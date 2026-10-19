/**
 * Exam marks entry, moderation and revaluation.
 *
 * Connects the examination lifecycle to the results engine. The integrity rules
 * enforced here are the ones an institution would be asked to defend:
 *
 *   1. MARKS REQUIRE A REGISTRATION. A student who never registered — or who
 *      was ruled ineligible — cannot receive marks. Without this, the
 *      eligibility rules enforced at registration are decorative.
 *
 *   2. PUBLICATION REQUIRES MODERATION. The audit found results could be
 *      published straight from entry. Marks now move
 *      draft → submitted → verified → moderated → published, and publication
 *      refuses anything that has not been moderated.
 *
 *   3. EVERY ADJUSTMENT IS AUDITED. Moderation changes marks after a faculty
 *      member entered them; that is exactly the discretion an audit needs to
 *      see, so a reason is mandatory and `GradeHistory` records both values.
 *
 *   4. REVALUATION CREATES A NEW ATTEMPT. It does not overwrite the original.
 *      The first evaluation remains part of the record.
 */

import { basePrisma } from '../../lib/prisma.js';
import { mutate, requireContext } from '../../lib/service.js';
import {
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  ValidationError
} from '../../lib/errors.js';
import { resolveGradeBand, round2 } from '../results/gpa.js';
import { recomputeWithin } from '../results/results.service.js';

const MODULE = 'examination';

/** Statuses a result must reach before it may be published. */
const MODERATED_STATUSES = new Set(['moderated', 'published', 'revalued']);

async function activeGradeScale(institutionId: string) {
  const scale = await basePrisma.gradeScale.findFirst({
    where: { institutionId, isActive: true },
    include: { bands: true },
    orderBy: { effectiveFrom: 'desc' }
  });
  if (!scale) {
    throw new BusinessRuleError(
      'No active grading scale is configured. Marks cannot be graded until one exists.'
    );
  }
  return scale;
}

/** Convert marks to a band, refusing to invent a grade when the scale has a gap. */
function gradeFor(
  totalMarks: number,
  maxMarks: number,
  scale: Awaited<ReturnType<typeof activeGradeScale>>
) {
  const percentage = (totalMarks / maxMarks) * 100;
  const band = resolveGradeBand(percentage, scale.bands);

  if (!band) {
    throw new BusinessRuleError(
      `Marks ${totalMarks}/${maxMarks} (${round2(percentage)}%) map to no grade in scale ` +
        `${scale.code} v${scale.version}. The grading scale has a gap.`
    );
  }

  return band;
}

// ─── Marks entry ──────────────────────────────────────────────────────────────

export interface EnterMarksInput {
  scheduleId: string;
  studentProfileId: string;
  internalMarks?: number;
  externalMarks?: number;
  totalMarks: number;
  /** Absent students are recorded as absent, not as zero. */
  isAbsent?: boolean;
}

/**
 * Enter marks for one student against one scheduled paper.
 *
 * Refuses when the student has no eligible registration for that paper.
 */
export async function enterExamMarks(input: EnterMarksInput) {
  const ctx = requireContext();

  const schedule = await basePrisma.examSchedule.findFirst({
    where: { id: input.scheduleId, institutionId: ctx.institutionId },
    include: { course: true, session: true }
  });
  if (!schedule) throw new NotFoundError('Exam schedule');

  // RULE 1 — no registration, no marks.
  const registration = await basePrisma.examRegistration.findFirst({
    where: { scheduleId: input.scheduleId, studentProfileId: input.studentProfileId }
  });

  if (!registration) {
    throw new BusinessRuleError(
      `This student has no registration for ${schedule.course.code} in session ${schedule.session.code}. ` +
        'Marks cannot be entered for an unregistered candidate.'
    );
  }

  if (!registration.isEligible) {
    throw new BusinessRuleError(
      `This student was ruled INELIGIBLE for ${schedule.course.code} and cannot receive marks.`,
      { reasons: registration.ineligibilityReasons }
    );
  }

  const maxMarks = schedule.maxMarks;

  if (!input.isAbsent) {
    if (input.totalMarks < 0 || input.totalMarks > maxMarks) {
      throw new ValidationError(
        `Total marks ${input.totalMarks} is outside the range 0..${maxMarks} for this paper.`
      );
    }
  }

  const scale = await activeGradeScale(ctx.institutionId);
  const student = await basePrisma.studentProfile.findFirst({
    where: { id: input.studentProfileId, institutionId: ctx.institutionId }
  });
  if (!student) throw new NotFoundError('Student profile');

  // Inherit the continuous-assessment marks the course faculty already
  // recorded, unless this caller is explicitly overriding them.
  //
  // Before `Enrollment.internalMarks` existed the faculty's figure lived only
  // in a string column this module could not sensibly read, so the exam cell
  // either re-typed marks that had already been entered — with the
  // transcription errors that invites — or left the field null and lost the
  // internal component from the record entirely.
  const enrolment = await basePrisma.enrollment.findFirst({
    where: { studentProfileId: input.studentProfileId, courseId: schedule.courseId },
    select: { internalMarks: true }
  });

  const internalMarks = input.internalMarks ?? enrolment?.internalMarks ?? null;

  // An absent candidate gets the scale's excluded-from-GPA band where one
  // exists, so absence is not silently scored as a zero.
  const absentBand = scale.bands.find((b) => b.isExcludedFromGpa);
  const band = input.isAbsent && absentBand ? absentBand : gradeFor(input.totalMarks, maxMarks, scale);

  const existing = await basePrisma.courseResult.findFirst({
    where: { studentProfileId: input.studentProfileId, courseId: schedule.courseId, attempt: 1 }
  });

  if (existing && MODERATED_STATUSES.has(existing.status)) {
    throw new ConflictError(
      `This result is already ${existing.status}. Use moderation or revaluation to change it.`
    );
  }

  return mutate(
    ctx,
    {
      action: existing ? 'UPDATE' : 'CREATE',
      module: MODULE,
      resource: (r) => `CourseResult:${(r as { id: string }).id}`,
      details: `Entered marks for ${student.rollNumber} in ${schedule.course.code}: ${input.isAbsent ? 'ABSENT' : input.totalMarks + '/' + maxMarks} → ${band.letter}`,
      oldValue: existing ? { totalMarks: existing.totalMarks, letterGrade: existing.letterGrade } : undefined,
      newValue: { totalMarks: input.isAbsent ? null : input.totalMarks, letterGrade: band.letter }
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      const data = {
        institutionId: ctx.institutionId,
        studentProfileId: input.studentProfileId,
        courseId: schedule.courseId,
        semester: schedule.session.semester,
        academicYear: schedule.session.academicYear,
        internalMarks,
        externalMarks: input.externalMarks ?? null,
        totalMarks: input.isAbsent ? null : input.totalMarks,
        maxMarks,
        letterGrade: band.letter,
        gradePoint: band.point,
        credits: schedule.course.credits,
        isPassing: band.isPassing,
        isExcludedFromGpa: band.isExcludedFromGpa,
        attempt: 1,
        status: 'submitted'
      };

      const result = existing
        ? await db.courseResult.update({ where: { id: existing.id }, data })
        : await db.courseResult.create({ data });

      await db.gradeHistory.create({
        data: {
          institutionId: ctx.institutionId,
          courseResultId: result.id,
          oldLetterGrade: existing?.letterGrade ?? null,
          newLetterGrade: band.letter,
          oldGradePoint: existing?.gradePoint ?? null,
          newGradePoint: band.point,
          oldTotalMarks: existing?.totalMarks ?? null,
          newTotalMarks: input.isAbsent ? null : input.totalMarks,
          reason: input.isAbsent ? 'Candidate absent' : 'Examination marks entry',
          changeType: 'initial',
          changedBy: ctx.userId
        }
      });

      // Reflect appearance on the registration for exam-branch reporting.
      await db.examRegistration.update({
        where: { id: registration.id },
        data: { status: input.isAbsent ? 'absent' : 'appeared' }
      });

      return result;
    }
  );
}

// ─── Moderation ───────────────────────────────────────────────────────────────

/**
 * Moderate a submitted result.
 *
 * Moderation exists because a paper may be marked harshly or leniently relative
 * to the cohort. Adjusting a mark after a faculty member set it is real
 * discretion, so a reason is mandatory and both values are preserved.
 */
export async function moderateResult(
  courseResultId: string,
  input: { revisedMarks?: number; reason: string }
) {
  const ctx = requireContext();

  if (!input.reason || input.reason.trim().length < 10) {
    throw new BusinessRuleError(
      'Moderation requires a reason of at least 10 characters. It is recorded permanently.'
    );
  }

  const result = await basePrisma.courseResult.findFirst({
    where: { id: courseResultId, institutionId: ctx.institutionId }
  });
  if (!result) throw new NotFoundError('Course result');

  if (result.status === 'published') {
    throw new BusinessRuleError(
      'A published result cannot be moderated. Use revaluation instead.'
    );
  }

  const scale = await activeGradeScale(ctx.institutionId);
  const maxMarks = result.maxMarks ?? 100;

  // No mark change means moderation ACCEPTED the result as entered — still a
  // decision, and still recorded.
  const newMarks = input.revisedMarks ?? result.totalMarks;

  if (newMarks !== null && (newMarks < 0 || newMarks > maxMarks)) {
    throw new ValidationError(`Revised marks must be within 0..${maxMarks}.`);
  }

  const band =
    newMarks === null
      ? { letter: result.letterGrade, point: result.gradePoint, isPassing: result.isPassing, isExcludedFromGpa: result.isExcludedFromGpa }
      : gradeFor(newMarks, maxMarks, scale);

  const changed = newMarks !== result.totalMarks;

  return mutate(
    ctx,
    {
      action: 'APPROVE',
      module: MODULE,
      resource: `CourseResult:${courseResultId}`,
      details: changed
        ? `Moderated: ${result.totalMarks} → ${newMarks} (${result.letterGrade} → ${band.letter})`
        : `Moderation accepted the result as entered (${result.letterGrade})`,
      oldValue: { totalMarks: result.totalMarks, letterGrade: result.letterGrade },
      newValue: { totalMarks: newMarks, letterGrade: band.letter },
      reason: input.reason,
      severity: changed ? 'critical' : 'warning'
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      const updated = await db.courseResult.update({
        where: { id: courseResultId },
        data: {
          totalMarks: newMarks,
          letterGrade: band.letter,
          gradePoint: band.point,
          isPassing: band.isPassing,
          isExcludedFromGpa: band.isExcludedFromGpa,
          status: 'moderated'
        }
      });

      if (changed) {
        await db.gradeHistory.create({
          data: {
            institutionId: ctx.institutionId,
            courseResultId,
            oldLetterGrade: result.letterGrade,
            newLetterGrade: band.letter,
            oldGradePoint: result.gradePoint,
            newGradePoint: band.point,
            oldTotalMarks: result.totalMarks,
            newTotalMarks: newMarks,
            reason: input.reason,
            changeType: 'moderation',
            changedBy: ctx.userId
          }
        });
      }

      return updated;
    }
  );
}

/**
 * Publish a session's results.
 *
 * REFUSES if anything has not been moderated. The audit's concern was that
 * results could go straight from entry to publication with no second pair of
 * eyes; this makes that impossible.
 *
 * Publication is atomic across the whole session — partial publication would
 * show some students a result and others nothing for the same examination.
 */
export async function publishSessionResults(sessionId: string) {
  const ctx = requireContext();

  const session = await basePrisma.examSession.findFirst({
    where: { id: sessionId, institutionId: ctx.institutionId },
    include: { schedules: true }
  });
  if (!session) throw new NotFoundError('Exam session');

  const courseIds = session.schedules.map((s) => s.courseId);

  const results = await basePrisma.courseResult.findMany({
    where: {
      institutionId: ctx.institutionId,
      courseId: { in: courseIds },
      semester: session.semester,
      academicYear: session.academicYear
    }
  });

  if (results.length === 0) {
    throw new BusinessRuleError('There are no results to publish for this session.');
  }

  const unmoderated = results.filter((r) => !MODERATED_STATUSES.has(r.status));
  if (unmoderated.length > 0) {
    throw new BusinessRuleError(
      `Publication refused: ${unmoderated.length} result(s) have not been moderated.`,
      {
        unmoderated: unmoderated.map((r) => ({ id: r.id, status: r.status }))
      }
    );
  }

  return mutate(
    ctx,
    {
      action: 'PUBLISH',
      module: MODULE,
      resource: `ExamSession:${sessionId}`,
      details: `Published ${results.length} result(s) for session ${session.code}`,
      newValue: { session: session.code, resultCount: results.length },
      severity: 'critical'
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;
      const now = new Date();

      await db.courseResult.updateMany({
        where: { id: { in: results.map((r) => r.id) } },
        data: { status: 'published', publishedAt: now, publishedBy: ctx.userId }
      });

      await db.examSession.update({
        where: { id: sessionId },
        data: { status: 'results_published' }
      });

      // Recompute SGPA/CGPA for every affected student, IN THIS TRANSACTION.
      //
      // Nothing did this before. `StudentProfile.cgpa` had exactly one writer
      // (`recomputeStudentResults`), reachable only through an endpoint no
      // screen ever called — so results could be published while every
      // affected student's CGPA stayed at whatever it was, typically 0. A
      // published result the GPA does not reflect is worse than an unpublished
      // one: it looks finished.
      //
      // Inside the transaction rather than after it, so publication and the
      // figures derived from it cannot disagree.
      const affected = [...new Set(results.map((r) => r.studentProfileId))];
      for (const studentProfileId of affected) {
        await recomputeWithin(db, ctx, studentProfileId);
      }

      return { published: results.length, session: session.code, recomputed: affected.length };
    }
  );
}

// ─── Revaluation ──────────────────────────────────────────────────────────────

export async function requestRevaluation(input: {
  courseResultId: string;
  type?: string;
  reason?: string;
  fee?: number;
}) {
  const ctx = requireContext();

  const result = await basePrisma.courseResult.findFirst({
    where: { id: input.courseResultId, institutionId: ctx.institutionId }
  });
  if (!result) throw new NotFoundError('Course result');

  // Only a published result can be revalued — there is nothing to dispute
  // before publication, and moderation is the route at that stage.
  if (result.status !== 'published') {
    throw new BusinessRuleError(
      `Revaluation applies only to published results (current status: ${result.status}).`
    );
  }

  const existing = await basePrisma.revaluationRequest.findFirst({
    where: {
      courseResultId: input.courseResultId,
      status: { in: ['requested', 'fee_pending', 'under_evaluation'] }
    }
  });
  if (existing) {
    throw new ConflictError('A revaluation request is already open for this result.', {
      requestNumber: existing.requestNumber
    });
  }

  return mutate(
    ctx,
    {
      action: 'CREATE',
      module: MODULE,
      resource: (r) => `RevaluationRequest:${(r as { id: string }).id}`,
      details: (r) => `Revaluation ${(r as { requestNumber: string }).requestNumber} requested for a ${result.letterGrade} result`,
      newValue: { type: input.type ?? 'revaluation', originalMarks: result.totalMarks },
      severity: 'warning'
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      const count = await db.revaluationRequest.count({ where: { institutionId: ctx.institutionId } });
      const requestNumber = `REV-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

      return db.revaluationRequest.create({
        data: {
          institutionId: ctx.institutionId,
          courseResultId: input.courseResultId,
          studentProfileId: result.studentProfileId,
          type: input.type ?? 'revaluation',
          requestNumber,
          reason: input.reason ?? null,
          fee: input.fee ?? 0,
          feePaid: (input.fee ?? 0) === 0,
          originalMarks: result.totalMarks ?? 0,
          status: (input.fee ?? 0) > 0 ? 'fee_pending' : 'requested'
        }
      });
    }
  );
}

/**
 * Complete a revaluation.
 *
 * Creates a NEW ATTEMPT rather than overwriting the original — the first
 * evaluation remains part of the academic record, which is what makes a
 * revaluation defensible rather than a quiet correction.
 */
export async function completeRevaluation(
  requestId: string,
  input: { revisedMarks: number; remarks?: string; externalMarks?: number }
) {
  const ctx = requireContext();

  const request = await basePrisma.revaluationRequest.findFirst({
    where: { id: requestId, institutionId: ctx.institutionId }
  });
  if (!request) throw new NotFoundError('Revaluation request');

  if (request.status === 'completed') {
    throw new ConflictError('This revaluation is already complete.');
  }
  if (!request.feePaid) {
    throw new BusinessRuleError('The revaluation fee has not been paid.');
  }

  const original = await basePrisma.courseResult.findFirst({
    where: { id: request.courseResultId, institutionId: ctx.institutionId }
  });
  if (!original) throw new NotFoundError('Course result');

  const scale = await activeGradeScale(ctx.institutionId);
  const maxMarks = original.maxMarks ?? 100;

  if (input.revisedMarks < 0 || input.revisedMarks > maxMarks) {
    throw new ValidationError(`Revised marks must be within 0..${maxMarks}.`);
  }

  const band = gradeFor(input.revisedMarks, maxMarks, scale);
  const changed = input.revisedMarks !== original.totalMarks;

  return mutate(
    ctx,
    {
      action: 'UPDATE',
      module: MODULE,
      resource: `RevaluationRequest:${requestId}`,
      details: changed
        ? `Revaluation ${request.requestNumber}: ${original.totalMarks} → ${input.revisedMarks} (${original.letterGrade} → ${band.letter})`
        : `Revaluation ${request.requestNumber}: marks unchanged at ${original.totalMarks}`,
      oldValue: { totalMarks: original.totalMarks, letterGrade: original.letterGrade },
      newValue: { totalMarks: input.revisedMarks, letterGrade: band.letter },
      reason: input.remarks ?? 'Revaluation outcome',
      severity: 'critical'
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      await db.revaluationRequest.update({
        where: { id: requestId },
        data: {
          revisedMarks: input.revisedMarks,
          marksChanged: changed,
          status: 'completed',
          evaluatedBy: ctx.userId,
          evaluatedAt: new Date(),
          remarks: input.remarks ?? null
        }
      });

      if (!changed) {
        return { requestNumber: request.requestNumber, marksChanged: false };
      }

      // New attempt — the original evaluation is preserved.
      const nextAttempt = original.attempt + 1;

      const revalued = await db.courseResult.create({
        data: {
          institutionId: ctx.institutionId,
          studentProfileId: original.studentProfileId,
          courseId: original.courseId,
          semester: original.semester,
          academicYear: original.academicYear,
          internalMarks: original.internalMarks,
          // The re-marked paper when given; the total otherwise (legacy callers).
          externalMarks: input.externalMarks ?? input.revisedMarks,
          totalMarks: input.revisedMarks,
          maxMarks,
          letterGrade: band.letter,
          gradePoint: band.point,
          credits: original.credits,
          isPassing: band.isPassing,
          isExcludedFromGpa: band.isExcludedFromGpa,
          attempt: nextAttempt,
          status: 'revalued',
          publishedAt: new Date(),
          publishedBy: ctx.userId
        }
      });

      await db.gradeHistory.create({
        data: {
          institutionId: ctx.institutionId,
          courseResultId: revalued.id,
          oldLetterGrade: original.letterGrade,
          newLetterGrade: band.letter,
          oldGradePoint: original.gradePoint,
          newGradePoint: band.point,
          oldTotalMarks: original.totalMarks,
          newTotalMarks: input.revisedMarks,
          reason: input.remarks ?? `Revaluation ${request.requestNumber}`,
          changeType: 'revaluation',
          changedBy: ctx.userId
        }
      });

      // A revaluation that changes a grade changes the CGPA by definition.
      // This used to return `recomputeRequiredFor` and rely on the caller —
      // and no caller anywhere ever did it, so a successful revaluation
      // updated the transcript and left the CGPA reflecting the old mark.
      // Done here, in the same transaction, rather than asked of a caller who
      // may forget.
      const recomputed = await recomputeWithin(db, ctx, original.studentProfileId);

      return {
        requestNumber: request.requestNumber,
        marksChanged: true,
        attempt: nextAttempt,
        oldGrade: original.letterGrade,
        newGrade: band.letter,
        cgpa: recomputed.cgpa
      };
    }
  );
}
