import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { getTenantContext } from '../lib/tenant.js';
import { sendError } from '../lib/errors.js';
import * as workflow from '../modules/workflow/workflow.service.js';
import { ensureDefinition } from '../modules/workflow/bridge.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { z } from 'zod';
import * as exams from '../modules/coe/exams.service.js';
import { createExamSchema, updateExamSchema } from '../modules/coe/exams.schema.js';
import { RESULT_PUBLICATION } from '../modules/workflow/builtins.js';

const router = Router();

function normalizeText(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeSemester(value: unknown) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

// ─── Examination schedule (Phase 3a — migrated to the service layer) ─────────
//
// The four handlers below were replaced. What they used to do is recorded in
// modules/coe/exams.service.ts; in short: no tenant key, `update({ where: { id },
// data: req.body })` in two files, an unaudited hard delete, and a list endpoint
// that recomputed `totalStudents` from student profiles instead of reading it.

const examPage = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50)
});

router.get(
  '/exams',
  authenticate,
  validate({ query: examPage }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as { page: number; pageSize: number };
    const result = await exams.listExams(getTenantContext(req), q);
    res.json({ success: true, ...result });
  })
);

router.post(
  '/exams',
  authenticate,
  validate({ body: createExamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const created = await exams.createExam(getTenantContext(req), req.body);
    res.status(201).json({ success: true, data: created });
  })
);

router.put(
  '/exams/:id',
  authenticate,
  validate({ params: z.object({ id: z.string().trim().min(1).max(80) }), body: updateExamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await exams.updateExam(
      getTenantContext(req),
      String(req.params.id),
      req.body
    );
    res.json({ success: true, data: updated });
  })
);

router.delete(
  '/exams/:id',
  authenticate,
  validate({
    params: z.object({ id: z.string().trim().min(1).max(80) }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await exams.deleteExam(
      getTenantContext(req),
      String(req.params.id),
      String(req.body.reason)
    );
    res.json({ success: true, data: result });
  })
);

router.get('/dashboard', authenticate, async (_req: Request, res: Response) => {
  try {
    const [pending, published, draftExamCount, activeExamCount] = await Promise.all([
      prisma.approvalItem.count({ where: { type: 'result_publication', status: 'pending' } }),
      prisma.approvalItem.count({ where: { type: 'result_publication', status: 'published' } }),
      prisma.examProgress.count({ where: { status: { in: ['scheduling', 'ongoing', 'mark_entry', 'moderation'] } } }),
      prisma.examProgress.count({ where: { status: { in: ['ongoing', 'mark_entry', 'moderation'] } } }),
    ]);

    const latestSubmissions = await prisma.approvalItem.findMany({
      where: { type: 'result_publication' },
      orderBy: { requestedAt: 'desc' },
      take: 5
    });

    const departmentIds = latestSubmissions
      .map((item: any) => String(item.details || ''))
      .filter(Boolean);
    const departments = departmentIds.length > 0
      ? await prisma.department.findMany({ where: { id: { in: departmentIds } } })
      : [];
    const requestUserIds = latestSubmissions
      .map((item: any) => String(item.requestedBy || ''))
      .filter(Boolean);
    const requestUsers = requestUserIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: requestUserIds } } })
      : [];
    const departmentById = new Map(departments.map((dept: any) => [dept.id, dept.name]));
    const userById = new Map(requestUsers.map((user: any) => [user.id, user.name]));

    res.json({
      success: true,
      data: {
        stats: [
          { label: 'Pending Dean Approval', value: String(pending), icon: 'Clock' },
          { label: 'Published Results', value: String(published), icon: 'CheckCircle' },
          { label: 'Active Exam Cycles', value: String(activeExamCount), icon: 'ClipboardList' },
          { label: 'Exam Pipelines', value: String(draftExamCount), icon: 'BarChart3' },
        ]
        ,
        latestSubmissions: latestSubmissions.map((item: any) => ({
          id: item.id,
          departmentId: item.details,
          department: departmentById.get(String(item.details || '')) || 'Unknown Department',
          status: item.status,
          requestedAt: item.requestedAt,
          requestedBy: item.requestedBy,
          requestedByName: userById.get(String(item.requestedBy || '')) || item.requestedBy
        }))
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/submissions', authenticate, async (_req: Request, res: Response) => {
  try {
    const submissions = await prisma.approvalItem.findMany({
      where: { type: 'result_publication' },
      orderBy: { requestedAt: 'desc' },
    });

    const departmentIds = submissions
      .map((item: any) => String(item.details || ''))
      .filter(Boolean);
    const departments = departmentIds.length > 0
      ? await prisma.department.findMany({ where: { id: { in: departmentIds } } })
      : [];
    const requestUserIds = submissions
      .map((item: any) => String(item.requestedBy || ''))
      .filter(Boolean);
    const requestUsers = requestUserIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: requestUserIds } } })
      : [];
    const departmentById = new Map(departments.map((dept: any) => [dept.id, dept.name]));
    const userById = new Map(requestUsers.map((user: any) => [user.id, user.name]));

    res.json({
      success: true,
      data: submissions.map((item: any) => ({
        id: item.id,
        departmentId: item.details,
        department: departmentById.get(String(item.details || '')) || 'Unknown Department',
        status: item.status,
        requestedAt: item.requestedAt,
        requestedBy: item.requestedBy,
        requestedByName: userById.get(String(item.requestedBy || '')) || item.requestedBy,
        title: item.title,
        priority: item.priority
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/results', authenticate, async (_req: Request, res: Response) => {
  try {
    const [departments, approvals] = await Promise.all([
      prisma.department.findMany({ include: { courses: { include: { enrollments: true } } } }),
      prisma.approvalItem.findMany({ where: { type: 'result_publication' } })
    ]);

    const approvalByDepartmentId = new Map<string, any>();
    for (const approval of approvals) {
      if (approval.details) {
        approvalByDepartmentId.set(String(approval.details), approval);
      }
    }

    res.json({
      success: true,
      data: departments.map((d: any) => {
        const totalEnrollments = d.courses.reduce((sum: number, c: any) => sum + c.enrollments.length, 0);
        const passed = d.courses.reduce((sum: number, c: any) =>
          sum + c.enrollments.filter((e: any) => e.grade && !['F', 'I'].includes(e.grade)).length, 0);

        const approval = approvalByDepartmentId.get(String(d.id));
        let status = 'draft';
        if (approval?.status === 'pending') status = 'pending_approval';
        if (approval?.status === 'published' || approval?.status === 'approved') status = 'published';

        return {
          departmentId: d.id,
          department: d.name,
          totalStudents: totalEnrollments,
          passed,
          failed: totalEnrollments - passed,
          passPercentage: totalEnrollments > 0 ? Math.round((passed / totalEnrollments) * 100) : 0,
          avgGPA: 7.2,
          status
        };
      })
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Submit a department's results for publication (Phase 2.4 — engine-backed).
 *
 * The HTTP contract is unchanged. What changed is underneath: this now STARTS a
 * workflow instance, and the `ApprovalItem` row it returns is a projection of
 * that instance rather than the record itself.
 *
 * The behaviour this replaces: the handler reset ANY existing row back to
 * `pending`, including one already `published`. A published result could be
 * quietly pulled back into the queue and published again, with the record
 * showing only the latest state and nothing about the round trip. The engine
 * refuses a second open instance for the same department, so that path is now a
 * 409 instead of a silent overwrite.
 */
router.post('/results/:id/submit', authenticate, async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    const identifier = decodeURIComponent(String(req.params.id));
    const userId = String((req as any).user.id);

    const department = await prisma.department.findFirst({
      where: { OR: [{ id: identifier }, { name: identifier }] }
    });

    if (!department) {
      res.status(404).json({ success: false, message: 'Department not found' });
      return;
    }

    await ensureDefinition(ctx, RESULT_PUBLICATION);

    // Throws ConflictError (409) if this department already has a submission in
    // flight. That is the point: two open publications of one department's
    // results could reach opposite conclusions.
    const instance = await workflow.startWorkflow(ctx, {
      code: RESULT_PUBLICATION.code,
      entityType: RESULT_PUBLICATION.entityType,
      entityId: String(department.id),
      context: { department: department.name, submittedBy: userId }
    });

    // The queue projection. Created fresh per submission rather than recycling
    // the previous row: each publication cycle is its own request, and reusing
    // one row is what allowed a decided item to be reopened in place.
    const created = await prisma.approvalItem.create({
      data: {
        institutionId: ctx.institutionId,
        type: 'result_publication',
        title: `Result publication request - ${department.name}`,
        details: String(department.id),
        requestedBy: userId,
        priority: 'medium',
        status: 'pending',
        workflowInstanceId: instance.instanceId
      }
    });

    res.json({
      success: true,
      data: {
        approvalId: created.id,
        instanceId: instance.instanceId,
        departmentId: department.id,
        department: department.name,
        status: 'pending_approval',
        waitingOn: instance.assigneeRole,
        currentStep: instance.currentStep
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

export default router;
