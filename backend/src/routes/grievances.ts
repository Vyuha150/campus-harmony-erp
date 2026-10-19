import { notifyInApp } from '../lib/inAppNotify.js';
import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { sendError } from '../lib/errors.js';
import { getTenantContext } from '../lib/tenant.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { entityId } from '../schemas/common.js';
import { updateTenantEntity } from '../modules/common/entityUpdate.service.js';
import {
  updateAffidavitSchema
} from '../modules/common/entityUpdate.schemas.js';
import * as grievanceService from '../modules/grievances/grievances.service.js';
import {
  createCaseSchema,
  updateCaseSchema,
  addActivitySchema,
  listCasesQuery,
  complianceItemCreateSchema,
  complianceItemUpdateSchema,
  antiRaggingAffidavitCreateSchema
} from '../modules/grievances/grievances.schema.js';

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
    sendError(res, error);
  }
});

// ─── Cases ───
// List all cases with optional filters
router.get(
  '/cases',
  authenticate,
  validate({ query: listCasesQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      page: number; pageSize: number; status?: string; severity?: string; category?: string;
    };
    const result = await grievanceService.listCases(
      getTenantContext(req),
      { page: q.page, pageSize: q.pageSize },
      { status: q.status, severity: q.severity, category: q.category }
    );
    res.json({ success: true, ...result });
  })
);

// Get single case by ID
router.get(
  '/cases/:id',
  authenticate,
  validate({ params: z.object({ id: entityId }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const found = await grievanceService.getCase(getTenantContext(req), String(req.params.id));
    res.json({ success: true, data: found });
  })
);

// Create new grievance case
/**
 * File a grievance.
 *
 * The old handler read `complainantId` from the REQUEST BODY, so a caller could
 * attribute a complaint to somebody else. Worse, for an anonymous submission it
 * omitted `complainantId` and then wrote `by: req.user?.id` into the timeline on
 * the same row — recording the identity it had just promised to withhold.
 *
 * Both are fixed in the service: the complainant is the authenticated caller or
 * nobody, and an anonymous case records `anonymous` as the timeline actor.
 */
router.post(
  '/cases',
  authenticate,
  validate({ body: createCaseSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const created = await grievanceService.fileCase(getTenantContext(req), req.body);
    res.status(201).json({ success: true, data: created });
  })
);

// Update grievance case
/**
 * Update a case.
 *
 * `isAnonymous`, `complainantId`, `complainantName` and `complainantType` are
 * NOT accepted. Allowing `isAnonymous` to be flipped would be the most damaging
 * write in this module: it converts a protected submission into an attributable
 * one after the fact.
 */
router.put(
  '/cases/:id',
  authenticate,
  validate({ params: z.object({ id: entityId }), body: updateCaseSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await grievanceService.updateCase(
      getTenantContext(req),
      String(req.params.id),
      req.body
    );
    if (req.body.status) await tellComplainant(req, updated, `Your grievance ${(updated as any).grievanceNumber} is now ${String(req.body.status).replace(/_/g, ' ')}`, req.body.resolution ?? 'See the grievance for details.');
    res.json({ success: true, data: updated });
  })
);

/** Tell the person who raised a case it moved. Anonymous cases have no complainant id. */
async function tellComplainant(req: Request, c: any, subject: string, body: string) {
  if (!c?.complainantId || c.isAnonymous) return;
  await notifyInApp(getTenantContext(req).institutionId, { userIds: [c.complainantId] }, {
    eventType: 'grievance.updated', subject, body, relatedEntityType: 'GrievanceCase', relatedEntityId: c.id
  });
}

// Add activity/timeline entry to a case
router.post(
  '/cases/:id/activity',
  authenticate,
  validate({ params: z.object({ id: entityId }), body: addActivitySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await grievanceService.addActivity(
      getTenantContext(req),
      String(req.params.id),
      req.body
    );
    await tellComplainant(req, updated, `Update on grievance ${(updated as any).grievanceNumber}: ${req.body.action}`, req.body.notes ?? '');
    res.json({ success: true, data: updated });
  })
);

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
    sendError(res, error);
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
    sendError(res, error);
  }
});

// Create compliance item
router.post('/compliance', authenticate, validate({ body: complianceItemCreateSchema }), async (req: Request, res: Response) => {
  try {
    const { title, type, description, applicableTo, dueDate, renewalPeriod, documents } = req.body;

    if (!title || !type || !description || !applicableTo) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }

    const item = await prisma.complianceItem.create({
      data: {
        institutionId: getTenantContext(req).institutionId,
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
    sendError(res, error);
  }
});

// Update compliance item
router.put('/compliance/:id', authenticate, validate({ params: z.object({ id: entityId }), body: complianceItemUpdateSchema }), async (req: Request, res: Response) => {
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
    sendError(res, error);
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
    sendError(res, error);
  }
});

router.post('/affidavits', authenticate, validate({ body: antiRaggingAffidavitCreateSchema }), async (req: Request, res: Response) => {
  try {
    const { studentId, studentName, program, academicYear, parentAffidavit, studentAffidavit } = req.body;

    if (!studentId || !studentName || !program || !academicYear) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }

    const affidavit = await prisma.antiRaggingAffidavit.create({
      data: {
        institutionId: getTenantContext(req).institutionId,
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
    sendError(res, error);
  }
});

router.put(
  '/affidavits/:id',
  authenticate,
  validate({ params: z.object({ id: entityId }), body: updateAffidavitSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await updateTenantEntity(getTenantContext(req), {
      model: 'antiRaggingAffidavit',
      entity: 'AntiRaggingAffidavit',
      module: 'grievances',
      id: String(req.params.id),
      data: req.body as Record<string, unknown>
    });

    res.json({ success: true, data: updated });
  })
);

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
    sendError(res, error);
  }
});

export default router;
