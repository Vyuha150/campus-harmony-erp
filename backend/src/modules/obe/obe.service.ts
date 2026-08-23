/**
 * OBE attainment service.
 *
 * Loads real marks and computes CO and PO attainment through the pure functions
 * in `attainment.ts`.
 *
 * WHAT WAS MISSING BEFORE THIS
 *
 * Migration 0007 added CourseOutcome, ProgrammeOutcome and CoPoMapping, so the
 * repository looked like it supported outcome-based education. Nothing linked
 * student marks to an outcome: `CourseResult` records only course totals.
 *
 * The available shortcut — split a student's course total evenly across that
 * course's COs — would have produced a full set of attainment figures in an
 * afternoon. Every CO would attain identically by construction, the numbers
 * would look plausible, and they could end up in an accreditation submission.
 * Migration 0015 adds the missing link instead.
 */

import { basePrisma } from '../../lib/prisma.js';
import { mutate } from '../../lib/service.js';
import { NotFoundError, ValidationError, BusinessRuleError } from '../../lib/errors.js';
import type { TenantContext } from '../../lib/tenant.js';
import {
  computeCoDirectAttainment,
  computePoAttainment,
  blendAttainment,
  aggregateStudentCoScores,
  validateCoDistribution,
  type AttainmentPolicy,
  type CoAttainment,
  type PoAttainment,
  type CoPoLink
} from './attainment.js';

/**
 * The institution's attainment policy.
 *
 * Throws when absent rather than substituting defaults. Migration 0015 creates
 * one row per institution; a missing row means something is wrong, and inventing
 * thresholds at runtime would produce attainment figures the institution could
 * not defend to an assessor — precisely the fabrication pattern this codebase
 * has been removing.
 */
export async function getPolicy(context: TenantContext): Promise<AttainmentPolicy> {
  const policy = await basePrisma.obeAttainmentPolicy.findFirst({
    where: { institutionId: context.institutionId }
  });

  if (!policy) {
    throw new NotFoundError(
      'OBE attainment policy for this institution. It should have been created by migration 0015 — create one before computing attainment rather than relying on defaults, since every threshold is institutional policy'
    );
  }

  return {
    studentTargetPercent: policy.studentTargetPercent,
    level3Percent: policy.level3Percent,
    level2Percent: policy.level2Percent,
    level1Percent: policy.level1Percent,
    directWeight: policy.directWeight,
    indirectWeight: policy.indirectWeight,
    maxLevel: policy.maxLevel
  };
}

// ─── Assessments ─────────────────────────────────────────────────────────────

export interface CreateAssessmentInput {
  schemeCourseId: string;
  academicYear: string;
  name: string;
  type: string;
  maxMarks: number;
  weightPercent?: number | undefined;
  conductedOn?: Date | undefined;
  sectionId?: string | undefined;
  /** CO-wise mark distribution. Must total `maxMarks`. */
  outcomes: Array<{ courseOutcomeId: string; maxMarks: number }>;
}

export async function createAssessment(
  context: TenantContext,
  input: CreateAssessmentInput
): Promise<{ id: string; name: string; maxMarks: number; outcomes: number }> {
  const schemeCourse = await basePrisma.schemeCourse.findFirst({
    where: { id: input.schemeCourseId, institutionId: context.institutionId },
    select: { id: true, courseId: true }
  });

  if (!schemeCourse) {
    throw new NotFoundError(`Scheme course ${input.schemeCourseId}`);
  }

  const distribution = validateCoDistribution(input.maxMarks, input.outcomes);
  if (!distribution.ok) {
    throw new ValidationError(distribution.message, { field: 'outcomes' });
  }

  // Every named CO must belong to THIS course. Mapping an assessment to another
  // course's outcome would silently pollute that course's attainment.
  const validCos = await basePrisma.courseOutcome.findMany({
    where: {
      institutionId: context.institutionId,
      schemeCourseId: schemeCourse.id,
      id: { in: input.outcomes.map((o) => o.courseOutcomeId) }
    },
    select: { id: true, code: true }
  });

  const validIds = new Set(validCos.map((c) => c.id));
  const foreign = input.outcomes.filter((o) => !validIds.has(o.courseOutcomeId));

  if (foreign.length > 0) {
    throw new ValidationError(
      `Course outcome(s) ${foreign.map((f) => f.courseOutcomeId).join(', ')} do not belong to this course. ` +
        'An assessment may only be mapped to outcomes of the course it assesses.',
      { field: 'outcomes' }
    );
  }

  return mutate(
    context,
    {
      action: 'CREATE',
      module: 'obe',
      resource: (r) => `Assessment:${(r as { id: string }).id}`,
      details: `Created assessment "${input.name}" (${input.maxMarks} marks) mapped to ${input.outcomes.length} course outcome(s)`
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      const assessment = await db.assessment.create({
        data: {
          institutionId: context.institutionId,
          schemeCourseId: schemeCourse.id,
          academicYear: input.academicYear,
          sectionId: input.sectionId ?? null,
          name: input.name,
          type: input.type,
          maxMarks: input.maxMarks,
          weightPercent: input.weightPercent ?? 0,
          conductedOn: input.conductedOn ?? null,
          status: 'draft'
        }
      });

      for (const outcome of input.outcomes) {
        await db.assessmentOutcome.create({
          data: {
            assessmentId: assessment.id,
            courseOutcomeId: outcome.courseOutcomeId,
            maxMarks: outcome.maxMarks
          }
        });
      }

      return {
        id: assessment.id,
        name: assessment.name,
        maxMarks: assessment.maxMarks,
        outcomes: input.outcomes.length
      };
    }
  );
}

export interface MarkEntry {
  studentProfileId: string;
  courseOutcomeId: string;
  marksObtained: number;
  isAbsent?: boolean | undefined;
}

/**
 * Record CO-wise marks.
 *
 * Upserted on (assessment, student, CO), so correcting an entry replaces it
 * rather than adding a second row. An additive mark table would silently double
 * a student's score on re-entry, which is a correction people make routinely.
 */
export async function recordMarks(
  context: TenantContext,
  assessmentId: string,
  entries: MarkEntry[]
): Promise<{ recorded: number; assessment: string }> {
  const assessment = await basePrisma.assessment.findFirst({
    where: { id: assessmentId, institutionId: context.institutionId },
    include: { outcomes: true }
  });

  if (!assessment) {
    throw new NotFoundError(`Assessment ${assessmentId}`);
  }

  if (assessment.status === 'published') {
    throw new BusinessRuleError(
      `Assessment "${assessment.name}" is published. Marks contributing to attainment cannot be edited in place — unpublish it first, so the change is deliberate and recorded.`,
      { assessmentId, status: assessment.status }
    );
  }

  const coMax = new Map(assessment.outcomes.map((o) => [o.courseOutcomeId, o.maxMarks]));

  for (const entry of entries) {
    const max = coMax.get(entry.courseOutcomeId);

    if (max === undefined) {
      throw new ValidationError(
        `Course outcome ${entry.courseOutcomeId} is not part of assessment "${assessment.name}". Marks can only be recorded against outcomes the assessment measures.`,
        { field: 'courseOutcomeId' }
      );
    }

    if (!entry.isAbsent && entry.marksObtained > max) {
      // Caught here because this is where the CO's ceiling is known. A mark
      // above the maximum inflates attainment above 100% and is almost always a
      // data-entry slip.
      throw new ValidationError(
        `${entry.marksObtained} exceeds the ${max} marks allocated to this outcome in "${assessment.name}".`,
        { field: 'marksObtained', max }
      );
    }

    if (entry.marksObtained < 0) {
      throw new ValidationError('Marks cannot be negative.', { field: 'marksObtained' });
    }
  }

  // Students must belong to this institution.
  const studentIds = [...new Set(entries.map((e) => e.studentProfileId))];
  const students = await basePrisma.studentProfile.findMany({
    where: { id: { in: studentIds }, institutionId: context.institutionId },
    select: { id: true }
  });

  const known = new Set(students.map((s) => s.id));
  const unknown = studentIds.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw new NotFoundError(`Student profile(s) ${unknown.join(', ')}`);
  }

  return mutate(
    context,
    {
      action: 'UPDATE',
      module: 'obe',
      resource: `Assessment:${assessment.id}`,
      details: `Recorded ${entries.length} outcome-wise mark(s) for "${assessment.name}"`,
      severity: 'info'
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      for (const entry of entries) {
        const existing = await db.assessmentCoMark.findFirst({
          where: {
            assessmentId: assessment.id,
            studentProfileId: entry.studentProfileId,
            courseOutcomeId: entry.courseOutcomeId
          },
          select: { id: true }
        });

        if (existing) {
          await db.assessmentCoMark.updateMany({
            where: { id: existing.id },
            data: {
              marksObtained: entry.isAbsent ? 0 : entry.marksObtained,
              isAbsent: entry.isAbsent ?? false,
              recordedBy: context.userId
            }
          });
        } else {
          await db.assessmentCoMark.create({
            data: {
              institutionId: context.institutionId,
              assessmentId: assessment.id,
              studentProfileId: entry.studentProfileId,
              courseOutcomeId: entry.courseOutcomeId,
              marksObtained: entry.isAbsent ? 0 : entry.marksObtained,
              isAbsent: entry.isAbsent ?? false,
              recordedBy: context.userId
            }
          });
        }
      }

      return { recorded: entries.length, assessment: assessment.name };
    }
  );
}

/** Publish an assessment so its marks count toward attainment. */
export async function publishAssessment(
  context: TenantContext,
  assessmentId: string
): Promise<{ id: string; name: string; status: string; marksRecorded: number }> {
  const assessment = await basePrisma.assessment.findFirst({
    where: { id: assessmentId, institutionId: context.institutionId },
    include: { outcomes: true, marks: { select: { id: true } } }
  });

  if (!assessment) {
    throw new NotFoundError(`Assessment ${assessmentId}`);
  }

  if (assessment.marks.length === 0) {
    throw new BusinessRuleError(
      `Assessment "${assessment.name}" has no marks recorded. Publishing it would contribute an empty assessment to attainment.`,
      { assessmentId }
    );
  }

  return mutate(
    context,
    {
      action: 'UPDATE',
      module: 'obe',
      resource: `Assessment:${assessment.id}`,
      details: `Published "${assessment.name}" — its ${assessment.marks.length} mark(s) now contribute to outcome attainment`,
      // Publishing changes accreditation-facing figures.
      severity: 'warning'
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;
      await db.assessment.updateMany({
        where: { id: assessment.id, institutionId: context.institutionId },
        data: { status: 'published' }
      });
      return {
        id: assessment.id,
        name: assessment.name,
        status: 'published',
        marksRecorded: assessment.marks.length
      };
    }
  );
}

// ─── Attainment ──────────────────────────────────────────────────────────────

export interface CourseAttainmentReport {
  schemeCourse: { id: string; courseCode: string; courseName: string; semester: number };
  academicYear: string;
  policy: AttainmentPolicy;
  assessmentsIncluded: Array<{ id: string; name: string; type: string; maxMarks: number }>;
  assessmentsExcluded: Array<{ id: string; name: string; reason: string }>;
  outcomes: CoAttainment[];
  dataQualityWarnings: string[];
  provenance: {
    method: string;
    caveat: string;
    generatedAt: string;
    institutionId: string;
  };
}

/**
 * CO attainment for one course in one academic year.
 *
 * Only PUBLISHED assessments contribute. Draft assessments are listed as
 * excluded with the reason, so a figure that looks low because marks are still
 * in draft is distinguishable from one that is genuinely low.
 */
export async function courseAttainment(
  context: TenantContext,
  schemeCourseId: string,
  academicYear: string
): Promise<CourseAttainmentReport> {
  const policy = await getPolicy(context);

  const schemeCourse = await basePrisma.schemeCourse.findFirst({
    where: { id: schemeCourseId, institutionId: context.institutionId },
    include: { course: { select: { code: true, name: true } } }
  });

  if (!schemeCourse) {
    throw new NotFoundError(`Scheme course ${schemeCourseId}`);
  }

  const outcomes = await basePrisma.courseOutcome.findMany({
    where: { institutionId: context.institutionId, schemeCourseId },
    orderBy: { code: 'asc' }
  });

  if (outcomes.length === 0) {
    throw new BusinessRuleError(
      `No course outcomes are defined for ${schemeCourse.course.code}. Attainment cannot be computed until the COs are recorded.`,
      { schemeCourseId }
    );
  }

  const assessments = await basePrisma.assessment.findMany({
    where: { institutionId: context.institutionId, schemeCourseId, academicYear },
    include: { outcomes: true }
  });

  const published = assessments.filter((a) => a.status === 'published');
  const excluded = assessments
    .filter((a) => a.status !== 'published')
    .map((a) => ({
      id: a.id,
      name: a.name,
      reason: `Status is "${a.status}" — only published assessments contribute to attainment.`
    }));

  const warnings: string[] = [];

  if (published.length === 0) {
    warnings.push(
      assessments.length > 0
        ? `None of the ${assessments.length} assessment(s) for this course are published, so no attainment can be computed.`
        : 'No assessments exist for this course in this academic year.'
    );
  }

  // Marks, joined to their CO-wise maximum.
  const marks = published.length
    ? await basePrisma.assessmentCoMark.findMany({
        where: {
          institutionId: context.institutionId,
          assessmentId: { in: published.map((a) => a.id) }
        }
      })
    : [];

  const coMaxByAssessment = new Map<string, Map<string, number>>();
  for (const assessment of published) {
    coMaxByAssessment.set(
      assessment.id,
      new Map(assessment.outcomes.map((o) => [o.courseOutcomeId, o.maxMarks]))
    );
  }

  const scored = aggregateStudentCoScores(
    marks.map((m) => ({
      studentProfileId: m.studentProfileId,
      courseOutcomeId: m.courseOutcomeId,
      marksObtained: m.marksObtained,
      coMaxMarks: coMaxByAssessment.get(m.assessmentId)?.get(m.courseOutcomeId) ?? 0,
      isAbsent: m.isAbsent
    }))
  );

  const indirect = await basePrisma.indirectAttainment.findMany({
    where: {
      institutionId: context.institutionId,
      academicYear,
      courseOutcomeId: { in: outcomes.map((o) => o.id) }
    }
  });

  const indirectByCo = new Map(
    indirect.map((i) => [
      i.courseOutcomeId,
      { level: i.level, source: i.source, respondents: i.respondents }
    ])
  );

  const results: CoAttainment[] = outcomes.map((outcome) => {
    const direct = computeCoDirectAttainment(outcome.id, scored.get(outcome.id) ?? [], policy);
    const survey = indirectByCo.get(outcome.id) ?? null;
    const blended = blendAttainment(direct, survey, policy);

    if (direct.studentsAssessed === 0) {
      warnings.push(`${outcome.code}: no marks recorded — attainment NOT MEASURED.`);
    }

    return {
      ...direct,
      code: outcome.code,
      statement: outcome.statement,
      indirectLevel: survey?.level ?? null,
      indirectSource: survey?.source ?? null,
      indirectRespondents: survey?.respondents ?? null,
      finalLevel: blended.finalLevel,
      directOnly: blended.directOnly,
      explanation: `${direct.explanation} ${blended.note}`
    };
  });

  const directOnlyCount = results.filter((r) => r.directOnly).length;
  if (directOnlyCount > 0 && published.length > 0) {
    warnings.push(
      `${directOnlyCount} of ${results.length} outcome(s) have no indirect (survey) attainment recorded. ` +
        `Those figures are DIRECT ONLY and are not the ${policy.directWeight}/${policy.indirectWeight} blend the institution's policy defines.`
    );
  }

  return {
    schemeCourse: {
      id: schemeCourse.id,
      courseCode: schemeCourse.course.code,
      courseName: schemeCourse.course.name,
      semester: schemeCourse.semester
    },
    academicYear,
    policy,
    assessmentsIncluded: published.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      maxMarks: a.maxMarks
    })),
    assessmentsExcluded: excluded,
    outcomes: results,
    dataQualityWarnings: warnings,
    provenance: {
      method:
        'Direct attainment: proportion of assessed students scoring at or above the target percentage, mapped onto the institution\'s level bands. Absent students excluded. Indirect attainment blended where recorded.',
      caveat:
        'NBA does not prescribe an attainment formula. Every threshold, level band and weight used here comes from this institution\'s recorded ObeAttainmentPolicy and must match its published OBE manual. This output must NOT be described as "NBA compliant".',
      generatedAt: new Date().toISOString(),
      institutionId: context.institutionId
    }
  };
}

export interface ProgrammeAttainmentReport {
  programme: { id: string; code: string; name: string };
  scheme: { id: string; code: string };
  academicYear: string;
  policy: AttainmentPolicy;
  outcomes: PoAttainment[];
  coverage: {
    coursesConsidered: number;
    courseOutcomesTotal: number;
    courseOutcomesMeasured: number;
    unmappedProgrammeOutcomes: string[];
  };
  dataQualityWarnings: string[];
  provenance: { method: string; caveat: string; generatedAt: string; institutionId: string };
}

/**
 * PO/PSO attainment across every course in a scheme.
 *
 * Rolls CO attainment up through `CoPoMapping`, weighted by correlation
 * strength. Coverage is reported explicitly: a PO computed from 2 of 40
 * contributing COs is not the same claim as one computed from all 40, and the
 * difference is invisible in the number alone.
 */
export async function programmeAttainment(
  context: TenantContext,
  schemeId: string,
  academicYear: string
): Promise<ProgrammeAttainmentReport> {
  const policy = await getPolicy(context);

  const scheme = await basePrisma.curriculumScheme.findFirst({
    where: { id: schemeId, institutionId: context.institutionId },
    include: { programme: { select: { id: true, code: true, name: true } } }
  });

  if (!scheme) {
    throw new NotFoundError(`Curriculum scheme ${schemeId}`);
  }

  const programmeOutcomes = await basePrisma.programmeOutcome.findMany({
    where: { institutionId: context.institutionId, schemeId },
    orderBy: [{ type: 'asc' }, { code: 'asc' }]
  });

  if (programmeOutcomes.length === 0) {
    throw new BusinessRuleError(
      'No programme outcomes are defined for this scheme. PO attainment cannot be computed until they are recorded.',
      { schemeId }
    );
  }

  const schemeCourses = await basePrisma.schemeCourse.findMany({
    where: { institutionId: context.institutionId, schemeId },
    select: { id: true }
  });

  // CO attainment per course, reusing the same computation as the course report
  // so the two can never disagree.
  const coLevels = new Map<string, { level: number; code: string; measured: boolean }>();
  const warnings: string[] = [];
  let coTotal = 0;
  let coMeasured = 0;

  for (const schemeCourse of schemeCourses) {
    let report: CourseAttainmentReport;
    try {
      report = await courseAttainment(context, schemeCourse.id, academicYear);
    } catch (error) {
      // A course with no COs defined is a gap to report, not a reason to abort
      // the whole programme roll-up.
      if (error instanceof BusinessRuleError) continue;
      throw error;
    }

    for (const outcome of report.outcomes) {
      coTotal++;
      const measured = outcome.studentsAssessed > 0;
      if (measured) coMeasured++;

      coLevels.set(outcome.courseOutcomeId, {
        level: outcome.finalLevel,
        code: `${report.schemeCourse.courseCode}.${outcome.code}`,
        measured
      });
    }
  }

  const mappings = await basePrisma.coPoMapping.findMany({
    where: {
      institutionId: context.institutionId,
      programmeOutcomeId: { in: programmeOutcomes.map((p) => p.id) }
    }
  });

  const linksByPo = new Map<string, CoPoLink[]>();
  for (const mapping of mappings) {
    const list = linksByPo.get(mapping.programmeOutcomeId) ?? [];
    list.push({
      courseOutcomeId: mapping.courseOutcomeId,
      programmeOutcomeId: mapping.programmeOutcomeId,
      strength: mapping.strength
    });
    linksByPo.set(mapping.programmeOutcomeId, list);
  }

  const unmapped: string[] = [];

  const results = programmeOutcomes.map((po) => {
    const links = linksByPo.get(po.id) ?? [];
    if (links.length === 0) unmapped.push(po.code);

    return computePoAttainment(
      {
        id: po.id,
        code: po.code,
        statement: po.statement,
        type: po.type,
        attainmentThreshold: po.attainmentThreshold
      },
      links,
      coLevels,
      policy
    );
  });

  if (unmapped.length > 0) {
    warnings.push(
      `${unmapped.length} programme outcome(s) have NO course outcome mapped to them (${unmapped.join(', ')}). ` +
        'These cannot be attained by construction — the curriculum does not currently address them anywhere.'
    );
  }

  if (coTotal > 0 && coMeasured < coTotal) {
    warnings.push(
      `Only ${coMeasured} of ${coTotal} course outcome(s) have recorded marks. ` +
        'Programme attainment is computed from the measured subset; unmeasured outcomes are excluded rather than counted as zero, so these figures describe partial coverage.'
    );
  }

  if (coMeasured === 0) {
    warnings.push(
      'NO course outcome in this scheme has any recorded marks. Every figure below is NOT MEASURED, which is not the same as not attained.'
    );
  }

  return {
    programme: scheme.programme,
    scheme: { id: scheme.id, code: scheme.code },
    academicYear,
    policy,
    outcomes: results,
    coverage: {
      coursesConsidered: schemeCourses.length,
      courseOutcomesTotal: coTotal,
      courseOutcomesMeasured: coMeasured,
      unmappedProgrammeOutcomes: unmapped
    },
    dataQualityWarnings: warnings,
    provenance: {
      method:
        'PO attainment is the correlation-strength-weighted mean of contributing CO attainment levels, expressed as a percentage of the policy maximum. Unmeasured COs are excluded, not counted as zero.',
      caveat:
        'NBA does not prescribe an attainment formula. Thresholds, level bands and weights come from this institution\'s recorded ObeAttainmentPolicy and must match its published OBE manual. This output must NOT be described as "NBA compliant".',
      generatedAt: new Date().toISOString(),
      institutionId: context.institutionId
    }
  };
}

/** Record indirect (survey) attainment for a course outcome. */
export async function recordIndirectAttainment(
  context: TenantContext,
  input: {
    courseOutcomeId: string;
    academicYear: string;
    source: string;
    level: number;
    respondents: number;
  }
): Promise<{ id: string; source: string; level: number }> {
  const policy = await getPolicy(context);

  if (input.level < 0 || input.level > policy.maxLevel) {
    throw new ValidationError(
      `Attainment level must be between 0 and ${policy.maxLevel}, the maximum on this institution's scale.`,
      { field: 'level', maxLevel: policy.maxLevel }
    );
  }

  const outcome = await basePrisma.courseOutcome.findFirst({
    where: { id: input.courseOutcomeId, institutionId: context.institutionId },
    select: { id: true, code: true }
  });

  if (!outcome) {
    throw new NotFoundError(`Course outcome ${input.courseOutcomeId}`);
  }

  return mutate(
    context,
    {
      action: 'CREATE',
      module: 'obe',
      resource: `CourseOutcome:${outcome.id}`,
      details: `Recorded indirect attainment ${input.level} for ${outcome.code} from "${input.source}" (${input.respondents} respondents)`
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      const existing = await db.indirectAttainment.findFirst({
        where: {
          courseOutcomeId: outcome.id,
          academicYear: input.academicYear,
          source: input.source
        },
        select: { id: true }
      });

      if (existing) {
        await db.indirectAttainment.updateMany({
          where: { id: existing.id },
          data: {
            level: input.level,
            respondents: input.respondents,
            recordedBy: context.userId
          }
        });
        return { id: existing.id, source: input.source, level: input.level };
      }

      const created = await db.indirectAttainment.create({
        data: {
          institutionId: context.institutionId,
          courseOutcomeId: outcome.id,
          academicYear: input.academicYear,
          source: input.source,
          level: input.level,
          respondents: input.respondents,
          recordedBy: context.userId
        }
      });

      return { id: created.id, source: created.source, level: created.level };
    }
  );
}
