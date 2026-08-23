/**
 * Workflow engine (Phase 2.3).
 *
 * WHAT THE CATALOGUE FOUND, AND HOW IT SHAPED THIS
 *
 * Phase 2.1 found approvals implemented three ways: a boolean on an entity, a
 * row in a shared queue, and a multi-step sequence spanning modules. It also
 * found handlers creating records already marked `approved` — activity log
 * entries wearing approval clothing.
 *
 * So this engine does NOT try to absorb every one of those. It provides a real
 * approval process for flows that genuinely have one, and leaves the entity
 * flags where they are until their modules are migrated.
 *
 * THE CENTRAL DECISION: the transition log is the record.
 *
 * A status column tells you where something sits. It cannot tell you how it got
 * there, who moved it, or what they were shown at the time. For a fee waiver or
 * a grade change, that second question is the one that gets asked. So every
 * decision writes an append-only `WorkflowTransition`, and the instance's
 * `currentStepId` is a cache of the latest one — enforced by a database trigger
 * that refuses UPDATE and DELETE on the log.
 */

import { basePrisma } from '../../lib/prisma.js';
import { mutate } from '../../lib/service.js';
import { NotFoundError, ValidationError, BusinessRuleError, ConflictError } from '../../lib/errors.js';
import type { TenantContext } from '../../lib/tenant.js';

export const WORKFLOW_ACTIONS = ['approved', 'rejected', 'forwarded', 'cancelled'] as const;
export type WorkflowAction = (typeof WORKFLOW_ACTIONS)[number];

export interface StepInput {
  sequence: number;
  name: string;
  assigneeRole: string;
  slaHours?: number | undefined;
}

/**
 * Define a process.
 *
 * Definitions are versioned and never edited. Redefining a code creates version
 * n+1, and running instances keep the version they started under — changing the
 * process tomorrow must not rewrite what was approved yesterday.
 */
export async function defineWorkflow(
  context: TenantContext,
  input: {
    code: string;
    name: string;
    description?: string | undefined;
    entityType: string;
    steps: StepInput[];
  }
): Promise<{ id: string; code: string; version: number; steps: number }> {
  if (input.steps.length === 0) {
    throw new ValidationError(
      'A workflow needs at least one step. A definition with no steps would approve nothing and could never complete.',
      { field: 'steps' }
    );
  }

  const sequences = input.steps.map((s) => s.sequence);
  if (new Set(sequences).size !== sequences.length) {
    throw new ValidationError('Step sequences must be unique within a workflow.', { field: 'steps' });
  }

  const latest = await basePrisma.workflowDefinition.findFirst({
    where: { institutionId: context.institutionId, code: input.code },
    orderBy: { version: 'desc' },
    select: { version: true }
  });

  const version = (latest?.version ?? 0) + 1;

  return mutate(
    context,
    {
      action: 'CREATE',
      module: 'workflow',
      resource: (r) => `WorkflowDefinition:${(r as { id: string }).id}`,
      details: `Defined workflow ${input.code} v${version} ("${input.name}") with ${input.steps.length} step(s)`,
      severity: 'warning'
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      // Supersede the previous version rather than deleting it: instances still
      // reference it, and its history must stay readable.
      if (latest) {
        await db.workflowDefinition.updateMany({
          where: { institutionId: context.institutionId, code: input.code },
          data: { active: false }
        });
      }

      const definition = await db.workflowDefinition.create({
        data: {
          institutionId: context.institutionId,
          code: input.code,
          name: input.name,
          description: input.description ?? null,
          entityType: input.entityType,
          version,
          active: true,
          createdBy: context.userId
        }
      });

      const ordered = [...input.steps].sort((a, b) => a.sequence - b.sequence);
      const created = [];
      for (const step of ordered) {
        created.push(
          await db.workflowStep.create({
            data: {
              definitionId: definition.id,
              sequence: step.sequence,
              name: step.name,
              assigneeRole: step.assigneeRole,
              slaHours: step.slaHours ?? null
            }
          })
        );
      }

      // Wire the default happy path: each step approves onto the next, and the
      // last completes the workflow. Branching is set explicitly afterwards.
      for (let i = 0; i < created.length - 1; i++) {
        await db.workflowStep.updateMany({
          where: { id: created[i]!.id },
          data: { onApproveStepId: created[i + 1]!.id }
        });
      }

      return {
        id: definition.id,
        code: definition.code,
        version: definition.version,
        steps: created.length
      };
    }
  );
}

/** Start an instance against an entity. */
export async function startWorkflow(
  context: TenantContext,
  input: {
    code: string;
    entityType: string;
    entityId: string;
    context?: Record<string, unknown> | undefined;
  }
): Promise<{ instanceId: string; currentStep: string; assigneeRole: string }> {
  const definition = await basePrisma.workflowDefinition.findFirst({
    where: { institutionId: context.institutionId, code: input.code, active: true },
    include: { steps: { orderBy: { sequence: 'asc' } } }
  });

  if (!definition) {
    throw new NotFoundError(
      `Active workflow "${input.code}". Define it before starting an instance — the engine will not invent a process`
    );
  }

  if (definition.entityType !== input.entityType) {
    throw new ValidationError(
      `Workflow "${input.code}" approves ${definition.entityType}, not ${input.entityType}.`,
      { field: 'entityType' }
    );
  }

  const firstStep = definition.steps[0];
  if (!firstStep) {
    throw new BusinessRuleError(`Workflow "${input.code}" has no steps.`, { code: input.code });
  }

  // One open instance per entity. Two concurrent approvals of the same fee
  // waiver could reach opposite conclusions, and nothing would say which won.
  const existing = await basePrisma.workflowInstance.findFirst({
    where: {
      institutionId: context.institutionId,
      entityType: input.entityType,
      entityId: input.entityId,
      status: 'pending'
    },
    select: { id: true }
  });

  if (existing) {
    throw new ConflictError(
      `An approval is already in progress for this ${input.entityType} (instance ${existing.id}). Complete or cancel it first.`,
      { instanceId: existing.id }
    );
  }

  return mutate(
    context,
    {
      action: 'CREATE',
      module: 'workflow',
      resource: (r) => `WorkflowInstance:${(r as { instanceId: string }).instanceId}`,
      details: `Started ${definition.code} v${definition.version} for ${input.entityType}:${input.entityId}`
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      const instance = await db.workflowInstance.create({
        data: {
          institutionId: context.institutionId,
          definitionId: definition.id,
          entityType: input.entityType,
          entityId: input.entityId,
          currentStepId: firstStep.id,
          status: 'pending',
          startedBy: context.userId,
          context: (input.context ?? null) as never
        }
      });

      await db.workflowTransition.create({
        data: {
          instanceId: instance.id,
          fromStepId: null,
          toStepId: firstStep.id,
          action: 'started',
          actorId: context.userId,
          actorRole: context.role
        }
      });

      return {
        instanceId: instance.id,
        currentStep: firstStep.name,
        assigneeRole: firstStep.assigneeRole
      };
    }
  );
}

export interface ActResult {
  instanceId: string;
  action: WorkflowAction;
  status: string;
  currentStep: string | null;
  assigneeRole: string | null;
  complete: boolean;
}

/**
 * Act on the step an instance is waiting at.
 *
 * The caller's role must match the step's `assigneeRole`. That check is the
 * point of the engine: previously any holder of a role could decide anything,
 * and nothing recorded which step a decision belonged to.
 */
export async function act(
  context: TenantContext,
  instanceId: string,
  action: WorkflowAction,
  note?: string
): Promise<ActResult> {
  if (!WORKFLOW_ACTIONS.includes(action)) {
    throw new ValidationError(`action must be one of: ${WORKFLOW_ACTIONS.join(', ')}.`, {
      field: 'action'
    });
  }

  const instance = await basePrisma.workflowInstance.findFirst({
    where: { id: instanceId, institutionId: context.institutionId },
    include: { definition: { include: { steps: true } } }
  });

  if (!instance) {
    throw new NotFoundError(`Workflow instance ${instanceId}`);
  }

  if (instance.status !== 'pending') {
    throw new BusinessRuleError(
      `This approval is already ${instance.status}. Reversing it means recording a new decision, not editing the old one.`,
      { instanceId, status: instance.status }
    );
  }

  const currentStep = instance.definition.steps.find((s) => s.id === instance.currentStepId);
  if (!currentStep) {
    throw new BusinessRuleError(
      'This instance is not sitting at a known step — its definition may have been altered.',
      { instanceId }
    );
  }

  // Role gate. `super_admin` is permitted throughout, matching how every other
  // module treats it.
  if (context.role !== 'super_admin' && context.role !== currentStep.assigneeRole) {
    throw new BusinessRuleError(
      `This approval is waiting on ${currentStep.assigneeRole}, not ${context.role}. Step: "${currentStep.name}".`,
      { requiredRole: currentStep.assigneeRole, step: currentStep.name }
    );
  }

  if (action === 'rejected' && (!note || note.trim().length < 10)) {
    // A rejection someone must act on needs to say why.
    throw new ValidationError(
      'Rejecting an approval requires a reason of at least 10 characters — the person whose request this is has to know what to change.',
      { field: 'note' }
    );
  }

  const nextStepId =
    action === 'approved'
      ? currentStep.onApproveStepId
      : action === 'rejected'
        ? currentStep.onRejectStepId
        : action === 'forwarded'
          ? currentStep.onApproveStepId
          : null;

  const nextStep = nextStepId
    ? instance.definition.steps.find((s) => s.id === nextStepId) ?? null
    : null;

  // Terminal when approving/forwarding with nowhere to go, or on reject/cancel
  // with no rejection path defined.
  const complete = nextStep === null;
  const finalStatus = !complete
    ? 'pending'
    : action === 'approved' || action === 'forwarded'
      ? 'approved'
      : action === 'rejected'
        ? 'rejected'
        : 'cancelled';

  return mutate(
    context,
    {
      action: 'UPDATE',
      module: 'workflow',
      resource: `WorkflowInstance:${instance.id}`,
      details:
        `${action} at step "${currentStep.name}" of ${instance.definition.code} ` +
        `for ${instance.entityType}:${instance.entityId}` +
        (nextStep ? ` → now at "${nextStep.name}"` : ` → ${finalStatus}`),
      reason: note,
      // Approvals move money, grades and employment. Always reviewable.
      severity: 'warning'
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      // The append-only record, written FIRST — it is the thing that matters.
      await db.workflowTransition.create({
        data: {
          instanceId: instance.id,
          fromStepId: currentStep.id,
          toStepId: nextStep?.id ?? null,
          action,
          actorId: context.userId,
          actorRole: context.role,
          note: note ?? null
        }
      });

      // Guarded on the step it was read at, so two simultaneous decisions cannot
      // both apply — the second finds the instance has moved.
      const moved = await db.workflowInstance.updateMany({
        where: { id: instance.id, currentStepId: currentStep.id, status: 'pending' },
        data: {
          currentStepId: nextStep?.id ?? null,
          status: finalStatus,
          endedAt: complete ? new Date() : null
        }
      });

      if (moved.count === 0) {
        throw new ConflictError(
          'This approval moved while you were deciding. Reload and check its current state.',
          { instanceId: instance.id }
        );
      }

      return {
        instanceId: instance.id,
        action,
        status: finalStatus,
        currentStep: nextStep?.name ?? null,
        assigneeRole: nextStep?.assigneeRole ?? null,
        complete
      };
    }
  );
}

/** What is waiting on this caller's role. */
export async function inbox(
  context: TenantContext,
  page: { page: number; pageSize: number }
): Promise<{
  data: Array<{
    instanceId: string;
    workflow: string;
    entityType: string;
    entityId: string;
    step: string;
    waitingSince: Date;
    overdue: boolean;
    context: unknown;
  }>;
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}> {
  const instances = await basePrisma.workflowInstance.findMany({
    where: { institutionId: context.institutionId, status: 'pending' },
    include: {
      definition: { include: { steps: true } },
      transitions: { orderBy: { occurredAt: 'desc' }, take: 1 }
    },
    orderBy: { startedAt: 'asc' }
  });

  // Filtered in memory because "is this step assigned to my role" depends on the
  // instance's current step, which SQL cannot join to without a step FK.
  const mine = instances.filter((i) => {
    const step = i.definition.steps.find((s) => s.id === i.currentStepId);
    return step && (context.role === 'super_admin' || step.assigneeRole === context.role);
  });

  const start = (page.page - 1) * page.pageSize;
  const slice = mine.slice(start, start + page.pageSize);
  const now = Date.now();

  return {
    data: slice.map((i) => {
      const step = i.definition.steps.find((s) => s.id === i.currentStepId)!;
      const since = i.transitions[0]?.occurredAt ?? i.startedAt;
      return {
        instanceId: i.id,
        workflow: `${i.definition.code} v${i.definition.version}`,
        entityType: i.entityType,
        entityId: i.entityId,
        step: step.name,
        waitingSince: since,
        // Reported, not acted on — there is no scheduler, and pretending
        // otherwise would imply escalation happens by itself.
        overdue: step.slaHours ? now - since.getTime() > step.slaHours * 3600_000 : false,
        context: i.context
      };
    }),
    meta: {
      page: page.page,
      pageSize: page.pageSize,
      total: mine.length,
      totalPages: Math.max(1, Math.ceil(mine.length / page.pageSize))
    }
  };
}

/** Full history of one instance — the audit view. */
export async function history(
  context: TenantContext,
  instanceId: string
): Promise<Record<string, unknown>> {
  const instance = await basePrisma.workflowInstance.findFirst({
    where: { id: instanceId, institutionId: context.institutionId },
    include: {
      definition: { include: { steps: { orderBy: { sequence: 'asc' } } } },
      transitions: { orderBy: { occurredAt: 'asc' } }
    }
  });

  if (!instance) {
    throw new NotFoundError(`Workflow instance ${instanceId}`);
  }

  const stepName = (id: string | null) =>
    id ? instance.definition.steps.find((s) => s.id === id)?.name ?? id : null;

  return {
    instanceId: instance.id,
    workflow: { code: instance.definition.code, version: instance.definition.version, name: instance.definition.name },
    entity: { type: instance.entityType, id: instance.entityId },
    status: instance.status,
    startedBy: instance.startedBy,
    startedAt: instance.startedAt,
    endedAt: instance.endedAt,
    currentStep: stepName(instance.currentStepId),
    context: instance.context,
    // The record. Append-only, enforced by a database trigger.
    transitions: instance.transitions.map((t) => ({
      action: t.action,
      from: stepName(t.fromStepId),
      to: stepName(t.toStepId),
      actorId: t.actorId,
      actorRole: t.actorRole,
      note: t.note,
      occurredAt: t.occurredAt
    }))
  };
}
