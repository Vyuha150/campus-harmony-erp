/**
 * Soft-delete guards (Phase 1.4).
 *
 * These are static checks. The behavioural properties — a deleted row vanishing
 * from ordinary queries, and `includeDeleted()` reaching it — were verified
 * against a live database; what is worth guarding in CI is the structure that
 * makes those properties hold.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SOFT_DELETABLE_MODELS, TENANT_OWNED_MODELS } from '../lib/tenantExtension.js';
import { includeDeleted, isIncludingDeleted } from '../lib/tenantStore.js';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('soft-deletable model set', () => {
  it('covers people, academic units and records', () => {
    for (const model of [
      'User', 'StudentProfile', 'FacultyProfile',
      'Department', 'Programme', 'Course',
      'CourseResult', 'SemesterResult', 'FeeRecord', 'LibraryBook'
    ]) {
      expect(SOFT_DELETABLE_MODELS.has(model), `${model} should be soft-deletable`).toBe(true);
    }
  });

  it('excludes append-only history', () => {
    // Audit and delivery rows are evidence. They are never "deleted", and giving
    // them the machinery would imply they could be.
    for (const model of ['SystemAuditLog', 'GradeHistory', 'NotificationDelivery', 'ImportJob']) {
      expect(SOFT_DELETABLE_MODELS.has(model), `${model} must not be soft-deletable`).toBe(false);
    }
  });

  it('every soft-deletable model declares deletedAt in the schema', () => {
    const schema = read('../../prisma/schema.prisma');
    for (const model of SOFT_DELETABLE_MODELS) {
      const block = new RegExp(`model\\s+${model}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(schema);
      expect(block, `${model} not found in schema`).toBeTruthy();
      expect(block![1], `${model} is soft-deletable but has no deletedAt column`).toMatch(/deletedAt\s+DateTime\?/);
    }
  });
});

describe('the filter is structural, not per-call-site', () => {
  it('the extension injects deletedAt: null itself', () => {
    // The whole point: 500 call sites cannot be relied on to remember. One
    // forgotten filter puts a deleted student back in a roll or an export.
    const code = stripComments(read('../lib/tenantExtension.ts'));
    expect(code).toMatch(/SOFT_DELETABLE_MODELS\.has\(model\)/);
    expect(code).toMatch(/deletedAt:\s*null/);
  });

  it('a caller-supplied deletedAt filter is not overwritten', () => {
    // `deletedAt: { not: null }` is a deliberate request for deleted rows and
    // must survive.
    const code = stripComments(read('../lib/tenantExtension.ts'));
    expect(code).toMatch(/where\?\.deletedAt === undefined/);
  });
});

describe('context helpers await inside the context', () => {
  // The bug this catches was invisible and cost a debugging cycle: Prisma
  // queries are LAZY, so returning `prisma.x.findFirst()` from `storage.run()`
  // executes it AFTER the context has exited. The flag is then unset and the
  // ordinary filters apply — silently.
  it('runUnscoped awaits fn rather than returning its promise', () => {
    const code = stripComments(read('../lib/tenantStore.ts'));
    expect(code).toMatch(/runUnscoped[\s\S]{0,600}async \(\) => await fn\(\)/);
  });

  it('includeDeleted awaits fn rather than returning its promise', () => {
    const code = stripComments(read('../lib/tenantStore.ts'));
    expect(code).toMatch(/includeDeleted[\s\S]{0,900}async \(\) => await fn\(\)/);
  });

  it('includeDeleted actually sets the flag for the duration', async () => {
    expect(isIncludingDeleted()).toBe(false);
    const inside = await includeDeleted('verifying the flag is set for the callback', async () => {
      // Across an await, which is where AsyncLocalStorage propagation matters.
      await new Promise((r) => setTimeout(r, 1));
      return isIncludingDeleted();
    });
    expect(inside).toBe(true);
    expect(isIncludingDeleted()).toBe(false);
  });

  it('requires a reason', async () => {
    await expect(includeDeleted('short', async () => 1)).rejects.toThrow(/at least 10 characters/);
  });
});

describe('deletion is audited', () => {
  it('softDelete requires a reason and records it', () => {
    // A removed institutional record with no recorded justification is an audit
    // finding. The moment to capture why is the moment of deletion.
    const code = read('../lib/service.ts');
    expect(code).toMatch(/export async function softDelete/);
    expect(code).toMatch(/at least 10 characters/);
    expect(code).toMatch(/action: 'DELETE'/);
    expect(code).toMatch(/severity: 'warning'/);
  });

  it('every soft-deletable model is also tenant-owned or deliberately not', () => {
    // Not a rule, a sanity check: a soft-deletable model outside the tenant set
    // should be a conscious choice, not an oversight.
    const outside = [...SOFT_DELETABLE_MODELS].filter((m) => !TENANT_OWNED_MODELS.has(m));
    expect(outside, 'unexpected soft-deletable models outside the tenant set').toEqual([]);
  });
});
