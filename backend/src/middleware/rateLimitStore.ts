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
 * deployment already requires MongoDB, which is another. MongoDB is used
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
  /** Forget a key's count (used to stop counting successful sign-ins). */
  reset?(key: string): Promise<void>;
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

  async reset(key: string): Promise<void> {
    this.buckets.delete(key);
  }
}

/**
 * Counters in MongoDB, shared by every instance.
 *
 * One atomic command per hit: `findAndModify` with an update PIPELINE, so the
 * decision "is this window still open?" is made by the server against the
 * stored document, not by this process against a value it read earlier.
 * `resetAt` is chosen by whichever instance opens the window and is then read
 * back, so all instances agree on when it ends rather than each extending it.
 *
 * The expired-window case is handled inside the same command — an expired
 * document is overwritten with a fresh window rather than incremented — so two
 * instances racing at a window boundary cannot produce two different windows.
 */
export class MongoRateLimitStore implements RateLimitStore {
  readonly name = 'mongodb';

  async hit(key: string, windowMs: number): Promise<WindowState> {
    const now = { $date: new Date().toISOString() };
    const resetAt = { $date: new Date(Date.now() + windowMs).toISOString() };

    // A missing document has no `resetAt`; `$ifNull` makes it count as expired.
    const expired = { $lte: [{ $ifNull: ['$resetAt', now] }, now] };

    const run = () =>
      basePrisma.$runCommandRaw({
        findAndModify: 'RateLimitWindow',
        query: { _id: key },
        update: [
          {
            $set: {
              count: { $cond: [expired, 1, { $add: ['$count', 1] }] },
              resetAt: { $cond: [expired, resetAt, '$resetAt'] }
            }
          }
        ],
        upsert: true,
        new: true
      }) as Promise<{ value?: { count?: number; resetAt?: { $date: string } } | null }>;

    let result;
    try {
      result = await run();
    } catch (error) {
      // Two instances upserting the same brand-new key: one inserts, the other
      // gets a duplicate-key error. The document now exists, so retry once.
      if (!/E11000|duplicate key/i.test((error as Error).message)) throw error;
      result = await run();
    }

    const doc = result.value;
    if (!doc || typeof doc.count !== 'number' || !doc.resetAt) {
      // `new: true` with `upsert: true` always yields a document; defensive only.
      throw new Error('RateLimitWindow upsert returned no document');
    }
    return { count: doc.count, resetAt: new Date(doc.resetAt.$date).getTime() };
  }

  /** Delete expired windows. Called opportunistically, not on the hot path. */
  async reset(key: string): Promise<void> {
    await basePrisma.rateLimitWindow.deleteMany({ where: { key } });
  }

  static async prune(): Promise<number> {
    const result = await basePrisma.rateLimitWindow.deleteMany({
      where: { resetAt: { lte: new Date() } }
    });
    return result.count;
  }
}

/**
 * A store that uses MongoDB but degrades to per-process counting if the
 * database is unreachable.
 *
 * Failing OPEN is deliberate. If the database is down the application cannot
 * serve logins anyway, and the alternative — refusing every request because
 * the limiter cannot record it — converts a database blip into a total
 * outage. The degradation is logged at `error` so it is never silent.
 */
export class ResilientRateLimitStore implements RateLimitStore {
  readonly name = 'mongodb (falls back to in-process)';
  private readonly shared = new MongoRateLimitStore();
  private readonly fallback = new InProcessRateLimitStore();
  private degraded = false;

  async reset(key: string): Promise<void> {
    await this.fallback.reset(key);
    await this.shared.reset(key).catch(() => undefined);
  }

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
