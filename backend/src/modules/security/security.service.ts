/**
 * Security service (Phase 3b).
 *
 * `routes/security.ts` is 35 handlers of CRUD over seven entities: visitor
 * passes, patrol logs, ID cards, vehicle passes, vigilance cases, support
 * tickets and hostel access.
 *
 * WHAT WAS WRONG
 *
 *   1. EIGHT DELETE ENDPOINTS, NONE AUDITED. Every one was
 *      `prisma.X.delete({ where: { id } })` and a success message. Including:
 *
 *          DELETE /security/vigilance-cases/:id
 *          DELETE /security/incidents/:id
 *
 *      A vigilance case is a confidential investigation, with evidence files
 *      behind the authenticated download path added in Phase 0.3. The office
 *      conducting an investigation could destroy the record of it, and nothing
 *      anywhere would show that a record had ever existed.
 *
 *      Those two are now SOFT deleted (migration 0035). The row stays, the
 *      tenant extension filters it structurally so it leaves every screen, and
 *      the deletion is itself an audited event. The rest remain hard deletes —
 *      a cancelled visitor pass carries no evidentiary weight — but are audited.
 *
 *   2. NONE OF THE SEVEN MODELS HAD A TENANT KEY. All seven tables were global.
 *      Closed by 0035.
 *
 *   3. NO VALIDATION ON ANY WRITE, and none of the lists were bounded.
 */

import { basePrisma } from '../../lib/prisma.js';
import { mutate, toSkipTake, paginated, type PageRequest, type Paginated } from '../../lib/service.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import type { TenantContext } from '../../lib/tenant.js';

export type SecurityModel =
  | 'visitorPass'
  | 'patrolLog'
  | 'iDCardRequest'
  | 'vehiclePass'
  | 'vigilanceCase'
  | 'supportTicket'
  | 'incidentReport';

/**
 * Records whose deletion must not destroy them.
 *
 * Both are the evidence that something was investigated. An investigation the
 * investigating office can erase is not evidence of anything, and the erasure is
 * precisely the event an auditor would want to see.
 */
const SOFT_DELETE: ReadonlySet<SecurityModel> = new Set(['vigilanceCase', 'incidentReport']);

export async function listScoped(
  context: TenantContext,
  model: SecurityModel,
  page: PageRequest,
  orderBy?: Record<string, 'asc' | 'desc'>
): Promise<Paginated<unknown>> {
  const delegate = (basePrisma as unknown as Record<string, any>)[model];
  const where = { institutionId: context.institutionId };

  const [rows, total] = await Promise.all([
    delegate.findMany({ where, ...(orderBy ? { orderBy } : {}), ...toSkipTake(page) }),
    delegate.count({ where })
  ]);
  return paginated(rows, total, page);
}

/**
 * Remove a security record.
 *
 * Soft where the record is evidence, hard where it is not — but audited either
 * way, with the row captured BEFORE it goes. Vigilance deletions are recorded at
 * `critical`: of everything in this module, destroying an investigation is the
 * action most likely to be the thing being investigated.
 */
export async function removeRecord(
  context: TenantContext,
  spec: { model: SecurityModel; entity: string; id: string; reason: string }
): Promise<{ id: string; softDeleted: boolean }> {
  if (!spec.reason || spec.reason.trim().length < 10) {
    throw new ValidationError(
      `A reason of at least 10 characters is required to delete a ${spec.entity}.`,
      { field: 'reason' }
    );
  }

  const delegate = (basePrisma as unknown as Record<string, any>)[spec.model];
  const existing = await delegate.findFirst({
    where: { id: spec.id, institutionId: context.institutionId }
  });
  if (!existing) throw new NotFoundError(`${spec.entity} ${spec.id}`);

  const soft = SOFT_DELETE.has(spec.model);

  return mutate(
    context,
    {
      action: 'DELETE',
      module: 'security',
      resource: `${spec.entity}:${spec.id}`,
      details: soft
        ? `Withdrew ${spec.entity} ${spec.id} — retained and hidden, not destroyed`
        : `Deleted ${spec.entity} ${spec.id}`,
      // Captured before removal; afterwards there is nothing left to describe.
      oldValue: JSON.stringify(existing),
      reason: spec.reason.trim(),
      severity: soft ? 'critical' : 'warning'
    },
    async (tx) => {
      const txDelegate = (tx as unknown as Record<string, any>)[spec.model];

      if (soft) {
        // NOT a hard delete. The extension hides `deletedAt` rows from every
        // ordinary query, so this leaves the screens while staying answerable.
        const result = await txDelegate.updateMany({
          where: { id: spec.id, institutionId: context.institutionId },
          data: { deletedAt: new Date(), deletedBy: context.userId }
        });
        if (result.count === 0) throw new NotFoundError(`${spec.entity} ${spec.id}`);
        return { id: spec.id, softDeleted: true };
      }

      const result = await txDelegate.deleteMany({
        where: { id: spec.id, institutionId: context.institutionId }
      });
      if (result.count === 0) throw new NotFoundError(`${spec.entity} ${spec.id}`);
      return { id: spec.id, softDeleted: false };
    }
  );
}

/**
 * Remove a guard account.
 *
 * Was `prisma.patrolLog.deleteMany(...)` then `prisma.user.delete({ where: {
 * id } })` — no reason, no audit record, and no `institutionId` filter on
 * either `where` clause, so a security officer could delete a `User` row in
 * ANY institution by id. Worse: it never checked the target was actually a
 * guard, so this route could delete any user account in the system —
 * faculty, a dean, another institution's super_admin — not just the guards
 * it lists.
 *
 * `adminService.deleteUser()` was considered instead of a new function here
 * and rejected: it deletes any user in the caller's institution regardless
 * of role, which is exactly the privilege escalation this closes. Scoping
 * the lookup to `role: 'security_officer'` is what makes this a guard-roster
 * operation rather than a general account deletion reachable by a
 * non-admin role.
 */
export async function removeGuard(
  context: TenantContext,
  id: string,
  reason: string
): Promise<{ id: string }> {
  if (!reason || reason.trim().length < 10) {
    throw new ValidationError(
      'A reason of at least 10 characters is required to remove a guard.',
      { field: 'reason' }
    );
  }

  if (id === context.userId) {
    throw new ValidationError(
      'You cannot remove your own guard account. Ask another security officer or administrator to do it.',
      { field: 'id' }
    );
  }

  const existing = await basePrisma.user.findFirst({
    where: { id, institutionId: context.institutionId, role: 'security_officer' },
    select: { id: true, name: true, email: true, designation: true, campus: true }
  });
  if (!existing) throw new NotFoundError(`Guard ${id}`);

  return mutate(
    context,
    {
      action: 'DELETE',
      module: 'security',
      resource: `User:${id}`,
      details: `Removed guard ${existing.email} (${existing.name}) from the roster`,
      // Captured before removal; afterwards there is nothing left to describe.
      oldValue: JSON.stringify(existing),
      reason: reason.trim(),
      severity: 'critical'
    },
    async (tx) => {
      await tx.patrolLog.deleteMany({
        where: { officerId: id, institutionId: context.institutionId }
      });
      const result = await tx.user.deleteMany({
        where: { id, institutionId: context.institutionId, role: 'security_officer' }
      });
      if (result.count === 0) throw new NotFoundError(`Guard ${id}`);
      return { id };
    }
  );
}
