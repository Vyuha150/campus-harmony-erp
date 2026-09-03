import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { sendError } from '../lib/errors.js';
import { getTenantContext } from '../lib/tenant.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { entityId } from '../schemas/common.js';
import { updateTenantEntity } from '../modules/common/entityUpdate.service.js';
import {
  updateJournalEntrySchema
} from '../modules/common/entityUpdate.schemas.js';
import {
  createPayrollSchema,
  createVendorSchema
} from '../modules/common/entityCreate.schemas.js';
import * as legacy from '../modules/finance/legacy.service.js';
import {
  createFeeStructureSchema,
  createJournalEntrySchema,
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  createBudgetSchema,
  updateBudgetSchema,
  updatePayrollSchema,
  disbursePayrollSchema,
  financePage,
  payrollQuery,
  decideTaskSchema,
  feePaymentStatusUpdateSchema,
  financeReportGenerateSchema
} from '../modules/finance/legacy.schemas.js';

const router = Router();

function toArray<T = any>(value: any): T[] {
  return Array.isArray(value) ? value : [];
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date: Date): string {
  return date.toLocaleString('en-IN', { month: 'short' });
}

// ─── Dashboard ───
router.get('/dashboard', authenticate, async (req: Request, res: Response) => {
  try {
    const totalPaid = await prisma.feeRecord.aggregate({ where: { status: 'paid' }, _sum: { amount: true } });
    const pendingDues = await prisma.feeRecord.aggregate({ where: { status: 'pending' }, _sum: { amount: true } });
    const countTransactions = await prisma.feeRecord.count({ where: { status: 'paid' } });
    const pendingApprovals = await prisma.approvalItem.count({ where: { type: 'fee_waiver', status: 'pending' } });

    res.json({
      success: true,
      data: {
        stats: [
          { label: 'Total Revenue', value: `₹${totalPaid._sum.amount || 0}`, icon: 'IndianRupee', color: 'text-primary' },
          { label: 'Pending Dues', value: `₹${pendingDues._sum.amount || 0}`, icon: 'AlertCircle', color: 'text-warning' },
          { label: 'Processed Transactions', value: countTransactions.toString(), icon: 'CheckCircle2', color: 'text-success' },
          { label: 'Fee Waiver Requests', value: pendingApprovals.toString(), icon: 'Clock', color: 'text-muted-foreground' }
        ]
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/snapshot', authenticate, async (_req: Request, res: Response) => {
  try {
    const [budgets, paidFees, pendingFees, overdueCount] = await Promise.all([
      prisma.budgetAllocation.findMany(),
      prisma.feeRecord.findMany({ where: { status: 'paid' }, select: { amount: true, paidDate: true } }),
      prisma.feeRecord.findMany({ where: { status: 'pending' }, select: { amount: true } }),
      prisma.feeRecord.count({ where: { status: 'pending', dueDate: { lt: new Date() } } }),
    ]);

    const budgetAllocated = budgets.reduce((sum: number, row: any) => sum + Number(row.allocatedAmount || 0), 0);
    const budgetSpent = budgets.reduce((sum: number, row: any) => sum + Number(row.spentAmount || 0), 0);
    const revenueCollected = paidFees.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
    const outstandingDues = pendingFees.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);

    const monthlyMap = new Map<string, { month: string; income: number; expenses: number }>();
    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      monthlyMap.set(monthKey(date), { month: monthLabel(date), income: 0, expenses: 0 });
    }

    paidFees.forEach((row: any) => {
      if (!row.paidDate) return;
      const key = monthKey(new Date(row.paidDate));
      const bucket = monthlyMap.get(key);
      if (bucket) bucket.income += Number(row.amount || 0);
    });

    budgets.forEach((row: any) => {
      const year = Number(String(row.budgetYear || '').slice(0, 4));
      if (!Number.isFinite(year)) return;
      const date = new Date(year, new Date().getMonth(), 1);
      const key = monthKey(date);
      const bucket = monthlyMap.get(key);
      if (bucket) bucket.expenses += Number(row.spentAmount || 0) / 6;
    });

    const salaryBudget = budgets
      .filter((row: any) => String(row.category || '').toLowerCase().includes('salary'))
      .reduce((sum: number, row: any) => sum + Number(row.spentAmount || 0), 0);
    const salaryPercentage = budgetSpent > 0 ? Math.round((salaryBudget / budgetSpent) * 100) : 0;

    res.json({
      success: true,
      data: {
        budgetSpent,
        budgetAllocated,
        revenueCollected,
        outstandingDues,
        salaryPercentage,
        defaulterCount: overdueCount,
        lastUpdated: new Date(),
        cashFlow: Array.from(monthlyMap.values()),
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/alerts', authenticate, async (_req: Request, res: Response) => {
  try {
    const [budgets, overdueRecords] = await Promise.all([
      prisma.budgetAllocation.findMany(),
      prisma.feeRecord.findMany({
        where: { status: 'pending', dueDate: { lt: new Date() } },
        include: { student: { include: { user: true } } },
        take: 5,
      }),
    ]);

    const alerts: any[] = [];

    budgets
      .filter((row: any) => Number(row.utilizationPercentage || 0) >= 85)
      .forEach((row: any) => {
        alerts.push({
          id: `budget-${row.id}`,
          title: `${row.department} nearing budget cap`,
          description: `${row.category} utilization is ${Math.round(Number(row.utilizationPercentage || 0))}%`,
          severity: Number(row.utilizationPercentage || 0) >= 95 ? 'critical' : 'high',
          amount: Number(row.availableAmount || 0),
          acknowledged: false,
        });
      });

    overdueRecords.forEach((row: any) => {
      alerts.push({
        id: `due-${row.id}`,
        title: `Overdue fee payment`,
        description: `${row.student?.user?.name || 'Student'} has overdue ${row.type || 'fee'} payment`,
        severity: 'high',
        amount: Number(row.amount || 0),
        acknowledged: false,
      });
    });

    res.json({ success: true, data: alerts.slice(0, 12) });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/alerts/:id/ack', authenticate, async (_req: Request, res: Response) => {
  res.json({ success: true, data: { acknowledged: true } });
});

router.get('/tasks', authenticate, async (_req: Request, res: Response) => {
  try {
    const items = await prisma.approvalItem.findMany({
      where: {
        OR: [
          { type: 'budget_allocation' },
          { type: 'capital_expenditure' },
          { type: 'purchase_order' },
          { type: 'procurement' },
        ]
      },
      orderBy: { requestedAt: 'desc' },
      take: 20,
    });

    res.json({
      success: true,
      data: items.map((item: any) => ({
        id: item.id,
        title: item.title,
        description: item.details,
        requestedBy: item.requestedBy,
        amount: Number(item.amount || 0),
        department: 'Finance',
        priority: item.priority,
        status: item.status,
        requestedAt: item.requestedAt,
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/tasks/:id', authenticate, validate({ body: decideTaskSchema }), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const status = String(req.body.status || 'pending');
    // updateMany + a pending filter, NOT update-by-id.
    //
    // The tenant extension can constrain a `where` clause but cannot filter a
    // unique-key update, so `update({ where: { id } })` let anyone holding an id
    // from ANOTHER institution decide that approval. Demonstrated live before
    // migration 0022. The status is validated above rather than written raw.
    const ALLOWED_DECISIONS = ['approved', 'rejected', 'forwarded'];
    if (!ALLOWED_DECISIONS.includes(status)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `status must be one of: ${ALLOWED_DECISIONS.join(', ')}.` }
      });
      return;
    }
    const changed = await prisma.approvalItem.updateMany({
      where: { id, status: 'pending' },
      data: { status, decidedBy: getTenantContext(req).userId, decidedAt: new Date() }
    });
    if (changed.count === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No pending approval with that id.' }
      });
      return;
    }
    const updated = await prisma.approvalItem.findFirst({ where: { id } });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Fee Structures ───
router.get(
  '/fee-structures',
  authenticate,
  validate({ query: financePage }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as { page: number; pageSize: number };
    const result = await legacy.listFeeStructures(getTenantContext(req), q);
    res.json({ success: true, ...result });
  })
);

/**
 * Was `create({ data: { ...req.body, dueDate } })` — mass assignment with a
 * decoration on top, and unaudited in the module that sets what students owe.
 */
router.post(
  '/fee-structures',
  authenticate,
  validate({ body: createFeeStructureSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const created = await legacy.createFeeStructure(getTenantContext(req), req.body);
    res.status(201).json({ success: true, data: created });
  })
);

// ─── Payments ───
router.get('/payments', authenticate, async (req: Request, res: Response) => {
  try {
    const query = req.query as Record<string, string | undefined>;
    const { status, type } = query;
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const payments = await prisma.feeRecord.findMany({
      where,
      include: { student: { include: { user: true } } },
      orderBy: { paidDate: 'desc' },
      take: 100
    });

    res.json({
      success: true,
      data: payments.map((p: any) => ({
        id: p.id, studentName: p.student.user.name, rollNumber: p.student.rollNumber,
        type: p.type, amount: p.amount, dueDate: p.dueDate, paidDate: p.paidDate,
        status: p.status, transactionId: p.transactionId, method: p.method
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/fee-payments', authenticate, async (req: Request, res: Response) => {
  try {
    const query = req.query as Record<string, string | undefined>;
    const { status, type } = query;
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const payments = await prisma.feeRecord.findMany({
      where,
      include: { student: { include: { user: true } } },
      orderBy: { paidDate: 'desc' },
      take: 100
    });

    res.json({
      success: true,
      data: payments.map((p: any) => ({
        id: p.id,
        studentName: p.student?.user?.name || 'Unknown',
        studentId: p.student?.rollNumber || '-',
        program: p.student?.program || '-',
        amount: Number(p.amount || 0),
        paymentMethod: p.transactionId ? 'online' : 'offline',
        paymentDate: p.paidDate || p.dueDate,
        status: String(p.status || '').toLowerCase() === 'paid' ? 'successful' : 'pending'
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/fee-payments/:id', authenticate, validate({ body: feePaymentStatusUpdateSchema }), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const payload: any = {};
    if (req.body.status === 'successful') {
      payload.status = 'paid';
      payload.paidDate = new Date();
    }
    if (req.body.status === 'pending') {
      payload.status = 'pending';
    }
    if (req.body.status === 'failed') {
      payload.status = 'pending';
    }
    const updated = await prisma.feeRecord.update({ where: { id }, data: payload });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Defaulters ───
router.get('/defaulters', authenticate, async (req: Request, res: Response) => {
  try {
    const defaulters = await prisma.feeRecord.findMany({
      where: { status: 'pending', dueDate: { lt: new Date() } },
      include: { student: { include: { user: true } } }
    });

    const grouped: any = {};
    defaulters.forEach((d: any) => {
      const key = d.student.id;
      if (!grouped[key]) {
        grouped[key] = {
          studentId: d.student.id, name: d.student.user.name, rollNumber: d.student.rollNumber,
          program: d.student.program, semester: d.student.semester, totalDue: 0, overdueItems: 0
        };
      }
      grouped[key].totalDue += d.amount;
      grouped[key].overdueItems += 1;
    });

    res.json({ success: true, data: Object.values(grouped) });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Journal Entries ───
router.get(
  '/journal-entries',
  authenticate,
  validate({ query: financePage }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as { page: number; pageSize: number };
    const result = await legacy.listJournalEntries(getTenantContext(req), q);
    res.json({ success: true, ...result });
  })
);

/**
 * A journal entry whose debits and credits disagree is not an entry; the schema
 * now refuses it. `status` is forced to `draft` — posting is a separate act.
 */
router.post(
  '/journal-entries',
  authenticate,
  validate({ body: createJournalEntrySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const created = await legacy.createJournalEntry(getTenantContext(req), req.body);
    res.status(201).json({ success: true, data: created });
  })
);

router.put(
  '/journal-entries/:id',
  authenticate,
  validate({ params: z.object({ id: entityId }), body: updateJournalEntrySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await updateTenantEntity(getTenantContext(req), {
      model: 'journalEntry',
      entity: 'JournalEntry',
      module: 'finance',
      id: String(req.params.id),
      data: req.body as Record<string, unknown>
    });

    res.json({ success: true, data: updated });
  })
);

// ─── Purchase Orders ───
router.get(
  '/purchase-orders',
  authenticate,
  validate({ query: financePage }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as { page: number; pageSize: number };
    const result = await legacy.listPurchaseOrders(getTenantContext(req), q);
    res.json({ success: true, ...result });
  })
);

router.post(
  '/purchase-orders',
  authenticate,
  validate({ body: createPurchaseOrderSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const created = await legacy.createPurchaseOrder(getTenantContext(req), req.body);
    res.status(201).json({ success: true, data: created });
  })
);

router.put(
  '/purchase-orders/:id',
  authenticate,
  validate({ params: z.object({ id: entityId }), body: updatePurchaseOrderSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await legacy.updatePurchaseOrder(
      getTenantContext(req),
      String(req.params.id),
      req.body
    );
    res.json({ success: true, data: updated });
  })
);

// ─── Vendors ───
router.get('/vendors', authenticate, async (req: Request, res: Response) => {
  try {
    const vendors = await prisma.vendor.findMany({ include: { purchaseOrders: { take: 5, orderBy: { orderDate: 'desc' } } } });
    res.json({ success: true, data: vendors });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post(
  '/vendors',
  authenticate,
  validate({ body: createVendorSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    // Was `data: req.body`. `tsc` could not see that — req.body is `any` —
    // so it compiled cleanly while accepting every column. The tenant key is
    // injected by the Prisma extension and is NOT read from the body.
    const body = req.body as z.infer<typeof createVendorSchema>;
    const record = await prisma.vendor.create({
      data: {
        ...body,
      } as any
    });

    res.status(201).json({ success: true, data: record });
  })
);

// ─── Payroll ───
router.get(
  '/payroll',
  authenticate,
  validate({ query: payrollQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as { page: number; pageSize: number; month?: string; year?: number };
    const result = await legacy.listPayroll(
      getTenantContext(req),
      { page: q.page, pageSize: q.pageSize },
      { month: q.month, year: q.year }
    );
    res.json({ success: true, ...result });
  })
);

/**
 * `grossSalary` and `netSalary` are recomputed from the components; a paid
 * record can no longer be edited at all.
 */
router.put(
  '/payroll/:id',
  authenticate,
  validate({ params: z.object({ id: entityId }), body: updatePayrollSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await legacy.updatePayroll(
      getTenantContext(req),
      String(req.params.id),
      req.body
    );
    res.json({ success: true, data: updated });
  })
);

/**
 * One transaction for the whole run, and already-paid records are skipped
 * rather than paid twice. The previous handler had no such guard.
 */
router.post(
  '/payroll/disburse',
  authenticate,
  validate({ body: disbursePayrollSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await legacy.disbursePayroll(getTenantContext(req), req.body);
    res.json({
      success: true,
      message: `Disbursed ${result.disbursed} record(s), total net ${result.totalNet}. ${result.skipped} already paid.`,
      data: result
    });
  })
);

router.post(
  '/payroll/process',
  authenticate,
  validate({ body: createPayrollSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    // Was `data: req.body`. `tsc` could not see that — req.body is `any` —
    // so it compiled cleanly while accepting every column. The tenant key is
    // injected by the Prisma extension and is NOT read from the body.
    const body = req.body as z.infer<typeof createPayrollSchema>;

    // grossSalary / netSalary are DERIVED and are not accepted from the client.
    // A payroll row whose stated net contradicts its own components is not a
    // record of anything.
    const sum = (v: unknown) =>
      v && typeof v === 'object'
        ? Object.values(v as Record<string, unknown>).reduce<number>(
            (a, b) => a + (Number(b) || 0),
            0
          )
        : 0;
    const gross = body.basicSalary + sum(body.allowances);
    const net = gross - sum(body.deductions);
    const record = await prisma.payrollRecord.create({
      data: {
        ...body,
        grossSalary: Number(gross.toFixed(2)),
        netSalary: Number(net.toFixed(2)),
      } as any
    });

    res.status(201).json({ success: true, data: record });
  })
);

router.get('/payroll/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const record = await prisma.payrollRecord.findUnique({ where: { id } });
    res.json({ success: true, data: record });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Reports ───
router.get('/reports', authenticate, async (req: Request, res: Response) => {
  try {
    const totalRevenue = await prisma.feeRecord.aggregate({ where: { status: 'paid' }, _sum: { amount: true } });
    const pendingDues = await prisma.feeRecord.aggregate({ where: { status: 'pending' }, _sum: { amount: true } });
    const budgets = await prisma.budgetAllocation.findMany();

    res.json({
      success: true,
      data: {
        totalRevenue: totalRevenue._sum.amount || 0,
        pendingDues: pendingDues._sum.amount || 0,
        totalBudget: budgets.reduce((s: number, b: any) => s + b.allocatedAmount, 0),
        totalSpent: budgets.reduce((s: number, b: any) => s + b.spentAmount, 0),
        budgetAllocations: budgets
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/reports/generate', authenticate, validate({ body: financeReportGenerateSchema }), async (req: Request, res: Response) => {
  try {
    const { type, startDate, endDate } = req.body;
    const where: any = { status: 'paid' };
    if (startDate) where.paidDate = { gte: new Date(startDate) };
    if (endDate) where.paidDate = { ...where.paidDate, lte: new Date(endDate) };

    const records = await prisma.feeRecord.findMany({ where, include: { student: { include: { user: true } } } });
    res.json({
      success: true,
      data: { reportType: type, recordCount: records.length, totalAmount: records.reduce((s: number, r: any) => s + r.amount, 0), generatedAt: new Date() }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/reports/catalog', authenticate, async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      { title: 'Balance Sheet', desc: 'Assets, liabilities, and equity position', category: 'statements', icon: 'FileText' },
      { title: 'Income & Expenditure', desc: 'Revenue vs expenses for the period', category: 'statements', icon: 'BarChart3' },
      { title: 'Cash Flow Statement', desc: 'Operating, investing, financing activities', category: 'statements', icon: 'TrendingUp' },
      { title: 'Department Variance', desc: 'Department-wise budget vs actual analysis', category: 'analysis', icon: 'PieChart' },
      { title: 'Procurement Summary', desc: 'Purchase order and vendor payment summary', category: 'operational', icon: 'FileBarChart' },
      { title: 'Compliance Register', desc: 'Regulatory filing and statutory compliance view', category: 'compliance', icon: 'Shield' },
      { title: 'Internal Audit Pack', desc: 'Generated internal audit evidence pack', category: 'audit', icon: 'FileText' },
    ]
  });
});

router.get('/reports/summary', authenticate, async (_req: Request, res: Response) => {
  try {
    // WHAT THIS REPLACES. Four fields here were never measured: `journalEntry`
    // counts ledger postings, not reports generated, but was relabelled and
    // returned as `reportsGenerated`. `pendingCount` — fee records awaiting
    // payment, an accounts-receivable figure — was returned as
    // `auditObservations`, an unrelated financial-audit concept. From that
    // same wrong number, `pendingAuditResolutions` invented a further 40%
    // as "resolved". `lastAuditPeriod` was the literal string 'Q4 FY 2025-26'
    // on every load, audited or not. There is no audit-observation, audit-
    // period, or report-generation model anywhere in this schema — none of
    // the four can be computed today, so each is null rather than a number
    // borrowed from a different question. `complianceScore`, likewise
    // repurposing budget utilization as compliance, is dropped rather than
    // relabelled: utilization isn't a proxy for compliance either.
    const [paidCount, pendingCount] = await Promise.all([
      prisma.feeRecord.count({ where: { status: 'paid' } }),
      prisma.feeRecord.count({ where: { status: 'pending' } }),
    ]);

    res.json({
      success: true,
      data: {
        reportsGenerated: null,
        auditObservations: null,
        pendingAuditResolutions: null,
        lastAuditPeriod: null,
        complianceScore: null,
        paidCount,
        pendingCount,
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Budgets ───
router.get(
  '/budgets',
  authenticate,
  validate({ query: financePage }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as { page: number; pageSize: number };
    const result = await legacy.listBudgets(getTenantContext(req), q);
    res.json({ success: true, ...result });
  })
);

/**
 * `availableAmount` and `utilizationPercentage` are DERIVED and no longer
 * accepted. They used to arrive in the body, so a budget could report headroom
 * it did not have.
 */
router.post(
  '/budgets',
  authenticate,
  validate({ body: createBudgetSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const created = await legacy.createBudget(getTenantContext(req), req.body);
    res.status(201).json({ success: true, data: created });
  })
);

router.put(
  '/budgets/:id',
  authenticate,
  validate({ params: z.object({ id: entityId }), body: updateBudgetSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await legacy.updateBudget(
      getTenantContext(req),
      String(req.params.id),
      req.body
    );
    res.json({ success: true, data: updated });
  })
);

router.get('/expenditure-trend', authenticate, async (_req: Request, res: Response) => {
  try {
    const budgets = await prisma.budgetAllocation.findMany();
    const yearBuckets: Record<string, { total: number; count: number }> = {};

    budgets.forEach((row: any) => {
      const year = String(row.budgetYear || 'Unknown');
      if (!yearBuckets[year]) yearBuckets[year] = { total: 0, count: 0 };
      yearBuckets[year].total += Number(row.spentAmount || 0);
      yearBuckets[year].count += 1;
    });

    // Previously indexed `yearBuckets[...]` and `sortedYears[index - 1]` without
    // undefined checks — TS2532/TS2538. With no budget rows, or a sparse index,
    // this threw "Cannot read properties of undefined" at runtime and returned a
    // 500 from the finance dashboard.
    const mean = (bucket: { total: number; count: number } | undefined): number =>
      bucket && bucket.count > 0 ? bucket.total / bucket.count : 0;

    const sortedYears = Object.keys(yearBuckets).sort();
    const data = sortedYears.map((year, index) => {
      const amount = Math.round(mean(yearBuckets[year]));

      const previousYear = index > 0 ? sortedYears[index - 1] : undefined;
      const prev = previousYear !== undefined ? mean(yearBuckets[previousYear]) : amount;

      const changePercentage = prev > 0 ? Number((((amount - prev) / prev) * 100).toFixed(1)) : 0;
      return { year, amount, changePercentage };
    });

    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/revenue-streams', authenticate, async (_req: Request, res: Response) => {
  try {
    const paid = await prisma.feeRecord.findMany({ where: { status: 'paid' } });
    const streamMap: Record<string, number> = {};
    paid.forEach((row: any) => {
      const key = String(row.type || 'other').toLowerCase();
      streamMap[key] = (streamMap[key] || 0) + Number(row.amount || 0);
    });

    const total = Object.values(streamMap).reduce((sum, amount) => sum + amount, 0);
    const data = Object.entries(streamMap).map(([stream, amount]) => ({
      stream: stream.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
      trend: 'stable'
    }));

    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

export default router;
