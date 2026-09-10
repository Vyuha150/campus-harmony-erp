/**
 * Online fee payment (Razorpay).
 *
 * Two routes with deliberately different security models:
 *
 *   POST /finance/payments/gateway/order    authenticated, tenant-scoped
 *   POST /finance/payments/gateway/webhook  UNAUTHENTICATED, signature-verified
 *
 * The webhook cannot be authenticated the normal way — Razorpay's servers hold
 * no JWT — so it is mounted OUTSIDE the tenant middleware in `server.ts` and
 * proves itself with an HMAC signature instead. That signature is the entire
 * security boundary for this route, which is why it is verified before the
 * body is trusted for anything at all, including deciding which institution
 * the payment belongs to.
 *
 * A payment is recorded ONLY here, on the webhook. The browser's success
 * callback never records anything: it is attacker-controlled, and a gateway
 * integration that credits a fee ledger on the strength of it can be drained
 * by anyone who can open developer tools.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { entityId } from '../../schemas/common.js';
import { getTenantContext } from '../../lib/tenant.js';
import { ValidationError, IntegrationError } from '../../lib/errors.js';
import { basePrisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { record } from '../../lib/audit.js';
import * as service from './finance.service.js';
import {
  createOrder,
  razorpayConfigured,
  verifyWebhookSignature,
  parsePaymentWebhook
} from './razorpay.js';

/** Routes that require a logged-in caller. Mounted under the tenant-scoped finance path. */
export const gatewayRouter = Router();

/** The webhook. Mounted separately, before authentication. */
export const gatewayWebhookRouter = Router();

const createOrderSchema = z
  .object({
    studentProfileId: entityId,
    amount: z.coerce.number().positive().max(10_000_000)
  })
  .strict();

/**
 * Create a payment order for the student to complete in Razorpay Checkout.
 *
 * Creating an order does NOT record a payment and does not touch the ledger.
 * It only reserves an id at the gateway.
 */
gatewayRouter.post(
  '/payments/gateway/order',
  validate({ body: createOrderSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = getTenantContext(req);
    const body = req.body as z.infer<typeof createOrderSchema>;
    const caller = (req as Request & { user?: { id: string; role: string } }).user!;

    const student = await basePrisma.studentProfile.findFirst({
      where: { id: body.studentProfileId, institutionId: ctx.institutionId },
      select: { id: true, userId: true, rollNumber: true }
    });

    if (!student) throw new ValidationError('No such student in this institution.');

    // A student may pay their OWN fees and nobody else's. Staff raising a
    // payment link on a student's behalf is a separate, allowed case.
    const isSelf = student.userId === caller.id;
    const isStaff = ['super_admin', 'finance_officer', 'registrar'].includes(caller.role);
    if (!isSelf && !isStaff) {
      throw new ValidationError('You may only pay your own fees.');
    }

    const order = await createOrder({
      amountRupees: body.amount,
      receipt: `${student.rollNumber}-${Date.now()}`,
      // Echoed back on the webhook and covered by its signature. This is how a
      // single gateway account serves a multi-tenant deployment without the
      // webhook having to guess the institution.
      notes: {
        institutionId: ctx.institutionId,
        studentProfileId: student.id,
        initiatedBy: caller.id
      }
    });

    res.status(201).json({ success: true, data: order });
  })
);

/**
 * Razorpay payment webhook.
 *
 * Returns 200 for anything it has legitimately finished with — including
 * events it deliberately ignores — because Razorpay retries on non-2xx, and
 * retrying an event we will never act on achieves nothing but noise.
 * A BAD SIGNATURE returns 400: that is not a delivery problem, and it should
 * be loud.
 */
gatewayWebhookRouter.post(
  '/payments/gateway/webhook',
  asyncHandler(async (req: Request, res: Response) => {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const signature = req.header('X-Razorpay-Signature');

    if (!rawBody) {
      // Means the raw-body capture in server.ts did not run for this path.
      throw new IntegrationError(
        'Raw request body unavailable, so the webhook signature cannot be verified.'
      );
    }

    if (!signature || !verifyWebhookSignature(rawBody, signature)) {
      logger.warn('Rejected Razorpay webhook with an invalid signature', {
        module: 'finance',
        operation: 'gateway.webhook',
        hasSignature: Boolean(signature)
      });
      res.status(400).json({ success: false, message: 'Invalid signature.' });
      return;
    }

    const parsed = parsePaymentWebhook(req.body);

    if (!parsed) {
      res.json({ success: true, message: 'Ignored: unrecognised payload shape.' });
      return;
    }

    // Only a CAPTURED payment is money actually taken. `payment.authorized`
    // means the funds are held, not collected, and crediting a ledger on it
    // would show a student as paid against money that may never arrive.
    if (parsed.event !== 'payment.captured') {
      res.json({ success: true, message: `Ignored event ${parsed.event}.` });
      return;
    }

    const institutionId = parsed.notes.institutionId;
    const studentProfileId = parsed.notes.studentProfileId;

    if (!institutionId || !studentProfileId) {
      // Signature was valid, so this really came from Razorpay — but it is not
      // an order this application created. Logged rather than 4xx'd: retrying
      // will not add the notes.
      logger.error('Razorpay webhook lacked the notes needed to attribute it', {
        module: 'finance',
        operation: 'gateway.webhook',
        paymentId: parsed.paymentId
      });
      res.json({ success: true, message: 'Ignored: payment could not be attributed.' });
      return;
    }

    const student = await basePrisma.studentProfile.findFirst({
      where: { id: studentProfileId, institutionId },
      select: { id: true, userId: true }
    });

    if (!student) {
      logger.error('Razorpay webhook referenced an unknown student', {
        module: 'finance',
        operation: 'gateway.webhook',
        paymentId: parsed.paymentId
      });
      res.json({ success: true, message: 'Ignored: student not found.' });
      return;
    }

    // The gateway's own payment id is the idempotency key. Razorpay retries a
    // webhook until it gets a 2xx and may deliver the same event more than
    // once regardless, so this is exactly the case the finance service's
    // idempotency was built for — a replay returns the original payment
    // instead of crediting the student twice.
    // Attributed to the STUDENT, not to a synthetic "system" actor. They are
    // who actually paid, `SystemAuditLog.userId` is a real foreign key so an
    // invented id fails outright, and a seeded pseudo-user would make the
    // audit trail read as though a robot paid the fees.
    const { payment, replayed } = await service.recordPayment(
      { institutionId, campusId: null, userId: student.userId, role: 'student' } as never,
      {
        studentProfileId: student.id,
        amount: parsed.amountRupees,
        method: 'online',
        gateway: 'razorpay',
        transactionReference: parsed.paymentId,
        idempotencyKey: `razorpay:${parsed.paymentId}`
      }
    );

    await record({
      userId: student.userId,
      userName: 'Razorpay webhook',
      role: 'student',
      action: 'CREATE',
      module: 'finance',
      resource: `Payment:${payment.id}`,
      details: `Online payment ${parsed.paymentId} captured via Razorpay${replayed ? ' (duplicate webhook delivery, no second charge)' : ''}`,
      severity: 'info'
    });

    res.json({ success: true, replayed, paymentNumber: payment.paymentNumber });
  })
);

/** Whether online payment is available, so the UI can hide the button when it is not. */
gatewayRouter.get(
  '/payments/gateway/status',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, data: { configured: razorpayConfigured(), gateway: 'razorpay' } });
  })
);
