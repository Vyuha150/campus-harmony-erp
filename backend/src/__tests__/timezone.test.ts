/**
 * Timezone handling guards.
 *
 * The defect these protect against was invisible for the life of the project:
 * the connection pool set no session timezone, so the driver applied the
 * server's offset when writing a Date and unwound it on read. The round trip
 * was self-consistent, so nothing failed and no test caught it — while every
 * stored value sat one local offset away from the instant the application meant.
 *
 * Measured before the fix:
 *   Prisma wrote  2026-01-15T10:00:00Z
 *   row held      2026-01-15 04:30:00Z
 *   Prisma read   2026-01-15T10:00:00Z
 *
 * These are static checks. A round-trip test would need a live database, and the
 * property that actually matters — the pool is pinned to UTC and the columns are
 * zone-aware — is verifiable from the source.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('database session timezone', () => {
  it('pins the connection pool to UTC', () => {
    // Without this the pool inherits the server's zone, and identical code
    // stores different instants depending on where it is deployed.
    const code = stripComments(read('../lib/prisma.ts'));
    expect(code).toMatch(/options:\s*'-c timezone=UTC'/);
  });

  it('that assertion would catch the pool losing its timezone', () => {
    // Negative control: without it, the test above could pass because the regex
    // is wrong rather than because the pool is configured.
    const withoutOption = "const pool = new Pool({ host: 'x', max: 10 });";
    expect(stripComments(withoutOption)).not.toMatch(/options:\s*'-c timezone=UTC'/);
  });
});

describe('schema uses zone-aware timestamps', () => {
  const schema = read('../../prisma/schema.prisma');

  it('every DateTime field declares Timestamptz', () => {
    // `timestamp without time zone` cannot record which instant it means, so any
    // writer other than Prisma corrupts it silently.
    const dateTimeFields = schema
      .split('\n')
      .filter((line) => /^\s+\w+\s+DateTime\??/.test(line) && !line.trim().startsWith('//'));

    expect(dateTimeFields.length).toBeGreaterThan(200);

    const unannotated = dateTimeFields.filter((line) => !line.includes('@db.Timestamptz'));
    expect(
      unannotated.map((l) => l.trim()),
      'these DateTime fields would be stored without a time zone'
    ).toEqual([]);
  });
});

describe('timezone migrations', () => {
  it('the conversion assumes UTC explicitly rather than a session default', () => {
    // Relying on the session's zone would shift every row by the local offset,
    // and every date would still look plausible afterwards.
    const migration = read('../../prisma/migrations/20260822180000_0016_timestamptz/migration.sql');
    expect(migration).toMatch(/AT TIME ZONE 'UTC'/);
    // And it verifies rather than trusts the transform.
    expect(migration).toMatch(/moved by .* during conversion/);
  });

  it('the realignment refuses to run twice', () => {
    // Applying the shift a second time would move every timestamp by another
    // offset, and nothing downstream would report an error.
    const migration = read('../../prisma/migrations/20260822190000_0017_timezone_backfill/migration.sql');
    expect(migration).toMatch(/already been applied/);
    expect(migration).toMatch(/AT TIME ZONE/);
  });
});
