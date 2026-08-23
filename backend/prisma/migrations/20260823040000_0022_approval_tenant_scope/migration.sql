-- ═══════════════════════════════════════════════════════════════════════════
-- 0022 — Tenant-scope ApprovalItem, and record who decided (P0)
--
-- ── THE BREACH ────────────────────────────────────────────────────────────
--
-- `ApprovalItem` had NO institutionId and was absent from TENANT_OWNED_MODELS,
-- so the approval queue was SHARED ACROSS EVERY INSTITUTION. Demonstrated live:
-- one institution's HOD listed another institution's confidential item, and then
-- successfully APPROVED it.
--
-- That is worse than the tenant leaks fixed in 0010/0012. Those exposed data;
-- this exposed AUTHORITY — a decision recorded against another university's
-- budget, taken by someone with no standing there and no trace of the crossing.
--
-- ── ALSO FIXED HERE ───────────────────────────────────────────────────────
--
--   * `status` was written straight from the request body (`data: { status }`),
--     so an item could be set to any string at all and skip states entirely.
--     Now constrained to the documented set.
--
--   * The model recorded who REQUESTED but never who DECIDED. An approval with
--     no approver is not an approval; it is an assertion.
--
-- The full catalogue of approval paths is in `19_APPROVAL_CATALOGUE.md`.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "ApprovalItem" ADD COLUMN "institutionId" TEXT;
ALTER TABLE "ApprovalItem" ADD COLUMN "decidedBy" TEXT;
ALTER TABLE "ApprovalItem" ADD COLUMN "decidedAt" TIMESTAMPTZ(3);
ALTER TABLE "ApprovalItem" ADD COLUMN "decisionNote" TEXT;

-- Derive ownership from the requester's own institution: the person who raised
-- the request belongs to exactly one, so this is authoritative rather than a guess.
UPDATE "ApprovalItem" a
SET "institutionId" = u."institutionId"
FROM "User" u
WHERE a."requestedBy" = u.id AND a."institutionId" IS NULL;

-- Anything left cannot be attributed. Refused rather than guessed: assigning an
-- approval to the wrong institution recreates the exact breach being closed.
DO $$
DECLARE orphans INTEGER; sample TEXT;
BEGIN
  SELECT COUNT(*) INTO orphans FROM "ApprovalItem" WHERE "institutionId" IS NULL;
  IF orphans > 0 THEN
    SELECT string_agg(id, ', ') INTO sample
    FROM (SELECT id FROM "ApprovalItem" WHERE "institutionId" IS NULL LIMIT 10) s;
    RAISE EXCEPTION
      E'% approval item(s) cannot be attributed to an institution (requester not found).\nAffected: %\nAssign "institutionId" by hand before re-running.',
      orphans, sample;
  END IF;
END $$;

ALTER TABLE "ApprovalItem" ALTER COLUMN "institutionId" SET NOT NULL;

CREATE INDEX "ApprovalItem_institutionId_idx" ON "ApprovalItem"("institutionId");
CREATE INDEX "ApprovalItem_status_idx" ON "ApprovalItem"("status");

ALTER TABLE "ApprovalItem" ADD CONSTRAINT "ApprovalItem_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ApprovalItem" ADD CONSTRAINT "ApprovalItem_status_check"
  CHECK ("status" IN ('pending', 'approved', 'rejected', 'forwarded'));
