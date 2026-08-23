/**
 * Notification routes. Thin HTTP layer over the dispatch service.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authorizeRoles } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { entityId, institutionalCode } from '../../schemas/common.js';
import { getTenantContext } from '../../lib/tenant.js';
import * as service from './notifications.service.js';

const router = Router();

function pathParam(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0]! : (value as string);
}

/** Templates and policies govern what the institution says on its own behalf. */
const COMMS_AUTHORITY = authorizeRoles('super_admin', 'registrar', 'vice_chancellor', 'pro_vc');

const CHANNELS = ['in_app', 'email', 'sms', 'push', 'whatsapp'] as const;
const idParam = z.object({ id: entityId });

// ─── Templates ────────────────────────────────────────────────────────────────

router.post(
  '/templates',
  COMMS_AUTHORITY,
  validate({
    body: z
      .object({
        code: institutionalCode,
        name: z.string().trim().min(3).max(120),
        eventType: z.string().trim().regex(/^[a-z]+(\.[a-z_]+)+$/, 'Event type must be dot.separated lowercase, e.g. fee.overdue.'),
        channel: z.enum(CHANNELS),
        subject: z.string().trim().max(200).optional(),
        body: z.string().trim().min(5).max(4000),
        version: z.string().trim().max(10).optional()
      })
      .strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await service.createTemplate(req.body) });
  })
);

// ─── Policies ─────────────────────────────────────────────────────────────────

router.post(
  '/policies',
  COMMS_AUTHORITY,
  validate({
    body: z
      .object({
        code: institutionalCode,
        name: z.string().trim().min(3).max(120),
        eventType: z.string().trim().min(3).max(80),
        channels: z.array(z.enum(CHANNELS)).min(1),
        targetRoles: z.array(z.string().trim().max(40)).max(20).optional(),
        notifySubject: z.boolean().optional(),
        notifyGuardian: z.boolean().optional(),
        delayMinutes: z.number().int().min(0).max(10080).optional()
      })
      .strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await service.createPolicy(req.body) });
  })
);

// ─── Dispatch ─────────────────────────────────────────────────────────────────

/**
 * Dispatch a domain event.
 *
 * Normally called from within a service (fee overdue, result published), but
 * exposed so an operator can trigger a broadcast and so the pipeline is
 * testable without waiting for a real event.
 */
router.post(
  '/dispatch',
  authorizeRoles('super_admin', 'registrar', 'vice_chancellor', 'pro_vc', 'coe', 'finance_officer'),
  validate({
    body: z
      .object({
        eventType: z.string().trim().min(3).max(80),
        variables: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
        subjectUserId: entityId.optional(),
        relatedEntityType: z.string().trim().max(60).optional(),
        relatedEntityId: entityId.optional()
      })
      .strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await service.dispatch(req.body) });
  })
);

router.post(
  '/retry',
  COMMS_AUTHORITY,
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, data: await service.retryFailedDeliveries() });
  })
);

// ─── Statistics & inbox ───────────────────────────────────────────────────────

/** Derived from real delivery attempts — unlike the previous stored counters. */
router.get(
  '/statistics',
  validate({ query: z.object({ eventType: z.string().trim().max(80).optional() }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const { eventType } = req.query as unknown as { eventType?: string };
    res.json({ success: true, data: await service.getDeliveryStatistics(eventType) });
  })
);

/** The caller's own inbox — identity comes from the token, never a parameter. */
router.get(
  '/inbox',
  validate({ query: z.object({ unreadOnly: z.coerce.boolean().optional() }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = getTenantContext(req);
    const { unreadOnly } = req.query as unknown as { unreadOnly?: boolean };
    res.json({ success: true, data: await service.getInbox(ctx.userId, unreadOnly ?? false) });
  })
);

router.post(
  '/inbox/:id/read',
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = getTenantContext(req);
    res.json({ success: true, data: await service.markRead(pathParam(req, 'id'), ctx.userId) });
  })
);

export default router;
