-- 0028 - Tenant keys for the 16 models behind the mass-assignment handlers.
--
-- WHY THESE 16 TOGETHER
--
-- 17 handlers across 9 route files carried this line:
--
--     prisma.<model>.update({ where: { id }, data: req.body })
--
-- That is two defects. A unique-key update the tenant extension cannot
-- constrain, and an unfiltered request body making every column writable.
-- Fixing only the second would have left the first open, and the first turned
-- out to be the worse of the two: 16 of these 17 models had NO institutionId at
-- all, so the tables were shared across every institution in the deployment.
-- Sports rosters, incident reports, journal entries, anti-ragging affidavits,
-- transfer requests, broadcast messages and accreditation checklists were all
-- globally readable and writable by any authenticated holder of the relevant
-- role, from any institution.
--
-- BACKFILL
--
-- Derived from a foreign key wherever one exists - a student's affidavit belongs
-- to that student's institution, a journal entry to its author's. Where no path
-- exists, rows are assigned ONLY if their id marks them as seed data, which is a
-- statement of fact about known ids rather than a guess.
--
-- Anything else aborts the migration. That rule is carried over from 0027:
-- guessing a tenant is how records end up filed under the wrong university, and
-- a deployment with real rows in these tables needs a person to assign them.
--
-- SportsTeam is scoped before SportsAttendance, which derives from it.

-- ----------------------------------------------------------------------
-- AlumniEvent
-- ----------------------------------------------------------------------
ALTER TABLE "AlumniEvent" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;

UPDATE "AlumniEvent"
SET "institutionId" = '00000000-0000-4000-8000-000000000001'
WHERE "institutionId" IS NULL AND id LIKE 'seed-%';

DO $$
DECLARE orphans INT;
BEGIN
  SELECT COUNT(*) INTO orphans FROM "AlumniEvent" WHERE "institutionId" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION
      'Cannot scope % row(s) in AlumniEvent: no owner can be derived and they are not seed rows. Assign them deliberately - see migration 0028.', orphans;
  END IF;
END $$;

ALTER TABLE "AlumniEvent" ALTER COLUMN "institutionId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AlumniEvent_institutionId_fkey') THEN
    ALTER TABLE "AlumniEvent"
      ADD CONSTRAINT "AlumniEvent_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "AlumniEvent_institutionId_idx" ON "AlumniEvent"("institutionId");

-- ----------------------------------------------------------------------
-- AlumniJobPosting
-- ----------------------------------------------------------------------
ALTER TABLE "AlumniJobPosting" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;

UPDATE "AlumniJobPosting" e
SET "institutionId" = src."institutionId"
FROM "User" src
WHERE e."institutionId" IS NULL
  AND src.id = e."postedBy"
  AND src."institutionId" IS NOT NULL;

UPDATE "AlumniJobPosting"
SET "institutionId" = '00000000-0000-4000-8000-000000000001'
WHERE "institutionId" IS NULL AND id LIKE 'seed-%';

DO $$
DECLARE orphans INT;
BEGIN
  SELECT COUNT(*) INTO orphans FROM "AlumniJobPosting" WHERE "institutionId" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION
      'Cannot scope % row(s) in AlumniJobPosting: no owner can be derived and they are not seed rows. Assign them deliberately - see migration 0028.', orphans;
  END IF;
END $$;

ALTER TABLE "AlumniJobPosting" ALTER COLUMN "institutionId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AlumniJobPosting_institutionId_fkey') THEN
    ALTER TABLE "AlumniJobPosting"
      ADD CONSTRAINT "AlumniJobPosting_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "AlumniJobPosting_institutionId_idx" ON "AlumniJobPosting"("institutionId");

-- ----------------------------------------------------------------------
-- JournalEntry
-- ----------------------------------------------------------------------
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;

UPDATE "JournalEntry" e
SET "institutionId" = src."institutionId"
FROM "User" src
WHERE e."institutionId" IS NULL
  AND src.id = e."createdBy"
  AND src."institutionId" IS NOT NULL;

UPDATE "JournalEntry"
SET "institutionId" = '00000000-0000-4000-8000-000000000001'
WHERE "institutionId" IS NULL AND id LIKE 'seed-%';

DO $$
DECLARE orphans INT;
BEGIN
  SELECT COUNT(*) INTO orphans FROM "JournalEntry" WHERE "institutionId" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION
      'Cannot scope % row(s) in JournalEntry: no owner can be derived and they are not seed rows. Assign them deliberately - see migration 0028.', orphans;
  END IF;
END $$;

ALTER TABLE "JournalEntry" ALTER COLUMN "institutionId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'JournalEntry_institutionId_fkey') THEN
    ALTER TABLE "JournalEntry"
      ADD CONSTRAINT "JournalEntry_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "JournalEntry_institutionId_idx" ON "JournalEntry"("institutionId");

-- ----------------------------------------------------------------------
-- AntiRaggingAffidavit
-- ----------------------------------------------------------------------
ALTER TABLE "AntiRaggingAffidavit" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;

UPDATE "AntiRaggingAffidavit" e
SET "institutionId" = src."institutionId"
FROM "StudentProfile" src
WHERE e."institutionId" IS NULL
  AND src.id = e."studentId"
  AND src."institutionId" IS NOT NULL;

UPDATE "AntiRaggingAffidavit"
SET "institutionId" = '00000000-0000-4000-8000-000000000001'
WHERE "institutionId" IS NULL AND id LIKE 'seed-%';

DO $$
DECLARE orphans INT;
BEGIN
  SELECT COUNT(*) INTO orphans FROM "AntiRaggingAffidavit" WHERE "institutionId" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION
      'Cannot scope % row(s) in AntiRaggingAffidavit: no owner can be derived and they are not seed rows. Assign them deliberately - see migration 0028.', orphans;
  END IF;
END $$;

ALTER TABLE "AntiRaggingAffidavit" ALTER COLUMN "institutionId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AntiRaggingAffidavit_institutionId_fkey') THEN
    ALTER TABLE "AntiRaggingAffidavit"
      ADD CONSTRAINT "AntiRaggingAffidavit_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "AntiRaggingAffidavit_institutionId_idx" ON "AntiRaggingAffidavit"("institutionId");

-- ----------------------------------------------------------------------
-- QualityMetric
-- ----------------------------------------------------------------------
ALTER TABLE "QualityMetric" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;

UPDATE "QualityMetric"
SET "institutionId" = '00000000-0000-4000-8000-000000000001'
WHERE "institutionId" IS NULL AND id LIKE 'seed-%';

DO $$
DECLARE orphans INT;
BEGIN
  SELECT COUNT(*) INTO orphans FROM "QualityMetric" WHERE "institutionId" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION
      'Cannot scope % row(s) in QualityMetric: no owner can be derived and they are not seed rows. Assign them deliberately - see migration 0028.', orphans;
  END IF;
END $$;

ALTER TABLE "QualityMetric" ALTER COLUMN "institutionId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QualityMetric_institutionId_fkey') THEN
    ALTER TABLE "QualityMetric"
      ADD CONSTRAINT "QualityMetric_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "QualityMetric_institutionId_idx" ON "QualityMetric"("institutionId");

-- ----------------------------------------------------------------------
-- TransferRequest
-- ----------------------------------------------------------------------
ALTER TABLE "TransferRequest" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;

UPDATE "TransferRequest" e
SET "institutionId" = src."institutionId"
FROM "StudentProfile" src
WHERE e."institutionId" IS NULL
  AND src.id = e."studentId"
  AND src."institutionId" IS NOT NULL;

UPDATE "TransferRequest"
SET "institutionId" = '00000000-0000-4000-8000-000000000001'
WHERE "institutionId" IS NULL AND id LIKE 'seed-%';

DO $$
DECLARE orphans INT;
BEGIN
  SELECT COUNT(*) INTO orphans FROM "TransferRequest" WHERE "institutionId" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION
      'Cannot scope % row(s) in TransferRequest: no owner can be derived and they are not seed rows. Assign them deliberately - see migration 0028.', orphans;
  END IF;
END $$;

ALTER TABLE "TransferRequest" ALTER COLUMN "institutionId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TransferRequest_institutionId_fkey') THEN
    ALTER TABLE "TransferRequest"
      ADD CONSTRAINT "TransferRequest_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "TransferRequest_institutionId_idx" ON "TransferRequest"("institutionId");

-- ----------------------------------------------------------------------
-- Vacancy
-- ----------------------------------------------------------------------
ALTER TABLE "Vacancy" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;

UPDATE "Vacancy"
SET "institutionId" = '00000000-0000-4000-8000-000000000001'
WHERE "institutionId" IS NULL AND id LIKE 'seed-%';

DO $$
DECLARE orphans INT;
BEGIN
  SELECT COUNT(*) INTO orphans FROM "Vacancy" WHERE "institutionId" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION
      'Cannot scope % row(s) in Vacancy: no owner can be derived and they are not seed rows. Assign them deliberately - see migration 0028.', orphans;
  END IF;
END $$;

ALTER TABLE "Vacancy" ALTER COLUMN "institutionId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Vacancy_institutionId_fkey') THEN
    ALTER TABLE "Vacancy"
      ADD CONSTRAINT "Vacancy_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Vacancy_institutionId_idx" ON "Vacancy"("institutionId");

-- ----------------------------------------------------------------------
-- AccreditationChecklist
-- ----------------------------------------------------------------------
ALTER TABLE "AccreditationChecklist" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;

UPDATE "AccreditationChecklist"
SET "institutionId" = '00000000-0000-4000-8000-000000000001'
WHERE "institutionId" IS NULL AND id LIKE 'seed-%';

DO $$
DECLARE orphans INT;
BEGIN
  SELECT COUNT(*) INTO orphans FROM "AccreditationChecklist" WHERE "institutionId" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION
      'Cannot scope % row(s) in AccreditationChecklist: no owner can be derived and they are not seed rows. Assign them deliberately - see migration 0028.', orphans;
  END IF;
END $$;

ALTER TABLE "AccreditationChecklist" ALTER COLUMN "institutionId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AccreditationChecklist_institutionId_fkey') THEN
    ALTER TABLE "AccreditationChecklist"
      ADD CONSTRAINT "AccreditationChecklist_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "AccreditationChecklist_institutionId_idx" ON "AccreditationChecklist"("institutionId");

-- ----------------------------------------------------------------------
-- IncidentReport
-- ----------------------------------------------------------------------
ALTER TABLE "IncidentReport" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;

UPDATE "IncidentReport"
SET "institutionId" = '00000000-0000-4000-8000-000000000001'
WHERE "institutionId" IS NULL AND id LIKE 'seed-%';

DO $$
DECLARE orphans INT;
BEGIN
  SELECT COUNT(*) INTO orphans FROM "IncidentReport" WHERE "institutionId" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION
      'Cannot scope % row(s) in IncidentReport: no owner can be derived and they are not seed rows. Assign them deliberately - see migration 0028.', orphans;
  END IF;
END $$;

ALTER TABLE "IncidentReport" ALTER COLUMN "institutionId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IncidentReport_institutionId_fkey') THEN
    ALTER TABLE "IncidentReport"
      ADD CONSTRAINT "IncidentReport_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IncidentReport_institutionId_idx" ON "IncidentReport"("institutionId");

-- ----------------------------------------------------------------------
-- SportsAthlete
-- ----------------------------------------------------------------------
ALTER TABLE "SportsAthlete" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;

UPDATE "SportsAthlete" e
SET "institutionId" = src."institutionId"
FROM "StudentProfile" src
WHERE e."institutionId" IS NULL
  AND src.id = e."studentId"
  AND src."institutionId" IS NOT NULL;

UPDATE "SportsAthlete"
SET "institutionId" = '00000000-0000-4000-8000-000000000001'
WHERE "institutionId" IS NULL AND id LIKE 'seed-%';

DO $$
DECLARE orphans INT;
BEGIN
  SELECT COUNT(*) INTO orphans FROM "SportsAthlete" WHERE "institutionId" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION
      'Cannot scope % row(s) in SportsAthlete: no owner can be derived and they are not seed rows. Assign them deliberately - see migration 0028.', orphans;
  END IF;
END $$;

ALTER TABLE "SportsAthlete" ALTER COLUMN "institutionId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SportsAthlete_institutionId_fkey') THEN
    ALTER TABLE "SportsAthlete"
      ADD CONSTRAINT "SportsAthlete_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "SportsAthlete_institutionId_idx" ON "SportsAthlete"("institutionId");

-- ----------------------------------------------------------------------
-- SportsTeam
-- ----------------------------------------------------------------------
ALTER TABLE "SportsTeam" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;

UPDATE "SportsTeam"
SET "institutionId" = '00000000-0000-4000-8000-000000000001'
WHERE "institutionId" IS NULL AND id LIKE 'seed-%';

DO $$
DECLARE orphans INT;
BEGIN
  SELECT COUNT(*) INTO orphans FROM "SportsTeam" WHERE "institutionId" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION
      'Cannot scope % row(s) in SportsTeam: no owner can be derived and they are not seed rows. Assign them deliberately - see migration 0028.', orphans;
  END IF;
END $$;

ALTER TABLE "SportsTeam" ALTER COLUMN "institutionId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SportsTeam_institutionId_fkey') THEN
    ALTER TABLE "SportsTeam"
      ADD CONSTRAINT "SportsTeam_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "SportsTeam_institutionId_idx" ON "SportsTeam"("institutionId");

-- ----------------------------------------------------------------------
-- SportsAttendance
-- ----------------------------------------------------------------------
ALTER TABLE "SportsAttendance" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;

UPDATE "SportsAttendance" e
SET "institutionId" = src."institutionId"
FROM "SportsTeam" src
WHERE e."institutionId" IS NULL
  AND src.id = e."teamId"
  AND src."institutionId" IS NOT NULL;

UPDATE "SportsAttendance"
SET "institutionId" = '00000000-0000-4000-8000-000000000001'
WHERE "institutionId" IS NULL AND id LIKE 'seed-%';

DO $$
DECLARE orphans INT;
BEGIN
  SELECT COUNT(*) INTO orphans FROM "SportsAttendance" WHERE "institutionId" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION
      'Cannot scope % row(s) in SportsAttendance: no owner can be derived and they are not seed rows. Assign them deliberately - see migration 0028.', orphans;
  END IF;
END $$;

ALTER TABLE "SportsAttendance" ALTER COLUMN "institutionId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SportsAttendance_institutionId_fkey') THEN
    ALTER TABLE "SportsAttendance"
      ADD CONSTRAINT "SportsAttendance_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "SportsAttendance_institutionId_idx" ON "SportsAttendance"("institutionId");

-- ----------------------------------------------------------------------
-- SportsFacility
-- ----------------------------------------------------------------------
ALTER TABLE "SportsFacility" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;

UPDATE "SportsFacility"
SET "institutionId" = '00000000-0000-4000-8000-000000000001'
WHERE "institutionId" IS NULL AND id LIKE 'seed-%';

DO $$
DECLARE orphans INT;
BEGIN
  SELECT COUNT(*) INTO orphans FROM "SportsFacility" WHERE "institutionId" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION
      'Cannot scope % row(s) in SportsFacility: no owner can be derived and they are not seed rows. Assign them deliberately - see migration 0028.', orphans;
  END IF;
END $$;

ALTER TABLE "SportsFacility" ALTER COLUMN "institutionId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SportsFacility_institutionId_fkey') THEN
    ALTER TABLE "SportsFacility"
      ADD CONSTRAINT "SportsFacility_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "SportsFacility_institutionId_idx" ON "SportsFacility"("institutionId");

-- ----------------------------------------------------------------------
-- SportsInventoryItem
-- ----------------------------------------------------------------------
ALTER TABLE "SportsInventoryItem" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;

UPDATE "SportsInventoryItem"
SET "institutionId" = '00000000-0000-4000-8000-000000000001'
WHERE "institutionId" IS NULL AND id LIKE 'seed-%';

DO $$
DECLARE orphans INT;
BEGIN
  SELECT COUNT(*) INTO orphans FROM "SportsInventoryItem" WHERE "institutionId" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION
      'Cannot scope % row(s) in SportsInventoryItem: no owner can be derived and they are not seed rows. Assign them deliberately - see migration 0028.', orphans;
  END IF;
END $$;

ALTER TABLE "SportsInventoryItem" ALTER COLUMN "institutionId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SportsInventoryItem_institutionId_fkey') THEN
    ALTER TABLE "SportsInventoryItem"
      ADD CONSTRAINT "SportsInventoryItem_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "SportsInventoryItem_institutionId_idx" ON "SportsInventoryItem"("institutionId");

-- ----------------------------------------------------------------------
-- Meeting
-- ----------------------------------------------------------------------
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;

UPDATE "Meeting" e
SET "institutionId" = src."institutionId"
FROM "User" src
WHERE e."institutionId" IS NULL
  AND src.id = e."createdBy"
  AND src."institutionId" IS NOT NULL;

UPDATE "Meeting"
SET "institutionId" = '00000000-0000-4000-8000-000000000001'
WHERE "institutionId" IS NULL AND id LIKE 'seed-%';

DO $$
DECLARE orphans INT;
BEGIN
  SELECT COUNT(*) INTO orphans FROM "Meeting" WHERE "institutionId" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION
      'Cannot scope % row(s) in Meeting: no owner can be derived and they are not seed rows. Assign them deliberately - see migration 0028.', orphans;
  END IF;
END $$;

ALTER TABLE "Meeting" ALTER COLUMN "institutionId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Meeting_institutionId_fkey') THEN
    ALTER TABLE "Meeting"
      ADD CONSTRAINT "Meeting_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Meeting_institutionId_idx" ON "Meeting"("institutionId");

-- ----------------------------------------------------------------------
-- BroadcastMessage
-- ----------------------------------------------------------------------
ALTER TABLE "BroadcastMessage" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;

UPDATE "BroadcastMessage"
SET "institutionId" = '00000000-0000-4000-8000-000000000001'
WHERE "institutionId" IS NULL AND id LIKE 'seed-%';

DO $$
DECLARE orphans INT;
BEGIN
  SELECT COUNT(*) INTO orphans FROM "BroadcastMessage" WHERE "institutionId" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION
      'Cannot scope % row(s) in BroadcastMessage: no owner can be derived and they are not seed rows. Assign them deliberately - see migration 0028.', orphans;
  END IF;
END $$;

ALTER TABLE "BroadcastMessage" ALTER COLUMN "institutionId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BroadcastMessage_institutionId_fkey') THEN
    ALTER TABLE "BroadcastMessage"
      ADD CONSTRAINT "BroadcastMessage_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "BroadcastMessage_institutionId_idx" ON "BroadcastMessage"("institutionId");
