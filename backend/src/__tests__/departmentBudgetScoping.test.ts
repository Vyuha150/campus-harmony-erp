/**
 * DepartmentBudget carries no institutionId column of its own — only
 * `departmentId -> Department.institutionId`. Department IS tenant-owned, so
 * the extension scopes it automatically, but that protection does not extend
 * to DepartmentBudget: a `prisma.departmentBudget.findMany()` with no `where`
 * returns every institution's budgets, department names included.
 *
 * Found the same way as the alumni.ts leak (see alumniOrphanScoping.test.ts):
 * vc.ts's /finance, /financialoverview, /finance-summary, /department-budgets
 * and /revenue-streams, and dean.ts's own /finance, all queried it with zero
 * scoping. Fixed by adding `where: { department: { institutionId } }` to each.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const FILES = ['vc.ts', 'dean.ts'];

function routeBlocks(src: string): { signature: string; body: string }[] {
  const sigs = [...src.matchAll(/router\.(get|post|put|patch|delete)\(/g)].map((m) => m.index!);
  const blocks: { signature: string; body: string }[] = [];
  for (let i = 0; i < sigs.length; i++) {
    const start = sigs[i]!;
    const end = i + 1 < sigs.length ? sigs[i + 1]! : src.length;
    const body = src.slice(start, end);
    const sig = /router\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/.exec(body.slice(0, 200));
    blocks.push({ signature: sig ? `${sig[1]!.toUpperCase()} ${sig[2]}` : body.slice(0, 40), body });
  }
  return blocks;
}

function unscopedBudgetRoutes(src: string): string[] {
  const found: string[] = [];
  for (const { signature, body } of routeBlocks(src)) {
    if (!body.includes('prisma.departmentBudget.')) continue;
    if (!body.includes('institutionId')) found.push(signature);
  }
  return found;
}

describe('vc.ts and dean.ts scope DepartmentBudget by hand', () => {
  it.each(FILES.map((f) => [f] as const))('%s has no unscoped DepartmentBudget query', (file) => {
    const src = stripComments(
      readFileSync(fileURLToPath(new URL(`../routes/${file}`, import.meta.url)), 'utf8')
    );
    expect(
      unscopedBudgetRoutes(src),
      `${file} queries DepartmentBudget — which carries no institutionId of ` +
        'its own — without referencing institutionId anywhere in the same ' +
        'handler. Add where: { department: { institutionId } }.'
    ).toEqual([]);
  });

  it('NEGATIVE CONTROL: the scanner finds an unscoped handler and clears a scoped one', () => {
    const bare = `
router.get('/probe', authenticate, async (req, res) => {
  const budgets = await prisma.departmentBudget.findMany({ include: { department: true } });
});`;
    expect(unscopedBudgetRoutes(bare)).toEqual(['GET /probe']);

    const guarded = `
router.get('/probe', authenticate, async (req, res) => {
  const context = getTenantContext(req);
  const budgets = await prisma.departmentBudget.findMany({
    where: { department: { institutionId: context.institutionId } }
  });
});`;
    expect(unscopedBudgetRoutes(guarded)).toEqual([]);
  });
});
