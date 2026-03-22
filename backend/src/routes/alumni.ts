import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const currentYear = new Date().getFullYear();

// ─── Dashboard ───
router.get('/dashboard', authenticate, async (req: Request, res: Response) => {
  try {
    const alumniCount = await prisma.alumniProfile.count({
      where: {
        graduationYear: { lte: currentYear },
        user: { role: { not: 'alumni_officer' } }
      }
    });
    const donations = await prisma.donation.aggregate({ _sum: { amount: true } });
    const mentoring = await prisma.mentorshipProgram.count({ where: { status: 'active' } });
    const jobPostings = await prisma.alumniJobPosting.count({ where: { status: 'active' } });

    res.json({
      success: true,
      data: {
        stats: [
          { label: "Registered Alumni", value: alumniCount.toString(), icon: "Users" },
          { label: "Total Donations", value: `₹${donations._sum.amount || 0}`, icon: "IndianRupee", color: "text-green-500" },
          { label: "Active Mentorships", value: mentoring.toString(), icon: "Handshake", color: "text-blue-500" },
          { label: "Job Postings", value: jobPostings.toString(), icon: "Briefcase", color: "text-purple-500" }
        ]
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Directory ───
router.get('/directory', authenticate, async (req: Request, res: Response) => {
  try {
    const query = req.query as Record<string, string | undefined>;
    const search = query.search;
    const graduationYear = query.graduationYear;
    const program = query.program;
    const location = query.location;
    const where: any = {
      graduationYear: { lte: currentYear },
      user: { role: { not: 'alumni_officer' } }
    };
    if (graduationYear) where.graduationYear = parseInt(graduationYear);
    if (program) where.program = program;
    if (location) where.currentLocation = { contains: location, mode: 'insensitive' };

    const alumni = await prisma.alumniProfile.findMany({
      where,
      include: { user: true },
      take: 100
    });

    res.json({
      success: true,
      data: alumni.filter((a: any) => !search || a.user.name.toLowerCase().includes((search as string).toLowerCase()))
        .map((a: any) => ({
          id: a.id, name: a.user.name, email: a.user.email, graduationYear: a.graduationYear,
          program: a.program, currentCompany: a.currentCompany, currentRole: a.currentRole,
          currentLocation: a.currentLocation, linkedIn: a.linkedIn
        }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/directory/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const alumni = await prisma.alumniProfile.findUnique({ where: { id }, include: { user: true } });
    if (!alumni || alumni.user.role === 'alumni_officer' || alumni.graduationYear > currentYear) {
      res.status(404).json({ success: false, message: 'Alumni not found' });
      return;
    }
    res.json({ success: true, data: alumni });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/directory/sync-graduates', authenticate, async (req: Request, res: Response) => {
  try {
    const defaultProgramDurationYears = 4;
    const minimumGraduatingSemester = 8;

    const eligibleStudents = await prisma.studentProfile.findMany({
      where: {
        user: {
          role: 'student',
          alumniProfile: null,
        },
        OR: [
          { semester: { gte: minimumGraduatingSemester } },
          { admissionYear: { lte: currentYear - defaultProgramDurationYears } },
        ],
      },
      select: {
        userId: true,
        admissionYear: true,
      },
    });

    if (!eligibleStudents.length) {
      res.json({
        success: true,
        data: {
          eligibleCount: 0,
          createdCount: 0,
          skippedCount: 0,
        },
      });
      return;
    }

    const createResult = await prisma.alumniProfile.createMany({
      data: eligibleStudents.map((student) => ({
        userId: student.userId,
        graduationYear: Math.min(currentYear, student.admissionYear + defaultProgramDurationYears),
      })),
      skipDuplicates: true,
    });

    res.json({
      success: true,
      data: {
        eligibleCount: eligibleStudents.length,
        createdCount: createResult.count,
        skippedCount: eligibleStudents.length - createResult.count,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Communications ───
router.get('/communications', authenticate, async (req: Request, res: Response) => {
  try {
    const comms = await prisma.alumniCommunicationRecord.findMany({ orderBy: { sentDate: 'desc' } });
    res.json({ success: true, data: comms });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/communications', authenticate, async (req: Request, res: Response) => {
  try {
    const comm = await prisma.alumniCommunicationRecord.create({ data: req.body });
    res.json({ success: true, data: comm });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Events ───
router.get('/events', authenticate, async (req: Request, res: Response) => {
  try {
    const events = await prisma.alumniEvent.findMany({ orderBy: { date: 'desc' } });
    res.json({ success: true, data: events });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/events', authenticate, async (req: Request, res: Response) => {
  try {
    const event = await prisma.alumniEvent.create({
      data: {
        ...req.body,
        date: new Date(req.body.date),
        registrationDeadline: new Date(req.body.registrationDeadline),
        ...(req.body.endDate && { endDate: new Date(req.body.endDate) })
      }
    });
    res.json({ success: true, data: event });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/events/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await prisma.alumniEvent.update({ where: { id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Mentorship ───
router.get('/mentorship/programs', authenticate, async (req: Request, res: Response) => {
  try {
    const programs = await prisma.mentorshipProgram.findMany({ orderBy: { startDate: 'desc' } });
    res.json({ success: true, data: programs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/mentorship/programs', authenticate, async (req: Request, res: Response) => {
  try {
    const program = await prisma.mentorshipProgram.create({
      data: { ...req.body, startDate: new Date(req.body.startDate), ...(req.body.endDate && { endDate: new Date(req.body.endDate) }) }
    });
    res.json({ success: true, data: program });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/mentorship/matches', authenticate, async (req: Request, res: Response) => {
  try {
    const programs = await prisma.mentorshipProgram.findMany({ where: { status: 'active' } });
    const matches = programs.flatMap((p: any) => (p.matches || []).map((m: any) => ({ ...m, programId: p.id, programTitle: p.title })));
    res.json({ success: true, data: matches });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Donations ───
router.get('/donations', authenticate, async (req: Request, res: Response) => {
  try {
    const donations = await prisma.donation.findMany({
      include: { alumni: { include: { user: true } } },
      orderBy: { date: 'desc' }
    });
    res.json({
      success: true,
      data: donations.map((d: any) => ({
        id: d.id, amount: d.amount, purpose: d.purpose, donatedAt: d.date,
        donorName: d.alumni.user.name
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/donations', authenticate, async (req: Request, res: Response) => {
  try {
    const donation = await prisma.donation.create({ data: req.body });
    res.json({ success: true, data: donation });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Progression ───
router.get('/progression/surveys', authenticate, async (req: Request, res: Response) => {
  try {
    const surveys = await prisma.progressionSurvey.findMany({ orderBy: { startDate: 'desc' } });
    res.json({ success: true, data: surveys });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/progression/surveys', authenticate, async (req: Request, res: Response) => {
  try {
    const survey = await prisma.progressionSurvey.create({
      data: { ...req.body, startDate: new Date(req.body.startDate), endDate: new Date(req.body.endDate) }
    });
    res.json({ success: true, data: survey });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/progression/metrics', authenticate, async (req: Request, res: Response) => {
  try {
    const alumni = await prisma.alumniProfile.findMany({
      where: {
        graduationYear: { lte: currentYear },
        user: { role: { not: 'alumni_officer' } }
      }
    });
    const companyCounts: any = {};
    alumni.forEach((a: any) => { if (a.currentCompany) companyCounts[a.currentCompany] = (companyCounts[a.currentCompany] || 0) + 1; });

    const topEmployers = Object.entries(companyCounts).sort((a: any, b: any) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));

    res.json({
      success: true,
      data: {
        totalAlumni: alumni.length, employedCount: alumni.filter((a: any) => a.currentCompany).length,
        topEmployers, averageSalary: 'N/A'
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Jobs ───
router.get('/jobs', authenticate, async (req: Request, res: Response) => {
  try {
    const jobs = await prisma.alumniJobPosting.findMany({ orderBy: { postedDate: 'desc' } });
    res.json({ success: true, data: jobs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/jobs', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const job = await prisma.alumniJobPosting.create({
      data: { ...req.body, postedBy: userId, applicationDeadline: new Date(req.body.applicationDeadline) }
    });
    res.json({ success: true, data: job });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/jobs/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await prisma.alumniJobPosting.update({ where: { id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
