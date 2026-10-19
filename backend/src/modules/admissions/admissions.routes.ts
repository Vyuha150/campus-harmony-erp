/**
 * Admissions routes.
 *
 * Reference implementation of the target architecture (T-203):
 *
 *   route  → parse & validate, call service, format response   (this file)
 *   service→ business rules, transactions, audit                (*.service.ts)
 *   schema → request contracts                                  (*.schema.ts)
 *
 * Handlers here contain NO business logic and NO Prisma calls. Compare with
 * `hod.ts` (1,882 lines of mixed HTTP, rules and data access) to see what this
 * pattern is replacing.
 *
 * Errors are thrown by the service and handled centrally — no `try/catch`
 * swallowing, no `res.status(500).json({ message: error.message })`.
 */

import { Router, type Request, type Response } from 'express';
import { authorizeRoles } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import * as service from './admissions.service.js';
import {
  createCycleSchema,
  submitApplicationSchema,
  verifyApplicationSchema,
  makeOfferSchema,
  declineOfferSchema,
  confirmAdmissionSchema,
  idParamSchema,
  listApplicationsQuery,
  listCyclesQuery
} from './admissions.schema.js';

const router = Router();

/**
 * Read a path parameter as a string.
 *
 * Express 5 types params as `string | string[]` because a route pattern can
 * repeat a name. Our params are validated by `idParamSchema` before reaching a
 * handler, so this narrows the type in one place instead of casting at each
 * call site.
 */
function pathParam(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0]! : (value as string);
}

/** Roles permitted to administer admissions. */
const ADMISSIONS_STAFF = authorizeRoles(
  'super_admin',
  'registrar',
  'principal',
  'dean',
  'vice_chancellor',
  'pro_vc'
);

// ─── Cycles ───────────────────────────────────────────────────────────────────

router.post(
  '/cycles',
  ADMISSIONS_STAFF,
  validate({ body: createCycleSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const cycle = await service.createCycle(req.body);
    res.status(201).json({ success: true, data: cycle });
  })
);

router.get(
  '/cycles',
  validate({ query: listCyclesQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, pageSize, status } = req.query as unknown as {
      page: number;
      pageSize: number;
      status?: string;
    };
    const result = await service.listCycles({ page, pageSize }, status);
    res.json({ success: true, ...result });
  })
);

router.post(
  '/cycles/:id/open',
  ADMISSIONS_STAFF,
  validate({ params: idParamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const cycle = await service.openCycle(pathParam(req, 'id'));
    res.json({ success: true, data: cycle });
  })
);

router.get(
  '/cycles/:id/statistics',
  validate({ params: idParamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    // Seat utilisation for NAAC Criterion 2 — DERIVED from operational records,
    // not manually entered.
    const stats = await service.getCycleStatistics(pathParam(req, 'id'));
    res.json({ success: true, data: stats });
  })
);

router.post(
  '/cycles/:id/merit-list',
  ADMISSIONS_STAFF,
  validate({ params: idParamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await service.generateMeritList(pathParam(req, 'id'));
    res.json({ success: true, data: result });
  })
);

router.get(
  '/cycles/:id/applications',
  validate({ params: idParamSchema, query: listApplicationsQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, pageSize, status, category } = req.query as unknown as {
      page: number;
      pageSize: number;
      status?: string;
      category?: string;
    };
    const result = await service.listApplications(
      pathParam(req, 'id'),
      { page, pageSize },
      { status, category }
    );
    res.json({ success: true, ...result });
  })
);

/** Programmes an admission cycle can be opened for. */
router.get(
  '/programmes',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, data: await service.listProgrammes() });
  })
);

/** One cycle on one screen: seats, applications and their latest offers. */
router.get(
  '/cycles/:id/board',
  ADMISSIONS_STAFF,
  validate({ params: idParamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await service.cycleBoard(pathParam(req, 'id')) });
  })
);

// ─── Applications ─────────────────────────────────────────────────────────────

router.post(
  '/applications',
  ADMISSIONS_STAFF,
  validate({ body: submitApplicationSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const application = await service.submitApplication(req.body);
    res.status(201).json({ success: true, data: application });
  })
);

router.post(
  '/applications/:id/verify',
  ADMISSIONS_STAFF,
  validate({ params: idParamSchema, body: verifyApplicationSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const application = await service.verifyApplication(pathParam(req, 'id'), req.body);
    res.json({ success: true, data: application });
  })
);

// ─── Offers ───────────────────────────────────────────────────────────────────

router.post(
  '/applications/:id/offer',
  ADMISSIONS_STAFF,
  validate({ params: idParamSchema, body: makeOfferSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const offer = await service.makeOffer(pathParam(req, 'id'), req.body);
    res.status(201).json({ success: true, data: offer });
  })
);

router.post(
  '/offers/:id/decline',
  ADMISSIONS_STAFF,
  validate({ params: idParamSchema, body: declineOfferSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await service.declineOffer(pathParam(req, 'id'), req.body.reason);
    res.json({ success: true, data: result });
  })
);

/**
 * Confirm admission — creates the student record.
 *
 * The temporary password is returned ONCE for out-of-band delivery and is never
 * stored in plaintext or retrievable again.
 */
router.post(
  '/offers/:id/confirm',
  ADMISSIONS_STAFF,
  validate({ params: idParamSchema, body: confirmAdmissionSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await service.confirmAdmission(pathParam(req, 'id'), req.body);
    res.status(201).json({
      success: true,
      data: {
        applicationNumber: result.applicationNumber,
        rollNumber: result.rollNumber,
        userId: result.userId,
        studentProfileId: result.studentProfileId
      },
      temporaryPassword: result.temporaryPassword,
      message:
        'Student record created. Deliver the temporary password out of band; it cannot be retrieved again.'
    });
  })
);

export default router;
