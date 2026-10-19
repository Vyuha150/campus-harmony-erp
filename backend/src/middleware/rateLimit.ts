/**
 * Rate limiting.
 *
 * The login endpoint previously had no throttling of any kind: no rate limit,
 * no account lockout, no failed-attempt logging. Combined with seeded accounts
 * sharing a known default password, unlimited credential stuffing was possible
 * and completely invisible.
 *
 * WHERE THE COUNTERS LIVE, AND WHY IT MATTERS
 *
 * They used to live in a `Map` in this module. That made the login throttle
 * per-process, with two failures observed rather than theorised: restarting
 * the backend cleared a live lockout (seen during this project's own testing),
 * and N instances behind a load balancer would each allow the full quota,
 * multiplying the limit by N.
 *
 * The login limiter now counts in a store shared by every instance
 * (`rateLimitStore.ts`). The broad per-IP API limiter deliberately stays
 * in-process: it fires on every request, and a database round trip per request
 * to protect against flooding costs most exactly when the traffic it exists to
 * survive arrives. Per-instance counting is a fair approximation for flood
 * control; it is not one for credential stuffing, where the cap per account is
 * the entire point.
 */

import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';
import { logger } from '../lib/logger.js';
import {
  InProcessRateLimitStore,
  ResilientRateLimitStore,
  type RateLimitStore
} from './rateLimitStore.js';

export function createLimiter(options: {
  windowMs: number;
  max: number;
  name: string;
  store: RateLimitStore;
  keyOf?: (req: Request) => string;
  /** Clear the count when the request succeeds, so only failures are limited. */
  skipSuccessful?: boolean;
}) {
  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const key = `${options.name}:${options.keyOf ? options.keyOf(req) : req.ip ?? 'unknown'}`;
    if (options.skipSuccessful && options.store.reset) {
      res.on('finish', () => {
        if (res.statusCode < 400) void options.store.reset!(key).catch(() => undefined);
      });
    }

    void options.store
      .hit(key, options.windowMs)
      .then((state) => {
        const now = Date.now();
        const retryAfterSeconds = Math.max(0, Math.ceil((state.resetAt - now) / 1000));

        res.setHeader('RateLimit-Limit', String(options.max));
        res.setHeader('RateLimit-Remaining', String(Math.max(0, options.max - state.count)));
        res.setHeader('RateLimit-Reset', String(retryAfterSeconds));

        if (state.count > options.max) {
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
      })
      .catch((error: unknown) => {
        // The store already degrades to in-process counting on failure, so
        // reaching here means something unexpected. Fail OPEN: refusing every
        // request because the limiter is broken turns a limiter fault into a
        // total outage, and the event is logged loudly either way.
        logger.error('Rate limiter failed — allowing the request', {
          limiter: options.name,
          error: (error as Error).message
        });
        next();
      });
  };
}

/**
 * Login throttle. Keyed on IP **and** submitted email so that one attacker
 * cannot lock out a legitimate user by exhausting that user's quota from a
 * different address, while still capping per-account guessing.
 *
 * Uses the SHARED store: this is the limiter whose whole value depends on the
 * count being global rather than per-process.
 */
export const loginRateLimiter = createLimiter({
  name: 'login',
  windowMs: config.rateLimit.loginWindowMs,
  max: config.rateLimit.loginMaxAttempts,
  store: new ResilientRateLimitStore(),
  // Only FAILED attempts count. Successful sign-ins counted too, so someone
  // switching between demo accounts, or simply signing in six times in a
  // quarter-hour, was locked out with the right password.
  skipSuccessful: true,
  keyOf: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : 'unknown';
    return `${req.ip ?? 'unknown'}:${email}`;
  }
});

/**
 * Forgot-password throttle. Same shared store and per-account reasoning as
 * `loginRateLimiter`, but its OWN bucket namespace (`password-reset:...`) —
 * sharing login's bucket would let an attacker who spams forgot-password for
 * a victim's email also exhaust that victim's login attempts, turning a
 * self-service recovery feature into a denial-of-service lever against the
 * account it is meant to help.
 */
export const passwordResetRateLimiter = createLimiter({
  name: 'password-reset',
  windowMs: config.rateLimit.loginWindowMs,
  max: config.rateLimit.loginMaxAttempts,
  store: new ResilientRateLimitStore(),
  keyOf: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : 'unknown';
    return `${req.ip ?? 'unknown'}:${email}`;
  }
});

/**
 * Broad API throttle applied to all routes. In-process on purpose — see the
 * file header.
 */
export const apiRateLimiter = createLimiter({
  name: 'api',
  windowMs: config.rateLimit.apiWindowMs,
  max: config.rateLimit.apiMaxRequests,
  store: new InProcessRateLimitStore()
});
