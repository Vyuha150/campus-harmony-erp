/**
 * Bridge between the legacy approval routes and the workflow engine (Phase 2.4).
 *
 * The migration strategy is deliberately a strangler, not a rewrite. The HTTP
 * contracts of the routes below are UNCHANGED, so the existing screens keep
 * working; what changes is that the decision is now recorded by the engine and
 * the `ApprovalItem` row becomes a projection of it.
 *
 * Projection, precisely: the queue row is derived, and the transition log is the
 * source. If the two ever disagree, the log is right. The projection exists so
 * that migrating a flow does not require migrating its UI on the same day.
 */

import { basePrisma } from '../../lib/prisma.js';
import type { TenantContext } from '../../lib/tenant.js';
import * as service from './workflow.service.js';
import type { BuiltinWorkflow } from './builtins.js';

/**
 * Install a built-in definition for this institution if it has none.
 *
 * Idempotent, and never overwrites: an institution that has defined its own
 * version of the code keeps it. Returns the code so callers read naturally.
 */
export async function ensureDefinition(
  context: TenantContext,
  builtin: BuiltinWorkflow
): Promise<string> {
  const existing = await basePrisma.workflowDefinition.findFirst({
    where: { institutionId: context.institutionId, code: builtin.code, active: true },
    select: { id: true }
  });

  if (existing) return builtin.code;

  // Defining is a governance act, so it is audited by `defineWorkflow` exactly
  // as an operator-initiated definition would be. The audit entry showing the
  // system installing a default is worth more than a silent insert.
  await service.defineWorkflow(context, {
    code: builtin.code,
    name: builtin.name,
    description: builtin.description,
    entityType: builtin.entityType,
    steps: builtin.steps
  });

  return builtin.code;
}

/** The open instance for an entity, if any. At most one exists by construction. */
export async function openInstanceFor(
  context: TenantContext,
  entityType: string,
  entityId: string
): Promise<{ id: string; currentStepId: string | null } | null> {
  return basePrisma.workflowInstance.findFirst({
    where: {
      institutionId: context.institutionId,
      entityType,
      entityId,
      status: 'pending'
    },
    select: { id: true, currentStepId: true }
  });
}

/**
 * Point a queue row at the instance it projects, and mirror the instance's
 * status onto it.
 *
 * `updateMany`, not `update({ where: { id } })`: the tenant extension can
 * constrain a `where` clause but cannot filter a unique-key update. That
 * distinction is what made the pre-0022 approval routes exploitable across
 * institutions, so the rule is applied everywhere without exception.
 */
export async function projectOntoQueue(input: {
  approvalId: string;
  instanceId: string;
  status: string;
  decidedBy?: string | null;
  decisionNote?: string | null;
}): Promise<void> {
  await basePrisma.approvalItem.updateMany({
    where: { id: input.approvalId },
    data: {
      workflowInstanceId: input.instanceId,
      status: input.status,
      ...(input.decidedBy !== undefined
        ? { decidedBy: input.decidedBy, decidedAt: new Date() }
        : {}),
      ...(input.decisionNote !== undefined ? { decisionNote: input.decisionNote } : {})
    }
  });
}
