/**
 * Coverage check for the body factory: for every validated write endpoint,
 * can we synthesise a body its own schema accepts?
 *
 * Reports coverage rather than asserting it, because an un-generatable body is
 * information about the schema, not a failure of the sweep.
 */

import { basePrisma } from '../../src/lib/prisma.js';
import { buildBody, loadSchemas, loadRouteSchemaMap, type SeedIds } from './bodyFactory.js';

async function collectSeedIds(): Promise<SeedIds> {
  const seeds: SeedIds = {};
  const put = (k: string, v?: string | null) => { if (v) seeds[k] = v; };

  const [student, faculty, dept, course, cls, user, company, drive, vendor, institution] = await Promise.all([
    basePrisma.studentProfile.findFirst({ select: { id: true, userId: true } }),
    basePrisma.facultyProfile.findFirst({ select: { id: true, userId: true } }),
    basePrisma.department.findFirst({ select: { id: true } }),
    basePrisma.course.findFirst({ select: { id: true } }),
    basePrisma.courseClass.findFirst({ select: { id: true } }),
    basePrisma.user.findFirst({ select: { id: true } }),
    basePrisma.company.findFirst({ select: { id: true } }),
    basePrisma.placementDrive.findFirst({ select: { id: true } }),
    basePrisma.vendor.findFirst({ select: { id: true } }),
    basePrisma.institution.findFirst({ select: { id: true } })
  ]);

  put('studentProfileId', student?.id);
  put('studentId', student?.id);
  put('applicantId', student?.userId);
  put('facultyProfileId', faculty?.id);
  put('facultyId', faculty?.id);
  put('officerId', faculty?.userId);
  put('departmentId', dept?.id);
  put('courseId', course?.id);
  put('classId', cls?.id);
  put('userId', user?.id);
  put('assignedTo', user?.id);
  put('companyId', company?.id);
  put('driveId', drive?.id);
  put('vendorId', vendor?.id);
  put('institutionId', institution?.id);
  put('alumniProfileId', (await basePrisma.alumniProfile.findFirst({ select: { id: true } }))?.id);
  return seeds;
}

const seeds = await collectSeedIds();
const schemas = await loadSchemas();
const routes = loadRouteSchemaMap();

let ok = 0;
const missingSchema: string[] = [];
const failures: Array<{ ep: string; schema: string; reason: string }> = [];

for (const r of routes) {
  const schema = schemas.get(r.schema);
  if (!schema) { missingSchema.push(`${r.method} ${r.path} (${r.schema})`); continue; }
  const built = buildBody(schema, seeds);
  if (built.ok) ok++;
  else failures.push({ ep: `${r.method} ${r.path}`, schema: r.schema, reason: built.reason });
}

console.log('validated write endpoints :', routes.length);
console.log('schemas resolved          :', schemas.size);
console.log('bodies the schema ACCEPTS :', ok);
console.log('could not generate        :', failures.length);
console.log('schema not found by name  :', missingSchema.length);

if (failures.length) {
  console.log('\n--- un-generatable ---');
  for (const f of failures.slice(0, 25)) console.log(`  ${f.ep}\n      [${f.schema}] ${f.reason}`);
  if (failures.length > 25) console.log(`  ... and ${failures.length - 25} more`);
}
if (missingSchema.length) {
  console.log('\n--- schema name not exported from any *.schemas.ts ---');
  for (const m of missingSchema.slice(0, 15)) console.log('  ' + m);
  if (missingSchema.length > 15) console.log(`  ... and ${missingSchema.length - 15} more`);
}

await basePrisma.$disconnect();
