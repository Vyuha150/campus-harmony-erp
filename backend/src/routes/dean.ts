import type { Request, Response } from 'express';
import { budgetsByDepartment } from '../lib/departmentBudgets.js';
import { publishedOutcomes, outcomeFor, combineOutcomes, passPercentage } from '../lib/courseOutcomes.js';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { sendError, NotFoundError } from '../lib/errors.js';
import { getTenantContext } from '../lib/tenant.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as workflow from '../modules/workflow/workflow.service.js';
import { openInstanceFor, projectOntoQueue, ensureDefinition } from '../modules/workflow/bridge.js';
import { RESULT_PUBLICATION, PURCHASE_REQUEST, CURRICULUM_PROPOSAL } from '../modules/workflow/builtins.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { entityId } from '../schemas/common.js';
import { deleteTenantEntity } from '../modules/common/entityDelete.service.js';
import {
  deanWorkflowDecisionSchema,
  resultApprovalSchema,
  disciplinaryDecisionSchema,
  classManagementCreateSchema,
  classManagementUpdateSchema,
  eventCreateSchema,
  eventUpdateSchema,
  meetingCreateSchema,
  meetingUpdateSchema,
  mentoringAssignmentCreateSchema,
  deanCourseCreateSchema,
  deanCourseUpdateSchema,
  deanFacilityCreateSchema,
  deanFacilityUpdateSchema,
  academicYearCreateSchema,
  academicYearUpdateSchema
} from '../modules/dean/dean.schemas.js';

const router = Router();

/** Writes on the Dean's screens: the Dean, or the Principal who uses the same screens. */
const DEAN_WRITE = authorizeRoles('dean', 'principal', 'super_admin');

/**
 * The Dean oversees every department. List screens were limited to the Dean's
 * own department (CSE), so the other five were invisible. `?departmentId=`
 * narrows to one; omitted or "all" means the whole institution.
 */
async function departmentFilter(req: Request): Promise<{ departmentId?: string }> {
  const raw = String(req.query.departmentId ?? '').trim();
  if (!raw || raw === 'all') return {};
  const ctx = getTenantContext(req);
  const department = await prisma.department.findFirst({ where: { id: raw, institutionId: ctx.institutionId } });
  if (!department) throw new NotFoundError('Department');
  return { departmentId: department.id };
}

/** A department of this institution named in a request body, or the caller's own. */
async function targetDepartment(req: Request, departmentId?: string) {
  if (departmentId) {
    const ctx = getTenantContext(req);
    const department = await prisma.department.findFirst({ where: { id: departmentId, institutionId: ctx.institutionId } });
    if (!department) throw new NotFoundError('Department');
    return department;
  }
  return getDeanDepartment((req as any).user.id);
}

const shortDay = (d: string) => d.slice(0, 3);
/** "Mon 09:00, Wed 10:00 · 5/week" from a course's weekly slots. */
function scheduleText(schedules: Array<{ day: string; startTime: string; room: string }>): string {
  if (!schedules.length) return 'Not on the timetable';
  const order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const sorted = [...schedules].sort((a, b) => order.indexOf(a.day) - order.indexOf(b.day) || a.startTime.localeCompare(b.startTime));
  return `${sorted.slice(0, 3).map((x) => `${shortDay(x.day)} ${x.startTime}`).join(', ')}${sorted.length > 3 ? ' …' : ''} · ${sorted.length}/week`;
}

/**
 * Resolve the dean's department.
 *
 * HISTORY — this previously auto-created a "Computer Science & Engg" department
 * when the user had none, and silently assigned the user to it. That is the
 * same fabrication pattern removed from students.ts and faculty.ts: inventing
 * institutional structure on a read path. It also looked up `{ code: 'CSE' }`
 * globally, which under multi-tenancy could have returned ANOTHER
 * INSTITUTION'S department and assigned the user to it — a cross-tenant write.
 *
 * It now reads only and fails clearly when no department is assigned.
 *
 * @throws {NotFoundError} when the user has no department assignment.
 */
async function getDeanDepartment(userId: string) {
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

// ─── Dashboard ───
router.get('/dashboard', authenticate, async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    const totalStudents = await prisma.user.count({ where: { role: 'student' } });
    const totalFaculty = await prisma.user.count({ where: { role: 'faculty' } });
    // What is actually waiting on the Dean (leave, waivers, timetable changes,
    // curriculum, purchases …). Was a count of the legacy approval queue across
    // every type and department.
    const pendingApprovals = (await workflow.inbox(ctx, { page: 1, pageSize: 1 })).meta.total;
    const departments = await prisma.department.findMany({ include: { users: true, courses: true } });
    const academicYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
    const published = await publishedOutcomes(departments.flatMap((d: any) => d.courses.map((c: any) => c.id)));

    res.json({
      success: true,
      data: {
        stats: [
          { label: "Total Students", value: totalStudents.toString(), icon: "Users" },
          { label: "Total Faculty", value: totalFaculty.toString(), icon: "GraduationCap" },
          { label: "Pending Approvals", value: pendingApprovals.toString(), icon: "FileText", color: "text-warning" },
          { label: "Departments", value: departments.length.toString(), icon: "Building2", color: "text-success" }
        ],
        academicYear: academicYear?.year ?? null,
        pendingApprovals,
        departments: departments.map((d: any) => ({
          id: d.id, name: d.name,
          totalFaculty: d.users.filter((u: any) => u.role === 'faculty').length,
          totalStudents: d.users.filter((u: any) => u.role === 'student').length,
          totalCourses: d.courses.length,
          // Latest published results; null when nothing is graded yet.
          passPercentage: combineOutcomes(d.courses.map((c: any) => outcomeFor(c, published))).passPercentage
        }))
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Academics ───
router.get('/academics', authenticate, async (req: Request, res: Response) => {
  try {
    const departments = await prisma.department.findMany({
      include: { courses: { include: { enrollments: true } }, users: true }
    });
    res.json({
      success: true,
      data: departments.map((d: any) => ({
        id: d.id, name: d.name,
        totalFaculty: d.users.filter((u: any) => u.role === 'faculty').length,
        totalStudents: d.users.filter((u: any) => u.role === 'student').length,
        courses: d.courses.length
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Curriculum Proposals ───
router.get('/curriculum-proposals', authenticate, async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    // CurriculumProposal carries no institutionId of its own — reach it
    // through the (tenant-owned, auto-scoped) Department relation instead.
    const proposals = await prisma.curriculumProposal.findMany({
      where: { department: { institutionId: context.institutionId } },
      include: { department: { select: { name: true } } },
      orderBy: { submittedAt: 'desc' }
    });
    // The screen showed a department badge from a field that did not exist.
    res.json({ success: true, data: proposals.map((p: any) => ({ ...p, department: undefined, departmentName: p.department?.name ?? null })) });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Decide a curriculum proposal (Phase 2.4 — engine-backed).
 *
 * Was `update({ where: { id }, data: { status } })` with `status` straight from
 * the body and no validation at all — any string, including one that skipped the
 * process entirely.
 */
router.put('/curriculum-proposals/:id', authenticate, DEAN_WRITE, validate({ params: z.object({ id: entityId }), body: deanWorkflowDecisionSchema }), asyncHandler(async (req: Request, res: Response) => {
  const ctx = getTenantContext(req);
  const id = String(req.params.id);
  const decision = String(req.body?.status || '').toLowerCase();

  if (!['approved', 'rejected'].includes(decision)) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'status must be approved or rejected.' }
    });
    return;
  }

  let instance = await openInstanceFor(ctx, CURRICULUM_PROPOSAL.entityType, id);
  if (!instance) {
    // A proposal recorded before approvals went through the engine (seeded or
    // imported) is still pending with no instance; start its approval now.
    const legacy = await prisma.curriculumProposal.findFirst({ where: { id, status: 'pending_dean' }, include: { department: true } });
    if (legacy) {
      await ensureDefinition(ctx, CURRICULUM_PROPOSAL);
      await workflow.startWorkflow(ctx, {
        code: CURRICULUM_PROPOSAL.code,
        entityType: CURRICULUM_PROPOSAL.entityType,
        entityId: legacy.id,
        context: { title: legacy.title, type: legacy.type, department: legacy.department?.name ?? '' }
      });
      instance = await openInstanceFor(ctx, CURRICULUM_PROPOSAL.entityType, id);
    }
  }
  if (!instance) {
    res.status(409).json({
      success: false,
      error: {
        code: 'BUSINESS_RULE_VIOLATION',
        message: 'No curriculum proposal is awaiting a decision with that id. It may already have been decided.'
      }
    });
    return;
  }

  const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 500) : undefined;
  const result = await workflow.act(ctx, instance.id, decision === 'approved' ? 'approved' : 'rejected', note);

  // The proposal leaves the Dean's queue either way; record the outcome.
  await prisma.curriculumProposal.updateMany({
    where: { id },
    data: { status: decision === 'approved' ? 'approved' : 'rejected' }
  });
  const updated = await prisma.curriculumProposal.findFirst({ where: { id } });

  res.json({ success: true, data: { ...updated, workflowStatus: result.status, instanceId: instance.id } });
}));

// ─── Faculty & HR ───
router.get('/faculty', authenticate, async (req: Request, res: Response) => {
  try {
    const faculty = await prisma.user.findMany({
      where: { role: 'faculty' },
      include: { department: true, facultyProfile: true }
    });
    res.json({
      success: true,
      data: faculty.map((f: any) => ({
        id: f.id, name: f.name, email: f.email, department: f.department?.name,
        designation: f.designation, qualification: f.facultyProfile?.qualification,
        specialization: f.facultyProfile?.specialization, experience: f.facultyProfile?.experience
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/recruitment', authenticate, async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    // FacultyRecruitment carries no institutionId of its own — reach it
    // through the (tenant-owned, auto-scoped) Department relation instead.
    const rec = await prisma.facultyRecruitment.findMany({
      where: { department: { institutionId: context.institutionId } },
      include: { department: true }
    });
    res.json({ success: true, data: rec });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Student Affairs ───
router.get('/student-affairs', authenticate, async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    // DisciplinaryCase carries no institutionId of its own — reach it
    // through the (tenant-owned, auto-scoped) Department relation instead.
    const cases = await prisma.disciplinaryCase.findMany({
      where: { department: { institutionId: context.institutionId } },
      orderBy: { reportedAt: 'desc' }
    });
    // Was a count of PAID fees of type "other" — nothing to do with scholarships.
    const waivers = await prisma.feeWaiverRequest.findMany({ where: { status: { in: ['approved', 'pending'] } }, select: { status: true, sanctionedAmount: true } });
    const sanctioned = waivers.filter((w: any) => w.status === 'approved');
    res.json({
      success: true,
      data: {
        disciplinaryCases: cases,
        scholarshipCount: sanctioned.length,
        scholarshipAmount: sanctioned.reduce((sum: number, w: any) => sum + (w.sanctionedAmount ?? 0), 0),
        scholarshipPending: waivers.length - sanctioned.length
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/disciplinary/:id', authenticate, DEAN_WRITE, validate({ params: z.object({ id: entityId }), body: disciplinaryDecisionSchema }), async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    const id = String(req.params.id);
    const { status, severity, actionTaken, remarks } = req.body;
    // `update({ where: { id } })` cannot carry the institution check — the
    // tenant extension constrains a `where` clause but not a unique-key
    // update — so `updateMany` + a department-derived institutionId filter,
    // then re-read, is the pattern this codebase uses everywhere a model has
    // no institutionId column of its own (see curriculumProposal above).
    const changed = await prisma.disciplinaryCase.updateMany({
      where: { id, department: { institutionId: context.institutionId } },
      data: {
        ...(status ? { status } : {}),
        ...(severity ? { severity } : {}),
        ...(actionTaken ? { actionTaken, decidedBy: context.userId, decidedAt: new Date() } : {}),
        ...(remarks !== undefined ? { decisionRemarks: remarks || null } : {})
      }
    });
    if (changed.count === 0) {
      res.status(404).json({ success: false, message: 'Disciplinary case not found' });
      return;
    }
    const updated = await prisma.disciplinaryCase.findFirst({ where: { id } });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Results ───
router.get('/results', authenticate, async (req: Request, res: Response) => {
  try {
    const [departments, approvals] = await Promise.all([
      prisma.department.findMany({
        include: {
          courses: { include: { enrollments: true } },
          users: { where: { role: 'student' }, select: { id: true } }
        }
      }),
      prisma.approvalItem.findMany({ where: { type: 'result_publication' } })
    ]);
    const published = await publishedOutcomes(departments.flatMap((d: any) => d.courses.map((c: any) => c.id)));

    const approvalByDepartmentId = new Map<string, any>();
    for (const approval of approvals) {
      if (approval.details) {
        approvalByDepartmentId.set(String(approval.details), approval);
      }
    }

    res.json({
      success: true,
      data: departments.map((d: any) => {
        // Published results where they exist, legacy grades otherwise — the same
        // source as the HOD and CoE screens (lib/courseOutcomes.ts), so the three
        // agree. Nobody assessed yet is `null`, never "0% pass".
        const outcome = combineOutcomes(d.courses.map((c: any) => outcomeFor(c, published)));

        const approval = approvalByDepartmentId.get(String(d.id));
        let status = 'draft';
        if (approval?.status === 'pending') status = 'pending_approval';
        if (approval?.status === 'published' || approval?.status === 'approved') status = 'published';

        return {
          departmentId: d.id,
          department: d.name,
          // Students in the department — not course enrolments, which count
          // each student once per subject.
          totalStudents: d.users.length,
          resultsRecorded: outcome.assessed,
          passed: outcome.passed,
          failed: outcome.failed,
          passPercentage: outcome.passPercentage,
          // REMOVED: `avgGPA: 7.2`, a literal presented as this department's
          // average. It never varied by department, semester or cohort. The
          // figure belongs to SemesterResult and is computed there; asserting it
          // here put an invented academic statistic on an oversight screen.
          avgGPA: null,
          status
        };
      })
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Publish a department's results (Phase 2.4 — engine-backed).
 *
 * THE DEFECT THIS CLOSES. The previous handler never checked that a submission
 * existed. When it found no approval row it CREATED one already marked
 * `published`, so the dean could publish results the CoE had never submitted,
 * and afterwards the record showed an approval with no request behind it. There
 * was also nothing preventing a second publication of the same results.
 *
 * Both follow from keeping a process in a status column: a column can record
 * where something is, but cannot express "this may only happen after that".
 * The engine can, because the instance must exist and must be waiting at the
 * dean's step before `act` will record anything.
 *
 * The HTTP contract is unchanged apart from the added failure case — publishing
 * with nothing submitted is now a refusal rather than a fabricated record.
 */
router.put('/results/:id/approve', authenticate, DEAN_WRITE, validate({ body: resultApprovalSchema }), async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    const identifier = decodeURIComponent(String(req.params.id));

    const department = await prisma.department.findFirst({
      where: { OR: [{ id: identifier }, { name: identifier }] }
    });

    if (!department) {
      res.status(404).json({ success: false, message: 'Department not found' });
      return;
    }

    const instance = await openInstanceFor(ctx, RESULT_PUBLICATION.entityType, String(department.id));

    if (!instance) {
      res.status(409).json({
        success: false,
        error: {
          code: 'BUSINESS_RULE_VIOLATION',
          message:
            `No result publication is awaiting approval for ${department.name}. ` +
            'The Controller of Examinations must submit the results before they can be published.'
        }
      });
      return;
    }

    // Records the transition and completes the instance. Throws if the caller is
    // not the dean, or if the instance has already been decided.
    const result = await workflow.act(
      ctx,
      instance.id,
      'approved',
      typeof req.body?.note === 'string' ? req.body.note.slice(0, 500) : undefined
    );

    // Mirror onto the queue row so existing screens keep working. `published`
    // rather than `approved`: that is the vocabulary this flow already used, and
    // migration 0023 widened the CHECK constraint to permit it.
    const projection = await prisma.approvalItem.findFirst({
      where: { workflowInstanceId: instance.id },
      select: { id: true }
    });

    if (projection) {
      await projectOntoQueue({
        approvalId: projection.id,
        instanceId: instance.id,
        status: 'published',
        decidedBy: ctx.userId,
        decisionNote: typeof req.body?.note === 'string' ? req.body.note.slice(0, 500) : null
      });
    }

    res.json({
      success: true,
      data: {
        approvalId: projection?.id ?? null,
        instanceId: instance.id,
        departmentId: department.id,
        department: department.name,
        status: 'published',
        workflowStatus: result.status
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Finance ───
router.get('/finance', authenticate, async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    // Finance's budget lines, summed per department (lib/departmentBudgets.ts).
    const budgets = await budgetsByDepartment(context.institutionId);
    res.json({
      success: true,
      data: budgets.map((b) => ({
        department: b.department, allocated: b.allocated, spent: b.spent, remaining: b.remaining,
        categories: b.categories.map((c) => ({ name: c.name, amount: c.allocated, spent: c.spent }))
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Accreditation ───
router.get('/accreditation', authenticate, async (req: Request, res: Response) => {
  try {
    const metrics = await prisma.qualityMetric.findMany();
    // Stored values are what IQAC last entered. The ratio can be computed, so
    // it is — the stored "2.6:1" disagreed with the institution's own counts.
    const [students, faculty] = await Promise.all([
      prisma.user.count({ where: { role: 'student' } }),
      prisma.user.count({ where: { role: { in: ['faculty', 'hod'] } } })
    ]);
    const ratio = faculty > 0 ? `${(students / faculty).toFixed(1)}:1` : null;
    res.json({
      success: true,
      data: metrics.map((m: any) => (/student.?teacher ratio/i.test(m.metric) && ratio
        ? { ...m, currentValue: ratio, status: students / faculty <= 20 ? 'on_track' : 'at_risk', computed: true }
        : m))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Coordination ───
router.get('/events', authenticate, async (req: Request, res: Response) => {
  try {
    const events = await prisma.interDeptEvent.findMany({ orderBy: { date: 'desc' } });
    res.json({ success: true, data: events });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Dean Class Management ───
router.get('/class-management/options', authenticate, async (req: Request, res: Response) => {
  try {
    const filter = await departmentFilter(req);
    const [departments, courses, faculty] = await Promise.all([
      prisma.department.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, code: true } }),
      prisma.course.findMany({ where: filter, orderBy: [{ semester: 'asc' }, { code: 'asc' }] }),
      prisma.facultyProfile.findMany({ where: filter.departmentId ? { user: { departmentId: filter.departmentId } } : {}, include: { user: true } })
    ]);
    res.json({
      success: true,
      data: {
        departments,
        courses: courses.map((course: any) => ({ id: course.id, code: course.code, name: course.name, semester: course.semester, credits: course.credits, departmentId: course.departmentId })),
        faculty: faculty.map((item: any) => ({ id: item.id, name: item.user?.name || 'Faculty', email: item.user?.email || '', departmentId: item.user?.departmentId ?? null }))
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

function classRow(item: any) {
  return {
    id: item.id,
    courseId: item.courseId,
    courseCode: item.course.code,
    courseName: item.course.name,
    credits: item.course.credits,
    semester: item.course.semester,
    departmentId: item.course.departmentId,
    department: item.course.department?.name ?? null,
    section: item.section,
    facultyId: item.facultyId,
    assignedFaculty: item.faculty?.user?.name || 'Unassigned',
    students: item.students.length,
    studentEmails: item.students
      .map((enrollment: any) => enrollment.student?.user?.email)
      .filter((email: string | undefined): email is string => Boolean(email)),
    // From the real timetable (CourseSchedule) — the one students and faculty see.
    schedule: scheduleText(item.course.schedules ?? [])
  };
}

const classInclude = {
  course: { include: { schedules: true, department: true } },
  faculty: { include: { user: true } },
  students: { include: { student: { include: { user: true } } } }
} as const;

router.get('/class-management', authenticate, async (req: Request, res: Response) => {
  try {
    const filter = await departmentFilter(req);
    const classes = await prisma.courseClass.findMany({
      where: { course: filter },
      include: classInclude,
      orderBy: { course: { semester: 'asc' } }
    });
    res.json({ success: true, data: classes.map(classRow) });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Create a class (a section of a course with its teacher and students).
 *
 * Its timetable is set in Workload & Timetable (HOD raises, Dean approves).
 * This handler used to write the HOD grid's copy of the timetable directly, so
 * the students' and teachers' timetables never saw it and no clash check ran.
 */
router.post('/class-management', authenticate, DEAN_WRITE, validate({ body: classManagementCreateSchema }), async (req: Request, res: Response) => {
  try {
    const { courseId, semester, facultyId, section, studentEmails } = req.body;
    const course = await prisma.course.findFirst({ where: { id: String(courseId) } });
    if (!course) {
      res.status(404).json({ success: false, message: 'Course not found' });
      return;
    }
    const semesterNum = Number(semester);
    if (Number.isFinite(semesterNum) && semesterNum !== course.semester) {
      res.status(400).json({ success: false, message: 'Selected semester does not match the course semester' });
      return;
    }
    const faculty = await prisma.facultyProfile.findFirst({ where: { id: String(facultyId) }, include: { user: true } });
    if (!faculty || faculty.user?.departmentId !== course.departmentId) {
      res.status(400).json({ success: false, message: 'The teacher must belong to the department that offers the course' });
      return;
    }
    const sectionCode = String(section).toUpperCase();
    const duplicate = await prisma.courseClass.findFirst({ where: { courseId: course.id, section: sectionCode } });
    if (duplicate) {
      res.status(409).json({ success: false, message: `${course.code} already has a section ${sectionCode}` });
      return;
    }

    const createdClass = await prisma.courseClass.create({
      data: { courseId: course.id, facultyId: faculty.id, section: sectionCode, name: `${course.code}-${sectionCode}` }
    });
    // A course with no teacher takes this one, so attendance has an owner.
    if (!course.facultyId) await prisma.course.updateMany({ where: { id: course.id }, data: { facultyId: faculty.id } });

    const emails = String(studentEmails || '').split(/[\n,;]/).map((entry) => entry.trim().toLowerCase()).filter(Boolean);
    const studentProfileIds = await resolveStudentProfileIdsByEmails(course.departmentId, emails);
    if (studentProfileIds.length > 0) {
      await prisma.classEnrollment.createMany({ data: studentProfileIds.map((studentProfileId: string) => ({ classId: createdClass.id, studentProfileId })) });
    }
    const created = await prisma.courseClass.findFirst({ where: { id: createdClass.id }, include: classInclude });
    res.json({ success: true, data: classRow(created), ...(emails.length !== studentProfileIds.length ? { warning: `${emails.length - studentProfileIds.length} email(s) did not match a student of this department` } : {}) });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/class-management/:id', authenticate, DEAN_WRITE, validate({ params: z.object({ id: entityId }), body: classManagementUpdateSchema }), async (req: Request, res: Response) => {
  try {
    const classId = String(req.params.id);
    const existing = await prisma.courseClass.findFirst({ where: { id: classId }, include: { course: true } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Class not found' });
      return;
    }
    const { courseCode, courseName, credits, semester, facultyId, section, studentEmails } = req.body;

    if (facultyId) {
      const faculty = await prisma.facultyProfile.findFirst({ where: { id: String(facultyId) }, include: { user: true } });
      if (!faculty || faculty.user?.departmentId !== existing.course.departmentId) {
        res.status(400).json({ success: false, message: 'The teacher must belong to the department that offers the course' });
        return;
      }
    }
    await prisma.course.updateMany({
      where: { id: existing.courseId },
      data: {
        ...(courseCode ? { code: String(courseCode).toUpperCase() } : {}),
        ...(courseName ? { name: String(courseName) } : {}),
        ...(credits != null ? { credits: Number(credits) } : {}),
        ...(semester != null ? { semester: Number(semester) } : {})
      }
    });
    await prisma.courseClass.updateMany({
      where: { id: classId },
      data: {
        ...(facultyId ? { facultyId: String(facultyId) } : {}),
        ...(section ? { section: String(section).toUpperCase(), name: `${courseCode || existing.course.code}-${String(section).toUpperCase()}` } : {})
      }
    });
    if (studentEmails !== undefined) {
      const emails = String(studentEmails || '').split(/[\n,;]/).map((entry) => entry.trim().toLowerCase()).filter(Boolean);
      const studentProfileIds = await resolveStudentProfileIdsByEmails(existing.course.departmentId, emails);
      await prisma.classEnrollment.deleteMany({ where: { classId } });
      if (studentProfileIds.length > 0) {
        await prisma.classEnrollment.createMany({ data: studentProfileIds.map((studentProfileId: string) => ({ classId, studentProfileId })) });
      }
    }
    const updated = await prisma.courseClass.findFirst({ where: { id: classId }, include: classInclude });
    res.json({ success: true, data: classRow(updated) });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Was `prisma.courseClass.delete({ where: { id } })` with nothing recorded.
 * Now audited, with the row captured before it goes and a reason required.
 */
router.delete(
  '/class-management/:id',
  authenticate,
  DEAN_WRITE,
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
      reason: String(req.body.reason),
      // CourseClass has no institutionId of its own — Prisma throws "Unknown
      // argument institutionId" without this (found live, see
      // entityDelete.service.ts). Course is tenant-owned, so this reaches it.
      scopeWhere: (institutionId) => ({ course: { institutionId } })
    });

    res.json({ success: true, data: result });
  })
);

router.post('/events', authenticate, DEAN_WRITE, validate({ body: eventCreateSchema }), async (req: Request, res: Response) => {
  try {
    const { title, type, date, departments, coordinator, budget } = req.body;
    // institutionId is required on the model since 0038 but injected by the
    // tenant extension at runtime, not supplied here — `as any` because tsc
    // checks a named object literal's keys even though every value is `any`.
    const event = await prisma.interDeptEvent.create({
      data: { title, type, date: new Date(date), departments, coordinator, budget: budget || 0 } as any
    });
    res.json({ success: true, data: event });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/events/:id', authenticate, DEAN_WRITE, validate({ params: z.object({ id: entityId }), body: eventUpdateSchema }), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updateData: any = {};
    const { title, type, date, departments, coordinator, budget, participants, status } = req.body;

    if (title !== undefined) updateData.title = String(title);
    if (type !== undefined) updateData.type = String(type);
    if (date !== undefined) updateData.date = new Date(date);
    if (departments !== undefined) updateData.departments = departments;
    if (coordinator !== undefined) updateData.coordinator = String(coordinator);
    if (budget !== undefined) updateData.budget = Number(budget) || 0;
    if (participants !== undefined) updateData.participants = Number(participants) || 0;
    if (status !== undefined) updateData.status = String(status);

    const changed = await prisma.interDeptEvent.updateMany({ where: { id }, data: updateData });
    if (changed.count === 0) {
      res.status(404).json({ success: false, message: 'Event not found' });
      return;
    }
    res.json({ success: true, data: await prisma.interDeptEvent.findFirst({ where: { id } }) });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/meetings', authenticate, async (req: Request, res: Response) => {
  try {
    const meetings = await prisma.meeting.findMany({ orderBy: { date: 'desc' }, take: 20 });
    res.json({ success: true, data: meetings });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/meetings', authenticate, DEAN_WRITE, validate({ body: meetingCreateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { title, meetingType, date, time, venue, status, agendaItems, attendees, minutes } = req.body;

    if (!title || !meetingType || !date || !time || !venue) {
      res.status(400).json({ success: false, message: 'title, meetingType, date, time and venue are required' });
      return;
    }

    const meeting = await prisma.meeting.create({
      data: {
        institutionId: getTenantContext(req).institutionId,
        title: String(title),
        meetingType: String(meetingType),
        date: new Date(date),
        time: String(time),
        venue: String(venue),
        status: String(status || 'upcoming'),
        agendaItems: agendaItems || null,
        attendees: attendees || null,
        minutes: minutes ? String(minutes) : null,
        createdBy: String(userId)
      }
    });

    res.json({ success: true, data: meeting });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/meetings/:id', authenticate, DEAN_WRITE, validate({ params: z.object({ id: entityId }), body: meetingUpdateSchema }), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { title, meetingType, date, time, venue, status, agendaItems, attendees, minutes } = req.body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = String(title);
    if (meetingType !== undefined) updateData.meetingType = String(meetingType);
    if (date !== undefined) updateData.date = new Date(date);
    if (time !== undefined) updateData.time = String(time);
    if (venue !== undefined) updateData.venue = String(venue);
    if (status !== undefined) updateData.status = String(status);
    if (agendaItems !== undefined) updateData.agendaItems = agendaItems;
    if (attendees !== undefined) updateData.attendees = attendees;
    if (minutes !== undefined) updateData.minutes = minutes ? String(minutes) : null;

    const changed = await prisma.meeting.updateMany({ where: { id }, data: updateData });
    if (changed.count === 0) {
      res.status(404).json({ success: false, message: 'Meeting not found' });
      return;
    }
    res.json({ success: true, data: await prisma.meeting.findFirst({ where: { id } }) });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Mentoring Assignment Management ───
router.get('/mentoring/options', authenticate, async (_req: Request, res: Response) => {
  try {
    const [faculty, students] = await Promise.all([
      prisma.facultyProfile.findMany({ include: { user: { include: { department: true } } } }),
      prisma.studentProfile.findMany({ include: { user: { include: { department: true } } } })
    ]);
    // MenteeAssignment carries no institutionId of its own. faculty/students
    // above are already scoped (FacultyProfile/StudentProfile are
    // tenant-owned), so filtering assignments to studentIds drawn from that
    // list keeps this consistent without a second manual institutionId path —
    // an assignment can only exist for a real student, who belongs to exactly
    // one institution.
    const assignments = await prisma.menteeAssignment.findMany({
      where: { studentId: { in: students.map((s: any) => s.id) } }
    });

    const facultyById = new Map(faculty.map((item: any) => [item.id, item]));
    const studentsById = new Map(students.map((item: any) => [item.id, item]));

    res.json({
      success: true,
      data: {
        faculty: faculty.map((item: any) => ({
          id: item.id,
          userId: item.userId,
          name: item.user?.name || 'Faculty',
          email: item.user?.email || '',
          employeeId: item.employeeId,
          department: item.user?.department?.name || null
        })),
        students: students.map((item: any) => ({
          id: item.id,
          userId: item.userId,
          name: item.user?.name || 'Student',
          email: item.user?.email || '',
          rollNumber: item.rollNumber,
          program: item.program,
          semester: item.semester,
          section: item.section,
          department: item.user?.department?.name || null
        })),
        assignments: assignments.map((item: any) => {
          const facultyProfile = facultyById.get(item.facultyId);
          const studentProfile = studentsById.get(item.studentId);
          return {
            id: item.id,
            facultyId: item.facultyId,
            studentId: item.studentId,
            lastMeeting: item.lastMeeting,
            facultyName: facultyProfile?.user?.name || 'Faculty',
            facultyEmail: facultyProfile?.user?.email || '',
            studentName: studentProfile?.user?.name || 'Student',
            studentEmail: studentProfile?.user?.email || '',
            rollNumber: studentProfile?.rollNumber || ''
          };
        })
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/mentoring/assignments', authenticate, DEAN_WRITE, validate({ body: mentoringAssignmentCreateSchema }), async (req: Request, res: Response) => {
  try {
    const { studentId, facultyId } = req.body;

    if (!studentId || !facultyId) {
      res.status(400).json({ success: false, message: 'studentId and facultyId are required' });
      return;
    }

    const [student, faculty] = await Promise.all([
      prisma.studentProfile.findUnique({ where: { id: String(studentId) } }),
      prisma.facultyProfile.findUnique({ where: { id: String(facultyId) } })
    ]);

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }

    if (!faculty) {
      res.status(404).json({ success: false, message: 'Faculty not found' });
      return;
    }

    const existingForStudent = await prisma.menteeAssignment.findFirst({
      where: { studentId: String(studentId) }
    });

    const assignment = existingForStudent
      ? await prisma.menteeAssignment.update({
          where: { id: existingForStudent.id },
          data: { facultyId: String(facultyId) }
        })
      : await prisma.menteeAssignment.create({
          data: {
            studentId: String(studentId),
            facultyId: String(facultyId)
          }
        });

    const [studentUser, facultyUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: student.userId } }),
      prisma.user.findUnique({ where: { id: faculty.userId } })
    ]);

    res.json({
      success: true,
      data: {
        id: assignment.id,
        studentId: assignment.studentId,
        facultyId: assignment.facultyId,
        lastMeeting: assignment.lastMeeting,
        studentName: studentUser?.name || 'Student',
        rollNumber: student.rollNumber,
        facultyName: facultyUser?.name || 'Faculty',
        facultyEmail: facultyUser?.email || ''
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Was an unaudited `menteeAssignment.delete`, and the sweep that converted the
 * other eighteen deletes missed it: those all delete the row named in the path,
 * while this one resolves an assignment from a STUDENT id and deletes what it
 * finds. A pattern-matching pass keys on the shape it was written against.
 *
 * Worth recording for its own sake. Who a student's mentor was, and when that
 * stopped being true, is the sort of question raised months later — usually
 * because something went wrong for the student in the gap.
 */
router.delete(
  '/mentoring/assignments/:studentId',
  authenticate,
  validate({
    params: z.object({ studentId: entityId }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const context = getTenantContext(req);
    const studentId = String(req.params.studentId);
    // MenteeAssignment has no institutionId of its own — scope the lookup
    // through the student, the same relation deleteTenantEntity's
    // scopeWhere uses below, so a foreign-institution studentId 404s here
    // instead of surfacing a row that the delete would then reject anyway.
    const assignment = await prisma.menteeAssignment.findFirst({
      where: { studentId, student: { institutionId: context.institutionId } }
    });

    if (!assignment) {
      res.status(404).json({ success: false, message: 'No assignment found for this student' });
      return;
    }

    const result = await deleteTenantEntity(context, {
      model: 'menteeAssignment',
      entity: 'MenteeAssignment',
      module: 'academics',
      id: assignment.id,
      reason: String(req.body.reason),
      scopeWhere: (institutionId) => ({ student: { institutionId } })
    });

    res.json({ success: true, data: result });
  })
);

// ─── Dean Course Management ───
router.get('/course-management/options', authenticate, async (req: Request, res: Response) => {
  try {
    const own = await getDeanDepartment((req as any).user.id);
    const departments = await prisma.department.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, code: true } });
    res.json({ success: true, data: { department: own ? { id: own.id, name: own.name, code: own.code } : null, departments } });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/course-management', authenticate, async (req: Request, res: Response) => {
  try {
    const filter = await departmentFilter(req);
    const courses = await prisma.course.findMany({
      where: filter,
      include: { _count: { select: { enrollments: true } }, department: true },
      orderBy: [{ semester: 'asc' }, { code: 'asc' }]
    });
    const teachers = await prisma.facultyProfile.findMany({
      where: { id: { in: courses.map((c: any) => c.facultyId).filter(Boolean) } },
      include: { user: { select: { name: true } } }
    });
    const teacher = new Map(teachers.map((t: any) => [t.id, t.user?.name]));
    res.json({
      success: true,
      data: courses.map((course: any) => ({
        id: course.id, code: course.code, name: course.name, credits: course.credits, semester: course.semester,
        students: course._count.enrollments, department: course.department?.name ?? null, departmentId: course.departmentId,
        faculty: course.facultyId ? teacher.get(course.facultyId) ?? null : null
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/course-management', authenticate, DEAN_WRITE, validate({ body: deanCourseCreateSchema }), async (req: Request, res: Response) => {
  try {
    const department = await targetDepartment(req, req.body.departmentId);
    if (!department) throw new NotFoundError('Department');
    const { code, name, credits, semester } = req.body;
    const codeUpper = String(code).toUpperCase();
    const clash = await prisma.course.findFirst({ where: { code: codeUpper } });
    if (clash) {
      res.status(409).json({ success: false, message: `A course with code ${codeUpper} already exists` });
      return;
    }
    const created = await prisma.course.create({
      data: {
        institutionId: getTenantContext(req).institutionId,
        code: codeUpper, name: String(name), credits: Number(credits), semester: Number(semester),
        departmentId: department.id, facultyId: null
      }
    });
    res.json({ success: true, data: { ...created, department: department.name, students: 0, faculty: null } });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/course-management/:id', authenticate, DEAN_WRITE, validate({ params: z.object({ id: entityId }), body: deanCourseUpdateSchema }), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const existing = await prisma.course.findFirst({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Course not found' });
      return;
    }
    const payload = req.body ?? {};
    // Was `facultyId: null` on every edit: renaming a course removed its teacher.
    await prisma.course.updateMany({
      where: { id },
      data: {
        ...(payload.code ? { code: String(payload.code).toUpperCase() } : {}),
        ...(payload.name ? { name: String(payload.name) } : {}),
        ...(payload.credits != null ? { credits: Number(payload.credits) } : {}),
        ...(payload.semester != null ? { semester: Number(payload.semester) } : {})
      }
    });
    res.json({ success: true, data: await prisma.course.findFirst({ where: { id } }) });
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
  DEAN_WRITE,
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

// ─── Dean Facility Management ───
router.get('/facility-management', authenticate, async (_req: Request, res: Response) => {
  try {
    const facilities = await prisma.facility.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] });
    res.json({ success: true, data: facilities });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/facility-management', authenticate, authorizeRoles('dean', 'principal', 'hod'), validate({ body: deanFacilityCreateSchema }), async (req: Request, res: Response) => {
  try {
    const { name, type, capacity, status } = req.body;
    if (!name || !type || !capacity) {
      res.status(400).json({ success: false, message: 'name, type and capacity are required' });
      return;
    }

    // institutionId is required on the model since 0038 but injected by the
    // tenant extension at runtime — see the InterDeptEvent create above.
    const created = await prisma.facility.create({
      data: {
        name: String(name),
        type: String(type),
        capacity: Number(capacity),
        status: status ? String(status) : 'available'
      } as any
    });
    res.json({ success: true, data: created });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/facility-management/:id', authenticate, authorizeRoles('dean', 'hod'), validate({ params: z.object({ id: entityId }), body: deanFacilityUpdateSchema }), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const payload = req.body ?? {};

    const changed = await prisma.facility.updateMany({
      where: { id },
      data: {
        ...(payload.name ? { name: String(payload.name) } : {}),
        ...(payload.type ? { type: String(payload.type) } : {}),
        ...(payload.capacity != null ? { capacity: Number(payload.capacity) } : {}),
        ...(payload.status ? { status: String(payload.status) } : {})
      }
    });
    if (changed.count === 0) {
      res.status(404).json({ success: false, message: 'Facility not found' });
      return;
    }
    res.json({ success: true, data: await prisma.facility.findFirst({ where: { id } }) });
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
  DEAN_WRITE,
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

// ─── Dean Semester Management ───
router.get('/semester-management/academic-years', authenticate, async (_req: Request, res: Response) => {
  try {
    const years = await prisma.academicYear.findMany({ orderBy: { year: 'desc' } });
    res.json({ success: true, data: years });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/semester-management/academic-years', authenticate, DEAN_WRITE, validate({ body: academicYearCreateSchema }), async (req: Request, res: Response) => {
  try {
    const yearValue = String(req.body?.year || '').trim();
    if (!yearValue || !req.body?.startDate || !req.body?.endDate) {
      res.status(400).json({ success: false, message: 'year, startDate and endDate are required' });
      return;
    }

    // Academic years are TENANT-SCOPED: two universities may both run "2025-26",
    // and each must be able to define its own calendar. A bare
    // `{ year: yearValue }` lookup would have found another institution's row
    // and wrongly reported a duplicate.
    const ctx = getTenantContext(req);

    const existing = await prisma.academicYear.findUnique({
      where: { institutionId_year: { institutionId: ctx.institutionId, year: yearValue } }
    });
    if (existing) {
      res.status(400).json({ success: false, message: `Academic year ${yearValue} already exists` });
      return;
    }

    const created = await prisma.academicYear.create({
      data: {
        institutionId: ctx.institutionId,
        year: yearValue,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        isCurrent: Boolean(req.body?.isCurrent),
        status: req.body?.status ? String(req.body.status) : 'upcoming',
        ...(req.body?.semesters !== undefined ? { semesters: req.body.semesters } : {})
      }
    });

    res.json({ success: true, data: created });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/semester-management/academic-years/:id', authenticate, DEAN_WRITE, validate({ params: z.object({ id: entityId }), body: academicYearUpdateSchema }), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const payload = req.body ?? {};

    const data: any = {
      ...(payload.year ? { year: String(payload.year).trim() } : {}),
      ...(payload.status ? { status: String(payload.status) } : {}),
      ...(payload.semesters !== undefined ? { semesters: payload.semesters } : {}),
      ...(payload.isCurrent !== undefined ? { isCurrent: Boolean(payload.isCurrent) } : {})
    };

    if (payload.startDate) data.startDate = new Date(payload.startDate);
    if (payload.endDate) data.endDate = new Date(payload.endDate);

    const updated = await prisma.$transaction(async (tx) => {
      if (payload.isCurrent === true) {
        await tx.academicYear.updateMany({ where: { isCurrent: true, institutionId: getTenantContext(req).institutionId }, data: { isCurrent: false } });
      }
      return tx.academicYear.update({ where: { id }, data });
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Dean Lab Purchase Approvals ───
router.get('/inventory/purchase-requests', authenticate, async (req: Request, res: Response) => {
  try {
    const filter = await departmentFilter(req);
    const requests = await prisma.purchaseRequest.findMany({
      where: filter,
      include: { department: { select: { name: true } } },
      orderBy: { requestDate: 'desc' }
    });

    res.json({
      success: true,
      data: requests.map((item: any) => ({
        ...item,
        requestDate: new Date(item.requestDate).toLocaleDateString('en-IN')
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Sanction or refuse a purchase request (Phase 2.4 — engine-backed).
 *
 * Was `prisma.purchaseRequest.update({ where: { id }, data: { status } })` after
 * a department check. The decision is now recorded as a transition, so the
 * approver, the moment and any note survive; the `status` column becomes a
 * projection of that.
 */
router.put('/inventory/purchase-requests/:id/status', authenticate, DEAN_WRITE, validate({ params: z.object({ id: entityId }), body: deanWorkflowDecisionSchema }), asyncHandler(async (req: Request, res: Response) => {
  const ctx = getTenantContext(req);
  const id = String(req.params.id);
  const status = String(req.body?.status || '').toLowerCase();

  if (!['approved', 'rejected'].includes(status)) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'status must be approved or rejected.' }
    });
    return;
  }

  const instance = await openInstanceFor(ctx, PURCHASE_REQUEST.entityType, id);
  if (!instance) {
    res.status(409).json({
      success: false,
      error: {
        code: 'BUSINESS_RULE_VIOLATION',
        message: 'No purchase request is awaiting sanction with that id. It may already have been decided.'
      }
    });
    return;
  }

  const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 500) : undefined;
  const result = await workflow.act(ctx, instance.id, status === 'approved' ? 'approved' : 'rejected', note);

  await prisma.purchaseRequest.updateMany({ where: { id }, data: { status } });
  const updated = await prisma.purchaseRequest.findFirst({ where: { id } });

  res.json({ success: true, data: { ...updated, workflowStatus: result.status, instanceId: instance.id } });
}));

export default router;
