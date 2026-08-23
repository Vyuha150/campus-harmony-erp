-- ═══════════════════════════════════════════════════════════════════════════
-- 0018 — Foreign keys from every tenant-owned table to Institution
--
-- 50 tables carry `institutionId`; only 6 had a foreign key. The other 44
-- columns pointed at Institution with nothing enforcing that the target exists.
--
-- WHY THIS ONE MATTERS MORE THAN A TYPICAL MISSING FK
--
-- `institutionId` is the TENANT KEY. Every read is scoped by it (ADR-0001), so a
-- row naming an institution that does not exist is not merely inconsistent — it
-- is unreachable. The tenant extension filters on the caller's institution, that
-- row matches nobody, and it silently disappears from every query, export and
-- report. Invisible data loss, with no error anywhere.
--
-- SURVEY BEFORE WRITING THIS (checked, not assumed):
--   110 unconstrained `*Id` columns in total
--    77 with a target inferable from the name — ZERO orphaned references
--    44 of those are `institutionId`, handled here
--
-- Columns deliberately NOT constrained, because they are not references:
--   FacultyProfile.employeeId       the institution's own staff number
--   FeeRecord.transactionId         a payment gateway's reference string
--   NotificationDelivery.providerMessageId  an external provider's id
--   Institution.nirfId              the NIRF institution code
--   FileMetadata.relatedEntityId    POLYMORPHIC — its target depends on
--                                   relatedEntityType, so a foreign key cannot
--                                   express it at all
--   LibraryBook.currentLoanId       denormalised pointer; a FK here would form
--                                   a cycle with LibraryLoan.bookId
--
-- ON DELETE RESTRICT, matching the six that already existed. Deleting an
-- institution that still holds data must fail loudly. CASCADE would erase a
-- university's entire record set from one statement.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Refuse to proceed over orphaned data ───────────────────────────────────
--
-- Adding the constraint would fail anyway, but only after scanning the table,
-- and the message would name one constraint rather than the whole picture. This
-- reports every affected table first, so an operator sees the full scope.
DO $$
DECLARE r RECORD; orphans BIGINT; total BIGINT := 0; details TEXT := '';
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.column_name = 'institutionId'
      AND c.table_name <> 'Institution'
    ORDER BY c.table_name
  LOOP
    EXECUTE format(
      'SELECT COUNT(*) FROM %I s WHERE s."institutionId" IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM "Institution" i WHERE i.id = s."institutionId")',
      r.table_name
    ) INTO orphans;

    IF orphans > 0 THEN
      total := total + orphans;
      details := details || format('  %s: %s row(s)%s', r.table_name, orphans, chr(10));
    END IF;
  END LOOP;

  IF total > 0 THEN
    RAISE EXCEPTION
      E'% row(s) reference an institution that does not exist:\n%\nThese rows are already invisible to every tenant-scoped query. Decide whether they belong to a real institution or should be removed, then re-run. They are NOT reassigned automatically — attaching a record to the wrong university is worse than leaving it unreachable.',
      total, details;
  END IF;

  RAISE NOTICE 'No orphaned institution references. Proceeding.';
END $$;

-- ── Add the constraints ────────────────────────────────────────────────────
--
-- Driven from information_schema rather than a hand-written list, so a
-- tenant-owned table added since this file was written is not silently skipped.
-- Idempotent: a table that already has the constraint is left alone.
DO $$
DECLARE r RECORD; added INTEGER := 0; skipped INTEGER := 0; cname TEXT;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.column_name = 'institutionId'
      AND c.table_name <> 'Institution'
    ORDER BY c.table_name
  LOOP
    cname := r.table_name || '_institutionId_fkey';

    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND table_name = r.table_name
        AND constraint_name = cname AND constraint_type = 'FOREIGN KEY'
    ) THEN
      skipped := skipped + 1;
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("institutionId")
         REFERENCES "Institution"(id) ON DELETE RESTRICT ON UPDATE CASCADE',
      r.table_name, cname
    );
    added := added + 1;
  END LOOP;

  RAISE NOTICE 'Institution foreign keys: % added, % already present.', added, skipped;
END $$;
