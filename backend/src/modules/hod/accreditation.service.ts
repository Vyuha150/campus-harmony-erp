/**
 * Department accreditation data — blueprint, HOD portal, "Accreditation Data
 * (Dept)": the HOD "review[s] automatically gathered data … verif[ies] the list
 * of publications by their faculty as pulled from the research module, add[s]
 * any missing ones, and attach[es] documents".
 *
 * The screen used to start empty: every metric had to be typed in by hand, so
 * a department showed 0% readiness until someone did. These metrics are now
 * computed from the ERP's own records for the current academic year and kept
 * as AccreditationData rows (source "computed"). The HOD verifies each one; if
 * the underlying data changes after verification, the row goes back to
 * "needs_review". Qualitative or external metrics are still added by hand.
 */
import { basePrisma } from '../../lib/prisma.js';
import { combineOutcomes, outcomeFor, publishedOutcomes } from '../../lib/courseOutcomes.js';

export interface Computed { key: string; criterion: string; metric: string; value: string; basis: string }

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 1000) / 10}%` : '—');
const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** The current academic year ("2026-27") and its calendar span. */
export async function currentAcademicYear(institutionId: string) {
  const year = await basePrisma.academicYear.findFirst({ where: { institutionId, isCurrent: true } });
  if (year) return { label: year.year, start: year.startDate, end: year.endDate };
  const now = new Date();
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return { label: `${startYear}-${String(startYear + 1).slice(-2)}`, start: new Date(`${startYear}-07-01`), end: new Date(`${startYear + 1}-06-30`) };
}

/** Department metrics, or the whole institution's when departmentId is null (IQAC). */
export async function computeMetrics(institutionId: string, departmentId: string | null, span: { start: Date; end: Date }): Promise<Computed[]> {
  return compute(institutionId, departmentId, span);
}

async function compute(institutionId: string, departmentId: string | null, span: { start: Date; end: Date }): Promise<Computed[]> {
  const scope = departmentId ? { departmentId } : {};
  const [courses, users] = await Promise.all([
    basePrisma.course.findMany({ where: { institutionId, ...scope }, select: { id: true, code: true } }),
    basePrisma.user.findMany({
      where: { institutionId, ...scope, role: { in: ['student', 'faculty', 'hod'] } },
      select: { id: true, role: true, studentProfile: { select: { id: true } }, facultyProfile: { select: { id: true, qualification: true, qualificationLevel: true } } }
    })
  ]);
  const studentIds = users.map((u) => u.studentProfile?.id).filter((x): x is string => !!x);
  const facultyProfiles = users.filter((u) => u.role !== 'student').map((u) => u.facultyProfile).filter((x): x is NonNullable<typeof x> => !!x);
  const facultyIds = facultyProfiles.map((f) => f.id);
  const startYear = span.start.getFullYear();

  const [proposals, attendance, published, projects, publications, patents, waivers, offers, mentored] = await Promise.all([
    basePrisma.curriculumProposal.count({ where: { ...scope, status: 'approved', submittedAt: { gte: span.start, lte: span.end } } }),
    basePrisma.attendance.findMany({ where: { studentProfileId: { in: studentIds } }, select: { status: true } }),
    publishedOutcomes(courses.map((c) => c.id)),
    basePrisma.researchProject.findMany({ where: { facultyProfileId: { in: facultyIds }, status: { in: ['ongoing', 'completed'] } }, select: { amount: true } }),
    basePrisma.publication.count({ where: { facultyProfileId: { in: facultyIds }, status: { in: ['published', 'verified'] }, year: { in: [startYear - 1, startYear] } } }),
    basePrisma.patent.count({ where: { facultyProfileId: { in: facultyIds }, status: { in: ['filed', 'published', 'granted'] } } }),
    basePrisma.feeWaiverRequest.findMany({ where: { institutionId, studentProfileId: { in: studentIds }, status: 'approved' }, select: { sanctionedAmount: true } }),
    basePrisma.jobOffer.findMany({ where: { studentId: { in: studentIds }, status: { not: 'rejected' } }, select: { studentId: true, package: true } }),
    basePrisma.menteeAssignment.count({ where: { studentId: { in: studentIds } } })
  ]);

  const phd = facultyProfiles.filter((f) => /ph\.?\s?d/i.test(`${f.qualification ?? ''} ${f.qualificationLevel ?? ''}`)).length;
  const present = attendance.filter((a) => a.status !== 'absent').length;
  const outcome = combineOutcomes(courses.map((c) => outcomeFor(c as never, published)));
  const placed = new Set(offers.map((o) => o.studentId)).size;
  const packages = offers.map((o) => o.package).sort((a, b) => a - b);
  const median = packages.length ? packages[Math.floor(packages.length / 2)]! : null;

  return [
    { key: 'c1_courses', criterion: 'Criterion 1 – Curricular Aspects', metric: '1.1 Courses offered by the department', value: String(courses.length), basis: 'Courses in Course Management' },
    { key: 'c1_curriculum', criterion: 'Criterion 1 – Curricular Aspects', metric: '1.2 Curriculum changes approved this year', value: String(proposals), basis: 'Curriculum proposals approved by the Dean' },
    { key: 'c2_students', criterion: 'Criterion 2 – Teaching-Learning and Evaluation', metric: '2.1 Student strength', value: String(studentIds.length), basis: 'Students registered in the department' },
    { key: 'c2_str', criterion: 'Criterion 2 – Teaching-Learning and Evaluation', metric: '2.2 Student–teacher ratio', value: facultyIds.length ? `${(studentIds.length / facultyIds.length).toFixed(1)}:1` : '—', basis: `${studentIds.length} students ÷ ${facultyIds.length} faculty (incl. HOD)` },
    { key: 'c2_phd', criterion: 'Criterion 2 – Teaching-Learning and Evaluation', metric: '2.4 Full-time faculty with Ph.D.', value: `${phd} of ${facultyIds.length} (${pct(phd, facultyIds.length)})`, basis: 'Qualification in faculty profiles' },
    { key: 'c2_attendance', criterion: 'Criterion 2 – Teaching-Learning and Evaluation', metric: '2.3 Average student attendance', value: pct(present, attendance.length), basis: `${attendance.length} attendance marks posted by faculty` },
    { key: 'c2_pass', criterion: 'Criterion 2 – Teaching-Learning and Evaluation', metric: '2.6 Pass percentage', value: outcome.passPercentage == null ? '—' : `${outcome.passPercentage}%`, basis: `${outcome.assessed} published course results` },
    { key: 'c3_projects', criterion: 'Criterion 3 – Research, Innovations and Extension', metric: '3.1 Funded research projects', value: `${projects.length} (${rupees(projects.reduce((s, p) => s + p.amount, 0))})`, basis: 'Sanctioned projects (ongoing or completed)' },
    { key: 'c3_publications', criterion: 'Criterion 3 – Research, Innovations and Extension', metric: `3.3 Publications (${startYear - 1}–${startYear})`, value: String(publications), basis: 'Publications verified through the research module' },
    { key: 'c3_patents', criterion: 'Criterion 3 – Research, Innovations and Extension', metric: '3.2 Patents filed / granted', value: String(patents), basis: 'Patents approved through the IPR workflow' },
    { key: 'c5_scholarships', criterion: 'Criterion 5 – Student Support and Progression', metric: '5.1 Scholarships and fee waivers', value: `${waivers.length} (${rupees(waivers.reduce((s, w) => s + (w.sanctionedAmount ?? 0), 0))})`, basis: 'Fee waivers sanctioned by Finance' },
    { key: 'c5_placement', criterion: 'Criterion 5 – Student Support and Progression', metric: '5.2 Students placed', value: `${placed}${median != null ? ` · median ${median} LPA` : ''}`, basis: `${offers.length} job offer(s) recorded by the Placement Cell` },
    { key: 'c5_mentoring', criterion: 'Criterion 5 – Student Support and Progression', metric: '5.1 Students with a mentor', value: `${mentored} of ${studentIds.length} (${pct(mentored, studentIds.length)})`, basis: 'Mentor assignments' }
  ];
}

/** Bring the department's computed rows up to date for the current year. */
export async function syncComputedMetrics(institutionId: string, departmentId: string, userId: string): Promise<string> {
  const year = await currentAcademicYear(institutionId);
  const metrics = await compute(institutionId, departmentId, year);
  const existing = await basePrisma.accreditationData.findMany({ where: { departmentId, year: year.label, source: 'computed' } });
  for (const m of metrics) {
    const row = existing.find((e) => e.metricKey === m.key);
    if (!row) {
      await basePrisma.accreditationData.create({
        data: { departmentId, year: year.label, source: 'computed', metricKey: m.key, criterion: m.criterion, metric: m.metric, value: m.value, basis: m.basis, status: 'pending', updatedBy: userId }
      });
    } else if (row.value !== m.value || row.metric !== m.metric || row.basis !== m.basis) {
      // A verified figure whose data moved on must be looked at again.
      await basePrisma.accreditationData.updateMany({
        where: { id: row.id, departmentId },
        data: {
          metric: m.metric, value: m.value, basis: m.basis, lastUpdated: new Date(),
          ...(row.value !== m.value && row.status === 'complete' ? { status: 'needs_review' } : {})
        }
      });
    }
  }
  return year.label;
}
