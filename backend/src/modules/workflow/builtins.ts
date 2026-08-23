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

export const BUILTIN_WORKFLOWS: readonly BuiltinWorkflow[] = [RESULT_PUBLICATION];
