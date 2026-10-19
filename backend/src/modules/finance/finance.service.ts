/**
 * Finance service — fee ledger, payments, receipts.
 *
 * THE FINDING THIS CLOSES
 *
 * The audit found 4 uses of `$transaction` across 478 endpoints, and named fee
 * payment + receipt creation as an operation that MUST be atomic and was not.
 * The failure mode is concrete: money recorded with no receipt, or a receipt
 * with no money, discovered weeks later during reconciliation with no way to
 * tell which of the two is true.
 *
 * WHAT IS ATOMIC HERE
 *
 * `recordPayment` writes, in one transaction:
 *   1. the Payment row
 *   2. one PaymentAllocation per fee record cleared
 *   3. the updated paidAmount/status on each FeeRecord
 *   4. the Receipt
 *   5. the audit record (via `mutate`)
 *
 * All five commit, or none do.
 *
 * WHAT IS LOCKED
 *
 * Fee records are locked `FOR UPDATE` before their balances are read. Without
 * that, two concurrent payments both read `paidAmount = 0`, both compute a
 * balance of ₹50,000, and both allocate against it — the student is recorded as
 * having paid ₹100,000 against a ₹50,000 due, and the ledger is wrong in the
 * direction that is hardest to notice.
 */

import { basePrisma, lockForUpdate } from '../../lib/prisma.js';
import { mutate, type TransactionClient } from '../../lib/service.js';
import { recordInTransaction } from '../../lib/audit.js';
import { withIdempotency } from '../../lib/idempotency.js';
import {
  NotFoundError,
  ValidationError,
  BusinessRuleError,
  ConflictError
} from '../../lib/errors.js';
import type { TenantContext } from '../../lib/tenant.js';
import {
  round2,
  sum,
  exceeds,
  amountsEqual,
  outstanding,
  deriveStatus,
  amountInWords,
  financialYear,
  EPSILON
} from './money.js';
import { randomBytes } from 'node:crypto';

/** Payment methods accepted. `adjustment` covers scholarship/waiver settlement. */
export const PAYMENT_METHODS = [
  'cash',
  'cheque',
  'dd',
  'online',
  'upi',
  'card',
  'netbanking',
  'adjustment'
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface AllocationInput {
  feeRecordId: string;
  amount: number;
}

export interface RecordPaymentInput {
  studentProfileId: string;
  amount: number;
  method: PaymentMethod;
  /** Explicit split across dues. Omitted → oldest-due-first. */
  allocations?: AllocationInput[] | undefined;
  transactionReference?: string | undefined;
  gateway?: string | undefined;
  paidAt?: Date | undefined;
  remarks?: string | undefined;
  /** Client-supplied retry key. REQUIRED by the route schema for money. */
  idempotencyKey?: string | undefined;
}

/**
 * Record a payment and issue its receipt.
 *
 * Returns the payment with its receipt. On a repeated call with the same
 * idempotency key, returns the ORIGINAL result — no second charge.
 */
export async function recordPayment(
  context: TenantContext,
  input: RecordPaymentInput
): Promise<{ payment: PaymentView; replayed: boolean }> {
  if (input.amount <= 0) {
    throw new ValidationError('Payment amount must be greater than zero.', {
      field: 'amount'
    });
  }

  const amount = round2(input.amount);

  // A cheque or DD without its instrument number cannot be reconciled against a
  // bank statement, which is the entire point of recording one.
  if ((input.method === 'cheque' || input.method === 'dd') && !input.transactionReference) {
    throw new ValidationError(
      `A ${input.method} payment requires its instrument number in transactionReference, otherwise it cannot be reconciled against the bank statement.`,
      { field: 'transactionReference' }
    );
  }

  const student = await basePrisma.studentProfile.findFirst({
    where: { id: input.studentProfileId, institutionId: context.institutionId },
    select: { id: true, rollNumber: true, userId: true }
  });

  if (!student) {
    throw new NotFoundError(`Student ${input.studentProfileId}`);
  }

  const outcome = await withIdempotency(
    {
      institutionId: context.institutionId,
      key: input.idempotencyKey,
      operation: 'payment.record',
      // Hash the financially meaningful fields only. A differing `remarks`
      // should not defeat a retry.
      payload: {
        studentProfileId: input.studentProfileId,
        amount,
        method: input.method,
        allocations: input.allocations ?? null,
        transactionReference: input.transactionReference ?? null
      }
    },
    (tx) => executePayment(tx, context, input, amount, student)
  );

  return { payment: outcome.result, replayed: outcome.replayed };
}

interface StudentRef {
  id: string;
  rollNumber: string;
  userId: string;
}

/** The transactional body. Every write below shares one transaction. */
async function executePayment(
  tx: TransactionClient,
  context: TenantContext,
  input: RecordPaymentInput,
  amount: number,
  student: StudentRef
): Promise<PaymentView> {
  const db = tx as never as typeof basePrisma;

  // ── Lock the fee records BEFORE reading balances ────────────────────────
  //
  // Ordered by id so that two concurrent payments touching overlapping records
  // acquire locks in the same sequence. Unordered locking is how deadlocks
  // happen under load.
  const requestedIds = input.allocations?.map((a) => a.feeRecordId);

  const feeWhere = requestedIds
    ? { id: { in: requestedIds }, institutionId: context.institutionId, studentProfileId: student.id }
    : {
        institutionId: context.institutionId,
        studentProfileId: student.id,
        status: { notIn: ['paid', 'waived'] }
      };

  await lockForUpdate(db.feeRecord, feeWhere);
  const lockedRecords: LockedFeeRecord[] = await db.feeRecord.findMany({
    where: feeWhere,
    orderBy: { id: 'asc' },
    select: { id: true, amount: true, paidAmount: true, waivedAmount: true, dueDate: true, status: true, description: true, type: true }
  });

  if (requestedIds) {
    // A record the caller named but that does not belong to this student, or
    // does not exist, must fail loudly — silently dropping it would allocate
    // the money somewhere the caller did not intend.
    const found = new Set(lockedRecords.map((r) => r.id));
    const missing = requestedIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new NotFoundError(
        `Fee record(s) ${missing.join(', ')} — not found for this student in this institution`
      );
    }
  }

  if (lockedRecords.length === 0) {
    throw new BusinessRuleError(
      'This student has no outstanding fee records. There is nothing for this payment to settle.',
      { studentProfileId: student.id }
    );
  }

  // ── Decide the split ────────────────────────────────────────────────────
  const allocations = input.allocations
    ? validateExplicitAllocations(input.allocations, lockedRecords, amount)
    : allocateOldestFirst(lockedRecords, amount);

  // ── Write ───────────────────────────────────────────────────────────────
  const paidAt = input.paidAt ?? new Date();
  const paymentNumber = await nextPaymentNumber(db, context.institutionId, paidAt);

  const payment = await db.payment.create({
    data: {
      institutionId: context.institutionId,
      studentProfileId: student.id,
      paymentNumber,
      amount,
      method: input.method,
      transactionReference: input.transactionReference ?? null,
      gateway: input.gateway ?? null,
      // Offline instruments are not money in the bank until they clear, so they
      // stay pending. Recording an uncleared cheque as 'success' is how a
      // bounced cheque becomes an untraceable shortfall.
      status: input.method === 'cheque' || input.method === 'dd' ? 'pending' : 'success',
      paidAt,
      recordedBy: context.userId,
      remarks: input.remarks ?? null
    }
  });

  for (const allocation of allocations) {
    await db.paymentAllocation.create({
      data: {
        paymentId: payment.id,
        feeRecordId: allocation.feeRecordId,
        amount: allocation.amount
      }
    });

    const record = lockedRecords.find((r) => r.id === allocation.feeRecordId)!;
    const newPaid = round2(record.paidAmount + allocation.amount);
    const nextStatus = deriveStatus(
      {
        amount: record.amount,
        paidAmount: newPaid,
        waivedAmount: record.waivedAmount,
        dueDate: record.dueDate
      },
      paidAt
    );

    await db.feeRecord.updateMany({
      where: { id: record.id, institutionId: context.institutionId },
      data: {
        paidAmount: newPaid,
        status: nextStatus,
        paidDate: nextStatus === 'paid' ? paidAt : null,
        transactionId: input.transactionReference ?? payment.paymentNumber
      }
    });
  }

  // ── Receipt, in the same transaction ────────────────────────────────────
  //
  // Only for money actually received. An uncleared cheque gets its receipt when
  // it clears, not when it is handed over.
  let receipt: ReceiptView | null = null;

  if (payment.status === 'success') {
    receipt = await issueReceipt(db, context, payment, student, paidAt);
  }

  // ── Audit, in the SAME transaction ──────────────────────────────────────
  //
  // Written here rather than via `mutate()` because `withIdempotency` already
  // owns the transaction — nesting `mutate` would open a second one, and an
  // audit record that can commit independently of the payment is not an audit
  // trail. A first cut of this module omitted it entirely: the live check found
  // zero finance audit rows after a successful payment.
  await recordInTransaction(tx as never, {
    userId: context.userId,
    role: context.role,
    action: 'CREATE',
    module: 'finance',
    resource: `Payment:${payment.id}`,
    details:
      `Recorded ${payment.paymentNumber} — ₹${amount.toFixed(2)} by ${input.method} ` +
      `for ${student.rollNumber}, allocated across ${allocations.length} fee record(s)` +
      (receipt ? `; receipt ${receipt.receiptNumber}` : '; receipt deferred until the instrument clears'),
    newValue: {
      paymentNumber: payment.paymentNumber,
      amount,
      method: input.method,
      // The reference is recorded because reconciliation depends on it. No
      // card numbers, bank details or other sensitive instrument data is
      // stored here — only the reference the institution already holds.
      transactionReference: input.transactionReference ?? null,
      allocations,
      receiptNumber: receipt?.receiptNumber ?? null
    },
    // Money movement is reviewable by default.
    severity: 'warning'
  });

  return toPaymentView(payment, allocations, receipt);
}

interface LockedFeeRecord {
  id: string;
  amount: number;
  paidAmount: number;
  waivedAmount: number;
  dueDate: Date;
  status: string;
  description: string;
  type: string;
}

/** Check a caller-supplied split against the real balances. */
function validateExplicitAllocations(
  requested: AllocationInput[],
  records: LockedFeeRecord[],
  paymentAmount: number
): AllocationInput[] {
  const byId = new Map(records.map((r) => [r.id, r]));
  const seen = new Set<string>();
  const result: AllocationInput[] = [];

  for (const allocation of requested) {
    if (seen.has(allocation.feeRecordId)) {
      throw new ValidationError(
        `Fee record ${allocation.feeRecordId} appears twice in the allocation. Combine the amounts into one entry.`,
        { field: 'allocations' }
      );
    }
    seen.add(allocation.feeRecordId);

    if (allocation.amount <= 0) {
      throw new ValidationError('Each allocation amount must be greater than zero.', {
        field: 'allocations'
      });
    }

    const record = byId.get(allocation.feeRecordId)!;
    const due = outstanding(record);

    if (exceeds(allocation.amount, due)) {
      // Over-allocation is refused rather than absorbed. Silently capping it
      // would leave the difference unaccounted for.
      throw new BusinessRuleError(
        `Cannot allocate ₹${allocation.amount.toFixed(2)} to "${record.description}" — only ₹${due.toFixed(2)} is outstanding on it.`,
        { feeRecordId: record.id, outstanding: due, requested: allocation.amount }
      );
    }

    result.push({ feeRecordId: allocation.feeRecordId, amount: round2(allocation.amount) });
  }

  const allocated = sum(result.map((a) => a.amount));

  if (!amountsEqual(allocated, paymentAmount)) {
    // The allocations must account for the whole payment. A mismatch means
    // money would be recorded as received with no due it settles.
    throw new ValidationError(
      `Allocations total ₹${allocated.toFixed(2)} but the payment is ₹${paymentAmount.toFixed(2)}. Every rupee received must be allocated to a fee record.`,
      { field: 'allocations', allocated, paymentAmount }
    );
  }

  return result;
}

/**
 * Default split: oldest due first.
 *
 * This is the conventional Indian practice and it matters — settling the oldest
 * due first is what stops a student accruing late-fee penalties on an old
 * instalment while a new one shows as paid.
 */
function allocateOldestFirst(
  records: LockedFeeRecord[],
  paymentAmount: number
): AllocationInput[] {
  const ordered = [...records].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const allocations: AllocationInput[] = [];
  let remaining = paymentAmount;

  for (const record of ordered) {
    if (remaining < EPSILON) break;

    const due = outstanding(record);
    if (due < EPSILON) continue;

    const take = round2(Math.min(due, remaining));
    allocations.push({ feeRecordId: record.id, amount: take });
    remaining = round2(remaining - take);
  }

  if (remaining > EPSILON) {
    // Refused rather than held as credit. This system has no credit-balance
    // model, and inventing one implicitly — money sitting in a column no report
    // reads — is worse than declining the overpayment.
    const totalDue = sum(records.map(outstanding));
    throw new BusinessRuleError(
      `Payment of ₹${paymentAmount.toFixed(2)} exceeds the total outstanding of ₹${totalDue.toFixed(2)} by ₹${remaining.toFixed(2)}. ` +
        'Overpayments are not accepted — reduce the amount, or allocate explicitly if a specific due is intended.',
      { paymentAmount, totalOutstanding: totalDue, excess: remaining }
    );
  }

  return allocations;
}

/**
 * Next payment number for the institution.
 *
 * Derived from the count within the year under the transaction's lock, and
 * protected by the unique index on (institutionId, paymentNumber) — if two
 * transactions somehow compute the same number, the second fails rather than
 * producing a duplicate.
 */
async function nextPaymentNumber(
  db: typeof basePrisma,
  institutionId: string,
  when: Date
): Promise<string> {
  const year = when.getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);

  const count = await db.payment.count({
    where: { institutionId, paidAt: { gte: start, lt: end } }
  });

  return `PAY-${year}-${String(count + 1).padStart(6, '0')}`;
}

/** Issue a receipt. Called only from inside the payment transaction. */
async function issueReceipt(
  db: typeof basePrisma,
  context: TenantContext,
  payment: { id: string; amount: number },
  student: StudentRef,
  issuedAt: Date
): Promise<ReceiptView> {
  const fy = financialYear(issuedAt);

  const count = await db.receipt.count({
    where: { institutionId: context.institutionId, financialYear: fy }
  });

  const receiptNumber = `RCP-${fy}-${String(count + 1).padStart(6, '0')}`;

  const user = await db.user.findFirst({
    where: { id: student.userId },
    select: { name: true }
  });

  const receipt = await db.receipt.create({
    data: {
      institutionId: context.institutionId,
      paymentId: payment.id,
      receiptNumber,
      financialYear: fy,
      amount: payment.amount,
      // Written on the receipt so an altered figure is detectable.
      amountInWords: amountInWords(payment.amount),
      studentName: user?.name ?? student.rollNumber,
      rollNumber: student.rollNumber,
      issuedAt,
      issuedBy: context.userId,
      // Lets a holder verify the receipt without the institution's help, and
      // makes a forged number detectable. Random, not derived — a derived code
      // is guessable from the number it certifies.
      verificationCode: randomBytes(8).toString('hex').toUpperCase()
    }
  });

  return {
    id: receipt.id,
    receiptNumber: receipt.receiptNumber,
    financialYear: receipt.financialYear,
    amount: receipt.amount,
    amountInWords: receipt.amountInWords,
    studentName: receipt.studentName,
    rollNumber: receipt.rollNumber,
    issuedAt: receipt.issuedAt,
    verificationCode: receipt.verificationCode,
    status: receipt.status
  };
}

export interface ReceiptView {
  id: string;
  receiptNumber: string;
  financialYear: string;
  amount: number;
  amountInWords: string | null;
  studentName: string;
  rollNumber: string;
  issuedAt: Date;
  verificationCode: string;
  status: string;
}

export interface PaymentView {
  id: string;
  paymentNumber: string;
  amount: number;
  method: string;
  status: string;
  paidAt: Date;
  transactionReference: string | null;
  allocations: AllocationInput[];
  receipt: ReceiptView | null;
}

function toPaymentView(
  payment: {
    id: string;
    paymentNumber: string;
    amount: number;
    method: string;
    status: string;
    paidAt: Date;
    transactionReference: string | null;
  },
  allocations: AllocationInput[],
  receipt: ReceiptView | null
): PaymentView {
  return {
    id: payment.id,
    paymentNumber: payment.paymentNumber,
    amount: payment.amount,
    method: payment.method,
    status: payment.status,
    paidAt: payment.paidAt,
    transactionReference: payment.transactionReference,
    allocations,
    receipt
  };
}

/**
 * Student's fee ledger — dues, payments, and the derived balance.
 *
 * The status on each record is RECOMPUTED from the amounts rather than trusted,
 * because the inherited data has rows whose stored status disagrees with its
 * numbers.
 */
export async function getLedger(
  context: TenantContext,
  studentProfileId: string
): Promise<LedgerView> {
  const student = await basePrisma.studentProfile.findFirst({
    where: { id: studentProfileId, institutionId: context.institutionId },
    select: { id: true, rollNumber: true }
  });

  if (!student) {
    throw new NotFoundError(`Student ${studentProfileId}`);
  }

  const records = await basePrisma.feeRecord.findMany({
    where: { studentProfileId: student.id },
    orderBy: { dueDate: 'asc' }
  });

  const payments = await basePrisma.payment.findMany({
    where: { studentProfileId: student.id },
    orderBy: { paidAt: 'desc' },
    include: { receipt: true, allocations: true }
  });

  const now = new Date();

  const items = records.map((r) => {
    const derived = deriveStatus(
      { amount: r.amount, paidAmount: r.paidAmount, waivedAmount: r.waivedAmount, dueDate: r.dueDate },
      now
    );
    return {
      id: r.id,
      type: r.type,
      description: r.description,
      amount: r.amount,
      paidAmount: r.paidAmount,
      waivedAmount: r.waivedAmount,
      outstanding: outstanding(r),
      dueDate: r.dueDate,
      academicYear: r.academicYear,
      status: derived,
      // Surfaced rather than silently corrected — a mismatch is a data-quality
      // signal the finance office should see.
      storedStatusMismatch: derived !== r.status ? r.status : null
    };
  });

  const totalDue = sum(items.map((i) => i.amount));
  const totalPaid = sum(items.map((i) => i.paidAmount));
  const totalWaived = sum(items.map((i) => i.waivedAmount));
  const totalOutstanding = sum(items.map((i) => i.outstanding));

  return {
    student: { id: student.id, rollNumber: student.rollNumber },
    summary: {
      totalDue,
      totalPaid,
      totalWaived,
      totalOutstanding,
      overdueCount: items.filter((i) => i.status === 'overdue').length,
      // The flag exam eligibility already consults.
      hasOutstandingDues: totalOutstanding > EPSILON
    },
    records: items,
    payments: payments.map((p) => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      amount: p.amount,
      method: p.method,
      status: p.status,
      paidAt: p.paidAt,
      transactionReference: p.transactionReference,
      allocations: p.allocations.map((a) => ({ feeRecordId: a.feeRecordId, amount: a.amount })),
      receiptNumber: p.receipt?.receiptNumber ?? null
    }))
  };
}

export interface LedgerView {
  student: { id: string; rollNumber: string };
  summary: {
    totalDue: number;
    totalPaid: number;
    totalWaived: number;
    totalOutstanding: number;
    overdueCount: number;
    hasOutstandingDues: boolean;
  };
  records: Array<{
    id: string;
    type: string;
    description: string;
    amount: number;
    paidAmount: number;
    waivedAmount: number;
    outstanding: number;
    dueDate: Date;
    academicYear: string;
    status: string;
    storedStatusMismatch: string | null;
  }>;
  payments: Array<{
    id: string;
    paymentNumber: string;
    amount: number;
    method: string;
    status: string;
    paidAt: Date;
    transactionReference: string | null;
    allocations: AllocationInput[];
    receiptNumber: string | null;
  }>;
}

// `resolveOwnStudentProfileId` moved to lib/service.ts once the library module
// needed the same check; re-exported so the routes here keep importing it from
// their own service.
export { resolveOwnStudentProfileId } from '../../lib/service.js';

/**
 * Cancel a receipt.
 *
 * Receipts are NEVER deleted and never renumbered — a gap in a receipt series is
 * the first thing an auditor asks about. Cancellation marks the row, keeps the
 * number occupied, and requires a reason.
 */
export async function cancelReceipt(
  context: TenantContext,
  receiptId: string,
  reason: string
): Promise<{ receiptNumber: string; status: string }> {
  if (!reason || reason.trim().length < 10) {
    throw new ValidationError(
      'Cancelling a receipt requires a reason of at least 10 characters. A cancelled financial document with no recorded justification is an audit finding.',
      { field: 'reason' }
    );
  }

  const receipt = await basePrisma.receipt.findFirst({
    where: { id: receiptId, institutionId: context.institutionId },
    include: { payment: { include: { allocations: true } } }
  });

  if (!receipt) {
    throw new NotFoundError(`Receipt ${receiptId}`);
  }

  if (receipt.status === 'cancelled') {
    throw new ConflictError(
      `Receipt ${receipt.receiptNumber} is already cancelled.`,
      { cancelledAt: receipt.cancelledAt?.toISOString() ?? null }
    );
  }

  return mutate(
    context,
    {
      action: 'UPDATE',
      module: 'finance',
      resource: `Receipt:${receipt.id}`,
      details: `Cancelled receipt ${receipt.receiptNumber} (₹${receipt.amount.toFixed(2)})`,
      reason,
      // Cancelling a financial document is exactly the event an auditor reviews.
      severity: 'warning'
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      // Reverse the allocations, or the student's ledger keeps credit for money
      // whose receipt has been cancelled.
      for (const allocation of receipt.payment.allocations) {
        const recordWhere = { id: allocation.feeRecordId, institutionId: context.institutionId };
        await lockForUpdate(db.feeRecord, recordWhere);
        const record: LockedFeeRecord | null = await db.feeRecord.findFirst({
          where: recordWhere,
          select: { id: true, amount: true, paidAmount: true, waivedAmount: true, dueDate: true, status: true, description: true, type: true }
        });
        if (!record) continue;

        const newPaid = Math.max(0, round2(record.paidAmount - allocation.amount));
        await db.feeRecord.updateMany({
          where: { id: record.id, institutionId: context.institutionId },
          data: {
            paidAmount: newPaid,
            status: deriveStatus({
              amount: record.amount,
              paidAmount: newPaid,
              waivedAmount: record.waivedAmount,
              dueDate: record.dueDate
            }),
            paidDate: null
          }
        });
      }

      await db.payment.updateMany({
        where: { id: receipt.paymentId, institutionId: context.institutionId },
        data: { status: 'cancelled' }
      });

      await db.receipt.updateMany({
        where: { id: receipt.id, institutionId: context.institutionId },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelledBy: context.userId,
          cancellationReason: reason
        }
      });

      return { receiptNumber: receipt.receiptNumber, status: 'cancelled' };
    }
  );
}

/**
 * Verify a receipt by its number and code.
 *
 * Deliberately narrow: it confirms a receipt exists, its amount, and whether it
 * is still valid. It does NOT return the student's ledger — this is the one
 * finance surface reachable by someone holding a piece of paper.
 */
export async function verifyReceipt(
  context: TenantContext,
  receiptNumber: string,
  verificationCode: string
): Promise<{
  valid: boolean;
  reason?: string;
  receipt?: {
    receiptNumber: string;
    amount: number;
    amountInWords: string | null;
    studentName: string;
    rollNumber: string;
    issuedAt: Date;
    status: string;
  };
}> {
  const receipt = await basePrisma.receipt.findFirst({
    where: {
      institutionId: context.institutionId,
      receiptNumber,
      verificationCode: verificationCode.toUpperCase()
    }
  });

  if (!receipt) {
    // One message for both "no such receipt" and "wrong code", so the endpoint
    // cannot be used to enumerate valid receipt numbers.
    return { valid: false, reason: 'No receipt matches that number and verification code.' };
  }

  if (receipt.status === 'cancelled') {
    return {
      valid: false,
      reason: `Receipt ${receipt.receiptNumber} was cancelled on ${receipt.cancelledAt?.toISOString().slice(0, 10)}.`,
      receipt: {
        receiptNumber: receipt.receiptNumber,
        amount: receipt.amount,
        amountInWords: receipt.amountInWords,
        studentName: receipt.studentName,
        rollNumber: receipt.rollNumber,
        issuedAt: receipt.issuedAt,
        status: receipt.status
      }
    };
  }

  return {
    valid: true,
    receipt: {
      receiptNumber: receipt.receiptNumber,
      amount: receipt.amount,
      amountInWords: receipt.amountInWords,
      studentName: receipt.studentName,
      rollNumber: receipt.rollNumber,
      issuedAt: receipt.issuedAt,
      status: receipt.status
    }
  };
}
