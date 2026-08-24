import type { Request, Response } from 'express';
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { sendError } from '../lib/errors.js';
import { hashPassword } from '../lib/password.js';
import { getTenantContext } from '../lib/tenant.js';
import * as securityService from '../modules/security/security.service.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { entityId } from '../schemas/common.js';
import { updateTenantEntity } from '../modules/common/entityUpdate.service.js';
import {
  updateIncidentSchema
} from '../modules/common/entityUpdate.schemas.js';
import {
  supportTicketCreateSchema,
  vigilanceCaseCreateSchema
} from '../modules/common/legacyWrite.schemas.js';

const router = Router();

// ─── Dashboard ───
router.get('/dashboard', authenticate, async (req: Request, res: Response) => {
  try {
    const activeVisitors = await prisma.visitorPass.count({ where: { status: 'active' } });
    const gatePasses = await prisma.gatePass.count({ where: { status: 'approved' } });
    const incidents = await prisma.incidentReport.count({ where: { status: 'pending' } });
    const pendingGatePasses = await prisma.gatePass.count({ where: { status: 'pending' } });
    const idRequests = await prisma.iDCardRequest.count({ where: { status: 'pending' } });
    const vehiclePasses = await prisma.vehiclePass.count({ where: { status: 'active' } });

    res.json({
      success: true,
      data: {
        stats: [
          { label: "Active Visitors", value: activeVisitors.toString(), icon: "Users" },
          { label: "Pending Approvals", value: pendingGatePasses.toString(), icon: "Clock", color: "text-warning" },
          { label: "Reported Incidents", value: incidents.toString(), icon: "AlertTriangle", color: "text-destructive" },
          { label: "Gate Passes Issued", value: gatePasses.toString(), icon: "FileCheck", color: "text-success" },
          { label: "ID Card Requests", value: idRequests.toString(), icon: "CreditCard", color: "text-blue-500" },
          { label: "Vehicle Passes", value: vehiclePasses.toString(), icon: "Car", color: "text-purple-500" }
        ]
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Visitors ───
router.get('/visitors', authenticate, async (req: Request, res: Response) => {
  try {
    const visitors = await prisma.visitorPass.findMany({ orderBy: { checkInTime: 'desc' }, take: 100 });
    res.json({ success: true, data: visitors });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/visitors', authenticate, async (req: Request, res: Response) => {
  try {
    const { visitorName, purpose, hostName, checkInTime, status } = req.body || {};
    if (!visitorName || !purpose || !hostName) {
      return res.status(400).json({ success: false, message: 'visitorName, purpose, and hostName are required' });
    }

    const visitor = await prisma.visitorPass.create({
      data: {
        institutionId: getTenantContext(req).institutionId,
        visitorName: String(visitorName),
        purpose: String(purpose),
        hostName: String(hostName),
        checkInTime: checkInTime ? new Date(checkInTime) : new Date(),
        status: status ? String(status) : 'active'
      }
    });
    res.json({ success: true, data: visitor });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/visitors/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status, checkOutTime, visitorName, purpose, hostName } = req.body || {};

    const data: any = {};
    if (visitorName !== undefined) data.visitorName = String(visitorName);
    if (purpose !== undefined) data.purpose = String(purpose);
    if (hostName !== undefined) data.hostName = String(hostName);
    if (status !== undefined) data.status = String(status);
    if (checkOutTime !== undefined) {
      data.checkOutTime = checkOutTime ? new Date(checkOutTime) : null;
    }

    if (data.status && (data.status === 'checked_out' || data.status === 'closed') && !data.checkOutTime) {
      data.checkOutTime = new Date();
    }

    const updated = await prisma.visitorPass.update({
      where: { id },
      data
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Was `prisma.visitorPass.delete({ where: { id } })` and a success message —
 * no record of who removed it or what it was.
 *
 * Hard deleted, but audited with the row captured before it goes.
 */
router.delete(
  '/visitors/:id',
  authenticate,
  validate({
    params: z.object({ id: entityId }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await securityService.removeRecord(getTenantContext(req), {
      model: 'visitorPass',
      entity: 'VisitorPass',
      id: String(req.params.id),
      reason: String(req.body.reason)
    });
    res.json({ success: true, data: result });
  })
);

// ─── Incidents ───
router.get('/incidents', authenticate, async (req: Request, res: Response) => {
  try {
    const incidents = await prisma.incidentReport.findMany({
      take: 200, orderBy: { reportedAt: 'desc' } });
    res.json({ success: true, data: incidents });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/incidents', authenticate, async (req: Request, res: Response) => {
  try {
    const { title, description, location, severity, status } = req.body || {};
    if (!title || !description || !location || !severity) {
      return res.status(400).json({ success: false, message: 'title, description, location, and severity are required' });
    }

    const incident = await prisma.incidentReport.create({
      data: {
        institutionId: getTenantContext(req).institutionId,
        title: String(title),
        description: String(description),
        location: String(location),
        severity: String(severity),
        status: status ? String(status) : 'pending'
      }
    });
    res.json({ success: true, data: incident });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put(
  '/incidents/:id',
  authenticate,
  validate({ params: z.object({ id: entityId }), body: updateIncidentSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await updateTenantEntity(getTenantContext(req), {
      model: 'incidentReport',
      entity: 'IncidentReport',
      module: 'security',
      id: String(req.params.id),
      data: req.body as Record<string, unknown>
    });

    res.json({ success: true, data: updated });
  })
);

/**
 * Was `prisma.incidentReport.delete({ where: { id } })` and a success message —
 * no record of who removed it or what it was.
 *
 * SOFT deleted: this is the record that something was investigated, and
 * an investigation the investigating office can erase is not evidence of
 * anything. The row stays and the extension hides it.
 */
router.delete(
  '/incidents/:id',
  authenticate,
  validate({
    params: z.object({ id: entityId }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await securityService.removeRecord(getTenantContext(req), {
      model: 'incidentReport',
      entity: 'IncidentReport',
      id: String(req.params.id),
      reason: String(req.body.reason)
    });
    res.json({ success: true, data: result });
  })
);

// ─── Patrols ───
router.get('/patrols', authenticate, async (req: Request, res: Response) => {
  try {
    const patrols = await prisma.patrolLog.findMany({ orderBy: { startTime: 'desc' }, take: 50 });
    res.json({ success: true, data: patrols });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/patrols', authenticate, async (req: Request, res: Response) => {
  try {
    const { officerId, officerName, shift, patrolRoute, startTime, endTime, checkpoints, status, location } = req.body || {};
    if (!officerId || !officerName || !shift || !patrolRoute || !startTime) {
      return res.status(400).json({ success: false, message: 'officerId, officerName, shift, patrolRoute, and startTime are required' });
    }

    const created = await prisma.patrolLog.create({
      data: {
        institutionId: getTenantContext(req).institutionId,
        officerId: String(officerId),
        officerName: String(officerName),
        shift: String(shift),
        patrolRoute: String(patrolRoute),
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : null,
        checkpoints: checkpoints ?? undefined,
        status: status ? String(status) : 'on_duty',
        location: location ? String(location) : null,
      }
    });

    res.json({ success: true, data: created });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/patrols/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { officerId, officerName, shift, patrolRoute, startTime, endTime, checkpoints, status, location } = req.body || {};

    const data: any = { lastUpdate: new Date() };
    if (officerId !== undefined) data.officerId = String(officerId);
    if (officerName !== undefined) data.officerName = String(officerName);
    if (shift !== undefined) data.shift = String(shift);
    if (patrolRoute !== undefined) data.patrolRoute = String(patrolRoute);
    if (startTime !== undefined) data.startTime = startTime ? new Date(startTime) : null;
    if (endTime !== undefined) data.endTime = endTime ? new Date(endTime) : null;
    if (checkpoints !== undefined) data.checkpoints = checkpoints;
    if (status !== undefined) data.status = String(status);
    if (location !== undefined) data.location = location ? String(location) : null;

    const updated = await prisma.patrolLog.update({ where: { id }, data });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Was `prisma.patrolLog.delete({ where: { id } })` and a success message —
 * no record of who removed it or what it was.
 *
 * Hard deleted, but audited with the row captured before it goes.
 */
router.delete(
  '/patrols/:id',
  authenticate,
  validate({
    params: z.object({ id: entityId }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await securityService.removeRecord(getTenantContext(req), {
      model: 'patrolLog',
      entity: 'PatrolLog',
      id: String(req.params.id),
      reason: String(req.body.reason)
    });
    res.json({ success: true, data: result });
  })
);

// ─── Guards ───
router.get('/guards', authenticate, async (req: Request, res: Response) => {
  try {
    const guards = await prisma.user.findMany({
      take: 200,
      where: { role: 'security_officer' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        designation: true,
        campus: true,
        createdAt: true,
      }
    });

    const withDuty = await Promise.all(
      guards.map(async (guard) => {
        const latestDuty = await prisma.patrolLog.findFirst({
          where: { officerId: guard.id },
          orderBy: { startTime: 'desc' },
          select: {
            id: true,
            shift: true,
            patrolRoute: true,
            location: true,
            status: true,
            startTime: true,
            endTime: true,
            lastUpdate: true,
          }
        });

        return {
          ...guard,
          latestDuty,
        };
      })
    );

    res.json({ success: true, data: withDuty });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/guards', authenticate, async (req: Request, res: Response) => {
  try {
    const { name, email, password, designation, campus } = req.body || {};
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'name and email are required' });
    }

    const existing = await prisma.user.findUnique({ where: { email: String(email) } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A user with this email already exists' });
    }

    // REMOVED: `password ? String(password) : 'Guard@123'`.
    //
    // A guard account created without a password got a KNOWN one. The literal
    // sits in a public repository, the accounts are real, and nothing forced a
    // change at first login — so every such account shared one published
    // credential. Phase 0.4 removed default passwords elsewhere; this call
    // survived because it hashes with bcrypt directly instead of going through
    // `hashPassword()`, which is where the policy check lives.
    //
    // A password is now required, and is validated by the same policy as every
    // other account rather than by this handler's own judgement.
    if (!password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'A password is required. Guard accounts are no longer created with a default.'
        }
      });
    }
    const hashedPassword = await hashPassword(String(password));

    const created = await prisma.user.create({
      data: {
        // Was absent: a guard account was created with NO institution. Since
        // `resolveTenantContext` derives the request's institution from the user
        // row, that account could authenticate and then be rejected by every
        // tenant-scoped route — and after 0030 the row cannot be written at all.
        // Taken from the creator's context, never from the request body.
        institutionId: getTenantContext(req).institutionId,
        name: String(name),
        email: String(email),
        password: hashedPassword,
        role: 'security_officer',
        designation: designation ? String(designation) : 'Security Guard',
        campus: campus ? String(campus) : null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        designation: true,
        campus: true,
        createdAt: true,
      }
    });

    res.json({
      success: true,
      data: {
        ...created,
        latestDuty: null,
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/guards/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { name, email, designation, campus } = req.body || {};

    const data: any = {};
    if (name !== undefined) data.name = String(name);
    if (email !== undefined) data.email = String(email);
    if (designation !== undefined) data.designation = designation ? String(designation) : null;
    if (campus !== undefined) data.campus = campus ? String(campus) : null;

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        designation: true,
        campus: true,
        createdAt: true,
      }
    });

    const latestDuty = await prisma.patrolLog.findFirst({
      where: { officerId: id },
      orderBy: { startTime: 'desc' },
      select: {
        id: true,
        shift: true,
        patrolRoute: true,
        location: true,
        status: true,
        startTime: true,
        endTime: true,
        lastUpdate: true,
      }
    });

    res.json({ success: true, data: { ...updated, latestDuty } });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/guards/:id/duty', authenticate, async (req: Request, res: Response) => {
  try {
    const officerId = String(req.params.id);
    const { shift, patrolRoute, location, status, startTime, endTime } = req.body || {};

    if (!shift || !patrolRoute) {
      return res.status(400).json({ success: false, message: 'shift and patrolRoute are required' });
    }

    const guard = await prisma.user.findUnique({
      where: { id: officerId },
      select: { id: true, name: true, role: true }
    });

    if (!guard || guard.role !== 'security_officer') {
      return res.status(404).json({ success: false, message: 'Guard not found' });
    }

    const activeDuty = await prisma.patrolLog.findFirst({
      where: {
        officerId,
        endTime: null,
        status: { in: ['on_duty', 'active', 'in_progress'] }
      },
      orderBy: { startTime: 'desc' }
    });

    let duty;
    if (activeDuty) {
      duty = await prisma.patrolLog.update({
        where: { id: activeDuty.id },
        data: {
          shift: String(shift),
          patrolRoute: String(patrolRoute),
          location: location ? String(location) : null,
          status: status ? String(status) : 'on_duty',
          startTime: startTime ? new Date(startTime) : activeDuty.startTime,
          endTime: endTime ? new Date(endTime) : null,
          lastUpdate: new Date(),
        }
      });
    } else {
      duty = await prisma.patrolLog.create({
        data: {
        institutionId: getTenantContext(req).institutionId,
          officerId,
          officerName: guard.name,
          shift: String(shift),
          patrolRoute: String(patrolRoute),
          location: location ? String(location) : null,
          status: status ? String(status) : 'on_duty',
          startTime: startTime ? new Date(startTime) : new Date(),
          endTime: endTime ? new Date(endTime) : null,
        }
      });
    }

    res.json({ success: true, data: duty });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.delete('/guards/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    await prisma.patrolLog.deleteMany({ where: { officerId: id } });
    await prisma.user.delete({ where: { id } });
    res.json({ success: true, data: { id } });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── ID Cards ───
router.get('/id-cards', authenticate, async (req: Request, res: Response) => {
  try {
    const requests = await prisma.iDCardRequest.findMany({
      take: 200, orderBy: { requestDate: 'desc' } });
    res.json({ success: true, data: requests });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/id-cards', authenticate, async (req: Request, res: Response) => {
  try {
    const count = await prisma.iDCardRequest.count();
    const { applicantId, applicantName, applicantType, requestType, reason, feesPaid, documents } = req.body || {};
    if (!applicantId || !applicantName || !applicantType) {
      return res.status(400).json({ success: false, message: 'applicantId, applicantName, and applicantType are required' });
    }

    const request = await prisma.iDCardRequest.create({
      data: {
        institutionId: getTenantContext(req).institutionId,
        requestNumber: `IDC-${(count + 1).toString().padStart(5, '0')}`,
        applicantId: String(applicantId),
        applicantName: String(applicantName),
        applicantType: String(applicantType),
        requestType: requestType ? String(requestType) : 'new',
        reason: reason ? String(reason) : null,
        feesPaid: Boolean(feesPaid),
        documents: documents ?? undefined
      }
    });
    res.json({ success: true, data: request });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/id-cards/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const userId = String((req as any).user.id || 'system');
    const { status, feesPaid, documents, reason, requestType, applicantType, applicantName } = req.body || {};

    const data: any = {};
    if (status !== undefined) data.status = String(status);
    if (feesPaid !== undefined) data.feesPaid = Boolean(feesPaid);
    if (documents !== undefined) data.documents = documents;
    if (reason !== undefined) data.reason = reason ? String(reason) : null;
    if (requestType !== undefined) data.requestType = String(requestType);
    if (applicantType !== undefined) data.applicantType = String(applicantType);
    if (applicantName !== undefined) data.applicantName = String(applicantName);

    if (data.status === 'approved') {
      data.approvedBy = userId;
      data.approvalDate = new Date();
    }

    if (data.status === 'issued') {
      data.cardIssuedDate = new Date();
      if (!data.approvedBy) data.approvedBy = userId;
      if (!data.approvalDate) data.approvalDate = new Date();
    }

    const updated = await prisma.iDCardRequest.update({ where: { id }, data });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Was `prisma.iDCardRequest.delete({ where: { id } })` and a success message —
 * no record of who removed it or what it was.
 *
 * Hard deleted, but audited with the row captured before it goes.
 */
router.delete(
  '/id-cards/:id',
  authenticate,
  validate({
    params: z.object({ id: entityId }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await securityService.removeRecord(getTenantContext(req), {
      model: 'iDCardRequest',
      entity: 'IDCardRequest',
      id: String(req.params.id),
      reason: String(req.body.reason)
    });
    res.json({ success: true, data: result });
  })
);

// ─── Vehicle Passes ───
router.get('/vehicle-passes', authenticate, async (req: Request, res: Response) => {
  try {
    const passes = await prisma.vehiclePass.findMany({
      take: 200, orderBy: { validFrom: 'desc' } });
    res.json({ success: true, data: passes });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/vehicle-passes', authenticate, async (req: Request, res: Response) => {
  try {
    const count = await prisma.vehiclePass.count();
    const {
      ownerName,
      ownerType,
      ownerIdNumber,
      vehicleType,
      vehicleNumber,
      vehicleModel,
      validFrom,
      validUntil,
      parkingZone,
      status,
      feesPaid,
      documents
    } = req.body || {};

    if (!ownerName || !ownerType || !ownerIdNumber || !vehicleType || !vehicleNumber || !validFrom || !validUntil || !parkingZone) {
      return res.status(400).json({ success: false, message: 'ownerName, ownerType, ownerIdNumber, vehicleType, vehicleNumber, validFrom, validUntil, and parkingZone are required' });
    }

    const pass = await prisma.vehiclePass.create({
      data: {
        institutionId: getTenantContext(req).institutionId,
        passNumber: `VP-${(count + 1).toString().padStart(5, '0')}`,
        ownerName: String(ownerName),
        ownerType: String(ownerType),
        ownerIdNumber: String(ownerIdNumber),
        vehicleType: String(vehicleType),
        vehicleNumber: String(vehicleNumber),
        vehicleModel: vehicleModel ? String(vehicleModel) : null,
        validFrom: new Date(validFrom),
        validUntil: new Date(validUntil),
        parkingZone: String(parkingZone),
        status: status ? String(status) : 'active',
        feesPaid: Boolean(feesPaid),
        documents: documents ?? undefined,
      }
    });
    res.json({ success: true, data: pass });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/vehicle-passes/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const {
      ownerName,
      ownerType,
      ownerIdNumber,
      vehicleType,
      vehicleNumber,
      vehicleModel,
      validFrom,
      validUntil,
      parkingZone,
      status,
      feesPaid,
      documents
    } = req.body || {};

    const data: any = {};
    if (ownerName !== undefined) data.ownerName = String(ownerName);
    if (ownerType !== undefined) data.ownerType = String(ownerType);
    if (ownerIdNumber !== undefined) data.ownerIdNumber = String(ownerIdNumber);
    if (vehicleType !== undefined) data.vehicleType = String(vehicleType);
    if (vehicleNumber !== undefined) data.vehicleNumber = String(vehicleNumber);
    if (vehicleModel !== undefined) data.vehicleModel = vehicleModel ? String(vehicleModel) : null;
    if (validFrom !== undefined) data.validFrom = validFrom ? new Date(validFrom) : null;
    if (validUntil !== undefined) data.validUntil = validUntil ? new Date(validUntil) : null;
    if (parkingZone !== undefined) data.parkingZone = String(parkingZone);
    if (status !== undefined) data.status = String(status);
    if (feesPaid !== undefined) data.feesPaid = Boolean(feesPaid);
    if (documents !== undefined) data.documents = documents;

    const updated = await prisma.vehiclePass.update({ where: { id }, data });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Was `prisma.vehiclePass.delete({ where: { id } })` and a success message —
 * no record of who removed it or what it was.
 *
 * Hard deleted, but audited with the row captured before it goes.
 */
router.delete(
  '/vehicle-passes/:id',
  authenticate,
  validate({
    params: z.object({ id: entityId }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await securityService.removeRecord(getTenantContext(req), {
      model: 'vehiclePass',
      entity: 'VehiclePass',
      id: String(req.params.id),
      reason: String(req.body.reason)
    });
    res.json({ success: true, data: result });
  })
);

// ─── Hostel Access ───
router.get('/hostel-access', authenticate, async (req: Request, res: Response) => {
  try {
    const logs = await prisma.hostelAccessLog.findMany({ orderBy: { outTime: 'desc' }, take: 100 });
    res.json({ success: true, data: logs });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Vigilance Cases ───
router.get('/vigilance-cases', authenticate, async (req: Request, res: Response) => {
  try {
    const cases = await prisma.vigilanceCase.findMany({
      take: 200, orderBy: { dateReported: 'desc' } });
    res.json({ success: true, data: cases });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/vigilance-cases', authenticate,
  validate({ body: vigilanceCaseCreateSchema }),
  async (req: Request, res: Response) => {
  try {
    const count = await prisma.vigilanceCase.count();
    const caseRecord = await prisma.vigilanceCase.create({
      data: { ...req.body, caseNumber: `VIG-${(count + 1).toString().padStart(5, '0')}` }
    });
    res.json({ success: true, data: caseRecord });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/vigilance-cases/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const {
      type,
      subject,
      description,
      complainantType,
      dateReported,
      status,
      investigatingOfficer,
      documentsCollected,
      peopleInterviewed,
      findings,
      actionTaken,
      closeDate,
      confidentialityLevel
    } = req.body || {};

    const data: any = {};
    if (type !== undefined) data.type = String(type);
    if (subject !== undefined) data.subject = String(subject);
    if (description !== undefined) data.description = String(description);
    if (complainantType !== undefined) data.complainantType = String(complainantType);
    if (dateReported !== undefined) data.dateReported = dateReported ? new Date(dateReported) : null;
    if (status !== undefined) data.status = String(status);
    if (investigatingOfficer !== undefined) data.investigatingOfficer = String(investigatingOfficer);
    if (documentsCollected !== undefined) data.documentsCollected = documentsCollected;
    if (peopleInterviewed !== undefined) data.peopleInterviewed = peopleInterviewed;
    if (findings !== undefined) data.findings = findings ? String(findings) : null;
    if (actionTaken !== undefined) data.actionTaken = actionTaken ? String(actionTaken) : null;
    if (closeDate !== undefined) data.closeDate = closeDate ? new Date(closeDate) : null;
    if (confidentialityLevel !== undefined) data.confidentialityLevel = String(confidentialityLevel);

    const updated = await prisma.vigilanceCase.update({ where: { id }, data });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Was `prisma.vigilanceCase.delete({ where: { id } })` and a success message —
 * no record of who removed it or what it was.
 *
 * SOFT deleted: this is the record that something was investigated, and
 * an investigation the investigating office can erase is not evidence of
 * anything. The row stays and the extension hides it.
 */
router.delete(
  '/vigilance-cases/:id',
  authenticate,
  validate({
    params: z.object({ id: entityId }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await securityService.removeRecord(getTenantContext(req), {
      model: 'vigilanceCase',
      entity: 'VigilanceCase',
      id: String(req.params.id),
      reason: String(req.body.reason)
    });
    res.json({ success: true, data: result });
  })
);

// ─── Support Tickets ───
router.get('/support-tickets', authenticate, async (req: Request, res: Response) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      take: 200, orderBy: { createdDate: 'desc' } });
    res.json({ success: true, data: tickets });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/support-tickets', authenticate,
  validate({ body: supportTicketCreateSchema }),
  async (req: Request, res: Response) => {
  try {
    const count = await prisma.supportTicket.count();
    const ticket = await prisma.supportTicket.create({
      data: { ...req.body, ticketNumber: `TKT-${(count + 1).toString().padStart(5, '0')}` }
    });
    res.json({ success: true, data: ticket });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/support-tickets/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const {
      reportedBy,
      reporterType,
      contactInfo,
      category,
      priority,
      subject,
      description,
      attachments,
      assignedTo,
      status,
      resolutionDate,
      resolutionNotes,
      satisfactionRating
    } = req.body || {};

    const data: any = { lastUpdate: new Date() };
    if (reportedBy !== undefined) data.reportedBy = String(reportedBy);
    if (reporterType !== undefined) data.reporterType = String(reporterType);
    if (contactInfo !== undefined) data.contactInfo = String(contactInfo);
    if (category !== undefined) data.category = String(category);
    if (priority !== undefined) data.priority = String(priority);
    if (subject !== undefined) data.subject = String(subject);
    if (description !== undefined) data.description = String(description);
    if (attachments !== undefined) data.attachments = attachments;
    if (assignedTo !== undefined) data.assignedTo = assignedTo ? String(assignedTo) : null;
    if (status !== undefined) data.status = String(status);
    if (resolutionDate !== undefined) data.resolutionDate = resolutionDate ? new Date(resolutionDate) : null;
    if (resolutionNotes !== undefined) data.resolutionNotes = resolutionNotes ? String(resolutionNotes) : null;
    if (satisfactionRating !== undefined) data.satisfactionRating = Number(satisfactionRating);

    const updated = await prisma.supportTicket.update({ where: { id }, data });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Was `prisma.supportTicket.delete({ where: { id } })` and a success message —
 * no record of who removed it or what it was.
 *
 * Hard deleted, but audited with the row captured before it goes.
 */
router.delete(
  '/support-tickets/:id',
  authenticate,
  validate({
    params: z.object({ id: entityId }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await securityService.removeRecord(getTenantContext(req), {
      model: 'supportTicket',
      entity: 'SupportTicket',
      id: String(req.params.id),
      reason: String(req.body.reason)
    });
    res.json({ success: true, data: result });
  })
);

export default router;
