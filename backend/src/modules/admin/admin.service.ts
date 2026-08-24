/**
 * Administration service (Phase 3b).
 *
 * `routes/admin.ts` holds the highest-privilege endpoints in the system: who
 * exists, what role they hold, and what the institution says about itself.
 *
 * WHAT WAS WRONG
 *
 *   1. THE INSTITUTION'S ACCREDITATION WAS A LITERAL.
 *
 *          university: { name: 'Campus Harmony University', code: 'CHU',
 *                        type: 'Private', accreditation: 'NAAC A+' }
 *
 *      `GET /admin/config` reported an A+ NAAC grade to every caller, for every
 *      deployment, regardless of what the institution had actually been awarded.
 *      `Institution` carries real `naacGrade`, `aisheCode` and `nirfId` columns
 *      one join away. An accreditation grade asserted from a string literal is
 *      the most consequential fabrication in this codebase after the fee ledger:
 *      it is a claim about a regulator's finding.
 *
 *   2. USER DELETION WAS UNAUDITED. `prisma.user.delete({ where: { id } })` and
 *      nothing else. Accounts could be removed with no record of who did it or
 *      what the account was — in the module whose entire purpose is controlling
 *      access.
 *
 *   3. `role` WAS UNVALIDATED. The update handler whitelisted the field but
 *      accepted any string, so a user could be given a role no route recognises
 *      — locking them out silently — or one that grants more than intended.
 *
 *   4. NOTHING STOPPED THE LAST super_admin BEING REMOVED or demoted. An
 *      institution with no administrator cannot create one, because creating one
 *      requires an administrator.
 */

import { basePrisma } from '../../lib/prisma.js';
import { mutate } from '../../lib/service.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { KNOWN_ROLES } from '../../lib/tenant.js';
import type { TenantContext } from '../../lib/tenant.js';

/**
 * Refuse a change that would leave the institution with no administrator.
 *
 * Checked inside the transaction, against the caller's own institution: a
 * deployment with several institutions must not be able to borrow another's
 * administrator to satisfy the rule.
 */
async function assertNotLastSuperAdmin(
  tx: { user: { count: (args: unknown) => Promise<number> } },
  context: TenantContext,
  targetId: string,
  action: string
) {
  const target = await basePrisma.user.findFirst({
    where: { id: targetId, institutionId: context.institutionId },
    select: { role: true }
  });
  if (target?.role !== 'super_admin') return;

  const remaining = await tx.user.count({
    where: {
      institutionId: context.institutionId,
      role: 'super_admin',
      id: { not: targetId }
    }
  });

  if (remaining === 0) {
    throw new ValidationError(
      `This is the only super_admin for this institution; ${action} would leave it with no administrator, ` +
        'and creating a new one requires an administrator. Appoint another first.',
      { field: 'role' }
    );
  }
}

export function assertKnownRole(role: string) {
  if (!KNOWN_ROLES.includes(role as never)) {
    throw new ValidationError(
      `"${role}" is not a role this system recognises. A user given an unknown role can authenticate and then reach nothing.`,
      { field: 'role', known: KNOWN_ROLES }
    );
  }
}

/**
 * Delete a user.
 *
 * Audited at `critical`, with the account's details captured BEFORE removal —
 * afterwards there is nothing left to describe. Self-deletion is refused: an
 * administrator removing their own account cannot undo it.
 */
export async function deleteUser(
  context: TenantContext,
  id: string,
  reason: string
): Promise<{ id: string }> {
  if (!reason || reason.trim().length < 10) {
    throw new ValidationError(
      'A reason of at least 10 characters is required to delete a user account.',
      { field: 'reason' }
    );
  }

  if (id === context.userId) {
    throw new ValidationError(
      'You cannot delete your own account. Ask another administrator to do it, so the action has a second party.',
      { field: 'id' }
    );
  }

  const existing = await basePrisma.user.findFirst({
    where: { id, institutionId: context.institutionId },
    select: { id: true, name: true, email: true, role: true, designation: true }
  });
  if (!existing) throw new NotFoundError(`User ${id}`);

  return mutate(
    context,
    {
      action: 'DELETE',
      module: 'admin',
      resource: `User:${id}`,
      details: `Deleted ${existing.role} account ${existing.email} (${existing.name})`,
      // Captured before the row goes; afterwards there is nothing to record.
      oldValue: JSON.stringify(existing),
      reason: reason.trim(),
      severity: 'critical'
    },
    async (tx) => {
      await assertNotLastSuperAdmin(tx as never, context, id, 'deleting them');

      const result = await tx.user.deleteMany({
        where: { id, institutionId: context.institutionId }
      });
      if (result.count === 0) throw new NotFoundError(`User ${id}`);
      return { id };
    }
  );
}

/** Guard a role change, then let the caller perform it. */
export async function assertRoleChangeAllowed(
  context: TenantContext,
  targetId: string,
  newRole: string
) {
  assertKnownRole(newRole);

  if (newRole !== 'super_admin') {
    await assertNotLastSuperAdmin(
      basePrisma as never,
      context,
      targetId,
      `changing their role to ${newRole}`
    );
  }
}

export interface InstitutionConfigView {
  name: string;
  code: string;
  type: string;
  legalName: string | null;
  /** NULL when the institution has not recorded a grade. Never a literal. */
  naacGrade: string | null;
  aisheCode: string | null;
  nirfId: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  establishedAt: Date | null;
}

/**
 * The institution's own particulars, read from the record.
 *
 * Everything here used to be a string literal in the handler, including
 * `accreditation: 'NAAC A+'`. Where the institution has not recorded a value,
 * this returns null rather than inventing one — an unrecorded NAAC grade is a
 * fact about the data, and filling it in would be a claim about a regulator.
 */
export async function institutionConfig(
  context: TenantContext
): Promise<InstitutionConfigView> {
  const institution = await basePrisma.institution.findFirst({
    where: { id: context.institutionId },
    select: {
      name: true, code: true, type: true, legalName: true,
      naacGrade: true, aisheCode: true, nirfId: true,
      city: true, state: true, website: true, establishedAt: true
    }
  });

  if (!institution) throw new NotFoundError(`Institution ${context.institutionId}`);
  return institution;
}
