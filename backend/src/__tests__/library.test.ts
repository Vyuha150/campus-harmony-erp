/**
 * Library tests (T-203b).
 *
 * The fine calculation is the part with a direct consequence for a person: the
 * previous endpoint took the fine from the request body, so whoever called it
 * decided what a student owed.
 */

import { describe, it, expect } from 'vitest';
import { computeFine, accruedFine, isOverdue, daysBetween, type CirculationPolicy } from '../modules/library/fines.js';

const policy: CirculationPolicy = {
  loanPeriodDays: 14,
  maxRenewals: 2,
  renewalDays: 14,
  finePerDay: 2,
  graceDays: 1,
  maxFine: 500,
  maxBooksPerStudent: 3,
  blockIssueAboveFine: 100
};

const noGrace: CirculationPolicy = { ...policy, graceDays: 0, finePerDay: 1 };

function daysFrom(base: string, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

describe('day counting', () => {
  it('counts whole days between dates', () => {
    expect(daysBetween(new Date('2026-08-01T00:00:00Z'), new Date('2026-08-05T00:00:00Z'))).toBe(4);
  });

  it('ignores the time of day', () => {
    // A book due at 09:00 and returned at 17:00 the SAME day is not a day late.
    expect(
      daysBetween(new Date('2026-08-01T09:00:00Z'), new Date('2026-08-01T17:00:00Z'))
    ).toBe(0);
  });

  it('never returns a negative count', () => {
    // Returned early must not produce a negative fine — a credit for being punctual.
    expect(daysBetween(new Date('2026-08-10T00:00:00Z'), new Date('2026-08-01T00:00:00Z'))).toBe(0);
  });

  it('counts across a month boundary', () => {
    expect(daysBetween(new Date('2026-08-30T00:00:00Z'), new Date('2026-09-02T00:00:00Z'))).toBe(3);
  });
});

describe('fine computation', () => {
  it('charges nothing when returned on time', () => {
    const result = computeFine(new Date('2026-08-20T00:00:00Z'), new Date('2026-08-20T00:00:00Z'), policy);
    expect(result.fine).toBe(0);
    expect(result.daysOverdue).toBe(0);
  });

  it('charges nothing when returned early', () => {
    const result = computeFine(new Date('2026-08-20T00:00:00Z'), new Date('2026-08-15T00:00:00Z'), policy);
    expect(result.fine).toBe(0);
  });

  it('applies the grace period before charging', () => {
    const due = new Date('2026-08-20T00:00:00Z');
    // 1 day late, 1 grace day → nothing chargeable.
    expect(computeFine(due, daysFrom('2026-08-20T00:00:00Z', 1), policy).fine).toBe(0);
    // 2 days late, 1 grace day → 1 chargeable day at Rs.2.
    expect(computeFine(due, daysFrom('2026-08-20T00:00:00Z', 2), policy).fine).toBe(2);
  });

  it('multiplies chargeable days by the rate', () => {
    const result = computeFine(
      new Date('2026-08-20T00:00:00Z'),
      daysFrom('2026-08-20T00:00:00Z', 11),
      policy
    );
    expect(result.daysOverdue).toBe(11);
    expect(result.chargeableDays).toBe(10);
    expect(result.fine).toBe(20);
  });

  it('caps the fine so a forgotten book cannot accrue without bound', () => {
    // Two years overdue: 730 days x Rs.2 = Rs.1460, capped at Rs.500.
    const result = computeFine(
      new Date('2026-08-20T00:00:00Z'),
      daysFrom('2026-08-20T00:00:00Z', 730),
      policy
    );
    expect(result.cappedAtMax).toBe(true);
    expect(result.fine).toBe(500);
  });

  it('explains its own arithmetic', () => {
    // The explanation is stored on the audit record, so a student who disputes a
    // fine can be shown how it was derived rather than just the number.
    const result = computeFine(
      new Date('2026-08-20T00:00:00Z'),
      daysFrom('2026-08-20T00:00:00Z', 6),
      noGrace
    );
    expect(result.explanation).toContain('6');
    expect(result.explanation).toContain('day');
    expect(result.fine).toBe(6);
  });

  it('says why there is no fine rather than going silent', () => {
    expect(
      computeFine(new Date('2026-08-20T00:00:00Z'), new Date('2026-08-20T00:00:00Z'), policy)
        .explanation
    ).toMatch(/no fine/i);
    expect(
      computeFine(new Date('2026-08-20T00:00:00Z'), daysFrom('2026-08-20T00:00:00Z', 1), policy)
        .explanation
    ).toMatch(/grace/i);
  });

  it('rounds to two decimals with a fractional rate', () => {
    const fractional: CirculationPolicy = { ...policy, finePerDay: 0.5, graceDays: 0 };
    expect(
      computeFine(new Date('2026-08-20T00:00:00Z'), daysFrom('2026-08-20T00:00:00Z', 3), fractional)
        .fine
    ).toBe(1.5);
  });
});

describe('overdue detection', () => {
  it('is computed from the due date, not a stored status', () => {
    // The old schema had an `overdue` status nothing ever set, so the
    // dashboard's overdue count was permanently zero while looking correct.
    const past = new Date(Date.now() - 5 * 86400000);
    const future = new Date(Date.now() + 5 * 86400000);
    expect(isOverdue(past)).toBe(true);
    expect(isOverdue(future)).toBe(false);
  });

  it('is not overdue on the due date itself', () => {
    expect(isOverdue(new Date())).toBe(false);
  });

  it('accrues a fine on a loan that has not been returned', () => {
    const due = new Date(Date.now() - 10 * 86400000);
    const owed = accruedFine(due, policy);
    expect(owed.daysOverdue).toBe(10);
    expect(owed.fine).toBe(18); // (10 - 1 grace) x Rs.2
  });
});

describe('library module guarantees', () => {
  it('library models are tenant-owned', async () => {
    // LibraryBook had no institutionId at all before migration 0012 — the
    // dashboard counted every institution's books.
    const { TENANT_OWNED_MODELS } = await import('../lib/tenantExtension.js');
    for (const model of ['LibraryBook', 'LibraryLoan', 'LibraryPolicy']) {
      expect(TENANT_OWNED_MODELS.has(model), `${model} must be tenant-scoped`).toBe(true);
    }
  });

  it('the fine is never read from the request body', async () => {
    // The specific defect being replaced:
    //   const rawFine = req.body?.fine;
    const { readFileSync } = await import('node:fs');
    const routes = readFileSync(
      new URL('../modules/library/library.routes.ts', import.meta.url),
      'utf8'
    );

    // Comments are stripped first. A first version of this assertion matched the
    // comment in the route file DESCRIBING the removed pattern, which would have
    // pressured a maintainer into deleting the documentation of the defect to
    // make the test pass. Same trap as the CI secret-detection gate.
    const code = routes
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    expect(code).not.toMatch(/body\s*\??\.\s*fine/);
    expect(code).not.toMatch(/fine\s*:\s*z\./);
  });

  it('that assertion actually detects the pattern it forbids', () => {
    // Negative control: without it, the test above could pass because the regex
    // is wrong rather than because the code is right.
    const offending = 'const rawFine = req.body?.fine;';
    const stripped = offending.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(stripped).toMatch(/body\s*\??\.\s*fine/);
  });

  it('circulation mutations are audited inside their transaction', async () => {
    const { readFileSync } = await import('node:fs');
    const service = readFileSync(
      new URL('../modules/library/library.service.ts', import.meta.url),
      'utf8'
    );

    // issue, return and renew each write an audit row on the transaction client.
    const auditCalls = service.match(/recordInTransaction\(\s*tx/g) ?? [];
    expect(auditCalls.length).toBeGreaterThanOrEqual(3);
  });

  it('circulation reads lock the copy before deciding availability', async () => {
    // Without the write lock, two concurrent issues both see `available` and both
    // succeed — one physical book, two borrowers.
    const { readFileSync } = await import('node:fs');
    const service = readFileSync(
      new URL('../modules/library/library.service.ts', import.meta.url),
      'utf8'
    );
    const locks = service.match(/await lockForUpdate\(db\.libraryBook/g) ?? [];
    expect(locks.length).toBeGreaterThanOrEqual(3);
  });

  it('the superseded route file is gone, not merely unmounted', async () => {
    // Left in place it could be re-mounted, reintroducing a router with no
    // tenant scoping over tables that now carry institutionId.
    const { existsSync } = await import('node:fs');
    expect(existsSync(new URL('../routes/library.ts', import.meta.url))).toBe(false);
  });
});
