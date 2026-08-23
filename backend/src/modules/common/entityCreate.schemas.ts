/**
 * Create schemas for the 9 handlers that took `data: req.body` (0030 follow-up).
 *
 * WHY THESE WERE MISSED
 *
 * The Phase 3b ratchet bans `update({ where: { id }, data: req.body })`. It said
 * nothing about `create({ data: req.body })`, so nine of those survived a sweep
 * that reported zero. A guard is only as wide as the shape it was written
 * against, and the shape I wrote it against was the one I had just fixed.
 *
 * WHAT IS AND IS NOT AT RISK HERE
 *
 * Tenancy is NOT the problem on this path, and it is worth being precise rather
 * than alarming. Routes use the extended `prisma` client, and the tenant
 * extension injects `institutionId` on create — it also OVERRIDES a
 * client-supplied one. Verified live: posting
 * `institutionId: <rival institution>` to `POST /sports/teams` produced a row in
 * the CALLER's institution, not the rival's.
 *
 * What remains is ordinary mass assignment: every other column was writable,
 * including counters, provenance and status fields the domain treats as derived
 * or decided elsewhere. That is what these schemas close.
 */

import { z } from 'zod';

const jsonValue = z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]);

const isoDate = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'must be a valid date');

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

// ─── alumni.ts ───────────────────────────────────────────────────────────────

export const createCommunicationSchema = z
  .object({
    title: text(3, 200),
    content: text(1, 20000),
    type: z.enum(['newsletter', 'announcement', 'invitation', 'appeal']).optional(),
    targetAudience: jsonValue.nullable().optional(),
    scheduledDate: isoDate.nullable().optional(),
    status: z.enum(['draft', 'scheduled', 'sent']).optional()
  })
  // `sentDate`, `recipientCount`, `openRate` and `clickRate` are omitted: they
  // are the RESULT of sending. A caller that can set them can report a campaign
  // reach that never happened.
  .strict();

export const createDonationSchema = z
  .object({
    alumniProfileId: text(1, 80),
    amount: z.coerce.number().positive().max(1_000_000_000),
    purpose: text(2, 300),
    date: isoDate.optional(),
    status: z.enum(['pending', 'completed', 'refunded', 'failed']).optional()
  })
  .strict();

// ─── finance.ts ──────────────────────────────────────────────────────────────

export const createVendorSchema = z
  .object({
    name: text(2, 200),
    contactPerson: text(2, 160),
    email: z.string().trim().email().max(200),
    phone: text(4, 20),
    address: text(4, 500),
    gstNumber: z.string().trim().max(20).nullable().optional(),
    panNumber: z.string().trim().max(20).nullable().optional(),
    paymentTerms: z.string().trim().max(60).optional(),
    status: z.enum(['active', 'inactive', 'blacklisted']).optional()
  })
  .strict();

export const createPayrollSchema = z
  .object({
    employeeId: text(1, 80),
    employeeName: text(2, 160),
    department: text(2, 160),
    designation: text(2, 160),
    month: text(1, 20),
    year: z.coerce.number().int().min(1900).max(2200),
    basicSalary: z.coerce.number().min(0).max(1_000_000_000),
    allowances: jsonValue.nullable().optional(),
    deductions: jsonValue.nullable().optional(),
    paymentMethod: z.enum(['bank_transfer', 'cheque', 'cash']).optional()
  })
  // `grossSalary` and `netSalary` are DERIVED from basic + allowances -
  // deductions, and the route computes them. `status` and `paymentDate` describe
  // whether the person has actually been paid, which is not something the
  // request creating the record gets to assert.
  .strict();

// ─── registrar.ts ────────────────────────────────────────────────────────────

export const createTransferSchema = z
  .object({
    studentId: text(1, 80),
    studentName: text(2, 160),
    type: text(2, 40),
    fromInstitution: text(2, 200),
    toInstitution: text(2, 200),
    program: text(2, 160),
    reason: text(1, 2000),
    documents: jsonValue.nullable().optional()
  })
  // `status` is omitted deliberately: a transfer request is created PENDING. A
  // caller that can post `status: 'approved'` has approved their own transfer.
  .strict();

// ─── sports.ts ───────────────────────────────────────────────────────────────

export const createAthleteSchema = z
  .object({
    studentId: text(1, 80),
    studentName: text(2, 160),
    rollNumber: text(1, 40),
    program: text(2, 160),
    year: z.coerce.number().int().min(1).max(10),
    email: z.string().trim().email().max(200),
    phone: text(4, 20),
    sports: jsonValue.nullable().optional(),
    achievements: jsonValue.nullable().optional(),
    medicalClearance: z.boolean().optional(),
    emergencyContact: jsonValue.nullable().optional(),
    status: z.enum(['active', 'injured', 'inactive', 'graduated']).optional()
  })
  .strict();

export const createTeamSchema = z
  .object({
    sport: text(2, 60),
    category: text(2, 60),
    level: text(2, 60).optional(),
    coach: text(2, 120),
    captain: z.string().trim().max(120).nullable().optional(),
    members: jsonValue.nullable().optional(),
    practiceSchedule: jsonValue.nullable().optional(),
    upcomingMatches: jsonValue.nullable().optional(),
    season: text(2, 40),
    status: z.enum(['active', 'inactive', 'disbanded']).optional()
  })
  .strict();

export const createAttendanceSchema = z
  .object({
    teamId: text(1, 80),
    date: isoDate.optional(),
    attendees: jsonValue.nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    sessionType: z.enum(['training', 'match', 'fitness', 'meeting']).optional()
  })
  .strict();

export const createInventorySchema = z
  .object({
    itemName: text(2, 160),
    category: text(2, 60),
    sport: text(2, 60),
    brand: z.string().trim().max(80).nullable().optional(),
    quantity: z.coerce.number().int().min(0).max(1_000_000),
    availableQuantity: z.coerce.number().int().min(0).max(1_000_000).optional(),
    unitPrice: z.coerce.number().min(0).max(100_000_000),
    condition: z.enum(['new', 'good', 'fair', 'poor', 'unusable']).optional(),
    purchaseDate: isoDate.nullable().optional(),
    lastMaintenance: isoDate.nullable().optional(),
    location: text(2, 160)
  })
  // `totalValue` is derived; the route computes it from quantity x unitPrice.
  .strict()
  .refine(
    (v) => v.availableQuantity === undefined || v.availableQuantity <= v.quantity,
    { message: 'availableQuantity cannot exceed quantity', path: ['availableQuantity'] }
  );
