/**
 * OBE attainment routes.
 *
 * Every attainment response carries its POLICY and its PROVENANCE, including an
 * explicit caveat that NBA prescribes no formula. A bare attainment number is
 * not defensible to an assessor; the derivation is the deliverable.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authorizeRoles } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { entityId, academicYear } from '../../schemas/common.js';
import { getTenantContext } from '../../lib/tenant.js';
import { unbounded } from '../../lib/tenantStore.js';
import * as service from './obe.service.js';

const router = Router();

function pathParam(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0]! : (value as string);
}

/** Who may define assessments and enter outcome-wise marks. */
const OBE_WRITE = authorizeRoles('super_admin', 'faculty', 'hod', 'coe', 'iqac_coordinator');
/** Who may publish — publishing changes accreditation-facing figures. */
const OBE_PUBLISH = authorizeRoles('super_admin', 'hod', 'coe', 'iqac_coordinator');

const ASSESSMENT_TYPES = ['CIE', 'SEE', 'ASSIGNMENT', 'LAB', 'PROJECT', 'SEMINAR', 'VIVA'] as const;

/** The institution's policy — every threshold behind every figure. */
router.get(
  '/policy',
  asyncHandler(async (req: Request, res: Response) => {
    const policy = await service.getPolicy(getTenantContext(req));
    res.json({
      success: true,
      data: {
        policy,
        note:
          'These thresholds are INSTITUTIONAL POLICY, not a standard. NBA prescribes no attainment formula; ' +
          'these values must match the institution\'s published OBE manual.'
      }
    });
  })
);

const createAssessmentSchema = z
  .object({
    schemeCourseId: entityId,
    academicYear,
    name: z.string().trim().min(1).max(160),
    type: z.enum(ASSESSMENT_TYPES),
    maxMarks: z.number().positive().max(1000),
    weightPercent: z.number().min(0).max(100).optional(),
    conductedOn: z.coerce.date().optional(),
    sectionId: entityId.optional(),
    outcomes: z
      .array(
        z
          .object({
            courseOutcomeId: entityId,
            maxMarks: z.number().positive().max(1000)
          })
          .strict()
      )
      .min(1, 'An assessment must map at least one course outcome')
      .max(30)
  })
  .strict();

router.post(
  '/assessments',
  OBE_WRITE,
  validate({ body: createAssessmentSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof createAssessmentSchema>;

    const created = await service.createAssessment(getTenantContext(req), {
      schemeCourseId: body.schemeCourseId,
      academicYear: body.academicYear,
      name: body.name,
      type: body.type,
      maxMarks: body.maxMarks,
      weightPercent: body.weightPercent,
      conductedOn: body.conductedOn,
      sectionId: body.sectionId,
      outcomes: body.outcomes
    });

    res.status(201).json({
      success: true,
      message: `Created "${created.name}" (${created.maxMarks} marks) across ${created.outcomes} outcome(s).`,
      data: created
    });
  })
);

const marksSchema = z
  .object({
    entries: z
      .array(
        z
          .object({
            studentProfileId: entityId,
            courseOutcomeId: entityId,
            marksObtained: z.number().min(0).max(1000),
            isAbsent: z.boolean().optional()
          })
          .strict()
      )
      .min(1)
      .max(5000)
  })
  .strict();

/** Record outcome-wise marks. Upserted, so a correction replaces rather than adds. */
router.post(
  '/assessments/:assessmentId/marks',
  OBE_WRITE,
  validate({ params: z.object({ assessmentId: entityId }), body: marksSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof marksSchema>;

    const result = await service.recordMarks(
      getTenantContext(req),
      pathParam(req, 'assessmentId'),
      body.entries
    );

    res.json({
      success: true,
      message: `Recorded ${result.recorded} outcome-wise mark(s) for "${result.assessment}".`,
      data: result
    });
  })
);

router.post(
  '/assessments/:assessmentId/publish',
  OBE_PUBLISH,
  validate({ params: z.object({ assessmentId: entityId }), body: z.object({}).strict() }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await service.publishAssessment(
      getTenantContext(req),
      pathParam(req, 'assessmentId')
    );

    res.json({
      success: true,
      message: `"${result.name}" published — its ${result.marksRecorded} mark(s) now contribute to attainment.`,
      data: result
    });
  })
);

/** Indirect (survey) attainment. */
const indirectSchema = z
  .object({
    courseOutcomeId: entityId,
    academicYear,
    source: z.string().trim().min(3).max(120),
    level: z.number().min(0).max(10),
    respondents: z.number().int().min(0).max(100000)
  })
  .strict();

router.post(
  '/indirect',
  OBE_WRITE,
  validate({ body: indirectSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof indirectSchema>;
    const result = await service.recordIndirectAttainment(getTenantContext(req), body);

    res.status(201).json({
      success: true,
      message: `Recorded indirect attainment ${result.level} from "${result.source}".`,
      data: result
    });
  })
);

/** CO attainment for one course. */
router.get(
  '/attainment/course/:schemeCourseId',
  validate({
    params: z.object({ schemeCourseId: entityId }),
    query: z.object({ academicYear })
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as { academicYear: string };

    // Attainment divides by the number of marks it reads, so the
    // unpaginated-read cap must not apply: a capped input yields a
    // percentage that is wrong and indistinguishable from right. Bounded
    // instead by the course/scheme this request names.
    const report = await unbounded('CO attainment reads every mark in the course', () =>
      service.courseAttainment(
        getTenantContext(req),
        pathParam(req, 'schemeCourseId'),
        query.academicYear
      )
    );

    res.json({ success: true, data: report });
  })
);

/** PO/PSO attainment for a whole curriculum scheme. */
router.get(
  '/attainment/programme/:schemeId',
  validate({
    params: z.object({ schemeId: entityId }),
    query: z.object({ academicYear })
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as { academicYear: string };

    // Attainment divides by the number of marks it reads, so the
    // unpaginated-read cap must not apply: a capped input yields a
    // percentage that is wrong and indistinguishable from right. Bounded
    // instead by the course/scheme this request names.
    const report = await unbounded('PO attainment reads every course in the scheme', () =>
      service.programmeAttainment(
        getTenantContext(req),
        pathParam(req, 'schemeId'),
        query.academicYear
      )
    );

    res.json({ success: true, data: report });
  })
);

export default router;
