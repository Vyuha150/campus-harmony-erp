-- 0037 - Tenant keys for the three VC-dashboard models with no institution
-- link at all: InstitutionKPI, ComplianceReport, PolicyScenario.
--
-- Same class of gap as 0036: none of the three is reachable from a raw
-- `update({ where: { id }, data: req.body })` handler, so 0028's sweep never
-- looked at them, but every GET in vc.ts against them had no institutionId
-- filter. Worse for InstitutionKPI specifically — `GET /dashboard` seeds three
-- fabricated KPI rows ("Overall Placement: 92%", ...) the FIRST time the table
-- is empty, with no institutionId to scope that check by. On a multi-tenant
-- deployment the second institution to ever load the VC dashboard would find
-- the first institution's rows already there (or, before either had any,
-- would trigger the fabricated seed and then EVERY institution would see
-- those same three invented numbers forever — a global fabrication, not just
-- a global leak). That handler is fixed in the same change as this migration.
--
-- PolicyScenario has a createdBy column (a User id, no formal FK) that can
-- derive an owner properly. InstitutionKPI and ComplianceReport have nothing
-- to derive from and get the seed-id fallback only.

ALTER TABLE "PolicyScenario" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
UPDATE "PolicyScenario" ps
SET "institutionId" = u."institutionId"
FROM "User" u
WHERE ps."institutionId" IS NULL AND u.id = ps."createdBy" AND u."institutionId" IS NOT NULL;

DO $$
DECLARE t TEXT; n INT;
BEGIN
  FOREACH t IN ARRAY ARRAY['InstitutionKPI', 'ComplianceReport', 'PolicyScenario']
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "institutionId" TEXT', t);
    EXECUTE format('UPDATE %I SET "institutionId" = ''00000000-0000-4000-8000-000000000001'' WHERE "institutionId" IS NULL AND id LIKE ''seed-%%''', t);

    EXECUTE format('SELECT COUNT(*) FROM %I WHERE "institutionId" IS NULL', t) INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION 'Cannot scope % row(s) in %: no owner can be derived and they are not seed rows. Assign them deliberately - see migration 0037.', n, t;
    END IF;

    EXECUTE format('ALTER TABLE %I ALTER COLUMN "institutionId" SET NOT NULL', t);
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_institutionId_fkey') THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE', t, t || '_institutionId_fkey');
    END IF;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I("institutionId")', t || '_institutionId_idx', t);
  END LOOP;
END $$;
