/**
 * Razorpay payment gateway.
 *
 * THE GAP THIS ADDRESSES: fee "payment" existed only as manual data entry.
 * `Payment.gateway` was a free-text label somebody typed after collecting
 * money through an entirely separate channel — there was no integration, no
 * online checkout, and no reconciliation. A student could not pay through the
 * portal at all.
 *
 * DESIGN RULE — same as `storage.ts` and `providers.ts`: this activates when
 * credentials are present and refuses clearly when they are not. It never
 * pretends to have taken a payment.
 *
 * WHAT IS DELIBERATELY NOT HERE: no card details, no UPI handles, no bank
 * credentials ever reach this server. The browser talks to Razorpay's own
 * checkout with the order id created here, so this application stays outside
 * PCI scope. Anything else would put card data in an application whose threat
 * model was never built for it.
 *
 * TRUST BOUNDARY: the ONLY trustworthy report that money moved is the
 * webhook, verified by HMAC signature. The browser's success callback is not
 * trusted — it is attacker-controlled, and treating it as proof of payment is
 * the single most common way gateway integrations are defrauded. This module
 * therefore records a payment on the webhook path only.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { IntegrationError, ValidationError } from '../../lib/errors.js';

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

/** Read at CALL TIME so tests and a credential rotation both take effect without a restart. */
export function razorpayConfig(): RazorpayConfig {
  return {
    keyId: process.env.RAZORPAY_KEY_ID ?? '',
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? ''
  };
}

export function razorpayConfigured(): boolean {
  const c = razorpayConfig();
  return Boolean(c.keyId && c.keySecret);
}

function requireConfigured(): RazorpayConfig {
  const c = razorpayConfig();
  if (!c.keyId || !c.keySecret) {
    throw new IntegrationError(
      'Online payment is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET ' +
        '(and RAZORPAY_WEBHOOK_SECRET, without which payments cannot be confirmed).',
      { gateway: 'razorpay' }
    );
  }
  return c;
}

/**
 * Rupees to paise.
 *
 * Razorpay takes the amount in the smallest currency subunit — ₹299 is sent
 * as 29900. Getting this wrong by a factor of 100 in either direction is the
 * classic gateway bug, so the conversion lives in exactly one place and
 * rounds explicitly rather than trusting float arithmetic: 0.1 + 0.2 in
 * binary floating point is not 0.3, and a fee ledger cannot afford that.
 */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Paise back to rupees, for recording what the gateway says was actually captured. */
export function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}

export interface CreatedOrder {
  orderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
}

/**
 * Create a Razorpay order.
 *
 * `notes` carries the institution, student and fee-record ids. Razorpay
 * echoes them back on the webhook, and the webhook's signature proves they
 * came from Razorpay unmodified — which is what lets a single gateway account
 * serve a multi-tenant deployment without the webhook having to guess which
 * institution a payment belongs to.
 */
export async function createOrder(input: {
  amountRupees: number;
  receipt: string;
  notes: Record<string, string>;
}): Promise<CreatedOrder> {
  const config = requireConfigured();
  const amountPaise = rupeesToPaise(input.amountRupees);

  if (amountPaise <= 0) {
    throw new ValidationError('Payment amount must be greater than zero.', { field: 'amount' });
  }

  const auth = Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64');

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: 'INR',
      // Razorpay caps receipt at 40 characters and rejects the request above it.
      receipt: input.receipt.slice(0, 40),
      notes: input.notes
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new IntegrationError(`Razorpay refused the order: ${detail}`, {
      gateway: 'razorpay',
      status: response.status
    });
  }

  const order = (await response.json()) as { id: string; amount: number; currency: string };

  return {
    orderId: order.id,
    amountPaise: order.amount,
    currency: order.currency,
    // The browser needs the PUBLIC key id to open checkout. The secret never leaves this process.
    keyId: config.keyId
  };
}

/**
 * Verify a webhook signature.
 *
 * HMAC-SHA256 over the RAW request body, keyed with the webhook secret, per
 * Razorpay's documentation — which is explicit that the body must not be
 * parsed or re-serialised first. `JSON.parse` followed by `JSON.stringify`
 * does not reliably round-trip byte-for-byte (key order, unicode escapes,
 * float formatting), and any difference makes every signature fail.
 *
 * Compared with `timingSafeEqual`, not `===`. A byte-by-byte early-exit
 * comparison leaks how much of a forged signature was correct, which is
 * enough to reconstruct a valid one given enough attempts.
 */
export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  const { webhookSecret } = razorpayConfig();

  if (!webhookSecret) {
    throw new IntegrationError(
      'RAZORPAY_WEBHOOK_SECRET is not set, so payment confirmations cannot be verified. ' +
        'Refusing to accept an unverified payment notification.',
      { gateway: 'razorpay' }
    );
  }

  const expected = createHmac('sha256', webhookSecret).update(rawBody).digest();

  let provided: Buffer;
  try {
    provided = Buffer.from(signature, 'hex');
  } catch {
    return false;
  }

  // timingSafeEqual throws on a length mismatch, which is itself a signal —
  // handled here so a wrong-length signature is a clean `false`.
  if (provided.length !== expected.length) return false;

  return timingSafeEqual(provided, expected);
}

export interface CapturedPayment {
  event: string;
  paymentId: string;
  orderId: string | null;
  amountRupees: number;
  status: string;
  notes: Record<string, string>;
}

/**
 * Pull the fields we act on out of a webhook body.
 *
 * Paths verified against Razorpay's published payload reference:
 * `payload.payment.entity.{id,order_id,amount,status}`.
 */
export function parsePaymentWebhook(body: unknown): CapturedPayment | null {
  const event = (body as { event?: string })?.event;
  if (typeof event !== 'string') return null;

  const entity = (body as {
    payload?: { payment?: { entity?: Record<string, unknown> } };
  })?.payload?.payment?.entity;

  if (!entity || typeof entity.id !== 'string') return null;

  return {
    event,
    paymentId: entity.id,
    orderId: typeof entity.order_id === 'string' ? entity.order_id : null,
    amountRupees: paiseToRupees(Number(entity.amount ?? 0)),
    status: typeof entity.status === 'string' ? entity.status : 'unknown',
    notes: (entity.notes as Record<string, string>) ?? {}
  };
}
