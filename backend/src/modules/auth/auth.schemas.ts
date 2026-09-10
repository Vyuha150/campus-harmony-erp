import { z } from 'zod';
import { KNOWN_ROLES } from '../../lib/tenant.js';

/**
 * POST /auth/login.
 *
 * No length minimum on `password`: this verifies an EXISTING password against
 * bcrypt, it does not set one, so a schema minimum could reject a legitimate
 * account whose password predates any policy. `email` trims and lowercases —
 * strictly more permissive than today's exact-string lookup, so it cannot turn
 * a working login into a failing one, only the reverse.
 *
 * `role`, when sent, is checked for equality against the account's real role
 * and never used to grant it — restricting it to the known set turns a typo
 * into a clean 400 instead of an accidental 403 with a confusing message.
 */
export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Must be a valid email address.').max(254),
    password: z.string().min(1, 'Password is required.').max(200),
    role: z.enum(KNOWN_ROLES).optional()
  })
  .strict();

/** POST /auth/forgot-password. */
export const forgotPasswordSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Must be a valid email address.').max(254)
  })
  .strict();

/**
 * POST /auth/reset-password.
 *
 * No length/composition minimum on `newPassword` here — `hashPassword` (see
 * `lib/password.ts`) already validates it against real institutional policy,
 * and duplicating a threshold here risks the schema and the policy silently
 * drifting apart. The schema's only job is to make sure something was sent.
 */
export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1, 'Reset token is required.').max(200),
    newPassword: z.string().min(1, 'New password is required.').max(200)
  })
  .strict();
