/**
 * Reporting and export tests.
 *
 * CSV escaping is the highest-risk part of this module: get it wrong and you
 * either corrupt an institution's data export or hand an attacker a formula
 * that executes when a registrar opens the file.
 */

import { describe, it, expect } from 'vitest';
import { escapeCsvField, toCsv, exportMeta, UNSUPPORTED_FORMATS } from '../modules/reporting/export.js';
import { REPORTS, findReport } from '../modules/reporting/reports.js';

describe('CSV escaping (RFC 4180)', () => {
  it('leaves a plain field untouched', () => {
    expect(escapeCsvField('CS101')).toBe('CS101');
  });

  it('quotes fields containing a comma', () => {
    expect(escapeCsvField('Rao, Asha')).toBe('"Rao, Asha"');
  });

  it('doubles embedded quotes', () => {
    expect(escapeCsvField('She said "hello"')).toBe('"She said ""hello"""');
  });

  it('quotes fields containing newlines', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvField('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('renders null and undefined as EMPTY, not as the words', () => {
    // Exporting the literal string "null" into a student record would be read
    // as data by whatever consumes the file.
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('formats dates as ISO', () => {
    expect(escapeCsvField(new Date('2026-08-20T10:30:00Z'))).toBe('2026-08-20T10:30:00.000Z');
  });

  it('preserves zero rather than treating it as empty', () => {
    // A pass rate of 0% is a real figure and must not vanish.
    expect(escapeCsvField(0)).toBe('0');
    expect(escapeCsvField(false)).toBe('false');
  });
});

describe('CSV injection defence', () => {
  // Excel and Google Sheets execute a cell beginning with = + - or @.
  // A student name stored as `=cmd|...` would run when a registrar opens the
  // export. Most CSV writers miss this.
  it('neutralises formula-leading characters', () => {
    for (const dangerous of ['=1+1', '+1+1', '-1+1', '@SUM(A1)']) {
      const escaped = escapeCsvField(dangerous);
      expect(escaped.startsWith("'"), `${dangerous} must be neutralised`).toBe(true);
    }
  });

  it('neutralises the classic command-injection payload', () => {
    const payload = '=cmd|\' /C calc\'!A0';
    const escaped = escapeCsvField(payload);
    // Prefixed, and quoted because it also contains a comma-free but quote-ish
    // payload — the key property is that it no longer begins with `=`.
    expect(escaped.replace(/^"/, '').startsWith("'")).toBe(true);
  });

  it('does not mangle a legitimate negative number beyond neutralising it', () => {
    // -5 is prefixed for safety; the value remains readable to a human.
    expect(escapeCsvField(-5)).toBe("'-5");
  });

  it('leaves safe values alone', () => {
    for (const safe of ['CS101', 'Asha Rao', '92', '100%']) {
      expect(escapeCsvField(safe)).toBe(safe);
    }
  });
});

describe('CSV document', () => {
  const columns = [
    { key: 'code', label: 'Course Code' },
    { key: 'name', label: 'Course Name' },
    { key: 'rate', label: 'Pass Rate (%)' }
  ];

  it('emits a header row followed by data', () => {
    const csv = toCsv([{ code: 'CS101', name: 'Programming', rate: 100 }], columns);
    const lines = csv.split('\r\n');

    expect(lines[0]).toBe('Course Code,Course Name,Pass Rate (%)');
    expect(lines[1]).toBe('CS101,Programming,100');
  });

  it('uses CRLF line endings per RFC 4180', () => {
    const csv = toCsv([{ code: 'A' }, { code: 'B' }], [{ key: 'code', label: 'Code' }]);
    expect(csv).toContain('\r\n');
  });

  it('emits only a header when there are no rows', () => {
    expect(toCsv([], columns)).toBe('Course Code,Course Name,Pass Rate (%)');
  });

  it('renders a missing key as empty rather than omitting the column', () => {
    // Column alignment must survive sparse rows, or the file is unparseable.
    const csv = toCsv([{ code: 'CS101' }], columns);
    expect(csv.split('\r\n')[1]).toBe('CS101,,');
  });
});

describe('export formats', () => {
  it('declares content type and extension', () => {
    expect(exportMeta('csv').contentType).toContain('text/csv');
    expect(exportMeta('csv').extension).toBe('csv');
    expect(exportMeta('json').contentType).toContain('application/json');
  });

  it('names unsupported formats explicitly rather than silently downgrading', () => {
    // Emitting a CSV with an .xlsx extension — which some systems do — produces
    // a file that fails to open and a user who does not know why.
    expect(UNSUPPORTED_FORMATS.xlsx).toContain('exceljs');
    expect(UNSUPPORTED_FORMATS.pdf).toBeTruthy();
  });
});

describe('report provenance', () => {
  it('every report declares its source models and formula', () => {
    // Without provenance a figure is an assertion, not evidence — which is the
    // whole reason the compliance engine sits on this layer.
    for (const report of REPORTS) {
      expect(report.sourceModels.length, `${report.code} has no sourceModels`).toBeGreaterThan(0);
      expect(report.formula.length, `${report.code} has no formula`).toBeGreaterThan(20);
      expect(report.columns.length, `${report.code} has no columns`).toBeGreaterThan(0);
    }
  });

  it('resolves reports by code', () => {
    expect(findReport('EXAM_PASS_RATE')?.name).toBeTruthy();
    expect(findReport('NO_SUCH_REPORT')).toBeUndefined();
  });

  it('the faculty qualification report never infers a doctorate', async () => {
    // The removed fabrication defaulted every faculty member to 'Ph.D in CSE'.
    // This report must bucket unknowns as UNKNOWN and warn, never assume.
    const report = findReport('FACULTY_QUALIFICATION')!;
    expect(report.formula).toContain('SEPARATELY');
    expect(report.formula).toMatch(/never counted as doctorates/i);
  });

  it('report codes are unique', () => {
    const codes = REPORTS.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
