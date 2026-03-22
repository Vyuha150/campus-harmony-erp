import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// ─── Dashboard ───
router.get('/dashboard', authenticate, async (req: Request, res: Response) => {
  try {
    const openStatusFilter = { notIn: ['resolved', 'closed'] as string[] };

    const active = await prisma.grievanceCase.count({ where: { status: openStatusFilter } });
    const highPriority = await prisma.grievanceCase.count({ where: { severity: 'high', status: openStatusFilter } });
    const resolved = await prisma.grievanceCase.count({ where: { status: 'resolved' } });
    const compliance = await prisma.complianceItem.count({ where: { status: 'active' } });

    res.json({
      success: true,
      data: {
        stats: [
          { label: "Total Active", value: active.toString(), icon: "AlertCircle", color: "text-warning" },
          { label: "High Priority", value: highPriority.toString(), icon: "AlertTriangle", color: "text-destructive" },
          { label: "Resolved", value: resolved.toString(), icon: "CheckCircle2", color: "text-success" },
          { label: "Compliance Items", value: compliance.toString(), icon: "Shield", color: "text-blue-500" }
        ]
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Cases ───
// List all cases with optional filters
router.get('/cases', authenticate, async (req: Request, res: Response) => {
  try {
    const query = req.query as Record<string, string | undefined>;
    const { status, severity, category, page = '1', limit = '20' } = query;
    const where: any = {};
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (category) where.category = category;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [cases, total] = await Promise.all([
      prisma.grievanceCase.findMany({
        where,
        orderBy: { submissionDate: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.grievanceCase.count({ where })
    ]);

    res.json({
      success: true,
      data: cases,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single case by ID
router.get('/cases/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');
    if (!id) {
      res.status(400).json({ success: false, message: 'Case id is required' });
      return;
    }
    const grievance = await prisma.grievanceCase.findUnique({ where: { id } });

    if (!grievance) {
      res.status(404).json({ success: false, message: 'Grievance case not found' });
      return;
    }

    res.json({ success: true, data: grievance });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create new grievance case
router.post('/cases', authenticate, async (req: Request, res: Response) => {
  try {
    const {
      complainantName,
      complainantType,
      complainantId,
      category,
      subcategory,
      subject,
      description,
      severity = 'medium',
      isAnonymous = false,
      evidenceFiles
    } = req.body;

    if (!complainantName || !category || !subject || !description) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }

    // Generate grievance number
    const grievanceNumber = `GR-${Date.now()}`;

    const grievance = await prisma.grievanceCase.create({
      data: {
        grievanceNumber,
        complainantName,
        complainantType: complainantType || 'anonymous',
        complainantId: isAnonymous ? undefined : complainantId,
        category,
        subcategory,
        subject,
        description,
        severity,
        isAnonymous,
        evidenceFiles: evidenceFiles || [],
        status: 'received',
        timeline: [
          {
            date: new Date().toISOString(),
            action: 'Case Created',
            by: (req as any).user?.id || 'system',
            notes: 'Grievance case submitted'
          }
        ]
      }
    });

    res.status(201).json({ success: true, data: grievance });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update grievance case
router.put('/cases/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');
    if (!id) {
      res.status(400).json({ success: false, message: 'Case id is required' });
      return;
    }
    const updateData: any = { ...req.body, lastUpdated: new Date() };

    if (req.body.status === 'resolved') {
      updateData.actualResolutionDate = new Date();
    }

    const updated = await prisma.grievanceCase.update({
      where: { id },
      data: updateData
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add activity/timeline entry to a case
router.post('/cases/:id/activity', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');
    if (!id) {
      res.status(400).json({ success: false, message: 'Case id is required' });
      return;
    }
    const { action, notes, status } = req.body;
    const userId = (req as any).user?.id || 'system';

    if (!action) {
      res.status(400).json({ success: false, message: 'Action is required' });
      return;
    }

    const grievance = await prisma.grievanceCase.findUnique({ where: { id } });

    if (!grievance) {
      res.status(404).json({ success: false, message: 'Case not found' });
      return;
    }

    const existingTimeline = (grievance.timeline as any[]) || [];
    existingTimeline.push({
      date: new Date().toISOString(),
      action,
      by: userId,
      notes
    });

    const updated = await prisma.grievanceCase.update({
      where: { id },
      data: {
        timeline: existingTimeline,
        lastUpdated: new Date(),
        ...(status && { status })
      }
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Compliance ───
router.get('/compliance', authenticate, async (req: Request, res: Response) => {
  try {
    const items = await prisma.complianceItem.findMany({ orderBy: { dueDate: 'asc' } });
    const affidavits = await prisma.antiRaggingAffidavit.findMany({
      orderBy: { submissionDate: 'desc' },
      take: 50
    });

    res.json({
      success: true,
      data: {
        complianceItems: items,
        antiRaggingAffidavits: affidavits
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single compliance item
router.get('/compliance/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');
    if (!id) {
      res.status(400).json({ success: false, message: 'Compliance id is required' });
      return;
    }
    const item = await prisma.complianceItem.findUnique({ where: { id } });

    if (!item) {
      res.status(404).json({ success: false, message: 'Compliance item not found' });
      return;
    }

    res.json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create compliance item
router.post('/compliance', authenticate, async (req: Request, res: Response) => {
  try {
    const { title, type, description, applicableTo, dueDate, renewalPeriod, documents } = req.body;

    if (!title || !type || !description || !applicableTo) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }

    const item = await prisma.complianceItem.create({
      data: {
        title,
        type,
        description,
        applicableTo,
        dueDate: dueDate ? new Date(dueDate) : null,
        renewalPeriod: renewalPeriod ?? null,
        documents: documents || [],
        completionTracking: [],
        status: 'active'
      }
    });

    res.status(201).json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update compliance item
router.put('/compliance/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');
    if (!id) {
      res.status(400).json({ success: false, message: 'Compliance id is required' });
      return;
    }
    const updateData: any = req.body;

    if (updateData.dueDate) {
      updateData.dueDate = new Date(updateData.dueDate);
    }

    const updated = await prisma.complianceItem.update({
      where: { id },
      data: updateData
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Anti-Ragging Affidavits ───
router.get('/affidavits', authenticate, async (req: Request, res: Response) => {
  try {
    const affidavits = await prisma.antiRaggingAffidavit.findMany({
      orderBy: { submissionDate: 'desc' }
    });

    res.json({ success: true, data: affidavits });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/affidavits', authenticate, async (req: Request, res: Response) => {
  try {
    const { studentId, studentName, program, academicYear, parentAffidavit, studentAffidavit } = req.body;

    if (!studentId || !studentName || !program || !academicYear) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }

    const affidavit = await prisma.antiRaggingAffidavit.create({
      data: {
        studentId,
        studentName,
        program,
        academicYear,
        parentAffidavit: parentAffidavit || false,
        studentAffidavit: studentAffidavit || false,
        status: 'pending'
      }
    });

    res.status(201).json({ success: true, data: affidavit });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/affidavits/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');
    if (!id) {
      res.status(400).json({ success: false, message: 'Affidavit id is required' });
      return;
    }
    const updated = await prisma.antiRaggingAffidavit.update({
      where: { id },
      data: req.body
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Reports ───
router.get('/reports', authenticate, async (req: Request, res: Response) => {
  try {
    const totalCases = await prisma.grievanceCase.count();
    const resolvedCases = await prisma.grievanceCase.count({ where: { status: 'resolved' } });
    const pendingCases = await prisma.grievanceCase.count({ where: { status: { notIn: ['resolved', 'closed'] } } });

    const categories = await prisma.grievanceCase.groupBy({
      by: ['category'],
      _count: true
    });

    res.json({
      success: true,
      data: {
        totalCases,
        resolvedCases,
        pendingCases,
        resolutionRate: totalCases > 0 ? Math.round((resolvedCases / totalCases) * 100) : 0,
        byCategory: categories.map((c: any) => ({
          category: c.category,
          count: c._count
        }))
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
