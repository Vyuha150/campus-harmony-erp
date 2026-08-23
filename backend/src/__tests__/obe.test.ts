/**
 * OBE attainment tests.
 *
 * The arithmetic is checked against hand-computed examples rather than
 * inspected by eye. An attainment figure can end up in an accreditation
 * submission, so "it looks about right" is not a standard.
 */

import { describe, it, expect } from 'vitest';
import {
  computeCoDirectAttainment,
  computePoAttainment,
  blendAttainment,
  aggregateStudentCoScores,
  validateCoDistribution,
  levelFor,
  type AttainmentPolicy
} from '../modules/obe/attainment.js';

/** A conventional policy: 60% target, 70/60/50 level bands, 80/20 blend. */
const policy: AttainmentPolicy = {
  studentTargetPercent: 60,
  level3Percent: 70,
  level2Percent: 60,
  level1Percent: 50,
  directWeight: 80,
  indirectWeight: 20,
  maxLevel: 3
};

function scores(pairs: Array<[string, number, number]>, absent: string[] = []) {
  return [
    ...pairs.map(([id, obtained, max]) => ({
      studentProfileId: id,
      obtained,
      max,
      absentThroughout: false
    })),
    ...absent.map((id) => ({
      studentProfileId: id,
      obtained: 0,
      max: 0,
      absentThroughout: true
    }))
  ];
}

describe('level bands', () => {
  it('maps the proportion clearing the target onto the policy levels', () => {
    expect(levelFor(85, policy)).toBe(3);
    expect(levelFor(70, policy)).toBe(3); // boundary is inclusive
    expect(levelFor(69.9, policy)).toBe(2);
    expect(levelFor(60, policy)).toBe(2);
    expect(levelFor(50, policy)).toBe(1);
    expect(levelFor(49.9, policy)).toBe(0);
  });

  it("honours a DIFFERENT institution's bands", () => {
    // The bands are policy, not a standard. A stricter institution must get
    // stricter results from the same marks.
    const strict: AttainmentPolicy = { ...policy, level3Percent: 90, level2Percent: 80, level1Percent: 70 };
    expect(levelFor(85, strict)).toBe(2);
    expect(levelFor(85, policy)).toBe(3);
  });
});

describe('CO direct attainment', () => {
  it('matches a hand-computed example', () => {
    // 10 students, target 60%. Scores out of 20:
    //   14,16,18,12,13 -> 70,80,90,60,65%  = 5 at or above 60
    //   10,11, 9, 8, 7 -> 50,55,45,40,35%  = 5 below
    // 5/10 = 50% clearing the target -> level 1 under this policy.
    const result = computeCoDirectAttainment(
      'co-1',
      scores([
        ['s1', 14, 20], ['s2', 16, 20], ['s3', 18, 20], ['s4', 12, 20], ['s5', 13, 20],
        ['s6', 10, 20], ['s7', 11, 20], ['s8', 9, 20], ['s9', 8, 20], ['s10', 7, 20]
      ]),
      policy
    );

    expect(result.studentsAssessed).toBe(10);
    expect(result.studentsMeetingTarget).toBe(5);
    expect(result.percentMeetingTarget).toBe(50);
    expect(result.level).toBe(1);
  });

  it('counts a student exactly ON the target as having met it', () => {
    // 12/20 = 60%, exactly the target. Excluding them would be an off-by-one
    // that quietly lowers every cohort's attainment.
    const result = computeCoDirectAttainment('co-1', scores([['s1', 12, 20]]), policy);
    expect(result.studentsMeetingTarget).toBe(1);
  });

  it('is the proportion clearing the target, NOT the class average', () => {
    // Everyone scores 59% — a high average, and zero attainment. This is the
    // whole point of the measure.
    const result = computeCoDirectAttainment(
      'co-1',
      scores([['s1', 59, 100], ['s2', 59, 100], ['s3', 59, 100]]),
      policy
    );
    expect(result.averagePercent).toBe(59);
    expect(result.percentMeetingTarget).toBe(0);
    expect(result.level).toBe(0);
  });

  it('EXCLUDES absent students rather than scoring them zero', () => {
    // 3 present, all clearing the target; 2 absent. Attainment is 100%, not 60%.
    // Counting an absence as zero would depress the figure for a reason that has
    // nothing to do with whether the outcome was taught.
    const result = computeCoDirectAttainment(
      'co-1',
      scores([['s1', 18, 20], ['s2', 17, 20], ['s3', 16, 20]], ['s4', 's5']),
      policy
    );

    expect(result.studentsAssessed).toBe(3);
    expect(result.studentsAbsent).toBe(2);
    expect(result.percentMeetingTarget).toBe(100);
    expect(result.level).toBe(3);
    expect(result.explanation).toMatch(/2 absent/);
  });

  it('reports NOT MEASURED, distinct from not attained, when there are no marks', () => {
    // The distinction that matters most: a level of 0 from no data is not
    // evidence of failure.
    const result = computeCoDirectAttainment('co-1', [], policy);
    expect(result.studentsAssessed).toBe(0);
    expect(result.level).toBe(0);
    expect(result.explanation).toMatch(/NOT MEASURED/);
    expect(result.explanation).toMatch(/different from not attained/);
  });

  it('reports NOT MEASURED when every student was absent', () => {
    const result = computeCoDirectAttainment('co-1', scores([], ['s1', 's2']), policy);
    expect(result.studentsAssessed).toBe(0);
    expect(result.explanation).toMatch(/NOT MEASURED/);
  });

  it('shows its own arithmetic', () => {
    // The derivation is the deliverable; an assessor cannot check a bare number.
    const result = computeCoDirectAttainment('co-1', scores([['s1', 18, 20], ['s2', 5, 20]]), policy);
    expect(result.explanation).toContain('1 of 2');
    expect(result.explanation).toContain('60%');
    expect(result.explanation).toMatch(/level \d/);
  });
});

describe('aggregating across assessments', () => {
  it('sums marks and maxima, not per-assessment percentages', () => {
    // A 5-mark quiz must not carry the same weight as a 50-mark exam.
    // Correct:   (4 + 25) / (5 + 50) = 52.7%
    // Naive mean of percentages: (80% + 50%) / 2 = 65% — materially different,
    // and would flip this student across a 60% target.
    const aggregated = aggregateStudentCoScores([
      { studentProfileId: 's1', courseOutcomeId: 'co-1', marksObtained: 4, coMaxMarks: 5, isAbsent: false },
      { studentProfileId: 's1', courseOutcomeId: 'co-1', marksObtained: 25, coMaxMarks: 50, isAbsent: false }
    ]);

    const score = aggregated.get('co-1')![0]!;
    expect(score.obtained).toBe(29);
    expect(score.max).toBe(55);
    expect((score.obtained / score.max) * 100).toBeCloseTo(52.73, 1);
  });

  it('excludes an absence from BOTH numerator and denominator', () => {
    // Absent for the quiz, present for the exam: assessed on 50 marks, not 55.
    const aggregated = aggregateStudentCoScores([
      { studentProfileId: 's1', courseOutcomeId: 'co-1', marksObtained: 0, coMaxMarks: 5, isAbsent: true },
      { studentProfileId: 's1', courseOutcomeId: 'co-1', marksObtained: 40, coMaxMarks: 50, isAbsent: false }
    ]);

    const score = aggregated.get('co-1')![0]!;
    expect(score.max).toBe(50);
    expect(score.obtained).toBe(40);
    expect(score.absentThroughout).toBe(false);
  });

  it('marks a student absent throughout only when absent for every assessment', () => {
    const aggregated = aggregateStudentCoScores([
      { studentProfileId: 's1', courseOutcomeId: 'co-1', marksObtained: 0, coMaxMarks: 5, isAbsent: true },
      { studentProfileId: 's1', courseOutcomeId: 'co-1', marksObtained: 0, coMaxMarks: 50, isAbsent: true }
    ]);
    expect(aggregated.get('co-1')![0]!.absentThroughout).toBe(true);
  });

  it('separates students and outcomes', () => {
    const aggregated = aggregateStudentCoScores([
      { studentProfileId: 's1', courseOutcomeId: 'co-1', marksObtained: 5, coMaxMarks: 10, isAbsent: false },
      { studentProfileId: 's2', courseOutcomeId: 'co-1', marksObtained: 8, coMaxMarks: 10, isAbsent: false },
      { studentProfileId: 's1', courseOutcomeId: 'co-2', marksObtained: 9, coMaxMarks: 10, isAbsent: false }
    ]);

    expect(aggregated.get('co-1')).toHaveLength(2);
    expect(aggregated.get('co-2')).toHaveLength(1);
  });
});

describe('direct/indirect blend', () => {
  it('blends by the policy weights', () => {
    // (3 x 80 + 2 x 20) / 100 = 2.8
    const direct = computeCoDirectAttainment('co-1', scores([['s1', 20, 20]]), policy);
    expect(direct.level).toBe(3);

    const blended = blendAttainment(direct, { level: 2, source: 'Course exit survey', respondents: 45 }, policy);
    expect(blended.finalLevel).toBe(2.8);
    expect(blended.directOnly).toBe(false);
  });

  it('uses the direct level AS-IS when no survey exists, and says so', () => {
    // Treating a missing survey as zero would drag every CO down by the
    // indirect weight — a figure that looks computed but reflects a gap in data
    // collection rather than in learning.
    const direct = computeCoDirectAttainment('co-1', scores([['s1', 20, 20]]), policy);
    const blended = blendAttainment(direct, null, policy);

    expect(blended.finalLevel).toBe(3);
    expect(blended.finalLevel).not.toBe(2.4); // what 3 x 0.8 + 0 x 0.2 would give
    expect(blended.directOnly).toBe(true);
    expect(blended.note).toMatch(/DIRECT ONLY/);
  });
});

describe('PO attainment', () => {
  const po = {
    id: 'po-1',
    code: 'PO1',
    statement: 'Engineering knowledge',
    type: 'PO',
    attainmentThreshold: 60
  };

  it('matches a hand-computed strength-weighted mean', () => {
    // CO1 level 3 strength 3 -> 9
    // CO2 level 2 strength 2 -> 4
    // CO3 level 1 strength 1 -> 1
    // (9 + 4 + 1) / (3 + 2 + 1) = 14/6 = 2.3333 -> 2.33
    // As a percentage of max level 3: 77.78%
    const result = computePoAttainment(
      po,
      [
        { courseOutcomeId: 'co-1', programmeOutcomeId: 'po-1', strength: 3 },
        { courseOutcomeId: 'co-2', programmeOutcomeId: 'po-1', strength: 2 },
        { courseOutcomeId: 'co-3', programmeOutcomeId: 'po-1', strength: 1 }
      ],
      new Map([
        ['co-1', { level: 3, code: 'CS101.CO1', measured: true }],
        ['co-2', { level: 2, code: 'CS101.CO2', measured: true }],
        ['co-3', { level: 1, code: 'CS101.CO3', measured: true }]
      ]),
      policy
    );

    expect(result.attainmentLevel).toBe(2.33);
    expect(result.attainmentPercent).toBe(77.78);
    expect(result.attained).toBe(true);
  });

  it('weights by correlation strength, not equally', () => {
    // One substantial mapping at level 3 and two slight ones at level 0.
    // Weighted:   (3x3 + 0x1 + 0x1) / 5 = 1.8
    // Unweighted: (3 + 0 + 0) / 3       = 1.0
    // An unweighted mean would let weak mappings swamp the strong one — the
    // reason CoPoMapping.strength exists.
    const result = computePoAttainment(
      po,
      [
        { courseOutcomeId: 'co-1', programmeOutcomeId: 'po-1', strength: 3 },
        { courseOutcomeId: 'co-2', programmeOutcomeId: 'po-1', strength: 1 },
        { courseOutcomeId: 'co-3', programmeOutcomeId: 'po-1', strength: 1 }
      ],
      new Map([
        ['co-1', { level: 3, code: 'A.CO1', measured: true }],
        ['co-2', { level: 0, code: 'A.CO2', measured: true }],
        ['co-3', { level: 0, code: 'A.CO3', measured: true }]
      ]),
      policy
    );

    expect(result.attainmentLevel).toBe(1.8);
  });

  it('EXCLUDES unmeasured COs instead of counting them as zero', () => {
    // CO1 measured at level 3; CO2 never assessed.
    // Counting CO2 as zero gives (3x1 + 0x1)/2 = 1.5 — understating a PO for a
    // reason that is about data collection, not learning.
    const result = computePoAttainment(
      po,
      [
        { courseOutcomeId: 'co-1', programmeOutcomeId: 'po-1', strength: 1 },
        { courseOutcomeId: 'co-2', programmeOutcomeId: 'po-1', strength: 1 }
      ],
      new Map([
        ['co-1', { level: 3, code: 'A.CO1', measured: true }],
        ['co-2', { level: 0, code: 'A.CO2', measured: false }]
      ]),
      policy
    );

    expect(result.attainmentLevel).toBe(3);
    expect(result.contributions).toHaveLength(1);
    expect(result.explanation).toMatch(/1 mapped CO\(s\) excluded as unmeasured/);
  });

  it('reports NOT MEASURED when every contributing CO is unmeasured', () => {
    const result = computePoAttainment(
      po,
      [{ courseOutcomeId: 'co-1', programmeOutcomeId: 'po-1', strength: 3 }],
      new Map([['co-1', { level: 0, code: 'A.CO1', measured: false }]]),
      policy
    );

    expect(result.attainmentLevel).toBe(0);
    expect(result.attained).toBe(false);
    expect(result.explanation).toMatch(/NOT MEASURED/);
    expect(result.explanation).toMatch(/not the same as "not attained"/);
  });

  it('flags a PO with NO course outcome mapped to it', () => {
    // Attainable by construction only if something teaches it. Silence here
    // would hide a genuine curriculum gap.
    const result = computePoAttainment(po, [], new Map(), policy);
    expect(result.explanation).toMatch(/no course outcomes are mapped/i);
  });

  it("compares against the PO's OWN threshold", () => {
    const strictPo = { ...po, attainmentThreshold: 90 };
    const coLevels = new Map([['co-1', { level: 2, code: 'A.CO1', measured: true }]]);
    const links = [{ courseOutcomeId: 'co-1', programmeOutcomeId: 'po-1', strength: 1 }];

    // 2/3 = 66.67%: attained against 60, not attained against 90.
    expect(computePoAttainment(po, links, coLevels, policy).attained).toBe(true);
    expect(computePoAttainment(strictPo, links, coLevels, policy).attained).toBe(false);
  });

  it('shows the workings', () => {
    const result = computePoAttainment(
      po,
      [{ courseOutcomeId: 'co-1', programmeOutcomeId: 'po-1', strength: 3 }],
      new Map([['co-1', { level: 3, code: 'CS101.CO1', measured: true }]]),
      policy
    );
    expect(result.explanation).toContain('CS101.CO1(L3 x 3)');
  });
});

describe('CO-wise mark distribution', () => {
  it('accepts a distribution that adds up', () => {
    expect(
      validateCoDistribution(50, [
        { courseOutcomeId: 'co-1', maxMarks: 20 },
        { courseOutcomeId: 'co-2', maxMarks: 30 }
      ]).ok
    ).toBe(true);
  });

  it('rejects a distribution that does not add up', () => {
    // A distribution summing to less than the paper means some marks are
    // attributed to no outcome, distorting every figure derived from it.
    const result = validateCoDistribution(50, [
      { courseOutcomeId: 'co-1', maxMarks: 20 },
      { courseOutcomeId: 'co-2', maxMarks: 20 }
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/totals 40 but the assessment is out of 50/);
  });

  it('rejects an assessment mapped to no outcome at all', () => {
    const result = validateCoDistribution(50, []);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/at least one course outcome/);
  });

  it('tolerates a half-mark of rounding on fractional splits', () => {
    expect(validateCoDistribution(50, [
      { courseOutcomeId: 'co-1', maxMarks: 16.67 },
      { courseOutcomeId: 'co-2', maxMarks: 16.67 },
      { courseOutcomeId: 'co-3', maxMarks: 16.66 }
    ]).ok).toBe(true);
  });
});

describe('module guarantees', () => {
  it('OBE models are tenant-owned', async () => {
    const { TENANT_OWNED_MODELS } = await import('../lib/tenantExtension.js');
    for (const model of ['Assessment', 'AssessmentCoMark', 'IndirectAttainment', 'ObeAttainmentPolicy']) {
      expect(TENANT_OWNED_MODELS.has(model), `${model} must be tenant-scoped`).toBe(true);
    }
  });

  it('no threshold is hardcoded — every one comes from policy', async () => {
    // The load-bearing property: NBA prescribes no formula, so an institution's
    // published OBE manual must be what drives these numbers.
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('../modules/obe/attainment.ts', import.meta.url), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    // No bare numeric comparison against a percentage-looking literal.
    expect(code).not.toMatch(/>=\s*(50|60|70|75|80)\b/);
    expect(code).toMatch(/policy\.studentTargetPercent/);
    expect(code).toMatch(/policy\.level3Percent/);
  });

  it('never claims NBA compliance', async () => {
    const { readFileSync } = await import('node:fs');
    for (const file of ['../modules/obe/attainment.ts', '../modules/obe/obe.service.ts']) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8');
      // The phrase appears only inside an explicit prohibition.
      const claims = source.match(/NBA[- ]compliant/gi) ?? [];
      for (const claim of claims) {
        const index = source.indexOf(claim);
        const context = source.slice(Math.max(0, index - 120), index);
        expect(context, `unqualified "${claim}" in ${file}`).toMatch(/not|NOT|never/);
      }
    }
  });
});
