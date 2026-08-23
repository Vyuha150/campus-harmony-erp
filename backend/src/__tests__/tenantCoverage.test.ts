/**
 * Tenant coverage guard.
 *
 * The Prisma extension scopes only models listed in `TENANT_OWNED_MODELS`. A
 * model that gains an `institutionId` column but is not added to that list
 * would be SILENTLY UNSCOPED — the failure mode is invisible in code review and
 * leaks another institution's data in production.
 *
 * This test reads the Prisma schema and fails if the two ever drift, so the
 * omission is caught in CI rather than discovered in an incident.
 */

import { describe, it, expect } from 'vitest';
import { TENANT_OWNED_MODELS } from '../lib/tenantExtension.js';

/** Parse `schema.prisma` and return models declaring an institutionId field. */
async function modelsWithInstitutionId(): Promise<Set<string>> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const schema = await fs.readFile(
    path.resolve(process.cwd(), 'prisma/schema.prisma'),
    'utf8'
  );

  const found = new Set<string>();

  // Match `model Name { ... }` blocks, then look for an institutionId field
  // declaration (not a relation reference such as `fields: [institutionId]`).
  const blocks = schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g);

  for (const block of blocks) {
    const name = block[1]!;
    const body = block[2]!;

    const declaresField = body
      .split('\n')
      .map((line) => line.trim())
      .some((line) => /^institutionId\s+String/.test(line));

    if (declaresField) found.add(name);
  }

  return found;
}

describe('tenant scoping coverage', () => {
  it('scopes every model that carries an institutionId', async () => {
    const inSchema = await modelsWithInstitutionId();

    const unscoped = [...inSchema].filter((model) => !TENANT_OWNED_MODELS.has(model));

    expect(
      unscoped,
      `These models have an institutionId column but are NOT in TENANT_OWNED_MODELS, ` +
        `so the Prisma extension will not scope them and they will leak across ` +
        `institutions: ${unscoped.join(', ')}`
    ).toEqual([]);
  });

  it('does not list models that lack an institutionId', async () => {
    const inSchema = await modelsWithInstitutionId();

    // A model listed but lacking the column would make every query against it
    // fail with an unknown-argument error at runtime.
    const bogus = [...TENANT_OWNED_MODELS].filter((model) => !inSchema.has(model));

    expect(
      bogus,
      `These models are in TENANT_OWNED_MODELS but have no institutionId column, ` +
        `so scoping them will throw at runtime: ${bogus.join(', ')}`
    ).toEqual([]);
  });

  it('covers the models that hold institutional records', async () => {
    // Sanity floor — if any of these ever fell out of scoping it would be a
    // serious regression, so name them explicitly.
    for (const critical of [
      'User',
      'StudentProfile',
      'FacultyProfile',
      'Department',
      'Course'
    ]) {
      expect(TENANT_OWNED_MODELS.has(critical), `${critical} must be tenant-scoped`).toBe(true);
    }
  });
});
