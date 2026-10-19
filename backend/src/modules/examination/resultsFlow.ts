/**
 * The end-semester result chain, as the blueprint's examination module runs it:
 *
 *   faculty enter marks  → submitted
 *   HOD verifies course  → verified      (or returns it to the faculty)
 *   CoE moderates        → moderated     (accepts, or revises with a reason)
 *   CoE submits the department to the Dean (RESULT_PUBLICATION workflow)
 *   Dean approves        → published     (SGPA/CGPA recomputed, students told)
 *   student may request revaluation → CoE completes it (a new attempt)
 *
 * The engine pieces (marks.service: enterExamMarks, moderateResult,
 * completeRevaluation) existed with no screen calling them, and the screens did
 * something else: the HOD's "Verify" and "Forward to CoE" wrote approval rows
 * already marked approved that nothing read, and the Dean approving a
 * publication published nothing. This module is the glue the screens call.
 */
import { basePrisma } from '../../lib/prisma.js';
import { mutate } from '../../lib/service.js';
import { BusinessRuleError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { notifyInApp } from '../../lib/inAppNotify.js';
import type { TenantContext } from '../../lib/tenant.js';
import { recomputeWithin } from '../results/results.service.js';
import * as marks from './marks.service.js';

/**
 * Internal (continuous assessment) : end-semester weightage. 40:60 is the common
 * UGC-pattern split; faculty record internals out of 100 on the Marks screen.
 */
export const INTERNAL_WEIGHT = 0.4;

/** Course total on the paper's scale from internals (/100) and the paper (/max). */
export function combineMarks(internalOf100: number, external: number, maxMarks: number): number {
  const pct = INTERNAL_WEIGHT * internalOf100 + (1 - INTERNAL_WEIGHT) * (external / maxMarks) * 100;
  // Course totals are rounded to whole marks, as on a marks memo.
  return Math.round((pct * maxMarks) / 100);
}

const OPEN_SESSION = { status: { notIn: ['results_published', 'cancelled'] } };

/** The schedules whose results are still being worked on. */
async function openSchedules(institutionId: string, where: Record<string, unknown> = {}) {
  return basePrisma.examSchedule.findMany({
    where: { institutionId, session: OPEN_SESSION, ...where },
    include: { session: true, course: { include: { faculty: { include: { user: { select: { id: true, name: true } } } } } } },
    orderBy: { examDate: 'asc' }
  });
}

type Schedule = Awaited<ReturnType<typeof openSchedules>>[number];

/** Every registered candidate of a paper with their marks so far. */
async function sheet(institutionId: string, s: Schedule) {
  const [regs, enrolments, results] = await Promise.all([
    basePrisma.examRegistration.findMany({
      where: { scheduleId: s.id },
      include: { studentProfile: { include: { user: { select: { name: true } } } } }
    }),
    basePrisma.enrollment.findMany({ where: { courseId: s.courseId }, select: { studentProfileId: true, internalMarks: true } }),
    basePrisma.courseResult.findMany({
      where: { institutionId, courseId: s.courseId, semester: s.session.semester, academicYear: s.session.academicYear, attempt: 1 }
    })
  ]);
  const internal = new Map(enrolments.map((e) => [e.studentProfileId, e.internalMarks]));
  const result = new Map(results.map((r) => [r.studentProfileId, r]));
  const rows = regs
    .map((r: any) => {
      const res = result.get(r.studentProfileId);
      return {
        studentProfileId: r.studentProfileId,
        rollNumber: r.studentProfile.rollNumber,
        name: r.studentProfile.user?.name ?? '',
        eligible: r.isEligible,
        ineligibilityReasons: r.ineligibilityReasons ?? null,
        internalMarks: internal.get(r.studentProfileId) ?? null,
        externalMarks: res?.externalMarks ?? null,
        totalMarks: res?.totalMarks ?? null,
        absent: r.status === 'absent',
        grade: res?.letterGrade ?? null,
        status: res?.status ?? 'pending',
        courseResultId: res?.id ?? null
      };
    })
    .sort((a, b) => String(a.rollNumber).localeCompare(String(b.rollNumber)));
  const eligible = rows.filter((r) => r.eligible);
  const count = (st: string) => eligible.filter((r) => r.status === st).length;
  return {
    scheduleId: s.id,
    session: s.session.code,
    sessionName: s.session.name ?? s.session.code,
    semester: s.session.semester,
    academicYear: s.session.academicYear,
    examDate: s.examDate,
    courseId: s.courseId,
    courseCode: s.course.code,
    courseName: s.course.name,
    departmentId: s.course.departmentId,
    faculty: s.course.faculty?.user?.name ?? 'Unassigned',
    facultyUserId: s.course.faculty?.user?.id ?? null,
    maxMarks: s.maxMarks,
    internalWeight: INTERNAL_WEIGHT,
    eligibleCount: eligible.length,
    entered: eligible.length - count('pending'),
    submitted: count('submitted'),
    verified: count('verified'),
    moderated: count('moderated'),
    published: count('published') + count('revalued'),
    stage: stageOf(eligible.map((r) => r.status)),
    rows
  };
}

/** One word for where a paper's results stand, for badges and filters. */
function stageOf(statuses: string[]): string {
  if (statuses.length === 0) return 'no_candidates';
  const all = (st: string[]) => statuses.every((x) => st.includes(x));
  if (all(['published', 'revalued'])) return 'published';
  if (all(['moderated', 'published', 'revalued'])) return 'moderated';
  if (all(['verified', 'moderated'])) return 'verified';
  if (all(['submitted', 'verified', 'moderated'])) return 'entered';
  if (statuses.some((x) => x !== 'pending')) return 'entry_in_progress';
  return 'awaiting_marks';
}

// ─── Faculty ─────────────────────────────────────────────────────────────────

export async function facultySheets(ctx: TenantContext, facultyProfileId: string) {
  const schedules = await openSchedules(ctx.institutionId, { course: { facultyId: facultyProfileId } });
  return Promise.all(schedules.map((s) => sheet(ctx.institutionId, s)));
}

export interface MarkEntry { studentProfileId: string; externalMarks?: number | null; absent?: boolean }

export async function saveFacultyMarks(ctx: TenantContext, facultyProfileId: string, scheduleId: string, entries: MarkEntry[]) {
  const [s] = await openSchedules(ctx.institutionId, { id: scheduleId });
  if (!s) throw new NotFoundError('Exam paper');
  if (s.course.facultyId !== facultyProfileId) throw new BusinessRuleError('You can enter marks only for papers of courses you teach.');
  const current = await sheet(ctx.institutionId, s);
  const byStudent = new Map(current.rows.map((r) => [r.studentProfileId, r]));
  const saved: string[] = [];
  const skipped: { rollNumber: string; reason: string }[] = [];
  for (const e of entries) {
    const row = byStudent.get(e.studentProfileId);
    if (!row) { skipped.push({ rollNumber: e.studentProfileId, reason: 'not registered for this paper' }); continue; }
    if (!row.eligible) { skipped.push({ rollNumber: row.rollNumber, reason: 'not eligible (attendance shortage)' }); continue; }
    if (!['pending', 'submitted'].includes(row.status)) { skipped.push({ rollNumber: row.rollNumber, reason: `already ${row.status}; ask the HOD to return it` }); continue; }
    if (!e.absent && (e.externalMarks === null || e.externalMarks === undefined)) continue; // left blank
    if (!e.absent && (e.externalMarks! < 0 || e.externalMarks! > s.maxMarks)) { skipped.push({ rollNumber: row.rollNumber, reason: `marks must be 0–${s.maxMarks}` }); continue; }
    if (!e.absent && row.internalMarks === null) { skipped.push({ rollNumber: row.rollNumber, reason: 'internal marks not recorded — enter them on the Internal marks tab first' }); continue; }
    const total = e.absent ? 0 : combineMarks(row.internalMarks!, e.externalMarks!, s.maxMarks);
    await marks.enterExamMarks({
      scheduleId, studentProfileId: e.studentProfileId,
      ...(row.internalMarks !== null ? { internalMarks: row.internalMarks } : {}),
      ...(e.absent ? {} : { externalMarks: e.externalMarks! }),
      totalMarks: total, isAbsent: !!e.absent
    });
    saved.push(row.rollNumber);
  }
  return { saved: saved.length, skipped, sheet: await sheet(ctx.institutionId, s) };
}

// ─── HOD ─────────────────────────────────────────────────────────────────────

export async function departmentSheets(ctx: TenantContext, departmentId: string) {
  const schedules = await openSchedules(ctx.institutionId, { course: { departmentId } });
  return Promise.all(schedules.map((s) => sheet(ctx.institutionId, s)));
}

async function departmentSchedule(ctx: TenantContext, departmentId: string, scheduleId: string) {
  const [s] = await openSchedules(ctx.institutionId, { id: scheduleId, course: { departmentId } });
  if (!s) throw new NotFoundError('Exam paper in your department');
  return s;
}

export async function verifyCourse(ctx: TenantContext, departmentId: string, scheduleId: string) {
  const s = await departmentSchedule(ctx, departmentId, scheduleId);
  const sh = await sheet(ctx.institutionId, s);
  const missing = sh.rows.filter((r) => r.eligible && r.status === 'pending');
  if (sh.eligibleCount === 0) throw new BusinessRuleError('No eligible candidates for this paper.');
  if (missing.length) throw new BusinessRuleError(`Marks are missing for ${missing.length} eligible candidate(s): ${missing.slice(0, 5).map((r) => r.rollNumber).join(', ')}${missing.length > 5 ? '…' : ''}.`);
  const ids = sh.rows.filter((r) => r.status === 'submitted').map((r) => r.courseResultId!) as string[];
  if (ids.length === 0) throw new BusinessRuleError('Nothing to verify — these results are already verified.');
  await mutate(ctx, { action: 'APPROVE', module: 'examination', resource: `ExamSchedule:${s.id}`, details: `HOD verified ${ids.length} result(s) of ${s.course.code}`, severity: 'warning' },
    (tx) => (tx as never as typeof basePrisma).courseResult.updateMany({ where: { id: { in: ids }, institutionId: ctx.institutionId }, data: { status: 'verified' } }));
  await notifyInApp(ctx.institutionId, { roles: ['coe'] }, {
    eventType: 'results.verified', subject: `${s.course.code} results verified by HOD`,
    body: `${ids.length} result(s) of ${s.course.name} are ready for moderation.`, relatedEntityType: 'ExamSchedule', relatedEntityId: s.id
  });
  if (sh.facultyUserId) await notifyInApp(ctx.institutionId, { userIds: [sh.facultyUserId] }, {
    eventType: 'results.verified', subject: `Your ${s.course.code} marks were verified`, body: 'They go to the Controller of Examinations for moderation.', relatedEntityType: 'ExamSchedule', relatedEntityId: s.id
  });
  return sheet(ctx.institutionId, s);
}

/** Send a paper's marks back to the faculty for correction. */
export async function returnCourse(ctx: TenantContext, departmentId: string, scheduleId: string, reason: string) {
  if (reason.trim().length < 10) throw new ValidationError('Say what needs correcting (at least 10 characters).');
  const s = await departmentSchedule(ctx, departmentId, scheduleId);
  const sh = await sheet(ctx.institutionId, s);
  const ids = sh.rows.filter((r) => r.status === 'verified').map((r) => r.courseResultId!) as string[];
  if (ids.length) {
    await mutate(ctx, { action: 'REJECT', module: 'examination', resource: `ExamSchedule:${s.id}`, details: `HOD returned ${s.course.code} marks to faculty`, reason, severity: 'warning' },
      (tx) => (tx as never as typeof basePrisma).courseResult.updateMany({ where: { id: { in: ids }, institutionId: ctx.institutionId }, data: { status: 'submitted' } }));
  }
  if (sh.facultyUserId) await notifyInApp(ctx.institutionId, { userIds: [sh.facultyUserId] }, {
    eventType: 'results.returned', subject: `HOD returned your ${s.course.code} marks`, body: reason, relatedEntityType: 'ExamSchedule', relatedEntityId: s.id
  });
  return sheet(ctx.institutionId, s);
}

// ─── CoE ─────────────────────────────────────────────────────────────────────

export async function allSheets(ctx: TenantContext) {
  const schedules = await openSchedules(ctx.institutionId);
  const sheets = await Promise.all(schedules.map((s) => sheet(ctx.institutionId, s)));
  const departments = await basePrisma.department.findMany({ where: { institutionId: ctx.institutionId }, select: { id: true, name: true } });
  const name = new Map(departments.map((d) => [d.id, d.name]));
  return sheets.map((x) => ({ ...x, department: name.get(x.departmentId) ?? '' }));
}

export interface Adjustment { courseResultId: string; revisedTotal: number; reason: string }

/** Moderate a verified paper: accept as entered, revising any listed result with a reason. */
export async function moderateCourse(ctx: TenantContext, scheduleId: string, adjustments: Adjustment[]) {
  const [s] = await openSchedules(ctx.institutionId, { id: scheduleId });
  if (!s) throw new NotFoundError('Exam paper');
  const sh = await sheet(ctx.institutionId, s);
  const notVerified = sh.rows.filter((r) => r.eligible && ['pending', 'submitted'].includes(r.status));
  if (notVerified.length) throw new BusinessRuleError(`The HOD has not verified ${notVerified.length} result(s) of ${s.course.code} yet.`);
  const verified = sh.rows.filter((r) => r.status === 'verified');
  if (!verified.length) throw new BusinessRuleError('Nothing to moderate — already moderated.');
  const adj = new Map(adjustments.map((a) => [a.courseResultId, a]));
  for (const r of verified) {
    const a = adj.get(r.courseResultId!);
    await marks.moderateResult(r.courseResultId!, a
      ? { revisedMarks: a.revisedTotal, reason: a.reason }
      : { reason: 'Accepted at moderation as entered and verified' });
  }
  return sheet(ctx.institutionId, s);
}

/** What still stands between a department and publication. */
export async function departmentReadiness(ctx: TenantContext, departmentId: string) {
  const sheets = await departmentSheets(ctx, departmentId);
  const papers = sheets.filter((x) => x.eligibleCount > 0);
  const notModerated = papers.filter((x) => !['moderated', 'published'].includes(x.stage));
  const toPublish = papers.filter((x) => x.stage === 'moderated').length;
  return {
    papers: toPublish, ready: toPublish > 0 && notModerated.length === 0,
    waiting: notModerated.map((x) => `${x.courseCode} (${x.stage.replace(/_/g, ' ')})`)
  };
}

/** Run when the Dean approves RESULT_PUBLICATION for a department. */
export async function publishDepartment(ctx: TenantContext, departmentId: string) {
  const sheets = await departmentSheets(ctx, departmentId);
  const ids = sheets.flatMap((x) => x.rows.filter((r) => r.status === 'moderated').map((r) => r.courseResultId!)) as string[];
  if (!ids.length) return { published: 0 };
  const students = [...new Set(sheets.flatMap((x) => x.rows.filter((r) => r.status === 'moderated').map((r) => r.studentProfileId)))];
  await mutate(ctx, { action: 'PUBLISH', module: 'examination', resource: `Department:${departmentId}`, details: `Published ${ids.length} result(s)`, severity: 'critical' }, async (tx) => {
    const db = tx as never as typeof basePrisma;
    await db.courseResult.updateMany({ where: { id: { in: ids }, institutionId: ctx.institutionId }, data: { status: 'published', publishedAt: new Date(), publishedBy: ctx.userId } });
  });
  // SGPA/CGPA per student, each in its own short transaction: a whole department
  // in one transaction outran the database's 5-second transaction limit.
  // Recomputation is idempotent, so a failure part-way is repaired by re-running.
  for (const id of students) {
    await basePrisma.$transaction((tx) => recomputeWithin(tx as never as typeof basePrisma, ctx, id), { timeout: 20000 });
  }
  // A session whose every paper is published is closed.
  for (const sessionId of [...new Set((await openSchedules(ctx.institutionId, { course: { departmentId } })).map((s) => s.sessionId))]) {
    const left = await basePrisma.examSchedule.findMany({ where: { institutionId: ctx.institutionId, sessionId }, select: { courseId: true } });
    const unpublished = await basePrisma.courseResult.count({ where: { institutionId: ctx.institutionId, courseId: { in: left.map((l) => l.courseId) }, status: { in: ['submitted', 'verified', 'moderated'] } } });
    if (unpublished === 0) {
      await basePrisma.examSession.updateMany({ where: { id: sessionId, institutionId: ctx.institutionId }, data: { status: 'results_published' } });
      // The CoE's exam tracker follows: this is the only way an exam reaches Published.
      await basePrisma.examProgress.updateMany({ where: { institutionId: ctx.institutionId, examSessionId: sessionId }, data: { status: 'published' } });
    }
  }
  const users = await basePrisma.studentProfile.findMany({ where: { id: { in: students }, institutionId: ctx.institutionId }, select: { userId: true } });
  await notifyInApp(ctx.institutionId, { userIds: users.map((u) => u.userId) }, {
    eventType: 'results.published', subject: 'Your semester results are published', body: 'See Examinations → Results. You can apply for revaluation from there.', relatedEntityType: 'CourseResult', relatedEntityId: departmentId
  });
  await basePrisma.approvalItem.updateMany({ where: { institutionId: ctx.institutionId, type: 'result_publication', details: departmentId, status: 'pending' }, data: { status: 'published' } });
  return { published: ids.length, students: students.length };
}

export async function revaluationQueue(ctx: TenantContext) {
  const reqs = await basePrisma.revaluationRequest.findMany({ where: { institutionId: ctx.institutionId }, orderBy: { requestedAt: 'desc' }, take: 300 });
  const results = await basePrisma.courseResult.findMany({ where: { institutionId: ctx.institutionId, id: { in: reqs.map((r) => r.courseResultId) } }, include: { course: { select: { code: true, name: true } } } });
  const students = await basePrisma.studentProfile.findMany({ where: { institutionId: ctx.institutionId, id: { in: reqs.map((r) => r.studentProfileId) } }, include: { user: { select: { name: true } } } });
  const res = new Map(results.map((r) => [r.id, r]));
  const st = new Map(students.map((s) => [s.id, s]));
  return reqs.map((r) => {
    const c = res.get(r.courseResultId);
    const s = st.get(r.studentProfileId);
    return {
      id: r.id, requestNumber: r.requestNumber, status: r.status, reason: r.reason, requestedAt: r.requestedAt,
      originalMarks: r.originalMarks, revisedMarks: r.revisedMarks, marksChanged: r.marksChanged, remarks: r.remarks,
      courseCode: c?.course.code ?? '', courseName: c?.course.name ?? '', maxMarks: c?.maxMarks ?? 100,
      internalMarks: c?.internalMarks ?? null, externalMarks: c?.externalMarks ?? null, grade: c?.letterGrade ?? null,
      studentName: s?.user?.name ?? '', rollNumber: s?.rollNumber ?? '', studentUserId: s?.userId ?? null
    };
  });
}

/** Complete a revaluation from the re-marked PAPER (the external component). */
export async function completeRevaluation(ctx: TenantContext, id: string, revisedExternal: number, remarks?: string) {
  const req = await basePrisma.revaluationRequest.findFirst({ where: { id, institutionId: ctx.institutionId } });
  if (!req) throw new NotFoundError('Revaluation request');
  const original = await basePrisma.courseResult.findFirst({ where: { id: req.courseResultId, institutionId: ctx.institutionId } });
  if (!original) throw new NotFoundError('Course result');
  const max = original.maxMarks ?? 100;
  if (revisedExternal < 0 || revisedExternal > max) throw new ValidationError(`Paper marks must be 0–${max}.`);
  const total = original.internalMarks !== null ? combineMarks(original.internalMarks, revisedExternal, max) : revisedExternal;
  const out: any = await marks.completeRevaluation(id, { revisedMarks: total, externalMarks: revisedExternal, ...(remarks ? { remarks } : {}) });
  const s = await basePrisma.studentProfile.findFirst({ where: { id: req.studentProfileId, institutionId: ctx.institutionId }, select: { userId: true } });
  if (s) await notifyInApp(ctx.institutionId, { userIds: [s.userId] }, {
    eventType: 'revaluation.completed', subject: `Revaluation ${req.requestNumber} completed`,
    body: out.marksChanged ? `Your grade changed from ${out.oldGrade} to ${out.newGrade}. CGPA is now ${out.cgpa}.` : 'Your marks are unchanged after revaluation.',
    relatedEntityType: 'RevaluationRequest', relatedEntityId: id
  });
  return out;
}
