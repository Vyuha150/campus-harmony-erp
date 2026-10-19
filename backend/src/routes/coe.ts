import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { getTenantContext } from '../lib/tenant.js';
import * as coeService from '../modules/coe/coe.service.js';
import { sendError } from '../lib/errors.js';
import * as workflow from '../modules/workflow/workflow.service.js';
import { ensureDefinition } from '../modules/workflow/bridge.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { z } from 'zod';
import * as exams from '../modules/coe/exams.service.js';
import { createExamSchema, updateExamSchema } from '../modules/coe/exams.schema.js';
import { RESULT_PUBLICATION } from '../modules/workflow/builtins.js';
import { authorizeRoles } from '../middleware/auth.js';
import { entityId } from '../schemas/common.js';
import * as resultsFlow from '../modules/examination/resultsFlow.js';
import * as examOffice from '../modules/examination/examOffice.js';
import * as examEngine from '../modules/examination/examination.service.js';
import { isoDate, academicYear } from '../schemas/common.js';

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

router.get(
  '/dashboard',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await coeService.dashboard(getTenantContext(req));
    res.json({ success: true, data });
  })
);

// Was unpaginated: every result-publication row, however many existed.
router.get(
  '/submissions',
  authenticate,
  validate({ query: examPage }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as { page: number; pageSize: number };
    const result = await coeService.listSubmissions(getTenantContext(req), q);
    res.json({ success: true, ...result });
  })
);

/**
 * Department-by-department result readiness.
 *
 * `avgGPA` is now COMPUTED from published SemesterResult rows reached through
 * Department -> Programme -> StudentProfile. It was the literal 7.2, identical
 * for every department, on the screen used to decide whether results are fit to
 * publish. `null` where nothing is published yet.
 */
router.get(
  '/results',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await coeService.departmentResults(getTenantContext(req));
    res.json({ success: true, data });
  })
);

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
// ─── Moderation and revaluation ───
const COE_ONLY = authorizeRoles('coe', 'super_admin');

// ─── Exam timetable, registration and hall tickets ───
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM.');

/** Every course, for scheduling papers. */
router.get('/courses', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const rows = await prisma.course.findMany({ include: { department: { select: { code: true } } }, orderBy: [{ semester: 'asc' }, { code: 'asc' }] });
  res.json({ success: true, data: rows.map((c: any) => ({ id: c.id, code: c.code, name: c.name, semester: c.semester, department: c.department?.code ?? null })) });
}));

router.get('/sessions', authenticate, asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await examOffice.listSessions(getTenantContext(req)) });
}));

router.get('/sessions/:id', authenticate, validate({ params: z.object({ id: entityId }) }), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await examOffice.sessionDetail(getTenantContext(req), String(req.params.id)) });
}));

router.post('/sessions', authenticate, COE_ONLY, validate({
  body: z.object({
    code: z.string().trim().min(2).max(40), name: z.string().trim().min(3).max(160),
    type: z.enum(['internal', 'mid_semester', 'end_semester', 'supplementary', 'revaluation', 'special']),
    academicYear, semester: z.number().int().min(1).max(12),
    registrationStartsAt: isoDate, registrationEndsAt: isoDate, examStartsAt: isoDate, examEndsAt: isoDate,
    minAttendancePercentage: z.number().min(0).max(100).optional(), requireFeeClearance: z.boolean().optional()
  }).strict()
}), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await examEngine.createSession(req.body) });
}));

router.post('/sessions/:id/schedules', authenticate, COE_ONLY, validate({
  params: z.object({ id: entityId }),
  body: z.object({ courseId: entityId, examDate: isoDate, startTime: hhmm, endTime: hhmm, venue: z.string().trim().max(120).optional(), maxMarks: z.number().int().min(1).max(1000).optional() }).strict()
}), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await examEngine.addSchedule({ sessionId: String(req.params.id), ...req.body }) });
}));

router.delete('/schedules/:id', authenticate, COE_ONLY, validate({ params: z.object({ id: entityId }) }), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await examOffice.removeSchedule(getTenantContext(req), String(req.params.id)) });
}));

router.post('/sessions/:id/open-registration', authenticate, COE_ONLY, validate({ params: z.object({ id: entityId }) }), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await examEngine.openRegistration(String(req.params.id)) });
}));

router.post('/sessions/:id/register-all', authenticate, COE_ONLY, validate({ params: z.object({ id: entityId }) }), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await examOffice.registerAll(getTenantContext(req), String(req.params.id)) });
}));

router.post('/sessions/:id/close-registration', authenticate, COE_ONLY, validate({ params: z.object({ id: entityId }) }), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await examOffice.closeRegistration(getTenantContext(req), String(req.params.id)) });
}));

router.post('/sessions/:id/hall-tickets', authenticate, COE_ONLY, validate({ params: z.object({ id: entityId }) }), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await examOffice.issueAllHallTickets(getTenantContext(req), String(req.params.id)) });
}));

/** Every open paper with its stage (awaiting marks → entered → verified → moderated → published). */
router.get('/moderation', authenticate, asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await resultsFlow.allSheets(getTenantContext(req)) });
}));

router.post(
  '/moderation/:scheduleId',
  authenticate,
  COE_ONLY,
  validate({
    params: z.object({ scheduleId: entityId }),
    body: z.object({ adjustments: z.array(z.object({ courseResultId: entityId, revisedTotal: z.number().min(0).max(1000), reason: z.string().trim().min(10).max(500) }).strict()).max(500).default([]) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await resultsFlow.moderateCourse(getTenantContext(req), String(req.params.scheduleId), req.body.adjustments) });
  })
);

router.get('/revaluations', authenticate, asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await resultsFlow.revaluationQueue(getTenantContext(req)) });
}));

router.post(
  '/revaluations/:id/complete',
  authenticate,
  COE_ONLY,
  validate({ params: z.object({ id: entityId }), body: z.object({ revisedExternal: z.number().min(0).max(1000), remarks: z.string().trim().max(500).optional() }).strict() }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await resultsFlow.completeRevaluation(getTenantContext(req), String(req.params.id), req.body.revisedExternal, req.body.remarks) });
  })
);

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

    // Only moderated results can go to the Dean; this used to submit a
    // department with nothing entered at all.
    const readiness = await resultsFlow.departmentReadiness(ctx, department.id);
    if (!readiness.ready) {
      res.status(400).json({ success: false, message: readiness.waiting.length === 0 ? `${department.name} has no moderated results waiting to be published.` : `Not ready: ${readiness.waiting.join(', ')} must be moderated first.` });
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
