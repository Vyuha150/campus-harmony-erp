import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { sendError } from '../lib/errors.js';
import { hashPassword, generateTemporaryPassword } from '../lib/password.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { entityId } from '../schemas/common.js';
import { deleteTenantEntity } from '../modules/common/entityDelete.service.js';
import { getTenantContext } from '../lib/tenant.js';
import {
  placementStudentCreateSchema,
  companyCreateSchema,
  companyUpdateSchema,
  driveCreateSchema,
  driveUpdateSchema,
  applicationStatusUpdateSchema,
  trainingCreateSchema,
  trainingUpdateSchema,
  placementReportGenerateSchema,
  placementMessageCreateSchema,
  communicationTemplateCreateSchema
} from '../modules/placements/placements.schemas.js';

const router = Router();
const customCommunicationTemplates: Array<{ id: string; name: string; category: string; desc: string }> = [];

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[,\s]/g, '').toLowerCase();
    if (!cleaned) return 0;
    const numeric = Number.parseFloat(cleaned.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(numeric)) return 0;
    if (cleaned.includes('cr')) return numeric * 10000000;
    if (cleaned.includes('lpa') || cleaned.includes('lac') || cleaned.includes('lakh')) return numeric * 100000;
    return numeric;
  }
  return 0;
};

const median = (arr: number[]): number => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    const left = sorted[mid - 1] ?? 0;
    const right = sorted[mid] ?? 0;
    return Math.round((left + right) / 2);
  }
  return Math.round(sorted[mid] ?? 0);
};

const buildPlacementPackages = (offerRows: any[], selectedApplications: any[]): number[] => {
  const offerPackages = (offerRows || [])
    .map((o: any) => Number(o.package || 0))
    .filter((v: number) => Number.isFinite(v) && v > 0);

  const selectedStudentBestPackage = new Map<string, number>();
  for (const app of selectedApplications || []) {
    const studentId = String(app.studentProfileId || '');
    if (!studentId) continue;
    const pkg = toNumber(app.drive?.package);
    if (!Number.isFinite(pkg) || pkg <= 0) continue;
    const prev = selectedStudentBestPackage.get(studentId) ?? 0;
    if (pkg > prev) selectedStudentBestPackage.set(studentId, pkg);
  }

  const selectedPackages = Array.from(selectedStudentBestPackage.values());
  return offerPackages.length > 0 ? offerPackages : selectedPackages;
};

// ─── Dashboard ───
router.get('/dashboard', authenticate, async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    // PlacementDrive, JobOffer and StudentApplication carry no institutionId
    // of their own — each is reached through its owning Company/StudentProfile
    // relation instead, the same pattern used for the other orphan models
    // this audit found.
    const [
      totalStudents,
      activeDrives,
      totalDrives,
      offers,
      offerRows,
      selectedApplications,
      participatingCompanies
    ] = await Promise.all([
      prisma.studentProfile.count(),
      prisma.placementDrive.count({
        where: { status: { in: ['active', 'ongoing', 'upcoming'] }, company: { institutionId: context.institutionId } }
      }),
      prisma.placementDrive.count({ where: { company: { institutionId: context.institutionId } } }),
      prisma.jobOffer.count({ where: { student: { institutionId: context.institutionId } } }),
      prisma.jobOffer.findMany({
        where: { student: { institutionId: context.institutionId } },
        select: { package: true }
      }),
      prisma.studentApplication.findMany({
        where: { status: 'selected', student: { institutionId: context.institutionId } },
        select: {
          studentProfileId: true,
          drive: { select: { package: true } }
        }
      }),
      prisma.placementDrive.findMany({
        where: { company: { institutionId: context.institutionId } },
        distinct: ['companyId'],
        select: { companyId: true }
      })
    ]);

    const placedStudentIds = new Set((selectedApplications as any[]).map((a: any) => String(a.studentProfileId)));
    const studentsPlaced = placedStudentIds.size;

    const packages = buildPlacementPackages(offerRows as any[], selectedApplications as any[]);
    const minimumPackage = packages.length > 0 ? Math.min(...packages) : 0;
    const highestPackage = packages.length > 0 ? Math.max(...packages) : 0;
    const averagePackage = packages.length > 0 ? Math.round(packages.reduce((s, v) => s + v, 0) / packages.length) : 0;
    const medianPackage = median(packages);
    const placementPercentage = totalStudents > 0 ? Math.round((studentsPlaced / totalStudents) * 100) : 0;
    const totalCompanies = participatingCompanies.length;

    res.json({
      success: true,
      data: {
        placementPercentage,
        placedStudents: studentsPlaced,
        eligibleStudents: totalStudents,
        companiesVisited: totalCompanies,
        minimumPackage,
        minPackage: minimumPackage,
        highestPackage,
        averagePackage,
        medianPackage,
        totalStudents,
        totalPlaced: studentsPlaced,
        totalCompanies,
        totalDrives,
        stats: [
          { label: "Total Companies", value: totalCompanies.toString(), icon: "Building", color: "text-blue-500" },
          { label: "Offers Made", value: (studentsPlaced + offers).toString(), icon: "Award", color: "text-green-500" },
          { label: "Active Drives", value: activeDrives.toString(), icon: "Briefcase", color: "text-purple-500" },
          { label: "Highest Package", value: highestPackage > 0 ? `₹${(highestPackage / 100000).toFixed(1)} LPA` : '₹0', icon: "IndianRupee", color: "text-yellow-600" }
        ]
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Students ───
router.get('/students', authenticate, async (req: Request, res: Response) => {
  try {
    const students = await prisma.studentProfile.findMany({
      include: { user: true, applications: { include: { drive: true } } }
    });
    res.json({
      success: true,
      data: students.map((s: any) => ({
        id: s.id, name: s.user.name, rollNumber: s.rollNumber, program: s.program,
        branch: s.branch, semester: s.semester, section: s.section, batch: s.batch, admissionYear: s.admissionYear, cgpa: s.cgpa, email: s.user.email,
        // Was `resumeVerified: true` — every student reported as having a
        // verified resume, whether or not anyone had looked at one. There is no
        // verification record in the schema, so the honest answer is that we do
        // not know.
        resumeVerified: null,
        status: s.applications.some((a: any) => a.status === 'selected') ? 'placed' : 'eligible',
        placed: s.applications.some((a: any) => a.status === 'selected'),
        placedAt: s.applications.find((a: any) => a.status === 'selected')?.drive?.role ?? null,
        appliedCount: s.applications.length, selectedCount: s.applications.filter((a: any) => a.status === 'selected').length
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Departments, for the student-onboarding form's picker.
 *
 * The only other department list is GET /admin/departments, which is mounted
 * super_admin-only, so a placement officer could not populate a picker at all —
 * which is part of why students were being created without one.
 */
router.get('/departments', authenticate, async (req: Request, res: Response) => {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true }
    });
    res.json({ success: true, data: departments });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/students', authenticate, validate({ body: placementStudentCreateSchema }), async (req: Request, res: Response) => {
  try {
    const payload = req.body ?? {};
    const name = String(payload.name || '').trim();
    const email = String(payload.email || '').trim().toLowerCase();
    const rollNumber = String(payload.rollNumber || '').trim();

    if (!name || !email || !rollNumber) {
      res.status(400).json({ success: false, message: 'Name, email and roll number are required' });
      return;
    }

    // Previously: `bcrypt.hash(String(payload.password || 'Student@123'), 10)`.
    // Omitting the password created a real student account with a password
    // published in a public repository. A temporary password is now generated
    // and returned once to the caller for out-of-band delivery.
    const temporaryPassword =
      typeof payload.password === 'string' && payload.password.length > 0
        ? payload.password
        : generateTemporaryPassword();

    const hashedPassword = await hashPassword(temporaryPassword);
    const passwordWasGenerated = payload.password !== temporaryPassword;

    // departmentId is client-supplied, so confirm it belongs to this
    // institution before writing it — the same check POST /admin/courses makes
    // for its department.
    const departmentId = payload.departmentId ? String(payload.departmentId) : null;
    if (departmentId) {
      const department = await prisma.department.findFirst({
        where: { id: departmentId, institutionId: getTenantContext(req).institutionId },
        select: { id: true }
      });
      if (!department) {
        res.status(404).json({ success: false, message: 'Department not found' });
        return;
      }
    }

    const created = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: 'student',
          // Was omitted entirely, so every student onboarded here had a null
          // departmentId and was invisible to every department-scoped view —
          // GET /hod/students filters on exactly this column, so no HOD ever
          // saw them.
          ...(departmentId ? { departmentId } : {})
        }
      });

      const student = await tx.studentProfile.create({
        data: {
          userId: user.id,
          rollNumber,
          program: String(payload.program || 'B.Tech').trim(),
          branch: String(payload.branch || 'General').trim(),
          semester: Number(payload.semester ?? 1),
          section: String(payload.section || 'A').trim(),
          batch: String(payload.batch || `${new Date().getFullYear()}`).trim(),
          admissionYear: Number(payload.admissionYear ?? new Date().getFullYear()),
          cgpa: Number(payload.cgpa ?? 0),
          totalCredits: Number(payload.totalCredits ?? 0),
          earnedCredits: Number(payload.earnedCredits ?? 0)
        }
      });

      return { user, student };
    });

    res.json({
      success: true,
      // Returned ONCE so the operator can deliver it out of band. It is not
      // stored in plaintext and cannot be retrieved again.
      ...(passwordWasGenerated ? { temporaryPassword } : {}),
      data: {
        id: created.student.id,
        userId: created.user.id,
        name: created.user.name,
        email: created.user.email,
        rollNumber: created.student.rollNumber,
        program: created.student.program,
        branch: created.student.branch,
        semester: created.student.semester,
        section: created.student.section,
        batch: created.student.batch,
        admissionYear: created.student.admissionYear,
        cgpa: created.student.cgpa
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/students/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const student = await prisma.studentProfile.findUnique({
      where: { id },
      include: { user: true, applications: { include: { drive: { include: { company: true } } } } }
    });

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        id: student.id,
        name: student.user.name,
        rollNumber: student.rollNumber,
        program: student.program,
        branch: student.branch,
        semester: student.semester,
        section: student.section,
        batch: student.batch,
        admissionYear: student.admissionYear,
        cgpa: student.cgpa,
        email: student.user.email,
        status: student.applications.some((a: any) => a.status === 'selected') ? 'placed' : 'eligible',
        applications: student.applications.map((a: any) => ({
          id: a.id,
          status: a.status,
          appliedAt: a.appliedAt,
          company: a.drive?.company?.name ?? null,
          role: a.drive?.role ?? null
        }))
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * REFUSED for academic fields.
 *
 * This accepted `program`, `branch`, `semester` and `cgpa` and wrote them to the
 * StudentProfile. A placement officer editing a CGPA is the same defect as the
 * registrar route that allowed it — except that here it is not even the office
 * that owns the data, and a CGPA is the number recruiters shortlist on.
 */
router.put('/students/:id', authenticate, async (_req: Request, res: Response) => {
  res.status(403).json({
    success: false,
    error: {
      code: 'FORBIDDEN',
      message:
        'Placements cannot amend a student record. Programme, semester and CGPA ' +
        'belong to the registrar and to published results; a CGPA edited here ' +
        'would be the figure recruiters shortlist on.'
    }
  });
});

/**
 * REFUSED, and that is the fix.
 *
 * This deleted a USER:
 *
 *     const profile = await prisma.studentProfile.findUnique({ where: { id }, select: { userId: true } });
 *     await prisma.user.delete({ where: { id: profile.userId } });
 *
 * `/api/placements` is mounted for `placement_officer`. A placement officer
 * could therefore delete a student's entire account — cascading away their
 * enrolments, results, fees and library history — from a screen about campus
 * recruitment. Nothing was audited, and nothing about the placements domain
 * makes that a reasonable thing to be able to do.
 *
 * There is no "remove from the placement pool" concept in the schema to fall
 * back on: eligibility is derived from StudentProfile, and a student's
 * involvement with a drive is a StudentApplication. Withdrawing an application
 * is what this screen actually wants, and that endpoint already exists.
 */
router.delete('/students/:id', authenticate, async (_req: Request, res: Response) => {
  res.status(403).json({
    success: false,
    error: {
      code: 'FORBIDDEN',
      message:
        'Placements cannot delete student accounts. Removing a student from the ' +
        'register is an action for the registrar; to take a student out of a drive, ' +
        'withdraw their application instead.'
    }
  });
});

// ─── Companies ───
router.get('/companies', authenticate, async (req: Request, res: Response) => {
  try {
    const companies = await prisma.company.findMany({ include: { placementDrives: true } });
    res.json({
      success: true,
      data: companies.map((c: any) => ({
        id: c.id, name: c.name, industry: c.industry, website: c.website,
        email: c.email,
        contactPerson: c.name,
        phone: '',
        address: '',
        companySize: '',
        status: 'active',
        totalHires: c.totalHires,
        totalDrives: c.placementDrives.length,
        lastVisit: c.placementDrives.length > 0 ? c.placementDrives[c.placementDrives.length - 1].driveDate : null
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/companies', authenticate, validate({ body: companyCreateSchema }), async (req: Request, res: Response) => {
  try {
    const payload = req.body ?? {};
    // institutionId is required on the model since 0038 but injected by the
    // tenant extension at runtime, not supplied here.
    const company = await prisma.company.create({
      data: {
        name: String(payload.name || '').trim(),
        industry: String(payload.industry || 'General').trim(),
        email: String(payload.email || 'na@example.com').trim(),
        website: payload.website ? String(payload.website).trim() : null,
        totalHires: Number(payload.totalHires || 0)
      } as any
    });
    res.json({ success: true, data: company });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/companies/:id', authenticate, validate({ params: z.object({ id: entityId }), body: companyUpdateSchema }), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const payload = req.body ?? {};
    const updated = await prisma.company.update({
      where: { id },
      data: {
        ...(payload.name !== undefined ? { name: String(payload.name) } : {}),
        ...(payload.industry !== undefined ? { industry: String(payload.industry) } : {}),
        ...(payload.email !== undefined ? { email: String(payload.email) } : {}),
        ...(payload.website !== undefined ? { website: payload.website ? String(payload.website) : null } : {}),
        ...(payload.totalHires !== undefined ? { totalHires: Number(payload.totalHires) } : {})
      }
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Was `prisma.company.delete({ where: { id } })` with nothing recorded.
 * Now audited, with the row captured before it goes and a reason required.
 */
router.delete(
  '/companies/:id',
  authenticate,
  validate({
    params: z.object({ id: entityId }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await deleteTenantEntity(getTenantContext(req), {
      model: 'company',
      entity: 'Company',
      module: 'placements',
      id: String(req.params.id),
      blockers: [
        { model: 'placementDrive', foreignKey: 'companyId', describe: 'placement drives' }
      ],
      reason: String(req.body.reason)
    });

    res.json({ success: true, data: result });
  })
);

// ─── Drives ───
router.get('/drives', authenticate, async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    const drives = await prisma.placementDrive.findMany({
      where: { company: { institutionId: context.institutionId } },
      include: { company: true, applications: true },
      orderBy: { driveDate: 'desc' }
    });
    res.json({
      success: true,
      data: drives.map((d: any) => ({
        id: d.id,
        role: d.role,
        jobRole: d.role,
        companyName: d.company.name,
        company: { id: d.company.id, name: d.company.name },
        companyId: d.companyId,
        driveDate: d.driveDate,
        registrationDeadline: d.registrationDeadline,
        package: { ctc: toNumber(d.package), raw: d.package },
        location: d.location,
        venue: d.location,
        status: d.status,
        registrations: d.applications.length,
        registeredStudents: d.applications.length,
        selected: d.applications.filter((a: any) => a.status === 'selected').length,
        selectedStudents: d.applications.filter((a: any) => a.status === 'selected').length,
        eligibilityCriteria: { minCGPA: null, programs: [] },
        rounds: []
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/drives', authenticate, validate({ body: driveCreateSchema }), async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    const payload = req.body ?? {};
    // PlacementDrive has no institutionId of its own — companyId is
    // client-supplied, so without this a drive could be created against
    // another institution's company.
    const company = await prisma.company.findFirst({
      where: { id: String(payload.companyId), institutionId: context.institutionId },
      select: { id: true }
    });
    if (!company) {
      res.status(404).json({ success: false, message: 'Company not found' });
      return;
    }
    const drive = await prisma.placementDrive.create({
      data: {
        companyId: String(payload.companyId),
        role: String(payload.role ?? payload.jobRole ?? 'Role'),
        package: String(payload.package?.raw ?? payload.package?.ctc ?? payload.package ?? '0'),
        driveDate: payload.driveDate ? new Date(payload.driveDate) : new Date(payload.date),
        registrationDeadline: payload.registrationDeadline
          ? new Date(payload.registrationDeadline)
          : payload.driveDate
            ? new Date(payload.driveDate)
            : new Date(payload.date),
        status: String(payload.status ?? 'upcoming'),
        location: String(payload.location ?? payload.venue ?? 'TBD'),
        jobDescription: String(payload.jobDescription ?? '')
      }
    });
    res.json({ success: true, data: drive });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/drives/:id', authenticate, validate({ params: z.object({ id: entityId }), body: driveUpdateSchema }), async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    const id = String(req.params.id);
    const payload = req.body ?? {};
    if (payload.companyId !== undefined) {
      const company = await prisma.company.findFirst({
        where: { id: String(payload.companyId), institutionId: context.institutionId },
        select: { id: true }
      });
      if (!company) {
        res.status(404).json({ success: false, message: 'Company not found' });
        return;
      }
    }
    // PlacementDrive has no institutionId of its own — `update({ where: {
    // id } })` cannot carry the institution check, so `updateMany` + a
    // company-derived filter, then re-read, is the pattern this codebase
    // uses everywhere a model has no institutionId column of its own.
    const changed = await prisma.placementDrive.updateMany({
      where: { id, company: { institutionId: context.institutionId } },
      data: {
        ...(payload.companyId !== undefined ? { companyId: String(payload.companyId) } : {}),
        ...(payload.role !== undefined || payload.jobRole !== undefined ? { role: String(payload.role ?? payload.jobRole) } : {}),
        ...(payload.package !== undefined ? { package: String(payload.package?.raw ?? payload.package?.ctc ?? payload.package) } : {}),
        ...(payload.driveDate !== undefined || payload.date !== undefined ? { driveDate: new Date(payload.driveDate ?? payload.date) } : {}),
        ...(payload.registrationDeadline !== undefined ? { registrationDeadline: new Date(payload.registrationDeadline) } : {}),
        ...(payload.status !== undefined ? { status: String(payload.status) } : {}),
        ...(payload.location !== undefined || payload.venue !== undefined ? { location: String(payload.location ?? payload.venue) } : {}),
        ...(payload.jobDescription !== undefined ? { jobDescription: String(payload.jobDescription) } : {})
      }
    });
    if (changed.count === 0) {
      res.status(404).json({ success: false, message: 'Placement drive not found' });
      return;
    }
    const updated = await prisma.placementDrive.findFirst({ where: { id } });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Was `prisma.placementDrive.delete({ where: { id } })` with nothing recorded.
 * Now audited, with the row captured before it goes and a reason required.
 */
router.delete(
  '/drives/:id',
  authenticate,
  validate({
    params: z.object({ id: entityId }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await deleteTenantEntity(getTenantContext(req), {
      model: 'placementDrive',
      entity: 'PlacementDrive',
      module: 'placements',
      id: String(req.params.id),
      blockers: [
        { model: 'studentApplication', foreignKey: 'placementDriveId', describe: 'student applications' }
      ],
      reason: String(req.body.reason),
      // PlacementDrive has no institutionId of its own — Prisma throws
      // "Unknown argument institutionId" without this (found live, see
      // entityDelete.service.ts). Company is tenant-owned, so this reaches it.
      scopeWhere: (institutionId) => ({ company: { institutionId } })
    });

    res.json({ success: true, data: result });
  })
);

router.get('/drives/:id/applications', authenticate, async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    const id = String(req.params.id);
    const apps = await prisma.studentApplication.findMany({
      where: { placementDriveId: id, drive: { company: { institutionId: context.institutionId } } },
      include: { student: { include: { user: true } } }
    });
    res.json({
      success: true,
      data: apps.map((a: any) => ({
        id: a.id, studentId: a.studentId, studentName: a.student.user.name,
        rollNumber: a.student.rollNumber, cgpa: a.student.cgpa,
        status: a.status, appliedAt: a.appliedAt
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/drives/:driveId/applications/:applicationId', authenticate, validate({ params: z.object({ driveId: entityId, applicationId: entityId }), body: applicationStatusUpdateSchema }), async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    const driveId = String(req.params.driveId);
    const applicationId = String(req.params.applicationId);
    const status = String(req.body?.status || '').trim().toLowerCase();

    if (!['applied', 'shortlisted', 'selected', 'rejected'].includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid application status' });
      return;
    }

    const updated = await prisma.studentApplication.updateMany({
      where: { id: applicationId, placementDriveId: driveId, drive: { company: { institutionId: context.institutionId } } },
      data: { status }
    });

    if (updated.count === 0) {
      res.status(404).json({ success: false, message: 'Application not found for this drive' });
      return;
    }

    res.json({ success: true, data: { id: applicationId, status } });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Training ───
router.get('/training', authenticate, async (req: Request, res: Response) => {
  try {
    const sessions = await prisma.trainingSession.findMany({ orderBy: { date: 'desc' } });
    res.json({
      success: true,
      data: sessions.map((s: any) => ({
        ...s,
        materials: Array.isArray(s.materials) ? s.materials : []
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/training', authenticate, validate({ body: trainingCreateSchema }), async (req: Request, res: Response) => {
  try {
    const payload = req.body ?? {};
    // institutionId is required on the model since 0038 but injected by the
    // tenant extension at runtime, not supplied here.
    const session = await prisma.trainingSession.create({
      data: {
        title: String(payload.title ?? 'Training Session'),
        type: String(payload.type ?? 'soft_skills'),
        instructor: String(payload.instructor ?? 'TBD'),
        date: new Date(payload.date),
        duration: Number(payload.duration ?? 60),
        venue: String(payload.venue ?? 'TBD'),
        maxCapacity: Number(payload.maxCapacity ?? 100),
        registeredCount: Number(payload.registeredCount ?? 0),
        status: String(payload.status ?? 'scheduled'),
        description: payload.description ? String(payload.description) : null,
        materials: Array.isArray(payload.materials) ? payload.materials : []
      } as any
    });
    res.json({ success: true, data: session });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/training/:id', authenticate, validate({ params: z.object({ id: entityId }), body: trainingUpdateSchema }), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const payload = req.body ?? {};
    const updated = await prisma.trainingSession.update({
      where: { id },
      data: {
        ...(payload.title !== undefined ? { title: String(payload.title) } : {}),
        ...(payload.type !== undefined ? { type: String(payload.type) } : {}),
        ...(payload.instructor !== undefined ? { instructor: String(payload.instructor) } : {}),
        ...(payload.date !== undefined ? { date: new Date(payload.date) } : {}),
        ...(payload.duration !== undefined ? { duration: Number(payload.duration) } : {}),
        ...(payload.venue !== undefined ? { venue: String(payload.venue) } : {}),
        ...(payload.maxCapacity !== undefined ? { maxCapacity: Number(payload.maxCapacity) } : {}),
        ...(payload.registeredCount !== undefined ? { registeredCount: Number(payload.registeredCount) } : {}),
        ...(payload.status !== undefined ? { status: String(payload.status) } : {}),
        ...(payload.description !== undefined ? { description: payload.description ? String(payload.description) : null } : {}),
        ...(payload.materials !== undefined ? { materials: Array.isArray(payload.materials) ? payload.materials : [] } : {})
      }
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Was `prisma.trainingSession.delete({ where: { id } })` with nothing recorded.
 * Now audited, with the row captured before it goes and a reason required.
 */
router.delete(
  '/training/:id',
  authenticate,
  validate({
    params: z.object({ id: entityId }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await deleteTenantEntity(getTenantContext(req), {
      model: 'trainingSession',
      entity: 'TrainingSession',
      module: 'placements',
      id: String(req.params.id),
      reason: String(req.body.reason)
    });

    res.json({ success: true, data: result });
  })
);

// ─── Reports ───
router.get('/reports', authenticate, async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    const [totalStudents, drives, selectedApplications, offerRows, participatingCompanies] = await Promise.all([
      prisma.studentProfile.count(),
      prisma.placementDrive.count({ where: { company: { institutionId: context.institutionId } } }),
      prisma.studentApplication.findMany({
        where: { status: 'selected', student: { institutionId: context.institutionId } },
        select: {
          studentProfileId: true,
          drive: { select: { package: true } }
        }
      }),
      prisma.jobOffer.findMany({
        where: { student: { institutionId: context.institutionId } },
        select: { package: true }
      }),
      prisma.placementDrive.findMany({
        where: { company: { institutionId: context.institutionId } },
        distinct: ['companyId'],
        select: { companyId: true }
      })
    ]);

    const placedStudentIds = new Set((selectedApplications as any[]).map((a: any) => String(a.studentProfileId)));
    const totalPlaced = placedStudentIds.size;

    const packages = buildPlacementPackages(offerRows as any[], selectedApplications as any[]);
    const minimumPackage = packages.length > 0 ? Math.min(...packages) : 0;
    const highestPackage = packages.length > 0 ? Math.max(...packages) : 0;
    const averagePackage = packages.length > 0 ? Math.round(packages.reduce((s, v) => s + v, 0) / packages.length) : 0;
    const medianPackage = median(packages);

    res.json({
      success: true,
      data: {
        totalStudents, totalPlaced, placementPercentage: totalStudents > 0 ? Math.round((totalPlaced / totalStudents) * 100) : 0,
        totalCompanies: participatingCompanies.length, totalDrives: drives,
        minimumPackage,
        minPackage: minimumPackage,
        highestPackage,
        averagePackage,
        medianPackage
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/analytics/department-wise', authenticate, async (_req: Request, res: Response) => {
  try {
    const students = await prisma.studentProfile.findMany({
      select: {
        id: true,
        branch: true,
        applications: { select: { status: true } }
      }
    });

    const grouped = new Map<string, { dept: string; total: number; placed: number }>();
    for (const s of students as any[]) {
      const key = String(s.branch || 'Unknown');
      const item = grouped.get(key) ?? { dept: key, total: 0, placed: 0 };
      item.total += 1;
      if ((s.applications || []).some((a: any) => a.status === 'selected')) item.placed += 1;
      grouped.set(key, item);
    }

    res.json({ success: true, data: Array.from(grouped.values()) });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/offers/recent', authenticate, async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    const offers = await prisma.jobOffer.findMany({
      where: { student: { institutionId: context.institutionId } },
      orderBy: { offerDate: 'desc' },
      take: 20
    });
    res.json({ success: true, data: offers });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/reports/department-wise', authenticate, async (_req: Request, res: Response) => {
  try {
    const students = await prisma.studentProfile.findMany({
      select: {
        branch: true,
        applications: { select: { status: true } }
      }
    });

    const grouped = new Map<string, { dept: string; total: number; placed: number }>();
    for (const s of students as any[]) {
      const key = String(s.branch || 'Unknown');
      const item = grouped.get(key) ?? { dept: key, total: 0, placed: 0 };
      item.total += 1;
      if ((s.applications || []).some((a: any) => a.status === 'selected')) item.placed += 1;
      grouped.set(key, item);
    }

    res.json({ success: true, data: Array.from(grouped.values()) });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/reports/outcomes', authenticate, async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    const [totalStudents, selectedApplications] = await Promise.all([
      prisma.studentProfile.count(),
      prisma.studentApplication.findMany({
        where: { status: 'selected', student: { institutionId: context.institutionId } },
        select: { studentProfileId: true }
      })
    ]);

    const selected = new Set((selectedApplications as any[]).map((a: any) => String(a.studentProfileId))).size;

    const unplaced = Math.max(0, totalStudents - selected);
    res.json({
      success: true,
      data: [
        { name: 'Placed', value: selected },
        { name: 'Seeking', value: unplaced }
      ]
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/reports/salary-bands', authenticate, async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    const [offers, selectedApplications] = await Promise.all([
      prisma.jobOffer.findMany({
        where: { student: { institutionId: context.institutionId } },
        select: { package: true }
      }),
      prisma.studentApplication.findMany({
        where: { status: 'selected', student: { institutionId: context.institutionId } },
        select: { studentProfileId: true, drive: { select: { package: true } } }
      })
    ]);

    const packages = buildPlacementPackages(offers as any[], selectedApplications as any[]);

    const bands = [
      { band: '< 5 LPA', min: 0, max: 500000, count: 0 },
      { band: '5 - 10 LPA', min: 500000, max: 1000000, count: 0 },
      { band: '10 - 20 LPA', min: 1000000, max: 2000000, count: 0 },
      { band: '> 20 LPA', min: 2000000, max: Number.POSITIVE_INFINITY, count: 0 }
    ];

    for (const pkg of packages) {
      const band = bands.find((b) => pkg >= b.min && pkg < b.max);
      if (band) band.count += 1;
    }

    res.json({ success: true, data: bands.map(({ band, count }) => ({ band, count })) });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/reports/generate', authenticate, validate({ body: placementReportGenerateSchema }), async (req: Request, res: Response) => {
  try {
    const { type, period, notes } = req.body;

    // REMOVED: a `type === 'department_wise'` branch that listed every
    // department with `placed: 0, total: 0` — hardcoded literals, not counts
    // of anything. No caller sends that type (the three report buttons send
    // training_attendance, internship_completion and a free-text
    // performance type), so it was dead code whose only output was fabricated
    // placement figures. Real per-department placement counts belong in a
    // reporting implementation that reads placement records, not here.
    const data: any = {
      reportType: type,
      ...(period !== undefined ? { period } : {}),
      ...(notes !== undefined ? { notes } : {}),
      generatedAt: new Date()
    };

    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Communication ───
router.get('/messages', authenticate, async (req: Request, res: Response) => {
  try {
    const messages = await prisma.placementMessage.findMany({ orderBy: { sentAt: 'desc' } });
    res.json({ success: true, data: messages });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/messages', authenticate, validate({ body: placementMessageCreateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const payload = req.body ?? {};
    // institutionId is required on the model since 0038 but injected by the
    // tenant extension at runtime, not supplied here.
    const msg = await prisma.placementMessage.create({
      data: {
        title: String(payload.title ?? payload.subject ?? 'Placement Update'),
        content: String(payload.content ?? payload.message ?? ''),
        type: String(payload.type ?? payload.channel ?? 'announcement'),
        sentBy: userId,
        targetGroup: payload.targetGroup ? String(payload.targetGroup) : payload.targetAudience ? String(payload.targetAudience) : null
      } as any
    });
    res.json({ success: true, data: msg });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/communication/recent', authenticate, async (_req: Request, res: Response) => {
  try {
    const messages = await prisma.placementMessage.findMany({ orderBy: { sentAt: 'desc' }, take: 20 });
    res.json({
      success: true,
      data: messages.map((m: any) => ({
        id: m.id,
        subject: m.title,
        recipients: m.targetGroup || 'All Eligible Students',
        sentAt: m.sentAt,
        channel: m.type,
        readRate: 'N/A',
        status: 'sent'
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/communication/templates', authenticate, async (_req: Request, res: Response) => {
  try {
    const defaultTemplates = [
      { id: 'drive-announce', name: 'Drive Announcement', category: 'drive', desc: 'Notify eligible students about a new drive.' },
      { id: 'deadline-reminder', name: 'Deadline Reminder', category: 'reminder', desc: 'Remind students before registration closes.' },
      { id: 'results-update', name: 'Results Update', category: 'result', desc: 'Share shortlist/selection updates with students.' }
    ];

    res.json({
      success: true,
      data: [...defaultTemplates, ...customCommunicationTemplates]
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/communication/templates', authenticate, validate({ body: communicationTemplateCreateSchema }), async (req: Request, res: Response) => {
  try {
    const payload = req.body ?? {};
    const template = {
      id: `custom-${Date.now()}`,
      name: String(payload.name || 'Custom Template').trim(),
      category: String(payload.category || 'custom').trim(),
      desc: String(payload.desc || '').trim()
    };

    customCommunicationTemplates.push(template);
    res.json({ success: true, data: template });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/communication/stats', authenticate, async (_req: Request, res: Response) => {
  try {
    const messagesSent = await prisma.placementMessage.count();
    const whatsappDelivered = await prisma.placementMessage.count({ where: { type: { contains: 'whatsapp' } } });
    res.json({
      success: true,
      data: {
        messagesSent,
        averageReadRate: 'N/A',
        whatsappDelivered,
        pendingSends: 0
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

export default router;
