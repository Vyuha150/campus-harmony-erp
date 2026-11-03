/**
 * Demo data for re-testing the Finance Officer role, so its workflows have
 * something to act on:
 *
 *   - 6 certificate requests waiting in Finance's approval queue (no-dues step)
 *   - salary structures for 8 more staff, and a November 2026 payroll with
 *     3 draft rows (to approve) and 3 approved rows (bank file, disburse);
 *     2 of the new staff have no November row, so "Generate" creates drafts
 *   - 1 vendor and 4 purchase orders: one invoiced (awaiting payment), two
 *     delivered awaiting an invoice, one approved awaiting delivery
 *
 * Everything has an id starting `tsfin-`, except workflow instances, which are
 * recorded in seed-testsprite-finance.manifest.json. Nothing that already
 * existed is changed.
 *
 *   npx tsx scripts/seed-testsprite-finance.ts up       add it (safe to run again)
 *   npx tsx scripts/seed-testsprite-finance.ts down     remove what `up` added
 *   npx tsx scripts/seed-testsprite-finance.ts status   show what is present
 */
import 'dotenv/config';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { basePrisma } from '../src/lib/prisma.js';
import { runWithTenant } from '../src/lib/tenantStore.js';
import * as workflow from '../src/modules/workflow/workflow.service.js';
import { computeSalary } from '../src/modules/finance/payrollService.js';

const P = 'tsfin-';
const MANIFEST = join(dirname(fileURLToPath(import.meta.url)), 'seed-testsprite-finance.manifest.json');
const MONTH = 'November';
const YEAR = 2026;
const db: any = basePrisma;

type Manifest = { instanceIds: string[] };
const readManifest = (): Manifest => (existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { instanceIds: [] });
const writeManifest = (m: Manifest) => writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n');

const institution = await db.institution.findFirst({ select: { id: true } });
if (!institution) throw new Error('No institution found.');
const institutionId: string = institution.id;
const ctxFor = (u: any) => ({ institutionId, campusId: null, scopeLevel: 'institution', userId: u.id, userName: u.name, role: u.role }) as never;
const days = (n: number) => new Date(Date.now() + n * 864e5);

// Staff who get a salary structure. The first 6 get a November row: 3 draft, 3 approved.
const STAFF = [
  ['faculty.cse3', 72000], ['faculty.cse4', 68000], ['faculty.ece1', 70000], ['faculty.ece2', 66000],
  ['hod.ece', 115000], ['librarian', 58000], ['hod.it', 112000], ['faculty.it1', 64000]
] as const;

async function up() {
  const manifest = readManifest();

  // ── 1. Certificate requests in Finance's queue ──────────────────────────
  const students = await db.studentProfile.findMany({ where: { institutionId }, include: { user: true }, orderBy: { rollNumber: 'asc' }, take: 12 });
  const certs = [
    ['bonafide', 'Passport application'], ['transcript', 'MS admission abroad'], ['bonafide', 'Education loan from SBI'],
    ['migration', 'Transfer to another university'], ['bonafide', 'Scholarship renewal'], ['transcript', 'Job application at TCS']
  ];
  let made = 0;
  for (const [i, [type, purpose]] of certs.entries()) {
    const sp = students[i + 2] ?? students[i % students.length];
    const id = `${P}cert-${i + 1}`;
    if (!(await db.certificateRequest.findFirst({ where: { id } }))) {
      await db.certificateRequest.create({ data: { id, institutionId, studentProfileId: sp.id, type, purpose, copies: 1 + (i % 2), fee: type === 'transcript' ? 500 : 100, status: 'pending', requestedAt: days(-(i + 1)) } });
    }
    if (await db.workflowInstance.findFirst({ where: { entityType: 'CertificateRequest', entityId: id, status: 'pending' } })) continue;
    const started = await runWithTenant(ctxFor(sp.user), () => workflow.startWorkflow(ctxFor(sp.user), { code: 'CERTIFICATE_ISSUE', entityType: 'CertificateRequest', entityId: id }));
    manifest.instanceIds.push(started.instanceId);
    made++;
  }
  writeManifest(manifest);
  console.log(`certificates: ${made} sent to ${'finance_officer'}`);

  // ── 2. Salary structures and November payroll ───────────────────────────
  let structures = 0, rows = 0;
  for (const [i, [local, basic]] of STAFF.entries()) {
    const u = await db.user.findFirst({ where: { email: `${local}@campusharmony.edu`, institutionId }, include: { department: { select: { name: true } }, facultyProfile: { select: { employeeId: true } } } });
    if (!u) { console.log(`skip ${local}: no such user`); continue; }
    let s = await db.salaryStructure.findFirst({ where: { institutionId, userId: u.id } });
    if (!s) {
      s = await db.salaryStructure.create({ data: {
        id: `${P}salary-${i + 1}`, institutionId, userId: u.id, employeeId: u.facultyProfile?.employeeId ?? `EMP-TS-${101 + i}`,
        basic, daPercent: 12, hraPercent: 18, otherAllowances: 2500, pfApplicable: true, ptApplicable: true,
        bankAccount: `5010023456${String(70 + i).padStart(2, '0')}`, ifsc: 'HDFC0001234', pan: `ABCPT${1200 + i}K`
      } });
      structures++;
    }
    if (i >= 6) continue;
    const id = `${P}pay-${i + 1}`;
    if (await db.payrollRecord.findFirst({ where: { OR: [{ id }, { institutionId, userId: u.id, month: MONTH, year: YEAR }] } })) continue;
    const c = computeSalary(s);
    await db.payrollRecord.create({ data: {
      id, institutionId, userId: u.id, employeeId: s.employeeId, employeeName: u.name, department: u.department?.name ?? '—', designation: u.designation ?? u.role,
      month: MONTH, year: YEAR, basicSalary: s.basic, allowances: c.allowances, deductions: c.deductions, grossSalary: c.gross, netSalary: c.net,
      status: i < 3 ? 'draft' : 'approved', paymentMethod: 'bank_transfer'
    } });
    rows++;
  }
  console.log(`payroll: ${structures} salary structures, ${rows} ${MONTH} ${YEAR} rows (3 draft, 3 approved)`);

  // ── 3. Vendor and purchase orders for the invoices tab ──────────────────
  if (!(await db.vendor.findFirst({ where: { id: `${P}vendor-1` } }))) {
    await db.vendor.create({ data: { id: `${P}vendor-1`, institutionId, name: 'Sri Lakshmi Lab Equipments', contactPerson: 'K. Srinivas', email: 'sales@srilakshmilab.example', phone: '9000054321', address: '4-21 Auto Nagar, Vijayawada', gstNumber: '37ABCFS1234K1Z2', panNumber: 'ABCFS1234K', paymentTerms: 'Net 30', status: 'active' } });
  }
  const finance = await db.user.findFirst({ where: { email: 'finance@campusharmony.edu', institutionId } });
  const orders = [
    { n: 1, dept: 'ECE', vendor: `${P}vendor-1`, item: 'Digital storage oscilloscopes', qty: 4, price: 38500, status: 'delivered', delivered: -6, invoice: 'SLE/INV/2026/0412' },
    { n: 2, dept: 'CSE', vendor: 'seed-vendor-1', item: 'Wireless keyboards and mice', qty: 30, price: 1450, status: 'delivered', delivered: -3, invoice: null },
    { n: 3, dept: 'MECH', vendor: `${P}vendor-1`, item: 'Vernier calipers set', qty: 20, price: 2200, status: 'delivered', delivered: -1, invoice: null },
    { n: 4, dept: 'Library', vendor: 'seed-vendor-1', item: 'Barcode scanners', qty: 6, price: 4800, status: 'approved', delivered: null, invoice: null }
  ];
  let pos = 0;
  for (const o of orders) {
    const id = `${P}po-${o.n}`;
    if (await db.purchaseOrder.findFirst({ where: { id } })) continue;
    const total = o.qty * o.price;
    await db.purchaseOrder.create({ data: {
      id, institutionId, poNumber: `PO-2026-TS0${o.n}`, department: o.dept, vendorId: o.vendor,
      orderDate: days(-20 + o.n), expectedDelivery: days(o.delivered ?? 10), totalAmount: total, status: o.status,
      items: [{ id: `${id}-item`, description: o.item, quantity: o.qty, unitPrice: o.price, totalPrice: total }],
      approvedBy: finance?.id ?? null, deliveredDate: o.delivered == null ? null : days(o.delivered), invoiceNumber: o.invoice, paymentDate: null
    } });
    pos++;
  }
  console.log(`procurement: ${pos} purchase orders`);
  console.log('done');
}

async function down() {
  const m = readManifest();
  const byEntity = (await db.workflowInstance.findMany({ where: { entityId: { startsWith: P } }, select: { id: true } })).map((x: any) => x.id);
  const instanceIds = [...new Set([...m.instanceIds, ...byEntity])];
  await db.approvalItem.deleteMany({ where: { workflowInstanceId: { in: instanceIds } } });
  await db.workflowTransition.deleteMany({ where: { instanceId: { in: instanceIds } } });
  await db.workflowInstance.deleteMany({ where: { id: { in: instanceIds } } });
  await db.notificationDelivery.deleteMany({ where: { relatedEntityId: { startsWith: P } } });
  await db.certificateRequest.deleteMany({ where: { id: { startsWith: P } } });
  // Payroll rows for the seeded staff, including drafts "Generate" made from these structures.
  const seeded = (await db.salaryStructure.findMany({ where: { id: { startsWith: P } }, select: { userId: true } })).map((s: any) => s.userId);
  await db.payrollRecord.deleteMany({ where: { OR: [{ id: { startsWith: P } }, { institutionId, userId: { in: seeded }, month: MONTH, year: YEAR }] } });
  await db.salaryStructure.deleteMany({ where: { id: { startsWith: P } } });
  await db.purchaseOrder.deleteMany({ where: { id: { startsWith: P } } });
  await db.vendor.deleteMany({ where: { id: { startsWith: P }, purchaseOrders: { none: {} } } });
  writeManifest({ instanceIds: [] });
  console.log('removed everything this script added');
}

async function status() {
  const count = (model: string, extra = {}) => db[model].count({ where: { id: { startsWith: P }, ...extra } });
  const finQueue = await db.workflowInstance.count({ where: { entityId: { startsWith: P }, status: 'pending' } });
  console.log({
    certificatesPending: await count('certificateRequest', { status: 'pending' }), openWorkflows: finQueue,
    salaryStructures: await count('salaryStructure'),
    payroll: await db.payrollRecord.groupBy({ by: ['status'], _count: true, where: { institutionId, month: MONTH, year: YEAR } }),
    purchaseOrders: await count('purchaseOrder'), vendors: await count('vendor')
  });
}

const mode = process.argv[2];
try {
  if (mode === 'up') await up();
  else if (mode === 'down') await down();
  else if (mode === 'status') await status();
  else console.log('usage: tsx scripts/seed-testsprite-finance.ts up | down | status');
} finally {
  await basePrisma.$disconnect();
}
