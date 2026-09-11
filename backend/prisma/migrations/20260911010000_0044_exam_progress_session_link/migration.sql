-- 0044 - Link the CoE/Registrar oversight row to the examination session.
--
-- `ExamProgress.marksEntered` is written as 0 when a row is created and NO
-- CODE ANYWHERE EVER UPDATES IT. `resultsPublished` only moves if someone
-- manually sets the status to 'published'. So the progress tracker could not
-- track progress, while the examination engine next to it held the real
-- counts and knew nothing about this table.
--
-- The registrar's read path papered over that by inferring figures — taking
-- the whole institution's student count as an exam's cohort when no
-- programme matched, and forcing marksEntered to equal totalStudents for
-- anything published, which makes a progress bar that always reads complete.
-- The CoE's read path did not, so the two screens disagreed about the same
-- examinations.
--
-- With a session linked, the figures are DERIVED from it and cannot drift.
-- Nullable because an institution tracks examinations here before it adopts
-- the session workflow, which is where every institution starts.

ALTER TABLE "ExamProgress" ADD COLUMN "examSessionId" TEXT;

CREATE INDEX "ExamProgress_examSessionId_idx" ON "ExamProgress"("examSessionId");

-- SetNull rather than Cascade: deleting a session must not silently delete
-- the oversight record of the examination it reported on.
ALTER TABLE "ExamProgress"
  ADD CONSTRAINT "ExamProgress_examSessionId_fkey"
  FOREIGN KEY ("examSessionId") REFERENCES "ExamSession"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
