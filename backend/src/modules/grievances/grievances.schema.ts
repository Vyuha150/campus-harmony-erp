/**
 * Grievance validation.
 *
 * The omissions matter more here than anywhere else in this codebase. A
 * grievance record decides who is accused, who complained, and whether the
 * complainant can be identified — and the module handles ragging and harassment
 * complaints, where re-identifying an anonymous complainant is the specific harm
 * the anonymity option exists to prevent.
 */

import { z } from 'zod';

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const GRIEVANCE_STATUSES = [
  'received',
  'under_review',
  'investigating',
  'resolved',
  'closed',
  'escalated'
] as const;

export const GRIEVANCE_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

/**
 * Filing a grievance.
 *
 * `complainantId` is NOT accepted. It used to be read from the request body,
 * which meant a caller could file a complaint attributed to somebody else —
 * impersonation in the one module where the complainant's identity is the most
 * consequential field in the row. It is now taken from the authenticated token,
 * or deliberately omitted for anonymous submissions.
 *
 * `complainantName` is also not accepted: for a named submission it is resolved
 * from the caller's own user record, and for an anonymous one storing a name
 * would defeat the point.
 *
 * `status` and `timeline` are not accepted either. A case is created `received`
 * with a system-generated first entry; a caller that can post
 * `status: 'closed'` can file and dismiss a complaint about themselves in one
 * request.
 */
export const createCaseSchema = z
  .object({
    complainantType: z.enum(['student', 'faculty', 'staff', 'parent', 'anonymous']),
    category: text(2, 80),
    subcategory: z.string().trim().max(80).nullable().optional(),
    subject: text(3, 200),
    description: text(10, 20000),
    severity: z.enum(GRIEVANCE_SEVERITIES).optional(),
    isAnonymous: z.boolean().optional(),
    department: z.string().trim().max(160).nullable().optional(),
    evidenceFiles: z.array(z.string().trim().max(500)).max(20).optional()
  })
  .strict();

/**
 * Updating a case — the officer's view.
 *
 * Nothing that identifies the complainant is editable: not `complainantId`,
 * `complainantName`, `complainantType` or `isAnonymous`. Allowing `isAnonymous`
 * to be flipped would be the single most damaging write in this module, because
 * it converts a protected submission into an attributable one after the fact.
 *
 * `grievanceNumber`, `submissionDate` and `timeline` are likewise fixed: the
 * timeline is append-only through the activity endpoint.
 */
export const updateCaseSchema = z
  .object({
    status: z.enum(GRIEVANCE_STATUSES).optional(),
    severity: z.enum(GRIEVANCE_SEVERITIES).optional(),
    category: text(2, 80).optional(),
    subcategory: z.string().trim().max(80).nullable().optional(),
    assignedTo: z.string().trim().max(80).nullable().optional(),
    department: z.string().trim().max(160).nullable().optional(),
    expectedResolutionDate: z
      .string()
      .trim()
      .refine((v) => !Number.isNaN(Date.parse(v)), 'must be a valid date')
      .nullable()
      .optional(),
    resolution: z.string().trim().max(20000).nullable().optional(),
    satisfactionRating: z.coerce.number().int().min(1).max(5).nullable().optional()
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });

/** One append-only timeline entry. */
export const addActivitySchema = z
  .object({
    action: text(2, 120),
    notes: z.string().trim().max(4000).optional()
  })
  .strict();

export const listCasesQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(GRIEVANCE_STATUSES).optional(),
  severity: z.enum(GRIEVANCE_SEVERITIES).optional(),
  category: z.string().trim().max(80).optional()
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
export type AddActivityInput = z.infer<typeof addActivitySchema>;

/**
 * Compliance items and anti-ragging affidavits (Phase 3c completion).
 *
 * `PUT /compliance/:id` was `const updateData: any = req.body; ... data: updateData`
 * — mass assignment that evaded the ratchet in `serviceScoping.test.ts`
 * entirely, because the guard matches `data: req.body` textually and this
 * handler assigns `req.body` to a variable one line earlier. A fourth
 * too-narrow pattern, in the same family as the three the ratchet's own
 * comments already record. `.strict()` here closes it the same way a wired
 * `validate()` closes every other handler in this sweep.
 */
export const complianceItemCreateSchema = z
  .object({
    title: text(2, 300),
    type: text(1, 80),
    description: text(1, 4000),
    applicableTo: text(1, 300),
    dueDate: z.coerce.date().optional(),
    renewalPeriod: z.string().trim().max(80).nullable().optional(),
    documents: z.array(z.unknown()).max(200).optional()
  })
  .strict();

export const complianceItemUpdateSchema = z
  .object({
    title: text(2, 300).optional(),
    type: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().min(1).max(4000).optional(),
    applicableTo: z.string().trim().min(1).max(300).optional(),
    dueDate: z.coerce.date().nullable().optional(),
    renewalPeriod: z.string().trim().max(80).nullable().optional(),
    documents: z.array(z.unknown()).max(200).optional(),
    completionTracking: z.array(z.unknown()).max(1000).optional(),
    status: z.string().trim().max(40).optional()
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });

export const antiRaggingAffidavitCreateSchema = z
  .object({
    studentId: text(1, 200),
    studentName: text(1, 200),
    program: text(1, 200),
    academicYear: text(1, 20),
    parentAffidavit: z.coerce.boolean().optional(),
    studentAffidavit: z.coerce.boolean().optional()
  })
  .strict();
