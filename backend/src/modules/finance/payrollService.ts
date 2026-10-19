/**
 * Payroll from salary structures, with the statutory deductions an Indian
 * college applies every month, and Tally export for the accounts office.
 *
 * Deductions (FY 2025-26 onwards, as in force; review each Budget):
 *  - PF (employee share): 12% of basic + DA, on the statutory wage ceiling of
 *    ₹15,000 — i.e. at most ₹1,800 a month — unless the structure opts out.
 *  - Professional tax (Andhra Pradesh): ≤ ₹15,000 nil; ₹15,001–20,000 ₹150;
 *    above ₹20,000 ₹200 a month.
 *  - TDS on salary, new regime (s.115BAC): annual gross less the ₹75,000
 *    standard deduction, slabs 0–4L nil, 4–8L 5%, 8–12L 10%, 12–16L 15%,
 *    16–20L 20%, 20–24L 25%, above 24L 30%; full rebate u/s 87A up to ₹12L
 *    taxable; 4% health & education cess. Spread evenly over 12 months.
 */
import { basePrisma } from '../../lib/prisma.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { notifyInApp } from '../../lib/inAppNotify.js';
import type { TenantContext } from '../../lib/tenant.js';

const PF_WAGE_CEILING = 15000;
const round = (n: number) => Math.round(n * 100) / 100;

export function professionalTax(monthlyGross: number): number {
  if (monthlyGross <= 15000) return 0;
  if (monthlyGross <= 20000) return 150;
  return 200;
}

export function annualTaxNewRegime(annualGross: number): number {
  const taxable = Math.max(0, annualGross - 75000);
  if (taxable <= 1200000) return 0; // s.87A rebate
  const slabs: Array<[number, number]> = [[400000, 0], [800000, 0.05], [1200000, 0.1], [1600000, 0.15], [2000000, 0.2], [2400000, 0.25], [Infinity, 0.3]];
  let tax = 0, lower = 0;
  for (const [upper, rate] of slabs) {
    if (taxable > lower) tax += (Math.min(taxable, upper) - lower) * rate;
    lower = upper;
  }
  return round(tax * 1.04);
}

export interface StructureInput {
  employeeId: string; basic: number; daPercent: number; hraPercent: number; otherAllowances: number;
  pfApplicable: boolean; ptApplicable: boolean; bankAccount?: string | undefined; ifsc?: string | undefined; pan?: string | undefined;
}

/** The month's figures for one structure. */
export function computeSalary(s: { basic: number; daPercent: number; hraPercent: number; otherAllowances: number; pfApplicable: boolean; ptApplicable: boolean }) {
  const da = round((s.basic * s.daPercent) / 100);
  const hra = round((s.basic * s.hraPercent) / 100);
  const gross = round(s.basic + da + hra + s.otherAllowances);
  const pf = s.pfApplicable ? round(Math.min(s.basic + da, PF_WAGE_CEILING) * 0.12) : 0;
  const pt = s.ptApplicable ? professionalTax(gross) : 0;
  const tds = round(annualTaxNewRegime(gross * 12) / 12);
  const allowances = [
    { name: 'Dearness Allowance', amount: da },
    { name: 'House Rent Allowance', amount: hra },
    ...(s.otherAllowances ? [{ name: 'Other allowances', amount: s.otherAllowances }] : [])
  ].filter((a) => a.amount > 0);
  const deductions = [
    { name: 'Provident Fund (12%)', amount: pf },
    { name: 'Professional Tax', amount: pt },
    { name: 'Income Tax (TDS)', amount: tds }
  ].filter((d) => d.amount > 0);
  return { gross, net: round(gross - pf - pt - tds), allowances, deductions };
}

const STAFF = ['faculty', 'hod', 'dean', 'registrar', 'coe', 'finance_officer', 'principal', 'vice_chancellor', 'pro_vc', 'librarian', 'placement_officer', 'sports_director', 'alumni_officer', 'iqac_coordinator', 'grievance_officer', 'security_officer', 'auditor'];

export async function structures(ctx: TenantContext) {
  const [staff, rows] = await Promise.all([
    basePrisma.user.findMany({ where: { institutionId: ctx.institutionId, role: { in: STAFF } }, include: { department: { select: { code: true } }, facultyProfile: { select: { employeeId: true } } }, orderBy: { name: 'asc' } }),
    basePrisma.salaryStructure.findMany({ where: { institutionId: ctx.institutionId } })
  ]);
  const byUser = new Map(rows.map((r) => [r.userId, r]));
  return staff.map((u) => {
    const s = byUser.get(u.id) ?? null;
    return {
      userId: u.id, name: u.name, role: u.role, designation: u.designation, department: u.department?.code ?? null,
      employeeId: s?.employeeId ?? u.facultyProfile?.employeeId ?? null,
      structure: s, monthly: s ? computeSalary(s) : null
    };
  });
}

export async function saveStructure(ctx: TenantContext, userId: string, input: StructureInput) {
  const user = await basePrisma.user.findFirst({ where: { id: userId, institutionId: ctx.institutionId, role: { in: STAFF } } });
  if (!user) throw new NotFoundError('Staff member');
  const data = { employeeId: input.employeeId, basic: input.basic, daPercent: input.daPercent, hraPercent: input.hraPercent, otherAllowances: input.otherAllowances, pfApplicable: input.pfApplicable, ptApplicable: input.ptApplicable, bankAccount: input.bankAccount ?? null, ifsc: input.ifsc ?? null, pan: input.pan ?? null };
  const existing = await basePrisma.salaryStructure.findFirst({ where: { institutionId: ctx.institutionId, userId } });
  if (existing) await basePrisma.salaryStructure.updateMany({ where: { id: existing.id, institutionId: ctx.institutionId }, data });
  else await basePrisma.salaryStructure.create({ data: { ...data, institutionId: ctx.institutionId, userId } });
  return { ...data, userId, monthly: computeSalary(data) };
}

/** Draft payroll for every staff member with a structure; existing rows for the month are left alone. */
export async function generate(ctx: TenantContext, month: string, year: number) {
  const rows = await basePrisma.salaryStructure.findMany({ where: { institutionId: ctx.institutionId } });
  if (!rows.length) throw new ValidationError('No salary structures yet. Set them up under Payroll → Salary structures.');
  const users = await basePrisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) }, institutionId: ctx.institutionId }, include: { department: { select: { name: true } } } });
  const byId = new Map(users.map((u) => [u.id, u]));
  const existing = new Set((await basePrisma.payrollRecord.findMany({ where: { institutionId: ctx.institutionId, month, year, userId: { in: rows.map((r) => r.userId) } }, select: { userId: true } })).map((r) => r.userId));
  let created = 0;
  for (const s of rows) {
    if (existing.has(s.userId)) continue;
    const u = byId.get(s.userId);
    if (!u) continue;
    const c = computeSalary(s);
    await basePrisma.payrollRecord.create({
      data: {
        institutionId: ctx.institutionId, userId: s.userId, employeeId: s.employeeId, employeeName: u.name, department: u.department?.name ?? '—', designation: u.designation ?? u.role,
        month, year, basicSalary: s.basic, allowances: c.allowances as never, deductions: c.deductions as never, grossSalary: c.gross, netSalary: c.net,
        status: 'draft', paymentMethod: 'bank_transfer'
      }
    });
    created++;
  }
  return { created, alreadyThere: existing.size };
}

export async function approveMonth(ctx: TenantContext, month: string, year: number) {
  const r = await basePrisma.payrollRecord.updateMany({ where: { institutionId: ctx.institutionId, month, year, status: 'draft' }, data: { status: 'approved' } });
  if (!r.count) throw new ValidationError(`No draft payroll for ${month} ${year}.`);
  return { approved: r.count };
}

/** Tell each paid staff member their payslip is ready. Called after disbursement. */
export async function announcePayslips(ctx: TenantContext, month: string, year: number) {
  const paid = await basePrisma.payrollRecord.findMany({ where: { institutionId: ctx.institutionId, month, year, status: 'paid', userId: { not: null } }, select: { userId: true } });
  const ids = paid.map((p) => p.userId).filter((x): x is string => !!x);
  if (ids.length) await notifyInApp(ctx.institutionId, { userIds: ids }, {
    eventType: 'payroll.paid', subject: `Salary credited — payslip for ${month} ${year}`, body: 'Download it from your Payslips.', relatedEntityType: 'PayrollRecord', relatedEntityId: `${month}-${year}`
  });
}

export async function myPayslips(ctx: TenantContext, userId: string) {
  return basePrisma.payrollRecord.findMany({ where: { institutionId: ctx.institutionId, userId, status: 'paid' }, orderBy: [{ year: 'desc' }, { paymentDate: 'desc' }] });
}

export async function payslip(ctx: TenantContext, id: string, userId: string | null) {
  const p = await basePrisma.payrollRecord.findFirst({ where: { id, institutionId: ctx.institutionId, ...(userId ? { userId } : {}) } });
  if (!p) throw new NotFoundError('Payslip');
  const [s, institution] = await Promise.all([
    p.userId ? basePrisma.salaryStructure.findFirst({ where: { institutionId: ctx.institutionId, userId: p.userId } }) : null,
    basePrisma.institution.findFirst({ where: { id: ctx.institutionId } })
  ]);
  const mask = (v?: string | null) => (v ? `XXXX${v.slice(-4)}` : null);
  return {
    ...p, institution: { name: institution?.name, address: [institution?.addressLine, institution?.city, institution?.state].filter(Boolean).join(', ') },
    bankAccount: mask(s?.bankAccount), ifsc: s?.ifsc ?? null, pan: s?.pan ? `${s.pan.slice(0, 2)}XXXXX${s.pan.slice(-3)}` : null
  };
}

// ─── Tally export ───────────────────────────────────────────────────────────

const xml = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const tallyDate = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');

/**
 * Tally Prime / ERP 9 import file (XML "Import Data → Vouchers") for a period:
 * fee collections as Receipt vouchers (Bank Dr / Fee income Cr), journal
 * entries as Journal vouchers, salary payments as Payment vouchers.
 * Ledger names must exist in Tally (or be created) with the same names.
 */
export async function tallyExport(ctx: TenantContext, from: Date, to: Date) {
  const [fees, journals, salaries] = await Promise.all([
    basePrisma.feeRecord.findMany({ where: { institutionId: ctx.institutionId, status: 'paid', paidDate: { gte: from, lte: to } }, include: { student: { select: { rollNumber: true } } } }),
    basePrisma.journalEntry.findMany({ where: { institutionId: ctx.institutionId, status: 'posted', date: { gte: from, lte: to } } }),
    basePrisma.payrollRecord.findMany({ where: { institutionId: ctx.institutionId, status: 'paid', paymentDate: { gte: from, lte: to } } })
  ]);
  const voucher = (type: string, date: Date, number: string, narration: string, entries: Array<{ ledger: string; amount: number }>) => `
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <VOUCHER VCHTYPE="${type}" ACTION="Create">
     <DATE>${tallyDate(date)}</DATE>
     <VOUCHERTYPENAME>${type}</VOUCHERTYPENAME>
     <VOUCHERNUMBER>${xml(number)}</VOUCHERNUMBER>
     <NARRATION>${xml(narration)}</NARRATION>${entries.map((e) => `
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${xml(e.ledger)}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>${e.amount < 0 ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
      <AMOUNT>${e.amount.toFixed(2)}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>`).join('')}
    </VOUCHER>
   </TALLYMESSAGE>`;
  const parts: string[] = [];
  for (const f of fees) {
    const amt = f.paidAmount || f.amount;
    const income = f.type === 'hostel' ? 'Hostel Fee Income' : f.type === 'transport' ? 'Transport Fee Income' : f.type === 'exam' ? 'Examination Fee Income' : 'Tuition Fee Income';
    parts.push(voucher('Receipt', f.paidDate ?? f.dueDate, f.transactionId ?? f.id.slice(0, 8), `${f.description} — ${f.student?.rollNumber ?? ''}`, [{ ledger: 'Bank Account', amount: -amt }, { ledger: income, amount: amt }]));
  }
  for (const j of journals) {
    const accounts = (Array.isArray(j.accounts) ? j.accounts : []) as Array<{ accountName?: string; debitAmount?: number; creditAmount?: number }>;
    parts.push(voucher('Journal', j.date, j.entryNumber, j.description, accounts.map((a) => ({ ledger: a.accountName ?? 'Suspense', amount: Number(a.debitAmount ?? 0) > 0 ? -Number(a.debitAmount) : Number(a.creditAmount ?? 0) }))));
  }
  for (const p of salaries) {
    parts.push(voucher('Payment', p.paymentDate ?? new Date(), `SAL-${p.month.slice(0, 3)}${p.year}-${p.employeeId}`, `Salary ${p.month} ${p.year} — ${p.employeeName}`, [{ ledger: 'Salaries', amount: -p.netSalary }, { ledger: 'Bank Account', amount: p.netSalary }]));
  }
  const company = (await basePrisma.institution.findFirst({ where: { id: ctx.institutionId } }))?.name ?? 'Institution';
  const body = `<ENVELOPE>
 <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${xml(company)}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC>
   <REQUESTDATA>${parts.join('')}
   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>
`;
  return { xml: body, counts: { receipts: fees.length, journals: journals.length, payments: salaries.length } };
}
