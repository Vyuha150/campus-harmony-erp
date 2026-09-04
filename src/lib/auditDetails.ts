/**
 * Audit `details` is a composed string, not free text.
 *
 * `composeDetails` (backend/src/lib/audit.ts) joins the human summary with an
 * optional reason and a JSON diff:
 *
 *     "<summary> | Reason: <why> | Change: {"old":...,"new":...}"
 *
 * That is deliberate — the schema has no dedicated oldValue/newValue columns
 * yet, and capturing the diff mattered more than waiting for a migration. But
 * screens were rendering the whole string, so an administrator reading Recent
 * Activity saw escaped JSON stretching off the row rather than what happened.
 */

export interface AuditDetail {
  /** The human sentence: everything before the structured suffixes. */
  summary: string;
  /** The stated reason, where the action required one. */
  reason: string | null;
  /** The raw JSON diff, still available for a detail view. */
  change: string | null;
}

export function parseAuditDetails(details: string): AuditDetail {
  const text = String(details ?? '');
  const reasonMatch = /(?:^|\s\|\s)Reason:\s([\s\S]*?)(?=\s\|\s(?:Change:)|$)/.exec(text);
  const changeIndex = text.indexOf(' | Change: ');

  // The Prisma extension writes a different shape for structural writes
  // (structuralAudit.ts): "<ACTION> <Model> via <op> — {json}". Same problem,
  // different separator, so it is cut here too.
  const structuralIndex = text.indexOf(' — {');

  let summary = text;
  const cutAt = [text.indexOf(' | Reason: '), changeIndex, structuralIndex].filter((i) => i >= 0);
  if (cutAt.length > 0) summary = text.slice(0, Math.min(...cutAt));

  return {
    summary: summary.trim(),
    reason: reasonMatch ? reasonMatch[1]!.trim() : null,
    change:
      changeIndex >= 0
        ? text.slice(changeIndex + ' | Change: '.length)
        : structuralIndex >= 0
          ? text.slice(structuralIndex + 3)
          : null,
  };
}
