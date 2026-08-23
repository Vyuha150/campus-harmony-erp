/**
 * Password policy and hashing.
 *
 * Previously there was no policy at all, and two modules silently substituted a
 * publicly-known default when no password was supplied:
 *
 *     backend/src/routes/admin.ts:70
 *       bcrypt.hash(password || 'password123', 10)
 *     backend/src/routes/placements.ts:157
 *       bcrypt.hash(String(payload.password || 'Student@123'), 10)
 *
 * Because no endpoint validated its input, creating a user without a password
 * was trivially easy — and produced a real account with a password published in
 * a public repository.
 *
 * A password is now always required and always validated.
 */

import bcrypt from 'bcrypt';
import { webcrypto } from 'node:crypto';
import { config } from '../config/env.js';
import { ValidationError } from './errors.js';

/**
 * Passwords rejected outright regardless of length, including the historical
 * defaults that may already exist in deployed databases.
 */
const FORBIDDEN_PASSWORDS = new Set([
  'password123',
  'student@123',
  'password@123',
  'admin',
  'administrator',
  'password',
  'campusharmony',
  'changeme',
  '12345678',
  'qwerty123'
]);

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a password against institutional policy.
 *
 * Favours length over exotic composition rules, in line with current NIST
 * guidance: a long passphrase is both stronger and more usable than a short
 * string with mandatory symbol classes.
 */
export function validatePassword(password: unknown): PasswordValidationResult {
  const errors: string[] = [];

  if (typeof password !== 'string' || password.length === 0) {
    return { valid: false, errors: ['Password is required.'] };
  }

  const minLength = config.auth.passwordMinLength;

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters.`);
  }

  if (password.length > 200) {
    errors.push('Password must not exceed 200 characters.');
  }

  if (FORBIDDEN_PASSWORDS.has(password.toLowerCase())) {
    errors.push('This password is publicly known and cannot be used.');
  }

  // Require some variety without mandating specific symbol classes.
  const classes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^a-zA-Z0-9]/.test(password)
  ].filter(Boolean).length;

  if (classes < 3) {
    errors.push(
      'Password must include at least three of: lowercase, uppercase, digits, symbols.'
    );
  }

  if (/^(.)\1+$/.test(password)) {
    errors.push('Password must not be a single repeated character.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate and hash a password.
 *
 * There is deliberately no default parameter: a caller that forgets to supply a
 * password now gets a 400, not a silently-created account with a known password.
 *
 * @throws {ValidationError} when the password is missing or fails policy.
 */
export async function hashPassword(password: unknown): Promise<string> {
  const result = validatePassword(password);

  if (!result.valid) {
    throw new ValidationError('Password does not meet security requirements.', {
      violations: result.errors
    });
  }

  return bcrypt.hash(password as string, config.auth.bcryptRounds);
}

/** Compare a plaintext candidate against a stored hash. */
export async function verifyPassword(candidate: string, hash: string): Promise<boolean> {
  return bcrypt.compare(candidate, hash);
}

/**
 * Generate a cryptographically random temporary password.
 *
 * Used for administrative resets. The caller must require a change on first
 * login — a temporary password is a delivery mechanism, not a credential.
 *
 * GUARANTEES the generated password satisfies `validatePassword`.
 *
 * The first implementation drew every character uniformly from a combined
 * alphabet and relied on chance to satisfy the "three character classes" rule.
 * Symbols and digits were only 8 of 64 characters each, so a 20-character
 * password missed BOTH about 0.3% of the time — producing a password this
 * system's own policy would reject. In practice that is an administrator
 * resetting an account and the reset silently failing. A test caught it.
 *
 * One character is now drawn from each of three required classes up front, the
 * remainder filled from the full alphabet, and the result shuffled so the
 * guaranteed characters are not in predictable positions.
 */
export function generateTemporaryPassword(length = 20): string {
  const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O — misread as 1/0
  const LOWER = 'abcdefghijkmnopqrstuvwxyz'; // no l — misread as 1
  const DIGITS = '23456789'; // no 0 or 1
  const SYMBOLS = '!@#$%^&*';
  const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

  const minLength = Math.max(length, config.auth.passwordMinLength, 4);

  const pick = (alphabet: string): string => {
    // Rejection sampling avoids the modulo bias that `% alphabet.length`
    // introduces when the alphabet does not divide 2^32 evenly.
    const limit = Math.floor(0xffffffff / alphabet.length) * alphabet.length;
    const buffer = new Uint32Array(1);
    let value: number;
    do {
      webcrypto.getRandomValues(buffer);
      value = buffer[0]!;
    } while (value >= limit);
    return alphabet[value % alphabet.length]!;
  };

  // Guarantee all four classes — comfortably above the "three of four" rule.
  const characters: string[] = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];

  while (characters.length < minLength) {
    characters.push(pick(ALL));
  }

  // Fisher-Yates shuffle so the guaranteed characters are not always first.
  for (let i = characters.length - 1; i > 0; i -= 1) {
    const limit = Math.floor(0xffffffff / (i + 1)) * (i + 1);
    const buffer = new Uint32Array(1);
    let value: number;
    do {
      webcrypto.getRandomValues(buffer);
      value = buffer[0]!;
    } while (value >= limit);
    const j = value % (i + 1);
    [characters[i], characters[j]] = [characters[j]!, characters[i]!];
  }

  return characters.join('');
}
