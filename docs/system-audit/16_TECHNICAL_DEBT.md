# 16 — Technical Debt & Architectural Inconsistencies

Prioritised by the brief's ordering: **correctness → security → data integrity → reliability → scalability → maintainability.** Cosmetic refactoring is explicitly deferred.

---

## Tier 1 — Debt that corrupts data (fix first)

### T1.1 — "Get or create" as a read pattern

The most consequential design decision in the codebase. `getOrCreateStudentProfile`, `getOrCreateFacultyProfile`, `getOrCreateFacultyClasses`, `getOrCreateStudentClassEnrollments` and `ensureFacultyLessonPlanTable` all **mutate state during GET requests**, inventing data when none exists.

**Root cause:** the pattern was almost certainly introduced to stop dashboards rendering empty during development. It is an excellent solution to a demo problem and a catastrophic one for a system of record.

**Systemic consequence:** the codebase has **no concept of a legitimate empty state**. Every module assumes data exists because the backend guarantees it by fabrication. Removing the fabrication (Phase 0) will expose empty UIs across the system — **that exposure is the point**, and those gaps must then be filled with real workflows (admissions, HR onboarding), not by restoring the fabrication.

### T1.2 — Type checking deliberately disabled

`const db: any = prisma` (`faculty.ts:8`, `students.ts:8`, and elsewhere) makes every call through `db.*` invisible to the compiler.

This is why only 36 type errors surface across 12,108 lines — the compiler cannot see most of the data access. It also explains why the type errors that *do* surface (`dean.ts:786-790`, `students.ts:107-109`, `finance.ts:613-616`) are real crash candidates: they are the few places the compiler could still see.

Mirrored on the frontend, where untyped API responses arrive as `unknown` and produce 18 of the 22 frontend errors. **There are no shared types between frontend and backend** — the schema is the only contract and it isn't propagated.

### T1.3 — Schema drift by design

`FacultyLessonPlan` exists in the database but not in `schema.prisma`. Combined with zero migrations, the declared schema and the real schema are permanently divergent with no reconciliation mechanism.

## Tier 2 — Debt that blocks safe change

### T2.1 — No service layer

Business logic lives in route handlers. `hod.ts` is 1,882 lines; `faculty.ts` 1,532; `students.ts` 1,274; `dean.ts` 1,209.

This single omission is what makes every other fix expensive:

| Cross-cutting concern | Places to change today | With a service layer |
|---|---:|---|
| Input validation | 478 | ~18 |
| Transactions | 478 | Per operation |
| Audit logging | 478 | 1 (in the service base) |
| Error handling | 478 | 1 |
| Authorization (object-level) | 478 | Per service |

**Extracting the service layer should precede the validation, transaction and audit work** — otherwise each is paid for 478 times.

### T2.2 — No migrations

Covered in `05_DATABASE_AUDIT.md` D1. Listed here because it is *change-blocking* debt: no schema improvement in this document can be safely applied until a baseline migration exists. It is the gate on Tier 1 and Tier 3 database work alike.

The debt is already visible in the codebase: `seed.ts:1493-1511` carries commented-out seed blocks labelled *"uncomment after running migrations"* — the authors hit this wall and worked around it rather than resolving it.

### T2.3 — Duplicated logic across role modules

Each role module re-implements dashboard aggregation, list filtering and status handling. There is no shared query layer. Grievance status mapping is the counter-example — `lib/grievanceStatus.ts` correctly centralises role-specific status translation. **That pattern should be generalised**, not left as the only instance.

Frontend equivalent: accreditation UIs are re-implemented per role (`HODAccreditation`, `DeanAccreditation`, `RegistrarAccreditation`, `IQACCriteria`) rather than one component parameterised by scope.

### T2.4 — Configuration hardcoded

| Value | Location | Should be |
|---|---|---|
| CORS origin | `server.ts:35` | Env var |
| Port (3 conflicting assumptions) | `server.ts:72`, `ecosystem.config.cjs`, `server.ts:35` | Single env var |
| Role→module permissions | `server.ts:47-64` | Data (`ModuleConfig.roles` exists, unused) |
| JWT secret fallback | `middleware/auth.ts:4` | **Removed entirely** |
| Default passwords | `admin.ts:70`, `placements.ts:157` | **Removed entirely** |
| Upload size limit | `uploads.ts:34` | Env var |

`ModuleConfig.roles` is the clearest instance of half-finished work: the data model for configurable permissions exists and is seeded, but `authorizeRoles` never consults it.

## Tier 3 — Debt that limits correctness

### T3.1 — Domain state as free-text strings

No Prisma `enum` in 1,554 lines. Every status is an unconstrained `String` with allowed values in a trailing comment. With no validation layer, any string persists — including typos and states no code path handles.

State machines exist only as convention. `GrievanceCase.status` moves through `received → under_investigation → resolved`, but nothing prevents a jump from `received` to `closed`, or an invalid value entirely.

### T3.2 — Referential integrity as convention

~40 reference fields are bare `String`. `DisciplinaryCase.rollNumber` and `DegreeRecord.rollNo` denormalise identity as free text — **a student's disciplinary record and degree certificate are not reliably joinable to the student.**

### T3.3 — Structured data in untyped JSON

~30 models use `Json` for structured content. Unvalidatable, unindexable, unqueryable in a typed way. Directly obstructs the compliance reporting the product intends.

### T3.4 — Error handling uniform but incorrect

Every handler collapses all failures into 500 with the raw message. Missing record → 500 not 404. Constraint violation → 500 not 409. Clients cannot distinguish retryable from permanent failures, and internal details leak.

## Tier 4 — Maintainability (defer)

Genuine debt, but **do not spend effort here before Tiers 1–3**.

| Item | Detail |
|---|---|
| Dead code | `src/data/studentMockData.ts`, `src/lib/dataStore.ts` — 0 importers |
| Duplicate lockfiles | `package-lock.json`, `bun.lock`, `bun.lockb` — ambiguous installs |
| Duplicate PM2 configs | `ecosystem.config.cjs` + `.js` |
| Missing LICENSE | README claims MIT and links a non-existent file |
| Inaccurate README | Instructs `ts-node` and port 3000; actual `tsx`/8080 |
| Committed tool output | `testsprite_exec_log.txt` |
| Possibly superseded models | `Facility`, `Team`, `QualityMetric`, `IncidentReport` — **trace before removing** |
| Frontend duplicate keys | `DashboardLayout.tsx:72,84,87,106` — actually a correctness bug, promote to Tier 3 |

## Dependency debt

| Concern | Detail |
|---|---|
| Vulnerabilities | 53 total (frontend 32 incl. 1 critical; backend 21) |
| Unused frontend deps | Likely — 644 packages for 133 components. Not audited (`depcheck` not run) |
| Build-path third-party tooling | `lovable-tagger`, `@testsprite/testsprite-mcp` — supply-chain review warranted |
| Version currency | Express 5.2, Prisma 7.5, React 18.3 — current; **no upgrade debt.** ✅ |
| `zod` asymmetry | Present in frontend, **absent from backend** — validation exists where it provides no security value |

**Do not bulk-upgrade.** Triage critical/high vulnerabilities with compatibility testing, per the brief.

## What is *not* debt

Worth stating explicitly so remediation doesn't churn code that is already correct:

- **Server-side RBAC** — consistent, correct, `.includes()` throughout. Preserve through any refactor.
- **Parameterised raw SQL** — no injection anywhere.
- **Upload path sanitisation** — `sanitizeModule()` is correct.
- **Seed idempotency** — `upsert` with stable IDs plus a schema preflight; careful work.
- **Graceful shutdown** — `server.ts:90-115` handles SIGINT/SIGTERM properly.
- **Frontend API centralisation** — one axios instance, 91% adoption.
- **`DATABASE_URL` fail-fast** — `lib/prisma.ts:8-10` is exactly the pattern `JWT_SECRET` should copy.
- **Consistent design system** — shadcn/Radix throughout.
- **No fake AI** — nothing is falsely labelled AI.
- **Modern, current dependency versions.**

## Paydown sequence

1. **Delete fabrication** (T1.1) — correctness, and it precedes everything.
2. **Baseline migration** (T2.2) — gates all schema work.
3. **Extract service layer** (T2.1) — makes validation/transactions/audit cost 18× less.
4. **Add validation + transactions + audit** in the service layer.
5. **Foreign keys and enums** (T3.1, T3.2) — needs migrations.
6. **Restore type safety** (T1.2) — remove `any`, generate shared types.
7. **Externalise configuration** (T2.4).
8. **Error taxonomy** (T3.4).
9. **Deduplicate role logic** (T2.3).
10. **Cosmetic cleanup** (Tier 4) — last.

**The single highest-leverage item is #3.** Nearly every remaining fix is cheap with a service layer and prohibitively expensive without one.
