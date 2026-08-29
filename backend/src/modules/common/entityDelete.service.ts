/**
 * Audited deletion (Phase 3c).
 *
 * Phase 3c began with 20 DELETE endpoints across eight route files, and not one
 * of them recorded anything. Every one was
 *
 *     await prisma.X.delete({ where: { id } });
 *     res.json({ success: true });
 *
 * A row disappeared and the system could not afterwards say that it ever
 * existed, who removed it, or what it contained. For a visitor pass that is
 * untidy; for a course with enrolments and results behind it, or a mentee
 * assignment, it destroys the explanation for records that remain.
 *
 * WHY ONE HELPER
 *
 * The 20 differ only in model and wording. Twenty near-identical services would
 * be twenty places for the rule to rot — the same reasoning as
 * `entityUpdate.service.ts`, and the same reasoning that explains how the
 * identical mass-assignment line ended up in two files.
 *
 * WHAT IT REFUSES
 *
 * A delete with no reason, and a delete of a row that has dependents where those
 * dependents would be silently orphaned or cascaded. `blockers` lets a caller
 * name the relationships that must be empty first, so "you cannot delete a
 * course that has enrolments" is a sentence the user reads rather than a foreign
 * key error they do not.
 */

import { basePrisma } from '../../lib/prisma.js';
import { mutate } from '../../lib/service.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import type { TenantContext } from '../../lib/tenant.js';

export interface DeleteSpec {
  /** Prisma delegate, e.g. `sportsTeam`. */
  model: string;
  /** Model name for the audit resource, e.g. `SportsTeam`. */
  entity: string;
  /** Functional module for the audit entry. */
  module: string;
  id: string;
  reason: string;
  /**
   * Relationships that must be empty before the row may go.
   *
   * Each names another model and the column pointing back here. A non-empty
   * relationship produces a refusal that says what is in the way.
   */
  blockers?: { model: string; foreignKey: string; describe: string }[];
  /** `true` for records whose deletion would destroy evidence. */
  soft?: boolean;
  /**
   * For a model with no institutionId column of its own — e.g. MenteeAssignment,
   * scoped only via `studentId -> StudentProfile.institutionId`. Builds the
   * relation-based tenant filter in place of the default `{ institutionId }`.
   * Without this, `findFirst`/`updateMany`/`deleteMany` below throw a Prisma
   * validation error ("Unknown argument institutionId") for such a model —
   * fails closed, but completely broken, for every caller, not just a
   * cross-tenant one. Found live: DELETE /dean/mentoring/assignments/:studentId
   * crashed with exactly that error on a same-institution delete.
   */
  scopeWhere?: (institutionId: string) => Record<string, unknown>;
}

export async function deleteTenantEntity(
  context: TenantContext,
  spec: DeleteSpec
): Promise<{ id: string; softDeleted: boolean }> {
  if (!spec.reason || spec.reason.trim().length < 10) {
    throw new ValidationError(
      `A reason of at least 10 characters is required to delete a ${spec.entity}.`,
      { field: 'reason' }
    );
  }

  const delegate = (basePrisma as unknown as Record<string, any>)[spec.model];
  const tenantWhere = spec.scopeWhere
    ? spec.scopeWhere(context.institutionId)
    : { institutionId: context.institutionId };

  const existing = await delegate.findFirst({
    where: { id: spec.id, ...tenantWhere }
  });
  if (!existing) throw new NotFoundError(`${spec.entity} ${spec.id}`);

  for (const blocker of spec.blockers ?? []) {
    const blockerDelegate = (basePrisma as unknown as Record<string, any>)[blocker.model];
    const count = await blockerDelegate.count({ where: { [blocker.foreignKey]: spec.id } });
    if (count > 0) {
      throw new ValidationError(
        `This ${spec.entity} cannot be deleted: ${count} ${blocker.describe} still reference it. ` +
          'Removing it would leave those records explaining nothing.',
        { field: 'id', blockedBy: blocker.model, count }
      );
    }
  }

  return mutate(
    context,
    {
      action: 'DELETE',
      module: spec.module,
      resource: `${spec.entity}:${spec.id}`,
      details: spec.soft
        ? `Withdrew ${spec.entity} ${spec.id} — retained and hidden, not destroyed`
        : `Deleted ${spec.entity} ${spec.id}`,
      // Captured before removal; afterwards there is nothing left to describe.
      oldValue: JSON.stringify(existing),
      reason: spec.reason.trim(),
      severity: spec.soft ? 'critical' : 'warning'
    },
    async (tx) => {
      const txDelegate = (tx as unknown as Record<string, any>)[spec.model];

      if (spec.soft) {
        const result = await txDelegate.updateMany({
          where: { id: spec.id, ...tenantWhere },
          data: { deletedAt: new Date(), deletedBy: context.userId }
        });
        if (result.count === 0) throw new NotFoundError(`${spec.entity} ${spec.id}`);
        return { id: spec.id, softDeleted: true };
      }

      const result = await txDelegate.deleteMany({
        where: { id: spec.id, ...tenantWhere }
      });
      if (result.count === 0) throw new NotFoundError(`${spec.entity} ${spec.id}`);
      return { id: spec.id, softDeleted: false };
    }
  );
}
