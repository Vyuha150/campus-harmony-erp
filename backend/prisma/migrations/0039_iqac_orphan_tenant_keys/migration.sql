-- 0039 - Tenant keys for IQAC's four orphan models, and a global-unique fix.
--
-- Same audit, same defect, fourth module: AQARRecord, IQACActionItem,
-- QualityDocument and IQACMeeting carry no institutionId and no relation to
-- derive one from — `generatedBy`/`assignedTo`/`uploadedBy`/`chairperson` are
-- free-text strings, not foreign keys. GET /iqac/reports, GET
-- /iqac/action-items (etc.), the quality-document library and every IQAC
-- meeting were global: any institution's IQAC officer could read (and, on
-- create, mix into) every other institution's accreditation data.
--
-- AQARRecord.academicYear also carried a bare UNIQUE constraint — global
-- across every institution, so two institutions could not both file an AQAR
-- for the same academic year. Same defect as Company.name (see the follow-up
-- task for that one); fixed here in the same migration since it is the exact
-- column being touched. Replaced with a composite unique on
-- (academicYear, institutionId).

DO $$
DECLARE t TEXT; n INT;
BEGIN
  FOREACH t IN ARRAY ARRAY['AQARRecord', 'IQACActionItem', 'QualityDocument', 'IQACMeeting']
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "institutionId" TEXT', t);
    EXECUTE format('UPDATE %I SET "institutionId" = ''00000000-0000-4000-8000-000000000001'' WHERE "institutionId" IS NULL AND id LIKE ''seed-%%''', t);

    EXECUTE format('SELECT COUNT(*) FROM %I WHERE "institutionId" IS NULL', t) INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION 'Cannot scope % row(s) in %: no owner can be derived and they are not seed rows. Assign them deliberately - see migration 0039.', n, t;
    END IF;

    EXECUTE format('ALTER TABLE %I ALTER COLUMN "institutionId" SET NOT NULL', t);
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_institutionId_fkey') THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE', t, t || '_institutionId_fkey');
    END IF;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I("institutionId")', t || '_institutionId_idx', t);
  END LOOP;
END $$;

-- AQARRecord.academicYear: global unique -> per-institution unique.
--
-- Prisma's `@unique` on this column materialized as a bare unique INDEX, not
-- a table CONSTRAINT — `pg_constraint` has no row for it, so `ALTER TABLE ...
-- DROP CONSTRAINT IF EXISTS` silently no-ops (confirmed live: it printed
-- "does not exist, skipping" while `\d` still showed the index). Drop the
-- index directly instead.
DROP INDEX IF EXISTS "AQARRecord_academicYear_key";
ALTER TABLE "AQARRecord" DROP CONSTRAINT IF EXISTS "AQARRecord_academicYear_key";
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AQARRecord_academicYear_institutionId_key') THEN
    ALTER TABLE "AQARRecord" ADD CONSTRAINT "AQARRecord_academicYear_institutionId_key" UNIQUE ("academicYear", "institutionId");
  END IF;
END $$;
