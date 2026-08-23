/**
 * Prisma client with an explicitly configured PostgreSQL pool.
 *
 * Changes from the previous implementation:
 *
 *  - Connection settings come from validated config rather than being parsed
 *    ad-hoc from the URL with no bounds.
 *  - The pool is now SIZED. Previously no `max`, `idleTimeoutMillis` or
 *    `connectionTimeoutMillis` was set, so `pg` defaults applied (max 10) with
 *    no way to tune them — and long synchronous report queries holding
 *    connections made pool exhaustion likely.
 *  - `ssl.rejectUnauthorized` defaulted to `false`, silently disabling
 *    certificate verification and permitting a man-in-the-middle on the
 *    database connection. It now defaults to ON and cannot be disabled in
 *    production.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from '../config/env.js';
import { logger } from './logger.js';
import { tenantExtension } from './tenantExtension.js';

const parsedDatabaseUrl = new URL(config.database.url);

const isLocalConnection = ['localhost', '127.0.0.1', '::1'].includes(
  parsedDatabaseUrl.hostname
);

/**
 * TLS is skipped for local connections (a local socket has no meaningful MITM
 * exposure and local Postgres installs typically have no certificate), and
 * required everywhere else.
 */
const ssl = isLocalConnection
  ? false
  : { rejectUnauthorized: config.database.rejectUnauthorized };

if (!isLocalConnection && !config.database.rejectUnauthorized) {
  logger.warn(
    'Database TLS certificate verification is DISABLED — the connection is vulnerable ' +
      'to interception. Set DATABASE_SSL_REJECT_UNAUTHORIZED=true.'
  );
}

const pool = new Pool({
  host: parsedDatabaseUrl.hostname,
  port: Number(parsedDatabaseUrl.port || 5432),
  user: decodeURIComponent(parsedDatabaseUrl.username),
  password: String(decodeURIComponent(parsedDatabaseUrl.password || '')),
  database: decodeURIComponent(parsedDatabaseUrl.pathname.replace(/^\//, '')),
  ssl,
  max: config.database.poolMax,
  idleTimeoutMillis: config.database.poolIdleTimeoutMs,
  connectionTimeoutMillis: config.database.connectionTimeoutMs,
  // ── Pin the session to UTC ────────────────────────────────────────────────
  //
  // Without this the session inherits the server's zone, and the driver's
  // date handling then applies that offset on write and unwinds it on read.
  // The application never notices — the round trip is self-consistent — but
  // every value in the database sits one local offset away from the instant
  // the application meant, so psql, BI tools, dumps and hand-written fixes all
  // read the wrong time. It also means identical code stores different values
  // depending on the server's zone.
  //
  // Measured before this line existed: Prisma wrote 10:00Z, the row held
  // 04:30Z, and Prisma read back 10:00Z.
  //
  // Migration 0017 shifts the rows written under the old behaviour so their
  // instants match what the application always reported. The two changes
  // belong together — applying either alone moves every historical timestamp.
  options: '-c timezone=UTC'
});

pool.on('error', (error) => {
  // Emitted for idle clients; without a handler this would crash the process.
  logger.error('Unexpected PostgreSQL pool error', { error: error.message });
});

/**
 * Base client — NOT tenant-scoped.
 *
 * Exported only for authentication (finding a user by globally-unique email
 * before their tenant is known), migrations and maintenance scripts. Route
 * handlers must use `prisma` below.
 */
export const basePrisma = new PrismaClient({
  adapter: new PrismaPg(pool)
});

/**
 * Application client — TENANT-SCOPED BY DEFAULT (ADR-0001).
 *
 * Every query against a tenant-owned model is automatically constrained to the
 * institution in the current request's async context. Scoping is the default,
 * not something each of the 478 handlers must remember; bypassing it requires
 * an explicit, greppable `runUnscoped()`.
 */
export const prisma = basePrisma.$extends(tenantExtension) as unknown as typeof basePrisma;

export { pool };
