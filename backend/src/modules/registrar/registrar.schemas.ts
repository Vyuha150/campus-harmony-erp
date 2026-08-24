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
