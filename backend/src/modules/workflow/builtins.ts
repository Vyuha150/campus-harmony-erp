/**
 * Built-in workflow definitions (Phase 2.4).
 *
 * These describe processes the system itself relies on, as distinct from ones an
 * institution designs for itself through `POST /workflow/definitions`.
 *
 * They are declared here rather than seeded, for one reason: a seed runs once
 * against one database, and every institution created afterwards would have a
 * result-publication route that throws `NotFoundError: Active workflow
 * "RESULT_PUBLICATION"`. `ensureDefinition` installs a definition on first use,
 * per institution, and is a no-op thereafter.
 *
 * Installing is NOT the same as editing. If an institution has already defined
 * its own version of one of these codes, `ensureDefinition` leaves it alone —
 * the built-in is a default, not an override.
 */

import type { StepInput } from './workflow.service.js';

export interface BuiltinWorkflow {
  code: string;
  name: string;
  description: string;
  entityType: string;
  steps: StepInput[];
}

/**
 * Result publication.
 *
 * What the code did before this workflow existed:
 *
 *   - `POST /coe/results/:id/submit` reset ANY existing approval row back to
 *     `pending`, including one already `published`. A published result could be
 *     silently returned to the queue and published a second time.
 *   - `PUT /dean/results/:id/approve` did not check that a submission existed.
 *     With no row present it CREATED one already marked `published`. The dean
 *     could therefore publish results the CoE had never submitted, and the
 *     record would afterwards show an approval with no request behind it.
 *
 * Neither is a coding slip; both follow from storing a process in a status
 * column, where nothing can express "this may only happen after that".
 *
 * One step, not two: the CoE's submission is what STARTS the instance, so it is
 * the `started` transition rather than a step waiting to be actioned.
 */
export const RESULT_PUBLICATION: BuiltinWorkflow = {
  code: 'RESULT_PUBLICATION',
  name: 'Result publication',
  description:
    'The CoE submits a department result set; the Dean publishes it. Publication ' +
    'cannot occur without a submission, and cannot occur twice.',
  entityType: 'Department',
  steps: [{ sequence: 1, name: 'Dean publication', assigneeRole: 'dean', slaHours: 72 }]
};


/**
 * Purchase requests.
 *
 * Raised in a department (`hod.ts POST /inventory/purchase-request`), then
 * approved in two places that did not know about each other:
 * `hod.ts PUT /purchaserequests/:id/status` and
 * `dean.ts PUT /inventory/purchase-requests/:id/status`. Both wrote `status`
 * directly, so either could approve alone and neither recorded the other's
 * decision. For a request that commits money, "who approved this" was answerable
 * only by guessing from the last write.
 *
 * Two steps, because that is what the two handlers imply: the HOD endorses the
 * departmental need, the Dean sanctions the spend.
 */
export const PURCHASE_REQUEST: BuiltinWorkflow = {
  code: 'PURCHASE_REQUEST',
  name: 'Purchase request approval',
  description:
    'A department raises a purchase request; the HOD endorses it and the Dean ' +
    'sanctions the spend. Neither step can be skipped.',
  entityType: 'PurchaseRequest',
  // ONE step, not two.
  //
  // I first modelled this as HOD endorsement -> Dean sanction, which is what the
  // two handler names suggest. Reading them showed otherwise:
  // `hod.ts PUT /purchaserequests/:id/status` is a 403 stub that says "only Dean
  // can approve". The HOD RAISES the request, which is the `started` transition,
  // and the Dean is the only decision.
  //
  // Modelling the second step anyway would have invented a governance stage the
  // institution does not have — the exact mistake the approval catalogue warned
  // about when it found records born `approved`.
  //
  // Escalates to the principal: a purchase request that sits past its SLA blocks
  // a department, and the principal is the next authority who can sanction spend.
  steps: [
    {
      sequence: 1,
      name: 'Dean sanction',
      assigneeRole: 'dean',
      slaHours: 120,
      escalationRole: 'principal'
    }
  ]
};

/**
 * Curriculum proposals.
 *
 * `CurriculumProposal` carries BOTH a `status` defaulting to `pending_dean` and
 * a separate `bosApproved` boolean. Two fields describing one process, updated
 * independently, is how a proposal ends up simultaneously approved and pending.
 *
 * The engine holds the sequence; the two columns become a projection of it.
 */
export const CURRICULUM_PROPOSAL: BuiltinWorkflow = {
  code: 'CURRICULUM_PROPOSAL',
  name: 'Curriculum proposal approval',
  description:
    'A department proposes a curriculum change; the Board of Studies reviews it ' +
    'and the Dean approves it.',
  entityType: 'CurriculumProposal',
  // Also ONE step, for the same reason: `hod.ts POST /curriculum-proposals`
  // raises it and `dean.ts PUT /curriculum-proposals/:id` decides it. There is
  // no Board of Studies step in the code.
  //
  // `bosApproved` was taken from the REQUEST BODY — the proposer asserting that
  // a governance body had approved their own proposal. It is no longer accepted
  // (see hod.ts). An institution that wants a real BoS stage can define one
  // through POST /workflow/definitions without code, which is what the engine is
  // for; inventing it here would put a stage in the record that nobody sits in.
  steps: [
    {
      sequence: 1,
      name: 'Dean approval',
      assigneeRole: 'dean',
      slaHours: 168,
      escalationRole: 'vice_chancellor'
    }
  ]
};

export const BUILTIN_WORKFLOWS: readonly BuiltinWorkflow[] = [
  RESULT_PUBLICATION,
  PURCHASE_REQUEST,
  CURRICULUM_PROPOSAL
];
