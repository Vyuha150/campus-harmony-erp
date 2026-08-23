-- ═══════════════════════════════════════════════════════════════════════════
-- 0023 — Correct the ApprovalItem status set
--
-- Migration 0022 constrained `status` to the four values named in the model's
-- inline comment: pending | approved | rejected | forwarded.
--
-- The comment was incomplete. The result-publication flow in `dean.ts` also
-- writes `published`, so 0022 broke that path — an UPDATE that had worked began
-- failing the check constraint.
--
-- This is precisely the failure mode documented in Phase 1.3: the CODE is the
-- authority on a column's value set, not a comment and not current table
-- contents. 0022 took the comment at its word and did not audit the writes.
-- The 24 columns constrained in 0020 were re-audited against actual writes after
-- this surfaced; none of them had the same gap.
--
-- Caught in development by a route that had not been exercised. In production it
-- would have appeared as a publication silently failing.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "ApprovalItem" DROP CONSTRAINT IF EXISTS "ApprovalItem_status_check";

ALTER TABLE "ApprovalItem" ADD CONSTRAINT "ApprovalItem_status_check"
  CHECK ("status" IN ('pending', 'approved', 'rejected', 'forwarded', 'published'));
