/**
 * Shared validation primitives.
 *
 * Centralised so that "what a valid roll number looks like" is defined once
 * rather than re-guessed per endpoint.
 */

import { z } from 'zod';

/** UUID path/route identifier. */
export const uuid = z.string().uuid('Must be a valid identifier.');

/**
 * Identifier accepting both UUIDs and the seed's readable ids
 * (`seed-user-student`). Used where existing seeded data must remain reachable.
 */
export const entityId = z
  .string()
  .min(1, 'Identifier is required.')
  .max(64, 'Identifier is too long.');

/** Human-entered name. */
export const personName = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters.')
  .max(120, 'Name must not exceed 120 characters.');

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('Must be a valid email address.')
  .max(254);

/**
 * Indian mobile number — 10 digits starting 6-9, optional +91.
 * Institutions collect these for SMS/WhatsApp alerts.
 */
export const indianPhone = z
  .string()
  .trim()
  .regex(/^(\+?91[-\s]?)?[6-9]\d{9}$/, 'Must be a valid Indian mobile number.');

/** Institutional code — uppercase alphanumeric, tenant-scoped uniqueness. */
export const institutionalCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{1,19}$/, 'Code must be 2-20 uppercase letters, digits or hyphens.');

/** Academic year in `YYYY-YY` form, e.g. 2025-26. */
export const academicYear = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}$/, 'Academic year must be in the form 2025-26.');

/**
 * Reservation category (Government of India norms).
 *
 * Statutory admissions requirement — seat allocation by quota cannot be
 * expressed without it. See ADR note in the admissions schema: collection of
 * this field is subject to DPDP purpose-limitation review.
 */
export const reservationCategory = z.enum([
  'GENERAL',
  'EWS',
  'OBC_NCL',
  'SC',
  'ST',
  'PWD',
  'MINORITY'
]);

export const gender = z.enum(['MALE', 'FEMALE', 'TRANSGENDER', 'PREFER_NOT_TO_SAY']);

/** Pagination query. Capped so a caller cannot request an unbounded page. */
export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50)
});

/** ISO date string coerced to a Date, rejecting unparseable input. */
export const isoDate = z.coerce.date({ message: 'Must be a valid date.' });

/** Non-negative money amount, rounded to paise. */
export const amount = z
  .number()
  .nonnegative('Amount cannot be negative.')
  .max(1_000_000_000, 'Amount exceeds the permitted maximum.')
  .transform((value) => Math.round(value * 100) / 100);
