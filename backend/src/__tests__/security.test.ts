/**
 * Security regression tests.
 *
 * These lock in the Phase 0 fixes so they cannot silently regress. Each test
 * corresponds to a P0/P1 finding from /docs/system-audit/17_MASTER_GAP_REGISTER.md.
 *
 * These are pure unit tests — no database or running server required, so they
 * are safe to run in CI. End-to-end HTTP tests against a disposable Postgres
 * are tracked as T-213.
 *
 * Run: npm test
 */

import { describe, it, expect } from 'vitest';
import { validatePassword, generateTemporaryPassword } from '../lib/password.js';
import {
  NotFoundError,
  ValidationError,
  AuthorizationError,
  ConflictError,
  BusinessRuleError,
  isAppError,
  translatePrismaError
} from '../lib/errors.js';

describe('P1-10 — password policy', () => {
  it('rejects the historical default passwords', () => {
    // These were silently substituted when no password was supplied
    // (admin.ts:70 and placements.ts:157), creating real accounts with
    // credentials published in a public repository.
    for (const legacy of ['password123', 'Student@123', 'Password@123']) {
      const result = validatePassword(legacy);
      expect(result.valid, `"${legacy}" must be rejected`).toBe(false);
    }
  });

  it('requires a password to be present', () => {
    expect(validatePassword(undefined).valid).toBe(false);
    expect(validatePassword('').valid).toBe(false);
    expect(validatePassword(null).valid).toBe(false);
  });

  it('enforces the minimum length', () => {
    const result = validatePassword('Sh0rt!');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('at least'))).toBe(true);
  });

  it('requires at least three character classes', () => {
    const result = validatePassword('alllowercaseletters');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('three of'))).toBe(true);
  });

  it('rejects a single repeated character', () => {
    expect(validatePassword('aaaaaaaaaaaaaaaa').valid).toBe(false);
  });

  it('accepts a strong passphrase', () => {
    const result = validatePassword('Str0ng!Passphrase2026');
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('generates temporary passwords that satisfy the policy', () => {
    // A generated temp password must NEVER fail our own policy check — an
    // administrator resetting an account must not get a password the system
    // then rejects. 500 iterations: the original implementation failed this
    // roughly 0.3% of the time by relying on chance to hit the required
    // character classes.
    for (let i = 0; i < 500; i += 1) {
      const generated = generateTemporaryPassword();
      expect(validatePassword(generated).valid, `generated: ${generated}`).toBe(true);
    }
  });

  it('generates a different password each time', () => {
    const generated = new Set(Array.from({ length: 50 }, () => generateTemporaryPassword()));
    expect(generated.size).toBe(50);
  });
});

describe('P2-04 — error taxonomy', () => {
  it('maps each error class to the correct HTTP status', () => {
    // Previously every failure returned 500, so clients could not distinguish
    // "not found" from "conflict" from a genuine server fault.
    expect(new NotFoundError('Student profile').statusCode).toBe(404);
    expect(new ValidationError('bad input').statusCode).toBe(400);
    expect(new AuthorizationError().statusCode).toBe(403);
    expect(new ConflictError('duplicate').statusCode).toBe(409);
    expect(new BusinessRuleError('rule violated').statusCode).toBe(422);
  });

  it('produces a user-safe message', () => {
    const error = new NotFoundError('Student profile');
    expect(error.publicMessage).toBe('Student profile was not found.');
    expect(error.publicMessage).not.toContain('prisma');
    expect(error.publicMessage).not.toContain('SELECT');
  });

  it('identifies application errors', () => {
    expect(isAppError(new NotFoundError('X'))).toBe(true);
    expect(isAppError(new Error('generic'))).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError('string')).toBe(false);
  });

  it('translates Prisma error codes to domain errors', () => {
    expect(translatePrismaError({ code: 'P2002' })).toBeInstanceOf(ConflictError);
    expect(translatePrismaError({ code: 'P2025' })).toBeInstanceOf(NotFoundError);
    expect(translatePrismaError({ code: 'P2003' })).toBeInstanceOf(ValidationError);
  });

  it('returns null for errors it does not recognise, so they stay 500', () => {
    expect(translatePrismaError({ code: 'UNKNOWN' })).toBeNull();
    expect(translatePrismaError(new Error('plain'))).toBeNull();
    expect(translatePrismaError(null)).toBeNull();
  });
});

/**
 * Strip comments so these checks inspect EXECUTABLE code only.
 *
 * Without this, the historical patterns quoted in explanatory comments (which
 * document what was removed and why) would trip the assertions — a false
 * positive that would push a future maintainer to delete the very documentation
 * explaining the fix.
 */
async function readSourceWithoutComments(relativePath: string): Promise<string> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const content = await fs.readFile(path.resolve(process.cwd(), relativePath), 'utf8');

  return content
    .replace(/\/\*[\s\S]*?\*\//g, '') // block and JSDoc comments
    .replace(/^\s*\/\/.*$/gm, ''); // whole-line // comments
}

describe('P0-01/02/03 — no data fabrication', () => {
  it('does not fabricate student records', async () => {
    // getOrCreateStudentProfile invented `cgpa: 8.5`, `admissionYear: 2024` and
    // a roll number on GET requests — a read that wrote invented academic data.
    const students = await readSourceWithoutComments('src/routes/students.ts');
    expect(students).not.toContain('cgpa: 8.5');
    expect(students).not.toContain('getOrCreateStudentProfile');
  });

  it('does not fabricate faculty credentials', async () => {
    // getOrCreateFacultyProfile invented `qualification: 'Ph.D in CSE'` and
    // `experience: 5` across 38 endpoints. Faculty qualification is a NIRF TLR
    // input, so this fabricated data would have been reported to a national
    // ranking body.
    const faculty = await readSourceWithoutComments('src/routes/faculty.ts');
    expect(faculty).not.toContain("qualification: 'Ph.D in CSE'");
    expect(faculty).not.toContain('getOrCreateFacultyProfile');
  });

  it('does not auto-generate lesson plans or mark them complete', async () => {
    const faculty = await readSourceWithoutComments('src/routes/faculty.ts');
    expect(faculty).not.toContain("week <= 4 ? 'completed' : 'pending'");
    expect(faculty).not.toContain('`Module ${week}`');
  });

  it('the SEED does not fabricate a CGPA either', async () => {
    // The runtime fabrication was removed in Phase 0, but the seed still wrote
    // a plausible-looking `cgpa: 8.7`. That is the same defect in a different
    // place: a stored CGPA that no calculation produced, and that would
    // silently disagree with the results engine.
    const seed = await readSourceWithoutComments('prisma/seed.ts');
    expect(seed).not.toMatch(/cgpa:\s*[1-9]/);
  });

  it('no longer creates database tables at runtime', async () => {
    // Runtime DDL created a shadow table absent from schema.prisma, producing
    // permanent drift no migration could reconcile.
    const faculty = await readSourceWithoutComments('src/routes/faculty.ts');
    expect(faculty).not.toContain('CREATE TABLE IF NOT EXISTS');
  });
});

describe('P0-04 — no hardcoded secrets', () => {
  it('has no JWT secret fallback in the auth path', async () => {
    // `process.env.JWT_SECRET || 'supersecretkey123'` in a public repository
    // allowed anyone to forge a super_admin token when the variable was unset —
    // and no .env.example existed to signal it was required.
    for (const file of ['src/middleware/auth.ts', 'src/routes/auth.ts']) {
      const content = await readSourceWithoutComments(file);
      expect(content, `${file} still has a secret fallback`).not.toContain(
        "|| 'supersecretkey123'"
      );
    }
  });
});

describe('P2-04 — leaky error responses removed', () => {
  it('no route file returns a raw error message to the client', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');

    const routesDir = path.resolve(process.cwd(), 'src/routes');
    const files = await fs.readdir(routesDir);

    for (const file of files.filter((f) => f.endsWith('.ts'))) {
      const content = await readSourceWithoutComments(`src/routes/${file}`);
      // This pattern leaked Prisma model names, field names and constraint
      // details to clients across all 478 handlers.
      expect(content, `${file} still leaks error.message`).not.toContain(
        'message: error.message'
      );
    }
  });
});
