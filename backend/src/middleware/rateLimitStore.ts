/**
 * Where rate-limit counters live.
 *
 * WHY THIS EXISTS
 *
 * The login throttle kept its counters in a `Map` inside the process. Two
 * consequences, both observed rather than theorised:
 *
 *   1. RESTARTING THE SERVER CLEARED A LIVE LOCKOUT. I hit the login limit
 *      during this project's own testing, restarted the backend, and was
 *      immediately able to try again. Anything that can crash or redeploy the
 *      process can reset the protection.
 *
 *   2. N INSTANCES MEANT N TIMES THE LIMIT. Each process counts only the
 *      attempts it happens to receive, so five attempts per window becomes
 *      five per window *per instance* behind a load balancer — the exact
 *      arithmetic an attacker benefits from.
 *
 * The development plan records this as F1 and names Redis. The requirement is
 * a store SHARED BY EVERY INSTANCE, and Redis is one way to get one; this
 * deployment already requires PostgreSQL, which is another. Postgres is used
 * here because it can be verified in this environment today, where Redis
 * cannot — an unexercised integration is not a fix. The interface below is the
 * seam: adding a Redis store later is a new implementation, not a rewrite.
 *
 * WHAT IS DELIBERATELY *NOT* SHARED
 *
 * Only the login throttle uses the shared store. The broad per-IP API limiter
 * stays in-process on purpose: it fires on every request, and a database round
 * trip per request to protect against flooding is a cost that scales with
 * exactly the traffic it exists to survive. Per-instance counting is an
 * acceptable approximation for flood control; it is not acceptable for
 * credential stuffing, where the whole point is a hard cap per account.
 */

import { basePrisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export interface WindowState {
  /** Attempts recorded in the current window, including this one. */
  count: number;
  /** Epoch milliseconds at which the window expires. */
  resetAt: number;
}

export interface RateLimitStore {
  /** Record one hit against `key` and return the resulting window. */
  hit(key: string, windowMs: number): Promise<WindowState>;
  /** Human-readable name, used when reporting which store is active. */
  readonly name: string;
}

/**
 * Per-process counters. Correct for a single instance, and the fallback when
 * the shared store is unreachable.
 */
export class InProcessRateLimitStore implements RateLimitStore {
  readonly name = 'in-process';
  private readonly buckets = new Map<string, WindowState>();

  constructor(sweepEveryMs = 60_000) {
    // Bound memory. `unref` so the timer never holds the process open.
    const timer = setInterval(() => this.sweep(), sweepEveryMs);
    timer.unref?.();
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, state] of this.buckets) {
      if (state.resetAt <= now) this.buckets.delete(key);
    }
  }

  async hit(key: string, windowMs: number): Promise<WindowState> {
    const now = Date.now();
    let state = this.buckets.get(key);
    if (!state || state.resetAt <= now) {
      state = { count: 0, resetAt: now + windowMs };
      this.buckets.set(key, state);
    }
    state.count += 1;
    return { count: state.count, resetAt: state.resetAt };
  }
}

/**
 * Counters in PostgreSQL, shared by every instance.
 *
 * One statement per hit: insert the window, or increment it if this key's
 * window is still open. `resetAt` is chosen by whichever instance opens the
 * window and is then read back, so all instances agree on when it ends rather
 * than each extending it.
 *
 * The expired-window case is handled inside the same statement — an expired
 * row is overwritten with a fresh window rather than incremented — so two
 * instances racing at a window boundary cannot produce two different windows.
 */
export class PostgresRateLimitStore implements RateLimitStore {
  readonly name = 'postgres';

  async hit(key: string, windowMs: number): Promise<WindowState> {
    const now = new Date();
    const resetAt = new Date(now.getTime() + windowMs);

    const rows = await basePrisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
      INSERT INTO "RateLimitWindow" ("key", "count", "resetAt")
      VALUES (${key}, 1, ${resetAt})
      ON CONFLICT ("key") DO UPDATE
        SET "count"   = CASE
                          WHEN "RateLimitWindow"."resetAt" <= ${now} THEN 1
                          ELSE "RateLimitWindow"."count" + 1
                        END,
            "resetAt" = CASE
                          WHEN "RateLimitWindow"."resetAt" <= ${now} THEN ${resetAt}
                          ELSE "RateLimitWindow"."resetAt"
                        END
      RETURNING "count", "resetAt"
    `;

    const row = rows[0];
    if (!row) {
      // RETURNING always yields a row for an upsert; this is defensive only.
      throw new Error('RateLimitWindow upsert returned no row');
    }
    return { count: Number(row.count), resetAt: new Date(row.resetAt).getTime() };
  }

  /** Delete expired windows. Called opportunistically, not on the hot path. */
  static async prune(): Promise<number> {
    const result = await basePrisma.$executeRaw`
      DELETE FROM "RateLimitWindow" WHERE "resetAt" <= NOW()
    `;
    return Number(result);
  }
}

/**
 * A store that uses PostgreSQL but degrades to per-process counting if the
 * database is unreachable.
 *
 * Failing OPEN is deliberate. If the database is down the application cannot
 * serve logins anyway, and the alternative — refusing every request because
 * the limiter cannot record it — converts a database blip into a total
 * outage. The degradation is logged at `error` so it is never silent.
 */
export class ResilientRateLimitStore implements RateLimitStore {
  readonly name = 'postgres (falls back to in-process)';
  private readonly shared = new PostgresRateLimitStore();
  private readonly fallback = new InProcessRateLimitStore();
  private degraded = false;

  async hit(key: string, windowMs: number): Promise<WindowState> {
    try {
      const state = await this.shared.hit(key, windowMs);
      if (this.degraded) {
        this.degraded = false;
        logger.info('Rate limit store recovered — counters are shared again', {
          module: 'rateLimit'
        });
      }
      return state;
    } catch (error) {
      if (!this.degraded) {
        this.degraded = true;
        logger.error(
          'Rate limit store unreachable — falling back to per-process counters. ' +
            'Limits are now per-instance until the database recovers.',
          { module: 'rateLimit', error: (error as Error).message }
        );
      }
      return this.fallback.hit(key, windowMs);
    }
  }
}
