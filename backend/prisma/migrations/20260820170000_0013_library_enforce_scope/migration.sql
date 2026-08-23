-- ═══════════════════════════════════════════════════════════════════════════
-- 0013 — Enforce tenant scope and accession numbers on LibraryBook
--
-- Same two-step as the finance migrations: 0012 derives what it can, a human
-- resolves anything ambiguous, and this makes the constraints real.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE unresolved INTEGER; sample TEXT;
BEGIN
  SELECT COUNT(*) INTO unresolved FROM "LibraryBook" WHERE "institutionId" IS NULL;

  IF unresolved > 0 THEN
    SELECT string_agg(id, ', ') INTO sample
    FROM (SELECT id FROM "LibraryBook" WHERE "institutionId" IS NULL LIMIT 10) s;

    RAISE EXCEPTION
      E'% LibraryBook row(s) have no institutionId.\nAffected id(s): %\n\n'
      'Assign each before re-running:\n'
      '  UPDATE "LibraryBook" SET "institutionId" = ''<institution-uuid>'' WHERE id = ''<row-id>'';\n'
      'List institutions with:  SELECT id, name, code FROM "Institution";',
      unresolved, sample;
  END IF;
END $$;

-- Any copy still lacking an accession number gets one now. Unlike institution
-- ownership this can be assigned safely without a human: an accession number is
-- an internal identifier, and a wrong one misfiles a book rather than
-- misattributing it to another institution.
WITH numbered AS (
  SELECT "id",
         ROW_NUMBER() OVER (PARTITION BY "institutionId" ORDER BY "isbn", "id") AS seq,
         "institutionId"
  FROM "LibraryBook"
  WHERE "accessionNumber" IS NULL
)
UPDATE "LibraryBook" lb
SET "accessionNumber" = 'ACC-MIG-' || LPAD(numbered.seq::text, 6, '0')
FROM numbered
WHERE lb."id" = numbered."id";

ALTER TABLE "LibraryBook" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "LibraryBook" ALTER COLUMN "accessionNumber" SET NOT NULL;

CREATE UNIQUE INDEX "LibraryBook_institutionId_accessionNumber_key"
    ON "LibraryBook"("institutionId", "accessionNumber");
