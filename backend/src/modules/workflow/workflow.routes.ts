/**
 * Workflow routes (Phase 2.3).
 *
 * Role checks live in the SERVICE, not here, because who may act depends on the
 * step an instance is currently at — a fact middleware cannot see.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authorizeRoles } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { entityId } from '../../schemas/common.js';
import { getTenantContext } from '../../lib/tenant.js';
import * as service from './workflow.service.js';
import { WORKFLOW_ACTIONS } from './workflow.service.js';

const router = Router();

function pathParam(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0]! : (value as string);
}

/** Who may define a process. Changing an approval chain is a governance act. */
const WORKFLOW_ADMIN = authorizeRoles('super_admin', 'registrar', 'vice_chancellor');

const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

const defineSchema = z
  .object({
    code: z.string().trim().regex(/^[A-Z][A-Z0-9_]{2,39}$/, 'code must be UPPER_SNAKE_CASE'),
    name: z.string().trim().min(3).max(120),
    description: z.string().trim().max(500).optional(),
    entityType: z.string().trim().min(2).max(60),
    steps: z
      .array(
        z
          .object({
            sequence: z.number().int().min(1).max(50),
            name: z.string().trim().min(2).max(80),
            assigneeRole: z.string().trim().min(2).max(40),
            slaHours: z.number().int().min(1).max(8760).optional(),
            escalationRole: z.string().trim().min(2).max(40).optional()
          })
          .strict()
      )
      .min(1)
      .max(20)
  })
  .strict();

router.post(
  '/definitions',
  WORKFLOW_ADMIN,
  validate({ body: defineSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof defineSchema>;
    const result = await service.defineWorkflow(getTenantContext(req), body);

    res.status(201).json({
      success: true,
      message:
        `Defined ${result.code} v${result.version} with ${result.steps} step(s). ` +
        (result.version > 1
          ? 'The previous version is retained — instances already running keep the process they started under.'
          : ''),
      data: result
    });
  })
);

const startSchema = z
  .object({
    code: z.string().trim().min(3).max(40),
    entityType: z.string().trim().min(2).max(60),
    entityId: z.string().trim().min(1).max(80),
    context: z.record(z.string(), z.unknown()).optional()
  })
  .strict();

router.post(
  '/instances',
  validate({ body: startSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof startSchema>;
    const result = await service.startWorkflow(getTenantContext(req), body);

    res.status(201).json({
      success: true,
      message: `Started. Now waiting on ${result.assigneeRole} at "${result.currentStep}".`,
      data: result
    });
  })
);

const actSchema = z
  .object({
    action: z.enum(WORKFLOW_ACTIONS),
    note: z.string().trim().max(500).optional()
  })
  .strict();

/** Act on the step an instance is waiting at. */
router.post(
  '/instances/:instanceId/act',
  validate({ params: z.object({ instanceId: entityId }), body: actSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof actSchema>;
    const result = await service.act(
      getTenantContext(req),
      pathParam(req, 'instanceId'),
      body.action,
      body.note
    );

    res.json({
      success: true,
      message: result.complete
        ? `Workflow ${result.status}.`
        : `Recorded. Now waiting on ${result.assigneeRole} at "${result.currentStep}".`,
      data: result
    });
  })
);

/** What is waiting on the caller's role. */
router.get(
  '/inbox',
  validate({ query: pageQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as { page: number; pageSize: number };
    const result = await service.inbox(getTenantContext(req), q);
    res.json({ success: true, ...result });
  })
);

/** Full transition history — the audit view. */
router.get(
  '/instances/:instanceId',
  validate({ params: z.object({ instanceId: entityId }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await service.history(getTenantContext(req), pathParam(req, 'instanceId'));
    res.json({ success: true, data: result });
  })
);

/**
 * Escalate every approval past its SLA.
 *
 * A called sweep, not a timer: there is no scheduler in this system, and a
 * `POST` that reports exactly what moved is more honest than a background job
 * nobody can see. Point a cron entry at it if you want it periodic.
 *
 * It widens who may act; it decides nothing.
 */
router.post(
  '/escalate',
  WORKFLOW_ADMIN,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await service.escalateOverdue(getTenantContext(req));
    res.json({
      success: true,
      message:
        `${result.escalated} escalated, ${result.overdueWithoutRole} overdue with no escalation role.`,
      data: result
    });
  })
);

export default router;
