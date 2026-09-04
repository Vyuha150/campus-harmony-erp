-- 0035 - Tenant keys for the security module, and soft delete for the records
-- that must not be destroyable.
--
-- VisitorPass, PatrolLog, IDCardRequest, VehiclePass, VigilanceCase,
-- SupportTicket and HostelAccessLog carried no institutionId. All seven global.
--
-- VigilanceCase is the sensitive one: confidential investigations, with evidence
-- files behind the authenticated download path added in Phase 0.3. Every
-- security officer in the deployment could read every institution's, and
-- `DELETE /security/vigilance-cases/:id` destroyed one outright with nothing
-- recorded.
--
-- SOFT DELETE, not a hard one, for VigilanceCase and IncidentReport.
--
-- These are the record that something was investigated. An investigation that
-- can be erased by the office conducting it is not evidence of anything, and the
-- erasure is exactly the event an auditor would want to see. `deletedAt` keeps
-- the row and the tenant extension filters it structurally, so it disappears
-- from every screen without disappearing from the database.

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['VisitorPass','PatrolLog','IDCardRequest','VehiclePass','VigilanceCase','SupportTicket','HostelAccessLog']
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "institutionId" TEXT', t);
    EXECUTE format('UPDATE %I SET "institutionId" = ''00000000-0000-4000-8000-000000000001'' WHERE "institutionId" IS NULL AND id LIKE ''seed-%%''', t);
  END LOOP;
END $$;

-- HostelAccessLog references a student, so it can be derived properly. The
-- column is `studentId`, NOT `studentProfileId` — checked against
-- information_schema after a first attempt assumed the latter and failed. That
-- is the same assumption 0034 was rewritten to avoid; assuming a column name is
-- how a migration discovers the schema at the worst possible moment.
UPDATE "HostelAccessLog" e SET "institutionId" = sp."institutionId"
  FROM "StudentProfile" sp WHERE e."institutionId" IS NULL AND sp.id = e."studentId";

DO $$
DECLARE t TEXT; n INT;
BEGIN
  FOREACH t IN ARRAY ARRAY['VisitorPass','PatrolLog','IDCardRequest','VehiclePass','VigilanceCase','SupportTicket','HostelAccessLog']
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE "institutionId" IS NULL', t) INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION 'Cannot scope % row(s) in %: not seed data and no owner derivable. Assign them deliberately.', n, t;
    END IF;
    EXECUTE format('ALTER TABLE %I ALTER COLUMN "institutionId" SET NOT NULL', t);
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_institutionId_fkey') THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE', t, t || '_institutionId_fkey');
    END IF;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I("institutionId")', t || '_institutionId_idx', t);
  END LOOP;
END $$;

ALTER TABLE "VigilanceCase"  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ(3);
ALTER TABLE "VigilanceCase"  ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;
ALTER TABLE "IncidentReport" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ(3);
ALTER TABLE "IncidentReport" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;
CREATE INDEX IF NOT EXISTS "VigilanceCase_deletedAt_idx"  ON "VigilanceCase"("deletedAt");
CREATE INDEX IF NOT EXISTS "IncidentReport_deletedAt_idx" ON "IncidentReport"("deletedAt");
