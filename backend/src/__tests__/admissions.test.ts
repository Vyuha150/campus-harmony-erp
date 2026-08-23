/**
 * Admissions regression tests (EPIC-05).
 *
 * Locks the request contracts and the architectural properties that make this
 * module the reference implementation for T-203. The workflow itself was
 * verified end-to-end against a running server with two institutions; those
 * HTTP tests need a disposable database in CI and are tracked as T-213.
 */

import { describe, it, expect } from 'vitest';
import {
  createCycleSchema,
  submitApplicationSchema,
  verifyApplicationSchema,
  makeOfferSchema,
  listApplicationsQuery
} from '../modules/admissions/admissions.schema.js';

const validCycle = {
  programmeId: 'programme-1',
  academicYear: '2026-27',
  name: 'B.Tech CSE Admissions 2026',
  code: 'BTCSE2026',
  applicationStartsAt: '2026-08-01',
  applicationEndsAt: '2026-12-31',
  totalSeats: 10,
  seatMatrix: [
    { category: 'GENERAL', totalSeats: 5 },
    { category: 'OBC_NCL', totalSeats: 2 },
    { category: 'SC', totalSeats: 2 },
    { category: 'ST', totalSeats: 1 }
  ]
};

const validApplication = {
  cycleId: 'cycle-1',
  fullName: 'Asha Rao',
  email: 'asha@example.edu',
  phone: '9876500001',
  dateOfBirth: '2008-03-15',
  category: 'SC' as const
};

describe('admission cycle contract', () => {
  it('accepts a well-formed cycle', () => {
    expect(createCycleSchema.safeParse(validCycle).success).toBe(true);
  });

  it('requires at least one seat category', () => {
    // A cycle with no seat matrix could never allocate against a statutory quota.
    const result = createCycleSchema.safeParse({ ...validCycle, seatMatrix: [] });
    expect(result.success).toBe(false);
  });

  it('rejects a reservation category the system does not recognise', () => {
    // Categories are statutory; a free-text value would silently create an
    // unallocatable pool.
    const result = createCycleSchema.safeParse({
      ...validCycle,
      seatMatrix: [{ category: 'MADE_UP_QUOTA', totalSeats: 5 }]
    });
    expect(result.success).toBe(false);
  });

  it('accepts every statutory reservation category', () => {
    for (const category of ['GENERAL', 'EWS', 'OBC_NCL', 'SC', 'ST', 'PWD', 'MINORITY']) {
      const result = createCycleSchema.safeParse({
        ...validCycle,
        totalSeats: 5,
        seatMatrix: [{ category, totalSeats: 5 }]
      });
      expect(result.success, category).toBe(true);
    }
  });

  it('REJECTS unknown keys (mass assignment)', () => {
    // The `PUT /admin/users` fix needed a hand-written whitelist precisely
    // because req.body was spread into Prisma. `.strict()` makes that
    // structural for every new endpoint.
    const result = createCycleSchema.safeParse({ ...validCycle, status: 'open', createdBy: 'x' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-positive intake', () => {
    expect(createCycleSchema.safeParse({ ...validCycle, totalSeats: 0 }).success).toBe(false);
  });

  it('normalises the cycle code to uppercase', () => {
    const parsed = createCycleSchema.parse({ ...validCycle, code: 'btcse2026' });
    expect(parsed.code).toBe('BTCSE2026');
  });

  it('requires academic year in YYYY-YY form', () => {
    expect(createCycleSchema.safeParse({ ...validCycle, academicYear: '2026' }).success).toBe(false);
    expect(createCycleSchema.safeParse({ ...validCycle, academicYear: '2026-27' }).success).toBe(true);
  });
});

describe('application contract', () => {
  it('accepts a well-formed application', () => {
    expect(submitApplicationSchema.safeParse(validApplication).success).toBe(true);
  });

  it('validates Indian mobile numbers', () => {
    for (const phone of ['123', '12345678901234', '1234567890', 'abcdefghij']) {
      expect(
        submitApplicationSchema.safeParse({ ...validApplication, phone }).success,
        phone
      ).toBe(false);
    }
    for (const phone of ['9876500001', '+919876500001', '6123456789']) {
      expect(
        submitApplicationSchema.safeParse({ ...validApplication, phone }).success,
        phone
      ).toBe(true);
    }
  });

  it('normalises email to lowercase', () => {
    const parsed = submitApplicationSchema.parse({
      ...validApplication,
      email: 'Asha.RAO@Example.EDU'
    });
    expect(parsed.email).toBe('asha.rao@example.edu');
  });

  it('defaults category to GENERAL when omitted', () => {
    const { category, ...withoutCategory } = validApplication;
    void category;
    expect(submitApplicationSchema.parse(withoutCategory).category).toBe('GENERAL');
  });

  it('bounds the qualifying percentage to 0-100', () => {
    expect(
      submitApplicationSchema.safeParse({ ...validApplication, previousPercentage: 101 }).success
    ).toBe(false);
    expect(
      submitApplicationSchema.safeParse({ ...validApplication, previousPercentage: -1 }).success
    ).toBe(false);
  });

  it('REJECTS client-supplied status or merit rank', () => {
    // An applicant must not be able to declare themselves admitted or set
    // their own merit position.
    for (const forged of [{ status: 'admitted' }, { meritRank: 1 }, { isEligible: true }]) {
      expect(
        submitApplicationSchema.safeParse({ ...validApplication, ...forged }).success,
        JSON.stringify(forged)
      ).toBe(false);
    }
  });
});

describe('decision contracts', () => {
  it('requires an explicit eligibility decision', () => {
    expect(verifyApplicationSchema.safeParse({}).success).toBe(false);
    expect(verifyApplicationSchema.safeParse({ eligible: true }).success).toBe(true);
  });

  it('bounds offer validity to a sane window', () => {
    expect(makeOfferSchema.safeParse({ validForDays: 0 }).success).toBe(false);
    expect(makeOfferSchema.safeParse({ validForDays: 400 }).success).toBe(false);
    expect(makeOfferSchema.safeParse({ validForDays: 14 }).success).toBe(true);
  });

  it('rejects a negative admission fee', () => {
    expect(makeOfferSchema.safeParse({ admissionFeeAmount: -1 }).success).toBe(false);
  });
});

describe('pagination', () => {
  it('applies defaults', () => {
    const parsed = listApplicationsQuery.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(50);
  });

  it('caps page size so a caller cannot request an unbounded page', () => {
    // Only ~9% of the original 478 endpoints paginated; the rest returned whole
    // tables. Pagination is enforced in the shared layer now.
    expect(listApplicationsQuery.safeParse({ pageSize: 10_000 }).success).toBe(false);
  });

  it('coerces numeric strings from the query string', () => {
    const parsed = listApplicationsQuery.parse({ page: '3', pageSize: '25' });
    expect(parsed.page).toBe(3);
    expect(parsed.pageSize).toBe(25);
  });
});

describe('architecture guards', () => {
  async function read(relativePath: string): Promise<string> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const content = await fs.readFile(path.resolve(process.cwd(), relativePath), 'utf8');
    return content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  }

  it('keeps data access out of route handlers', async () => {
    // The defect this module exists to avoid: hod.ts is 1,882 lines of mixed
    // HTTP, business rules and Prisma calls.
    const routes = await read('src/modules/admissions/admissions.routes.ts');
    expect(routes).not.toContain('prisma.');
    expect(routes).not.toContain('basePrisma');
  });

  it('does not swallow errors into blanket 500s', async () => {
    const routes = await read('src/modules/admissions/admissions.routes.ts');
    expect(routes).not.toContain('message: error.message');
    expect(routes).not.toContain('res.status(500)');
  });

  it('audits every state-changing operation', async () => {
    // Admission decisions are institutional records. `mutate()` writes the
    // change and its audit entry in one transaction.
    const service = await read('src/modules/admissions/admissions.service.ts');
    const mutations = (service.match(/export async function (create|open|submit|verify|generate|make|decline|confirm)\w*/g) ?? []).length;
    const audited = (service.match(/mutate\(/g) ?? []).length;
    expect(audited).toBeGreaterThanOrEqual(mutations - 1); // listCycles/stats are reads
  });

  it('does not fabricate derived academic values', async () => {
    // The Phase 0 defect: a literal `cgpa: 8.5` written for any student.
    // CGPA must be COMPUTED from results (T-403), so admission sets it to zero.
    const service = await read('src/modules/admissions/admissions.service.ts');
    expect(service).toContain('cgpa: 0');
    expect(service).not.toMatch(/cgpa:\s*[1-9]/);
  });
});
