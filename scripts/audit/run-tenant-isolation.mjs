
/**
 * Category: tenant-isolation.
 *
 * Authenticate as Rival University and call every GET endpoint the role can
 * reach. Any response carrying Default Institution's id, or an id from its
 * seed data, is a cross-tenant leak.
 *
 * The assertion is deliberately crude and broad — substring presence — because
 * a leak is a leak wherever it appears in the payload, including nested
 * includes that a field-by-field check would miss.
 */
import { readFileSync } from 'node:fs';

const BASE = 'http://localhost:5000/api';
const PW = 'DevSeed@Campus2026';
const HOME = '00000000-0000-4000-8000-000000000001';   // Default Institution
const RIVAL = '11111111-1111-4111-8111-111111111111';  // Rival University

const RIVALS = { super_admin: 'admin@rival.edu', hod: 'hod@rival.edu', faculty: 'faculty@rival.edu' };

async function req(url, opts, tries = 6) {
  for (let i = 0; i < tries; i++) {
    let r;
    try { r = await fetch(url, opts); } catch { return null; }
    if (r.status !== 429) return r;
    const w = Number(r.headers.get('retry-after') || '10');
    await new Promise((x) => setTimeout(x, Math.min(w, 65) * 1000));
  }
  return null;
}

async function login(email) {
  const r = await req(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PW })
  });
  if (!r) return null;
  const j = await r.json().catch(() => ({}));
  return j.token || null;
}

const tokens = {};
for (const [role, email] of Object.entries(RIVALS)) tokens[role] = await login(email);

const map = JSON.parse(readFileSync('scripts/audit/connection-map.json', 'utf8'));
const results = { checked: 0, clean: 0, leaks: [], skipped: 0 };

for (const e of map.endpoints) {
  if (e.method !== 'GET') continue;
  if (e.path.includes(':')) { results.skipped++; continue; }   // needs a real id
  const role = Object.keys(tokens).find((r) => tokens[r] && (!e.roles.length || e.roles.includes(r)));
  if (!role) { results.skipped++; continue; }

  const r = await req(BASE.replace('/api', '') + e.path, {
    headers: { Authorization: `Bearer ${tokens[role]}` }
  });
  if (!r || r.status !== 200) { results.skipped++; continue; }

  const text = await r.text();
  results.checked++;

  const hits = [];
  if (text.includes(HOME)) hits.push('home institutionId');
  const seedIds = [...text.matchAll(/"(seed-[A-Za-z0-9-]+)"/g)].map((m) => m[1]);
  if (seedIds.length) hits.push(`seed ids: ${[...new Set(seedIds)].slice(0, 4).join(', ')}`);

  if (hits.length) results.leaks.push({ endpoint: `${e.method} ${e.path}`, as: role, hits });
  else results.clean++;
}

console.log('\n=== tenant isolation sweep (as Rival University) ===');
console.log('endpoints checked :', results.checked);
console.log('clean             :', results.clean);
console.log('LEAKING           :', results.leaks.length);
console.log('skipped           :', results.skipped, '(path params, or role cannot reach)');
for (const l of results.leaks.slice(0, 30)) {
  console.log(`  LEAK ${l.endpoint}  as=${l.as}  -> ${l.hits.join(' | ')}`);
}
if (results.leaks.length > 30) console.log(`  ... and ${results.leaks.length - 30} more`);
