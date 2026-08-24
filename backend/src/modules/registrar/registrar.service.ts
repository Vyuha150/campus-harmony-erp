/**
 * Registrar service (Phase 3b).
 *
 * The registrar holds the records of record: who is enrolled, under what roll
 * number, in which programme and semester — and issues the certificates and
 * verifications that third parties rely on.
 *
 * WHAT WAS WRONG
 *
 *   1. `PUT /students/:id` SPREAD THE REQUEST BODY INTO THE ACADEMIC RECORD:
 *
 *          const { name, email, ...profileData } = req.body;
 *          await prisma.studentProfile.updateMany({ where: { userId: id }, data: profileData });
 *
 *      Every column was writable for ANY student — `cgpa`, `earnedCredits`,
 *      `semester`, `rollNumber`, `admissionYear`, `programmeId`. Unvalidated and
 *      completely unaudited, so a CGPA could be changed and nothing anywhere
 *      would record that it had been, or what it was before.
 *
 *      This is the same shape as the student self-service hole closed earlier,
 *      but with a registrar's reach and applied to anyone. T-104 built
 *      GradeHistory precisely so an academic figure could not move without a
 *      record; this route went round it.
 *
 *   2. ISSUANCE WAS UNAUDITED. Certificates and degree verifications — the
 *      documents employers and other universities act on — were issued by a
 *      status flip with no record of who issued them.
 *
 * WHAT THE REGISTRAR MAY AND MAY NOT CHANGE HERE
 *
 * `cgpa`, `totalCredits` and `earnedCredits` are DERIVED from published results
 * and are not editable through this route at any privilege level. If a result is
 * wrong, the correction belongs in the results flow, which recomputes them and
 * records a grade history. Editing the summary would leave it disagreeing with
 * the results it is supposed to summarise.
 *
 * `rollNumber` is an identity that appears on issued documents. Changing it is a
 * deliberate act with its own consequences, not a field edit, so it is excluded
 * here rather than quietly permitted.
 */

import { basePrisma } from '../../lib/prisma.js';
import { mutate } from '../../lib/service.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import type { TenantContext } from '../../lib/tenant.js';

export interface UpdateStudentRecordInput {
  name?: string | undefined;
  email?: string | undefined;
  program?: string | undefined;
  branch?: string | undefined;
  section?: string | undefined;
  batch?: string | undefined;
  semester?: number | undefined;
  gender?: string | null | undefined;
  category?: string | null | undefined;
  domicileState?: string | null | undefined;
  nationality?: string | null | undefined;
  isDifferentlyAbled?: boolean | undefined;
  isHosteller?: boolean | undefined;
}

/**
 * Amend a student's record.
 *
 * Audited at `warning` with before and after, because this is the register. A
 * semester change in particular decides exam eligibility and fee liability, so
 * the reason it happened needs to survive the person who made it.
 */
export async function updateStudentRecord(
  context: TenantContext,
  userId: string,
  input: UpdateStudentRecordInput,
  reason: string
) {
  if (!reason || reason.trim().length < 10) {
    throw new ValidationError(
      'A reason of at least 10 characters is required to amend a student record.',
      { field: 'reason' }
    );
  }

  const user = await basePrisma.user.findFirst({
    where: { id: userId, institutionId: context.institutionId },
    select: { id: true, name: true, email: true }
  });
  if (!user) throw new NotFoundError(`Student ${userId}`);

  const profile = await basePrisma.studentProfile.findFirst({
    where: { userId, institutionId: context.institutionId },
    select: {
      id: true, rollNumber: true, program: true, branch: true,
      section: true, batch: true, semester: true, cgpa: true
    }
  });
  if (!profile) throw new NotFoundError(`Student profile for ${userId}`);

  const { name, email, ...profileFields } = input;
  const changed = Object.keys(input);

  return mutate(
    context,
    {
      action: 'UPDATE',
      module: 'registrar',
      resource: `StudentProfile:${profile.id}`,
      details: `Amended ${changed.join(', ')} on the record of ${user.name} (${profile.rollNumber})`,
      oldValue: JSON.stringify({
        name: user.name,
        email: user.email,
        program: profile.program,
        branch: profile.branch,
        section: profile.section,
        batch: profile.batch,
        semester: profile.semester,
        // Recorded but NOT editable — so the audit shows it was unchanged.
        cgpa: profile.cgpa
      }),
      newValue: JSON.stringify(input),
      reason: reason.trim(),
      severity: 'warning'
    },
    async (tx) => {
      if (name !== undefined || email !== undefined) {
        await tx.user.updateMany({
          where: { id: userId, institutionId: context.institutionId },
          data: {
            ...(name !== undefined ? { name } : {}),
            ...(email !== undefined ? { email } : {})
          }
        });
      }

      if (Object.keys(profileFields).length > 0) {
        await tx.studentProfile.updateMany({
          where: { userId, institutionId: context.institutionId },
          data: profileFields as never
        });
      }

      return tx.studentProfile.findFirst({
        where: { userId, institutionId: context.institutionId }
      });
    }
  );
}

/**
 * Decide a request that the registrar handles: a certificate, a verification, a
 * record change, a promotion or a retirement.
 *
 * One helper because the shape is identical across all five — a status flip on a
 * row the registrar owns — and each was previously unaudited. A degree
 * verification is acted on by employers and other universities; issuing one with
 * no record of who issued it makes the institution unable to answer the only
 * question that matters afterwards.
 */
export async function decideRequest(
  context: TenantContext,
  spec: {
    model: 'certificateRequest' | 'verificationRequest' | 'recordChangeRequest' | 'promotionRequest' | 'retirementRequest';
    entity: string;
    id: string;
    status: string;
    note?: string | undefined;
    /** Column carrying the decider, where the model has one. */
    decidedByField?: string | undefined;
  }
) {
  const delegate = (basePrisma as unknown as Record<string, any>)[spec.model];

  const existing = await delegate.findFirst({
    where: { id: spec.id, institutionId: context.institutionId }
  });
  if (!existing) throw new NotFoundError(`${spec.entity} ${spec.id}`);

  return mutate(
    context,
    {
      action: spec.status === 'rejected' ? 'REJECT' : 'APPROVE',
      module: 'registrar',
      resource: `${spec.entity}:${spec.id}`,
      details: `${spec.entity} ${spec.id} marked ${spec.status}`,
      oldValue: JSON.stringify({ status: existing.status }),
      newValue: JSON.stringify({ status: spec.status, note: spec.note ?? null }),
      severity: 'warning'
    },
    async (tx) => {
      const txDelegate = (tx as unknown as Record<string, any>)[spec.model];
      const result = await txDelegate.updateMany({
        where: { id: spec.id, institutionId: context.institutionId },
        data: {
          status: spec.status,
          ...(spec.decidedByField ? { [spec.decidedByField]: context.userId } : {})
        }
      });
      if (result.count === 0) throw new NotFoundError(`${spec.entity} ${spec.id}`);
      return txDelegate.findFirst({
        where: { id: spec.id, institutionId: context.institutionId }
      });
    }
  );
}
