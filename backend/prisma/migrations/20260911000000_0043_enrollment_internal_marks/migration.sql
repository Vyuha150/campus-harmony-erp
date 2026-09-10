-- 0043 - Internal marks get a column of their own.
--
-- The faculty marks screen submits `String(total)` — a NUMBER — into
-- `Enrollment.grade`, a column named for a letter grade. Two consequences:
--
--   1. The value could not travel. `enterExamMarks` in the examination module
--      takes `internalMarks` as a numeric input, and there was nothing to read
--      it from, so the exam cell had to re-type marks the faculty had already
--      entered, or leave the field null.
--
--   2. Reading it back required guessing whether the string was "85" or "B+",
--      which the student results screen did with Number() and a fallback.
--
-- `grade` keeps the working/letter value it was named for. New numeric writes
-- go to `internalMarks`.

ALTER TABLE "Enrollment" ADD COLUMN "internalMarks" DOUBLE PRECISION;

-- Backfill: move values that are unambiguously numeric. A row holding "B+"
-- is left alone — it is a genuine working grade, not misfiled marks.
--
-- The regex is anchored and allows an optional decimal part, so "85", "85.5"
-- and " 85 " (trimmed) move, while "B+", "A", "PASS" and "" do not. The
-- bound of 0..100 is the range the marks screen itself enforces; anything
-- outside it is not marks and is left for a human to look at.
UPDATE "Enrollment"
   SET "internalMarks" = TRIM("grade")::DOUBLE PRECISION
 WHERE "grade" IS NOT NULL
   AND TRIM("grade") ~ '^[0-9]+(\.[0-9]+)?$'
   AND TRIM("grade")::DOUBLE PRECISION BETWEEN 0 AND 100;
