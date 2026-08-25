import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { fromRoleGrievanceStatus, toRoleGrievanceStatus } from '../lib/grievanceStatus.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { sendError, NotFoundError } from '../lib/errors.js';
import { getTenantContext } from '../lib/tenant.js';
import * as workflow from '../modules/workflow/workflow.service.js';
import { openInstanceFor, ensureDefinition } from '../modules/workflow/bridge.js';
import { PURCHASE_REQUEST, CURRICULUM_PROPOSAL } from '../modules/workflow/builtins.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { entityId } from '../schemas/common.js';
import { deleteTenantEntity } from '../modules/common/entityDelete.service.js';
import {
  accreditationDataUpdateSchema
} from '../modules/common/legacyWrite.schemas.js';
import {
  hodApprovalDecisionSchema,
  workloadAssignSchema,
  purchaseRequestCreateSchema,
  hodBroadcastCreateSchema,
  facultyRolesUpdateSchema,
  facultyLeaveDecisionSchema,
  promotionRecommendationSchema,
  remedialNoteSchema,
  advisorAssignSchema,
  counselingNoteSchema,
  workloadCourseCreateSchema,
  workloadCourseUpdateSchema,
  accreditationDataCreateSchema,
  labInventoryCreateSchema,
  labInventoryUpdateSchema,
  hodCourseCreateSchema,
  hodCourseUpdateSchema,
  curriculumProposalCreateSchema,
  facilityCreateSchema,
  facilityUpdateSchema,
  hodCommunicationCreateSchema,
  hodGrievanceDecisionSchema,
  studentsExportSchema,
  meritListSchema,
  studentEmailSchema,
  accreditationDocumentUploadSchema
} from '../modules/hod/hod.schemas.js';

const router = Router();
const db: any = prisma;

/**
 * Resolve the HOD's department.
 *
 * HISTORY — same fabrication as dean.ts: it auto-created a "Computer Science &
 * Engg" department and assigned the user to it, using a GLOBAL `{ code: 'CSE' }`
 * lookup that under multi-tenancy could have matched another institution's
 * department and assigned this user across the tenant boundary.
 *
 * @throws {NotFoundError} when the user has no department assignment.
 */
async function getHODDepartment(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { department: true } });
  if (!user?.departmentId) {
    throw new NotFoundError(
      'Department assignment',
      { userId, hint: 'This account is not assigned to a department. An administrator must assign one.' }
    );
  }
  return user.department;
}

async function resolveStudentProfileIdsByEmails(departmentId: string, emails: string[]) {
  if (emails.length === 0) return [] as string[];

  const users = await prisma.user.findMany({
    where: {
      departmentId,
      role: 'student',
      email: { in: emails }
    },
    include: { studentProfile: true }
  });

  return users
    .map((user: any) => user.studentProfile?.id)
    .filter((id: string | undefined): id is string => Boolean(id));
}

/**
 * Real per-student attendance, from `Attendance` records.
 *
 * REPLACES the literal `attendance: 85` that appeared on every student in
 * three list endpoints in this file, regardless of whether the student had
 * ever been marked present, absent, or not at all.
 *
 * A student with no marked sessions is simply ABSENT from the returned map —
 * not present at 0%, and not defaulted to a plausible-looking number. Callers
 * render that as "No records", the same convention used in
 * `routes/students.ts`.
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

/**
 * Tally of the REAL grade values on a set of enrolments.
 *
 * REPLACES a fixed 25% / 35% / 40% A/B/C split that was computed from
 * `totalStudents` alone — the same three numbers regardless of what any
 * student had actually been graded, on the one screen that reports a
 * department's grade distribution to its own head. Ungraded enrolments
 * (`grade` null — not yet evaluated) are excluded, the same way an unpublished
 * result is excluded elsewhere in this system.
 */
function tallyGrades(enrollments: { grade: string | null }[]): { grade: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const enrollment of enrollments) {
    if (!enrollment.grade) continue;
    counts.set(enrollment.grade, (counts.get(enrollment.grade) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([grade, count]) => ({ grade, count }));
}

// ─── Dashboard ───
/**
 * Department dashboard.
 *
 * `avgPassPercentage: 88.5, avgAttendance: 82.3` were literals — the same two
 * numbers for every department in every institution, regardless of how any
 * student had actually done. Both are now real: pass percentage from the
 * department's own `Enrollment.grade` values, attendance from the department's
 * own `Attendance` records. Either reports `null` rather than a plausible
 * number when nothing has been graded or marked yet.
 */
router.get('/dashboard', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error("Department unassigned");

    const totalStudents = await prisma.user.count({ where: { departmentId: department.id, role: 'student' } });
    const totalFaculty = await prisma.user.count({ where: { departmentId: department.id, role: 'faculty' } });
    const courses = await prisma.course.count({ where: { departmentId: department.id } });
    const pendingApprovals = await prisma.approvalItem.count({ where: { status: 'pending' } });

    const [deptEnrollments, deptStudentProfileIds] = await Promise.all([
      prisma.enrollment.findMany({
        where: { course: { departmentId: department.id } },
        select: { grade: true }
      }),
      prisma.studentProfile.findMany({
        where: { user: { departmentId: department.id, role: 'student' } },
        select: { id: true }
      })
    ]);

    const gradedEnrollments = deptEnrollments.filter((e) => e.grade);
    const avgPassPercentage =
      gradedEnrollments.length > 0
        ? Math.round(
            (gradedEnrollments.filter((e) => !['F', 'I'].includes(String(e.grade))).length /
              gradedEnrollments.length) *
              100 *
              10
          ) / 10
        : null;

    const attendanceByStudent = await attendancePercentageByStudent(deptStudentProfileIds.map((s) => s.id));
    const avgAttendance =
      attendanceByStudent.size > 0
        ? Math.round(
            ([...attendanceByStudent.values()].reduce((sum, v) => sum + v, 0) / attendanceByStudent.size) * 10
          ) / 10
        : null;

    res.json({
      success: true,
      data: {
        departmentSummary: { name: department.name, totalFaculty, totalStudents, avgPassPercentage, avgAttendance },
        stats: [
          { label: "Total Faculty", value: totalFaculty.toString(), icon: "Users" },
          { label: "Total Students", value: totalStudents.toString(), icon: "GraduationCap", color: "text-blue-500" },
          { label: "Active Courses", value: courses.toString(), icon: "BookOpen", color: "text-success" },
          { label: "Pending Approvals", value: pendingApprovals.toString(), icon: "AlertTriangle", color: "text-destructive" }
        ],
        upcomingEvents: []
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Faculty Management ───
router.get('/faculty', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error("Department unassigned");

    const faculty = await prisma.user.findMany({
      where: { departmentId: department.id, role: 'faculty' },
      include: { facultyProfile: { include: { coursesTaught: true, leaveRequests: true } } }
    });

    res.json({
      success: true,
      data: faculty.map((f: any) => ({
        id: f.id, name: f.name, employeeId: f.facultyProfile?.employeeId,
        designation: f.designation || 'Assistant Professor', qualification: f.facultyProfile?.qualification,
        specialization: f.facultyProfile?.specialization, email: f.email,
        coursesAssigned: f.facultyProfile?.coursesTaught?.length || 0,
        weeklyHours: (f.facultyProfile?.coursesTaught?.length || 0) * 4,
        publications: 0, type: 'permanent',
        isOnLeave: f.facultyProfile?.leaveRequests?.some((l: any) => l.status === 'approved' && new Date(l.toDate) >= new Date()) || false
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Approvals ───
router.get('/approvals', authenticate, async (req: Request, res: Response) => {
  try {
    const approvals = await prisma.approvalItem.findMany({ orderBy: { requestedAt: 'desc' } });
    res.json({ success: true, data: approvals });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/approvals/:id', authenticate, validate({ body: hodApprovalDecisionSchema }), async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    const id = String(req.params.id);
    const { status, note } = req.body ?? {};

    // The status was previously written straight from the body (`data: { status }`),
    // so any string was accepted and an item could skip states entirely.
    const ALLOWED = ['approved', 'rejected', 'forwarded'] as const;
    if (!ALLOWED.includes(status)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `status must be one of: ${ALLOWED.join(', ')}.`
        }
      });
      return;
    }

    // updateMany, not update: the tenant extension constrains a `where` clause but
    // cannot filter a unique-key update. Without this, knowing an id from another
    // institution was enough to decide their approval.
    const result = await prisma.approvalItem.updateMany({
      where: { id, status: 'pending' },
      data: {
        status,
        decidedBy: ctx.userId,
        decidedAt: new Date(),
        decisionNote: typeof note === 'string' ? note.slice(0, 500) : null
      }
    });

    if (result.count === 0) {
      // Absent, already decided, or belonging to another institution — all three
      // are "not yours to decide", and distinguishing them would leak whether an
      // id exists elsewhere.
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No pending approval with that id.' }
      });
      return;
    }

    const updated = await prisma.approvalItem.findFirst({ where: { id } });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Workload ───
router.get('/workload', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error("Department unassigned");

    const classes = await prisma.courseClass.findMany({
      where: { course: { departmentId: department.id } },
      include: {
        course: true,
        faculty: { include: { user: true } },
        students: true
      }
    });

    const slots = await prisma.timetableSlot.findMany({ where: { departmentId: department.id } });
    const slotByClassKey = new Map<string, any>();
    for (const slot of slots) {
      const key = `${slot.courseCode}::${String(slot.section).toUpperCase()}`;
      if (!slotByClassKey.has(key)) slotByClassKey.set(key, slot);
    }

    res.json({
      success: true,
      data: classes.map((item: any) => ({
        ...(() => {
          const slotKey = `${item.course.code}::${String(item.section).toUpperCase()}`;
          const slot = slotByClassKey.get(slotKey);
          return {
            day: slot?.day || null,
            startTime: slot?.startTime || null,
            endTime: slot?.endTime || null,
            room: slot?.room || null,
            schedule: slot ? `${slot.day} ${slot.startTime}-${slot.endTime} (${slot.room})` : 'TBD',
          };
        })(),
        id: item.id,
        courseId: item.courseId,
        courseCode: item.course.code,
        courseName: item.course.name,
        credits: item.course.credits,
        semester: item.course.semester,
        assignedFaculty: item.faculty?.user?.name || 'Unassigned',
        facultyId: item.facultyId,
        section: item.section,
        students: item.students.length,
        type: 'theory'
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/workload/assign', authenticate, validate({ body: workloadAssignSchema }), async (req: Request, res: Response) => {
  try {
    const classId = req.body?.classId ? String(req.body.classId) : null;
    const courseId = req.body?.courseId ? String(req.body.courseId) : null;
    const facultyId = req.body?.facultyId ? String(req.body.facultyId) : null;

    if (classId && facultyId) {
      const updatedClass = await prisma.courseClass.update({ where: { id: classId }, data: { facultyId } });
      res.json({ success: true, data: updatedClass });
      return;
    }

    if (courseId && facultyId) {
      const updatedCourse = await prisma.course.update({ where: { id: courseId }, data: { facultyId } });
      res.json({ success: true, data: updatedCourse });
      return;
    }

    // Substitution flow from UI currently sends absent/substitute data; accept as successful action.
    res.json({ success: true, data: { accepted: true } });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/workload/course-options', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const [courses, rooms] = await Promise.all([
      prisma.course.findMany({ where: { departmentId: department.id }, orderBy: [{ semester: 'asc' }, { code: 'asc' }] }),
      prisma.facility.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] })
    ]);
    res.json({
      success: true,
      data: {
        courses: courses.map((course: any) => ({ id: course.id, code: course.code, name: course.name, semester: course.semester, credits: course.credits })),
        rooms: rooms.map((room: any) => ({ id: room.id, name: room.name, type: room.type, capacity: room.capacity, status: room.status }))
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Timetable ───
router.get('/timetable', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error("Department unassigned");

    const requestedSection = req.query?.section ? String(req.query.section) : 'all';
    const whereClause = requestedSection && requestedSection !== 'all'
      ? { departmentId: department.id, section: requestedSection.toUpperCase() }
      : { departmentId: department.id };

    const slots = await db.timetableSlot.findMany({ where: whereClause });
    if (slots.length > 0) {
      res.json({ success: true, data: slots });
      return;
    }

    // Fallback: derive timetable-like slots from course schedules and class assignments.
    const classes = await prisma.courseClass.findMany({
      where: { course: { departmentId: department.id } },
      include: { course: { include: { schedules: true } }, faculty: { include: { user: true } } }
    });

    const derived = classes.flatMap((item: any) =>
      (item.course?.schedules || []).map((schedule: any) => ({
        id: `${item.id}-${schedule.id}`,
        day: schedule.day,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        courseCode: item.course.code,
        courseName: item.course.name,
        faculty: item.faculty?.user?.name || 'Unassigned',
        room: schedule.room,
        section: item.section,
        type: schedule.type
      }))
    );

    const filtered = requestedSection && requestedSection !== 'all'
      ? derived.filter((slot: any) => String(slot.section).toUpperCase() === requestedSection.toUpperCase())
      : derived;

    res.json({ success: true, data: filtered });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Students ───
router.get('/students', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error("Department unassigned");

    const students = await prisma.user.findMany({
      where: { departmentId: department.id, role: 'student' },
      include: { studentProfile: true }
    });

    const attendanceByStudent = await attendancePercentageByStudent(
      students.map((s: any) => s.studentProfile?.id).filter((id: string | undefined): id is string => Boolean(id))
    );

    res.json({
      success: true,
      data: students.map((s: any) => ({
        id: s.studentProfile?.id || s.id, rollNumber: s.studentProfile?.rollNumber, name: s.name,
        program: s.studentProfile?.program, year: Math.ceil((s.studentProfile?.semester || 1) / 2),
        semester: s.studentProfile?.semester, section: s.studentProfile?.section,
        cgpa: s.studentProfile?.cgpa || 0,
        // `null`, not the literal 85: a student with no marked sessions has no
        // attendance figure, not a plausible-looking one.
        attendance: s.studentProfile?.id ? attendanceByStudent.get(s.studentProfile.id) ?? null : null,
        status: 'active', email: s.email
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Results Analysis ───
router.get('/results', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error("Department unassigned");

    const courses = await prisma.course.findMany({
      where: { departmentId: department.id },
      include: { faculty: { include: { user: true } }, enrollments: true }
    });

    res.json({
      success: true,
      // `avgScore: 65, highestScore: 95, gradeDistribution: []` were literals —
      // the same two numbers and an always-empty distribution for every course
      // in every department, on the screen a head of department reads to judge
      // how a course actually went. Numeric marks come from `Enrollment.grade`
      // where it parses as a number; `null` when nothing does, rather than a
      // plausible-looking score. The distribution is a real tally, not an
      // invented percentage split.
      data: courses.map((c: any) => {
        const total = c.enrollments.length;
        const passed = c.enrollments.filter((e: any) => e.grade && !['F', 'I'].includes(e.grade)).length;
        const numericMarks = c.enrollments
          .map((e: any) => Number(e.grade))
          .filter((v: number) => Number.isFinite(v));
        return {
          courseCode: c.code, courseName: c.name, faculty: c.faculty?.user?.name || 'N/A',
          totalStudents: total, passed, failed: total - passed,
          passPercentage: total > 0 ? Math.round((passed / total) * 100) : 0,
          avgScore:
            numericMarks.length > 0
              ? Math.round(numericMarks.reduce((s: number, v: number) => s + v, 0) / numericMarks.length)
              : null,
          highestScore: numericMarks.length > 0 ? Math.max(...numericMarks) : null,
          gradeDistribution: tallyGrades(c.enrollments)
        };
      })
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Accreditation ───
router.get('/accreditation', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error("Department unassigned");
    const data = await db.accreditationData.findMany({ where: { departmentId: department.id } });
    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/accreditation/:id', authenticate,
  validate({ params: z.object({ id: entityId }), body: accreditationDataUpdateSchema }),
  async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await db.accreditationData.update({ where: { id }, data: { ...req.body, lastUpdated: new Date() } });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Lab Inventory ───
router.get('/inventory', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error("Department unassigned");
    const items = await db.labInventoryItem.findMany({ where: { departmentId: department.id } });
    res.json({ success: true, data: items });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/inventory/purchase-request', authenticate, validate({ body: purchaseRequestCreateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error("Department unassigned");
    const { itemName, lab, quantity, estimatedCost, justification } = req.body;
    const request = await db.purchaseRequest.create({
      data: { itemName, lab, requestedBy: userId, quantity, estimatedCost, justification, departmentId: department.id }
    });
    res.json({ success: true, data: request });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Communication ───
router.get('/messages', authenticate, async (req: Request, res: Response) => {
  try {
    const messages = await db.broadcastMessage.findMany({ orderBy: { sentAt: 'desc' }, take: 50 });
    res.json({ success: true, data: messages });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/messages', authenticate, validate({ body: hodBroadcastCreateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const { subject, content, type, recipients } = req.body;
    const msg = await db.broadcastMessage.create({
      data: { subject, content, sender: user?.name || 'HOD', type: type || 'announcement', recipients: recipients || 'department' }
    });
    res.json({ success: true, data: msg });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Frontend Compatibility Endpoints ───
router.get('/departmentfaculty', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const faculty = await prisma.user.findMany({
      where: { departmentId: department.id, role: 'faculty' },
      include: { facultyProfile: { include: { coursesTaught: true, leaveRequests: true } } }
    });

    res.json({
      success: true,
      data: faculty.map((item: any) => ({
        id: item.id,
        name: item.name,
        employeeId: item.facultyProfile?.employeeId || '',
        designation: item.designation || 'Assistant Professor',
        qualification: item.facultyProfile?.qualification || 'Not specified',
        specialization: item.facultyProfile?.specialization || 'General',
        email: item.email,
        phone: 'Not provided',
        dateOfJoining: item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN') : 'N/A',
        type: 'permanent',
        coursesAssigned: item.facultyProfile?.coursesTaught?.length || 0,
        weeklyHours: (item.facultyProfile?.coursesTaught?.length || 0) * 4,
        publications: 0,
        isOnLeave: item.facultyProfile?.leaveRequests?.some((leave: any) => leave.status === 'approved' && new Date(leave.toDate) >= new Date()) || false,
        leaveType: item.facultyProfile?.leaveRequests?.find((leave: any) => leave.status === 'approved' && new Date(leave.toDate) >= new Date())?.type || undefined,
        roles: []
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/faculty/:id/roles', authenticate, validate({ params: z.object({ id: entityId }), body: facultyRolesUpdateSchema }), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const roles = Array.isArray(req.body?.roles) ? req.body.roles : [];
    await prisma.approvalItem.create({
      data: {
        institutionId: getTenantContext(req).institutionId,
        type: 'role_assignment',
        title: `Faculty role update for ${id}`,
        details: `Roles set: ${roles.join(', ')}`,
        requestedBy: (req as any).user.id,
        priority: 'medium',
        status: 'approved'
      }
    });
    res.json({ success: true, data: { id, roles } });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/faculty/:id/leave', authenticate, validate({ params: z.object({ id: entityId }), body: facultyLeaveDecisionSchema }), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const action = String(req.body?.action || 'approve');
    const facultyProfile = await prisma.facultyProfile.findUnique({ where: { userId: id } });

    if (!facultyProfile) {
      res.status(404).json({ success: false, message: 'Faculty profile not found' });
      return;
    }

    const latestLeave = await prisma.leaveRequest.findFirst({
      where: { facultyProfileId: facultyProfile.id },
      orderBy: { appliedAt: 'desc' }
    });

    if (!latestLeave) {
      res.status(404).json({ success: false, message: 'No leave request found' });
      return;
    }

    const status = action === 'reject' ? 'rejected' : 'approved';
    const updated = await prisma.leaveRequest.update({
      where: { id: latestLeave.id },
      data: { status }
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/faculty/:id/promotion-recommendation', authenticate, validate({ params: z.object({ id: entityId }), body: promotionRecommendationSchema }), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const reason = String(req.body?.reason || 'Promotion recommendation');
    const item = await prisma.approvalItem.create({
      data: {
        institutionId: getTenantContext(req).institutionId,
        type: 'promotion_recommendation',
        title: `Promotion recommendation: ${id}`,
        details: reason,
        requestedBy: (req as any).user.id,
        priority: 'high',
        status: 'pending'
      }
    });
    res.json({ success: true, data: item });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/departmentstudents', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const students = await prisma.user.findMany({
      where: { departmentId: department.id, role: 'student' },
      include: { studentProfile: true }
    });

    const studentProfileIds = students
      .map((s: any) => s.studentProfile?.id)
      .filter((id: string | undefined): id is string => Boolean(id));

    const [attendanceByStudent, assignments] = await Promise.all([
      attendancePercentageByStudent(studentProfileIds),
      // The REAL advisor, from MenteeAssignment. Was
      // `faculty[index % faculty.length]` — every student in the department
      // assigned an "advisor" by cycling through the faculty list in list
      // order, with no assignment record behind it. A HOD reading this could
      // believe a named professor was mentoring students who had never been
      // assigned to them.
      studentProfileIds.length > 0
        ? prisma.menteeAssignment.findMany({
            where: { studentId: { in: studentProfileIds } },
            select: { studentId: true, facultyId: true }
          })
        : Promise.resolve([])
    ]);

    const facultyIds = [...new Set(assignments.map((a: any) => a.facultyId))];
    const advisorProfiles = facultyIds.length > 0
      ? await prisma.facultyProfile.findMany({
          where: { id: { in: facultyIds } },
          include: { user: { select: { name: true } } }
        })
      : [];
    const advisorNameByFacultyId = new Map(advisorProfiles.map((p: any) => [p.id, p.user?.name]));
    const advisorByStudent = new Map(
      assignments.map((a: any) => [a.studentId, advisorNameByFacultyId.get(a.facultyId) ?? null])
    );

    res.json({
      success: true,
      data: students.map((student: any) => ({
        id: student.studentProfile?.id || student.id,
        rollNumber: student.studentProfile?.rollNumber || '',
        name: student.name,
        program: student.studentProfile?.program || 'B.Tech',
        year: Math.ceil((student.studentProfile?.semester || 1) / 2),
        semester: student.studentProfile?.semester || 1,
        section: student.studentProfile?.section || 'A',
        cgpa: student.studentProfile?.cgpa || 0,
        attendance: student.studentProfile?.id ? attendanceByStudent.get(student.studentProfile.id) ?? null : null,
        advisor: (student.studentProfile?.id && advisorByStudent.get(student.studentProfile.id)) || 'Not assigned',
        status: 'active',
        email: student.email
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/students/:id/advisor', authenticate, validate({ params: z.object({ id: entityId }), body: advisorAssignSchema }), async (req: Request, res: Response) => {
  try {
    const studentId = String(req.params.id);
    const advisor = String(req.body?.advisor || '');
    res.json({ success: true, data: { studentId, advisor } });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/students/:id/counseling-note', authenticate, validate({ params: z.object({ id: entityId }), body: counselingNoteSchema }), async (req: Request, res: Response) => {
  try {
    const studentId = String(req.params.id);
    const note = String(req.body?.note || '');
    const entry = await prisma.approvalItem.create({
      data: {
        institutionId: getTenantContext(req).institutionId,
        type: 'counseling_note',
        title: `Counseling note for ${studentId}`,
        details: note,
        requestedBy: (req as any).user.id,
        priority: 'low',
        status: 'approved'
      }
    });
    res.json({ success: true, data: entry });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/hodapprovals', authenticate, async (_req: Request, res: Response) => {
  try {
    const approvals = await prisma.approvalItem.findMany({ orderBy: { requestedAt: 'desc' }, take: 30 });
    res.json({
      success: true,
      data: approvals.map((item: any) => ({
        id: item.id,
        type: (item.type || 'grievance') as any,
        title: item.title,
        requestedBy: item.requestedBy,
        requestedAt: new Date(item.requestedAt).toLocaleDateString('en-IN'),
        details: item.details,
        priority: (item.priority || 'medium') as any,
        status: (item.status || 'pending') as any
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/hodapprovals/:id/status', authenticate, validate({ params: z.object({ id: entityId }), body: hodApprovalDecisionSchema }), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const status = String(req.body?.status || 'pending');
    // updateMany + a pending filter, NOT update-by-id.
    //
    // The tenant extension can constrain a `where` clause but cannot filter a
    // unique-key update, so `update({ where: { id } })` let anyone holding an id
    // from ANOTHER institution decide that approval. Demonstrated live before
    // migration 0022. The status is validated above rather than written raw.
    const ALLOWED_DECISIONS = ['approved', 'rejected', 'forwarded'];
    if (!ALLOWED_DECISIONS.includes(status)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `status must be one of: ${ALLOWED_DECISIONS.join(', ')}.` }
      });
      return;
    }
    const changed = await prisma.approvalItem.updateMany({
      where: { id, status: 'pending' },
      data: { status, decidedBy: getTenantContext(req).userId, decidedAt: new Date() }
    });
    if (changed.count === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No pending approval with that id.' }
      });
      return;
    }
    const updated = await prisma.approvalItem.findFirst({ where: { id } });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/departmentcalendar', authenticate, async (_req: Request, res: Response) => {
  try {
    const meetings = await prisma.meeting.findMany({ orderBy: { date: 'asc' }, take: 10 });
    res.json({
      success: true,
      data: meetings.map((meeting: any) => ({
        id: meeting.id,
        title: meeting.title,
        date: new Date(meeting.date).toISOString().slice(0, 10),
        time: meeting.time,
        type: 'meeting',
        description: meeting.meetingType
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/workload/course', authenticate, authorizeRoles('hod', 'dean'), validate({ body: workloadCourseCreateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const { courseId, semester, facultyId, section, type, studentEmails, roomId, day, startTime, endTime } = req.body;
    if (!courseId || !facultyId || !section || !roomId || !day || !startTime || !endTime) {
      res.status(400).json({ success: false, message: 'courseId, facultyId, section, roomId, day, startTime and endTime are required' });
      return;
    }

    const course = await prisma.course.findFirst({ where: { id: String(courseId), departmentId: department.id } });
    if (!course) {
      res.status(404).json({ success: false, message: 'Course not found in your department' });
      return;
    }

    const semesterNum = Number(semester);
    if (Number.isFinite(semesterNum) && semesterNum !== course.semester) {
      res.status(400).json({ success: false, message: 'Selected semester does not match the course semester' });
      return;
    }

    const faculty = await prisma.facultyProfile.findUnique({ where: { id: String(facultyId) }, include: { user: true } });
    if (!faculty || faculty.user?.departmentId !== department.id) {
      res.status(400).json({ success: false, message: 'Selected faculty does not belong to your department' });
      return;
    }

    const room = await prisma.facility.findUnique({ where: { id: String(roomId) } });
    if (!room) {
      res.status(404).json({ success: false, message: 'Selected room not found' });
      return;
    }

    const conflict = await prisma.timetableSlot.findFirst({
      where: {
        departmentId: department.id,
        day: String(day),
        startTime: String(startTime),
        OR: [
          { room: room.name },
          { faculty: faculty.user?.name || '' }
        ]
      }
    });
    if (conflict) {
      res.status(400).json({ success: false, message: 'Timetable conflict detected for room/faculty at selected slot' });
      return;
    }

    const createdClass = await prisma.courseClass.create({
      data: {
        courseId: course.id,
        facultyId: String(facultyId),
        section: String(section).toUpperCase(),
        name: `${course.code}-${String(section).toUpperCase()}`
      }
    });

    const emails = String(studentEmails || '')
      .split(/[\n,;]/)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);

    const studentProfileIds = await resolveStudentProfileIdsByEmails(department.id, emails);
    if (studentProfileIds.length > 0) {
      await prisma.classEnrollment.createMany({
        data: studentProfileIds.map((studentProfileId: string) => ({ classId: createdClass.id, studentProfileId })),
        skipDuplicates: true
      });
    }

    await prisma.timetableSlot.create({
      data: {
        day: String(day),
        startTime: String(startTime),
        endTime: String(endTime),
        courseCode: course.code,
        courseName: course.name,
        faculty: faculty.user?.name || 'Unassigned',
        room: room.name,
        section: String(section).toUpperCase(),
        type: String(type || 'theory'),
        departmentId: department.id
      }
    });

    const studentCount = await prisma.classEnrollment.count({ where: { classId: createdClass.id } });

    res.json({
      success: true,
      data: {
        id: createdClass.id,
        courseId: course.id,
        courseCode: course.code,
        courseName: course.name,
        credits: course.credits,
        semester: course.semester,
        section: createdClass.section,
        facultyId: createdClass.facultyId,
        assignedFaculty: faculty.user?.name || 'Assigned',
        day: String(day),
        startTime: String(startTime),
        endTime: String(endTime),
        room: room.name,
        schedule: `${String(day)} ${String(startTime)}-${String(endTime)} (${room.name})`,
        students: studentCount,
        type: type || 'theory'
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/workload/course/:id', authenticate, authorizeRoles('hod', 'dean'), validate({ params: z.object({ id: entityId }), body: workloadCourseUpdateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const classId = String(req.params.id);
    const existing = await prisma.courseClass.findFirst({
      where: { id: classId, course: { departmentId: department.id } },
      include: { course: true }
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'Class not found' });
      return;
    }

    const { courseCode, courseName, credits, semester, facultyId, section, type, studentEmails, roomId, day, startTime, endTime } = req.body;

    const updatedCourse = await prisma.course.update({
      where: { id: existing.courseId },
      data: {
        ...(courseCode ? { code: String(courseCode) } : {}),
        ...(courseName ? { name: String(courseName) } : {}),
        ...(credits != null ? { credits: Number(credits) } : {}),
        ...(semester != null ? { semester: Number(semester) } : {})
      }
    });

    const updatedClass = await prisma.courseClass.update({
      where: { id: classId },
      data: {
        ...(facultyId ? { facultyId: String(facultyId) } : {}),
        ...(section ? { section: String(section).toUpperCase() } : {}),
        ...(type ? { name: `${updatedCourse.code}-${String(section || existing.section).toUpperCase()}-${String(type)}` } : {})
      },
      include: { faculty: { include: { user: true } } }
    });

    const room = roomId ? await prisma.facility.findUnique({ where: { id: String(roomId) } }) : null;
    const currentRoomName = room?.name;
    const slotKeyCourseCode = updatedCourse.code;
    const slotKeySection = String(updatedClass.section).toUpperCase();
    const existingSlot = await prisma.timetableSlot.findFirst({
      where: {
        departmentId: department.id,
        courseCode: slotKeyCourseCode,
        section: slotKeySection
      },
      orderBy: { startTime: 'asc' }
    });

    const chosenDay = String(day || existingSlot?.day || 'Monday');
    const chosenStart = String(startTime || existingSlot?.startTime || '09:00');
    const chosenEnd = String(endTime || existingSlot?.endTime || '10:00');
    const chosenRoom = String(currentRoomName || existingSlot?.room || 'TBD');
    const chosenFacultyName = updatedClass.faculty?.user?.name || existingSlot?.faculty || 'Unassigned';

    await prisma.timetableSlot.deleteMany({
      where: {
        departmentId: department.id,
        courseCode: slotKeyCourseCode,
        section: slotKeySection
      }
    });
    await prisma.timetableSlot.create({
      data: {
        day: chosenDay,
        startTime: chosenStart,
        endTime: chosenEnd,
        courseCode: slotKeyCourseCode,
        courseName: updatedCourse.name,
        faculty: chosenFacultyName,
        room: chosenRoom,
        section: slotKeySection,
        type: String(type || existingSlot?.type || 'theory'),
        departmentId: department.id
      }
    });

    if (studentEmails !== undefined) {
      const emails = String(studentEmails || '')
        .split(/[\n,;]/)
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);

      const studentProfileIds = await resolveStudentProfileIdsByEmails(department.id, emails);
      await prisma.classEnrollment.deleteMany({ where: { classId } });
      if (studentProfileIds.length > 0) {
        await prisma.classEnrollment.createMany({
          data: studentProfileIds.map((studentProfileId: string) => ({ classId, studentProfileId })),
          skipDuplicates: true
        });
      }
    }

    const studentCount = await prisma.classEnrollment.count({ where: { classId } });
    res.json({
      success: true,
      data: {
        id: classId,
        courseId: updatedCourse.id,
        courseCode: updatedCourse.code,
        courseName: updatedCourse.name,
        credits: updatedCourse.credits,
        semester: updatedCourse.semester,
        section: updatedClass.section,
        facultyId: updatedClass.facultyId,
        assignedFaculty: updatedClass.faculty?.user?.name || 'Assigned',
        day: chosenDay,
        startTime: chosenStart,
        endTime: chosenEnd,
        room: chosenRoom,
        schedule: `${chosenDay} ${chosenStart}-${chosenEnd} (${chosenRoom})`,
        students: studentCount,
        type: type || 'theory'
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Was `prisma.courseClass.delete({ where: { id } })` with nothing recorded.
 * Now audited, with the row captured before it goes and a reason required.
 */
router.delete(
  '/workload/course/:id',
  authenticate,
  validate({
    params: z.object({ id: entityId }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await deleteTenantEntity(getTenantContext(req), {
      model: 'courseClass',
      entity: 'CourseClass',
      module: 'academics',
      id: String(req.params.id),
      reason: String(req.body.reason)
    });

    res.json({ success: true, data: result });
  })
);

router.get('/courseresults', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const courses = await prisma.course.findMany({
      where: { departmentId: department.id },
      include: { faculty: { include: { user: true } }, enrollments: true }
    });

    res.json({
      success: true,
      data: courses.map((course: any) => {
        const totalStudents = course.enrollments.length;
        const numericMarks = course.enrollments.map((enrollment: any) => Number(enrollment.grade)).filter((value: number) => Number.isFinite(value));
        const passed = totalStudents > 0
          ? course.enrollments.filter((enrollment: any) => {
              const value = Number(enrollment.grade);
              if (Number.isFinite(value)) return value >= 35;
              return enrollment.grade && !['F', 'I'].includes(String(enrollment.grade));
            }).length
          : 0;

        // `65` / `95` / a fixed 25%-35%-40% split were literals — see the
        // identical fabrication in GET /results above, fixed the same way:
        // null when there is nothing to average, a real tally instead of an
        // invented distribution.
        const avgScore = numericMarks.length > 0
          ? Math.round(numericMarks.reduce((sum: number, value: number) => sum + value, 0) / numericMarks.length)
          : null;
        const highestScore = numericMarks.length > 0 ? Math.max(...numericMarks) : null;

        return {
          courseCode: course.code,
          courseName: course.name,
          faculty: course.faculty?.user?.name || 'Unassigned',
          totalStudents,
          passed,
          failed: totalStudents - passed,
          passPercentage: totalStudents > 0 ? Math.round((passed / totalStudents) * 100) : 0,
          avgScore,
          highestScore,
          gradeDistribution: tallyGrades(course.enrollments)
        };
      })
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/courseresults/:courseCode/verify', authenticate, async (req: Request, res: Response) => {
  try {
    const courseCode = String(req.params.courseCode);
    const item = await prisma.approvalItem.create({
      data: {
        institutionId: getTenantContext(req).institutionId,
        type: 'result_verification',
        title: `Result verified: ${courseCode}`,
        details: 'Verified by HOD',
        requestedBy: (req as any).user.id,
        priority: 'high',
        status: 'approved'
      }
    });
    res.json({ success: true, data: item });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/courseresults/:courseCode/remedial', authenticate, validate({ body: remedialNoteSchema }), async (req: Request, res: Response) => {
  try {
    const courseCode = String(req.params.courseCode);
    const note = String(req.body?.note || 'Remedial class scheduled');
    const item = await prisma.approvalItem.create({
      data: {
        institutionId: getTenantContext(req).institutionId,
        type: 'remedial',
        title: `Remedial for ${courseCode}`,
        details: note,
        requestedBy: (req as any).user.id,
        priority: 'medium',
        status: 'approved'
      }
    });
    res.json({ success: true, data: item });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/courseresults/forward-coe', authenticate, async (req: Request, res: Response) => {
  try {
    const item = await prisma.approvalItem.create({
      data: {
        institutionId: getTenantContext(req).institutionId,
        type: 'forward_to_coe',
        title: 'Results forwarded to CoE',
        details: 'Department results forwarded for publication',
        requestedBy: (req as any).user.id,
        priority: 'high',
        status: 'approved'
      }
    });
    res.json({ success: true, data: item });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/accreditationdata', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error('Department unassigned');
    const data = await db.accreditationData.findMany({ where: { departmentId: department.id } });
    res.json({
      success: true,
      data: data.map((item: any) => ({
        id: item.id,
        criterion: item.criterion,
        metric: item.metric,
        value: item.value,
        year: item.year,
        status: item.status,
        lastUpdated: new Date(item.lastUpdated).toLocaleDateString('en-IN'),
        updatedBy: item.updatedBy
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/accreditationdata', authenticate, validate({ body: accreditationDataCreateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error('Department unassigned');
    const { criterion, metric, value, year } = req.body;
    const created = await db.accreditationData.create({
      data: {
        criterion,
        metric,
        value,
        year,
        status: 'pending',
        updatedBy: userId,
        departmentId: department.id
      }
    });
    res.json({ success: true, data: created });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/accreditationdata/:id', authenticate,
  validate({ params: z.object({ id: entityId }), body: accreditationDataUpdateSchema }),
  async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await db.accreditationData.update({
      where: { id },
      data: {
        ...req.body,
        updatedBy: (req as any).user.id,
        lastUpdated: new Date()
      }
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/labinventory', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error('Department unassigned');
    const items = await db.labInventoryItem.findMany({ where: { departmentId: department.id } });
    res.json({
      success: true,
      data: items.map((item: any) => ({
        ...item,
        lastMaintenance: item.lastMaintenance ? new Date(item.lastMaintenance).toLocaleDateString('en-IN') : 'N/A',
        purchaseDate: item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString('en-IN') : 'N/A',
        warrantyExpiry: item.warrantyExpiry ? new Date(item.warrantyExpiry).toLocaleDateString('en-IN') : ''
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/labinventory', authenticate, validate({ body: labInventoryCreateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const { name, lab, category, quantity, workingCondition, purchaseDate, warrantyExpiry, status } = req.body;
    if (!name || !lab || !category || !quantity) {
      res.status(400).json({ success: false, message: 'name, lab, category and quantity are required' });
      return;
    }

    const normalizedLab = String(lab).trim();
    const targetFacility = await prisma.facility.findFirst({
      where: {
        name: normalizedLab,
        type: { contains: 'lab', mode: 'insensitive' }
      }
    });

    if (!targetFacility) {
      res.status(400).json({ success: false, message: 'Please select a valid lab from Facility Management' });
      return;
    }

    const created = await db.labInventoryItem.create({
      data: {
        name: String(name),
        lab: normalizedLab,
        category: String(category),
        quantity: Number(quantity),
        workingCondition: workingCondition != null ? Number(workingCondition) : Number(quantity),
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
        status: status ? String(status) : 'working',
        departmentId: department.id
      }
    });

    res.json({ success: true, data: created });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/labinventory/:id', authenticate, validate({ params: z.object({ id: entityId }), body: labInventoryUpdateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const id = String(req.params.id);
    const existing = await db.labInventoryItem.findFirst({ where: { id, departmentId: department.id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Inventory item not found' });
      return;
    }

    const payload = req.body ?? {};

    if (payload.lab) {
      const nextLab = String(payload.lab).trim();
      const targetFacility = await prisma.facility.findFirst({
        where: {
          name: nextLab,
          type: { contains: 'lab', mode: 'insensitive' }
        }
      });

      const sameAsExisting = nextLab.toLowerCase() === String(existing.lab || '').trim().toLowerCase();
      if (!targetFacility && !sameAsExisting) {
        res.status(400).json({ success: false, message: 'Please select a valid lab from Facility Management' });
        return;
      }
    }

    const updated = await db.labInventoryItem.update({
      where: { id },
      data: {
        ...(payload.name ? { name: String(payload.name) } : {}),
        ...(payload.lab ? { lab: String(payload.lab).trim() } : {}),
        ...(payload.category ? { category: String(payload.category) } : {}),
        ...(payload.quantity != null ? { quantity: Number(payload.quantity) } : {}),
        ...(payload.workingCondition != null ? { workingCondition: Number(payload.workingCondition) } : {}),
        ...(payload.purchaseDate !== undefined ? { purchaseDate: payload.purchaseDate ? new Date(payload.purchaseDate) : null } : {}),
        ...(payload.warrantyExpiry !== undefined ? { warrantyExpiry: payload.warrantyExpiry ? new Date(payload.warrantyExpiry) : null } : {}),
        ...(payload.status ? { status: String(payload.status) } : {})
      }
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/labinventory/:id/maintenance', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await db.labInventoryItem.update({
      where: { id },
      data: { status: 'maintenance', lastMaintenance: new Date() }
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/purchaserequests', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error('Department unassigned');
    const requests = await db.purchaseRequest.findMany({ where: { departmentId: department.id }, orderBy: { requestDate: 'desc' } });
    res.json({
      success: true,
      data: requests.map((request: any) => ({
        ...request,
        requestDate: new Date(request.requestDate).toLocaleDateString('en-IN')
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Raise a purchase request (Phase 2.4 — engine-backed).
 *
 * Raising is the `started` transition. The Dean's sanction is the only decision,
 * and it now runs on the engine, so "who approved this spend" is answerable from
 * the transition log rather than inferred from whoever wrote `status` last.
 */
router.post('/purchaserequests', authenticate, validate({ body: purchaseRequestCreateSchema }), async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error('Department unassigned');
    const { itemName, lab, quantity, estimatedCost, justification } = req.body;

    const targetFacility = await prisma.facility.findFirst({
      where: { name: String(lab), type: { contains: 'lab', mode: 'insensitive' } }
    });

    if (!targetFacility) {
      res.status(400).json({ success: false, message: 'Please select a valid lab from Facility Management' });
      return;
    }

    const request = await db.purchaseRequest.create({
      data: { itemName, lab, requestedBy: userId, quantity, estimatedCost, justification, departmentId: department.id }
    });

    await ensureDefinition(ctx, PURCHASE_REQUEST);
    const instance = await workflow.startWorkflow(ctx, {
      code: PURCHASE_REQUEST.code,
      entityType: PURCHASE_REQUEST.entityType,
      entityId: request.id,
      context: { itemName, estimatedCost, department: department.name, raisedBy: userId }
    });

    res.status(201).json({
      success: true,
      data: { ...request, instanceId: instance.instanceId, waitingOn: instance.assigneeRole }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/purchaserequests/:id/status', authenticate, async (req: Request, res: Response) => {
  try {
    res.status(403).json({
      success: false,
      message: 'Purchase requests can only be approved or rejected by Dean'
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Course Management ───
router.get('/course-management/options', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const faculty = await prisma.facultyProfile.findMany({
      where: { user: { departmentId: department.id } },
      include: { user: true },
      orderBy: { user: { name: 'asc' } }
    });

    res.json({
      success: true,
      data: {
        department: { id: department.id, name: department.name, code: department.code },
        faculty: faculty.map((item: any) => ({ id: item.id, name: item.user?.name || 'Faculty', email: item.user?.email || '' }))
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/course-management', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const courses = await prisma.course.findMany({
      where: { departmentId: department.id },
      include: { enrollments: true },
      orderBy: [{ semester: 'asc' }, { code: 'asc' }]
    });

    res.json({
      success: true,
      data: courses.map((course: any) => ({
        id: course.id,
        code: course.code,
        name: course.name,
        credits: course.credits,
        semester: course.semester,
        students: course.enrollments.length,
        department: department.name,
        departmentId: department.id
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/course-management', authenticate, authorizeRoles('hod', 'dean'), validate({ body: hodCourseCreateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const { code, name, credits, semester } = req.body;
    if (!code || !name || !credits || !semester) {
      res.status(400).json({ success: false, message: 'code, name, credits and semester are required' });
      return;
    }

    const created = await prisma.course.create({
      data: {
        // Was absent: courses created here landed with a NULL tenant key and
        // were then invisible to every scoped query — created successfully,
        // then unreachable. Exposed by migration 0029.
        institutionId: getTenantContext(req).institutionId,
        code: String(code).toUpperCase(),
        name: String(name),
        credits: Number(credits),
        semester: Number(semester),
        departmentId: department.id,
        facultyId: null
      }
    });

    res.json({ success: true, data: created });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/course-management/:id', authenticate, authorizeRoles('hod', 'dean'), validate({ params: z.object({ id: entityId }), body: hodCourseUpdateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const id = String(req.params.id);
    const existing = await prisma.course.findFirst({ where: { id, departmentId: department.id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Course not found' });
      return;
    }

    const payload = req.body ?? {};
    const updated = await prisma.course.update({
      where: { id },
      data: {
        ...(payload.code ? { code: String(payload.code).toUpperCase() } : {}),
        ...(payload.name ? { name: String(payload.name) } : {}),
        ...(payload.credits != null ? { credits: Number(payload.credits) } : {}),
        ...(payload.semester != null ? { semester: Number(payload.semester) } : {}),
        facultyId: null
      }
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Was `prisma.course.delete({ where: { id } })` with nothing recorded.
 * Now audited, with the row captured before it goes and a reason required.
 */
router.delete(
  '/course-management/:id',
  authenticate,
  validate({
    params: z.object({ id: entityId }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await deleteTenantEntity(getTenantContext(req), {
      model: 'course',
      entity: 'Course',
      module: 'academics',
      id: String(req.params.id),
      blockers: [
        { model: 'enrollment', foreignKey: 'courseId', describe: 'enrolments' }
      ],
      reason: String(req.body.reason)
    });

    res.json({ success: true, data: result });
  })
);

router.get('/curriculum-proposals', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const proposals = await prisma.curriculumProposal.findMany({
      where: { departmentId: department.id },
      orderBy: { submittedAt: 'desc' }
    });

    const proposerIds = [...new Set(proposals.map((item: any) => item.proposedBy).filter(Boolean))];
    const users = proposerIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: proposerIds } } })
      : [];
    const userById = new Map(users.map((item: any) => [item.id, item.name || item.email || item.id]));

    res.json({
      success: true,
      data: proposals.map((item: any) => ({
        id: item.id,
        department: department.name,
        proposedBy: userById.get(item.proposedBy) || item.proposedBy,
        type: item.type,
        title: item.title,
        description: item.description,
        submittedAt: new Date(item.submittedAt).toLocaleDateString('en-IN'),
        bosApproved: Boolean(item.bosApproved),
        status: item.status
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Raise a curriculum proposal (Phase 2.4 — engine-backed).
 *
 * `bosApproved` is NO LONGER ACCEPTED from the request body. It was
 * `Boolean(req.body.bosApproved)` — the proposer asserting that the Board of
 * Studies had approved their own proposal, with nothing recording who on that
 * body decided anything. It is created `false`; an institution that wants a real
 * BoS stage defines one through POST /workflow/definitions, without code.
 */
router.post('/curriculum-proposals', authenticate, authorizeRoles('hod'), validate({ body: curriculumProposalCreateSchema }), async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const { type, title, description } = req.body ?? {};
    if (!type || !title || !description) {
      res.status(400).json({ success: false, message: 'type, title and description are required' });
      return;
    }

    const allowedTypes = ['new_course', 'syllabus_update', 'program_change', 'elective_addition'];
    if (!allowedTypes.includes(String(type))) {
      res.status(400).json({ success: false, message: 'Invalid proposal type' });
      return;
    }

    const created = await prisma.curriculumProposal.create({
      data: {
        departmentId: department.id,
        proposedBy: userId,
        type: String(type),
        title: String(title),
        description: String(description),
        bosApproved: false,
        status: 'pending_dean'
      }
    });

    await ensureDefinition(ctx, CURRICULUM_PROPOSAL);
    const instance = await workflow.startWorkflow(ctx, {
      code: CURRICULUM_PROPOSAL.code,
      entityType: CURRICULUM_PROPOSAL.entityType,
      entityId: created.id,
      context: { title: String(title), type: String(type), department: department.name }
    });

    res.status(201).json({
      success: true,
      data: { ...created, instanceId: instance.instanceId, waitingOn: instance.assigneeRole }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Facility Management ───
router.get('/facility-management', authenticate, async (_req: Request, res: Response) => {
  try {
    const facilities = await prisma.facility.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] });
    res.json({ success: true, data: facilities });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/facility-management', authenticate, authorizeRoles('hod', 'dean'), validate({ body: facilityCreateSchema }), async (req: Request, res: Response) => {
  try {
    const { name, type, capacity, status } = req.body;
    if (!name || !type || !capacity) {
      res.status(400).json({ success: false, message: 'name, type and capacity are required' });
      return;
    }

    const created = await prisma.facility.create({
      data: {
        name: String(name),
        type: String(type),
        capacity: Number(capacity),
        status: status ? String(status) : 'available'
      }
    });
    res.json({ success: true, data: created });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/facility-management/:id', authenticate, authorizeRoles('hod', 'dean'), validate({ params: z.object({ id: entityId }), body: facilityUpdateSchema }), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const payload = req.body ?? {};

    const updated = await prisma.facility.update({
      where: { id },
      data: {
        ...(payload.name ? { name: String(payload.name) } : {}),
        ...(payload.type ? { type: String(payload.type) } : {}),
        ...(payload.capacity != null ? { capacity: Number(payload.capacity) } : {}),
        ...(payload.status ? { status: String(payload.status) } : {})
      }
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Was `prisma.facility.delete({ where: { id } })` with nothing recorded.
 * Now audited, with the row captured before it goes and a reason required.
 */
router.delete(
  '/facility-management/:id',
  authenticate,
  validate({
    params: z.object({ id: entityId }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await deleteTenantEntity(getTenantContext(req), {
      model: 'facility',
      entity: 'Facility',
      module: 'academics',
      id: String(req.params.id),
      reason: String(req.body.reason)
    });

    res.json({ success: true, data: result });
  })
);

router.get('/communication/messages', authenticate, async (_req: Request, res: Response) => {
  try {
    const messages = await db.broadcastMessage.findMany({ orderBy: { sentAt: 'desc' }, take: 50 });

    const normalizeAudience = (raw: string) => {
      const value = String(raw || '').trim().toLowerCase();
      if (value === 'all' || value === 'students' || value === 'faculties') return value;
      if (value.startsWith('class:')) return value;
      if (value === 'everyone') return 'all';
      if (value === 'all_students' || value === 'department') return 'students';
      if (value === 'all_faculty') return 'faculties';
      return 'all';
    };

    res.json({
      success: true,
      data: messages.map((message: any) => ({
        id: message.id,
        subject: message.subject,
        message: message.content,
        sentAt: new Date(message.sentAt).toLocaleDateString('en-IN'),
        recipients: normalizeAudience(message.recipients),
        to: normalizeAudience(message.recipients),
        recipientCount: 0,
        readCount: 0,
        viaEmail: true,
        viaWhatsApp: false
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/communication/messages', authenticate, validate({ body: hodCommunicationCreateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const department = await getHODDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const { subject, message, recipients, to, viaEmail, viaWhatsApp } = req.body;

    const normalizeAudience = (raw: string) => {
      const value = String(raw || '').trim().toLowerCase();
      if (value === 'all' || value === 'students' || value === 'faculties') return value;
      if (value.startsWith('class:')) return value;
      if (value === 'everyone') return 'all';
      if (value === 'all_students' || value === 'department') return 'students';
      if (value === 'all_faculty') return 'faculties';
      return 'all';
    };

    const audience = normalizeAudience(String(to || recipients || 'all'));
    if (audience.startsWith('class:')) {
      const classId = audience.slice('class:'.length);
      const classExists = await prisma.courseClass.findFirst({
        where: { id: classId, course: { departmentId: department.id } }
      });
      if (!classExists) {
        res.status(400).json({ success: false, message: 'Invalid class target for this department' });
        return;
      }
    }

    const created = await db.broadcastMessage.create({
      data: {
        subject,
        content: message,
        sender: user?.name || 'HOD',
        recipients: audience,
        type: 'announcement'
      }
    });
    res.json({
      success: true,
      data: {
        id: created.id,
        subject: created.subject,
        message: created.content,
        sentAt: new Date(created.sentAt).toLocaleDateString('en-IN'),
        recipients: created.recipients,
        to: created.recipients,
        recipientCount: 0,
        readCount: 0,
        viaEmail: Boolean(viaEmail),
        viaWhatsApp: Boolean(viaWhatsApp)
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Was `prisma.broadcastMessage.delete({ where: { id } })` with nothing recorded.
 * Now audited, with the row captured before it goes and a reason required.
 */
router.delete(
  '/communication/messages/:id',
  authenticate,
  validate({
    params: z.object({ id: entityId }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await deleteTenantEntity(getTenantContext(req), {
      model: 'broadcastMessage',
      entity: 'BroadcastMessage',
      module: 'governance',
      id: String(req.params.id),
      reason: String(req.body.reason)
    });

    res.json({ success: true, data: result });
  })
);

router.get('/communication/recipient-options', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error('Department unassigned');
    const [facultyCount, studentCount, classes] = await Promise.all([
      prisma.user.count({ where: { departmentId: department.id, role: 'faculty' } }),
      prisma.user.count({ where: { departmentId: department.id, role: 'student' } }),
      prisma.courseClass.findMany({
        where: { course: { departmentId: department.id } },
        include: { course: true, students: true },
        orderBy: { course: { semester: 'asc' } }
      })
    ]);

    res.json({
      success: true,
      data: [
        { value: 'all', label: 'Everyone (Faculty + Students)', count: facultyCount + studentCount },
        { value: 'students', label: 'All Students', count: studentCount },
        { value: 'faculties', label: 'All Faculties', count: facultyCount },
        ...classes.map((item: any) => ({
          value: `class:${item.id}`,
          label: `${item.course.code} ${item.section} (${item.course.semester})`,
          count: item.students.length
        }))
      ]
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/grievances', authenticate, async (_req: Request, res: Response) => {
  try {
    const grievances = await prisma.grievanceCase.findMany({ orderBy: { submissionDate: 'desc' } });
    res.json({
      success: true,
      data: grievances.map((item: any) => ({
        id: item.id,
        type: item.category === 'disciplinary'
          ? 'disciplinary'
          : (item.complainantType === 'faculty' ? 'faculty_complaint' : 'student_complaint'),
        subject: item.subject,
        description: item.description,
        filedBy: item.complainantName || item.complainantId || 'Unknown',
        filedAt: new Date(item.submissionDate).toLocaleDateString('en-IN'),
        status: toRoleGrievanceStatus(item.status, 'hod'),
        priority: item.severity || 'medium',
        category: item.category,
        response: item.resolution || undefined,
        grievanceNumber: item.grievanceNumber
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/grievances/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');
    if (!id) {
      res.status(400).json({ success: false, message: 'Grievance id is required' });
      return;
    }

    const grievance = await prisma.grievanceCase.findUnique({ where: { id } });
    if (!grievance) {
      res.status(404).json({ success: false, message: 'Grievance case not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        ...grievance,
        status: toRoleGrievanceStatus(grievance.status, 'hod')
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/grievances/:id', authenticate, validate({ params: z.object({ id: entityId }), body: hodGrievanceDecisionSchema }), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const status = String(req.body?.status || 'under_review');
    const response = req.body?.response ? String(req.body.response) : null;
    const userId = (req as any).user?.id || 'system';

    const normalizedStatus = fromRoleGrievanceStatus(status, 'hod');

    const existing = await prisma.grievanceCase.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Grievance case not found' });
      return;
    }

    const timeline = Array.isArray(existing.timeline) ? [...existing.timeline as any[]] : [];
    timeline.push({
      date: new Date().toISOString(),
      action: 'HOD Update',
      by: userId,
      notes: response || `Status changed to ${normalizedStatus}`
    });

    const updated = await prisma.grievanceCase.update({
      where: { id },
      data: {
        status: normalizedStatus,
        lastUpdated: new Date(),
        timeline,
        ...(response ? { resolution: response } : {}),
        ...(normalizedStatus === 'resolved' ? { actualResolutionDate: new Date() } : {})
      }
    });

    res.json({
      success: true,
      data: {
        id: updated.id,
        status: toRoleGrievanceStatus(updated.status, 'hod'),
        response: updated.resolution,
        resolvedAt: updated.actualResolutionDate
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/students/export', authenticate, validate({ body: studentsExportSchema }), async (req: Request, res: Response) => {
  try {
    const format = String(req.body?.format || 'csv');
    res.json({ success: true, data: { format, exportedAt: new Date().toISOString() } });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/students/merit-list', authenticate, validate({ body: meritListSchema }), async (req: Request, res: Response) => {
  try {
    const limit = Number(req.body?.limit || 5);
    const userId = (req as any).user.id;
    const department = await getHODDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const students = await prisma.user.findMany({
      where: { departmentId: department.id, role: 'student' },
      include: { studentProfile: true }
    });

    const ranked = students
      .map((student: any) => ({
        id: student.studentProfile?.id || student.id,
        name: student.name,
        rollNumber: student.studentProfile?.rollNumber || '',
        cgpa: Number(student.studentProfile?.cgpa || 0)
      }))
      .sort((a, b) => b.cgpa - a.cgpa)
      .slice(0, limit);

    res.json({ success: true, data: ranked });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/students/:id/email', authenticate, validate({ params: z.object({ id: entityId }), body: studentEmailSchema }), async (req: Request, res: Response) => {
  try {
    const studentId = String(req.params.id);
    const subject = String(req.body?.subject || 'Department Communication');
    const message = String(req.body?.message || 'Please check your department portal for updates.');

    const entry = await prisma.approvalItem.create({
      data: {
        institutionId: getTenantContext(req).institutionId,
        type: 'student_communication',
        title: `Email sent to student ${studentId}`,
        details: `${subject}: ${message}`,
        requestedBy: (req as any).user.id,
        priority: 'low',
        status: 'approved'
      }
    });

    res.json({ success: true, data: entry });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/students/:id/report-card', authenticate, async (req: Request, res: Response) => {
  try {
    const studentId = String(req.params.id);
    res.json({ success: true, data: { studentId, generatedAt: new Date().toISOString() } });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/workload/check-conflicts', authenticate, async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: { conflicts: [] } });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/timetable/export', authenticate, async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: { exportedAt: new Date().toISOString(), format: 'pdf' } });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/accreditation/export-ssr', authenticate, async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: { exportedAt: new Date().toISOString(), type: 'ssr' } });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/accreditation/upload-document', authenticate, validate({ body: accreditationDocumentUploadSchema }), async (req: Request, res: Response) => {
  try {
    const name = String(req.body?.name || 'document');
    res.json({ success: true, data: { name, uploadedAt: new Date().toISOString() } });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/inventory/export', authenticate, async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: { exportedAt: new Date().toISOString() } });
  } catch (error: any) {
    sendError(res, error);
  }
});

export default router;
