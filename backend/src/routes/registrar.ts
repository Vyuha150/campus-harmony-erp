import * as campus from '../modules/campus/campusServices.js';
import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { sendError, NotFoundError } from '../lib/errors.js';
import { notifyInApp } from '../lib/inAppNotify.js';
import * as exams from '../modules/coe/exams.service.js';
import * as workflow from '../modules/workflow/workflow.service.js';
import { authorizeRoles } from '../middleware/auth.js';
import { updateExamSchema } from '../modules/coe/exams.schema.js';
import { getTenantContext } from '../lib/tenant.js';
import * as registrarService from '../modules/registrar/registrar.service.js';
import {
  updateStudentRecordSchema,
  decideRequestSchema,
  verificationDecisionSchema,
  workflowFileDecisionSchema,
  registrarDocumentCreateSchema,
  vacancyCreateSchema,
  promotionForwardSchema
} from '../modules/registrar/registrar.schemas.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { z } from 'zod';
import { entityId } from '../schemas/common.js';
import { updateTenantEntity } from '../modules/common/entityUpdate.service.js';
import { deleteTenantEntity } from '../modules/common/entityDelete.service.js';
import {
  updateTransferRequestSchema,
  updateVacancySchema,
  updateAccreditationSchema
} from '../modules/common/entityUpdate.schemas.js';
import {
  createTransferSchema
} from '../modules/common/entityCreate.schemas.js';

const router = Router();

function normalizeText(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeSemester(value: unknown) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

// ─── Dashboard ───
router.get('/dashboard', authenticate, async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    // "Gate Passes" was a security-office count; "Pending Certificates" counted a
    // status nothing used. These are the Registrar's own queues.
    const [activeStudents, toIssue, openVacancies, verifications, awaiting] = await Promise.all([
      prisma.user.count({ where: { role: 'student' } }),
      prisma.certificateRequest.count({ where: { status: 'approved' } }),
      prisma.vacancy.count({ where: { status: { notIn: ['closed', 'joined'] } } }),
      prisma.verificationRequest.count({ where: { status: { in: ['pending', 'processing'] } } }),
      workflow.inbox(ctx, { page: 1, pageSize: 1 })
    ]);

    res.json({
      success: true,
      data: {
        stats: [
          { label: "Awaiting your approval", value: String(awaiting.meta.total), icon: "FileText", color: "text-warning" },
          { label: "Certificates to issue", value: toIssue.toString(), icon: "Award", color: "text-blue-500" },
          { label: "Verification requests", value: verifications.toString(), icon: "Search", color: "text-purple-500" },
          { label: "Open Vacancies", value: openVacancies.toString(), icon: "Briefcase", color: "text-purple-500" },
          { label: "Active Students", value: activeStudents.toString(), icon: "Users" }
        ]
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Student Records ───
router.get('/students', authenticate, async (req: Request, res: Response) => {
  try {
    const query = req.query as Record<string, string | undefined>;
    const { search, program, semester } = query;
    const where: any = { role: 'student' };
    if (search) { where.name = { contains: search, mode: 'insensitive' }; }

    const students = await prisma.user.findMany({
      where, include: { studentProfile: true, department: true }, orderBy: { name: 'asc' }, take: 500
    });

    res.json({
      success: true,
      data: students.filter((s: any) => {
        if (program && s.studentProfile?.program !== program) return false;
        if (semester && s.studentProfile?.semester !== parseInt(semester as string)) return false;
        return true;
      }).map((s: any) => ({
        id: s.id, profileId: s.studentProfile?.id ?? null, name: s.name, email: s.email, rollNumber: s.studentProfile?.rollNumber,
        // The register page reads rollNo / batch; it crashed on search without them.
        rollNo: s.studentProfile?.rollNumber ?? '', batch: s.studentProfile?.batch ?? String(s.studentProfile?.admissionYear ?? ''),
        program: s.studentProfile?.program, semester: s.studentProfile?.semester,
        section: s.studentProfile?.section, department: s.department?.name ?? '',
        admissionYear: s.studentProfile?.admissionYear, cgpa: s.studentProfile?.cgpa,
        category: s.studentProfile?.category ?? null, gender: s.studentProfile?.gender ?? null,
        dob: s.studentProfile?.dateOfBirth ?? null, nationality: s.studentProfile?.nationality ?? null,
        homeState: s.studentProfile?.domicileState ?? null, status: s.deletedAt ? 'discontinued' : 'active'
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/students/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id },
      include: { studentProfile: true, department: true }
    });
    if (!user) { res.status(404).json({ success: false, message: 'Student not found' }); return; }
    res.json({ success: true, data: user });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Amend a student's record.
 *
 * Was:
 *
 *     const { name, email, ...profileData } = req.body;
 *     await prisma.studentProfile.updateMany({ where: { userId: id }, data: profileData });
 *
 * Every column writable for ANY student — cgpa, earnedCredits, semester,
 * rollNumber, admissionYear, programmeId — unvalidated and unaudited. A CGPA
 * could be changed and nothing anywhere would record that it had been, or what
 * it was before. T-104 built GradeHistory so an academic figure could not move
 * without a record; this route went round it.
 *
 * `cgpa`, `totalCredits` and `earnedCredits` are now not editable here at any
 * privilege level: they are derived from published results, and editing the
 * summary would leave it disagreeing with what it summarises. `rollNumber`
 * appears on issued documents and is excluded rather than quietly permitted.
 */
router.put(
  '/students/:id',
  authenticate,
  validate({ params: z.object({ id: entityId }), body: updateStudentRecordSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { reason, ...fields } = req.body as Record<string, unknown> & { reason: string };
    const updated = await registrarService.updateStudentRecord(
      getTenantContext(req),
      String(req.params.id),
      fields,
      reason
    );
    res.json({ success: true, data: updated });
  })
);

// ─── Record Change Requests ───
/** Fields a correction can change, and where each lives. */
const RECORD_FIELDS: Record<string, { on: 'user' | 'profile'; column: string; kind?: 'date' }> = {
  name: { on: 'user', column: 'name' },
  date_of_birth: { on: 'profile', column: 'dateOfBirth', kind: 'date' },
  gender: { on: 'profile', column: 'gender' },
  category: { on: 'profile', column: 'category' },
  home_state: { on: 'profile', column: 'domicileState' },
  nationality: { on: 'profile', column: 'nationality' }
};

async function applyRecordChange(request: { studentId: string; field: string; newValue: string }): Promise<boolean> {
  const target = RECORD_FIELDS[request.field];
  if (!target) return false;
  const profile: any = await prisma.studentProfile.findFirst({ where: { id: request.studentId } });
  if (!profile) return false;
  const value = target.kind === 'date' ? new Date(request.newValue) : request.newValue;
  if (target.on === 'user') await prisma.user.updateMany({ where: { id: profile.userId }, data: { [target.column]: value } });
  else await prisma.studentProfile.updateMany({ where: { id: profile.id }, data: { [target.column]: value } });
  return true;
}

router.get('/record-changes', authenticate, async (req: Request, res: Response) => {
  try {
    const requests = await prisma.recordChangeRequest.findMany({ orderBy: { requestedAt: 'desc' } });
    res.json({ success: true, data: requests });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Decide a record changes request. Previously a status flip with no
 * record of who decided it.
 */
router.put(
  '/record-changes/:id',
  authenticate,
  validate({ params: z.object({ id: entityId }), body: decideRequestSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as { status: string; note?: string };
    const ctx = getTenantContext(req);
    const request: any = await prisma.recordChangeRequest.findFirst({ where: { id: String(req.params.id) } });
    if (!request) throw new NotFoundError('Record change request');
    if (request.status !== 'pending') {
      res.status(409).json({ success: false, message: `This request is already ${request.status}.` });
      return;
    }
    const updated = await registrarService.decideRequest(ctx, {
      model: 'recordChangeRequest',
      entity: 'RecordChangeRequest',
      id: String(req.params.id),
      status: body.status,
      note: body.note
    });
    // Approving used to change only the request's status, never the record.
    let applied = false;
    if (body.status === 'approved') applied = await applyRecordChange(request);
    const profile: any = await prisma.studentProfile.findFirst({ where: { id: request.studentId } });
    if (profile) {
      await notifyInApp(ctx.institutionId, { userIds: [profile.userId] }, {
        eventType: `record_change.${body.status}`, subject: `Your ${request.field} correction was ${body.status}`,
        body: body.status === 'approved' ? (applied ? `Your record now shows: ${request.newValue}.` : 'Approved; the office will update the paper file.') : (body.note ?? 'Contact the Registrar\'s office.'),
        relatedEntityType: 'RecordChangeRequest', relatedEntityId: request.id
      });
    }
    res.json({ success: true, data: { ...updated, applied } });
  })
);

// ─── Transfers ───
router.get('/transfers', authenticate, async (req: Request, res: Response) => {
  try {
    const transfers = await prisma.transferRequest.findMany({ orderBy: { requestedAt: 'desc' } });
    res.json({ success: true, data: transfers });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post(
  '/transfers',
  authenticate,
  validate({ body: createTransferSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    // Was `data: req.body`. `tsc` could not see that — req.body is `any` —
    // so it compiled cleanly while accepting every column. The tenant key is
    // injected by the Prisma extension and is NOT read from the body.
    const body = req.body as z.infer<typeof createTransferSchema>;
    const record = await prisma.transferRequest.create({
      data: {
        ...body,
      } as any
    });

    res.status(201).json({ success: true, data: record });
  })
);

router.put(
  '/transfers/:id',
  authenticate,
  validate({ params: z.object({ id: entityId }), body: updateTransferRequestSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = getTenantContext(req);
    const before: any = await prisma.transferRequest.findFirst({ where: { id: String(req.params.id) } });
    if (!before) throw new NotFoundError('Transfer request');
    const updated = await updateTenantEntity(ctx, {
      model: 'transferRequest',
      entity: 'TransferRequest',
      module: 'registrar',
      id: String(req.params.id),
      data: req.body as Record<string, unknown>
    });
    // Completing an intra-university transfer moves the student to the new department.
    let moved = false;
    if (req.body.status === 'completed' && before.status !== 'completed' && before.type === 'intra_university') {
      const to: any = await prisma.department.findFirst({ where: { name: before.toInstitution } });
      const profile: any = await prisma.studentProfile.findFirst({ where: { OR: [{ id: before.studentId }, { userId: before.studentId }] } });
      if (to && profile) {
        await prisma.user.updateMany({ where: { id: profile.userId }, data: { departmentId: to.id } });
        await prisma.studentProfile.updateMany({ where: { id: profile.id }, data: { branch: to.name } });
        moved = true;
      }
    }
    // A transfer names the student by profile id (seed) or user id (the Registrar's student list).
    const student: any = await prisma.studentProfile.findFirst({ where: { OR: [{ id: before.studentId }, { userId: before.studentId }] } });
    if (student && req.body.status) {
      await notifyInApp(ctx.institutionId, { userIds: [student.userId] }, {
        eventType: 'transfer.updated', subject: `Your transfer request: ${String(req.body.status).replace(/_/g, ' ')}`,
        body: req.body.remarks ?? (moved ? `You are now in ${before.toInstitution}.` : 'See the Registrar\'s office for details.'),
        relatedEntityType: 'TransferRequest', relatedEntityId: before.id
      });
    }
    res.json({ success: true, data: { ...(updated as object), moved } });
  })
);

// ─── Certificates ───
const CERT_PREFIX: Record<string, string> = { bonafide: 'BON', transcript: 'TRN', migration: 'MIG', transfer: 'TC', degree: 'DEG', provisional: 'PRV', character: 'CHR' };
const certStatus = (status: string) => (status === 'processing' ? 'pending' : status);

/**
 * Every certificate request, with where its approval stands. A request is
 * approved by Finance (no dues) → HOD (verified) → Registrar (CERTIFICATE_ISSUE);
 * once approved the Registrar issues it (a verifiable number) and records collection.
 */
router.get('/certificates', authenticate, async (req: Request, res: Response) => {
  try {
    const certs = await prisma.certificateRequest.findMany({
      include: { student: { include: { user: { include: { department: true } } } } },
      orderBy: { requestedAt: 'desc' }
    });
    const instances = await prisma.workflowInstance.findMany({
      where: { entityType: 'CertificateRequest', entityId: { in: certs.map((c: any) => c.id) } },
      include: { definition: { include: { steps: { orderBy: { sequence: 'asc' } } } }, transitions: true },
      orderBy: { startedAt: 'desc' }
    });
    res.json({
      success: true,
      data: certs.map((c: any) => {
        const inst: any = instances.find((i: any) => i.entityId === c.id);
        const steps = inst?.definition.steps.map((step: any) => {
          const decided = inst.transitions.filter((t: any) => t.fromStepId === step.id && t.action !== 'started').pop();
          return { role: step.assigneeRole, state: decided ? decided.action : step.id === inst.currentStepId && inst.status === 'pending' ? 'current' : 'upcoming' };
        }) ?? [];
        return {
          id: c.id, type: c.type, purpose: c.purpose, copies: c.copies, fee: c.fee,
          status: certStatus(c.status), requestedAt: c.requestedAt,
          certificateNumber: c.certificateNumber ?? null, issuedAt: c.issuedAt ?? null, collectedAt: c.collectionDate ?? null,
          studentName: c.student.user.name, rollNumber: c.student.rollNumber, program: c.student.program,
          department: c.student.user.department?.name ?? null, semester: c.student.semester,
          instanceId: inst?.id ?? null, waitingOn: steps.find((x: any) => x.state === 'current')?.role ?? null, steps
        };
      })
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

/** Look up an issued certificate by its number (employers, other universities). */
router.get('/certificates/verify', authenticate, async (req: Request, res: Response) => {
  try {
    const q = String(req.query.number ?? '').trim();
    if (!q) {
      res.status(400).json({ success: false, message: 'Give a certificate number' });
      return;
    }
    const cert: any = await prisma.certificateRequest.findFirst({
      where: { certificateNumber: q },
      include: { student: { include: { user: true } } }
    });
    res.json({
      success: true,
      data: cert && ['issued', 'collected'].includes(cert.status)
        ? { valid: true, certificateNumber: cert.certificateNumber, type: cert.type, studentName: cert.student.user.name, rollNumber: cert.student.rollNumber, program: cert.student.program, issuedAt: cert.issuedAt }
        : { valid: false }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Issue an approved certificate, or record that it was collected. The page sent
 * statuses ("generated", "printed") the server refused, and nothing checked
 * that the request had been approved first.
 */
router.put(
  '/certificates/:id',
  authenticate,
  authorizeRoles('registrar', 'super_admin'),
  validate({ params: z.object({ id: entityId }), body: z.object({ action: z.enum(['issue', 'collected']), note: z.string().trim().max(500).optional() }).strict() }),
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = getTenantContext(req);
    const cert: any = await prisma.certificateRequest.findFirst({ where: { id: String(req.params.id) }, include: { student: true } });
    if (!cert) throw new NotFoundError('Certificate request');
    const status = certStatus(cert.status);
    if (req.body.action === 'issue') {
      if (status !== 'approved') {
        res.status(409).json({ success: false, message: status === 'pending' ? 'It is still being approved (Finance → HOD → Registrar). Approve it from Approvals first.' : `It is already ${status}.` });
        return;
      }
      const year = new Date().getFullYear();
      const prefix = `CH/${CERT_PREFIX[cert.type] ?? 'CRT'}/${year}/`;
      const count = await prisma.certificateRequest.count({ where: { certificateNumber: { startsWith: prefix } } });
      const certificateNumber = `${prefix}${String(count + 1).padStart(4, '0')}`;
      await prisma.certificateRequest.updateMany({ where: { id: cert.id }, data: { status: 'issued', certificateNumber, issuedAt: new Date(), issuedBy: ctx.userId } });
      await notifyInApp(ctx.institutionId, { userIds: [cert.student.userId] }, {
        eventType: 'certificate.issued', subject: `Your ${cert.type} certificate is ready`,
        body: `Certificate ${certificateNumber}. Collect it from the Registrar's office.`, relatedEntityType: 'CertificateRequest', relatedEntityId: cert.id
      });
    } else {
      if (status !== 'issued') {
        res.status(409).json({ success: false, message: 'Only an issued certificate can be marked collected.' });
        return;
      }
      await prisma.certificateRequest.updateMany({ where: { id: cert.id }, data: { status: 'collected', collectionDate: new Date() } });
    }
    res.json({ success: true, data: await prisma.certificateRequest.findFirst({ where: { id: cert.id } }) });
  })
);

/** Final-year students — the graduands for the next convocation. */
router.get('/graduands', authenticate, async (_req: Request, res: Response) => {
  try {
    const students = await prisma.studentProfile.findMany({
      where: { semester: { gte: 7 } },
      include: { user: { include: { department: true } } },
      orderBy: { rollNumber: 'asc' }
    });
    res.json({
      success: true,
      data: students.map((s: any) => ({ id: s.id, name: s.user?.name, rollNumber: s.rollNumber, program: s.program, department: s.user?.department?.name ?? null, semester: s.semester, cgpa: s.cgpa, batch: s.batch }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Verification Requests ───
router.get('/verifications', authenticate, async (req: Request, res: Response) => {
  try {
    const verifications = await prisma.verificationRequest.findMany({ orderBy: { receivedAt: 'desc' } });
    res.json({ success: true, data: verifications });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Decide a verifications request. Previously a status flip with no record of
 * who decided it — then, once audited, still broken: it had been wired to
 * decideRequestSchema's generic approval enum, which RegistrarQueries.tsx's
 * real pending/processing/responded workflow can't express (verified live —
 * every "Mark In Progress" and "Send Response" click 400'd). Its own schema
 * now, and the response text this route never used to save at all.
 */
router.put(
  '/verifications/:id',
  authenticate,
  validate({ params: z.object({ id: entityId }), body: verificationDecisionSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as { status: string; response?: string };
    const updated = await registrarService.decideRequest(getTenantContext(req), {
      model: 'verificationRequest',
      entity: 'VerificationRequest',
      id: String(req.params.id),
      status: body.status,
      response: body.response
    });
    res.json({ success: true, data: updated });
  })
);

// ─── Exam Oversight ───
//
// Reads through the SAME service the CoE screen uses, rather than a second
// implementation over the same table.
//
// The handler this replaces produced different numbers from the same rows.
// It ignored the stored `totalStudents` and inferred a cohort instead,
// falling through three guesses to "every student profile in the system" —
// so an exam for one programme could report the whole university as its
// cohort. It then forced `marksEntered = totalStudents` for anything
// published, which is a progress bar that always reads complete at the end
// regardless of what was actually entered.
//
// `coe/exams.service.ts` had already removed exactly these two inventions
// and recorded why: "If a stored figure is wrong, the fix belongs where the
// figure is written, not in a display path that quietly overwrites it." The
// registrar screen kept showing the invented figures while the CoE screen
// showed honest ones, for the same examinations.
router.get(
  '/exams',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    // Response shape unchanged — the screen receives the same flat `data`
    // array it always has, with honest figures in it now.
    const result = await exams.listExams(getTenantContext(req), { page: 1, pageSize: 200 });
    res.json({ success: true, data: result.data, meta: result.meta });
  })
);

// Phase 3a. This handler carried the SAME line as coe.ts:
//
//     prisma.examProgress.update({ where: { id }, data: req.body })
//
// A unique-key update the tenant extension cannot constrain, carrying an
// unfiltered request body. Both now go through one service, so the rule holds in
// both places and cannot drift apart again.
router.put(
  '/exams/:id',
  authenticate,
  validate({ params: z.object({ id: z.string().trim().min(1).max(80) }), body: updateExamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await exams.updateExam(
      getTenantContext(req),
      String(req.params.id),
      req.body
    );
    res.json({ success: true, data: updated });
  })
);

// ─── Documents ───
router.get('/documents', authenticate, async (req: Request, res: Response) => {
  try {
    const docs = await prisma.adminDocument.findMany({ orderBy: { uploadedAt: 'desc' } });
    res.json({ success: true, data: docs });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/admindocuments', authenticate, async (req: Request, res: Response) => {
  try {
    const docs = await prisma.adminDocument.findMany({ orderBy: { uploadedAt: 'desc' } });
    res.json({ success: true, data: docs });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/workflow-files', authenticate, async (_req: Request, res: Response) => {
  try {
    const items = await prisma.approvalItem.findMany({ orderBy: { requestedAt: 'desc' }, take: 50 });

    const requesterIds = Array.from(new Set(items.map((item: any) => String(item.requestedBy || '')).filter(Boolean)));
    const users = requesterIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: requesterIds } }, select: { id: true, name: true } })
      : [];
    const userNameById = new Map(users.map((user: any) => [user.id, user.name]));

    const mapType = (type: string) => {
      const normalized = normalizeText(type);
      if (normalized.includes('policy')) return 'policy';
      if (normalized.includes('transfer')) return 'transfer';
      if (normalized.includes('certificate')) return 'certificate';
      if (normalized.includes('budget') || normalized.includes('finance')) return 'budget';
      if (normalized.includes('hire') || normalized.includes('recruit')) return 'recruitment';
      if (normalized.includes('record')) return 'record_change';
      if (normalized.includes('affiliation')) return 'affiliation';
      return 'general';
    };

    const data = items.map((item: any) => ({
      id: item.id,
      type: mapType(item.type),
      title: item.title,
      description: item.details,
      submittedBy: userNameById.get(item.requestedBy) || item.requestedBy,
      submittedAt: item.requestedAt,
      status: item.status,
      priority: item.priority || 'medium',
      remarks: undefined,
      documents: []
    }));

    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put('/workflow-files/:id', authenticate, validate({ body: workflowFileDecisionSchema }), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status, remarks } = req.body;

    const existing = await prisma.approvalItem.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Workflow file not found' });
      return;
    }

    const remarkText = String(remarks || '').trim();
    const nextDetails = remarkText.length > 0
      ? `${existing.details || ''}\n\nRegistrar Note: ${remarkText}`.trim()
      : existing.details;

    // updateMany, not update-by-id: `id` arrives from the request, and the tenant
    // extension can constrain a `where` clause but cannot filter a unique-key
    // update. Before this, an id from another institution was enough to decide
    // their approval.
    const nextStatus = String(status || existing.status);
    const ALLOWED_DECISIONS = ['pending', 'approved', 'rejected', 'forwarded', 'published'];
    if (!ALLOWED_DECISIONS.includes(nextStatus)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `status must be one of: ${ALLOWED_DECISIONS.join(', ')}.` }
      });
      return;
    }

    const changed = await prisma.approvalItem.updateMany({
      where: { id },
      data: {
        status: nextStatus,
        details: nextDetails,
        decidedBy: getTenantContext(req).userId,
        decidedAt: new Date()
      }
    });

    if (changed.count === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No approval with that id.' }
      });
      return;
    }

    const updated = await prisma.approvalItem.findFirst({ where: { id } });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/documents', authenticate, validate({ body: registrarDocumentCreateSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const {
      title,
      category,
      tags,
      isConfidential,
      accessRoles,
      filePath,
      fileUrl,
      fileName,
      mimeType,
      fileSize
    } = req.body;

    const normalizedTags = Array.isArray(tags) ? tags : [];
    const normalizedRoles = Array.isArray(accessRoles) ? accessRoles : [];
    const doc = await prisma.adminDocument.create({
      data: {
        institutionId: getTenantContext(req).institutionId,
        title,
        category,
        uploadedBy: userId,
        filePath,
        fileUrl,
        fileName,
        mimeType,
        fileSize: fileSize || '0 KB',
        tags: normalizedTags,
        isConfidential: Boolean(isConfidential),
        accessRoles: normalizedRoles
      }
    });
    res.json({ success: true, data: doc });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Was `prisma.adminDocument.delete({ where: { id } })` — no reason, no
 * audit trail. These are the institution's own government orders, UGC
 * communications, circulars, minutes and audit reports; losing the record
 * of who removed one and why is the same defect Phase 3c's delete sweep
 * closed everywhere else. AdminDocument has no dependents to block on.
 */
router.delete(
  '/documents/:id',
  authenticate,
  validate({
    params: z.object({ id: entityId }),
    body: z.object({ reason: z.string().trim().min(10).max(500) }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await deleteTenantEntity(getTenantContext(req), {
      model: 'adminDocument',
      entity: 'AdminDocument',
      module: 'registrar',
      id: String(req.params.id),
      reason: String(req.body.reason)
    });

    res.json({ success: true, data: result });
  })
);

// ─── HR / Establishment ───
router.get('/hr/summary', authenticate, async (req: Request, res: Response) => {
  try {
    const [vacancies, promotions, retirements] = await Promise.all([
      prisma.vacancy.findMany(),
      prisma.promotionRequest.findMany({ where: { status: 'pending' } }),
      prisma.retirementRequest.findMany({ where: { status: 'pending' } })
    ]);
    
    // Separate teaching and non-teaching vacancies
    const teaching = vacancies.filter(v => v.type === 'teaching');
    const nonTeaching = vacancies.filter(v => v.type === 'non_teaching');
    
    // Calculate totals
    const teachingFilled = teaching.reduce((sum: number, v: any) => sum + (v.filled || 0), 0);
    const teachingSanctioned = teaching.reduce((sum: number, v: any) => sum + (v.sanctioned || 0), 0);
    const nonTeachingFilled = nonTeaching.reduce((sum: number, v: any) => sum + (v.filled || 0), 0);
    const nonTeachingSanctioned = nonTeaching.reduce((sum: number, v: any) => sum + (v.sanctioned || 0), 0);
    
    res.json({
      success: true,
      data: {
        totalFilled: teachingFilled + nonTeachingFilled,
        totalSanctioned: teachingSanctioned + nonTeachingSanctioned,
        teaching: { filled: teachingFilled, sanctioned: teachingSanctioned },
        nonTeaching: { filled: nonTeachingFilled, sanctioned: nonTeachingSanctioned },
        pendingPromotions: promotions.length,
        pendingRetirements: retirements.length,
        activeRecruitments: vacancies.filter(v => !['joined', 'closed'].includes(v.status)).length,
        vacancy_summary: vacancies.map((v: any) => ({
          position: v.position,
          department: v.department,
          sanctioned: v.sanctioned,
          filled: v.filled,
          vacant: Math.max(0, v.sanctioned - v.filled),
          status: v.status
        }))
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/hr/vacancies', authenticate, async (req: Request, res: Response) => {
  try {
    const vacancies = await prisma.vacancy.findMany({ orderBy: { postedAt: 'desc' } });
    res.json({ success: true, data: vacancies });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.post('/hr/vacancies', authenticate, validate({ body: vacancyCreateSchema }), async (req: Request, res: Response) => {
  try {
    const { position, department, type, sanctioned, filled, status, postedAt, lastDate, applicants } = req.body;
    const vacancy = await prisma.vacancy.create({
      data: {
        institutionId: getTenantContext(req).institutionId,
        position,
        department,
        type,
        sanctioned: sanctioned || 1,
        filled: filled || 0,
        status: status || 'advertised',
        postedAt: postedAt ? new Date(postedAt) : new Date(),
        lastDate: lastDate ? new Date(lastDate) : new Date(Date.now() + 30 * 86400000),
        applicants: applicants || 0,
      }
    });
    res.json({ success: true, data: vacancy });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put(
  '/hr/vacancies/:id',
  authenticate,
  validate({ params: z.object({ id: entityId }), body: updateVacancySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await updateTenantEntity(getTenantContext(req), {
      model: 'vacancy',
      entity: 'Vacancy',
      module: 'hr',
      id: String(req.params.id),
      data: req.body as Record<string, unknown>
    });

    res.json({ success: true, data: updated });
  })
);


// ─── Accreditation ───
router.get('/accreditation', authenticate, async (req: Request, res: Response) => {
  try {
    const checklists = await prisma.accreditationChecklist.findMany();
    res.json({ success: true, data: checklists });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.put(
  '/accreditation/:id',
  authenticate,
  validate({ params: z.object({ id: entityId }), body: updateAccreditationSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await updateTenantEntity(getTenantContext(req), {
      model: 'accreditationChecklist',
      entity: 'AccreditationChecklist',
      module: 'accreditation',
      id: String(req.params.id),
      data: req.body as Record<string, unknown>
    });

    res.json({ success: true, data: updated });
  })
);

/**
 * "Remind" only showed a "Reminder Sent" toast. It now puts an in-app
 * notification in front of whoever holds the responsible office.
 */
const OFFICE_ROLES: Array<[RegExp, string[]]> = [
  [/iqac/i, ['iqac_coordinator']],
  [/research|dean/i, ['dean']],
  [/placement|training/i, ['placement_officer']],
  [/principal/i, ['principal']],
  [/registrar|admin/i, ['registrar']],
  [/exam|coe|controller/i, ['coe']],
  [/financ|account/i, ['finance_officer']],
  [/librar/i, ['librarian']],
  [/sport/i, ['sports_director']],
  [/alumni/i, ['alumni_officer']],
  [/hod|head/i, ['hod']]
];

router.post(
  '/accreditation/:id/remind',
  authenticate,
  validate({ params: z.object({ id: entityId }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const context = getTenantContext(req);
    const item = await prisma.accreditationChecklist.findFirst({ where: { id: String(req.params.id) } });
    if (!item) throw new NotFoundError('Accreditation item');

    const office = String(item.responsibleOffice || '');
    const roles = OFFICE_ROLES.filter(([pattern]) => pattern.test(office)).flatMap(([, r]) => r);
    // "HOD CSE" → only the CSE head.
    const deptCode = /hod\s+(\w+)/i.exec(office)?.[1];
    const department = deptCode
      ? await prisma.department.findFirst({ where: { code: deptCode.toUpperCase() }, select: { id: true } })
      : null;

    const sent = roles.length
      ? await notifyInApp(
          context.institutionId,
          { roles: [roles[0]!], departmentId: department?.id ?? null, excludeUserId: context.userId },
          {
            eventType: 'accreditation.reminder',
            subject: `${item.framework} data pending: ${item.criterion}`,
            body: `The Registrar's office is waiting for your submission${item.deadline ? ` (due ${item.deadline.toLocaleDateString('en-IN')})` : ''}.`,
            relatedEntityType: 'AccreditationChecklist',
            relatedEntityId: item.id
          }
        )
      : 0;

    res.json({ success: true, data: { office, recipients: sent } });
  })
);

// ─── Queries ───
router.get('/queries', authenticate, async (req: Request, res: Response) => {
  try {
    const queries = await prisma.verificationRequest.findMany({
      where: { type: { in: ['rti', 'employer_verification', 'background_check'] } },
      orderBy: { receivedAt: 'desc' }
    });
    res.json({ success: true, data: queries });
  } catch (error: any) {
    sendError(res, error);
  }
});

// PUT /queries/:id removed: a raw, unscoped, unaudited duplicate of PUT
// /verifications/:id above, which now covers everything this one did
// (including saving `response`) safely. No frontend caller ever used this
// path — confirmed by grep — only /verifications/:id.

// ─── Promotions ───
router.get('/promotions', authenticate, async (req: Request, res: Response) => {
  try {
    const promotions = await prisma.promotionRequest.findMany({ orderBy: { appliedAt: 'desc' } });
    const people = await prisma.facultyProfile.findMany({
      where: { id: { in: promotions.map((p: any) => p.facultyProfileId) } },
      include: { user: { include: { department: true } } }
    });
    const instances = await prisma.workflowInstance.findMany({
      where: { entityType: 'PromotionRequest', entityId: { in: promotions.map((p: any) => p.id) } },
      include: { definition: { include: { steps: true } } }
    });
    res.json({
      success: true,
      data: promotions.map((p: any) => {
        const who: any = people.find((x: any) => x.id === p.facultyProfileId);
        const inst: any = instances.find((i: any) => i.entityId === p.id);
        return {
          ...p, name: who?.user?.name ?? 'Faculty', department: who?.user?.department?.name ?? null,
          instanceId: inst?.id ?? null,
          waitingOn: inst?.status === 'pending' ? inst.definition.steps.find((x: any) => x.id === inst.currentStepId)?.assigneeRole ?? null : null
        };
      })
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Decide a promotions request. Previously a status flip with no
 * record of who decided it.
 */
// ─── Retirements ───
router.get('/retirements', authenticate, async (req: Request, res: Response) => {
  try {
    const retirements = await prisma.retirementRequest.findMany({ orderBy: { lastDate: 'asc' } });
    const people = await prisma.facultyProfile.findMany({ where: { id: { in: retirements.map((r: any) => r.facultyProfileId) } }, include: { user: { include: { department: true } } } });
    res.json({
      success: true,
      data: retirements.map((r: any) => {
        const who: any = people.find((x: any) => x.id === r.facultyProfileId);
        return { ...r, name: who?.user?.name ?? 'Staff member', department: who?.user?.department?.name ?? null };
      })
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * Decide a retirements request. Previously a status flip with no
 * record of who decided it.
 */
router.put(
  '/retirements/:id',
  authenticate,
  validate({ params: z.object({ id: entityId }), body: decideRequestSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as { status: string; note?: string };
    const updated = await registrarService.decideRequest(getTenantContext(req), {
      model: 'retirementRequest',
      entity: 'RetirementRequest',
      id: String(req.params.id),
      status: body.status,
      note: body.note
    });
    res.json({ success: true, data: updated });
  })
);


// ─── Hostel & transport (student services) ───
const REGISTRAR_OFFICE = authorizeRoles('registrar', 'super_admin');
const stopSchema = z.object({ name: z.string().trim().min(1).max(80), time: z.string().trim().max(10), fee: z.number().min(0).max(1000000) }).strict();
const hostelSchema = z.object({
  name: z.string().trim().min(2).max(120), block: z.string().trim().min(1).max(40), wardenName: z.string().trim().min(2).max(120), wardenPhone: z.string().trim().min(6).max(20),
  capacity: z.number().int().min(1).max(5000).optional(), hostelType: z.enum(['boys', 'girls', 'staff']).optional(), feePerSemester: z.number().min(0).max(1000000).optional()
}).strict();
const routeSchema = z.object({
  code: z.string().trim().min(1).max(20), name: z.string().trim().min(2).max(120), vehicleNumber: z.string().trim().max(20).optional(),
  driverName: z.string().trim().max(120).optional(), driverPhone: z.string().trim().max(20).optional(), capacity: z.number().int().min(1).max(200),
  stops: z.array(stopSchema).min(1).max(40), active: z.boolean().optional()
}).strict();

router.get('/hostels', authenticate, asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await campus.hostels(getTenantContext(req)) });
}));
router.post('/hostels', authenticate, REGISTRAR_OFFICE, validate({ body: hostelSchema }), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await campus.saveHostel(getTenantContext(req), null, req.body) });
}));
router.put('/hostels/:id', authenticate, REGISTRAR_OFFICE, validate({ params: z.object({ id: entityId }), body: hostelSchema }), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await campus.saveHostel(getTenantContext(req), String(req.params.id), req.body) });
}));
router.post('/hostel-allocations', authenticate, REGISTRAR_OFFICE, validate({ body: z.object({ hostelId: entityId, studentProfileId: entityId, roomNumber: z.string().trim().min(1).max(20), roomType: z.enum(['single', 'double', 'triple', 'dormitory']), requestId: entityId.optional() }).strict() }), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await campus.allocateHostel(getTenantContext(req), req.body) });
}));
router.post('/hostel-allocations/:id/vacate', authenticate, REGISTRAR_OFFICE, validate({ params: z.object({ id: entityId }) }), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await campus.vacateHostel(getTenantContext(req), String(req.params.id)) });
}));
router.get('/transport-routes', authenticate, asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await campus.routes(getTenantContext(req)) });
}));
router.post('/transport-routes', authenticate, REGISTRAR_OFFICE, validate({ body: routeSchema }), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await campus.saveRoute(getTenantContext(req), null, req.body) });
}));
router.put('/transport-routes/:id', authenticate, REGISTRAR_OFFICE, validate({ params: z.object({ id: entityId }), body: routeSchema }), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await campus.saveRoute(getTenantContext(req), String(req.params.id), req.body) });
}));
router.post('/transport-allocations', authenticate, REGISTRAR_OFFICE, validate({ body: z.object({ routeId: entityId, studentProfileId: entityId, stop: z.string().trim().min(1).max(80), requestId: entityId.optional() }).strict() }), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await campus.allocateTransport(getTenantContext(req), req.body) });
}));
router.post('/transport-allocations/:id/cancel', authenticate, REGISTRAR_OFFICE, validate({ params: z.object({ id: entityId }) }), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await campus.cancelTransport(getTenantContext(req), String(req.params.id)) });
}));
router.get('/service-requests', authenticate, asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await campus.listRequests(getTenantContext(req)) });
}));
router.post('/service-requests/:id/decline', authenticate, REGISTRAR_OFFICE, validate({ params: z.object({ id: entityId }), body: z.object({ note: z.string().trim().min(10).max(500) }).strict() }), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await campus.decideRequest(getTenantContext(req), String(req.params.id), 'declined', req.body.note) });
}));

export default router;
