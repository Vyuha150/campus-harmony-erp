/**
 * Admissions request schemas.
 *
 * `.strict()` everywhere: unknown keys are REJECTED, not ignored. That is the
 * mass-assignment defence — the earlier `PUT /admin/users` fix needed a
 * hand-written whitelist precisely because `req.body` was spread into Prisma.
 */

import { z } from 'zod';
import {
  entityId,
  personName,
  email,
  indianPhone,
  institutionalCode,
  academicYear,
  reservationCategory,
  gender,
  isoDate,
  amount,
  pageQuery
} from '../../schemas/common.js';

const percentage = z
  .number()
  .min(0, 'Percentage cannot be negative.')
  .max(100, 'Percentage cannot exceed 100.');

export const createCycleSchema = z
  .object({
    programmeId: entityId,
    campusId: entityId.optional(),
    academicYear,
    name: z.string().trim().min(3).max(160),
    code: institutionalCode,
    applicationStartsAt: isoDate,
    applicationEndsAt: isoDate,
    totalSeats: z.number().int().min(1).max(10_000),
    applicationFee: amount.optional(),
    minimumQualifyingPercentage: percentage.optional(),
    entranceExamName: z.string().trim().max(120).optional(),
    seatMatrix: z
      .array(
        z
          .object({
            category: reservationCategory,
            totalSeats: z.number().int().min(0).max(10_000)
          })
          .strict()
      )
      .min(1, 'At least one seat category is required.')
  })
  .strict();

export const submitApplicationSchema = z
  .object({
    cycleId: entityId,
    fullName: personName,
    email,
    phone: indianPhone,
    dateOfBirth: isoDate,
    category: reservationCategory.default('GENERAL'),
    gender: gender.optional(),
    domicileState: z.string().trim().max(60).optional(),
    guardianName: personName.optional(),
    guardianPhone: indianPhone.optional(),
    previousQualification: z.string().trim().max(120).optional(),
    previousBoard: z.string().trim().max(120).optional(),
    previousPercentage: percentage.optional(),
    previousYearOfPassing: z
      .number()
      .int()
      .min(1950)
      .max(new Date().getFullYear() + 1)
      .optional(),
    entranceExamRollNumber: z.string().trim().max(40).optional(),
    entranceExamScore: z.number().min(0).max(1000).optional(),
    entranceExamRank: z.number().int().min(1).optional(),
    isDifferentlyAbled: z.boolean().optional()
  })
  .strict();

export const verifyApplicationSchema = z
  .object({
    eligible: z.boolean(),
    remark: z.string().trim().max(500).optional()
  })
  .strict();

export const makeOfferSchema = z
  .object({
    validForDays: z.number().int().min(1).max(90).optional(),
    admissionFeeAmount: amount.optional()
  })
  .strict();

export const declineOfferSchema = z
  .object({
    reason: z.string().trim().max(500).optional()
  })
  .strict();

export const confirmAdmissionSchema = z
  .object({
    admissionFeeAmount: amount.optional(),
    feeDueInDays: z.number().int().min(1).max(365).optional()
  })
  .strict();

export const idParamSchema = z.object({ id: entityId });

export const listApplicationsQuery = pageQuery.extend({
  status: z.string().trim().max(40).optional(),
  category: reservationCategory.optional()
});

export const listCyclesQuery = pageQuery.extend({
  status: z.string().trim().max(40).optional()
});
