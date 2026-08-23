# 14 — Testing & Reliability

## Testing: the complete suite

`src/test/example.test.ts` is the **only** test file in the repository (excluding `node_modules`):

```ts
import { describe, it, expect } from "vitest";

describe("example", () => {
  it("should pass", () => {
    expect(true).toBe(true);
  });
});
```

That is the entire test suite for **478 API endpoints, 95 database models and 133 feature components**.

| Test type | Present | Count |
|---|---|---:|
| Unit | ❌ | 0 |
| Component | ❌ | 0 |
| API / integration | ❌ | 0 |
| Database | ❌ | 0 |
| End-to-end | ❌ | 0 |
| Security | ❌ | 0 |
| Permission / RBAC | ❌ | 0 |
| Regression | ❌ | 0 |
| Load | ❌ | 0 |
| Migration | ❌ | 0 (no migrations exist) |
| **Trivial placeholder** | ✅ | **1** |

Infrastructure is installed and unused: `vitest` 3.2, `@testing-library/react` 16, `@testing-library/jest-dom` 6.6, `jsdom`, plus `vitest.config.ts`. `backend/package.json` has `"test": "echo \"Error: no test specified\" && exit 1"` — **the backend has no test runner at all.**

`@testsprite/testsprite-mcp` is a dependency and `testsprite_exec_log.txt` sits in the repo root, suggesting an AI test-generation tool was trialled. No generated tests were committed.

### Diagnostics actually executed

Commands run during this audit, with real results:

| Command | Result |
|---|---|
| `npx tsc --noEmit` (backend) | **36 errors** |
| `npx tsc --noEmit -p tsconfig.app.json` (frontend) | **22 errors** |
| `npm audit` (frontend) | **32 vulns** — 1 critical, 22 high, 7 moderate, 2 low |
| `npm audit` (backend) | **21 vulns** — 13 high, 6 moderate, 2 low |
| `npm install` (both) | ✅ succeeded — 644 + 300 packages |
| `npm test` | **NOT RUN** |
| `npm run build` | **NOT RUN** |
| `npm run lint` | **NOT RUN** |
| `prisma validate` / `migrate` | **NOT RUN** — no migrations exist |

**`BLOCKED / NOT VERIFIED`:** the test suite, production build and linter were not executed, and the application was never run against a live database. No claim in this audit rests on runtime behaviour.

### Critical workflows with zero test protection

Every one of these can silently corrupt institutional records:

| Workflow | Risk |
|---|---|
| Authentication & JWT verification | Auth bypass undetected |
| RBAC enforcement (17 roles × 18 modules) | Privilege escalation undetected |
| Grade entry and mutation | Academic record corruption |
| Fee payment and status transitions | Financial record corruption |
| Attendance recording | Eligibility miscalculation |
| Result publication | Wrong results published |
| Payroll processing | Incorrect payments |
| File upload and access control | Confidential data exposure |
| Grievance anonymity | Complainant identity exposure |

## Reliability

### T1 — No transaction boundaries (P1)

**4 uses of `prisma.$transaction` across 478 endpoints.** Operations requiring atomicity that lack it:

| Operation | Failure mode |
|---|---|
| Fee payment + receipt + ledger | Payment recorded without receipt, or receipt without payment |
| Marks entry + result publication | Published results diverge from stored marks |
| Course registration + seat update | Over-enrolment or lost seats |
| Student promotion + record creation | Student in undefined semester state |
| Payroll + journal entry | Books out of balance |

`faculty.ts:1029` updates grades **inside a loop** with no transaction — partial failure leaves some students graded, others not, with no record of the boundary.

### T2 — No idempotency (P1)

No idempotency keys, no request deduplication, no optimistic concurrency (no `version` column on any model). Consequences:

- Double-clicking submit creates duplicate fee records, duplicate applications, duplicate grievances.
- Concurrent grade entry by two users: last write wins silently.
- Retried requests re-execute side effects.

`@@unique` constraints provide accidental partial protection in a few places (`Enrollment`, `ClassEnrollment`, `Attendance`, `Submission`) — genuinely valuable, but incidental rather than designed.

### T3 — Race conditions in `getOrCreate*` (P1)

`getOrCreateStudentProfile` (`students.ts:122`) and `getOrCreateFacultyProfile` (`faculty.ts:38`) are read-then-write with **no transaction and no upsert**. Two concurrent requests both find no profile, both attempt `create`, and the second violates the `userId @unique` constraint — surfacing as a 500. On a login storm this is a live failure mode.

These functions should be deleted outright (see `04_BACKEND_AUDIT.md` B1), which resolves the race as a side effect.

### T4 — Runtime DDL under concurrency (P1)

`ensureFacultyLessonPlanTable()` (`faculty.ts:10`) issues `CREATE TABLE IF NOT EXISTS` on the request path. Concurrent calls contend on schema locks; under load this blocks unrelated queries.

### T5 — No retry, backoff, or circuit breaking (P2)

No retry logic anywhere. `server.ts:76-88` exits the process if the initial Prisma connect fails — reasonable — but there is no reconnection handling for connection loss *during* operation.

### T6 — No background processing (P2)

No queue, worker, or scheduler. Everything runs synchronously in the request:

- Report generation blocks the HTTP request
- Notification records are written with no delivery mechanism (no email/SMS/push transport exists)
- Bulk operations have no batching

Long-running reports will hit request timeouts and consume a connection for their duration.

### T7 — Uniform error swallowing (P2)

Every handler collapses all failures into 500 with the raw message (`04_BACKEND_AUDIT.md` B6). A missing record returns 500, not 404; a unique violation returns 500, not 409. Clients cannot distinguish retryable from permanent failures.

### T8 — No health/readiness distinction (P3)

`server.ts:42-44` provides `/api/health` returning a static `{ status: 'healthy' }` — it does **not** check database connectivity. A running process with a dead database reports healthy. No readiness or liveness distinction for orchestrators.

## Operations requiring atomicity — target state

Per the brief:

| Operation | Required boundary |
|---|---|
| Fee payment + receipt creation | Single transaction + idempotency key |
| Marks approval + result publication | Single transaction + audit record |
| Course registration + seat update | Transaction + row lock on seat count |
| Student promotion + academic record | Transaction + history write |

## Scores

- **Testing: 2 / 100** — infrastructure present, one trivial assertion.
- **Reliability: 15 / 100** — no transactions, no idempotency, live race conditions.

## Recommendations

1. **Write RBAC and auth tests first** (`P1`) — 17 roles × 18 modules is the highest-value, most mechanical coverage available, and it protects the property the system currently gets *right*.
2. Add a backend test runner (`vitest` + `supertest`) against a disposable Postgres (**P1**).
3. Wrap all multi-step writes in `$transaction` (**P1**).
4. Delete `getOrCreate*` — resolves T3 and the P0 fabrication together (**P0**).
5. Add idempotency keys to financial and enrolment endpoints (**P1**).
6. Fix the 58 TypeScript errors; enable `strict` and CI type-checking (**P2**).
7. Introduce a job queue for reports and notifications (**P2**).
8. Make `/api/health` verify the database; add `/ready` (**P3**).
9. Add integration tests for each atomic operation above before touching that code (**P1**).
