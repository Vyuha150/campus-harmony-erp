/**
 * Validation for the legacy finance router (Phase 3b).
 *
 * `routes/finance.ts` had 34 handlers, and before this NONE of its writes were
 * validated or audited. In the module that moves money, that meant a fee
 * structure, a purchase order, a payroll record or a budget could be created or
 * changed with no schema, no record of who did it, and no way to reconstruct
 * what it looked like before.
 *
 * Five of those writes used the SPREAD form, `data: { ...req.body, dueDate }`,
 * which the mass-assignment ratchet did not match until it was widened a third
 * time. They were mass assignment with a decoration on top.
 *
 * As everywhere else, the omissions are the substance: derived totals, running
 * balances, approval fields and provenance are not accepted from a request.
 */

import { z } from 'zod';

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const money = z.coerce.number().min(0).max(10_000_000_000);
const jsonValue = z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]);
const isoDate = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'must be a valid date');

// ─── Fee structures ──────────────────────────────────────────────────────────

export const createFeeStructureSchema = z
  .object({
    academicYear: text(4, 20),
    semester: text(1, 20),
    program: text(2, 160),
    feeComponents: jsonValue,
    totalAmount: money,
    dueDate: isoDate,
    lateFeePenalty: money.optional(),
    active: z.boolean().optional()
  })
  .strict();

// ─── Journal entries ─────────────────────────────────────────────────────────

export const createJournalEntrySchema = z
  .object({
    // The Accounting screen sends neither an entry number nor anything but a
    // draft, and every manual entry was refused. The number is generated when
    // absent; a new entry is always a draft (posting is a separate act).
    entryNumber: text(1, 60).optional(),
    status: z.literal('draft').optional(),
    description: text(1, 500),
    reference: z.string().trim().max(120).nullable().optional(),
    date: isoDate.optional(),
    accounts: jsonValue,
    totalDebit: money,
    totalCredit: money
  })
  .strict()
  // A journal entry whose debits and credits disagree is not an entry; it is a
  // mistake that will be discovered during a reconciliation nobody enjoys.
  .refine((v) => Math.abs(v.totalDebit - v.totalCredit) < 0.005, {
    message: 'totalDebit and totalCredit must balance',
    path: ['totalCredit']
  });

// ─── Purchase orders ─────────────────────────────────────────────────────────

export const createPurchaseOrderSchema = z
  .object({
    // `poNumber` was REQUIRED here but no caller has ever sent one —
    // Procurement.tsx (the only one) has no field for it, so every purchase
    // order was rejected for a missing value the UI never collected. It is
    // now generated server-side in `createPurchaseOrder`, matching how every
    // other numbered document in this codebase works (IDC-, VP-, VIG-, TKT-),
    // and is deliberately not accepted from the caller: it is unique per
    // institution, so letting a request choose it invites collisions.
    department: text(2, 160),
    vendorId: text(1, 80),
    expectedDelivery: isoDate,
    totalAmount: money,
    items: jsonValue
  })
  // `approvedBy`, `deliveredDate`, `invoiceNumber` and `paymentDate` are facts
  // established later by people doing things. A request that can assert them can
  // record an order as approved, delivered and paid before anything happened.
  .strict();

export const updatePurchaseOrderSchema = z
  .object({
    // `paid` only through recording the vendor's invoice; the service checks
    // the order was delivered and that the invoice number is there.
    status: z.enum(['pending', 'approved', 'ordered', 'delivered', 'paid', 'cancelled']).optional(),
    expectedDelivery: isoDate.optional(),
    deliveredDate: isoDate.nullable().optional(),
    invoiceNumber: z.string().trim().max(80).nullable().optional(),
    paymentDate: isoDate.optional(),
    items: jsonValue.optional(),
    totalAmount: money.optional()
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });

// ─── Budgets ─────────────────────────────────────────────────────────────────

export const createBudgetSchema = z
  .object({
    department: text(2, 160),
    category: text(2, 80),
    budgetYear: text(4, 20),
    allocatedAmount: money
  })
  // `spentAmount`, `availableAmount` and `utilizationPercentage` are DERIVED.
  // The route computes them; accepting them would allow a budget that reports
  // headroom it does not have.
  .strict();

export const updateBudgetSchema = z
  .object({
    allocatedAmount: money.optional(),
    spentAmount: money.optional(),
    category: text(2, 80).optional()
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });

// ─── Payroll ─────────────────────────────────────────────────────────────────

export const updatePayrollSchema = z
  .object({
    basicSalary: money.optional(),
    allowances: jsonValue.nullable().optional(),
    deductions: jsonValue.nullable().optional(),
    paymentMethod: z.enum(['bank_transfer', 'cheque', 'cash']).optional()
  })
  // `status`, `paymentDate`, `grossSalary` and `netSalary` are omitted: the
  // first two say whether a person has actually been paid, and the last two are
  // derived from the components above.
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });

export const disbursePayrollSchema = z
  .object({
    month: text(1, 20),
    year: z.coerce.number().int().min(1900).max(2200),
    paymentDate: isoDate.optional()
  })
  .strict();

// ─── Fee payment adjustment ──────────────────────────────────────────────────

export const updateFeePaymentSchema = z
  .object({
    status: z.enum(['pending', 'partial', 'paid', 'overdue', 'waived']).optional(),
    paidAmount: money.optional(),
    remarks: z.string().trim().max(1000).nullable().optional()
  })
  // `amount` is what was BILLED. Changing it here would silently rewrite the
  // charge rather than record a payment against it; that belongs to the fee
  // structure, not to a payment adjustment.
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });

// ─── Alerts and tasks ────────────────────────────────────────────────────────

export const decideTaskSchema = z
  .object({
    status: z.enum(['approved', 'rejected', 'forwarded']),
    note: z.string().trim().max(500).optional()
  })
  .strict();

// ─── Shared list query ───────────────────────────────────────────────────────

export const financePage = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export const payrollQuery = financePage.extend({
  month: z.string().trim().max(20).optional(),
  year: z.coerce.number().int().min(1900).max(2200).optional()
});

// ─── PUT /fee-payments/:id ────────────────────────────────────────────────────
//
// Not `updateFeePaymentSchema` above — that enum (pending/partial/paid/
// overdue/waived) belongs to a different status vocabulary than this handler
// actually checks (`successful`/`pending`/`failed`, matching the gateway
// callback shape). Reusing the wrong one would accept a status the handler
// silently does nothing with — the same "client typo becomes a no-op" defect
// this schema exists to close, just moved to a different field.
export const feePaymentStatusUpdateSchema = z
  .object({
    status: z.enum(['successful', 'pending', 'failed']),
    mode: z.enum(['cash', 'dd', 'cheque', 'neft', 'upi', 'card', 'online']).optional(),
    reference: z.string().trim().max(80).optional()
  })
  .strict();

// ─── POST /reports/generate ───────────────────────────────────────────────────

export const financeReportGenerateSchema = z
  .object({
    type: text(1, 200),
    startDate: isoDate.optional(),
    endDate: isoDate.optional()
  })
  .strict()
  .refine(
    (v) => !v.startDate || !v.endDate || Date.parse(v.startDate) <= Date.parse(v.endDate),
    { message: 'startDate must not be after endDate.', path: ['endDate'] }
  );
