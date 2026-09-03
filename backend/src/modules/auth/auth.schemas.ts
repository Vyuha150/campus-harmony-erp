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
