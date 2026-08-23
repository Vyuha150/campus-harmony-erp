/**
 * Finance tests.
 *
 * The arithmetic here is the part that must not be wrong. A pass rate computed
 * incorrectly is embarrassing; a fee balance computed incorrectly is a student
 * being told they owe money they have already paid.
 */

import { describe, it, expect } from 'vitest';
import {
  round2,
  sum,
  amountsEqual,
  exceeds,
  amountInWords,
  financialYear,
  outstanding,
  deriveStatus,
  EPSILON
} from '../modules/finance/money.js';
import { hashRequest, IDEMPOTENCY_TTL_HOURS } from '../lib/idempotency.js';

describe('money rounding', () => {
  it('rounds to two decimal places', () => {
    expect(round2(100.456)).toBe(100.46);
    expect(round2(100.454)).toBe(100.45);
    expect(round2(100)).toBe(100);
  });

  it('handles the classic binary-float rounding trap', () => {
    // 1.005 is stored as 1.00499999..., so `Math.round(x*100)/100` yields 1.00.
    // Getting this wrong loses a paisa per transaction, which reconciles to a
    // visible discrepancy over a term's fee collection.
    expect(round2(1.005)).toBe(1.01);
    expect(round2(8.615)).toBe(8.62);
  });

  it('sums without accumulating drift', () => {
    // 0.1 + 0.2 === 0.30000000000000004 in IEEE 754.
    expect(sum([0.1, 0.2])).toBe(0.3);
    expect(sum([78000, 2500, 6000, 3500])).toBe(90000);
  });

  it('rejects non-finite amounts rather than storing NaN', () => {
    // A NaN written to a fee balance is unrecoverable without the audit trail.
    expect(() => round2(NaN)).toThrow(RangeError);
    expect(() => round2(Infinity)).toThrow(RangeError);
  });

  it('treats amounts within half a paisa as equal', () => {
    expect(amountsEqual(100, 100.001)).toBe(true);
    expect(amountsEqual(100, 100.01)).toBe(false);
  });

  it('does not report rounding noise as an excess', () => {
    expect(exceeds(100.001, 100)).toBe(false);
    expect(exceeds(100.01, 100)).toBe(true);
  });
});

describe('amount in words (Indian numbering)', () => {
  it('writes simple amounts', () => {
    expect(amountInWords(500)).toBe('Rupees Five Hundred Only');
    expect(amountInWords(0)).toBe('Rupees Zero Only');
  });

  it('uses lakh and crore, NOT million', () => {
    // A receipt written with western grouping is wrong on an Indian receipt.
    expect(amountInWords(100000)).toContain('Lakh');
    expect(amountInWords(10000000)).toContain('Crore');
    expect(amountInWords(5000000)).not.toContain('Million');
  });

  it('writes a realistic fee amount', () => {
    expect(amountInWords(90000)).toBe('Rupees Ninety Thousand Only');
    expect(amountInWords(78500)).toBe('Rupees Seventy Eight Thousand Five Hundred Only');
  });

  it('includes paise when present', () => {
    expect(amountInWords(1250.5)).toContain('Fifty Paise');
    expect(amountInWords(1250)).not.toContain('Paise');
  });

  it('handles the teens correctly', () => {
    // 15 is "Fifteen", not "Ten Five" — a common off-by-one in these routines.
    expect(amountInWords(15)).toBe('Rupees Fifteen Only');
    expect(amountInWords(19)).toBe('Rupees Nineteen Only');
    expect(amountInWords(1500)).toBe('Rupees One Thousand Five Hundred Only');
  });

  it('composes lakh + thousand + hundred', () => {
    expect(amountInWords(123456)).toBe(
      'Rupees One Lakh Twenty Three Thousand Four Hundred and Fifty Six Only'
    );
  });
});

describe('financial year', () => {
  it('runs April to March, not January to December', () => {
    // Receipt series reset at the FY boundary. Using the calendar year would
    // put April's receipts in the previous year's book.
    expect(financialYear(new Date('2026-04-01'))).toBe('2026-27');
    expect(financialYear(new Date('2026-03-31'))).toBe('2025-26');
    expect(financialYear(new Date('2026-12-31'))).toBe('2026-27');
    expect(financialYear(new Date('2026-01-01'))).toBe('2025-26');
  });
});

describe('outstanding balance', () => {
  it('subtracts both paid and waived amounts', () => {
    expect(outstanding({ amount: 10000, paidAmount: 3000, waivedAmount: 2000 })).toBe(5000);
  });

  it('never returns a negative balance', () => {
    // An overpayment must not present as negative money owed.
    expect(outstanding({ amount: 1000, paidAmount: 1500, waivedAmount: 0 })).toBe(0);
  });

  it('is zero for a fully paid record', () => {
    expect(outstanding({ amount: 90000, paidAmount: 90000, waivedAmount: 0 })).toBe(0);
  });
});

describe('derived fee status', () => {
  const future = new Date(Date.now() + 30 * 86400000);
  const past = new Date(Date.now() - 30 * 86400000);

  it('is paid when nothing is outstanding', () => {
    expect(
      deriveStatus({ amount: 1000, paidAmount: 1000, waivedAmount: 0, dueDate: future })
    ).toBe('paid');
  });

  it('is partial when some has been paid', () => {
    expect(
      deriveStatus({ amount: 1000, paidAmount: 400, waivedAmount: 0, dueDate: future })
    ).toBe('partial');
  });

  it('is overdue only when unpaid AND past due', () => {
    expect(
      deriveStatus({ amount: 1000, paidAmount: 0, waivedAmount: 0, dueDate: past })
    ).toBe('overdue');
    expect(
      deriveStatus({ amount: 1000, paidAmount: 0, waivedAmount: 0, dueDate: future })
    ).toBe('pending');
  });

  it('distinguishes waived from paid', () => {
    // A waived fee is not revenue. Reporting it as paid overstates collection.
    expect(
      deriveStatus({ amount: 1000, paidAmount: 0, waivedAmount: 1000, dueDate: past })
    ).toBe('waived');
  });

  it('does not call a record overdue over a fraction of a paisa', () => {
    expect(
      deriveStatus({ amount: 1000, paidAmount: 1000 - EPSILON / 2, waivedAmount: 0, dueDate: past })
    ).toBe('paid');
  });
});

describe('idempotency request hashing', () => {
  it('is stable across key ordering', () => {
    // A client serialising the same request with different key order is still
    // making the same request; treating it as different would reject valid
    // retries.
    expect(hashRequest({ a: 1, b: 2 })).toBe(hashRequest({ b: 2, a: 1 }));
  });

  it('differs when a value differs', () => {
    // The property that matters: same key + different amount must be caught,
    // not silently replayed.
    expect(hashRequest({ amount: 1000 })).not.toBe(hashRequest({ amount: 2000 }));
  });

  it('distinguishes nested changes', () => {
    expect(hashRequest({ allocations: [{ id: 'a', amount: 100 }] })).not.toBe(
      hashRequest({ allocations: [{ id: 'a', amount: 200 }] })
    );
  });

  it('distinguishes a missing field from a null one', () => {
    expect(hashRequest({ a: 1, b: null })).not.toBe(hashRequest({ a: 1 }));
  });

  it('is order-sensitive for arrays', () => {
    // Allocation order is not meaningful to the outcome, but treating two
    // different arrays as identical would be worse than the reverse.
    expect(hashRequest([1, 2])).not.toBe(hashRequest([2, 1]));
  });

  it('honours keys for a full day', () => {
    // Long enough that any sane client retry is covered.
    expect(IDEMPOTENCY_TTL_HOURS).toBeGreaterThanOrEqual(24);
  });
});

describe('finance schema guards', () => {
  it('fee records are tenant-owned', async () => {
    // FeeRecord was unscoped until migration 0010 — a fee query without an
    // explicit filter returned every institution's dues.
    const { TENANT_OWNED_MODELS } = await import('../lib/tenantExtension.js');
    for (const model of ['FeeRecord', 'FeeStructure', 'Payment', 'Receipt']) {
      expect(TENANT_OWNED_MODELS.has(model), `${model} must be tenant-scoped`).toBe(true);
    }
  });

  it('recording a payment writes an audit entry inside the transaction', async () => {
    // This gap was real: the first cut of the module routed payments through
    // `withIdempotency`, which owns its own transaction, so `mutate()` was never
    // called and money was recorded with NO audit row. Every functional check
    // passed while it was broken — only a direct query on SystemAuditLog caught
    // it. Guarded here so it cannot come back silently.
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(
      new URL('../modules/finance/finance.service.ts', import.meta.url),
      'utf8'
    );

    const executeBody = source.slice(
      source.indexOf('async function executePayment'),
      source.indexOf('interface LockedFeeRecord')
    );

    expect(executeBody).toContain('recordInTransaction');
    // It must use the transaction client, not a fresh connection — an audit row
    // that can commit independently of the payment is not an audit trail.
    expect(executeBody).toMatch(/recordInTransaction\(\s*tx/);
  });

  it('the seed never records a payment that did not happen', async () => {
    // Same class of defect as the seeded `cgpa: 8.7` the audit found: a figure
    // that looks like real data but has nothing behind it.
    const { readFileSync } = await import('node:fs');
    const seed = readFileSync(new URL('../../prisma/seed.ts', import.meta.url), 'utf8');
    expect(seed).not.toMatch(/paidAmount:\s*[1-9]/);
  });
});
