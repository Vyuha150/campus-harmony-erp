
/**
 * Connection map: which endpoint writes which model, which endpoint reads it,
 * and therefore which write must surface in which read — across roles.
 *
 * Emits JSON for the test-matrix generator.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.argv[2] || process.cwd();
const BE = join(ROOT, 'backend', 'src');

function walk(dir, out = []) {
  let e; try { e = readdirSync(dir); } catch { return out; }
  for (const n of e) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (n.endsWith('.ts') && !p.includes('__tests__')) out.push(p);
  }
  return out;
}

// ---- role mounts ------------------------------------------------------------
const server = readFileSync(join(BE, 'server.ts'), 'utf8');
const impByVar = new Map();
for (const m of server.matchAll(/import\s+(\w+)\s+from\s+'\.\/(routes|modules)\/([\w\/.]+)\.js'/g)) {
  impByVar.set(m[1], { dir: m[2], name: m[3] + '.ts' });
}
const mounts = [];
for (const m of server.matchAll(/app\.use\(\s*'(\/api\/[^']*)'([^;]*?)(\w+)\s*\)\s*;/g)) {
  const f = impByVar.get(m[3]);
  if (!f) continue;
  const roles = [...m[2].matchAll(/'([a-z_]+)'/g)].map((r) => r[1]);
  mounts.push({ prefix: m[1], file: f, roles });
}

// ---- endpoints, with the models they touch ---------------------------------
const WRITE_OPS = ['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany'];
const READ_OPS = ['findMany', 'findFirst', 'findUnique', 'count', 'aggregate', 'groupBy'];

const endpoints = [];
for (const { prefix, file, roles } of mounts) {
  const candidates = [join(BE, file.dir, file.name), join(BE, file.name)];
  let src = null, path = null;
  for (const c of candidates) { try { src = readFileSync(c, 'utf8'); path = c; break; } catch {} }
  if (!src) continue;

  const sigs = [...src.matchAll(/router\.(get|post|put|patch|delete)\(\s*\n?\s*['"]([^'"]+)['"]/g)];
  for (let i = 0; i < sigs.length; i++) {
    const s = sigs[i];
    const start = s.index;
    const end = i + 1 < sigs.length ? sigs[i + 1].index : src.length;
    const body = src.slice(start, end);

    const writes = new Set(), reads = new Set();
    for (const m of body.matchAll(/(?:prisma|db|tx|basePrisma)\.(\w+)\.(\w+)\(/g)) {
      const model = m[1], op = m[2];
      if (model === '$transaction' || model === '$queryRaw') continue;
      if (WRITE_OPS.includes(op)) writes.add(model);
      else if (READ_OPS.includes(op)) reads.add(model);
    }
    // service-layer indirection: note called services so we can flag them
    const services = [...body.matchAll(/(\w+Service)\.(\w+)\(/g)].map((x) => x[1] + '.' + x[2]);

    endpoints.push({
      method: s[1].toUpperCase(),
      path: prefix + s[2],
      file: path.slice(ROOT.length + 1).split(String.fromCharCode(92)).join('/'),
      roles,
      writes: [...writes],
      reads: [...reads],
      services: [...new Set(services)]
    });
  }
}

// ---- service-layer model usage ---------------------------------------------
const serviceModels = {};
for (const f of walk(join(BE, 'modules'))) {
  const src = readFileSync(f, 'utf8');
  const key = f.slice(BE.length + 1).split(String.fromCharCode(92)).join('/');
  const w = new Set(), r = new Set();
  for (const m of src.matchAll(/(?:prisma|db|tx|basePrisma)\.(\w+)\.(\w+)\(/g)) {
    if (WRITE_OPS.includes(m[2])) w.add(m[1]);
    else if (READ_OPS.includes(m[2])) r.add(m[1]);
  }
  serviceModels[key] = { writes: [...w], reads: [...r] };
}

writeFileSync(join(ROOT, 'scripts', 'audit', 'connection-map.json'),
  JSON.stringify({ endpoints, serviceModels }, null, 2));

// ---- summary ---------------------------------------------------------------
const models = new Map();
for (const e of endpoints) {
  for (const m of e.writes) {
    if (!models.has(m)) models.set(m, { writers: [], readers: [] });
    models.get(m).writers.push(e);
  }
  for (const m of e.reads) {
    if (!models.has(m)) models.set(m, { writers: [], readers: [] });
    models.get(m).readers.push(e);
  }
}

const roleOf = (e) => (e.roles.length ? e.roles.join('|') : 'any');
let crossRole = 0, writeOnly = 0, readOnly = 0;
for (const [, v] of models) {
  if (v.writers.length && !v.readers.length) writeOnly++;
  if (!v.writers.length && v.readers.length) readOnly++;
  for (const w of v.writers) for (const r of v.readers) {
    if (roleOf(w) !== roleOf(r)) crossRole++;
  }
}

console.log('endpoints analysed      :', endpoints.length);
console.log('models touched          :', models.size);
console.log('write-only models       :', writeOnly, '(written, never read back)');
console.log('read-only models        :', readOnly, '(read, never written by any endpoint)');
console.log('cross-role write->read  :', crossRole, 'pairs');
