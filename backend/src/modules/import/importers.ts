/**
 * Importer definitions — one per entity type.
 *
 * Each declares its columns, per-row validation, and how its references are
 * resolved. Adding an entity type means adding a definition here, not touching
 * the engine.
 *
 * TWO RULES THAT SHAPE ALL OF THESE
 *
 * 1. REFERENCES RESOLVE OR FAIL. A student row naming department "CSE" is
 *    looked up; if no such department exists, the row is an error. It is NEVER
 *    created. Auto-creating a referenced entity is the fabrication pattern
 *    removed in phase 0.2 — `getOrCreateDepartment` invented a "CSE" department
 *    and attached people to it. An import is the single most likely place for
 *    that to recur at scale, because a typo in one cell would silently mint a
 *    new department.
 *
 * 2. NOTHING IS INFERRED. A missing CGPA stays 0; a missing semester is an
 *    error, not a guess. The audit's central finding was invented data, and a
 *    bulk loader is the fastest way to reintroduce it.
 */

import { z } from 'zod';
import { basePrisma } from '../../lib/prisma.js';
import { hashPassword, generateTemporaryPassword } from '../../lib/password.js';
import type { TransactionClient } from '../../lib/service.js';
import type { TenantContext } from '../../lib/tenant.js';
import { normaliseHeading } from './csv.js';

export interface ColumnSpec {
  /** Canonical name, used in error messages and in the template. */
  name: string;
  required: boolean;
  /** Alternative headings accepted from legacy files. */
  aliases?: string[];
  description: string;
}

/** One problem with one row. */
export interface RowIssue {
  column?: string | undefined;
  value?: string | undefined;
  errorType: 'validation' | 'duplicate' | 'reference_not_found' | 'conflict' | 'system';
  message: string;
}

export interface ValidatedRow<T> {
  line: number;
  data: T;
}

/**
 * Lookup tables loaded ONCE per job.
 *
 * Resolving a department per row would be one query per row — 50,000 queries
 * for a mid-sized roll. Loaded up front and matched in memory instead.
 */
export interface ReferenceData {
  departmentsByCode: Map<string, string>;
  programmesByCode: Map<string, string>;
  existingEmails: Set<string>;
  existingRollNumbers: Set<string>;
  existingCourseCodes: Set<string>;
  existingEmployeeIds: Set<string>;
}

/**
 * Keys already seen WITHIN this file.
 *
 * Duplicates inside one upload are as common as duplicates against the
 * database — the usual cause is a spreadsheet where a block was pasted twice —
 * and a unique constraint would only catch them at write time, after validation
 * had already reported the file clean.
 */
export interface SeenKeys {
  emails: Set<string>;
  rollNumbers: Set<string>;
  courseCodes: Set<string>;
  employeeIds: Set<string>;
}

export function newSeenKeys(): SeenKeys {
  return {
    emails: new Set(),
    rollNumbers: new Set(),
    courseCodes: new Set(),
    employeeIds: new Set()
  };
}

export interface Importer<T> {
  entityType: string;
  label: string;
  columns: ColumnSpec[];
  /** Shown alongside the template, so the constraints are known before upload. */
  guidance: string;
  validate(
    record: Record<string, string>,
    line: number,
    refs: ReferenceData,
    seen: SeenKeys
  ): { ok: true; data: T } | { ok: false; issues: RowIssue[] };
  /** Persist validated rows. Runs inside the job's single transaction. */
  persist(
    tx: TransactionClient,
    context: TenantContext,
    rows: Array<ValidatedRow<T>>
  ): Promise<{ imported: number; skipped: number; notes: string[] }>;
}

/** Resolve a header row onto canonical column names. */
export function mapHeader(
  header: string[],
  columns: ColumnSpec[]
): { mapping: Map<string, string>; missing: string[]; unknown: string[] } {
  const canonical = new Map<string, string>();
  for (const column of columns) {
    canonical.set(normaliseHeading(column.name), column.name);
    for (const alias of column.aliases ?? []) {
      canonical.set(normaliseHeading(alias), column.name);
    }
  }

  const mapping = new Map<string, string>();
  const unknown: string[] = [];

  for (const heading of header) {
    if (heading === '') continue;
    const resolved = canonical.get(normaliseHeading(heading));
    if (resolved) {
      mapping.set(heading, resolved);
    } else {
      unknown.push(heading);
    }
  }

  const present = new Set(mapping.values());
  const missing = columns.filter((c) => c.required && !present.has(c.name)).map((c) => c.name);

  return { mapping, missing, unknown };
}

/** Re-key a raw record onto canonical column names. */
export function canonicalise(
  record: Record<string, string>,
  mapping: Map<string, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [raw, value] of Object.entries(record)) {
    const key = mapping.get(raw);
    if (key) out[key] = value;
  }
  return out;
}

// ─── Shared field rules ──────────────────────────────────────────────────────

const emailField = z
  .string()
  .trim()
  .min(3)
  .max(160)
  .email('must be a valid email address')
  .transform((v) => v.toLowerCase());

const nameField = z.string().trim().min(1, 'is required').max(160);

/**
 * Reject spreadsheet formulas on the way IN.
 *
 * `reporting/export.ts` neutralises these on the way OUT. Storing one is still
 * wrong: it is not a name, and it would be handed to whatever system reads this
 * data next, which may not defend itself.
 */
function rejectFormula(value: string, column: string): RowIssue | null {
  if (/^[=+@]/.test(value) || /^-[^0-9.]/.test(value)) {
    return {
      column,
      value: value.slice(0, 60),
      errorType: 'validation',
      message: `"${column}" begins with a spreadsheet formula character (= + @ -). This is refused rather than stored.`
    };
  }
  return null;
}

/**
 * Columns whose collection is gated or forbidden.
 *
 * `StudentProfile.category` and `isDifferentlyAbled` exist so the reporting
 * architecture is not blocked, but the schema records that collection is GATED
 * ON LEGAL REVIEW (T-407), pending DPDP purpose-limitation, consent and
 * retention decisions. A bulk importer is precisely how such a gate gets
 * bypassed by accident, so it is enforced here rather than assumed.
 *
 * Aadhaar is refused outright — it must not be stored in this system at all.
 */
const GATED_COLUMNS = new Set([
  'category',
  'caste',
  'religion',
  'disability',
  'differentlyabled',
  'isdifferentlyabled',
  'aadhaar',
  'aadhar',
  'aadhaarnumber',
  'uid'
]);

export function checkGatedColumns(header: string[]): string[] {
  return header.filter((h) => GATED_COLUMNS.has(normaliseHeading(h)));
}

function zodIssues(error: z.ZodError, record: Record<string, string>): RowIssue[] {
  return error.issues.map((issue) => {
    const column = issue.path.join('.') || undefined;
    return {
      column,
      value: column ? record[column]?.slice(0, 60) : undefined,
      errorType: 'validation' as const,
      message: column ? `"${column}" ${issue.message}` : issue.message
    };
  });
}

/**
 * Resolve a reference code, or record why it could not be resolved.
 *
 * Deliberately operates on the RAW cell value rather than a schema-parsed one,
 * so that reference problems are reported even when some OTHER field in the row
 * failed validation. Without this, a row with a bad email and an unknown
 * department reports only the email; the operator fixes it, re-uploads, and
 * only then discovers the department. Each such round trip is a reason imports
 * get abandoned halfway.
 */
function resolveReference(
  raw: string | undefined,
  column: string,
  lookup: Map<string, string>,
  label: string,
  issues: RowIssue[]
): string | undefined {
  const code = (raw ?? '').trim();
  // An absent code is the schema's problem to report, not a missing reference.
  if (code === '') return undefined;

  const id = lookup.get(code.toUpperCase());
  if (!id) {
    issues.push({
      column,
      value: code,
      errorType: 'reference_not_found',
      message: `No ${label} with code "${code}" exists in this institution. Create it first — it will not be created automatically.`
    });
    return undefined;
  }
  return id;
}

/** Shared optional-date handling. Returns undefined when absent. */
function parseOptionalDate(
  raw: string | undefined,
  column: string,
  issues: RowIssue[],
  options: { rejectFuture?: boolean } = {}
): Date | undefined {
  if (!raw || raw === '') return undefined;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    issues.push({
      column,
      value: raw,
      errorType: 'validation',
      message: `"${raw}" is not a recognisable date. Use YYYY-MM-DD.`
    });
    return undefined;
  }
  if (options.rejectFuture && parsed.getTime() > Date.now()) {
    issues.push({ column, value: raw, errorType: 'validation', message: `${column} is in the future.` });
    return undefined;
  }
  return parsed;
}

// ─── Students ────────────────────────────────────────────────────────────────

export interface StudentRow {
  rollNumber: string;
  name: string;
  email: string;
  programmeCode: string;
  programmeId: string;
  departmentCode: string;
  departmentId: string;
  semester: number;
  admissionYear: number;
  section: string;
  batch: string;
  gender?: string | undefined;
  dateOfBirth?: Date | undefined;
}

const studentSchema = z.object({
  rollNumber: z.string().trim().min(1, 'is required').max(40),
  name: nameField,
  email: emailField,
  programmeCode: z.string().trim().min(1, 'is required').max(40),
  departmentCode: z.string().trim().min(1, 'is required').max(40),
  semester: z.coerce
    .number()
    .int('must be a whole number')
    .min(1, 'must be at least 1')
    .max(12, 'must be 12 or less'),
  admissionYear: z.coerce
    .number()
    .int('must be a whole number')
    .min(1950, 'is too early to be an admission year')
    .max(new Date().getFullYear() + 1, 'is in the future'),
  section: z.string().trim().max(20).optional().default(''),
  batch: z.string().trim().max(40).optional().default(''),
  gender: z.string().trim().max(30).optional(),
  dateOfBirth: z.string().trim().optional()
});

export const studentImporter: Importer<StudentRow> = {
  entityType: 'students',
  label: 'Students',
  guidance:
    'Programme and department must ALREADY EXIST and are matched by code — a code that does not exist is an error, not a prompt to create one. ' +
    'No password column is accepted: a temporary password is generated per student, and access is obtained through the password-reset flow. ' +
    'CGPA is not importable; it is computed from results.',
  columns: [
    { name: 'rollNumber', required: true, aliases: ['roll no', 'roll number', 'regno', 'registration number', 'enrollment no'], description: 'Unique within the institution' },
    { name: 'name', required: true, aliases: ['student name', 'full name'], description: 'Full name' },
    { name: 'email', required: true, aliases: ['email id', 'mail', 'email address'], description: 'Globally unique login' },
    { name: 'programmeCode', required: true, aliases: ['programme', 'program', 'programme code'], description: 'Must match an existing Programme code' },
    { name: 'departmentCode', required: true, aliases: ['department', 'dept', 'department code', 'branch'], description: 'Must match an existing Department code' },
    { name: 'semester', required: true, aliases: ['sem', 'current semester'], description: '1-12' },
    { name: 'admissionYear', required: true, aliases: ['year of admission', 'admission year', 'joining year'], description: 'e.g. 2024' },
    { name: 'section', required: false, aliases: ['sec'], description: 'Optional' },
    { name: 'batch', required: false, aliases: ['batch year'], description: 'Optional, e.g. 2024-28' },
    { name: 'gender', required: false, aliases: [], description: 'Optional' },
    { name: 'dateOfBirth', required: false, aliases: ['dob', 'date of birth'], description: 'Optional, YYYY-MM-DD' }
  ],

  validate(record, _line, refs, seen) {
    const issues: RowIssue[] = [];

    for (const [column, value] of Object.entries(record)) {
      const formula = rejectFormula(value, column);
      if (formula) issues.push(formula);
    }

    // ── References: resolve or fail. Never create. ──
    // Checked BEFORE the schema parse so a row with several distinct problems
    // reports all of them in one pass.
    const programmeId = resolveReference(record.programmeCode, 'programmeCode', refs.programmesByCode, 'programme', issues);
    const departmentId = resolveReference(record.departmentCode, 'departmentCode', refs.departmentsByCode, 'department', issues);

    const parsed = studentSchema.safeParse(record);
    if (!parsed.success) {
      issues.push(...zodIssues(parsed.error, record));
      return { ok: false, issues };
    }

    const value = parsed.data;

    // ── Duplicates: against the database AND within this file ──
    if (refs.existingEmails.has(value.email)) {
      issues.push({
        column: 'email',
        value: value.email,
        errorType: 'duplicate',
        message: `An account with email "${value.email}" already exists. Emails are unique across the whole system, not only this institution.`
      });
    }
    if (seen.emails.has(value.email)) {
      issues.push({
        column: 'email',
        value: value.email,
        errorType: 'duplicate',
        message: `Email "${value.email}" appears more than once in this file.`
      });
    }

    const rollKey = value.rollNumber.toUpperCase();
    if (refs.existingRollNumbers.has(rollKey)) {
      issues.push({
        column: 'rollNumber',
        value: value.rollNumber,
        errorType: 'duplicate',
        message: `Roll number "${value.rollNumber}" already exists in this institution.`
      });
    }
    if (seen.rollNumbers.has(rollKey)) {
      issues.push({
        column: 'rollNumber',
        value: value.rollNumber,
        errorType: 'duplicate',
        message: `Roll number "${value.rollNumber}" appears more than once in this file.`
      });
    }

    const dateOfBirth = parseOptionalDate(value.dateOfBirth, 'dateOfBirth', issues, {
      rejectFuture: true
    });

    if (issues.length > 0) return { ok: false, issues };

    seen.emails.add(value.email);
    seen.rollNumbers.add(rollKey);

    return {
      ok: true,
      data: {
        rollNumber: value.rollNumber,
        name: value.name,
        email: value.email,
        programmeCode: value.programmeCode,
        programmeId: programmeId!,
        departmentCode: value.departmentCode,
        departmentId: departmentId!,
        semester: value.semester,
        admissionYear: value.admissionYear,
        section: value.section,
        batch: value.batch,
        gender: value.gender,
        dateOfBirth
      }
    };
  },

  async persist(tx, context, rows) {
    const db = tx as never as typeof basePrisma;
    let imported = 0;

    for (const row of rows) {
      // A temporary password is generated per student: never read from the
      // file, never logged, never returned. Access comes via password reset.
      const password = await hashPassword(generateTemporaryPassword());

      const user = await db.user.create({
        data: {
          institutionId: context.institutionId,
          email: row.data.email,
          password,
          name: row.data.name,
          role: 'student',
          departmentId: row.data.departmentId
        }
      });

      await db.studentProfile.create({
        data: {
          userId: user.id,
          institutionId: context.institutionId,
          programmeId: row.data.programmeId,
          rollNumber: row.data.rollNumber,
          program: row.data.programmeCode,
          branch: row.data.departmentCode,
          section: row.data.section,
          batch: row.data.batch,
          semester: row.data.semester,
          admissionYear: row.data.admissionYear,
          // NOT imported and NOT inferred — computed from results.
          cgpa: 0,
          totalCredits: 0,
          earnedCredits: 0,
          gender: row.data.gender ?? null,
          dateOfBirth: row.data.dateOfBirth ?? null
        }
      });

      imported++;
    }

    const notes =
      imported > 0
        ? [
            `${imported} student account(s) created with generated temporary passwords. ` +
              'No password was read from or written to the file; students must use the password-reset flow.'
          ]
        : [];

    return { imported, skipped: 0, notes };
  }
};

// ─── Faculty ─────────────────────────────────────────────────────────────────

export interface FacultyRow {
  employeeId: string;
  name: string;
  email: string;
  departmentCode: string;
  departmentId: string;
  designation: string;
  qualification?: string | undefined;
  specialization?: string | undefined;
  experience?: number | undefined;
  joiningDate?: Date | undefined;
}

const facultySchema = z.object({
  employeeId: z.string().trim().min(1, 'is required').max(40),
  name: nameField,
  email: emailField,
  departmentCode: z.string().trim().min(1, 'is required').max(40),
  designation: z.string().trim().min(1, 'is required').max(80),
  qualification: z.string().trim().max(120).optional(),
  specialization: z.string().trim().max(160).optional(),
  experience: z.coerce.number().int().min(0).max(70).optional(),
  joiningDate: z.string().trim().optional()
});

export const facultyImporter: Importer<FacultyRow> = {
  entityType: 'faculty',
  label: 'Faculty',
  guidance:
    'Department must already exist and is matched by code. ' +
    'Qualification is optional and is NOT defaulted — a faculty member with no recorded qualification is reported as UNKNOWN by the faculty-qualification report, never assumed to hold a doctorate.',
  columns: [
    { name: 'employeeId', required: true, aliases: ['employee id', 'emp id', 'staff id'], description: 'Unique within the institution' },
    { name: 'name', required: true, aliases: ['faculty name', 'full name'], description: 'Full name' },
    { name: 'email', required: true, aliases: ['email id', 'mail'], description: 'Globally unique login' },
    { name: 'departmentCode', required: true, aliases: ['department', 'dept'], description: 'Must match an existing Department code' },
    { name: 'designation', required: true, aliases: ['post', 'title'], description: 'e.g. Assistant Professor' },
    { name: 'qualification', required: false, aliases: ['highest qualification'], description: 'Optional; blank stays UNKNOWN' },
    { name: 'specialization', required: false, aliases: ['specialisation', 'area'], description: 'Optional' },
    { name: 'experience', required: false, aliases: ['years of experience', 'exp'], description: 'Optional, whole years' },
    { name: 'joiningDate', required: false, aliases: ['date of joining', 'doj'], description: 'Optional, YYYY-MM-DD' }
  ],

  validate(record, _line, refs, seen) {
    const issues: RowIssue[] = [];

    for (const [column, value] of Object.entries(record)) {
      const formula = rejectFormula(value, column);
      if (formula) issues.push(formula);
    }

    const departmentId = resolveReference(record.departmentCode, 'departmentCode', refs.departmentsByCode, 'department', issues);

    const parsed = facultySchema.safeParse(record);
    if (!parsed.success) {
      issues.push(...zodIssues(parsed.error, record));
      return { ok: false, issues };
    }

    const value = parsed.data;

    if (refs.existingEmails.has(value.email)) {
      issues.push({
        column: 'email',
        value: value.email,
        errorType: 'duplicate',
        message: `An account with email "${value.email}" already exists.`
      });
    }
    if (seen.emails.has(value.email)) {
      issues.push({
        column: 'email',
        value: value.email,
        errorType: 'duplicate',
        message: `Email "${value.email}" appears more than once in this file.`
      });
    }

    const empKey = value.employeeId.toUpperCase();
    if (refs.existingEmployeeIds.has(empKey)) {
      issues.push({
        column: 'employeeId',
        value: value.employeeId,
        errorType: 'duplicate',
        message: `Employee id "${value.employeeId}" already exists.`
      });
    }
    if (seen.employeeIds.has(empKey)) {
      issues.push({
        column: 'employeeId',
        value: value.employeeId,
        errorType: 'duplicate',
        message: `Employee id "${value.employeeId}" appears more than once in this file.`
      });
    }

    const joiningDate = parseOptionalDate(value.joiningDate, 'joiningDate', issues);

    if (issues.length > 0) return { ok: false, issues };

    seen.emails.add(value.email);
    seen.employeeIds.add(empKey);

    return {
      ok: true,
      data: {
        employeeId: value.employeeId,
        name: value.name,
        email: value.email,
        departmentCode: value.departmentCode,
        departmentId: departmentId!,
        designation: value.designation,
        qualification: value.qualification,
        specialization: value.specialization,
        experience: value.experience,
        joiningDate
      }
    };
  },

  async persist(tx, context, rows) {
    const db = tx as never as typeof basePrisma;
    let imported = 0;

    for (const row of rows) {
      const password = await hashPassword(generateTemporaryPassword());

      const user = await db.user.create({
        data: {
          institutionId: context.institutionId,
          email: row.data.email,
          password,
          name: row.data.name,
          role: 'faculty',
          departmentId: row.data.departmentId,
          designation: row.data.designation
        }
      });

      await db.facultyProfile.create({
        data: {
          userId: user.id,
          institutionId: context.institutionId,
          employeeId: row.data.employeeId,
          // Free-text, retained for display.
          qualification: row.data.qualification ?? null,
          // Structured, and null unless the spelling is unambiguous — see
          // `normaliseQualificationLevel`.
          qualificationLevel: normaliseQualificationLevel(row.data.qualification),
          // NEVER set true by an import. Verification means someone checked a
          // certificate; a spreadsheet cell is not that.
          qualificationVerified: false,
          specialization: row.data.specialization ?? null,
          experience: row.data.experience ?? 0,
          dateOfJoining: row.data.joiningDate ?? null
        }
      });

      imported++;
    }

    const notes =
      imported > 0
        ? [`${imported} faculty account(s) created with generated temporary passwords, obtained via the password-reset flow.`]
        : [];

    return { imported, skipped: 0, notes };
  }
};

/**
 * Map a free-text qualification onto the structured level, or null.
 *
 * The schema is explicit about why `qualificationLevel` exists: the old code
 * auto-created faculty with `qualification: 'Ph.D in CSE'`, fabricating
 * doctorates that would have been reported to NIRF. So this function only
 * recognises spellings that are UNAMBIGUOUS, and returns null for everything
 * else — including empty input.
 *
 * Normalising "Ph.D." and "PhD" to DOCTORATE is not fabrication; they are the
 * same claim written differently. Guessing that "Dr." or "Doctoral candidate"
 * means a completed doctorate WOULD be, so neither is matched.
 *
 * `qualificationVerified` is never set by an import: verification means a human
 * checked a certificate, and a spreadsheet cell is not that.
 */
export function normaliseQualificationLevel(raw: string | undefined): string | null {
  if (!raw) return null;

  const text = raw.trim().toLowerCase().replace(/[.\s_-]/g, '');
  if (text === '') return null;

  // Anchored to the START so "M.Tech, pursuing Ph.D" is not read as a doctorate.
  if (/^(phd|dphil|doctorate|doctorofphilosophy)/.test(text)) return 'DOCTORATE';
  if (/^(mphil|masterofphilosophy)/.test(text)) return 'MPHIL';
  if (/^(mtech|me|msc|ma|mcom|mba|mca|pg|postgraduate|masters?)/.test(text)) return 'POSTGRADUATE';
  if (/^(btech|be|bsc|ba|bcom|bba|bca|ug|graduate|bachelors?)/.test(text)) return 'GRADUATE';

  // Deliberately unrecognised: "Dr", "pursuing PhD", "Ph.D (submitted)",
  // and anything else. Unknown reads as unknown.
  return null;
}

// ─── Courses ─────────────────────────────────────────────────────────────────

export interface CourseRow {
  code: string;
  name: string;
  credits: number;
  departmentCode: string;
  departmentId: string;
  semester: number;
  type: string;
}

const courseSchema = z.object({
  code: z.string().trim().min(1, 'is required').max(40),
  name: nameField,
  credits: z.coerce.number().int(String.raw`must be a whole number`).min(0, 'cannot be negative').max(30, 'is implausibly large'),
  departmentCode: z.string().trim().min(1, 'is required').max(40),
  semester: z.coerce.number().int('must be a whole number').min(1).max(12),
  type: z.string().trim().max(40).optional().default('core')
});

export const courseImporter: Importer<CourseRow> = {
  entityType: 'courses',
  label: 'Courses',
  guidance:
    'Department must already exist and is matched by code. Course codes are unique within the institution.',
  columns: [
    { name: 'code', required: true, aliases: ['course code', 'subject code'], description: 'Unique within the institution' },
    { name: 'name', required: true, aliases: ['course name', 'subject', 'title'], description: 'Course title' },
    { name: 'credits', required: true, aliases: ['credit'], description: 'Credit value' },
    { name: 'departmentCode', required: true, aliases: ['department', 'dept'], description: 'Must match an existing Department code' },
    { name: 'semester', required: true, aliases: ['sem'], description: '1-12' },
    { name: 'type', required: false, aliases: ['course type'], description: 'core / elective / lab' }
  ],

  validate(record, _line, refs, seen) {
    const issues: RowIssue[] = [];

    for (const [column, value] of Object.entries(record)) {
      const formula = rejectFormula(value, column);
      if (formula) issues.push(formula);
    }

    const departmentId = resolveReference(record.departmentCode, 'departmentCode', refs.departmentsByCode, 'department', issues);

    const parsed = courseSchema.safeParse(record);
    if (!parsed.success) {
      issues.push(...zodIssues(parsed.error, record));
      return { ok: false, issues };
    }

    const value = parsed.data;

    const codeKey = value.code.toUpperCase();
    if (refs.existingCourseCodes.has(codeKey)) {
      issues.push({
        column: 'code',
        value: value.code,
        errorType: 'duplicate',
        message: `Course code "${value.code}" already exists in this institution.`
      });
    }
    if (seen.courseCodes.has(codeKey)) {
      issues.push({
        column: 'code',
        value: value.code,
        errorType: 'duplicate',
        message: `Course code "${value.code}" appears more than once in this file.`
      });
    }

    if (issues.length > 0) return { ok: false, issues };

    seen.courseCodes.add(codeKey);

    return {
      ok: true,
      data: {
        code: value.code,
        name: value.name,
        credits: value.credits,
        departmentCode: value.departmentCode,
        departmentId: departmentId!,
        semester: value.semester,
        type: value.type
      }
    };
  },

  async persist(tx, context, rows) {
    const db = tx as never as typeof basePrisma;
    let imported = 0;

    for (const row of rows) {
      await db.course.create({
        data: {
          institutionId: context.institutionId,
          code: row.data.code,
          name: row.data.name,
          credits: row.data.credits,
          departmentId: row.data.departmentId,
          semester: row.data.semester
        }
      });
      imported++;
    }

    return { imported, skipped: 0, notes: [] };
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const IMPORTERS: Record<string, Importer<any>> = {
  students: studentImporter,
  faculty: facultyImporter,
  courses: courseImporter
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function findImporter(entityType: string): Importer<any> | undefined {
  return IMPORTERS[entityType.toLowerCase()];
}
