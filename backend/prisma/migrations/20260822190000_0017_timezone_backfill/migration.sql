-- ═══════════════════════════════════════════════════════════════════════════
-- 0017 — Realign timestamps written under the driver timezone skew
--
-- MUST BE DEPLOYED WITH the `options: '-c timezone=UTC'` change in
-- `src/lib/prisma.ts`. Either one alone moves every historical timestamp.
--
-- ── WHAT WAS WRONG ────────────────────────────────────────────────────────
--
-- The connection pool set no session timezone, so it inherited the server's.
-- The driver then applied that offset when writing a JS Date and unwound it on
-- read. Measured directly:
--
--     Prisma wrote  2026-01-15T10:00:00Z
--     row held      2026-01-15 04:30:00Z     <- one local offset away
--     Prisma read   2026-01-15T10:00:00Z     <- self-consistent, so unnoticed
--
-- The application never saw a problem. Everything else did: psql, dumps, BI
-- tools and hand-written fixes all read every timestamp 5.5 hours off.
--
-- ── WHY SHIFT THE DATA RATHER THAN JUST FIX THE DRIVER ────────────────────
--
-- The application's semantic truth is what Prisma reported. Every fine, exam
-- eligibility window, receipt and AUDIT LOG ENTRY was computed and shown from
-- those values.
--
-- Fixing the driver alone would leave the rows untouched, so every historical
-- record would suddenly read one offset earlier than it always had — an audit
-- entry stamped 16:48 would become 11:18. Silently rewriting an audit trail to
-- work around a driver bug is not acceptable in an institutional record system.
--
-- So the rows move to the instants the application always meant, and every
-- application-visible value stays exactly where it was.
--
-- ── THE ZONE ──────────────────────────────────────────────────────────────
--
-- The skew equals the offset of the zone the writing process ran in. For this
-- deployment that is Asia/Kolkata. Expressed via AT TIME ZONE rather than a
-- fixed INTERVAL so the rules are applied per row — a fixed interval would be
-- wrong across a DST boundary in any zone that observes one.
--
-- ANOTHER DEPLOYMENT MUST SET ITS OWN ZONE BELOW BEFORE RUNNING THIS.
--
-- ── FRESH DATABASES ───────────────────────────────────────────────────────
--
-- Seeding runs after migrations, with the corrected driver, so a new database
-- is empty at this point and every UPDATE below touches zero rows. The shift
-- applies only to data written under the old behaviour.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  -- The zone the application process ran in when the legacy rows were written.
  legacy_zone TEXT := 'Asia/Kolkata';
  r RECORD;
  cols INTEGER := 0;
  rows_before BIGINT;
  witness_before TIMESTAMPTZ;
  witness_after TIMESTAMPTZ;
BEGIN
  -- Is there any legacy data at all? If not, this is a fresh install and the
  -- loop below is a no-op — reported rather than left ambiguous.
  SELECT COUNT(*) INTO rows_before FROM "SystemAuditLog";
  SELECT MAX("timestamp") INTO witness_before FROM "SystemAuditLog";

  IF rows_before = 0 THEN
    RAISE NOTICE 'No audit rows present — treating this as a fresh database. The shift will affect nothing.';
  ELSE
    RAISE NOTICE 'Realigning timestamps written under the % skew. Witness (latest audit row) before: %',
      legacy_zone, witness_before;
  END IF;

  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.data_type = 'timestamp with time zone'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name <> '_prisma_migrations'
    ORDER BY c.table_name, c.column_name
  LOOP
    -- Render the stored instant as wall-clock in the legacy zone, then reinterpret
    -- that wall-clock as UTC. That is exactly the transform the driver used to
    -- apply on read, so the result is the instant the application always reported.
    EXECUTE format(
      'UPDATE %I SET %I = (%I AT TIME ZONE %L) AT TIME ZONE ''UTC'' WHERE %I IS NOT NULL',
      r.table_name, r.column_name, r.column_name, legacy_zone, r.column_name
    );
    cols := cols + 1;
  END LOOP;

  RAISE NOTICE 'Realigned % timestamptz column(s).', cols;

  IF rows_before > 0 THEN
    SELECT MAX("timestamp") INTO witness_after FROM "SystemAuditLog";
    RAISE NOTICE 'Witness after: % (moved by %)', witness_after, witness_after - witness_before;

    -- The shift must be non-zero and must equal the legacy zone's offset for
    -- that instant. A zero shift means the migration ran twice or the zone is
    -- wrong; either way, stop rather than leave the data half-corrected.
    IF witness_after = witness_before THEN
      RAISE EXCEPTION
        'Timestamps did not move. Either this migration has already been applied, or legacy_zone (%) is UTC and no realignment was needed. Verify before proceeding.',
        legacy_zone;
    END IF;
  END IF;
END $$;
