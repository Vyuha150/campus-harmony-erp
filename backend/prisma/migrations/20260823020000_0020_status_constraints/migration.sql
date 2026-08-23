-- ═══════════════════════════════════════════════════════════════════════════
-- 0020 — Constrain status columns to their documented values (Phase 1.3)
--
-- ── WHY CHECK CONSTRAINTS AND NOT POSTGRES ENUM TYPES ─────────────────────
--
-- The plan called this "status columns -> enums". A CHECK constraint is used
-- instead, deliberately:
--
--   1. A Prisma enum changes the generated TypeScript type from `string` to a
--      union. Every service that assigns a status, every zod schema, and every
--      test fixture would need changing — a large refactor across 91 columns
--      that buys no integrity the constraint does not already give.
--
--   2. Adding a value later is `ALTER TYPE ... ADD VALUE`, which cannot run
--      inside a transaction in older versions and cannot remove a value at all.
--      Replacing a CHECK is a single reversible statement. Institutions DO extend
--      their workflows, so this will happen.
--
--   3. Prisma does not model CHECK constraints, so there is no schema drift.
--      (Contrast foreign keys, which Prisma DOES model — hence 0018/0019 also
--      declared relations in schema.prisma.)
--
-- The guarantee is the same in the way that matters: the database rejects a
-- status value the application never intended to write.
--
-- ── WHERE THE VALUES COME FROM ────────────────────────────────────────────
--
-- Each set is taken from the doc comment on the field itself, e.g.
--
--     /// pending | partial | paid | waived | overdue
--     status String
--
-- Those comments were written alongside the services that assign the values, so
-- they describe what the CODE writes. CURRENT TABLE CONTENTS ARE NOT THE
-- AUTHORITY — an empty table would produce an empty set, and a constraint built
-- from that would reject every future write.
--
-- ── SCOPE ─────────────────────────────────────────────────────────────────
--
-- 24 columns, all from modules with a documented state machine. Roughly 67 other
-- status columns in the legacy routes have NO documented value set. Their valid
-- values cannot be derived from the schema or from data, and guessing would
-- reject writes the application still makes. They are left unconstrained until
-- their modules are migrated (Phase 3).
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  specs TEXT[][] := ARRAY[
    ['Batch','status','active,graduated,discontinued'],
    ['FeeRecord','status','pending,partial,paid,waived,overdue'],
    ['LibraryBook','status','available,issued,lost,damaged,withdrawn'],
    ['LibraryLoan','status','active,returned,lost'],
    ['Payment','status','pending,success,failed,refunded,cancelled'],
    ['Receipt','status','issued,cancelled,reprinted'],
    ['IdempotencyKey','status','in_progress,completed,failed'],
    ['NotificationDelivery','status','pending,sending,sent,delivered,failed,bounced,skipped'],
    ['ExamSession','status','draft,registration_open,registration_closed,in_progress,evaluation,moderation,results_published,archived'],
    ['ExamRegistration','status','registered,ineligible,condoned,cancelled,absent,appeared'],
    ['HallTicket','status','valid,revoked'],
    ['RevaluationRequest','status','requested,fee_pending,under_evaluation,completed,rejected'],
    ['CurriculumScheme','status','draft,approved,active,superseded'],
    ['CourseResult','status','draft,submitted,verified,moderated,published,revalued,withheld'],
    ['SemesterResult','resultStatus','pass,fail,promoted,detained,withheld'],
    ['SemesterResult','status','draft,published,revised'],
    ['AdmissionCycle','status','draft,open,closed,merit_published,admissions_closed,cancelled'],
    ['AdmissionApplication','status','submitted,under_verification,verified,rejected,eligible,shortlisted,offered,accepted,declined,admitted,withdrawn,expired'],
    ['AdmissionDocument','verificationStatus','pending,verified,rejected'],
    ['AdmissionOffer','status','pending,accepted,declined,expired,withdrawn'],
    ['CommitteeMeeting','status','scheduled,held,cancelled,postponed'],
    ['InstitutionalPolicy','status','draft,under_review,approved,superseded,withdrawn'],
    ['ImportJob','status','pending,validating,validated,importing,completed,failed,cancelled'],
    ['Assessment','status','draft,published']
  ];
  s TEXT[]; vals TEXT[]; cname TEXT; bad BIGINT; report TEXT := '';
  added INTEGER := 0; skipped INTEGER := 0;
BEGIN
  -- Pass 1: does existing data already satisfy each set? A constraint added over
  -- violating rows fails after a full scan and names only the first problem.
  FOREACH s SLICE 1 IN ARRAY specs LOOP
    IF to_regclass('public.' || quote_ident(s[1])) IS NULL THEN CONTINUE; END IF;
    vals := string_to_array(s[3], ',');

    EXECUTE format(
      'SELECT COUNT(*) FROM %I WHERE %I IS NOT NULL AND NOT (%I = ANY($1))',
      s[1], s[2], s[2]
    ) INTO bad USING vals;

    IF bad > 0 THEN
      report := report || format('  %s.%s: %s row(s) outside {%s}%s',
                                 s[1], s[2], bad, s[3], chr(10));
    END IF;
  END LOOP;

  IF report <> '' THEN
    RAISE EXCEPTION
      E'Existing rows hold status values outside the documented set; no constraints were added:\n%\nEither the value is legitimate and the documentation is incomplete, or the row is wrong. Both need a human — this migration will not silently widen a state machine.',
      report;
  END IF;

  -- Pass 2: apply.
  FOREACH s SLICE 1 IN ARRAY specs LOOP
    IF to_regclass('public.' || quote_ident(s[1])) IS NULL THEN CONTINUE; END IF;
    cname := format('%s_%s_check', s[1], s[2]);

    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = cname) THEN
      skipped := skipped + 1;
      CONTINUE;
    END IF;

    vals := string_to_array(s[3], ',');
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I CHECK (%I IN (%s))',
      s[1], cname, s[2],
      (SELECT string_agg(quote_literal(v), ', ') FROM unnest(vals) v)
    );
    added := added + 1;
  END LOOP;

  RAISE NOTICE 'Status constraints: % added, % already present.', added, skipped;
END $$;
