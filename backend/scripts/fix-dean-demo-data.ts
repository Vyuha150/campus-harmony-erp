/**
 * Demo-data repairs found while auditing the Dean's screens (17 Oct 2026).
 *
 *  1. Curriculum proposals created by the seed have no approval behind them,
 *     so the Dean's Approve / Reject could only fail ("No curriculum proposal is
 *     awaiting a decision"). Each pending one is routed into CURRICULUM_PROPOSAL,
 *     as if its HOD had submitted it through the screen.
 *  2. The current academic year was 2025-26 in October 2026. 2026-27 becomes
 *     current; 2025-26 is marked completed.
 *
 * Idempotent. Run: npx tsx scripts/fix-dean-demo-data.ts
 */
import 'dotenv/config';
import { basePrisma } from '../src/lib/prisma.js';
import { runWithTenant } from '../src/lib/tenantStore.js';
import * as workflow from '../src/modules/workflow/workflow.service.js';
import { ensureDefinition } from '../src/modules/workflow/bridge.js';
import { CURRICULUM_PROPOSAL } from '../src/modules/workflow/builtins.js';

const proposals = await basePrisma.curriculumProposal.findMany({
  where: { status: { in: ['pending_dean', 'pending', 'submitted'] } },
  include: { department: true }
});
for (const proposal of proposals) {
  const open = await basePrisma.workflowInstance.findFirst({ where: { entityType: CURRICULUM_PROPOSAL.entityType, entityId: proposal.id, status: 'pending' } });
  if (open) continue;
  const hod = await basePrisma.user.findFirst({ where: { role: 'hod', departmentId: proposal.departmentId } });
  if (!hod) { console.log(`skip ${proposal.title}: department has no HOD`); continue; }
  const ctx = { institutionId: proposal.department.institutionId, campusId: null, scopeLevel: 'institution', userId: hod.id, userName: hod.name, role: 'hod' };
  await runWithTenant(ctx as never, async () => {
    await ensureDefinition(ctx as never, CURRICULUM_PROPOSAL);
    const started = await workflow.startWorkflow(ctx as never, { code: CURRICULUM_PROPOSAL.code, entityType: CURRICULUM_PROPOSAL.entityType, entityId: proposal.id });
    console.log(`routed "${proposal.title}" → ${started.assigneeRole}`);
  });
}

const institutions = await basePrisma.institution.findMany({ select: { id: true } });
for (const { id: institutionId } of institutions) {
  const current = await basePrisma.academicYear.findFirst({ where: { institutionId, year: '2026-27' } });
  if (!current) {
    await basePrisma.academicYear.create({
      data: {
        institutionId, year: '2026-27', startDate: new Date('2026-07-01T00:00:00Z'), endDate: new Date('2027-06-30T00:00:00Z'),
        isCurrent: true, status: 'active', semesters: ['odd', 'even']
      }
    });
    console.log('created academic year 2026-27');
  }
  await basePrisma.academicYear.updateMany({ where: { institutionId, year: { not: '2026-27' }, isCurrent: true }, data: { isCurrent: false, status: 'completed' } });
  await basePrisma.academicYear.updateMany({ where: { institutionId, year: '2026-27' }, data: { isCurrent: true, status: 'active' } });
}
console.log('done');
await basePrisma.$disconnect();
