/**
 * NAAC for IQAC: live institution figures, a readiness score per criterion, and
 * the two approvals that close the loop — a criterion's sign-off by the
 * Principal, and the AQAR's approval by the Principal and Vice-Chancellor.
 */
import { basePrisma } from '../../lib/prisma.js';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../lib/errors.js';
import type { TenantContext } from '../../lib/tenant.js';
import { computeMetrics, currentAcademicYear } from '../hod/accreditation.service.js';
import * as workflow from '../workflow/workflow.service.js';
import { ensureDefinition } from '../workflow/bridge.js';
import { AQAR_APPROVAL, CRITERION_SIGNOFF } from '../workflow/builtins.js';

export const NAAC_CRITERIA = [
  { n: 1, name: 'Curricular Aspects' },
  { n: 2, name: 'Teaching-Learning and Evaluation' },
  { n: 3, name: 'Research, Innovations and Extension' },
  { n: 4, name: 'Infrastructure and Learning Resources' },
  { n: 5, name: 'Student Support and Progression' },
  { n: 6, name: 'Governance, Leadership and Management' },
  { n: 7, name: 'Institutional Values and Best Practices' }
];

/** Which live figure answers a stored IQAC metric, by its name. */
const LIVE_FOR: Array<[RegExp, string]> = [
  [/student.?teacher ratio|faculty-student ratio/i, 'c2_str'],
  [/ph\.?\s?d/i, 'c2_phd'],
  [/pass (percentage|rate)/i, 'c2_pass'],
  [/attendance/i, 'c2_attendance'],
  [/publication/i, 'c3_publications'],
  [/research (projects|funding)/i, 'c3_projects'],
  [/employab|placed|placement/i, 'c5_placement']
];

/** IQAC's criteria page: stored targets, with the current value taken live where the ERP can compute it. */
export async function liveCriteria(ctx: TenantContext) {
  const span = await currentAcademicYear(ctx.institutionId);
  const live = await computeMetrics(ctx.institutionId, null, span);
  const byKey = new Map(live.map((m) => [m.key, m]));
  const stored = await basePrisma.qualityMetric.findMany({ where: { institutionId: ctx.institutionId } });
  const grouped: Record<string, unknown[]> = {};
  for (const m of stored) {
    const key = LIVE_FOR.find(([re]) => re.test(m.metric))?.[1];
    const l = key ? byKey.get(key) : undefined;
    const row = l ? { ...m, currentValue: l.value, computed: true, basis: l.basis } : { ...m, computed: false };
    (grouped[m.category] ??= []).push(row);
  }
  return { ...grouped, live, academicYear: span.label };
}

const criterionOf = (text: string): number | null => {
  const m = /criterion\s*(\d)/i.exec(text);
  return m ? Number(m[1]) : null;
};

/**
 * Readiness per NAAC criterion, from three things the ERP holds:
 *  - the Registrar's checklist for the criterion (signed off = done),
 *  - the departments' accreditation data for it (share verified by HODs),
 *  - IQAC's evidence documents for it (share approved).
 * Criteria without department data (4, 6, 7) are scored on the other two.
 */
export async function readiness(ctx: TenantContext) {
  const span = await currentAcademicYear(ctx.institutionId);
  const [checklist, deptData, docs, pending] = await Promise.all([
    basePrisma.accreditationChecklist.findMany({ where: { institutionId: ctx.institutionId, framework: 'NAAC' } }),
    basePrisma.accreditationData.findMany({ where: { year: span.label, department: { institutionId: ctx.institutionId } }, select: { criterion: true, status: true, departmentId: true } }),
    basePrisma.qualityDocument.findMany({ where: { institutionId: ctx.institutionId }, select: { criteriaNumber: true, status: true } }),
    basePrisma.workflowInstance.findMany({ where: { institutionId: ctx.institutionId, entityType: 'AccreditationChecklist', status: 'pending' }, select: { entityId: true } })
  ]);
  const awaiting = new Set(pending.map((p) => p.entityId));
  return NAAC_CRITERIA.map((c) => {
    const items = checklist.filter((x) => criterionOf(x.criterion) === c.n && /—|–|-/.test(x.criterion));
    const checkScore = items.length ? items.reduce((a, x) => a + (x.status === 'completed' ? 1 : x.status === 'in_progress' || x.status === 'pending_signoff' ? 0.5 : 0), 0) / items.length : 0;
    const data = deptData.filter((d) => criterionOf(d.criterion) === c.n);
    const dataScore = data.length ? data.filter((d) => d.status === 'complete').length / data.length : null;
    const d = docs.filter((x) => x.criteriaNumber === c.n);
    const docScore = d.length ? d.reduce((a, x) => a + (x.status === 'approved' ? 1 : x.status === 'pending_review' ? 0.4 : 0), 0) / d.length : 0;
    const parts: Array<[number, number]> = [[checkScore, 0.4], [docScore, dataScore === null ? 0.6 : 0.2]];
    if (dataScore !== null) parts.push([dataScore, 0.4]);
    const score = Math.round(parts.reduce((a, [v, w]) => a + v * w, 0) * 100);
    const missing: string[] = [];
    if (!items.length) missing.push('No checklist entry with the Registrar');
    else if (items.some((x) => x.status !== 'completed')) missing.push(items.some((x) => awaiting.has(x.id)) ? 'Awaiting the Principal’s sign-off' : 'Checklist not signed off');
    if (dataScore !== null && dataScore < 1) missing.push(`${data.length - data.filter((x) => x.status === 'complete').length} department metric(s) not yet verified by HODs`);
    if (!d.length) missing.push('No evidence documents uploaded');
    else if (d.some((x) => x.status !== 'approved')) missing.push(`${d.filter((x) => x.status !== 'approved').length} document(s) awaiting IQAC review`);
    return {
      criterion: c.n, name: c.name, score, missing,
      checklist: items.map((x) => ({ id: x.id, status: x.status, responsibleOffice: x.responsibleOffice, deadline: x.deadline, awaitingSignoff: awaiting.has(x.id) })),
      departmentMetrics: { total: data.length, verified: data.filter((x) => x.status === 'complete').length },
      documents: { total: d.length, approved: d.filter((x) => x.status === 'approved').length }
    };
  });
}

/** IQAC marks a criterion ready; the Principal signs it off. */
export async function requestSignoff(ctx: TenantContext, checklistId: string) {
  const item = await basePrisma.accreditationChecklist.findFirst({ where: { id: checklistId, institutionId: ctx.institutionId } });
  if (!item) throw new NotFoundError('Checklist item');
  if (item.status === 'completed') throw new ConflictError('This criterion is already signed off.');
  const open = await basePrisma.workflowInstance.findFirst({ where: { institutionId: ctx.institutionId, entityType: 'AccreditationChecklist', entityId: checklistId, status: 'pending' } });
  if (open) throw new ConflictError('Already with the Principal for sign-off.');
  await ensureDefinition(ctx, CRITERION_SIGNOFF);
  await basePrisma.accreditationChecklist.updateMany({ where: { id: checklistId, institutionId: ctx.institutionId }, data: { status: 'pending_signoff' } });
  return workflow.startWorkflow(ctx, { code: CRITERION_SIGNOFF.code, entityType: 'AccreditationChecklist', entityId: checklistId });
}

/** IQAC submits the AQAR for the Principal and Vice-Chancellor's approval. */
export async function submitAqar(ctx: TenantContext, aqarId: string) {
  const aqar = await basePrisma.aQARRecord.findFirst({ where: { id: aqarId, institutionId: ctx.institutionId } });
  if (!aqar) throw new NotFoundError('AQAR');
  if (['submitted', 'approved'].includes(aqar.status)) throw new BusinessRuleError(`This AQAR is already ${aqar.status}.`);
  await ensureDefinition(ctx, AQAR_APPROVAL);
  await basePrisma.aQARRecord.updateMany({ where: { id: aqarId, institutionId: ctx.institutionId }, data: { status: 'submitted', submissionDate: new Date() } });
  return workflow.startWorkflow(ctx, { code: AQAR_APPROVAL.code, entityType: 'AQARRecord', entityId: aqarId });
}
