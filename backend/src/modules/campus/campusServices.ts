/**
 * Campus services: student leave / on-duty, hostel and transport.
 *
 * Hostel and transport are run from the Registrar's office (estate & student
 * services). An allocation raises the fee as a FeeRecord, so it appears on the
 * student's Fees page and in Finance like any other due.
 */
import { basePrisma } from '../../lib/prisma.js';
import { BusinessRuleError, ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { notifyInApp } from '../../lib/inAppNotify.js';
import type { TenantContext } from '../../lib/tenant.js';
import * as workflow from '../workflow/workflow.service.js';
import { ensureDefinition } from '../workflow/bridge.js';
import { STUDENT_LEAVE_OD } from '../workflow/builtins.js';

async function currentYear(institutionId: string): Promise<string> {
  const y = await basePrisma.academicYear.findFirst({ where: { institutionId, isCurrent: true }, select: { year: true } });
  if (y?.year) return y.year;
  const now = new Date();
  const start = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

async function studentUser(institutionId: string, studentProfileId: string) {
  return basePrisma.studentProfile.findFirst({ where: { id: studentProfileId, institutionId }, include: { user: { select: { id: true, name: true } } } });
}

// ─── Student leave / on-duty ────────────────────────────────────────────────

export async function applyLeave(ctx: TenantContext, studentProfileId: string, input: { type: string; fromDate: Date; toDate: Date; reason: string; documentUrl?: string | undefined }) {
  if (input.toDate < input.fromDate) throw new ValidationError('The leave cannot end before it starts.');
  const days = Math.round((input.toDate.getTime() - input.fromDate.getTime()) / 864e5) + 1;
  if (days > 60) throw new ValidationError('A single request can cover at most 60 days.');
  const overlap = await basePrisma.studentLeaveRequest.findFirst({
    where: { institutionId: ctx.institutionId, studentProfileId, status: { in: ['pending', 'approved'] }, fromDate: { lte: input.toDate }, toDate: { gte: input.fromDate } }
  });
  if (overlap) throw new ConflictError('You already have a leave request covering some of these dates.');
  const created = await basePrisma.studentLeaveRequest.create({
    data: { institutionId: ctx.institutionId, studentProfileId, type: input.type, fromDate: input.fromDate, toDate: input.toDate, reason: input.reason, documentUrl: input.documentUrl ?? null, status: 'pending' }
  });
  await ensureDefinition(ctx, STUDENT_LEAVE_OD);
  const started = await workflow.startWorkflow(ctx, { code: STUDENT_LEAVE_OD.code, entityType: 'StudentLeaveRequest', entityId: created.id });
  return { ...created, days, waitingOn: started.assigneeRole };
}

export async function myLeaves(ctx: TenantContext, studentProfileId: string) {
  const rows = await basePrisma.studentLeaveRequest.findMany({ where: { institutionId: ctx.institutionId, studentProfileId }, orderBy: { createdAt: 'desc' } });
  const inst = await basePrisma.workflowInstance.findMany({
    where: { institutionId: ctx.institutionId, entityType: 'StudentLeaveRequest', entityId: { in: rows.map((r) => r.id) } },
    include: { transitions: { orderBy: { occurredAt: 'desc' }, take: 1 } }
  });
  return rows.map((r) => {
    const i = inst.find((x) => x.entityId === r.id);
    return { ...r, instanceId: i?.id ?? null, note: i?.status !== 'pending' ? i?.transitions[0]?.note ?? null : null };
  });
}

// ─── Hostel ─────────────────────────────────────────────────────────────────

export async function hostels(ctx: TenantContext) {
  const list = await basePrisma.hostel.findMany({ where: { institutionId: ctx.institutionId }, orderBy: { name: 'asc' } });
  const allocations = await basePrisma.hostelAllocation.findMany({
    where: { hostelId: { in: list.map((h) => h.id) }, status: 'active' },
    include: { student: { include: { user: { select: { name: true } } } } },
    orderBy: { roomNumber: 'asc' }
  });
  return list.map((h) => {
    const mine = allocations.filter((a) => a.hostelId === h.id);
    return {
      ...h, occupied: mine.length, vacant: h.capacity != null ? Math.max(0, h.capacity - mine.length) : null,
      residents: mine.map((a) => ({ id: a.id, studentProfileId: a.studentProfileId, name: a.student.user?.name ?? '', rollNumber: a.student.rollNumber, roomNumber: a.roomNumber, roomType: a.roomType, checkInDate: a.checkInDate, academicYear: a.academicYear }))
    };
  });
}

export async function saveHostel(ctx: TenantContext, id: string | null, input: { name: string; block: string; wardenName: string; wardenPhone: string; capacity?: number | undefined; hostelType?: string | undefined; feePerSemester?: number | undefined }) {
  const data = { name: input.name, block: input.block, wardenName: input.wardenName, wardenPhone: input.wardenPhone, capacity: input.capacity ?? null, hostelType: input.hostelType ?? null, feePerSemester: input.feePerSemester ?? null };
  if (id) {
    const r = await basePrisma.hostel.updateMany({ where: { id, institutionId: ctx.institutionId }, data });
    if (!r.count) throw new NotFoundError('Hostel');
    return basePrisma.hostel.findFirst({ where: { id, institutionId: ctx.institutionId } });
  }
  return basePrisma.hostel.create({ data: { ...data, institutionId: ctx.institutionId } });
}

export async function allocateHostel(ctx: TenantContext, input: { hostelId: string; studentProfileId: string; roomNumber: string; roomType: string; requestId?: string | undefined }) {
  const hostel = await basePrisma.hostel.findFirst({ where: { id: input.hostelId, institutionId: ctx.institutionId } });
  if (!hostel) throw new NotFoundError('Hostel');
  const student = await studentUser(ctx.institutionId, input.studentProfileId);
  if (!student) throw new NotFoundError('Student');
  const already = await basePrisma.hostelAllocation.findFirst({ where: { studentProfileId: input.studentProfileId, status: 'active' } });
  if (already) throw new ConflictError(`${student.user?.name} already has room ${already.roomNumber}. Vacate it first.`);
  if (hostel.capacity != null) {
    const occupied = await basePrisma.hostelAllocation.count({ where: { hostelId: hostel.id, status: 'active' } });
    if (occupied >= hostel.capacity) throw new BusinessRuleError(`${hostel.name} is full (${hostel.capacity} beds).`);
  }
  const year = await currentYear(ctx.institutionId);
  let feeRecordId: string | null = null;
  if (hostel.feePerSemester && hostel.feePerSemester > 0) {
    const fee = await basePrisma.feeRecord.create({
      data: { institutionId: ctx.institutionId, studentProfileId: input.studentProfileId, type: 'hostel', description: `Hostel fee — ${hostel.name}, room ${input.roomNumber}`, amount: hostel.feePerSemester, paidAmount: 0, dueDate: new Date(Date.now() + 15 * 864e5), status: 'pending', academicYear: year }
    });
    feeRecordId = fee.id;
  }
  const alloc = await basePrisma.hostelAllocation.create({
    data: { studentProfileId: input.studentProfileId, hostelId: hostel.id, roomNumber: input.roomNumber, roomType: input.roomType, checkInDate: new Date(), institutionId: ctx.institutionId, status: 'active', academicYear: year, feeRecordId }
  });
  await basePrisma.studentProfile.updateMany({ where: { id: input.studentProfileId, institutionId: ctx.institutionId }, data: { isHosteller: true } });
  if (input.requestId) await decideRequest(ctx, input.requestId, 'allocated', `${hostel.name}, room ${input.roomNumber}`);
  if (student.user) await notifyInApp(ctx.institutionId, { userIds: [student.user.id] }, {
    eventType: 'hostel.allocated', subject: `Hostel room allotted: ${hostel.name}, room ${input.roomNumber}`,
    body: hostel.feePerSemester ? `Hostel fee of ₹${hostel.feePerSemester.toLocaleString('en-IN')} has been added to your fees.` : 'Report to the warden to check in.',
    relatedEntityType: 'HostelAllocation', relatedEntityId: alloc.id
  });
  return alloc;
}

export async function vacateHostel(ctx: TenantContext, allocationId: string) {
  const alloc = await basePrisma.hostelAllocation.findFirst({ where: { id: allocationId, institutionId: ctx.institutionId, status: 'active' } });
  if (!alloc) throw new NotFoundError('Active hostel allocation');
  await basePrisma.hostelAllocation.updateMany({ where: { id: allocationId }, data: { status: 'vacated', checkOutDate: new Date() } });
  await basePrisma.studentProfile.updateMany({ where: { id: alloc.studentProfileId, institutionId: ctx.institutionId }, data: { isHosteller: false } });
  return { vacated: true };
}

// ─── Transport ──────────────────────────────────────────────────────────────

type Stop = { name: string; time: string; fee: number };

export async function routes(ctx: TenantContext) {
  const list = await basePrisma.transportRoute.findMany({ where: { institutionId: ctx.institutionId }, orderBy: { code: 'asc' } });
  const allocs = await basePrisma.transportAllocation.findMany({
    where: { institutionId: ctx.institutionId, routeId: { in: list.map((r) => r.id) }, status: 'active' }
  });
  const students = await basePrisma.studentProfile.findMany({ where: { id: { in: allocs.map((a) => a.studentProfileId) }, institutionId: ctx.institutionId }, include: { user: { select: { name: true } } } });
  const sName = new Map(students.map((s) => [s.id, s]));
  return list.map((r) => {
    const mine = allocs.filter((a) => a.routeId === r.id);
    return {
      ...r, riders: mine.length, seatsLeft: Math.max(0, r.capacity - mine.length),
      passengers: mine.map((a) => ({ id: a.id, studentProfileId: a.studentProfileId, name: sName.get(a.studentProfileId)?.user?.name ?? '', rollNumber: sName.get(a.studentProfileId)?.rollNumber ?? '', stop: a.stop, fee: a.fee }))
    };
  });
}

export async function saveRoute(ctx: TenantContext, id: string | null, input: { code: string; name: string; vehicleNumber?: string | undefined; driverName?: string | undefined; driverPhone?: string | undefined; capacity: number; stops: Stop[]; active?: boolean | undefined }) {
  if (!input.stops.length) throw new ValidationError('Add at least one stop.');
  const data = { code: input.code, name: input.name, vehicleNumber: input.vehicleNumber ?? null, driverName: input.driverName ?? null, driverPhone: input.driverPhone ?? null, capacity: input.capacity, stops: input.stops as never, active: input.active ?? true };
  if (id) {
    const r = await basePrisma.transportRoute.updateMany({ where: { id, institutionId: ctx.institutionId }, data });
    if (!r.count) throw new NotFoundError('Route');
    return basePrisma.transportRoute.findFirst({ where: { id, institutionId: ctx.institutionId } });
  }
  const clash = await basePrisma.transportRoute.findFirst({ where: { institutionId: ctx.institutionId, code: input.code } });
  if (clash) throw new ConflictError(`Route ${input.code} already exists.`);
  return basePrisma.transportRoute.create({ data: { ...data, institutionId: ctx.institutionId } });
}

export async function allocateTransport(ctx: TenantContext, input: { routeId: string; studentProfileId: string; stop: string; requestId?: string | undefined }) {
  const route = await basePrisma.transportRoute.findFirst({ where: { id: input.routeId, institutionId: ctx.institutionId } });
  if (!route || !route.active) throw new NotFoundError('Active route');
  const stop = (route.stops as unknown as Stop[]).find((s) => s.name === input.stop);
  if (!stop) throw new ValidationError(`${input.stop} is not a stop on ${route.code}.`);
  const student = await studentUser(ctx.institutionId, input.studentProfileId);
  if (!student) throw new NotFoundError('Student');
  const already = await basePrisma.transportAllocation.findFirst({ where: { institutionId: ctx.institutionId, studentProfileId: input.studentProfileId, status: 'active' } });
  if (already) throw new ConflictError(`${student.user?.name} already has a bus pass. Cancel it first.`);
  const riders = await basePrisma.transportAllocation.count({ where: { institutionId: ctx.institutionId, routeId: route.id, status: 'active' } });
  if (riders >= route.capacity) throw new BusinessRuleError(`${route.code} is full (${route.capacity} seats).`);
  const year = await currentYear(ctx.institutionId);
  let feeRecordId: string | null = null;
  if (stop.fee > 0) {
    const fee = await basePrisma.feeRecord.create({
      data: { institutionId: ctx.institutionId, studentProfileId: input.studentProfileId, type: 'transport', description: `Transport fee — ${route.code} ${route.name}, ${stop.name}`, amount: stop.fee, paidAmount: 0, dueDate: new Date(Date.now() + 15 * 864e5), status: 'pending', academicYear: year }
    });
    feeRecordId = fee.id;
  }
  const alloc = await basePrisma.transportAllocation.create({
    data: { institutionId: ctx.institutionId, routeId: route.id, studentProfileId: input.studentProfileId, stop: stop.name, fee: stop.fee, academicYear: year, status: 'active', feeRecordId, allocatedBy: ctx.userId }
  });
  if (input.requestId) await decideRequest(ctx, input.requestId, 'allocated', `${route.code}, ${stop.name}`);
  if (student.user) await notifyInApp(ctx.institutionId, { userIds: [student.user.id] }, {
    eventType: 'transport.allocated', subject: `Bus pass: ${route.code} ${route.name}`,
    body: `Boarding at ${stop.name} (${stop.time}).${stop.fee ? ` Transport fee ₹${stop.fee.toLocaleString('en-IN')} added to your fees.` : ''}`,
    relatedEntityType: 'TransportAllocation', relatedEntityId: alloc.id
  });
  return alloc;
}

export async function cancelTransport(ctx: TenantContext, allocationId: string) {
  const r = await basePrisma.transportAllocation.updateMany({ where: { id: allocationId, institutionId: ctx.institutionId, status: 'active' }, data: { status: 'cancelled' } });
  if (!r.count) throw new NotFoundError('Active bus pass');
  return { cancelled: true };
}

// ─── Student requests for hostel / transport ────────────────────────────────

export async function requestService(ctx: TenantContext, studentProfileId: string, input: { service: 'hostel' | 'transport'; preference?: Record<string, unknown> | undefined; note?: string | undefined }) {
  const open = await basePrisma.campusServiceRequest.findFirst({ where: { institutionId: ctx.institutionId, studentProfileId, service: input.service, status: 'requested' } });
  if (open) throw new ConflictError(`You already have a ${input.service} request waiting.`);
  if (input.service === 'hostel' && await basePrisma.hostelAllocation.findFirst({ where: { studentProfileId, status: 'active' } })) throw new ConflictError('You already have a hostel room.');
  if (input.service === 'transport' && await basePrisma.transportAllocation.findFirst({ where: { institutionId: ctx.institutionId, studentProfileId, status: 'active' } })) throw new ConflictError('You already have a bus pass.');
  const created = await basePrisma.campusServiceRequest.create({
    data: { institutionId: ctx.institutionId, studentProfileId, service: input.service, preference: (input.preference ?? null) as never, note: input.note ?? null, status: 'requested' }
  });
  const s = await studentUser(ctx.institutionId, studentProfileId);
  await notifyInApp(ctx.institutionId, { roles: ['registrar'] }, {
    eventType: `${input.service}.requested`, subject: `${input.service === 'hostel' ? 'Hostel' : 'Transport'} request: ${s?.user?.name} (${s?.rollNumber})`,
    body: input.note ?? '', relatedEntityType: 'CampusServiceRequest', relatedEntityId: created.id
  });
  return created;
}

export async function listRequests(ctx: TenantContext, filter: { studentProfileId?: string } = {}) {
  const rows = await basePrisma.campusServiceRequest.findMany({ where: { institutionId: ctx.institutionId, ...filter }, orderBy: { createdAt: 'desc' }, take: 300 });
  const students = await basePrisma.studentProfile.findMany({ where: { id: { in: rows.map((r) => r.studentProfileId) }, institutionId: ctx.institutionId }, include: { user: { select: { name: true } } } });
  const m = new Map(students.map((s) => [s.id, s]));
  return rows.map((r) => ({ ...r, studentName: m.get(r.studentProfileId)?.user?.name ?? '', rollNumber: m.get(r.studentProfileId)?.rollNumber ?? '' }));
}

export async function decideRequest(ctx: TenantContext, requestId: string, status: 'allocated' | 'declined' | 'cancelled', note?: string) {
  const req = await basePrisma.campusServiceRequest.findFirst({ where: { id: requestId, institutionId: ctx.institutionId } });
  if (!req) throw new NotFoundError('Request');
  if (req.status !== 'requested') throw new ConflictError(`This request is already ${req.status}.`);
  await basePrisma.campusServiceRequest.updateMany({ where: { id: requestId }, data: { status, decidedBy: ctx.userId, decidedAt: new Date(), decisionNote: note ?? null } });
  if (status === 'declined') {
    const s = await studentUser(ctx.institutionId, req.studentProfileId);
    if (s?.user) await notifyInApp(ctx.institutionId, { userIds: [s.user.id] }, {
      eventType: `${req.service}.declined`, subject: `Your ${req.service} request was declined`, body: note ?? '', relatedEntityType: 'CampusServiceRequest', relatedEntityId: requestId
    });
  }
  return { status };
}

/** What a student sees: their room, their bus pass, their requests. */
export async function myServices(ctx: TenantContext, studentProfileId: string) {
  const [room, pass, requests, routeList] = await Promise.all([
    basePrisma.hostelAllocation.findFirst({ where: { studentProfileId, status: 'active' }, include: { hostel: true } }),
    basePrisma.transportAllocation.findFirst({ where: { institutionId: ctx.institutionId, studentProfileId, status: 'active' } }),
    listRequests(ctx, { studentProfileId }),
    basePrisma.transportRoute.findMany({ where: { institutionId: ctx.institutionId, active: true }, orderBy: { code: 'asc' } })
  ]);
  const route = pass ? routeList.find((r) => r.id === pass.routeId) : null;
  return {
    hostel: room ? { hostel: room.hostel.name, block: room.hostel.block, roomNumber: room.roomNumber, roomType: room.roomType, warden: room.hostel.wardenName, wardenPhone: room.hostel.wardenPhone, since: room.checkInDate } : null,
    transport: pass && route ? { route: `${route.code} ${route.name}`, stop: pass.stop, time: (route.stops as unknown as Stop[]).find((s) => s.name === pass.stop)?.time ?? null, vehicleNumber: route.vehicleNumber, driverName: route.driverName, driverPhone: route.driverPhone } : null,
    requests,
    routes: routeList.map((r) => ({ id: r.id, code: r.code, name: r.name, stops: r.stops }))
  };
}
