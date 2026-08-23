/**
 * Examination lifecycle service.
 *
 * Blueprint: "The ERP ensures only eligible students (attendance and fee
 * compliance) can register, enforcing academic rules."
 *
 * The audit found 8 endpoints covering this domain and no lifecycle at all —
 * no registration, no eligibility enforcement, no hall tickets, no moderation,
 * no revaluation.
 *
 * DESIGN NOTES
 *
 * 1. Eligibility is COMPUTED from real attendance records and real fee rows,
 *    never asserted. The figures behind each decision are stored on the
 *    registration so a refusal can be explained months later.
 *
 * 2. Thresholds are per-session DATA, not constants. UGC/AICTE commonly mandate
 *    75% attendance but institutions differ and rules change year to year.
 *
 * 3. Condonation is supported because institutions do waive shortfalls — but it
 *    records who waived it and why. A waiver is exactly the kind of decision
 *    that must be auditable.
 *
 * 4. Hall tickets are issued only when EVERY registration in the session is
 *    eligible. A partially valid hall ticket is worse than none: a student
 *    would arrive at a hall they may not sit in.
 */

import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { basePrisma } from '../../lib/prisma.js';
import { mutate, requireContext } from '../../lib/service.js';
import {
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  ValidationError
} from '../../lib/errors.js';

const MODULE = 'examination';

// ─── Sessions ─────────────────────────────────────────────────────────────────

export interface CreateSessionInput {
  code: string;
  name: string;
  type: string;
  academicYear: string;
  semester: number;
  registrationStartsAt: Date;
  registrationEndsAt: Date;
  examStartsAt: Date;
  examEndsAt: Date;
  minAttendancePercentage?: number;
  requireFeeClearance?: boolean;
}

export async function createSession(input: CreateSessionInput) {
  const ctx = requireContext();

  if (input.registrationEndsAt <= input.registrationStartsAt) {
    throw new ValidationError('The registration window must end after it starts.');
  }
  if (input.examStartsAt < input.registrationEndsAt) {
    throw new ValidationError('Examinations cannot begin before registration closes.');
  }
  if (input.examEndsAt < input.examStartsAt) {
    throw new ValidationError('The examination period must end after it starts.');
  }

  return mutate(
    ctx,
    {
      action: 'CREATE',
      module: MODULE,
      resource: (r) => `ExamSession:${(r as { id: string }).id}`,
      details: `Created exam session ${input.code} (${input.type}, ${input.academicYear} S${input.semester})`,
      newValue: {
        code: input.code,
        minAttendance: input.minAttendancePercentage ?? 75,
        feeClearance: input.requireFeeClearance ?? true
      },
      severity: 'warning'
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      const existing = await db.examSession.findFirst({
        where: { institutionId: ctx.institutionId, code: input.code }
      });
      if (existing) throw new ConflictError(`Exam session ${input.code} already exists.`);

      return db.examSession.create({
        data: {
          institutionId: ctx.institutionId,
          campusId: ctx.campusId,
          code: input.code,
          name: input.name,
          type: input.type,
          academicYear: input.academicYear,
          semester: input.semester,
          registrationStartsAt: input.registrationStartsAt,
          registrationEndsAt: input.registrationEndsAt,
          examStartsAt: input.examStartsAt,
          examEndsAt: input.examEndsAt,
          minAttendancePercentage: input.minAttendancePercentage ?? 75,
          requireFeeClearance: input.requireFeeClearance ?? true,
          status: 'draft',
          createdBy: ctx.userId
        }
      });
    }
  );
}

export async function addSchedule(input: {
  sessionId: string;
  courseId: string;
  examDate: Date;
  startTime: string;
  endTime: string;
  venue?: string;
  maxMarks?: number;
}) {
  const ctx = requireContext();

  const session = await basePrisma.examSession.findFirst({
    where: { id: input.sessionId, institutionId: ctx.institutionId }
  });
  if (!session) throw new NotFoundError('Exam session');

  const course = await basePrisma.course.findFirst({
    where: { id: input.courseId, institutionId: ctx.institutionId }
  });
  if (!course) throw new NotFoundError('Course');

  // The paper must actually fall inside the session's examination window.
  if (input.examDate < session.examStartsAt || input.examDate > session.examEndsAt) {
    throw new ValidationError(
      `The exam date falls outside the session window ` +
        `(${session.examStartsAt.toISOString().slice(0, 10)} to ${session.examEndsAt.toISOString().slice(0, 10)}).`
    );
  }

  return mutate(
    ctx,
    {
      action: 'CREATE',
      module: MODULE,
      resource: (r) => `ExamSchedule:${(r as { id: string }).id}`,
      details: `Scheduled ${course.code} on ${input.examDate.toISOString().slice(0, 10)} in session ${session.code}`
    },
    async (tx) =>
      (tx as never as typeof basePrisma).examSchedule.create({
        data: {
          institutionId: ctx.institutionId,
          sessionId: input.sessionId,
          courseId: input.courseId,
          examDate: input.examDate,
          startTime: input.startTime,
          endTime: input.endTime,
          venue: input.venue ?? null,
          maxMarks: input.maxMarks ?? 100
        }
      })
  );
}

export async function openRegistration(sessionId: string) {
  const ctx = requireContext();

  const session = await basePrisma.examSession.findFirst({
    where: { id: sessionId, institutionId: ctx.institutionId },
    include: { schedules: true }
  });
  if (!session) throw new NotFoundError('Exam session');

  if (session.schedules.length === 0) {
    throw new BusinessRuleError(
      'Registration cannot open for a session with no scheduled papers.'
    );
  }

  return mutate(
    ctx,
    {
      action: 'UPDATE',
      module: MODULE,
      resource: `ExamSession:${sessionId}`,
      details: `Opened registration for ${session.code} (${session.schedules.length} papers)`,
      oldValue: { status: session.status },
      newValue: { status: 'registration_open' },
      severity: 'warning'
    },
    async (tx) =>
      (tx as never as typeof basePrisma).examSession.update({
        where: { id: sessionId },
        data: { status: 'registration_open' }
      })
  );
}

// ─── Eligibility ──────────────────────────────────────────────────────────────

export interface EligibilityResult {
  studentProfileId: string;
  rollNumber: string;
  courseCode: string;
  attendancePercentage: number | null;
  attendanceMet: boolean;
  feesCleared: boolean;
  outstandingFeeAmount: number;
  isEligible: boolean;
  reasons: string[];
}

/**
 * Compute attendance percentage for one student in one course.
 *
 * Derived from `AttendanceSession` + `Attendance` records. Returns null when no
 * sessions have been held — which is NOT the same as 0%, and must not be
 * treated as a shortfall. A student cannot fall short of a requirement in a
 * course that has never met.
 */
async function attendancePercentageFor(
  studentProfileId: string,
  courseId: string
): Promise<number | null> {
  const sessions = await basePrisma.attendanceSession.findMany({
    where: { courseId },
    select: { id: true }
  });

  if (sessions.length === 0) return null;

  const sessionIds = sessions.map((s) => s.id);

  const present = await basePrisma.attendance.count({
    where: {
      studentProfileId,
      attendanceSessionId: { in: sessionIds },
      status: { in: ['present', 'late', 'on_duty'] }
    }
  });

  return Math.round((present / sessions.length) * 10000) / 100;
}

/** Total unpaid fees for a student. */
async function outstandingFeesFor(studentProfileId: string): Promise<number> {
  const unpaid = await basePrisma.feeRecord.findMany({
    where: { studentProfileId, status: { in: ['pending', 'overdue', 'partial'] } },
    select: { amount: true }
  });

  return unpaid.reduce((sum, f) => sum + f.amount, 0);
}

/**
 * Evaluate exam eligibility for a student across a session's papers.
 *
 * A dry run — writes nothing. A student portal can show what is blocking them
 * before the registration window closes, which is the point.
 */
export async function checkEligibility(
  sessionId: string,
  studentProfileId: string
): Promise<EligibilityResult[]> {
  const ctx = requireContext();

  const session = await basePrisma.examSession.findFirst({
    where: { id: sessionId, institutionId: ctx.institutionId },
    include: { schedules: { include: { course: true } } }
  });
  if (!session) throw new NotFoundError('Exam session');

  const student = await basePrisma.studentProfile.findFirst({
    where: { id: studentProfileId, institutionId: ctx.institutionId }
  });
  if (!student) throw new NotFoundError('Student profile');

  // Fees are institution-wide, not per paper — computed once.
  const outstanding = await outstandingFeesFor(studentProfileId);
  const feesCleared = !session.requireFeeClearance || outstanding <= 0;

  const results: EligibilityResult[] = [];

  for (const schedule of session.schedules) {
    const reasons: string[] = [];

    const attendance = await attendancePercentageFor(studentProfileId, schedule.courseId);

    // No sessions held → attendance cannot be assessed, so it does not block.
    const attendanceMet =
      attendance === null || attendance >= session.minAttendancePercentage;

    if (!attendanceMet && attendance !== null) {
      reasons.push(
        `Attendance is ${attendance}%, below the required ${session.minAttendancePercentage}%.`
      );
    }

    if (!feesCleared) {
      reasons.push(
        `Outstanding fees of ${outstanding.toFixed(2)} must be cleared before registration.`
      );
    }

    results.push({
      studentProfileId,
      rollNumber: student.rollNumber,
      courseCode: schedule.course.code,
      attendancePercentage: attendance,
      attendanceMet,
      feesCleared,
      outstandingFeeAmount: outstanding,
      isEligible: reasons.length === 0,
      reasons
    });
  }

  return results;
}

/**
 * Register a student for a session's papers.
 *
 * Ineligible papers are recorded as `ineligible` rather than skipped, so the
 * decision and the figures behind it are preserved. A student who later
 * disputes a refusal can be shown exactly what was assessed and when.
 */
export async function registerStudent(sessionId: string, studentProfileId: string) {
  const ctx = requireContext();

  const session = await basePrisma.examSession.findFirst({
    where: { id: sessionId, institutionId: ctx.institutionId },
    include: { schedules: true }
  });
  if (!session) throw new NotFoundError('Exam session');

  if (session.status !== 'registration_open') {
    throw new BusinessRuleError(
      `Registration is not open for this session (status: ${session.status}).`
    );
  }

  const now = new Date();
  if (now < session.registrationStartsAt) {
    throw new BusinessRuleError('The registration window has not opened yet.');
  }
  if (now > session.registrationEndsAt) {
    throw new BusinessRuleError('The registration window has closed.');
  }

  const eligibility = await checkEligibility(sessionId, studentProfileId);
  const byCourse = new Map(eligibility.map((e) => [e.courseCode, e]));

  const scheduleCourses = await basePrisma.course.findMany({
    where: { id: { in: session.schedules.map((s) => s.courseId) } },
    select: { id: true, code: true }
  });
  const codeByCourseId = new Map(scheduleCourses.map((c) => [c.id, c.code]));

  const eligibleCount = eligibility.filter((e) => e.isEligible).length;

  return mutate(
    ctx,
    {
      action: 'CREATE',
      module: MODULE,
      resource: `ExamSession:${sessionId}`,
      details: `Exam registration for ${eligibility[0]?.rollNumber ?? studentProfileId}: ${eligibleCount}/${eligibility.length} papers eligible`,
      newValue: {
        eligible: eligibleCount,
        total: eligibility.length,
        blocked: eligibility.filter((e) => !e.isEligible).map((e) => e.courseCode)
      },
      severity: eligibleCount < eligibility.length ? 'warning' : 'info'
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      for (const schedule of session.schedules) {
        const code = codeByCourseId.get(schedule.courseId) ?? '';
        const check = byCourse.get(code);
        if (!check) continue;

        await db.examRegistration.upsert({
          where: {
            scheduleId_studentProfileId: {
              scheduleId: schedule.id,
              studentProfileId
            }
          },
          update: {
            attendancePercentage: check.attendancePercentage,
            attendanceMet: check.attendanceMet,
            feesCleared: check.feesCleared,
            outstandingFeeAmount: check.outstandingFeeAmount,
            isEligible: check.isEligible,
            ineligibilityReasons: check.reasons.length > 0 ? check.reasons : Prisma.DbNull,
            status: check.isEligible ? 'registered' : 'ineligible'
          },
          create: {
            institutionId: ctx.institutionId,
            sessionId,
            scheduleId: schedule.id,
            studentProfileId,
            attendancePercentage: check.attendancePercentage,
            attendanceMet: check.attendanceMet,
            feesCleared: check.feesCleared,
            outstandingFeeAmount: check.outstandingFeeAmount,
            isEligible: check.isEligible,
            ineligibilityReasons: check.reasons.length > 0 ? check.reasons : Prisma.DbNull,
            status: check.isEligible ? 'registered' : 'ineligible',
            registeredBy: ctx.userId
          }
        });
      }

      return {
        rollNumber: eligibility[0]?.rollNumber,
        totalPapers: eligibility.length,
        eligible: eligibleCount,
        blocked: eligibility.filter((e) => !e.isEligible).map((e) => ({
          courseCode: e.courseCode,
          reasons: e.reasons
        }))
      };
    }
  );
}

/**
 * Condone an attendance shortfall for one registration.
 *
 * Institutions do waive shortfalls. This records WHO waived it and WHY, because
 * a discretionary override of an academic rule is precisely what an audit
 * needs to be able to see.
 */
export async function condoneShortfall(registrationId: string, reason: string) {
  const ctx = requireContext();

  if (!reason || reason.trim().length < 10) {
    throw new BusinessRuleError(
      'Condonation requires a reason of at least 10 characters. It is recorded permanently.'
    );
  }

  const registration = await basePrisma.examRegistration.findFirst({
    where: { id: registrationId, institutionId: ctx.institutionId }
  });
  if (!registration) throw new NotFoundError('Exam registration');

  if (registration.isEligible) {
    throw new BusinessRuleError('This registration is already eligible; condonation is unnecessary.');
  }

  // Fee dues are a financial obligation, not an academic shortfall — they are
  // deliberately NOT condonable through this path.
  if (!registration.feesCleared) {
    throw new BusinessRuleError(
      'Outstanding fees cannot be condoned here. Clear or formally waive the fee record first.'
    );
  }

  return mutate(
    ctx,
    {
      action: 'APPROVE',
      module: MODULE,
      resource: `ExamRegistration:${registrationId}`,
      details: `Condoned attendance shortfall (${registration.attendancePercentage}%) for exam registration`,
      oldValue: { isEligible: false, attendancePercentage: registration.attendancePercentage },
      newValue: { isEligible: true, isCondoned: true },
      reason,
      severity: 'critical' // discretionary override of an academic rule
    },
    async (tx) =>
      (tx as never as typeof basePrisma).examRegistration.update({
        where: { id: registrationId },
        data: {
          isEligible: true,
          isCondoned: true,
          condonedBy: ctx.userId,
          condonedAt: new Date(),
          condonationReason: reason,
          status: 'condoned'
        }
      })
  );
}

// ─── Hall tickets ─────────────────────────────────────────────────────────────

/**
 * Issue a hall ticket.
 *
 * Refuses while ANY registration in the session is ineligible. A partially
 * valid hall ticket is worse than none — a student would arrive at a hall they
 * are not permitted to sit in.
 */
export async function issueHallTicket(sessionId: string, studentProfileId: string) {
  const ctx = requireContext();

  const registrations = await basePrisma.examRegistration.findMany({
    where: { sessionId, studentProfileId, institutionId: ctx.institutionId },
    include: { schedule: { include: { course: true } } }
  });

  if (registrations.length === 0) {
    throw new NotFoundError('Exam registration for this student');
  }

  const ineligible = registrations.filter((r) => !r.isEligible);
  if (ineligible.length > 0) {
    throw new BusinessRuleError(
      `A hall ticket cannot be issued: ${ineligible.length} paper(s) are still ineligible.`,
      {
        blocked: ineligible.map((r) => ({
          courseCode: r.schedule.course.code,
          reasons: r.ineligibilityReasons
        }))
      }
    );
  }

  const student = await basePrisma.studentProfile.findFirst({
    where: { id: studentProfileId, institutionId: ctx.institutionId }
  });
  if (!student) throw new NotFoundError('Student profile');

  const existing = await basePrisma.hallTicket.findFirst({
    where: { sessionId, studentProfileId }
  });
  if (existing) {
    throw new ConflictError('A hall ticket has already been issued for this session.', {
      ticketNumber: existing.ticketNumber
    });
  }

  return mutate(
    ctx,
    {
      action: 'CREATE',
      module: MODULE,
      resource: (r) => `HallTicket:${(r as { id: string }).id}`,
      details: `Issued hall ticket to ${student.rollNumber} for ${registrations.length} paper(s)`,
      severity: 'warning'
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      const count = await db.hallTicket.count({ where: { institutionId: ctx.institutionId } });
      const ticketNumber = `HT-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;

      const ticket = await db.hallTicket.create({
        data: {
          institutionId: ctx.institutionId,
          sessionId,
          studentProfileId,
          ticketNumber,
          // Checkable at the hall without exposing internal ids.
          verificationCode: randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase(),
          issuedBy: ctx.userId,
          status: 'valid',
          entries: {
            create: registrations.map((r) => ({ scheduleId: r.scheduleId }))
          }
        },
        include: { entries: true }
      });

      return {
        ticketNumber: ticket.ticketNumber,
        verificationCode: ticket.verificationCode,
        rollNumber: student.rollNumber,
        papers: registrations.map((r) => ({
          courseCode: r.schedule.course.code,
          examDate: r.schedule.examDate,
          startTime: r.schedule.startTime,
          venue: r.schedule.venue
        }))
      };
    }
  );
}

/** Session-level registration statistics — exam-branch operational view. */
export async function getSessionStatistics(sessionId: string) {
  const ctx = requireContext();

  const session = await basePrisma.examSession.findFirst({
    where: { id: sessionId, institutionId: ctx.institutionId },
    include: { schedules: true }
  });
  if (!session) throw new NotFoundError('Exam session');

  const byStatus = await basePrisma.examRegistration.groupBy({
    by: ['status'],
    where: { sessionId },
    _count: { _all: true }
  });

  const [ticketsIssued, condoned] = await Promise.all([
    basePrisma.hallTicket.count({ where: { sessionId, status: 'valid' } }),
    basePrisma.examRegistration.count({ where: { sessionId, isCondoned: true } })
  ]);

  return {
    session: {
      code: session.code,
      name: session.name,
      status: session.status,
      minAttendancePercentage: session.minAttendancePercentage,
      requireFeeClearance: session.requireFeeClearance
    },
    papers: session.schedules.length,
    registrations: {
      total: byStatus.reduce((sum, r) => sum + r._count._all, 0),
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all]))
    },
    condonations: condoned,
    hallTicketsIssued: ticketsIssued
  };
}
