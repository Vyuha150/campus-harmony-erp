# 14 — Remaining Work to a Production ERP

**Originally written 2026-08-19. Re-measured 2026-09-05.** Measured from the
repository, not estimated from memory.

---

## Where the system actually stands

| Measure | 2026-08-19 | 2026-09-05 |
|---|---|---|
| Database models | 120 | **159** |
| Migrations | 4 | **40** |
| Endpoints | 490 | **551** |
| Route files with request validation | 0 of 18 | **17 of 17** |
| Backend tests | 66 | **609** (25 files) |
| Backend typecheck | 0 errors | 0 errors |
| Frontend typecheck | not run | **0 errors, now blocking in CI** |
| Dependency vulnerabilities | 53 (1 critical) | **9 (0 critical)** |

The 2026-08-19 table said 479 of 490 endpoints ran on the legacy pattern with
no validation, transactions, audit or pagination. **Section B is substantially
closed**: every route file validates its request bodies, writes go through
`mutate()` with an audit record in the same transaction, and the tenant
extension scopes queries structurally.

Two guards now make the frontend/backend contract testable rather than
discovered in a browser:

- `payloadContract.test.ts` — every `postApi`/`putApi` payload key must be
  accepted by that route's `.strict()` schema. Roughly 25 features were broken
  by a single refused field before this existed.
- `routeExistence.test.ts` — every frontend API call must resolve to a
  registered backend route.

---

## A. Blocking production — nothing ships without these

| # | Item | 2026-08-19 | 2026-09-05 |
|---|---|---|---|
| A1 | Backups + tested restore | ❌ model only | ✅ `npm run backup` / `backup:verify`, exercised in CI |
| A2 | CI pipeline | ❌ nothing enforced | ✅ 6 gates: types, tests, migrations, audit, container, build |
| A3 | Dependency vulnerabilities | ❌ 53, 1 critical | 🔷 9, none critical — the rest need major-version bumps |
| A4 | Backend deployment target | ❌ none | 🔷 `backend/Dockerfile` + compose; **host still undecided** |
| A5 | Object storage for uploads | ❌ local disk | ✅ S3 client present |

**A4 is the one genuinely open item here, and it is a decision, not code.**

### A6 — Migration history could not rebuild the database *(found and fixed 2026-09-05)*

`prisma migrate deploy` against an empty database failed outright. Migrations
0026–0040 were named without the timestamp prefix every earlier migration used,
and Prisma orders lexicographically — so `0026` sorted before the baseline that
creates the tables it alters, and the replay died on
`relation "ApprovalItem" does not exist`. A fresh deploy and any
restore-from-migrations were both broken.

It survived because the only database in use was built with `db push`, and the
CI gate meant to catch it passed `--shadow-database-url`, which this Prisma
version does not accept — so the step errored on every run and
`continue-on-error: true` reported success anyway. **A gate that always fails
silently is worse than no gate: it is a false assurance.**

Both are fixed and the check is blocking. `migrate diff` reports
"No difference detected."

## B. Correctness debt on the 479 legacy endpoints

This is the largest body of work and the least visible.

| # | Item | Gap | Effort |
|---|---|---|---|
| B1 | **Migrate modules to the service pattern** (T-203b) | 18 files, smallest first (`library.ts` → `hod.ts`) | XL |
| B2 | **Validation** | 0 of 18 files validate input | L |
| B3 | **Transactions** | 4 uses across 479 endpoints; fees/marks/enrolment are not atomic | L |
| B4 | **Audit coverage** | 3 of 18 files; most mutations still untraceable | L |
| B5 | **Pagination** | ~9%; unbounded queries will exhaust memory at scale | M |
| B6 | **Object-level authz** (T-305) | Role grants module-wide access; users not bound to own records | L |
| B7 | **History tables** (T-104) | Grades/marks/fees still mutate with no before/after | M |
| B8 | **Foreign keys** (T-105) | ~40 reference columns still bare strings | L |
| B9 | **Soft delete** (T-106) | Deleting a user still destroys their academic history | M |

## C. Missing academic core — the ERP cannot yet do its central job

| # | Module | Status | Effort |
|---|---|---|---|
| C1 | **Grade-point + SGPA/CGPA engine** (T-403) | ❌ CGPA is a stored zero. **Correct, but not computed** | L |
| C2 | **Curriculum / syllabus / electives** | ❌ `Programme` exists; no scheme, basket, or prerequisites | L |
| C3 | **Examination lifecycle** | ❌ Registration → hall ticket → marks → moderation → result → transcript | XL |
| C4 | **OBE (CO/PO/PSO + attainment)** | ❌ No models. Required for NBA | L |
| C5 | **Transcripts & degree issuance** | ❌ Depends on C1 | M |
| C6 | **Attendance eligibility rules** | 🔷 Recording works; no thresholds or alerts | M |

> **C1 gates C3, C5, NIRF `GO`, and ABC credit transfer.** It is the highest-value item after section A.

## D. Missing operational modules

| # | Module | Status | Effort |
|---|---|---|---|
| D1 | **Notification delivery** | ⚠️ Stores messages, **sends nothing**. No email/SMS/push | L |
| D2 | **Fee payment gateway + receipts** | ❌ No integration, no reconciliation | L |
| D3 | **Bulk import/export** | ❌ No institution can onboard legacy data | L |
| D4 | **Reporting layer + export** | ❌ No Excel/CSV/PDF anywhere | L |
| D5 | **Workflow/approval engine** | ❌ Approval logic will be rebuilt per module without it | M |
| D6 | **Committee/policy endpoints** | 🔷 Models exist (migration 0003); no API or UI | M |
| D7 | **Research depth** | ❌ No citations, patents, consultancy, PhD scholars — NIRF `RP` inputs | M |
| D8 | **Scholarships, transport, clubs** | ❌ | M |
| D9 | **Library multi-copy** | ⚠️ `LibraryBook` conflates title and copy | S |

## E. Compliance — blocked on inputs, not on code

| # | Item | Blocker |
|---|---|---|
| E1 | **Official NAAC / NIRF / UGC documents** | ❌ **Not obtained.** Every framework detail remains `NOT VERIFIED` |
| E2 | Metric engine (formula, numerator, provenance) | Needs E1 + the reporting layer (D4) |
| E3 | Demographics collection | ⚠️ Columns exist; **gated on DPDP legal review** |
| E4 | AQAR / SSR / NIRF DCS export | Needs E1, E2, D4 |
| E5 | Multi-year snapshots | Needs history tables (B7) |

> Building a compliance engine before E1 means building to a vendor blog's description of the framework. Don't.

## F. Scale and "self-load balancing" — stated precisely

Auto-scaling is **infrastructure configuration**, not application code. But the application currently has **three specific defects that prevent horizontal scaling from working at all**:

| # | Blocker | Why it breaks multi-instance | Fix |
|---|---|---|---|
| F1 | **Rate limiter is in-process** | Each instance keeps its own counters, so N instances = N× the intended limit. *Observed live this session: restarting the server cleared a lockout* | Move to Redis |
| F2 | **Uploads on local disk** | Instance A cannot serve a file uploaded to instance B | Object storage (A5) |
| F3 | **No job queue** | Reports/notifications run in-request; a long report holds a connection and can time out | BullMQ + worker process |

Once those three are fixed, the app is genuinely stateless and standard autoscaling applies:

```
Load balancer → N stateless app instances (health/readiness already implemented ✅)
                       ↓
        PostgreSQL (primary + read replicas when measurement justifies)
        Redis (rate limiting, cache, queue)
        Object storage (uploads)
```

**Then, and only then**, tune from measurement: pagination and indexes first (they will deliver more than any infrastructure addition at current scale), caching only where profiling justifies it.

> ⚠️ **No performance measurement has ever been taken on this system.** Every scalability statement in this repository is structural inference. Load testing is itself outstanding work.

---

## Recommended order

Dependency-driven, not preference:

| Phase | Work | Duration |
|---|---|---|
| **1** | **A1–A5** — backups, CI, vulns, deploy target, object storage | 3–4 weeks |
| **2** | **C1** SGPA/CGPA engine + **B7** history tables | 4–5 weeks |
| **3** | **B1–B5** migrate legacy modules (validation, transactions, audit, pagination arrive with each) | 8–10 weeks |
| **4** | **C2, C3** curriculum + examination lifecycle | 10–12 weeks |
| **5** | **D1–D5** notification, payments, import/export, reporting, workflow | 8–10 weeks |
| **6** | **F1–F3** scale enablers, then load test and tune | 3–4 weeks |
| **7** | **C4** OBE + **E1–E5** compliance engine | 10–12 weeks |

**Roughly 10–12 months** with a small focused team.

### Why this order

- Phase 1 first because **nothing else matters if data cannot be recovered**.
- Phase 2 before 3 because CGPA is the value everything academic depends on, and history tables must exist before more code starts mutating records.
- Phase 3 before 4 because building examinations on the legacy pattern would add ~50 more unvalidated, untransacted endpoints.
- Phase 6 before 7 because compliance reporting is the heaviest read workload, and it should run on a system that scales.

### What can run in parallel at any time

Frontend empty states (fabrication removal made them reachable), the remaining 22 frontend type errors, browser verification of the 401 interceptor, and D6/D9 — none of these gate anything else.

---

## Honest summary

**Fixed:** the defects that made the system dangerous — fabricated records, absent audit trail, no migrations, hardcoded secret, public file access, no tenant isolation.

**Proven:** multi-tenancy, and one module (admissions) demonstrating the full target architecture with transactions, validation, audit and quota enforcement.

**Outstanding:** 479 endpoints on the legacy pattern, the entire academic core (CGPA, curriculum, examinations), five operational modules, and every production-operations capability.

**The system is currently a sound foundation with one complete module — not a production ERP.**
