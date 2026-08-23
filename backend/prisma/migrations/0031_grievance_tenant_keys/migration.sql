-- 0031 - Tenant keys for the grievance module.
--
-- GrievanceCase and ComplianceItem carried NO institutionId and were absent from
-- TENANT_OWNED_MODELS. Both tables were global.
--
-- This is the most sensitive instance of that pattern found in this codebase.
-- GrievanceCase holds harassment and ragging complaints, the identity of the
-- complainant (or the deliberate absence of it, for anonymous submissions),
-- evidence file references, an investigation timeline and a resolution. Every
-- grievance officer in the deployment could read and write every institution's
-- cases, and nothing in the record would show that a boundary had been crossed.
--
-- BACKFILL
--
-- Derived from the complainant's institution where one is recorded, then from
-- the assigned officer's. Both are deliberate: an anonymous case has no
-- complainant by design, so the officer handling it is the only remaining link,
-- and falling back to a seed-id check after that keeps the rule from 0027/0028 -
-- guessing a tenant is how records end up filed under the wrong university.
--
-- Anything unresolved aborts. For this table that matters more than most: a
-- misfiled grievance is a complaint delivered to the wrong institution's staff.

ALTER TABLE "GrievanceCase"  ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "ComplianceItem" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;

-- 1. From the complainant, where they identified themselves.
UPDATE "GrievanceCase" g
SET "institutionId" = u."institutionId"
FROM "User" u
WHERE g."institutionId" IS NULL
  AND u.id = g."complainantId";

-- 2. Otherwise from the officer the case is assigned to. This is the only link
--    an anonymous case has, and it is the correct one: the case belongs to the
--    institution whose staff are handling it.
UPDATE "GrievanceCase" g
SET "institutionId" = u."institutionId"
FROM "User" u
WHERE g."institutionId" IS NULL
  AND u.id = g."assignedTo";

UPDATE "GrievanceCase"
SET "institutionId" = '00000000-0000-4000-8000-000000000001'
WHERE "institutionId" IS NULL AND id LIKE 'seed-%';

UPDATE "ComplianceItem"
SET "institutionId" = '00000000-0000-4000-8000-000000000001'
WHERE "institutionId" IS NULL AND id LIKE 'seed-%';

DO $$
DECLARE t TEXT; n INT;
BEGIN
  FOREACH t IN ARRAY ARRAY['GrievanceCase','ComplianceItem']
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE "institutionId" IS NULL', t) INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION
        'Cannot scope % row(s) in %: no complainant, no assignee, not seed data. A misfiled grievance is a complaint delivered to the wrong institution - assign these deliberately.', n, t;
    END IF;
  END LOOP;
END $$;

ALTER TABLE "GrievanceCase"  ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "ComplianceItem" ALTER COLUMN "institutionId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GrievanceCase_institutionId_fkey') THEN
    ALTER TABLE "GrievanceCase" ADD CONSTRAINT "GrievanceCase_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ComplianceItem_institutionId_fkey') THEN
    ALTER TABLE "ComplianceItem" ADD CONSTRAINT "ComplianceItem_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "GrievanceCase_institutionId_idx"  ON "GrievanceCase"("institutionId");
CREATE INDEX IF NOT EXISTS "ComplianceItem_institutionId_idx" ON "ComplianceItem"("institutionId");

-- `grievanceNumber` was GLOBALLY unique. Two universities each numbering their
-- cases GRV-2026-001 would collide, and the second would be unable to file it -
-- the same correctness bug fixed for Department code and Course code earlier.
DROP INDEX IF EXISTS "GrievanceCase_grievanceNumber_key";
ALTER TABLE "GrievanceCase" DROP CONSTRAINT IF EXISTS "GrievanceCase_grievanceNumber_key";
CREATE UNIQUE INDEX IF NOT EXISTS "GrievanceCase_institutionId_grievanceNumber_key"
  ON "GrievanceCase"("institutionId", "grievanceNumber");
