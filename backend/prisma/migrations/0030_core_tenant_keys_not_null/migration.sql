-- 0030 - The last five nullable tenant keys become NOT NULL.
--
-- User, StudentProfile, FacultyProfile, Department and AcademicYear each carried
-- a NULLABLE institutionId. Migration 0029 tightened Course and explicitly
-- deferred these five, because each is load-bearing for authentication or
-- enrolment and deserved its own migration rather than being swept into a change
-- about something else. This is that migration.
--
-- WHY NULLABLE IS A HOLE, NOT A CONVENIENCE
--
-- Every scoped query reads `where: { ..., institutionId: <caller's> }`. A row
-- whose institutionId is NULL matches NO institution, so it does not leak - it
-- disappears. That fails closed, which is the right direction, but it produces
-- rows that exist in the database and cannot be seen or repaired through the
-- application by anyone.
--
-- For `User` specifically it is worse than invisibility: `resolveTenantContext`
-- derives the request's institution FROM the user row. A user with no
-- institution has no derivable context, so every tenant-scoped route rejects
-- them - an account that can authenticate and then do nothing.
--
-- All five hold zero NULL rows today. The guards below are not ceremony: they
-- are what makes this migration safe to run against a database that is NOT this
-- one, where that may not be true.

DO $$
DECLARE
  t TEXT;
  n INT;
BEGIN
  FOREACH t IN ARRAY ARRAY['User','StudentProfile','FacultyProfile','Department','AcademicYear']
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE "institutionId" IS NULL', t) INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION
        'Cannot tighten %.institutionId: % row(s) are NULL. Assign them before applying this migration - see 0030.', t, n;
    END IF;
  END LOOP;
END $$;

ALTER TABLE "User"           ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "StudentProfile" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "FacultyProfile" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "Department"     ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "AcademicYear"   ALTER COLUMN "institutionId" SET NOT NULL;
