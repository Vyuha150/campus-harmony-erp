/**
 * Results service (T-403 / T-104).
 *
 * Turns marks into grades, grades into SGPA, and SGPA into CGPA — from real
 * enrolment data, through the institution's own versioned grading scheme.
 *
 * WHAT THIS REPLACES
 *
 * `StudentProfile.cgpa` was a stored Float that nothing computed; the old code
 * wrote a literal `cgpa: 8.5`. Phase 0 removed that fabrication and left it at
 * zero — correct, but the system still could not produce a transcript.
 *
 * `StudentProfile.cgpa` is now a CACHE of `recomputeStudentResults()`. It is
 * only ever written by this module, from a calculation, and can be rebuilt from
 * `CourseResult` rows at any time. If the cache and the calculation ever
 * disagree, the calculation is authoritative.
 *
 * EVERY grade change writes a `GradeHistory` row INSIDE the same transaction.
 * A grade change that cannot be recorded does not commit — that is the whole
 * point of T-104.
 */

import { basePrisma } from '../../lib/prisma.js';
import { mutate, requireContext, type TransactionClient } from '../../lib/service.js';
import {
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  ValidationError
} from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import {
  computeSgpa,
  computeCgpa,
  resolveGradeBand,
  round2,
  type GradedCourse,
  type SemesterComputation
} from './gpa.js';

const MODULE = 'results';

/** Statuses after which a change requires a reason and an approver. */
const PUBLISHED_STATUSES = new Set(['published', 'revalued']);

// ─── Grading scheme ───────────────────────────────────────────────────────────

export interface CreateGradeScaleInput {
  code: string;
  name: string;
  maxPoint?: number;
  passingPoint?: number;
  version?: string;
  effectiveFrom: Date;
  bands: Array<{
    letter: string;
    point: number;
    minMarks: number;
    maxMarks: number;
    isPassing?: boolean;
    isExcludedFromGpa?: boolean;
    description?: string;
  }>;
}

export async function createGradeScale(input: CreateGradeScaleInput) {
  const ctx = requireContext();

  if (input.bands.length === 0) {
    throw new ValidationError('A grading scale must define at least one band.');
  }

  // A gap in the scale means marks that map to no grade — the caller would
  // then have to invent one. Reject the configuration instead.
  //
  // Administrative grades (W / I / AB) are EXCLUDED from the continuity check:
  // they are outcomes, not mark ranges, and are awarded by a decision rather
  // than by a score. Including them made a legitimate scale look gapped.
  const markRanged = input.bands.filter((band) => !band.isExcludedFromGpa);

  if (markRanged.length === 0) {
    throw new ValidationError(
      'A grading scale must define at least one mark-based band.'
    );
  }

  const sorted = [...markRanged].sort((a, b) => a.minMarks - b.minMarks);
  for (const band of input.bands) {
    if (band.minMarks > band.maxMarks) {
      throw new ValidationError(
        `Band ${band.letter} has minMarks (${band.minMarks}) above maxMarks (${band.maxMarks}).`
      );
    }
    if (band.point < 0 || band.point > (input.maxPoint ?? 10)) {
      throw new ValidationError(
        `Band ${band.letter} has point ${band.point}, outside the 0..${input.maxPoint ?? 10} scale.`
      );
    }
  }

  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1]!;
    const current = sorted[i]!;
    if (current.minMarks > previous.maxMarks + 1) {
      throw new ValidationError(
        `Grading scale has a gap between ${previous.maxMarks} and ${current.minMarks}. ` +
          'Marks in that range would map to no grade.',
        { gapAfter: previous.letter, gapBefore: current.letter }
      );
    }
  }

  return mutate(
    ctx,
    {
      action: 'CREATE',
      module: MODULE,
      resource: (r) => `GradeScale:${(r as { id: string }).id}`,
      details: `Created grading scale ${input.code} v${input.version ?? '1.0'} with ${input.bands.length} bands`,
      newValue: { code: input.code, maxPoint: input.maxPoint ?? 10, bands: input.bands.length },
      severity: 'warning' // grading rules govern degree outcomes
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      return db.gradeScale.create({
        data: {
          institutionId: ctx.institutionId,
          code: input.code,
          name: input.name,
          maxPoint: input.maxPoint ?? 10,
          passingPoint: input.passingPoint ?? 4,
          version: input.version ?? '1.0',
          effectiveFrom: input.effectiveFrom,
          isActive: true,
          createdBy: ctx.userId,
          bands: {
            create: input.bands.map((band) => ({
              letter: band.letter,
              point: band.point,
              minMarks: band.minMarks,
              maxMarks: band.maxMarks,
              isPassing: band.isPassing ?? true,
              isExcludedFromGpa: band.isExcludedFromGpa ?? false,
              description: band.description ?? null
            }))
          }
        },
        include: { bands: { orderBy: { point: 'desc' } } }
      });
    }
  );
}

/** The scale in force for the institution, newest effective first. */
async function activeGradeScale(institutionId: string) {
  const scale = await basePrisma.gradeScale.findFirst({
    where: { institutionId, isActive: true },
    include: { bands: true },
    orderBy: { effectiveFrom: 'desc' }
  });

  if (!scale) {
    throw new BusinessRuleError(
      'No active grading scale is configured for this institution. ' +
        'Results cannot be computed until one exists.'
    );
  }

  return scale;
}

export async function listGradeScales() {
  const ctx = requireContext();
  return basePrisma.gradeScale.findMany({
    where: { institutionId: ctx.institutionId },
    include: { bands: { orderBy: { point: 'desc' } } },
    orderBy: { effectiveFrom: 'desc' }
  });
}

// ─── Recording marks ──────────────────────────────────────────────────────────

export interface RecordResultInput {
  studentProfileId: string;
  courseId: string;
  semester: number;
  academicYear: string;
  internalMarks?: number;
  externalMarks?: number;
  totalMarks: number;
  maxMarks?: number;
  attempt?: number;
  /** Required when amending an already-published result. */
  reason?: string;
}

/**
 * Record or amend a course result.
 *
 * Marks are converted to a grade through the institution's scale — the caller
 * cannot supply a letter grade directly, so a grade can never disagree with the
 * marks that produced it.
 */
export async function recordCourseResult(input: RecordResultInput) {
  const ctx = requireContext();

  const scale = await activeGradeScale(ctx.institutionId);

  const maxMarks = input.maxMarks ?? 100;
  if (input.totalMarks < 0 || input.totalMarks > maxMarks) {
    throw new ValidationError(
      `Total marks ${input.totalMarks} is outside the range 0..${maxMarks}.`
    );
  }

  // Normalise to a percentage so a scale defined on 0-100 works regardless of
  // the paper's maximum.
  const percentage = (input.totalMarks / maxMarks) * 100;
  const band = resolveGradeBand(percentage, scale.bands);

  if (!band) {
    throw new BusinessRuleError(
      `Marks ${input.totalMarks}/${maxMarks} (${round2(percentage)}%) map to no grade in scale ` +
        `${scale.code} v${scale.version}. The grading scale has a gap.`,
      { percentage: round2(percentage), scale: scale.code }
    );
  }

  const course = await basePrisma.course.findFirst({
    where: { id: input.courseId, institutionId: ctx.institutionId }
  });
  if (!course) throw new NotFoundError('Course');

  const student = await basePrisma.studentProfile.findFirst({
    where: { id: input.studentProfileId, institutionId: ctx.institutionId }
  });
  if (!student) throw new NotFoundError('Student profile');

  const attempt = input.attempt ?? 1;

  const existing = await basePrisma.courseResult.findFirst({
    where: { studentProfileId: input.studentProfileId, courseId: input.courseId, attempt }
  });

  // Amending a PUBLISHED result is the sensitive case: it must carry a reason,
  // and it must be traceable. This is the defect T-104 exists to close.
  if (existing && PUBLISHED_STATUSES.has(existing.status)) {
    if (!input.reason || input.reason.trim().length < 10) {
      throw new BusinessRuleError(
        'Amending a published result requires a reason of at least 10 characters. ' +
          'The reason is recorded permanently against the change.'
      );
    }
  }

  return mutate(
    ctx,
    {
      action: existing ? 'UPDATE' : 'CREATE',
      module: MODULE,
      resource: (r) => `CourseResult:${(r as { id: string }).id}`,
      details: existing
        ? `Amended result for ${student.rollNumber} in ${course.code}: ${existing.letterGrade} → ${band.letter}`
        : `Recorded ${band.letter} for ${student.rollNumber} in ${course.code}`,
      oldValue: existing
        ? { letterGrade: existing.letterGrade, gradePoint: existing.gradePoint, totalMarks: existing.totalMarks }
        : undefined,
      newValue: { letterGrade: band.letter, gradePoint: band.point, totalMarks: input.totalMarks },
      reason: input.reason,
      severity: existing && PUBLISHED_STATUSES.has(existing.status) ? 'critical' : 'info'
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      const data = {
        institutionId: ctx.institutionId,
        studentProfileId: input.studentProfileId,
        courseId: input.courseId,
        semester: input.semester,
        academicYear: input.academicYear,
        internalMarks: input.internalMarks ?? null,
        externalMarks: input.externalMarks ?? null,
        totalMarks: input.totalMarks,
        maxMarks,
        letterGrade: band.letter,
        gradePoint: band.point,
        credits: course.credits,
        isPassing: band.isPassing,
        isExcludedFromGpa: band.isExcludedFromGpa,
        attempt
      };

      const result = existing
        ? await db.courseResult.update({ where: { id: existing.id }, data })
        : await db.courseResult.create({ data: { ...data, status: 'draft' } });

      // GRADE HISTORY — written in the SAME transaction. If this insert fails,
      // the grade change is rolled back.
      await db.gradeHistory.create({
        data: {
          institutionId: ctx.institutionId,
          courseResultId: result.id,
          oldLetterGrade: existing?.letterGrade ?? null,
          newLetterGrade: band.letter,
          oldGradePoint: existing?.gradePoint ?? null,
          newGradePoint: band.point,
          oldTotalMarks: existing?.totalMarks ?? null,
          newTotalMarks: input.totalMarks,
          reason: input.reason ?? (existing ? 'Correction before publication' : 'Initial entry'),
          changeType: existing ? 'correction' : 'initial',
          changedBy: ctx.userId
        }
      });

      return result;
    }
  );
}

// ─── Computation ──────────────────────────────────────────────────────────────

export interface StudentResultSummary {
  rollNumber: string;
  cgpa: number;
  totalCreditsRegistered: number;
  totalCreditsEarned: number;
  semesters: Array<{
    semester: number;
    academicYear: string;
    sgpa: number;
    cgpa: number;
    creditsRegistered: number;
    creditsEarned: number;
    courseCount: number;
  }>;
}

/**
 * Recompute every semester result and the CGPA for one student.
 *
 * Rebuilds from `CourseResult` rows rather than adjusting incrementally, so the
 * output cannot drift from the underlying grades. `StudentProfile.cgpa` and the
 * credit columns are refreshed as a cache of this calculation.
 */
/**
 * The computation itself, running inside a caller-supplied transaction.
 *
 * Split out from `recomputeStudentResults` so that publication can recompute
 * IN THE SAME TRANSACTION that publishes. Before this existed, nothing
 * recomputed on publish at all: `StudentProfile.cgpa` was written by exactly
 * one function, which was called by exactly one endpoint, which nothing in the
 * product ever called — so a student's results could be published while their
 * CGPA stayed at whatever it was before, commonly 0.
 *
 * Doing it in the caller's transaction rather than after it matters: a
 * publication that committed while the recompute failed would leave results
 * visible against a stale CGPA, which is the same class of half-applied
 * outcome this module already refuses elsewhere.
 */
export async function recomputeWithin(
  db: typeof basePrisma,
  ctx: { institutionId: string },
  studentProfileId: string
): Promise<StudentResultSummary> {
  const student = await db.studentProfile.findFirst({
    where: { id: studentProfileId, institutionId: ctx.institutionId }
  });
  if (!student) throw new NotFoundError('Student profile');

  const scale = await activeGradeScale(ctx.institutionId);

  const allResults = await db.courseResult.findMany({
    where: { studentProfileId, institutionId: ctx.institutionId },
    orderBy: [{ semester: 'asc' }, { attempt: 'asc' }]
  });

  const latestByCourse = new Map<string, (typeof allResults)[number]>();
  for (const result of allResults) {
    const key = `${result.semester}::${result.courseId}`;
    const current = latestByCourse.get(key);
    if (!current || result.attempt > current.attempt) {
      latestByCourse.set(key, result);
    }
  }

  const bySemester = new Map<number, { academicYear: string; courses: GradedCourse[] }>();
  for (const result of latestByCourse.values()) {
    const bucket =
      bySemester.get(result.semester) ??
      bySemester.set(result.semester, { academicYear: result.academicYear, courses: [] }).get(result.semester)!;

    bucket.courses.push({
      courseId: result.courseId,
      credits: result.credits,
      gradePoint: result.gradePoint,
      isPassing: result.isPassing,
      isExcludedFromGpa: result.isExcludedFromGpa
    });
  }

  const semesters = [...bySemester.keys()].sort((a, b) => a - b);
  const computations: SemesterComputation[] = [];
  const summary: StudentResultSummary['semesters'] = [];

  for (const semester of semesters) {
    const bucket = bySemester.get(semester)!;
    const computation = computeSgpa(bucket.courses);
    computations.push(computation);

    const cumulative = computeCgpa(computations);

    await db.semesterResult.upsert({
      where: {
        studentProfileId_semester_academicYear: {
          studentProfileId,
          semester,
          academicYear: bucket.academicYear
        }
      },
      update: {
        gradeScaleId: scale.id,
        creditsRegistered: computation.creditsRegistered,
        creditsEarned: computation.creditsEarned,
        sgpa: computation.sgpa,
        cgpa: cumulative.cgpa,
        cumulativeCreditsRegistered: cumulative.cumulativeCreditsRegistered,
        cumulativeCreditsEarned: cumulative.cumulativeCreditsEarned,
        resultStatus: computation.creditsEarned === computation.creditsRegistered ? 'pass' : 'fail',
        computedAt: new Date()
      },
      create: {
        institutionId: ctx.institutionId,
        studentProfileId,
        semester,
        academicYear: bucket.academicYear,
        gradeScaleId: scale.id,
        creditsRegistered: computation.creditsRegistered,
        creditsEarned: computation.creditsEarned,
        sgpa: computation.sgpa,
        cgpa: cumulative.cgpa,
        cumulativeCreditsRegistered: cumulative.cumulativeCreditsRegistered,
        cumulativeCreditsEarned: cumulative.cumulativeCreditsEarned,
        resultStatus: computation.creditsEarned === computation.creditsRegistered ? 'pass' : 'fail',
        status: 'draft'
      }
    });

    summary.push({
      semester,
      academicYear: bucket.academicYear,
      sgpa: computation.sgpa,
      cgpa: cumulative.cgpa,
      creditsRegistered: computation.creditsRegistered,
      creditsEarned: computation.creditsEarned,
      courseCount: bucket.courses.length
    });
  }

  const final = computeCgpa(computations);

  // Refresh the cache on StudentProfile. This column is DERIVED — the only
  // writers are this function and, through it, `recomputeStudentResults`.
  await db.studentProfile.update({
    where: { id: studentProfileId },
    data: {
      cgpa: final.cgpa,
      earnedCredits: final.cumulativeCreditsEarned
    }
  });

  return {
    rollNumber: student.rollNumber,
    cgpa: final.cgpa,
    totalCreditsRegistered: final.cumulativeCreditsRegistered,
    totalCreditsEarned: final.cumulativeCreditsEarned,
    semesters: summary
  };
}

export async function recomputeStudentResults(
  studentProfileId: string
): Promise<StudentResultSummary> {
  const ctx = requireContext();

  const student = await basePrisma.studentProfile.findFirst({
    where: { id: studentProfileId, institutionId: ctx.institutionId }
  });
  if (!student) throw new NotFoundError('Student profile');

  return mutate(
    ctx,
    {
      action: 'UPDATE',
      module: MODULE,
      resource: `StudentProfile:${studentProfileId}`,
      details: (r) =>
        `Recomputed results for ${student.rollNumber}: CGPA ${(r as StudentResultSummary).cgpa} across ${(r as StudentResultSummary).semesters.length} semester(s)`,
      oldValue: { cgpa: student.cgpa, earnedCredits: student.earnedCredits },
      // Resolved after the computation so the audit records the value actually
      // written, not one predicted before the work ran.
      newValue: undefined,
      severity: 'warning'
    },
    async (tx) => recomputeWithin(tx as never as typeof basePrisma, ctx, studentProfileId)
  );
}

// ─── Publication ──────────────────────────────────────────────────────────────

/**
 * Publish a semester's results.
 *
 * Atomic across every course result and the semester record: partial
 * publication would show some students a result and others nothing for the same
 * examination, which is exactly the failure the audit called out as
 * unacceptable.
 */
export async function publishSemesterResults(semester: number, academicYear: string) {
  const ctx = requireContext();

  const pending = await basePrisma.courseResult.findMany({
    where: { institutionId: ctx.institutionId, semester, academicYear, status: { not: 'published' } }
  });

  if (pending.length === 0) {
    throw new BusinessRuleError('There are no unpublished results for this semester.');
  }

  return mutate(
    ctx,
    {
      action: 'PUBLISH',
      module: MODULE,
      resource: `Semester:${academicYear}-S${semester}`,
      details: `Published ${pending.length} course result(s) for semester ${semester}, ${academicYear}`,
      newValue: { semester, academicYear, resultCount: pending.length },
      severity: 'critical' // publication is irreversible in practice
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;
      const now = new Date();

      await db.courseResult.updateMany({
        where: { institutionId: ctx.institutionId, semester, academicYear, status: { not: 'published' } },
        data: { status: 'published', publishedAt: now, publishedBy: ctx.userId }
      });

      // Recompute BEFORE marking the semester records published, so the rows
      // being published carry the freshly computed SGPA/CGPA rather than
      // whatever a previous run left behind.
      const affected = [...new Set(pending.map((r) => r.studentProfileId))];
      for (const studentProfileId of affected) {
        await recomputeWithin(db, ctx, studentProfileId);
      }

      await db.semesterResult.updateMany({
        where: { institutionId: ctx.institutionId, semester, academicYear },
        data: { status: 'published', publishedAt: now, publishedBy: ctx.userId }
      });

      logger.info('Semester results published', {
        module: MODULE,
        operation: 'publishSemesterResults',
        userId: ctx.userId,
        resource: `${academicYear}-S${semester}`,
        studentsRecomputed: affected.length
      });

      return { published: pending.length, semester, academicYear, recomputed: affected.length };
    }
  );
}

// ─── Reads ────────────────────────────────────────────────────────────────────

/** Full academic record — the basis of a transcript. */
export async function getStudentTranscript(studentProfileId: string) {
  const ctx = requireContext();

  const student = await basePrisma.studentProfile.findFirst({
    where: { id: studentProfileId, institutionId: ctx.institutionId },
    include: { user: { select: { name: true, email: true } } }
  });
  if (!student) throw new NotFoundError('Student profile');

  const [courseResults, semesterResults] = await Promise.all([
    basePrisma.courseResult.findMany({
      where: { studentProfileId, institutionId: ctx.institutionId },
      orderBy: [{ semester: 'asc' }, { courseId: 'asc' }]
    }),
    basePrisma.semesterResult.findMany({
      where: { studentProfileId, institutionId: ctx.institutionId },
      orderBy: { semester: 'asc' }
    })
  ]);

  const courseIds = [...new Set(courseResults.map((r) => r.courseId))];
  const courses = await basePrisma.course.findMany({
    where: { id: { in: courseIds } },
    select: { id: true, code: true, name: true }
  });
  const courseById = new Map(courses.map((c) => [c.id, c]));

  return {
    student: {
      rollNumber: student.rollNumber,
      name: student.user.name,
      programme: student.program,
      // Reported from the SemesterResult chain, not the cached column, so a
      // transcript always reflects the computation.
      cgpa: semesterResults.at(-1)?.cgpa ?? 0,
      creditsEarned: semesterResults.at(-1)?.cumulativeCreditsEarned ?? 0
    },
    semesters: semesterResults.map((sr) => ({
      semester: sr.semester,
      academicYear: sr.academicYear,
      sgpa: sr.sgpa,
      cgpa: sr.cgpa,
      creditsRegistered: sr.creditsRegistered,
      creditsEarned: sr.creditsEarned,
      status: sr.status,
      courses: courseResults
        .filter((cr) => cr.semester === sr.semester)
        .map((cr) => ({
          courseCode: courseById.get(cr.courseId)?.code ?? '',
          courseName: courseById.get(cr.courseId)?.name ?? '',
          credits: cr.credits,
          totalMarks: cr.totalMarks,
          maxMarks: cr.maxMarks,
          letterGrade: cr.letterGrade,
          gradePoint: cr.gradePoint,
          attempt: cr.attempt,
          status: cr.status
        }))
    }))
  };
}

/** Full change history for one course result — the audit view. */
export async function getGradeHistory(courseResultId: string) {
  const ctx = requireContext();

  const result = await basePrisma.courseResult.findFirst({
    where: { id: courseResultId, institutionId: ctx.institutionId }
  });
  if (!result) throw new NotFoundError('Course result');

  return basePrisma.gradeHistory.findMany({
    where: { courseResultId },
    orderBy: { changedAt: 'desc' }
  });
}
