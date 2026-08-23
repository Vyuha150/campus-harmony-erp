-- ═══════════════════════════════════════════════════════════════════════════
-- 0025 — Let the transition log cascade, without letting it be rewritten
--
-- THE TRAP 0024 CREATED
--
-- The append-only trigger blocked every DELETE, including the CASCADE from a
-- parent `WorkflowInstance`. The consequence chained:
--
--   a transition cannot be deleted
--     -> an instance cannot be deleted (its transitions block the cascade)
--       -> a definition cannot be deleted (instances RESTRICT it)
--         -> an INSTITUTION cannot be deleted (definitions RESTRICT it)
--
-- Immutability of history is the right goal; making four levels of the schema
-- permanently undeletable is not. It would have surfaced the first time anyone
-- removed a test institution or exercised a data-retention policy.
--
-- THE DISTINCTION THAT MATTERS
--
--   Rewriting history            -> must be impossible
--   Deleting a decision in situ  -> must be impossible (it would leave a gap
--                                   in a chain that is supposed to be complete)
--   Removing a whole workflow    -> legitimate: the instance and its history go
--                                   together, and deleting the instance is
--                                   itself restricted and audited
--
-- Implemented by asking whether the parent still exists. During a cascade the
-- parent row is already gone, so the delete is permitted; a direct
-- `DELETE FROM "WorkflowTransition" WHERE id = ...` finds the parent present and
-- is refused.
-- ═══════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS "WorkflowTransition_no_delete" ON "WorkflowTransition";

CREATE OR REPLACE FUNCTION reject_transition_delete_in_situ() RETURNS TRIGGER AS $$
BEGIN
  -- Parent gone => this is a cascade from the instance being removed. Allow.
  IF NOT EXISTS (SELECT 1 FROM "WorkflowInstance" WHERE id = OLD."instanceId") THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION
    'A workflow transition cannot be deleted while its instance still exists. Removing one decision from a chain leaves a gap in a record that is supposed to be complete. To reverse a decision, record a new transition; to discard the whole approval, delete the instance.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "WorkflowTransition_no_delete"
  BEFORE DELETE ON "WorkflowTransition"
  FOR EACH ROW EXECUTE FUNCTION reject_transition_delete_in_situ();

-- UPDATE stays unconditionally blocked. There is no legitimate reason to alter a
-- recorded decision, cascade or otherwise.
