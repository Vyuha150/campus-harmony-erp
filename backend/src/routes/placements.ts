import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

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
      prisma.placementDrive.count({ where: { status: { in: ['active', 'ongoing', 'upcoming'] } } }),
      prisma.placementDrive.count(),
      prisma.jobOffer.count(),
      prisma.jobOffer.findMany({ select: { package: true } }),
      prisma.studentApplication.findMany({
        where: { status: 'selected' },
        select: {
          studentProfileId: true,
          drive: { select: { package: true } }
        }
      }),
      prisma.placementDrive.findMany({ distinct: ['companyId'], select: { companyId: true } })
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
    res.status(500).json({ success: false, message: error.message });
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
        resumeVerified: true,
        status: s.applications.some((a: any) => a.status === 'selected') ? 'placed' : 'eligible',
        placed: s.applications.some((a: any) => a.status === 'selected'),
        placedAt: s.applications.find((a: any) => a.status === 'selected')?.drive?.role ?? null,
        appliedCount: s.applications.length, selectedCount: s.applications.filter((a: any) => a.status === 'selected').length
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/students', authenticate, async (req: Request, res: Response) => {
  try {
    const payload = req.body ?? {};
    const name = String(payload.name || '').trim();
    const email = String(payload.email || '').trim().toLowerCase();
    const rollNumber = String(payload.rollNumber || '').trim();

    if (!name || !email || !rollNumber) {
      res.status(400).json({ success: false, message: 'Name, email and roll number are required' });
      return;
    }

    const bcrypt = await import('bcrypt');
    const hashedPassword = await bcrypt.hash(String(payload.password || 'Student@123'), 10);

    const created = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: 'student'
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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/students/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { name, email, program, branch, semester, cgpa, section, batch, admissionYear } = req.body ?? {};

    const existing = await prisma.studentProfile.findUnique({ where: { id }, select: { userId: true } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      if (name !== undefined || email !== undefined) {
        await tx.user.update({
          where: { id: existing.userId },
          data: {
            ...(name !== undefined ? { name: String(name) } : {}),
            ...(email !== undefined ? { email: String(email).toLowerCase() } : {})
          }
        });
      }

      return tx.studentProfile.update({
        where: { id },
        data: {
          ...(program !== undefined ? { program: String(program) } : {}),
          ...(branch !== undefined ? { branch: String(branch) } : {}),
          ...(semester !== undefined ? { semester: Number(semester) } : {}),
          ...(cgpa !== undefined ? { cgpa: Number(cgpa) } : {}),
          ...(section !== undefined ? { section: String(section) } : {}),
          ...(batch !== undefined ? { batch: String(batch) } : {}),
          ...(admissionYear !== undefined ? { admissionYear: Number(admissionYear) } : {})
        }
      });
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/students/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const profile = await prisma.studentProfile.findUnique({ where: { id }, select: { userId: true } });

    if (!profile) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }

    await prisma.user.delete({ where: { id: profile.userId } });
    res.json({ success: true, data: { id } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/companies', authenticate, async (req: Request, res: Response) => {
  try {
    const payload = req.body ?? {};
    const company = await prisma.company.create({
      data: {
        name: String(payload.name || '').trim(),
        industry: String(payload.industry || 'General').trim(),
        email: String(payload.email || 'na@example.com').trim(),
        website: payload.website ? String(payload.website).trim() : null,
        totalHires: Number(payload.totalHires || 0)
      }
    });
    res.json({ success: true, data: company });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/companies/:id', authenticate, async (req: Request, res: Response) => {
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/companies/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    await prisma.company.delete({ where: { id } });
    res.json({ success: true, data: { id } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Drives ───
router.get('/drives', authenticate, async (req: Request, res: Response) => {
  try {
    const drives = await prisma.placementDrive.findMany({
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/drives', authenticate, async (req: Request, res: Response) => {
  try {
    const payload = req.body ?? {};
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/drives/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const payload = req.body ?? {};
    const updated = await prisma.placementDrive.update({
      where: { id },
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
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/drives/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    await prisma.placementDrive.delete({ where: { id } });
    res.json({ success: true, data: { id } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/drives/:id/applications', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const apps = await prisma.studentApplication.findMany({
      where: { placementDriveId: id },
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/drives/:driveId/applications/:applicationId', authenticate, async (req: Request, res: Response) => {
  try {
    const driveId = String(req.params.driveId);
    const applicationId = String(req.params.applicationId);
    const status = String(req.body?.status || '').trim().toLowerCase();

    if (!['applied', 'shortlisted', 'selected', 'rejected'].includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid application status' });
      return;
    }

    const updated = await prisma.studentApplication.updateMany({
      where: { id: applicationId, placementDriveId: driveId },
      data: { status }
    });

    if (updated.count === 0) {
      res.status(404).json({ success: false, message: 'Application not found for this drive' });
      return;
    }

    res.json({ success: true, data: { id: applicationId, status } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/training', authenticate, async (req: Request, res: Response) => {
  try {
    const payload = req.body ?? {};
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
      }
    });
    res.json({ success: true, data: session });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/training/:id', authenticate, async (req: Request, res: Response) => {
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/training/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    await prisma.trainingSession.delete({ where: { id } });
    res.json({ success: true, data: { id } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Reports ───
router.get('/reports', authenticate, async (req: Request, res: Response) => {
  try {
    const [totalStudents, drives, selectedApplications, offerRows, participatingCompanies] = await Promise.all([
      prisma.studentProfile.count(),
      prisma.placementDrive.count(),
      prisma.studentApplication.findMany({
        where: { status: 'selected' },
        select: {
          studentProfileId: true,
          drive: { select: { package: true } }
        }
      }),
      prisma.jobOffer.findMany({ select: { package: true } }),
      prisma.placementDrive.findMany({ distinct: ['companyId'], select: { companyId: true } })
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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/offers/recent', authenticate, async (_req: Request, res: Response) => {
  try {
    const offers = await prisma.jobOffer.findMany({ orderBy: { offerDate: 'desc' }, take: 20 });
    res.json({ success: true, data: offers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/reports/outcomes', authenticate, async (_req: Request, res: Response) => {
  try {
    const [totalStudents, selectedApplications] = await Promise.all([
      prisma.studentProfile.count(),
      prisma.studentApplication.findMany({ where: { status: 'selected' }, select: { studentProfileId: true } })
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/reports/salary-bands', authenticate, async (_req: Request, res: Response) => {
  try {
    const [offers, selectedApplications] = await Promise.all([
      prisma.jobOffer.findMany({ select: { package: true } }),
      prisma.studentApplication.findMany({
        where: { status: 'selected' },
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/reports/generate', authenticate, async (req: Request, res: Response) => {
  try {
    const { type } = req.body;
    const data: any = { reportType: type, generatedAt: new Date() };

    if (type === 'department_wise') {
      const departments = await prisma.department.findMany();
      data.departments = departments.map((d: any) => ({ name: d.name, placed: 0, total: 0 }));
    }

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Communication ───
router.get('/messages', authenticate, async (req: Request, res: Response) => {
  try {
    const messages = await prisma.placementMessage.findMany({ orderBy: { sentAt: 'desc' } });
    res.json({ success: true, data: messages });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/messages', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const payload = req.body ?? {};
    const msg = await prisma.placementMessage.create({
      data: {
        title: String(payload.title ?? payload.subject ?? 'Placement Update'),
        content: String(payload.content ?? payload.message ?? ''),
        type: String(payload.type ?? payload.channel ?? 'announcement'),
        sentBy: userId,
        targetGroup: payload.targetGroup ? String(payload.targetGroup) : payload.targetAudience ? String(payload.targetAudience) : null
      }
    });
    res.json({ success: true, data: msg });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/communication/templates', authenticate, async (req: Request, res: Response) => {
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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
