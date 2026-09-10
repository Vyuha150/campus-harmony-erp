/**
 * Payment gateway tests.
 *
 * The webhook signature is the ENTIRE security boundary for an endpoint that
 * credits a student's fee ledger without any authentication. If it can be
 * bypassed, anyone on the internet can mark any fee as paid. These tests exist
 * for that one property, plus the amount conversion — a factor-of-100 error in
 * a payment integration is the classic version of this bug.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  rupeesToPaise,
  paiseToRupees,
  verifyWebhookSignature,
  parsePaymentWebhook,
  razorpayConfigured
} from '../modules/finance/razorpay.js';
import { IntegrationError } from '../lib/errors.js';

const SECRET = 'test_webhook_secret_value';

beforeEach(() => {
  process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
});

function sign(body: string, secret = SECRET): string {
  return createHmac('sha256', secret).update(Buffer.from(body)).digest('hex');
}

describe('amount conversion', () => {
  it('converts rupees to paise', () => {
    expect(rupeesToPaise(299)).toBe(29900);
    expect(rupeesToPaise(1)).toBe(100);
  });

  it('handles the float cases that break naive multiplication', () => {
    // 1234.56 * 100 is 123455.99999999999 in binary floating point. Truncating
    // would bill the student one paisa less; over a fee run that is a ledger
    // that never reconciles.
    expect(rupeesToPaise(1234.56)).toBe(123456);
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
  });

  it('round-trips', () => {
    expect(paiseToRupees(rupeesToPaise(45250.75))).toBe(45250.75);
  });
});

describe('webhook signature verification', () => {
  const body = JSON.stringify({ event: 'payment.captured', payload: {} });

  it('accepts a correctly signed body', () => {
    expect(verifyWebhookSignature(Buffer.from(body), sign(body))).toBe(true);
  });

  it('REJECTS a body tampered with after signing', () => {
    const signature = sign(body);
    const tampered = JSON.stringify({ event: 'payment.captured', payload: { evil: true } });
    expect(verifyWebhookSignature(Buffer.from(tampered), signature)).toBe(false);
  });

  it('REJECTS a signature made with a different secret', () => {
    expect(verifyWebhookSignature(Buffer.from(body), sign(body, 'attacker_guess'))).toBe(false);
  });

  it('REJECTS a signature of the wrong length rather than throwing', () => {
    // timingSafeEqual throws on length mismatch; a wrong-length signature must
    // come back as a clean false, not a 500.
    expect(verifyWebhookSignature(Buffer.from(body), 'abcd')).toBe(false);
  });

  it('REJECTS non-hex garbage', () => {
    expect(verifyWebhookSignature(Buffer.from(body), 'not-hex-at-all!!')).toBe(false);
  });

  it('REFUSES to verify at all when no webhook secret is configured', () => {
    // The dangerous failure would be treating "no secret" as "nothing to
    // check" and accepting everything.
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    expect(() => verifyWebhookSignature(Buffer.from(body), sign(body))).toThrow(IntegrationError);
  });

  it('is sensitive to whitespace, proving it signs raw bytes not a re-serialised object', () => {
    // Razorpay's docs are explicit that the body must not be parsed and
    // re-serialised. This locks that in: a semantically identical but
    // differently-formatted body must NOT verify against the original
    // signature.
    const reserialised = JSON.stringify(JSON.parse(body), null, 2);
    expect(verifyWebhookSignature(Buffer.from(reserialised), sign(body))).toBe(false);
  });
});

describe('webhook payload parsing', () => {
  const captured = {
    entity: 'event',
    event: 'payment.captured',
    contains: ['payment'],
    payload: {
      payment: {
        entity: {
          id: 'pay_DESlfW9H8K9uqM',
          order_id: 'order_DESlLckIVRkHWj',
          amount: 4500000,
          status: 'captured',
          notes: { institutionId: 'inst-1', studentProfileId: 'stu-1' }
        }
      }
    }
  };

  it('reads the documented nesting path', () => {
    const parsed = parsePaymentWebhook(captured);
    expect(parsed).not.toBeNull();
    expect(parsed!.paymentId).toBe('pay_DESlfW9H8K9uqM');
    expect(parsed!.orderId).toBe('order_DESlLckIVRkHWj');
    expect(parsed!.status).toBe('captured');
    expect(parsed!.notes.institutionId).toBe('inst-1');
  });

  it('converts the amount out of paise', () => {
    // 4,500,000 paise is ₹45,000 — not ₹4,500,000.
    expect(parsePaymentWebhook(captured)!.amountRupees).toBe(45000);
  });

  it('returns null for a payload with no payment entity', () => {
    expect(parsePaymentWebhook({ event: 'payout.processed', payload: {} })).toBeNull();
    expect(parsePaymentWebhook({})).toBeNull();
    expect(parsePaymentWebhook(null)).toBeNull();
  });
});

describe('configuration', () => {
  it('reports unconfigured when keys are absent', () => {
    expect(razorpayConfigured()).toBe(false);
  });

  it('reports configured once both keys are present', () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_x';
    process.env.RAZORPAY_KEY_SECRET = 'secret';
    expect(razorpayConfigured()).toBe(true);
  });
});
