/**
 * Per-file authorization tests (A5 / T-209).
 *
 * Phase 0 stopped uploads being world-readable but left a documented gap: any
 * authenticated user could download any file whose id they knew. These tests
 * lock the rules that close it, including the ones that are deliberately
 * stricter than "is an admin".
 */

import { describe, it, expect } from 'vitest';
import { assertCanReadFile, assertCanDeleteFile, type FileAccessSubject } from '../lib/fileAccess.js';
import { AuthorizationError, NotFoundError } from '../lib/errors.js';
import type { TenantContext } from '../lib/tenant.js';

const INST_A = 'institution-a';
const INST_B = 'institution-b';

function ctx(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    institutionId: INST_A,
    campusId: 'campus-1',
    scopeLevel: 'CAMPUS',
    userId: 'user-reader',
    role: 'faculty',
    ...overrides
  };
}

function file(overrides: Partial<FileAccessSubject> = {}): FileAccessSubject {
  return {
    id: 'file-1',
    institutionId: INST_A,
    uploadedBy: 'user-uploader',
    ownerUserId: null,
    visibility: 'private',
    allowedRoles: null,
    isConfidential: false,
    module: 'general',
    deletedAt: null,
    ...overrides
  };
}

describe('tenant boundary', () => {
  it('reports another institution\'s file as NOT FOUND', () => {
    // 404 not 403 — confirming an id exists in another university is itself a
    // disclosure.
    expect(() => assertCanReadFile(ctx(), file({ institutionId: INST_B }))).toThrow(NotFoundError);
  });

  it('rejects a soft-deleted file', () => {
    expect(() => assertCanReadFile(ctx(), file({ deletedAt: new Date() }))).toThrow(NotFoundError);
  });

  it('rejects a missing file', () => {
    expect(() => assertCanReadFile(ctx(), null)).toThrow(NotFoundError);
  });
});

describe('ownership', () => {
  it('lets the uploader read their own file', () => {
    expect(() =>
      assertCanReadFile(ctx({ userId: 'user-uploader' }), file())
    ).not.toThrow();
  });

  it('lets the SUBJECT read a file uploaded by someone else', () => {
    // A student must be able to read their own certificate even though the
    // registrar uploaded it.
    expect(() =>
      assertCanReadFile(ctx({ userId: 'student-1', role: 'student' }), file({ ownerUserId: 'student-1' }))
    ).not.toThrow();
  });

  it('blocks an unrelated user from a private file', () => {
    expect(() => assertCanReadFile(ctx(), file())).toThrow(AuthorizationError);
  });
});

describe('visibility', () => {
  it('allows any institution member when visibility is institution', () => {
    expect(() => assertCanReadFile(ctx(), file({ visibility: 'institution' }))).not.toThrow();
  });

  it('allows a listed role when visibility is role_restricted', () => {
    expect(() =>
      assertCanReadFile(
        ctx({ role: 'grievance_officer' }),
        file({ visibility: 'role_restricted', allowedRoles: ['grievance_officer'] })
      )
    ).not.toThrow();
  });

  it('blocks an unlisted role when visibility is role_restricted', () => {
    expect(() =>
      assertCanReadFile(
        ctx({ role: 'sports_director' }),
        file({ visibility: 'role_restricted', allowedRoles: ['grievance_officer'] })
      )
    ).toThrow(AuthorizationError);
  });

  it('treats an unknown visibility as private (fails closed)', () => {
    expect(() =>
      assertCanReadFile(ctx(), file({ visibility: 'something_new' }))
    ).toThrow(AuthorizationError);
  });
});

describe('confidential material', () => {
  it('blocks even super_admin without an explicit role grant', () => {
    // Vigilance files, anonymous grievance evidence and disciplinary records
    // must not be readable simply by holding an admin role.
    expect(() =>
      assertCanReadFile(ctx({ role: 'super_admin' }), file({ isConfidential: true }))
    ).toThrow(AuthorizationError);
  });

  it('allows an admin who IS explicitly granted', () => {
    expect(() =>
      assertCanReadFile(
        ctx({ role: 'registrar' }),
        file({ isConfidential: true, allowedRoles: ['registrar'] })
      )
    ).not.toThrow();
  });

  it('does NOT become readable via institution-wide visibility', () => {
    // Guards the combination that would otherwise quietly expose everything.
    expect(() =>
      assertCanReadFile(ctx(), file({ isConfidential: true, visibility: 'institution' }))
    ).toThrow(AuthorizationError);
  });

  it('still lets the uploader read their own confidential upload', () => {
    expect(() =>
      assertCanReadFile(ctx({ userId: 'user-uploader' }), file({ isConfidential: true }))
    ).not.toThrow();
  });
});

describe('administrative access', () => {
  for (const role of ['super_admin', 'registrar', 'auditor']) {
    it(`lets ${role} read non-confidential institution files`, () => {
      expect(() => assertCanReadFile(ctx({ role }), file())).not.toThrow();
    });
  }

  it('does not extend admin access across institutions', () => {
    expect(() =>
      assertCanReadFile(ctx({ role: 'super_admin' }), file({ institutionId: INST_B }))
    ).toThrow(NotFoundError);
  });
});

describe('deletion is narrower than reading', () => {
  it('lets the uploader delete', () => {
    expect(() => assertCanDeleteFile(ctx({ userId: 'user-uploader' }), file())).not.toThrow();
  });

  it('does NOT let the file subject delete', () => {
    // Reading your own certificate is reasonable; destroying an institutional
    // record is an administrative act.
    expect(() =>
      assertCanDeleteFile(ctx({ userId: 'student-1', role: 'student' }), file({ ownerUserId: 'student-1' }))
    ).toThrow(AuthorizationError);
  });

  it('does not let auditor delete — read-only role', () => {
    expect(() => assertCanDeleteFile(ctx({ role: 'auditor' }), file())).toThrow(AuthorizationError);
  });

  it('lets super_admin and registrar delete', () => {
    for (const role of ['super_admin', 'registrar']) {
      expect(() => assertCanDeleteFile(ctx({ role }), file()), role).not.toThrow();
    }
  });
});

describe('storage safety', () => {
  it('generates tenant-partitioned, traversal-safe keys', async () => {
    const { buildStorageKey } = await import('../lib/storage.js');

    const key = buildStorageKey(INST_A, 'grievances', 'evidence.pdf');
    expect(key.startsWith(`${INST_A}/grievances/`)).toBe(true);
    expect(key.endsWith('.pdf')).toBe(true);

    // A hostile module name must not escape the prefix.
    const hostile = buildStorageKey(INST_A, '../../etc', 'x.pdf');
    expect(hostile).not.toContain('..');
    expect(hostile.startsWith(`${INST_A}/`)).toBe(true);
  });

  it('produces a unique key per upload of the same filename', async () => {
    const { buildStorageKey } = await import('../lib/storage.js');
    const keys = new Set(
      Array.from({ length: 50 }, () => buildStorageKey(INST_A, 'general', 'same.pdf'))
    );
    expect(keys.size).toBe(50);
  });
});
