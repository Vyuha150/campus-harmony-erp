/**
 * Rate limiting.
 *
 * The login endpoint previously had no throttling of any kind: no rate limit,
 * no account lockout, no failed-attempt logging. Combined with seeded accounts
 * sharing a known default password, unlimited credential stuffing was possible
 * and completely invisible.
 *
 * Implemented with an in-process fixed-window counter — no new dependency, and
 * adequate for a single-instance deployment. NOTE: this state is per-process,
 * so a multi-instance deployment must move it to a shared store (Redis). That
 * is recorded as a follow-up in the development plan rather than pre-built,
 * since the current deployment topology is single-instance.
 */

import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';
import { logger } from '../lib/logger.js';

interface WindowState {
  count: number;
  resetAt: number;
}

function createLimiter(options: {
  windowMs: number;
  max: number;
  name: string;
  keyOf?: (req: Request) => string;
}) {
  const buckets = new Map<string, WindowState>();

  // Bound memory: drop expired buckets periodically. `unref` so this timer
  // never keeps the process alive during shutdown.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, state] of buckets) {
      if (state.resetAt <= now) buckets.delete(key);
    }
  }, options.windowMs).unref?.();
  void sweep;

  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const key = options.keyOf ? options.keyOf(req) : req.ip ?? 'unknown';
    const now = Date.now();

    let state = buckets.get(key);
    if (!state || state.resetAt <= now) {
      state = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, state);
    }

    state.count += 1;

    const remaining = Math.max(0, options.max - state.count);
    res.setHeader('RateLimit-Limit', String(options.max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil((state.resetAt - now) / 1000)));

    if (state.count > options.max) {
      const retryAfterSeconds = Math.ceil((state.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSeconds));

      logger.warn('Rate limit exceeded', {
        limiter: options.name,
        key,
        count: state.count,
        max: options.max,
        path: req.path
      });

      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests. Please try again in ${retryAfterSeconds} seconds.`
        }
      });
      return;
    }

    next();
  };
}

/**
 * Login throttle. Keyed on IP **and** submitted email so that one attacker
 * cannot lock out a legitimate user by exhausting that user's quota from a
 * different address, while still capping per-account guessing.
 */
export const loginRateLimiter = createLimiter({
  name: 'login',
  windowMs: config.rateLimit.loginWindowMs,
  max: config.rateLimit.loginMaxAttempts,
  keyOf: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : 'unknown';
    return `${req.ip ?? 'unknown'}:${email}`;
  }
});

/** Broad API throttle applied to all routes. */
export const apiRateLimiter = createLimiter({
  name: 'api',
  windowMs: config.rateLimit.apiWindowMs,
  max: config.rateLimit.apiMaxRequests
});
