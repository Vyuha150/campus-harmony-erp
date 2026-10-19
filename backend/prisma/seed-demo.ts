/**
 * Demo dataset: an engineering college.
 *
 *   npm run db:seed:demo        (also runs as the second half of `prisma db seed`)
 *
 * `seed.ts` creates one row of everything so each engine is exercisable. This
 * script makes the screens look like a working institution:
 *
 *   - six engineering departments, each with a HOD, faculty, courses and students
 *   - ONE FULL DEMO CLASS: B.Tech CSE, Semester 5, Section A — 30 students and
 *     6 subjects, with timetable, four weeks of attendance, assignments, lesson
 *     plans, internal marks, exam registrations and Semester 4 results
 *   - fees (paid, part-paid and overdue), library stock and loans, placements
 *   - NAAC / NIRF readiness: accreditation checklist, quality metrics and the
 *     full workflow catalogue from `naacNirfWorkflows.ts`
 *
 * RULES THIS FOLLOWS
 *
 *   - Idempotent. Every row has a deterministic id, so a second run changes
 *     nothing and never duplicates.
 *   - Nothing derived is typed in. CGPA comes from the results engine, payments
 *     and receipts from the finance service, loans from the library service —
 *     the same code paths a user drives. Quality metrics that can be computed
 *     from this data (ratios, percentages) ARE computed from it.
 *   - Deterministic. The pseudo-random spread of marks and attendance is seeded,
 *     so two developers get the same class.
 *
 * Requires `seed.ts` to have run first: it owns the tenant, the role accounts,
 * the grading scale and the examination session this builds on.
 */

import 'dotenv/config';
import fs from 'node:fs';
import bcrypt from 'bcrypt';
import { prisma } from '../src/lib/prisma.js';
import { runWithTenant } from '../src/lib/tenantStore.js';
import { recomputeStudentResults } from '../src/modules/results/results.service.js';
import { recordPayment } from '../src/modules/finance/finance.service.js';
import { issueBook } from '../src/modules/library/library.service.js';
import { WORKFLOWS } from './naacNirfWorkflows.js';

const db: any = prisma;

const nodeEnv = process.env.NODE_ENV ?? 'development';
if (nodeEnv !== 'development' && process.env.ALLOW_SEED !== 'yes') {
  console.error(`REFUSING TO SEED DEMO DATA: NODE_ENV is "${nodeEnv}". Set ALLOW_SEED=yes for a disposable database.`);
  process.exit(1);
}

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || 'Password@123';
const INSTITUTION = '00000000-0000-4000-8000-000000000001';
const CAMPUS = '00000000-0000-4000-8000-000000000002';
const EMAIL_DOMAIN = 'campusharmony.edu';
const ACADEMIC_YEAR = '2025-26';

// Ids owned by seed.ts that this script attaches to.
const SEED = {
  student: { user: 'seed-user-student', profile: 'seed-student-profile' },
  faculty: { user: 'seed-user-faculty', profile: 'seed-faculty-profile' },
  users: { hod: 'seed-user-hod', dean: 'seed-user-dean', coe: 'seed-user-coe', finance: 'seed-user-finance', librarian: 'seed-user-librarian', superAdmin: 'seed-user-super-admin' },
  examSession: 'seed-exam-session-s5',
  cse501: { course: 'seed-course-cse501', class: 'seed-class-cse501-a' }
};

// ── Deterministic helpers ───────────────────────────────────────────────────

/** mulberry32 — small seeded PRNG, so the class looks the same on every machine. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (text: string) => [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (offset: number) => new Date(Date.now() + offset * DAY_MS);
const pad = (n: number, width = 3) => String(n).padStart(width, '0');

async function upsertById(delegate: any, id: string, data: Record<string, unknown>) {
  return delegate.upsert({ where: { id }, update: data, create: { id, ...data } });
}

/** Create only when absent — for rows whose later state belongs to the app, not the seed. */
async function createIfMissing(delegate: any, id: string, data: Record<string, unknown>) {
  const existing = await delegate.findUnique({ where: { id }, select: { id: true } });
  if (!existing) await delegate.create({ data: { id, ...data } });
  return !existing;
}

/** Bulk insert rows with deterministic ids, skipping any that already exist. */
async function createMissing(delegate: any, rows: Array<{ id: string }>): Promise<number> {
  if (rows.length === 0) return 0;
  const existing = new Set<string>();
  for (let i = 0; i < rows.length; i += 500) {
    const found = await delegate.findMany({
      where: { id: { in: rows.slice(i, i + 500).map((r) => r.id) } },
      select: { id: true }
    });
    found.forEach((r: { id: string }) => existing.add(r.id));
  }
  const fresh = rows.filter((r) => !existing.has(r.id));
  for (let i = 0; i < fresh.length; i += 500) {
    await delegate.createMany({ data: fresh.slice(i, i + 500) });
  }
  return fresh.length;
}

async function inChunks<T>(items: T[], size: number, work: (item: T) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(work));
  }
}

// ── The college ─────────────────────────────────────────────────────────────

interface Dept { key: string; id: string; code: string; name: string; branch: string; rollTag: string; block: string }

const DEPARTMENTS: Dept[] = [
  { key: 'cse', id: 'seed-dept-cse', code: 'CSE', name: 'Computer Science and Engineering', branch: 'Computer Science', rollTag: 'CS', block: 'CSE' },
  { key: 'ece', id: 'seed-dept-ece', code: 'ECE', name: 'Electronics and Communication Engineering', branch: 'Electronics and Communication', rollTag: 'EC', block: 'ECE' },
  { key: 'eee', id: 'demo-dept-eee', code: 'EEE', name: 'Electrical and Electronics Engineering', branch: 'Electrical and Electronics', rollTag: 'EE', block: 'EEE' },
  { key: 'mech', id: 'demo-dept-mech', code: 'MECH', name: 'Mechanical Engineering', branch: 'Mechanical', rollTag: 'ME', block: 'MECH' },
  { key: 'civil', id: 'demo-dept-civil', code: 'CIVIL', name: 'Civil Engineering', branch: 'Civil', rollTag: 'CE', block: 'CIVIL' },
  { key: 'it', id: 'demo-dept-it', code: 'IT', name: 'Information Technology', branch: 'Information Technology', rollTag: 'IT', block: 'IT' }
];
const dept = (key: string) => DEPARTMENTS.find((d) => d.key === key)!;

interface Staff {
  key: string; email: string; name: string; role: 'faculty' | 'hod'; dept: string; designation: string;
  qualification: string; level: 'phd' | 'pg'; specialization: string; experience: number; gender: 'male' | 'female';
  /** Set when the account already exists in seed.ts. */
  existing?: { user: string; profile?: string };
}

const STAFF: Staff[] = [
  // CSE — the six subject teachers of the demo class.
  { key: 'cse1', email: `faculty@${EMAIL_DOMAIN}`, name: 'Dr. Ravi Faculty', role: 'faculty', dept: 'cse', designation: 'Professor', qualification: 'Ph.D. in Computer Science', level: 'phd', specialization: 'Distributed Systems', experience: 12, gender: 'male', existing: { user: SEED.faculty.user, profile: SEED.faculty.profile } },
  { key: 'cse2', email: `faculty.cse2@${EMAIL_DOMAIN}`, name: 'Dr. Lakshmi Narayana', role: 'faculty', dept: 'cse', designation: 'Associate Professor', qualification: 'Ph.D. in Computer Science', level: 'phd', specialization: 'Database Systems', experience: 14, gender: 'female' },
  { key: 'cse3', email: `faculty.cse3@${EMAIL_DOMAIN}`, name: 'Dr. Sandeep Varma', role: 'faculty', dept: 'cse', designation: 'Associate Professor', qualification: 'Ph.D. in Computer Engineering', level: 'phd', specialization: 'Operating Systems', experience: 11, gender: 'male' },
  { key: 'cse4', email: `faculty.cse4@${EMAIL_DOMAIN}`, name: 'Ms. Harika Chowdary', role: 'faculty', dept: 'cse', designation: 'Assistant Professor', qualification: 'M.Tech in Computer Networks', level: 'pg', specialization: 'Computer Networks', experience: 6, gender: 'female' },
  { key: 'cse5', email: `faculty.cse5@${EMAIL_DOMAIN}`, name: 'Dr. Venkat Rao', role: 'faculty', dept: 'cse', designation: 'Professor', qualification: 'Ph.D. in Algorithms', level: 'phd', specialization: 'Algorithms and Complexity', experience: 18, gender: 'male' },
  { key: 'cse6', email: `faculty.cse6@${EMAIL_DOMAIN}`, name: 'Mr. Aditya Kulkarni', role: 'faculty', dept: 'cse', designation: 'Assistant Professor', qualification: 'M.Tech in Software Engineering', level: 'pg', specialization: 'Software Engineering', experience: 5, gender: 'male' },
  // The seeded `hod@` account is the CSE HOD. It has no faculty profile and needs none.
  { key: 'hod-ece', email: `hod.ece@${EMAIL_DOMAIN}`, name: 'Dr. Padmaja Rani', role: 'hod', dept: 'ece', designation: 'Head of Department', qualification: 'Ph.D. in VLSI Design', level: 'phd', specialization: 'VLSI Design', experience: 19, gender: 'female' },
  { key: 'ece1', email: `faculty.ece1@${EMAIL_DOMAIN}`, name: 'Dr. Srinivas Murthy', role: 'faculty', dept: 'ece', designation: 'Associate Professor', qualification: 'Ph.D. in Signal Processing', level: 'phd', specialization: 'Digital Signal Processing', experience: 13, gender: 'male' },
  { key: 'ece2', email: `faculty.ece2@${EMAIL_DOMAIN}`, name: 'Ms. Divya Teja', role: 'faculty', dept: 'ece', designation: 'Assistant Professor', qualification: 'M.Tech in Embedded Systems', level: 'pg', specialization: 'Embedded Systems', experience: 4, gender: 'female' },
  { key: 'hod-eee', email: `hod.eee@${EMAIL_DOMAIN}`, name: 'Dr. Ramesh Babu', role: 'hod', dept: 'eee', designation: 'Head of Department', qualification: 'Ph.D. in Power Systems', level: 'phd', specialization: 'Power Systems', experience: 21, gender: 'male' },
  { key: 'eee1', email: `faculty.eee1@${EMAIL_DOMAIN}`, name: 'Dr. Anitha Kumari', role: 'faculty', dept: 'eee', designation: 'Associate Professor', qualification: 'Ph.D. in Control Systems', level: 'phd', specialization: 'Control Systems', experience: 12, gender: 'female' },
  { key: 'eee2', email: `faculty.eee2@${EMAIL_DOMAIN}`, name: 'Mr. Naveen Prasad', role: 'faculty', dept: 'eee', designation: 'Assistant Professor', qualification: 'M.Tech in Power Electronics', level: 'pg', specialization: 'Power Electronics', experience: 7, gender: 'male' },
  { key: 'hod-mech', email: `hod.mech@${EMAIL_DOMAIN}`, name: 'Dr. Krishna Mohan', role: 'hod', dept: 'mech', designation: 'Head of Department', qualification: 'Ph.D. in Thermal Engineering', level: 'phd', specialization: 'Thermal Engineering', experience: 22, gender: 'male' },
  { key: 'mech1', email: `faculty.mech1@${EMAIL_DOMAIN}`, name: 'Dr. Satish Chandra', role: 'faculty', dept: 'mech', designation: 'Associate Professor', qualification: 'Ph.D. in Machine Design', level: 'phd', specialization: 'Machine Design', experience: 15, gender: 'male' },
  { key: 'mech2', email: `faculty.mech2@${EMAIL_DOMAIN}`, name: 'Ms. Bhavana Reddy', role: 'faculty', dept: 'mech', designation: 'Assistant Professor', qualification: 'M.Tech in Manufacturing', level: 'pg', specialization: 'Manufacturing Technology', experience: 5, gender: 'female' },
  { key: 'hod-civil', email: `hod.civil@${EMAIL_DOMAIN}`, name: 'Dr. Subba Rao', role: 'hod', dept: 'civil', designation: 'Head of Department', qualification: 'Ph.D. in Structural Engineering', level: 'phd', specialization: 'Structural Engineering', experience: 24, gender: 'male' },
  { key: 'civil1', email: `faculty.civil1@${EMAIL_DOMAIN}`, name: 'Dr. Madhavi Latha', role: 'faculty', dept: 'civil', designation: 'Associate Professor', qualification: 'Ph.D. in Geotechnical Engineering', level: 'phd', specialization: 'Geotechnical Engineering', experience: 13, gender: 'female' },
  { key: 'civil2', email: `faculty.civil2@${EMAIL_DOMAIN}`, name: 'Mr. Praveen Kumar', role: 'faculty', dept: 'civil', designation: 'Assistant Professor', qualification: 'M.Tech in Transportation Engineering', level: 'pg', specialization: 'Transportation Engineering', experience: 6, gender: 'male' },
  { key: 'hod-it', email: `hod.it@${EMAIL_DOMAIN}`, name: 'Dr. Swathi Priya', role: 'hod', dept: 'it', designation: 'Head of Department', qualification: 'Ph.D. in Data Mining', level: 'phd', specialization: 'Data Mining', experience: 17, gender: 'female' },
  { key: 'it1', email: `faculty.it1@${EMAIL_DOMAIN}`, name: 'Dr. Rajesh Gupta', role: 'faculty', dept: 'it', designation: 'Associate Professor', qualification: 'Ph.D. in Web Engineering', level: 'phd', specialization: 'Web Technologies', experience: 10, gender: 'male' },
  { key: 'it2', email: `faculty.it2@${EMAIL_DOMAIN}`, name: 'Ms. Keerthi Sai', role: 'faculty', dept: 'it', designation: 'Assistant Professor', qualification: 'M.Tech in Information Technology', level: 'pg', specialization: 'Software Testing', experience: 3, gender: 'female' }
];
const staffUserId = (s: Staff) => s.existing?.user ?? `demo-user-${s.key}`;
const staffProfileId = (s: Staff) => s.existing?.profile ?? `demo-faculty-${s.key}`;
const staff = (key: string) => STAFF.find((s) => s.key === key)!;

interface CourseSpec { code: string; name: string; credits: number; semester: number; dept: string; faculty: string; topics?: string[] }

const COURSES: CourseSpec[] = [
  // ── The demo class: B.Tech CSE, Semester 5 — six subjects ────────────────
  { code: 'CSE501', name: 'Cloud Computing', credits: 4, semester: 5, dept: 'cse', faculty: 'cse1',
    topics: ['Cloud service and deployment models', 'Virtualisation and hypervisors', 'Containers and orchestration', 'Cloud storage systems', 'Distributed computing with MapReduce', 'Cloud security and identity', 'Serverless computing', 'Cost, scaling and monitoring'] },
  { code: 'CSE502', name: 'Database Management Systems', credits: 4, semester: 5, dept: 'cse', faculty: 'cse2',
    topics: ['Data models and ER design', 'Relational algebra and calculus', 'SQL: queries, joins and subqueries', 'Normalisation up to BCNF', 'Transactions and ACID properties', 'Concurrency control', 'Indexing and hashing', 'Recovery and NoSQL overview'] },
  { code: 'CSE503', name: 'Operating Systems', credits: 4, semester: 5, dept: 'cse', faculty: 'cse3',
    topics: ['OS structure and system calls', 'Processes and threads', 'CPU scheduling', 'Process synchronisation', 'Deadlocks', 'Memory management and paging', 'Virtual memory', 'File systems and disk scheduling'] },
  { code: 'CSE504', name: 'Computer Networks', credits: 3, semester: 5, dept: 'cse', faculty: 'cse4',
    topics: ['Network models: OSI and TCP/IP', 'Physical layer and transmission media', 'Data link layer and error control', 'Medium access control', 'Network layer and IP addressing', 'Routing algorithms', 'Transport layer: TCP and UDP', 'Application layer protocols'] },
  { code: 'CSE505', name: 'Design and Analysis of Algorithms', credits: 4, semester: 5, dept: 'cse', faculty: 'cse5',
    topics: ['Asymptotic analysis and recurrences', 'Divide and conquer', 'Greedy algorithms', 'Dynamic programming', 'Graph traversal and shortest paths', 'Minimum spanning trees', 'Backtracking and branch-and-bound', 'NP-completeness'] },
  { code: 'CSE506', name: 'Software Engineering', credits: 3, semester: 5, dept: 'cse', faculty: 'cse6',
    topics: ['Software process models', 'Agile and Scrum', 'Requirements engineering', 'Software design and UML', 'Coding standards and reviews', 'Software testing strategies', 'Project estimation and scheduling', 'Maintenance and quality assurance'] },
  // ── CSE Semester 4 — the published results behind the class's CGPA ────────
  { code: 'CSE401', name: 'Object Oriented Programming', credits: 4, semester: 4, dept: 'cse', faculty: 'cse6' },
  { code: 'CSE402', name: 'Computer Organization and Architecture', credits: 4, semester: 4, dept: 'cse', faculty: 'cse3' },
  { code: 'CSE403', name: 'Discrete Mathematics', credits: 3, semester: 4, dept: 'cse', faculty: 'cse5' },
  { code: 'CSE404', name: 'Data Structures', credits: 4, semester: 4, dept: 'cse', faculty: 'cse2' },
  { code: 'CSE405', name: 'Probability and Statistics', credits: 3, semester: 4, dept: 'cse', faculty: 'cse4' },
  { code: 'CSE406', name: 'Web Technologies', credits: 3, semester: 4, dept: 'cse', faculty: 'cse1' },
  // ── Other departments — two current and two completed subjects each ───────
  { code: 'ECE501', name: 'Digital Signal Processing', credits: 4, semester: 5, dept: 'ece', faculty: 'ece1' },
  { code: 'ECE502', name: 'VLSI Design', credits: 4, semester: 5, dept: 'ece', faculty: 'ece2' },
  { code: 'ECE401', name: 'Analog Circuits', credits: 4, semester: 4, dept: 'ece', faculty: 'ece2' },
  { code: 'ECE402', name: 'Signals and Systems', credits: 4, semester: 4, dept: 'ece', faculty: 'ece1' },
  { code: 'EEE501', name: 'Power Systems', credits: 4, semester: 5, dept: 'eee', faculty: 'eee2' },
  { code: 'EEE502', name: 'Control Systems', credits: 4, semester: 5, dept: 'eee', faculty: 'eee1' },
  { code: 'EEE401', name: 'Electrical Machines', credits: 4, semester: 4, dept: 'eee', faculty: 'eee2' },
  { code: 'EEE402', name: 'Network Theory', credits: 3, semester: 4, dept: 'eee', faculty: 'eee1' },
  { code: 'ME501', name: 'Heat Transfer', credits: 4, semester: 5, dept: 'mech', faculty: 'mech2' },
  { code: 'ME502', name: 'Design of Machine Elements', credits: 4, semester: 5, dept: 'mech', faculty: 'mech1' },
  { code: 'ME401', name: 'Thermodynamics', credits: 4, semester: 4, dept: 'mech', faculty: 'mech2' },
  { code: 'ME402', name: 'Fluid Mechanics', credits: 4, semester: 4, dept: 'mech', faculty: 'mech1' },
  { code: 'CE501', name: 'Structural Analysis', credits: 4, semester: 5, dept: 'civil', faculty: 'civil2' },
  { code: 'CE502', name: 'Geotechnical Engineering', credits: 4, semester: 5, dept: 'civil', faculty: 'civil1' },
  { code: 'CE401', name: 'Surveying', credits: 3, semester: 4, dept: 'civil', faculty: 'civil2' },
  { code: 'CE402', name: 'Strength of Materials', credits: 4, semester: 4, dept: 'civil', faculty: 'civil1' },
  { code: 'IT501', name: 'Web Application Development', credits: 4, semester: 5, dept: 'it', faculty: 'it1' },
  { code: 'IT502', name: 'Data Mining', credits: 4, semester: 5, dept: 'it', faculty: 'it2' },
  { code: 'IT401', name: 'Java Programming', credits: 4, semester: 4, dept: 'it', faculty: 'it1' },
  { code: 'IT402', name: 'Software Testing', credits: 3, semester: 4, dept: 'it', faculty: 'it2' }
];
const courseId = (code: string) => (code === 'CSE501' ? SEED.cse501.course : `demo-course-${code.toLowerCase()}`);
const classId = (code: string) => (code === 'CSE501' ? SEED.cse501.class : `demo-class-${code.toLowerCase()}-a`);

// ── Students ────────────────────────────────────────────────────────────────

type Gender = 'male' | 'female';
const CSE_NAMES: Array<[string, string, Gender]> = [
  // Roll 001 is the seeded `student@` account; these are rolls 002–030.
  ['Aarav', 'Sharma', 'male'], ['Bhavya', 'Reddy', 'female'], ['Charan', 'Teja', 'male'], ['Deepika', 'Nair', 'female'],
  ['Eshwar', 'Rao', 'male'], ['Farhan', 'Ahmed', 'male'], ['Gayatri', 'Iyer', 'female'], ['Harsha', 'Vardhan', 'male'],
  ['Ishita', 'Verma', 'female'], ['Jaswanth', 'Kumar', 'male'], ['Kavya', 'Menon', 'female'], ['Lokesh', 'Naidu', 'male'],
  ['Meghana', 'Chowdary', 'female'], ['Nikhil', 'Varma', 'male'], ['Ojaswi', 'Patel', 'female'], ['Pranav', 'Joshi', 'male'],
  ['Qureshi', 'Imran', 'male'], ['Rithika', 'Das', 'female'], ['Sai', 'Kiran', 'male'], ['Tanvi', 'Agarwal', 'female'],
  ['Uday', 'Bhaskar', 'male'], ['Varsha', 'Pillai', 'female'], ['Wasim', 'Akram', 'male'], ['Yamini', 'Krishna', 'female'],
  ['Zaheer', 'Khan', 'male'], ['Akhila', 'Devi', 'female'], ['Bharath', 'Simha', 'male'], ['Chaitra', 'Hegde', 'female'],
  ['Dinesh', 'Karthik', 'male']
];
const OTHER_NAMES: Record<string, Array<[string, string, Gender]>> = {
  ece: [['Abhinav', 'Mishra', 'male'], ['Bindu', 'Madhavi', 'female'], ['Chetan', 'Gowda', 'male'], ['Dhanya', 'Lakshmi', 'female'], ['Eswari', 'Prasad', 'female']],
  eee: [['Fayaz', 'Basha', 'male'], ['Girish', 'Babu', 'male'], ['Hema', 'Malini', 'female'], ['Indu', 'Priya', 'female'], ['Jagadeesh', 'Chandra', 'male']],
  mech: [['Karthik', 'Raja', 'male'], ['Lohith', 'Sagar', 'male'], ['Manoj', 'Kumar', 'male'], ['Neha', 'Singh', 'female'], ['Omkar', 'Deshmukh', 'male']],
  civil: [['Pavan', 'Kalyan', 'male'], ['Ramya', 'Sree', 'female'], ['Sumanth', 'Reddy', 'male'], ['Tejaswini', 'Rao', 'female'], ['Umesh', 'Yadav', 'male']],
  it: [['Vamsi', 'Krishna', 'male'], ['Anusha', 'Bhat', 'female'], ['Yashwanth', 'Goud', 'male'], ['Sneha', 'Kapoor', 'female'], ['Rohan', 'Mehta', 'male']]
};
const CATEGORIES = ['General', 'OBC', 'General', 'SC', 'OBC', 'General', 'EWS', 'OBC', 'ST', 'General'];
const STATES = ['Andhra Pradesh', 'Andhra Pradesh', 'Andhra Pradesh', 'Telangana', 'Andhra Pradesh', 'Karnataka', 'Andhra Pradesh', 'Tamil Nadu', 'Andhra Pradesh', 'Odisha'];

interface Student {
  dept: string; roll: string; name: string; email: string; gender: Gender;
  userId: string; profileId: string; category: string; state: string; hosteller: boolean;
  /** 0–1: drives marks. */
  ability: number;
  /** 0–1: probability of being present for a class. */
  regularity: number;
}

function buildStudents(): Student[] {
  const students: Student[] = [];
  const add = (deptKey: string, index: number, first: string, last: string, gender: Gender, existing?: { user: string; profile: string; email: string; name: string }) => {
    const d = dept(deptKey);
    const roll = `CH2024${d.rollTag}${pad(index)}`;
    const random = rng(hash(roll));
    // Most of a class sits between a B and an A+, with a short tail. The first
    // version spread ability evenly from 42% up, which put a third of the class
    // "at risk" and one student on a 1.5 CGPA — not a credible demo cohort.
    const ability = clamp(0.56 + random() * 0.4 - (random() < 0.08 ? 0.12 : 0), 0.45, 0.97);
    // A handful attend poorly so the shortage and condonation screens have cases.
    const regularity = random() < 0.14 ? 0.58 + random() * 0.14 : 0.8 + random() * 0.18;
    students.push({
      dept: deptKey, roll, gender,
      name: existing?.name ?? `${first} ${last}`,
      email: existing?.email ?? `${first}.${last}@${EMAIL_DOMAIN}`.toLowerCase(),
      userId: existing?.user ?? `demo-user-${roll.toLowerCase()}`,
      profileId: existing?.profile ?? `demo-student-${roll.toLowerCase()}`,
      category: CATEGORIES[hash(roll + 'c') % CATEGORIES.length]!,
      state: STATES[hash(roll + 's') % STATES.length]!,
      hosteller: hash(roll + 'h') % 3 === 0,
      ability, regularity
    });
  };
  add('cse', 1, 'Ananya', 'Student', 'female', { user: SEED.student.user, profile: SEED.student.profile, email: `student@${EMAIL_DOMAIN}`, name: 'Ananya Student' });
  CSE_NAMES.forEach(([first, last, gender], i) => add('cse', i + 2, first, last, gender));
  for (const [deptKey, names] of Object.entries(OTHER_NAMES)) {
    names.forEach(([first, last, gender], i) => add(deptKey, i + 1, first, last, gender));
  }
  return students;
}

// ── Timetable ───────────────────────────────────────────────────────────────

const PERIODS: Array<[string, string]> = [['09:00', '10:00'], ['10:00', '11:00'], ['11:15', '12:15'], ['12:15', '13:15'], ['14:00', '15:00']];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
/** Day → course code per period (null = free). */
const TIMETABLE: Record<string, Record<string, Array<string | null>>> = {
  cse: {
    Monday: ['CSE502', 'CSE501', 'CSE503', 'CSE505', null],
    Tuesday: ['CSE503', 'CSE504', 'CSE505', 'CSE506', null],
    Wednesday: ['CSE501', 'CSE502', 'CSE504', 'CSE503', null],
    Thursday: ['CSE505', 'CSE506', 'CSE501', 'CSE502', null],
    Friday: ['CSE504', 'CSE503', 'CSE506', 'CSE505', null]
  },
  ece: { Monday: ['ECE501', 'ECE502'], Wednesday: ['ECE502', 'ECE501'], Friday: ['ECE501', 'ECE502'] },
  eee: { Monday: ['EEE501', 'EEE502'], Wednesday: ['EEE502', 'EEE501'], Friday: ['EEE501', 'EEE502'] },
  mech: { Tuesday: ['ME501', 'ME502'], Thursday: ['ME502', 'ME501'], Friday: ['ME501', 'ME502'] },
  civil: { Tuesday: ['CE501', 'CE502'], Thursday: ['CE502', 'CE501'], Friday: ['CE501', 'CE502'] },
  it: { Monday: ['IT501', 'IT502'], Wednesday: ['IT502', 'IT501'], Thursday: ['IT501', 'IT502'] }
};

/**
 * The demo class's afternoons and Saturday. With only the four morning
 * lectures the day ended at 13:15, which no engineering timetable does: the
 * afternoon is labs (one three-hour block) or tutorials, and Saturday is a
 * half day. Lunch is 13:15–14:00.
 */
const CSE_EXTRA_SLOTS: Array<{ day: string; start: string; end: string; code: string; type: 'Lab' | 'Tutorial' | 'Lecture'; room: string }> = [
  { day: 'Monday', start: '14:00', end: '16:45', code: 'CSE502', type: 'Lab', room: 'CSE Lab 1' },
  { day: 'Tuesday', start: '14:00', end: '15:00', code: 'CSE501', type: 'Tutorial', room: 'CSE-301' },
  { day: 'Tuesday', start: '15:00', end: '16:00', code: 'CSE506', type: 'Lecture', room: 'CSE-301' },
  { day: 'Wednesday', start: '14:00', end: '16:45', code: 'CSE503', type: 'Lab', room: 'CSE Lab 2' },
  { day: 'Thursday', start: '14:00', end: '16:45', code: 'CSE504', type: 'Lab', room: 'Networks Lab' },
  { day: 'Friday', start: '14:00', end: '15:00', code: 'CSE505', type: 'Tutorial', room: 'CSE-302' },
  { day: 'Friday', start: '15:00', end: '16:00', code: 'CSE501', type: 'Lecture', room: 'CSE-302' },
  { day: 'Saturday', start: '09:00', end: '10:00', code: 'CSE506', type: 'Lecture', room: 'CSE-301' },
  { day: 'Saturday', start: '10:00', end: '11:00', code: 'CSE505', type: 'Lecture', room: 'CSE-301' },
  { day: 'Saturday', start: '11:15', end: '12:15', code: 'CSE501', type: 'Tutorial', room: 'CSE-302' },
  { day: 'Saturday', start: '12:15', end: '13:15', code: 'CSE504', type: 'Lecture', room: 'CSE-302' }
];

/** Grade bands of the seeded DEFAULT-10 scale. */
function grade(total: number): { letter: string; point: number; passing: boolean } {
  const bands: Array<[number, string, number]> = [[90, 'O', 10], [80, 'A+', 9], [70, 'A', 8], [60, 'B+', 7], [50, 'B', 6], [45, 'C', 5], [40, 'P', 4]];
  for (const [min, letter, point] of bands) if (total >= min) return { letter, point, passing: true };
  return { letter: 'F', point: 0, passing: false };
}

// ════════════════════════════════════════════════════════════════════════════

async function main() {
  const tenant = await prisma.institution.findUnique({ where: { id: INSTITUTION }, select: { id: true } });
  const scale = await prisma.gradeScale.findFirst({ where: { institutionId: INSTITUTION, isActive: true }, select: { id: true } });
  if (!tenant || !scale) {
    throw new Error('Base seed has not run. Run `npx prisma db seed` (or `tsx prisma/seed.ts`) first.');
  }

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const students = buildStudents();
  const cseClass = students.filter((s) => s.dept === 'cse');
  const log = (label: string, detail: string | number) => console.log(`  ${label.padEnd(34)} ${detail}`);
  console.log('Seeding the engineering-college demo…');

  // ── Institution ───────────────────────────────────────────────────────────
  await prisma.institution.update({
    where: { id: INSTITUTION },
    data: {
      name: 'Campus Harmony Institute of Engineering and Technology',
      legalName: 'Campus Harmony Institute of Engineering and Technology (demo data)',
      type: 'autonomous_college',
      city: 'Vijayawada', state: 'Andhra Pradesh', pincode: '520008',
      addressLine: 'Knowledge Park Road',
      email: `info@${EMAIL_DOMAIN}`,
      establishedAt: new Date('2008-07-01T00:00:00.000Z')
    }
  });
  await prisma.campus.update({ where: { id: CAMPUS }, data: { city: 'Vijayawada', state: 'Andhra Pradesh' } });

  await upsertById(prisma.school, 'demo-school-engineering', {
    institutionId: INSTITUTION, campusId: CAMPUS, code: 'SOE', name: 'School of Engineering',
    deanUserId: SEED.users.dean, isActive: true
  });

  // ── Departments ───────────────────────────────────────────────────────────
  for (const d of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { institutionId_code: { institutionId: INSTITUTION, code: d.code } },
      update: { name: d.name, schoolId: 'demo-school-engineering', campusId: CAMPUS },
      create: { id: d.id, institutionId: INSTITUTION, campusId: CAMPUS, schoolId: 'demo-school-engineering', code: d.code, name: d.name }
    });
  }
  log('departments', DEPARTMENTS.length);

  // ── Staff accounts and faculty profiles ───────────────────────────────────
  await inChunks(STAFF, 6, async (s) => {
    if (!s.existing) {
      await prisma.user.upsert({
        where: { email: s.email },
        update: { name: s.name, role: s.role, designation: s.designation, departmentId: dept(s.dept).id, institutionId: INSTITUTION, campusId: CAMPUS, campus: 'Main Campus' },
        create: { id: staffUserId(s), email: s.email, password: hashedPassword, name: s.name, role: s.role, designation: s.designation, departmentId: dept(s.dept).id, institutionId: INSTITUTION, campusId: CAMPUS, campus: 'Main Campus' }
      });
    }
    const profile = {
      institutionId: INSTITUTION, campusId: CAMPUS,
      employeeId: s.existing ? 'EMP-CSE-1001' : `EMP-${dept(s.dept).code}-${1001 + STAFF.filter((x) => x.dept === s.dept).indexOf(s)}`,
      qualification: s.qualification, qualificationLevel: s.level,
      // Left unverified on purpose: verification is a registrar action
      // (workflow FACULTY_QUALIFICATION_VERIFICATION), not something a seed asserts.
      specialization: s.specialization, experience: s.experience,
      employmentType: 'regular', gender: s.gender,
      dateOfJoining: new Date(Date.UTC(2026 - Math.min(s.experience, 16), 6, 1))
    };
    await prisma.facultyProfile.upsert({
      where: { userId: staffUserId(s) },
      update: profile,
      create: { id: staffProfileId(s), userId: staffUserId(s), ...profile }
    });
  });
  // Each department records its head. CSE's is the seeded `hod@` account.
  await prisma.department.update({ where: { id: dept('cse').id }, data: { hodUserId: SEED.users.hod } });
  for (const s of STAFF.filter((x) => x.role === 'hod')) {
    await prisma.department.update({ where: { id: dept(s.dept).id }, data: { hodUserId: staffUserId(s) } });
  }
  log('faculty and HOD accounts', STAFF.length);

  // ── Programmes, batches, sections ─────────────────────────────────────────
  for (const d of DEPARTMENTS) {
    const programmeId = `demo-programme-${d.key}`;
    const batchId = `demo-batch-${d.key}-2024`;
    await upsertById(prisma.programme, programmeId, {
      institutionId: INSTITUTION, departmentId: d.id, code: `BTECH-${d.code}`, name: `B.Tech ${d.name}`,
      level: 'UG', durationYears: 4, totalSemesters: 8, totalCredits: 160, sanctionedIntake: 60, isActive: true
    });
    await upsertById(prisma.batch, batchId, {
      institutionId: INSTITUTION, programmeId, code: `${d.code}-2024-28`, name: `B.Tech ${d.code} 2024–28`,
      admissionYear: 2024, expectedGraduationYear: 2028, currentSemester: 5, status: 'active'
    });
    const advisor = STAFF.find((s) => s.dept === d.key && s.role === 'faculty');
    await upsertById(prisma.section, `demo-section-${d.key}-a`, {
      institutionId: INSTITUTION, batchId, code: 'A', name: 'Section A', capacity: 60,
      classAdvisorUserId: advisor ? staffUserId(advisor) : null
    });
  }

  // ── Students ──────────────────────────────────────────────────────────────
  await inChunks(students, 8, async (s) => {
    const d = dept(s.dept);
    const isSeeded = s.userId === SEED.student.user;
    if (!isSeeded) {
      await prisma.user.upsert({
        where: { email: s.email },
        update: { name: s.name, role: 'student', designation: 'Student', departmentId: d.id, institutionId: INSTITUTION, campusId: CAMPUS, campus: 'Main Campus' },
        create: { id: s.userId, email: s.email, password: hashedPassword, name: s.name, role: 'student', designation: 'Student', departmentId: d.id, institutionId: INSTITUTION, campusId: CAMPUS, campus: 'Main Campus' }
      });
    }
    const random = rng(hash(s.roll + 'dob'));
    const profile = {
      institutionId: INSTITUTION, campusId: CAMPUS,
      programmeId: `demo-programme-${d.key}`, batchId: `demo-batch-${d.key}-2024`, sectionId: `demo-section-${d.key}-a`,
      rollNumber: s.roll, program: 'B.Tech', branch: d.branch, section: 'A', batch: '2024', semester: 5, admissionYear: 2024,
      // The programme's credit requirement. Earned credits stay with the engine.
      ...(isSeeded ? {} : { totalCredits: 160 }),
      gender: s.gender, category: s.category, domicileState: s.state, nationality: 'Indian', isHosteller: s.hosteller,
      dateOfBirth: new Date(Date.UTC(2006, Math.floor(random() * 12), 1 + Math.floor(random() * 27)))
    };
    await prisma.studentProfile.upsert({
      where: { userId: s.userId },
      // cgpa and credits are NOT set here: the results engine owns them.
      update: profile,
      create: { id: s.profileId, userId: s.userId, ...profile, cgpa: 0 }
    });
  });
  log('students', `${students.length} (${cseClass.length} in the CSE demo class)`);

  // ── Courses, classes, enrolments ──────────────────────────────────────────
  for (const c of COURSES) {
    // `Course.facultyId` is who teaches it NOW. A completed Semester 4 subject
    // has no current teacher; leaving last term's name on it made every faculty
    // member appear to be teaching two courses to sixty students.
    const data = { name: c.name, credits: c.credits, semester: c.semester, departmentId: dept(c.dept).id, facultyId: c.semester === 5 ? staffProfileId(staff(c.faculty)) : null };
    await prisma.course.upsert({
      where: { institutionId_code: { institutionId: INSTITUTION, code: c.code } },
      update: data,
      create: { id: courseId(c.code), institutionId: INSTITUTION, code: c.code, ...data }
    });
    if (c.semester === 5) {
      await upsertById(db.courseClass, classId(c.code), {
        courseId: courseId(c.code), facultyId: staffProfileId(staff(c.faculty)), section: 'A', batch: '2024', name: `${c.code} Section A`
      });
    }
  }
  log('courses', COURSES.length);

  // Enrolments are for the RUNNING semester. An earlier version of this seed
  // also enrolled everyone in their Semester 4 subjects, which every screen
  // then counted as current: "12 active courses", last term's subjects at 0%
  // attendance. Finished subjects are recorded as results, not enrolments.
  await prisma.enrollment.deleteMany({ where: { id: { startsWith: 'demo-enr-' }, semester: 4 } });

  const enrollments: any[] = [];
  const classEnrollments: any[] = [];
  for (const c of COURSES.filter((x) => x.semester === 5)) {
    for (const s of students.filter((x) => x.dept === c.dept)) {
      const random = rng(hash(s.roll + c.code));
      // Internal assessment out of 100 — the scale the gradebook enters and
      // every screen displays.
      const internal = Math.round(clamp(s.ability * 100 + (random() - 0.5) * 18, 30, 98));
      const isSeededPair = s.profileId === SEED.student.profile && c.code === 'CSE501';
      if (!isSeededPair) {
        enrollments.push({ id: `demo-enr-${s.roll}-${c.code}`.toLowerCase(), studentProfileId: s.profileId, courseId: courseId(c.code), semester: c.semester, internalMarks: internal });
        if (c.semester === 5) classEnrollments.push({ id: `demo-cen-${s.roll}-${c.code}`.toLowerCase(), classId: classId(c.code), studentProfileId: s.profileId });
      }
    }
  }
  log('course enrolments', await createMissing(prisma.enrollment, enrollments) + ' new');
  // Rows from before the scale changed carried marks out of 40.
  const stored = await prisma.enrollment.findMany({ where: { id: { in: enrollments.map((e) => e.id) } }, select: { id: true, internalMarks: true } });
  const wanted = new Map(enrollments.map((e) => [e.id, e.internalMarks]));
  await inChunks(stored.filter((e) => e.internalMarks !== wanted.get(e.id)), 10, (e) =>
    prisma.enrollment.update({ where: { id: e.id }, data: { internalMarks: wanted.get(e.id) } }));
  await createMissing(db.classEnrollment, classEnrollments);

  // ── Timetable ─────────────────────────────────────────────────────────────
  const schedules: any[] = [];
  const slots: any[] = [];
  for (const [deptKey, days] of Object.entries(TIMETABLE)) {
    const d = dept(deptKey);
    for (const [dayName, codes] of Object.entries(days)) {
      codes.forEach((code, period) => {
        if (!code) return;
        const course = COURSES.find((c) => c.code === code)!;
        const [start, end] = PERIODS[period]!;
        const key = `${code}-${dayName}-${start}`.toLowerCase().replace(':', '');
        const room = `${d.block}-30${1 + (period % 2)}`;
        // seed.ts already owns the Monday 10:00 Cloud Computing lecture.
        if (!(code === 'CSE501' && dayName === 'Monday')) {
          schedules.push({ id: `demo-sch-${key}`, courseId: courseId(code), day: dayName, startTime: start, endTime: end, room, type: 'Lecture' });
        }
        slots.push({
          id: `demo-slot-${key}`, day: dayName, startTime: start, endTime: end, courseCode: code, courseName: course.name,
          faculty: staff(course.faculty).name, room, section: 'A', type: 'Lecture', departmentId: d.id
        });
      });
    }
  }
  const cse = dept('cse');
  for (const x of CSE_EXTRA_SLOTS) {
    const course = COURSES.find((c) => c.code === x.code)!;
    const key = `${x.code}-${x.day}-${x.start}`.toLowerCase().replace(':', '');
    schedules.push({ id: `demo-sch-${key}`, courseId: courseId(x.code), day: x.day, startTime: x.start, endTime: x.end, room: x.room, type: x.type });
    slots.push({
      id: `demo-slot-${key}`, day: x.day, startTime: x.start, endTime: x.end, courseCode: x.code, courseName: course.name,
      faculty: staff(course.faculty).name, room: x.room, section: 'A', type: x.type, departmentId: cse.id
    });
  }
  await createMissing(prisma.courseSchedule, schedules);
  log('timetable slots', await createMissing(prisma.timetableSlot, slots) + ' new');

  // ── Attendance: the last four weeks of classes actually held ──────────────
  const sessions: any[] = [];
  const marks: any[] = [];
  for (let back = 28; back >= 1; back--) {
    const date = new Date(Date.now() - back * DAY_MS);
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getUTCDay()]!;
    if (!WEEKDAYS.includes(dayName)) continue;
    const stamp = date.toISOString().slice(0, 10).replace(/-/g, '');
    const classDate = new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);
    for (const [deptKey, days] of Object.entries(TIMETABLE)) {
      (days[dayName] ?? []).forEach((code, period) => {
        if (!code) return;
        const course = COURSES.find((c) => c.code === code)!;
        const [start, end] = PERIODS[period]!;
        const sessionId = `demo-as-${code}-${stamp}-${start.replace(':', '')}`.toLowerCase();
        sessions.push({ id: sessionId, courseId: courseId(code), facultyId: staffProfileId(staff(course.faculty)), date: classDate, startTime: start, endTime: end, type: 'lecture' });
        for (const s of students.filter((x) => x.dept === deptKey)) {
          const present = rng(hash(sessionId + s.roll))() < s.regularity;
          marks.push({ id: `demo-att-${sessionId}-${s.roll}`.toLowerCase(), attendanceSessionId: sessionId, studentProfileId: s.profileId, status: present ? 'present' : 'absent' });
        }
      });
    }
  }
  await createMissing(prisma.attendanceSession, sessions);
  log('attendance records', `${await createMissing(prisma.attendance, marks)} new across ${sessions.length} class sessions`);

  const attendancePct = new Map<string, number>();
  for (const s of students) {
    const mine = marks.filter((m) => m.studentProfileId === s.profileId);
    attendancePct.set(s.profileId, mine.length ? Math.round((mine.filter((m) => m.status === 'present').length / mine.length) * 1000) / 10 : 0);
  }

  // ── Lesson plans and assignments for the six demo-class subjects ──────────
  const demoCourses = COURSES.filter((c) => c.dept === 'cse' && c.semester === 5);
  const submissions: any[] = [];
  for (const c of demoCourses) {
    for (const [week, topic] of (c.topics ?? []).entries()) {
      // Week 1 began five weeks ago, so weeks 1–5 are taught and 6–8 are ahead.
      const planned = daysFromNow((week - 5) * 7);
      await prisma.facultyLessonPlan.upsert({
        where: { courseId_weekNumber: { courseId: courseId(c.code), weekNumber: week + 1 } },
        update: {},
        create: {
          id: `demo-plan-${c.code}-${week + 1}`.toLowerCase(), courseId: courseId(c.code), weekNumber: week + 1, topic,
          subtopics: [], courseOutcome: `CO${Math.floor(week / 2) + 1}`, plannedDate: planned, status: week < 5 ? 'completed' : 'pending'
        }
      });
    }
    const assignments = [
      { n: 1, title: `${c.name} — Assignment 1`, description: `Problem set on ${c.topics![1]!.toLowerCase()} and ${c.topics![2]!.toLowerCase()}.`, due: -9 },
      { n: 2, title: `${c.name} — Assignment 2`, description: `Case study on ${c.topics![4]!.toLowerCase()}.`, due: 8 }
    ];
    for (const a of assignments) {
      const assignmentId = `demo-asg-${c.code}-${a.n}`.toLowerCase();
      await createIfMissing(prisma.assignment, assignmentId, {
        classId: classId(c.code), title: a.title, description: a.description, dueDate: daysFromNow(a.due), maxMarks: 50, status: 'published'
      });
      for (const s of cseClass) {
        const random = rng(hash(assignmentId + s.roll));
        const roll = random();
        // Past-due work is mostly evaluated; the open one is partly handed in.
        if (a.due < 0 ? roll < 0.93 : roll < 0.45) {
          const evaluated = a.due < 0 && random() < 0.85;
          submissions.push({
            id: `demo-sub-${assignmentId}-${s.roll}`.toLowerCase(), assignmentId, studentProfileId: s.profileId,
            submittedAt: daysFromNow(a.due < 0 ? a.due - 1 - Math.floor(random() * 4) : -Math.floor(random() * 3)),
            status: evaluated ? 'evaluated' : 'submitted',
            obtainedMarks: evaluated ? Math.round(clamp(s.ability * 50 + (random() - 0.5) * 10, 15, 50)) : null,
            feedback: evaluated ? (s.ability > 0.8 ? 'Thorough and well reasoned.' : s.ability > 0.6 ? 'Correct approach; tighten the explanation.' : 'Revisit the core concept and resubmit the last two problems.') : null,
            fileUrl: null
          });
        }
      }
    }
  }
  log('assignment submissions', await createMissing(prisma.submission, submissions) + ' new');

  // ── Mentoring: five mentees per CSE subject teacher ───────────────────────
  const cseFaculty = STAFF.filter((s) => s.dept === 'cse' && s.role === 'faculty');
  await createMissing(db.menteeAssignment, cseClass.map((s, i) => ({
    id: `demo-mentee-${s.roll}`.toLowerCase(), facultyId: staffProfileId(cseFaculty[i % cseFaculty.length]!), studentId: s.profileId,
    lastMeeting: daysFromNow(-(3 + (i % 12))), notes: []
  })));

  // ── Semester 4 results — published, then the engine computes SGPA / CGPA ──
  const results: any[] = [];
  for (const c of COURSES.filter((x) => x.semester === 4)) {
    for (const s of students.filter((x) => x.dept === c.dept)) {
      const random = rng(hash(s.roll + c.code + 'result'));
      const internal = Math.round(clamp(s.ability * 40 + (random() - 0.5) * 8, 10, 40));
      const external = Math.round(clamp(s.ability * 60 + (random() - 0.5) * 16, 14, 60));
      const g = grade(internal + external);
      results.push({
        id: `demo-cr-${s.roll}-${c.code}`.toLowerCase(), institutionId: INSTITUTION, studentProfileId: s.profileId, courseId: courseId(c.code),
        semester: 4, academicYear: ACADEMIC_YEAR, internalMarks: internal, externalMarks: external, totalMarks: internal + external, maxMarks: 100,
        letterGrade: g.letter, gradePoint: g.point, credits: c.credits, isPassing: g.passing, isExcludedFromGpa: false, attempt: 1,
        status: 'published', publishedAt: daysFromNow(-120), publishedBy: SEED.users.coe
      });
    }
  }
  // The distribution above changed once; results written under the old one are
  // replaced, so re-seeding an existing database converges on the same class.
  const RESULTS_VERSION = 'v2';
  const stale = await prisma.courseResult.count({ where: { id: { startsWith: 'demo-cr-' }, NOT: { id: { endsWith: `-${RESULTS_VERSION}` } } } });
  if (stale > 0) {
    await prisma.courseResult.deleteMany({ where: { id: { startsWith: 'demo-cr-' } } });
    await prisma.semesterResult.deleteMany({ where: { semester: 4, academicYear: ACADEMIC_YEAR, studentProfileId: { in: students.map((s) => s.profileId) } } });
  }
  for (const r of results) r.id = `${r.id}-${RESULTS_VERSION}`;
  const newResults = await createMissing(prisma.courseResult, results);
  if (newResults > 0) {
    await runWithTenant(
      { institutionId: INSTITUTION, campusId: null, userId: SEED.users.coe, role: 'coe' } as never,
      async () => { for (const s of students) await recomputeStudentResults(s.profileId); }
    );
  }
  // The semester records the engine just computed are released as a set. This is
  // the final step of publishSemesterResults(); it is done directly here because
  // that function recomputes every student inside ONE transaction, which for a
  // whole college outlasts the transaction timeout against a remote cluster.
  await prisma.semesterResult.updateMany({
    where: { institutionId: INSTITUTION, semester: 4, academicYear: ACADEMIC_YEAR, status: { not: 'published' }, studentProfileId: { in: students.map((s) => s.profileId) } },
    data: { status: 'published', publishedAt: daysFromNow(-120), publishedBy: SEED.users.coe }
  });
  log('semester 4 results', `${newResults} new — CGPA computed by the results engine`);

  // ── Graduating batch: B.Tech CSE 2022–26, Semester 8 ─────────────────────
  //
  // The alumni office works with the students who are leaving. With only a
  // third-year class in the demo, its directory was empty and "Sync Alumni" had
  // no one to find. Eight of these students already have an alumni profile with
  // their placement outcome; four do not, so syncing visibly adds them.
  const FINAL_YEAR: Array<[string, string, Gender, string | null, string | null]> = [
    ['Rahul', 'Menon', 'male', 'Nimbus Software Labs', 'Software Engineer'],
    ['Sowmya', 'Reddy', 'female', 'Aarohan Analytics', 'Data Analyst'],
    ['Vikas', 'Chandra', 'male', 'Vertex Infotech', 'Graduate Engineer Trainee'],
    ['Lavanya', 'Iyer', 'female', 'Nimbus Software Labs', 'Associate Developer'],
    ['Arjun', 'Pillai', 'male', 'Sunrise Embedded Technologies', 'Firmware Engineer'],
    ['Pooja', 'Nair', 'female', 'Aarohan Analytics', 'Business Analyst'],
    ['Kiran', 'Kumar', 'male', 'Vertex Infotech', 'Systems Engineer'],
    ['Divya', 'Sri', 'female', 'Deccan Power Solutions', 'IT Analyst'],
    ['Manish', 'Gupta', 'male', null, null],
    ['Shreya', 'Rao', 'female', null, null],
    ['Teja', 'Varma', 'male', null, null],
    ['Ayesha', 'Begum', 'female', null, null]
  ];
  const FINAL_COURSES: Array<[string, string, number]> = [
    ['CSE701', 'Machine Learning', 4], ['CSE702', 'Cryptography and Network Security', 3], ['CSE703', 'Big Data Analytics', 3]
  ];
  await upsertById(prisma.batch, 'demo-batch-cse-2022', {
    institutionId: INSTITUTION, programmeId: 'demo-programme-cse', code: 'CSE-2022-26', name: 'B.Tech CSE 2022–26',
    admissionYear: 2022, expectedGraduationYear: 2026, currentSemester: 8, status: 'active'
  });
  await upsertById(prisma.section, 'demo-section-cse-2022-a', {
    institutionId: INSTITUTION, batchId: 'demo-batch-cse-2022', code: 'A', name: 'Section A', capacity: 60, classAdvisorUserId: staffUserId(staff('cse5'))
  });
  for (const [code, name, credits] of FINAL_COURSES) {
    await prisma.course.upsert({
      where: { institutionId_code: { institutionId: INSTITUTION, code } },
      update: { name, credits, semester: 7, departmentId: dept('cse').id, facultyId: null },
      create: { id: `demo-course-${code.toLowerCase()}`, institutionId: INSTITUTION, code, name, credits, semester: 7, departmentId: dept('cse').id, facultyId: null }
    });
  }
  const finalYear = FINAL_YEAR.map(([first, last, gender, company, role], i) => {
    const roll = `CH2022CS${pad(i + 1)}`;
    return { roll, first, last, gender, company, role, name: `${first} ${last}`, email: `${first}.${last}@${EMAIL_DOMAIN}`.toLowerCase(), userId: `demo-user-${roll.toLowerCase()}`, profileId: `demo-student-${roll.toLowerCase()}` };
  });
  await inChunks(finalYear, 6, async (f) => {
    await prisma.user.upsert({
      where: { email: f.email },
      update: { name: f.name, role: 'student', designation: 'Student', departmentId: dept('cse').id, institutionId: INSTITUTION, campusId: CAMPUS, campus: 'Main Campus' },
      create: { id: f.userId, email: f.email, password: hashedPassword, name: f.name, role: 'student', designation: 'Student', departmentId: dept('cse').id, institutionId: INSTITUTION, campusId: CAMPUS, campus: 'Main Campus' }
    });
    const profile = {
      institutionId: INSTITUTION, campusId: CAMPUS, programmeId: 'demo-programme-cse', batchId: 'demo-batch-cse-2022', sectionId: 'demo-section-cse-2022-a',
      rollNumber: f.roll, program: 'B.Tech', branch: 'Computer Science', section: 'A', batch: '2022', semester: 8, admissionYear: 2022,
      gender: f.gender, category: CATEGORIES[hash(f.roll + 'c') % CATEGORIES.length]!, domicileState: STATES[hash(f.roll + 's') % STATES.length]!,
      nationality: 'Indian', totalCredits: 160
    };
    await prisma.studentProfile.upsert({ where: { userId: f.userId }, update: profile, create: { id: f.profileId, userId: f.userId, ...profile, cgpa: 0 } });
    if (f.company) {
      await prisma.alumniProfile.upsert({
        where: { userId: f.userId },
        update: {},
        create: {
          id: `demo-alumni-${f.roll.toLowerCase()}`, userId: f.userId, graduationYear: 2026, currentCompany: f.company, currentRole: f.role,
          linkedIn: `https://www.linkedin.com/in/${f.first.toLowerCase()}-${f.last.toLowerCase()}-demo`
        }
      });
    }
  });
  // Semester 7 results, so the batch carries a real CGPA rather than reading as 0.
  const finalResults: any[] = [];
  for (const f of finalYear) {
    for (const [code, , credits] of FINAL_COURSES) {
      const random = rng(hash(f.roll + code));
      const internal = Math.round(clamp(26 + random() * 13, 10, 40));
      const external = Math.round(clamp(36 + random() * 22, 14, 60));
      const g = grade(internal + external);
      finalResults.push({
        id: `demo-cr-${f.roll}-${code}-v2`.toLowerCase(), institutionId: INSTITUTION, studentProfileId: f.profileId, courseId: `demo-course-${code.toLowerCase()}`,
        semester: 7, academicYear: ACADEMIC_YEAR, internalMarks: internal, externalMarks: external, totalMarks: internal + external, maxMarks: 100,
        letterGrade: g.letter, gradePoint: g.point, credits, isPassing: g.passing, isExcludedFromGpa: false, attempt: 1,
        status: 'published', publishedAt: daysFromNow(-150), publishedBy: SEED.users.coe
      });
    }
  }
  if ((await createMissing(prisma.courseResult, finalResults)) > 0) {
    await runWithTenant(
      { institutionId: INSTITUTION, campusId: null, userId: SEED.users.coe, role: 'coe' } as never,
      async () => { for (const f of finalYear) await recomputeStudentResults(f.profileId); }
    );
    await prisma.semesterResult.updateMany({
      where: { institutionId: INSTITUTION, semester: 7, academicYear: ACADEMIC_YEAR, studentProfileId: { in: finalYear.map((f) => f.profileId) } },
      data: { status: 'published', publishedAt: daysFromNow(-150), publishedBy: SEED.users.coe }
    });
  }
  log('graduating batch', `${finalYear.length} final-year students, ${finalYear.filter((f) => f.company).length} already in the alumni directory`);

  // ── Examination: schedule the other five papers and register the class ────
  const papers = demoCourses.filter((c) => c.code !== 'CSE501');
  for (const [i, c] of papers.entries()) {
    await upsertById(prisma.examSchedule, `demo-exam-schedule-${c.code}`.toLowerCase(), {
      institutionId: INSTITUTION, sessionId: SEED.examSession, courseId: courseId(c.code),
      examDate: daysFromNow(12 + i * 2), startTime: '10:00', endTime: '13:00', venue: 'Main Examination Hall', maxMarks: 100
    });
  }

  // ── Fees ──────────────────────────────────────────────────────────────────
  // Dues are seeded; payments are NOT typed in. They are recorded through the
  // finance service below, so every paid rupee has a Payment and a Receipt.
  type FeePlan = 'paid' | 'partial' | 'due' | 'overdue';
  const feePlan = new Map<string, FeePlan>();
  for (const s of students) {
    if (s.profileId === SEED.student.profile) continue; // seed.ts owns that student's dues
    const r = rng(hash(s.roll + 'fee'))();
    const plan: FeePlan = r < 0.6 ? 'paid' : r < 0.78 ? 'partial' : r < 0.9 ? 'due' : 'overdue';
    feePlan.set(s.profileId, plan);
    const dueDate = plan === 'overdue' ? daysFromNow(-20) : daysFromNow(12);
    await createIfMissing(prisma.feeRecord, `demo-fee-${s.roll}-tuition`.toLowerCase(), {
      institutionId: INSTITUTION, studentProfileId: s.profileId, type: 'tuition', description: 'Semester 5 tuition fee',
      amount: 78000, paidAmount: 0, waivedAmount: 0, dueDate, status: 'pending', academicYear: ACADEMIC_YEAR
    });
    await createIfMissing(prisma.feeRecord, `demo-fee-${s.roll}-exam`.toLowerCase(), {
      institutionId: INSTITUTION, studentProfileId: s.profileId, type: 'exam', description: 'Semester 5 examination fee',
      amount: 1500, paidAmount: 0, waivedAmount: 0, dueDate, status: 'pending', academicYear: ACADEMIC_YEAR
    });
  }
  const financeContext = { institutionId: INSTITUTION, campusId: null, scopeLevel: 'INSTITUTION', userId: SEED.users.finance, userName: 'Meera Finance', role: 'finance_officer' } as never;
  let payments = 0;
  await runWithTenant(financeContext, async () => {
    for (const s of students) {
      const plan = feePlan.get(s.profileId);
      if (plan !== 'paid' && plan !== 'partial') continue;
      // Already paid on an earlier run. The idempotency key would replay the
      // same payment, but keys expire after a day — so check the ledger instead.
      if ((await prisma.payment.count({ where: { studentProfileId: s.profileId } })) > 0) continue;
      const result = await recordPayment(financeContext, {
        studentProfileId: s.profileId,
        amount: plan === 'paid' ? 79500 : 40000,
        method: rng(hash(s.roll + 'method'))() < 0.7 ? 'upi' : 'netbanking',
        transactionReference: `DEMO${hash(s.roll + 'txn').toString().padStart(10, '0')}`,
        paidAt: daysFromNow(-(5 + (hash(s.roll) % 25))),
        remarks: 'Semester 5 fee',
        // The retry key is what makes a second seed run return the SAME payment.
        idempotencyKey: `demo-seed-fee-${s.roll}`
      });
      if (!result.replayed) payments++;
    }
  });
  log('fee payments', `${payments} new, recorded through the finance service`);

  // Exam registrations — eligibility follows from the attendance and fees above.
  const duesCleared = (s: Student) => s.profileId === SEED.student.profile || feePlan.get(s.profileId) === 'paid';
  const registrations: any[] = [];
  for (const c of papers) {
    for (const s of cseClass) {
      const pct = attendancePct.get(s.profileId) ?? 0;
      const attendanceMet = pct >= 75;
      const feesCleared = duesCleared(s);
      const reasons = [
        ...(attendanceMet ? [] : [`Attendance ${pct}% is below the required 75%.`]),
        ...(feesCleared ? [] : ['Fee dues are outstanding.'])
      ];
      registrations.push({
        id: `demo-reg-${s.roll}-${c.code}`.toLowerCase(), institutionId: INSTITUTION, sessionId: SEED.examSession,
        scheduleId: `demo-exam-schedule-${c.code}`.toLowerCase(), studentProfileId: s.profileId,
        attendancePercentage: pct, attendanceMet, feesCleared,
        outstandingFeeAmount: feesCleared ? 0 : feePlan.get(s.profileId) === 'partial' ? 39500 : 79500,
        isEligible: reasons.length === 0, ineligibilityReasons: reasons.length ? reasons : null,
        status: reasons.length === 0 ? 'registered' : 'ineligible', registeredBy: SEED.users.coe
      });
    }
  }
  log('exam registrations', await createMissing(prisma.examRegistration, registrations) + ' new');

  // ── Library ───────────────────────────────────────────────────────────────
  const BOOKS: Array<[string, string, string, string, string]> = [
    ['9780073523323', 'Database System Concepts', 'Silberschatz, Korth, Sudarshan', 'Database Systems', 'McGraw-Hill'],
    ['9781118063330', 'Operating System Concepts', 'Silberschatz, Galvin, Gagne', 'Operating Systems', 'Wiley'],
    ['9780132126953', 'Computer Networks', 'Andrew S. Tanenbaum', 'Computer Networks', 'Pearson'],
    ['9780262033848', 'Introduction to Algorithms', 'Cormen, Leiserson, Rivest, Stein', 'Algorithms', 'MIT Press'],
    ['9780133943030', 'Software Engineering', 'Ian Sommerville', 'Software Engineering', 'Pearson'],
    ['9780124114548', 'Distributed and Cloud Computing', 'Hwang, Fox, Dongarra', 'Cloud Computing', 'Morgan Kaufmann'],
    ['9780131873216', 'Discrete-Time Signal Processing', 'Oppenheim, Schafer', 'Electronics', 'Pearson'],
    ['9780321547743', 'CMOS VLSI Design', 'Weste, Harris', 'Electronics', 'Pearson'],
    ['9780071077750', 'Power System Engineering', 'Nagrath, Kothari', 'Electrical', 'McGraw-Hill'],
    ['9788122420012', 'Control Systems Engineering', 'Nagrath, Gopal', 'Electrical', 'New Age International'],
    ['9780073398174', 'Heat and Mass Transfer', 'Yunus A. Cengel', 'Mechanical', 'McGraw-Hill'],
    ['9780073529288', "Shigley's Mechanical Engineering Design", 'Budynas, Nisbett', 'Mechanical', 'McGraw-Hill'],
    ['9780133942842', 'Structural Analysis', 'R. C. Hibbeler', 'Civil', 'Pearson'],
    ['9781305635180', 'Principles of Geotechnical Engineering', 'Braja M. Das', 'Civil', 'Cengage'],
    ['9780123814791', 'Data Mining: Concepts and Techniques', 'Han, Kamber, Pei', 'Data Science', 'Morgan Kaufmann'],
    ['9780596517748', 'JavaScript: The Good Parts', 'Douglas Crockford', 'Web Technologies', "O'Reilly"],
    // A fuller shelf, so the student catalogue search has something to find.
    ['9780134685991', 'Effective Java', 'Joshua Bloch', 'Programming', 'Addison-Wesley'],
    ['9780201633610', 'Design Patterns', 'Gamma, Helm, Johnson, Vlissides', 'Software Engineering', 'Addison-Wesley'],
    ['9780132350884', 'Clean Architecture', 'Robert C. Martin', 'Software Engineering', 'Prentice Hall'],
    ['9781449373320', 'Designing Data-Intensive Applications', 'Martin Kleppmann', 'Database Systems', "O'Reilly"],
    ['9780262046305', 'Artificial Intelligence: A Modern Approach', 'Russell, Norvig', 'Artificial Intelligence', 'Pearson'],
    ['9780262035613', 'Deep Learning', 'Goodfellow, Bengio, Courville', 'Artificial Intelligence', 'MIT Press'],
    ['9781492032649', 'Hands-On Machine Learning', 'Aurélien Géron', 'Artificial Intelligence', "O'Reilly"],
    ['9780133594140', 'Computer Networking: A Top-Down Approach', 'Kurose, Ross', 'Computer Networks', 'Pearson'],
    ['9780131103627', 'The C Programming Language', 'Kernighan, Ritchie', 'Programming', 'Prentice Hall'],
    ['9780321573513', 'Algorithms', 'Sedgewick, Wayne', 'Algorithms', 'Addison-Wesley'],
    ['9780070634367', 'Engineering Mathematics', 'B. S. Grewal', 'Mathematics', 'Khanna Publishers'],
    ['9788120338647', 'Probability and Statistics for Engineers', 'Miller, Freund', 'Mathematics', 'PHI Learning'],
    ['9780199476770', 'Microelectronic Circuits', 'Sedra, Smith', 'Electronics', 'Oxford University Press'],
    ['9780132291545', 'Digital Design', 'M. Morris Mano', 'Electronics', 'Pearson'],
    ['9780070700154', 'Electrical Machinery', 'P. S. Bimbhra', 'Electrical', 'Khanna Publishers'],
    ['9789332555983', 'Modern Power System Analysis', 'Kothari, Nagrath', 'Electrical', 'McGraw-Hill'],
    ['9780073398204', 'Thermodynamics: An Engineering Approach', 'Cengel, Boles', 'Mechanical', 'McGraw-Hill'],
    ['9780470547557', 'Fluid Mechanics', 'Frank M. White', 'Mechanical', 'McGraw-Hill'],
    ['9789385909689', 'Strength of Materials', 'R. K. Rajput', 'Civil', 'S. Chand'],
    ['9788121916813', 'Surveying Vol. 1', 'B. C. Punmia', 'Civil', 'Laxmi Publications'],
    ['9781119456377', 'Software Testing', 'Ron Patton', 'Software Engineering', 'Sams'],
    ['9780134494166', 'Operating Systems: Internals and Design Principles', 'William Stallings', 'Operating Systems', 'Pearson']
  ];
  const copies: Array<{ id: string; title: string }> = [];
  let accession = 100;
  for (const [isbn, title, author, category, publisher] of BOOKS) {
    for (let copy = 1; copy <= 2; copy++) {
      accession++;
      const id = `demo-book-${accession}`;
      copies.push({ id, title });
      await createIfMissing(prisma.libraryBook, id, {
        institutionId: INSTITUTION, accessionNumber: `ACC-${pad(accession, 6)}`, isbn, title, author, category, publisher, status: 'available'
      });
    }
  }
  const librarianContext = { institutionId: INSTITUTION, campusId: null, scopeLevel: 'INSTITUTION', userId: SEED.users.librarian, userName: 'Maya Librarian', role: 'librarian' } as never;
  let loans = 0;
  // Only on a library that has never circulated a demo copy, so re-running
  // does not issue a second round of books.
  const alreadyCirculated = await prisma.libraryLoan.count({ where: { bookId: { in: copies.map((c) => c.id) } } });
  if (alreadyCirculated === 0) {
    await runWithTenant(librarianContext, async () => {
      for (let i = 0; i < 10; i++) {
        await issueBook(librarianContext, copies[i * 2]!.id, cseClass[(i * 3 + 1) % cseClass.length]!.profileId);
        loans++;
      }
    });
  }
  log('library', `${copies.length} copies, ${loans} new loans issued through the library service`);

  // ── Research output (NIRF: Research and Professional Practice) ────────────
  const JOURNALS = ['IEEE Access', 'Journal of Engineering Research', 'International Journal of Advanced Computing', 'Materials Today: Proceedings', 'Springer Lecture Notes in Engineering'];
  const publications: any[] = [];
  const projects: any[] = [];
  STAFF.forEach((s, i) => {
    const count = s.level === 'phd' ? 2 : 1;
    for (let n = 1; n <= count; n++) {
      publications.push({
        id: `demo-pub-${s.key}-${n}`, facultyProfileId: staffProfileId(s),
        title: `${n === 1 ? 'A Study of' : 'Recent Advances in'} ${s.specialization} for Engineering Applications`,
        journal: JOURNALS[(i + n) % JOURNALS.length]!, year: 2026 - ((i + n) % 3), status: n === 2 && i % 4 === 0 ? 'submitted' : 'published'
      });
    }
    if (s.level === 'phd' && i % 2 === 0) {
      projects.push({
        id: `demo-project-${s.key}`, facultyProfileId: staffProfileId(s), title: `Applied Research in ${s.specialization}`,
        fundingAgency: ['DST-SERB', 'AICTE', 'UGC', 'Industry sponsored'][i % 4]!, amount: 800000 + (i % 5) * 350000,
        amountSpent: 150000 + (i % 4) * 120000, status: 'ongoing'
      });
    }
  });
  await createMissing(prisma.publication, publications);
  await createMissing(prisma.researchProject, projects);
  log('research', `${publications.length} publications, ${projects.length} funded projects`);
  // Project periods and co-investigators, which the list used to fake as "today".
  for (const [i, pr] of projects.entries()) {
    await prisma.researchProject.updateMany({
      where: { id: pr.id, startDate: null },
      data: {
        startDate: new Date(Date.UTC(2024 + (i % 2), (i * 3) % 12, 1)),
        endDate: new Date(Date.UTC(2027 + (i % 2), (i * 3) % 12, 1)),
        coInvestigators: STAFF.filter((x) => x.dept === STAFF.find((s) => staffProfileId(s) === pr.facultyProfileId)?.dept && staffProfileId(x) !== pr.facultyProfileId).slice(0, 1).map((x) => x.name)
      }
    });
  }
  const PATENTS: Array<[string, string, string, string, number]> = [
    ['cse1', 'Adaptive container scheduler for heterogeneous campus clouds', '202641012345', 'published', -300],
    ['cse5', 'Method for incremental shortest-path maintenance in dynamic graphs', '202541098765', 'granted', -700],
    ['ece1', 'Low-power FIR filter architecture using approximate multipliers', '202641033221', 'filed', -90],
    ['mech1', 'Self-aligning coupling for misaligned rotating shafts', '202541077654', 'published', -420],
    ['civil1', 'Soil stabilisation mix using fly ash and coir fibre', '202641044210', 'filed', -45]
  ];
  for (const [key, title, applicationNumber, status, filedDaysAgo] of PATENTS) {
    const owner = staff(key);
    await createIfMissing(prisma.patent, `demo-patent-${key}`, {
      facultyProfileId: staffProfileId(owner), title, applicationNumber, status, jurisdiction: 'India',
      filingDate: daysFromNow(filedDaysAgo), grantDate: status === 'granted' ? daysFromNow(filedDaysAgo + 500) : null,
      patentNumber: status === 'granted' ? `IN${applicationNumber.slice(-6)}` : null,
      inventors: [owner.name]
    });
  }
  log('patents', PATENTS.length);

  // ── Department budgets and laboratories ───────────────────────────────────
  const LABS: Record<string, Array<[string, string, string, number]>> = {
    cse: [['Desktop workstation', 'Programming Lab', 'Computer', 60], ['Network switch (24-port)', 'Networks Lab', 'Networking', 6], ['GPU server', 'AI Lab', 'Server', 2]],
    ece: [['Digital storage oscilloscope', 'Electronics Lab', 'Instrument', 20], ['FPGA development kit', 'VLSI Lab', 'Kit', 15], ['Function generator', 'Electronics Lab', 'Instrument', 20]],
    eee: [['DC machine test bench', 'Machines Lab', 'Machine', 6], ['Power analyser', 'Power Systems Lab', 'Instrument', 8], ['PLC trainer kit', 'Control Lab', 'Kit', 10]],
    mech: [['CNC lathe', 'Manufacturing Lab', 'Machine', 2], ['Heat exchanger test rig', 'Thermal Lab', 'Rig', 3], ['Universal testing machine', 'Materials Lab', 'Machine', 1]],
    civil: [['Total station', 'Surveying Lab', 'Instrument', 6], ['Compression testing machine', 'Concrete Lab', 'Machine', 2], ['Triaxial test apparatus', 'Geotechnical Lab', 'Apparatus', 2]],
    it: [['Desktop workstation', 'Web Development Lab', 'Computer', 40], ['Rack server', 'Data Centre', 'Server', 3], ['Wireless access point', 'Networking Lab', 'Networking', 8]]
  };
  for (const [i, d] of DEPARTMENTS.entries()) {
    // Budgets are Finance's: one `BudgetAllocation` line per head, which every
    // screen sums per department (lib/departmentBudgets.ts). The older
    // `DepartmentBudget` table has no screen that writes to it and is no longer read.
    const HEADS: Array<[string, number, number]> = [
      ['laboratory_equipment', 1400000 + i * 150000, 0.45 + (i % 3) * 0.1],
      ['maintenance', 600000 + i * 50000, 0.3 + (i % 4) * 0.12],
      ['academic_events', 400000 + i * 40000, 0.25 + (i % 2) * 0.2]
    ];
    for (const [category, allocatedAmount, used] of HEADS) {
      const spentAmount = Math.round(allocatedAmount * used);
      await prisma.budgetAllocation.upsert({
        where: { department_category_budgetYear: { department: d.code, category, budgetYear: ACADEMIC_YEAR } },
        update: {},
        create: {
          id: `demo-budget-${d.key}-${category}`, institutionId: INSTITUTION, department: d.code, category, budgetYear: ACADEMIC_YEAR,
          allocatedAmount, spentAmount, availableAmount: allocatedAmount - spentAmount,
          utilizationPercentage: Math.round((spentAmount / allocatedAmount) * 100)
        }
      });
    }
    for (const [n, [name, lab, category, quantity]] of LABS[d.key]!.entries()) {
      // `workingCondition` is a COUNT of working units (the screen shows it as
      // "working / quantity"), not a percentage — despite its schema default.
      const working = Math.max(0, quantity - ((i + n) % 5 === 4 ? Math.ceil(quantity * 0.15) : (i + n) % 3 === 0 ? 1 : 0));
      await upsertById(db.labInventoryItem, `demo-lab-${d.key}-${n + 1}`, {
        name, lab, category, quantity, workingCondition: Math.min(working, quantity), departmentId: d.id,
        status: (i + n) % 5 === 4 ? 'maintenance' : 'working',
        purchaseDate: daysFromNow(-(400 + n * 200)), lastMaintenance: daysFromNow(-(30 + n * 25)), warrantyExpiry: daysFromNow(300 - n * 150)
      });
    }
  }

  // ── Placements (NIRF: Graduation Outcomes) ────────────────────────────────
  // Fictional recruiters — a demo should not put words in a real company's mouth.
  const COMPANIES: Array<[string, string, string, string, string, string]> = [
    ['Nimbus Software Labs', 'IT Services', 'Software Engineer Intern', '6.5 LPA', 'Hyderabad', 'cse'],
    ['Vertex Infotech', 'IT Services', 'Graduate Engineer Trainee', '4.2 LPA', 'Bengaluru', 'cse'],
    ['Aarohan Analytics', 'Data and Analytics', 'Data Analyst Intern', '7.8 LPA', 'Pune', 'it'],
    ['Sunrise Embedded Technologies', 'Electronics', 'Embedded Systems Trainee', '5.0 LPA', 'Chennai', 'ece'],
    ['Deccan Power Solutions', 'Power and Energy', 'Graduate Engineer Trainee', '4.8 LPA', 'Vijayawada', 'eee'],
    ['Krishna Infra Projects', 'Construction', 'Site Engineer Trainee', '4.0 LPA', 'Visakhapatnam', 'civil']
  ];
  const applications: any[] = [];
  for (const [i, [name, industry, role, pkg, location, deptKey]] of COMPANIES.entries()) {
    const companyId = `demo-company-${i + 1}`;
    await prisma.company.upsert({
      where: { name },
      update: {},
      create: { id: companyId, institutionId: INSTITUTION, name, industry, email: `campus@${name.toLowerCase().replace(/[^a-z]+/g, '')}.example`, totalHires: 0 }
    });
    const driveId = `demo-drive-${i + 1}`;
    await createIfMissing(prisma.placementDrive, driveId, {
      companyId, role, package: pkg, driveDate: daysFromNow(14 + i * 6), registrationDeadline: daysFromNow(7 + i * 6),
      status: 'active', location, jobDescription: `${role} — open to B.Tech ${dept(deptKey).code} and allied branches. Aptitude test, technical interview and HR round.`
    });
    const pool = students.filter((s) => s.dept === deptKey || (deptKey !== 'cse' && s.dept === 'cse' && s.ability > 0.8));
    for (const s of pool) {
      if (rng(hash(driveId + s.roll))() < 0.55) {
        applications.push({ id: `demo-app-${driveId}-${s.roll}`.toLowerCase(), placementDriveId: driveId, studentProfileId: s.profileId, status: 'applied' });
      }
    }
  }
  log('placements', `${COMPANIES.length} drives, ${await createMissing(prisma.studentApplication, applications)} new applications`);

  // ── NAAC / NIRF readiness ─────────────────────────────────────────────────
  const CHECKLIST: Array<[string, string, string, string, string, number]> = [
    ['NAAC', 'Criterion 1 — Curricular Aspects', 'Curriculum design, academic flexibility, enrichment courses and the stakeholder feedback system with action-taken reports.', 'Dean Academics', 'in_progress', 45],
    ['NAAC', 'Criterion 2 — Teaching-Learning and Evaluation', 'Enrolment profile, student-teacher ratio, teaching-learning process, teacher quality, evaluation reforms, learning outcomes and the Student Satisfaction Survey.', 'IQAC', 'in_progress', 40],
    ['NAAC', 'Criterion 3 — Research, Innovations and Extension', 'Research facilities, grants, innovation ecosystem, publications, consultancy, extension activities and functional MoUs.', 'Dean Research', 'in_progress', 60],
    ['NAAC', 'Criterion 4 — Infrastructure and Learning Resources', 'Physical facilities, library resources and expenditure, IT infrastructure and campus maintenance.', 'Registrar', 'not_started', 75],
    ['NAAC', 'Criterion 5 — Student Support and Progression', 'Scholarships, capacity building, grievance redressal, placement and higher-studies progression, student activities and alumni engagement.', 'Placement Cell', 'in_progress', 50],
    ['NAAC', 'Criterion 6 — Governance, Leadership and Management', 'Vision and leadership, strategic plan, faculty empowerment, financial management and audits, and the internal quality assurance system.', 'Principal Office', 'not_started', 80],
    ['NAAC', 'Criterion 7 — Institutional Values and Best Practices', 'Gender equity, environmental and energy audits, inclusion, code of conduct, two best practices and institutional distinctiveness.', 'IQAC', 'not_started', 90],
    ['NIRF', 'TLR — Teaching, Learning and Resources', 'Student strength, faculty-student ratio, faculty with Ph.D. and experience, and financial resources and their utilisation.', 'Registrar', 'in_progress', 35],
    ['NIRF', 'RP — Research and Professional Practice', 'Publications and their quality, IPR and patents, and the footprint of projects and professional practice.', 'Dean Research', 'in_progress', 35],
    ['NIRF', 'GO — Graduation Outcomes', 'Placement and higher studies, university examination results, median salary and Ph.D. students graduated.', 'Placement Cell', 'in_progress', 35],
    ['NIRF', 'OI — Outreach and Inclusivity', 'Region and women diversity, economically and socially challenged students, and facilities for physically challenged students.', 'Registrar', 'not_started', 35],
    ['NIRF', 'PR — Perception', 'Peer perception among academics and employers.', 'IQAC', 'not_started', 35],
    ['NBA', 'B.Tech CSE — programme accreditation', 'Programme outcomes and course outcomes, CO-PO attainment, and the self-assessment report for the Computer Science programme.', 'HOD CSE', 'in_progress', 120]
  ];
  for (const [i, [framework, criterion, description, office, status, deadline]] of CHECKLIST.entries()) {
    await createIfMissing(prisma.accreditationChecklist, `demo-accreditation-${i + 1}`, {
      institutionId: INSTITUTION, framework, criterion, description, responsibleOffice: office, status, documents: [], deadline: daysFromNow(deadline), remarks: null
    });
  }

  // Metrics that CAN be computed from this dataset are computed from it.
  const faculty = STAFF.length;
  const pct = (part: number, whole: number) => `${Math.round((part / whole) * 1000) / 10}%`;
  const women = students.filter((s) => s.gender === 'female').length;
  const outOfState = students.filter((s) => s.state !== 'Andhra Pradesh').length;
  const reserved = students.filter((s) => s.category !== 'General').length;
  const belowAttendance = [...attendancePct.values()].filter((v) => v < 75).length;
  const passed = results.filter((r) => r.isPassing).length;
  const METRICS: Array<[string, string, string, string, string, string]> = [
    ['naac', 'Student-teacher ratio (Criterion 2.2)', `${Math.round((students.length / faculty) * 10) / 10}:1`, '15:1', 'stable', 'on_track'],
    ['naac', 'Teachers with Ph.D. (Criterion 2.4)', pct(STAFF.filter((s) => s.level === 'phd').length, faculty), '75%', 'upward', 'on_track'],
    ['naac', 'Semester 4 pass percentage (Criterion 2.6)', pct(passed, results.length), '90%', 'stable', passed / results.length >= 0.9 ? 'on_track' : 'needs_attention'],
    ['naac', 'Students below 75% attendance (Criterion 2.3)', `${belowAttendance} of ${students.length}`, '0', 'stable', belowAttendance > 0 ? 'needs_attention' : 'on_track'],
    ['naac', 'Publications per teacher (Criterion 3.4)', `${Math.round((publications.length / faculty) * 10) / 10}`, '2.0', 'upward', 'on_track'],
    ['naac', 'Funded research projects (Criterion 3.2)', `${projects.length}`, '12', 'upward', 'on_track'],
    ['nirf', 'TLR — Faculty-student ratio (FSR)', `1:${Math.round((students.length / faculty) * 10) / 10}`, '1:15', 'stable', 'on_track'],
    ['nirf', 'TLR — Faculty with Ph.D. (FQE)', pct(STAFF.filter((s) => s.level === 'phd').length, faculty), '80%', 'upward', 'on_track'],
    ['nirf', 'RP — Research funding sanctioned (FPPP)', `₹${(projects.reduce((sum, p) => sum + p.amount, 0) / 100000).toFixed(1)} lakh`, '₹150 lakh', 'upward', 'on_track'],
    ['nirf', 'GO — University examination pass rate (GUE)', pct(passed, results.length), '90%', 'stable', 'on_track'],
    ['nirf', 'OI — Women students (WD)', pct(women, students.length), '40%', 'upward', women / students.length >= 0.4 ? 'on_track' : 'needs_attention'],
    ['nirf', 'OI — Students from other states (RD)', pct(outOfState, students.length), '30%', 'stable', 'on_track'],
    ['nirf', 'OI — Reserved-category students (ESCS)', pct(reserved, students.length), '50%', 'stable', 'on_track']
  ];
  for (const [i, [category, metric, currentValue, target, trend, status]] of METRICS.entries()) {
    await upsertById(prisma.qualityMetric, `demo-quality-metric-${i + 1}`, { institutionId: INSTITUTION, category, metric, currentValue, target, trend, status });
  }
  log('NAAC / NIRF readiness', `${CHECKLIST.length} checklist items, ${METRICS.length} computed metrics`);

  // ── Workflow catalogue → workflow engine ──────────────────────────────────
  // Built-in workflows are created by the application on first use; the rest of
  // the catalogue is defined here so each one can be started from the API.
  let defined = 0;
  for (const w of WORKFLOWS.filter((x) => !x.builtIn)) {
    const definitionId = `demo-wf-${w.code.toLowerCase()}`;
    const fresh = await createIfMissing(prisma.workflowDefinition, definitionId, {
      institutionId: INSTITUTION, code: w.code, name: w.name, entityType: w.entityType, version: 1, active: true, createdBy: SEED.users.superAdmin,
      description: `NAAC ${w.naacIndicator}${w.nirf.length ? ` · NIRF ${w.nirf.join(', ')}` : ''}. ${w.purpose}`
    });
    const stepId = (n: number) => `demo-wfs-${w.code.toLowerCase()}-${n}`;
    if (!fresh) {
      await prisma.workflowDefinition.update({
        where: { id: definitionId },
        data: {
          name: w.name, entityType: w.entityType,
          description: `NAAC ${w.naacIndicator}${w.nirf.length ? ` · NIRF ${w.nirf.join(', ')}` : ''}. ${w.purpose}`
        }
      });
      // Keep an existing definition's steps in line with the catalogue. A live
      // institution would publish a new VERSION instead (running approvals keep
      // the process they started under); for demo data, with nothing running,
      // correcting the steps in place is the honest equivalent.
      for (const [index, s] of w.steps.entries()) {
        await prisma.workflowStep.updateMany({
          where: { id: stepId(index + 1) },
          data: { name: s.name, assigneeRole: s.role, slaHours: s.slaHours, escalationRole: s.escalateTo ?? null }
        });
      }
      continue;
    }
    defined++;
    // Last step first, so each step can point at an already-existing successor.
    for (let n = w.steps.length; n >= 1; n--) {
      const s = w.steps[n - 1]!;
      await prisma.workflowStep.create({
        data: {
          id: stepId(n), definitionId, sequence: n, name: s.name, assigneeRole: s.role, slaHours: s.slaHours,
          escalationRole: s.escalateTo ?? null, onApproveStepId: n < w.steps.length ? stepId(n + 1) : null
        }
      });
    }
  }
  log('workflow definitions', `${defined} new (${WORKFLOWS.length} in the NAAC/NIRF catalogue)`);

  // ── Logins ────────────────────────────────────────────────────────────────
  const accounts = await prisma.user.findMany({
    where: { institutionId: INSTITUTION },
    select: { name: true, email: true, role: true, designation: true, department: { select: { code: true } }, studentProfile: { select: { rollNumber: true } } },
    orderBy: [{ role: 'asc' }, { email: 'asc' }]
  });
  const row = (a: (typeof accounts)[number]) => `| ${a.name} | \`${a.email}\` | ${a.studentProfile?.rollNumber ?? a.designation ?? ''} | ${a.department?.code ?? ''} |`;
  const section = (title: string, list: typeof accounts, third: string) =>
    list.length ? [`## ${title}`, '', `| Name | Email | ${third} | Dept |`, '|---|---|---|---|', ...list.map(row), ''] : [];
  const isStaff = (r: string) => r === 'faculty' || r === 'hod';
  const lines = [
    '# Demo logins',
    '',
    'Generated by `prisma/seed-demo.ts`. Development data only — this file is git-ignored.',
    '',
    `**Every account uses the same password:** \`${DEFAULT_PASSWORD}\``,
    '',
    'Login is limited to 5 attempts per 15 minutes per email.',
    '',
    ...section('Administration and offices', accounts.filter((a) => a.role !== 'student' && !isStaff(a.role)), 'Designation'),
    ...section('Heads of department', accounts.filter((a) => a.role === 'hod'), 'Designation'),
    ...section('Faculty', accounts.filter((a) => a.role === 'faculty'), 'Designation'),
    ...section('Students — B.Tech CSE, Semester 5, Section A (the demo class)', accounts.filter((a) => a.role === 'student' && a.department?.code === 'CSE'), 'Roll number'),
    ...section('Students — other departments', accounts.filter((a) => a.role === 'student' && a.department?.code !== 'CSE'), 'Roll number')
  ];
  fs.writeFileSync(new URL('../DEMO_LOGINS.md', import.meta.url), lines.join('\n'));
  log('accounts', `${accounts.length} — listed in backend/DEMO_LOGINS.md`);

  console.log('Demo seed completed.');
}

main()
  .catch((error) => {
    console.error('Demo seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
