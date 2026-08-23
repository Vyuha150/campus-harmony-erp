/**
 * Service layer foundation (T-203).
 *
 * WHY THIS EXISTS
 *
 * All business logic previously lived inside route handlers — `hod.ts` alone is
 * 1,882 lines. That single omission is what made every other fix expensive:
 *
 *   Concern              per-endpoint   via services
 *   ------------------   ------------   ------------
 *   Validation                    478            ~18
 *   Transactions                  478    per operation
 *   Audit logging                 478              1
 *   Object-level authz            478    per service
 *
 * `mutate()` below is the reason this file matters: it makes "write the change,
 * write its audit record, commit both or neither" a single call. Auditing that
 * can silently fail is not an audit trail, and a grade change that commits
 * without its audit row is exactly what an institutional record system must
 * never allow.
 */

import { basePrisma } from './prisma.js';
import { recordInTransaction, type AuditAction, type AuditSeverity } from './audit.js';
import { currentTenant } from './tenantStore.js';
import { AuthorizationError, ValidationError, NotFoundError } from './errors.js';
import type { TenantContext } from './tenant.js';

/** Prisma transaction client. `any` is confined to this one alias. */
export type TransactionClient = Parameters<
  Parameters<typeof basePrisma.$transaction>[0]
>[0];

export interface AuditSpec {
  action: AuditAction;
  module: string;
  /** `Entity:id` — resolved after the write when the id is generated. */
  resource: string | ((result: unknown) => string);
  details: string | ((result: unknown) => string);
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | undefined;
  severity?: AuditSeverity | undefined;
}

/**
 * Run a mutation and its audit record in ONE transaction.
 *
 * If the audit write fails, the business change is rolled back. That trade-off
 * is deliberate for institutional records: an untraceable grade or payroll
 * change is worse than a failed request the user can retry.
 */
export async function mutate<T>(
  context: TenantContext,
  audit: AuditSpec,
  operation: (tx: TransactionClient) => Promise<T>
): Promise<T> {
  return basePrisma.$transaction(async (tx) => {
    const result = await operation(tx);

    await recordInTransaction(tx as never, {
      userId: context.userId,
      role: context.role,
      action: audit.action,
      module: audit.module,
      resource:
        typeof audit.resource === 'function' ? audit.resource(result) : audit.resource,
      details: typeof audit.details === 'function' ? audit.details(result) : audit.details,
      oldValue: audit.oldValue,
      newValue: audit.newValue,
      reason: audit.reason,
      severity: audit.severity
    });

    return result;
  });
}

/**
 * Tenant context for the current request.
 *
 * Services read the tenant from async context rather than taking it as a
 * parameter, so a caller cannot accidentally pass someone else's.
 */
export function requireContext(): TenantContext {
  const context = currentTenant();
  if (!context) {
    throw new AuthorizationError('This operation requires an institution context.');
  }
  return context;
}


/**
 * Soft-delete a row: mark it deleted, and record who and why, in ONE transaction.
 *
 * Hard deletion of an institutional record destroys the evidence that it ever
 * existed — and with it any ability to answer "who removed this student, and on
 * whose authority?". `deletedAt` keeps the row; the Prisma extension hides it
 * from every ordinary query; `includeDeleted()` is the explicit way back to it.
 *
 * A reason is REQUIRED. A removed record with no recorded justification is an
 * audit finding, and the moment to capture the reason is the moment of deletion
 * — never afterwards.
 */
export async function softDelete(
  context: TenantContext,
  spec: {
    model: string;
    id: string;
    /** `Entity:id` for the audit record. */
    resource: string;
    details: string;
    reason: string;
  }
): Promise<{ id: string; deletedAt: Date }> {
  if (!spec.reason || spec.reason.trim().length < 10) {
    throw new ValidationError(
      'Deleting a record requires a reason of at least 10 characters. A removed institutional record with no recorded justification is an audit finding.',
      { field: 'reason' }
    );
  }

  return mutate(
    context,
    {
      action: 'DELETE',
      module: spec.model,
      resource: spec.resource,
      details: spec.details,
      reason: spec.reason,
      // Deletion of an institutional record is always reviewable.
      severity: 'warning'
    },
    async (tx) => {
      const db = tx as never as Record<string, { updateMany: (a: unknown) => Promise<{ count: number }> }>;
      const delegate = db[spec.model.charAt(0).toLowerCase() + spec.model.slice(1)];

      if (!delegate) {
        throw new ValidationError(`Unknown model "${spec.model}" for soft delete.`);
      }

      const deletedAt = new Date();
      const result = await delegate.updateMany({
        where: { id: spec.id, deletedAt: null },
        data: { deletedAt, deletedBy: context.userId }
      });

      if (result.count === 0) {
        // Either it does not exist, or it is already deleted. Both mean the
        // caller's assumption is wrong, and silently succeeding would hide that.
        throw new NotFoundError(`${spec.model} ${spec.id} (it may already be deleted)`);
      }

      return { id: spec.id, deletedAt };
    }
  );
}

/**
 * The StudentProfile id belonging to the calling user, if any.
 *
 * Object-level authorisation for "a student may see their own X" — the check
 * that middleware cannot express, because the answer depends on a path
 * parameter. Returns null when the caller is not a student, so a caller must
 * treat null as "no match" rather than "permitted".
 *
 * Lives here rather than in a module because finance and library both need it,
 * and every remaining module that exposes per-student data will too.
 */
export async function resolveOwnStudentProfileId(
  context: TenantContext
): Promise<string | null> {
  const profile = await basePrisma.studentProfile.findFirst({
    where: { userId: context.userId, institutionId: context.institutionId },
    select: { id: true }
  });
  return profile?.id ?? null;
}

/** Standard pagination input. */
export interface PageRequest {
  page: number;
  pageSize: number;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

/**
 * Convert a page request into Prisma `skip`/`take`.
 *
 * Only ~9% of the 478 endpoints paginated; the rest returned entire tables. At
 * institutional scale (millions of attendance rows) that is a memory-exhaustion
 * path, so pagination belongs in the shared layer, not per-endpoint discretion.
 */
export function toSkipTake(page: PageRequest): { skip: number; take: number } {
  return { skip: (page.page - 1) * page.pageSize, take: page.pageSize };
}

export function paginated<T>(data: T[], total: number, page: PageRequest): Paginated<T> {
  return {
    data,
    meta: {
      page: page.page,
      pageSize: page.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / page.pageSize))
    }
  };
}
