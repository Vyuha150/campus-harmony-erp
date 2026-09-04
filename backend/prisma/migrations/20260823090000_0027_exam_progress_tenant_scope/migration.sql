-- 0027 — Give ExamProgress a tenant key (Phase 3a).
--
-- ExamProgress carried NO institutionId and was absent from TENANT_OWNED_MODELS,
-- so the examination schedule was shared across every institution in the
-- deployment. Two handlers made that writable:
--
--   coe.ts:       prisma.examProgress.update({ where: { id }, data: req.body })
--   registrar.ts: prisma.examProgress.update({ where: { id }, data: req.body })
--
-- Two separate defects in one line, both already seen in this codebase:
--
--   1. Update by unique key. The tenant extension can constrain a `where`
--      clause but CANNOT filter a unique-key update, so knowing an id was
--      enough to write another institution's exam. This is what made the
--      pre-0022 approval routes exploitable.
--   2. `data: req.body` — unrestricted mass assignment. Every column was
--      writable, including marksEntered, resultsPublished and status, so an
--      exam could be marked published without any marks being entered.
--
-- Backfill is derived from the coordinator's own institution, matching the
-- approach taken for ApprovalItem in 0022. Rows that cannot be resolved are NOT
-- given a default: guessing a tenant is how data ends up under the wrong
-- university. The migration aborts instead, so the ambiguity is handled by a
-- person who knows the answer.

ALTER TABLE "ExamProgress" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;

UPDATE "ExamProgress" e
SET "institutionId" = u."institutionId"
FROM "User" u
WHERE e."institutionId" IS NULL
  AND (u.id = e.coordinator OR u.name = e.coordinator)
  AND u."institutionId" IS NOT NULL;

DO $$
DECLARE orphans INT;
BEGIN
  SELECT COUNT(*) INTO orphans FROM "ExamProgress" WHERE "institutionId" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION
      'Cannot scope % ExamProgress row(s): the coordinator does not resolve to a user with an institution. Assign these rows deliberately rather than defaulting them.', orphans;
  END IF;
END $$;

ALTER TABLE "ExamProgress" ALTER COLUMN "institutionId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExamProgress_institutionId_fkey') THEN
    ALTER TABLE "ExamProgress"
      ADD CONSTRAINT "ExamProgress_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ExamProgress_institutionId_idx" ON "ExamProgress"("institutionId");

-- `status` was unconstrained, so `data: req.body` could store any string in it.
--
-- The value set was taken from THREE sources, because no single one was right:
--
--   backend writes  scheduling, ongoing, mark_entry, moderation, published
--   frontend uses   the same five, in its stage progression
--   actual data     'evaluation' — written by the seed, in no backend path
--
-- My first attempt at this constraint used only the backend list and was
-- rejected by the existing row. That is the same mistake as migration 0022,
-- which took ApprovalItem's values from an inline comment, missed `published`
-- and broke result publication. One source is never enough.
--
-- `evaluation` is a legacy synonym: COEExamOversight.tsx normalises it to
-- `mark_entry` on read, so the two are already treated as one thing by the only
-- screen that displays them. It is admitted here rather than rewritten, because
-- rewriting rows to tidy a vocabulary is a data change wearing a migration's
-- clothes, and the seed would reintroduce it on the next run anyway.
-- Consolidating the two is a separate, deliberate piece of work.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExamProgress_status_check') THEN
    ALTER TABLE "ExamProgress" ADD CONSTRAINT "ExamProgress_status_check"
      CHECK (status IN ('scheduling','ongoing','evaluation','mark_entry','moderation','completed','published'));
  END IF;
END $$;
