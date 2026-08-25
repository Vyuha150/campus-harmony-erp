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
 *   hod.ts        FIVE literals, all in the department head's own screens:
 *                 `avgPassPercentage: 88.5, avgAttendance: 82.3` on the
 *                 dashboard; `attendance: 85` on every student in TWO list
 *                 endpoints; `avgScore: 65, highestScore: 95` on every course
 *                 in TWO results endpoints; and a grade distribution computed
 *                 as a fixed 25% / 35% / 40% A/B/C split of `totalStudents`
 *                 rather than a tally of the real `Enrollment.grade` values
 *                 already loaded in the same query. Also: `advisor` was
 *                 `faculty[index % faculty.length]` — every student assigned a
 *                 mentor by cycling through the department's faculty list in
 *                 array order, with no `MenteeAssignment` behind it. (Phase 4.)
 *
 *   faculty.ts    `attendance: 80` on every mentee, regardless of whether they
 *                 had ever been marked present. (Phase 4.)
 *
 *   admin.ts      `systemHealth: { status: 'operational', uptime: '99.9%' }` —
 *                 a reliability percentage no monitoring in this system has
 *                 ever measured. (Phase 4.)
 *
 *   faculty.ts    `GET /marks/:courseId` did `Number(e.grade)` with no null
 *                 check, so an ungraded enrolment (`grade` is `null`) reported
 *                 a real mark of 0 — the same `Number(null) === 0` bug as
 *                 hod.ts and dean.ts. A second, unused endpoint,
 *                 `GET /marks/internal`, fabricated a five-part quiz/midterm/
 *                 assignment/attendance breakdown per row from nothing but the
 *                 row's array index (`6 + (index % 4)`, `28 + (index % 20)`,
 *                 …) — not read from any table, not derived from the total,
 *                 just a function of position in the result set. It had no
 *                 frontend caller; removed rather than fixed. (Phase 4.)
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

/**
 * A literal number assigned directly to a field name that this codebase's own
 * history has already shown gets read as a measured academic figure: an
 * attendance percentage, an average or highest score, an average pass
 * percentage. Not `attendance: value` (a variable) or `attendance: x ?? null`
 * — only a bare digit, which is the shape every fixed instance had.
 */
const HARDCODED_METRIC =
  /\b(?:attendance|avgScore|highestScore|avgGPA|avgPassPercentage|avgAttendance)\s*:\s*-?\d+(?:\.\d+)?\s*[,}]/;

/**
 * A grade or category distribution computed as a fixed fraction of a count,
 * rather than a tally of the real values already loaded in the same query —
 * `hod.ts`'s `{ grade: 'A', count: Math.round(totalStudents * 0.25) }`. The
 * multiplier can be any decimal fraction; the point is that a *count* field is
 * being invented from a *fraction*, not read from a record.
 */
const INVENTED_DISTRIBUTION = /count\s*:\s*Math\.(?:round|max|min)\([\s\S]{0,60}?\*\s*0\.\d+/;

/**
 * A per-row value built from the row's position in a `.map()` result rather
 * than anything read from the database — `faculty.ts`'s deleted
 * `GET /marks/internal` did `const quiz1 = Math.min(10, 6 + (index % 4))` for
 * five different "scores," none of them backed by a column. Bounding the
 * result with `Math.min`/`Math.max` made it look like a plausible score
 * instead of an obviously wrong one.
 */
const INDEX_FABRICATED_VALUE = /-?\d+\s*\+\s*\(?\s*index\s*%\s*\d+\s*\)?/;

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

  it.each([...sources.keys()].map((f) => [f] as const))(
    '%s does not hard-code a measured academic figure',
    (file) => {
      const src = sources.get(file)!;
      const hit = HARDCODED_METRIC.exec(src);
      expect(
        hit?.[0] ?? null,
        `${file} assigns a literal number to a field this codebase has already ` +
          'shown gets read as measured (attendance, avgScore, highestScore, ' +
          'avgGPA, avgPassPercentage, avgAttendance). Compute it from the rows, ' +
          'or report null.'
      ).toBeNull();
    }
  );

  it.each([...sources.keys()].map((f) => [f] as const))(
    '%s does not invent a distribution from a fixed fraction of a count',
    (file) => {
      const src = sources.get(file)!;
      const hit = INVENTED_DISTRIBUTION.exec(src);
      expect(
        hit?.[0] ?? null,
        `${file} computes a category count as a fraction of a total rather than ` +
          'tallying the real values. hod.ts did this for a grade distribution: ' +
          "every course reported the same 25%/35%/40% A/B/C split regardless of " +
          'what any student was actually graded.'
      ).toBeNull();
    }
  );

  it.each([...sources.keys()].map((f) => [f] as const))(
    '%s does not fabricate a value from the row index',
    (file) => {
      const src = sources.get(file)!;
      const hit = INDEX_FABRICATED_VALUE.exec(src);
      expect(
        hit?.[0] ?? null,
        `${file} derives a "score" from a row's position in the result set ` +
          '(an offset plus index modulo N) instead of a real column. ' +
          'faculty.ts did this for a fake quiz/midterm/assignment breakdown.'
      ).toBeNull();
    }
  );

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

    it('hardcoded metric', () => {
      expect(HARDCODED_METRIC.test('attendance: 85, status: "active"')).toBe(true);
      expect(HARDCODED_METRIC.test('avgScore: 65, highestScore: 95, gradeDistribution: []')).toBe(true);
      expect(HARDCODED_METRIC.test('avgPassPercentage: 88.5, avgAttendance: 82.3 }')).toBe(true);
      // a real value — a variable, a computed expression, or null — must NOT trip it
      expect(HARDCODED_METRIC.test('attendance: attendanceByStudent.get(id) ?? null,')).toBe(false);
      expect(HARDCODED_METRIC.test('avgScore: numericMarks.length > 0 ? avg : null,')).toBe(false);
    });

    it('invented distribution', () => {
      expect(
        INVENTED_DISTRIBUTION.test("{ grade: 'A', count: Math.round(totalStudents * 0.25) }")
      ).toBe(true);
      expect(
        INVENTED_DISTRIBUTION.test(
          "{ grade: 'C', count: Math.max(0, totalStudents - Math.round(totalStudents * 0.6)) }"
        )
      ).toBe(true);
      // a real tally — counting actual rows — must NOT trip it
      expect(INVENTED_DISTRIBUTION.test('counts.set(grade, (counts.get(grade) ?? 0) + 1)')).toBe(false);
    });

    it('index-fabricated value', () => {
      expect(INDEX_FABRICATED_VALUE.test('const quiz1 = Math.min(10, 6 + (index % 4));')).toBe(true);
      expect(INDEX_FABRICATED_VALUE.test('const midterm = Math.min(50, 28 + (index % 20));')).toBe(true);
      // a real value read from the row itself must NOT trip it
      expect(INDEX_FABRICATED_VALUE.test('const grade = enrollment.grade;')).toBe(false);
    });
  });
});
