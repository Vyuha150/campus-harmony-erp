/**
 * Validation schemas for the 5 `vc.ts` write handlers still on an unvalidated
 * `req.body` (Phase 3c completion). Same rationale as
 * `modules/hod/hod.schemas.ts`.
 */

import { z } from 'zod';

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const optionalTrimmed = (max: number) => z.string().trim().max(max).optional();

/**
 * PUT /approvals/:id.
 *
 * `status` includes `pending` alongside the three real decisions: VCApprovals.tsx
 * and VCDashboard.tsx's "Forward to Board of Management" action sends
 * `status: 'pending'`, not `'forwarded'` — the item stays pending for the next
 * approver rather than settling into a `forwarded` state, and `pending` is
 * already the column's own documented, CHECK-constrained default (see
 * ApprovalItem.status in schema.prisma). `notes` is real — both callers always
 * send it — and reaches `decisionNote`, the column both this route and HOD's
 * equivalent (`hod.ts` PUT /approvals/:id) write to.
 *
 * `forwardedFrom` (also sent by both callers, always the literal
 * `'Vice Chancellor'`) is NOT accepted: `ApprovalItem` has no column for it,
 * and the value carries no information beyond what `decidedBy` already
 * records. Left as a follow-up rather than a schema field with nowhere to go.
 */
export const vcApprovalDecisionSchema = z
  .object({
    status: z.enum(['approved', 'rejected', 'forwarded', 'pending']),
    notes: z.string().trim().max(500).optional()
  })
  .strict();

/** POST /policyscenarios and POST /policies/simulate — near-identical bodies. */
export const policyScenarioCreateSchema = z
  .object({
    title: trimmed(300),
    description: trimmed(4000),
    category: trimmed(80),
    parameters: z.array(z.unknown()).max(200).optional(),
    projectedOutcome: optionalTrimmed(2000),
    impact: z.enum(['positive', 'neutral', 'negative']).optional()
  })
  .strict();

/** POST /meetings (VC). */
export const vcMeetingCreateSchema = z
  .object({
    meetingType: trimmed(60),
    title: trimmed(200),
    date: z.coerce.date(),
    time: trimmed(20),
    venue: trimmed(200),
    agendaItems: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional(),
    attendees: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional()
  })
  .strict();

/** POST /messages (VC broadcast). */
export const vcBroadcastCreateSchema = z
  .object({
    subject: trimmed(200),
    content: trimmed(4000),
    type: optionalTrimmed(40),
    recipients: optionalTrimmed(120),
    pinned: z.coerce.boolean().optional()
  })
  .strict();
