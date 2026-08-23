/**
 * Approval guards (Phase 2.1).
 *
 * `ApprovalItem` had no `institutionId` and was absent from
 * TENANT_OWNED_MODELS, so the approval queue was shared across every
 * institution. Demonstrated live before the fix: one institution's HOD listed
 * another institution's confidential item and then successfully APPROVED it.
 *
 * That is a cross-tenant AUTHORITY breach, not merely a read leak — a decision
 * recorded against another university's budget by someone with no standing
 * there, and no trace of the crossing.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { TENANT_OWNED_MODELS } from '../lib/tenantExtension.js';

const routesDir = fileURLToPath(new URL('../routes', import.meta.url));
const routeFiles = readdirSync(routesDir).filter((f) => f.endsWith('.ts'));
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('approval queue is tenant-scoped', () => {
  it('ApprovalItem is in the tenant-owned set', () => {
    expect(TENANT_OWNED_MODELS.has('ApprovalItem')).toBe(true);
  });

  it('the model carries institutionId and a decider', () => {
    const schema = readFileSync(
      fileURLToPath(new URL('../../prisma/schema.prisma', import.meta.url)), 'utf8'
    );
    const block = /model\s+ApprovalItem\s*\{([\s\S]*?)\n\}/.exec(schema);
    expect(block).toBeTruthy();
    expect(block![1]).toMatch(/institutionId\s+String/);
    // An approval with no approver is not an approval; it is an assertion.
    expect(block![1]).toMatch(/decidedBy\s+String\?/);
    expect(block![1]).toMatch(/decidedAt\s+DateTime\?/);
  });
});

describe('approval transitions cannot cross a tenant boundary', () => {
  it('no route decides an approval via update-by-id', () => {
    // The tenant extension constrains a `where` clause but CANNOT filter a
    // unique-key update. `update({ where: { id } })` therefore let anyone
    // holding an id from another institution decide that approval.
    // `updateMany` with a where clause is the form the extension can protect.
    const offenders: string[] = [];

    for (const file of routeFiles) {
      const code = stripComments(readFileSync(join(routesDir, file), 'utf8'));
      // Match `approvalItem.update(` but not `approvalItem.updateMany(`.
      const matches = code.match(/approvalItem\.update\s*\(/g) ?? [];
      if (matches.length > 0) offenders.push(`${file}: ${matches.length}`);
    }

    expect(
      offenders,
      'these use update-by-id, which the tenant extension cannot constrain'
    ).toEqual([]);
  });

  /**
   * A DECISION handler is one that writes a terminal state. Raising a request
   * (writing `pending`) is a different operation and carries none of these
   * obligations — an earlier version of this file conflated the two and failed
   * `coe.ts`, which only raises requests.
   */
  const decisionFiles = routeFiles.filter((file) => {
    const code = stripComments(readFileSync(join(routesDir, file), 'utf8'));
    return /approvalItem\.updateMany\(\{[\s\S]{0,200}status:\s*(status|nextStatus|'(approved|rejected|forwarded|published)')/.test(code);
  });

  it('finds the decision handlers', () => {
    expect(decisionFiles.length).toBeGreaterThan(0);
  });

  /**
   * NOT ASSERTED HERE: "a decision on a request-supplied id must filter on the
   * pending state".
   *
   * The property is real and the code does it (`hod.ts`, `registrar.ts`), but it
   * is per-HANDLER and these checks are per-FILE. `dean.ts` reads
   * `req.params.id` in one handler and calls `updateMany` in an unrelated one,
   * so any file-level regex either passes it wrongly or fails it wrongly. Two
   * attempts at expressing it produced exactly those two outcomes.
   *
   * It is covered instead by:
   *   - the update-by-id ban above, which removes the class of bug outright;
   *   - the status validation and decider checks below;
   *   - a live verification recorded in `19_APPROVAL_CATALOGUE.md`: a second
   *     decision on an already-decided item returned 404, and a cross-tenant
   *     attempt left the row untouched.
   *
   * A test that cannot express its property honestly is worse than a documented
   * gap — it passes for the wrong reason and no one revisits it.
   */

  it('a decided status is validated rather than written raw from the body', () => {
    // Previously `data: { status }` straight from the request, so any string was
    // accepted and an item could skip states entirely.
    for (const file of routeFiles) {
      const code = stripComments(readFileSync(join(routesDir, file), 'utf8'));
      if (!code.includes('approvalItem.updateMany')) continue;
      if (!/status:\s*(status|nextStatus)/.test(code)) continue; // not body-driven
      expect(code, `${file} writes a body-supplied status without validating it`).toMatch(
        /ALLOWED_DECISIONS|'approved',\s*'rejected',\s*'forwarded'/
      );
    }
  });

  it('a terminal decision records who made it', () => {
    for (const file of decisionFiles) {
      const code = stripComments(readFileSync(join(routesDir, file), 'utf8'));
      expect(code, `${file} reaches a terminal state without recording the decider`).toMatch(
        /decidedBy:/
      );
    }
  });
});

describe('the check would catch a regression', () => {
  it('detects update-by-id if reintroduced', () => {
    // Negative control — the matcher must reject the vulnerable form.
    const vulnerable = 'await prisma.approvalItem.update({ where: { id }, data: { status } });';
    expect(vulnerable.match(/approvalItem\.update\s*\(/g)).toHaveLength(1);
    const safe = 'await prisma.approvalItem.updateMany({ where: { id, status: "pending" } });';
    expect(safe.match(/approvalItem\.update\s*\(/g)).toBeNull();
  });
});
