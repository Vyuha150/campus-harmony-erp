import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { toRoleGrievanceStatus } from '../lib/grievanceStatus.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const db: any = prisma;

async function ensureFacultyLessonPlanTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FacultyLessonPlan" (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      week_number INTEGER NOT NULL,
      topic TEXT NOT NULL,
      subtopics JSONB NOT NULL DEFAULT '[]'::jsonb,
      course_outcome TEXT NOT NULL,
      planned_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      UNIQUE (course_id, week_number)
    )
  `);
}

function formatDateToIn(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString('en-IN');
}

function sanitizeLessonSubtopics(value: any): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

async function getOrCreateFacultyProfile(userId: string) {
  let profile = await prisma.facultyProfile.findUnique({ where: { userId } });
  if (!profile) {
    profile = await prisma.facultyProfile.create({
      data: {
        userId,
        employeeId: `FAC${userId.substring(0, 6).toUpperCase()}`,
        qualification: 'Ph.D in CSE',
        specialization: 'Artificial Intelligence',
        experience: 5
      }
    });
  }
  return profile;
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

async function getOrCreateFacultyClasses(facultyProfileId: string) {
  let classes = await db.courseClass.findMany({
    where: { facultyId: facultyProfileId },
    include: { course: true, students: true }
  });

  if (classes.length > 0) {
    return classes;
  }

  const courses = await prisma.course.findMany({
    where: { facultyId: facultyProfileId },
    include: {
      enrollments: {
        include: { student: true }
      }
    }
  });

  for (const course of courses) {
    const groups = new Map<string, { section: string; batch: string | null; studentIds: string[] }>();

    for (const enrollment of course.enrollments) {
      const section = enrollment.student.section || 'A';
      const batch = enrollment.student.batch || null;
      const key = `${section}::${batch || ''}`;
      if (!groups.has(key)) {
        groups.set(key, { section, batch, studentIds: [] });
      }
      groups.get(key)!.studentIds.push(enrollment.studentProfileId);
    }

    if (groups.size === 0) {
      groups.set('A::', { section: 'A', batch: null, studentIds: [] });
    }

    for (const group of groups.values()) {
      const createdClass = await db.courseClass.create({
        data: {
          courseId: course.id,
          facultyId: facultyProfileId,
          section: group.section,
          batch: group.batch,
          name: `${course.code} Section ${group.section}${group.batch ? ` (${group.batch})` : ''}`
        }
      });

      if (group.studentIds.length > 0) {
        await db.classEnrollment.createMany({
          data: group.studentIds.map((studentId) => ({
            classId: createdClass.id,
            studentProfileId: studentId
          })),
          skipDuplicates: true
        });
      }
    }
  }

  classes = await db.courseClass.findMany({
    where: { facultyId: facultyProfileId },
    include: { course: true, students: true }
  });

  return classes;
}

// ─── Dashboard ───
router.get('/dashboard', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateFacultyProfile(userId);

    const classes = await getOrCreateFacultyClasses(profile.id);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Profile ───
router.get('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateFacultyProfile(userId);
    const user = await prisma.user.findUnique({ where: { id: userId } });
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
        phone: user?.avatar || '',
        department: user?.designation || 'Computer Science',
        designation: user?.designation || 'Assistant Professor',
        dateOfJoining: user?.createdAt,
        coursesThisSemester: courses.length,
        totalStudents,
        totalPublications: publications,
        totalProjects: projects,
        weeklyHours,
        hIndex: publications,
        leaves,
        leaveBalance: [
          { type: 'Casual Leave', total: 12, used: leaves.filter((l: any) => l.type === 'casual' && l.status === 'approved').length, remaining: 12 - leaves.filter((l: any) => l.type === 'casual' && l.status === 'approved').length },
          { type: 'Earned Leave', total: 15, used: leaves.filter((l: any) => l.type === 'earned' && l.status === 'approved').length, remaining: 15 },
          { type: 'Medical Leave', total: 10, used: leaves.filter((l: any) => l.type === 'medical' && l.status === 'approved').length, remaining: 10 },
        ]
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/profile/leave-balances', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateFacultyProfile(userId);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/profile/leave-history', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateFacultyProfile(userId);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateFacultyProfile(userId);
    const { qualification, specialization, experience } = req.body;
    const updated = await prisma.facultyProfile.update({
      where: { id: profile.id },
      data: { ...(qualification && { qualification }), ...(specialization && { specialization }), ...(experience && { experience }) }
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/profile/leave-request', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateFacultyProfile(userId);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Courses ───
router.get('/courses', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const semesterQuery = req.query.semester ? Number(req.query.semester) : undefined;
    const profile = await getOrCreateFacultyProfile(userId);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/classes', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateFacultyProfile(userId);
    const classes = await getOrCreateFacultyClasses(profile.id);

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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/current-semester', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateFacultyProfile(userId);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/courses/:id/details', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const userRole = String((req as any).user?.role || '');
    const profile = await getOrCreateFacultyProfile(userId);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/courses/lesson-plans', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const semesterQuery = req.query.semester ? Number(req.query.semester) : undefined;
    const profile = await getOrCreateFacultyProfile(userId);
    const where: any = { facultyId: profile.id };
    if (Number.isFinite(semesterQuery)) where.semester = semesterQuery;
    const courses = await prisma.course.findMany({ where });
    await ensureFacultyLessonPlanTable();

    const lessonPlans: any[] = [];
    for (const course of courses) {
      const existingRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, course_id, week_number, topic, subtopics, course_outcome, planned_date, status
         FROM "FacultyLessonPlan"
         WHERE course_id = $1
         ORDER BY week_number ASC`,
        course.id
      );

      if (existingRows.length === 0) {
        for (let week = 1; week <= 8; week += 1) {
          const plannedDate = new Date(new Date().getFullYear(), 0, week * 7 + 1);
          await prisma.$executeRawUnsafe(
            `INSERT INTO "FacultyLessonPlan"
             (id, course_id, week_number, topic, subtopics, course_outcome, planned_date, status)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
             ON CONFLICT (course_id, week_number) DO NOTHING`,
            `${course.id}-${week}`,
            course.id,
            week,
            `Module ${week}`,
            JSON.stringify([`Topic ${week}.1`, `Topic ${week}.2`]),
            `CO${Math.min(week, 5)}`,
            plannedDate,
            week <= 4 ? 'completed' : 'pending'
          );
        }
      }

      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, course_id, week_number, topic, subtopics, course_outcome, planned_date, status
         FROM "FacultyLessonPlan"
         WHERE course_id = $1
         ORDER BY week_number ASC`,
        course.id
      );

      rows.forEach((row: any) => {
        lessonPlans.push({
          id: row.id,
          courseId: row.course_id,
          courseCode: course.code,
          weekNumber: row.week_number,
          topic: row.topic,
          subtopics: sanitizeLessonSubtopics(row.subtopics),
          courseOutcome: row.course_outcome,
          plannedDate: formatDateToIn(row.planned_date),
          status: row.status
        });
      });
    }

    res.json({ success: true, data: lessonPlans });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/courses/:courseId/lesson-plans/:weekNumber', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateFacultyProfile(userId);
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

    await ensureFacultyLessonPlanTable();

    await prisma.$executeRawUnsafe(
      `INSERT INTO "FacultyLessonPlan"
       (id, course_id, week_number, topic, subtopics, course_outcome, planned_date, status, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, NOW())
       ON CONFLICT (course_id, week_number)
       DO UPDATE SET
         topic = EXCLUDED.topic,
         subtopics = EXCLUDED.subtopics,
         course_outcome = EXCLUDED.course_outcome,
         planned_date = EXCLUDED.planned_date,
         status = EXCLUDED.status,
         updated_at = NOW()`,
      `${courseId}-${weekNumber}`,
      courseId,
      weekNumber,
      String(topic),
      JSON.stringify(sanitizeLessonSubtopics(subtopics)),
      String(courseOutcome),
      new Date(plannedDate),
      String(status)
    );

    res.json({
      success: true,
      data: {
        id: `${courseId}-${weekNumber}`,
        courseId,
        courseCode: course.code,
        weekNumber,
        topic: String(topic),
        subtopics: sanitizeLessonSubtopics(subtopics),
        courseOutcome: String(courseOutcome),
        plannedDate: formatDateToIn(new Date(plannedDate)),
        status: String(status)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/courses/:id/students', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Attendance ───
router.get('/attendance/sessions', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const semesterQuery = req.query.semester ? Number(req.query.semester) : undefined;
    const profile = await getOrCreateFacultyProfile(userId);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/attendance/roster', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const semesterQuery = req.query.semester ? Number(req.query.semester) : undefined;
    const courseIdQuery = req.query.courseId ? String(req.query.courseId) : undefined;
    const profile = await getOrCreateFacultyProfile(userId);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/attendance/mark', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateFacultyProfile(userId);
    const { courseId, date, startTime, endTime, type, students } = req.body;

    const session = await prisma.attendanceSession.create({
      data: { courseId, facultyId: profile.id, date: new Date(date), startTime, endTime, type: type || 'lecture' }
    });

    if (students && Array.isArray(students)) {
      await prisma.attendance.createMany({
        data: students.map((s: any) => ({
          attendanceSessionId: session.id,
          studentProfileId: s.studentId,
          status: s.status
        }))
      });
    }

    res.json({ success: true, data: session });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/attendance/history', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateFacultyProfile(userId);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Assignments ───
router.get('/assignments', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const semesterQuery = req.query.semester ? Number(req.query.semester) : undefined;
    const profile = await getOrCreateFacultyProfile(userId);
    const classes = await getOrCreateFacultyClasses(profile.id);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/assignments', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateFacultyProfile(userId);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/assignments/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { title, description, dueDate, maxMarks, status } = req.body;

    const updated = await prisma.assignment.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(dueDate !== undefined ? { dueDate: new Date(dueDate) } : {}),
        ...(maxMarks !== undefined ? { maxMarks } : {}),
        ...(status !== undefined ? { status } : {})
      }
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/assignments/:id/submissions', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/assignments/submissions', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const semesterQuery = req.query.semester ? Number(req.query.semester) : undefined;
    const profile = await getOrCreateFacultyProfile(userId);
    const classes = await getOrCreateFacultyClasses(profile.id);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/assignments/:id/submissions/:subId/grade', authenticate, async (req: Request, res: Response) => {
  try {
    const subId = String(req.params.subId);
    const { marks, feedback } = req.body;
    const updated = await prisma.submission.update({
      where: { id: subId },
      data: { obtainedMarks: marks, feedback, status: 'evaluated' }
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Internal Marks ───
router.get('/marks/:courseId', authenticate, async (req: Request, res: Response) => {
  try {
    const courseId = String(req.params.courseId);
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId },
      include: { student: { include: { user: true } } }
    });
    res.json({
      success: true,
      data: enrollments.map((e: any) => {
        const storedTotal = Number(e.grade);
        return {
          studentId: e.student.id,
          rollNumber: e.student.rollNumber,
          studentName: e.student.user.name,
          grade: e.grade,
          total: Number.isFinite(storedTotal) ? storedTotal : 0,
          maxTotal: 100
        };
      })
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/marks/:courseId', authenticate, async (req: Request, res: Response) => {
  try {
    const courseId = String(req.params.courseId);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/marks/internal', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const semesterQuery = req.query.semester ? Number(req.query.semester) : undefined;
    const profile = await getOrCreateFacultyProfile(userId);
    const where: any = { facultyId: profile.id };
    if (Number.isFinite(semesterQuery)) where.semester = semesterQuery;
    const courses = await prisma.course.findMany({
      where
    });
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId: { in: courses.map((course: any) => course.id) } },
      include: { student: { include: { user: true } } },
      take: 100
    });

    res.json({
      success: true,
      data: enrollments.map((enrollment: any, index: number) => {
        const quiz1 = Math.min(10, 6 + (index % 4));
        const quiz2 = Math.min(10, 5 + (index % 5));
        const midterm = Math.min(50, 28 + (index % 20));
        const assignment = Math.min(20, 12 + (index % 8));
        const attendance = Math.min(10, 7 + (index % 4));
        return {
          studentId: enrollment.student.id,
          rollNumber: enrollment.student.rollNumber,
          studentName: enrollment.student.user.name,
          quiz1,
          quiz2,
          midterm,
          assignment,
          attendance,
          total: quiz1 + quiz2 + midterm + assignment + attendance
        };
      })
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Mentoring ───
router.get('/mentees', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateFacultyProfile(userId);
    const assignments = await db.menteeAssignment.findMany({ where: { facultyId: profile.id } });

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
            attendance: 80,
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/mentees/:id/notes', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateFacultyProfile(userId);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Research ───
router.get('/research/publications', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateFacultyProfile(userId);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/research/publications', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateFacultyProfile(userId);
    const { title, journal, year, status } = req.body;
    const pub = await prisma.publication.create({
      data: { facultyProfileId: profile.id, title, journal, year, status: status || 'submitted' }
    });
    res.json({ success: true, data: pub });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/research/projects', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateFacultyProfile(userId);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/research/patents', authenticate, async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: [] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Dashboard helpers ───
router.get('/dashboard/announcements', authenticate, async (_req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: [
        { id: 'a1', title: 'Internal marks submission window open', detail: 'Submit internal marks before Friday.', priority: 'high' },
        { id: 'a2', title: 'Department review meeting', detail: 'Friday 3:00 PM in conference hall.', priority: 'medium' },
      ]
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/dashboard/tasks', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const semesterQuery = req.query.semester ? Number(req.query.semester) : undefined;
    const profile = await getOrCreateFacultyProfile(userId);
    const classes = await getOrCreateFacultyClasses(profile.id);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/dashboard/alerts', authenticate, async (_req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: [
        { id: 'al1', title: 'Attendance dip detected', description: 'One or more courses are below 75% average attendance.' }
      ]
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/feedback-summaries', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const semesterQuery = req.query.semester ? Number(req.query.semester) : undefined;
    const profile = await getOrCreateFacultyProfile(userId);
    const where: any = { facultyId: profile.id };
    if (Number.isFinite(semesterQuery)) where.semester = semesterQuery;
    const courses = await prisma.course.findMany({
      where,
      include: { feedbacks: { include: { responses: true } } }
    });

    const summaries = courses.map((course: any) => {
      const responses = course.feedbacks.flatMap((form: any) => form.responses || []);
      return {
        courseId: course.id,
        courseCode: course.code,
        courseName: course.name,
        semester: `Semester ${course.semester}`,
        totalResponses: responses.length,
        overallRating: responses.length > 0 ? 4.0 : 0,
        maxRating: 5,
        categories: [
          { name: 'Course Delivery', score: responses.length > 0 ? 4.1 : 0, maxScore: 5 },
          { name: 'Clarity', score: responses.length > 0 ? 4.0 : 0, maxScore: 5 },
          { name: 'Assessment Quality', score: responses.length > 0 ? 3.9 : 0, maxScore: 5 }
        ],
        suggestions: []
      };
    });

    res.json({ success: true, data: summaries });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/research/projects', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateFacultyProfile(userId);
    const { title, fundingAgency, amount, status } = req.body;
    const project = await prisma.researchProject.create({
      data: { facultyProfileId: profile.id, title, fundingAgency, amount, status: status || 'submitted' }
    });
    res.json({ success: true, data: project });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Committees ───
router.get('/committees', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateFacultyProfile(userId);
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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/grievances', authenticate, async (req: Request, res: Response) => {
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/grievances/:id/respond', authenticate, async (req: Request, res: Response) => {
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Communication ───
router.get('/messages', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const semesterQuery = req.query.semester ? Number(req.query.semester) : undefined;
    const profile = await getOrCreateFacultyProfile(userId);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/messages', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateFacultyProfile(userId);
    const { courseId, courseCode, subject, message } = req.body;

    const enrollmentCount = await prisma.enrollment.count({ where: { courseId } });

    const msg = await db.classMessage.create({
      data: { courseId, courseCode, subject, message, facultyId: profile.id, recipients: enrollmentCount }
    });
    res.json({ success: true, data: msg });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
