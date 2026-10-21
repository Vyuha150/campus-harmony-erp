/**
 * Legacy finance router, migrated to the service layer (Phase 3b).
 *
 * `routes/finance.ts` carried 34 handlers. The payments and receipts half was
 * rebuilt in EPIC-08 (`finance.service.ts`); this covers what was left behind:
 * fee structures, journal entries, purchase orders, budgets and payroll.
 *
 * WHAT WAS WRONG ACROSS ALL OF IT
 *
 *   1. NOT ONE WRITE WAS AUDITED. In the module that moves money, nothing
 *      recorded who created a purchase order, changed a budget or adjusted a
 *      payroll record, or what the row looked like beforehand.
 *
 *   2. NO VALIDATION ANYWHERE. Five writes used `data: { ...req.body }` — mass
 *      assignment with a decoration on top, which the ratchet did not match
 *      until it was widened a third time.
 *
 *   3. UNBOUNDED LISTS. Fee structures, purchase orders, budgets and payroll
 *      each returned their entire table.
 *
 *   4. DERIVED FIGURES ACCEPTED AS INPUT. `availableAmount` and
 *      `utilizationPercentage` on a budget were whatever the caller sent, so a
 *      budget could report headroom it did not have.
 */

import { basePrisma } from '../../lib/prisma.js';
import {
  mutate,
  toSkipTake,
  paginated,
  type PageRequest,
  type Paginated
} from '../../lib/service.js';
import { BusinessRuleError, NotFoundError, ValidationError } from '../../lib/errors.js';
import type { TenantContext } from '../../lib/tenant.js';

type Json = Record<string, unknown> | unknown[];

/** Sum the numeric leaves of an allowances/deductions blob. */
function sumComponents(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  return Object.values(value as Record<string, unknown>).reduce<number>(
    (total, v) => total + (Number(v) || 0),
    0
  );
}

// ─── Fee structures ──────────────────────────────────────────────────────────

export async function listFeeStructures(
  context: TenantContext,
  page: PageRequest
): Promise<Paginated<unknown>> {
  const where = { institutionId: context.institutionId };
  const [rows, total] = await Promise.all([
    basePrisma.feeStructure.findMany({
      where,
      orderBy: { academicYear: 'desc' },
      ...toSkipTake(page)
    }),
    basePrisma.feeStructure.count({ where })
  ]);
  return paginated(rows, total, page);
}

export async function createFeeStructure(
  context: TenantContext,
  input: {
    academicYear: string; semester: string; program: string;
    feeComponents: Json; totalAmount: number; dueDate: string;
    lateFeePenalty?: number | undefined; active?: boolean | undefined;
  }
) {
  return mutate(
    context,
    {
      action: 'CREATE',
      module: 'finance',
      resource: (r: unknown) => `FeeStructure:${(r as { id: string }).id}`,
      details: `Fee structure for ${input.program} ${input.academicYear} sem ${input.semester}, total ${input.totalAmount}`,
      severity: 'warning'
    },
    async (tx) =>
      tx.feeStructure.create({
        data: {
          institutionId: context.institutionId,
          academicYear: input.academicYear,
          semester: input.semester,
          program: input.program,
          feeComponents: input.feeComponents as never,
          totalAmount: input.totalAmount,
          dueDate: new Date(input.dueDate),
          ...(input.lateFeePenalty !== undefined ? { lateFeePenalty: input.lateFeePenalty } : {}),
          ...(input.active !== undefined ? { active: input.active } : {})
        }
      })
  );
}

// ─── Journal entries ─────────────────────────────────────────────────────────

export async function listJournalEntries(context: TenantContext, page: PageRequest) {
  const where = { institutionId: context.institutionId };
  const [rows, total] = await Promise.all([
    basePrisma.journalEntry.findMany({ where, orderBy: { date: 'desc' }, ...toSkipTake(page) }),
    basePrisma.journalEntry.count({ where })
  ]);
  return paginated(rows, total, page);
}

export async function createJournalEntry(
  context: TenantContext,
  input: {
    entryNumber?: string | undefined; status?: string | undefined; description: string; reference?: string | null | undefined;
    date?: string | undefined; accounts: Json; totalDebit: number; totalCredit: number;
  }
) {
  let entryNumber: string | undefined = input.entryNumber;
  if (!entryNumber) {
    const year = new Date().getFullYear();
    const n = await basePrisma.journalEntry.count({ where: { institutionId: context.institutionId, entryNumber: { startsWith: `JE/${year}/` } } });
    entryNumber = `JE/${year}/${String(n + 1).padStart(5, '0')}`;
  }
  input = { ...input, entryNumber };
  const clash = await basePrisma.journalEntry.findFirst({
    where: { institutionId: context.institutionId, entryNumber: entryNumber },
    select: { id: true }
  });
  if (clash) {
    throw new ValidationError(
      `Journal entry ${entryNumber} already exists. Entry numbers identify a ledger line and cannot be reused.`,
      { field: 'entryNumber' }
    );
  }

  return mutate(
    context,
    {
      action: 'CREATE',
      module: 'finance',
      resource: (r: unknown) => `JournalEntry:${(r as { id: string }).id}`,
      details: `Journal ${entryNumber}: ${input.description} (Dr ${input.totalDebit} / Cr ${input.totalCredit})`,
      severity: 'warning'
    },
    async (tx) =>
      tx.journalEntry.create({
        data: {
          institutionId: context.institutionId,
          entryNumber: entryNumber,
          description: input.description,
          reference: input.reference ?? null,
          ...(input.date ? { date: new Date(input.date) } : {}),
          accounts: input.accounts as never,
          totalDebit: input.totalDebit,
          totalCredit: input.totalCredit,
          // Posted by a separate action; a caller must not create an entry that
          // is already in the ledger.
          status: 'draft',
          createdBy: context.userId
        }
      })
  );
}

// ─── Purchase orders ─────────────────────────────────────────────────────────

export async function listPurchaseOrders(context: TenantContext, page: PageRequest) {
  const where = { institutionId: context.institutionId };
  const [rows, total] = await Promise.all([
    basePrisma.purchaseOrder.findMany({
      where,
      include: { vendor: true },
      orderBy: { orderDate: 'desc' },
      ...toSkipTake(page)
    }),
    basePrisma.purchaseOrder.count({ where })
  ]);
  return paginated(rows, total, page);
}

export async function createPurchaseOrder(
  context: TenantContext,
  input: {
    department: string; vendorId: string;
    expectedDelivery: string; totalAmount: number; items: Json;
  }
) {
  const vendor = await basePrisma.vendor.findFirst({
    where: { id: input.vendorId, institutionId: context.institutionId },
    select: { id: true, status: true }
  });
  if (!vendor) throw new NotFoundError(`Vendor ${input.vendorId}`);
  if (vendor.status === 'blacklisted') {
    throw new ValidationError(
      'This vendor is blacklisted. A purchase order cannot be raised against them.',
      { field: 'vendorId' }
    );
  }

  // Generated here, not accepted from the caller: `poNumber` is unique per
  // institution, and counted within this institution only so two tenants
  // cannot collide. Matches IDC-/VP-/VIG-/TKT- elsewhere in the codebase.
  const poCount = await basePrisma.purchaseOrder.count({
    where: { institutionId: context.institutionId }
  });
  const poNumber = `PO-${(poCount + 1).toString().padStart(5, '0')}`;

  return mutate(
    context,
    {
      action: 'CREATE',
      module: 'finance',
      resource: (r: unknown) => `PurchaseOrder:${(r as { id: string }).id}`,
      details: `PO ${poNumber} for ${input.department}, ${input.totalAmount}`,
      severity: 'warning'
    },
    async (tx) =>
      tx.purchaseOrder.create({
        data: {
          institutionId: context.institutionId,
          poNumber,
          department: input.department,
          vendorId: input.vendorId,
          expectedDelivery: new Date(input.expectedDelivery),
          totalAmount: input.totalAmount,
          items: input.items as never,
          status: 'pending'
        }
      })
  );
}

export async function updatePurchaseOrder(
  context: TenantContext,
  id: string,
  input: Record<string, unknown>
) {
  const existing = await basePrisma.purchaseOrder.findFirst({
    where: { id, institutionId: context.institutionId }
  });
  if (!existing) throw new NotFoundError(`Purchase order ${id}`);

  if (input.paymentDate !== undefined && input.status !== 'paid') {
    throw new ValidationError('A payment date is recorded only when the invoice is paid.');
  }
  if (input.status === 'paid') {
    if (existing.status !== 'delivered') {
      throw new BusinessRuleError(`Only a delivered order can be paid; PO ${existing.poNumber} is ${existing.status}.`);
    }
    if (!String(input.invoiceNumber ?? existing.invoiceNumber ?? '').trim()) {
      throw new ValidationError('Record the vendor invoice number to mark the order paid.');
    }
    const paid = input.paymentDate ? new Date(String(input.paymentDate)) : new Date();
    if (paid.getTime() > Date.now() + 24 * 60 * 60 * 1000) throw new ValidationError('The payment date cannot be in the future.');
    input = { ...input, paymentDate: paid };
  }

  return mutate(
    context,
    {
      action: 'UPDATE',
      module: 'finance',
      resource: `PurchaseOrder:${id}`,
      details: `Updated ${Object.keys(input).join(', ')} on PO ${existing.poNumber}`,
      oldValue: JSON.stringify({ status: existing.status, totalAmount: existing.totalAmount }),
      newValue: JSON.stringify(input),
      severity: 'warning'
    },
    async (tx) => {
      const data: Record<string, unknown> = { ...input };
      if (typeof data.expectedDelivery === 'string') data.expectedDelivery = new Date(data.expectedDelivery);
      if (typeof data.deliveredDate === 'string') data.deliveredDate = new Date(data.deliveredDate);
      // Who approved it is taken from the caller, never from the request.
      if (data.status === 'approved') data.approvedBy = context.userId;

      const result = await tx.purchaseOrder.updateMany({
        where: { id, institutionId: context.institutionId },
        data: data as never
      });
      if (result.count === 0) throw new NotFoundError(`Purchase order ${id}`);
      return tx.purchaseOrder.findFirst({ where: { id, institutionId: context.institutionId } });
    }
  );
}

// ─── Budgets ─────────────────────────────────────────────────────────────────

export async function listBudgets(context: TenantContext, page: PageRequest) {
  const where = { institutionId: context.institutionId };
  const [rows, total] = await Promise.all([
    basePrisma.budgetAllocation.findMany({ where, ...toSkipTake(page) }),
    basePrisma.budgetAllocation.count({ where })
  ]);
  return paginated(rows, total, page);
}

/** available and utilisation are DERIVED, never accepted. */
function budgetDerived(allocated: number, spent: number) {
  return {
    availableAmount: Number((allocated - spent).toFixed(2)),
    utilizationPercentage: allocated > 0 ? Number(((spent / allocated) * 100).toFixed(2)) : 0
  };
}

export async function createBudget(
  context: TenantContext,
  input: { department: string; category: string; budgetYear: string; allocatedAmount: number }
) {
  return mutate(
    context,
    {
      action: 'CREATE',
      module: 'finance',
      resource: (r: unknown) => `BudgetAllocation:${(r as { id: string }).id}`,
      details: `Budget ${input.allocatedAmount} for ${input.department}/${input.category} ${input.budgetYear}`,
      severity: 'warning'
    },
    async (tx) =>
      tx.budgetAllocation.create({
        data: {
          institutionId: context.institutionId,
          department: input.department,
          category: input.category,
          budgetYear: input.budgetYear,
          allocatedAmount: input.allocatedAmount,
          spentAmount: 0,
          ...budgetDerived(input.allocatedAmount, 0)
        }
      })
  );
}

export async function updateBudget(
  context: TenantContext,
  id: string,
  input: { allocatedAmount?: number | undefined; spentAmount?: number | undefined; category?: string | undefined }
) {
  const existing = await basePrisma.budgetAllocation.findFirst({
    where: { id, institutionId: context.institutionId }
  });
  if (!existing) throw new NotFoundError(`Budget ${id}`);

  const allocated = input.allocatedAmount ?? existing.allocatedAmount;
  const spent = input.spentAmount ?? existing.spentAmount;

  if (spent > allocated) {
    throw new ValidationError(
      `Spend of ${spent} exceeds the allocation of ${allocated}. Raise the allocation before recording the spend, so the overrun is a decision rather than a side effect.`,
      { field: 'spentAmount' }
    );
  }

  return mutate(
    context,
    {
      action: 'UPDATE',
      module: 'finance',
      resource: `BudgetAllocation:${id}`,
      details: `Budget ${existing.department}/${existing.category}: allocated ${existing.allocatedAmount}->${allocated}, spent ${existing.spentAmount}->${spent}`,
      oldValue: JSON.stringify({
        allocatedAmount: existing.allocatedAmount,
        spentAmount: existing.spentAmount
      }),
      newValue: JSON.stringify({ allocatedAmount: allocated, spentAmount: spent }),
      severity: 'warning'
    },
    async (tx) => {
      const result = await tx.budgetAllocation.updateMany({
        where: { id, institutionId: context.institutionId },
        data: {
          allocatedAmount: allocated,
          spentAmount: spent,
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...budgetDerived(allocated, spent),
          lastUpdated: new Date()
        }
      });
      if (result.count === 0) throw new NotFoundError(`Budget ${id}`);
      return tx.budgetAllocation.findFirst({ where: { id, institutionId: context.institutionId } });
    }
  );
}

// ─── Payroll ─────────────────────────────────────────────────────────────────

export async function listPayroll(
  context: TenantContext,
  page: PageRequest,
  filters: { month?: string | undefined; year?: number | undefined }
) {
  const where = {
    institutionId: context.institutionId,
    ...(filters.month ? { month: filters.month } : {}),
    ...(filters.year ? { year: filters.year } : {})
  };
  const [rows, total] = await Promise.all([
    basePrisma.payrollRecord.findMany({
      where,
      orderBy: { employeeName: 'asc' },
      ...toSkipTake(page)
    }),
    basePrisma.payrollRecord.count({ where })
  ]);
  return paginated(rows, total, page);
}

export async function updatePayroll(
  context: TenantContext,
  id: string,
  input: {
    basicSalary?: number | undefined; allowances?: Json | null | undefined;
    deductions?: Json | null | undefined; paymentMethod?: string | undefined;
  }
) {
  const existing = await basePrisma.payrollRecord.findFirst({
    where: { id, institutionId: context.institutionId }
  });
  if (!existing) throw new NotFoundError(`Payroll record ${id}`);

  if (existing.status === 'paid') {
    throw new ValidationError(
      'This payroll record has already been disbursed and cannot be edited. Record a correction against the next cycle instead.',
      { field: 'status' }
    );
  }

  const basic = input.basicSalary ?? existing.basicSalary;
  const allowances = input.allowances !== undefined ? input.allowances : existing.allowances;
  const deductions = input.deductions !== undefined ? input.deductions : existing.deductions;
  const gross = basic + sumComponents(allowances);
  const net = gross - sumComponents(deductions);

  return mutate(
    context,
    {
      action: 'UPDATE',
      module: 'finance',
      resource: `PayrollRecord:${id}`,
      details: `Payroll for ${existing.employeeName}: net ${existing.netSalary} -> ${net.toFixed(2)}`,
      oldValue: JSON.stringify({
        basicSalary: existing.basicSalary,
        grossSalary: existing.grossSalary,
        netSalary: existing.netSalary
      }),
      newValue: JSON.stringify({ basicSalary: basic, grossSalary: gross, netSalary: net }),
      severity: 'warning'
    },
    async (tx) => {
      const result = await tx.payrollRecord.updateMany({
        where: { id, institutionId: context.institutionId },
        data: {
          basicSalary: basic,
          allowances: allowances as never,
          deductions: deductions as never,
          ...(input.paymentMethod !== undefined ? { paymentMethod: input.paymentMethod } : {}),
          grossSalary: Number(gross.toFixed(2)),
          netSalary: Number(net.toFixed(2))
        }
      });
      if (result.count === 0) throw new NotFoundError(`Payroll record ${id}`);
      return tx.payrollRecord.findFirst({ where: { id, institutionId: context.institutionId } });
    }
  );
}

/**
 * Disburse a payroll month.
 *
 * One transaction for the whole run, and already-paid records are skipped rather
 * than paid twice. The previous handler had no such guard.
 */
export async function disbursePayroll(
  context: TenantContext,
  input: { month: string; year: number; paymentDate?: string | undefined }
): Promise<{ disbursed: number; skipped: number; totalNet: number }> {
  const due = await basePrisma.payrollRecord.findMany({
    where: {
      institutionId: context.institutionId,
      month: input.month,
      year: input.year,
      // Only approved payroll is paid; drafts must be approved first.
      status: 'approved'
    },
    select: { id: true, netSalary: true }
  });

  const alreadyPaid = await basePrisma.payrollRecord.count({
    where: {
      institutionId: context.institutionId,
      month: input.month,
      year: input.year,
      status: 'paid'
    }
  });

  if (due.length === 0) {
    throw new ValidationError(
      `Nothing approved to disburse for ${input.month} ${input.year}. ${alreadyPaid} record(s) are already paid; approve the drafts first.`,
      { field: 'month' }
    );
  }

  const totalNet = due.reduce((sum, r) => sum + r.netSalary, 0);
  const paymentDate = input.paymentDate ? new Date(input.paymentDate) : new Date();

  return mutate(
    context,
    {
      action: 'UPDATE',
      module: 'finance',
      resource: `PayrollRecord:${input.month}-${input.year}`,
      details: `Disbursed ${due.length} payroll record(s) for ${input.month} ${input.year}, total net ${totalNet.toFixed(2)}`,
      severity: 'critical'
    },
    async (tx) => {
      await tx.payrollRecord.updateMany({
        where: {
          institutionId: context.institutionId,
          id: { in: due.map((r) => r.id) }
        },
        data: { status: 'paid', paymentDate }
      });
      return {
        disbursed: due.length,
        skipped: alreadyPaid,
        totalNet: Number(totalNet.toFixed(2))
      };
    }
  );
}
