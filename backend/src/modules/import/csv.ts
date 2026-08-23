/**
 * RFC 4180 CSV reader.
 *
 * WHY HAND-WRITTEN
 *
 * The repository already has a compliant CSV *writer* (`reporting/export.ts`)
 * but no reader. The obvious `line.split(',')` corrupts any quoted field that
 * contains a comma — which in an Indian student roll means every address and a
 * good share of names ("Rao, Asha"). It also breaks on embedded newlines, which
 * appear whenever an address was pasted from another system.
 *
 * A dependency would do this, but adding one to a repository whose dependency
 * tree is already under triage (15_DEPENDENCY_TRIAGE.md) is a worse trade than
 * 120 lines of parser with tests.
 *
 * WHAT IT HANDLES
 *   - quoted fields containing commas, quotes ("" escaping) and newlines
 *   - CRLF, LF and CR line endings, mixed within one file
 *   - a UTF-8 BOM, which Excel writes by default and which otherwise becomes
 *     part of the first column's NAME, silently breaking header mapping
 *   - trailing newline at EOF (produces no phantom empty row)
 */

export interface ParsedCsv {
  header: string[];
  /** Data rows. `line` is the 1-based line in the FILE, so it matches the
   *  operator's spreadsheet — errors reported against a 0-based row index send
   *  people to the wrong line. */
  rows: Array<{ line: number; cells: string[] }>;
}

export class CsvParseError extends Error {
  constructor(message: string, readonly line: number) {
    super(message);
    this.name = 'CsvParseError';
  }
}

/** Strip a UTF-8 BOM. */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function parseCsv(input: string): ParsedCsv {
  const text = stripBom(input);

  const records: Array<{ line: number; cells: string[] }> = [];
  let cells: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let recordStartLine = 1;
  let sawAnyChar = false;

  const endField = () => {
    cells.push(field);
    field = '';
  };

  const endRecord = () => {
    endField();
    // A line containing nothing but separators-free whitespace is skipped
    // rather than reported as a row of empty values.
    const blank = cells.length === 1 && cells[0]!.trim() === '';
    if (!blank) {
      records.push({ line: recordStartLine, cells });
    }
    cells = [];
    recordStartLine = line + 1;
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    sawAnyChar = true;

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === '\n') line++;
        field += char;
      }
      continue;
    }

    if (char === '"') {
      if (field.length > 0) {
        // A quote appearing mid-field is malformed. Reported rather than
        // guessed at, because guessing silently changes someone's data.
        throw new CsvParseError(
          `Unexpected quote inside an unquoted field. If the value contains a quote, the whole field must be quoted and inner quotes doubled ("").`,
          line
        );
      }
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      endField();
      continue;
    }

    if (char === '\r') {
      // CRLF or a lone CR both terminate the record.
      if (text[i + 1] === '\n') i++;
      endRecord();
      line++;
      continue;
    }

    if (char === '\n') {
      endRecord();
      line++;
      continue;
    }

    field += char;
  }

  if (inQuotes) {
    throw new CsvParseError(
      'File ends inside a quoted field — a closing quote is missing. Check for an unbalanced " in the last rows.',
      recordStartLine
    );
  }

  // Flush the final record when the file does not end with a newline.
  if (field.length > 0 || cells.length > 0) {
    endRecord();
  }

  if (records.length === 0) {
    throw new CsvParseError(
      sawAnyChar ? 'The file contains no rows.' : 'The file is empty.',
      1
    );
  }

  const headerRecord = records[0]!;
  const header = headerRecord.cells.map((h) => h.trim());

  const seen = new Set<string>();
  for (const name of header) {
    if (name === '') continue;
    const key = name.toLowerCase();
    if (seen.has(key)) {
      // Duplicate headers make column mapping ambiguous; whichever the code
      // picked would be arbitrary and wrong half the time.
      throw new CsvParseError(`Duplicate column heading "${name}". Column names must be unique.`, headerRecord.line);
    }
    seen.add(key);
  }

  return { header, rows: records.slice(1) };
}

/**
 * Map a row's cells onto its header names.
 *
 * Rows with the wrong number of cells are a caller-visible error, not something
 * to pad or truncate: a short row usually means an unquoted comma, and silently
 * shifting every subsequent value into the wrong column is exactly the failure
 * that makes people distrust an import.
 */
export function toRecord(
  header: string[],
  cells: string[],
  line: number
): Record<string, string> {
  if (cells.length !== header.length) {
    throw new CsvParseError(
      `Row has ${cells.length} value(s) but the header defines ${header.length} column(s). A common cause is a comma inside an unquoted field.`,
      line
    );
  }

  const record: Record<string, string> = {};
  for (let i = 0; i < header.length; i++) {
    const key = header[i]!;
    if (key === '') continue;
    record[key] = cells[i]!.trim();
  }
  return record;
}

/**
 * Normalise a heading for matching.
 *
 * Institutions' legacy files use "Roll No", "roll_number", "RollNumber" and
 * "Roll Number" interchangeably. Requiring an exact match would mean every
 * institution hand-edits its export before it can be loaded.
 */
export function normaliseHeading(heading: string): string {
  return heading.toLowerCase().replace(/[\s_\-.]/g, '');
}
