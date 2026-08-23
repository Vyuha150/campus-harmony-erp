/**
 * Bulk import tests.
 *
 * The parser is the highest-risk part: a reader that mis-splits one row shifts
 * every value into the wrong column, and the result is a student roll that
 * looks plausible and is wrong.
 */

import { describe, it, expect } from 'vitest';
import { parseCsv, toRecord, stripBom, normaliseHeading, CsvParseError } from '../modules/import/csv.js';
import {
  mapHeader,
  canonicalise,
  checkGatedColumns,
  newSeenKeys,
  normaliseQualificationLevel,
  studentImporter,
  facultyImporter,
  courseImporter,
  findImporter,
  type ReferenceData
} from '../modules/import/importers.js';

function refs(overrides: Partial<ReferenceData> = {}): ReferenceData {
  return {
    departmentsByCode: new Map([['CSE', 'dept-cse']]),
    programmesByCode: new Map([['BTCSE', 'prog-btcse']]),
    existingEmails: new Set<string>(),
    existingRollNumbers: new Set<string>(),
    existingCourseCodes: new Set<string>(),
    existingEmployeeIds: new Set<string>(),
    ...overrides
  };
}

describe('CSV parsing', () => {
  it('parses a simple file', () => {
    const result = parseCsv('a,b,c\n1,2,3');
    expect(result.header).toEqual(['a', 'b', 'c']);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.cells).toEqual(['1', '2', '3']);
  });

  it('keeps commas inside quoted fields', () => {
    // The reason a hand-written parser exists: `split(',')` corrupts every
    // address and any name written "Rao, Asha".
    const result = parseCsv('name,city\n"Rao, Asha",Hyderabad');
    expect(result.rows[0]!.cells).toEqual(['Rao, Asha', 'Hyderabad']);
  });

  it('unescapes doubled quotes', () => {
    const result = parseCsv('name\n"She said ""hi"""');
    expect(result.rows[0]!.cells).toEqual(['She said "hi"']);
  });

  it('keeps newlines inside quoted fields', () => {
    // Addresses pasted from another system routinely contain these.
    const result = parseCsv('name,address\nAsha,"12 Main St\nHyderabad"');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.cells[1]).toBe('12 Main St\nHyderabad');
  });

  it('handles CRLF, LF and a lone CR', () => {
    expect(parseCsv('a,b\r\n1,2').rows[0]!.cells).toEqual(['1', '2']);
    expect(parseCsv('a,b\n1,2').rows[0]!.cells).toEqual(['1', '2']);
    expect(parseCsv('a,b\r1,2').rows[0]!.cells).toEqual(['1', '2']);
  });

  it('strips a UTF-8 BOM', () => {
    // Excel writes one by default. Left in place it becomes part of the FIRST
    // column's name, so header mapping silently fails on exactly one column.
    const result = parseCsv('﻿rollNumber,name\nR1,Asha');
    expect(result.header[0]).toBe('rollNumber');
    expect(stripBom('﻿abc')).toBe('abc');
  });

  it('does not emit a phantom row for a trailing newline', () => {
    expect(parseCsv('a,b\n1,2\n').rows).toHaveLength(1);
    expect(parseCsv('a,b\n1,2\r\n').rows).toHaveLength(1);
  });

  it('skips blank lines rather than reporting empty rows', () => {
    expect(parseCsv('a,b\n1,2\n\n3,4\n').rows).toHaveLength(2);
  });

  it('reports line numbers as they appear in the FILE', () => {
    // Errors reported against a 0-based row index send the operator to the
    // wrong line in their spreadsheet.
    const result = parseCsv('a,b\n1,2\n3,4');
    expect(result.rows[0]!.line).toBe(2);
    expect(result.rows[1]!.line).toBe(3);
  });

  it('counts lines correctly after a multi-line quoted field', () => {
    const result = parseCsv('a,b\nx,"line1\nline2"\ny,z');
    expect(result.rows[1]!.line).toBe(4);
  });

  it('rejects an unterminated quoted field', () => {
    expect(() => parseCsv('a,b\n"unterminated,2')).toThrow(CsvParseError);
  });

  it('rejects a stray quote inside an unquoted field', () => {
    // Guessing here would silently alter someone's data.
    expect(() => parseCsv('a\nab"cd')).toThrow(CsvParseError);
  });

  it('rejects duplicate headings', () => {
    // Whichever column the mapper picked would be arbitrary.
    expect(() => parseCsv('name,name\n1,2')).toThrow(/Duplicate column/i);
  });

  it('rejects an empty file', () => {
    expect(() => parseCsv('')).toThrow(CsvParseError);
  });
});

describe('row to record', () => {
  it('maps cells onto header names', () => {
    expect(toRecord(['a', 'b'], ['1', '2'], 2)).toEqual({ a: '1', b: '2' });
  });

  it('trims values', () => {
    expect(toRecord(['a'], ['  x  '], 2)).toEqual({ a: 'x' });
  });

  it('refuses a row with the wrong number of cells', () => {
    // Padding or truncating shifts every later value into the wrong column —
    // the failure that makes people stop trusting an import.
    expect(() => toRecord(['a', 'b', 'c'], ['1', '2'], 5)).toThrow(/3 column/);
  });
});

describe('header mapping', () => {
  it('accepts the legacy spellings institutions actually use', () => {
    // "Roll No", "roll_number", "RollNumber" all appear in real exports.
    for (const heading of ['rollNumber', 'Roll No', 'roll_number', 'ROLL NUMBER', 'Reg.No']) {
      const { mapping } = mapHeader([heading], studentImporter.columns);
      expect(mapping.get(heading), `${heading} should map`).toBeTruthy();
    }
  });

  it('normalises separators and case', () => {
    expect(normaliseHeading('Roll_Number')).toBe(normaliseHeading('roll number'));
    expect(normaliseHeading('Date-Of.Birth')).toBe('dateofbirth');
  });

  it('reports missing required columns', () => {
    const { missing } = mapHeader(['rollNumber', 'name'], studentImporter.columns);
    expect(missing).toContain('email');
    expect(missing).toContain('programmeCode');
  });

  it('reports unknown columns without failing', () => {
    // Surfaced so a mis-named column is visible, but not fatal — legacy exports
    // carry all kinds of extra columns.
    const { unknown } = mapHeader(['rollNumber', 'favouriteColour'], studentImporter.columns);
    expect(unknown).toEqual(['favouriteColour']);
  });

  it('re-keys a record onto canonical names', () => {
    const { mapping } = mapHeader(['Roll No', 'Student Name'], studentImporter.columns);
    expect(canonicalise({ 'Roll No': 'R1', 'Student Name': 'Asha' }, mapping)).toEqual({
      rollNumber: 'R1',
      name: 'Asha'
    });
  });
});

describe('gated columns', () => {
  it('refuses caste, religion and disability columns', () => {
    // Collection is gated on DPDP legal review (T-407). A bulk importer is
    // exactly how such a gate gets bypassed by accident.
    for (const column of ['category', 'Caste', 'religion', 'Differently Abled']) {
      expect(checkGatedColumns([column]), `${column} must be gated`).toHaveLength(1);
    }
  });

  it('refuses Aadhaar outright', () => {
    expect(checkGatedColumns(['Aadhaar Number'])).toHaveLength(1);
    expect(checkGatedColumns(['aadhar'])).toHaveLength(1);
  });

  it('permits ordinary columns', () => {
    expect(checkGatedColumns(['rollNumber', 'name', 'email', 'gender'])).toHaveLength(0);
  });
});

describe('student validation', () => {
  const validRow = {
    rollNumber: 'CH2024CS100',
    name: 'Asha Rao',
    email: 'asha.rao@example.edu',
    programmeCode: 'BTCSE',
    departmentCode: 'CSE',
    semester: '3',
    admissionYear: '2024'
  };

  it('accepts a well-formed row', () => {
    const result = studentImporter.validate(validRow, 2, refs(), newSeenKeys());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.programmeId).toBe('prog-btcse');
      expect(result.data.departmentId).toBe('dept-cse');
      expect(result.data.semester).toBe(3);
    }
  });

  it('FAILS on an unknown department instead of creating one', () => {
    // The fabrication pattern removed in phase 0.2 was `getOrCreateDepartment`,
    // which invented a "CSE" department. At import scale, one typo would mint a
    // new department silently.
    const result = studentImporter.validate(
      { ...validRow, departmentCode: 'NOSUCH' },
      2,
      refs(),
      newSeenKeys()
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = result.issues.find((i) => i.column === 'departmentCode');
      expect(issue?.errorType).toBe('reference_not_found');
      expect(issue?.message).toMatch(/will not be created automatically/);
    }
  });

  it('FAILS on an unknown programme instead of creating one', () => {
    const result = studentImporter.validate(
      { ...validRow, programmeCode: 'GHOST' },
      2,
      refs(),
      newSeenKeys()
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.errorType === 'reference_not_found')).toBe(true);
    }
  });

  it('detects a duplicate against the database', () => {
    const result = studentImporter.validate(
      validRow,
      2,
      refs({ existingRollNumbers: new Set(['CH2024CS100']) }),
      newSeenKeys()
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.errorType === 'duplicate')).toBe(true);
    }
  });

  it('detects a duplicate WITHIN the same file', () => {
    // Usually a spreadsheet where a block was pasted twice. A unique constraint
    // would only catch this at write time, after validation reported it clean.
    const seen = newSeenKeys();
    const first = studentImporter.validate(validRow, 2, refs(), seen);
    expect(first.ok).toBe(true);

    const second = studentImporter.validate(validRow, 3, refs(), seen);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.issues.some((i) => i.message.includes('more than once in this file'))).toBe(true);
    }
  });

  it('rejects an invalid email', () => {
    const result = studentImporter.validate({ ...validRow, email: 'not-an-email' }, 2, refs(), newSeenKeys());
    expect(result.ok).toBe(false);
  });

  it('rejects an out-of-range semester', () => {
    for (const semester of ['0', '13', 'three', '2.5']) {
      const result = studentImporter.validate({ ...validRow, semester }, 2, refs(), newSeenKeys());
      expect(result.ok, `semester ${semester} should be rejected`).toBe(false);
    }
  });

  it('rejects a future admission year', () => {
    const result = studentImporter.validate(
      { ...validRow, admissionYear: String(new Date().getFullYear() + 5) },
      2,
      refs(),
      newSeenKeys()
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a spreadsheet formula in any field', () => {
    // Neutralised on export; still refused on import — it is not a name, and it
    // would be handed to whatever reads this data next.
    const result = studentImporter.validate(
      { ...validRow, name: '=cmd|/c calc' },
      2,
      refs(),
      newSeenKeys()
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.message.includes('formula'))).toBe(true);
    }
  });

  it('accepts a legitimate hyphenated name', () => {
    // The formula check must not reject "Anne-Marie".
    const result = studentImporter.validate(
      { ...validRow, name: 'Anne-Marie Rao' },
      2,
      refs(),
      newSeenKeys()
    );
    expect(result.ok).toBe(true);
  });

  it('rejects a future date of birth', () => {
    const result = studentImporter.validate(
      { ...validRow, dateOfBirth: '2099-01-01' },
      2,
      refs(),
      newSeenKeys()
    );
    expect(result.ok).toBe(false);
  });

  it('collects EVERY problem in a row, not just the first', () => {
    // An operator fixing one error per upload round-trip is why imports get
    // abandoned. A bad email must not hide an unknown department: reference
    // checks run on the raw values, independently of the schema parse.
    const result = studentImporter.validate(
      { ...validRow, departmentCode: 'NOPE', programmeCode: 'NOPE', email: 'bad' },
      2,
      refs(),
      newSeenKeys()
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const columns = result.issues.map((i) => i.column);
      expect(columns).toContain('departmentCode');
      expect(columns).toContain('programmeCode');
      expect(columns).toContain('email');
    }
  });

  it('reports several schema violations at once', () => {
    const result = studentImporter.validate(
      { ...validRow, email: 'bad', semester: '99', admissionYear: 'nope' },
      2,
      refs(),
      newSeenKeys()
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.length).toBeGreaterThanOrEqual(3);
  });

  it('has no password column at all', () => {
    // Passwords must never travel in a spreadsheet.
    expect(studentImporter.columns.some((c) => /password/i.test(c.name))).toBe(false);
    expect(facultyImporter.columns.some((c) => /password/i.test(c.name))).toBe(false);
  });

  it('has no CGPA column — it is computed, not imported', () => {
    expect(studentImporter.columns.some((c) => /cgpa|gpa/i.test(c.name))).toBe(false);
  });
});

describe('faculty qualification normalisation', () => {
  it('normalises unambiguous spellings of a doctorate', () => {
    for (const raw of ['Ph.D', 'PhD', 'ph d', 'Doctorate', 'D.Phil']) {
      expect(normaliseQualificationLevel(raw), `${raw} should be DOCTORATE`).toBe('DOCTORATE');
    }
  });

  it('recognises postgraduate and graduate degrees', () => {
    expect(normaliseQualificationLevel('M.Tech')).toBe('POSTGRADUATE');
    expect(normaliseQualificationLevel('M.Phil')).toBe('MPHIL');
    expect(normaliseQualificationLevel('B.Tech')).toBe('GRADUATE');
  });

  it('returns null for anything ambiguous rather than guessing', () => {
    // The removed defect auto-created faculty with `qualification: 'Ph.D in CSE'`,
    // fabricating doctorates that would have been reported to NIRF. "Dr." is a
    // title, not a completed doctorate; "pursuing PhD" is not one either.
    for (const raw of ['Dr.', 'pursuing PhD', 'Doctoral candidate', 'something else', '']) {
      expect(normaliseQualificationLevel(raw), `${raw} must stay unknown`).toBeNull();
    }
    expect(normaliseQualificationLevel(undefined)).toBeNull();
  });

  it('is anchored so a qualification MENTIONING a doctorate is not one', () => {
    // "M.Tech, pursuing Ph.D" is a postgraduate, not a doctorate.
    expect(normaliseQualificationLevel('M.Tech, pursuing Ph.D')).toBe('POSTGRADUATE');
  });
});

describe('faculty and course validation', () => {
  it('accepts a well-formed faculty row', () => {
    const result = facultyImporter.validate(
      {
        employeeId: 'EMP100',
        name: 'Dr Meera Iyer',
        email: 'meera@example.edu',
        departmentCode: 'CSE',
        designation: 'Assistant Professor'
      },
      2,
      refs(),
      newSeenKeys()
    );
    expect(result.ok).toBe(true);
  });

  it('leaves an absent faculty qualification unknown', () => {
    const result = facultyImporter.validate(
      {
        employeeId: 'EMP101',
        name: 'A Faculty',
        email: 'af@example.edu',
        departmentCode: 'CSE',
        designation: 'Lecturer'
      },
      2,
      refs(),
      newSeenKeys()
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.qualification).toBeUndefined();
  });

  it('rejects a non-integer credit value', () => {
    const result = courseImporter.validate(
      { code: 'CS101', name: 'Programming', credits: '3.5', departmentCode: 'CSE', semester: '1' },
      2,
      refs(),
      newSeenKeys()
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a negative credit value', () => {
    const result = courseImporter.validate(
      { code: 'CS101', name: 'Programming', credits: '-3', departmentCode: 'CSE', semester: '1' },
      2,
      refs(),
      newSeenKeys()
    );
    expect(result.ok).toBe(false);
  });
});

describe('importer registry', () => {
  it('resolves by entity type, case-insensitively', () => {
    expect(findImporter('students')?.entityType).toBe('students');
    expect(findImporter('STUDENTS')?.entityType).toBe('students');
    expect(findImporter('nonexistent')).toBeUndefined();
  });

  it('every importer declares guidance and at least one required column', () => {
    for (const type of ['students', 'faculty', 'courses']) {
      const importer = findImporter(type)!;
      expect(importer.guidance.length, `${type} needs guidance`).toBeGreaterThan(30);
      expect(importer.columns.some((c) => c.required), `${type} needs a required column`).toBe(true);
    }
  });
});

describe('import engine guarantees', () => {
  it('a dry run is the DEFAULT when the flag is omitted', async () => {
    // The safe outcome must be the one that happens by accident.
    const { readFileSync } = await import('node:fs');
    const routes = readFileSync(
      new URL('../modules/import/import.routes.ts', import.meta.url),
      'utf8'
    );
    expect(routes).toMatch(/dryRun:\s*z\.boolean\(\)\.optional\(\)\.default\(true\)/);
  });

  it('import jobs are tenant-owned', async () => {
    const { TENANT_OWNED_MODELS } = await import('../lib/tenantExtension.js');
    expect(TENANT_OWNED_MODELS.has('ImportJob')).toBe(true);
  });

  it('the engine writes inside a single transaction', async () => {
    const { readFileSync } = await import('node:fs');
    const service = readFileSync(
      new URL('../modules/import/import.service.ts', import.meta.url),
      'utf8'
    );
    expect(service).toMatch(/\$transaction/);
    // And audits the bulk creation.
    expect(service).toMatch(/recordInTransaction/);
  });
});
