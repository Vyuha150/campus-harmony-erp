import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

function normalizeText(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeSemester(value: unknown) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

// ─── Dashboard ───
router.get('/dashboard', authenticate, async (req: Request, res: Response) => {
  try {
    const activeStudents = await prisma.user.count({ where: { role: 'student' } });
    const pendingCertificates = await prisma.certificateRequest.count({ where: { status: 'pending' } });
    const gatePasses = await prisma.gatePass.count({ where: { status: 'pending' } });
    const openVacancies = await prisma.vacancy.count({ where: { status: 'advertised' } });

    res.json({
      success: true,
      data: {
        stats: [
          { label: "Active Students", value: activeStudents.toString(), icon: "Users" },
          { label: "Pending Certificates", value: pendingCertificates.toString(), icon: "FileText", color: "text-warning" },
          { label: "Gate Passes", value: gatePasses.toString(), icon: "ArrowRightLeft", color: "text-blue-500" },
          { label: "Open Vacancies", value: openVacancies.toString(), icon: "Briefcase", color: "text-purple-500" }
        ]
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Student Records ───
router.get('/students', authenticate, async (req: Request, res: Response) => {
  try {
    const query = req.query as Record<string, string | undefined>;
    const { search, program, semester } = query;
    const where: any = { role: 'student' };
    if (search) { where.name = { contains: search, mode: 'insensitive' }; }

    const students = await prisma.user.findMany({
      where, include: { studentProfile: true, department: true }, take: 100
    });

    res.json({
      success: true,
      data: students.filter((s: any) => {
        if (program && s.studentProfile?.program !== program) return false;
        if (semester && s.studentProfile?.semester !== parseInt(semester as string)) return false;
        return true;
      }).map((s: any) => ({
        id: s.id, name: s.name, email: s.email, rollNumber: s.studentProfile?.rollNumber,
        program: s.studentProfile?.program, semester: s.studentProfile?.semester,
        section: s.studentProfile?.section, department: s.department?.name,
        admissionYear: s.studentProfile?.admissionYear, cgpa: s.studentProfile?.cgpa, status: 'active'
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/students/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id },
      include: { studentProfile: true, department: true }
    });
    if (!user) { res.status(404).json({ success: false, message: 'Student not found' }); return; }
    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/students/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { name, email, ...profileData } = req.body;
    if (name || email) {
      await prisma.user.update({ where: { id }, data: { ...(name && { name }), ...(email && { email }) } });
    }
    if (Object.keys(profileData).length > 0) {
      await prisma.studentProfile.updateMany({ where: { userId: id }, data: profileData });
    }
    res.json({ success: true, message: 'Student record updated' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Record Change Requests ───
router.get('/record-changes', authenticate, async (req: Request, res: Response) => {
  try {
    const requests = await prisma.recordChangeRequest.findMany({ orderBy: { requestedAt: 'desc' } });
    res.json({ success: true, data: requests });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/record-changes/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const userId = (req as any).user.id;
    const { status } = req.body;
    const updated = await prisma.recordChangeRequest.update({ where: { id }, data: { status, approvedBy: userId } });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Transfers ───
router.get('/transfers', authenticate, async (req: Request, res: Response) => {
  try {
    const transfers = await prisma.transferRequest.findMany({ orderBy: { requestedAt: 'desc' } });
    res.json({ success: true, data: transfers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/transfers', authenticate, async (req: Request, res: Response) => {
  try {
    const transfer = await prisma.transferRequest.create({ data: req.body });
    res.json({ success: true, data: transfer });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/transfers/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await prisma.transferRequest.update({ where: { id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Certificates ───
router.get('/certificates', authenticate, async (req: Request, res: Response) => {
  try {
    const certs = await prisma.certificateRequest.findMany({
      include: { student: { include: { user: true } } },
      orderBy: { requestedAt: 'desc' }
    });
    res.json({
      success: true,
      data: certs.map((c: any) => ({
        id: c.id, type: c.type, status: c.status, requestedAt: c.requestedAt,
        studentName: c.student.user.name, rollNumber: c.student.rollNumber, remarks: c.remarks
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/certificates/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status, remarks } = req.body;
    const updated = await prisma.certificateRequest.update({ where: { id }, data: { status, ...(remarks && { remarks }) } });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Verification Requests ───
router.get('/verifications', authenticate, async (req: Request, res: Response) => {
  try {
    const verifications = await prisma.verificationRequest.findMany({ orderBy: { receivedAt: 'desc' } });
    res.json({ success: true, data: verifications });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/verifications/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status, response } = req.body;
    const updated = await prisma.verificationRequest.update({
      where: { id },
      data: { status, response, respondedAt: new Date() }
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Exam Oversight ───
router.get('/exams', authenticate, async (req: Request, res: Response) => {
  try {
    const [exams, profiles] = await Promise.all([
      prisma.examProgress.findMany({ orderBy: { startDate: 'desc' } }),
      prisma.studentProfile.findMany({ select: { program: true, semester: true } })
    ]);

    const totalProfiles = profiles.length;
    const programCounts = new Map<string, number>();
    const programSemesterCounts = new Map<string, number>();

    for (const profile of profiles) {
      const programKey = normalizeText(profile.program);
      const semester = normalizeSemester(profile.semester);
      if (!programKey) continue;

      programCounts.set(programKey, (programCounts.get(programKey) || 0) + 1);
      if (semester !== null) {
        const key = `${programKey}::${semester}`;
        programSemesterCounts.set(key, (programSemesterCounts.get(key) || 0) + 1);
      }
    }

    const normalized = exams.map((exam: any) => {
      const storedTotal = Math.max(0, Number(exam.totalStudents) || 0);
      const programKey = normalizeText(exam.program);
      const semester = normalizeSemester(exam.semester);

      let inferredTotal: number | undefined;
      if (programKey && semester !== null) {
        inferredTotal = programSemesterCounts.get(`${programKey}::${semester}`);
      }
      if ((inferredTotal === undefined || inferredTotal === 0) && programKey) {
        inferredTotal = programCounts.get(programKey);
      }
      if (inferredTotal === undefined || inferredTotal === 0) {
        inferredTotal = totalProfiles > 0 ? totalProfiles : storedTotal;
      }

      const totalStudents = Math.max(0, inferredTotal || 0);
      let marksEntered = Math.max(0, Number(exam.marksEntered) || 0);
      marksEntered = Math.min(marksEntered, totalStudents);
      if (exam.status === 'published' || exam.resultsPublished) {
        marksEntered = totalStudents;
      }

      return { ...exam, totalStudents, marksEntered };
    });

    res.json({ success: true, data: normalized });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/exams/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await prisma.examProgress.update({ where: { id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Documents ───
router.get('/documents', authenticate, async (req: Request, res: Response) => {
  try {
    const docs = await prisma.adminDocument.findMany({ orderBy: { uploadedAt: 'desc' } });
    res.json({ success: true, data: docs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/admindocuments', authenticate, async (req: Request, res: Response) => {
  try {
    const docs = await prisma.adminDocument.findMany({ orderBy: { uploadedAt: 'desc' } });
    res.json({ success: true, data: docs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/workflow-files', authenticate, async (_req: Request, res: Response) => {
  try {
    const items = await prisma.approvalItem.findMany({ orderBy: { requestedAt: 'desc' }, take: 50 });

    const requesterIds = Array.from(new Set(items.map((item: any) => String(item.requestedBy || '')).filter(Boolean)));
    const users = requesterIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: requesterIds } }, select: { id: true, name: true } })
      : [];
    const userNameById = new Map(users.map((user: any) => [user.id, user.name]));

    const mapType = (type: string) => {
      const normalized = normalizeText(type);
      if (normalized.includes('policy')) return 'policy';
      if (normalized.includes('transfer')) return 'transfer';
      if (normalized.includes('certificate')) return 'certificate';
      if (normalized.includes('budget') || normalized.includes('finance')) return 'budget';
      if (normalized.includes('hire') || normalized.includes('recruit')) return 'recruitment';
      if (normalized.includes('record')) return 'record_change';
      if (normalized.includes('affiliation')) return 'affiliation';
      return 'general';
    };

    const data = items.map((item: any) => ({
      id: item.id,
      type: mapType(item.type),
      title: item.title,
      description: item.details,
      submittedBy: userNameById.get(item.requestedBy) || item.requestedBy,
      submittedAt: item.requestedAt,
      status: item.status,
      priority: item.priority || 'medium',
      remarks: undefined,
      documents: []
    }));

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/workflow-files/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status, remarks } = req.body;

    const existing = await prisma.approvalItem.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Workflow file not found' });
      return;
    }

    const remarkText = String(remarks || '').trim();
    const nextDetails = remarkText.length > 0
      ? `${existing.details || ''}\n\nRegistrar Note: ${remarkText}`.trim()
      : existing.details;

    const updated = await prisma.approvalItem.update({
      where: { id },
      data: {
        status: String(status || existing.status),
        details: nextDetails,
      }
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/documents', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const {
      title,
      category,
      tags,
      isConfidential,
      accessRoles,
      filePath,
      fileUrl,
      fileName,
      mimeType,
      fileSize
    } = req.body;

    const normalizedTags = Array.isArray(tags) ? tags : [];
    const normalizedRoles = Array.isArray(accessRoles) ? accessRoles : [];
    const doc = await prisma.adminDocument.create({
      data: {
        title,
        category,
        uploadedBy: userId,
        filePath,
        fileUrl,
        fileName,
        mimeType,
        fileSize: fileSize || '0 KB',
        tags: normalizedTags,
        isConfidential: Boolean(isConfidential),
        accessRoles: normalizedRoles
      }
    });
    res.json({ success: true, data: doc });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/documents/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    await prisma.adminDocument.delete({ where: { id } });
    res.json({ success: true, message: 'Document deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── HR / Establishment ───
router.get('/hr/summary', authenticate, async (req: Request, res: Response) => {
  try {
    const [vacancies, promotions, retirements] = await Promise.all([
      prisma.vacancy.findMany(),
      prisma.promotionRequest.findMany({ where: { status: 'pending' } }),
      prisma.retirementRequest.findMany({ where: { status: 'pending' } })
    ]);
    
    // Separate teaching and non-teaching vacancies
    const teaching = vacancies.filter(v => v.type === 'teaching');
    const nonTeaching = vacancies.filter(v => v.type === 'non_teaching');
    
    // Calculate totals
    const teachingFilled = teaching.reduce((sum: number, v: any) => sum + (v.filled || 0), 0);
    const teachingSanctioned = teaching.reduce((sum: number, v: any) => sum + (v.sanctioned || 0), 0);
    const nonTeachingFilled = nonTeaching.reduce((sum: number, v: any) => sum + (v.filled || 0), 0);
    const nonTeachingSanctioned = nonTeaching.reduce((sum: number, v: any) => sum + (v.sanctioned || 0), 0);
    
    res.json({
      success: true,
      data: {
        totalFilled: teachingFilled + nonTeachingFilled,
        totalSanctioned: teachingSanctioned + nonTeachingSanctioned,
        teaching: { filled: teachingFilled, sanctioned: teachingSanctioned },
        nonTeaching: { filled: nonTeachingFilled, sanctioned: nonTeachingSanctioned },
        pendingPromotions: promotions.length,
        pendingRetirements: retirements.length,
        activeRecruitments: vacancies.filter(v => !['joined', 'closed'].includes(v.status)).length,
        vacancy_summary: vacancies.map((v: any) => ({
          position: v.position,
          department: v.department,
          sanctioned: v.sanctioned,
          filled: v.filled,
          vacant: Math.max(0, v.sanctioned - v.filled),
          status: v.status
        }))
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/hr/vacancies', authenticate, async (req: Request, res: Response) => {
  try {
    const vacancies = await prisma.vacancy.findMany({ orderBy: { postedAt: 'desc' } });
    res.json({ success: true, data: vacancies });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/hr/vacancies', authenticate, async (req: Request, res: Response) => {
  try {
    const { position, department, type, sanctioned, filled, status, postedAt, lastDate, applicants } = req.body;
    const vacancy = await prisma.vacancy.create({
      data: {
        position,
        department,
        type,
        sanctioned: sanctioned || 1,
        filled: filled || 0,
        status: status || 'advertised',
        postedAt: postedAt ? new Date(postedAt) : new Date(),
        lastDate: lastDate ? new Date(lastDate) : new Date(Date.now() + 30 * 86400000),
        applicants: applicants || 0,
      }
    });
    res.json({ success: true, data: vacancy });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/hr/vacancies/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await prisma.vacancy.update({ where: { id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/hr/promotions/forward', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = String((req as any).user.id);
    const { name, fromDesignation, toDesignation, department, years } = req.body || {};

    if (!name || !fromDesignation || !toDesignation || !department) {
      res.status(400).json({ success: false, message: 'Missing required promotion details' });
      return;
    }

    const created = await prisma.approvalItem.create({
      data: {
        type: 'faculty_hire',
        title: `Promotion Recommendation: ${name}`,
        details: `${name} (${department}) recommended for promotion from ${fromDesignation} to ${toDesignation}. Years of service: ${years ?? 'N/A'}. Forwarded by Registrar for VC review.`,
        requestedBy: userId,
        priority: 'high',
        status: 'forwarded',
      }
    });

    res.json({ success: true, data: created });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Accreditation ───
router.get('/accreditation', authenticate, async (req: Request, res: Response) => {
  try {
    const checklists = await prisma.accreditationChecklist.findMany();
    res.json({ success: true, data: checklists });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/accreditation/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await prisma.accreditationChecklist.update({ where: { id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Queries ───
router.get('/queries', authenticate, async (req: Request, res: Response) => {
  try {
    const queries = await prisma.verificationRequest.findMany({
      where: { type: { in: ['rti', 'employer_verification', 'background_check'] } },
      orderBy: { receivedAt: 'desc' }
    });
    res.json({ success: true, data: queries });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/queries/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status, response } = req.body;
    const updated = await prisma.verificationRequest.update({
      where: { id }, data: { status, response, respondedAt: new Date() }
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Promotions ───
router.get('/promotions', authenticate, async (req: Request, res: Response) => {
  try {
    const promotions = await prisma.promotionRequest.findMany({ orderBy: { appliedAt: 'desc' } });
    res.json({ success: true, data: promotions });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/promotions/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const userId = (req as any).user.id;
    const { status } = req.body;
    const updateData: any = { status, approvedBy: userId };
    if (status === 'approved') {
      updateData.approvedAt = new Date();
    }
    const updated = await prisma.promotionRequest.update({
      where: { id },
      data: updateData
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Retirements ───
router.get('/retirements', authenticate, async (req: Request, res: Response) => {
  try {
    const retirements = await prisma.retirementRequest.findMany({ orderBy: { appliedAt: 'desc' } });
    res.json({ success: true, data: retirements });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/retirements/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const userId = (req as any).user.id;
    const { status } = req.body;
    const updateData: any = { status, approvedBy: userId };
    if (status === 'approved') {
      updateData.approvedAt = new Date();
    }
    const updated = await prisma.retirementRequest.update({
      where: { id },
      data: updateData
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
