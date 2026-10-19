/**
 * Idempotency for operations that must not run twice.
 *
 * WHY THIS EXISTS
 *
 * There was no idempotency anywhere in the codebase. For most endpoints that is
 * merely untidy; for money it is a defect with a direct financial consequence:
 *
 *   - a cashier double-clicks Submit          → student charged twice
 *   - a browser retries on a flaky connection → duplicate receipt numbers
 *   - a payment gateway redelivers a webhook  → the same UPI transaction
 *                                               recorded as two payments
 *
 * Gateways redeliver webhooks BY DESIGN — at-least-once delivery is the norm,
 * and a receiver that cannot tolerate it is broken, not unlucky.
 *
 * HOW IT WORKS
 *
 * The unique index on (institutionId, key) IS the concurrency control. Two
 * simultaneous requests race to INSERT; exactly one wins. The loser reads the
 * winner's record and replays its response rather than performing the operation
 * again.
 *
 * WHAT IT DELIBERATELY REFUSES
 *
 * Reusing a key with a DIFFERENT request body is rejected, not replayed. That
 * combination means the client has a bug — likely a key generated per-session
 * instead of per-request — and silently returning an unrelated earlier response
 * would hide it. Stripe's API behaves the same way, for the same reason.
 */

import { createHash } from 'node:crypto';
import { basePrisma } from './prisma.js';
import { ConflictError, ValidationError } from './errors.js';
import { logger } from './logger.js';
import type { TransactionClient } from './service.js';

/** How long a key is honoured. Long enough for any sane retry, short enough
 *  that the table does not grow without bound. Stripe uses 24h. */
export const IDEMPOTENCY_TTL_HOURS = 24;

export interface IdempotencyOutcome<T> {
  result: T;
  /** True when this is a replay rather than a fresh execution. */
  replayed: boolean;
}

/** Stable hash of the request payload, so key reuse with different data is caught. */
export function hashRequest(payload: unknown): string {
  // Keys are sorted so that `{a:1,b:2}` and `{b:2,a:1}` hash identically — the
  // same request serialised differently is still the same request.
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

/** Unique-index violation, surfaced through Prisma. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/**
 * Execute `operation` at most once for a given key.
 *
 * The key record and the operation share ONE transaction, so a crash mid-flight
 * rolls back both. There is no window in which the key says "done" but the
 * payment does not exist, nor the reverse.
 */
export async function withIdempotency<T>(
  params: {
    institutionId: string;
    key: string | undefined;
    operation: string;
    payload: unknown;
  },
  operation: (tx: TransactionClient) => Promise<T>
): Promise<IdempotencyOutcome<T>> {
  const { institutionId, key, operation: operationName, payload } = params;

  // No key supplied: run normally. Requiring a key would break every existing
  // caller, so callers that need the guarantee opt in by sending one. Routes
  // handling money REQUIRE it at the schema level instead.
  if (!key) {
    const result = await basePrisma.$transaction((tx) => operation(tx));
    return { result, replayed: false };
  }

  const requestHash = hashRequest(payload);

  const existing = await basePrisma.idempotencyKey.findFirst({
    where: { institutionId, key }
  });

  if (existing) {
    return { result: replay<T>(existing, requestHash, operationName), replayed: true };
  }

  const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000);

  try {
    // Key insert and operation in ONE transaction — see the note above.
    const result = await basePrisma.$transaction(async (tx) => {
      await (tx as never as typeof basePrisma).idempotencyKey.create({
        data: {
          institutionId,
          key,
          operation: operationName,
          requestHash,
          status: 'completed',
          expiresAt
        }
      });

      const value = await operation(tx);

      await (tx as never as typeof basePrisma).idempotencyKey.updateMany({
        where: { institutionId, key },
        data: {
          // Round-tripped through JSON so what is stored is exactly what a
          // replay will return — Dates become ISO strings either way, and a
          // replay that differed from the original response would defeat the
          // purpose.
          responseBody: (value === undefined
            ? null
            : JSON.parse(JSON.stringify(value))) as never,
          responseStatus: 200,
          completedAt: new Date()
        }
      });

      return value;
    });

    return { result, replayed: false };
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Lost the race. The winner's transaction has committed by definition of
      // the unique violation, so its record is readable and authoritative.
      const winner = await basePrisma.idempotencyKey.findFirst({
        where: { institutionId, key }
      });

      if (winner) {
        logger.info('Idempotent replay after concurrent request', {
          operation: operationName
        });
        return { result: replay<T>(winner, requestHash, operationName), replayed: true };
      }
    }
    throw error;
  }
}

/** Validate a stored key record and return its response. */
function replay<T>(
  record: {
    requestHash: string;
    operation: string;
    status: string;
    responseBody: unknown;
    expiresAt: Date;
  },
  requestHash: string,
  operationName: string
): T {
  if (record.expiresAt.getTime() < Date.now()) {
    // Expired keys are not silently reused: the caller should mint a fresh one.
    throw new ConflictError(
      'This idempotency key has expired. Retry with a new key.',
      { expiredAt: record.expiresAt.toISOString() }
    );
  }

  if (record.requestHash !== requestHash) {
    // The dangerous case. Same key, different body — replaying would return a
    // response describing an operation the caller did not request.
    throw new ValidationError(
      'This idempotency key was already used with a different request body. ' +
        'Idempotency keys must be unique per distinct request — generate a new key ' +
        'for each operation rather than reusing one per session.',
      { field: 'Idempotency-Key' }
    );
  }

  if (record.operation !== operationName) {
    throw new ValidationError(
      `This idempotency key was already used for a different operation ("${record.operation}").`,
      { field: 'Idempotency-Key' }
    );
  }

  if (record.status !== 'completed' || record.responseBody === null) {
    // An in-progress record means a concurrent request is still running. The
    // caller must retry rather than receive a half-formed answer.
    throw new ConflictError(
      'A request with this idempotency key is currently in progress. Retry shortly.',
      { retryable: true }
    );
  }

  return record.responseBody as T;
}

/**
 * Delete expired keys.
 *
 * Not wired to a scheduler — this repository has no job runner yet, and
 * pretending otherwise would be exactly the kind of mock completion the plan
 * forbids. Call it from a cron or an admin endpoint.
 */
export async function purgeExpiredKeys(): Promise<number> {
  const { count } = await basePrisma.idempotencyKey.deleteMany({
    where: { expiresAt: { lt: new Date() } }
  });
  if (count > 0) {
    logger.info('Purged expired idempotency keys', { count });
  }
  return count;
}
