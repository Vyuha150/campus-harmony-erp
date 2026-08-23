# 09 — Testing Plan

## Before

The entire repository's test suite was one file:

```ts
describe("example", () => { it("should pass", () => { expect(true).toBe(true); }); });
```

For 478 endpoints, 95 models and 133 components. The backend had **no test runner at all** — `"test": "echo \"Error: no test specified\" && exit 1"`.

## Now ✅

`backend/src/__tests__/security.test.ts` — **19 tests, all passing**, with `vitest` configured for the backend.

```
 Test Files  1 passed (1)
      Tests  19 passed (19)
```

Coverage — each test locks in one audit finding so it cannot silently regress:

| Suite | Tests | Locks in |
|---|---:|---|
| Password policy | 7 | Rejects `password123`/`Student@123`; length, character classes, generated-password strength and uniqueness |
| Error taxonomy | 5 | Correct status per error class; Prisma code translation; no internal detail in public messages |
| No data fabrication | 4 | Source-level guard — fails if `cgpa: 8.5`, `'Ph.D in CSE'`, auto lesson plans, or runtime DDL return |
| No hardcoded secrets | 1 | Fails if the `JWT_SECRET` fallback returns |
| No leaky errors | 1 | Scans **all 18 route files** for `message: error.message` |

The source-level guards are deliberate: they are cheap, need no database, and catch the exact regressions that would be most damaging and least visible.

> Note: these strip comments before asserting, so the explanatory comments documenting what was removed do not trip the checks — otherwise a maintainer would be pushed to delete the documentation explaining the fix.

## Test pyramid (target)

```
        ╱  E2E (few)  ╲          critical workflows only
      ╱  Integration   ╲         API ↔ service ↔ DB
    ╱   Unit (many)     ╲        business rules, pure logic
   ╱  Static guards      ╲       ✅ implemented
```

## Next: T-213 — integration tests

Needs a disposable PostgreSQL (Docker or a CI service container).

```ts
// vitest.integration.config.ts — separate from unit tests
beforeAll(async () => {
  execSync('prisma migrate deploy');  // also validates migrations
  await seedMinimalFixtures();        // NOT the demo seed
});
beforeEach(async () => { await truncateAllTables(); });
```

**Security tests are the highest-value first target** — they protect the property the system already gets right (server-side RBAC), and they are mechanical: 17 roles × 18 modules.

| Scenario | Expected |
|---|---|
| Student A requests Student B's record | 403/404 |
| Faculty in Dept A modifies Dept B | 403 |
| Student calls an admin endpoint | 403 |
| Faculty publishes results unauthorised | 403 |
| Expired token | 401 |
| Token signed with wrong secret | 401 ✅ verified manually |
| Unauthenticated file download | 401 ✅ verified manually |

## Critical workflows requiring E2E (T-214)

Per audit rule 79 — none currently has any coverage:

| Workflow | Chain |
|---|---|
| **Admission** | Application → verification → approval → student record → enrollment |
| **Academic** | Enrollment → registration → attendance |
| **Examination** | Marks → verification → approval → publication → SGPA/CGPA |
| **Finance** | Invoice → payment → receipt → ledger |
| **Compliance** | Operational record → metric → evidence → report |

Each must be transactional and audited, so its test asserts **both** the business outcome and the audit row.

## Failure testing (T-215)

Success paths are the easy half. Per audit rule 80:

- network failure mid-transaction
- database unavailable
- duplicate submission (idempotency)
- concurrent update (two admins editing one student)
- concurrent attendance entry by multiple faculty
- concurrent marks processing
- repeated payment webhook
- invalid data at every layer
- unauthorised user on every endpoint

**Race conditions to test explicitly:** the `getOrCreate*` read-then-write race is gone with the functions, but seat allocation and result publication will introduce new ones.

## Frontend testing (T-216)

`@testing-library/react` is installed and unused. Priority:

1. `AuthContext` — 401 handling, session expiry, cross-tab logout *(new code, currently unverified in a browser)*
2. `api.ts` interceptors — token attach, 401 clear, error normalisation
3. Role-based navigation
4. Forms — validation and error display
5. Empty states — **now reachable**, since removing fabrication means components legitimately receive no data

## CI pipeline (T-020)

No CI exists. Nothing enforces typecheck, lint, tests, audit or build.

```yaml
install → lint → typecheck → unit tests → integration tests
  → npm audit → build → migration validation → artifact
```

Gates: typecheck must pass (backend is at **0 errors** — keep it there); unit tests must pass; no new critical/high vulnerabilities; migrations must apply cleanly to an empty database.

## Definition of Done

A feature is not complete without:

```
Unit tests (business rules) ✓
Integration test (API → DB) ✓
Authorization test (wrong role rejected) ✓
Failure test (invalid input, conflict) ✓
Audit assertion (mutation recorded) ✓
```

## Coverage targets

| Area | Now | Target |
|---|---:|---:|
| Security/regression guards | **19 tests** | maintain |
| Backend unit | ~0% | 70% of service layer |
| Backend integration | 0% | all critical workflows |
| Authorization | 0% (manual only) | **100% of role×module** |
| Frontend | 0% | 50% of shared components |
| E2E | 0% | 5 critical workflows |

Coverage percentage is not the goal — **untested critical workflows** are the risk. A 90%-covered codebase with no result-publication test is worse than a 40%-covered one that has it.

## Commands

```bash
cd backend && npm test
```

```bash
cd backend && npx tsc --noEmit
```
