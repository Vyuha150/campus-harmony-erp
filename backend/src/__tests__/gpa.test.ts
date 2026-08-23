/**
 * GPA arithmetic tests (T-403).
 *
 * SGPA and CGPA decide degrees. This is the most consequential arithmetic in
 * the system and the part a registrar would be asked to defend, so it is tested
 * as pure functions with worked examples that can be checked by hand.
 */

import { describe, it, expect } from 'vitest';
import {
  computeSgpa,
  computeCgpa,
  resolveGradeBand,
  cgpaToPercentage,
  classifyDegree,
  round2,
  type GradedCourse
} from '../modules/results/gpa.js';

function course(overrides: Partial<GradedCourse> = {}): GradedCourse {
  return {
    courseId: 'c1',
    credits: 4,
    gradePoint: 8,
    isPassing: true,
    isExcludedFromGpa: false,
    ...overrides
  };
}

describe('SGPA', () => {
  it('computes a credit-weighted average', () => {
    // (9×4 + 8×3 + 7×3) / (4+3+3) = (36+24+21)/10 = 81/10 = 8.1
    const result = computeSgpa([
      course({ courseId: 'a', credits: 4, gradePoint: 9 }),
      course({ courseId: 'b', credits: 3, gradePoint: 8 }),
      course({ courseId: 'c', credits: 3, gradePoint: 7 })
    ]);

    expect(result.sgpa).toBe(8.1);
    expect(result.creditsRegistered).toBe(10);
    expect(result.creditsEarned).toBe(10);
    expect(result.totalGradePoints).toBe(81);
    expect(result.gpaCredits).toBe(10);
  });

  it('weights by credits, NOT by course count', () => {
    // A 1-credit course must not pull the average as hard as a 9-credit one.
    // (10×1 + 6×9) / 10 = 64/10 = 6.4  — not the naive mean of 8.0
    const result = computeSgpa([
      course({ courseId: 'small', credits: 1, gradePoint: 10 }),
      course({ courseId: 'big', credits: 9, gradePoint: 6 })
    ]);

    expect(result.sgpa).toBe(6.4);
    expect(result.sgpa).not.toBe(8);
  });

  it('counts a failed course in registered credits but NOT earned', () => {
    // Failing still contributes 0 points to the GPA denominator — the student
    // is penalised, which is the correct behaviour.
    const result = computeSgpa([
      course({ courseId: 'pass', credits: 4, gradePoint: 8 }),
      course({ courseId: 'fail', credits: 4, gradePoint: 0, isPassing: false })
    ]);

    expect(result.creditsRegistered).toBe(8);
    expect(result.creditsEarned).toBe(4);
    expect(result.sgpa).toBe(4); // (32 + 0) / 8
  });

  it('excludes W/I/AB from BOTH numerator and denominator', () => {
    // A withdrawal must not be treated as a zero — that would silently punish
    // a student for an administrative outcome.
    const result = computeSgpa([
      course({ courseId: 'graded', credits: 4, gradePoint: 9 }),
      course({ courseId: 'withdrawn', credits: 4, gradePoint: 0, isPassing: false, isExcludedFromGpa: true })
    ]);

    expect(result.sgpa).toBe(9);
    expect(result.gpaCredits).toBe(4);
    expect(result.creditsRegistered).toBe(8); // still attempted
    expect(result.creditsEarned).toBe(4);
  });

  it('returns 0 rather than NaN when nothing is GPA-eligible', () => {
    const result = computeSgpa([
      course({ credits: 4, isExcludedFromGpa: true, isPassing: false })
    ]);

    expect(result.sgpa).toBe(0);
    expect(Number.isNaN(result.sgpa)).toBe(false);
    // gpaCredits = 0 distinguishes "no GPA" from a genuine 0.0.
    expect(result.gpaCredits).toBe(0);
  });

  it('handles an empty semester', () => {
    const result = computeSgpa([]);
    expect(result.sgpa).toBe(0);
    expect(result.creditsRegistered).toBe(0);
  });
});

describe('CGPA', () => {
  it('is credit-weighted across semesters, NOT the mean of SGPAs', () => {
    // Semester 1: 9.0 over 10 credits  → 90 points
    // Semester 2: 6.0 over 30 credits  → 180 points
    // CGPA = 270 / 40 = 6.75
    // The naive mean of SGPAs would be 7.5 — wrong, and the most common way
    // this calculation is got wrong.
    const s1 = computeSgpa([course({ credits: 10, gradePoint: 9 })]);
    const s2 = computeSgpa([course({ credits: 30, gradePoint: 6 })]);

    const result = computeCgpa([s1, s2]);

    expect(result.cgpa).toBe(6.75);
    expect(result.cgpa).not.toBe(7.5);
    expect(result.cumulativeCreditsEarned).toBe(40);
  });

  it('accumulates credits across semesters', () => {
    const semesters = [
      computeSgpa([course({ credits: 20, gradePoint: 8 })]),
      computeSgpa([course({ credits: 22, gradePoint: 8 })]),
      computeSgpa([course({ credits: 18, gradePoint: 8 })])
    ];

    const result = computeCgpa(semesters);
    expect(result.cgpa).toBe(8);
    expect(result.cumulativeCreditsRegistered).toBe(60);
  });

  it('returns 0 for a student with no results', () => {
    expect(computeCgpa([]).cgpa).toBe(0);
  });

  it('excludes failed credits from cumulative earned', () => {
    const semesters = [
      computeSgpa([
        course({ courseId: 'p', credits: 16, gradePoint: 8 }),
        course({ courseId: 'f', credits: 4, gradePoint: 0, isPassing: false })
      ])
    ];

    const result = computeCgpa(semesters);
    expect(result.cumulativeCreditsRegistered).toBe(20);
    expect(result.cumulativeCreditsEarned).toBe(16);
  });
});

describe('grade band resolution', () => {
  const bands = [
    { letter: 'O', point: 10, minMarks: 90, maxMarks: 100, isPassing: true, isExcludedFromGpa: false },
    { letter: 'A+', point: 9, minMarks: 80, maxMarks: 89, isPassing: true, isExcludedFromGpa: false },
    { letter: 'A', point: 8, minMarks: 70, maxMarks: 79, isPassing: true, isExcludedFromGpa: false },
    { letter: 'B', point: 7, minMarks: 60, maxMarks: 69, isPassing: true, isExcludedFromGpa: false },
    { letter: 'P', point: 4, minMarks: 40, maxMarks: 59, isPassing: true, isExcludedFromGpa: false },
    { letter: 'F', point: 0, minMarks: 0, maxMarks: 39, isPassing: false, isExcludedFromGpa: false }
  ];

  it('maps marks to the correct band', () => {
    expect(resolveGradeBand(95, bands)?.letter).toBe('O');
    expect(resolveGradeBand(85, bands)?.letter).toBe('A+');
    expect(resolveGradeBand(70, bands)?.letter).toBe('A');
    expect(resolveGradeBand(39, bands)?.letter).toBe('F');
  });

  it('is inclusive at both boundaries', () => {
    expect(resolveGradeBand(90, bands)?.letter).toBe('O');
    expect(resolveGradeBand(89, bands)?.letter).toBe('A+');
    expect(resolveGradeBand(80, bands)?.letter).toBe('A+');
    expect(resolveGradeBand(79, bands)?.letter).toBe('A');
  });

  it('handles the extremes', () => {
    expect(resolveGradeBand(100, bands)?.letter).toBe('O');
    expect(resolveGradeBand(0, bands)?.letter).toBe('F');
  });

  it('returns null for a gap instead of inventing a grade', () => {
    // A gap is a configuration error. Returning null forces the caller to
    // surface it rather than silently award a default — which would be exactly
    // the fabrication this project removed.
    const gapped = [
      { letter: 'A', point: 9, minMarks: 80, maxMarks: 100, isPassing: true, isExcludedFromGpa: false },
      { letter: 'F', point: 0, minMarks: 0, maxMarks: 39, isPassing: false, isExcludedFromGpa: false }
    ];
    expect(resolveGradeBand(60, gapped)).toBeNull();
  });

  it('resolves overlapping bands to the higher one, deterministically', () => {
    const overlapping = [
      { letter: 'A', point: 9, minMarks: 80, maxMarks: 100, isPassing: true, isExcludedFromGpa: false },
      { letter: 'B', point: 7, minMarks: 70, maxMarks: 85, isPassing: true, isExcludedFromGpa: false }
    ];
    // 82 falls in both — must not depend on array order.
    expect(resolveGradeBand(82, overlapping)?.letter).toBe('A');
  });
});

describe('conversions', () => {
  it('applies the institution-supplied percentage formula', () => {
    // The formula is a PARAMETER: universities differ, and hard-coding one
    // would make the system wrong for most of them.
    expect(cgpaToPercentage(8.5, { multiplier: 10, offset: 0.75 })).toBe(77.5);
    expect(cgpaToPercentage(8.5, { multiplier: 9.5, offset: 0 })).toBe(80.75);
  });

  it('classifies by the highest threshold met', () => {
    const thresholds = [
      { minCgpa: 7.5, classification: 'First Class with Distinction' },
      { minCgpa: 6.5, classification: 'First Class' },
      { minCgpa: 5.5, classification: 'Second Class' },
      { minCgpa: 4.0, classification: 'Pass' }
    ];

    expect(classifyDegree(9.1, thresholds)).toBe('First Class with Distinction');
    expect(classifyDegree(6.5, thresholds)).toBe('First Class');
    expect(classifyDegree(4.0, thresholds)).toBe('Pass');
    expect(classifyDegree(3.2, thresholds)).toBeNull();
  });
});

describe('rounding', () => {
  it('rounds to two decimals without floating-point drift', () => {
    expect(round2(8.005)).toBe(8.01);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(8.994999)).toBe(8.99);
  });

  it('is stable across repeated computation', () => {
    // A published SGPA must not change by 0.01 between two runs.
    const courses = [
      course({ courseId: 'a', credits: 3, gradePoint: 7 }),
      course({ courseId: 'b', credits: 4, gradePoint: 9 })
    ];
    const first = computeSgpa(courses).sgpa;
    for (let i = 0; i < 100; i += 1) {
      expect(computeSgpa(courses).sgpa).toBe(first);
    }
  });
});
