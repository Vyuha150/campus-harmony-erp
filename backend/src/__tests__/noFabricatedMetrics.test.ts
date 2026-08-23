/**
 * Route handlers must not invent figures.
 *
 * THE PATTERN
 *
 * A handler queries the database, finds nothing (or finds something it did not
 * actually read), and returns a plausible number anyway. It produces no error,
 * fails no test, and looks correct on screen — which is exactly why it survives.
 * Every instance below was found by reading a response, not by a failure:
 *
 *   students.ts   `change: '+0.2', changeType: 'increase'` — a literal. The CGPA
 *                 tile claimed a rise of 0.2 on every render, including for a
 *                 student who had never been graded.
 *
 *   students.ts   attendance fell back to 100% when a student had NO attendance
 *                 records. Absence of data rendered as perfect attendance.
 *
 *   students.ts   `upcomingEvents` was one invented row dated `new Date()` — an
 *                 event permanently happening now.
 *
 *   faculty.ts    `responses.length > 0 ? 4.0 : 0`, plus 4.1 / 4.0 / 3.9 for
 *                 three fixed categories. A course with one scathing response
 *                 and one with fifty glowing ones both reported 4.0, and the
 *                 category names did not match the questions students answered.
 *
 *   coe.ts        `avgGPA: 7.2` — identical for every department and semester.
 *   dean.ts       the same literal.
 *
 *   vc.ts         `trend: '+0.0%'` on every revenue line, with no prior period
 *                 loaded to compare against.
 *
 *   iqac.ts       invented a NAAC "Overall Score" of 3.24 against a target of
 *                 3.5 whenever the metrics table was empty, and wrote them to
 *                 the database on first page load. (Fixed in Phase 3b.)
 *
 * The rule: when there is no data, say so. A dashboard that fills gaps with
 * plausible numbers is worse than an empty one, because nobody can tell which
 * figures were measured.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const routesDir = fileURLToPath(new URL('../routes', import.meta.url));
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const routeFiles = readdirSync(routesDir).filter((f) => f.endsWith('.ts'));
const sources = new Map(
  routeFiles.map((f) => [f, stripComments(readFileSync(join(routesDir, f), 'utf8'))])
);

/**
 * `<something>.length > 0 ? <number literal> : <number literal>`
 *
 * The shape that says "we have rows, so here is a score" without reading them.
 * A ternary returning a COMPUTED expression is fine and is not matched.
 */
const EXISTENCE_SCORE = /\.length\s*>\s*0\s*\?\s*-?\d+(?:\.\d+)?\s*:\s*-?\d+(?:\.\d+)?/;

/** A hard-coded delta presented as a measured trend. */
const LITERAL_TREND = /\b(?:change|trend)\s*:\s*['"][+-]\d/;

/**
 * Absence of data rendered as a perfect score.
 *
 * The middle must span NESTED parentheses: the real shape is
 * `Math.round((present / total) * 100)`, and an earlier `[^)]*` stopped at the
 * first inner `)`, so it never matched the very thing it was written to catch.
 * The negative control below is what exposed that — every file check was passing
 * while the matcher was dead.
 */
const EMPTY_MEANS_FULL = /\?\s*Math\.round\([\s\S]{0,120}?\)\s*:\s*100\b/;

describe('handlers do not fabricate figures', () => {
  it('found route files to scan — otherwise every check below is vacuous', () => {
    expect(routeFiles.length).toBeGreaterThan(10);
  });

  it.each([...sources.keys()].map((f) => [f] as const))(
    '%s does not score on existence alone',
    (file) => {
      const src = sources.get(file)!;
      const hit = EXISTENCE_SCORE.exec(src);
      expect(
        hit?.[0] ?? null,
        `${file} returns a literal number just because rows exist. ` +
          'Compute it from the rows, or report that there is no figure.'
      ).toBeNull();
    }
  );

  it.each([...sources.keys()].map((f) => [f] as const))(
    '%s does not assert a trend as a literal',
    (file) => {
      const src = sources.get(file)!;
      const hit = LITERAL_TREND.exec(src);
      expect(
        hit?.[0] ?? null,
        `${file} hard-codes a trend. A trend needs a prior period to compare ` +
          'against; if one is not loaded, the field should be null.'
      ).toBeNull();
    }
  );

  it.each([...sources.keys()].map((f) => [f] as const))(
    '%s does not turn "no records" into 100%%',
    (file) => {
      const src = sources.get(file)!;
      const hit = EMPTY_MEANS_FULL.exec(src);
      expect(
        hit?.[0] ?? null,
        `${file} falls back to 100 when there is nothing to average. ` +
          'No attendance recorded is not full attendance.'
      ).toBeNull();
    }
  );

  it('no handler hard-codes an average GPA', () => {
    for (const [file, src] of sources) {
      expect(src, `${file} hard-codes avgGPA`).not.toMatch(/avgGPA\s*:\s*\d/);
    }
  });

  describe('NEGATIVE CONTROLS: each matcher detects what it bans', () => {
    // Without these, a regex that silently stopped matching would turn every
    // check above into a guaranteed pass.
    it('existence-scoring', () => {
      expect(EXISTENCE_SCORE.test('overallRating: responses.length > 0 ? 4.0 : 0')).toBe(true);
      // a real computation must NOT trip it
      expect(
        EXISTENCE_SCORE.test('rating: xs.length > 0 ? Math.round(sum / xs.length) : null')
      ).toBe(false);
    });

    it('literal trends', () => {
      expect(LITERAL_TREND.test("change: '+0.2'")).toBe(true);
      expect(LITERAL_TREND.test("trend: '+0.0%'")).toBe(true);
      expect(LITERAL_TREND.test('change: `${delta >= 0 ? "+" : ""}${delta}`')).toBe(false);
    });

    it('empty-means-full', () => {
      expect(
        EMPTY_MEANS_FULL.test('const a = n > 0 ? Math.round((p / n) * 100) : 100;')
      ).toBe(true);
      expect(
        EMPTY_MEANS_FULL.test('const a = n > 0 ? Math.round((p / n) * 100) : null;')
      ).toBe(false);
    });
  });
});
