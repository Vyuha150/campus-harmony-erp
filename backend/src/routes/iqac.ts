import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

function toDateOrUndefined(value: unknown): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function averageFromResponseJson(payload: unknown): number {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 0;
  const numeric = Object.values(payload as Record<string, unknown>)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (numeric.length === 0) return 0;
  return Number((numeric.reduce((acc, value) => acc + value, 0) / numeric.length).toFixed(1));
}

function toSatisfactionLevel(rating: number): 'excellent' | 'very_good' | 'good' | 'satisfactory' | 'needs_improvement' {
  if (rating >= 4.5) return 'excellent';
  if (rating >= 4.0) return 'very_good';
  if (rating >= 3.5) return 'good';
  if (rating >= 3.0) return 'satisfactory';
  return 'needs_improvement';
}

// ─── Dashboard ───
router.get('/dashboard', authenticate, async (req: Request, res: Response) => {
  try {
    const metrics = await prisma.qualityMetric.findMany();
    if (metrics.length === 0) {
      await prisma.qualityMetric.createMany({
        data: [
          { category: 'naac', metric: 'Overall Score', currentValue: '3.24', target: '3.5', trend: 'increase', status: 'on_track' },
          { category: 'internal', metric: 'Feedback Forms Pending', currentValue: '1240', target: '0', trend: 'decrease', status: 'at_risk' }
        ]
      });
    }
    const finalMetrics = await prisma.qualityMetric.findMany();
    const naacScore = finalMetrics.find(m => m.category === 'naac' && m.metric.includes('Score'))?.currentValue || 'N/A';
    const pendingFeedback = finalMetrics.find(m => m.metric.includes('Feedback'))?.currentValue || '0';
    const actionItems = await prisma.iQACActionItem.count({ where: { status: 'pending' } });

    res.json({
      success: true,
      data: {
        stats: [
          { label: "Overall NAAC Score", value: naacScore, target: "3.5", icon: "Award", color: "text-blue-500" },
          { label: "Feedback Forms Pending", value: pendingFeedback, icon: "MessageSquare", color: "text-purple-500" },
          { label: "Pending Actions", value: actionItems.toString(), icon: "ListChecks", color: "text-warning" },
          { label: "AQAR Status", value: "In Progress", icon: "CheckCircle", color: "text-green-500" }
        ],
        recentMetrics: finalMetrics
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Criteria ───
router.get('/criteria', authenticate, async (req: Request, res: Response) => {
  try {
    const metrics = await prisma.qualityMetric.findMany();
    const grouped: any = {};
    metrics.forEach(m => {
      if (!grouped[m.category]) grouped[m.category] = [];
      grouped[m.category].push(m);
    });
    res.json({ success: true, data: grouped });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/criteria/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await prisma.qualityMetric.update({ where: { id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Action Items ───
router.get('/actions', authenticate, async (req: Request, res: Response) => {
  try {
    const actions = await prisma.iQACActionItem.findMany({ orderBy: { dueDate: 'asc' } });
    res.json({ success: true, data: actions });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/actions', authenticate, async (req: Request, res: Response) => {
  try {
    const action = await prisma.iQACActionItem.create({
      data: { ...req.body, dueDate: new Date(req.body.dueDate) }
    });
    res.json({ success: true, data: action });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/actions/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await prisma.iQACActionItem.update({
      where: { id },
      data: { ...req.body, ...(req.body.status === 'completed' ? { completedDate: new Date() } : {}) }
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Documents ───
router.get('/documents', authenticate, async (req: Request, res: Response) => {
  try {
    const docs = await prisma.qualityDocument.findMany({ orderBy: { uploadDate: 'desc' } });
    res.json({ success: true, data: docs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/documents', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const doc = await prisma.qualityDocument.create({
      data: { ...req.body, uploadedBy: userId }
    });
    res.json({ success: true, data: doc });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/documents/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const userId = (req as any).user.id;
    const updated = await prisma.qualityDocument.update({
      where: { id },
      data: { ...req.body, ...(req.body.status === 'approved' ? { reviewedBy: userId, reviewDate: new Date() } : {}) }
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Feedback ───
router.get('/feedback', authenticate, async (req: Request, res: Response) => {
  try {
    const forms = await prisma.feedbackForm.findMany({
      include: { responses: true },
      orderBy: { deadline: 'desc' }
    });

    res.json({
      success: true,
      data: forms.map((f: any) => ({
        id: f.id,
        title: f.title,
        type: f.title?.toLowerCase().includes('alumni') ? 'alumni' : f.title?.toLowerCase().includes('employer') ? 'employer' : f.title?.toLowerCase().includes('faculty') ? 'faculty' : 'student',
        targetAudience: f.title?.toLowerCase().includes('alumni') ? 'alumni' : f.title?.toLowerCase().includes('employer') ? 'employer' : f.title?.toLowerCase().includes('faculty') ? 'faculty' : 'student',
        createdAt: f.deadline,
        isActive: f.status === 'open',
        totalResponses: f.responses.length,
        respondents: f.responses.length,
        averageRating: Number((f.responses.reduce((acc: number, response: any) => acc + averageFromResponseJson(response.responses), 0) / Math.max(f.responses.length, 1)).toFixed(1)),
        satisfactionLevel: toSatisfactionLevel(Number((f.responses.reduce((acc: number, response: any) => acc + averageFromResponseJson(response.responses), 0) / Math.max(f.responses.length, 1)).toFixed(1))),
        keyFindings: [
          `Responses received: ${f.responses.length}`,
          `Form status: ${f.status}`
        ],
        improvementAreas: [
          'Increase response participation',
          'Review low-scoring indicators'
        ],
        lastCollected: f.deadline
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/feedback/create-form', authenticate, async (req: Request, res: Response) => {
  try {
    const defaultCourse = await prisma.course.findFirst({ select: { id: true } });
    if (!defaultCourse) {
      return res.status(400).json({ success: false, message: 'No course found to attach the feedback form.' });
    }

    const deadline = toDateOrUndefined(req.body?.deadline);
    if (!deadline) {
      return res.status(400).json({ success: false, message: 'Invalid deadline provided.' });
    }

    const form = await prisma.feedbackForm.create({
      data: {
        title: String(req.body?.title || 'Feedback Form'),
        status: String(req.body?.status || 'open'),
        deadline,
        courseId: String(req.body?.courseId || defaultCourse.id)
      }
    });
    res.json({ success: true, data: form });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Reports & AQAR ───
router.get('/reports', authenticate, async (req: Request, res: Response) => {
  try {
    const aqar = await prisma.aQARRecord.findMany({ orderBy: { academicYear: 'desc' } });
    res.json({ success: true, data: aqar });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/reports/generate', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { academicYear } = req.body;
    const aqar = await prisma.aQARRecord.create({
      data: {
        academicYear,
        generatedBy: userId,
        status: 'draft',
        institutionDetails: {},
        criteria: {},
        keyIndicators: {},
        bestPractices: {},
        distinctiveFeatures: {}
      }
    });
    res.json({ success: true, data: aqar });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/reports/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const parsedSubmissionDate = req.body?.submissionDate ? toDateOrUndefined(req.body.submissionDate) : null;
    const updated = await prisma.aQARRecord.update({
      where: { id },
      data: {
        ...(req.body?.academicYear ? { academicYear: String(req.body.academicYear) } : {}),
        ...(req.body?.institutionDetails !== undefined ? { institutionDetails: req.body.institutionDetails } : {}),
        ...(req.body?.criteria !== undefined ? { criteria: req.body.criteria } : {}),
        ...(req.body?.keyIndicators !== undefined ? { keyIndicators: req.body.keyIndicators } : {}),
        ...(req.body?.bestPractices !== undefined ? { bestPractices: req.body.bestPractices } : {}),
        ...(req.body?.distinctiveFeatures !== undefined ? { distinctiveFeatures: req.body.distinctiveFeatures } : {}),
        ...(req.body?.status ? { status: String(req.body.status) } : {}),
        ...(parsedSubmissionDate ? { submissionDate: parsedSubmissionDate } : {})
      }
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Meetings ───
router.get('/meetings', authenticate, async (req: Request, res: Response) => {
  try {
    const meetings = await prisma.iQACMeeting.findMany({ orderBy: { date: 'desc' } });
    res.json({ success: true, data: meetings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/meetings', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const date = toDateOrUndefined(req.body?.date);
    const nextMeetingDate = toDateOrUndefined(req.body?.nextMeetingDate);
    if (!date) {
      return res.status(400).json({ success: false, message: 'Invalid meeting date provided.' });
    }

    const meeting = await prisma.iQACMeeting.create({
      data: {
        title: String(req.body?.title || 'IQAC Meeting'),
        date,
        venue: String(req.body?.venue || 'TBD'),
        agenda: toStringArray(req.body?.agenda),
        attendees: Array.isArray(req.body?.attendees) ? req.body.attendees : [],
        chairperson: String(req.body?.chairperson || userId),
        decisions: toStringArray(req.body?.decisions),
        actionItems: toStringArray(req.body?.actionItems),
        ...(nextMeetingDate ? { nextMeetingDate } : {}),
        status: String(req.body?.status || 'scheduled'),
        documentsShared: toStringArray(req.body?.documentsShared)
      }
    });

    res.json({ success: true, data: meeting });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/meetings/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const parsedDate = req.body?.date ? toDateOrUndefined(req.body.date) : null;
    const parsedNextMeetingDate = req.body?.nextMeetingDate ? toDateOrUndefined(req.body.nextMeetingDate) : null;
    const updated = await prisma.iQACMeeting.update({
      where: { id },
      data: {
        ...(req.body?.title ? { title: String(req.body.title) } : {}),
        ...(parsedDate ? { date: parsedDate } : {}),
        ...(req.body?.venue ? { venue: String(req.body.venue) } : {}),
        ...(req.body?.agenda !== undefined ? { agenda: toStringArray(req.body.agenda) } : {}),
        ...(req.body?.attendees !== undefined ? { attendees: Array.isArray(req.body.attendees) ? req.body.attendees : [] } : {}),
        ...(req.body?.chairperson ? { chairperson: String(req.body.chairperson) } : {}),
        ...(req.body?.minutes !== undefined ? { minutes: req.body.minutes ? String(req.body.minutes) : null } : {}),
        ...(req.body?.decisions !== undefined ? { decisions: toStringArray(req.body.decisions) } : {}),
        ...(req.body?.actionItems !== undefined ? { actionItems: toStringArray(req.body.actionItems) } : {}),
        ...(parsedNextMeetingDate ? { nextMeetingDate: parsedNextMeetingDate } : {}),
        ...(req.body?.status ? { status: String(req.body.status) } : {}),
        ...(req.body?.documentsShared !== undefined ? { documentsShared: toStringArray(req.body.documentsShared) } : {})
      }
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
