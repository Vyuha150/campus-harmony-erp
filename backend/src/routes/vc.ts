import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

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
    const allEnrollments = d.courses.flatMap((c: any) => c.enrollments || []);
    const evaluated = allEnrollments.filter((e: any) => Boolean(e.grade));
    const passed = evaluated.filter((e: any) => !['F', 'I'].includes(String(e.grade))).length;
    const passRate = evaluated.length > 0 ? Math.round((passed / evaluated.length) * 100) : 0;
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
    const kpis = await prisma.institutionKPI.findMany();
    if (kpis.length === 0) {
      await prisma.institutionKPI.createMany({
        data: [
          { category: "academic", label: "Overall Placement", value: "92%", target: "95%", trend: "up", status: "good" },
          { category: "research", label: "Research Grants", value: "4.5Cr", target: "5Cr", trend: "up", status: "good" },
          { category: "quality", label: "Student Satisfaction", value: "4.2/5", target: "4.5", trend: "stable", status: "average" },
        ]
      });
    }
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Approvals ───
router.get('/approvals', authenticate, async (req: Request, res: Response) => {
  try {
    const approvals = await prisma.approvalItem.findMany({ orderBy: { requestedAt: 'desc' } });
    res.json({ success: true, data: approvals });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/approvals/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid approval id' });
    }
    const { status } = req.body;
    const updated = await prisma.approvalItem.update({ where: { id }, data: { status } });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Policy & Planning ───
router.get('/policies', authenticate, async (req: Request, res: Response) => {
  try {
    const scenarios = await prisma.policyScenario.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: scenarios });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/policyscenarios', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = String((req as any).user.id);
    const { title, description, category, parameters, projectedOutcome, impact } = req.body;
    const created = await prisma.policyScenario.create({
      data: {
        title,
        description,
        category,
        parameters: Array.isArray(parameters) ? parameters : [],
        projectedOutcome: projectedOutcome || 'Run simulation to generate projections.',
        impact: impact || 'neutral',
        createdBy: userId,
      }
    });
    res.json({ success: true, data: { ...created, parameters: toArray<any>(created.parameters) } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/policyscenarios/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    await prisma.policyScenario.delete({ where: { id } });
    res.json({ success: true, data: { id } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/policies/simulate', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { title, description, category, parameters } = req.body;
    const scenario = await prisma.policyScenario.create({
      data: { title, description, category, parameters, createdBy: userId, projectedOutcome: 'Simulation pending' }
    });
    res.json({ success: true, data: scenario });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Meetings ───
router.get('/meetings', authenticate, async (req: Request, res: Response) => {
  try {
    const meetings = await prisma.meeting.findMany({ orderBy: { date: 'desc' } });
    res.json({ success: true, data: meetings.map(normalizeMeeting) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/meetingagendas', authenticate, async (_req: Request, res: Response) => {
  try {
    const meetings = await prisma.meeting.findMany({ orderBy: { date: 'desc' } });
    res.json({ success: true, data: meetings.map(normalizeMeeting) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/meetings', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { meetingType, title, date, time, venue, agendaItems, attendees } = req.body;
    const meeting = await prisma.meeting.create({
      data: { meetingType, title, date: new Date(date), time, venue, agendaItems, attendees, createdBy: userId }
    });
    res.json({ success: true, data: meeting });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/meetings/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid meeting id' });
    }
    const updated = await prisma.meeting.update({ where: { id }, data: req.body });
    res.json({ success: true, data: normalizeMeeting(updated) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/meetings/:id/minutes', authenticate, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid meeting id' });
    }
    const meeting = await prisma.meeting.findUnique({ where: { id } });
    res.json({ success: true, data: { minutes: meeting?.minutes, agendaItems: meeting?.agendaItems } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Communication ───
router.get('/messages', authenticate, async (req: Request, res: Response) => {
  try {
    const messages = await prisma.broadcastMessage.findMany({ orderBy: { sentAt: 'desc' } });
    res.json({ success: true, data: messages });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/broadcastmessages', authenticate, async (_req: Request, res: Response) => {
  try {
    const messages = await prisma.broadcastMessage.findMany({ orderBy: { sentAt: 'desc' } });
    res.json({ success: true, data: messages });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/messages', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const { subject, content, type, recipients, pinned } = req.body;
    const msg = await prisma.broadcastMessage.create({
      data: { subject, content, sender: user?.name || 'VC', type: type || 'announcement', recipients: recipients || 'all', pinned: pinned || false }
    });
    res.json({ success: true, data: msg });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/messages/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await prisma.broadcastMessage.update({ where: { id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/compliance/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await prisma.complianceReport.update({
      where: { id },
      data: { ...req.body, lastUpdated: new Date() }
    });
    res.json({ success: true, data: { ...updated, criteria: toArray<any>(updated.criteria) } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Finance ───
router.get('/finance', authenticate, async (req: Request, res: Response) => {
  try {
    const totalRevenue = await prisma.feeRecord.aggregate({ where: { status: 'paid' }, _sum: { amount: true } });
    const pendingDues = await prisma.feeRecord.aggregate({ where: { status: 'pending' }, _sum: { amount: true } });
    const budgets = await prisma.departmentBudget.findMany({ include: { department: true } });

    res.json({
      success: true,
      data: {
        totalRevenue: totalRevenue._sum.amount || 0,
        pendingDues: pendingDues._sum.amount || 0,
        departmentBudgets: budgets.map((b: any) => ({
          category: b.department.name, budget: b.allocated, actual: b.spent, variance: b.allocated - b.spent
        }))
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Analytics ───
router.get('/analytics', authenticate, async (req: Request, res: Response) => {
  try {
    const data = await buildDepartmentPerformance();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/departmentperformance', authenticate, async (_req: Request, res: Response) => {
  try {
    const data = await buildDepartmentPerformance();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/financialoverview', authenticate, async (_req: Request, res: Response) => {
  try {
    const [paid, pending, budgets] = await Promise.all([
      prisma.feeRecord.aggregate({ where: { status: 'paid' }, _sum: { amount: true } }),
      prisma.feeRecord.aggregate({ where: { status: 'pending' }, _sum: { amount: true } }),
      prisma.departmentBudget.findMany({ include: { department: true } })
    ]);

    res.json({
      success: true,
      data: {
        totalRevenue: paid._sum.amount || 0,
        pendingDues: pending._sum.amount || 0,
        totalBudget: budgets.reduce((sum: number, b: any) => sum + Number(b.allocated || 0), 0),
        totalSpent: budgets.reduce((sum: number, b: any) => sum + Number(b.spent || 0), 0)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/finance-summary', authenticate, async (_req: Request, res: Response) => {
  try {
    const budgets = await prisma.departmentBudget.findMany({ include: { department: true } });
    res.json({
      success: true,
      data: budgets.map((b: any) => ({
        department: b.department?.name || 'Unknown',
        allocated: Number(b.allocated || 0),
        spent: Number(b.spent || 0),
        remaining: Number(b.allocated || 0) - Number(b.spent || 0)
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/compliancereports', authenticate, async (_req: Request, res: Response) => {
  try {
    const data = await prisma.complianceReport.findMany({ orderBy: { lastUpdated: 'desc' } });
    res.json({ success: true, data: data.map((report: any) => ({ ...report, criteria: toArray<any>(report.criteria) })) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/department-budgets', authenticate, async (_req: Request, res: Response) => {
  try {
    const budgets = await prisma.departmentBudget.findMany({ include: { department: true } });
    const data = budgets.map((budget: any) => {
      const allocated = Number(budget.allocated || 0);
      const spent = Number(budget.spent || 0);
      const util = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;
      return {
        dept: budget.department?.name || 'Unknown',
        allocated,
        spent,
        util,
        categories: [
          { name: 'Committed', amount: spent },
          { name: 'Available', amount: Math.max(0, allocated - spent) }
        ]
      };
    });
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/revenue-streams', authenticate, async (_req: Request, res: Response) => {
  try {
    const [paid, budgets] = await Promise.all([
      prisma.feeRecord.findMany({ where: { status: 'paid' } }),
      prisma.departmentBudget.findMany()
    ]);

    const tuition = paid.reduce((sum: number, record: any) => sum + Number(record.amount || 0), 0);
    const grants = budgets.reduce((sum: number, budget: any) => sum + Number(budget.allocated || 0) * 0.1, 0);
    const other = Math.max(0, tuition * 0.05);
    const total = tuition + grants + other;
    const rows = [
      { source: 'Tuition Fees', amount: Math.round(tuition), trend: '+0.0%' },
      { source: 'Research & Grants', amount: Math.round(grants), trend: '+0.0%' },
      { source: 'Other Income', amount: Math.round(other), trend: '+0.0%' },
    ].map((row) => ({
      ...row,
      percentage: total > 0 ? Math.round((row.amount / total) * 100) : 0
    }));

    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
