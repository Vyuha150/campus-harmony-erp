import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';

const router = Router();
const db: any = prisma;

// ─── Dashboard ───
router.get('/dashboard', authenticate, async (req: Request, res: Response) => {
  try {
    const totalUsers = await prisma.user.count();
    const students = await prisma.user.count({ where: { role: 'student' } });
    const faculty = await prisma.user.count({ where: { role: 'faculty' } });
    const incidents = await prisma.incidentReport.count({ where: { status: 'pending' } });

    res.json({
      success: true,
      data: {
        stats: [
          { label: "Total Users", value: totalUsers.toString(), icon: "Users" },
          { label: "Students", value: students.toString(), icon: "GraduationCap", color: "text-blue-500" },
          { label: "Faculty", value: faculty.toString(), icon: "BookOpen", color: "text-purple-500" },
          { label: "System Errors", value: incidents.toString(), icon: "AlertTriangle", color: "text-destructive" }
        ],
        systemHealth: {
          status: 'operational', uptime: '99.9%'
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── User Management ───
router.get('/users', authenticate, async (req: Request, res: Response) => {
  try {
    const query = req.query as Record<string, string | undefined>;
    const search = query.search;
    const role = query.role;
    const where: any = {};
    if (role) where.role = role;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const users = await prisma.user.findMany({
      where,
      include: { department: true },
      take: 100,
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      data: users.map((u: any) => ({
        id: u.id, name: u.name, email: u.email, role: u.role,
        department: u.department?.name, designation: u.designation, avatar: u.avatar,
        status: 'active', lastLogin: null, loginCount: 0
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/users', authenticate, async (req: Request, res: Response) => {
  try {
    const bcrypt = await import('bcrypt');
    const { name, email, password, role, departmentId, designation } = req.body;
    const hashedPassword = await bcrypt.hash(password || 'password123', 10);

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role, departmentId, designation }
    });

    res.json({ success: true, data: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/users/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { password, ...rest } = req.body;
    const data: any = { ...rest };

    if (password) {
      const bcrypt = await import('bcrypt');
      data.password = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.user.update({ where: { id }, data });
    res.json({ success: true, data: { id: updated.id, name: updated.name, email: updated.email, role: updated.role } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/users/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    await prisma.user.delete({ where: { id } });
    res.json({ success: true, message: 'User deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── System Configuration ───
router.get('/config', authenticate, async (req: Request, res: Response) => {
  try {
    const departments = await prisma.department.findMany();
    const academicYears = await db.academicYear.findMany({ orderBy: { year: 'desc' } });

    res.json({
      success: true,
      data: {
        university: { name: 'Campus Harmony University', code: 'CHU', type: 'Private', accreditation: 'NAAC A+' },
        departments, academicYears
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/config', authenticate, async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, message: 'Configuration updated' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Departments ───
router.get('/departments', authenticate, async (req: Request, res: Response) => {
  try {
    const departments = await prisma.department.findMany({
      include: { users: { select: { role: true } }, courses: true }
    });
    res.json({
      success: true,
      data: departments.map((d: any) => ({
        id: d.id, name: d.name, code: d.code,
        faculty: d.users.filter((u: any) => u.role === 'faculty').length,
        students: d.users.filter((u: any) => u.role === 'student').length,
        courses: d.courses.length
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/departments', authenticate, async (req: Request, res: Response) => {
  try {
    const dept = await prisma.department.create({ data: req.body });
    res.json({ success: true, data: dept });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Academic Years ───
router.get('/academic-years', authenticate, async (req: Request, res: Response) => {
  try {
    const years = await db.academicYear.findMany({ orderBy: { year: 'desc' } });
    res.json({ success: true, data: years });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/academicyears', authenticate, async (req: Request, res: Response) => {
  try {
    const years = await db.academicYear.findMany({ orderBy: { year: 'desc' } });
    res.json({ success: true, data: years });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/academic-years', authenticate, authorizeRoles('dean'), async (req: Request, res: Response) => {
  try {
    const yearValue = String(req.body?.year || '').trim();
    if (!yearValue) {
      return res.status(400).json({ success: false, message: 'Academic year is required' });
    }

    const existing = await db.academicYear.findUnique({ where: { year: yearValue } });
    if (existing) {
      return res.status(400).json({ success: false, message: `Academic year ${yearValue} already exists` });
    }

    const year = await db.academicYear.create({
      data: {
        ...req.body,
        year: yearValue,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate)
      }
    });
    res.json({ success: true, data: year });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/academic-years/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const payload = req.body ?? {};
    const userRole = String((req as any).user?.role || '');

    if (payload.semesters !== undefined && userRole !== 'dean') {
      res.status(403).json({ success: false, message: 'Only dean can create semesters' });
      return;
    }

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
        await tx.academicYear.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
      }

      return tx.academicYear.update({ where: { id }, data });
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Audit Logs ───
router.get('/audit-logs', authenticate, async (req: Request, res: Response) => {
  try {
    const query = req.query as Record<string, string | undefined>;
    const userId = query.userId;
    const action = query.action;
    const mod = query.module;
    const startDate = query.startDate;
    const endDate = query.endDate;
    const where: any = {};
    if (userId) where.userId = userId;
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (mod) where.module = mod;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const logs = await db.systemAuditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 200
    });
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Notifications ───
router.get('/notifications', authenticate, async (req: Request, res: Response) => {
  try {
    const notifications = await db.systemNotificationRecord.findMany({ orderBy: { sentDate: 'desc' }, take: 50 });
    res.json({ success: true, data: notifications });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/systemnotifications', authenticate, async (req: Request, res: Response) => {
  try {
    const notifications = await db.systemNotificationRecord.findMany({ orderBy: { sentDate: 'desc' }, take: 50 });
    res.json({ success: true, data: notifications });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/notifications', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const notification = await db.systemNotificationRecord.create({
      data: { ...req.body, sentBy: userId }
    });
    res.json({ success: true, data: notification });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Analytics ───
router.get('/analytics/login-trend', authenticate, async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const points = [] as Array<{ time: string; users: number }>;

    for (let i = 11; i >= 0; i -= 1) {
      const start = new Date(now);
      start.setHours(now.getHours() - i, 0, 0, 0);
      const end = new Date(start);
      end.setHours(start.getHours() + 1);

      const users = await db.systemAuditLog.count({
        where: {
          action: { contains: 'login', mode: 'insensitive' },
          timestamp: { gte: start, lt: end }
        }
      });

      points.push({
        time: start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        users
      });
    }

    res.json({ success: true, data: points });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/analytics/module-usage', authenticate, async (_req: Request, res: Response) => {
  try {
    const grouped = await db.systemAuditLog.groupBy({
      by: ['module'],
      _count: { module: true },
      orderBy: { _count: { module: 'desc' } },
      take: 10
    });

    res.json({
      success: true,
      data: grouped.map((item: any) => ({
        name: item.module,
        usage: item._count.module
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/analytics/role-distribution', authenticate, async (_req: Request, res: Response) => {
  try {
    const grouped = await prisma.user.groupBy({
      by: ['role'],
      _count: { role: true },
      orderBy: { _count: { role: 'desc' } }
    });

    res.json({
      success: true,
      data: grouped.map((item: any) => ({ role: item.role, count: item._count.role }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Course Management ───
router.get('/courses', authenticate, async (req: Request, res: Response) => {
  try {
    const query = req.query as Record<string, string | undefined>;
    const where: any = {};
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.semester) where.semester = parseInt(query.semester);

    const courses = await prisma.course.findMany({
      where,
      include: { department: true, faculty: { include: { user: true } }, enrollments: true },
      orderBy: { code: 'asc' }
    });
    res.json({
      success: true,
      data: courses.map((c: any) => ({
        id: c.id, code: c.code, name: c.name, credits: c.credits, semester: c.semester,
        department: c.department?.name, departmentId: c.departmentId,
        faculty: c.faculty?.user?.name || 'Unassigned', facultyId: c.facultyId,
        students: c.enrollments.length
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/courses', authenticate, authorizeRoles('hod', 'dean'), async (req: Request, res: Response) => {
  try {
    const { code, name, credits, semester, departmentId, facultyId } = req.body;
    const course = await prisma.course.create({
      data: { code, name, credits, semester, departmentId, ...(facultyId && { facultyId }) }
    });
    res.json({ success: true, data: course });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/courses/:id', authenticate, authorizeRoles('hod', 'dean'), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await prisma.course.update({ where: { id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/courses/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    await prisma.course.delete({ where: { id } });
    res.json({ success: true, message: 'Course deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
