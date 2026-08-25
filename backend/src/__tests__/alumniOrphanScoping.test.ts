/**
 * AlumniProfile and Donation carry no institutionId column (see
 * prisma/schema.prisma) — they are scoped only transitively, through
 * `alumniProfile.userId -> User.institutionId`. The Prisma tenant extension
 * cannot inject a filter for a column that does not exist, so it does nothing
 * for either model, and every handler that touches them must reach
 * institutionId manually through that relation.
 *
 * WHAT THIS ONCE LOOKED LIKE
 *
 * Every read in alumni.ts against these two models had no institutionId
 * anywhere: `GET /dashboard`'s alumni count and donation total, `GET
 * /directory` and `/directory/:id`, `GET /donations`, and `GET
 * /progression/metrics`. Any authenticated alumni_officer, from any
 * institution, saw every institution's alumni roster and donation ledger
 * combined. `POST /donations` had the write-side mirror of the same defect:
 * nothing stopped an alumni officer from recording a donation against an
 * alumniProfileId belonging to a different institution's graduate.
 *
 * Confirmed live against a planted rival institution and rival rows — see the
 * commit for this file. Fixed by adding `user: { institutionId }` (or, for
 * donations, `alumni: { user: { institutionId } } }`) to every query, and by
 * having `POST /donations` verify the target alumniProfileId resolves inside
 * the caller's own institution before writing.
 *
 * (MentorshipProgram, AlumniCommunicationRecord and ProgressionSurvey had the
 * identical defect but a different fix — migration 0036 gave them a real
 * institutionId column, so they are now covered generically by
 * tenantCoverage.test.ts and the extension itself, with nothing bespoke
 * needed here.)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const alumniSrc = stripComments(
  readFileSync(fileURLToPath(new URL('../routes/alumni.ts', import.meta.url)), 'utf8')
);

const ORPHAN_MODELS = ['alumniProfile', 'donation'];

/**
 * `POST /directory/sync-graduates` creates AlumniProfile rows from
 * `eligibleStudents`, which comes from `prisma.studentProfile.findMany` —
 * StudentProfile IS tenant-owned, so that query is already scoped by the
 * extension itself, and every `userId` it hands to `alumniProfile.createMany`
 * already belongs to the caller's own institution. Nothing here needs a
 * literal institutionId reference because the scoping happened one query
 * earlier, structurally, not by convention.
 */
const EXEMPT_HANDLERS = new Set(['POST /directory/sync-graduates']);

/**
 * Split into one block per `router.<method>(` call, the same technique
 * `serviceScoping.test.ts` uses: each route handler in this codebase runs
 * from its own signature to the next, with nothing at top level in between.
 */
function routeBlocks(src: string): { signature: string; body: string }[] {
  const sigs = [...src.matchAll(/router\.(get|post|put|patch|delete)\(/g)].map((m) => m.index!);
  const blocks: { signature: string; body: string }[] = [];
  for (let i = 0; i < sigs.length; i++) {
    const start = sigs[i]!;
    const end = i + 1 < sigs.length ? sigs[i + 1]! : src.length;
    const body = src.slice(start, end);
    const sig = /router\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/.exec(body.slice(0, 200));
    blocks.push({ signature: sig ? `${sig[1]!.toUpperCase()} ${sig[2]}` : body.slice(0, 40), body });
  }
  return blocks;
}

/** Route handlers whose body queries an orphan model with no institutionId anywhere in the same handler. */
function unscopedOrphanRoutes(src: string): string[] {
  const found: string[] = [];
  for (const { signature, body } of routeBlocks(src)) {
    if (EXEMPT_HANDLERS.has(signature)) continue;
    const touchesOrphan = ORPHAN_MODELS.some((m) => body.includes(`prisma.${m}.`));
    if (!touchesOrphan) continue;
    if (!body.includes('institutionId')) found.push(signature);
  }
  return found;
}

describe('alumni.ts scopes AlumniProfile and Donation by hand', () => {
  it('found route handlers to scan — otherwise the check below is vacuous', () => {
    expect(routeBlocks(alumniSrc).length).toBeGreaterThan(10);
  });

  it('every handler touching AlumniProfile or Donation reaches institutionId', () => {
    expect(
      unscopedOrphanRoutes(alumniSrc),
      'A handler queries AlumniProfile or Donation — neither carries an ' +
        'institutionId column, so the tenant extension cannot scope them — ' +
        "without referencing institutionId anywhere in its own body. That's " +
        'the exact shape of the leak fixed for GET /dashboard, /directory, ' +
        '/directory/:id, /donations, /progression/metrics, and POST /donations.'
    ).toEqual([]);
  });

  it('NEGATIVE CONTROL: the scanner finds an unscoped handler and clears a scoped one', () => {
    const bare = `
router.get('/probe', authenticate, async (req, res) => {
  const rows = await prisma.donation.findMany({ orderBy: { date: 'desc' } });
});`;
    expect(unscopedOrphanRoutes(bare)).toEqual(['GET /probe']);

    const guarded = `
router.get('/probe', authenticate, async (req, res) => {
  const context = getTenantContext(req);
  const rows = await prisma.donation.findMany({
    where: { alumni: { user: { institutionId: context.institutionId } } }
  });
});`;
    expect(unscopedOrphanRoutes(guarded)).toEqual([]);
  });
});
