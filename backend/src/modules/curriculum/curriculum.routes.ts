/**
 * Curriculum & registration routes.
 *
 * Thin HTTP layer — parse, validate, call the service, format.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authorizeRoles } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { entityId, institutionalCode } from '../../schemas/common.js';
import * as service from './curriculum.service.js';

const router = Router();

function pathParam(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0]! : (value as string);
}

/** Curriculum is approved by academic authority, not by any staff member. */
const CURRICULUM_AUTHORITY = authorizeRoles(
  'super_admin', 'registrar', 'dean', 'hod', 'vice_chancellor', 'pro_vc'
);
/** Registration can be performed by academic staff on a student's behalf. */
const REGISTRATION_STAFF = authorizeRoles(
  'super_admin', 'registrar', 'dean', 'hod', 'faculty'
);

const idParam = z.object({ id: entityId });

// ─── Scheme authoring ─────────────────────────────────────────────────────────

const createSchemeSchema = z
  .object({
    programmeId: entityId,
    code: institutionalCode,
    name: z.string().trim().min(3).max(160),
    effectiveFromYear: z.number().int().min(1950).max(2100),
    effectiveToYear: z.number().int().min(1950).max(2100).optional(),
    totalCreditsRequired: z.number().int().min(1).max(400),
    minCreditsPerSemester: z.number().int().min(1).max(60).optional(),
    maxCreditsPerSemester: z.number().int().min(1).max(60).optional(),
    baskets: z
      .array(
        z
          .object({
            code: institutionalCode,
            name: z.string().trim().min(2).max(120),
            type: z.enum([
              'core', 'professional_elective', 'open_elective', 'mandatory',
              'ability_enhancement', 'project', 'internship'
            ]),
            creditsRequired: z.number().int().min(0).max(400),
            isElective: z.boolean().optional(),
            minCourses: z.number().int().min(0).max(50).optional(),
            maxCourses: z.number().int().min(0).max(50).optional()
          })
          .strict()
      )
      .min(1)
  })
  .strict();

router.post(
  '/schemes',
  CURRICULUM_AUTHORITY,
  validate({ body: createSchemeSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await service.createScheme(req.body) });
  })
);

router.get(
  '/schemes',
  validate({ query: z.object({ programmeId: entityId.optional() }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const { programmeId } = req.query as unknown as { programmeId?: string };
    res.json({ success: true, data: await service.listSchemes(programmeId) });
  })
);

const addCourseSchema = z
  .object({
    basketCode: institutionalCode,
    courseId: entityId,
    semester: z.number().int().min(1).max(12),
    credits: z.number().int().min(0).max(20),
    lectureHours: z.number().int().min(0).max(20).optional(),
    tutorialHours: z.number().int().min(0).max(20).optional(),
    practicalHours: z.number().int().min(0).max(20).optional(),
    prerequisiteCourseCodes: z.array(institutionalCode).max(10).optional()
  })
  .strict();

router.post(
  '/schemes/:id/courses',
  CURRICULUM_AUTHORITY,
  validate({ params: idParam, body: addCourseSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const schemeCourse = await service.addCourseToScheme({
      schemeId: pathParam(req, 'id'),
      ...req.body
    });
    res.status(201).json({ success: true, data: schemeCourse });
  })
);

router.post(
  '/schemes/:id/activate',
  CURRICULUM_AUTHORITY,
  validate({
    params: idParam,
    body: z.object({ approvingBody: z.string().trim().min(3).max(120) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const scheme = await service.activateScheme(pathParam(req, 'id'), req.body.approvingBody);
    res.json({ success: true, data: scheme });
  })
);

// ─── Registration ─────────────────────────────────────────────────────────────

const registrationBody = z
  .object({
    studentProfileId: entityId,
    schemeCourseIds: z.array(entityId).min(1).max(20)
  })
  .strict();

/**
 * Dry-run eligibility check.
 *
 * Lets a portal show what is blocking a student BEFORE they submit, instead of
 * surfacing a rejection after the fact.
 */
router.post(
  '/registration/check',
  validate({ body: registrationBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await service.checkRegistrationEligibility(
      req.body.studentProfileId,
      req.body.schemeCourseIds
    );
    res.json({ success: true, data: result });
  })
);

router.post(
  '/registration',
  REGISTRATION_STAFF,
  validate({ body: registrationBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await service.registerCourses(
      req.body.studentProfileId,
      req.body.schemeCourseIds
    );
    res.status(201).json({ success: true, data: result });
  })
);

// ─── Progress ─────────────────────────────────────────────────────────────────

router.get(
  '/students/:id/progress',
  validate({
    params: idParam,
    query: z.object({ schemeId: entityId })
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { schemeId } = req.query as unknown as { schemeId: string };
    const progress = await service.getDegreeProgress(pathParam(req, 'id'), schemeId);
    res.json({ success: true, data: progress });
  })
);

export default router;
