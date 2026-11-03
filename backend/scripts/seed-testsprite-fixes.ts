/**
 * Demo data that the role-wise QA run found missing, so those flows can be
 * exercised instead of showing empty queues:
 *
 *   - pending approval requests for Finance, the HOD and the Dean
 *   - one generated payroll month (October 2026, draft, ready to approve)
 *   - four more mentees for faculty.cse2
 *   - published semester 5 results for aarav.sharma
 *   - a returned library loan (borrowing history) for aarav.sharma
 *   - two bus routes (so a bus pass can be requested) and one upcoming exam paper
 *
 * Everything this script creates has an id starting `tsfix-`, except the
 * payroll rows and workflow instances (generated ids), which are recorded in
 * seed-testsprite-fixes.manifest.json. Nothing that already existed is changed
 * or removed.
 *
 *   npx tsx scripts/seed-testsprite-fixes.ts up       add it (safe to run again)
 *   npx tsx scripts/seed-testsprite-fixes.ts down     remove exactly what `up` added
 *   npx tsx scripts/seed-testsprite-fixes.ts status   show what is present
 */
import 'dotenv/config';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { basePrisma } from '../src/lib/prisma.js';
import { runWithTenant } from '../src/lib/tenantStore.js';
import * as workflow from '../src/modules/workflow/workflow.service.js';
import * as payroll from '../src/modules/finance/payrollService.js';

const P = 'tsfix-';
const MANIFEST = join(dirname(fileURLToPath(import.meta.url)), 'seed-testsprite-fixes.manifest.json');
const PAYROLL_MONTH = 'October';
const PAYROLL_YEAR = 2026;
const db: any = basePrisma;

type Manifest = { payrollIds: string[]; instanceIds: string[]; structureIds: string[] };
const readManifest = (): Manifest =>
  existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { payrollIds: [], instanceIds: [], structureIds: [] };
const writeManifest = (m: Manifest) => writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n');

const institution = await db.institution.findFirst({ select: { id: true } });
if (!institution) throw new Error('No institution found.');
const institutionId: string = institution.id;
const userByEmail = (local: string) => db.user.findFirst({ where: { email: `${local}@campusharmony.edu`, institutionId } });
const ctxFor = (u: any) => ({ institutionId, campusId: null, scopeLevel: 'institution', userId: u.id, userName: u.name, role: u.role }) as never;

async function up() {
  const manifest = readManifest();
  const [aarav, hod, finance, facultyCse2] = await Promise.all(['aarav.sharma', 'hod', 'finance', 'faculty.cse2'].map(userByEmail));
  if (!aarav || !hod || !finance || !facultyCse2) throw new Error('A demo account is missing (aarav.sharma, hod, finance, faculty.cse2).');
  const aaravProfile = await db.studentProfile.findFirst({ where: { userId: aarav.id } });
  const facultyProfile = await db.facultyProfile.findFirst({ where: { userId: facultyCse2.id } });
  const classmates = await db.studentProfile.findMany({
    where: { institutionId, semester: aaravProfile.semester, program: aaravProfile.program, id: { not: aaravProfile.id } },
    include: { user: true },
    orderBy: { rollNumber: 'asc' },
    take: 40
  });

  // ── 1. Pending approvals: Finance, HOD, Dean ────────────────────────────
  const approvals: Array<{ code: string; entityType: string; entityId: string; starter: any; make: () => Promise<unknown> }> = [];
  const requesters = [aaravProfile, ...classmates.slice(0, 1)];
  requesters.forEach((sp: any, i: number) => {
    const user = i === 0 ? aarav : sp.user;
    approvals.push({
      code: 'CERTIFICATE_ISSUE', entityType: 'CertificateRequest', entityId: `${P}cert-${i + 1}`, starter: user,
      make: () => db.certificateRequest.create({ data: { id: `${P}cert-${i + 1}`, institutionId, studentProfileId: sp.id, type: i === 0 ? 'bonafide' : 'transcript', purpose: i === 0 ? 'Bank education loan' : 'Higher studies application', copies: 1, fee: 100, status: 'pending' } })
    });
    approvals.push({
      code: 'STUDENT_LEAVE_OD', entityType: 'StudentLeaveRequest', entityId: `${P}leave-${i + 1}`, starter: user,
      make: () => db.studentLeaveRequest.create({ data: { id: `${P}leave-${i + 1}`, institutionId, studentProfileId: sp.id, type: i === 0 ? 'on_duty' : 'medical', fromDate: new Date(Date.now() - 6 * 864e5), toDate: new Date(Date.now() - 5 * 864e5), reason: i === 0 ? 'Represented the college at an inter-college hackathon.' : 'Viral fever, medical certificate attached.', status: 'pending' } })
    });
  });
  const cse = await db.department.findFirst({ where: { code: 'CSE', institutionId } });
  [['3D printer filament and spares', 'Innovation Lab', 12, 48000], ['Network switches for CN lab', 'Networks Lab', 4, 135000]].forEach(([item, lab, qty, cost], i) => {
    approvals.push({
      code: 'PURCHASE_REQUEST', entityType: 'PurchaseRequest', entityId: `${P}purchase-${i + 1}`, starter: hod,
      make: () => db.purchaseRequest.create({ data: { id: `${P}purchase-${i + 1}`, itemName: item as string, lab: lab as string, requestedBy: hod.name, quantity: qty as number, estimatedCost: cost as number, justification: 'Needed for the coming semester practicals.', status: 'pending', departmentId: cse.id } })
    });
  });
  for (const a of approvals) {
    const exists = await db[a.entityType.charAt(0).toLowerCase() + a.entityType.slice(1)].findFirst({ where: { id: a.entityId } });
    if (!exists) await a.make();
    const open = await db.workflowInstance.findFirst({ where: { entityType: a.entityType, entityId: a.entityId, status: 'pending' } });
    if (open) continue;
    const started = await runWithTenant(ctxFor(a.starter), () => workflow.startWorkflow(ctxFor(a.starter), { code: a.code, entityType: a.entityType, entityId: a.entityId }));
    manifest.instanceIds.push(started.instanceId);
    console.log(`approval ${a.code} → ${started.assigneeRole}`);
  }

  // ── 2. Payroll: one draft month ready to approve ────────────────────────
  if (!(await db.salaryStructure.findFirst({ where: { institutionId, userId: facultyCse2.id } }))) {
    const s = await db.salaryStructure.create({ data: { id: `${P}salary-cse2`, institutionId, userId: facultyCse2.id, employeeId: facultyProfile?.employeeId ?? 'EMP-CSE-1002', basic: 95000, daPercent: 10, hraPercent: 20, otherAllowances: 2000, pfApplicable: true, ptApplicable: true } });
    manifest.structureIds.push(s.id);
  }
  const before = new Set((await db.payrollRecord.findMany({ where: { institutionId, month: PAYROLL_MONTH, year: PAYROLL_YEAR }, select: { id: true } })).map((r: any) => r.id));
  const finCtx = ctxFor(finance);
  const gen = await runWithTenant(finCtx, () => payroll.generate(finCtx, PAYROLL_MONTH, PAYROLL_YEAR));
  const after = await db.payrollRecord.findMany({ where: { institutionId, month: PAYROLL_MONTH, year: PAYROLL_YEAR }, select: { id: true } });
  manifest.payrollIds.push(...after.map((r: any) => r.id).filter((id: string) => !before.has(id)));
  console.log(`payroll ${PAYROLL_MONTH} ${PAYROLL_YEAR}: ${gen.created} drafts created`);

  // ── 3. Mentees for faculty.cse2 ─────────────────────────────────────────
  const already = new Set((await db.menteeAssignment.findMany({ select: { studentId: true } })).map((m: any) => m.studentId));
  let n = 0;
  for (const sp of classmates) {
    if (n >= 4) break;
    if (already.has(sp.id)) continue;
    n++;
    await db.menteeAssignment.upsert({
      where: { id: `${P}mentee-${n}` }, update: {},
      create: { id: `${P}mentee-${n}`, facultyId: facultyProfile.id, studentId: sp.id, lastMeeting: new Date(Date.now() - n * 7 * 864e5) }
    });
  }
  console.log(`mentees: ${n} added`);

  // ── 4. Published semester 5 results for aarav.sharma ────────────────────
  const scale = await db.gradeScale.findFirst({ where: { institutionId, isActive: true }, include: { bands: true } });
  const enrollments = await db.enrollment.findMany({ where: { studentProfileId: aaravProfile.id, semester: 5 }, include: { course: true } });
  if (scale && enrollments.length) {
    const academicYear = '2026-27';
    const external = [78, 72, 81, 69, 75, 84];
    let points = 0, credits = 0, earned = 0, made = 0;
    const gradeFor = (total: number) => scale.bands.find((b: any) => total >= b.minMarks && total <= b.maxMarks) ?? [...scale.bands].sort((a: any, b: any) => a.point - b.point)[0];
    for (const [i, e] of enrollments.entries()) {
      const have = await db.courseResult.findFirst({ where: { studentProfileId: aaravProfile.id, courseId: e.courseId, attempt: 1 } });
      const internal = Math.min(100, Math.round(e.internalMarks ?? 70));
      const ext = external[i % external.length] ?? 75;
      const total = Math.round(0.4 * internal + 0.6 * ext);
      const band = gradeFor(total);
      if (have) { if (have.status === 'published') { points += have.gradePoint * have.credits; credits += have.credits; if (have.isPassing) earned += have.credits; } continue; }
      await db.courseResult.create({ data: { id: `${P}result-${e.course.code.toLowerCase()}`, institutionId, studentProfileId: aaravProfile.id, courseId: e.courseId, semester: 5, academicYear, internalMarks: internal, externalMarks: ext, totalMarks: total, maxMarks: 100, letterGrade: band.letter, gradePoint: band.point, credits: e.course.credits, isPassing: band.isPassing, isExcludedFromGpa: band.isExcludedFromGpa, attempt: 1, status: 'published', publishedAt: new Date(), publishedBy: finance.id } });
      points += band.point * e.course.credits; credits += e.course.credits; if (band.isPassing) earned += e.course.credits; made++;
    }
    const haveSem = await db.semesterResult.findFirst({ where: { studentProfileId: aaravProfile.id, semester: 5 } });
    if (!haveSem && credits > 0) {
      const prior = await db.semesterResult.findMany({ where: { studentProfileId: aaravProfile.id, semester: { lt: 5 } } });
      const sgpa = Math.round((points / credits) * 100) / 100;
      const cumCredits = prior.reduce((a: number, r: any) => a + r.creditsRegistered, 0) + credits;
      const cumPoints = prior.reduce((a: number, r: any) => a + r.cgpa * r.creditsRegistered, 0) + points;
      await db.semesterResult.create({ data: { id: `${P}semester-5`, institutionId, studentProfileId: aaravProfile.id, semester: 5, academicYear, gradeScaleId: scale.id, creditsRegistered: credits, creditsEarned: earned, sgpa, cgpa: Math.round((cumPoints / cumCredits) * 100) / 100, cumulativeCreditsRegistered: cumCredits, cumulativeCreditsEarned: earned + prior.reduce((a: number, r: any) => a + r.creditsEarned, 0), resultStatus: 'pass', status: 'published', publishedAt: new Date(), publishedBy: finance.id } });
    }
    console.log(`results: ${made} course results published`);
  }

  // ── 5. Borrowing history for aarav.sharma ───────────────────────────────
  const book = await db.libraryBook.findFirst({ where: { institutionId } , orderBy: { id: 'desc' } });
  const onLoan = book ? await db.libraryLoan.findFirst({ where: { bookId: book.id, status: 'active' } }) : null;
  if (book && !onLoan && !(await db.libraryLoan.findFirst({ where: { id: `${P}loan-1` } }))) {
    await db.libraryLoan.create({ data: { id: `${P}loan-1`, institutionId, bookId: book.id, studentProfileId: aaravProfile.id, issuedAt: new Date(Date.now() - 40 * 864e5), dueAt: new Date(Date.now() - 26 * 864e5), returnedAt: new Date(Date.now() - 28 * 864e5), status: 'returned', issuedBy: aarav.id, returnedTo: aarav.id } });
    console.log('library: one returned loan added');
  }

  // ── 6. Bus routes, and one upcoming exam paper ──────────────────────────
  if (!(await db.transportRoute.findFirst({ where: { institutionId, active: true } }))) {
    await db.transportRoute.createMany({ data: [
      { id: `${P}route-1`, institutionId, code: 'R1', name: 'Benz Circle – Campus', vehicleNumber: 'AP 39 TX 1201', driverName: 'S. Venkatesh', driverPhone: '9000000011', capacity: 50, stops: [{ name: 'Benz Circle', time: '07:30', fee: 18000 }, { name: 'Governorpet', time: '07:45', fee: 16000 }, { name: 'Autonagar', time: '08:00', fee: 14000 }], active: true },
      { id: `${P}route-2`, institutionId, code: 'R2', name: 'Gannavaram – Campus', vehicleNumber: 'AP 39 TY 2208', driverName: 'P. Ramesh', driverPhone: '9000000022', capacity: 40, stops: [{ name: 'Gannavaram', time: '07:15', fee: 20000 }, { name: 'Nunna', time: '07:40', fee: 15000 }], active: true }
    ] });
    console.log('transport: 2 routes added');
  }
  const session = await db.examSession.findFirst({ where: { institutionId, semester: 5 } });
  const c501 = await db.course.findFirst({ where: { code: 'CSE501', institutionId } });
  if (session && c501 && !(await db.examSchedule.findFirst({ where: { sessionId: session.id, courseId: c501.id } }))) {
    await db.examSchedule.create({ data: { id: `${P}exam-cse501`, institutionId, sessionId: session.id, courseId: c501.id, examDate: new Date(Date.now() + 7 * 864e5), startTime: '10:00', endTime: '13:00', venue: 'Main Examination Hall', maxMarks: 100 } });
    console.log('exam: CSE501 paper added next week');
  }

  writeManifest(manifest);
  console.log('done');
}

async function down() {
  const m = readManifest();
  const byEntity = { in: await db.workflowInstance.findMany({ where: { entityId: { startsWith: P } }, select: { id: true } }).then((r: any[]) => r.map((x) => x.id)) };
  const instanceIds = [...new Set([...m.instanceIds, ...byEntity.in])];
  await db.approvalItem.deleteMany({ where: { workflowInstanceId: { in: instanceIds } } });
  await db.workflowTransition.deleteMany({ where: { instanceId: { in: instanceIds } } });
  await db.workflowInstance.deleteMany({ where: { id: { in: instanceIds } } });
  await db.notificationDelivery.deleteMany({ where: { relatedEntityId: { startsWith: P } } });
  await db.certificateRequest.deleteMany({ where: { id: { startsWith: P } } });
  await db.studentLeaveRequest.deleteMany({ where: { id: { startsWith: P } } });
  await db.purchaseRequest.deleteMany({ where: { id: { startsWith: P } } });
  await db.payrollRecord.deleteMany({ where: { id: { in: m.payrollIds }, status: { in: ['draft', 'approved'] } } });
  await db.salaryStructure.deleteMany({ where: { id: { in: m.structureIds } } });
  await db.menteeAssignment.deleteMany({ where: { id: { startsWith: P } } });
  await db.courseResult.deleteMany({ where: { id: { startsWith: P } } });
  await db.semesterResult.deleteMany({ where: { id: { startsWith: P } } });
  await db.libraryLoan.deleteMany({ where: { id: { startsWith: P } } });
  await db.transportRoute.deleteMany({ where: { id: { startsWith: P } } });
  await db.examSchedule.deleteMany({ where: { id: { startsWith: P } } });
  writeManifest({ payrollIds: [], instanceIds: [], structureIds: [] });
  console.log('removed everything this script added');
}

async function status() {
  const m = readManifest();
  const count = (model: string) => db[model].count({ where: { id: { startsWith: P } } });
  console.log({
    workflowInstances: await db.workflowInstance.count({ where: { id: { in: m.instanceIds } } }),
    payrollRows: await db.payrollRecord.count({ where: { id: { in: m.payrollIds } } }),
    certificateRequests: await count('certificateRequest'), leaves: await count('studentLeaveRequest'), purchases: await count('purchaseRequest'),
    mentees: await count('menteeAssignment'), courseResults: await count('courseResult'), semesterResults: await count('semesterResult'),
    loans: await count('libraryLoan'), routes: await count('transportRoute'), exams: await count('examSchedule')
  });
}

const mode = process.argv[2];
try {
  if (mode === 'up') await up();
  else if (mode === 'down') await down();
  else if (mode === 'status') await status();
  else console.log('usage: tsx scripts/seed-testsprite-fixes.ts up | down | status');
} finally {
  await basePrisma.$disconnect();
}
