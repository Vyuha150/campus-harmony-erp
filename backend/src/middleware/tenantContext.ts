/**
 * Tenant context resolution middleware (ADR-0001).
 *
 * Runs after `authenticate` and loads the caller's institution and campus from
 * the DATABASE, keyed on the authenticated user id.
 *
 * WHY THE DATABASE AND NOT THE JWT:
 *
 * Putting institutionId in the token would be faster, but a token is issued for
 * up to 24 hours. If a user is moved between campuses, suspended, or has their
 * institution changed, a stale token would keep granting the old scope until it
 * expires. For a hard security boundary that is not an acceptable trade — so
 * scope is resolved per request from the authoritative record.
 *
 * The cost is one indexed primary-key lookup per request. If profiling later
 * shows it matters, cache it with an explicit invalidation on user update —
 * do not solve it by trusting the token.
 */

import type { Request, Response, NextFunction } from 'express';
import { basePrisma } from '../lib/prisma.js';
import { AuthenticationError, AuthorizationError } from '../lib/errors.js';
import { scopeLevelForRole, type TenantContext } from '../lib/tenant.js';
import { runWithTenant } from '../lib/tenantStore.js';
import { logger } from '../lib/logger.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

export async function resolveTenantContext(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = (req as Request & { user?: { id: string; role: string } }).user;

    if (!user) {
      throw new AuthenticationError('Authentication required.');
    }

    // Uses the UNSCOPED client deliberately: this lookup is what establishes
    // which tenant the caller belongs to, so it cannot itself be tenant-scoped
    // (that would be circular). It is safe because it selects exactly one row
    // by primary key from the authenticated token.
    const record = await basePrisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, name: true, role: true, institutionId: true, campusId: true }
    });

    if (!record) {
      // Token is validly signed but the account no longer exists — e.g. deleted
      // while the token was still live.
      throw new AuthenticationError('Your account is no longer active.');
    }

    if (!record.institutionId) {
      // Every account must belong to an institution. Migration 0002 backfills
      // existing rows, so this indicates a provisioning fault, not normal state.
      logger.error('User has no institution assignment', {
        userId: record.id,
        role: record.role
      });
      throw new AuthorizationError(
        'Your account is not assigned to an institution. Contact your administrator.'
      );
    }

    // Role is taken from the DATABASE, not the token, for the same staleness
    // reason: a demoted user must lose access immediately, not in 24 hours.
    const role = record.role;
    // `authorizeRoles` (mounted after this in server.ts) reads req.user.role —
    // the TOKEN's copy. Overwrite it so a replaced HOD or any demoted user loses
    // the old role's routes on their next request, not when the token expires.
    user.role = role;

    const context: TenantContext = {
      institutionId: record.institutionId,
      campusId: record.campusId,
      scopeLevel: scopeLevelForRole(role),
      userId: record.id,
      userName: record.name,
      role
    };

    req.tenant = context;

    // Bind the context to this request's async execution so the Prisma
    // extension can scope EVERY query automatically, including in handlers that
    // never reference the tenant explicitly. `next()` must be called INSIDE
    // `runWithTenant` so the whole downstream chain inherits the context.
    runWithTenant(context, () => {
      next();
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Reject any attempt to specify a tenant from the client side.
 *
 * Nothing in the application reads these fields — scope always comes from the
 * authenticated principal. But a request carrying them signals either a
 * misunderstanding by an integrator or a probe for a tenant-confusion bug, and
 * in both cases the right response is a loud rejection plus a log line rather
 * than silently ignoring it.
 */
export function rejectClientTenantOverride(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const suspectKeys = ['institutionId', 'institution_id', 'tenantId', 'tenant_id'];

  const inQuery = suspectKeys.filter((key) => req.query?.[key] !== undefined);
  const inHeaders = ['x-institution-id', 'x-tenant-id'].filter(
    (key) => req.headers[key] !== undefined
  );

  if (inQuery.length > 0 || inHeaders.length > 0) {
    logger.warn('Client attempted to supply tenant context', {
      requestId: req.requestId,
      userId: (req as Request & { user?: { id: string } }).user?.id,
      path: req.path,
      queryKeys: inQuery,
      headerKeys: inHeaders
    });

    next(
      new AuthorizationError(
        'Tenant context cannot be supplied by the client; it is derived from your account.'
      )
    );
    return;
  }

  next();
}
