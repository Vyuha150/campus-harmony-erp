/**
 * Rate-limit store behaviour.
 *
 * The property that matters is that the login throttle's counters SURVIVE the
 * process. That was verified end to end against a live server — five bad
 * logins, a full backend restart, and the sixth attempt still refused with
 * ~14 minutes left on the window — but a live restart is not something a test
 * suite can reproduce, so what is asserted here is the logic that makes it
 * true: window arithmetic, expiry, key isolation, and the failure path.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  InProcessRateLimitStore,
  ResilientRateLimitStore,
  type RateLimitStore
} from '../middleware/rateLimitStore.js';

describe('InProcessRateLimitStore', () => {
  it('counts hits within a window and reports a stable reset time', async () => {
    const store = new InProcessRateLimitStore();
    const first = await store.hit('k', 60_000);
    const second = await store.hit('k', 60_000);

    expect(first.count).toBe(1);
    expect(second.count).toBe(2);
    // The window must not slide: a caller that keeps knocking cannot push its
    // own reset further away.
    expect(second.resetAt).toBe(first.resetAt);
  });

  it('keeps separate keys independent', async () => {
    const store = new InProcessRateLimitStore();
    await store.hit('a', 60_000);
    await store.hit('a', 60_000);
    const b = await store.hit('b', 60_000);

    // The login limiter keys on ip:email precisely so one account's lockout
    // cannot spill onto another's.
    expect(b.count).toBe(1);
  });

  it('starts a fresh window once the old one expires', async () => {
    const store = new InProcessRateLimitStore();
    const first = await store.hit('k', 1);
    await new Promise((r) => setTimeout(r, 5));
    const afterExpiry = await store.hit('k', 60_000);

    expect(first.count).toBe(1);
    expect(afterExpiry.count).toBe(1);
    expect(afterExpiry.resetAt).toBeGreaterThan(first.resetAt);
  });
});

describe('ResilientRateLimitStore', () => {
  /** Stand-in for the shared store, so the failure path needs no database. */
  function failingShared(): RateLimitStore {
    return {
      name: 'always-fails',
      hit: () => Promise.reject(new Error('connection refused'))
    };
  }

  it('falls back to per-process counting when the shared store is unreachable', async () => {
    const store = new ResilientRateLimitStore();
    // Replace the private shared store with one that always fails.
    (store as unknown as { shared: RateLimitStore }).shared = failingShared();

    const first = await store.hit('k', 60_000);
    const second = await store.hit('k', 60_000);

    // Degraded, but still limiting. Failing OPEN on the limiter would mean a
    // database blip removes login throttling entirely; failing CLOSED would
    // mean it takes the whole site down. Counting locally does neither.
    expect(first.count).toBe(1);
    expect(second.count).toBe(2);
  });

  it('reports the degradation rather than hiding it', async () => {
    const store = new ResilientRateLimitStore();
    (store as unknown as { shared: RateLimitStore }).shared = failingShared();

    const { logger } = await import('../lib/logger.js');
    const spy = vi.spyOn(logger, 'error').mockImplementation(() => undefined as never);

    await store.hit('k', 60_000);
    await store.hit('k', 60_000);

    // Logged once on entering the degraded state, not once per request — an
    // outage must not also be a log flood.
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]?.[0])).toMatch(/per-process|unreachable/i);
    spy.mockRestore();
  });
});
