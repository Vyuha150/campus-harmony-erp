/**
 * Audit that cannot be forgotten (Phase 3c).
 *
 * THE PROBLEM THIS SOLVES
 *
 * Phase 3c measured 105 write handlers across eight route files that changed
 * institutional data and recorded nothing. The fix that suggests itself is to
 * edit 105 handlers. That is the wrong shape: it closes today's 105 and does
 * nothing about the 106th, which arrives the first time someone adds a handler
 * without knowing the convention. The same argument settled tenant scoping in
 * Phase 3a, and the answer there was to make it structural rather than
 * remembered. This is that answer applied to audit.
 *
 * Every write to a tenant-owned model now leaves a row behind. Not because each
 * handler asks for one, but because the Prisma extension wraps the query
 * function itself, so a branch — including a branch added next year — cannot
 * return without passing through here.
 *
 * WHAT THIS IS NOT
 *
 * It is a FLOOR, not a replacement for a considered audit entry. It knows the
 * model, the operation, the actor and the affected row. It does not know what
 * the change meant, why it was made, or whether it was routine or serious, so
 * it records `module: 'data'` and `severity: 'info'` and says as much. A
 * handler that has something to say still says it through `mutate()`, whose
 * entry names the domain action, carries the reason, and can mark itself
 * critical — and which suppresses this one so a single action does not produce
 * two rows.
 *
 * WHAT IT REFUSES TO WRITE DOWN
 *
 * Audit logs are read by more people than the tables they describe, and they
 * are retained longer. Writing a password hash or a reset token into one turns
 * a durable, widely-read table into a credential store. `redact()` removes
 * those fields by name before anything is composed. The denylist is matched on
 * a normalised field name so `passwordHash`, `password_hash` and `PasswordHash`
 * are all caught.
 *
 * FAILURE POSTURE
 *
 * A failed audit write is logged loudly and does not roll back the operation,
 * matching `record()` in audit.ts. That is a real trade and it is made
 * deliberately: an institutional write that has already succeeded should not be
 * undone by a logging fault, but losing audit rows silently is how a log stops
 * being evidence, so the failure is made visible in monitoring instead.
 */

import { currentTenant, isServiceAudited } from './tenantStore.js';
import { logger } from './logger.js';

/**
 * The client is resolved lazily, and it has to be.
 *
 * `prisma.js` builds the client by applying `tenantExtension`, which now imports
 * this module. Importing `prisma.js` back at the top of this file closes the
 * cycle, and the loser of that race is whichever binding is read first — here,
 * `basePrisma`, which arrived as `undefined` and failed with
 * "Cannot read properties of undefined (reading 'client')" across eight test
 * files. Deferring the import to first use breaks the cycle without either
 * module having to know about the other's initialisation order.
 */
let clientPromise: Promise<{ systemAuditLog: { create: (a: unknown) => Promise<unknown> } }> | null =
  null;

function auditClient() {
  clientPromise ??= import('./prisma.js').then(
    (m) => m.basePrisma as unknown as { systemAuditLog: { create: (a: unknown) => Promise<unknown> } }
  );
  return clientPromise;
}

/** Operations that change data. Reads are not audited; there are far too many. */
const WRITE_OPERATIONS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany'
]);

/**
 * Field names never written to the audit log.
 *
 * Compared after stripping non-alphanumerics and lowercasing, so `passwordHash`,
 * `password_hash` and `PASSWORD_HASH` all match the same entry.
 */
const NEVER_LOG = new Set([
  'password',
  'passwordhash',
  'newpassword',
  'oldpassword',
  'currentpassword',
  'confirmpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'resettoken',
  'verificationtoken',
  'secret',
  'clientsecret',
  'apikey',
  'privatekey',
  'otp',
  'mfasecret',
  'sessiontoken'
]);

const normalise = (key: string) => key.replace(/[^a-z0-9]/gi, '').toLowerCase();

/** Replace sensitive values with a marker, recursively, preserving shape. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    out[key] = NEVER_LOG.has(normalise(key)) ? '[redacted]' : redact(inner, depth + 1);
  }
  return out;
}

/** Best-effort id of the row a write touched. */
function affectedId(result: unknown, args: unknown): string {
  const row = result as { id?: unknown; count?: unknown } | null;
  if (row && typeof row.id === 'string') return row.id;
  if (row && typeof row.count === 'number') return `${row.count} row(s)`;

  const where = (args as { where?: { id?: unknown } } | undefined)?.where;
  if (where && typeof where.id === 'string') return where.id;
  return 'unknown';
}

const ACTIONS: Record<string, string> = {
  create: 'CREATE',
  createMany: 'CREATE',
  createManyAndReturn: 'CREATE',
  update: 'UPDATE',
  updateMany: 'UPDATE',
  upsert: 'UPDATE',
  delete: 'DELETE',
  deleteMany: 'DELETE'
};

/**
 * Record a write, unless something else already has.
 *
 * Never throws: it is called from inside the extension, on the path of every
 * write in the system.
 */
export async function recordStructuralWrite(
  model: string,
  operation: string,
  args: unknown,
  result: unknown
): Promise<void> {
  if (!WRITE_OPERATIONS.has(operation)) return;

  // Writing an audit row is itself a write. Without this the first insert would
  // recurse until the stack gave out. `basePrisma` below is the second guard:
  // it does not carry the extension at all.
  if (model === 'SystemAuditLog' || model === 'AuditLog') return;

  // A service is describing this operation properly. Its entry is better.
  if (isServiceAudited()) return;

  // No tenant context means seeding, migration or a maintenance script — work
  // that has no authenticated actor to attribute, and whose provenance is the
  // deployment record rather than this table.
  const context = currentTenant();
  if (!context) return;

  const action = ACTIONS[operation] ?? 'UPDATE';
  const payload = (args as { data?: unknown; create?: unknown } | undefined) ?? {};
  const changed = redact(payload.data ?? payload.create ?? {});

  try {
    const client = await auditClient();
    await client.systemAuditLog.create({
      data: {
        userId: context.userId,
        // Was the literal 'unknown' on every structural row. The context
        // carries the name now, resolved from the same user lookup the tenant
        // middleware already performs.
        userName: context.userName,
        role: context.role,
        action,
        // These entries cannot name a functional module: the extension sees a
        // Prisma model, not the business operation that reached it. A handler
        // with something more specific to say uses mutate().
        module: 'data',
        resource: `${model}:${affectedId(result, args)}`,
        details: `${action} ${model} via ${operation} — ${JSON.stringify(changed).slice(0, 2000)}`,
        ipAddress: '0.0.0.0',
        userAgent: null,
        severity: action === 'DELETE' ? 'warning' : 'info',
        timestamp: new Date()
        // No institutionId: SystemAuditLog has no tenant column. That is a real
        // gap — the log is global — but it predates this work and closing it is
        // a migration, not a line here.
      } as never
    });
  } catch (error) {
    logger.error('STRUCTURAL AUDIT WRITE FAILED — a write was not recorded', {
      module: 'audit',
      operation,
      resource: model,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
