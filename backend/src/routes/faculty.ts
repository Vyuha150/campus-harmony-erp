import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { toRoleGrievanceStatus } from '../lib/grievanceStatus.js';
import { authenticate } from '../middleware/auth.js';
import { NotFoundError , sendError} from '../lib/errors.js';
import { getTenantContext } from '../lib/tenant.js';
import { recordFromRequest } from '../lib/audit.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { entityId } from '../schemas/common.js';
import {
  facultyProfileUpdateSchema,
  leaveRequestCreateSchema,
  courseDetailsUpdateSchema,
  lessonPlanUpsertSchema,
  attendanceMarkSchema,
  assignmentCreateSchema,
  assignmentUpdateSchema,
  submissionGradeSchema,
  marksUpdateSchema,
  counselingNoteCreateSchema,
  publicationCreateSchema,
  researchProjectCreateSchema,
  facultyGrievanceCreateSchema,
  grievanceRespondSchema,
  facultyClassMessageCreateSchema
} from '../modules/faculty/faculty.schemas.js';

const router = Router();
const db: any = prisma;

/** Allowed lesson-plan states. Previously any string was accepted. */
const LESSON_PLAN_STATUSES = ['pending', 'in_progress', 'completed', 'deferred'] as const;

// REMOVED: ensureFacultyLessonPlanTable()
//
// This executed `CREATE TABLE IF NOT EXISTS "FacultyLessonPlan"` via
// $executeRawUnsafe on the request path, on every call. The table existed in
// the database but not in schema.prisma, creating permanent drift that no
// migration could reconcile, and issuing DDL under concurrency contends on
// PostgreSQL schema locks.
//
// FacultyLessonPlan is now a first-class model in schema.prisma with a real
// foreign key to Course, created by migration 0001_baseline.

function formatDateToIn(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString('en-IN');
}

function sanitizeLessonSubtopics(value: any): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

/**
 * Resolve the authenticated user's faculty profile.
 *
 * HISTORY — this function previously CREATED a profile when none existed,
 * populating it with fabricated credentials: `qualification: 'Ph.D in CSE'`,
 * `specialization: 'Artificial Intelligence'`, `experience: 5`. It was invoked
 * from 38 endpoints in this file, all on read paths.
 *
 * This was the most damaging defect in the system. Faculty qualification and
 * experience are direct NIRF `TLR` inputs and NAAC teaching-learning evidence —
 * the application was manufacturing doctorates that would then be reported to
 * national accreditation and ranking bodies.
 *
 * It now reads only. Faculty records are created by the HR onboarding workflow
 * (EPIC-03 / T-307).
 *
 * @throws {NotFoundError} when the user has no faculty profile.
 */
async function getFacultyProfile(userId: string) {
  const profile = await prisma.facultyProfile.findUnique({ where: { userId } });

  if (!profile) {
    throw new NotFoundError(
      'Faculty profile',
      { userId, hint: 'This account has no faculty record. It must be created through HR onboarding.' }
    );
  }

  return profile;
}

/**
 * Real per-student attendance, from `Attendance` records.
 *
 * REPLACES the literal `attendance: 80` that every mentee showed regardless of
 * whether they had ever been marked present. A student with no marked sessions
 * is simply absent from the returned map — `null`, not a plausible 80%.
 */
async function attendancePercentageByStudent(studentProfileIds: string[]): Promise<Map<string, number>> {
  if (studentProfileIds.length === 0) return new Map();

  const records = await prisma.attendance.findMany({
    where: { studentProfileId: { in: studentProfileIds } },
    select: { studentProfileId: true, status: true }
  });

  const totals = new Map<string, { present: number; total: number }>();
  for (const record of records) {
    const bucket = totals.get(record.studentProfileId) ?? { present: 0, total: 0 };
    bucket.total += 1;
    if (record.status === 'present') bucket.present += 1;
    totals.set(record.studentProfileId, bucket);
  }

  const percentages = new Map<string, number>();
  for (const [studentProfileId, { present, total }] of totals) {
    percentages.set(studentProfileId, Math.round((present / total) * 100));
  }
  return percentages;
}

function parseSemesterNumber(input: any): number | null {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input === 'string') {
    const match = input.match(/(\d+)/);
    if (match) {
      const value = Number(match[1]);
      return Number.isFinite(value) ? value : null;
    }
  }
  if (input && typeof input === 'object') {
    return (
      parseSemesterNumber((input as any).semester) ??
      parseSemesterNumber((input as any).name) ??
      parseSemesterNumber((input as any).label)
    );
  }
  return null;
}

function resolveCurrentSemesterFromAcademicYear(academicYear: any): number | null {
  if (!academicYear) return null;
  const now = new Date();
  const semesters = Array.isArray(academicYear.semesters) ? academicYear.semesters : [];

  for (const semester of semesters) {
    const status = String((semester as any)?.status || '').toLowerCase();
    if (status === 'active' || status === 'current' || status === 'ongoing') {
      const parsed = parseSemesterNumber(semester);
      if (parsed != null) return parsed;
    }
  }

  for (const semester of semesters) {
    const start = (semester as any)?.startDate ? new Date((semester as any).startDate) : null;
    const end = (semester as any)?.endDate ? new Date((semester as any).endDate) : null;
    if (start && end && now >= start && now <= end) {
      const parsed = parseSemesterNumber(semester);
      if (parsed != null) return parsed;
    }
  }

  return null;
}

/**
 * Read the classes assigned to a faculty member.
 *
 * HISTORY — this previously SYNTHESISED `CourseClass` and `ClassEnrollment`
 * rows when a faculty member had none, inventing sections and batch groupings
 * the institution had never defined, with a `create` per group inside nested
 * loops (an N+1 write pattern on a read path).
 *
 * It now reads only. Class structures are defined by academic management
 * (EPIC-04); an empty result correctly means no classes are assigned.
 */
async function getFacultyClasses(facultyProfileId: string) {
  return db.courseClass.findMany({
    where: { facultyId: facultyProfileId },
    include: { course: true, students: true }
  });
}

// ─── Dashboard ───
router.get('/dashboard', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);

    const classes = await getFacultyClasses(profile.id);
    const classIds = classes.map((item: any) => item.id);

    const pendingSubmissions = await db.submission.count({
      where: {
        assignment: { classId: { in: classIds } },
        status: 'submitted'
      }
    });

    const publications = await prisma.publication.count({ where: { facultyProfileId: profile.id } });
    const leaveRequests = await prisma.leaveRequest.count({ where: { facultyProfileId: profile.id, status: 'pending' } });

    res.json({
      success: true,
      data: {
        stats: [
          { label: "Classes Assigned", value: classes.length.toString(), icon: "BookOpen" },
          { label: "Pending Evaluations", value: pendingSubmissions.toString(), icon: "FileEdit", color: "text-warning" },
          { label: "Publications", value: publications.toString(), icon: "Library" },
          { label: "Experience (Yrs)", value: profile.experience.toString(), icon: "Award", color: "text-purple-500" }
        ],
        courses: classes.map((item: any) => ({
          id: item.course.id,
          classId: item.id,
          className: item.name || `${item.course.code} - ${item.section}`,
          code: item.course.code,
          name: item.course.name,
          credits: item.course.credits,
          semester: item.course.semester,
          section: item.section,
          batch: item.batch
        })),
        pendingLeaves: leaveRequests
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Profile ───
router.get('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { department: true } });
    const leaves = await prisma.leaveRequest.findMany({ where: { facultyProfileId: profile.id } });
    const courses = await prisma.course.findMany({ where: { facultyId: profile.id }, include: { enrollments: true } });
    const totalStudents = courses.reduce((sum: number, course: any) => sum + course.enrollments.length, 0);
    const publications = await prisma.publication.count({ where: { facultyProfileId: profile.id } });
    const projects = await prisma.researchProject.count({ where: { facultyProfileId: profile.id } });
    const weeklyHours = courses.reduce((sum: number, course: any) => sum + (course.credits || 0), 0);

    res.json({
      success: true,
      data: {
        ...profile,
        name: user?.name,
        email: user?.email,
        // `phone` was `user?.avatar` — the avatar URL served as the faculty
        // member's phone number on their profile screen. Neither User nor
        // FacultyProfile has a phone column at all, so the honest value is
        // null; the screen renders it as unknown rather than showing an
        // image path.
        phone: null,
        // `department` was `user?.designation`, so the profile read
        // "Professor • Professor". It is a real relation, joined above.
        // The 'Computer Science' fallback went with it: naming a department
        // the record does not have is a guess, not a default.
        department: user?.department?.name ?? null,
        designation: user?.designation ?? null,
        dateOfJoining: user?.createdAt,
        coursesThisSemester: courses.length,
        totalStudents,
        totalPublications: publications,
        totalProjects: projects,
        weeklyHours,
        // `hIndex` was the publication count. The h-index is not a count of
        // publications — it is the largest h for which h papers have h
        // citations each — and no citation data exists in this schema, so it
        // cannot be computed. Reported as unknown rather than as a different
        // number wearing its name.
        hIndex: null,
        leaves,
        // `remaining` was `15` and `10` — the entitlement, ignoring `used`
        // entirely, so earned and medical leave always displayed as fully
        // available no matter how much had been approved. Only casual leave
        // subtracted. Computed the same way for all three now.
        leaveBalance: (
          [
            { type: 'Casual Leave', kind: 'casual', total: 12 },
            { type: 'Earned Leave', kind: 'earned', total: 15 },
            { type: 'Medical Leave', kind: 'medical', total: 10 },
          ] as const
        ).map(({ type, kind, total }) => {
          const used = leaves.filter((l: any) => l.type === kind && l.status === 'approved').length;
          return { type, total, used, remaining: Math.max(0, total - used) };
        })
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/profile/leave-balances', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);
    const leaves = await prisma.leaveRequest.findMany({ where: { facultyProfileId: profile.id } });

    const balances = [
      { type: 'Casual Leave', total: 12, used: leaves.filter((l: any) => l.type === 'casual' && l.status === 'approved').length },
      { type: 'Earned Leave', total: 15, used: leaves.filter((l: any) => l.type === 'earned' && l.status === 'approved').length },
      { type: 'Medical Leave', total: 10, used: leaves.filter((l: any) => l.type === 'medical' && l.status === 'approved').length },
      { type: 'Duty Leave', total: 8, used: leaves.filter((l: any) => l.type === 'duty' && l.status === 'approved').length },
      { type: 'Academic Leave', total: 6, used: leaves.filter((l: any) => l.type === 'academic' && l.status === 'approved').length },
    ].map((item) => ({ ...item, remaining: Math.max(item.total - item.used, 0) }));

    res.json({ success: true, data: balances });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/profile/leave-history', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);
    const leaves = await prisma.leaveRequest.findMany({
      where: { facultyProfileId: profile.id },
      orderBy: { appliedAt: 'desc' }
    });

    res.json({
      success: true,
      data: leaves.map((leave: any) => ({
        id: leave.id,
        type: leave.type,
        fromDate: leave.fromDate.toLocaleDateString('en-IN'),
        toDate: leave.toDate.toLocaleDateString('en-IN'),
        days: Math.max(1, Math.round((leave.toDate.getTime() - leave.fromDate.getTime()) / (24 * 60 * 60 * 1000)) + 1),
        reason: leave.reason,
        status: leave.status
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/profile', authenticate, validate({ body: facultyProfileUpdateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);
    const { qualification, specialization, experience } = req.body;
    const updated = await prisma.facultyProfile.update({
      where: { id: profile.id },
      data: { ...(qualification && { qualification }), ...(specialization && { specialization }), ...(experience && { experience }) }
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/profile/leave-request', authenticate, validate({ body: leaveRequestCreateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);
    const { type, fromDate, toDate, reason } = req.body;

    const created = await prisma.leaveRequest.create({
      data: {
        facultyProfileId: profile.id,
        type: String(type || 'casual'),
        fromDate: new Date(fromDate),
        toDate: new Date(toDate),
        reason: String(reason || ''),
        status: 'pending'
      }
    });

    res.json({ success: true, data: created });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Courses ───
router.get('/courses', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const semesterQuery = req.query.semester ? Number(req.query.semester) : undefined;
    const profile = await getFacultyProfile(userId);
    const where: any = { facultyId: profile.id };
    if (Number.isFinite(semesterQuery)) where.semester = semesterQuery;
    const courses = await prisma.course.findMany({
      where,
      include: {
        department: true,
        schedules: true,
        enrollments: { include: { student: true } },
        classes: { where: { facultyId: profile.id }, orderBy: { section: 'asc' } }
      }
    });

    res.json({
      success: true,
      data: courses.map((c: any) => ({
        id: c.id, code: c.code, name: c.name, credits: c.credits, semester: c.semester,
        classId: c.classes?.[0]?.id || null,
        className: c.classes?.[0]?.name || `${c.code} Section ${c.classes?.[0]?.section || 'A'}`,
        department: c.department?.name, totalStudents: c.enrollments.length,
        program: c.enrollments[0]?.student?.program || 'UG Programme',
        section: c.classes?.[0]?.section || c.enrollments[0]?.student?.section || 'A',
        batch: c.classes?.[0]?.batch || '',
        schedule: c.schedules, averageAttendance: 85, syllabusCompletion: 60, averageScore: 72
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/classes', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);
    const classes = await getFacultyClasses(profile.id);

    res.json({
      success: true,
      data: classes.map((item: any) => ({
        id: item.id,
        classId: item.id,
        className: item.name || `${item.course.code} - ${item.section}`,
        section: item.section,
        batch: item.batch || '',
        courseId: item.courseId,
        code: item.course.code,
        name: item.course.name,
        semester: item.course.semester,
        department: item.course.department?.name || '',
        totalStudents: item.students.length
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/current-semester', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);
    const courses = await prisma.course.findMany({ where: { facultyId: profile.id } });
    const availableSemesters = Array.from(new Set(courses.map((course: any) => Number(course.semester)).filter((value) => Number.isFinite(value))));

    const currentAcademicYear = await db.academicYear.findFirst({ where: { isCurrent: true } });
    const resolvedFromAcademicYear = resolveCurrentSemesterFromAcademicYear(currentAcademicYear);

    const currentSemester = resolvedFromAcademicYear != null && availableSemesters.includes(resolvedFromAcademicYear)
      ? resolvedFromAcademicYear
      : (availableSemesters.length > 0 ? Math.max(...availableSemesters) : null);

    res.json({
      success: true,
      data: {
        currentSemester,
        availableSemesters: availableSemesters.sort((a, b) => a - b)
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/courses/:id/details', authenticate, validate({ params: z.object({ id: entityId }), body: courseDetailsUpdateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const userRole = String((req as any).user?.role || '');
    const profile = await getFacultyProfile(userId);
    const courseId = String(req.params.id);
    const {
      code,
      name,
      credits,
      semester,
      className,
      section,
      batch,
      schedule
    } = req.body || {};

    const attemptsTimetableOrClassroomUpdate =
      schedule !== undefined ||
      className !== undefined ||
      section !== undefined ||
      batch !== undefined;

    if (userRole === 'faculty' && attemptsTimetableOrClassroomUpdate) {
      res.status(403).json({ success: false, message: 'Only HOD/Dean can update class timetable or classroom' });
      return;
    }

    const course = await prisma.course.findFirst({ where: { id: courseId, facultyId: profile.id } });
    if (!course) {
      res.status(404).json({ success: false, message: 'Course not found for this faculty' });
      return;
    }

    const updatedCourse = await prisma.course.update({
      where: { id: courseId },
      data: {
        ...(code ? { code: String(code).trim() } : {}),
        ...(name ? { name: String(name).trim() } : {}),
        ...(Number.isFinite(Number(credits)) ? { credits: Number(credits) } : {}),
        ...(Number.isFinite(Number(semester)) ? { semester: Number(semester) } : {})
      },
      include: { schedules: true, department: true }
    });

    const classRecord = await prisma.courseClass.findFirst({
      where: { courseId: updatedCourse.id, facultyId: profile.id },
      orderBy: { section: 'asc' }
    });

    let updatedClass = classRecord;
    if (classRecord) {
      updatedClass = await prisma.courseClass.update({
        where: { id: classRecord.id },
        data: {
          ...(typeof className === 'string' ? { name: className.trim() } : {}),
          ...(typeof section === 'string' && section.trim() ? { section: section.trim() } : {}),
          ...(typeof batch === 'string' ? { batch: batch.trim() || null } : {})
        }
      });
    }

    if (Array.isArray(schedule)) {
      await prisma.courseSchedule.deleteMany({ where: { courseId: updatedCourse.id } });

      const normalizedSchedule = schedule
        .filter((item: any) => item && item.day && item.startTime && item.endTime)
        .map((item: any) => ({
          courseId: updatedCourse.id,
          day: String(item.day),
          startTime: String(item.startTime),
          endTime: String(item.endTime),
          room: String(item.room || 'TBA'),
          type: String(item.type || 'lecture')
        }));

      if (normalizedSchedule.length > 0) {
        await prisma.courseSchedule.createMany({ data: normalizedSchedule });
      }
    }

    const refreshedCourse = await prisma.course.findUnique({
      where: { id: updatedCourse.id },
      include: {
        department: true,
        schedules: true,
        enrollments: { include: { student: true } }
      }
    });

    res.json({
      success: true,
      data: {
        id: refreshedCourse?.id,
        code: refreshedCourse?.code,
        name: refreshedCourse?.name,
        credits: refreshedCourse?.credits,
        semester: refreshedCourse?.semester,
        classId: updatedClass?.id || null,
        className: updatedClass?.name || null,
        section: updatedClass?.section || refreshedCourse?.enrollments?.[0]?.student?.section || 'A',
        batch: updatedClass?.batch || '',
        department: refreshedCourse?.department?.name,
        totalStudents: refreshedCourse?.enrollments?.length || 0,
        program: refreshedCourse?.enrollments?.[0]?.student?.program || 'UG Programme',
        schedule: refreshedCourse?.schedules || []
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/courses/lesson-plans', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const semesterQuery = req.query.semester ? Number(req.query.semester) : undefined;
    const profile = await getFacultyProfile(userId);
    const where: any = { facultyId: profile.id };
    if (Number.isFinite(semesterQuery)) where.semester = semesterQuery;
    const courses = await prisma.course.findMany({ where });

    if (courses.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    // HISTORY — this endpoint previously auto-generated eight weeks of lesson
    // plans per course when none existed, inventing topics ("Module 1"),
    // subtopics, course-outcome codes (CO1..CO5) and — most seriously — marking
    // weeks 1-4 as 'completed' with no human action. That fabricated both
    // academic delivery records and the CO artefacts OBE attainment depends on.
    //
    // It now reads only. An empty result correctly means the faculty member has
    // not yet created a lesson plan.
    //
    // The N+1 raw-SQL loop (2 queries per course) is also gone: this is a single
    // indexed query against the now-modelled FacultyLessonPlan table.
    const courseById = new Map(courses.map((course) => [course.id, course]));

    const rows = await db.facultyLessonPlan.findMany({
      where: { courseId: { in: courses.map((course) => course.id) } },
      orderBy: [{ courseId: 'asc' }, { weekNumber: 'asc' }]
    });

    const lessonPlans = rows.map((row: any) => ({
      id: row.id,
      courseId: row.courseId,
      courseCode: courseById.get(row.courseId)?.code ?? '',
      weekNumber: row.weekNumber,
      topic: row.topic,
      subtopics: sanitizeLessonSubtopics(row.subtopics),
      courseOutcome: row.courseOutcome,
      plannedDate: formatDateToIn(row.plannedDate),
      status: row.status
    }));

    res.json({ success: true, data: lessonPlans });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/courses/:courseId/lesson-plans/:weekNumber', authenticate, validate({ params: z.object({ courseId: entityId, weekNumber: z.coerce.number().int().min(1).max(52) }), body: lessonPlanUpsertSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);
    const courseId = String(req.params.courseId);
    const weekNumber = Number(req.params.weekNumber);

    if (!Number.isFinite(weekNumber) || weekNumber < 1) {
      res.status(400).json({ success: false, message: 'Invalid week number' });
      return;
    }

    const course = await prisma.course.findFirst({ where: { id: courseId, facultyId: profile.id } });
    if (!course) {
      res.status(404).json({ success: false, message: 'Course not found for this faculty' });
      return;
    }

    const {
      topic,
      subtopics,
      courseOutcome,
      plannedDate,
      status
    } = req.body || {};

    if (!topic || !courseOutcome || !plannedDate || !status) {
      res.status(400).json({ success: false, message: 'topic, courseOutcome, plannedDate and status are required' });
      return;
    }

    const parsedDate = new Date(plannedDate);
    if (Number.isNaN(parsedDate.getTime())) {
      res.status(400).json({ success: false, message: 'plannedDate must be a valid date' });
      return;
    }

    if (!(LESSON_PLAN_STATUSES as readonly string[]).includes(String(status))) {
      res.status(400).json({
        success: false,
        message: `status must be one of: ${LESSON_PLAN_STATUSES.join(', ')}`
      });
      return;
    }

    // Uses the modelled FacultyLessonPlan table (migration 0001_baseline)
    // instead of raw DDL + raw upsert against a shadow table.
    const payload = {
      topic: String(topic),
      subtopics: sanitizeLessonSubtopics(subtopics),
      courseOutcome: String(courseOutcome),
      plannedDate: parsedDate,
      status: String(status)
    };

    const saved = await db.facultyLessonPlan.upsert({
      where: { courseId_weekNumber: { courseId, weekNumber } },
      update: payload,
      create: { courseId, weekNumber, ...payload }
    });

    await recordFromRequest(req, {
      action: 'UPDATE',
      module: 'faculty',
      resource: `FacultyLessonPlan:${saved.id}`,
      details: `Lesson plan set for ${course.code} week ${weekNumber}`,
      newValue: payload
    });

    res.json({
      success: true,
      data: {
        id: saved.id,
        courseId,
        courseCode: course.code,
        weekNumber,
        topic: saved.topic,
        subtopics: sanitizeLessonSubtopics(saved.subtopics),
        courseOutcome: saved.courseOutcome,
        plannedDate: formatDateToIn(saved.plannedDate),
        status: saved.status
      }
    });
  } catch (error: any) {
    next(error);
  }
});

router.get('/courses/:id/students', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);
    const id = String(req.params.id);
    // Enrollment has no institutionId of its own, and courseId is a raw URL
    // param — without the facultyId check, any authenticated faculty member
    // could pull another faculty's (or institution's) full roster — names,
    // roll numbers, CGPA, email — by guessing a course id.
    const course = await prisma.course.findFirst({ where: { id, facultyId: profile.id } });
    if (!course) {
      res.status(404).json({ success: false, message: 'Course not found for this faculty' });
      return;
    }
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId: id },
      include: { student: { include: { user: true } } }
    });
    res.json({
      success: true,
      data: enrollments.map((e: any) => ({
        id: e.student.id, rollNumber: e.student.rollNumber, name: e.student.user.name,
        program: e.student.program, semester: e.student.semester, section: e.student.section,
        cgpa: e.student.cgpa, email: e.student.user.email
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Attendance ───
router.get('/attendance/sessions', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const semesterQuery = req.query.semester ? Number(req.query.semester) : undefined;
    const profile = await getFacultyProfile(userId);
    const where: any = { facultyId: profile.id };
    if (Number.isFinite(semesterQuery)) where.course = { semester: semesterQuery };
    const sessions = await prisma.attendanceSession.findMany({
      where,
      include: { course: { include: { schedules: true } }, records: true },
      orderBy: { date: 'desc' }
    });
    res.json({
      success: true,
      data: sessions.map((s: any) => ({
        id: s.id, courseId: s.courseId, courseCode: s.course.code, courseName: s.course.name,
        semester: s.course.semester,
        date: s.date, startTime: s.startTime, endTime: s.endTime, type: s.type,
        room: s.course?.schedules?.[0]?.room || 'TBA',
        totalStudents: s.records.length,
        presentCount: s.records.filter((r: any) => r.status === 'present').length,
        absentCount: s.records.filter((r: any) => r.status === 'absent').length,
        status: s.records.length > 0 ? 'completed' : 'pending'
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/attendance/roster', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const semesterQuery = req.query.semester ? Number(req.query.semester) : undefined;
    const courseIdQuery = req.query.courseId ? String(req.query.courseId) : undefined;
    const profile = await getFacultyProfile(userId);
    const where: any = { facultyId: profile.id };
    if (courseIdQuery) where.id = courseIdQuery;
    if (Number.isFinite(semesterQuery)) where.semester = semesterQuery;
    const course = await prisma.course.findFirst({
      where
    });

    if (!course) {
      res.json({ success: true, data: [] });
      return;
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { courseId: course.id },
      include: { student: { include: { user: true } } }
    });

    res.json({
      success: true,
      data: enrollments.map((enrollment: any) => ({
        studentId: enrollment.student.id,
        rollNumber: enrollment.student.rollNumber,
        name: enrollment.student.user?.name || enrollment.student.rollNumber,
        status: 'present'
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/attendance/mark', authenticate, validate({ body: attendanceMarkSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);
    const { courseId, date, startTime, endTime, type, students } = req.body;

    // courseId is client-supplied — without this, a faculty member could
    // mark attendance for a course (and its students) that isn't theirs.
    const course = await prisma.course.findFirst({ where: { id: courseId, facultyId: profile.id } });
    if (!course) {
      res.status(404).json({ success: false, message: 'Course not found for this faculty' });
      return;
    }

    const session = await prisma.attendanceSession.create({
      data: { courseId, facultyId: profile.id, date: new Date(date), startTime, endTime, type: type || 'lecture' }
    });

    if (students && Array.isArray(students)) {
      // Each studentId is also client-supplied — restrict to students
      // actually enrolled in this course, so attendance can't be recorded
      // for an arbitrary (or foreign-institution) studentProfileId.
      const enrolled = await prisma.enrollment.findMany({
        where: { courseId, studentProfileId: { in: students.map((s: any) => s.studentId) } },
        select: { studentProfileId: true }
      });
      const enrolledIds = new Set(enrolled.map((e: any) => e.studentProfileId));
      const validStudents = students.filter((s: any) => enrolledIds.has(s.studentId));

      if (validStudents.length > 0) {
        await prisma.attendance.createMany({
          data: validStudents.map((s: any) => ({
            attendanceSessionId: session.id,
            studentProfileId: s.studentId,
            status: s.status
          }))
        });
      }
    }

    res.json({ success: true, data: session });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/attendance/history', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);
    const query = req.query as Record<string, string | undefined>;
    const courseId = query.courseId;
    const semester = query.semester ? Number(query.semester) : undefined;

    const where: any = { facultyId: profile.id };
    if (courseId) where.courseId = courseId;
    if (Number.isFinite(semester)) where.course = { semester };

    const sessions = await prisma.attendanceSession.findMany({
      where,
      include: { course: true, records: { include: { student: { include: { user: true } } } } },
      orderBy: { date: 'desc' },
      take: 50
    });
    res.json({ success: true, data: sessions });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Assignments ───
router.get('/assignments', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const semesterQuery = req.query.semester ? Number(req.query.semester) : undefined;
    const profile = await getFacultyProfile(userId);
    const classes = await getFacultyClasses(profile.id);
    const filteredClasses = Number.isFinite(semesterQuery)
      ? classes.filter((item: any) => item.course?.semester === semesterQuery)
      : classes;
    const classIds = filteredClasses.map((item: any) => item.id);

    const assignments = await db.assignment.findMany({
      where: { classId: { in: classIds } },
      include: {
        class: {
          include: { course: true }
        },
        submissions: true
      },
      orderBy: { dueDate: 'desc' }
    });

    res.json({
      success: true,
      data: assignments.map((a: any) => ({
        id: a.id,
        classId: a.classId,
        className: a.class?.name || `${a.class?.course?.code || ''} - ${a.class?.section || ''}`,
        section: a.class?.section || '',
        batch: a.class?.batch || '',
        semester: a.class?.course?.semester || null,
        courseId: a.class?.courseId || '',
        courseCode: a.class?.course?.code || '',
        courseName: a.class?.course?.name || '',
        title: a.title, description: a.description, dueDate: a.dueDate, maxMarks: a.maxMarks,
        status: a.status, type: 'assignment',
        totalSubmissions: a.submissions.length,
        pendingEvaluation: a.submissions.filter((s: any) => s.status === 'submitted').length
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/assignments', authenticate, validate({ body: assignmentCreateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);
    const { classId, title, description, dueDate, maxMarks, status } = req.body;

    const classRecord = await db.courseClass.findFirst({ where: { id: classId, facultyId: profile.id }, include: { course: true } });
    if (!classRecord) {
      res.status(403).json({ success: false, message: 'Invalid class selected for assignment.' });
      return;
    }

    const assignment = await db.assignment.create({
      data: { classId, title, description, dueDate: new Date(dueDate), maxMarks, status: status || 'published' }
    });
    res.json({
      success: true,
      data: {
        ...assignment,
        className: classRecord.name || `${classRecord.course.code} - ${classRecord.section}`,
        section: classRecord.section,
        batch: classRecord.batch || '',
        courseId: classRecord.courseId,
        courseCode: classRecord.course.code,
        courseName: classRecord.course.name
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/assignments/:id', authenticate, validate({ params: z.object({ id: entityId }), body: assignmentUpdateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);
    const id = String(req.params.id);
    const { title, description, dueDate, maxMarks, status } = req.body;

    // Assignment has no institutionId of its own — `update({ where: { id }
    // })` cannot carry the ownership check, so `updateMany` + a
    // class-derived filter, then re-read, is the pattern this codebase uses
    // everywhere a model has no institutionId column of its own.
    const changed = await prisma.assignment.updateMany({
      where: { id, class: { facultyId: profile.id } },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(dueDate !== undefined ? { dueDate: new Date(dueDate) } : {}),
        ...(maxMarks !== undefined ? { maxMarks } : {}),
        ...(status !== undefined ? { status } : {})
      }
    });
    if (changed.count === 0) {
      res.status(404).json({ success: false, message: 'Assignment not found for this faculty' });
      return;
    }
    const updated = await prisma.assignment.findFirst({ where: { id } });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/assignments/:id/submissions', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);
    const id = String(req.params.id);
    // Submission has no institutionId of its own, and the assignment id is a
    // raw URL param — without this, any faculty could pull another
    // faculty's (or institution's) submissions, names and marks included.
    const assignment = await prisma.assignment.findFirst({ where: { id, class: { facultyId: profile.id } } });
    if (!assignment) {
      res.status(404).json({ success: false, message: 'Assignment not found for this faculty' });
      return;
    }
    const submissions = await prisma.submission.findMany({
      where: { assignmentId: id },
      include: { student: { include: { user: true } } }
    });
    res.json({
      success: true,
      data: submissions.map((s: any) => ({
        id: s.id, studentId: s.studentProfileId, rollNumber: s.student.rollNumber,
        studentName: s.student.user.name, submittedAt: s.submittedAt, status: s.status,
        marks: s.obtainedMarks, feedback: s.feedback, fileUrl: s.fileUrl
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/assignments/submissions', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const semesterQuery = req.query.semester ? Number(req.query.semester) : undefined;
    const profile = await getFacultyProfile(userId);
    const classes = await getFacultyClasses(profile.id);
    const filteredClasses = Number.isFinite(semesterQuery)
      ? classes.filter((item: any) => item.course?.semester === semesterQuery)
      : classes;
    const assignments = await db.assignment.findMany({
      where: { classId: { in: filteredClasses.map((item: any) => item.id) } }
    });

    const submissions = await prisma.submission.findMany({
      where: { assignmentId: { in: assignments.map((assignment: any) => assignment.id) } },
      include: { student: { include: { user: true } } },
      orderBy: { submittedAt: 'desc' }
    });

    res.json({
      success: true,
      data: submissions.map((submission: any) => ({
        id: submission.id,
        assignmentId: submission.assignmentId,
        studentId: submission.studentProfileId,
        rollNumber: submission.student.rollNumber,
        studentName: submission.student.user.name,
        submittedAt: submission.submittedAt,
        status: submission.status,
        marks: submission.obtainedMarks,
        feedback: submission.feedback,
        fileUrl: submission.fileUrl
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/assignments/:id/submissions/:subId/grade', authenticate, validate({ params: z.object({ id: entityId, subId: entityId }), body: submissionGradeSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);
    const subId = String(req.params.subId);
    const { marks, feedback } = req.body;
    // Submission has no institutionId of its own — `update({ where: { id }
    // })` cannot carry the ownership check, so `updateMany` + an
    // assignment/class-derived filter, then re-read, is the pattern this
    // codebase uses everywhere a model has no institutionId column of its own.
    const changed = await prisma.submission.updateMany({
      where: { id: subId, assignment: { class: { facultyId: profile.id } } },
      data: { obtainedMarks: marks, feedback, status: 'evaluated' }
    });
    if (changed.count === 0) {
      res.status(404).json({ success: false, message: 'Submission not found for this faculty' });
      return;
    }
    const updated = await prisma.submission.findFirst({ where: { id: subId } });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Internal Marks ───
router.get('/marks/:courseId', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);
    const courseId = String(req.params.courseId);
    // Enrollment has no institutionId of its own, and courseId is a raw URL
    // param — without this, any faculty could read another faculty's (or
    // institution's) gradebook.
    const course = await prisma.course.findFirst({ where: { id: courseId, facultyId: profile.id } });
    if (!course) {
      res.status(404).json({ success: false, message: 'Course not found for this faculty' });
      return;
    }
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId },
      include: { student: { include: { user: true } } }
    });
    res.json({
      success: true,
      // `total: Number.isFinite(storedTotal) ? storedTotal : 0` — `Number(null)`
      // is `0` in JavaScript, which IS finite, so an ungraded enrolment
      // (`grade` is `null`) reported a real mark of 0. Worse than a display bug:
      // the gradebook screen this feeds reconstructs a fake quiz/midterm/
      // assignment breakdown FROM this total, so a student who had never been
      // marked showed a full row of fabricated component scores that summed to
      // zero, rather than a blank, ungraded row.
      data: enrollments.map((e: any) => {
        const numeric = e.grade != null && e.grade !== '' ? Number(e.grade) : NaN;
        return {
          studentId: e.student.id,
          rollNumber: e.student.rollNumber,
          studentName: e.student.user.name,
          grade: e.grade,
          total: Number.isFinite(numeric) ? numeric : null,
          maxTotal: 100
        };
      })
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/marks/:courseId', authenticate, validate({ params: z.object({ courseId: entityId }), body: marksUpdateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);
    const courseId = String(req.params.courseId);
    // courseId is a raw URL param — without this, any faculty member could
    // overwrite another faculty's (or institution's) stored grades.
    const course = await prisma.course.findFirst({ where: { id: courseId, facultyId: profile.id } });
    if (!course) {
      res.status(404).json({ success: false, message: 'Course not found for this faculty' });
      return;
    }
    const { marks } = req.body;
    if (marks && Array.isArray(marks)) {
      for (const m of marks) {
        await prisma.enrollment.updateMany({
          where: { courseId, studentProfileId: m.studentId },
          data: { grade: m.grade }
        });
      }
    }
    res.json({ success: true, message: 'Marks updated' });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Mentoring ───
router.get('/mentees', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);
    const assignments = await db.menteeAssignment.findMany({ where: { facultyId: profile.id } });
    const attendanceByStudent = await attendancePercentageByStudent(
      assignments.map((a: any) => a.studentId)
    );

    const mentees = [];
    for (const a of assignments) {
      const student = await prisma.studentProfile.findUnique({
        where: { id: a.studentId },
        include: { user: true }
      });
      if (student) {
        const notes = await db.counselingNote.findMany({ where: { menteeAssignId: a.id }, orderBy: { date: 'desc' } });
        mentees.push({
          id: student.id, rollNumber: student.rollNumber, name: student.user.name,
          program: student.program, semester: student.semester, section: student.section,
          cgpa: student.cgpa, email: student.user.email, phone: '', riskLevel: student.cgpa < 5 ? 'high' : student.cgpa < 7 ? 'medium' : 'low',
            attendance: attendanceByStudent.get(student.id) ?? null,
            lastMeetingDate: a.lastMeeting ? a.lastMeeting.toLocaleDateString('en-IN') : null,
            counselingNotes: notes.map((note: any) => ({
              id: note.id,
              date: note.date.toLocaleDateString('en-IN'),
              topic: note.topic,
              notes: note.notes,
              followUpDate: note.followUpDate ? note.followUpDate.toLocaleDateString('en-IN') : null,
              status: note.status
            }))
        });
      }
    }
    res.json({ success: true, data: mentees });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/mentees/:id/notes', authenticate, validate({ params: z.object({ id: entityId }), body: counselingNoteCreateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);
    const studentId = String(req.params.id);
    const { topic, notes, followUpDate } = req.body;

    const assignment = await db.menteeAssignment.findUnique({
      where: { facultyId_studentId: { facultyId: profile.id, studentId } }
    });
    if (!assignment) { res.status(404).json({ success: false, message: 'Mentee not found' }); return; }

    const note = await db.counselingNote.create({
      data: { menteeAssignId: assignment.id, topic, notes, followUpDate: followUpDate ? new Date(followUpDate) : null }
    });

    await db.menteeAssignment.update({
      where: { id: assignment.id },
      data: { lastMeeting: new Date() }
    });

    res.json({ success: true, data: note });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Research ───
router.get('/research/publications', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);
    const pubs = await prisma.publication.findMany({ where: { facultyProfileId: profile.id }, orderBy: { year: 'desc' } });
    res.json({
      success: true,
      data: pubs.map((publication: any) => ({
        ...publication,
        authors: ['Primary Author'],
        indexing: 'Scopus',
        citations: 0
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/research/publications', authenticate, validate({ body: publicationCreateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);
    const { title, journal, year, status } = req.body;
    const pub = await prisma.publication.create({
      data: { facultyProfileId: profile.id, title, journal, year, status: status || 'submitted' }
    });
    res.json({ success: true, data: pub });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/research/projects', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);
    const projects = await prisma.researchProject.findMany({ where: { facultyProfileId: profile.id } });
    res.json({
      success: true,
      data: projects.map((project: any) => ({
        ...project,
        coInvestigators: [],
        startDate: new Date().toLocaleDateString('en-IN'),
        endDate: new Date().toLocaleDateString('en-IN')
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/research/patents', authenticate, async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: [] });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Dashboard helpers ───
/**
 * Was two hardcoded rows — "Internal marks submission window open... before
 * Friday" and "Department review meeting Friday 3:00 PM" — returned to every
 * faculty member on every visit, with no deadline or meeting behind either.
 * A faculty member reading this could believe a real submission window was
 * closing "this Friday" indefinitely, or miss an actual deadline because this
 * fake one looked identical to a real one.
 *
 * Now the real `BroadcastMessage` rows aimed at faculty. `priority` was never
 * a column on that model; `pinned` is, so a pinned broadcast is shown as high
 * priority rather than inventing an urgency the sender never set.
 */
router.get('/dashboard/announcements', authenticate, async (_req: Request, res: Response) => {
  try {
    const messages = await db.broadcastMessage.findMany({
      where: { recipients: { in: ['all', 'faculty', 'faculties', 'all_faculty'] } },
      orderBy: { sentAt: 'desc' },
      take: 10
    });

    res.json({
      success: true,
      data: messages.map((m: any) => ({
        id: m.id,
        title: m.subject,
        detail: m.content,
        priority: m.pinned ? 'high' : 'medium'
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/dashboard/tasks', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const semesterQuery = req.query.semester ? Number(req.query.semester) : undefined;
    const profile = await getFacultyProfile(userId);
    const classes = await getFacultyClasses(profile.id);
    const filteredClasses = Number.isFinite(semesterQuery)
      ? classes.filter((item: any) => item.course?.semester === semesterQuery)
      : classes;
    const assignments = await db.assignment.findMany({
      where: { classId: { in: filteredClasses.map((item: any) => item.id) } },
      include: {
        submissions: true,
        class: { include: { course: true } }
      },
      orderBy: { dueDate: 'asc' },
      take: 10
    });

    res.json({
      success: true,
      data: assignments.map((assignment: any) => ({
        id: assignment.id,
        task: assignment.title,
        course: assignment.class?.course?.code,
        semester: assignment.class?.course?.semester,
        className: assignment.class?.name || `${assignment.class?.course?.code || ''} - ${assignment.class?.section || ''}`,
        urgent: assignment.submissions.some((submission: any) => submission.status === 'submitted')
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Was a single hardcoded row — "Attendance dip detected... below 75%
 * average attendance" — returned unconditionally to every faculty member,
 * regardless of what any of their courses' real attendance looked like. It
 * read as a real, computed alert ("AI Performance Alerts" is the section
 * title on screen); nothing had ever computed it.
 *
 * Now a real per-course tally from `AttendanceSession`/`Attendance`. A course
 * with no marked sessions is not flagged — no data is not a dip.
 */
router.get('/dashboard/alerts', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);

    const sessions = await prisma.attendanceSession.findMany({
      where: { facultyId: profile.id },
      include: { course: { select: { code: true, name: true } }, records: { select: { status: true } } }
    });

    const byCourse = new Map<string, { code: string; name: string; present: number; total: number }>();
    for (const session of sessions) {
      const bucket = byCourse.get(session.courseId) ?? {
        code: session.course.code,
        name: session.course.name,
        present: 0,
        total: 0
      };
      bucket.total += session.records.length;
      bucket.present += session.records.filter((r: any) => r.status === 'present').length;
      byCourse.set(session.courseId, bucket);
    }

    const alerts = [...byCourse.values()]
      .filter((c) => c.total > 0)
      .map((c) => ({ ...c, percentage: Math.round((c.present / c.total) * 100) }))
      .filter((c) => c.percentage < 75)
      .map((c) => ({
        id: `attendance-${c.code}`,
        title: `${c.code} attendance below 75%`,
        description: `${c.name} is at ${c.percentage}% average attendance across marked sessions.`
      }));

    res.json({ success: true, data: alerts });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/feedback-summaries', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const semesterQuery = req.query.semester ? Number(req.query.semester) : undefined;
    const profile = await getFacultyProfile(userId);
    const where: any = { facultyId: profile.id };
    if (Number.isFinite(semesterQuery)) where.semester = semesterQuery;
    const courses = await prisma.course.findMany({
      where,
      include: { feedbacks: { include: { responses: true } } }
    });

    // WHAT THIS REPLACES
    //
    // The previous version returned `responses.length > 0 ? 4.0 : 0` for the
    // overall rating, and 4.1 / 4.0 / 3.9 for three fixed categories. Those are
    // literals: a course with one scathing response and a course with fifty
    // glowing ones both reported 4.0. Nothing read what the students wrote.
    //
    // The invented category names ("Course Delivery", "Clarity", "Assessment
    // Quality") did not even correspond to the questions asked - responses are
    // stored as free-form JSON keyed by whatever the form used, e.g.
    // { content: 5, teaching: 4, engagement: 4 }.
    //
    // Now: every numeric answer is averaged, and the categories reported are the
    // keys students actually answered. A course with no responses reports null
    // rather than 0, because "no feedback" and "rated zero" are different facts.
    const summaries = courses.map((course: any) => {
      const responses = course.feedbacks.flatMap((form: any) => form.responses || []);

      // key -> the numeric answers given for it, across every response
      const byKey = new Map<string, number[]>();
      for (const response of responses) {
        const answers = (response.responses ?? {}) as Record<string, unknown>;
        for (const [key, value] of Object.entries(answers)) {
          const n = typeof value === 'number' ? value : Number(value);
          if (!Number.isFinite(n)) continue; // free-text answers are not scores
          if (!byKey.has(key)) byKey.set(key, []);
          byKey.get(key)!.push(n);
        }
      }

      const mean = (xs: number[]) =>
        xs.length > 0 ? Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2)) : null;

      const allScores = [...byKey.values()].flat();

      return {
        courseId: course.id,
        courseCode: course.code,
        courseName: course.name,
        semester: `Semester ${course.semester}`,
        totalResponses: responses.length,
        overallRating: mean(allScores),
        maxRating: 5,
        categories: [...byKey.entries()].map(([name, scores]) => ({
          name,
          score: mean(scores),
          maxScore: 5,
          responses: scores.length
        })),
        suggestions: []
      };
    });

    res.json({ success: true, data: summaries });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/research/projects', authenticate, validate({ body: researchProjectCreateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);
    const { title, fundingAgency, amount, status } = req.body;
    const project = await prisma.researchProject.create({
      data: { facultyProfileId: profile.id, title, fundingAgency, amount, status: status || 'submitted' }
    });
    res.json({ success: true, data: project });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Committees ───
router.get('/committees', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);
    const committees = await db.committee.findMany({ where: { facultyId: profile.id } });
    res.json({
      success: true,
      data: committees.map((committee: any) => ({
        id: committee.id,
        name: committee.name,
        role: committee.role,
        tenure: committee.tenure,
        meetingsAttended: committee.meetingsAttended,
        totalMeetings: committee.totalMeetings,
        nextMeeting: committee.nextMeeting ? new Date(committee.nextMeeting).toLocaleDateString('en-IN') : null,
        documents: []
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Grievances ───
router.get('/grievances', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const grievances = await prisma.grievanceCase.findMany({
      where: {
        complainantId: userId,
        complainantType: 'faculty'
      },
      orderBy: { submissionDate: 'desc' }
    });

    res.json({
      success: true,
      data: grievances.map((grievance: any) => ({
        id: grievance.id,
        category: grievance.category,
        subject: grievance.subject,
        description: grievance.description,
        severity: grievance.severity,
        priority: grievance.severity,
        status: toRoleGrievanceStatus(grievance.status, 'faculty'),
        resolution: grievance.resolution,
        assignedTo: grievance.assignedTo,
        submittedAt: grievance.submissionDate,
        resolvedAt: grievance.actualResolutionDate,
        type: 'submitted',
        filedBy: 'Self',
        filedAt: new Date(grievance.submissionDate).toLocaleDateString('en-IN')
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/grievances/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const id = String(req.params.id || '');

    if (!id) {
      res.status(400).json({ success: false, message: 'Grievance id is required' });
      return;
    }

    const grievance = await prisma.grievanceCase.findFirst({
      where: {
        id,
        complainantId: userId,
        complainantType: 'faculty'
      }
    });

    if (!grievance) {
      res.status(404).json({ success: false, message: 'Grievance not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        ...grievance,
        status: toRoleGrievanceStatus(grievance.status, 'faculty')
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/grievances', authenticate, validate({ body: facultyGrievanceCreateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { category, subject, description, priority } = req.body;

    if (!category || !subject || !description) {
      res.status(400).json({ success: false, message: 'Category, subject, and description are required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const grievanceNumber = `GR-${Date.now()}`;

    const grievance = await prisma.grievanceCase.create({
      data: {
        institutionId: getTenantContext(req).institutionId,
        grievanceNumber,
        complainantId: userId,
        complainantName: user?.name || 'Faculty',
        complainantType: 'faculty',
        category,
        subject,
        description,
        severity: String(priority || 'medium').toLowerCase(),
        status: 'received',
        timeline: [
          {
            date: new Date().toISOString(),
            action: 'Case Created',
            by: userId,
            notes: 'Submitted by faculty'
          }
        ]
      }
    });

    res.status(201).json({
      success: true,
      data: {
        id: grievance.id,
        category: grievance.category,
        subject: grievance.subject,
        description: grievance.description,
        priority: grievance.severity,
        status: toRoleGrievanceStatus(grievance.status, 'faculty'),
        submittedAt: grievance.submissionDate,
        filedBy: 'Self',
        filedAt: new Date(grievance.submissionDate).toLocaleDateString('en-IN')
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/grievances/:id/respond', authenticate, validate({ params: z.object({ id: entityId }), body: grievanceRespondSchema }), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { resolution } = req.body;
    const updated = await prisma.grievanceCase.update({
      where: { id },
      data: { resolution, status: 'resolved', actualResolutionDate: new Date(), lastUpdated: new Date() }
    });
    res.json({
      success: true,
      data: {
        id: updated.id,
        resolution: updated.resolution,
        status: updated.status,
        resolvedAt: updated.actualResolutionDate
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Communication ───
router.get('/messages', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const semesterQuery = req.query.semester ? Number(req.query.semester) : undefined;
    const profile = await getFacultyProfile(userId);
    const courseWhere: any = { facultyId: profile.id };
    if (Number.isFinite(semesterQuery)) courseWhere.semester = semesterQuery;
    const courses = await prisma.course.findMany({
      where: courseWhere
    });
    const messageWhere: any = { facultyId: profile.id };
    if (Number.isFinite(semesterQuery)) messageWhere.courseId = { in: courses.map((course: any) => course.id) };
    const messages = await db.classMessage.findMany({
      where: messageWhere,
      orderBy: { sentAt: 'desc' }
    });
    res.json({ success: true, data: messages });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/messages', authenticate, validate({ body: facultyClassMessageCreateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getFacultyProfile(userId);
    const { courseId, courseCode, subject, message } = req.body;

    // courseId is client-supplied — without this, a faculty member could
    // attribute a class message to a course that isn't theirs, and the
    // enrollment count below would leak that foreign course's class size.
    const course = await prisma.course.findFirst({ where: { id: courseId, facultyId: profile.id } });
    if (!course) {
      res.status(404).json({ success: false, message: 'Course not found for this faculty' });
      return;
    }

    const enrollmentCount = await prisma.enrollment.count({ where: { courseId } });

    const msg = await db.classMessage.create({
      data: { courseId, courseCode, subject, message, facultyId: profile.id, recipients: enrollmentCount }
    });
    res.json({ success: true, data: msg });
  } catch (error: any) {
    sendError(res, error);
  }
});

export default router;
