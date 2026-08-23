import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { hashPassword } from '../lib/password.js';
import { ValidationError, NotFoundError , sendError} from '../lib/errors.js';
import { recordFromRequest } from '../lib/audit.js';
import {
  getTenantContext,
  campusScope,
  withInstitution,
  assertSameInstitution,
  assertCampusAccess
} from '../lib/tenant.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { entityId } from '../schemas/common.js';
import { updateTenantEntity } from '../modules/common/entityUpdate.service.js';
import {
  updateCourseSchema
} from '../modules/common/entityUpdate.schemas.js';

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
    sendError(res, error);
  }
});

// ─── User Management ───
router.get('/users', authenticate, async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    const query = req.query as Record<string, string | undefined>;
    const search = query.search;
    const role = query.role;

    // TENANT SCOPE (ADR-0001). Without this the endpoint would list every user
    // in every institution — the exact cross-tenant leak this architecture
    // exists to prevent. `campusScope` additionally narrows campus-scoped roles
    // to their own campus while letting VC/Registrar see all campuses.
    const where: any = { ...campusScope(ctx) };
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
    sendError(res, error);
  }
});

router.post('/users', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = getTenantContext(req);
    const { name, email, password, role, departmentId, designation } = req.body ?? {};

    if (!name || !email || !role) {
      throw new ValidationError('name, email and role are required.');
    }

    // Previously: `bcrypt.hash(password || 'password123', 10)` — omitting the
    // password silently created a real account with a password published in a
    // public repository. hashPassword() requires and validates it instead.
    const hashedPassword = await hashPassword(password);

    // `withInstitution` FORCES the creator's institutionId onto the row,
    // overwriting anything the client supplied — a caller must not be able to
    // create a user inside another institution.
    const user = await prisma.user.create({
      data: withInstitution(ctx, {
        name,
        email,
        password: hashedPassword,
        role,
        departmentId,
        designation,
        // Campus-scoped creators can only create within their own campus.
        campusId: ctx.scopeLevel === 'CAMPUS' ? ctx.campusId : (req.body?.campusId ?? null)
      })
    });

    await recordFromRequest(req, {
      action: 'CREATE',
      module: 'admin',
      resource: `User:${user.id}`,
      details: `Created user ${user.email} with role ${user.role}`,
      newValue: { name, email, role, departmentId, designation },
      severity: 'warning' // account creation is privileged
    });

    res.status(201).json({
      success: true,
      data: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    next(error);
  }
});

router.put('/users/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = getTenantContext(req);
    const id = String(req.params.id);
    const { password, ...rest } = req.body ?? {};

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('User');
    }

    // IDOR guard at tenant scale. `findUnique` by primary key cannot carry a
    // tenant filter, so an attacker who learned a user id from another
    // institution could otherwise modify it. Reports "not found" rather than
    // "forbidden" — confirming the id exists elsewhere is itself a leak.
    assertSameInstitution(ctx, existing, 'User');
    assertCampusAccess(ctx, existing, 'User');

    // Whitelist updatable fields. Spreading req.body allowed a caller to set any
    // column, including `role` — a privilege-escalation path — and `password`
    // in plaintext.
    const data: Record<string, unknown> = {};
    for (const field of ['name', 'email', 'role', 'departmentId', 'designation', 'campus', 'avatar']) {
      if (rest[field] !== undefined) data[field] = rest[field];
    }

    if (password !== undefined) {
      data.password = await hashPassword(password);
    }

    const updated = await prisma.user.update({ where: { id }, data });

    await recordFromRequest(req, {
      action: password !== undefined ? 'PASSWORD_RESET' : 'UPDATE',
      module: 'admin',
      resource: `User:${id}`,
      details: `Updated user ${updated.email}`,
      oldValue: {
        name: existing.name, email: existing.email, role: existing.role,
        departmentId: existing.departmentId, designation: existing.designation
      },
      newValue: data,
      severity: 'warning'
    });

    res.json({
      success: true,
      data: { id: updated.id, name: updated.name, email: updated.email, role: updated.role }
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/users/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    await prisma.user.delete({ where: { id } });
    res.json({ success: true, message: 'User deleted' });
  } catch (error: any) {
    sendError(res, error);
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
    sendError(res, error);
  }
});

router.put('/config', authenticate, async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, message: 'Configuration updated' });
  } catch (error: any) {
    sendError(res, error);
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
    sendError(res, error);
  }
});

router.post('/departments', authenticate, async (req: Request, res: Response) => {
  try {
    const dept = await prisma.department.create({ data: req.body });
    res.json({ success: true, data: dept });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Academic Years ───
router.get('/academic-years', authenticate, async (req: Request, res: Response) => {
  try {
    const years = await db.academicYear.findMany({ orderBy: { year: 'desc' } });
    res.json({ success: true, data: years });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/academicyears', authenticate, async (req: Request, res: Response) => {
  try {
    const years = await db.academicYear.findMany({ orderBy: { year: 'desc' } });
    res.json({ success: true, data: years });
  } catch (error: any) {
    sendError(res, error);
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
    sendError(res, error);
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
    sendError(res, error);
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
    sendError(res, error);
  }
});

// ─── Notifications ───
router.get('/notifications', authenticate, async (req: Request, res: Response) => {
  try {
    const notifications = await db.systemNotificationRecord.findMany({ orderBy: { sentDate: 'desc' }, take: 50 });
    res.json({ success: true, data: notifications });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/systemnotifications', authenticate, async (req: Request, res: Response) => {
  try {
    const notifications = await db.systemNotificationRecord.findMany({ orderBy: { sentDate: 'desc' }, take: 50 });
    res.json({ success: true, data: notifications });
  } catch (error: any) {
    sendError(res, error);
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
    sendError(res, error);
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
    sendError(res, error);
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
    sendError(res, error);
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
    sendError(res, error);
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
    sendError(res, error);
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
    sendError(res, error);
  }
});

router.put(
  '/courses/:id',
  authenticate,
  authorizeRoles('hod', 'dean'),
  validate({ params: z.object({ id: entityId }), body: updateCourseSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await updateTenantEntity(getTenantContext(req), {
      model: 'course',
      entity: 'Course',
      module: 'academics',
      id: String(req.params.id),
      data: req.body as Record<string, unknown>
    });

    res.json({ success: true, data: updated });
  })
);

router.delete('/courses/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    await prisma.course.delete({ where: { id } });
    res.json({ success: true, message: 'Course deleted' });
  } catch (error: any) {
    sendError(res, error);
  }
});

export default router;
