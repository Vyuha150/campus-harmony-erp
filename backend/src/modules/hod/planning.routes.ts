/**
 * Department planning for the HOD — the blueprint's "Workload & Timetable"
 * menu (HOD portal): assign courses to faculty, manage the department timetable
 * with conflict checking, and arrange cover when a faculty member is on leave.
 *
 * Timetable and allocation changes go to the Dean for approval
 * (TIMETABLE_WORKLOAD_APPROVAL) and take effect when approved. Substitutions
 * stay immediate: they cover a teacher on leave, often the same day.
 *
 *   GET    /planning/allocation              courses, who teaches each, weekly load
 *   PUT    /planning/allocation/:courseId    request: { facultyId | null }
 *   GET    /planning/timetable               every slot of the department's courses
 *   POST   /planning/timetable               request: add a slot      (conflict-checked)
 *   PUT    /planning/timetable/:scheduleId   request: move a slot     (conflict-checked)
 *   DELETE /planning/timetable/:scheduleId   request: drop a slot
 *   GET    /planning/changes                 requests and their outcome
 *   DELETE /planning/changes/:id             withdraw a pending request
 *   GET    /planning/substitutions?date=     the day's classes, who is on leave, cover arranged
 *   GET    /planning/substitutions/suggest   free faculty for a class
 *   POST   /planning/substitutions           arrange cover (immediate)
 *   DELETE /planning/substitutions/:id       cancel cover
 */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { basePrisma } from '../../lib/prisma.js';
import { getTenantContext } from '../../lib/tenant.js';
import { recordFromRequest } from '../../lib/audit.js';
import { notifyInApp } from '../../lib/inAppNotify.js';
import { NotFoundError, ValidationError, ConflictError, AuthorizationError } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { entityId } from '../../schemas/common.js';
import { act as workflowAct, startApprovalFor } from '../workflow/workflow.service.js';
import {
  DAYS, minutes, overlaps, facultyNames, studentUsers, checkChange, departmentCourse,
  type ChangeKind, type ChangePayload
} from './planning.service.js';

const router = Router();
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24-hour)');
const dayOf = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ValidationError('Give the date as YYYY-MM-DD', { field: 'date' });
  return new Date(`${value}T00:00:00.000Z`);
};

/** The HOD's department; writes are HOD-only, reads also serve principal and oversight roles. */
async function department(req: Request, write = false) {
  const ctx = getTenantContext(req);
  if (write && ctx.role !== 'hod' && ctx.role !== 'super_admin') {
    throw new AuthorizationError('Only the HOD changes the department timetable and subject allocation.');
  }
  const user = await basePrisma.user.findFirst({ where: { id: ctx.userId, institutionId: ctx.institutionId }, select: { departmentId: true } });
  if (!user?.departmentId) throw new NotFoundError('Department assignment', { hint: 'This account is not assigned to a department.' });
  return { ctx, departmentId: user.departmentId };
}

/**
 * Raise a change for the Dean. It is clash-checked now (and again when
 * approved); one open request per slot / per subject allocation.
 */
async function requestChange(req: Request, res: Response, kind: ChangeKind, payload: ChangePayload) {
  const { ctx, departmentId } = await department(req, true);
  const { courseId, summary } = await checkChange(ctx.institutionId, departmentId, kind, payload);
  const target = kind === 'allocation' ? `allocation:${courseId}` : payload.scheduleId ? `slot:${payload.scheduleId}` : null;
  if (target) {
    const open = await basePrisma.timetableChange.findFirst({ where: { institutionId: ctx.institutionId, target, status: 'pending' } });
    if (open) throw new ConflictError(`A change to this ${kind === 'allocation' ? 'subject' : 'class'} is already waiting for the Dean: ${open.summary}. Withdraw it first.`);
  }
  const change = await basePrisma.timetableChange.create({
    data: { institutionId: ctx.institutionId, departmentId, courseId, kind, target, payload: payload as never, summary, status: 'pending', requestedBy: ctx.userId }
  });
  const approval = await startApprovalFor(ctx, 'TIMETABLE_WORKLOAD_APPROVAL', 'TimetableChange', change.id);
  if (!approval) {
    // No approval process defined: never leave a request nobody can act on.
    await basePrisma.timetableChange.deleteMany({ where: { id: change.id } });
    throw new ValidationError('Timetable approval is not set up for this institution. Ask the administrator to define TIMETABLE_WORKLOAD_APPROVAL.');
  }
  await recordFromRequest(req, { action: 'CREATE', module: 'hod', resource: `TimetableChange:${change.id}`, details: `Sent to the Dean: ${summary}`, newValue: payload });
  res.json({ success: true, data: { changeId: change.id, summary, pendingApproval: true, approval } });
}

// ── Allocation ───────────────────────────────────────────────────────────────

router.get('/planning/allocation', asyncHandler(async (req: Request, res: Response) => {
  const { ctx, departmentId } = await department(req);
  const [courses, faculty] = await Promise.all([
    basePrisma.course.findMany({
      where: { institutionId: ctx.institutionId, departmentId },
      include: { schedules: true, _count: { select: { enrollments: true } } },
      orderBy: [{ semester: 'asc' }, { code: 'asc' }]
    }),
    basePrisma.facultyProfile.findMany({
      where: { institutionId: ctx.institutionId, user: { departmentId, role: { in: ['faculty', 'hod'] } } },
      select: { id: true, user: { select: { name: true, designation: true } } }
    })
  ]);
  const weeklyMinutes = (cs: typeof courses) => cs.reduce((sum, c) => sum + c.schedules.reduce((m, s) => m + minutes(s.endTime) - minutes(s.startTime), 0), 0);
  const names = new Map(faculty.map((f) => [f.id, f.user?.name ?? 'Faculty']));
  res.json({
    success: true,
    data: {
      courses: courses.map((c) => ({
        id: c.id, code: c.code, name: c.name, semester: c.semester, credits: c.credits,
        facultyId: c.facultyId, facultyName: c.facultyId ? names.get(c.facultyId) ?? 'Another department' : null,
        students: c._count.enrollments,
        weeklyHours: Math.round((weeklyMinutes([c]) / 60) * 10) / 10,
        slots: c.schedules.length
      })),
      faculty: faculty.map((f) => {
        const mine = courses.filter((c) => c.facultyId === f.id);
        return {
          id: f.id, name: f.user?.name ?? 'Faculty', designation: f.user?.designation ?? null,
          courses: mine.map((c) => c.code),
          weeklyHours: Math.round((weeklyMinutes(mine) / 60) * 10) / 10
        };
      })
    }
  });
}));

router.put(
  '/planning/allocation/:courseId',
  validate({ params: z.object({ courseId: entityId }), body: z.object({ facultyId: entityId.nullable() }).strict() }),
  asyncHandler((req, res) => requestChange(req, res, 'allocation', { courseId: String(req.params.courseId), facultyId: req.body.facultyId }))
);

// ── Timetable ────────────────────────────────────────────────────────────────

const slotBody = z.object({
  courseId: entityId,
  day: z.enum(DAYS),
  startTime: time,
  endTime: time,
  room: z.string().trim().min(1).max(60),
  type: z.enum(['Lecture', 'Lab', 'Tutorial']).default('Lecture')
}).strict().refine((v) => minutes(v.endTime) > minutes(v.startTime), { message: 'End time must be after start time', path: ['endTime'] });

router.get('/planning/timetable', asyncHandler(async (req: Request, res: Response) => {
  const { ctx, departmentId } = await department(req);
  const semester = Number(req.query.semester);
  const courses = await basePrisma.course.findMany({
    where: { institutionId: ctx.institutionId, departmentId, ...(req.query.semester && Number.isFinite(semester) ? { semester } : {}) },
    include: { schedules: true }
  });
  const names = await facultyNames(ctx.institutionId, courses.map((c) => c.facultyId));
  res.json({
    success: true,
    data: courses.flatMap((c) => c.schedules.map((s) => ({
      scheduleId: s.id, courseId: c.id, courseCode: c.code, courseName: c.name, semester: c.semester,
      day: s.day, startTime: s.startTime, endTime: s.endTime, room: s.room, type: s.type,
      facultyId: c.facultyId, facultyName: c.facultyId ? names.get(c.facultyId)?.name ?? null : null
    }))).sort((a, b) => DAYS.indexOf(a.day as never) - DAYS.indexOf(b.day as never) || a.startTime.localeCompare(b.startTime))
  });
}));

router.post('/planning/timetable', validate({ body: slotBody }),
  asyncHandler((req, res) => requestChange(req, res, 'slot_create', { slot: req.body })));
router.put('/planning/timetable/:scheduleId', validate({ params: z.object({ scheduleId: entityId }), body: slotBody }),
  asyncHandler((req, res) => requestChange(req, res, 'slot_update', { slot: req.body, scheduleId: String(req.params.scheduleId) })));
router.delete('/planning/timetable/:scheduleId', validate({ params: z.object({ scheduleId: entityId }) }),
  asyncHandler((req, res) => requestChange(req, res, 'slot_delete', { scheduleId: String(req.params.scheduleId) })));

// ── Change requests ──────────────────────────────────────────────────────────

router.get('/planning/changes', asyncHandler(async (req: Request, res: Response) => {
  const { ctx, departmentId } = await department(req);
  const changes = await basePrisma.timetableChange.findMany({
    where: { institutionId: ctx.institutionId, departmentId },
    orderBy: { requestedAt: 'desc' },
    take: 50
  });
  const instances = await basePrisma.workflowInstance.findMany({
    where: { institutionId: ctx.institutionId, entityType: 'TimetableChange', entityId: { in: changes.map((c) => c.id) } },
    include: { transitions: { orderBy: { occurredAt: 'desc' }, take: 1 } }
  });
  res.json({
    success: true,
    data: changes.map((c) => {
      const inst = instances.find((i) => i.entityId === c.id);
      return {
        id: c.id, kind: c.kind, summary: c.summary, status: c.status, requestedAt: c.requestedAt, appliedAt: c.appliedAt,
        failureReason: c.failureReason, instanceId: inst?.id ?? null,
        payload: c.payload, decisionNote: inst && inst.status !== 'pending' ? inst.transitions[0]?.note ?? null : null
      };
    })
  });
}));

router.delete('/planning/changes/:id', validate({ params: z.object({ id: entityId }) }), asyncHandler(async (req: Request, res: Response) => {
  const { ctx } = await department(req, true);
  const change = await basePrisma.timetableChange.findFirst({ where: { id: String(req.params.id), institutionId: ctx.institutionId, requestedBy: ctx.userId } });
  if (!change) throw new NotFoundError('Your timetable change request');
  if (change.status !== 'pending') throw new ConflictError(`This request is already ${change.status}.`);
  const inst = await basePrisma.workflowInstance.findFirst({ where: { entityType: 'TimetableChange', entityId: change.id, status: 'pending' } });
  if (inst) await workflowAct(ctx, inst.id, 'cancelled', 'Withdrawn by the HOD');
  else await basePrisma.timetableChange.updateMany({ where: { id: change.id }, data: { status: 'cancelled' } });
  res.json({ success: true, data: { withdrawn: change.id } });
}));

// ── Substitution ─────────────────────────────────────────────────────────────

/** Faculty profile ids on leave (approved, or still being approved) on a date. */
async function onLeave(facultyIds: string[], date: Date) {
  const leaves = await basePrisma.leaveRequest.findMany({
    where: { facultyProfileId: { in: facultyIds }, fromDate: { lte: date }, toDate: { gte: date }, status: { in: ['approved', 'pending'] } },
    select: { facultyProfileId: true, status: true, type: true }
  });
  return new Map(leaves.map((l) => [l.facultyProfileId, l]));
}

router.get('/planning/substitutions', asyncHandler(async (req: Request, res: Response) => {
  const { ctx, departmentId } = await department(req);
  const date = dayOf(String(req.query.date ?? new Date().toISOString().slice(0, 10)));
  const weekday = WEEKDAY[date.getUTCDay()]!;
  const courses = await basePrisma.course.findMany({
    where: { institutionId: ctx.institutionId, departmentId },
    include: { schedules: { where: { day: weekday } } }
  });
  const facultyIds = courses.map((c) => c.facultyId).filter((x): x is string => !!x);
  const [leave, covers] = await Promise.all([
    onLeave(facultyIds, date),
    basePrisma.classSubstitution.findMany({ where: { institutionId: ctx.institutionId, date } })
  ]);
  const names = await facultyNames(ctx.institutionId, [...facultyIds, ...covers.map((c) => c.substituteFacultyId)]);
  res.json({
    success: true,
    data: {
      date: date.toISOString().slice(0, 10),
      weekday,
      classes: courses.flatMap((c) => c.schedules.map((s) => {
        const cover = covers.find((x) => x.scheduleId === s.id);
        const away = c.facultyId ? leave.get(c.facultyId) : undefined;
        return {
          scheduleId: s.id, courseId: c.id, courseCode: c.code, courseName: c.name, semester: c.semester,
          startTime: s.startTime, endTime: s.endTime, room: s.room, type: s.type,
          facultyId: c.facultyId, facultyName: c.facultyId ? names.get(c.facultyId)?.name ?? null : null,
          facultyOnLeave: away ? { status: away.status, type: away.type } : null,
          substitution: cover ? { id: cover.id, substituteFacultyId: cover.substituteFacultyId, substituteName: names.get(cover.substituteFacultyId)?.name ?? null, reason: cover.reason } : null
        };
      })).sort((a, b) => a.startTime.localeCompare(b.startTime))
    }
  });
}));

/** Faculty in the department who are free for that class: not teaching then, not on leave, not already covering. Least-loaded first. */
async function freeFaculty(institutionId: string, departmentId: string, scheduleId: string, date: Date) {
  const slot = await basePrisma.courseSchedule.findFirst({ where: { id: scheduleId, course: { departmentId, institutionId } }, include: { course: true } });
  if (!slot) throw new NotFoundError('Timetable slot in your department');
  const weekday = WEEKDAY[date.getUTCDay()]!;
  if (slot.day !== weekday) throw new ValidationError(`That class is on ${slot.day}s, not ${weekday}.`, { field: 'date' });

  const faculty = await basePrisma.facultyProfile.findMany({
    where: { institutionId, user: { departmentId, role: { in: ['faculty', 'hod'] } } },
    select: { id: true, user: { select: { name: true, designation: true } } }
  });
  const ids = faculty.map((f) => f.id);
  const [allSchedules, leave, covers] = await Promise.all([
    basePrisma.courseSchedule.findMany({ where: { course: { institutionId, facultyId: { in: ids } } }, include: { course: { select: { facultyId: true } } } }),
    onLeave(ids, date),
    basePrisma.classSubstitution.findMany({ where: { institutionId, date } })
  ]);
  const load = (fid: string) => allSchedules.filter((s) => s.course.facultyId === fid).reduce((m, s) => m + minutes(s.endTime) - minutes(s.startTime), 0);
  return {
    slot,
    candidates: faculty
      .filter((f) => f.id !== slot.course.facultyId)
      .map((f) => {
        const busy = allSchedules.find((s) => s.course.facultyId === f.id && s.day === weekday && overlaps(s, slot));
        const covering = covers.find((c) => c.substituteFacultyId === f.id && overlaps(c, slot) && c.scheduleId !== slot.id);
        const away = leave.get(f.id);
        return {
          facultyId: f.id, name: f.user?.name ?? 'Faculty', designation: f.user?.designation ?? null,
          weeklyHours: Math.round((load(f.id) / 60) * 10) / 10,
          free: !busy && !covering && !away,
          reason: away ? `On ${away.type} leave` : busy ? `Teaching ${busy.startTime}–${busy.endTime}` : covering ? 'Already covering a class then' : null
        };
      })
      .sort((a, b) => Number(b.free) - Number(a.free) || a.weeklyHours - b.weeklyHours)
  };
}

router.get('/planning/substitutions/suggest', asyncHandler(async (req: Request, res: Response) => {
  const { ctx, departmentId } = await department(req);
  const { candidates } = await freeFaculty(ctx.institutionId, departmentId, String(req.query.scheduleId ?? ''), dayOf(String(req.query.date ?? '')));
  res.json({ success: true, data: candidates });
}));

router.post(
  '/planning/substitutions',
  validate({ body: z.object({ scheduleId: entityId, date: z.string(), substituteFacultyId: entityId, reason: z.string().trim().max(300).optional() }).strict() }),
  asyncHandler(async (req: Request, res: Response) => {
    const { ctx, departmentId } = await department(req, true);
    const date = dayOf(req.body.date);
    const { slot, candidates } = await freeFaculty(ctx.institutionId, departmentId, req.body.scheduleId, date);
    const pick = candidates.find((c) => c.facultyId === req.body.substituteFacultyId);
    if (!pick) throw new ValidationError('Choose a faculty member from your department.', { field: 'substituteFacultyId' });
    if (!pick.free) throw new ConflictError(`${pick.name} is not free: ${pick.reason}.`);

    const data = {
      institutionId: ctx.institutionId, courseId: slot.courseId, scheduleId: slot.id, date,
      startTime: slot.startTime, endTime: slot.endTime, originalFacultyId: slot.course.facultyId,
      substituteFacultyId: pick.facultyId, reason: req.body.reason ?? null, createdBy: ctx.userId
    };
    const existing = await basePrisma.classSubstitution.findFirst({ where: { scheduleId: slot.id, date } });
    const saved = existing
      ? (await basePrisma.classSubstitution.updateMany({ where: { id: existing.id }, data }), { ...existing, ...data })
      : await basePrisma.classSubstitution.create({ data });

    const dateText = date.toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
    const names = await facultyNames(ctx.institutionId, [pick.facultyId, slot.course.facultyId]);
    const what = `${slot.course.code} on ${dateText}, ${slot.startTime}–${slot.endTime} (${slot.room}) will be taken by ${pick.name}`;
    await recordFromRequest(req, { action: existing ? 'UPDATE' : 'CREATE', module: 'hod', resource: `ClassSubstitution:${saved.id}`, details: what, newValue: data });
    await notifyInApp(ctx.institutionId, { userIds: [names.get(pick.facultyId)!.userId] }, {
      eventType: 'substitution.assigned', subject: `Please take ${slot.course.code} on ${dateText}`,
      body: `${slot.startTime}–${slot.endTime} in ${slot.room}${data.reason ? ` · ${data.reason}` : ''}. It is in your attendance list for that day.`,
      relatedEntityType: 'ClassSubstitution', relatedEntityId: saved.id
    });
    await notifyInApp(ctx.institutionId, { userIds: await studentUsers(slot.courseId) }, {
      eventType: 'substitution.students', subject: `${slot.course.code} on ${dateText}: taken by ${pick.name}`,
      body: `Same time and room (${slot.startTime}, ${slot.room}).`, relatedEntityType: 'Course', relatedEntityId: slot.courseId
    });
    if (slot.course.facultyId && names.get(slot.course.facultyId)) {
      await notifyInApp(ctx.institutionId, { userIds: [names.get(slot.course.facultyId)!.userId] }, {
        eventType: 'substitution.covered', subject: `Your ${slot.course.code} class on ${dateText} is covered`,
        body: `${pick.name} will take it.`, relatedEntityType: 'ClassSubstitution', relatedEntityId: saved.id
      });
    }
    res.json({ success: true, data: { ...saved, substituteName: pick.name } });
  })
);

router.delete('/planning/substitutions/:id', validate({ params: z.object({ id: entityId }) }), asyncHandler(async (req: Request, res: Response) => {
  const { ctx, departmentId } = await department(req, true);
  const cover = await basePrisma.classSubstitution.findFirst({ where: { id: String(req.params.id), institutionId: ctx.institutionId } });
  if (!cover) throw new NotFoundError('Substitution');
  await departmentCourse(ctx.institutionId, departmentId, cover.courseId);
  await basePrisma.classSubstitution.deleteMany({ where: { id: cover.id } });
  await recordFromRequest(req, { action: 'DELETE', module: 'hod', resource: `ClassSubstitution:${cover.id}`, details: 'Substitution cancelled', oldValue: cover });
  const names = await facultyNames(ctx.institutionId, [cover.substituteFacultyId]);
  await notifyInApp(ctx.institutionId, { userIds: [names.get(cover.substituteFacultyId)?.userId].filter((x): x is string => !!x) }, {
    eventType: 'substitution.cancelled', subject: 'A class you were covering is no longer needed',
    body: `${cover.date.toISOString().slice(0, 10)} ${cover.startTime}–${cover.endTime}.`, relatedEntityType: 'Course', relatedEntityId: cover.courseId
  });
  res.json({ success: true, data: { removed: cover.id } });
}));

// ── Student record ───────────────────────────────────────────────────────────

/**
 * One student's full record, for the HOD of their department. Blueprint,
 * Student Academics (Department): "HOD can pull up any student's profile, see
 * their performance … they have read-access to all student data of their
 * branch". The list showed a summary only; this is the record behind it.
 */
router.get('/planning/students/:id', validate({ params: z.object({ id: entityId }) }), asyncHandler(async (req: Request, res: Response) => {
  const { ctx, departmentId } = await department(req);
  const profile = await basePrisma.studentProfile.findFirst({
    where: { id: String(req.params.id), institutionId: ctx.institutionId },
    include: { user: { select: { name: true, email: true, departmentId: true } } }
  });
  if (!profile || profile.user?.departmentId !== departmentId) throw new NotFoundError('Student in your department');

  const [enrolments, attendance, results, mentor, submissions, classLinks, fees] = await Promise.all([
    basePrisma.enrollment.findMany({ where: { studentProfileId: profile.id }, include: { course: true } }),
    basePrisma.attendance.findMany({ where: { studentProfileId: profile.id }, include: { session: { select: { courseId: true } } } }),
    basePrisma.courseResult.findMany({ where: { studentProfileId: profile.id, status: 'published' }, include: { course: true }, orderBy: [{ semester: 'asc' }] }),
    basePrisma.menteeAssignment.findFirst({ where: { studentId: profile.id } }),
    basePrisma.submission.findMany({ where: { studentProfileId: profile.id }, select: { status: true, obtainedMarks: true } }),
    basePrisma.classEnrollment.findMany({ where: { studentProfileId: profile.id }, select: { classId: true } }),
    basePrisma.feeRecord.findMany({ where: { studentProfileId: profile.id } })
  ]);
  const assignmentsSet = await basePrisma.assignment.count({ where: { classId: { in: classLinks.map((c) => c.classId) }, status: { not: 'draft' } } });
  const names = await facultyNames(ctx.institutionId, [...enrolments.map((e) => e.course.facultyId), mentor?.facultyId]);

  const pct = (rows: typeof attendance) => rows.length ? Math.round((rows.filter((r) => r.status !== 'absent').length / rows.length) * 1000) / 10 : null;
  const bySemester = new Map<number, typeof results>();
  for (const r of results) bySemester.set(r.semester, [...(bySemester.get(r.semester) ?? []), r]);

  res.json({
    success: true,
    data: {
      personal: {
        name: profile.user?.name, email: profile.user?.email, rollNumber: profile.rollNumber,
        program: profile.program, branch: profile.branch, semester: profile.semester, section: profile.section, batch: profile.batch,
        admissionYear: profile.admissionYear, gender: profile.gender, dateOfBirth: profile.dateOfBirth, category: profile.category,
        domicileState: profile.domicileState, hosteller: profile.isHosteller, differentlyAbled: profile.isDifferentlyAbled
      },
      academic: {
        cgpa: profile.cgpa, earnedCredits: profile.earnedCredits, totalCredits: profile.totalCredits,
        overallAttendance: pct(attendance),
        mentor: mentor ? names.get(mentor.facultyId)?.name ?? null : null
      },
      currentCourses: enrolments.map((e) => ({
        code: e.course.code, name: e.course.name, credits: e.course.credits,
        faculty: e.course.facultyId ? names.get(e.course.facultyId)?.name ?? null : null,
        attendance: pct(attendance.filter((a) => a.session?.courseId === e.courseId)),
        classesHeld: attendance.filter((a) => a.session?.courseId === e.courseId).length,
        internalMarks: e.internalMarks ?? null
      })),
      semesters: [...bySemester.entries()].map(([semester, rows]) => {
        const credits = rows.reduce((sum, r) => sum + r.course.credits, 0);
        return {
          semester,
          sgpa: credits ? Math.round((rows.reduce((sum, r) => sum + r.gradePoint * r.course.credits, 0) / credits) * 100) / 100 : null,
          backlogs: rows.filter((r) => !r.isPassing).length,
          courses: rows.map((r) => ({ code: r.course.code, name: r.course.name, credits: r.course.credits, grade: r.letterGrade, total: r.totalMarks, passed: r.isPassing }))
        };
      }),
      assignments: {
        set: assignmentsSet,
        submitted: submissions.length,
        graded: submissions.filter((x) => x.status === 'evaluated').length
      },
      fees: {
        total: fees.reduce((sum, f) => sum + f.amount, 0),
        paid: fees.reduce((sum, f) => sum + f.paidAmount, 0),
        due: fees.reduce((sum, f) => sum + Math.max(0, f.amount - f.paidAmount - f.waivedAmount), 0),
        overdue: fees.filter((f) => f.status !== 'paid' && f.status !== 'waived' && f.dueDate < new Date()).length
      }
    }
  });
}));

// ── Faculty leave ────────────────────────────────────────────────────────────

/**
 * One faculty member's leave requests (newest first) and where each stands in
 * its approval, so the HOD decides a specific request rather than "the
 * faculty member's leave".
 */
router.get('/planning/faculty/:userId/leaves', validate({ params: z.object({ userId: entityId }) }), asyncHandler(async (req: Request, res: Response) => {
  const { ctx, departmentId } = await department(req);
  const profile = await basePrisma.facultyProfile.findFirst({
    where: { userId: String(req.params.userId), institutionId: ctx.institutionId, user: { departmentId } }
  });
  if (!profile) throw new NotFoundError('Faculty member in your department');
  const leaves = await basePrisma.leaveRequest.findMany({ where: { facultyProfileId: profile.id }, orderBy: { appliedAt: 'desc' }, take: 20 });
  const instances = await basePrisma.workflowInstance.findMany({
    where: { institutionId: ctx.institutionId, entityType: 'LeaveRequest', entityId: { in: leaves.map((l) => l.id) } },
    include: { definition: { include: { steps: { orderBy: { sequence: 'asc' } } } }, transitions: { orderBy: { occurredAt: 'asc' } } },
    orderBy: { startedAt: 'desc' }
  });
  res.json({
    success: true,
    data: leaves.map((leave) => {
      const inst = instances.find((i) => i.entityId === leave.id);
      const steps = inst?.definition.steps.map((step) => {
        const decided = [...inst.transitions].reverse().find((t) => t.fromStepId === step.id && t.action !== 'started');
        return { role: step.assigneeRole, name: step.name, state: decided ? decided.action : step.id === inst.currentStepId && inst.status === 'pending' ? 'current' : 'upcoming', note: decided?.note ?? null };
      }) ?? [];
      const waitingOn = steps.find((x) => x.state === 'current')?.role ?? null;
      return {
        id: leave.id, type: leave.type, fromDate: leave.fromDate, toDate: leave.toDate,
        days: Math.max(1, Math.round((leave.toDate.getTime() - leave.fromDate.getTime()) / 86_400_000) + 1),
        reason: leave.reason, status: leave.status, appliedAt: leave.appliedAt,
        instanceId: inst?.id ?? null, waitingOn, steps,
        awaitingMe: inst?.status === 'pending' && waitingOn === ctx.role
      };
    })
  });
}));

export default router;
