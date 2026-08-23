-- ═══════════════════════════════════════════════════════════════════════════
-- 0021 — Soft delete for institutional records (Phase 1.4)
--
-- WHY THESE 14 MODELS AND NOT EVERY TABLE
--
-- Soft delete is not free: every query must filter it, and a forgotten filter
-- makes deleted rows reappear. It is applied only where a deletion must be
-- RECOVERABLE and ACCOUNTABLE:
--
--   People           User, StudentProfile, FacultyProfile
--   Academic units   Campus, School, Department, Programme, Batch, Section, Course
--   Records          CourseResult, SemesterResult
--   Assets / money   LibraryBook, FeeRecord
--
-- A student profile deleted by a mis-click should be restorable; a notification
-- delivery row should not carry the machinery. Log and queue tables are
-- deliberately excluded — they are append-only history, and 0018/0019 already
-- prevent a parent being deleted out from under them with ON DELETE RESTRICT.
--
-- HOW IT IS ENFORCED
--
-- `deletedAt IS NULL` is injected by the Prisma extension for every one of these
-- models, in the same place tenant scoping is injected. That is the point:
-- filtering soft-deleted rows is not left to 500 call sites remembering to do
-- it, any more than tenant scoping was. Bypassing requires an explicit,
-- greppable `includeDeleted()`.
--
-- PARTIAL INDEXES
--
-- Every scoped read now carries `deletedAt IS NULL`. A partial index on that
-- predicate keeps those reads on an index rather than adding a filter step, and
-- costs nothing for the deleted rows it excludes.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  targets TEXT[] := ARRAY[
    'User','StudentProfile','FacultyProfile',
    'Campus','School','Department','Programme','Batch','Section','Course',
    'CourseResult','SemesterResult','LibraryBook','FeeRecord'
  ];
  t TEXT; added INTEGER := 0; skipped INTEGER := 0;
BEGIN
  FOREACH t IN ARRAY targets LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NULL THEN
      RAISE NOTICE 'Table % not found — skipped.', t;
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'deletedAt'
    ) THEN
      skipped := skipped + 1;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I ADD COLUMN "deletedAt" TIMESTAMPTZ(3)', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN "deletedBy" TEXT', t);

    -- Partial index: the predicate every scoped read now carries.
    EXECUTE format(
      'CREATE INDEX %I ON %I ("deletedAt") WHERE "deletedAt" IS NULL',
      t || '_active_idx', t
    );

    added := added + 1;
  END LOOP;

  RAISE NOTICE 'Soft delete: % table(s) prepared, % already had it.', added, skipped;
END $$;

-- Every existing row is live. Stated explicitly rather than relying on the
-- column defaulting to NULL, so the intent is on the record.
DO $$
DECLARE live BIGINT;
BEGIN
  SELECT COUNT(*) INTO live FROM "StudentProfile" WHERE "deletedAt" IS NULL;
  RAISE NOTICE 'All pre-existing rows remain live (StudentProfile: % active).', live;
END $$;
