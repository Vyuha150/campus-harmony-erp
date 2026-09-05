
/**
 * Executes the generated test matrix against a running backend.
 *
 * Category: authorization — every endpoint mounted for specific roles must
 * refuse a role outside that list. Safe to run against write endpoints: a
 * correct refusal happens before any handler executes.
 */
import { readFileSync } from 'node:fs';

const BASE = 'http://localhost:5000/api';
const PW = 'DevSeed@Campus2026';

const ACCOUNTS = {
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

async function login(email) {
  // Logins go through the same per-IP API limiter as everything else, so a
  // sweep that has just spent its budget cannot even authenticate. Wait the
  // window out rather than reporting every role as un-loggable.
  for (let attempt = 0; attempt < 8; attempt++) {
    const r = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PW })
    });
    if (r.status === 429) {
      const wait = Number(r.headers.get('retry-after') || '10');
      await new Promise((x) => setTimeout(x, Math.min(wait, 65) * 1000));
      continue;
    }
    const j = await r.json().catch(() => ({}));
    return j.token || null;
  }
  return null;
}

const tokens = {};
for (const [role, email] of Object.entries(ACCOUNTS)) {
  tokens[role] = await login(email);
  if (!tokens[role]) console.log(`  [warn] could not log in ${role} (${email})`);
}

const map = JSON.parse(readFileSync('scripts/audit/connection-map.json', 'utf8'));

// Pick, per endpoint, a role that is NOT permitted by its mount.
function outsiderFor(roles) {
  const permitted = new Set(roles);
  for (const r of Object.keys(tokens)) {
    if (!tokens[r]) continue;
    if (!permitted.has(r)) return r;
  }
  return null;
}

// Replace :params with a value that will never exist, so a 404 from a
// permissive endpoint is distinguishable from a 403.
function concrete(path) {
  return path.replace(/:[A-Za-z]+/g, '00000000-0000-4000-8000-0000000000ff');
}

const results = { pass: 0, fail: 0, skipped: 0, failures: [] };

for (const e of map.endpoints) {
  if (!e.roles.length) { results.skipped++; continue; }   // no mount-level restriction
  const outsider = outsiderFor(e.roles);
  if (!outsider) { results.skipped++; continue; }

  const url = BASE.replace('/api', '') + concrete(e.path);
  let res;
  // The app's own API limiter (300/min) will throttle a sweep of this size.
  // A 429 says nothing about authorization, so wait it out and re-ask rather
  // than recording a verdict the test did not actually establish.
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      res = await fetch(url, {
        method: e.method,
        headers: {
          Authorization: `Bearer ${tokens[outsider]}`,
          'Content-Type': 'application/json'
        },
        ...(e.method === 'GET' || e.method === 'DELETE' ? {} : { body: '{}' })
      });
    } catch {
      res = undefined;
      break;
    }
    if (res.status !== 429) break;
    const wait = Number(res.headers.get('retry-after') || '5');
    await new Promise((r) => setTimeout(r, Math.min(wait, 65) * 1000));
  }
  if (!res || res.status === 429) { results.skipped++; continue; }

  // 403 is the expected refusal. 401 would mean the token was rejected
  // outright, which is also a refusal but points at a token problem.
  if (res.status === 403) results.pass++;
  else {
    results.fail++;
    results.failures.push({ endpoint: `${e.method} ${e.path}`, mounted: e.roles.join('|'), as: outsider, status: res.status });
  }
}

console.log('\n=== authorization sweep ===');
console.log('passed (403) :', results.pass);
console.log('FAILED       :', results.fail);
console.log('skipped      :', results.skipped);
if (results.failures.length) {
  console.log('\nEndpoints reachable by a role outside their mount:');
  const shown = results.failures.slice(0, 40);
  for (const f of shown) {
    console.log(`  [${f.status}] ${f.endpoint}   mounted=${f.mounted}  called-as=${f.as}`);
  }
  if (results.failures.length > shown.length) console.log(`  ... and ${results.failures.length - shown.length} more`);
}
