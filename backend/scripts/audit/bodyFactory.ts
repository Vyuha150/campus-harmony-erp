/**
 * Builds a VALID request body for every validated write endpoint.
 *
 * WHY IT WORKS THIS WAY
 *
 * A generator that guesses at bodies produces a sweep whose failures are
 * indistinguishable from its own bugs: an endpoint returning 400 might be
 * broken, or the body might simply have been wrong. So nothing is guessed and
 * hoped for — every candidate body is checked against the REAL Zod schema with
 * `safeParse` before it is ever sent, and a body that will not parse is
 * reported as un-generatable rather than fired at the server. A request that
 * leaves this file is one the route's own validator has already accepted.
 *
 * The schema objects are imported, not parsed out of the source. Reading
 * `.strict()` and enum members with regexes was the alternative and it drifts
 * silently; importing cannot drift, because it is the same object the route
 * uses at runtime.
 *
 * `z.toJSONSchema` gives the shape. Two things it cannot express, both handled
 * by the repair loop below rather than by pretending they do not exist:
 *   - `z.coerce.date()` erases to `{}`, carrying no type at all;
 *   - `.refine()` predicates are invisible (this codebase uses them for
 *     "at least one field", ISO-date parseability, and start <= end).
 * The repair loop reads the actual ZodError and fixes what it names, which
 * covers both without needing to model them.
 */

import { z } from 'zod';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(here, '..', '..');
const srcRoot = join(backendRoot, 'src');

export interface SeedIds {
  [key: string]: string;
}

/** Realistic values by field name. Names are the strongest signal available. */
function seedValueFor(field: string, seeds: SeedIds): unknown | undefined {
  const f = field.toLowerCase();

  if (f === 'email' || f.endsWith('email')) return 'sweep.probe@campusharmony.edu';
  if (f === 'password') return 'SweepProbe@2026';
  if (f.endsWith('url') || f === 'website') return 'https://example.com/sweep-probe.pdf';
  if (f === 'phone' || f.endsWith('phone') || f === 'contactnumber') return '9876543210';
  if (f === 'reason') return 'Automated cross-role sweep probe, safe to remove.';
  if (f === 'year' || f === 'academicyear') return '2025-26';
  if (f === 'budgetyear') return '2025-26';

  // Ids: prefer a real seeded row so foreign keys resolve.
  if (f.endsWith('id')) {
    const direct = seeds[field];
    if (direct) return direct;
    for (const [k, v] of Object.entries(seeds)) {
      if (k.toLowerCase() === f) return v;
    }
  }
  return undefined;
}

function isDateField(field: string): boolean {
  const f = field.toLowerCase();
  return f.endsWith('date') || f.endsWith('at') || f.endsWith('time') || f === 'dob';
}

/** Generate a candidate value from a JSON Schema node. */
function fromJsonSchema(node: any, field: string, seeds: SeedIds, depth = 0): unknown {
  if (depth > 6) return null;

  const seeded = seedValueFor(field, seeds);
  if (seeded !== undefined && (node?.type === 'string' || node?.type === undefined)) return seeded;

  // `anyOf` — take the first branch that is not null.
  if (Array.isArray(node?.anyOf)) {
    const branch = node.anyOf.find((b: any) => b?.type !== 'null') ?? node.anyOf[0];
    return fromJsonSchema(branch, field, seeds, depth + 1);
  }
  if (Array.isArray(node?.oneOf)) return fromJsonSchema(node.oneOf[0], field, seeds, depth + 1);

  if (Array.isArray(node?.enum) && node.enum.length) return node.enum[0];
  if (node?.const !== undefined) return node.const;

  switch (node?.type) {
    case 'string': {
      if (node.format === 'email') return 'sweep.probe@campusharmony.edu';
      if (isDateField(field)) return new Date(Date.now() + 86_400_000).toISOString();
      const min = Number(node.minLength ?? 1);
      const max = Number(node.maxLength ?? 64);
      // Long enough for a `min(10)` reason, short enough for a `max(20)` code.
      let s = `SweepProbe ${field}`;
      while (s.length < min) s += 'x';
      if (s.length > max) s = s.slice(0, Math.max(min, Math.min(max, s.length)));
      return s;
    }
    case 'integer':
    case 'number': {
      const min = node.minimum ?? node.exclusiveMinimum ?? 1;
      const max = node.maximum ?? node.exclusiveMaximum ?? min + 1;
      const v = Math.min(Math.max(1, Number(min)), Number(max));
      return node.type === 'integer' ? Math.round(v) : v;
    }
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object': {
      const out: Record<string, unknown> = {};
      for (const [k, sub] of Object.entries(node.properties ?? {})) {
        if ((node.required ?? []).includes(k)) out[k] = fromJsonSchema(sub, k, seeds, depth + 1);
      }
      return out;
    }
    case 'null':
      return null;
    default:
      // No type at all — `z.coerce.date()` erases to `{}`. A date-shaped name
      // is the only evidence left, and an ISO string satisfies both a date
      // coercion and most free strings.
      if (isDateField(field)) return new Date(Date.now() + 86_400_000).toISOString();
      return seeded ?? `SweepProbe ${field}`;
  }
}

/**
 * Build a body, then make the schema itself prove it. Each round reads the
 * ZodError and fixes exactly what it names — which is how `.refine()` and
 * `z.coerce.date()`, both invisible in JSON Schema, get satisfied without
 * being modelled.
 */
export function buildBody(
  schema: z.ZodType,
  seeds: SeedIds
): { ok: true; body: Record<string, unknown> } | { ok: false; reason: string } {
  let json: any;
  try {
    json = z.toJSONSchema(schema as never, { io: 'input', unrepresentable: 'any' });
  } catch (e) {
    return { ok: false, reason: `toJSONSchema failed: ${(e as Error).message}` };
  }

  let body = fromJsonSchema(json, 'body', seeds) as Record<string, unknown>;
  if (typeof body !== 'object' || body === null) body = {};

  for (let round = 0; round < 8; round++) {
    const parsed = schema.safeParse(body);
    if (parsed.success) return { ok: true, body };

    let changed = false;
    for (const issue of parsed.error.issues) {
      const path = issue.path;
      const key = String(path[0] ?? '');

      // Whole-object predicate (`.refine` for "at least one field"): widen by
      // adding every optional property the shape declares.
      if (path.length === 0) {
        for (const [k, sub] of Object.entries((json.properties ?? {}) as Record<string, any>)) {
          if (!(k in body)) {
            body[k] = fromJsonSchema(sub, k, seeds);
            changed = true;
          }
        }
        continue;
      }
      if (!key) continue;

      const sub = (json.properties ?? {})[key];

      if (issue.code === 'unrecognized_keys') {
        for (const k of (issue as any).keys ?? []) { delete body[k]; changed = true; }
        continue;
      }
      if (issue.code === 'invalid_type' && (issue as any).received === 'undefined') {
        body[key] = fromJsonSchema(sub, key, seeds);
        changed = true;
        continue;
      }
      if (issue.code === 'invalid_type') {
        const want = (issue as any).expected;
        if (want === 'date') body[key] = new Date(Date.now() + 86_400_000).toISOString();
        else if (want === 'number') body[key] = 1;
        else if (want === 'boolean') body[key] = false;
        else if (want === 'array') body[key] = [];
        else if (want === 'object') body[key] = {};
        else body[key] = `SweepProbe ${key}`;
        changed = true;
        continue;
      }
      if (issue.code === 'too_small') {
        const min = Number((issue as any).minimum ?? 1);
        if ((issue as any).origin === 'array' || Array.isArray(body[key])) {
          // An array with a minimum length: fill it with items built from the
          // element schema, not with the number `min` — which is what a
          // careless numeric fallback would have written here.
          const item = sub?.items ?? {};
          const arr = Array.isArray(body[key]) ? [...(body[key] as unknown[])] : [];
          while (arr.length < min) arr.push(fromJsonSchema(item, key, seeds));
          body[key] = arr;
        } else if ((issue as any).origin === 'string' || typeof body[key] === 'string') {
          let s = String(body[key] ?? '');
          while (s.length < min) s += 'x';
          body[key] = s;
        } else body[key] = min;
        changed = true;
        continue;
      }
      if (issue.code === 'too_big') {
        const max = Number((issue as any).maximum ?? 8);
        if (typeof body[key] === 'string') body[key] = String(body[key]).slice(0, max);
        else body[key] = max;
        changed = true;
        continue;
      }
      if (issue.code === 'invalid_value' || issue.code === 'invalid_format') {
        // An enum or a format (email/url/regex). Take the schema's own option.
        if (Array.isArray(sub?.enum) && sub.enum.length) body[key] = sub.enum[0];
        else if (typeof sub?.pattern === 'string') {
          // A regex the generator cannot invert. The patterns in this codebase
          // are institutional codes and academic years, so try those shapes
          // rather than abandoning the endpoint.
          const candidates = ['SWEEP01', '2025-26', 'SWEEP-01', 'SWEEP'];
          const cur = String(body[key] ?? '');
          const re = new RegExp(sub.pattern);
          body[key] = candidates.find((c) => re.test(c) && c !== cur) ?? candidates[0];
        }
        else if (Array.isArray((issue as any).values) && (issue as any).values.length) body[key] = (issue as any).values[0];
        else if (isDateField(key)) body[key] = new Date(Date.now() + 86_400_000).toISOString();
        else if (key.toLowerCase().includes('email')) body[key] = 'sweep.probe@campusharmony.edu';
        else body[key] = 'https://example.com/sweep-probe.pdf';
        changed = true;
        continue;
      }
      if (issue.code === 'custom') {
        // A `.refine()` on one field. By far the most common in this codebase
        // is "must be a valid date" (`isoDate`), and the field is not always
        // named like one — `expectedDelivery`, `registrationDeadline` and
        // `lastMaintenance` all carry it. So try a date FIRST regardless of
        // the name, and only move on if the value already is one.
        const current = body[key];
        const looksIso = typeof current === 'string' && !Number.isNaN(Date.parse(current));
        body[key] = looksIso ? JSON.stringify([]) : new Date(Date.now() + 86_400_000).toISOString();
        changed = true;
        continue;
      }
    }
    if (!changed) {
      return { ok: false, reason: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.code}`).join('; ') };
    }
  }

  const final = schema.safeParse(body);
  return final.success
    ? { ok: true, body }
    : { ok: false, reason: final.error.issues.map((i) => `${i.path.join('.')}: ${i.code}`).join('; ') };
}

/** Import every schema module and index the exported Zod objects by name. */
export async function loadSchemas(): Promise<Map<string, z.ZodType>> {
  const found = new Map<string, z.ZodType>();

  // Schemas are not all in `*.schemas.ts`. Some modules use the singular
  // `*.schema.ts`, and several define theirs inside the route file itself
  // (`library.routes.ts`, `finance.routes.ts`, `routes/admin.ts`). Importing
  // a route module is safe — it only builds a Router — and it is the only way
  // to reach a schema that lives there. A schema that is not exported cannot
  // be reached at all, and is reported rather than guessed at.
  const files: string[] = [];
  const collect = (dir: string) => {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    for (const n of entries) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) collect(p);
      else if (/\.schemas?\.ts$/.test(n) || /\.routes\.ts$/.test(n)) files.push(p);
    }
  };
  collect(join(srcRoot, 'modules'));
  for (const n of readdirSync(join(srcRoot, 'routes'))) {
    if (n.endsWith('.ts')) files.push(join(srcRoot, 'routes', n));
  }

  for (const f of files) {
    let mod: Record<string, unknown>;
    try {
      // Windows absolute paths are not valid ESM specifiers; they must be
      // file:// URLs or the loader rejects the drive letter as a scheme.
      mod = await import(pathToFileURL(f).href);
    } catch {
      continue;
    }
    for (const [name, value] of Object.entries(mod)) {
      if (value && typeof (value as any).safeParse === 'function' && !found.has(name)) {
        found.set(name, value as z.ZodType);
      }
    }
  }
  return found;
}

/** endpoint -> schema name, read from each route's own `validate({ body })`. */
export function loadRouteSchemaMap(): Array<{ method: string; path: string; schema: string; roles: string[] }> {
  const server = readFileSync(join(srcRoot, 'server.ts'), 'utf8');
  const importMap = new Map<string, { dir: string; name: string }>();
  for (const m of server.matchAll(/import\s+(\w+)\s+from\s+'\.\/(routes|modules)\/([\w/.]+)\.js'/g)) {
    importMap.set(m[1]!, { dir: m[2]!, name: m[3]! + '.ts' });
  }

  const out: Array<{ method: string; path: string; schema: string; roles: string[] }> = [];
  for (const m of server.matchAll(/app\.use\(\s*'(\/api\/[^']*)'([^;]*?)(\w+)\s*\)\s*;/g)) {
    const f = importMap.get(m[3]!);
    if (!f) continue;
    const roles = [...m[2]!.matchAll(/'([a-z_]+)'/g)].map((r) => r[1]!);
    let src: string | null = null;
    for (const c of [join(srcRoot, f.dir, f.name), join(srcRoot, f.name)]) {
      try { src = readFileSync(c, 'utf8'); break; } catch { /* next */ }
    }
    if (!src) continue;

    const re = /router\.(post|put|patch)\(\s*\n?\s*['"]([^'"]+)['"]([\s\S]{0,400}?)(?:async\s*\(|asyncHandler)/g;
    let r: RegExpExecArray | null;
    while ((r = re.exec(src))) {
      const sm = /validate\(\s*\{[\s\S]*?\bbody:\s*(\w+)/.exec(r[3]!);
      if (sm) out.push({ method: r[1]!.toUpperCase(), path: m[1]! + r[2]!, schema: sm[1]!, roles });
    }
  }
  return out;
}
