/**
 * The exam branch's day-to-day: timetables, registration, condonation requests
 * and hall tickets, over the engine in examination.service.ts (which had no
 * screen and no way to list what it held).
 */
import { basePrisma } from '../../lib/prisma.js';
import { BusinessRuleError, ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { notifyInApp } from '../../lib/inAppNotify.js';
import type { TenantContext } from '../../lib/tenant.js';
import * as engine from './examination.service.js';
import * as workflow from '../workflow/workflow.service.js';
import { ensureDefinition } from '../workflow/bridge.js';
import { ATTENDANCE_CONDONATION_FLOW } from '../workflow/builtins.js';

export async function listSessions(ctx: TenantContext) {
  const sessions = await basePrisma.examSession.findMany({
    where: { institutionId: ctx.institutionId },
    include: { schedules: { select: { id: true } } },
    orderBy: { examStartsAt: 'desc' }
  });
  const ids = sessions.map((s) => s.id);
  const [regs, tickets] = await Promise.all([
    basePrisma.examRegistration.groupBy({ by: ['sessionId', 'status'], where: { institutionId: ctx.institutionId, sessionId: { in: ids } }, _count: { _all: true } }),
    basePrisma.hallTicket.groupBy({ by: ['sessionId'], where: { institutionId: ctx.institutionId, sessionId: { in: ids }, status: 'valid' }, _count: { _all: true } })
  ]);
  return sessions.map((s) => {
    const mine = regs.filter((r) => r.sessionId === s.id);
    const count = (st: string) => mine.find((r) => r.status === st)?._count._all ?? 0;
    return {
      id: s.id, code: s.code, name: s.name, type: s.type, academicYear: s.academicYear, semester: s.semester, status: s.status,
      registrationStartsAt: s.registrationStartsAt, registrationEndsAt: s.registrationEndsAt, examStartsAt: s.examStartsAt, examEndsAt: s.examEndsAt,
      minAttendancePercentage: s.minAttendancePercentage, requireFeeClearance: s.requireFeeClearance,
      papers: s.schedules.length,
      registrations: mine.reduce((a, r) => a + r._count._all, 0),
      eligible: count('registered') + count('condoned') + count('appeared') + count('absent'),
      ineligible: count('ineligible'),
      condoned: count('condoned'),
      hallTickets: tickets.find((t) => t.sessionId === s.id)?._count._all ?? 0
    };
  });
}

export async function sessionDetail(ctx: TenantContext, sessionId: string) {
  const session = await basePrisma.examSession.findFirst({
    where: { id: sessionId, institutionId: ctx.institutionId },
    include: { schedules: { include: { course: { include: { department: { select: { code: true } } } } }, orderBy: [{ examDate: 'asc' }, { startTime: 'asc' }] } }
  });
  if (!session) throw new NotFoundError('Exam session');
  const regs = await basePrisma.examRegistration.findMany({
    where: { institutionId: ctx.institutionId, sessionId },
    include: { studentProfile: { include: { user: { select: { name: true } } } }, schedule: { include: { course: { select: { code: true } } } } }
  });
  const instances = await basePrisma.workflowInstance.findMany({
    where: { institutionId: ctx.institutionId, entityType: 'ExamRegistration', entityId: { in: regs.map((r) => r.id) } },
    include: { definition: { include: { steps: true } } },
    orderBy: { startedAt: 'desc' }
  });
  const tickets = await basePrisma.hallTicket.findMany({ where: { institutionId: ctx.institutionId, sessionId }, select: { studentProfileId: true, ticketNumber: true } });
  const ticketOf = new Map(tickets.map((t) => [t.studentProfileId, t.ticketNumber]));
  const condonationOf = (regId: string) => {
    const inst = instances.find((i) => i.entityId === regId);
    if (!inst) return null;
    const step = inst.definition.steps.find((x) => x.id === inst.currentStepId);
    return { status: inst.status, waitingOn: inst.status === 'pending' ? step?.assigneeRole ?? null : null };
  };
  const students = new Map<string, any>();
  for (const r of regs) {
    const s = students.get(r.studentProfileId) ?? {
      studentProfileId: r.studentProfileId, rollNumber: r.studentProfile.rollNumber, name: r.studentProfile.user?.name ?? '',
      hallTicket: ticketOf.get(r.studentProfileId) ?? null, papers: [] as any[]
    };
    s.papers.push({
      registrationId: r.id, courseCode: r.schedule.course.code, status: r.status, isEligible: r.isEligible,
      attendancePercentage: r.attendancePercentage, reasons: r.ineligibilityReasons, condonation: condonationOf(r.id),
      condonationRequest: r.condonationRequest
    });
    students.set(r.studentProfileId, s);
  }
  return {
    ...session,
    schedules: session.schedules.map((x) => ({
      id: x.id, courseId: x.courseId, courseCode: x.course.code, courseName: x.course.name, department: x.course.department?.code ?? null,
      examDate: x.examDate, startTime: x.startTime, endTime: x.endTime, venue: x.venue, maxMarks: x.maxMarks,
      registered: regs.filter((r) => r.scheduleId === x.id).length,
      eligible: regs.filter((r) => r.scheduleId === x.id && r.isEligible).length
    })),
    students: [...students.values()].sort((a, b) => String(a.rollNumber).localeCompare(String(b.rollNumber)))
  };
}

/** Remove a paper from the timetable — only before anyone is registered for it. */
export async function removeSchedule(ctx: TenantContext, scheduleId: string) {
  const sch = await basePrisma.examSchedule.findFirst({ where: { id: scheduleId, institutionId: ctx.institutionId } });
  if (!sch) throw new NotFoundError('Exam paper');
  const n = await basePrisma.examRegistration.count({ where: { scheduleId } });
  if (n > 0) throw new BusinessRuleError(`${n} student(s) are registered for this paper; it can no longer be removed.`);
  await basePrisma.examSchedule.deleteMany({ where: { id: scheduleId, institutionId: ctx.institutionId } });
  return { removed: true };
}

/**
 * Register every student taking the session's courses. Each is checked for
 * attendance and fee clearance by the engine; ineligible papers are recorded
 * as such (with the reason) rather than skipped.
 */
export async function registerAll(ctx: TenantContext, sessionId: string) {
  const session = await basePrisma.examSession.findFirst({ where: { id: sessionId, institutionId: ctx.institutionId }, include: { schedules: true } });
  if (!session) throw new NotFoundError('Exam session');
  const enrolled = await basePrisma.enrollment.findMany({ where: { courseId: { in: session.schedules.map((s) => s.courseId) } }, select: { studentProfileId: true } });
  const students = [...new Set(enrolled.map((e) => e.studentProfileId))];
  let fullyEligible = 0, withBlocks = 0;
  const failed: string[] = [];
  for (const id of students) {
    try {
      const r: any = await engine.registerStudent(sessionId, id);
      if (r.eligible === r.totalPapers) fullyEligible++; else withBlocks++;
    } catch (e) {
      failed.push((e as Error).message);
    }
  }
  if (students.length && failed.length === students.length) throw new BusinessRuleError(failed[0]!);
  const users = await basePrisma.studentProfile.findMany({ where: { id: { in: students }, institutionId: ctx.institutionId }, select: { userId: true } });
  await notifyInApp(ctx.institutionId, { userIds: users.map((u) => u.userId) }, {
    eventType: 'exam.registered', subject: `Registered for ${session.name}`,
    body: 'See Examinations → Exam registration for your papers. If a paper shows a shortage, you can request condonation there.',
    relatedEntityType: 'ExamSession', relatedEntityId: sessionId
  });
  return { students: students.length, fullyEligible, withBlocks, failed: failed.length };
}

export async function closeRegistration(ctx: TenantContext, sessionId: string) {
  const session = await basePrisma.examSession.findFirst({ where: { id: sessionId, institutionId: ctx.institutionId } });
  if (!session) throw new NotFoundError('Exam session');
  if (session.status !== 'registration_open') throw new BusinessRuleError(`Registration is not open (status: ${session.status}).`);
  await basePrisma.examSession.updateMany({ where: { id: sessionId, institutionId: ctx.institutionId }, data: { status: 'registration_closed' } });
  return { status: 'registration_closed' };
}

/** Issue hall tickets to every student whose papers are all eligible and who has none yet. */
export async function issueAllHallTickets(ctx: TenantContext, sessionId: string) {
  const regs = await basePrisma.examRegistration.findMany({ where: { institutionId: ctx.institutionId, sessionId }, select: { studentProfileId: true, isEligible: true } });
  const byStudent = new Map<string, boolean>();
  for (const r of regs) byStudent.set(r.studentProfileId, (byStudent.get(r.studentProfileId) ?? true) && r.isEligible);
  const existing = new Set((await basePrisma.hallTicket.findMany({ where: { institutionId: ctx.institutionId, sessionId }, select: { studentProfileId: true } })).map((t) => t.studentProfileId));
  let issued = 0, blocked = 0;
  const issuedTo: string[] = [];
  for (const [studentId, allEligible] of byStudent) {
    if (existing.has(studentId)) continue;
    if (!allEligible) { blocked++; continue; }
    try { await engine.issueHallTicket(sessionId, studentId); issued++; issuedTo.push(studentId); }
    catch (e) { if (!(e instanceof ConflictError)) throw e; }
  }
  if (issuedTo.length) {
    const users = await basePrisma.studentProfile.findMany({ where: { id: { in: issuedTo }, institutionId: ctx.institutionId }, select: { userId: true } });
    await notifyInApp(ctx.institutionId, { userIds: users.map((u) => u.userId) }, {
      eventType: 'exam.hall_ticket', subject: 'Your hall ticket is ready',
      body: 'Download it from Examinations → Exam registration and bring a printed copy to every exam.',
      relatedEntityType: 'ExamSession', relatedEntityId: sessionId
    });
  }
  return { issued, blocked, alreadyIssued: existing.size };
}

// ─── Student side ────────────────────────────────────────────────────────────

export async function studentExams(ctx: TenantContext, studentProfileId: string) {
  const regs = await basePrisma.examRegistration.findMany({
    where: { institutionId: ctx.institutionId, studentProfileId },
    include: { session: true, schedule: { include: { course: true } } },
    orderBy: { registeredAt: 'desc' }
  });
  const sessionIds = [...new Set(regs.map((r) => r.sessionId))];
  const [tickets, instances] = await Promise.all([
    basePrisma.hallTicket.findMany({ where: { institutionId: ctx.institutionId, studentProfileId, sessionId: { in: sessionIds } } }),
    basePrisma.workflowInstance.findMany({
      where: { institutionId: ctx.institutionId, entityType: 'ExamRegistration', entityId: { in: regs.map((r) => r.id) } },
      include: { definition: { include: { steps: true } }, transitions: { orderBy: { occurredAt: 'desc' }, take: 1 } },
      orderBy: { startedAt: 'desc' }
    })
  ]);
  return sessionIds.map((sid) => {
    const mine = regs.filter((r) => r.sessionId === sid);
    const s = mine[0]!.session;
    const ticket = tickets.find((t) => t.sessionId === sid);
    return {
      sessionId: sid, code: s.code, name: s.name, status: s.status, semester: s.semester, academicYear: s.academicYear,
      minAttendancePercentage: s.minAttendancePercentage,
      hallTicket: ticket ? { ticketNumber: ticket.ticketNumber, verificationCode: ticket.verificationCode, issuedAt: ticket.issuedAt } : null,
      papers: mine
        .sort((a, b) => a.schedule.examDate.getTime() - b.schedule.examDate.getTime())
        .map((r) => {
          const inst = instances.find((i) => i.entityId === r.id);
          const step = inst?.definition.steps.find((x) => x.id === inst.currentStepId);
          return {
            registrationId: r.id, courseCode: r.schedule.course.code, courseName: r.schedule.course.name,
            examDate: r.schedule.examDate, startTime: r.schedule.startTime, endTime: r.schedule.endTime, venue: r.schedule.venue,
            status: r.status, isEligible: r.isEligible, attendancePercentage: r.attendancePercentage, feesCleared: r.feesCleared,
            reasons: r.ineligibilityReasons,
            condonation: inst ? { status: inst.status, waitingOn: inst.status === 'pending' ? step?.assigneeRole ?? null : null, note: inst.transitions[0]?.note ?? null } : null
          };
        })
    };
  });
}

/** A student asks for an attendance shortage on one paper to be condoned. */
export async function requestCondonation(ctx: TenantContext, studentProfileId: string, registrationId: string, reason: string, documentUrl?: string) {
  if (reason.trim().length < 20) throw new ValidationError('Explain the shortage in at least 20 characters (illness, representation, family emergency …).');
  const reg = await basePrisma.examRegistration.findFirst({ where: { id: registrationId, institutionId: ctx.institutionId, studentProfileId } });
  if (!reg) throw new NotFoundError('Exam registration');
  if (reg.isEligible) throw new BusinessRuleError('This paper is not blocked.');
  if (!reg.feesCleared) throw new BusinessRuleError('This paper is blocked by unpaid fees, which condonation does not cover. Clear the dues with the Finance office.');
  const open = await basePrisma.workflowInstance.findFirst({ where: { institutionId: ctx.institutionId, entityType: 'ExamRegistration', entityId: registrationId, status: 'pending' } });
  if (open) throw new ConflictError('A condonation request for this paper is already being considered.');
  await basePrisma.examRegistration.updateMany({
    where: { id: registrationId, institutionId: ctx.institutionId },
    data: { condonationRequest: reason.trim(), condonationRequestedAt: new Date(), condonationDocumentUrl: documentUrl ?? null }
  });
  await ensureDefinition(ctx, ATTENDANCE_CONDONATION_FLOW);
  const started = await workflow.startWorkflow(ctx, { code: ATTENDANCE_CONDONATION_FLOW.code, entityType: 'ExamRegistration', entityId: registrationId });
  return { instanceId: started.instanceId, waitingOn: started.assigneeRole };
}

/** Everything a printed hall ticket shows. */
export async function hallTicket(ctx: TenantContext, studentProfileId: string, sessionId: string) {
  const ticket = await basePrisma.hallTicket.findFirst({
    where: { institutionId: ctx.institutionId, sessionId, studentProfileId },
    include: { entries: { include: { schedule: { include: { course: true } } } }, session: true }
  });
  if (!ticket) throw new NotFoundError('Hall ticket — it has not been issued yet');
  const student = await basePrisma.studentProfile.findFirst({ where: { id: studentProfileId, institutionId: ctx.institutionId }, include: { user: { include: { department: true } } } });
  const institution = await basePrisma.institution.findFirst({ where: { id: ctx.institutionId } });
  return {
    institution: { name: institution?.name, address: [institution?.addressLine, institution?.city, institution?.state].filter(Boolean).join(', ') },
    ticketNumber: ticket.ticketNumber, verificationCode: ticket.verificationCode, issuedAt: ticket.issuedAt, status: ticket.status,
    session: { name: ticket.session.name, code: ticket.session.code, academicYear: ticket.session.academicYear, semester: ticket.session.semester },
    student: { name: student?.user?.name, rollNumber: student?.rollNumber, program: student?.program, branch: student?.branch, department: student?.user?.department?.name },
    papers: ticket.entries
      .map((e) => ({ courseCode: e.schedule.course.code, courseName: e.schedule.course.name, examDate: e.schedule.examDate, startTime: e.schedule.startTime, endTime: e.schedule.endTime, venue: e.schedule.venue }))
      .sort((a, b) => a.examDate.getTime() - b.examDate.getTime())
  };
}
