/**
 * Read-only role enforcement.
 *
 * Before this, every role with access to a module had FULL WRITE access to that
 * module — there was no way to grant inspection without granting mutation. That
 * made it impossible to give a NAAC peer team or an internal auditor safe
 * access during a review.
 *
 * This blocks all mutating HTTP verbs for read-only roles, regardless of which
 * module they reach. Enforced centrally rather than per-endpoint so it cannot
 * be forgotten on a new route.
 */

import type { Request, Response, NextFunction } from 'express';
import { isReadOnlyRole } from '../lib/tenant.js';
import { AuthorizationError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function enforceReadOnly(req: Request, _res: Response, next: NextFunction): void {
  const role = (req as Request & { user?: { role: string } }).user?.role;

  if (!role || !isReadOnlyRole(role)) {
    next();
    return;
  }

  if (MUTATING_METHODS.has(req.method)) {
    logger.warn('Read-only role attempted a mutation', {
      requestId: req.requestId,
      userId: (req as Request & { user?: { id: string } }).user?.id,
      role,
      method: req.method,
      path: req.path
    });

    next(
      new AuthorizationError(
        'Your account has read-only access and cannot modify data.'
      )
    );
    return;
  }

  next();
}
