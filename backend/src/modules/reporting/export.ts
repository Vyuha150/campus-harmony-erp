/**
 * Export formats.
 *
 * The audit found NO export capability anywhere — no Excel, no CSV, no PDF.
 * An institution could not get its own data out of the system, which is a hard
 * blocker for NAAC/NIRF submission and for any offline analysis.
 *
 * CSV is implemented here directly rather than pulling in a library: the format
 * is small, the escaping rules are the entire risk, and adding a dependency to
 * a project already carrying dependency debt is not justified for ~40 lines.
 *
 * XLSX and PDF are deliberately absent rather than half-implemented — see
 * `UNSUPPORTED_FORMATS` at the bottom.
 */

export type ExportFormat = 'csv' | 'json';

export interface ExportColumn {
  /** Key in the row object. */
  key: string;
  /** Header text. */
  label: string;
}

/**
 * Escape a single CSV field (RFC 4180).
 *
 * The rules that matter:
 *  - a field containing a comma, quote, CR or LF must be quoted
 *  - a literal quote inside a quoted field is doubled
 *  - null/undefined become empty, NOT the strings "null"/"undefined"
 *
 * There is also a security rule most CSV writers miss: a field beginning with
 * `=`, `+`, `-` or `@` is interpreted as a FORMULA by Excel and Google Sheets.
 * A student whose name is stored as `=cmd|...` would execute on open. Such
 * fields are prefixed with a single quote to neutralise them.
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';

  let text = value instanceof Date ? value.toISOString() : String(value);

  // CSV injection defence — must happen BEFORE quoting.
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

/** Render rows as RFC 4180 CSV. */
export function toCsv(rows: Array<Record<string, unknown>>, columns: ExportColumn[]): string {
  const header = columns.map((c) => escapeCsvField(c.label)).join(',');

  const body = rows.map((row) =>
    columns.map((c) => escapeCsvField(row[c.key])).join(',')
  );

  // CRLF per RFC 4180 — Excel on Windows is the dominant consumer here.
  return [header, ...body].join('\r\n');
}

/** Content type and filename extension for a format. */
export function exportMeta(format: ExportFormat): { contentType: string; extension: string } {
  switch (format) {
    case 'csv':
      return { contentType: 'text/csv; charset=utf-8', extension: 'csv' };
    case 'json':
      return { contentType: 'application/json; charset=utf-8', extension: 'json' };
  }
}

/**
 * Formats deliberately NOT implemented.
 *
 * XLSX needs a library (`exceljs`/`xlsx`), PDF needs a rendering engine
 * (`pdfkit`/Puppeteer). Both are real dependencies with real footprints, and
 * pretending to support them — or emitting a CSV with an `.xlsx` extension,
 * which some systems do — would be worse than declining.
 *
 * CSV opens in Excel, so the practical gap is narrower than it looks.
 */
export const UNSUPPORTED_FORMATS: Record<string, string> = {
  xlsx: 'XLSX export requires the `exceljs` dependency. CSV opens directly in Excel in the meantime.',
  pdf: 'PDF export requires a rendering engine (pdfkit or headless Chrome). Not yet implemented.'
};
