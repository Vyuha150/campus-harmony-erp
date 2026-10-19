import { notifyInApp } from '../lib/inAppNotify.js';
import type { Request, Response } from 'express';
import { budgetsByDepartment } from '../lib/departmentBudgets.js';
import { publishedOutcomes, outcomeFor, combineOutcomes, passPercentage } from '../lib/courseOutcomes.js';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { sendError } from '../lib/errors.js';
import { getTenantContext } from '../lib/tenant.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { entityId } from '../schemas/common.js';
import { updateTenantEntity } from '../modules/common/entityUpdate.service.js';
import {
  updateMeetingSchema,
  updateBroadcastSchema
} from '../modules/common/entityUpdate.schemas.js';
import { deleteTenantEntity } from '../modules/common/entityDelete.service.js';
import {
  complianceReportUpdateSchema
} from '../modules/common/legacyWrite.schemas.js';
import {
  vcApprovalDecisionSchema,
  policyScenarioCreateSchema,
  vcMeetingCreateSchema,
  vcBroadcastCreateSchema
} from '../modules/vc/vc.schemas.js';

const router = Router();

function toArray<T = any>(value: any): T[] {
  return Array.isArray(value) ? value : [];
}

function toStringArray(value: any): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  return [];
}

function normalizeMeeting(meeting: any) {
  return {
    ...meeting,
    agendaItems: toArray<any>(meeting.agendaItems),
    attendees: toStringArray(meeting.attendees),
    documents: toStringArray(meeting.documents),
  };
}

async function buildDepartmentPerformance() {
  const [departments, placementApplications, facultyUsers] = await Promise.all([
    prisma.department.findMany({ include: { users: true, courses: { include: { enrollments: true } } } }),
    prisma.studentApplication.findMany({
      include: {
        student: {
          include: {
            user: { select: { departmentId: true } }
          }
        }
      }
    }),
    prisma.user.findMany({
      where: { role: 'faculty' },
      include: { facultyProfile: { include: { publications: true } } }
    })
  ]);

  const published = await publishedOutcomes(
    (departments as any[]).flatMap((d) => d.courses.map((c: any) => c.id))
  );

  const selectedByDepartment = new Map<string, number>();
  for (const app of placementApplications as any[]) {
    if (String(app.status || '').toLowerCase() !== 'selected') continue;
    const deptId = app.student?.user?.departmentId;
    if (!deptId) continue;
    selectedByDepartment.set(String(deptId), (selectedByDepartment.get(String(deptId)) || 0) + 1);
  }

  const researchByDepartment = new Map<string, number>();
  for (const faculty of facultyUsers as any[]) {
    const deptId = faculty.departmentId;
    if (!deptId) continue;
    const publications = Array.isArray(faculty.facultyProfile?.publications) ? faculty.facultyProfile.publications.length : 0;
    researchByDepartment.set(String(deptId), (researchByDepartment.get(String(deptId)) || 0) + publications);
  }

  return departments.map((d: any) => {
    const studentCount = d.users.filter((u: any) => u.role === 'student').length;
    const facultyCount = d.users.filter((u: any) => u.role === 'faculty').length;
    // Same source as the HOD, Dean and CoE screens — lib/courseOutcomes.ts.
    const passRate = combineOutcomes(d.courses.map((c: any) => outcomeFor(c, published))).passPercentage ?? 0;
    const selected = selectedByDepartment.get(String(d.id)) || 0;
    const placementRate = studentCount > 0 ? Math.min(100, Math.round((selected / studentCount) * 100)) : 0;
    const researchOutput = researchByDepartment.get(String(d.id)) || 0;
    const studentSatisfaction = Math.min(5, Math.max(0, Number((passRate / 20).toFixed(1))));

    return {
      id: d.id,
      department: d.name,
      facultyCount,
      studentCount,
      passRate,
      placementRate,
      researchOutput,
      studentSatisfaction
    };
  });
}

// ─── Dashboard ───
router.get('/dashboard', authenticate, async (req: Request, res: Response) => {
  try {
    // REMOVED: an auto-create that invented "Overall Placement: 92%",
    // "Research Grants: 4.5Cr" and "Student Satisfaction: 4.2/5" the first
    // time this institution had no KPI rows, then wrote them to the database
    // so every later load looked like a real measurement. The same pattern
    // Phase 3b removed from iqac.ts's NAAC score. An empty KPI list is the
    // honest answer when nobody has recorded one yet.
    const finalKpis = await prisma.institutionKPI.findMany();
    const totalStudents = await prisma.user.count({ where: { role: 'student' } });
    const totalFaculty = await prisma.user.count({ where: { role: 'faculty' } });
    const pendingApprovals = await prisma.approvalItem.count({ where: { status: 'pending' } });

    res.json({
      success: true,
      data: {
        kpis: finalKpis,
        stats: [
          { label: "Total Students", value: totalStudents.toString(), icon: "Users" },
          { label: "Total Faculty", value: totalFaculty.toString(), icon: "GraduationCap" },
          { label: "Pending Approvals", value: pendingApprovals.toString(), icon: "FileText" }
        ],
        liveUpdates: []
      }
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

router.put('/approvals/:id', authenticate, validate({ body: vcApprovalDecisionSchema }), async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid approval id' });
    }
    const { status, notes } = req.body;
    // updateMany + a pending filter, NOT update-by-id.
    //
    // The tenant extension can constrain a `where` clause but cannot filter a
    // unique-key update, so `update({ where: { id } })` let anyone holding an id
    // from ANOTHER institution decide that approval. Demonstrated live before
    // migration 0022. The status is validated above rather than written raw.
    //
    // 'pending' included: "Forward to Board of Management" (VCApprovals.tsx,
    // VCDashboard.tsx) sends status back as 'pending' rather than 'forwarded'.
    const ALLOWED_DECISIONS = ['approved', 'rejected', 'forwarded', 'pending'];
    if (!ALLOWED_DECISIONS.includes(status)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `status must be one of: ${ALLOWED_DECISIONS.join(', ')}.` }
      });
      return;
    }
    const changed = await prisma.approvalItem.updateMany({
      where: { id, status: 'pending' },
      data: {
        status,
        decidedBy: getTenantContext(req).userId,
        decidedAt: new Date(),
        decisionNote: typeof notes === 'string' ? notes.slice(0, 500) : null
      }
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

// ─── Policy & Planning ───
router.get('/policies', authenticate, async (req: Request, res: Response) => {
  try {
    const scenarios = await prisma.policyScenario.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: scenarios });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/policyscenarios', authenticate, async (_req: Request, res: Response) => {
  try {
    const scenarios = await prisma.policyScenario.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({
      success: true,
      data: scenarios.map((scenario: any) => ({
        ...scenario,
        parameters: toArray<any>(scenario.parameters),
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/policyscenarios', authenticate, validate({ body: policyScenarioCreateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = String((req as any).user.id);
    const { title, description, category, parameters, projectedOutcome, impact } = req.body;
    // `institutionId` is required on the model since 0037 but is injected by
    // the tenant extension at runtime, not supplied here — `as any` because
    // tsc checks a named object literal's keys even though every value on it
    // is `any`, unlike a `{ ...req.body }` spread.
    const created = await prisma.policyScenario.create({
      data: {
        title,
        description,
        category,
        parameters: Array.isArray(parameters) ? parameters : [],
        projectedOutcome: projectedOutcome || 'Run simulation to generate projections.',
        impact: impact || 'neutral',
        createdBy: userId,
      } as any
    });
    res.json({ success: true, data: { ...created, parameters: toArray<any>(created.parameters) } });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Was `prisma.policyScenario.delete({ where: { id } })` with nothing recorded.
 * Now audited, with the row captured before it goes and a reason required.
 */
router.delete(
  '/policyscenarios/:id',
  authenticate,
  validate({
    params: z.object({ id: entityId }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await deleteTenantEntity(getTenantContext(req), {
      model: 'policyScenario',
      entity: 'PolicyScenario',
      module: 'governance',
      id: String(req.params.id),
      reason: String(req.body.reason)
    });

    res.json({ success: true, data: result });
  })
);

router.post('/policies/simulate', authenticate, validate({ body: policyScenarioCreateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { title, description, category, parameters } = req.body;
    // See the comment on the /policyscenarios create above re: `as any`.
    const scenario = await prisma.policyScenario.create({
      data: { title, description, category, parameters, createdBy: userId, projectedOutcome: 'Simulation pending' } as any
    });
    res.json({ success: true, data: scenario });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Meetings ───
router.get('/meetings', authenticate, async (req: Request, res: Response) => {
  try {
    const meetings = await prisma.meeting.findMany({ orderBy: { date: 'desc' } });
    res.json({ success: true, data: meetings.map(normalizeMeeting) });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/meetingagendas', authenticate, async (_req: Request, res: Response) => {
  try {
    const meetings = await prisma.meeting.findMany({ orderBy: { date: 'desc' } });
    res.json({ success: true, data: meetings.map(normalizeMeeting) });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/meetings', authenticate, validate({ body: vcMeetingCreateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { meetingType, title, date, time, venue, agendaItems, attendees } = req.body;
    const meeting = await prisma.meeting.create({
      data: {
        institutionId: getTenantContext(req).institutionId,
        meetingType, title, date: new Date(date), time, venue, agendaItems, attendees, createdBy: userId
      }
    });
    res.json({ success: true, data: meeting });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put(
  '/meetings/:id',
  authenticate,
  validate({ params: z.object({ id: entityId }), body: updateMeetingSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await updateTenantEntity(getTenantContext(req), {
      model: 'meeting',
      entity: 'Meeting',
      module: 'governance',
      id: String(req.params.id),
      data: req.body as Record<string, unknown>
    });

    res.json({ success: true, data: updated });
  })
);

router.get('/meetings/:id/minutes', authenticate, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid meeting id' });
    }
    const meeting = await prisma.meeting.findUnique({ where: { id } });
    res.json({ success: true, data: { minutes: meeting?.minutes, agendaItems: meeting?.agendaItems } });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Communication ───
router.get('/messages', authenticate, async (req: Request, res: Response) => {
  try {
    const messages = await prisma.broadcastMessage.findMany({ orderBy: { sentAt: 'desc' } });
    res.json({ success: true, data: messages });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/broadcastmessages', authenticate, async (_req: Request, res: Response) => {
  try {
    const messages = await prisma.broadcastMessage.findMany({ orderBy: { sentAt: 'desc' } });
    res.json({ success: true, data: messages });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/messages', authenticate, validate({ body: vcBroadcastCreateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const { subject, content, type, recipients, pinned } = req.body;
    const msg = await prisma.broadcastMessage.create({
      data: {
        institutionId: getTenantContext(req).institutionId,
        subject, content, sender: user?.name || 'VC', type: type || 'announcement',
        recipients: recipients || 'all', pinned: pinned || false
      }
    });
    // Deliver the circular; it was only stored.
    const AUDIENCE: Record<string, string[]> = {
      'All Students': ['student'],
      'All Faculty': ['faculty', 'hod'],
      'All Deans & HODs': ['dean', 'hod', 'principal'],
      'Board Members': ['registrar', 'pro_vc', 'principal', 'dean', 'finance_officer']
    };
    const roles = AUDIENCE[String(recipients)] ?? null; // null → everyone
    const everyone = roles ? null : await prisma.user.findMany({ where: { id: { not: userId } }, select: { id: true } });
    await notifyInApp(getTenantContext(req).institutionId, roles ? { roles, excludeUserId: userId } : { userIds: everyone!.map((u: any) => u.id) }, {
      eventType: 'broadcast.vc', subject: `From the Vice-Chancellor: ${subject}`, body: String(content).slice(0, 300),
      relatedEntityType: 'BroadcastMessage', relatedEntityId: msg.id
    });
    res.json({ success: true, data: msg });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put(
  '/messages/:id',
  authenticate,
  validate({ params: z.object({ id: entityId }), body: updateBroadcastSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await updateTenantEntity(getTenantContext(req), {
      model: 'broadcastMessage',
      entity: 'BroadcastMessage',
      module: 'governance',
      id: String(req.params.id),
      data: req.body as Record<string, unknown>
    });

    res.json({ success: true, data: updated });
  })
);

// ─── Compliance ───
router.get('/compliance', authenticate, async (req: Request, res: Response) => {
  try {
    const reports = await prisma.complianceReport.findMany({ orderBy: { lastUpdated: 'desc' } });
    res.json({
      success: true,
      data: reports.map((report: any) => ({
        ...report,
        criteria: toArray<any>(report.criteria)
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/compliance/:id', authenticate,
  validate({ params: z.object({ id: entityId }), body: complianceReportUpdateSchema }),
  async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await prisma.complianceReport.update({
      where: { id },
      data: { ...req.body, lastUpdated: new Date() }
    });
    res.json({ success: true, data: { ...updated, criteria: toArray<any>(updated.criteria) } });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Finance ───
router.get('/finance', authenticate, async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    const totalRevenue = await prisma.feeRecord.aggregate({ where: { status: 'paid' }, _sum: { amount: true } });
    const pendingDues = await prisma.feeRecord.aggregate({ where: { status: 'pending' }, _sum: { amount: true } });
    const budgets = await budgetsByDepartment(context.institutionId);

    res.json({
      success: true,
      data: {
        totalRevenue: totalRevenue._sum.amount || 0,
        pendingDues: pendingDues._sum.amount || 0,
        departmentBudgets: budgets.map((b) => ({
          category: b.department, budget: b.allocated, actual: b.spent, variance: b.remaining
        }))
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Analytics ───
router.get('/analytics', authenticate, async (req: Request, res: Response) => {
  try {
    const data = await buildDepartmentPerformance();
    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/departmentperformance', authenticate, async (_req: Request, res: Response) => {
  try {
    const data = await buildDepartmentPerformance();
    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/campussummaries', authenticate, async (_req: Request, res: Response) => {
  try {
    const perf = await buildDepartmentPerformance();
    const data = perf.map((item: any) => ({
      id: item.id,
      name: item.department,
      location: 'Main Campus',
      students: item.studentCount,
      faculty: item.facultyCount,
      programs: 1,
      placementRate: item.placementRate,
      passRate: item.passRate
    }));

    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/institutionkpis', authenticate, async (_req: Request, res: Response) => {
  try {
    const data = await prisma.institutionKPI.findMany();
    res.json({
      success: true,
      data: data.map((item: any) => ({
        ...item,
        trendValue: String(item.trend || 'stable')
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/liveupdates', authenticate, async (_req: Request, res: Response) => {
  try {
    const [approvals, meetings] = await Promise.all([
      prisma.approvalItem.findMany({ orderBy: { requestedAt: 'desc' }, take: 5 }),
      prisma.meeting.findMany({ orderBy: { date: 'desc' }, take: 5 })
    ]);

    const updates = [
      ...approvals.map((a: any) => ({
        id: a.id,
        message: a.title,
        module: a.type || 'workflow',
        type: a.status === 'pending' ? 'warning' : a.status === 'rejected' ? 'critical' : 'success',
        timestamp: a.requestedAt
      })),
      ...meetings.map((m: any) => ({
        id: m.id,
        message: m.title,
        module: 'meetings',
        type: m.status === 'upcoming' ? 'info' : 'success',
        timestamp: m.date
      }))
    ].sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ success: true, data: updates.slice(0, 8) });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/executiveapprovals', authenticate, async (_req: Request, res: Response) => {
  try {
    const items = await prisma.approvalItem.findMany({ orderBy: { requestedAt: 'desc' }, take: 25 });
    res.json({
      success: true,
      data: items.map((item: any) => ({
        ...item,
        description: item.details,
        requestedAt: item.requestedAt,
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/financialoverview', authenticate, async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    const [paid, pending, budgets] = await Promise.all([
      prisma.feeRecord.aggregate({ where: { status: 'paid' }, _sum: { amount: true } }),
      prisma.feeRecord.aggregate({ where: { status: 'pending' }, _sum: { amount: true } }),
      budgetsByDepartment(context.institutionId)
    ]);

    res.json({
      success: true,
      data: {
        totalRevenue: paid._sum.amount || 0,
        pendingDues: pending._sum.amount || 0,
        totalBudget: budgets.reduce((sum, b) => sum + b.allocated, 0),
        totalSpent: budgets.reduce((sum, b) => sum + b.spent, 0)
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/finance-summary', authenticate, async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    const budgets = await budgetsByDepartment(context.institutionId);
    res.json({
      success: true,
      data: budgets.map((b) => ({ department: b.department, allocated: b.allocated, spent: b.spent, remaining: b.remaining }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/compliancereports', authenticate, async (_req: Request, res: Response) => {
  try {
    const data = await prisma.complianceReport.findMany({ orderBy: { lastUpdated: 'desc' } });
    res.json({ success: true, data: data.map((report: any) => ({ ...report, criteria: toArray<any>(report.criteria) })) });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/department-budgets', authenticate, async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    const budgets = await budgetsByDepartment(context.institutionId);
    const data = budgets.map((b) => ({
      dept: b.department,
      allocated: b.allocated,
      spent: b.spent,
      util: b.allocated > 0 ? Math.round((b.spent / b.allocated) * 100) : 0,
      // Finance's own budget heads, rather than a two-way committed/available split.
      categories: b.categories.map((c) => ({ name: c.name, amount: c.allocated }))
    }));
    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/revenue-streams', authenticate, async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    // `grants` and `other` used to be Math.round(totalBudgetAllocation * 0.1)
    // and Math.round(tuition * 0.05) — invented fractions with no revenue
    // behind them at all, not even a real number scaled wrong. ResearchProject
    // and Donation are real tables for exactly these two categories; neither
    // carries an institutionId of its own, so both are reached through their
    // owning profile's institution the same way alumni.ts does it.
    const [paid, grantProjects, donations] = await Promise.all([
      prisma.feeRecord.findMany({ where: { status: 'paid' } }),
      prisma.researchProject.findMany({ where: { faculty: { institutionId: context.institutionId } } }),
      prisma.donation.findMany({ where: { status: 'completed', alumni: { user: { institutionId: context.institutionId } } } })
    ]);

    const tuition = paid.reduce((sum: number, record: any) => sum + Number(record.amount || 0), 0);
    const grants = grantProjects.reduce((sum: number, project: any) => sum + Number(project.amount || 0), 0);
    const other = donations.reduce((sum: number, donation: any) => sum + Number(donation.amount || 0), 0);
    const total = tuition + grants + other;
    const rows = [
      // `trend` was the literal '+0.0%' on every line. A trend needs a prior
      // period to compare against, and none is loaded here, so the field is null
      // rather than a number that looks measured. Restoring it means loading the
      // comparable period, not typing a value.
      { source: 'Tuition Fees', amount: Math.round(tuition), trend: null },
      { source: 'Research & Grants', amount: Math.round(grants), trend: null },
      { source: 'Alumni Donations', amount: Math.round(other), trend: null },
    ].map((row) => ({
      ...row,
      percentage: total > 0 ? Math.round((row.amount / total) * 100) : 0
    }));

    res.json({ success: true, data: rows });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/global-access-records', authenticate, async (_req: Request, res: Response) => {
  try {
    const [students, faculty, departments, programs] = await Promise.all([
      prisma.user.findMany({ where: { role: 'student' }, include: { studentProfile: true, department: true }, take: 200 }),
      prisma.user.findMany({ where: { role: 'faculty' }, include: { facultyProfile: true, department: true }, take: 200 }),
      prisma.department.findMany({ include: { users: true, courses: true } }),
      prisma.course.findMany({ include: { department: true }, take: 200 }),
    ]);

    const records = [
      ...students.map((student: any) => ({
        type: 'student',
        name: student.name,
        id: student.studentProfile?.rollNumber || student.id,
        department: student.department?.name || '',
        details: `${student.studentProfile?.program || '-'} • Semester ${student.studentProfile?.semester || '-'}`,
        awards: [],
        email: student.email,
        phone: '',
        joinDate: student.createdAt,
      })),
      ...faculty.map((teacher: any) => ({
        type: 'faculty',
        name: teacher.name,
        id: teacher.facultyProfile?.employeeId || teacher.id,
        department: teacher.department?.name || '',
        details: `${teacher.designation || 'Faculty'} • ${teacher.facultyProfile?.specialization || ''}`.trim(),
        awards: [],
        email: teacher.email,
        phone: '',
        joinDate: teacher.createdAt,
      })),
      ...departments.map((department: any) => ({
        type: 'department',
        name: department.name,
        id: department.code,
        department: '',
        details: `${department.users.filter((user: any) => user.role === 'student').length} students • ${department.users.filter((user: any) => user.role === 'faculty').length} faculty`,
        awards: [],
      })),
      ...programs.map((program: any) => ({
        type: 'program',
        name: program.name,
        id: program.code,
        department: program.department?.name || '',
        details: `${program.credits} credits • Semester ${program.semester}`,
        awards: [],
      }))
    ];

    res.json({ success: true, data: records });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Global Access ───
router.get('/global-access/:module', authenticate, async (req: Request, res: Response) => {
  try {
    const { module } = req.params;
    let data: any = {};

    switch (module) {
      case 'students':
        data = await prisma.user.findMany({ where: { role: 'student' }, include: { studentProfile: true, department: true }, take: 100 });
        break;
      case 'faculty':
        data = await prisma.user.findMany({ where: { role: 'faculty' }, include: { facultyProfile: true, department: true }, take: 100 });
        break;
      case 'courses':
        data = await prisma.course.findMany({ include: { department: true }, take: 100 });
        break;
      case 'finance':
        const revenue = await prisma.feeRecord.aggregate({ where: { status: 'paid' }, _sum: { amount: true } });
        data = { totalRevenue: revenue._sum.amount || 0 };
        break;
      case 'grievances':
        data = await prisma.grievanceCase.findMany({ orderBy: { submissionDate: 'desc' }, take: 50 });
        break;
      default:
        data = { message: `Module '${module}' data not available` };
    }

    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

export default router;
