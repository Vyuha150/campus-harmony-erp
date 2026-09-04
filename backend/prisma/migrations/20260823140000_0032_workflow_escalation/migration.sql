-- 0032 - Escalation for the workflow engine (Phase 2.2).
--
-- The plan listed escalation as part of the model. It was never built: steps
-- carried `slaHours`, and the inbox used it to compute an `overdue` flag that
-- nothing acted on. A deadline nobody enforces is a comment.
--
-- `escalationRole` says WHO a step falls to when its SLA is breached. NULL means
-- the step does not escalate - the deadline is still reported, but the approval
-- stays where it is. That distinction is deliberate: escalating a decision to
-- someone who lacks the standing to make it is worse than leaving it late.

ALTER TABLE "WorkflowStep" ADD COLUMN IF NOT EXISTS "escalationRole" TEXT;

-- Recorded on the INSTANCE, not the step, because it is a fact about this
-- particular approval rather than about the process.
ALTER TABLE "WorkflowInstance" ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMPTZ(3);
ALTER TABLE "WorkflowInstance" ADD COLUMN IF NOT EXISTS "escalatedFromRole" TEXT;

CREATE INDEX IF NOT EXISTS "WorkflowInstance_escalatedAt_idx"
  ON "WorkflowInstance"("escalatedAt");

-- The transition log's action CHECK must admit `escalated`.
--
-- This is the exact failure mode migration 0022 caused: a CHECK written from one
-- source while the code wrote a value it did not list. `escalated` is written by
-- escalateOverdue() and is deliberately NOT in WORKFLOW_ACTIONS, because it is
-- system-generated — a client must not be able to POST it as a decision.
ALTER TABLE "WorkflowTransition" DROP CONSTRAINT IF EXISTS "WorkflowTransition_action_check";
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_action_check"
  CHECK (action IN ('started','approved','rejected','forwarded','cancelled','escalated'));
