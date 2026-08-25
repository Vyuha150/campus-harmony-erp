/**
 * Validation schemas for the 5 `vc.ts` write handlers still on an unvalidated
 * `req.body` (Phase 3c completion). Same rationale as
 * `modules/hod/hod.schemas.ts`.
 */

import { z } from 'zod';

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const optionalTrimmed = (max: number) => z.string().trim().max(max).optional();

/** PUT /approvals/:id — already validated manually; formalised here. */
export const vcApprovalDecisionSchema = z
  .object({
    status: z.enum(['approved', 'rejected', 'forwarded'])
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
