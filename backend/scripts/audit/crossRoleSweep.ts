/**
 * Cross-role sweep: does a write by one role surface for another?
 *
 * This is the "faculty enters marks, does the student see them?" question,
 * asked once per write→read pair the connection map found.
 *
 * HOW A CASE IS JUDGED
 *
 * For each pair (endpoint W writes model M, endpoint R reads model M under a
 * different role):
 *   1. read R as the reading role and keep the response  — BEFORE
 *   2. call W as the writing role with a body its own schema has accepted
 *   3. read R again                                       — AFTER
 *
 * The verdict is BEFORE vs AFTER, not the write's own status code, because an
 * endpoint that returns 200 and changes nothing observable is exactly the
 * defect being hunted. A write that genuinely succeeded but produced no
 * visible change on the reader's side is reported as `invisible` and is the
 * interesting outcome — not an error, a finding.
 *
 * WHAT IT REFUSES TO CLAIM
 *
 * A 429 proves nothing, so it waits and re-asks. A write that 4xx's is
 * reported as `write-rejected` and the pair is NOT judged — a failed write
 * cannot demonstrate anything about visibility. Only pairs that actually wrote
 * are scored, so the pass rate means what it says.
 *
 * THE CONTROL, AND WHY IT IS NEEDED
 *
 * Pairing on the Prisma model alone cannot tell three different things apart,
 * and the first run reported all three as "invisible":
 *
 *   - a genuine cross-role break (the reader should see it and does not);
 *   - a write whose columns no reader displays at all — PUT /faculty/profile
 *     writes qualification/specialization/experience while its paired readers
 *     return id/name/email;
 *   - a write that changed nothing, because the generated body re-sent values
 *     already stored (both mentoring ids come from the same seed row).
 *
 * So each write is first checked against a SAME-ROLE reader of the same model.
 * If even that control does not move, the write produced no observable change
 * anywhere, and the cross-role pairs beneath it are not evidence of anything —
 * they are reported as `no-observable-change` instead. Only a write whose
 * control DID move can demonstrate a cross-role break.
 */

import { basePrisma } from '../../src/lib/prisma.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBody, loadSchemas, loadRouteSchemaMap, type SeedIds } from './bodyFactory.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

const BASE = 'http://localhost:5000/api';
const PW = 'DevSeed@Campus2026';

const ACCOUNTS: Record<string, string> = {
  student: 'student@campusharmony.edu',
  faculty: 'faculty@campusharmony.edu',
  hod: 'hod@campusharmony.edu',
  dean: 'dean@campusharmony.edu',
  registrar: 'registrar@campusharmony.edu',
  coe: 'coe@campusharmony.edu',
  finance_officer: 'finance@campusharmony.edu',
  placement_officer: 'placement@campusharmony.edu',
  sports_director: 'sports@campusharmony.edu',
  alumni_officer: 'alumni@campusharmony.edu',
  iqac_coordinator: 'iqac@campusharmony.edu',
  grievance_officer: 'grievance@campusharmony.edu',
  security_officer: 'security@campusharmony.edu',
  librarian: 'librarian@campusharmony.edu',
  vice_chancellor: 'vc@campusharmony.edu',
  super_admin: 'superadmin@campusharmony.edu'
};

async function req(url: string, init: RequestInit, tries = 6): Promise<Response | null> {
  for (let i = 0; i < tries; i++) {
    let r: Response;
    try { r = await fetch(url, init); } catch { return null; }
    if (r.status !== 429) return r;
    const wait = Number(r.headers.get('retry-after') || '10');
    await new Promise((x) => setTimeout(x, Math.min(wait, 65) * 1000));
  }
  return null;
}

const tokens: Record<string, string> = {};
for (const [role, email] of Object.entries(ACCOUNTS)) {
  const r = await req(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PW })
  });
  const j = r ? await r.json().catch(() => ({})) : {};
  if ((j as any).token) tokens[role] = (j as any).token;
}
console.log(`authenticated ${Object.keys(tokens).length} of ${Object.keys(ACCOUNTS).length} roles\n`);

async function seedIds(): Promise<SeedIds> {
  const s: SeedIds = {};
  const put = (k: string, v?: string | null) => { if (v) s[k] = v; };
  const [stu, fac, dept, course, cls, user, comp, drive, vendor, inst, alum] = await Promise.all([
    basePrisma.studentProfile.findFirst({ select: { id: true, userId: true } }),
    basePrisma.facultyProfile.findFirst({ select: { id: true, userId: true } }),
    basePrisma.department.findFirst({ select: { id: true } }),
    basePrisma.course.findFirst({ select: { id: true } }),
    basePrisma.courseClass.findFirst({ select: { id: true } }),
    basePrisma.user.findFirst({ select: { id: true } }),
    basePrisma.company.findFirst({ select: { id: true } }),
    basePrisma.placementDrive.findFirst({ select: { id: true } }),
    basePrisma.vendor.findFirst({ select: { id: true } }),
    basePrisma.institution.findFirst({ select: { id: true } }),
    basePrisma.alumniProfile.findFirst({ select: { id: true } })
  ]);
  put('studentProfileId', stu?.id); put('studentId', stu?.id); put('applicantId', stu?.userId);
  put('facultyProfileId', fac?.id); put('facultyId', fac?.id); put('officerId', fac?.userId);
  put('departmentId', dept?.id); put('courseId', course?.id); put('classId', cls?.id);
  put('userId', user?.id); put('assignedTo', user?.id); put('companyId', comp?.id);
  put('driveId', drive?.id); put('vendorId', vendor?.id); put('institutionId', inst?.id);
  put('alumniProfileId', alum?.id);
  return s;
}

const seeds = await seedIds();
const schemas = await loadSchemas();
const routeSchemas = new Map(
  loadRouteSchemaMap().map((r) => [`${r.method} ${r.path}`, r.schema])
);

const map = JSON.parse(readFileSync(join(repoRoot, 'scripts', 'audit', 'connection-map.json'), 'utf8'));
const endpoints: Array<{ method: string; path: string; roles: string[]; writes: string[]; reads: string[] }> =
  map.endpoints;

const roleOf = (e: { roles: string[] }) => (e.roles.length ? e.roles : ['any']);
function actorFor(e: { roles: string[] }): string | null {
  for (const r of roleOf(e)) if (tokens[r]) return r;
  return e.roles.length === 0 ? 'super_admin' : null;
}

// Only parameterless endpoints: a :id needs a row that exists for that role,
// which is a different problem from the one this sweep is answering.
const writers = endpoints.filter(
  (e) => ['POST', 'PUT', 'PATCH'].includes(e.method) && !e.path.includes(':') && e.writes.length
);
const readers = endpoints.filter((e) => e.method === 'GET' && !e.path.includes(':') && e.reads.length);

interface Verdict { pair: string; model: string; outcome: string; detail?: string }
const results: Verdict[] = [];
const counts: Record<string, number> = {};
const bump = (k: string) => { counts[k] = (counts[k] ?? 0) + 1; };

const readCache = new Map<string, string>();
async function readAs(ep: { method: string; path: string }, role: string): Promise<string | null> {
  const r = await req(BASE.replace('/api', '') + ep.path, {
    headers: { Authorization: `Bearer ${tokens[role]}` }
  });
  if (!r || r.status !== 200) return null;
  return await r.text();
}

let pairIndex = 0;
for (const w of writers) {
  const writerRole = actorFor(w);
  if (!writerRole) continue;

  const schemaName = routeSchemas.get(`${w.method} ${w.path}`);
  const schema = schemaName ? schemas.get(schemaName) : undefined;
  if (!schema) { bump('skipped-no-schema'); continue; }

  const built = buildBody(schema, seeds);
  if (!built.ok) { bump('skipped-no-body'); continue; }

  // Readers of any model this endpoint writes, under a different role.
  const partners = readers.filter(
    (r) => r.reads.some((m) => w.writes.includes(m)) &&
           roleOf(r).join('|') !== roleOf(w).join('|') &&
           actorFor(r)
  );
  if (!partners.length) { bump('no-cross-role-reader'); continue; }

  // The control: a reader of the same model under the WRITER's own role. If
  // this does not move, the write changed nothing anyone can see, and the
  // cross-role pairs below it prove nothing.
  const controls = readers.filter(
    (r) => r.reads.some((m) => w.writes.includes(m)) &&
           roleOf(r).join('|') === roleOf(w).join('|') &&
           actorFor(r)
  );

  const before = new Map<string, string | null>();
  for (const r of [...partners, ...controls]) {
    const role = actorFor(r)!;
    const key = `${r.path}|${role}`;
    if (!before.has(key)) before.set(key, await readAs(r, role));
  }

  const wres = await req(BASE.replace('/api', '') + w.path, {
    method: w.method,
    headers: { Authorization: `Bearer ${tokens[writerRole]}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(built.body)
  });

  if (!wres) { bump('write-unreachable'); continue; }
  if (wres.status >= 400) {
    const text = (await wres.text()).slice(0, 160);
    bump('write-rejected');
    results.push({
      pair: `${w.method} ${w.path}`, model: w.writes.join(','),
      outcome: 'write-rejected', detail: `${wres.status} ${text}`
    });
    continue;
  }

  // Did the write change anything the writer's own role can see?
  let controlMoved: boolean | null = null;
  for (const r of controls) {
    const role = actorFor(r)!;
    const key = `${r.path}|${role}`;
    const b = before.get(key);
    if (b === null || b === undefined) continue;
    const after = await readAs(r, role);
    if (after === null) continue;
    controlMoved = controlMoved === true || after !== b;
  }

  if (controlMoved === false) {
    // Either the body re-sent values already stored, or the columns it writes
    // are returned by no reader. Both are worth knowing and neither is a
    // cross-role break, so the pairs beneath are not scored.
    bump('no-observable-change');
    results.push({
      pair: `${roleOf(w).join('|')} ${w.method} ${w.path}`,
      model: w.writes.join(','),
      outcome: 'no-observable-change',
      detail: `${partners.length} cross-role pair(s) not judged`
    });
    continue;
  }

  for (const r of partners) {
    const role = actorFor(r)!;
    const key = `${r.path}|${role}`;
    const after = await readAs(r, role);
    const pair = `${roleOf(w).join('|')} ${w.method} ${w.path}  ->  ${role} GET ${r.path}`;
    pairIndex++;

    if (after === null) { bump('read-unavailable'); continue; }
    if (before.get(key) === null) { bump('read-unavailable'); continue; }

    if (after !== before.get(key)) { bump('visible'); results.push({ pair, model: r.reads.join(','), outcome: 'visible' }); }
    else if (controlMoved === null) {
      // No same-role reader exists, so there is no control. Report it, but do
      // not call it a break on evidence this thin.
      bump('invisible-unverified');
      results.push({ pair, model: r.reads.join(','), outcome: 'invisible-unverified' });
    }
    else { bump('invisible'); results.push({ pair, model: r.reads.join(','), outcome: 'invisible' }); }
  }
}

console.log('=== cross-role sweep ===');
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(22)} ${v}`);
}
console.log(`\n  cross-role pairs judged: ${counts['visible'] ?? 0} visible, ${counts['invisible'] ?? 0} invisible`);

const rejected = results.filter((r) => r.outcome === 'write-rejected');
if (rejected.length) {
  console.log('\n--- writes the server refused (pair not judged) ---');
  for (const r of rejected.slice(0, 25)) console.log(`  ${r.pair}\n      ${r.detail}`);
  if (rejected.length > 25) console.log(`  ... and ${rejected.length - 25} more`);
}

const noChange = results.filter((r) => r.outcome === 'no-observable-change');
if (noChange.length) {
  console.log('\n--- no observable change even for the writer own role ---');
  console.log('    (body re-sent stored values, or it writes columns nothing returns)');
  for (const r of noChange) console.log(`  ${r.pair}   [${r.model}]  ${r.detail}`);
}

const unverified = results.filter((r) => r.outcome === 'invisible-unverified');
if (unverified.length) {
  console.log('\n--- no same-role reader exists, so no control ---');
  for (const r of unverified.slice(0, 15)) console.log(`  ${r.pair}`);
  if (unverified.length > 15) console.log(`  ... and ${unverified.length - 15} more`);
}

const invisible = results.filter((r) => r.outcome === 'invisible');
if (invisible.length) {
  console.log('\n--- CONTROL MOVED but this reader saw NO change (real candidates) ---');
  for (const r of invisible.slice(0, 40)) console.log(`  ${r.pair}   [${r.model}]`);
  if (invisible.length > 40) console.log(`  ... and ${invisible.length - 40} more`);
}

await basePrisma.$disconnect();
