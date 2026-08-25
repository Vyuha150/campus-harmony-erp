import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { sendError } from '../lib/errors.js';
import { z } from 'zod';
import { getTenantContext } from '../lib/tenant.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { entityId } from '../schemas/common.js';
import { updateTenantEntity } from '../modules/common/entityUpdate.service.js';
import {
  updateAthleteSchema,
  updateTeamSchema,
  updateAttendanceSchema,
  updateFacilitySchema,
  updateInventorySchema,
  sportsEventUpdateSchema,
  fitnessRecordUpdateSchema
} from '../modules/common/entityUpdate.schemas.js';
import {
  createAthleteSchema,
  createAttendanceSchema,
  createInventorySchema,
  createTeamSchema
} from '../modules/common/entityCreate.schemas.js';
import { deleteTenantEntity } from '../modules/common/entityDelete.service.js';
import {
  fitnessRecordCreateSchema,
  sportsEventCreateSchema
} from '../modules/common/legacyWrite.schemas.js';

const router = Router();

// ─── Dashboard ───
router.get('/dashboard', authenticate, async (req: Request, res: Response) => {
  try {
    const teamsCount = await prisma.sportsTeam.count();
    const facilitiesCount = await prisma.sportsFacility.count({ where: { status: 'available' } });
    const athleteCount = await prisma.sportsAthlete.count({ where: { status: 'active' } });
    const upcomingEvents = await prisma.sportsEvent.count({ where: { status: { in: ['planning', 'upcoming'] } } });

    res.json({
      success: true,
      data: {
        stats: [
          { label: "Active Teams", value: teamsCount.toString(), icon: "Users" },
          { label: "Available Facilities", value: facilitiesCount.toString(), icon: "Map", color: "text-blue-500" },
          { label: "Registered Athletes", value: athleteCount.toString(), icon: "Trophy", color: "text-success" },
          { label: "Upcoming Events", value: upcomingEvents.toString(), icon: "Calendar", color: "text-warning" }
        ]
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Athletes ───
router.get('/athletes', authenticate, async (req: Request, res: Response) => {
  try {
    const athletes = await prisma.sportsAthlete.findMany();
    res.json({ success: true, data: athletes });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post(
  '/athletes',
  authenticate,
  validate({ body: createAthleteSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    // Was `data: req.body`. `tsc` could not see that — req.body is `any` —
    // so it compiled cleanly while accepting every column. The tenant key is
    // injected by the Prisma extension and is NOT read from the body.
    const body = req.body as z.infer<typeof createAthleteSchema>;
    const record = await prisma.sportsAthlete.create({
      data: {
        ...body,
      } as any
    });

    res.status(201).json({ success: true, data: record });
  })
);

router.put(
  '/athletes/:id',
  authenticate,
  validate({ params: z.object({ id: entityId }), body: updateAthleteSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await updateTenantEntity(getTenantContext(req), {
      model: 'sportsAthlete',
      entity: 'SportsAthlete',
      module: 'sports',
      id: String(req.params.id),
      data: req.body as Record<string, unknown>
    });

    res.json({ success: true, data: updated });
  })
);

/**
 * Was `prisma.sportsAthlete.delete({ where: { id } })` with nothing recorded.
 * Now audited, with the row captured before it goes and a reason required.
 */
router.delete(
  '/athletes/:id',
  authenticate,
  validate({
    params: z.object({ id: entityId }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await deleteTenantEntity(getTenantContext(req), {
      model: 'sportsAthlete',
      entity: 'SportsAthlete',
      module: 'sports',
      id: String(req.params.id),
      reason: String(req.body.reason)
    });

    res.json({ success: true, data: result });
  })
);

// ─── Teams ───
router.get('/teams', authenticate, async (req: Request, res: Response) => {
  try {
    const teams = await prisma.sportsTeam.findMany();
    res.json({ success: true, data: teams });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post(
  '/teams',
  authenticate,
  validate({ body: createTeamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    // Was `data: req.body`. `tsc` could not see that — req.body is `any` —
    // so it compiled cleanly while accepting every column. The tenant key is
    // injected by the Prisma extension and is NOT read from the body.
    const body = req.body as z.infer<typeof createTeamSchema>;
    const record = await prisma.sportsTeam.create({
      data: {
        ...body,
      } as any
    });

    res.status(201).json({ success: true, data: record });
  })
);

router.put(
  '/teams/:id',
  authenticate,
  validate({ params: z.object({ id: entityId }), body: updateTeamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await updateTenantEntity(getTenantContext(req), {
      model: 'sportsTeam',
      entity: 'SportsTeam',
      module: 'sports',
      id: String(req.params.id),
      data: req.body as Record<string, unknown>
    });

    res.json({ success: true, data: updated });
  })
);

/**
 * Was `prisma.sportsTeam.delete({ where: { id } })` with nothing recorded.
 * Now audited, with the row captured before it goes and a reason required.
 */
router.delete(
  '/teams/:id',
  authenticate,
  validate({
    params: z.object({ id: entityId }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await deleteTenantEntity(getTenantContext(req), {
      model: 'sportsTeam',
      entity: 'SportsTeam',
      module: 'sports',
      id: String(req.params.id),
      blockers: [
        { model: 'sportsAttendance', foreignKey: 'teamId', describe: 'attendance records' }
      ],
      reason: String(req.body.reason)
    });

    res.json({ success: true, data: result });
  })
);

// ─── Attendance ───
router.get('/attendance', authenticate, async (req: Request, res: Response) => {
  try {
    const query = req.query as Record<string, string | undefined>;
    const { teamId } = query;
    const where: any = {};
    if (teamId) where.teamId = teamId;
    const records = await prisma.sportsAttendance.findMany({ where, orderBy: { date: 'desc' }, take: 50 });
    res.json({ success: true, data: records });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post(
  '/attendance',
  authenticate,
  validate({ body: createAttendanceSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    // Was `data: req.body`. `tsc` could not see that — req.body is `any` —
    // so it compiled cleanly while accepting every column. The tenant key is
    // injected by the Prisma extension and is NOT read from the body.
    const body = req.body as z.infer<typeof createAttendanceSchema>;
    const record = await prisma.sportsAttendance.create({
      data: {
        ...body,
      } as any
    });

    res.status(201).json({ success: true, data: record });
  })
);

router.put(
  '/attendance/:id',
  authenticate,
  validate({ params: z.object({ id: entityId }), body: updateAttendanceSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await updateTenantEntity(getTenantContext(req), {
      model: 'sportsAttendance',
      entity: 'SportsAttendance',
      module: 'sports',
      id: String(req.params.id),
      data: req.body as Record<string, unknown>
    });

    res.json({ success: true, data: updated });
  })
);

/**
 * Was `prisma.sportsAttendance.delete({ where: { id } })` with nothing recorded.
 * Now audited, with the row captured before it goes and a reason required.
 */
router.delete(
  '/attendance/:id',
  authenticate,
  validate({
    params: z.object({ id: entityId }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await deleteTenantEntity(getTenantContext(req), {
      model: 'sportsAttendance',
      entity: 'SportsAttendance',
      module: 'sports',
      id: String(req.params.id),
      reason: String(req.body.reason)
    });

    res.json({ success: true, data: result });
  })
);

// ─── Facilities ───
router.get('/facilities', authenticate, async (req: Request, res: Response) => {
  try {
    const facilities = await prisma.sportsFacility.findMany();
    res.json({ success: true, data: facilities });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/facilities/:id/book', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await prisma.sportsFacility.update({ where: { id }, data: { status: 'booked' } });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put(
  '/facilities/:id',
  authenticate,
  validate({ params: z.object({ id: entityId }), body: updateFacilitySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await updateTenantEntity(getTenantContext(req), {
      model: 'sportsFacility',
      entity: 'SportsFacility',
      module: 'sports',
      id: String(req.params.id),
      data: req.body as Record<string, unknown>
    });

    res.json({ success: true, data: updated });
  })
);

/**
 * Was `prisma.sportsFacility.delete({ where: { id } })` with nothing recorded.
 * Now audited, with the row captured before it goes and a reason required.
 */
router.delete(
  '/facilities/:id',
  authenticate,
  validate({
    params: z.object({ id: entityId }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await deleteTenantEntity(getTenantContext(req), {
      model: 'sportsFacility',
      entity: 'SportsFacility',
      module: 'sports',
      id: String(req.params.id),
      reason: String(req.body.reason)
    });

    res.json({ success: true, data: result });
  })
);

// ─── Inventory ───
router.get('/inventory', authenticate, async (req: Request, res: Response) => {
  try {
    const items = await prisma.sportsInventoryItem.findMany();
    res.json({ success: true, data: items });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post(
  '/inventory',
  authenticate,
  validate({ body: createInventorySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    // Was `data: req.body`. `tsc` could not see that — req.body is `any` —
    // so it compiled cleanly while accepting every column. The tenant key is
    // injected by the Prisma extension and is NOT read from the body.
    const body = req.body as z.infer<typeof createInventorySchema>;

    // totalValue is DERIVED from quantity x unitPrice.
    const totalValue = Number((body.quantity * body.unitPrice).toFixed(2));
    const record = await prisma.sportsInventoryItem.create({
      data: {
        ...body,
        totalValue,
        availableQuantity: body.availableQuantity ?? body.quantity,
      } as any
    });

    res.status(201).json({ success: true, data: record });
  })
);

router.put(
  '/inventory/:id',
  authenticate,
  validate({ params: z.object({ id: entityId }), body: updateInventorySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    // `totalValue` is derived (quantity x unitPrice) and is NOT accepted from the
    // client. Recomputed here from whichever operand changed, so the stored total
    // can never contradict its own operands.
    const patch: Record<string, unknown> = { ...req.body };
    if (patch.quantity !== undefined || patch.unitPrice !== undefined) {
      const current = await prisma.sportsInventoryItem.findFirst({
        where: { id: String(req.params.id), institutionId: getTenantContext(req).institutionId }
      });
      if (current) {
        const qty = patch.quantity !== undefined ? Number(patch.quantity) : current.quantity;
        const price = patch.unitPrice !== undefined ? Number(patch.unitPrice) : current.unitPrice;
        patch.totalValue = Number((qty * price).toFixed(2));
      }
    }

    const updated = await updateTenantEntity(getTenantContext(req), {
      model: 'sportsInventoryItem',
      entity: 'SportsInventoryItem',
      module: 'sports',
      id: String(req.params.id),
      data: patch as Record<string, unknown>
    });

    res.json({ success: true, data: updated });
  })
);

/**
 * Was `prisma.sportsInventoryItem.delete({ where: { id } })` with nothing recorded.
 * Now audited, with the row captured before it goes and a reason required.
 */
router.delete(
  '/inventory/:id',
  authenticate,
  validate({
    params: z.object({ id: entityId }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await deleteTenantEntity(getTenantContext(req), {
      model: 'sportsInventoryItem',
      entity: 'SportsInventoryItem',
      module: 'sports',
      id: String(req.params.id),
      reason: String(req.body.reason)
    });

    res.json({ success: true, data: result });
  })
);

// ─── Events ───
router.get('/events', authenticate, async (req: Request, res: Response) => {
  try {
    const events = await prisma.sportsEvent.findMany({ orderBy: { startDate: 'desc' } });
    res.json({ success: true, data: events });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/events', authenticate,
  validate({ body: sportsEventCreateSchema }),
  async (req: Request, res: Response) => {
  try {
    const event = await prisma.sportsEvent.create({
      data: { ...req.body, startDate: new Date(req.body.startDate), endDate: new Date(req.body.endDate) }
    });
    res.json({ success: true, data: event });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put(
  '/events/:id',
  authenticate,
  validate({ params: z.object({ id: entityId }), body: sportsEventUpdateSchema }),
  async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const data = {
      ...req.body,
      ...(req.body.startDate ? { startDate: new Date(req.body.startDate) } : {}),
      ...(req.body.endDate ? { endDate: new Date(req.body.endDate) } : {})
    };
    const updated = await prisma.sportsEvent.update({ where: { id }, data });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Was `prisma.sportsEvent.delete({ where: { id } })` with nothing recorded.
 * Now audited, with the row captured before it goes and a reason required.
 */
router.delete(
  '/events/:id',
  authenticate,
  validate({
    params: z.object({ id: entityId }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await deleteTenantEntity(getTenantContext(req), {
      model: 'sportsEvent',
      entity: 'SportsEvent',
      module: 'sports',
      id: String(req.params.id),
      reason: String(req.body.reason)
    });

    res.json({ success: true, data: result });
  })
);

router.get('/events/:id/results', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const event = await prisma.sportsEvent.findUnique({ where: { id } });
    res.json({ success: true, data: { event, results: event?.results } });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Health & Fitness ───
router.get('/health', authenticate, async (req: Request, res: Response) => {
  try {
    const query = req.query as Record<string, string | undefined>;
    const { studentId } = query;
    const where: any = {};
    if (studentId) where.studentId = studentId;
    const records = await prisma.fitnessRecord.findMany({ where, orderBy: { testDate: 'desc' } });
    res.json({ success: true, data: records });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/health/fitness-test', authenticate,
  validate({ body: fitnessRecordCreateSchema }),
  async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const record = await prisma.fitnessRecord.create({
      data: { ...req.body, conductedBy: userId, testDate: new Date(req.body.testDate || Date.now()) }
    });
    res.json({ success: true, data: record });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put(
  '/health/:id',
  authenticate,
  validate({ params: z.object({ id: entityId }), body: fitnessRecordUpdateSchema }),
  async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const data = {
      ...req.body,
      ...(req.body.testDate ? { testDate: new Date(req.body.testDate) } : {}),
      ...(req.body.nextTestDate ? { nextTestDate: new Date(req.body.nextTestDate) } : {})
    };
    const updated = await prisma.fitnessRecord.update({ where: { id }, data });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Was `prisma.fitnessRecord.delete({ where: { id } })` with nothing recorded.
 * Now audited, with the row captured before it goes and a reason required.
 */
router.delete(
  '/health/:id',
  authenticate,
  validate({
    params: z.object({ id: entityId }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await deleteTenantEntity(getTenantContext(req), {
      model: 'fitnessRecord',
      entity: 'FitnessRecord',
      module: 'sports',
      id: String(req.params.id),
      reason: String(req.body.reason)
    });

    res.json({ success: true, data: result });
  })
);

export default router;
