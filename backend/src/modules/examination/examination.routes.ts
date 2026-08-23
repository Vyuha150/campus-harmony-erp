/**
 * Examination routes. Thin HTTP layer over the service.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authorizeRoles } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { entityId, institutionalCode, academicYear, isoDate } from '../../schemas/common.js';
import * as service from './examination.service.js';
import * as marks from './marks.service.js';

const router = Router();

function pathParam(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0]! : (value as string);
}

/** Exam operations belong to the Controller of Examinations' office. */
const EXAM_OFFICE = authorizeRoles('super_admin', 'coe', 'registrar', 'vice_chancellor');
/** Condonation is a discretionary academic override — deliberately narrower. */
const CONDONATION_AUTHORITY = authorizeRoles('super_admin', 'coe', 'vice_chancellor', 'pro_vc');

const idParam = z.object({ id: entityId });
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM.');

// ─── Sessions ─────────────────────────────────────────────────────────────────

router.post(
  '/sessions',
  EXAM_OFFICE,
  validate({
    body: z
      .object({
        code: institutionalCode,
        name: z.string().trim().min(3).max(160),
        type: z.enum([
          'internal', 'mid_semester', 'end_semester',
          'supplementary', 'revaluation', 'special'
        ]),
        academicYear,
        semester: z.number().int().min(1).max(12),
        registrationStartsAt: isoDate,
        registrationEndsAt: isoDate,
        examStartsAt: isoDate,
        examEndsAt: isoDate,
        minAttendancePercentage: z.number().min(0).max(100).optional(),
        requireFeeClearance: z.boolean().optional()
      })
      .strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await service.createSession(req.body) });
  })
);

router.post(
  '/sessions/:id/schedules',
  EXAM_OFFICE,
  validate({
    params: idParam,
    body: z
      .object({
        courseId: entityId,
        examDate: isoDate,
        startTime: timeString,
        endTime: timeString,
        venue: z.string().trim().max(120).optional(),
        maxMarks: z.number().int().min(1).max(1000).optional()
      })
      .strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const schedule = await service.addSchedule({ sessionId: pathParam(req, 'id'), ...req.body });
    res.status(201).json({ success: true, data: schedule });
  })
);

router.post(
  '/sessions/:id/open-registration',
  EXAM_OFFICE,
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await service.openRegistration(pathParam(req, 'id')) });
  })
);

router.get(
  '/sessions/:id/statistics',
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await service.getSessionStatistics(pathParam(req, 'id')) });
  })
);

// ─── Eligibility & registration ───────────────────────────────────────────────

/**
 * Dry-run eligibility check.
 *
 * Lets a student see what is blocking them BEFORE the registration window
 * closes, rather than discovering it at refusal.
 */
router.get(
  '/sessions/:id/eligibility/:studentId',
  validate({ params: z.object({ id: entityId, studentId: entityId }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const results = await service.checkEligibility(
      pathParam(req, 'id'),
      pathParam(req, 'studentId')
    );
    res.json({ success: true, data: results });
  })
);

router.post(
  '/sessions/:id/register',
  EXAM_OFFICE,
  validate({
    params: idParam,
    body: z.object({ studentProfileId: entityId }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await service.registerStudent(pathParam(req, 'id'), req.body.studentProfileId);
    res.status(201).json({ success: true, data: result });
  })
);

router.post(
  '/registrations/:id/condone',
  CONDONATION_AUTHORITY,
  validate({
    params: idParam,
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await service.condoneShortfall(pathParam(req, 'id'), req.body.reason);
    res.json({ success: true, data: result });
  })
);

// ─── Hall tickets ─────────────────────────────────────────────────────────────

router.post(
  '/sessions/:id/hall-ticket',
  EXAM_OFFICE,
  validate({
    params: idParam,
    body: z.object({ studentProfileId: entityId }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const ticket = await service.issueHallTicket(pathParam(req, 'id'), req.body.studentProfileId);
    res.status(201).json({ success: true, data: ticket });
  })
);

// ─── Marks, moderation, revaluation ───────────────────────────────────────────

/** Faculty enter marks; the exam office moderates and publishes. */
const MARKS_ENTRY = authorizeRoles('super_admin', 'coe', 'faculty', 'hod');
const MODERATION_AUTHORITY = authorizeRoles('super_admin', 'coe', 'vice_chancellor');

router.post(
  '/schedules/:id/marks',
  MARKS_ENTRY,
  validate({
    params: idParam,
    body: z
      .object({
        studentProfileId: entityId,
        internalMarks: z.number().min(0).max(1000).optional(),
        externalMarks: z.number().min(0).max(1000).optional(),
        totalMarks: z.number().min(0).max(1000),
        isAbsent: z.boolean().optional()
      })
      .strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await marks.enterExamMarks({ scheduleId: pathParam(req, 'id'), ...req.body });
    res.status(201).json({ success: true, data: result });
  })
);

router.post(
  '/course-results/:id/moderate',
  MODERATION_AUTHORITY,
  validate({
    params: idParam,
    body: z
      .object({
        revisedMarks: z.number().min(0).max(1000).optional(),
        reason: z.string().trim().min(10).max(500)
      })
      .strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await marks.moderateResult(pathParam(req, 'id'), req.body);
    res.json({ success: true, data: result });
  })
);

router.post(
  '/sessions/:id/publish',
  MODERATION_AUTHORITY,
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await marks.publishSessionResults(pathParam(req, 'id')) });
  })
);

router.post(
  '/revaluations',
  authorizeRoles('super_admin', 'coe', 'registrar'),
  validate({
    body: z
      .object({
        courseResultId: entityId,
        type: z.enum(['recheck', 'revaluation', 'answer_script_copy']).optional(),
        reason: z.string().trim().max(500).optional(),
        fee: z.number().min(0).max(100000).optional()
      })
      .strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await marks.requestRevaluation(req.body) });
  })
);

router.post(
  '/revaluations/:id/complete',
  MODERATION_AUTHORITY,
  validate({
    params: idParam,
    body: z
      .object({
        revisedMarks: z.number().min(0).max(1000),
        remarks: z.string().trim().max(500).optional()
      })
      .strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await marks.completeRevaluation(pathParam(req, 'id'), req.body);
    res.json({ success: true, data: result });
  })
);

export default router;
