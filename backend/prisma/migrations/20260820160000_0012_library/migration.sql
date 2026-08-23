-- ═══════════════════════════════════════════════════════════════════════════
-- 0012 — Library: tenant scoping, physical copies, circulation history
--
-- Four defects are addressed:
--
--   1. LibraryBook had NO institutionId and was absent from TENANT_OWNED_MODELS.
--      Every library query — including the dashboard counts — spanned all
--      institutions.
--
--   2. `isbn` was globally UNIQUE. A library could hold only one copy of any
--      title, and once one institution catalogued a book, no other institution
--      could. Copies are now keyed by accession number, per institution.
--
--   3. Returning a book cleared `studentProfileId`, destroying the record of
--      who had borrowed it — and leaving any fine attached to the copy with no
--      link to the person who owed it. Circulation now lives in LibraryLoan.
--
--   4. Loan period and fine rate were hardcoded (14 days) or accepted from the
--      client (the fine). Both are now per-institution policy.
--
-- Existing loans are MIGRATED, not discarded: the open loan in the current data
-- becomes a LibraryLoan row with its dates preserved.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Policy table ────────────────────────────────────────────────────────

CREATE TABLE "LibraryPolicy" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "loanPeriodDays" INTEGER NOT NULL DEFAULT 14,
    "maxRenewals" INTEGER NOT NULL DEFAULT 2,
    "renewalDays" INTEGER NOT NULL DEFAULT 14,
    "finePerDay" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "graceDays" INTEGER NOT NULL DEFAULT 0,
    "maxFine" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "maxBooksPerStudent" INTEGER NOT NULL DEFAULT 3,
    "blockIssueAboveFine" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LibraryPolicy_institutionId_key" ON "LibraryPolicy"("institutionId");

-- Every institution gets the defaults. Without a policy row the service would
-- have to invent one at runtime, which is the fabrication pattern removed in
-- phase 0.2.
INSERT INTO "LibraryPolicy" ("id", "institutionId", "updatedAt")
SELECT gen_random_uuid()::text, "id", CURRENT_TIMESTAMP FROM "Institution";

-- ── 2. Scope and restructure LibraryBook ───────────────────────────────────

ALTER TABLE "LibraryBook" ADD COLUMN "institutionId" TEXT;
ALTER TABLE "LibraryBook" ADD COLUMN "accessionNumber" TEXT;
ALTER TABLE "LibraryBook" ADD COLUMN "publisher" TEXT;
ALTER TABLE "LibraryBook" ADD COLUMN "edition" TEXT;
ALTER TABLE "LibraryBook" ADD COLUMN "currentLoanId" TEXT;
ALTER TABLE "LibraryBook" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "LibraryBook" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Derive ownership from the borrower where a copy is currently issued.
UPDATE "LibraryBook" lb
SET "institutionId" = sp."institutionId"
FROM "StudentProfile" sp
WHERE lb."studentProfileId" = sp."id"
  AND lb."institutionId" IS NULL;

-- Otherwise fall back to the only institution, if there is only one.
DO $$
DECLARE inst_count INTEGER; only_inst TEXT; unresolved INTEGER;
BEGIN
  SELECT COUNT(*) INTO inst_count FROM "Institution";

  IF inst_count = 1 THEN
    SELECT "id" INTO only_inst FROM "Institution" LIMIT 1;
    UPDATE "LibraryBook" SET "institutionId" = only_inst WHERE "institutionId" IS NULL;
  END IF;

  SELECT COUNT(*) INTO unresolved FROM "LibraryBook" WHERE "institutionId" IS NULL;

  IF unresolved > 0 THEN
    -- A warning here; migration 0013 enforces. Same two-step as the finance
    -- migrations, so the operator has somewhere to record the decision.
    RAISE WARNING
      '% LibraryBook row(s) could not be scoped automatically (% institutions exist). Assign "institutionId" before running migration 0013.',
      unresolved, inst_count;
  END IF;
END $$;

-- Accession numbers for existing copies. Numbered per institution in a stable
-- order so a re-run produces the same result.
WITH numbered AS (
  SELECT "id",
         ROW_NUMBER() OVER (PARTITION BY "institutionId" ORDER BY "isbn", "id") AS seq
  FROM "LibraryBook"
  WHERE "accessionNumber" IS NULL AND "institutionId" IS NOT NULL
)
UPDATE "LibraryBook" lb
SET "accessionNumber" = 'ACC-' || LPAD(numbered.seq::text, 6, '0')
FROM numbered
WHERE lb."id" = numbered."id";

-- The global ISBN uniqueness is what prevented multiple copies and blocked
-- other institutions. Dropped in favour of a per-institution accession key.
DROP INDEX IF EXISTS "LibraryBook_isbn_key";

CREATE INDEX "LibraryBook_institutionId_idx" ON "LibraryBook"("institutionId");
CREATE INDEX "LibraryBook_isbn_idx" ON "LibraryBook"("isbn");
CREATE INDEX "LibraryBook_status_idx" ON "LibraryBook"("status");
CREATE INDEX "LibraryBook_title_idx" ON "LibraryBook"("title");

-- ── 3. Circulation history ─────────────────────────────────────────────────

CREATE TABLE "LibraryLoan" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "renewalCount" INTEGER NOT NULL DEFAULT 0,
    "fineAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finePaid" BOOLEAN NOT NULL DEFAULT false,
    "fineWaivedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fineWaiverReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "issuedBy" TEXT NOT NULL,
    "returnedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryLoan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LibraryLoan_institutionId_idx" ON "LibraryLoan"("institutionId");
CREATE INDEX "LibraryLoan_bookId_idx" ON "LibraryLoan"("bookId");
CREATE INDEX "LibraryLoan_studentProfileId_idx" ON "LibraryLoan"("studentProfileId");
CREATE INDEX "LibraryLoan_status_idx" ON "LibraryLoan"("status");
CREATE INDEX "LibraryLoan_dueAt_idx" ON "LibraryLoan"("dueAt");

-- RESTRICT: a copy or a student with circulation history cannot be deleted out
-- from under it. Losing the record of who has a book is how books go missing.
ALTER TABLE "LibraryLoan" ADD CONSTRAINT "LibraryLoan_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "LibraryBook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LibraryLoan" ADD CONSTRAINT "LibraryLoan_studentProfileId_fkey"
    FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One open loan per copy. This is the constraint that makes double-issue
-- impossible at the database level, not merely unlikely.
CREATE UNIQUE INDEX "LibraryLoan_bookId_active_key"
    ON "LibraryLoan"("bookId") WHERE "status" = 'active';

-- Migrate the currently-issued copies into loans rather than losing them.
INSERT INTO "LibraryLoan" (
  "id", "institutionId", "bookId", "studentProfileId",
  "issuedAt", "dueAt", "renewalCount", "fineAmount", "status", "issuedBy", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  lb."institutionId",
  lb."id",
  lb."studentProfileId",
  COALESCE(lb."issuedDate", CURRENT_TIMESTAMP),
  COALESCE(lb."dueDate", CURRENT_TIMESTAMP + INTERVAL '14 days'),
  COALESCE(lb."renewalCount", 0),
  COALESCE(lb."fine", 0),
  'active',
  -- The original issuing librarian was never recorded, so this is marked as
  -- migrated rather than attributed to someone who may not have done it.
  'migrated-0012',
  CURRENT_TIMESTAMP
FROM "LibraryBook" lb
WHERE lb."studentProfileId" IS NOT NULL
  AND lb."institutionId" IS NOT NULL
  AND lb."status" IN ('issued', 'overdue');

UPDATE "LibraryBook" lb
SET "currentLoanId" = ll."id", "status" = 'issued'
FROM "LibraryLoan" ll
WHERE ll."bookId" = lb."id" AND ll."status" = 'active';

-- ── 4. Retire the superseded columns ───────────────────────────────────────
--
-- Dropped only AFTER the data above has been copied into LibraryLoan.
ALTER TABLE "LibraryBook" DROP COLUMN "studentProfileId";
ALTER TABLE "LibraryBook" DROP COLUMN "issuedDate";
ALTER TABLE "LibraryBook" DROP COLUMN "dueDate";
ALTER TABLE "LibraryBook" DROP COLUMN "returnedDate";
ALTER TABLE "LibraryBook" DROP COLUMN "fine";
ALTER TABLE "LibraryBook" DROP COLUMN "renewalCount";
ALTER TABLE "LibraryBook" DROP COLUMN "maxRenewals";

-- 'returned' was a status on the COPY, which conflated the copy's availability
-- with the loan's state. A returned copy is simply available.
UPDATE "LibraryBook" SET "status" = 'available' WHERE "status" = 'returned';
