/**
 * Department timetable and subject allocation — the shared logic behind the
 * HOD's Workload & Timetable screen and the Dean's approval of its changes.
 *
 * A change (add / move / remove a class, or change who teaches a subject) is
 * raised by the HOD as a TimetableChange and approved by the Dean through
 * TIMETABLE_WORKLOAD_APPROVAL. It is checked for clashes when raised and again
 * when applied, because the timetable may have moved on in between.
 */
import { basePrisma } from '../../lib/prisma.js';
import { notifyInApp } from '../../lib/inAppNotify.js';
import { record } from '../../lib/audit.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const overlaps = (a: { startTime: string; endTime: string }, b: { startTime: string; endTime: string }) =>
  minutes(a.startTime) < minutes(b.endTime) && minutes(b.startTime) < minutes(a.endTime);

export interface SlotInput { courseId: string; day: string; startTime: string; endTime: string; room: string; type: string }
export type ChangeKind = 'slot_create' | 'slot_update' | 'slot_delete' | 'allocation';
export interface ChangePayload { slot?: SlotInput; scheduleId?: string; courseId?: string; facultyId?: string | null }

export async function departmentCourse(institutionId: string, departmentId: string, courseId: string) {
  const course = await basePrisma.course.findFirst({ where: { id: courseId, institutionId, departmentId } });
  if (!course) throw new NotFoundError('Course in your department');
  return course;
}

export async function facultyNames(institutionId: string, ids: Array<string | null | undefined>) {
  const wanted = [...new Set(ids.filter((x): x is string => !!x))];
  if (wanted.length === 0) return new Map<string, { name: string; userId: string }>();
  const rows = await basePrisma.facultyProfile.findMany({
    where: { id: { in: wanted }, institutionId },
    select: { id: true, userId: true, user: { select: { name: true } } }
  });
  return new Map(rows.map((r) => [r.id, { name: r.user?.name ?? 'Faculty', userId: r.userId }]));
}

/** User ids of the students enrolled in a course. */
export async function studentUsers(courseId: string): Promise<string[]> {
  const enrolments = await basePrisma.enrollment.findMany({ where: { courseId }, select: { student: { select: { userId: true } } } });
  return enrolments.map((e) => e.student?.userId).filter((x): x is string => !!x);
}

/**
 * The HOD grid and the student / faculty timetables read different stores
 * (TimetableSlot and CourseSchedule). Every change writes CourseSchedule and
 * rebuilds that course's TimetableSlot rows, so they never disagree.
 */
export async function mirrorSlots(institutionId: string, departmentId: string, courseId: string) {
  const course = await basePrisma.course.findFirst({ where: { id: courseId, departmentId, institutionId }, include: { schedules: true, classes: { select: { section: true } } } });
  if (!course) return;
  const names = await facultyNames(course.institutionId, [course.facultyId]);
  const section = course.classes[0]?.section ?? 'A';
  await basePrisma.timetableSlot.deleteMany({ where: { departmentId, courseCode: course.code } });
  if (course.schedules.length === 0) return;
  await basePrisma.timetableSlot.createMany({
    data: course.schedules.map((s) => ({
      day: s.day, startTime: s.startTime, endTime: s.endTime, courseCode: course.code, courseName: course.name,
      faculty: course.facultyId ? names.get(course.facultyId)?.name ?? 'TBA' : 'Unassigned',
      room: s.room, section, type: s.type, departmentId
    }))
  });
}

/** Clashes for a slot: the same students (department + semester), the same teacher anywhere, or the same room. */
export async function clashes(
  institutionId: string,
  departmentId: string,
  course: { id: string; semester: number; facultyId: string | null },
  slot: { day: string; startTime: string; endTime: string; room: string },
  ignoreScheduleId?: string
): Promise<string[]> {
  const sameDay = await basePrisma.courseSchedule.findMany({
    where: { day: slot.day, ...(ignoreScheduleId ? { id: { not: ignoreScheduleId } } : {}), course: { institutionId } },
    include: { course: { select: { id: true, code: true, semester: true, departmentId: true, facultyId: true } } }
  });
  const found: string[] = [];
  for (const other of sameDay.filter((s) => overlaps(s, slot))) {
    const at = `${other.course.code} ${slot.day} ${other.startTime}–${other.endTime}`;
    if (other.course.departmentId === departmentId && other.course.semester === course.semester && other.course.id !== course.id) {
      found.push(`Semester ${course.semester} students already have ${at}`);
    }
    if (other.course.id === course.id) found.push(`This course already has a class at ${at}`);
    if (course.facultyId && other.course.facultyId === course.facultyId && other.course.id !== course.id) {
      const name = (await facultyNames(institutionId, [course.facultyId])).get(course.facultyId)?.name;
      found.push(`${name ?? 'The teacher'} is already teaching ${at}`);
    }
    if (other.room.trim().toLowerCase() === slot.room.trim().toLowerCase()) found.push(`Room ${slot.room} is taken by ${at}`);
  }
  return [...new Set(found)];
}

/** The course's teacher and students hear about a change to their week. */
export async function announce(institutionId: string, course: { id: string; facultyId: string | null }, eventType: string, subject: string, body: string) {
  const names = await facultyNames(institutionId, [course.facultyId]);
  const teacher = course.facultyId ? names.get(course.facultyId)?.userId : undefined;
  await notifyInApp(institutionId, { userIds: [...(await studentUsers(course.id)), ...(teacher ? [teacher] : [])] }, {
    eventType, subject, body, relatedEntityType: 'Course', relatedEntityId: course.id
  });
}

/**
 * Check a proposed change and describe it in one line. Throws if it would
 * clash or does not apply to this department. Used when the HOD raises the
 * change and again when the Dean's approval applies it.
 */
export async function checkChange(institutionId: string, departmentId: string, kind: ChangeKind, payload: ChangePayload): Promise<{ courseId: string; summary: string }> {
  if (kind === 'allocation') {
    const course = await departmentCourse(institutionId, departmentId, payload.courseId!);
    const facultyId = payload.facultyId ?? null;
    if (facultyId === course.facultyId) throw new ValidationError('That teacher already teaches this subject.');
    const names = await facultyNames(institutionId, [facultyId, course.facultyId]);
    if (facultyId) {
      const own = await basePrisma.facultyProfile.findFirst({ where: { id: facultyId, institutionId, user: { departmentId } } });
      if (!own) throw new ValidationError('Choose a faculty member from your own department.', { field: 'facultyId' });
      const problems: string[] = [];
      for (const s of await basePrisma.courseSchedule.findMany({ where: { courseId: course.id } })) {
        problems.push(...(await clashes(institutionId, departmentId, { ...course, facultyId }, s, s.id)).filter((f) => /already teaching/.test(f)));
      }
      if (problems.length) throw new ConflictError(`Cannot assign: ${[...new Set(problems)].join('; ')}`, { conflicts: [...new Set(problems)] });
    }
    const from = course.facultyId ? names.get(course.facultyId)?.name ?? 'another teacher' : 'nobody';
    const to = facultyId ? names.get(facultyId)?.name ?? 'a teacher' : 'nobody (unassigned)';
    return { courseId: course.id, summary: `${course.code} ${course.name}: teacher ${from} → ${to}` };
  }

  if (kind === 'slot_delete') {
    const slot = await basePrisma.courseSchedule.findFirst({ where: { id: payload.scheduleId!, course: { departmentId, institutionId } }, include: { course: true } });
    if (!slot) throw new NotFoundError('Timetable slot in your department');
    return { courseId: slot.courseId, summary: `Remove ${slot.course.code} on ${slot.day} ${slot.startTime}–${slot.endTime} (${slot.room})` };
  }

  const input = payload.slot!;
  if (!DAYS.includes(input.day as never)) throw new ValidationError('Choose a day from Monday to Saturday.', { field: 'day' });
  if (minutes(input.endTime) <= minutes(input.startTime)) throw new ValidationError('End time must be after start time.', { field: 'endTime' });
  const course = await departmentCourse(institutionId, departmentId, input.courseId);
  const previous = kind === 'slot_update'
    ? await basePrisma.courseSchedule.findFirst({ where: { id: payload.scheduleId!, course: { departmentId, institutionId } } })
    : null;
  if (kind === 'slot_update' && !previous) throw new NotFoundError('Timetable slot in your department');
  const problems = await clashes(institutionId, departmentId, course, input, payload.scheduleId);
  if (problems.length) throw new ConflictError(`Timetable clash: ${problems.join('; ')}`, { conflicts: problems });
  return {
    courseId: course.id,
    summary: previous
      ? `Move ${course.code} from ${previous.day} ${previous.startTime} (${previous.room}) to ${input.day} ${input.startTime}–${input.endTime} (${input.room})`
      : `Add ${course.code} ${input.type.toLowerCase()} on ${input.day} ${input.startTime}–${input.endTime} in ${input.room}`
  };
}

/** Make an approved change live: write it, keep the HOD grid in step, notify, audit. */
async function applyChange(institutionId: string, departmentId: string, kind: ChangeKind, payload: ChangePayload, summary: string) {
  if (kind === 'allocation') {
    const course = await departmentCourse(institutionId, departmentId, payload.courseId!);
    const facultyId = payload.facultyId ?? null;
    // Course and its classes move together: attendance reads Course.facultyId,
    // assignments read CourseClass.facultyId.
    await basePrisma.course.updateMany({ where: { id: course.id, institutionId }, data: { facultyId } });
    await basePrisma.courseClass.updateMany({ where: { courseId: course.id }, data: { facultyId } });
    await mirrorSlots(institutionId, departmentId, course.id);
    const names = await facultyNames(institutionId, [facultyId, course.facultyId]);
    const newName = facultyId ? names.get(facultyId)?.name : null;
    if (facultyId) {
      await notifyInApp(institutionId, { userIds: [names.get(facultyId)!.userId] }, {
        eventType: 'allocation.assigned', subject: `You now teach ${course.code} – ${course.name}`,
        body: 'Allocated by your HOD and approved by the Dean. It appears in your courses, timetable and attendance.',
        relatedEntityType: 'Course', relatedEntityId: course.id
      });
    }
    if (course.facultyId && names.get(course.facultyId)) {
      await notifyInApp(institutionId, { userIds: [names.get(course.facultyId)!.userId] }, {
        eventType: 'allocation.removed', subject: `${course.code} – ${course.name} is no longer allocated to you`,
        body: newName ? `It is now taught by ${newName}.` : 'The allocation was removed.', relatedEntityType: 'Course', relatedEntityId: course.id
      });
    }
    await notifyInApp(institutionId, { userIds: await studentUsers(course.id) }, {
      eventType: 'allocation.changed', subject: `${course.code}: ${newName ? `now taught by ${newName}` : 'teacher to be announced'}`,
      body: `${course.name} has a change of teacher.`, relatedEntityType: 'Course', relatedEntityId: course.id
    });
    return;
  }

  if (kind === 'slot_delete') {
    const slot = await basePrisma.courseSchedule.findFirst({ where: { id: payload.scheduleId!, course: { departmentId, institutionId } }, include: { course: true } });
    if (!slot) throw new NotFoundError('Timetable slot in your department');
    await basePrisma.courseSchedule.deleteMany({ where: { id: slot.id } });
    await mirrorSlots(institutionId, departmentId, slot.courseId);
    await announce(institutionId, slot.course, 'timetable.changed', `Timetable change: ${slot.course.code}`, `${summary}.`);
    return;
  }

  const input = payload.slot!;
  const course = await departmentCourse(institutionId, departmentId, input.courseId);
  const data = { courseId: course.id, day: input.day, startTime: input.startTime, endTime: input.endTime, room: input.room, type: input.type };
  if (kind === 'slot_update') {
    const previous = await basePrisma.courseSchedule.findFirst({ where: { id: payload.scheduleId! } });
    await basePrisma.courseSchedule.updateMany({ where: { id: payload.scheduleId! }, data });
    if (previous && previous.courseId !== course.id) await mirrorSlots(institutionId, departmentId, previous.courseId);
  } else {
    await basePrisma.courseSchedule.create({ data });
  }
  await mirrorSlots(institutionId, departmentId, course.id);
  await announce(institutionId, course, 'timetable.changed', `Timetable change: ${course.code}`, `${summary}.`);
}

/**
 * Called when the Dean's approval completes. Re-checks the change against the
 * timetable as it is now; if something else took the slot in the meantime the
 * change is marked `failed` with the reason and the HOD is told, rather than
 * forcing a clash in.
 */
export async function applyApprovedChange(actor: { userId: string; role: string; institutionId: string }, changeId: string): Promise<void> {
  const change = await basePrisma.timetableChange.findFirst({ where: { id: changeId, institutionId: actor.institutionId } });
  if (!change || change.status !== 'approved') return;
  const payload = change.payload as ChangePayload;
  try {
    await checkChange(change.institutionId, change.departmentId, change.kind as ChangeKind, payload);
    await applyChange(change.institutionId, change.departmentId, change.kind as ChangeKind, payload, change.summary);
    await basePrisma.timetableChange.updateMany({ where: { id: change.id, institutionId: change.institutionId }, data: { status: 'applied', appliedAt: new Date() } });
    await record({
      userId: actor.userId, role: actor.role, action: 'UPDATE', module: 'hod', resource: `TimetableChange:${change.id}`,
      details: `Applied after Dean approval: ${change.summary}`, newValue: payload
    });
  } catch (error) {
    const reason = (error as Error).message;
    logger.warn('Approved timetable change could not be applied', { module: 'hod', changeId, reason });
    await basePrisma.timetableChange.updateMany({ where: { id: change.id, institutionId: change.institutionId }, data: { status: 'failed', failureReason: reason } });
    await notifyInApp(change.institutionId, { userIds: [change.requestedBy] }, {
      eventType: 'timetable.change_failed', subject: 'An approved timetable change could not be applied',
      body: `${change.summary} — ${reason}. Raise it again with a free slot.`, relatedEntityType: 'TimetableChange', relatedEntityId: change.id
    });
  }
}
