import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/tasks/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const status = String(req.body.status || 'pending');
    const updated = await prisma.approvalItem.update({ where: { id }, data: { status } });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Fee Structures ───
router.get('/fee-structures', authenticate, async (req: Request, res: Response) => {
  try {
    const structures = await prisma.feeStructure.findMany({ orderBy: { academicYear: 'desc' } });
    res.json({ success: true, data: structures });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/fee-structures', authenticate, async (req: Request, res: Response) => {
  try {
    const structure = await prisma.feeStructure.create({ data: { ...req.body, dueDate: new Date(req.body.dueDate) } });
    res.json({ success: true, data: structure });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/fee-payments/:id', authenticate, async (req: Request, res: Response) => {
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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Journal Entries ───
router.get('/journal-entries', authenticate, async (req: Request, res: Response) => {
  try {
    const entries = await prisma.journalEntry.findMany({ orderBy: { date: 'desc' }, take: 100 });
    res.json({ success: true, data: entries });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/journal-entries', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const count = await prisma.journalEntry.count();
    const entry = await prisma.journalEntry.create({
      data: { ...req.body, entryNumber: `JE-${(count + 1).toString().padStart(5, '0')}`, createdBy: userId, date: new Date(req.body.date || Date.now()) }
    });
    res.json({ success: true, data: entry });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/journal-entries/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await prisma.journalEntry.update({ where: { id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Purchase Orders ───
router.get('/purchase-orders', authenticate, async (req: Request, res: Response) => {
  try {
    const orders = await prisma.purchaseOrder.findMany({ include: { vendor: true }, orderBy: { orderDate: 'desc' } });
    res.json({ success: true, data: orders });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/purchase-orders', authenticate, async (req: Request, res: Response) => {
  try {
    const count = await prisma.purchaseOrder.count();
    const order = await prisma.purchaseOrder.create({
      data: {
        ...req.body,
        poNumber: `PO-${(count + 1).toString().padStart(5, '0')}`,
        orderDate: new Date(req.body.orderDate || Date.now()),
        expectedDelivery: new Date(req.body.expectedDelivery)
      }
    });
    res.json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/purchase-orders/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const payload = { ...req.body } as any;
    if (payload.deliveredDate) payload.deliveredDate = new Date(payload.deliveredDate);
    if (payload.paymentDate) payload.paymentDate = new Date(payload.paymentDate);
    const updated = await prisma.purchaseOrder.update({ where: { id }, data: payload });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Vendors ───
router.get('/vendors', authenticate, async (req: Request, res: Response) => {
  try {
    const vendors = await prisma.vendor.findMany({ include: { purchaseOrders: { take: 5, orderBy: { orderDate: 'desc' } } } });
    res.json({ success: true, data: vendors });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/vendors', authenticate, async (req: Request, res: Response) => {
  try {
    const vendor = await prisma.vendor.create({ data: req.body });
    res.json({ success: true, data: vendor });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Payroll ───
router.get('/payroll', authenticate, async (req: Request, res: Response) => {
  try {
    const query = req.query as Record<string, string | undefined>;
    const { month, year } = query;
    const where: any = {};
    if (month) where.month = month;
    if (year) where.year = parseInt(year);

    const records = await prisma.payrollRecord.findMany({ where, orderBy: { employeeName: 'asc' } });
    res.json({ success: true, data: records });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/payroll/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const payload = { ...req.body } as any;
    if (payload.paymentDate) payload.paymentDate = new Date(payload.paymentDate);
    const updated = await prisma.payrollRecord.update({ where: { id }, data: payload });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/payroll/disburse', authenticate, async (req: Request, res: Response) => {
  try {
    const { month, year } = req.body;
    const where: any = { status: { in: ['approved', 'draft'] } };
    if (month) where.month = month;
    if (year) where.year = Number(year);

    const result = await prisma.payrollRecord.updateMany({
      where,
      data: {
        status: 'paid',
        paymentDate: new Date(),
      }
    });

    res.json({ success: true, data: { updatedCount: result.count } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/payroll/process', authenticate, async (req: Request, res: Response) => {
  try {
    const record = await prisma.payrollRecord.create({ data: req.body });
    res.json({ success: true, data: record });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/payroll/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const record = await prisma.payrollRecord.findUnique({ where: { id } });
    res.json({ success: true, data: record });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/reports/generate', authenticate, async (req: Request, res: Response) => {
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
    res.status(500).json({ success: false, message: error.message });
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
    const [paidCount, pendingCount, budgets, journalCount] = await Promise.all([
      prisma.feeRecord.count({ where: { status: 'paid' } }),
      prisma.feeRecord.count({ where: { status: 'pending' } }),
      prisma.budgetAllocation.findMany(),
      prisma.journalEntry.count(),
    ]);

    const utilization = budgets.length > 0
      ? budgets.reduce((sum: number, row: any) => sum + Number(row.utilizationPercentage || 0), 0) / budgets.length
      : 0;

    res.json({
      success: true,
      data: {
        reportsGenerated: journalCount,
        auditObservations: pendingCount,
        pendingAuditResolutions: Math.max(0, Math.round(pendingCount * 0.4)),
        lastAuditPeriod: 'Q4 FY 2025-26',
        complianceScore: `${Math.max(0, Math.min(100, Math.round(utilization)))}%`,
        paidCount,
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Budgets ───
router.get('/budgets', authenticate, async (req: Request, res: Response) => {
  try {
    const budgets = await prisma.budgetAllocation.findMany();
    res.json({ success: true, data: budgets });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/budgets', authenticate, async (req: Request, res: Response) => {
  try {
    const budget = await prisma.budgetAllocation.create({
      data: { ...req.body, availableAmount: req.body.allocatedAmount - (req.body.spentAmount || 0) }
    });
    res.json({ success: true, data: budget });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/budgets/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await prisma.budgetAllocation.update({ where: { id }, data: { ...req.body, lastUpdated: new Date() } });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

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

    const sortedYears = Object.keys(yearBuckets).sort();
    const data = sortedYears.map((year, index) => {
      const amount = yearBuckets[year].count > 0 ? Math.round(yearBuckets[year].total / yearBuckets[year].count) : 0;
      const prev = index > 0
        ? (yearBuckets[sortedYears[index - 1]].count > 0
          ? yearBuckets[sortedYears[index - 1]].total / yearBuckets[sortedYears[index - 1]].count
          : 0)
        : amount;
      const changePercentage = prev > 0 ? Number((((amount - prev) / prev) * 100).toFixed(1)) : 0;
      return { year, amount, changePercentage };
    });

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
