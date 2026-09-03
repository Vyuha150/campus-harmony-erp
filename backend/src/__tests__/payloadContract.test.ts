/**
 * Frontend write payloads must be accepted by the schema guarding their route.
 *
 * WHY THIS EXISTS
 *
 * `validate({ body })` uses `.strict()` schemas, so an unrecognised key is
 * REFUSED, not ignored. That is the correct behaviour — it is what stops mass
 * assignment — but it means a frontend sending one extra field does not get a
 * partially-applied write: it gets a 400 and the feature does not work at all.
 *
 * That failure mode is invisible from either side alone. The backend looks
 * right (a deliberate, well-commented schema). The frontend looks right (a
 * plausible payload). Nothing in `tsc` connects them, because `postApi`/
 * `putApi` take `any`. Only actually issuing the request reveals it.
 *
 * Roughly twenty-five live features were broken this way at once, across every
 * module: no student could submit an assignment, no HOD could assign a class,
 * no exam cycle could be edited, no alumni event, sports event, inventory item,
 * purchase order, budget, payroll record, system notification or VC meeting
 * could be created, and several approve/reject flows silently failed. Each was
 * found by hand, one screen at a time. This test finds them by construction.
 *
 * WHAT IT CHECKS
 *
 * For every `postApi`/`putApi` call whose payload is an object literal, it
 * resolves the route being called, finds the `.strict()` schema on that route,
 * and asserts every literal key in the payload is accepted by it.
 *
 * WHAT IT DELIBERATELY DOES NOT CHECK
 *
 * Missing REQUIRED fields. A payload can spread (`...toPayload(x)`) or build
 * keys conditionally, so absence here does not imply absence at runtime — that
 * direction would produce false failures. This test only asserts the direction
 * that is always a real bug: a key that is definitely sent and definitely
 * refused. (`POST /finance/purchase-orders` omitting a then-required
 * `poNumber` was found by hand for exactly this reason.)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(here, '..', '..');
const repoRoot = join(backendRoot, '..');

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Brace-match forward from the `{` at or after `from`. Returns its index. */
function matchBrace(src: string, from: number): number {
  const start = src.indexOf('{', from);
  if (start === -1) return -1;
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Top-level `key:` names inside an object-literal body, ignoring anything
 * nested inside braces, parens or brackets.
 */
function topLevelKeys(body: string): string[] {
  const keys: string[] = [];
  let depth = 0;
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (depth === 0 && !trimmed.startsWith('//')) {
      const m = /^(\w+)\s*[:,]/.exec(trimmed);
      if (m && m[1]) keys.push(m[1]);
    }
    for (const ch of line) {
      if (ch === '(' || ch === '{' || ch === '[') depth++;
      else if (ch === ')' || ch === '}' || ch === ']') depth--;
    }
  }
  return keys;
}

interface SchemaInfo {
  keys: Set<string>;
  strict: boolean;
}

function collectSchemas(): Map<string, SchemaInfo> {
  const schemas = new Map<string, SchemaInfo>();
  for (const file of walk(join(backendRoot, 'src', 'modules'))) {
    const src = readFileSync(file, 'utf8');
    const re = /export const (\w+)\s*=\s*(?:nonEmpty\(\s*)?z\s*\r?\n?\s*\.object\(\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const name = m[1]!;
      const objStart = src.indexOf('{', m.index + m[0].length - 1);
      const objEnd = matchBrace(src, objStart);
      if (objEnd === -1) continue;

      // The modifier chain runs from the object's close to the end of the
      // statement. Reading only that — rather than a fixed window — keeps a
      // neighbouring schema's `.strict()` from being attributed to this one.
      const tailEnd = src.indexOf(';', objEnd);
      const tail = src.slice(objEnd, tailEnd === -1 ? objEnd + 200 : tailEnd);

      schemas.set(name, {
        keys: new Set(topLevelKeys(src.slice(objStart + 1, objEnd))),
        strict: /\.strict\(\)/.test(tail)
      });
    }
  }
  return schemas;
}

/** Router file -> the path it is mounted at in server.ts. */
const MOUNTS: Record<string, string> = {
  'students.ts': '/students', 'faculty.ts': '/faculty', 'finance.ts': '/finance',
  'admin.ts': '/admin', 'hod.ts': '/hod', 'dean.ts': '/dean', 'vc.ts': '/vc',
  'registrar.ts': '/registrar', 'coe.ts': '/coe', 'alumni.ts': '/alumni',
  'iqac.ts': '/iqac', 'placements.ts': '/placements', 'sports.ts': '/sports',
  'grievances.ts': '/grievances', 'security.ts': '/security', 'uploads.ts': '/uploads'
};

interface RouteInfo {
  method: string;
  path: string;
  schemaName: string;
}

function collectRoutes(): RouteInfo[] {
  const routes: RouteInfo[] = [];
  for (const file of walk(join(backendRoot, 'src', 'routes'))) {
    const base = file.split(/[\\/]/).pop()!;
    const mount = MOUNTS[base];
    if (!mount) continue;
    const src = readFileSync(file, 'utf8');
    const re =
      /router\.(post|put|patch)\(\s*\r?\n?\s*['"]([^'"]+)['"]([\s\S]{0,400}?)(?:async\s*\(|asyncHandler)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const sm = /validate\(\s*\{[\s\S]*?\bbody:\s*(\w+)/.exec(m[3]!);
      if (sm && sm[1]) {
        routes.push({ method: m[1]!.toUpperCase(), path: mount + m[2]!, schemaName: sm[1] });
      }
    }
  }
  return routes;
}

interface Finding {
  file: string;
  call: string;
  schema: string;
  extra: string[];
}

function findMismatches(): Finding[] {
  const schemas = collectSchemas();
  const routes = collectRoutes();
  const findings: Finding[] = [];

  for (const file of walk(join(repoRoot, 'src'))) {
    const src = readFileSync(file, 'utf8');
    const re = /\b(postApi|putApi)\s*(?:<[^>]*>)?\s*\(\s*(`[^`]*`|'[^']*')\s*,\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      // `${...}` params normalise to `:id` so template literals match routes.
      const path = m[2]!.slice(1, -1).replace(/\$\{[^}]*\}/g, ':id').replace(/\/+$/, '');
      const bodyEnd = matchBrace(src, m.index + m[0].length - 1);
      if (bodyEnd === -1) continue;
      const bodyStart = src.indexOf('{', m.index + m[0].length - 1);
      const keys = topLevelKeys(src.slice(bodyStart + 1, bodyEnd));
      if (!keys.length) continue;

      const method = m[1] === 'postApi' ? 'POST' : 'PUT';
      const route = routes.find(
        (r) =>
          r.method === method &&
          (r.path === path || r.path.replace(/:[A-Za-z]+/g, ':id') === path)
      );
      if (!route) continue;

      const schema = schemas.get(route.schemaName);
      // A non-strict schema accepts unknown keys by design.
      if (!schema || !schema.strict) continue;

      const extra = keys.filter((k) => !schema.keys.has(k));
      if (extra.length) {
        findings.push({
          file: relative(repoRoot, file).replace(/\\/g, '/'),
          call: `${method} ${path}`,
          schema: route.schemaName,
          extra
        });
      }
    }
  }
  return findings;
}

describe('frontend write payloads match their route schemas', () => {
  it('the scanner resolves both sides (guards against silently checking nothing)', () => {
    // If either collector breaks, every assertion below passes vacuously — so
    // assert the corpus is actually populated before trusting an empty result.
    expect(collectSchemas().size).toBeGreaterThan(100);
    expect(collectRoutes().length).toBeGreaterThan(100);
  });

  it('NEGATIVE CONTROL: a strict schema is distinguished from a passthrough one', () => {
    const schemas = collectSchemas();
    // Real examples, both in modules/hod/hod.schemas.ts. `workloadAssignSchema`
    // is deliberately `.passthrough()` and sits directly beside `.strict()`
    // schemas — a fixed-window scan attributes theirs to it and wrongly flags
    // the substitution payload.
    expect(schemas.get('hodApprovalDecisionSchema')?.strict).toBe(true);
    expect(schemas.get('workloadAssignSchema')?.strict).toBe(false);
  });

  it('no frontend payload sends a key its route schema refuses', () => {
    const findings = findMismatches();
    const report = findings
      .map((f) => `  ${f.call} [${f.schema}] — ${f.file}\n    refused keys: ${f.extra.join(', ')}`)
      .join('\n');

    expect(
      findings,
      findings.length === 0
        ? ''
        : `A frontend payload sends keys its route's .strict() schema refuses, so the ` +
            `whole request 400s and that feature does not work at all:\n\n${report}\n\n` +
            `Fix by deciding which side is right — either the field is a real input the ` +
            `schema should accept, or it is server-derived and the frontend should stop ` +
            `sending it. Do not simply loosen the schema: several of these fields were ` +
            `refused deliberately (derived totals, "results published", who approved what).`
    ).toEqual([]);
  });
});
