/**
 * Finance routes.
 *
 * Thin HTTP layer over `finance.service`. Two things are worth noting:
 *
 *  - `Idempotency-Key` is REQUIRED on the payment endpoint. Most APIs treat it
 *    as optional; for an endpoint that moves money and is called from a form a
 *    cashier can double-click, optional means "absent when it matters".
 *
 *  - Receipt verification is deliberately outside the finance role gate, since
 *    the point is that a receipt holder can check it. It still requires
 *    authentication and the exact code.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authorizeRoles } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { entityId } from '../../schemas/common.js';
import { getTenantContext } from '../../lib/tenant.js';
import { ValidationError } from '../../lib/errors.js';
import * as service from './finance.service.js';
import { PAYMENT_METHODS } from './finance.service.js';
import { formatInr } from './money.js';

const router = Router();

function pathParam(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0]! : (value as string);
}

/**
 * Who may record money received.
 *
 * `finance_officer` is the system's actual role name. An earlier version of this
 * file used `accountant`, which does not exist in this deployment — the effect
 * was that the one role that needs the finance module could not use any of it,
 * and the verification missed it because it ran as super_admin and registrar.
 * Found by the Phase 1.5 latency run, which called the ledger as the finance
 * officer and got a 403.
 */
const FINANCE_WRITE = authorizeRoles('super_admin', 'finance_officer', 'registrar');

/**
 * Who may read ANOTHER student's ledger.
 *
 * A set rather than middleware because the ledger route's authorisation depends
 * on the path parameter — a student reading their own ledger is allowed, and
 * middleware cannot see that distinction.
 */
const FINANCE_READ_ROLES = new Set([
  'super_admin',
  'finance_officer',
  'registrar',
  'principal',
  'auditor',
  'vice_chancellor',
  'hod',
  'dean'
]);

const allocationSchema = z
  .object({
    feeRecordId: entityId,
    amount: z.number().positive().max(100_000_000)
  })
  .strict();

const recordPaymentSchema = z
  .object({
    studentProfileId: entityId,
    amount: z.number().positive().max(100_000_000),
    method: z.enum(PAYMENT_METHODS),
    allocations: z.array(allocationSchema).min(1).max(50).optional(),
    transactionReference: z.string().trim().min(1).max(120).optional(),
    gateway: z.string().trim().min(1).max(60).optional(),
    paidAt: z.coerce.date().optional(),
    remarks: z.string().trim().max(500).optional()
  })
  .strict();

/**
 * Record a payment and issue its receipt.
 *
 * Requires `Idempotency-Key`. A repeat with the same key returns the ORIGINAL
 * payment rather than creating a second one.
 */
router.post(
  '/payments',
  FINANCE_WRITE,
  validate({ body: recordPaymentSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = getTenantContext(req);

    const idempotencyKey = req.header('Idempotency-Key');

    if (!idempotencyKey || idempotencyKey.trim().length < 8) {
      // Refused rather than defaulted. Generating a key server-side would defeat
      // the purpose — the whole mechanism depends on the CLIENT sending the same
      // key when it retries.
      throw new ValidationError(
        'An Idempotency-Key header of at least 8 characters is required to record a payment. ' +
          'Generate one unique value per payment attempt (a UUID is ideal) and resend the SAME value if the request is retried — this is what prevents a double-click or a network retry from charging the student twice.',
        { field: 'Idempotency-Key' }
      );
    }

    const body = req.body as z.infer<typeof recordPaymentSchema>;

    const { payment, replayed } = await service.recordPayment(ctx, {
      studentProfileId: body.studentProfileId,
      amount: body.amount,
      method: body.method,
      allocations: body.allocations,
      transactionReference: body.transactionReference,
      gateway: body.gateway,
      paidAt: body.paidAt,
      remarks: body.remarks,
      idempotencyKey: idempotencyKey.trim()
    });

    // Tells the caller no new charge occurred — useful when a client cannot
    // otherwise distinguish "succeeded" from "already succeeded".
    res.setHeader('Idempotent-Replay', replayed ? 'true' : 'false');

    res.status(replayed ? 200 : 201).json({
      success: true,
      replayed,
      message: replayed
        ? `This payment was already recorded as ${payment.paymentNumber}. No second charge was made.`
        : `Recorded ${formatInr(payment.amount)} as ${payment.paymentNumber}.`,
      data: payment
    });
  })
);

/** A student's fee ledger. */
router.get(
  '/students/:studentProfileId/ledger',
  validate({ params: z.object({ studentProfileId: entityId }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = getTenantContext(req);
    const studentProfileId = pathParam(req, 'studentProfileId');

    // A student may read their own ledger; anyone else needs a finance role.
    // Checked here rather than by middleware because the answer depends on the
    // path parameter.
    if (ctx.role === 'student') {
      const own = await service.resolveOwnStudentProfileId(ctx);
      if (own !== studentProfileId) {
        res.status(403).json({
          success: false,
          error: { code: 'AUTHORIZATION_ERROR', message: 'You may only view your own fee ledger.' }
        });
        return;
      }
    } else if (!FINANCE_READ_ROLES.has(ctx.role)) {
      res.status(403).json({
        success: false,
        error: { code: 'AUTHORIZATION_ERROR', message: 'You are not permitted to view student fee ledgers.' }
      });
      return;
    }

    const ledger = await service.getLedger(ctx, studentProfileId);
    res.json({ success: true, data: ledger });
  })
);

/** Cancel a receipt. Requires a reason; the number is never reused. */
router.post(
  '/receipts/:receiptId/cancel',
  FINANCE_WRITE,
  validate({
    params: z.object({ receiptId: entityId }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = getTenantContext(req);
    const result = await service.cancelReceipt(
      ctx,
      pathParam(req, 'receiptId'),
      (req.body as { reason: string }).reason
    );

    res.json({
      success: true,
      message: `Receipt ${result.receiptNumber} cancelled. The number remains reserved — receipt series must not contain gaps.`,
      data: result
    });
  })
);

/** Verify a receipt by number + code. */
router.get(
  '/receipts/verify',
  validate({
    query: z
      .object({
        receiptNumber: z.string().trim().min(3).max(60),
        code: z.string().trim().min(4).max(40)
      })
      .strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = getTenantContext(req);
    const query = req.query as unknown as { receiptNumber: string; code: string };

    const result = await service.verifyReceipt(ctx, query.receiptNumber, query.code);
    res.json({ success: true, data: result });
  })
);

export default router;
