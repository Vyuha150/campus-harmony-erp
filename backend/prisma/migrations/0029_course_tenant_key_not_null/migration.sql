-- 0029 - Course.institutionId becomes NOT NULL.
--
-- A NULLABLE tenant key is a hole in the filter. Every scoped query reads
-- `where: { id, institutionId: <caller's> }`, and a row whose institutionId is
-- NULL matches no institution at all -- so it becomes invisible and unwritable
-- rather than leaking. That fails closed, which is the right direction, but it
-- means a row can exist that no one can see or repair through the application.
--
-- Course is tightened here because `PUT /admin/courses/:id` is one of the 17
-- mass-assignment handlers being fixed, and the fix is only as strong as the
-- column it filters on.
--
-- FIVE OTHER tenant-owned models still have a nullable institutionId: User,
-- StudentProfile, FacultyProfile, Department and AcademicYear. All currently
-- hold zero NULL rows. They are NOT changed here -- each is load-bearing for
-- authentication or enrolment and deserves its own migration with its own
-- verification, rather than being swept into a change about something else.
-- Recorded in docs/development-plan/20_PHASE_3_BASELINE.md.

DO $$
DECLARE orphans INT;
BEGIN
  SELECT COUNT(*) INTO orphans FROM "Course" WHERE "institutionId" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION
      'Cannot tighten Course.institutionId: % row(s) are NULL. Assign them before applying this migration.', orphans;
  END IF;
END $$;

ALTER TABLE "Course" ALTER COLUMN "institutionId" SET NOT NULL;
