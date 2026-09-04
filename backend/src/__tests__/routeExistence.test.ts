/**
 * Every frontend API call must hit a route the backend actually registers.
 *
 * WHY THIS EXISTS
 *
 * `apiService` turns a failed request into `console.error('API request
 * failed')` and leaves the component's state at its initial value, so a call
 * to an endpoint that does not exist renders as an empty widget rather than an
 * error. Nothing surfaces it: the screen looks merely unpopulated.
 *
 * The generic dashboard shipped five such calls - /api/dashboard/schedule,
 * /tasks, /announcements and two /charts/* - which 404'd on every load for as
 * long as they existed. They were found by opening the browser console, not by
 * any check. This is that check.
 *
 * It resolves each router's mount prefix from server.ts, collects the concrete
 * paths each router registers, and asserts every fetchApi/postApi/putApi/
 * deleteApi path under `src/` matches one of them.
 *
 * A template `${...}` may expand to a path parameter OR to a query string, so
 * both readings are tried and only a path matching NEITHER is reported. That
 * asymmetry is deliberate: a false failure here would train people to ignore
 * the test.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RE_IMP_ROUTES = new RegExp("import\\s+(\\w+)\\s+from\\s+'\\./routes/([\\w.]+)\\.js'", 'g');
const RE_IMP_MODULES = new RegExp("import\\s+(\\w+)\\s+from\\s+'\\./modules/([\\w/.]+)\\.js'", 'g');
const RE_MOUNT = new RegExp("app\\.use\\(\\s*'(/api/[^']*)'[^;]*?(\\w+)\\s*\\)\\s*;", 'g');
const RE_ROUTE = new RegExp("router\\.(get|post|put|patch|delete)\\(\\s*\\n?\\s*['\"]([^'\"]+)['\"]", 'g');
const RE_CALL_SRC = "\\b(fetchApi|postApi|putApi|deleteApi)\\s*(?:<[^>]*>)?\\s*\\(\\s*(`[^`]*`|'[^']*')";
const RE_TPL = new RegExp('\\$\\{[^}]*\\}', 'g');

const here = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(here, '..', '..');
const repoRoot = join(backendRoot, '..');
const SEP = String.fromCharCode(92);

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

interface Route { method: string; segs: string[] }

function collectRoutes(): Route[] {
  const server = readFileSync(join(backendRoot, 'src', 'server.ts'), 'utf8');
  const importMap = new Map<string, { dir: string; name: string }>();
  for (const m of server.matchAll(RE_IMP_ROUTES)) importMap.set(m[1]!, { dir: 'routes', name: m[2]! + '.ts' });
  for (const m of server.matchAll(RE_IMP_MODULES)) importMap.set(m[1]!, { dir: 'modules', name: m[2]! + '.ts' });

  const routes: Route[] = [];
  for (const m of server.matchAll(RE_MOUNT)) {
    const f = importMap.get(m[2]!);
    if (!f) continue;
    let src: string | null = null;
    for (const c of [join(backendRoot, 'src', f.dir, f.name), join(backendRoot, 'src', f.name)]) {
      try { src = readFileSync(c, 'utf8'); break; } catch { /* try next */ }
    }
    if (!src) continue;
    for (const r of src.matchAll(RE_ROUTE)) {
      let p = m[1]! + r[2]!;
      while (p.endsWith('/')) p = p.slice(0, -1);
      routes.push({ method: r[1]!.toUpperCase(), segs: p.split('/') });
    }
  }
  return routes;
}

function matches(routeSegs: string[], callSegs: string[]): boolean {
  if (routeSegs.length !== callSegs.length) return false;
  return routeSegs.every((seg, i) => seg.startsWith(':') || seg === callSegs[i]);
}

interface Finding { call: string; files: string[] }

function findMissing(): Finding[] {
  const routes = collectRoutes();
  const missing = new Map<string, Set<string>>();

  for (const file of walk(join(repoRoot, 'src'))) {
    const src = readFileSync(file, 'utf8');
    const callRe = new RegExp(RE_CALL_SRC, 'g');
    let m: RegExpExecArray | null;
    while ((m = callRe.exec(src))) {
      const fn = m[1]!;
      const method = fn === 'fetchApi' ? 'GET' : fn === 'postApi' ? 'POST' : fn === 'putApi' ? 'PUT' : 'DELETE';
      const raw = m[2]!.slice(1, -1);
      if (raw.startsWith('http')) continue;

      let hit = false;
      let shown: string | null = null;
      for (let v of [raw.replace(RE_TPL, 'X'), raw.replace(RE_TPL, '')]) {
        const q = v.indexOf('?');
        if (q >= 0) v = v.slice(0, q);
        v = '/api' + v;
        while (v.endsWith('/')) v = v.slice(0, -1);
        if (shown === null) shown = v;
        if (routes.some((r) => r.method === method && matches(r.segs, v.split('/')))) { hit = true; break; }
      }
      if (!hit && shown) {
        const key = method + ' ' + shown;
        if (!missing.has(key)) missing.set(key, new Set());
        missing.get(key)!.add(file.slice(repoRoot.length + 1).split(SEP).join('/'));
      }
    }
  }
  return [...missing].map(([call, files]) => ({ call, files: [...files] }));
}

describe('every frontend API call reaches a real backend route', () => {
  it('the scanner resolves the backend route table', () => {
    // Without this, a broken collector reports an empty diff as success.
    expect(collectRoutes().length).toBeGreaterThan(300);
  });

  it('NEGATIVE CONTROL: a real path resolves and a known-missing one does not', () => {
    const routes = collectRoutes();
    const real = '/api/finance/fee-payments'.split('/');
    const gone = '/api/dashboard/schedule'.split('/');
    expect(routes.some((r) => r.method === 'GET' && matches(r.segs, real))).toBe(true);
    expect(routes.some((r) => r.method === 'GET' && matches(r.segs, gone))).toBe(false);
  });

  it('no frontend call targets an endpoint that does not exist', () => {
    const findings = findMissing();
    const report = findings
      .map((f) => '  ' + f.call + ' -- ' + f.files.join(', '))
      .join('; ');
    expect(
      findings,
      findings.length === 0
        ? ''
        : 'These calls 404 on every load. apiService turns that into a console.error ' +
            'and leaves the component empty, so the screen looks unpopulated rather ' +
            'than broken: ' + report
    ).toEqual([]);
  });
});
