/**
 * Multi-tenancy isolation tests (ADR-0001).
 *
 * Cross-institution data leakage is a P0 security incident — one university
 * reading another's student records. These tests lock the scoping helpers so a
 * future refactor cannot quietly widen the boundary.
 *
 * These are unit tests over the scoping logic. The end-to-end HTTP isolation
 * tests (verified manually against a running server with two real institutions)
 * are tracked as T-213 and need a disposable database in CI.
 */

import { describe, it, expect } from 'vitest';
import {
  scopeLevelForRole,
  institutionScope,
  campusScope,
  assertSameInstitution,
  assertCampusAccess,
  withInstitution,
  getTenantContext,
  type TenantContext
} from '../lib/tenant.js';
import { AuthorizationError, AuthenticationError } from '../lib/errors.js';

const INST_A = 'institution-a';
const INST_B = 'institution-b';
const CAMPUS_A1 = 'campus-a1';
const CAMPUS_A2 = 'campus-a2';

function ctx(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    institutionId: INST_A,
    campusId: CAMPUS_A1,
    scopeLevel: 'CAMPUS',
    userId: 'user-1',
    userName: 'Test User',
    role: 'faculty',
    ...overrides
  };
}

describe('role scope levels', () => {
  it('grants institution-wide scope to leadership roles', () => {
    // Blueprint: "Roles like VC, Registrar, or Group Finance Officer have
    // access to all campuses' information."
    for (const role of ['super_admin', 'vice_chancellor', 'pro_vc', 'registrar', 'coe']) {
      expect(scopeLevelForRole(role), role).toBe('INSTITUTION');
    }
  });

  it('grants campus scope to operational roles', () => {
    // Blueprint: "Roles like Principal, campus admin, or campus finance officer
    // are limited to their campus."
    for (const role of ['faculty', 'student', 'hod', 'librarian', 'finance_officer']) {
      expect(scopeLevelForRole(role), role).toBe('CAMPUS');
    }
  });

  it('FAILS CLOSED for an unknown role', () => {
    // A role added later must default to the NARROWER scope. Defaulting to
    // institution-wide would silently over-grant.
    expect(scopeLevelForRole('some_new_role_added_later')).toBe('CAMPUS');
    expect(scopeLevelForRole('')).toBe('CAMPUS');
  });
});

describe('query scoping', () => {
  it('always constrains to the caller institution', () => {
    expect(institutionScope(ctx())).toEqual({ institutionId: INST_A });
  });

  it('lets institution-scoped roles span all campuses', () => {
    const scope = campusScope(ctx({ scopeLevel: 'INSTITUTION', campusId: null, role: 'vice_chancellor' }));
    expect(scope).toEqual({ institutionId: INST_A });
    expect(scope).not.toHaveProperty('campusId');
  });

  it('restricts campus-scoped roles to their own campus', () => {
    expect(campusScope(ctx())).toEqual({ institutionId: INST_A, campusId: CAMPUS_A1 });
  });

  it('refuses to scope a campus role with no campus assigned', () => {
    // Falling back to institution-wide here would silently escalate privilege.
    expect(() => campusScope(ctx({ campusId: null }))).toThrow(AuthorizationError);
  });

  it('never emits a scope without an institutionId', () => {
    for (const level of ['INSTITUTION', 'CAMPUS'] as const) {
      const scope = campusScope(ctx({ scopeLevel: level }));
      expect(scope.institutionId).toBe(INST_A);
    }
  });
});

describe('cross-institution access (P0)', () => {
  it('rejects a record belonging to another institution', () => {
    expect(() =>
      assertSameInstitution(ctx(), { institutionId: INST_B }, 'Student')
    ).toThrow(AuthorizationError);
  });

  it('allows a record from the caller institution', () => {
    expect(() => assertSameInstitution(ctx(), { institutionId: INST_A })).not.toThrow();
  });

  it('does not disclose that the id exists elsewhere', () => {
    // Reporting "forbidden" would confirm the record exists in another
    // institution. The message must read as not-found.
    try {
      assertSameInstitution(ctx(), { institutionId: INST_B }, 'Student');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as AuthorizationError).publicMessage).toContain('not found');
      expect((error as AuthorizationError).publicMessage).not.toContain(INST_B);
    }
  });

  it('rejects a record with a null institution', () => {
    // An untenanted row must never be readable by a tenanted principal.
    expect(() => assertSameInstitution(ctx(), { institutionId: null })).toThrow(AuthorizationError);
  });

  it('ignores a null record so the caller can return 404', () => {
    expect(() => assertSameInstitution(ctx(), null)).not.toThrow();
  });
});

describe('cross-campus access', () => {
  it('blocks a campus-scoped role from another campus', () => {
    expect(() => assertCampusAccess(ctx(), { campusId: CAMPUS_A2 }, 'Course')).toThrow(
      AuthorizationError
    );
  });

  it('allows an institution-scoped role across campuses', () => {
    expect(() =>
      assertCampusAccess(ctx({ scopeLevel: 'INSTITUTION', role: 'registrar' }), { campusId: CAMPUS_A2 })
    ).not.toThrow();
  });

  it('allows a campus-scoped role within its own campus', () => {
    expect(() => assertCampusAccess(ctx(), { campusId: CAMPUS_A1 })).not.toThrow();
  });
});

describe('write scoping', () => {
  it('stamps the caller institution onto created rows', () => {
    expect(withInstitution(ctx(), { name: 'X' })).toEqual({ name: 'X', institutionId: INST_A });
  });

  it('OVERWRITES a client-supplied institutionId', () => {
    // The critical property: a caller must not be able to create a row inside
    // another institution by including institutionId in the request body.
    const result = withInstitution(ctx(), { name: 'X', institutionId: INST_B });
    expect(result.institutionId).toBe(INST_A);
  });
});

describe('missing tenant context', () => {
  it('throws rather than silently running an unscoped query', () => {
    // If a route is ever mounted without resolveTenantContext, the request must
    // fail — never degrade to returning every institution's rows.
    expect(() => getTenantContext({} as never)).toThrow(AuthenticationError);
  });
});

describe('source guard — tenant middleware is wired', () => {
  it('mounts resolveTenantContext on every tenant-scoped route', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const server = await fs.readFile(path.resolve(process.cwd(), 'src/server.ts'), 'utf8');

    const code = server.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    expect(code).toContain('resolveTenantContext');
    expect(code).toContain('rejectClientTenantOverride');

    // Every /api route except auth, health and ready must be tenant-scoped.
    //
    // Checks EVERY mount line, not just the first one found for a path. A path
    // can be mounted more than once (finance is mounted three times), and the
    // original `.find()` stopped at the first — so a second, unscoped mount of
    // an already-scoped path passed silently. That is precisely the mistake
    // this guard exists to catch.
    const exemptPaths = new Set(['auth']);

    /**
     * Routers deliberately mounted OUTSIDE the tenant middleware, each of
     * which must prove its own identity some other way. Adding to this list
     * means taking responsibility for that proof.
     *
     *   gatewayWebhookRouter — Razorpay's servers hold no JWT. It authenticates
     *   by HMAC signature over the raw body and derives its institution from
     *   signature-covered order notes, so a forged institutionId cannot be
     *   submitted. See modules/finance/gateway.routes.ts.
     */
    const exemptRouters = ['gatewayWebhookRouter'];

    const mountLines = code
      .split('\n')
      .filter((l) => /app\.use\('\/api\/[a-z-]+'/.test(l));

    for (const line of mountLines) {
      const mount = line.match(/app\.use\('\/api\/([a-z-]+)'/)?.[1];
      if (!mount || exemptPaths.has(mount)) continue;
      if (exemptRouters.some((r) => line.includes(r))) continue;

      expect(line, `/api/${mount} is mounted without tenantScoped`).toContain('tenantScoped');
    }
  });

  it('the tenant-exempt webhook verifies a signature instead', async () => {
    // An exemption above is only acceptable while the router it names really
    // does authenticate by another means. If someone strips the signature
    // check out, the exemption silently becomes an unauthenticated,
    // unscoped write endpoint — so the exemption and the check are asserted
    // together, here.
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const gateway = await fs.readFile(
      path.resolve(process.cwd(), 'src/modules/finance/gateway.routes.ts'),
      'utf8'
    );

    expect(gateway).toContain('verifyWebhookSignature');
    // The institution must come from the signed payload, never from a
    // client-supplied field on the request.
    expect(gateway).toContain('parsed.notes.institutionId');
  });
});
