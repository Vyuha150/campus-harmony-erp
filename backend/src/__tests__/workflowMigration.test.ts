/**
 * Phase 2.4 guards — result publication runs on the workflow engine.
 *
 * What these protect against is a regression to a status column. The two
 * handlers below used to keep the process in `ApprovalItem.status`, and a column
 * cannot express "this may only happen after that". The consequences were:
 *
 *   - `PUT /dean/results/:id/approve` did not require a submission. Finding no
 *     row, it CREATED one already marked `published`, so results the CoE had
 *     never submitted could be published and the record afterwards showed an
 *     approval with no request behind it.
 *   - `POST /coe/results/:id/submit` reset ANY existing row to `pending`,
 *     including one already `published`, so a decided item could be reopened in
 *     place and published a second time with no trace of the round trip.
 *
 * Both are verified live in scripts/verify-24-results.sh (12 checks). These
 * static guards exist because the live script needs a running server and a
 * database, so it does not run in CI — without them, someone could restore the
 * old shape and only the manual run would notice.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TENANT_OWNED_MODELS } from '../lib/tenantExtension.js';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const deanCode = stripComments(read('../routes/dean.ts'));
const coeCode = stripComments(read('../routes/coe.ts'));
const schema = read('../../prisma/schema.prisma');

/** The body of one route handler, so a check is per-handler and not per-file. */
function handlerBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start === -1) return '';
  const rest = source.slice(start);
  const end = rest.indexOf('\n});');
  return end === -1 ? rest : rest.slice(0, end);
}

describe('result publication is engine-backed', () => {
  const deanApprove = handlerBody(deanCode, "router.put('/results/:id/approve'");
  const coeSubmit = handlerBody(coeCode, "router.post('/results/:id/submit'");

  it('both handlers were found — otherwise every check below is vacuous', () => {
    expect(deanApprove.length).toBeGreaterThan(200);
    expect(coeSubmit.length).toBeGreaterThan(200);
  });

  it('the dean handler requires an open instance before publishing', () => {
    expect(deanApprove).toMatch(/openInstanceFor\s*\(/);
    expect(deanApprove).toMatch(/workflow\.act\s*\(/);
  });

  it('the dean handler no longer CREATES an approval row', () => {
    // This is the defect itself: publishing used to fabricate a `published`
    // record when it found nothing to approve.
    expect(deanApprove).not.toMatch(/approvalItem\.create\s*\(/);
  });

  it('the CoE handler starts an instance rather than resetting a row', () => {
    expect(coeSubmit).toMatch(/startWorkflow\s*\(/);
    // Resetting a decided item back to `pending` is what allowed a published
    // result to re-enter the queue.
    expect(coeSubmit).not.toMatch(/status:\s*'pending'[\s\S]{0,200}updateMany/);
    expect(coeSubmit).not.toMatch(/updateMany[\s\S]{0,200}status:\s*'pending'/);
  });

  it('neither handler updates an approval by unique key', () => {
    // The tenant extension can constrain a `where` clause but cannot filter a
    // unique-key update — the flaw that made the pre-0022 routes exploitable.
    for (const body of [deanApprove, coeSubmit]) {
      expect(body).not.toMatch(/approvalItem\.update\s*\(\s*\{\s*where:\s*\{\s*id/);
    }
  });

  it('NEGATIVE CONTROL: the matchers do detect the shapes they ban', () => {
    // A guard that cannot fail is not a guard. If these stop matching, the
    // patterns above have drifted and their passes mean nothing.
    const fabricating = "await prisma.approvalItem.create({ data: { status: 'published' } });";
    const byId = 'await prisma.approvalItem.update({ where: { id }, data: {} });';
    expect(fabricating).toMatch(/approvalItem\.create\s*\(/);
    expect(byId).toMatch(/approvalItem\.update\s*\(\s*\{\s*where:\s*\{\s*id/);
  });
});

describe('the queue row is a projection of the instance', () => {
  it('ApprovalItem links to a workflow instance', () => {
    const block = /model\s+ApprovalItem\s*\{([\s\S]*?)\n\}/.exec(schema);
    expect(block).toBeTruthy();
    expect(block![1]).toMatch(/workflowInstanceId\s+String\?/);
  });

  it('discarding an instance must not delete a row a user can see', () => {
    const block = /model\s+ApprovalItem\s*\{([\s\S]*?)\n\}/.exec(schema);
    expect(block![1]).toMatch(/workflowInstanceId\][\s\S]*?onDelete:\s*SetNull/);
  });

  it('workflow models stay tenant-owned', () => {
    for (const model of ['WorkflowDefinition', 'WorkflowInstance', 'ApprovalItem']) {
      expect(TENANT_OWNED_MODELS.has(model)).toBe(true);
    }
  });
});

describe('built-in definitions are installed per institution, not seeded once', () => {
  const builtins = read('../modules/workflow/builtins.ts');
  const bridge = read('../modules/workflow/bridge.ts');

  it('RESULT_PUBLICATION waits on the dean', () => {
    expect(builtins).toMatch(/code:\s*'RESULT_PUBLICATION'/);
    expect(builtins).toMatch(/assigneeRole:\s*'dean'/);
  });

  it('ensureDefinition never overwrites an institution\'s own version', () => {
    // A seed runs once against one database; every institution created later
    // would have no definition and a route that throws.
    expect(bridge).toMatch(/if\s*\(existing\)\s*return/);
  });
});
