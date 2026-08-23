/**
 * Outcome attainment computation.
 *
 * Pure functions, deliberately free of Prisma so the arithmetic can be checked
 * against a worked example rather than inspected by eye.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * A NECESSARY CAVEAT ABOUT "NBA COMPLIANCE"
 *
 * The method below is the one commonly used by Indian engineering institutions
 * for outcome-based accreditation, but NBA does NOT prescribe a formula.
 * Thresholds, level bands and the direct/indirect blend are set by each
 * institution and published in its own OBE manual.
 *
 * Every number this module uses therefore comes from `ObeAttainmentPolicy` —
 * none is hardcoded. This code must not be described as "NBA compliant"; it
 * computes what the institution's stated policy says, and reports that policy
 * alongside every figure so an assessor can check the derivation.
 * ─────────────────────────────────────────────────────────────────────────
 */

export interface AttainmentPolicy {
  /** A student attains a CO at or above this percentage. */
  studentTargetPercent: number;
  /** Percentage of students that must reach the target, per level. */
  level3Percent: number;
  level2Percent: number;
  level1Percent: number;
  directWeight: number;
  indirectWeight: number;
  maxLevel: number;
}

/** One student's marks against one CO, aggregated across assessments. */
export interface StudentCoScore {
  studentProfileId: string;
  obtained: number;
  max: number;
  /** True when the student was absent for EVERY assessment touching this CO. */
  absentThroughout: boolean;
}

export interface CoDirectAttainment {
  courseOutcomeId: string;
  /** Students with at least one non-absent mark for this CO. */
  studentsAssessed: number;
  studentsAbsent: number;
  studentsMeetingTarget: number;
  /** Percentage of assessed students who met the target. */
  percentMeetingTarget: number;
  /** Mean score across assessed students, for context — NOT the attainment. */
  averagePercent: number;
  level: number;
  /** Plain-language derivation, carried with the figure. */
  explanation: string;
}

/** Round to 2dp without the float artefacts of `Math.round(x*100)/100`. */
function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(Math.round(Number(`${value}e2`)) + 'e-2');
}

/**
 * Direct attainment for one CO.
 *
 * Two decisions worth stating:
 *
 * ABSENTEES ARE EXCLUDED, not counted as zero. A student who missed the test
 * provides no evidence about whether the outcome was taught successfully, and
 * counting them as a zero depresses the figure for an unrelated reason. They are
 * reported separately so the exclusion is visible rather than silent.
 *
 * ATTAINMENT IS THE PROPORTION CLEARING A TARGET, not the class average. A
 * cohort where everyone scores 59% against a 60% target has a high average and
 * zero attainment — which is the entire point of the measure, and the reason
 * `averagePercent` is reported for context but never used as the level.
 */
export function computeCoDirectAttainment(
  courseOutcomeId: string,
  scores: StudentCoScore[],
  policy: AttainmentPolicy
): CoDirectAttainment {
  const absent = scores.filter((s) => s.absentThroughout);
  const assessed = scores.filter((s) => !s.absentThroughout && s.max > 0);

  if (assessed.length === 0) {
    return {
      courseOutcomeId,
      studentsAssessed: 0,
      studentsAbsent: absent.length,
      studentsMeetingTarget: 0,
      percentMeetingTarget: 0,
      averagePercent: 0,
      // NOT zero-as-a-result: there is no evidence either way. The caller must
      // distinguish "not attained" from "not measured", so this is surfaced
      // through the explanation and a zero studentsAssessed count.
      level: 0,
      explanation:
        absent.length > 0
          ? `No student was assessed on this outcome (${absent.length} absent). Attainment is NOT MEASURED, which is different from not attained.`
          : 'No marks recorded against this outcome. Attainment is NOT MEASURED, which is different from not attained.'
    };
  }

  const percentages = assessed.map((s) => (s.obtained / s.max) * 100);
  const meeting = percentages.filter((p) => p >= policy.studentTargetPercent).length;
  const percentMeeting = (meeting / assessed.length) * 100;
  const average = percentages.reduce((total, p) => total + p, 0) / assessed.length;

  const level = levelFor(percentMeeting, policy);

  const absentNote =
    absent.length > 0
      ? ` ${absent.length} absent student(s) excluded — counting an absence as zero would depress the figure for a reason unrelated to teaching.`
      : '';

  return {
    courseOutcomeId,
    studentsAssessed: assessed.length,
    studentsAbsent: absent.length,
    studentsMeetingTarget: meeting,
    percentMeetingTarget: round2(percentMeeting),
    averagePercent: round2(average),
    level,
    explanation:
      `${meeting} of ${assessed.length} assessed student(s) scored at or above the ${policy.studentTargetPercent}% target ` +
      `= ${round2(percentMeeting)}%, which the institution's policy places at level ${level} ` +
      `(>=${policy.level3Percent}% → 3, >=${policy.level2Percent}% → 2, >=${policy.level1Percent}% → 1).${absentNote}`
  };
}

/** Map "percentage of students clearing the target" onto the policy's levels. */
export function levelFor(percentMeetingTarget: number, policy: AttainmentPolicy): number {
  if (percentMeetingTarget >= policy.level3Percent) return 3;
  if (percentMeetingTarget >= policy.level2Percent) return 2;
  if (percentMeetingTarget >= policy.level1Percent) return 1;
  return 0;
}

export interface CoAttainment extends CoDirectAttainment {
  code: string;
  statement: string;
  /** Recorded survey level, when one exists. */
  indirectLevel: number | null;
  indirectSource: string | null;
  indirectRespondents: number | null;
  /** Blend of direct and indirect, or the direct level when none is recorded. */
  finalLevel: number;
  /** True when no indirect evidence exists — the figure is direct-only. */
  directOnly: boolean;
}

/**
 * Blend direct and indirect attainment.
 *
 * When no survey is recorded the direct level is used AS-IS and flagged
 * `directOnly`. The alternative — treating a missing survey as zero — would
 * drag every CO down by the indirect weight and produce a figure that looks
 * computed but reflects a gap in data collection, not in learning.
 */
export function blendAttainment(
  direct: CoDirectAttainment,
  indirect: { level: number; source: string; respondents: number } | null,
  policy: AttainmentPolicy
): { finalLevel: number; directOnly: boolean; note: string } {
  if (!indirect) {
    return {
      finalLevel: direct.level,
      directOnly: true,
      note:
        'DIRECT ONLY — no indirect (survey) attainment is recorded for this outcome. ' +
        `The institution's policy weights direct ${policy.directWeight}% / indirect ${policy.indirectWeight}%, ` +
        'so this figure is not the policy-defined blend. Record course-exit survey results to complete it.'
    };
  }

  const blended =
    (direct.level * policy.directWeight + indirect.level * policy.indirectWeight) / 100;

  return {
    finalLevel: round2(blended),
    directOnly: false,
    note:
      `(direct ${direct.level} x ${policy.directWeight}% + indirect ${indirect.level} x ${policy.indirectWeight}%) / 100 ` +
      `= ${round2(blended)}, from "${indirect.source}" (${indirect.respondents} respondent(s)).`
  };
}

export interface CoPoLink {
  courseOutcomeId: string;
  programmeOutcomeId: string;
  /** 1 slight, 2 moderate, 3 substantial. */
  strength: number;
}

export interface PoAttainment {
  programmeOutcomeId: string;
  code: string;
  statement: string;
  type: string;
  /** Contributing COs and what each contributed. */
  contributions: Array<{
    courseOutcomeId: string;
    code: string;
    level: number;
    strength: number;
  }>;
  /** Strength-weighted mean of contributing CO levels. */
  attainmentLevel: number;
  /** As a percentage of the scale's maximum, which is what reports quote. */
  attainmentPercent: number;
  /** The institution's threshold for this PO. */
  thresholdPercent: number;
  attained: boolean;
  explanation: string;
}

/**
 * PO attainment as a strength-weighted mean of contributing CO levels.
 *
 * The weighting is the reason `CoPoMapping.strength` exists: a CO substantially
 * addressing a PO (3) should count for more than one touching it slightly (1).
 * An unweighted mean would let a large number of weak mappings swamp a strong one.
 *
 * COs with NO measurement are excluded rather than counted as zero — same
 * reasoning as absent students. A PO whose contributing COs were all unmeasured
 * returns `attainmentLevel: 0` with an explanation saying so, and the caller
 * must not read that as "not attained".
 */
export function computePoAttainment(
  po: { id: string; code: string; statement: string; type: string; attainmentThreshold: number },
  links: CoPoLink[],
  coLevels: Map<string, { level: number; code: string; measured: boolean }>,
  policy: AttainmentPolicy
): PoAttainment {
  const contributions: PoAttainment['contributions'] = [];
  let weightedSum = 0;
  let weightTotal = 0;
  let unmeasured = 0;

  for (const link of links) {
    const co = coLevels.get(link.courseOutcomeId);
    if (!co) continue;

    if (!co.measured) {
      unmeasured++;
      continue;
    }

    contributions.push({
      courseOutcomeId: link.courseOutcomeId,
      code: co.code,
      level: co.level,
      strength: link.strength
    });

    weightedSum += co.level * link.strength;
    weightTotal += link.strength;
  }

  if (weightTotal === 0) {
    return {
      programmeOutcomeId: po.id,
      code: po.code,
      statement: po.statement,
      type: po.type,
      contributions: [],
      attainmentLevel: 0,
      attainmentPercent: 0,
      thresholdPercent: po.attainmentThreshold,
      attained: false,
      explanation:
        unmeasured > 0
          ? `NOT MEASURED — ${unmeasured} contributing course outcome(s) have no recorded marks. This is not the same as "not attained": there is no evidence either way.`
          : 'NOT MEASURED — no course outcomes are mapped to this programme outcome.'
    };
  }

  const level = weightedSum / weightTotal;
  const percent = (level / policy.maxLevel) * 100;

  const workings = contributions
    .map((c) => `${c.code}(L${c.level} x ${c.strength})`)
    .join(' + ');

  const unmeasuredNote =
    unmeasured > 0
      ? ` ${unmeasured} mapped CO(s) excluded as unmeasured — including them as zero would understate this outcome.`
      : '';

  return {
    programmeOutcomeId: po.id,
    code: po.code,
    statement: po.statement,
    type: po.type,
    contributions,
    attainmentLevel: round2(level),
    attainmentPercent: round2(percent),
    thresholdPercent: po.attainmentThreshold,
    attained: percent >= po.attainmentThreshold,
    explanation:
      `Strength-weighted mean of contributing CO levels: (${workings}) / ${weightTotal} = ${round2(level)} ` +
      `of a maximum ${policy.maxLevel} = ${round2(percent)}%, against a ${po.attainmentThreshold}% threshold.${unmeasuredNote}`
  };
}

/**
 * Aggregate a student's marks for one CO across several assessments.
 *
 * Summed obtained over summed max, NOT a mean of per-assessment percentages —
 * the latter gives a 5-mark quiz the same influence as a 50-mark exam.
 */
export function aggregateStudentCoScores(
  marks: Array<{
    studentProfileId: string;
    courseOutcomeId: string;
    marksObtained: number;
    coMaxMarks: number;
    isAbsent: boolean;
  }>
): Map<string, StudentCoScore[]> {
  const byCo = new Map<string, Map<string, StudentCoScore>>();

  for (const mark of marks) {
    let students = byCo.get(mark.courseOutcomeId);
    if (!students) {
      students = new Map();
      byCo.set(mark.courseOutcomeId, students);
    }

    let score = students.get(mark.studentProfileId);
    if (!score) {
      score = {
        studentProfileId: mark.studentProfileId,
        obtained: 0,
        max: 0,
        absentThroughout: true
      };
      students.set(mark.studentProfileId, score);
    }

    if (mark.isAbsent) {
      // An absence contributes neither marks nor denominator. A student absent
      // for one of three assessments is still assessed on the other two.
      continue;
    }

    score.obtained += mark.marksObtained;
    score.max += mark.coMaxMarks;
    score.absentThroughout = false;
  }

  const result = new Map<string, StudentCoScore[]>();
  for (const [coId, students] of byCo) {
    result.set(coId, [...students.values()]);
  }
  return result;
}

/** Validate that an assessment's CO-wise distribution adds up. */
export function validateCoDistribution(
  assessmentMaxMarks: number,
  distribution: Array<{ courseOutcomeId: string; maxMarks: number }>
): { ok: true } | { ok: false; message: string } {
  if (distribution.length === 0) {
    return {
      ok: false,
      message:
        'An assessment must map at least one course outcome, otherwise its marks cannot contribute to attainment.'
    };
  }

  const total = distribution.reduce((sum, d) => sum + d.maxMarks, 0);

  // Half a mark of tolerance for fractional splits; anything larger is an
  // error that would distort every figure derived from this assessment.
  if (Math.abs(total - assessmentMaxMarks) > 0.5) {
    return {
      ok: false,
      message:
        `The CO-wise mark distribution totals ${round2(total)} but the assessment is out of ${assessmentMaxMarks}. ` +
        'Every mark must be attributed to exactly one outcome, or attainment computed from this assessment will be wrong.'
    };
  }

  return { ok: true };
}
