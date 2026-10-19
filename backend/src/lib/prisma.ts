/**
 * Prisma client for MongoDB (Atlas).
 *
 * The connection string comes from validated config rather than being read
 * ad-hoc from `process.env`. Pool sizing and timeouts are applied as MongoDB
 * connection-string options so they stay tunable from the environment without
 * each deployment hand-editing the URI.
 *
 * TLS: `mongodb+srv://` connections are always encrypted and verified by the
 * driver, so there is no certificate-verification switch to get wrong here.
 *
 * Time zones: MongoDB stores every `Date` as a UTC instant, so no session
 * pinning is needed.
 */

import { PrismaClient } from '@prisma/client';
import { config } from '../config/env.js';
import { tenantExtension } from './tenantExtension.js';
import { explicitNullExtension } from './explicitNulls.js';

/** Apply pool settings without overriding anything set explicitly in the URI. */
function withPoolOptions(uri: string): string {
  const url = new URL(uri);
  const defaults: Record<string, string> = {
    maxPoolSize: String(config.database.poolMax),
    maxIdleTimeMS: String(config.database.poolIdleTimeoutMs),
    connectTimeoutMS: String(config.database.connectionTimeoutMs),
    serverSelectionTimeoutMS: String(config.database.connectionTimeoutMs)
  };
  for (const [key, value] of Object.entries(defaults)) {
    if (!url.searchParams.has(key)) url.searchParams.set(key, value);
  }
  return url.toString();
}

/**
 * Base client — NOT tenant-scoped.
 *
 * Exported only for authentication (finding a user by globally-unique email
 * before their tenant is known), seeding and maintenance scripts. Route
 * handlers must use `prisma` below.
 *
 * It still carries `explicitNullExtension`: that is a storage-format guarantee
 * (see lib/explicitNulls.ts), not a scoping rule, so nothing may bypass it.
 */
export const basePrisma = new PrismaClient({
  datasourceUrl: withPoolOptions(config.database.url)
}).$extends(explicitNullExtension) as unknown as PrismaClient;

/**
 * Application client — TENANT-SCOPED BY DEFAULT (ADR-0001).
 *
 * Every query against a tenant-owned model is automatically constrained to the
 * institution in the current request's async context. Scoping is the default,
 * not something each of the 478 handlers must remember; bypassing it requires
 * an explicit, greppable `runUnscoped()`.
 */
export const prisma = basePrisma.$extends(tenantExtension) as unknown as typeof basePrisma;

/**
 * Liveness probe for the database. MongoDB has no `SELECT 1`; `ping` is the
 * equivalent round trip.
 */
export async function pingDatabase(): Promise<void> {
  await basePrisma.$runCommandRaw({ ping: 1 });
}

/**
 * Take a write lock on documents inside a transaction — the MongoDB
 * counterpart of `SELECT … FOR UPDATE`.
 *
 * MongoDB has no read locks. Instead, the first transaction to WRITE a
 * document owns it until commit; a second transaction writing the same
 * document fails immediately with a write conflict (Prisma `P2034`, surfaced
 * as a retryable conflict by lib/errors.ts) rather than queueing. Bumping
 * `lockVersion` before reading is what guarantees the balances or seat counts
 * read afterwards cannot change under this transaction.
 *
 * Call it BEFORE the read it protects, with the same `where`.
 */
export async function lockForUpdate(
  delegate: { updateMany: (args: never) => Promise<{ count: number }> },
  where: Record<string, unknown>
): Promise<number> {
  const result = await delegate.updateMany({
    where,
    data: { lockVersion: { increment: 1 } }
  } as never);
  return result.count;
}
