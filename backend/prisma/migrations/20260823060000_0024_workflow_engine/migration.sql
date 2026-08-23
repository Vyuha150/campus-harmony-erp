-- ═══════════════════════════════════════════════════════════════════════════
-- 0024 — Workflow engine (Phase 2.2)
--
-- Additive. No existing table is touched.
--
-- THE TRANSITION LOG IS THE PRIMARY RECORD. `WorkflowInstance.currentStepId` is
-- a cache of the latest transition so "what is waiting on me?" is one indexed
-- read; the history is what an auditor reads.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "WorkflowDefinition" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "entityType" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);

-- Versioned, never edited in place: an instance keeps the version it started
-- under, so changing the process tomorrow cannot rewrite yesterday's approval.
CREATE UNIQUE INDEX "WorkflowDefinition_institutionId_code_version_key"
  ON "WorkflowDefinition"("institutionId", "code", "version");
CREATE INDEX "WorkflowDefinition_institutionId_idx" ON "WorkflowDefinition"("institutionId");
CREATE INDEX "WorkflowDefinition_entityType_idx" ON "WorkflowDefinition"("entityType");

ALTER TABLE "WorkflowDefinition" ADD CONSTRAINT "WorkflowDefinition_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"(id) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "assigneeRole" TEXT NOT NULL,
    "onApproveStepId" TEXT,
    "onRejectStepId" TEXT,
    "slaHours" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowStep_definitionId_sequence_key" ON "WorkflowStep"("definitionId", "sequence");
CREATE INDEX "WorkflowStep_definitionId_idx" ON "WorkflowStep"("definitionId");

ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_definitionId_fkey"
  FOREIGN KEY ("definitionId") REFERENCES "WorkflowDefinition"(id) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorkflowInstance" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "currentStepId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedBy" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ(3),
    "context" JSONB,
    CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkflowInstance_institutionId_idx" ON "WorkflowInstance"("institutionId");
CREATE INDEX "WorkflowInstance_status_idx" ON "WorkflowInstance"("status");
CREATE INDEX "WorkflowInstance_entityType_entityId_idx" ON "WorkflowInstance"("entityType", "entityId");
-- The "what is waiting on me" query.
CREATE INDEX "WorkflowInstance_institutionId_status_idx" ON "WorkflowInstance"("institutionId", "status");

ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_status_check"
  CHECK ("status" IN ('pending', 'approved', 'rejected', 'cancelled'));

ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_definitionId_fkey"
  FOREIGN KEY ("definitionId") REFERENCES "WorkflowDefinition"(id) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "WorkflowTransition" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "fromStepId" TEXT,
    "toStepId" TEXT,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "note" TEXT,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowTransition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkflowTransition_instanceId_idx" ON "WorkflowTransition"("instanceId");
CREATE INDEX "WorkflowTransition_occurredAt_idx" ON "WorkflowTransition"("occurredAt");

ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_action_check"
  CHECK ("action" IN ('started', 'approved', 'rejected', 'forwarded', 'cancelled'));

ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_instanceId_fkey"
  FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- Append-only, enforced in the database rather than by convention. A transition
-- that could be edited after the fact would not be evidence of anything, and
-- "we only ever insert" is a habit, not a guarantee.
CREATE OR REPLACE FUNCTION reject_workflow_transition_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'WorkflowTransition is append-only. An approval history that can be rewritten is not an audit trail. To reverse a decision, record a new transition.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "WorkflowTransition_no_update"
  BEFORE UPDATE ON "WorkflowTransition"
  FOR EACH ROW EXECUTE FUNCTION reject_workflow_transition_mutation();

CREATE TRIGGER "WorkflowTransition_no_delete"
  BEFORE DELETE ON "WorkflowTransition"
  FOR EACH ROW EXECUTE FUNCTION reject_workflow_transition_mutation();
