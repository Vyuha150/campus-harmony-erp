/**
 * Service-layer tenant scoping.
 *
 * THE HAZARD THIS ONCE GUARDED, AND WHAT CHANGED
 *
 * Automatic scoping comes from the Prisma extension, which wraps `prisma`. The
 * service layer used not to benefit from it: services import `basePrisma`, the
 * UNSCOPED client, and `mutate()` opened its transaction there — so the `tx`
 * handed to every service operation was unscoped too. Tenant safety inside a
 * service was not structural. It depended on the author writing
 * `institutionId: context.institutionId` into each `where`, and nothing in the
 * type system noticed when they didn't.
 *
 * That was not hypothetical. The first version of `modules/coe/exams.service.ts`
 * used `basePrisma` without the filter, and live verification showed another
 * institution's exam listed and then successfully renamed through
 * `PUT /coe/exams/:id` — the same authority breach as the pre-0022 approvals
 * routes, reintroduced through the layer meant to prevent it, with a green unit
 * suite throughout.
 *
 * `mutate()` now opens its transaction on the EXTENDED client, so `tx` carries
 * the scope. A service that forgets its filter reads and writes nothing outside
 * the caller's institution — proven in
 * `scripts/verify/verify-service-scoping.ts`, which plants a rival row and shows
 * a filter-less `updateMany` affecting zero rows.
 *
 * THESE TESTS ARE THEREFORE A SECOND LAYER, NOT THE ONLY ONE.
 *
 * They are kept because the explicit filters remain the right posture for tenant
 * isolation: two independent mechanisms, either of which alone would hold. The
 * last describe block guards the single line that makes the first one work.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { TENANT_OWNED_MODELS } from '../lib/tenantExtension.js';

const modulesDir = fileURLToPath(new URL('../modules', import.meta.url));
const routesDir = () => fileURLToPath(new URL('../routes', import.meta.url));

const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Every `*.service.ts` under src/modules. */
function serviceFiles(): { path: string; name: string; source: string }[] {
  const out: { path: string; name: string; source: string }[] = [];
  for (const dir of readdirSync(modulesDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const full = join(modulesDir, dir.name);
    if (!existsSync(full)) continue;
    for (const f of readdirSync(full)) {
      if (!f.endsWith('.service.ts')) continue;
      out.push({
        path: `${dir.name}/${f}`,
        name: f,
        source: stripComments(readFileSync(join(full, f), 'utf8'))
      });
    }
  }
  return out;
}

/** Model name as it appears on a Prisma client: `ExamProgress` -> `examProgress`. */
const delegateOf = (model: string) => model[0]!.toLowerCase() + model.slice(1);

const TENANT_DELEGATES = new Set([...TENANT_OWNED_MODELS].map(delegateOf));

/**
 * Find `<client>.<delegate>.<op>({ where: { id ... } })` calls whose where-clause
 * names no `institutionId`.
 *
 * Only where-clauses whose KEY is `id` are examined. Two refinements, both from
 * false positives this matcher produced on its first run:
 *
 *   - `where: { studentProfileId: student.id }` was flagged because a loose
 *     `\bid\b` matched the `.id` property access on the right-hand side. The key
 *     is `studentProfileId`, and the parent row was already tenant-checked.
 *   - `where: { id: context.userId }` is a caller looking up their own user row.
 *     That cannot cross a tenant boundary, because the id comes from their own
 *     verified token rather than from the request.
 *
 * A query filtered by some other tenant-derived column is a judgement this test
 * cannot make, so it does not try. It catches the specific shape that has
 * actually gone wrong in this codebase.
 */
function unscopedByIdLookups(source: string): string[] {
  const found: string[] = [];
  const call =
    /\b(?:basePrisma|tx)\.([a-zA-Z]+)\.(findFirst|findMany|updateMany|deleteMany|count|update|delete)\s*\(\s*\{\s*where:\s*\{([^{}]*)\}/g;

  /**
   * `id` used as a where KEY, not as a property access like `student.id`.
   * Matches both `{ id: x }` and the shorthand `{ id }` — the shorthand is the
   * form the original unscoped handlers actually used, and an earlier version of
   * this matcher required a colon and so ignored exactly the shape it existed to
   * catch.
   */
  const idIsAKey = /(?:^|[{,])\s*id\s*(?::|,|$)/;
  /** The caller's own user row, taken from the verified token. */
  const selfLookup = /id\s*:\s*(?:context|ctx)\.userId/;

  let m: RegExpExecArray | null;
  while ((m = call.exec(source)) !== null) {
    const [, delegate, op, whereBody] = m;
    if (!TENANT_DELEGATES.has(delegate!)) continue;
    if (!idIsAKey.test(whereBody!)) continue;
    if (selfLookup.test(whereBody!)) continue;
    if (/institutionId/.test(whereBody!)) continue;
    found.push(`${delegate}.${op}({ where: {${whereBody!.trim()} } })`);
  }
  return found;
}

describe('service modules scope tenant-owned models explicitly', () => {
  const files = serviceFiles();

  it('found service files to check — otherwise every result below is vacuous', () => {
    expect(files.length).toBeGreaterThan(4);
  });

  it.each(files.map((f) => [f.path, f] as const))(
    '%s filters tenant-owned lookups by institutionId',
    (_path, file) => {
      expect(
        unscopedByIdLookups(file.source),
        `${file.path} queries a tenant-owned model by id without institutionId. ` +
          'The service layer runs on the UNSCOPED client, so this reads and writes ' +
          'across every institution.'
      ).toEqual([]);
    }
  );

  it('NEGATIVE CONTROL: the matcher detects an unscoped lookup', () => {
    // Without this, a regex that silently stopped matching would turn every
    // check above into a guaranteed pass.
    const bad = 'await basePrisma.examProgress.findFirst({ where: { id } });';
    expect(unscopedByIdLookups(bad)).toHaveLength(1);

    const good =
      'await basePrisma.examProgress.findFirst({ where: { id, institutionId: context.institutionId } });';
    expect(unscopedByIdLookups(good)).toHaveLength(0);
  });

  it('NEGATIVE CONTROL: a model outside the tenant set is ignored', () => {
    // `Institution` itself is not tenant-owned; flagging it would be noise.
    const notOwned = 'await basePrisma.institution.findFirst({ where: { id } });';
    expect(unscopedByIdLookups(notOwned)).toHaveLength(0);
  });

  it('NEGATIVE CONTROL: the two known false-positive shapes are not flagged', () => {
    // If these ever start matching again, the refinements have regressed and the
    // suite will start failing on safe code — which is how a guard gets deleted.
    const propertyAccess =
      'await basePrisma.feeRecord.findMany({ where: { studentProfileId: student.id } });';
    const ownUserRow =
      'await basePrisma.user.findFirst({ where: { id: context.userId }, select: { name: true } });';
    expect(unscopedByIdLookups(propertyAccess)).toHaveLength(0);
    expect(unscopedByIdLookups(ownUserRow)).toHaveLength(0);
  });
});

describe('the examination schedule is tenant-owned', () => {
  it('ExamProgress is registered with the extension', () => {
    expect(TENANT_OWNED_MODELS.has('ExamProgress')).toBe(true);
  });

  it('the model carries a tenant key', () => {
    const schema = readFileSync(
      fileURLToPath(new URL('../../prisma/schema.prisma', import.meta.url)),
      'utf8'
    );
    const block = /model\s+ExamProgress\s*\{([\s\S]*?)\n\}/.exec(schema);
    expect(block).toBeTruthy();
    expect(block![1]).toMatch(/institutionId\s+String/);
  });

  it('no exam route writes straight from req.body', () => {
    // `update({ where: { id }, data: req.body })` appeared in coe.ts AND
    // registrar.ts: a unique-key update the extension cannot constrain, carrying
    // every column as writable. Both now go through exams.service.ts.
    for (const f of ['coe.ts', 'registrar.ts']) {
      const src = stripComments(readFileSync(join(routesDir(), f), 'utf8'));
      expect(src, `${f} still writes examProgress from req.body`).not.toMatch(
        /examProgress\.update\s*\(\s*\{\s*where:\s*\{\s*id\s*\}\s*,\s*data:\s*req\.body/
      );
    }
  });
});

/**
 * A RATCHET that has reached zero.
 *
 * Migrating the exam schedule exposed that `update({ where: { id }, data: req.body })`
 * was not confined to the two handlers it was found in: it appeared 17 times
 * across 9 route files. Every one carried both defects — a unique-key update the
 * tenant extension cannot constrain, and an unfiltered request body making every
 * column writable — and 16 of the 17 models had no `institutionId` at all, so
 * those tables were shared across every institution in the deployment.
 *
 * All 17 were migrated in Phase 3b (migrations 0028 and 0029, plus
 * `modules/common/entityUpdate.*`). The inventory below is now empty and the
 * ratchet is what keeps it that way: reintroducing the pattern anywhere exceeds
 * a recorded count of zero and fails the build.
 *
 * Detail: docs/development-plan/20_PHASE_3_BASELINE.md.
 */
describe('mass-assignment debt does not grow', () => {
  /**
   * Files still writing a model from an UNVALIDATED `req.body`, with counts.
   *
   * EMPTY, and that is the point.
   *
   * The last seventeen — admin 2, alumni 4, hod 2, iqac 4, security 2, sports 2,
   * vc 1 — were closed in Phase 3c. The inventory stays here rather than being
   * deleted so the ratchet keeps working: any file that reintroduces the pattern
   * now exceeds its recorded count of zero and fails the build.
   */
  const KNOWN_MASS_ASSIGNMENT: Record<string, number> = {};

  /**
   * Any write whose `data` is the raw request body.
   *
   * WIDENED after 0030. The original pattern only matched
   * `update({ where: { id }, data: req.body })`, so a sweep reported ZERO while
   * NINE `create({ data: req.body })` handlers sat untouched — a guard is only
   * as wide as the shape it was written against, and I wrote it against the
   * shape I had just finished fixing.
   */
  //
  // The middle must span NESTED braces. `[^{}]*` cannot cross the `{ id }` in
  // `where: { id }`, so a first attempt at this widened pattern matched `create`
  // but silently stopped matching `update` — the shape the ratchet was
  // originally built for. That is the SECOND time a `[^…]*` class has produced a
  // dead matcher in this suite (see EMPTY_MEANS_FULL in
  // noFabricatedMetrics.test.ts). The negative control below is the only reason
  // either was caught.
  //
  // Matches BOTH forms:
  //   data: req.body            — the original
  //   data: { ...req.body, x }  — the spread, which the first two versions of
  //                               this pattern missed entirely
  //
  // That spread form accounts for 22 further sites, found only when a finance
  // handler was read by hand. This is the THIRD time this guard has been too
  // narrow: first it saw only `update`, then only the non-spread form. Each time
  // it reported zero while real instances sat untouched, because a guard only
  // covers the shape its author had in mind.
  const pattern =
    /\.(?:create|createMany|update|updateMany|upsert)\s*\(\s*\{[\s\S]{0,200}?data:\s*\{?\s*(?:\.\.\.\s*)?req\.body/g;

  /**
   * Is the handler containing `index` fed a VALIDATED body?
   *
   * `validate({ body: … })` does not merely check the body, it REPLACES it with
   * the parsed result — see middleware/validate.ts. So on a route that carries
   * it, `{ ...req.body }` spreads an object that is already stripped of unknown
   * keys by `.strict()`, and the spread is no longer mass assignment.
   *
   * This is why the ratchet must read the ROUTE and not just the write. The
   * seventeen Phase 3c sites were closed by adding middleware, not by deleting
   * the spread; a purely syntactic count went on reporting all seventeen as
   * outstanding after they were fixed. The reverse error is worse: a count that
   * looks only at the write can be "fixed" by rewording the spread while the
   * hole stays open.
   */
  function isValidated(src: string, index: number): boolean {
    const start = src.lastIndexOf('router.', index);
    if (start === -1) return false;
    // The middleware chain is everything before the handler function opens.
    const handler = src.indexOf('async (', start);
    if (handler === -1 || handler > index) return false;
    return /validate\s*\(\s*\{[\s\S]*?\bbody\s*:/.test(src.slice(start, handler));
  }

  function countIn(file: string): number {
    const src = stripComments(readFileSync(join(routesDir(), file), 'utf8'));
    let unvalidated = 0;
    for (const match of src.matchAll(pattern)) {
      if (!isValidated(src, match.index ?? 0)) unvalidated += 1;
    }
    return unvalidated;
  }

  it('no route file exceeds its recorded count', () => {
    const actual: Record<string, number> = {};
    for (const f of readdirSync(routesDir()).filter((n) => n.endsWith('.ts'))) {
      const n = countIn(f);
      if (n > 0) actual[f] = n;
    }

    for (const [file, count] of Object.entries(actual)) {
      const allowed = KNOWN_MASS_ASSIGNMENT[file] ?? 0;
      expect(
        count,
        `${file} has ${count} handler(s) writing a model from req.body; ${allowed} recorded. ` +
          'Route the new one through a service with a .strict() schema rather than raising this number.'
      ).toBeLessThanOrEqual(allowed);
    }
  });

  it('recorded counts are not stale — a fixed file must be removed from the list', () => {
    for (const [file, allowed] of Object.entries(KNOWN_MASS_ASSIGNMENT)) {
      const actual = countIn(file);
      expect(
        actual,
        `${file} is recorded as having ${allowed} but has ${actual}. ` +
          'Lower or remove its entry so the ratchet keeps tightening.'
      ).toBe(allowed);
    }
  });

  it('NEGATIVE CONTROL: the pattern matches every shape it counts', () => {
    const update = 'await prisma.thing.update({ where: { id }, data: req.body });';
    const create = 'await prisma.thing.create({ data: req.body });';
    const many = 'await prisma.thing.updateMany({ where: { id }, data: req.body });';
    for (const bad of [update, create, many]) {
      expect((bad.match(new RegExp(pattern.source, 'g')) ?? []).length, bad).toBe(1);
    }
    // A validated body must NOT trip it.
    const good = 'await prisma.thing.create({ data: { ...body, institutionId: ctx.institutionId } });';
    expect((good.match(new RegExp(pattern.source, 'g')) ?? []).length).toBe(0);
  });

  it('NEGATIVE CONTROL: isValidated separates a guarded route from a bare one', () => {
    const guarded = `router.post('/x', authenticate,
  validate({ body: thingSchema }),
  async (req: Request, res: Response) => {
    await prisma.thing.create({ data: { ...req.body } });`;

    const bare = `router.post('/x', authenticate, async (req: Request, res: Response) => {
    await prisma.thing.create({ data: { ...req.body } });`;

    // The write itself is identical in both; only the route differs.
    const at = (s: string) => s.indexOf('prisma.thing.create');

    expect(isValidated(guarded, at(guarded)), 'a validated route was counted as debt').toBe(true);
    expect(
      isValidated(bare, at(bare)),
      'an unvalidated route was treated as safe — the ratchet would report zero ' +
        'while every spread in the codebase stayed open'
    ).toBe(false);

    // `validate({ params })` alone must not count: it leaves the body untouched.
    const paramsOnly = guarded.replace('body: thingSchema', 'params: z.object({ id: entityId })');
    expect(isValidated(paramsOnly, at(paramsOnly))).toBe(false);
  });

  it('NEGATIVE CONTROL: the req.body matcher still works', () => {
    const bad = 'prisma.examProgress.update({ where: { id }, data: req.body });';
    expect(bad).toMatch(/\.update\s*\(\s*\{\s*where:\s*\{\s*id\s*\}\s*,\s*data:\s*req\.body/);
  });
});

/**
 * `mutate()` must open its transaction on the EXTENDED client.
 *
 * This one line is what makes the service layer scoped by construction. Moving
 * it back to `basePrisma` would silently restore the Phase 3a hazard: every
 * service would again depend on its author remembering a `where` clause, and
 * nothing would fail until a real tenant boundary was crossed.
 *
 * Proven live by scripts/verify/verify-service-scoping.ts, which plants a rival
 * row and confirms a filter-less updateMany writes zero rows. This static check
 * exists because that script needs a database and so does not run in CI.
 */
describe('mutate() is scoped by construction', () => {
  const serviceSrc = stripComments(
    readFileSync(fileURLToPath(new URL('../lib/service.ts', import.meta.url)), 'utf8')
  );

  /**
   * WHICH client, not which statement.
   *
   * These matchers used to require `return prisma.$transaction(`. That held
   * until `mutate()` was wrapped in `runServiceAudited(...)` to suppress the
   * duplicate structural audit, which put the call on its own line and broke a
   * test whose subject had not changed at all: the transaction still opens on
   * the extended client.
   *
   * Pinning the statement made the guard fire on a safe refactor. The thing
   * worth protecting is the identifier, so that is what is matched now. The
   * lookbehind is what keeps `basePrisma.$transaction(` from satisfying it —
   * the two names differ only by a prefix, and a plain `prisma` match would
   * accept the very thing this guards against.
   */
  const OPENS_ON_EXTENDED = /(?<![A-Za-z])prisma\.\$transaction\(/;
  const OPENS_ON_BASE = /basePrisma\.\$transaction\(/;

  it('opens its transaction on the extended client', () => {
    expect(serviceSrc).toMatch(OPENS_ON_EXTENDED);
  });

  it('does NOT open it on basePrisma', () => {
    expect(
      serviceSrc,
      'mutate() is back on basePrisma — the transaction client is unscoped again, ' +
        'and every service silently depends on hand-written institutionId filters.'
    ).not.toMatch(OPENS_ON_BASE);
  });

  it('NEGATIVE CONTROL: the matchers distinguish the two clients', () => {
    expect('  return prisma.$transaction(async (tx) => {').toMatch(OPENS_ON_EXTENDED);
    expect('    prisma.$transaction(async (tx) => {').toMatch(OPENS_ON_EXTENDED);
    expect('  return basePrisma.$transaction(async (tx) => {').toMatch(OPENS_ON_BASE);
    // `basePrisma` must not satisfy the `prisma` matcher.
    expect('  return basePrisma.$transaction(async (tx) => {').not.toMatch(OPENS_ON_EXTENDED);
  });
});
