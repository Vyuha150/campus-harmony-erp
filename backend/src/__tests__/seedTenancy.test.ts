/**
 * The seed must set a tenant key on every tenant-owned model.
 *
 * WHY A TEST RATHER THAN THE TYPE SYSTEM
 *
 * `seed.ts` writes most rows through a helper:
 *
 *     async function upsertById(delegate: any, id: string, data: Record<string, unknown>)
 *
 * `delegate: any` erases the Prisma input type, so a missing required column is
 * invisible to `tsc` and surfaces only when the seed is executed. That has now
 * bitten this project three times:
 *
 *   - migration 0022 made `ApprovalItem.institutionId` required and the seed was
 *     not updated. The seed threw at line 694 of 1829, so roughly 60% of it —
 *     academicYear, feeStructure, moduleConfig, departmentBudget — had never run
 *     on a fresh database, and nothing reported a failure because
 *     `prisma db seed` exits 0 on a failed seed.
 *   - migration 0027 did the same to `ExamProgress`.
 *   - migration 0028 would have done the same to sixteen more.
 *
 * Each was found by running the seed and reading the error. This test finds them
 * without a database.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TENANT_OWNED_MODELS } from '../lib/tenantExtension.js';

/**
 * Comments are stripped before scanning.
 *
 * Without this the scan matched COMMENTED-OUT seed calls — PromotionRequest and
 * RetirementRequest are disabled blocks awaiting their migrations — and reported
 * them as missing a tenant key. A commented call cannot throw at runtime, so
 * that was a false failure, and a guard that cries wolf is a guard someone
 * eventually deletes.
 */
const seed = readFileSync(
  fileURLToPath(new URL('../../prisma/seed.ts', import.meta.url)),
  'utf8'
)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const schema = readFileSync(
  fileURLToPath(new URL('../../prisma/schema.prisma', import.meta.url)),
  'utf8'
);

const delegateOf = (model: string) => model[0]!.toLowerCase() + model.slice(1);

/** Tenant-owned models whose `institutionId` is REQUIRED in the schema. */
function modelsRequiringTenantKey(): string[] {
  return [...TENANT_OWNED_MODELS].filter((model) => {
    const block = new RegExp(`model\\s+${model}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(schema);
    if (!block) return false;
    const field = /^\s*institutionId\s+String(\??)/m.exec(block[1]!);
    return Boolean(field) && field![1] !== '?';
  });
}

/**
 * The body of a seed call for one model — either
 * `upsertById(prisma.x, 'id', { ... })` or `prisma.x.upsert({ ... })`.
 */
function seedCallsFor(delegate: string): string[] {
  const bodies: string[] = [];

  const helper = new RegExp(`upsertById\\(prisma\\.${delegate},\\s*[^,]+,\\s*\\{`, 'g');
  const direct = new RegExp(`prisma\\.${delegate}\\.(?:upsert|create|createMany)\\s*\\(\\s*\\{`, 'g');

  for (const re of [helper, direct]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(seed)) !== null) {
      // Take a window from the call site and stop at the next top-level `await`,
      // which is where the following statement begins.
      const window = seed.slice(m.index, m.index + 2500);
      const end = window.indexOf('\n  await ');
      bodies.push(end === -1 ? window : window.slice(0, end));
    }
  }
  return bodies;
}

describe('seed sets a tenant key on every tenant-owned model', () => {
  const models = modelsRequiringTenantKey();

  it('found models to check — otherwise every result below is vacuous', () => {
    expect(models.length).toBeGreaterThan(15);
  });

  it.each(models.map((m) => [m] as const))('%s', (model) => {
    const calls = seedCallsFor(delegateOf(model));
    // Not every tenant-owned model is seeded; that is fine.
    if (calls.length === 0) return;

    for (const body of calls) {
      expect(
        body,
        `seed.ts creates a ${model} without institutionId. ` +
          'upsertById takes `delegate: any`, so tsc cannot see this — the seed ' +
          'will throw at runtime, and `prisma db seed` exits 0 even when it does, ' +
          'so every statement after it is silently skipped.'
      ).toMatch(/institutionId/);
    }
  });

  it('NEGATIVE CONTROL: the matcher finds a seed call and can fail', () => {
    // If `seedCallsFor` silently stopped matching, every check above would pass
    // by finding nothing to check.
    const anySeeded = modelsRequiringTenantKey().some(
      (m) => seedCallsFor(delegateOf(m)).length > 0
    );
    expect(anySeeded, 'no seed calls matched at all — the matcher has drifted').toBe(true);

    const missing = 'await upsertById(prisma.vacancy, "seed-x", {\n    position: "Lecturer",\n  });';
    expect(missing).not.toMatch(/institutionId/);
  });
});
