/**
 * Overdue and fine calculation.
 *
 * Pure functions, deliberately separated from the service so the arithmetic can
 * be tested without a database.
 *
 * THE DEFECT THIS REPLACES
 *
 * The previous return endpoint took the fine FROM THE CLIENT:
 *
 *     const rawFine = req.body?.fine;
 *     const fine = Number.isFinite(Number(rawFine)) ? Math.max(0, Number(rawFine)) : 0;
 *
 * Whoever called the endpoint decided what the borrower owed, with no
 * calculation, no ceiling, and no audit record. Sending `{"fine": 0}` cleared
 * any liability; sending `{"fine": 99999}` invented one.
 */

import { round2 } from '../finance/money.js';

export interface CirculationPolicy {
  loanPeriodDays: number;
  maxRenewals: number;
  renewalDays: number;
  finePerDay: number;
  graceDays: number;
  maxFine: number;
  maxBooksPerStudent: number;
  blockIssueAboveFine: number;
}

/** Whole days `later` is past `earlier`. Never negative. */
export function daysBetween(earlier: Date, later: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  // Compared at day granularity in UTC: a book due at 09:00 and returned at
  // 17:00 the same day is not one day late.
  const startOfDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.max(0, Math.round((startOfDay(later) - startOfDay(earlier)) / MS_PER_DAY));
}

export interface FineComputation {
  daysOverdue: number;
  chargeableDays: number;
  finePerDay: number;
  fine: number;
  cappedAtMax: boolean;
  /** Plain-language derivation, stored on the audit record. */
  explanation: string;
}

/**
 * Fine owed on a loan.
 *
 * Grace days are subtracted before charging, and the total is capped. Without a
 * cap, a book forgotten for two years accrues a fine larger than the book, which
 * institutions then have to write off by hand.
 */
export function computeFine(
  dueAt: Date,
  returnedAt: Date,
  policy: CirculationPolicy
): FineComputation {
  const daysOverdue = daysBetween(dueAt, returnedAt);
  const chargeableDays = Math.max(0, daysOverdue - policy.graceDays);

  const raw = round2(chargeableDays * policy.finePerDay);
  const capped = raw > policy.maxFine;
  const fine = capped ? round2(policy.maxFine) : raw;

  let explanation: string;
  if (daysOverdue === 0) {
    explanation = 'Returned on or before the due date — no fine.';
  } else if (chargeableDays === 0) {
    explanation = `${daysOverdue} day(s) overdue, within the ${policy.graceDays}-day grace period — no fine.`;
  } else {
    explanation =
      `${daysOverdue} day(s) overdue` +
      (policy.graceDays > 0 ? `, less ${policy.graceDays} grace day(s)` : '') +
      ` = ${chargeableDays} chargeable day(s) x Rs.${policy.finePerDay}/day = Rs.${raw.toFixed(2)}` +
      (capped ? ` (capped at the Rs.${policy.maxFine.toFixed(2)} maximum)` : '');
  }

  return {
    daysOverdue,
    chargeableDays,
    finePerDay: policy.finePerDay,
    fine,
    cappedAtMax: capped,
    explanation
  };
}

/**
 * Whether a loan is overdue right now.
 *
 * Computed, never stored. The old schema had an `overdue` status that nothing
 * ever assigned, so the dashboard's overdue count was permanently zero while
 * appearing to work.
 */
export function isOverdue(dueAt: Date, now: Date = new Date()): boolean {
  return daysBetween(dueAt, now) > 0;
}

/** Accrued fine on a loan that has NOT yet been returned. */
export function accruedFine(
  dueAt: Date,
  policy: CirculationPolicy,
  now: Date = new Date()
): FineComputation {
  return computeFine(dueAt, now, policy);
}
