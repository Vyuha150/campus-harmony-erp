# 04 — Backend Audit

**Scope:** `backend/src/` — 18 route files, 12,108 lines, **478 endpoints**, plus middleware and lib.
**Method:** full read of `server.ts`, `middleware/auth.ts`, `routes/auth.ts`, `routes/uploads.ts`, and the `getOrCreate*`/raw-SQL sections of `students.ts` and `faculty.ts`; repository-wide pattern analysis for the systemic measures below.

---

## Systemic measures (repository-wide, verified by grep)

| Measure | Result | Assessment |
|---|---|---|
| Total endpoints | 478 | — |
| Validation library in `backend/package.json` | **none** (no `zod`, `joi`, `express-validator`, `celebrate`) | **P1 systemic** |
| `prisma.$transaction` uses | **4**, in 3 files (`dean.ts`, `admin.ts`, `placements.ts` ×2) | **P1 systemic** |
| Endpoints with `take:`/`skip:` | 42 (~9%) | **P1 systemic** |
| `SystemAuditLog.create` calls | **0** | **P0** |
| `console.log` in route code | 0 (clean) | ✅ |
| SQL injection vectors | 0 — all raw SQL parameterised | ✅ |
| `bcrypt` cost | 10, consistent | ✅ |

`zod` **is** a dependency of the **frontend** — so client-side forms may validate, but the API accepts anything. Client-side validation is a UX feature, not a security control.

---

## B1 — The backend fabricates authoritative records (P0)

This is the most serious defect in the repository and it is **systemic**, not isolated.

### Student records

`backend/src/routes/students.ts:122-143`:

```ts
async function getOrCreateStudentProfile(userId: string) {
  let profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!profile) {
    profile = await prisma.studentProfile.create({
      data: {
        userId,
        rollNumber: `STU${userId.substring(0, 6).toUpperCase()}`,
        program: 'B.Tech', branch: 'Computer Science',
        semester: 5, section: 'A', batch: '2024',
        admissionYear: 2024,
        cgpa: 8.5                    // ← fabricated
      }
    });
  }
  return profile;
}
```

Invoked from `students.ts:14` inside `GET /api/students/messages` and elsewhere. **A GET request writes a fabricated CGPA, roll number, programme, branch and admission year into the student record system.**

The generated `rollNumber` is `STU` + the first 6 characters of a UUID. `rollNumber` is `@unique`; a collision throws a 500 at read time.

### Faculty records

`backend/src/routes/faculty.ts:38-52`:

```ts
profile = await prisma.facultyProfile.create({
  data: {
    userId,
    employeeId: `FAC${userId.substring(0, 6).toUpperCase()}`,
    qualification: 'Ph.D in CSE',
    specialization: 'Artificial Intelligence',
    experience: 5
  }
});
```

Called from **38 separate endpoints** in `faculty.ts` (lines 169, 216, 257, 277, 303, 318, 343, 377, 404, 431, 544, 612, 708, 739, 774, 800, 826, 870, 945, 1043, 1085, 1122, 1150, 1169, 1183, 1226, 1274, 1310, 1325, 1497, 1518 …).

**Faculty qualification and experience are direct NIRF `TLR` inputs and NAAC teaching-learning evidence.** The system will report fabricated doctorates to accreditation bodies.

### Academic delivery records

`backend/src/routes/faculty.ts:560-578` — when a course has no lesson plans, the backend invents eight weeks of them and **marks weeks 1–4 `'completed'`** with no human action:

```ts
if (existingRows.length === 0) {
  for (let week = 1; week <= 8; week += 1) {
    await prisma.$executeRawUnsafe(`INSERT INTO "FacultyLessonPlan" (...) VALUES (...)`,
      `${course.id}-${week}`, course.id, week,
      `Module ${week}`,
      JSON.stringify([`Topic ${week}.1`, `Topic ${week}.2`]),
      `CO${Math.min(week, 5)}`,
      plannedDate,
      week <= 4 ? 'completed' : 'pending');   // ← fabricated completion status
  }
}
```

This also fabricates course-outcome codes (`CO1`–`CO5`) — the exact artefact OBE attainment reporting depends on.

### Class structures

`faculty.ts:98-163` (`getOrCreateFacultyClasses`) and `students.ts:145+` (`getOrCreateStudentClassEnrollments`) similarly synthesise `CourseClass` and `ClassEnrollment` rows on read.

**Assessment:** these functions were presumably written to make dashboards render during development. In an institutional record system they are a data-integrity catastrophe: reads mutate state, and the mutations are invented facts that become indistinguishable from real records. **All `getOrCreate*` fabrication must be removed** and replaced with explicit admissions/HR onboarding workflows that return an empty state when no profile exists.

## B2 — No input validation anywhere (P1 systemic)

No validation library is installed in the backend. Validation, where present, is ad-hoc `if (!x)` presence checking. Representative good case — `faculty.ts:616-638`:

```ts
if (!Number.isFinite(weekNumber) || weekNumber < 1) { res.status(400)… }
if (!topic || !courseOutcome || !plannedDate || !status) { res.status(400)… }
```

This checks presence, not validity: `status` accepts any string, `plannedDate` any parseable value. Combined with `D3` (no foreign keys) and `D7` (no enums), the system accepts arbitrary strings into fields that drive business logic and reporting.

**Consequences:** type confusion, invalid state values no code path handles, orphaned references, and probable mass-assignment exposure where handlers spread `req.body` into Prisma `data` (**NOT VERIFIED** exhaustively).

## B3 — Effectively no transaction boundaries (P1)

4 uses of `prisma.$transaction` across 478 endpoints. Operations that **must** be atomic and are not:

| Operation | Risk if interrupted |
|---|---|
| Fee payment + receipt + ledger entry | Money recorded as received with no receipt, or vice versa |
| Marks entry + result publication | Published results inconsistent with stored marks |
| Course registration + seat decrement | Over-enrolment or lost seats |
| Student promotion + academic record creation | Student in an undefined semester state |
| Payroll processing + journal entry | Financial books out of balance |

`faculty.ts:1029` updates grades inside a loop with no transaction — a partial failure leaves some students graded and others not, with no record of which.

## B4 — Pagination largely absent (P1)

42 of 478 endpoints use `take`/`skip`. List endpoints returning `findMany()` unbounded will degrade linearly and eventually exhaust memory. The audit-log viewer (`admin.ts:264`), grievance lists, student lists, and attendance queries are all unbounded.

## B5 — N+1 query patterns (P2)

`faculty.ts:551-586` loops over courses issuing **two raw queries per course**, plus up to 8 inserts on first call:

```ts
for (const course of courses) {
  const existingRows = await prisma.$queryRawUnsafe(...);   // query 1
  if (existingRows.length === 0) { /* 8 inserts */ }
  const rows = await prisma.$queryRawUnsafe(...);            // query 2
}
```

`getOrCreateFacultyClasses` (`faculty.ts:117-155`) similarly issues a `create` per group inside nested loops.

## B6 — Uniform error swallowing (P2)

Every handler follows:

```ts
} catch (error: any) {
  res.status(500).json({ success: false, message: error.message });
}
```

All failures become 500 regardless of cause — a missing record returns 500 rather than 404, a constraint violation returns 500 rather than 409. Raw internal messages reach the client (see `07_SECURITY_AUDIT.md` S7). No structured logging, no correlation ID, no error taxonomy.

## B7 — Type checking disabled by convention (P2)

`const db: any = prisma` at `faculty.ts:8`, `students.ts:8` and elsewhere. Every `db.*` call is unchecked. This is why only 36 type errors surface across 12,108 lines — most data access is invisible to the compiler.

### `tsc --noEmit` — backend: 36 errors

Genuine runtime-crash candidates:

| Location | Error |
|---|---|
| `dean.ts:786-790` | `Property 'user' does not exist on type '{}'` (×4), `'rollNumber'` (×1) |
| `students.ts:107-109` | `Property 'name'/'semester'/'faculty' does not exist on type '{}'` |
| `finance.ts:613-616` | `Object is possibly 'undefined'` (×3), `Type 'undefined' cannot be used as an index type` (×3) |
| `faculty.ts:413` | `Argument of type 'unknown' is not assignable to parameter of type 'number'` |

`lib/prisma.ts:2` — `Module '@prisma/client' has no exported member 'PrismaClient'` — expected before `prisma generate`; not a code defect.

The remainder are implicit-`any` parameters.

## B8 — Runtime DDL (P1)

`faculty.ts:10-26` executes `CREATE TABLE IF NOT EXISTS "FacultyLessonPlan"` inside request handling, called at `faculty.ts:548` and `:640`. See `05_DATABASE_AUDIT.md` D2.

## What the backend does well

- **RBAC enforced server-side** at every mount (`server.ts:47-64`), consistently via `.includes()`. No frontend-only authorization.
- **Raw SQL correctly parameterised** — no SQL injection.
- **Upload path sanitisation** correct (`uploads.ts:12-16`) — no path traversal.
- **Consistent bcrypt cost 10.**
- **Student identity derived from JWT**, not client input — avoids the classic IDOR.
- **Graceful shutdown implemented** (`server.ts:90-115`) — SIGINT/SIGTERM close the server and disconnect Prisma.
- **No `console.log` debris** in route code.
- **Modular file organisation** by role — navigable despite file sizes.

## BLOCKED / NOT VERIFIED

- **Individual endpoint behaviour was not runtime-tested.** No server was started against a migrated database during this audit; the classification table below reflects static reading, not execution.
- **Per-endpoint classification of all 478 endpoints is incomplete.** Fully read: `server.ts`, `middleware/auth.ts`, `routes/auth.ts` (2 endpoints), `routes/uploads.ts` (1), plus targeted sections of `students.ts` and `faculty.ts`. The remaining ~14 route files were analysed by systemic pattern search, not line-by-line. **A complete endpoint matrix requires a further pass** — see `06_API_TRACE_MATRIX.md`.
- **Mass assignment** exposure not confirmed per endpoint.
- **Object-level authorization** verified only for `students.ts`.
- Two delegated background agents tasked with the exhaustive per-endpoint pass **failed (stalled)**; their work was not recovered and is not represented here.

## Priority fixes

1. Remove all `getOrCreate*` fabrication (**P0**).
2. Delete the `JWT_SECRET` fallback; fail fast (**P0**) — see S1.
3. Write `SystemAuditLog` on every mutation (**P0**).
4. Add `zod` validation middleware per endpoint (**P1**).
5. Wrap multi-step writes in `$transaction` (**P1**).
6. Add pagination to all list endpoints (**P1**).
7. Fold `FacultyLessonPlan` into the schema; remove runtime DDL (**P1**).
8. Introduce an error taxonomy; stop leaking `error.message` (**P2**).
9. Remove `const db: any`; type the Prisma client properly (**P2**).
10. Extract a service layer so the above can be applied in one place rather than 478 (**P2**).
