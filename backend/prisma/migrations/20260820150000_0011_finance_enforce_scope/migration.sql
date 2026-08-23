-- ═══════════════════════════════════════════════════════════════════════════
-- 0011 — Enforce tenant scope on FeeStructure
--
-- Separated from 0010 so there is a point at which the operator can assign
-- ownership for rows the system cannot derive. 0010 adds the column and fills
-- in what is unambiguous; between the two, a human resolves the rest; this
-- migration makes the constraint real.
--
-- If anything is still unassigned, this FAILS rather than picking an
-- institution. A fee structure attributed to the wrong institution produces
-- wrong fee demands for real students, and would be discovered by the people
-- receiving them.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE unresolved INTEGER; sample TEXT;
BEGIN
  SELECT COUNT(*) INTO unresolved FROM "FeeStructure" WHERE "institutionId" IS NULL;

  IF unresolved > 0 THEN
    SELECT string_agg(id, ', ') INTO sample
    FROM (SELECT id FROM "FeeStructure" WHERE "institutionId" IS NULL LIMIT 10) s;

    RAISE EXCEPTION
      E'% FeeStructure row(s) have no institutionId and cannot be scoped automatically.\n'
      'Affected id(s): %\n\n'
      'Assign each one before re-running:\n'
      '  UPDATE "FeeStructure" SET "institutionId" = ''<institution-uuid>'' WHERE id = ''<row-id>'';\n\n'
      'List institutions with:  SELECT id, name, code FROM "Institution";\n'
      'This is refused rather than guessed because a fee structure on the wrong '
      'institution generates incorrect fee demands for real students.',
      unresolved, sample;
  END IF;
END $$;

ALTER TABLE "FeeStructure" ALTER COLUMN "institutionId" SET NOT NULL;
