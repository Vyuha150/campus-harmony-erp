-- 0038 - Tenant keys for nine more models with no institution link at all.
--
-- Same audit as 0036/0037, widened past the alumni and VC modules: Company,
-- Facility, Team, Hostel, InterDeptEvent, DegreeRecord, TrainingSession,
-- PlacementMessage and SportsEvent carry no institutionId and no relation to
-- derive one from. Company, Facility, TrainingSession and PlacementMessage
-- are live in placements.ts/dean.ts/hod.ts/sports.ts with the identical
-- unscoped-query shape found in alumni.ts and vc.ts. Team and DegreeRecord
-- have no route querying them at all right now — fixed anyway, on the same
-- reasoning as fixing a door with no key yet cut for it: the leak is in the
-- schema, and the day a route is added to read them it inherits the fix for
-- free instead of needing to remember it.

DO $$
DECLARE t TEXT; n INT;
BEGIN
  FOREACH t IN ARRAY ARRAY['Company', 'Facility', 'Team', 'Hostel', 'InterDeptEvent', 'DegreeRecord', 'TrainingSession', 'PlacementMessage', 'SportsEvent']
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "institutionId" TEXT', t);
    EXECUTE format('UPDATE %I SET "institutionId" = ''00000000-0000-4000-8000-000000000001'' WHERE "institutionId" IS NULL AND id LIKE ''seed-%%''', t);

    EXECUTE format('SELECT COUNT(*) FROM %I WHERE "institutionId" IS NULL', t) INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION 'Cannot scope % row(s) in %: no owner can be derived and they are not seed rows. Assign them deliberately - see migration 0038.', n, t;
    END IF;

    EXECUTE format('ALTER TABLE %I ALTER COLUMN "institutionId" SET NOT NULL', t);
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_institutionId_fkey') THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE', t, t || '_institutionId_fkey');
    END IF;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I("institutionId")', t || '_institutionId_idx', t);
  END LOOP;
END $$;
