-- 0036 - Tenant keys for the three alumni models 0028 missed.
--
-- 0028 scoped every model reachable from a raw `update({ where: { id }, data:
-- req.body })` handler. MentorshipProgram, AlumniCommunicationRecord and
-- ProgressionSurvey were never wired to one of those (alumni.ts has no PUT for
-- any of them), so they were out of that migration's scope even though the
-- underlying defect is identical: all three had no institutionId at all, so
-- every mentorship program, newsletter/appeal record, and alumni progression
-- survey in the deployment was visible and creatable by any authenticated
-- alumni officer, from any institution. Found auditing alumni.ts's read
-- endpoints, which is where this class of bug hides — a GET with no `where`
-- clause raises no error and looks correct on screen.
--
-- None of the three has a foreign key to derive an owner from — they are not
-- linked to a student, faculty member, or department. The seed-id heuristic is
-- the only backfill available, matching 0028/0035's fallback for the same
-- situation (QualityMetric, Vacancy, SportsFacility, BroadcastMessage, ...).

DO $$
DECLARE t TEXT; n INT;
BEGIN
  FOREACH t IN ARRAY ARRAY['MentorshipProgram', 'AlumniCommunicationRecord', 'ProgressionSurvey']
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "institutionId" TEXT', t);
    EXECUTE format('UPDATE %I SET "institutionId" = ''00000000-0000-4000-8000-000000000001'' WHERE "institutionId" IS NULL AND id LIKE ''seed-%%''', t);

    EXECUTE format('SELECT COUNT(*) FROM %I WHERE "institutionId" IS NULL', t) INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION 'Cannot scope % row(s) in %: no owner can be derived and they are not seed rows. Assign them deliberately - see migration 0036.', n, t;
    END IF;

    EXECUTE format('ALTER TABLE %I ALTER COLUMN "institutionId" SET NOT NULL', t);
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_institutionId_fkey') THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE', t, t || '_institutionId_fkey');
    END IF;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I("institutionId")', t || '_institutionId_idx', t);
  END LOOP;
END $$;
