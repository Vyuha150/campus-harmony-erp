/**
 * Request-scoped tenant store (ADR-0001).
 *
 * Holds the current request's tenant context in `AsyncLocalStorage` so the
 * Prisma extension can inject `institutionId` into every query WITHOUT each of
 * the 478 route handlers having to remember to pass it.
 *
 * WHY THIS EXISTS
 *
 * The first pass at tenancy required every query to spread `campusScope(ctx)`
 * into its `where` clause. That works, but it is a convention — and a single
 * forgotten spread in any of 478 endpoints silently returns another
 * university's student records. Security properties that depend on 478 correct
 * decisions are not security properties; they are a probability distribution.
 *
 * With this store plus `tenantExtension`, scoping is the DEFAULT. A developer
 * has to actively opt out (via `runUnscoped`) rather than actively opt in, and
 * the opt-out is greppable in review.
 *
 * `AsyncLocalStorage` is the correct primitive: it survives `await` boundaries
 * and keeps concurrent requests isolated, unlike a module-level variable which
 * would leak one request's tenant into another under load.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { TenantContext } from './tenant.js';

interface TenantStoreValue {
  context: TenantContext;
  /**
   * When true, the Prisma extension does not inject a tenant filter.
   * Reserved for genuinely cross-tenant operations (login by email, platform
   * administration, migrations). Every use must be justified at the call site.
   */
  unscoped: boolean;
  /**
   * When true, the extension does not filter soft-deleted rows.
   *
   * Reserved for the few operations that legitimately need to see deleted
   * records: restoring one, an auditor's history view, a compliance export that
   * must account for removals. Every use is justified at the call site.
   */
  includeDeleted?: boolean;
}

const storage = new AsyncLocalStorage<TenantStoreValue>();

/** Run `fn` with the given tenant context active for all nested async work. */
export function runWithTenant<T>(context: TenantContext, fn: () => T): T {
  return storage.run({ context, unscoped: false }, fn);
}

/**
 * Run `fn` with tenant filtering DISABLED.
 *
 * Legitimate uses are narrow:
 *   - authentication (finding a user by globally-unique email before we know
 *     which tenant they belong to)
 *   - platform-level administration across institutions
 *   - migrations and maintenance scripts
 *
 * Anything else is almost certainly a bug. `reason` is required so the intent
 * is recorded at the call site and visible in code review.
 */
export async function runUnscoped<T>(reason: string, fn: () => T | Promise<T>): Promise<T> {
  const current = storage.getStore();
  void reason; // documented at the call site; retained for greppability

  // `fn` is AWAITED INSIDE the context, not merely called.
  //
  // Prisma queries are lazy: `prisma.x.findMany()` returns a PrismaPromise that
  // does not execute until it is awaited. Returning that promise from
  // `storage.run` means the query runs AFTER the context has exited, so the
  // extension sees no flag and applies the ordinary filters.
  //
  // Written as `() => fn()` this failed closed — the tenant check throws rather
  // than leaking — but it failed for a reason no call site could see. Awaiting
  // inside the context removes the trap.
  return storage.run(
    {
      context: current?.context ?? ({} as TenantContext),
      unscoped: true
    },
    async () => await fn()
  );
}

/** Current tenant context, or undefined outside a request (scripts, seeds). */
export function currentTenant(): TenantContext | undefined {
  const store = storage.getStore();
  if (!store || store.unscoped) return undefined;
  return store.context;
}

/**
 * Run `fn` with soft-deleted rows VISIBLE.
 *
 * The counterpart to `runUnscoped`. Deleted rows are hidden by default so a
 * forgotten filter cannot resurrect a removed student in a roll or an export;
 * this is the deliberate, greppable way to look at them.
 *
 * `reason` is required for the same purpose it serves on `runUnscoped` — it
 * forces the caller to state why, and shows up in review.
 */
export async function includeDeleted<T>(reason: string, fn: () => T | Promise<T>): Promise<T> {
  const current = storage.getStore();
  if (!reason || reason.trim().length < 10) {
    throw new Error('includeDeleted() requires a reason of at least 10 characters.');
  }

  // Awaited INSIDE the context — see the note on runUnscoped. A lazy Prisma
  // promise returned from `storage.run` executes after the context has exited,
  // which silently defeats the flag.
  if (!current) {
    // Outside a request (scripts, seeds) there is no tenant context to preserve,
    // but the flag still has to be set for the extension to see it.
    return storage.run(
      { context: {} as TenantContext, unscoped: true, includeDeleted: true },
      async () => await fn()
    );
  }

  return storage.run({ ...current, includeDeleted: true }, async () => await fn());
}

/** True when the current context has opted into seeing soft-deleted rows. */
export function isIncludingDeleted(): boolean {
  return storage.getStore()?.includeDeleted === true;
}

/** True when the current execution context has opted out of tenant filtering. */
export function isUnscoped(): boolean {
  return storage.getStore()?.unscoped ?? true; // outside a request → unscoped
}

/** True when a tenant context is active. */
export function hasTenantContext(): boolean {
  const store = storage.getStore();
  return Boolean(store && !store.unscoped && store.context?.institutionId);
}
