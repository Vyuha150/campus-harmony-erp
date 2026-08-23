-- 0026 — Link the approval queue to the workflow engine (Phase 2.4).
--
-- Where `workflowInstanceId` is set, the engine's append-only transition log is
-- the record of the decision and the ApprovalItem row is a PROJECTION of it,
-- retained so the existing queue screens keep working unchanged.
--
-- ON DELETE SET NULL, deliberately: discarding an instance must not delete the
-- queue row a user can see. The projection survives, unlinked, rather than
-- vanishing from someone's screen.
ALTER TABLE "ApprovalItem"
  ADD COLUMN IF NOT EXISTS "workflowInstanceId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ApprovalItem_workflowInstanceId_fkey'
  ) THEN
    ALTER TABLE "ApprovalItem"
      ADD CONSTRAINT "ApprovalItem_workflowInstanceId_fkey"
      FOREIGN KEY ("workflowInstanceId") REFERENCES "WorkflowInstance"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ApprovalItem_workflowInstanceId_idx"
  ON "ApprovalItem"("workflowInstanceId");
