-- 0034 - Tenant keys for the registrar's tables.
--
-- CertificateRequest, VerificationRequest, RecordChangeRequest,
-- PromotionRequest, RetirementRequest, AdminDocument and GatePass carried no
-- institutionId and were absent from TENANT_OWNED_MODELS. All seven were global.
--
-- VerificationRequest is the one with reach beyond the institution: it is how an
-- employer or another university confirms a degree is real. Every registrar in
-- the deployment could read and decide every institution's verifications, and an
-- issued verification is acted on by people who will never see this system.
--
-- PromotionRequest and RetirementRequest are staff employment records.
-- RecordChangeRequest is the trail for amendments to the register itself.
--
-- Backfill derives from whatever owner column each table actually has - checked
-- against information_schema rather than assumed, after a first attempt tried to
-- handle the differences with an exception handler inside a loop and would not
-- parse. Rows with no derivable owner are assigned only if their id marks them
-- as seed data; anything else aborts, per 0027/0028.

ALTER TABLE "CertificateRequest"  ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "VerificationRequest" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "RecordChangeRequest" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "PromotionRequest"    ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "RetirementRequest"   ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "AdminDocument"       ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "GatePass"            ADD COLUMN IF NOT EXISTS "institutionId" TEXT;

-- studentProfileId -> StudentProfile
UPDATE "CertificateRequest" e SET "institutionId" = sp."institutionId"
  FROM "StudentProfile" sp WHERE e."institutionId" IS NULL AND sp.id = e."studentProfileId";
UPDATE "GatePass" e SET "institutionId" = sp."institutionId"
  FROM "StudentProfile" sp WHERE e."institutionId" IS NULL AND sp.id = e."studentProfileId";

-- studentId -> StudentProfile
UPDATE "VerificationRequest" e SET "institutionId" = sp."institutionId"
  FROM "StudentProfile" sp WHERE e."institutionId" IS NULL AND sp.id = e."studentId";
UPDATE "RecordChangeRequest" e SET "institutionId" = sp."institutionId"
  FROM "StudentProfile" sp WHERE e."institutionId" IS NULL AND sp.id = e."studentId";

-- uploadedBy -> User
UPDATE "AdminDocument" e SET "institutionId" = u."institutionId"
  FROM "User" u WHERE e."institutionId" IS NULL AND u.id = e."uploadedBy";

DO $$
DECLARE t TEXT; n INT;
BEGIN
  FOREACH t IN ARRAY ARRAY['CertificateRequest','VerificationRequest','RecordChangeRequest','PromotionRequest','RetirementRequest','AdminDocument','GatePass']
  LOOP
    EXECUTE format('UPDATE %I SET "institutionId" = ''00000000-0000-4000-8000-000000000001'' WHERE "institutionId" IS NULL AND id LIKE ''seed-%%''', t);
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE "institutionId" IS NULL', t) INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION 'Cannot scope % row(s) in %: no owner can be derived and they are not seed data. Assign them deliberately.', n, t;
    END IF;
    EXECUTE format('ALTER TABLE %I ALTER COLUMN "institutionId" SET NOT NULL', t);
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_institutionId_fkey') THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE', t, t || '_institutionId_fkey');
    END IF;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I("institutionId")', t || '_institutionId_idx', t);
  END LOOP;
END $$;
