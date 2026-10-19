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

import { Prisma } from '@prisma/client';
import { logger } from '../../lib/logger.js';
import { basePrisma } from '../../lib/prisma.js';
import { mutate } from '../../lib/service.js';
import { NotFoundError, ValidationError, BusinessRuleError, ConflictError, AuthorizationError } from '../../lib/errors.js';
import type { TenantContext } from '../../lib/tenant.js';
import { notifyInApp } from '../../lib/inAppNotify.js';
import { applyApprovedChange } from '../hod/planning.service.js';
import { publishDepartment } from '../examination/resultsFlow.js';

export const WORKFLOW_ACTIONS = ['approved', 'rejected', 'forwarded', 'cancelled'] as const;
export type WorkflowAction = (typeof WORKFLOW_ACTIONS)[number];

export interface StepInput {
  sequence: number;
  name: string;
  assigneeRole: string;
  slaHours?: number | undefined;
  /** Who the step falls to on SLA breach. Omit for "does not escalate". */
  escalationRole?: string | undefined;
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
              slaHours: step.slaHours ?? null,
              escalationRole: step.escalationRole ?? null
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

/** Roles that may read any approval trail. */
/**
 * A HOD approves for their own department only. The inbox listed every
 * department's pending HOD step to every HOD, so the ECE head could approve a
 * CSE lecturer's leave. Requests from someone with no department stay visible
 * to every HOD rather than disappearing.
 */
async function departmentOf(institutionId: string, userIds: string[]): Promise<Map<string, string | null>> {
  const users = await basePrisma.user.findMany({
    where: { institutionId, id: { in: [...new Set(userIds)] } },
    select: { id: true, departmentId: true }
  });
  return new Map(users.map((u) => [u.id, u.departmentId ?? null]));
}

/**
 * A faculty-step request about one course (attendance condonation) is for that
 * course's teacher, not every faculty member in the institution.
 */
async function facultyMayAct(context: TenantContext, entityType: string, entityId: string): Promise<boolean> {
  if (context.role !== 'faculty' || entityType !== 'ExamRegistration') return true;
  const reg = await basePrisma.examRegistration.findFirst({
    where: { id: entityId, institutionId: context.institutionId },
    select: { schedule: { select: { course: { select: { facultyId: true } } } } }
  });
  const profile = await basePrisma.facultyProfile.findFirst({ where: { userId: context.userId, institutionId: context.institutionId }, select: { id: true } });
  return !!reg && !!profile && reg.schedule.course.facultyId === profile.id;
}

async function hodMayAct(context: TenantContext, requesterId: string): Promise<boolean> {
  if (context.role !== 'hod') return true;
  const depts = await departmentOf(context.institutionId, [context.userId, requesterId]);
  const mine = depts.get(context.userId);
  const theirs = depts.get(requesterId);
  return !mine || !theirs || mine === theirs;
}

const HISTORY_OVERSIGHT = new Set(['super_admin', 'registrar', 'vice_chancellor', 'pro_vc', 'principal', 'auditor']);

/**
 * Refuse to start an approval for a record that does not exist.
 *
 * `entityId` was accepted on trust, so anyone could open an approval — and put
 * work in an approver's inbox — for a record that was never created. When the
 * entity type names a model, the row must exist in the caller's institution.
 * A type that is not a model (a process with no table behind it) is let through.
 */
async function assertEntityExists(context: TenantContext, entityType: string, entityId: string): Promise<void> {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === entityType);
  if (!model) return;

  const delegate = (basePrisma as unknown as Record<string, { findFirst: (args: unknown) => Promise<unknown> }>)[
    entityType.charAt(0).toLowerCase() + entityType.slice(1)
  ];
  if (!delegate) return;

  const tenantOwned = model.fields.some((f) => f.name === 'institutionId');
  const row = await delegate.findFirst({
    where: { id: entityId, ...(tenantOwned ? { institutionId: context.institutionId } : {}) },
    select: { id: true }
  });
  if (!row) {
    throw new NotFoundError(`${entityType} ${entityId}`);
  }
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

  await assertEntityExists(context, input.entityType, input.entityId);

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

  const started = await mutate(
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

  await notifyApprovers(context, definition.name, firstStep.assigneeRole, input.entityType, input.entityId, context.userId);
  return started;
}

/**
 * Approvers had to open the Approvals page to discover work. Each step now
 * drops a note in the assignee role's in-app inbox. A HOD step goes only to the
 * HOD of the requester's department.
 */
async function notifyApprovers(
  context: TenantContext,
  workflowName: string,
  role: string,
  entityType: string,
  entityId: string,
  requesterId: string
): Promise<void> {
  const requester = await basePrisma.user.findFirst({
    where: { id: requesterId, institutionId: context.institutionId },
    select: { name: true, departmentId: true }
  });
  await notifyInApp(
    context.institutionId,
    { roles: [role], departmentId: role === 'hod' ? requester?.departmentId ?? null : null, excludeUserId: context.userId },
    {
      eventType: 'workflow.assigned',
      subject: `Approval needed: ${workflowName}`,
      body: `${requester?.name ?? 'A user'} submitted a request that is waiting for your decision under Approvals & Workflows.`,
      relatedEntityType: entityType,
      relatedEntityId: entityId
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
  //
  // Once an instance has ESCALATED, the escalation role may act as well. The
  // original assignee is NOT locked out: escalation exists so a late approval
  // still happens, not to punish whoever was slow, and removing their access
  // would strand any decision they were mid-way through.
  const permitted = new Set([currentStep.assigneeRole]);
  if (instance.escalatedAt && currentStep.escalationRole) {
    permitted.add(currentStep.escalationRole);
  }

  // Withdrawing your own request is not an approval decision, so it does not
  // need the approver's role. Before this, only the current approver could
  // cancel — the one person who had not asked for anything.
  const withdrawingOwn = action === 'cancelled' && instance.startedBy === context.userId;

  if (context.role !== 'super_admin' && !withdrawingOwn && !permitted.has(context.role)) {
    throw new BusinessRuleError(
      `This approval is waiting on ${[...permitted].join(' or ')}, not ${context.role}. Step: "${currentStep.name}".`,
      { requiredRole: [...permitted].join(' or '), step: currentStep.name }
    );
  }
  if (!withdrawingOwn && !(await hodMayAct(context, instance.startedBy))) {
    throw new AuthorizationError('This request is from another department. Its own HOD approves it.');
  }
  if (!withdrawingOwn && !(await facultyMayAct(context, instance.entityType, instance.entityId))) {
    throw new AuthorizationError('This request is for the course teacher.');
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

  const result = await mutate(
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

      // The approval's outcome becomes the record's own status, in the same
      // transaction — otherwise a leave approved by every step still read
      // "pending" on the faculty member's screen.
      if (complete) {
        await applyOutcome(db, instance.entityType, instance.entityId, finalStatus);
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

  // An approved timetable change takes effect now, outside the approval's own
  // transaction (it notifies people and may find the slot taken meanwhile).
  if (!nextStep && finalStatus === 'approved' && instance.entityType === 'TimetableChange') {
    await applyApprovedChange({ userId: context.userId, role: context.role, institutionId: context.institutionId }, instance.entityId);
  }
  // A course's lesson plan: approved, or returned to the teacher.
  if (!nextStep && instance.definition.code === 'COURSE_LESSON_PLAN') {
    await basePrisma.course.updateMany({
      where: { id: instance.entityId, institutionId: context.institutionId },
      data: { lessonPlanStatus: finalStatus === 'approved' ? 'approved' : finalStatus === 'rejected' ? 'returned' : null, lessonPlanNote: note ?? null }
    });
  }
  // The Dean's approval of a department's results is what publishes them.
  if (!nextStep && instance.entityType === 'Department' && instance.definition.code === 'RESULT_PUBLICATION') {
    if (finalStatus === 'approved') await publishDepartment(context, instance.entityId);
    else await basePrisma.approvalItem.updateMany({ where: { institutionId: context.institutionId, workflowInstanceId: instance.id }, data: { status: finalStatus } });
  }

  if (nextStep) {
    await notifyApprovers(context, instance.definition.name, nextStep.assigneeRole, instance.entityType, instance.entityId, instance.startedBy);
  } else if (instance.startedBy !== context.userId) {
    await notifyInApp(
      context.institutionId,
      { userIds: [instance.startedBy] },
      {
        eventType: `workflow.${finalStatus}`,
        subject: `Your request was ${finalStatus}: ${instance.definition.name}`,
        body: note ? `Final decision note: ${note}` : `The ${currentStep.name} step recorded the final decision.`,
        relatedEntityType: instance.entityType,
        relatedEntityId: instance.entityId
      }
    );
  }
  return result;
}

/**
 * Record statuses written when an approval finishes, per entity type.
 *
 * Only records whose own status means "approved or not" are listed. A type not
 * listed here keeps whatever status its own module manages.
 */
const OUTCOME_STATUS: Record<string, Partial<Record<'approved' | 'rejected' | 'cancelled', string>>> = {
  LeaveRequest: { approved: 'approved', rejected: 'rejected', cancelled: 'cancelled' },
  CertificateRequest: { approved: 'approved', rejected: 'rejected', cancelled: 'cancelled' },
  ResearchProject: { approved: 'ongoing', rejected: 'rejected', cancelled: 'withdrawn' },
  // 'published' is the publication's own state; approval records that the HOD and IQAC verified it.
  Publication: { approved: 'verified', rejected: 'rejected' },
  Patent: { approved: 'filed', rejected: 'rejected', cancelled: 'abandoned' },
  FeeWaiverRequest: { approved: 'approved', rejected: 'rejected', cancelled: 'cancelled' },
  TimetableChange: { approved: 'approved', rejected: 'rejected', cancelled: 'cancelled' },
  // Decided from Approvals & Workflows as well as their own screens.
  CurriculumProposal: { approved: 'approved', rejected: 'rejected' },
  PurchaseRequest: { approved: 'approved', rejected: 'rejected' },
  PromotionRequest: { approved: 'approved', rejected: 'rejected', cancelled: 'cancelled' },
  StudentLeaveRequest: { approved: 'approved', rejected: 'rejected', cancelled: 'cancelled' },
  // Handled below — each has more to do than a status.
  ExamRegistration: { approved: 'condoned', rejected: 'ineligible', cancelled: 'ineligible' },
  AQARRecord: { approved: 'approved', rejected: 'returned' },
  AccreditationChecklist: { approved: 'completed', rejected: 'in_progress' }
};

async function applyOutcome(db: typeof basePrisma, entityType: string, entityId: string, outcome: string): Promise<void> {
  const status = OUTCOME_STATUS[entityType]?.[outcome as 'approved' | 'rejected' | 'cancelled'];
  if (!status) return;
  if (entityType === 'FeeWaiverRequest') {
    await applyFeeWaiver(db, entityId, status);
    return;
  }
  if (entityType === 'ExamRegistration') {
    // Condonation granted: the paper becomes eligible (fees are never condoned here).
    const reg = await db.examRegistration.findFirst({ where: { id: entityId } });
    if (reg && status === 'condoned' && reg.feesCleared) {
      await db.examRegistration.updateMany({
        where: { id: entityId },
        data: { isEligible: true, isCondoned: true, condonedAt: new Date(), condonationReason: reg.condonationRequest ?? 'Condoned on approval', status: 'condoned' }
      });
    }
    return;
  }
  if (entityType === 'StudentLeaveRequest') {
    const leave = await db.studentLeaveRequest.findFirst({ where: { id: entityId } });
    await db.studentLeaveRequest.updateMany({ where: { id: entityId }, data: { status, decidedAt: new Date() } });
    // Approved on-duty: classes missed in that period count as attended.
    if (leave && status === 'approved' && leave.type === 'on_duty') {
      const sessions = await db.attendanceSession.findMany({
        where: { date: { gte: new Date(leave.fromDate.toISOString().slice(0, 10)), lte: new Date(leave.toDate.toISOString().slice(0, 10) + 'T23:59:59.999Z') } },
        select: { id: true }
      });
      await db.attendance.updateMany({
        where: { studentProfileId: leave.studentProfileId, attendanceSessionId: { in: sessions.map((x) => x.id) }, status: 'absent' },
        data: { status: 'on_duty' }
      });
    }
    return;
  }
  if (entityType === 'PromotionRequest') {
    // The VC's order takes effect: the faculty member's designation changes.
    const promotion = await db.promotionRequest.findFirst({ where: { id: entityId } });
    await db.promotionRequest.updateMany({ where: { id: entityId }, data: { status, ...(status === 'approved' ? { approvedAt: new Date() } : {}) } });
    if (promotion && status === 'approved') {
      const profile = await db.facultyProfile.findFirst({ where: { id: promotion.facultyProfileId, institutionId: promotion.institutionId } });
      if (profile) await db.user.updateMany({ where: { id: profile.userId, institutionId: promotion.institutionId }, data: { designation: promotion.newDesignation } });
    }
    return;
  }
  const delegate = (db as unknown as Record<string, { updateMany: (args: unknown) => Promise<unknown> }>)[
    entityType.charAt(0).toLowerCase() + entityType.slice(1)
  ];
  await delegate?.updateMany({ where: { id: entityId }, data: { status } });
}

/**
 * A sanctioned waiver reduces what the student owes: the amount (capped at
 * what is still outstanding) is added to FeeRecord.waivedAmount with the
 * reason, and a fee left with nothing to pay becomes `waived`.
 */
async function applyFeeWaiver(db: typeof basePrisma, requestId: string, status: string): Promise<void> {
  const request = await db.feeWaiverRequest.findFirst({ where: { id: requestId } });
  if (!request) return;
  let sanctioned: number | null = null;
  if (status === 'approved') {
    const fee = await db.feeRecord.findFirst({ where: { id: request.feeRecordId } });
    if (fee) {
      const outstanding = Math.max(0, fee.amount - fee.paidAmount - fee.waivedAmount);
      sanctioned = Math.round(Math.min(request.requestedAmount, outstanding) * 100) / 100;
      const waived = fee.waivedAmount + sanctioned;
      await db.feeRecord.updateMany({
        where: { id: fee.id },
        data: {
          waivedAmount: waived,
          waiverReason: `${request.category.replace(/_/g, ' ')}: ${request.reason}`.slice(0, 500),
          ...(fee.amount - fee.paidAmount - waived <= 0.005 ? { status: 'waived' } : {})
        }
      });
    }
  }
  await db.feeWaiverRequest.updateMany({
    where: { id: requestId },
    data: { status, decidedAt: new Date(), ...(sanctioned !== null ? { sanctionedAmount: sanctioned } : {}) }
  });
}

/**
 * Open the approval for a record that has just been created — best effort.
 *
 * Called by the screens where the record is raised (a leave application, a
 * research project, a certificate request …) so the request reaches its first
 * approver's inbox with nothing more for the requester to do. If the
 * institution has not defined that workflow, nothing happens: the record is
 * still created, it just is not routed.
 */
export async function startApprovalFor(
  context: TenantContext,
  code: string,
  entityType: string,
  entityId: string
): Promise<{ instanceId: string; assigneeRole: string } | null> {
  try {
    const started = await startWorkflow(context, { code, entityType, entityId });
    return { instanceId: started.instanceId, assigneeRole: started.assigneeRole };
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    logger.warn('Could not open the approval for a new record', {
      module: 'workflow', code, entityType, entityId, error: (error as Error).message
    });
    return null;
  }
}

/** What is waiting on this caller's role. */
export async function inbox(
  context: TenantContext,
  page: { page: number; pageSize: number }
): Promise<{
  data: Array<{
    instanceId: string;
    workflow: string;
    workflowName: string;
    requestedBy: string | null;
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
  const roleMatches = instances.filter((i) => {
    const step = i.definition.steps.find((s) => s.id === i.currentStepId);
    return step && (context.role === 'super_admin' || step.assigneeRole === context.role);
  });
  let mine = roleMatches;
  if (context.role === 'hod') {
    const depts = await departmentOf(context.institutionId, [context.userId, ...roleMatches.map((i) => i.startedBy)]);
    const own = depts.get(context.userId);
    mine = roleMatches.filter((i) => !own || !depts.get(i.startedBy) || depts.get(i.startedBy) === own);
  }
  if (context.role === 'faculty') {
    const allowed = await Promise.all(mine.map((i) => facultyMayAct(context, i.entityType, i.entityId)));
    mine = mine.filter((_, n) => allowed[n]);
  }

  const start = (page.page - 1) * page.pageSize;
  const slice = mine.slice(start, start + page.pageSize);
  const now = Date.now();
  // Readable on a dashboard: the process name and who asked.
  const requesters = await basePrisma.user.findMany({
    where: { institutionId: context.institutionId, id: { in: [...new Set(slice.map((i) => i.startedBy))] } },
    select: { id: true, name: true }
  });
  const requesterName = new Map(requesters.map((u) => [u.id, u.name]));

  return {
    data: slice.map((i) => {
      const step = i.definition.steps.find((s) => s.id === i.currentStepId)!;
      const since = i.transitions[0]?.occurredAt ?? i.startedAt;
      return {
        instanceId: i.id,
        workflow: `${i.definition.code} v${i.definition.version}`,
        workflowName: i.definition.name,
        requestedBy: requesterName.get(i.startedBy) ?? null,
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

  // An approval trail names who asked for what and what each approver wrote.
  // It was readable by every signed-in account — a student could read the
  // history of a faculty recruitment. It is for the people involved: whoever
  // raised it, anyone who acted on it, any role that approves a step, and the
  // offices that oversee workflows.
  const involved =
    HISTORY_OVERSIGHT.has(context.role) ||
    instance.startedBy === context.userId ||
    instance.transitions.some((t) => t.actorId === context.userId) ||
    instance.definition.steps.some((s) => s.assigneeRole === context.role || s.escalationRole === context.role);
  if (!involved) {
    throw new AuthorizationError('You are not a party to this approval.');
  }
  const personallyInvolved = instance.startedBy === context.userId || instance.transitions.some((t) => t.actorId === context.userId);
  if (!personallyInvolved && !HISTORY_OVERSIGHT.has(context.role) && (!(await hodMayAct(context, instance.startedBy)) || !(await facultyMayAct(context, instance.entityType, instance.entityId)))) {
    throw new AuthorizationError('This request is from another department.');
  }

  const stepName = (id: string | null) =>
    id ? instance.definition.steps.find((s) => s.id === id)?.name ?? id : null;

  // Who asked, what they asked for, and where it stands — the approver had
  // only Approve / Reject to go on, with no dates or reason to read.
  const people = await basePrisma.user.findMany({
    where: { institutionId: context.institutionId, id: { in: [instance.startedBy, ...instance.transitions.map((t) => t.actorId)] } },
    select: { id: true, name: true, role: true, designation: true, department: { select: { name: true } } }
  });
  const person = (id: string) => people.find((u) => u.id === id);
  const requester = person(instance.startedBy);
  const steps = instance.definition.steps.map((step) => {
    const decided = [...instance.transitions].reverse().find((t) => t.fromStepId === step.id && t.action !== 'started');
    const state =
      decided ? decided.action
      : step.id === instance.currentStepId && instance.status === 'pending' ? 'current'
      : 'upcoming';
    return {
      sequence: step.sequence,
      name: step.name,
      assigneeRole: step.assigneeRole,
      state,
      actorName: decided ? person(decided.actorId)?.name ?? null : null,
      note: decided?.note ?? null,
      at: decided?.occurredAt ?? null
    };
  });

  return {
    instanceId: instance.id,
    requester: requester
      ? { name: requester.name, role: requester.role, designation: requester.designation, department: requester.department?.name ?? null }
      : null,
    record: await recordSummary(instance.entityType, instance.entityId, instance.institutionId),
    steps,
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
      actorName: person(t.actorId)?.name ?? null,
      actorRole: t.actorRole,
      note: t.note,
      occurredAt: t.occurredAt
    }))
  };
}

/** Fields not worth showing an approver. */
const HIDDEN_FIELD = /(^id$|Id$|^institution|^campus|password|lockVersion|^createdAt$|^updatedAt$|^deletedAt$|^deletedBy$)/;

/**
 * The approved record as label → value pairs. Read through the base client
 * with the instance's own institution already checked by the caller.
 */
async function recordSummary(entityType: string, entityId: string, institutionId: string): Promise<Array<{ label: string; value: unknown }>> {
  if (entityType === 'ExamRegistration') {
    const r = await basePrisma.examRegistration.findFirst({
      where: { id: entityId, institutionId },
      include: { schedule: { include: { course: true } }, session: true, studentProfile: { include: { user: { select: { name: true } } } } }
    }).catch(() => null);
    if (!r) return [];
    return [
      { label: 'Student', value: `${r.studentProfile.user?.name ?? ''} (${r.studentProfile.rollNumber})` },
      { label: 'Course', value: `${r.schedule.course.code} – ${r.schedule.course.name}` },
      { label: 'Exam', value: `${r.session.name}, ${r.schedule.examDate.toISOString().slice(0, 10)}` },
      { label: 'Attendance', value: r.attendancePercentage === null ? 'not recorded' : `${r.attendancePercentage}% (required ${r.session.minAttendancePercentage}%)` },
      { label: "Student's reason", value: r.condonationRequest ?? '—' },
      ...(r.condonationDocumentUrl ? [{ label: 'Supporting document', value: r.condonationDocumentUrl }] : [])
    ];
  }
  if (entityType === 'Course') {
    const course = await basePrisma.course.findFirst({ where: { id: entityId, institutionId }, include: { faculty: { include: { user: { select: { name: true } } } }, lessonPlans: { orderBy: { weekNumber: 'asc' } } } }).catch(() => null);
    if (!course) return [];
    const weeks = (course as any).lessonPlans as Array<{ weekNumber: number; topic: string; status: string }>;
    return [
      { label: 'Course', value: `${course.code} – ${course.name} (semester ${course.semester})` },
      { label: 'Faculty', value: (course as any).faculty?.user?.name ?? '—' },
      { label: 'Weeks planned', value: weeks.length },
      { label: 'Weeks completed', value: weeks.filter((w) => w.status === 'completed').length },
      { label: 'Plan', value: weeks.map((w) => `W${w.weekNumber}: ${w.topic}`).join(' · ') || '—' }
    ];
  }
  const delegate = (basePrisma as unknown as Record<string, { findFirst?: (args: unknown) => Promise<Record<string, unknown> | null> }>)[
    entityType.charAt(0).toLowerCase() + entityType.slice(1)
  ];
  const row = await delegate?.findFirst?.({ where: { id: entityId } }).catch(() => null);
  if (!row) return [];
  return Object.entries(row)
    .filter(([key, value]) => !HIDDEN_FIELD.test(key) && value !== null && value !== '' && (typeof value !== 'object' || value instanceof Date || Array.isArray(value)))
    .map(([key, value]) => ({
      label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
      value: Array.isArray(value) ? value.join(', ') : value
    }));
}

/**
 * Escalate every instance whose current step has passed its SLA.
 *
 * WHY THIS IS A CALLED SWEEP AND NOT A TIMER
 *
 * There is no scheduler in this system. Rather than pretend otherwise, this is
 * an explicit operation: an operator or a cron entry calls
 * `POST /workflow/escalate` and gets told exactly what moved. The inbox
 * previously reported `overdue` and carried a comment saying escalation does not
 * happen by itself — that was honest, and it stayed true until now because
 * nothing acted on the flag.
 *
 * WHAT ESCALATION DOES AND DOES NOT DO
 *
 * It widens WHO MAY ACT; it does not decide anything. The approval stays at the
 * same step, still pending, and the original assignee keeps their access. A
 * system that auto-approved on a deadline would be recording decisions nobody
 * made, which is the failure this whole engine exists to prevent.
 *
 * Steps with no `escalationRole` are reported as overdue and left alone.
 * Escalating a decision to someone without the standing to make it is worse than
 * leaving it late.
 */
export async function escalateOverdue(
  context: TenantContext
): Promise<{ escalated: number; overdueWithoutRole: number; details: Record<string, unknown>[] }> {
  const open = await basePrisma.workflowInstance.findMany({
    where: { institutionId: context.institutionId, status: 'pending', escalatedAt: null },
    include: {
      definition: { include: { steps: true } },
      transitions: { orderBy: { occurredAt: 'desc' }, take: 1 }
    }
  });

  const now = Date.now();
  const details: Record<string, unknown>[] = [];
  let escalated = 0;
  let overdueWithoutRole = 0;

  for (const instance of open) {
    const step = instance.definition.steps.find((st) => st.id === instance.currentStepId);
    if (!step?.slaHours) continue;

    const since = instance.transitions[0]?.occurredAt ?? instance.startedAt;
    const overdueBy = now - since.getTime() - step.slaHours * 3600_000;
    if (overdueBy <= 0) continue;

    if (!step.escalationRole) {
      overdueWithoutRole += 1;
      details.push({
        instanceId: instance.id,
        step: step.name,
        overdueHours: Math.floor(overdueBy / 3600_000),
        action: 'reported only — this step has no escalation role'
      });
      continue;
    }

    await mutate(
      context,
      {
        action: 'UPDATE',
        module: 'workflow',
        resource: `WorkflowInstance:${instance.id}`,
        details:
          `Escalated "${step.name}" from ${step.assigneeRole} to ${step.escalationRole} ` +
          `after ${Math.floor(overdueBy / 3600_000)}h past a ${step.slaHours}h SLA`,
        severity: 'warning'
      },
      async (tx) => {
        // Guarded on currentStepId: if someone acted between the read above and
        // this write, the step has moved and there is nothing to escalate.
        const moved = await tx.workflowInstance.updateMany({
          where: {
            id: instance.id,
            institutionId: context.institutionId,
            currentStepId: step.id,
            status: 'pending',
            escalatedAt: null
          },
          data: { escalatedAt: new Date(), escalatedFromRole: step.assigneeRole }
        });

        if (moved.count === 0) return;

        // The escalation is itself a transition. An approval that widened who
        // could decide it, with no record of when or why, is exactly the gap the
        // transition log exists to close.
        await tx.workflowTransition.create({
          data: {
            // No institutionId: WorkflowTransition carries none and is scoped
            // through its parent instance. See tenantExtension.ts.
            instanceId: instance.id,
            fromStepId: step.id,
            toStepId: step.id,
            action: 'escalated',
            actorId: context.userId,
            actorRole: context.role,
            note:
              `SLA of ${step.slaHours}h breached by ${Math.floor(overdueBy / 3600_000)}h; ` +
              `${step.escalationRole} may now act alongside ${step.assigneeRole}`
          }
        });
      }
    );

    escalated += 1;
    details.push({
      instanceId: instance.id,
      step: step.name,
      from: step.assigneeRole,
      to: step.escalationRole,
      overdueHours: Math.floor(overdueBy / 3600_000),
      action: 'escalated'
    });
  }

  return { escalated, overdueWithoutRole, details };
}

/**
 * The active workflow catalogue: what can be started, and who approves each step.
 *
 * There was no way to read this. A workflow could be started only by someone who
 * already knew its code, which is why none of the definitions had a screen.
 */
export async function listDefinitions(context: TenantContext): Promise<
  Array<{
    code: string;
    name: string;
    description: string | null;
    entityType: string;
    version: number;
    steps: Array<{ sequence: number; name: string; assigneeRole: string; slaHours: number | null; escalationRole: string | null }>;
  }>
> {
  const definitions = await basePrisma.workflowDefinition.findMany({
    where: { institutionId: context.institutionId, active: true },
    include: { steps: { orderBy: { sequence: 'asc' } } },
    orderBy: { name: 'asc' }
  });
  return definitions.map((d) => ({
    code: d.code,
    name: d.name,
    description: d.description,
    entityType: d.entityType,
    version: d.version,
    steps: d.steps.map((s) => ({
      sequence: s.sequence,
      name: s.name,
      assigneeRole: s.assigneeRole,
      slaHours: s.slaHours,
      escalationRole: s.escalationRole
    }))
  }));
}

/** Approvals the caller raised, newest first — so a requester can follow their own. */
export async function listMine(
  context: TenantContext,
  page: { page: number; pageSize: number }
): Promise<{
  data: Array<{
    instanceId: string;
    workflow: string;
    workflowName: string;
    entityType: string;
    entityId: string;
    status: string;
    currentStep: string | null;
    waitingOn: string | null;
    startedAt: Date;
    endedAt: Date | null;
  }>;
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}> {
  const where = { institutionId: context.institutionId, startedBy: context.userId };
  const [total, instances] = await Promise.all([
    basePrisma.workflowInstance.count({ where }),
    basePrisma.workflowInstance.findMany({
      where,
      include: { definition: { include: { steps: true } } },
      orderBy: { startedAt: 'desc' },
      skip: (page.page - 1) * page.pageSize,
      take: page.pageSize
    })
  ]);
  return {
    data: instances.map((i) => {
      const step = i.definition.steps.find((s) => s.id === i.currentStepId) ?? null;
      return {
        instanceId: i.id,
        workflow: i.definition.code,
        workflowName: i.definition.name,
        entityType: i.entityType,
        entityId: i.entityId,
        status: i.status,
        currentStep: i.status === 'pending' ? step?.name ?? null : null,
        waitingOn: i.status === 'pending' ? step?.assigneeRole ?? null : null,
        startedAt: i.startedAt,
        endedAt: i.endedAt
      };
    }),
    meta: { page: page.page, pageSize: page.pageSize, total, totalPages: Math.max(1, Math.ceil(total / page.pageSize)) }
  };
}
