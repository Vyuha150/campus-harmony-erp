/**
 * Money primitives.
 *
 * A NOTE ON THE UNDERLYING TYPE
 *
 * `FeeRecord.amount` and `Payment.amount` are `Float` (PostgreSQL
 * DOUBLE PRECISION) in the inherited schema. That is the wrong type for money:
 * binary floating point cannot represent 0.1 exactly, so sums drift. With
 * ₹-denominated fees the practical error is small, but it is not zero, and
 * "small" is not a property a fee ledger should have.
 *
 * The correct fix is `Decimal(12,2)` — recorded as a migration task, not done
 * here, because converting the column requires coordinating with every existing
 * caller and is not safe to bundle into a feature change.
 *
 * WHAT THIS MODULE DOES ABOUT IT: every arithmetic result passes through
 * `round2()`, and comparisons use `EPSILON` rather than `===`. That contains the
 * drift at each step instead of letting it accumulate silently. It is a
 * mitigation, not a substitute for the correct column type.
 */

/** Half-paisa. Two amounts closer than this are the same amount. */
export const EPSILON = 0.005;

/** Round to 2 decimal places, away from zero on a tie. */
export function round2(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Not a finite amount: ${value}`);
  }
  // `Math.round(x * 100) / 100` is wrong for cases like 1.005 (which is stored
  // as 1.00499...). Going through the string form avoids that class of error.
  return Number(Math.round(Number(`${value}e2`)) + 'e-2');
}

/** Sum a list of amounts, rounding once at the end. */
export function sum(values: number[]): number {
  return round2(values.reduce((total, value) => total + value, 0));
}

/** True when two amounts are equal to within half a paisa. */
export function amountsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < EPSILON;
}

/** True when `a` exceeds `b` by more than rounding noise. */
export function exceeds(a: number, b: number): boolean {
  return a - b > EPSILON;
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n]!;
  const t = TENS[Math.floor(n / 10)]!;
  const o = ONES[n % 10]!;
  return o ? `${t} ${o}` : t;
}

/**
 * Amount in words, Indian numbering system.
 *
 * Receipts in India are conventionally (and in several states, statutorily)
 * written with the amount in words as well as figures — it is the defence
 * against a digit being altered after issue. The grouping is lakh/crore
 * (1,23,45,678), NOT the western million grouping, so `Intl.NumberFormat` with
 * a western locale would produce a legally wrong receipt.
 */
export function amountInWords(amount: number): string {
  const value = round2(Math.abs(amount));
  const rupees = Math.floor(value);
  const paise = Math.round((value - rupees) * 100);

  const parts: string[] = ['Rupees', integerToWords(rupees)];

  if (paise > 0) {
    parts.push('and', twoDigits(paise), 'Paise');
  }

  parts.push('Only');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function integerToWords(n: number): string {
  if (n === 0) return 'Zero';

  const words: string[] = [];

  const crore = Math.floor(n / 10000000);
  if (crore > 0) {
    words.push(integerToWords(crore), 'Crore');
    n %= 10000000;
  }

  const lakh = Math.floor(n / 100000);
  if (lakh > 0) {
    words.push(twoDigits(lakh), 'Lakh');
    n %= 100000;
  }

  const thousand = Math.floor(n / 1000);
  if (thousand > 0) {
    words.push(twoDigits(thousand), 'Thousand');
    n %= 1000;
  }

  const hundred = Math.floor(n / 100);
  if (hundred > 0) {
    words.push(ONES[hundred]!, 'Hundred');
    n %= 100;
  }

  if (n > 0) {
    if (words.length > 0) words.push('and');
    words.push(twoDigits(n));
  }

  return words.join(' ');
}

/**
 * Indian financial year for a date: 1 April – 31 March.
 *
 * Receipt series reset at the financial year boundary, so this determines which
 * series a receipt number belongs to. Using the calendar year would put April's
 * receipts in the wrong book.
 */
export function financialYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed; 3 = April
  return month >= 3 ? `${year}-${String(year + 1).slice(2)}` : `${year - 1}-${String(year).slice(2)}`;
}

/** Format for display. Indian grouping, two decimals. */
export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(round2(amount));
}

/** Outstanding balance on a fee record. Never negative. */
export function outstanding(record: {
  amount: number;
  paidAmount: number;
  waivedAmount: number;
}): number {
  return Math.max(0, round2(record.amount - record.paidAmount - record.waivedAmount));
}

/**
 * Fee record status derived from its numbers.
 *
 * Derived rather than stored-and-hoped: the inherited schema let `status` say
 * 'paid' while the amounts said otherwise, with nothing reconciling them.
 */
export function deriveStatus(
  record: { amount: number; paidAmount: number; waivedAmount: number; dueDate: Date },
  now: Date = new Date()
): 'paid' | 'partial' | 'overdue' | 'pending' | 'waived' {
  const due = outstanding(record);

  if (due < EPSILON) {
    return record.waivedAmount > 0 && record.paidAmount < EPSILON ? 'waived' : 'paid';
  }
  if (record.paidAmount > EPSILON) {
    return 'partial';
  }
  return record.dueDate.getTime() < now.getTime() ? 'overdue' : 'pending';
}
