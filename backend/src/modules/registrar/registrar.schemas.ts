/**
 * Registrar validation (Phase 3b).
 *
 * What is ABSENT from `updateStudentRecordSchema` is the point of the file.
 *
 * `cgpa`, `totalCredits` and `earnedCredits` are derived from published results.
 * They are not editable through this route at any privilege level: correcting a
 * result belongs in the results flow, which recomputes them and writes a grade
 * history. Editing the summary directly would leave it disagreeing with the
 * results it summarises, and nothing would say which was right.
 *
 * `rollNumber` and `admissionYear` are identity. They appear on issued
 * certificates and transcripts, so changing one is a deliberate act with
 * downstream consequences rather than a field edit.
 *
 * `institutionId`, `programmeId`, `batchId`, `sectionId` and `campusId` place a
 * student in the hierarchy. Moving them is a transfer, which has its own flow.
 */

import { z } from 'zod';

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const isoDate = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'must be a valid date');

export const updateStudentRecordSchema = z
  .object({
    // Every amendment to the register needs a stated reason. It is the only part
    // of the audit entry a later reader cannot reconstruct from the data.
    reason: text(10, 500),

    name: text(2, 160).optional(),
    email: z.string().trim().email().max(200).optional(),

    program: text(2, 160).optional(),
    branch: text(2, 160).optional(),
    section: text(1, 20).optional(),
    batch: text(2, 40).optional(),
    // A semester change decides exam eligibility and fee liability, so it is
    // permitted but audited with before and after.
    semester: z.coerce.number().int().min(1).max(12).optional(),

    gender: z.string().trim().max(30).nullable().optional(),
    category: z.string().trim().max(40).nullable().optional(),
    domicileState: z.string().trim().max(80).nullable().optional(),
    nationality: z.string().trim().max(60).nullable().optional(),
    isDifferentlyAbled: z.boolean().optional(),
    isHosteller: z.boolean().optional()
  })
  .strict()
  .refine((v) => Object.keys(v).length > 1, {
    message: 'No fields to update.'
  });

/**
 * Deciding a certificate, verification, record change, promotion or retirement.
 *
 * The five share a shape, so they share a schema. `status` is an enum rather
 * than a free string: these rows drive documents that third parties act on, and
 * a status nobody recognises leaves a request in a state no screen can clear.
 */
export const decideRequestSchema = z
  .object({
    status: z.enum(['pending', 'approved', 'rejected', 'issued', 'completed', 'cancelled']),
    note: z.string().trim().max(1000).optional()
  })
  .strict();

/**
 * PUT /verifications/:id.
 *
 * NOT decideRequestSchema, even though verificationRequest is one of the
 * five models that helper covers. An employer or another university
 * verification request has its own real lifecycle — RegistrarQueries.tsx
 * has always sent `pending -> processing -> responded`, matching the
 * `response`/`respondedAt` columns VerificationRequest has carried since
 * migration 0034 — and none of those three values is in the generic
 * approval enum above. Forcing this route onto the shared schema would
 * mean either rejecting every request this screen has ever sent, or
 * stretching `approved`/`completed` to mean something they don't for the
 * other four models that schema serves.
 */
export const verificationDecisionSchema = z
  .object({
    status: z.enum(['pending', 'processing', 'responded', 'rejected']),
    response: z.string().trim().max(2000).optional()
  })
  .strict();

/** PUT /workflow-files/:id. Status set already matched what the handler enforced by hand. */
export const workflowFileDecisionSchema = z
  .object({
    status: z.enum(['pending', 'approved', 'rejected', 'forwarded', 'published']).optional(),
    remarks: z.string().trim().max(1000).optional()
  })
  .strict();

/**
 * POST /registrar/documents.
 *
 * `category` takes the real seven values from RegistrarDocuments.tsx's own
 * label map. `filePath`/`fileName` are optional even though the frontend
 * schema-shape suggests they're always sent: `uploadApi()`'s response
 * (POST /uploads) doesn't actually carry a `storagePath` or `fileName`
 * field, so in practice the caller sends `undefined` for both today — a
 * separate, lower-severity mismatch than the two live-breaking ones this
 * pass already fixed, left as a follow-up rather than pulled into this one.
 */
export const registrarDocumentCreateSchema = z
  .object({
    title: text(1, 300),
    category: z.enum([
      'government_order',
      'ugc_communication',
      'circular',
      'minutes',
      'policy',
      'notification',
      'audit_report'
    ]),
    tags: z.array(z.string().trim().max(60)).max(30).optional(),
    isConfidential: z.boolean().optional(),
    accessRoles: z.array(z.string().trim().max(60)).max(30).optional(),
    filePath: z.string().trim().max(1000).optional(),
    fileUrl: z.string().trim().max(1000).optional(),
    fileName: z.string().trim().max(300).optional(),
    mimeType: z.string().trim().max(200).optional(),
    fileSize: z.string().trim().max(40).optional()
  })
  .strict();

/**
 * POST /hr/vacancies.
 *
 * `status` takes the same corrected seven-value pipeline as
 * updateVacancySchema (entityUpdate.schemas.ts) — both schemas now agree
 * with RegistrarHR.tsx, which is the point.
 */
export const vacancyCreateSchema = z
  .object({
    position: text(2, 160),
    department: text(2, 160),
    type: z.enum(['teaching', 'non_teaching']),
    sanctioned: z.coerce.number().int().min(0).max(10000).optional(),
    filled: z.coerce.number().int().min(0).max(10000).optional(),
    status: z.enum([
      'advertised',
      'applications_received',
      'shortlisted',
      'interview_scheduled',
      'selected',
      'joined',
      'closed'
    ]).optional(),
    postedAt: isoDate.optional(),
    lastDate: isoDate.optional(),
    applicants: z.coerce.number().int().min(0).max(1000000).optional()
  })
  .strict();

/** POST /hr/promotions/forward. */
export const promotionForwardSchema = z
  .object({
    name: text(2, 160),
    fromDesignation: text(2, 120),
    toDesignation: text(2, 120),
    department: text(2, 160),
    years: z.coerce.number().min(0).max(60).optional()
  })
  .strict();
