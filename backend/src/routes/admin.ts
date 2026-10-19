import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { prisma, pingDatabase } from '../lib/prisma.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { hashPassword } from '../lib/password.js';
import { NotFoundError, sendError } from '../lib/errors.js';
import { recordFromRequest } from '../lib/audit.js';
import { notifyInApp } from '../lib/inAppNotify.js';
import * as adminService from '../modules/admin/admin.service.js';
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
import { deleteTenantEntity } from '../modules/common/entityDelete.service.js';
import {
  updateCourseSchema
} from '../modules/common/entityUpdate.schemas.js';
import {
  academicYearCreateSchema,
  systemNotificationCreateSchema
} from '../modules/common/legacyWrite.schemas.js';
import {
  adminUserCreateSchema,
  adminUserUpdateSchema,
  academicYearUpdateSchema,
  adminCourseCreateSchema
} from '../modules/admin/admin.schemas.js';

const router = Router();
const db: any = prisma;

// ─── Dashboard ───
router.get('/dashboard', authenticate, async (req: Request, res: Response) => {
  try {
    const totalUsers = await prisma.user.count();
    const students = await prisma.user.count({ where: { role: 'student' } });
    const faculty = await prisma.user.count({ where: { role: 'faculty' } });
    const incidents = await prisma.incidentReport.count({ where: { status: 'pending' } });

    // `status: 'operational', uptime: '99.9%'` were literals — a health claim
    // and a specific reliability percentage that no monitoring in this system
    // has ever measured. `status` is now a real database check, the same one
    // `/api/ready` performs; `uptime` is this PROCESS's real uptime since its
    // last start (Node's own `process.uptime()`), not a historical SLA figure —
    // this system does not track the latter, and inventing one would be the
    // same defect with a decimal point added for plausibility.
    let dbConnected = true;
    try {
      await pingDatabase();
    } catch {
      dbConnected = false;
    }

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
          status: dbConnected ? 'operational' : 'degraded',
          processUptimeSeconds: Math.floor(process.uptime())
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
      take: 2000,
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

router.post('/users', authenticate, validate({ body: adminUserCreateSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = getTenantContext(req);
    const { name, email, password, role, departmentId, designation } = req.body;

    // Previously: `bcrypt.hash(password || 'password123', 10)` — omitting the
    // password silently created a real account with a password published in a
    // public repository. hashPassword() requires and validates it instead.
    // Reject an unrecognised role before the account exists, rather than after.
    adminService.assertKnownRole(String(role));
    if (role === 'hod') {
      res.status(409).json({ success: false, message: 'Create the account as faculty, then appoint them from System Configuration → Departments → Change HOD.' });
      return;
    }

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

router.put('/users/:id', authenticate, validate({ body: adminUserUpdateSchema }), async (req: Request, res: Response, next: NextFunction) => {
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

    // The field was whitelisted but its VALUE was not checked: any string was
    // accepted, so a user could be given a role no route recognises (locking
    // them out silently) or one granting more than intended. This also refuses a
    // change that would leave the institution with no administrator.
    if (typeof data.role === 'string') {
      await adminService.assertRoleChangeAllowed(getTenantContext(req), id, data.role);
      // Making someone HOD (or un-making one) here left two HODs in a department,
      // or a department with none and Department.hodUserId pointing at a faculty
      // member. It is done from System Configuration -> Departments -> Change HOD.
      if ((data.role === 'hod') !== (existing.role === 'hod')) {
        res.status(409).json({ success: false, message: 'HOD is a department position. Use System Configuration → Departments → Change HOD.' });
        return;
      }
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

/**
 * Was `prisma.user.delete({ where: { id } })` and nothing else — an account
 * removed with no record of who did it or what the account was, in the module
 * whose whole purpose is controlling access.
 */
router.delete(
  '/users/:id',
  authenticate,
  authorizeRoles('super_admin'),
  validate({
    params: z.object({ id: entityId }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await adminService.deleteUser(
      getTenantContext(req),
      String(req.params.id),
      String(req.body.reason)
    );
    res.json({ success: true, data: result });
  })
);

// ─── System Configuration ───
/**
 * The institution's own particulars.
 *
 * Every field here used to be a STRING LITERAL in this handler, including
 * `accreditation: 'NAAC A+'` — an accreditation grade reported to every caller
 * of every deployment regardless of what had actually been awarded. The
 * Institution row carries real naacGrade / aisheCode / nirfId columns; where one
 * is unrecorded this now returns null rather than inventing a regulator's
 * finding.
 */
router.get(
  '/config',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = getTenantContext(req);
    const [institution, departments, academicYears] = await Promise.all([
      adminService.institutionConfig(ctx),
      prisma.department.findMany({ take: 200 }),
      db.academicYear.findMany({ orderBy: { year: 'desc' }, take: 100 })
    ]);

    const full: any = await prisma.institution.findFirst({ where: { id: ctx.institutionId } });
    // The page reads `university`; it received `institution` and showed blanks.
    const university = {
      name: full?.name ?? '', code: full?.code ?? '', type: full?.type ?? '', accreditation: full?.naacGrade ?? '',
      website: full?.website ?? '', email: full?.email ?? '', phone: full?.phone ?? '',
      established: full?.establishedAt ? String(new Date(full.establishedAt).getFullYear()) : '',
      // Street only: city, state and PIN are their own columns. Joining them here
      // and saving the joined text back duplicated them on every save.
      address: full?.addressLine ?? '',
      aisheCode: full?.aisheCode ?? '', nirfId: full?.nirfId ?? ''
    };
    res.json({ success: true, data: { institution, university, departments, academicYears } });
  })
);

const configSchema = z.object({
  university: z.object({
    name: z.string().trim().min(2).max(200).optional(),
    type: z.string().trim().max(60).optional(),
    accreditation: z.string().trim().max(20).optional(),
    website: z.string().trim().max(200).optional(),
    email: z.string().trim().max(200).optional(),
    phone: z.string().trim().max(40).optional(),
    established: z.union([z.string(), z.number()]).optional(),
    address: z.string().trim().max(500).optional(),
    aisheCode: z.string().trim().max(40).optional(),
    nirfId: z.string().trim().max(40).optional()
  }).passthrough()
}).passthrough();

/** Was a no-op that answered "Configuration updated" and saved nothing. */
router.put('/config', authenticate, validate({ body: configSchema }), asyncHandler(async (req: Request, res: Response) => {
  const ctx = getTenantContext(req);
  const u = req.body.university as Record<string, any>;
  const data: Record<string, unknown> = {};
  if (u.name) data.name = u.name;
  if (u.type !== undefined) data.type = u.type;
  if (u.accreditation !== undefined) data.naacGrade = u.accreditation || null;
  for (const k of ['website', 'email', 'phone', 'aisheCode', 'nirfId']) if (u[k] !== undefined) data[k] = u[k] || null;
  if (u.address !== undefined) data.addressLine = u.address || null;
  const year = Number(u.established);
  if (Number.isInteger(year) && year > 1800 && year <= new Date().getFullYear()) data.establishedAt = new Date(Date.UTC(year, 0, 1));
  const before = await prisma.institution.findFirst({ where: { id: ctx.institutionId } });
  await prisma.institution.updateMany({ where: { id: ctx.institutionId }, data });
  await recordFromRequest(req, { action: 'UPDATE', module: 'admin', resource: `Institution:${ctx.institutionId}`, details: 'Updated the institution profile', oldValue: before as never, newValue: data as never, severity: 'warning' });
  res.json({ success: true, data });
}));

// ─── Departments ───
router.get('/departments', authenticate, async (req: Request, res: Response) => {
  try {
    const departments = await prisma.department.findMany({
      include: { users: { select: { id: true, name: true, email: true, role: true, designation: true } }, courses: { select: { id: true } }, programmes: { select: { id: true } } },
      orderBy: { name: 'asc' }
    });
    res.json({
      success: true,
      data: departments.map((d: any) => {
        const hod = d.users.find((u: any) => u.role === 'hod') ?? null;
        return {
          id: d.id, name: d.name, code: d.code, isActive: d.isActive !== false, status: d.isActive === false ? 'inactive' : 'active',
          hod: hod ? hod.name : null, hodUserId: hod?.id ?? null, hodEmail: hod?.email ?? null,
          faculty: d.users.filter((u: any) => u.role === 'faculty').length,
          students: d.users.filter((u: any) => u.role === 'student').length,
          courses: d.courses.length, programs: d.programmes.length
        };
      })
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

const createDepartmentSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    code: z.string().trim().min(1).max(20),
    campusId: z.string().trim().min(1).max(80).nullable().optional(),
    schoolId: z.string().trim().min(1).max(80).nullable().optional(),
    hodUserId: z.string().trim().min(1).max(80).nullable().optional(),
    isActive: z.boolean().optional()
  })
  .strict();

/**
 * Create a department.
 *
 * WHAT THIS REPLACES: `prisma.department.create({ data: req.body })`.
 *
 * Two defects, and neither was visible to the type checker — `req.body` is
 * `any`, so this compiled cleanly while accepting anything:
 *
 *   1. Unrestricted mass assignment. Every column was writable, including
 *      `institutionId` itself, so a caller could create a department inside
 *      ANOTHER institution simply by naming it. That is the reverse of the
 *      cross-tenant read problem and strictly worse, because it plants a row
 *      rather than reading one.
 *
 *   2. No tenant key was set when the caller did not supply one, so departments
 *      were created with a NULL institution and then invisible to every scoped
 *      query. Impossible after migration 0030, which is what surfaced this.
 *
 * The institution now comes from the creator's own context and is never read
 * from the request.
 */
router.post(
  '/departments',
  authenticate,
  validate({ body: createDepartmentSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = getTenantContext(req);
    const body = req.body as z.infer<typeof createDepartmentSchema>;

    const dept = await prisma.department.create({
      data: withInstitution(ctx, {
        name: body.name,
        code: body.code,
        campusId: ctx.scopeLevel === 'CAMPUS' ? ctx.campusId : (body.campusId ?? null),
        schoolId: body.schoolId ?? null,
        hodUserId: body.hodUserId ?? null,
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {})
      })
    });

    await recordFromRequest(req, {
      action: 'CREATE',
      module: 'admin',
      resource: `Department:${dept.id}`,
      details: `Created department ${dept.code} - ${dept.name}`,
      newValue: { name: dept.name, code: dept.code }
    });

    res.status(201).json({ success: true, data: dept });
  })
);

// ─── Department leadership ───
const deptParams = z.object({ id: entityId });

/** Rename, recode, or activate / deactivate a department (the toggle only changed the screen). */
router.put(
  '/departments/:id',
  authenticate,
  validate({ params: deptParams, body: z.object({ name: z.string().trim().min(2).max(160).optional(), code: z.string().trim().min(1).max(20).optional(), isActive: z.boolean().optional() }).strict() }),
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = getTenantContext(req);
    const dept: any = await prisma.department.findFirst({ where: { id: String(req.params.id), institutionId: ctx.institutionId } });
    if (!dept) throw new NotFoundError('Department');
    await prisma.department.updateMany({ where: { id: dept.id }, data: req.body });
    await recordFromRequest(req, { action: 'UPDATE', module: 'admin', resource: `Department:${dept.id}`, details: `Updated department ${dept.code}`, oldValue: { name: dept.name, code: dept.code, isActive: dept.isActive }, newValue: req.body, severity: 'warning' });
    res.json({ success: true, data: { ...dept, ...req.body } });
  })
);

/** Staff of a department — the people who can be appointed HOD. */
router.get(
  '/departments/:id/staff',
  authenticate,
  validate({ params: deptParams }),
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = getTenantContext(req);
    const staff = await prisma.user.findMany({
      where: { institutionId: ctx.institutionId, departmentId: String(req.params.id), role: { in: ['faculty', 'hod'] } },
      select: { id: true, name: true, email: true, role: true, designation: true },
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, data: staff });
  })
);

/**
 * Appoint, replace or remove a department's HOD.
 *
 * HOD is a POSITION held by a faculty member, not a separate person: the
 * outgoing HOD returns to the faculty role (keeping their profile, courses and
 * history), the incoming one gains the HOD role, and Department.hodUserId
 * follows. Requests already waiting at the HOD step move to the new HOD,
 * because the HOD inbox is the department's, not the person's. Access changes on
 * the very next request — roles are read from the database, not the token.
 */
router.put(
  '/departments/:id/hod',
  authenticate,
  validate({ params: deptParams, body: z.object({ userId: entityId.nullable(), reason: z.string().trim().min(10).max(500) }).strict() }),
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = getTenantContext(req);
    const dept: any = await prisma.department.findFirst({ where: { id: String(req.params.id), institutionId: ctx.institutionId } });
    if (!dept) throw new NotFoundError('Department');
    const outgoing: any = await prisma.user.findFirst({ where: { institutionId: ctx.institutionId, departmentId: dept.id, role: 'hod' }, include: { facultyProfile: true } });
    const { userId, reason } = req.body as { userId: string | null; reason: string };

    let incoming: any = null;
    if (userId) {
      incoming = await prisma.user.findFirst({ where: { id: userId, institutionId: ctx.institutionId }, include: { facultyProfile: true } });
      if (!incoming) throw new NotFoundError('User');
      if (incoming.role === 'hod' && incoming.departmentId === dept.id) {
        res.status(409).json({ success: false, message: `${incoming.name} is already the HOD of ${dept.name}.` });
        return;
      }
      if (incoming.role !== 'faculty' || incoming.departmentId !== dept.id) {
        res.status(400).json({ success: false, message: `Only a faculty member of ${dept.name} can be appointed its HOD.` });
        return;
      }
    } else if (!outgoing) {
      res.status(409).json({ success: false, message: `${dept.name} has no HOD to remove.` });
      return;
    }

    // Every HOD must be able to work as faculty again; the seed CSE HOD had no profile.
    const ensureFacultyProfile = async (u: any) => {
      if (u.facultyProfile) return;
      await prisma.facultyProfile.create({ data: { institutionId: ctx.institutionId, userId: u.id, employeeId: `EMP-${u.id.slice(-6).toUpperCase()}` } as never });
    };

    if (outgoing) {
      await ensureFacultyProfile(outgoing);
      await prisma.user.updateMany({
        where: { id: outgoing.id },
        // "Head of Department" is the position, not a cadre; they keep their cadre.
        data: { role: 'faculty', ...(outgoing.designation === 'Head of Department' ? { designation: 'Professor' } : {}) }
      });
    }
    if (incoming) {
      await ensureFacultyProfile(incoming);
      await prisma.user.updateMany({ where: { id: incoming.id }, data: { role: 'hod' } });
    }
    await prisma.department.updateMany({ where: { id: dept.id }, data: { hodUserId: incoming?.id ?? null } });

    await recordFromRequest(req, {
      action: 'UPDATE', module: 'admin', resource: `Department:${dept.id}`,
      details: incoming ? `${dept.code} HOD: ${outgoing?.name ?? 'vacant'} → ${incoming.name}` : `${dept.code} HOD ${outgoing.name} removed; post vacant`,
      oldValue: { hodUserId: outgoing?.id ?? null }, newValue: { hodUserId: incoming?.id ?? null }, reason, severity: 'critical'
    });

    if (outgoing) {
      await notifyInApp(ctx.institutionId, { userIds: [outgoing.id] }, {
        eventType: 'department.hod_changed', subject: `You are no longer HOD of ${dept.name}`,
        body: incoming ? `${incoming.name} takes over. You continue as faculty.` : 'The post is vacant for now. You continue as faculty.',
        relatedEntityType: 'Department', relatedEntityId: dept.id
      });
    }
    if (incoming) {
      await notifyInApp(ctx.institutionId, { userIds: [incoming.id] }, {
        eventType: 'department.hod_changed', subject: `You are now HOD of ${dept.name}`,
        body: 'Sign in again to see the HOD dashboard. Requests waiting at the HOD step are now yours.',
        relatedEntityType: 'Department', relatedEntityId: dept.id
      });
    }
    const announcement = {
      eventType: 'department.hod_changed', subject: incoming ? `${dept.code}: ${incoming.name} appointed HOD` : `${dept.code}: HOD post vacant`,
      body: reason, relatedEntityType: 'Department', relatedEntityId: dept.id
    };
    const informed = [outgoing?.id, incoming?.id].filter(Boolean) as string[];
    const colleagues = await prisma.user.findMany({ where: { institutionId: ctx.institutionId, departmentId: dept.id, role: 'faculty', id: { notIn: informed } }, select: { id: true } });
    if (colleagues.length) await notifyInApp(ctx.institutionId, { userIds: colleagues.map((c: any) => c.id) }, announcement);
    await notifyInApp(ctx.institutionId, { roles: ['dean', 'principal', 'registrar'], excludeUserId: ctx.userId }, announcement);

    res.json({ success: true, data: { departmentId: dept.id, outgoing: outgoing ? { id: outgoing.id, name: outgoing.name } : null, incoming: incoming ? { id: incoming.id, name: incoming.name } : null } });
  })
);

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

// Was `authorizeRoles('dean')` — copied from the unrelated dean-facing
// POST /dean/semester-management/academic-years (dean.ts), which is mounted
// under /api/dean and legitimately dean-only. This route is mounted under
// the super_admin-only /api/admin and is the one AdminSystemConfig.tsx (the
// "Super Admin Portal" screen, App.tsx) actually calls — no dean ever
// reaches it, and the super_admin who does was rejected by this leftover
// check. Confirmed live: a super_admin request got "Access denied for this
// role" before this fix.
router.post('/academic-years', authenticate,
  validate({ body: academicYearCreateSchema }),
  async (req: Request, res: Response) => {
  try {
    const yearValue = String(req.body?.year || '').trim();
    if (!yearValue) {
      return res.status(400).json({ success: false, message: 'Academic year is required' });
    }

    // Was `findUnique({ where: { year: yearValue } })` — a standalone lookup
    // on a field that hasn't been globally unique since migration 0030 made
    // academic years per-institution (`@@unique([institutionId, year])`).
    // Prisma rejects that shape outright ("needs at least one of `id` or
    // `institutionId_year`"), so this route has thrown a 500 on every create
    // since that migration landed — the duplicate check never ran because
    // the call itself never completed.
    const context = getTenantContext(req);
    const existing = await db.academicYear.findFirst({
      where: { institutionId: context.institutionId, year: yearValue }
    });
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

router.put('/academic-years/:id', authenticate, validate({ body: academicYearUpdateSchema }), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const payload = req.body ?? {};

    // Was `if (payload.semesters !== undefined && userRole !== 'dean') 403`.
    // This route is mounted under /api/admin, behind authorizeRoles('super_admin')
    // (server.ts) — no dean request ever reaches it, so the check rejected
    // every caller who included `semesters`, which AdminSystemConfig.tsx (the
    // only frontend caller) always does. Confirmed live: a super_admin update
    // with `semesters` got "Only dean can create semesters" before this fix.
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
    const context = getTenantContext(req);
    const query = req.query as Record<string, string | undefined>;
    const userId = query.userId;
    const action = query.action;
    const mod = query.module;
    const startDate = query.startDate;
    const endDate = query.endDate;
    // SystemAuditLog has no institutionId of its own, but a real relation
    // (userId -> User, added in 0019) — reach it through that instead.
    const where: any = { user: { institutionId: context.institutionId } };
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

router.post('/notifications', authenticate,
  validate({ body: systemNotificationCreateSchema }),
  async (req: Request, res: Response) => {
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
router.get('/analytics/login-trend', authenticate, async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    const now = new Date();
    const points = [] as Array<{ time: string; users: number }>;

    for (let i = 11; i >= 0; i -= 1) {
      const start = new Date(now);
      start.setHours(now.getHours() - i, 0, 0, 0);
      const end = new Date(start);
      end.setHours(start.getHours() + 1);

      // SystemAuditLog has no institutionId of its own — reach it through
      // the (tenant-owned, auto-scoped) User relation instead.
      const users = await db.systemAuditLog.count({
        where: {
          action: { contains: 'login', mode: 'insensitive' },
          timestamp: { gte: start, lt: end },
          user: { institutionId: context.institutionId }
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

router.get('/analytics/module-usage', authenticate, async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    const grouped = await db.systemAuditLog.groupBy({
      by: ['module'],
      where: { user: { institutionId: context.institutionId } },
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

// Was `authorizeRoles('hod', 'dean')` — but this router is mounted at
// `/api/admin` behind `authorizeRoles('super_admin')` (server.ts), which runs
// BEFORE this middleware. No hod or dean request ever reaches past the
// mount, and no super_admin request passed this check either: the route was
// unreachable by every role. No frontend caller exists for course creation
// under any path (`/admin`, `/hod`, or `/dean`), so there is no working
// alternative this duplicates — removed rather than widened, matching the
// GET and DELETE routes for this same resource, which rely on the mount.
router.post('/courses', authenticate, validate({ body: adminCourseCreateSchema }), async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    const { code, name, credits, semester, departmentId, facultyId } = req.body;

    // departmentId is client-supplied — Course's institutionId is injected
    // automatically on create (it's tenant-owned), but nothing stopped a
    // course from being created with the caller's own institutionId and a
    // DIFFERENT institution's departmentId, which is its own integrity break
    // even though it isn't a read leak.
    const department = await prisma.department.findFirst({
      where: { id: departmentId, institutionId: context.institutionId },
      select: { id: true }
    });
    if (!department) {
      res.status(404).json({ success: false, message: 'Department not found' });
      return;
    }

    if (facultyId) {
      const faculty = await prisma.facultyProfile.findFirst({
        where: { id: facultyId, institutionId: context.institutionId },
        select: { id: true }
      });
      if (!faculty) {
        res.status(404).json({ success: false, message: 'Faculty not found' });
        return;
      }
    }

    const course = await prisma.course.create({
      data: { code, name, credits, semester, departmentId, ...(facultyId && { facultyId }) }
    });
    res.json({ success: true, data: course });
  } catch (error: any) {
    sendError(res, error);
  }
});

// Same contradiction as the POST above: unreachable by any role, since this
// router sits behind the super_admin-only /api/admin mount. Removed for the
// same reason.
router.put(
  '/courses/:id',
  authenticate,
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

/**
 * Was `prisma.course.delete({ where: { id } })` — no audit trail, no reason,
 * and no check for what it takes with it. Most of Course's relations cascade
 * (CourseClass, CourseSchedule, FacultyLessonPlan, Enrollment, Examination,
 * AttendanceSession, FeedbackForm all `onDelete: Cascade`), so this one call
 * could silently erase a semester's enrolments, attendance and exam records.
 * Blocked instead where a real academic record already exists — a course
 * that has never been taught can still go.
 */
router.delete(
  '/courses/:id',
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
      reason: String(req.body.reason),
      blockers: [
        { model: 'enrollment', foreignKey: 'courseId', describe: 'enrolments' },
        { model: 'courseClass', foreignKey: 'courseId', describe: 'class sections' }
      ]
    });

    res.json({ success: true, data: result });
  })
);

export default router;
