/**
 * Results routes (T-403).
 *
 * Thin HTTP layer: parse, validate, call the service, format. No business
 * logic, no Prisma — the pattern established by the admissions module.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authorizeRoles } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { entityId, academicYear, institutionalCode, isoDate } from '../../schemas/common.js';
import * as service from './results.service.js';

const router = Router();

function pathParam(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0]! : (value as string);
}

/** Who may define grading rules and publish results. */
const EXAM_AUTHORITY = authorizeRoles('super_admin', 'coe', 'registrar', 'vice_chancellor');
/** Who may enter marks. */
const MARKS_ENTRY = authorizeRoles('super_admin', 'coe', 'registrar', 'faculty', 'hod');

// ─── Grading scheme ───────────────────────────────────────────────────────────

const gradeBandSchema = z
  .object({
    letter: z.string().trim().min(1).max(4),
    point: z.number().min(0).max(10),
    minMarks: z.number().min(0).max(100),
    maxMarks: z.number().min(0).max(100),
    isPassing: z.boolean().optional(),
    isExcludedFromGpa: z.boolean().optional(),
    description: z.string().trim().max(120).optional()
  })
  .strict();

const createGradeScaleSchema = z
  .object({
    code: institutionalCode,
    name: z.string().trim().min(3).max(120),
    maxPoint: z.number().min(1).max(100).optional(),
    passingPoint: z.number().min(0).max(100).optional(),
    version: z.string().trim().max(10).optional(),
    effectiveFrom: isoDate,
    bands: z.array(gradeBandSchema).min(1)
  })
  .strict();

router.post(
  '/grade-scales',
  EXAM_AUTHORITY,
  validate({ body: createGradeScaleSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const scale = await service.createGradeScale(req.body);
    res.status(201).json({ success: true, data: scale });
  })
);

router.get(
  '/grade-scales',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, data: await service.listGradeScales() });
  })
);

// ─── Marks entry ──────────────────────────────────────────────────────────────

const recordResultSchema = z
  .object({
    studentProfileId: entityId,
    courseId: entityId,
    semester: z.number().int().min(1).max(12),
    academicYear,
    internalMarks: z.number().min(0).max(100).optional(),
    externalMarks: z.number().min(0).max(100).optional(),
    totalMarks: z.number().min(0).max(1000),
    maxMarks: z.number().min(1).max(1000).optional(),
    attempt: z.number().int().min(1).max(10).optional(),
    /** Required when amending a published result — enforced in the service. */
    reason: z.string().trim().max(500).optional()
  })
  .strict();

router.post(
  '/course-results',
  MARKS_ENTRY,
  validate({ body: recordResultSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await service.recordCourseResult(req.body);
    res.status(201).json({ success: true, data: result });
  })
);

// ─── Computation ──────────────────────────────────────────────────────────────

/**
 * Recompute a student's SGPA/CGPA from their recorded grades.
 *
 * CGPA is DERIVED here. `StudentProfile.cgpa` is a cache of this calculation —
 * it replaced a stored value that nothing computed and that the old code
 * fabricated as a literal 8.5.
 */
router.post(
  '/students/:id/recompute',
  MARKS_ENTRY,
  validate({ params: z.object({ id: entityId }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const summary = await service.recomputeStudentResults(pathParam(req, 'id'));
    res.json({ success: true, data: summary });
  })
);

router.get(
  '/students/:id/transcript',
  validate({ params: z.object({ id: entityId }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const transcript = await service.getStudentTranscript(pathParam(req, 'id'));
    res.json({ success: true, data: transcript });
  })
);

// ─── Publication ──────────────────────────────────────────────────────────────

const publishSchema = z
  .object({
    semester: z.number().int().min(1).max(12),
    academicYear
  })
  .strict();

router.post(
  '/publish',
  EXAM_AUTHORITY,
  validate({ body: publishSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await service.publishSemesterResults(req.body.semester, req.body.academicYear);
    res.json({ success: true, data: result });
  })
);

// ─── Audit view ───────────────────────────────────────────────────────────────

/**
 * Change history for one course result.
 *
 * The record that makes an academic result defensible: who changed it, from
 * what, to what, and why.
 */
router.get(
  '/course-results/:id/history',
  validate({ params: z.object({ id: entityId }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const history = await service.getGradeHistory(pathParam(req, 'id'));
    res.json({ success: true, data: history });
  })
);

export default router;
