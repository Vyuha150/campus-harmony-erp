/**
 * Bulk import engine.
 *
 * WHY THIS EXISTS
 *
 * No institution can adopt this system without loading the records it already
 * has — students, faculty, courses — which arrive as spreadsheets exported from
 * a previous system or maintained by hand. Without this, onboarding means
 * typing a few thousand students into a web form.
 *
 * THE CONSTRAINT THAT SHAPES THE DESIGN
 *
 * A half-finished import is worse than a failed one. If 3,000 of 5,000 students
 * load and then row 3,001 fails, the registrar cannot tell which records are
 * real, and the usual recovery — delete everything and retry — stops working
 * the moment anything references the new rows.
 *
 * So the order is fixed and non-negotiable:
 *
 *   1. Parse the whole file.
 *   2. Validate EVERY row, collecting all errors.
 *   3. If any row is invalid, write NOTHING and return the full error report.
 *   4. Otherwise write every row in ONE transaction.
 *
 * `dryRun` stops after step 3, so an operator can see exactly what would happen
 * before committing to it. That is the difference between a tool a registrar
 * will use on a live roll and one they will not.
 */

import { createHash } from 'node:crypto';
import { basePrisma } from '../../lib/prisma.js';
import { recordInTransaction } from '../../lib/audit.js';
import { logger } from '../../lib/logger.js';
import { ValidationError, NotFoundError, ConflictError } from '../../lib/errors.js';
import type { TenantContext } from '../../lib/tenant.js';
import { parseCsv, toRecord, CsvParseError } from './csv.js';
import {
  findImporter,
  mapHeader,
  canonicalise,
  checkGatedColumns,
  newSeenKeys,
  type ReferenceData,
  type RowIssue,
  type ValidatedRow,
  type Importer
} from './importers.js';

/**
 * Hard ceiling on rows per job.
 *
 * Everything is held in memory to validate the file as a whole, so this is a
 * real limit rather than a nominal one. 20,000 rows is roughly a large
 * university's entire student body; beyond that the file should be split, which
 * is a far better answer than an out-of-memory crash midway through a write.
 */
export const MAX_ROWS = 20_000;

/** Errors recorded per job. Beyond this the report is truncated. */
export const MAX_RECORDED_ERRORS = 500;

export interface ImportRequest {
  entityType: string;
  fileName: string;
  content: string;
  dryRun: boolean;
}

export interface ImportOutcome {
  jobId: string;
  status: string;
  dryRun: boolean;
  entityType: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  importedRows: number;
  /** Present when the file was rejected as a whole. */
  failureReason?: string | undefined;
  errors: Array<{
    rowNumber: number;
    column: string | null;
    value: string | null;
    errorType: string;
    message: string;
  }>;
  errorsTruncated: boolean;
  /** Unmapped headings — usually a mis-named column worth surfacing. */
  ignoredColumns: string[];
  notes: string[];
}

/** Load every lookup this job needs, once. */
async function loadReferences(context: TenantContext): Promise<ReferenceData> {
  const scope = { institutionId: context.institutionId };

  const [departments, programmes, users, students, courses, faculty] = await Promise.all([
    basePrisma.department.findMany({ where: scope, select: { id: true, code: true } }),
    basePrisma.programme.findMany({ where: scope, select: { id: true, code: true } }),
    // Email is globally unique, so this check deliberately IGNORES the tenant
    // scope: an address taken by another institution is still taken.
    basePrisma.user.findMany({ select: { email: true } }),
    basePrisma.studentProfile.findMany({ where: scope, select: { rollNumber: true } }),
    basePrisma.course.findMany({ where: scope, select: { code: true } }),
    basePrisma.facultyProfile.findMany({ where: scope, select: { employeeId: true } })
  ]);

  return {
    departmentsByCode: new Map(departments.map((d) => [d.code.toUpperCase(), d.id])),
    programmesByCode: new Map(programmes.map((p) => [p.code.toUpperCase(), p.id])),
    existingEmails: new Set(users.map((u) => u.email.toLowerCase())),
    existingRollNumbers: new Set(students.map((s) => s.rollNumber.toUpperCase())),
    existingCourseCodes: new Set(courses.map((c) => c.code.toUpperCase())),
    existingEmployeeIds: new Set(faculty.map((f) => f.employeeId.toUpperCase()))
  };
}

/**
 * Run an import.
 *
 * Always creates an ImportJob row, including for a dry run and including when
 * the file is rejected outright — "we uploaded it and nothing happened" is a
 * support case that needs a record to investigate.
 */
export async function runImport(
  context: TenantContext,
  request: ImportRequest
): Promise<ImportOutcome> {
  const importer = findImporter(request.entityType);
  if (!importer) {
    throw new NotFoundError(
      `Import type "${request.entityType}". Supported types: students, faculty, courses`
    );
  }

  const contentHash = createHash('sha256').update(request.content).digest('hex');
  const fileSize = Buffer.byteLength(request.content, 'utf8');

  // Re-uploading identical content is almost always an accidental double
  // submit. Refused BEFORE parsing — the cheapest place to catch it.
  if (!request.dryRun) {
    const priorSuccess = await basePrisma.importJob.findFirst({
      where: {
        institutionId: context.institutionId,
        contentHash,
        dryRun: false,
        status: 'completed'
      },
      select: { id: true, fileName: true, startedAt: true, importedRows: true }
    });

    if (priorSuccess) {
      throw new ConflictError(
        `This exact file was already imported on ${priorSuccess.startedAt.toISOString().slice(0, 16).replace('T', ' ')} ` +
          `as "${priorSuccess.fileName}" (${priorSuccess.importedRows} row(s), job ${priorSuccess.id}). ` +
          'Re-importing it would duplicate those records. If the content genuinely changed, the file will hash differently.',
        { previousJobId: priorSuccess.id }
      );
    }
  }

  const job = await basePrisma.importJob.create({
    data: {
      institutionId: context.institutionId,
      entityType: importer.entityType,
      fileName: request.fileName,
      fileSize,
      contentHash,
      status: 'validating',
      dryRun: request.dryRun,
      startedBy: context.userId
    }
  });

  try {
    return await execute(context, job.id, importer, request);
  } catch (error) {
    // A whole-job failure still leaves a record explaining why.
    const reason = error instanceof Error ? error.message : 'Unknown error';

    await basePrisma.importJob.updateMany({
      where: { id: job.id, institutionId: context.institutionId },
      data: { status: 'failed', failureReason: reason.slice(0, 500), completedAt: new Date() }
    });

    logger.error('Import job failed', {
      module: 'import',
      operation: 'run',
      resource: `ImportJob:${job.id}`
    });

    throw error;
  }
}

async function execute(
  context: TenantContext,
  jobId: string,
  importer: Importer<unknown>,
  request: ImportRequest
): Promise<ImportOutcome> {
  // ── 1. Parse ──────────────────────────────────────────────────────────────
  let parsed;
  try {
    parsed = parseCsv(request.content);
  } catch (error) {
    if (error instanceof CsvParseError) {
      throw new ValidationError(`Line ${error.line}: ${error.message}`, {
        field: 'file',
        line: error.line
      });
    }
    throw error;
  }

  if (parsed.rows.length > MAX_ROWS) {
    throw new ValidationError(
      `This file has ${parsed.rows.length} rows; the limit is ${MAX_ROWS}. ` +
        'The whole file is validated in memory before anything is written, so this is a real limit. Split the file and import in parts.',
      { field: 'file', rows: parsed.rows.length, limit: MAX_ROWS }
    );
  }

  // ── 2. Header ─────────────────────────────────────────────────────────────
  const gated = checkGatedColumns(parsed.header);
  if (gated.length > 0) {
    throw new ValidationError(
      `This file contains column(s) whose collection is not permitted: ${gated.join(', ')}. ` +
        'Caste/category, religion and disability data are gated pending DPDP purpose-limitation, consent and retention decisions (T-407), ' +
        'and Aadhaar must not be stored in this system at all. Remove these columns and re-upload.',
      { field: 'file', gatedColumns: gated }
    );
  }

  const { mapping, missing, unknown } = mapHeader(parsed.header, importer.columns);

  if (missing.length > 0) {
    throw new ValidationError(
      `Required column(s) missing: ${missing.join(', ')}. ` +
        `Found: ${parsed.header.filter((h) => h !== '').join(', ') || '(none)'}. ` +
        `Download the template for "${importer.entityType}" to see the accepted headings.`,
      { field: 'file', missing, found: parsed.header }
    );
  }

  // ── 3. Validate every row ─────────────────────────────────────────────────
  const refs = await loadReferences(context);
  const seen = newSeenKeys();

  const valid: Array<ValidatedRow<unknown>> = [];
  const errors: Array<{
    rowNumber: number;
    column: string | null;
    value: string | null;
    errorType: string;
    message: string;
  }> = [];
  let errorRows = 0;

  const pushIssues = (line: number, issues: RowIssue[]) => {
    errorRows++;
    for (const issue of issues) {
      if (errors.length >= MAX_RECORDED_ERRORS) break;
      errors.push({
        rowNumber: line,
        column: issue.column ?? null,
        value: issue.value ?? null,
        errorType: issue.errorType,
        message: issue.message
      });
    }
  };

  for (const row of parsed.rows) {
    let record: Record<string, string>;
    try {
      record = toRecord(parsed.header, row.cells, row.line);
    } catch (error) {
      if (error instanceof CsvParseError) {
        pushIssues(row.line, [{ errorType: 'validation', message: error.message }]);
        continue;
      }
      throw error;
    }

    const result = importer.validate(canonicalise(record, mapping), row.line, refs, seen);

    if (result.ok) {
      valid.push({ line: row.line, data: result.data });
    } else {
      pushIssues(row.line, result.issues);
    }
  }

  const totalRows = parsed.rows.length;
  const errorsTruncated = errorRows > 0 && errors.length >= MAX_RECORDED_ERRORS;

  // Persist the error report before deciding anything, so it survives even if
  // the write below fails.
  if (errors.length > 0) {
    await basePrisma.importError.createMany({
      data: errors.map((e) => ({
        jobId,
        rowNumber: e.rowNumber,
        column: e.column,
        value: e.value,
        errorType: e.errorType,
        message: e.message.slice(0, 500)
      }))
    });
  }

  const baseCounts = {
    totalRows,
    validRows: valid.length,
    errorRows
  };

  // ── 4. Refuse a partial load ──────────────────────────────────────────────
  //
  // Even one bad row stops the whole file. Importing "the good ones" leaves the
  // operator to reconcile which of their rows landed — the exact situation this
  // design exists to prevent.
  if (errorRows > 0) {
    await basePrisma.importJob.updateMany({
      where: { id: jobId, institutionId: context.institutionId },
      data: {
        ...baseCounts,
        status: 'failed',
        failureReason: `${errorRows} of ${totalRows} row(s) failed validation. Nothing was imported.`,
        completedAt: new Date()
      }
    });

    return {
      jobId,
      status: 'failed',
      dryRun: request.dryRun,
      entityType: importer.entityType,
      ...baseCounts,
      importedRows: 0,
      failureReason:
        `${errorRows} of ${totalRows} row(s) failed validation. NOTHING was imported — ` +
        'the whole file is rejected so you never have to work out which rows landed. Fix the rows below and re-upload.',
      errors,
      errorsTruncated,
      ignoredColumns: unknown,
      notes: []
    };
  }

  // ── 5. Dry run stops here ─────────────────────────────────────────────────
  if (request.dryRun) {
    await basePrisma.importJob.updateMany({
      where: { id: jobId, institutionId: context.institutionId },
      data: { ...baseCounts, status: 'validated', completedAt: new Date() }
    });

    return {
      jobId,
      status: 'validated',
      dryRun: true,
      entityType: importer.entityType,
      ...baseCounts,
      importedRows: 0,
      errors: [],
      errorsTruncated: false,
      ignoredColumns: unknown,
      notes: [
        `All ${totalRows} row(s) are valid. NOTHING was written — this was a dry run.`,
        'Re-submit with dryRun=false to import.'
      ]
    };
  }

  // ── 6. Write, in one transaction ──────────────────────────────────────────
  await basePrisma.importJob.updateMany({
    where: { id: jobId, institutionId: context.institutionId },
    data: { ...baseCounts, status: 'importing' }
  });

  const result = await basePrisma.$transaction(
    async (tx) => {
      const outcome = await importer.persist(tx, context, valid);

      await recordInTransaction(tx as never, {
        userId: context.userId,
        role: context.role,
        action: 'CREATE',
        module: 'import',
        resource: `ImportJob:${jobId}`,
        details:
          `Imported ${outcome.imported} ${importer.entityType} record(s) from "${request.fileName}" ` +
          `(${totalRows} row(s) submitted)`,
        newValue: { entityType: importer.entityType, imported: outcome.imported, fileName: request.fileName },
        // Bulk-creating people is exactly the event an auditor reviews.
        severity: 'warning'
      });

      return outcome;
    },
    {
      // Creating thousands of users with password hashing is slow; the default
      // 5s timeout would abort a legitimate large import partway.
      timeout: 120_000,
      maxWait: 10_000
    }
  );

  await basePrisma.importJob.updateMany({
    where: { id: jobId, institutionId: context.institutionId },
    data: {
      ...baseCounts,
      status: 'completed',
      importedRows: result.imported,
      skippedRows: result.skipped,
      completedAt: new Date()
    }
  });

  return {
    jobId,
    status: 'completed',
    dryRun: false,
    entityType: importer.entityType,
    ...baseCounts,
    importedRows: result.imported,
    errors: [],
    errorsTruncated: false,
    ignoredColumns: unknown,
    notes: result.notes
  };
}

/** A CSV template with the accepted headings and one example row. */
export function buildTemplate(entityType: string): { fileName: string; content: string; guidance: string } {
  const importer = findImporter(entityType);
  if (!importer) {
    throw new NotFoundError(`Import type "${entityType}"`);
  }

  const header = importer.columns.map((c) => c.name).join(',');
  // A commented line rather than a fake data row: a sample row that looks real
  // gets imported by someone who forgets to delete it.
  const legend = importer.columns
    .map((c: { name: string; required: boolean; description: string }) =>
      `# ${c.name}${c.required ? ' (required)' : ' (optional)'}: ${c.description}`
    )
    .join('\n');

  return {
    fileName: `${importer.entityType}_template.csv`,
    content: `${header}\n`,
    guidance: `${importer.guidance}\n\n${legend}`
  };
}

/** Past jobs, newest first. */
export async function listJobs(
  context: TenantContext,
  page: { page: number; pageSize: number }
): Promise<{
  data: Array<{
    id: string;
    entityType: string;
    fileName: string;
    status: string;
    dryRun: boolean;
    totalRows: number;
    errorRows: number;
    importedRows: number;
    startedAt: Date;
    completedAt: Date | null;
  }>;
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}> {
  const where = { institutionId: context.institutionId };
  const skip = (page.page - 1) * page.pageSize;

  const [jobs, total] = await Promise.all([
    basePrisma.importJob.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip,
      take: page.pageSize,
      select: {
        id: true,
        entityType: true,
        fileName: true,
        status: true,
        dryRun: true,
        totalRows: true,
        errorRows: true,
        importedRows: true,
        startedAt: true,
        completedAt: true
      }
    }),
    basePrisma.importJob.count({ where })
  ]);

  return {
    data: jobs,
    meta: {
      page: page.page,
      pageSize: page.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / page.pageSize))
    }
  };
}

/** One job with its error report. */
export async function getJob(
  context: TenantContext,
  jobId: string
): Promise<Record<string, unknown>> {
  const job = await basePrisma.importJob.findFirst({
    where: { id: jobId, institutionId: context.institutionId },
    include: { errors: { orderBy: { rowNumber: 'asc' }, take: MAX_RECORDED_ERRORS } }
  });

  if (!job) {
    throw new NotFoundError(`Import job ${jobId}`);
  }

  return {
    id: job.id,
    entityType: job.entityType,
    fileName: job.fileName,
    fileSize: job.fileSize,
    status: job.status,
    dryRun: job.dryRun,
    totalRows: job.totalRows,
    validRows: job.validRows,
    errorRows: job.errorRows,
    importedRows: job.importedRows,
    failureReason: job.failureReason,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    errors: job.errors.map((e) => ({
      rowNumber: e.rowNumber,
      column: e.column,
      value: e.value,
      errorType: e.errorType,
      message: e.message
    }))
  };
}
