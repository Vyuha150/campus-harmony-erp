/**
 * The service layer is scoped BY CONSTRUCTION.
 *
 * Run with:  npx tsx scripts/verify/verify-service-scoping.ts
 *
 * WHY THIS EXISTS AS A LIVE CHECK RATHER THAN A UNIT TEST
 *
 * The claim is about what the DATABASE does when a service forgets its tenant
 * filter. No static test can establish that — the Phase 3a failure had a fully
 * green unit suite while a rival institution's exam was being renamed through
 * the API. This needs a real connection and a real row.
 *
 * WHAT IT PROVES
 *
 *   1. `prisma.$transaction` propagates the tenant extension to `tx`;
 *      `basePrisma.$transaction` does not. That asymmetry is the whole basis of
 *      the change to `mutate()`, and it was measured rather than assumed.
 *
 *   2. A service operation that omits `institutionId` from its `where` clause —
 *      exactly the mistake made in `exams.service.ts` — now reads and writes
 *      NOTHING outside the caller's institution.
 */

import { prisma, basePrisma } from '../../src/lib/prisma.js';
import { runWithTenant } from '../../src/lib/tenantStore.js';
import { mutate } from '../../src/lib/service.js';

const DEFAULT = '00000000-0000-4000-8000-000000000001';
const RIVAL = '11111111-1111-4111-8111-111111111111';
const PROBE = 'service-scoping-probe';

let failures = 0;
let checks = 0;
const EXPECTED_CHECKS = 8;

const pass = (m: string) => { console.log(`  PASS  ${m}`); checks++; };
const fail = (m: string) => { console.log(`  FAIL  ${m}`); failures++; checks++; };

async function plantRival() {
  await basePrisma.sportsTeam.deleteMany({ where: { id: PROBE } });
  await basePrisma.sportsTeam.create({
    data: {
      id: PROBE, institutionId: RIVAL, sport: 'Probe', category: 'Probe',
      level: 'university', coach: 'UNTOUCHED', season: '2026', status: 'active'
    }
  });
}

async function main() {
  const ctx = {
    userId: 'seed-user-sports',
    role: 'sports_director',
    institutionId: DEFAULT,
    campusId: null,
    scopeLevel: 'INSTITUTION'
  } as never;

  await plantRival();

  console.log('==============================================');
  console.log(' 1. Which transaction client carries the scope?');
  console.log('==============================================');

  await runWithTenant(ctx, async () => {
    const ext = await prisma.$transaction(async (tx) =>
      tx.sportsTeam.findMany({ where: { id: PROBE } })
    );
    ext.length === 0
      ? pass('prisma.$transaction  -> extension applies, rival invisible')
      : fail(`prisma.$transaction leaked ${ext.length} row(s)`);

    const base = await basePrisma.$transaction(async (tx) =>
      tx.sportsTeam.findMany({ where: { id: PROBE } })
    );
    // NOT a defect — basePrisma is the deliberate escape hatch. Asserted so the
    // asymmetry stays true; if this ever returns 0, the two clients have become
    // the same thing and `runUnscoped()` no longer works.
    base.length === 1
      ? pass('basePrisma.$transaction -> unscoped, as designed (escape hatch intact)')
      : fail(`basePrisma.$transaction returned ${base.length}, expected 1`);
  });

  console.log('');
  console.log('==============================================');
  console.log(' 2. A service that FORGETS the tenant filter');
  console.log('==============================================');

  await runWithTenant(ctx, async () => {
    const written = await mutate(
      ctx,
      { action: 'UPDATE', module: 'probe', resource: `SportsTeam:${PROBE}`, details: 'scoping probe' },
      async (tx) =>
        // No `institutionId` — the Phase 3a mistake, reproduced deliberately.
        (tx as never as typeof prisma).sportsTeam.updateMany({
          where: { id: PROBE },
          data: { coach: 'CROSS-TENANT WRITE' }
        })
    );
    written.count === 0
      ? pass('updateMany without a tenant filter wrote 0 rows')
      : fail(`updateMany wrote ${written.count} row(s) across a tenant boundary`);

    const read = await mutate(
      ctx,
      { action: 'UPDATE', module: 'probe', resource: `SportsTeam:${PROBE}`, details: 'scoping probe' },
      async (tx) =>
        (tx as never as typeof prisma).sportsTeam.findMany({ where: { id: PROBE } })
    );
    read.length === 0
      ? pass('findMany without a tenant filter returned 0 rows')
      : fail(`findMany returned ${read.length} row(s) from another institution`);
  });

  const after = await basePrisma.sportsTeam.findMany({ where: { id: PROBE }, select: { coach: true } });
  after[0]?.coach === 'UNTOUCHED'
    ? pass('the rival row is byte-for-byte unchanged')
    : fail(`the rival row was modified: ${after[0]?.coach}`);

  console.log('');
  console.log('==============================================');
  console.log(' 3. Unique-key WRITES must be refused, not undone');
  console.log('==============================================');

  // THE P0. `update` and `delete` used to run and then have their RESULT
  // checked, so the write had already committed when the extension threw.
  // Live before the fix: DELETE returned "Record was not found" and the row
  // count went 1 -> 0. A destructive cross-tenant write that reports failure is
  // worse than one that reports success, because nothing looks wrong.
  await plantRival();

  await runWithTenant(ctx, async () => {
    try {
      await prisma.sportsTeam.delete({ where: { id: PROBE } });
      fail('delete({ where: { id } }) on another institution SUCCEEDED');
    } catch {
      pass('delete({ where: { id } }) across tenants is refused');
    }

    try {
      await prisma.sportsTeam.update({ where: { id: PROBE }, data: { coach: 'HIJACKED' } });
      fail('update({ where: { id } }) on another institution SUCCEEDED');
    } catch {
      pass('update({ where: { id } }) across tenants is refused');
    }
  });

  const survived = await basePrisma.sportsTeam.findMany({ where: { id: PROBE }, select: { coach: true } });
  survived.length === 1 && survived[0]?.coach === 'UNTOUCHED'
    ? pass('the rival row survived both, unchanged')
    : fail(`the rival row was written or removed: ${JSON.stringify(survived)}`);

  await basePrisma.sportsTeam.deleteMany({ where: { id: PROBE } });
  await basePrisma.$disconnect();

  console.log('');
  console.log('==============================================');
  if (checks !== EXPECTED_CHECKS) {
    console.log(` INCOMPLETE - ${checks} of ${EXPECTED_CHECKS} checks executed. Treat as FAILED.`);
    failures += EXPECTED_CHECKS - checks;
  }
  console.log(failures === 0 ? ` ALL ${checks} CHECKS PASSED` : ` ${failures} CHECK(S) FAILED`);
  console.log('==============================================');
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('PROBE FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
