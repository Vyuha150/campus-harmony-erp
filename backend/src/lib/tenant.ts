/**
 * Tenant context and scoping (ADR-0001).
 *
 * THE GOVERNING RULE:
 *
 *   Tenant context is DERIVED FROM THE AUTHENTICATED PRINCIPAL.
 *   It is NEVER read from a request parameter, header, query string or body.
 *
 * A client-supplied institution id is ignored entirely. If a caller could
 * influence which tenant they are treated as, the entire isolation boundary
 * would be decorative — and a cross-institution read of student records is a
 * P0 security incident, not a bug.
 *
 * Two levels of scope, per the blueprint:
 *
 *   Institution — HARD boundary. No code path returns another institution's
 *                 rows to any principal. Not "restricted": impossible.
 *
 *   Campus      — SOFT boundary within an institution. Roles with INSTITUTION
 *                 scope (VC, Pro-VC, Registrar, CoE, super_admin) see every
 *                 campus; roles with CAMPUS scope (Principal, campus admin,
 *                 campus finance officer, faculty, students) see only theirs.
 *
 * Blueprint: "Roles like VC, Registrar, or Group Finance Officer have access to
 * all campuses' information. Roles like Principal, campus admin, or campus
 * finance officer are limited to their campus."
 */

import type { Request } from 'express';
import { AuthorizationError, AuthenticationError } from './errors.js';

/** How far a role can see within its institution. */
export type ScopeLevel = 'INSTITUTION' | 'CAMPUS';

/**
 * Roles that see every campus in their institution.
 *
 * Deliberately a small, explicit list — anything not named here is campus-scoped
 * by default, so a new role added later fails closed rather than open.
 *
 * Blueprint: "Roles like VC, Registrar, or Group Finance Officer have access to
 * all campuses' information."
 */
const INSTITUTION_SCOPED_ROLES = new Set<string>([
  'super_admin',
  'vice_chancellor',
  'pro_vc',
  'registrar',
  'coe',
  'iqac_coordinator', // needs cross-campus data for AQAR/NAAC reporting
  'auditor' // read-only oversight across campuses (NAAC peer team, vigilance)
]);

/**
 * Read-only roles. These may never mutate data, whatever module they reach.
 *
 * The blueprint requires vigilance/audit oversight, and NAAC peer teams need
 * inspection access during a visit. Before this, EVERY role with module access
 * had full write access to that module — there was no way to grant safe
 * inspection.
 */
const READ_ONLY_ROLES = new Set<string>(['auditor']);

export function scopeLevelForRole(role: string): ScopeLevel {
  return INSTITUTION_SCOPED_ROLES.has(role) ? 'INSTITUTION' : 'CAMPUS';
}

export function isReadOnlyRole(role: string): boolean {
  return READ_ONLY_ROLES.has(role);
}

/**
 * All roles the system recognises.
 *
 * `principal` and `auditor` were added from the blueprint:
 *  - `principal` is the head of a constituent college. Multi-campus without a
 *    campus head is incoherent — the blueprint states "a Principal at Campus A
 *    cannot see or edit data of Campus B", which requires the role to exist.
 *  - `auditor` is read-only oversight.
 */
export const KNOWN_ROLES = [
  'super_admin',
  'vice_chancellor',
  'pro_vc',
  'registrar',
  'coe',
  'principal',
  'dean',
  'hod',
  'faculty',
  'student',
  'finance_officer',
  'placement_officer',
  'alumni_officer',
  'iqac_coordinator',
  'sports_director',
  'grievance_officer',
  'security_officer',
  'librarian',
  'auditor'
] as const;

export type KnownRole = (typeof KNOWN_ROLES)[number];

export interface TenantContext {
  /** Tenant root. Always present for an authenticated principal. */
  institutionId: string;
  /** The principal's own campus. Null for institution-wide roles. */
  campusId: string | null;
  scopeLevel: ScopeLevel;
  userId: string;
  role: string;
}

/**
 * Read the tenant context attached by `resolveTenantContext` middleware.
 *
 * @throws {AuthenticationError} if no context is present — which means the
 *   route was mounted without the middleware. Failing loudly is deliberate:
 *   a missing tenant context must never silently degrade to an unscoped query.
 */
export function getTenantContext(req: Request): TenantContext {
  const context = (req as Request & { tenant?: TenantContext }).tenant;

  if (!context) {
    throw new AuthenticationError(
      'Tenant context is unavailable for this request.',
      { hint: 'Route is missing the resolveTenantContext middleware.' }
    );
  }

  return context;
}

/**
 * Prisma `where` fragment scoping a query to the caller's institution.
 *
 * Every tenant-owned read MUST spread this into its `where` clause:
 *
 *     await prisma.studentProfile.findMany({
 *       where: { ...institutionScope(ctx), semester: 5 }
 *     });
 */
export function institutionScope(context: TenantContext): { institutionId: string } {
  return { institutionId: context.institutionId };
}

/**
 * Prisma `where` fragment scoping to institution AND, for campus-scoped roles,
 * to the caller's campus.
 *
 * An INSTITUTION-scoped role gets institution-only scoping, so a VC sees all
 * campuses — exactly the blueprint's "VC's dashboard can aggregate enrollment
 * and results from all campuses".
 */
export function campusScope(
  context: TenantContext
): { institutionId: string; campusId?: string } {
  if (context.scopeLevel === 'INSTITUTION') {
    return { institutionId: context.institutionId };
  }

  if (!context.campusId) {
    // A campus-scoped role with no campus assigned cannot be scoped safely.
    // Fail closed rather than fall back to institution-wide access.
    throw new AuthorizationError(
      'Your account is not assigned to a campus. Contact your administrator.'
    );
  }

  return { institutionId: context.institutionId, campusId: context.campusId };
}

/**
 * Assert that a fetched record belongs to the caller's institution.
 *
 * Defence in depth for the case where a record was fetched by primary key
 * (`findUnique({ where: { id } })`), which cannot carry a tenant filter. Without
 * this check, an attacker who learns a UUID from another institution could read
 * it — the classic IDOR, at tenant scale.
 *
 * Returns 404, not 403: revealing that an id exists in another institution is
 * itself a small information leak.
 */
export function assertSameInstitution(
  context: TenantContext,
  record: { institutionId?: string | null } | null | undefined,
  resourceName = 'Record'
): void {
  if (!record) return; // caller handles not-found

  if (record.institutionId !== context.institutionId) {
    throw new AuthorizationError(`${resourceName} was not found.`);
  }
}

/**
 * Assert campus access for a campus-scoped principal.
 * Institution-scoped roles always pass.
 */
export function assertCampusAccess(
  context: TenantContext,
  record: { campusId?: string | null } | null | undefined,
  resourceName = 'Record'
): void {
  if (!record) return;
  if (context.scopeLevel === 'INSTITUTION') return;

  if (record.campusId && record.campusId !== context.campusId) {
    throw new AuthorizationError(`${resourceName} was not found.`);
  }
}

/**
 * Force `institutionId` onto data being written.
 *
 * Overwrites any client-supplied value rather than trusting it — a caller must
 * not be able to create a row inside another institution.
 */
export function withInstitution<T extends Record<string, unknown>>(
  context: TenantContext,
  data: T
): T & { institutionId: string } {
  return { ...data, institutionId: context.institutionId };
}
