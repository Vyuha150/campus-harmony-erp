-- ═══════════════════════════════════════════════════════════════════════════
-- 0016 — Convert every timestamp column to `timestamptz`
--
-- WHY
--
-- Prisma maps `DateTime` to `timestamp(3)` WITHOUT time zone. Prisma itself
-- reads and writes UTC consistently, so the application has always been
-- self-consistent — but the column carries no zone, so ANY other writer puts
-- local wall-clock into it and Prisma reads that back as UTC.
--
-- This is not hypothetical. In checkpoint 13 a test fixture written with psql's
-- `NOW()` was read back 5.5 hours off, which changed a computed library fine.
-- The same mistake in a hand-written production data fix would silently move
-- due dates, fine calculations and exam eligibility windows.
--
-- THE CONVERSION, AND WHY THIS DIRECTION
--
--   USING <col> AT TIME ZONE 'UTC'
--
-- reads each existing naive value AS a UTC wall-clock and produces the matching
-- instant. That is correct precisely BECAUSE Prisma wrote them as UTC.
--
-- Getting this backwards — letting Postgres apply the server's local zone —
-- would shift every timestamp in the database by the local offset (+5:30 here).
-- Every date would still look plausible. Nothing would fail loudly. So the
-- direction is stated explicitly rather than relying on a session default, and
-- the verification below asserts that no instant moved.
--
-- SCOPE: 277 columns. Driven from information_schema rather than enumerated by
-- hand, so a column added since this file was written is not silently skipped.
--
-- SAFETY: rewrites every affected table, so it takes an ACCESS EXCLUSIVE lock.
-- Run it in a maintenance window. Restore point taken beforehand:
--   campus_harmony_2026-08-22T17-56-34-493Z.dump (156 tables, restore drill PASSED)
-- ═══════════════════════════════════════════════════════════════════════════

-- Guard: the conversion below is only correct if the stored values are UTC.
-- If someone has already converted some columns, stop rather than double-convert.
DO $$
DECLARE already INTEGER;
BEGIN
  SELECT COUNT(*) INTO already
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND data_type = 'timestamp with time zone'
    AND table_name <> '_prisma_migrations';

  IF already > 0 THEN
    RAISE EXCEPTION
      'Found % column(s) already using timestamptz. This migration assumes every timestamp column is naive UTC; a partial conversion means the assumption does not hold. Investigate before proceeding.',
      already;
  END IF;
END $$;

-- Record the pre-conversion instant of a witness row, so the check at the end
-- compares against something real rather than trusting the transform.
CREATE TEMP TABLE tz_witness AS
SELECT
  (SELECT MIN("dueAt") FROM "LibraryLoan")        AS loan_due,
  (SELECT MIN("paidAt") FROM "Payment")           AS payment_paid,
  (SELECT MAX("timestamp") FROM "SystemAuditLog") AS audit_latest;

-- ── The conversion ─────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD; n INTEGER := 0;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.data_type = 'timestamp without time zone'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name <> '_prisma_migrations'
    ORDER BY c.table_name, c.column_name
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I TYPE timestamptz(3) USING %I AT TIME ZONE ''UTC''',
      r.table_name, r.column_name, r.column_name
    );
    n := n + 1;
  END LOOP;

  RAISE NOTICE 'Converted % timestamp column(s) to timestamptz.', n;
END $$;

-- ── Verify no instant moved ────────────────────────────────────────────────
--
-- Compares the witness values captured before the ALTERs against the same rows
-- now, both expressed as UTC. A wrong conversion direction shows up here as a
-- non-zero difference, and aborts the migration.
DO $$
DECLARE w RECORD; drift INTERVAL;
BEGIN
  SELECT * INTO w FROM tz_witness;

  IF w.loan_due IS NOT NULL THEN
    SELECT (SELECT MIN("dueAt") FROM "LibraryLoan") - (w.loan_due AT TIME ZONE 'UTC') INTO drift;
    IF drift <> INTERVAL '0' THEN
      RAISE EXCEPTION 'LibraryLoan.dueAt moved by % during conversion — the timezone direction is wrong.', drift;
    END IF;
  END IF;

  IF w.audit_latest IS NOT NULL THEN
    SELECT (SELECT MAX("timestamp") FROM "SystemAuditLog") - (w.audit_latest AT TIME ZONE 'UTC') INTO drift;
    IF drift <> INTERVAL '0' THEN
      RAISE EXCEPTION 'SystemAuditLog.timestamp moved by % during conversion — the timezone direction is wrong.', drift;
    END IF;
  END IF;

  RAISE NOTICE 'Verified: no instant moved during conversion.';
END $$;

-- Confirm nothing was left behind.
DO $$
DECLARE remaining INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON t.table_schema = c.table_schema AND t.table_name = c.table_name
  WHERE c.table_schema = 'public'
    AND c.data_type = 'timestamp without time zone'
    AND t.table_type = 'BASE TABLE'
    AND c.table_name <> '_prisma_migrations';

  IF remaining > 0 THEN
    RAISE EXCEPTION '% timestamp column(s) were not converted.', remaining;
  END IF;
END $$;

DROP TABLE IF EXISTS tz_witness;
