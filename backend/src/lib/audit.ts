/**
 * Audit trail service.
 *
 * The `SystemAuditLog` model existed and the Admin → Audit Logs screen queried
 * it in three places, but NOTHING in the 12,108 lines of route code ever wrote
 * a row. The audit screen displayed only whatever the seed script inserted.
 *
 * For an institutional record system this is disqualifying: a faculty member
 * could alter a published grade, or an administrator a payroll figure, with no
 * trace of who, when, or from what previous value.
 *
 * This service makes the audit trail real. It is deliberately written to be
 * called from a service layer (Phase 2) so that auditing is emitted in one
 * place per operation rather than repeated across 478 route handlers.
 *
 * Design decisions:
 *
 *  - `record()` NEVER throws. An audit failure must not roll back or block the
 *    business operation that succeeded. Failures are logged loudly instead.
 *  - `recordInTransaction()` DOES participate in the caller's transaction, for
 *    the cases where the audit entry must be atomic with the change (grade
 *    mutation, result publication, financial posting). Callers choose.
 *  - Old/new values are captured for mutations so a change is reconstructable.
 */

import type { Request } from 'express';
import { prisma } from './prisma.js';
import { logger } from './logger.js';

/** Severity of the audited action, used for filtering and alerting. */
export type AuditSeverity = 'info' | 'warning' | 'critical';

/**
 * Actions worth auditing. Kept as a union rather than free text so the audit
 * log stays queryable and typos cannot silently create a new "action".
 */
export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'PASSWORD_RESET'
  | 'PERMISSION_DENIED'
  | 'APPROVE'
  | 'REJECT'
  | 'PUBLISH'
  | 'EXPORT'
  | 'FILE_UPLOAD'
  | 'FILE_DOWNLOAD';

export interface AuditEntry {
  /** Who performed the action. Use 'anonymous' for pre-authentication events. */
  userId: string;
  userName?: string | undefined;
  role?: string | undefined;
  action: AuditAction;
  /** Functional module, e.g. 'examination', 'finance'. */
  module: string;
  /** Entity type and id, e.g. 'Enrollment:abc-123'. */
  resource: string;
  /** Human-readable description of what changed. */
  details: string;
  /** State before the change — required for UPDATE/DELETE to be reconstructable. */
  oldValue?: unknown;
  /** State after the change. */
  newValue?: unknown;
  /** Why the change was made. Required for sensitive overrides (e.g. grade edits). */
  reason?: string | undefined;
  severity?: AuditSeverity | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

/** Values that must never be persisted into the audit trail. */
const SENSITIVE_KEYS = new Set([
  'password',
  'newPassword',
  'oldPassword',
  'token',
  'secret',
  'apiKey',
  'cvv'
]);

function sanitise(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[max-depth]';
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => sanitise(item, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.has(key) ? '[REDACTED]' : sanitise(item, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * Serialise old/new values into the existing `details` text column.
 *
 * The current schema has no dedicated oldValue/newValue columns. Rather than
 * block auditing on a schema migration, values are appended as a structured
 * JSON suffix. Task T-104 adds proper columns and history tables; this keeps
 * the data captured from day one so nothing is lost in the interim.
 */
function composeDetails(entry: AuditEntry): string {
  const parts: string[] = [entry.details];

  if (entry.reason) parts.push(`Reason: ${entry.reason}`);

  if (entry.oldValue !== undefined || entry.newValue !== undefined) {
    parts.push(
      `Change: ${JSON.stringify({
        old: sanitise(entry.oldValue),
        new: sanitise(entry.newValue)
      })}`
    );
  }

  // Guard against unbounded rows from large payloads.
  const composed = parts.join(' | ');
  return composed.length > 8000 ? `${composed.slice(0, 7997)}...` : composed;
}

function toRow(entry: AuditEntry) {
  return {
    userId: entry.userId,
    userName: entry.userName ?? 'unknown',
    role: entry.role ?? 'unknown',
    action: entry.action,
    module: entry.module,
    resource: entry.resource,
    details: composeDetails(entry),
    ipAddress: entry.ipAddress ?? '0.0.0.0',
    userAgent: entry.userAgent ?? null,
    severity: entry.severity ?? 'info',
    timestamp: new Date()
  };
}

/**
 * Write an audit entry. Never throws.
 *
 * Use for the common case where the audit record should not be able to fail the
 * business operation.
 */
export async function record(entry: AuditEntry): Promise<void> {
  try {
    await prisma.systemAuditLog.create({ data: toRow(entry) });
  } catch (error) {
    // Deliberately swallowed — but loudly. Losing an audit row is serious and
    // must be visible in monitoring, yet it must not roll back a completed
    // institutional operation.
    logger.error('AUDIT WRITE FAILED — action was not recorded', {
      module: entry.module,
      operation: entry.action,
      resource: entry.resource,
      userId: entry.userId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Write an audit entry inside an existing transaction.
 *
 * Use where the audit record must be atomic with the change itself — grade
 * mutation, result publication, financial posting. If the audit write fails,
 * the whole transaction is rolled back, which is the correct trade-off for
 * records that must never change untracked.
 */
export async function recordInTransaction(
  tx: { systemAuditLog: { create: (args: { data: ReturnType<typeof toRow> }) => Promise<unknown> } },
  entry: AuditEntry
): Promise<void> {
  await tx.systemAuditLog.create({ data: toRow(entry) });
}

/** Extract actor and client context from an authenticated request. */
export function auditContextFromRequest(req: Request): {
  userId: string;
  role: string;
  ipAddress: string;
  userAgent?: string | undefined;
} {
  const user = (req as { user?: { id: string; role: string } }).user;
  return {
    userId: user?.id ?? 'anonymous',
    role: user?.role ?? 'anonymous',
    ipAddress: req.ip ?? '0.0.0.0',
    userAgent: req.get('user-agent') ?? undefined
  };
}

/** Convenience: audit an action described by an Express request. */
export async function recordFromRequest(
  req: Request,
  entry: Omit<AuditEntry, 'userId' | 'role' | 'ipAddress' | 'userAgent'>
): Promise<void> {
  await record({ ...entry, ...auditContextFromRequest(req) });
}
