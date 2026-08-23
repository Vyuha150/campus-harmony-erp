/**
 * Per-file authorization (T-209).
 *
 * THE GAP THIS CLOSES
 *
 * Phase 0 removed the unauthenticated `express.static('/uploads')` mount, which
 * had made every uploaded file publicly downloadable — grievance evidence
 * including anonymous submissions, vigilance case files, identity documents.
 *
 * But the fix stopped at "must be logged in". With no file metadata, ANY
 * authenticated user could download ANY file whose id they knew. That was
 * recorded honestly at the time as an accepted interim state; this closes it.
 *
 * The rules below are deliberately restrictive. For institutional records the
 * correct default is that a file is private to the people it concerns, and
 * access is widened explicitly — never inherited by being logged in.
 */

import type { TenantContext } from './tenant.js';
import { AuthorizationError, NotFoundError } from './errors.js';
import { logger } from './logger.js';

export interface FileAccessSubject {
  id: string;
  institutionId: string;
  uploadedBy: string;
  ownerUserId: string | null;
  visibility: string;
  allowedRoles: unknown;
  isConfidential: boolean;
  module: string;
  deletedAt: Date | null;
}

/**
 * Roles trusted with institution-wide file access.
 *
 * `auditor` is included because NAAC peer teams and internal vigilance need to
 * inspect evidence — and the role is read-only, enforced separately by
 * `enforceReadOnly`, so this grants inspection without any write capability.
 */
const INSTITUTION_FILE_ADMINS = new Set(['super_admin', 'registrar', 'auditor']);

function parseAllowedRoles(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  return [];
}

/**
 * Decide whether `context` may read `file`.
 *
 * @throws {NotFoundError} when the file is deleted or belongs to another
 *   institution. Deliberately NOT 403: confirming that an id exists in another
 *   university is itself a disclosure.
 * @throws {AuthorizationError} when the file exists in this institution but the
 *   caller has no claim to it.
 */
export function assertCanReadFile(
  context: TenantContext,
  file: FileAccessSubject | null | undefined
): void {
  if (!file || file.deletedAt) {
    throw new NotFoundError('File');
  }

  // Tenant boundary first — a hard wall, reported as not-found.
  if (file.institutionId !== context.institutionId) {
    logger.warn('Blocked cross-institution file access', {
      module: 'files',
      operation: 'read',
      userId: context.userId,
      resource: `FileMetadata:${file.id}`
    });
    throw new NotFoundError('File');
  }

  // The uploader may always read their own upload.
  if (file.uploadedBy === context.userId) return;

  // The subject of the file may always read it — a student can read their own
  // certificate even when the registrar uploaded it.
  if (file.ownerUserId && file.ownerUserId === context.userId) return;

  // Institution-wide administrators, EXCEPT for confidential material.
  if (INSTITUTION_FILE_ADMINS.has(context.role)) {
    if (!file.isConfidential) return;
    // Confidential files (vigilance, anonymous grievance evidence,
    // disciplinary records) require an explicit role grant even for admins.
    if (parseAllowedRoles(file.allowedRoles).includes(context.role)) return;

    logger.warn('Blocked admin access to confidential file', {
      module: 'files',
      operation: 'read',
      userId: context.userId,
      role: context.role,
      resource: `FileMetadata:${file.id}`
    });
    throw new AuthorizationError('This file requires specific authorisation to access.');
  }

  switch (file.visibility) {
    case 'institution':
      // Any member of the institution — but never for confidential material.
      if (file.isConfidential) break;
      return;

    case 'role_restricted':
      if (parseAllowedRoles(file.allowedRoles).includes(context.role)) return;
      break;

    case 'private':
    default:
      break;
  }

  logger.warn('Blocked unauthorised file access', {
    module: 'files',
    operation: 'read',
    userId: context.userId,
    role: context.role,
    resource: `FileMetadata:${file.id}`
  });

  throw new AuthorizationError('You do not have permission to access this file.');
}

/**
 * Whether `context` may delete `file`.
 *
 * Narrower than read: deletion of institutional records is an administrative
 * act, so the subject of a file cannot delete it.
 */
export function assertCanDeleteFile(
  context: TenantContext,
  file: FileAccessSubject | null | undefined
): void {
  if (!file || file.deletedAt) throw new NotFoundError('File');
  if (file.institutionId !== context.institutionId) throw new NotFoundError('File');

  if (file.uploadedBy === context.userId) return;
  if (context.role === 'super_admin' || context.role === 'registrar') return;

  throw new AuthorizationError('You do not have permission to delete this file.');
}
