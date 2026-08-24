/**
 * Redaction in the structural audit.
 *
 * The extension records every write that no service described itself. That
 * means it sees `data` payloads it did not choose, including the ones carrying
 * credentials: a user create, a password reset, a token refresh. An audit table
 * is read by more people than the tables it describes and kept longer than
 * most, so a hash written into it turns durable evidence into a credential
 * store.
 *
 * These tests exist because `redact()` is the only thing standing between those
 * payloads and that table, and because a redactor that quietly stopped matching
 * would leave no trace of having done so — the log would simply start
 * containing hashes, and would look exactly as it always had.
 */

import { describe, it, expect } from 'vitest';
import { redact } from '../lib/structuralAudit.js';
import { unpaginatedReadMessage } from '../lib/tenantExtension.js';

describe('audit redaction', () => {
  it('removes credentials at the top level', () => {
    const out = redact({ email: 'a@b.edu', password: 'hunter2' }) as Record<string, unknown>;
    expect(out.password).toBe('[redacted]');
    expect(out.email).toBe('a@b.edu');
  });

  it('matches regardless of casing or separators', () => {
    // The same field is spelled three ways across this codebase's models.
    const out = redact({
      passwordHash: 'x',
      password_hash: 'y',
      PASSWORDHASH: 'z'
    }) as Record<string, unknown>;
    expect(Object.values(out)).toEqual(['[redacted]', '[redacted]', '[redacted]']);
  });

  it('reaches nested objects and arrays', () => {
    const out = redact({
      user: { name: 'Asha', resetToken: 'abc' },
      batch: [{ apiKey: 'k1' }, { apiKey: 'k2' }]
    }) as { user: Record<string, unknown>; batch: Record<string, unknown>[] };

    expect(out.user.resetToken).toBe('[redacted]');
    expect(out.user.name).toBe('Asha');
    expect(out.batch[0]!.apiKey).toBe('[redacted]');
    expect(out.batch[1]!.apiKey).toBe('[redacted]');
  });

  it('covers every credential name the denylist claims to cover', () => {
    const names = [
      'password',
      'passwordHash',
      'newPassword',
      'oldPassword',
      'currentPassword',
      'confirmPassword',
      'token',
      'accessToken',
      'refreshToken',
      'resetToken',
      'verificationToken',
      'secret',
      'clientSecret',
      'apiKey',
      'privateKey',
      'otp',
      'mfaSecret',
      'sessionToken'
    ];
    for (const name of names) {
      const out = redact({ [name]: 'sensitive' }) as Record<string, unknown>;
      expect(out[name], `${name} was written to the audit log in the clear`).toBe('[redacted]');
    }
  });

  it('NEGATIVE CONTROL: ordinary fields survive', () => {
    // Without this, a redactor that replaced EVERY value would pass every test
    // above while making the audit log useless.
    const out = redact({
      title: 'Annual report',
      marks: 87,
      submitted: true,
      tags: ['a', 'b']
    }) as Record<string, unknown>;

    expect(out).toEqual({
      title: 'Annual report',
      marks: 87,
      submitted: true,
      tags: ['a', 'b']
    });
  });

  it('NEGATIVE CONTROL: a name that merely contains a denied word is kept', () => {
    // `passwordChangedAt` is a timestamp, not a credential. Redacting it would
    // remove exactly the fact an investigator wants.
    const out = redact({ passwordChangedAt: '2026-01-01', tokenCount: 3 }) as Record<
      string,
      unknown
    >;
    expect(out.passwordChangedAt).toBe('2026-01-01');
    expect(out.tokenCount).toBe(3);
  });

  it('leaves primitives and dates alone', () => {
    const date = new Date('2026-01-01T00:00:00Z');
    expect(redact('plain')).toBe('plain');
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBe(null);
    expect(redact(date)).toBe(date);
  });

  it('terminates on a deeply nested structure', () => {
    // Guards against a self-referential payload hanging the write path.
    let deep: Record<string, unknown> = { password: 'x' };
    for (let i = 0; i < 20; i += 1) deep = { nested: deep };
    expect(() => redact(deep)).not.toThrow();
  });
});

/**
 * The unpaginated-read cap's message.
 *
 * The cap itself needs a thousand rows and a database to trigger, and is proven
 * live in scripts/verify/verify-3c-row-cap.sh. What can be checked here is the
 * part that decides whether the cap gets respected or worked around: whether a
 * developer who hits it is told what to do.
 */
describe('unpaginated-read cap message', () => {
  it('names the model, the limit, and both remedies', () => {
    const message = unpaginatedReadMessage('StudentProfile');

    expect(message).toContain('StudentProfile');
    expect(message).toContain('1000');
    expect(message).toMatch(/paginate/i);
    expect(message).toContain('unbounded(');
  });

  it('says WHY it refuses instead of truncating', () => {
    // Without the reason, capping silently looks like the obvious simpler fix,
    // and the next person applies it.
    expect(unpaginatedReadMessage('CourseResult')).toMatch(/silently|computed/i);
  });
});
