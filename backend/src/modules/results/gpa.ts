/**
 * GPA arithmetic (T-403).
 *
 * Deliberately PURE — no database, no tenant context, no I/O. SGPA and CGPA
 * decide degrees, so the arithmetic must be testable in isolation and
 * inspectable by a registrar without reading data-access code.
 *
 * These are the formulae the institution is accountable for; they are
 * documented here rather than left implicit in a query (audit rule 76).
 */

/** One graded course, reduced to what the arithmetic needs. */
export interface GradedCourse {
  courseId: string;
  credits: number;
  gradePoint: number;
  isPassing: boolean;
  /** W / I / AB — excluded from BOTH numerator and denominator. */
  isExcludedFromGpa: boolean;
}

export interface SemesterComputation {
  sgpa: number;
  creditsRegistered: number;
  creditsEarned: number;
  /** Σ(gradePoint × credits) — retained so the result is auditable. */
  totalGradePoints: number;
  /** Σ(credits) over GPA-eligible courses — the SGPA denominator. */
  gpaCredits: number;
}

/**
 * Round to two decimals.
 *
 * Uses a scaled integer rather than `toFixed` to avoid the floating-point
 * surprises that would make a published SGPA differ by 0.01 between two runs.
 */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * SGPA for one semester.
 *
 *   SGPA = Σ(gradePoint × credits) / Σ(credits)
 *
 * over GPA-eligible courses only.
 *
 * Credit accounting:
 *  - registered — every course attempted, excluded ones included
 *  - earned     — passing courses only; drives degree completion and ABC
 *  - gpaCredits — the denominator; excludes W/I/AB
 *
 * A semester with no GPA-eligible courses yields SGPA 0 rather than NaN: a
 * student who withdrew from everything has no GPA, and 0 with
 * `gpaCredits === 0` is distinguishable from a genuine 0.0.
 */
export function computeSgpa(courses: GradedCourse[]): SemesterComputation {
  let totalGradePoints = 0;
  let gpaCredits = 0;
  let creditsRegistered = 0;
  let creditsEarned = 0;

  for (const course of courses) {
    creditsRegistered += course.credits;

    if (course.isPassing) {
      creditsEarned += course.credits;
    }

    if (course.isExcludedFromGpa) {
      continue;
    }

    totalGradePoints += course.gradePoint * course.credits;
    gpaCredits += course.credits;
  }

  const sgpa = gpaCredits > 0 ? round2(totalGradePoints / gpaCredits) : 0;

  return {
    sgpa,
    creditsRegistered,
    creditsEarned,
    totalGradePoints: round2(totalGradePoints),
    gpaCredits
  };
}

export interface CumulativeComputation {
  cgpa: number;
  cumulativeCreditsRegistered: number;
  cumulativeCreditsEarned: number;
}

/**
 * CGPA across semesters.
 *
 *   CGPA = Σ(all gradePoints × credits) / Σ(all gpa credits)
 *
 * CREDIT-WEIGHTED across the whole programme, NOT the mean of the SGPAs.
 * Averaging SGPAs would weight a 12-credit semester the same as a 24-credit
 * one and produce a different — wrong — number. Stated explicitly because it is
 * the most common way this calculation is got wrong.
 */
export function computeCgpa(semesters: SemesterComputation[]): CumulativeComputation {
  let totalGradePoints = 0;
  let totalGpaCredits = 0;
  let cumulativeCreditsRegistered = 0;
  let cumulativeCreditsEarned = 0;

  for (const semester of semesters) {
    totalGradePoints += semester.totalGradePoints;
    totalGpaCredits += semester.gpaCredits;
    cumulativeCreditsRegistered += semester.creditsRegistered;
    cumulativeCreditsEarned += semester.creditsEarned;
  }

  return {
    cgpa: totalGpaCredits > 0 ? round2(totalGradePoints / totalGpaCredits) : 0,
    cumulativeCreditsRegistered,
    cumulativeCreditsEarned
  };
}

export interface GradeBandLike {
  letter: string;
  point: number;
  minMarks: number;
  maxMarks: number;
  isPassing: boolean;
  isExcludedFromGpa: boolean;
}

/**
 * Map marks to a grade band.
 *
 * Returns null when no band covers the marks — a gap in the institution's own
 * scale. Returning null forces the caller to surface a configuration error
 * rather than silently awarding a default grade, which is precisely the class
 * of fabrication this project removed.
 */
export function resolveGradeBand(
  marks: number,
  bands: GradeBandLike[]
): GradeBandLike | null {
  // Highest band first, so overlapping ranges resolve in the student's favour
  // deterministically instead of by array order.
  const ordered = [...bands].sort((a, b) => b.minMarks - a.minMarks);
  const exact = ordered.find((band) => marks >= band.minMarks && marks <= band.maxMarks);
  if (exact) return exact;
  // Bands are usually whole numbers (A+ 80–89, O 90–100), so 89.5 fell between
  // them and was refused as "the scale has a gap". A fractional mark belongs to
  // the band of its whole part — it has not reached the next band's minimum.
  // A genuine gap (no band covers the whole number either) still returns null.
  const whole = Math.floor(marks);
  if (whole === marks) return null;
  return ordered.find((band) => whole >= band.minMarks && whole <= band.maxMarks) ?? null;
}

/**
 * Percentage equivalent of a CGPA.
 *
 * Institutions publish differing conversion formulae; the common Indian
 * convention is `(CGPA − 0.75) × 10` on a 10-point scale, but many use
 * `CGPA × 9.5` and some publish their own. `multiplier`/`offset` are therefore
 * parameters, not constants — and the caller must supply the institution's own
 * rule rather than inherit an assumption.
 */
export function cgpaToPercentage(
  cgpa: number,
  options: { multiplier: number; offset: number }
): number {
  return round2((cgpa - options.offset) * options.multiplier);
}

/**
 * Degree classification.
 *
 * Thresholds are supplied by the caller from institution configuration — they
 * vary by university and by regulation, and hard-coding them would make the
 * system wrong for most institutions.
 */
export function classifyDegree(
  cgpa: number,
  thresholds: Array<{ minCgpa: number; classification: string }>
): string | null {
  const ordered = [...thresholds].sort((a, b) => b.minCgpa - a.minCgpa);
  return ordered.find((t) => cgpa >= t.minCgpa)?.classification ?? null;
}
