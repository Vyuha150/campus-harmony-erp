/**
 * Render docs/NAAC_NIRF_WORKFLOWS.md from the workflow catalogue.
 *
 *   npm run docs:workflows
 *
 * The document is generated, never hand-edited, so it cannot disagree with the
 * definitions `prisma/seed-demo.ts` loads into the workflow engine. Change
 * `prisma/naacNirfWorkflows.ts` and run this again.
 */

import fs from 'node:fs';
import { NAAC_CRITERIA, NIRF_PARAMETERS, WORKFLOWS, type WorkflowSpec } from '../prisma/naacNirfWorkflows.js';

const ROLE_LABEL: Record<string, string> = {
  student: 'Student', faculty: 'Faculty', hod: 'HOD', dean: 'Dean', principal: 'Principal', registrar: 'Registrar',
  coe: 'Controller of Examinations', vice_chancellor: 'Vice-Chancellor', pro_vc: 'Pro Vice-Chancellor',
  finance_officer: 'Finance Officer', iqac_coordinator: 'IQAC Coordinator', placement_officer: 'Placement Officer',
  librarian: 'Librarian', grievance_officer: 'Grievance Officer', security_officer: 'Security Officer',
  sports_director: 'Sports Director', alumni_officer: 'Alumni Officer', auditor: 'Auditor', super_admin: 'IT Administrator'
};
const role = (r: string) => ROLE_LABEL[r] ?? r;
const sla = (hours: number) => (hours % 24 === 0 ? `${hours / 24} day${hours === 24 ? '' : 's'}` : `${hours} h`);
const chain = (w: WorkflowSpec) => w.steps.map((s) => role(s.role)).join(' → ');

const out: string[] = [];
const p = (...lines: string[]) => out.push(...lines);

p(
  '# Workflows required by NAAC and NIRF',
  '',
  '> Generated from `backend/prisma/naacNirfWorkflows.ts` by `npm run docs:workflows`. Do not edit by hand.',
  '',
  'This lists every approval workflow the ERP needs so that the data NAAC and NIRF ask for is produced by a recorded,',
  'role-based process rather than assembled at the last minute. It is derived from the *Comprehensive ERP Blueprint for',
  'Indian Universities (NAAC/UGC/NIRF Aligned)*, mapped to the seven NAAC criteria and the five NIRF parameters.',
  '',
  `**${WORKFLOWS.length} workflows.** ${WORKFLOWS.filter((w) => w.builtIn).length} are built into the application and wired to its screens;`,
  `the other ${WORKFLOWS.filter((w) => !w.builtIn).length} are loaded into the workflow engine by the demo seed as definitions, ready to be started`,
  'through `POST /api/workflow/instances` and acted on from each role\'s inbox (`GET /api/workflow/inbox`).',
  '',
  'Each step names the role that must act, the time allowed, and who it escalates to when that time runs out.',
  'NAAC key-indicator numbers follow the manual for universities and autonomous colleges; confirm them against the',
  'edition the institution is assessed under before quoting them in an SSR.',
  '',
  '## Summary',
  '',
  '### By NAAC criterion',
  '',
  '| Criterion | Workflows |',
  '|---|---|'
);
for (const [n, title] of Object.entries(NAAC_CRITERIA)) {
  p(`| ${n}. ${title} | ${WORKFLOWS.filter((w) => w.naacCriterion === Number(n)).length} |`);
}
p('', '### By NIRF parameter', '', '| Parameter | Workflows that feed it |', '|---|---|');
for (const [code, title] of Object.entries(NIRF_PARAMETERS)) {
  const feeding = WORKFLOWS.filter((w) => w.nirf.includes(code));
  p(`| **${code}** — ${title} | ${feeding.map((w) => w.name).join('; ')} |`);
}

p('', '### All workflows', '', '| # | Workflow | NAAC | NIRF | Approval chain |', '|---|---|---|---|---|');
WORKFLOWS.forEach((w, i) => {
  p(`| ${i + 1} | ${w.name}${w.builtIn ? ' *(built in)*' : ''} | ${w.naacIndicator.split(' ')[0]} | ${w.nirf.join(', ') || '—'} | ${w.initiatedBy.split(' /')[0]!.split(' (')[0]} → ${chain(w)} |`);
});

for (const [n, title] of Object.entries(NAAC_CRITERIA)) {
  const list = WORKFLOWS.filter((w) => w.naacCriterion === Number(n));
  p('', `## Criterion ${n} — ${title}`, '');
  for (const w of list) {
    p(
      `### ${w.name}`,
      '',
      `- **Code:** \`${w.code}\`${w.builtIn ? ' (built into the application)' : ''}`,
      `- **NAAC key indicator:** ${w.naacIndicator}`,
      `- **NIRF parameter:** ${w.nirf.length ? w.nirf.map((c) => `${c} (${NIRF_PARAMETERS[c]})`).join(', ') : 'none'}`,
      `- **Started by:** ${w.initiatedBy}`,
      `- **Record approved:** \`${w.entityType}\``,
      `- **Why it is needed:** ${w.purpose}`,
      `- **Evidence it leaves:** ${w.evidence}`,
      '',
      '| Step | Action | Role | Time allowed | Escalates to |',
      '|---|---|---|---|---|',
      ...w.steps.map((s, i) => `| ${i + 1} | ${s.name} | ${role(s.role)} | ${sla(s.slaHours)} | ${s.escalateTo ? role(s.escalateTo) : '—'} |`),
      ''
    );
  }
}

const target = new URL('../../docs/NAAC_NIRF_WORKFLOWS.md', import.meta.url);
fs.writeFileSync(target, out.join('\n') + '\n');
console.log(`Wrote ${WORKFLOWS.length} workflows to docs/NAAC_NIRF_WORKFLOWS.md`);
