/**
 * How a course actually went — one answer, shared by every screen that asks.
 *
 * WHY THIS EXISTS
 *
 * Five screens (HOD results, HOD course results, Dean results, VC analytics and
 * the CoE's department readiness) each computed pass rates from
 * `Enrollment.grade`, a legacy free-text column. The results engine never writes
 * that column: it records `CourseResult` rows and publishes them. So a
 * department with 230 published results, failures included, was shown as
 * "100% pass, 0 failures, N/A average" — and the five screens did not even agree
 * with each other.
 *
 * Published `CourseResult` rows are the record of how a course went. This reads
 * them, counted by the database rather than loaded row by row. A course with no
 * published result falls back to its legacy enrolment grades, so an institution
 * that has not adopted the results engine sees what it saw before.
 */

import { prisma } from './prisma.js';

export interface CourseOutcome {
  /** Students with an outcome recorded. */
  assessed: number;
  passed: number;
  failed: number;
  /** Mean of total marks, rounded. Null when no numeric marks exist. */
  avgScore: number | null;
  highestScore: number | null;
  gradeDistribution: { grade: string; count: number }[];
}

const EMPTY: CourseOutcome = { assessed: 0, passed: 0, failed: 0, avgScore: null, highestScore: null, gradeDistribution: [] };

/** Published outcomes for the given courses, keyed by course id. Courses with none are absent. */
export async function publishedOutcomes(courseIds: string[]): Promise<Map<string, CourseOutcome>> {
  const outcomes = new Map<string, CourseOutcome>();
  if (courseIds.length === 0) return outcomes;

  const where = { courseId: { in: courseIds }, status: 'published', isExcludedFromGpa: false };
  const [byGrade, marks] = await Promise.all([
    prisma.courseResult.groupBy({ by: ['courseId', 'letterGrade', 'isPassing'], where, _count: { _all: true } }),
    prisma.courseResult.groupBy({ by: ['courseId'], where, _avg: { totalMarks: true }, _max: { totalMarks: true } })
  ]);

  for (const row of byGrade) {
    const outcome = outcomes.get(row.courseId) ?? { ...EMPTY, gradeDistribution: [] };
    outcome.assessed += row._count._all;
    if (row.isPassing) outcome.passed += row._count._all;
    else outcome.failed += row._count._all;
    const band = outcome.gradeDistribution.find((g) => g.grade === row.letterGrade);
    if (band) band.count += row._count._all;
    else outcome.gradeDistribution.push({ grade: row.letterGrade, count: row._count._all });
    outcomes.set(row.courseId, outcome);
  }
  for (const row of marks) {
    const outcome = outcomes.get(row.courseId);
    if (!outcome) continue;
    outcome.avgScore = row._avg.totalMarks == null ? null : Math.round(row._avg.totalMarks);
    outcome.highestScore = row._max.totalMarks ?? null;
    outcome.gradeDistribution.sort((a, b) => b.count - a.count);
  }
  return outcomes;
}

/** Legacy path: outcomes read from `Enrollment.grade`. */
export function outcomeFromEnrolments(enrollments: { grade: string | null }[]): CourseOutcome {
  // GRADED, not all enrolments: an ungraded student is neither a pass nor a fail.
  const graded = enrollments.filter((e) => e.grade != null && e.grade !== '');
  const numeric = graded.map((e) => Number(e.grade)).filter((v) => Number.isFinite(v));
  const passed = graded.filter((e) => {
    const value = Number(e.grade);
    return Number.isFinite(value) ? value >= 35 : !['F', 'I'].includes(String(e.grade));
  }).length;
  const tally = new Map<string, number>();
  for (const e of graded) tally.set(String(e.grade), (tally.get(String(e.grade)) ?? 0) + 1);
  return {
    assessed: graded.length,
    passed,
    failed: graded.length - passed,
    avgScore: numeric.length ? Math.round(numeric.reduce((s, v) => s + v, 0) / numeric.length) : null,
    highestScore: numeric.length ? Math.max(...numeric) : null,
    gradeDistribution: [...tally].map(([grade, count]) => ({ grade, count })).sort((a, b) => b.count - a.count)
  };
}

/** The outcome for one course: published results when they exist, legacy grades otherwise. */
export function outcomeFor(
  course: { id: string; enrollments?: { grade: string | null }[] },
  published: Map<string, CourseOutcome>
): CourseOutcome {
  return published.get(course.id) ?? outcomeFromEnrolments(course.enrollments ?? []);
}

/** Outcomes summed across a set of courses — a department's or an institution's. */
export function combineOutcomes(outcomes: CourseOutcome[]): { assessed: number; passed: number; failed: number; passPercentage: number | null } {
  const assessed = outcomes.reduce((s, o) => s + o.assessed, 0);
  const passed = outcomes.reduce((s, o) => s + o.passed, 0);
  return { assessed, passed, failed: assessed - passed, passPercentage: assessed > 0 ? Math.round((passed / assessed) * 100) : null };
}

/** Pass percentage for one outcome, or null when nobody has been assessed. */
export function passPercentage(outcome: CourseOutcome): number | null {
  return outcome.assessed > 0 ? Math.round((outcome.passed / outcome.assessed) * 100) : null;
}
