# 14 — Remaining Work to a Production ERP

**Originally written 2026-08-19. Re-measured 2026-09-05, and again 2026-09-11.**
Measured from the repository, not estimated from memory.

> **Read section C first if you are picking this up.** The 2026-09-11 pass found
> that its central claim — that the academic core did not exist — was wrong, and
> that changes what the remaining work actually is.

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
| A3 | Dependency vulnerabilities | ❌ 53, 1 critical | ✅ **1 low.** mysql2 and deepmerge-ts pinned to patched versions via npm overrides (2026-09-11); only a dev-server-only esbuild advisory remains |
| A4 | Backend deployment target | ❌ none | ✅ `backend/Dockerfile` + `render.yaml` blueprint (Postgres, API with a persistent uploads disk, static frontend) |
| A5 | Object storage for uploads | ❌ local disk | ✅ S3 client present |

**A4 is resolved:** Render was chosen, and `render.yaml` provisions all three
services. Read the comment block in it before changing the cross-service URLs:
Render's `fromService` exposes only PRIVATE-network addresses, so wiring
`CORS_ORIGINS` and `VITE_API_BASE_URL` that way deploys two services that both
come up healthy and cannot reach each other.

### A3 — closed 2026-09-11

Down to **one low-severity advisory**. The 2026-09-05 triage below concluded
none of the nine were reachable, which was true — but "not reachable" is a
judgement that has to be re-made every time the dependency tree moves, and a
permanently non-empty audit is one people stop reading.

`mysql2` and `deepmerge-ts` are now pinned to patched versions
(3.24.4 and 8.0.2) with npm `overrides`. There is no Prisma release that fixes
them — 7.10.0 is the latest stable, 8.x is release-candidate only, and
`npm audit fix --force` proposes a *downgrade* to 6.19.3. `@prisma/client` was
also realigned to 7.10.0, having drifted to 7.5.0 behind its own CLI.

`deepmerge-ts` 8 is a major bump of a library Prisma's config loader uses, so
it was verified rather than assumed: generate, `migrate status`, seed, the full
test suite, the CGPA chain check, and a live server boot all pass on the
overridden tree.

**What remains:** `esbuild`, arbitrary file read *via the esbuild dev server*
on Windows. `tsx` does not start one and production serves a built image on
Linux. It stays.

The original triage, kept because the reasoning is still the right method:

| Package | Path | Reachable here? |
|---|---|---|
| `mysql2` | `prisma` CLI | **No** — bundled per provider; this deployment is PostgreSQL. *Pinned anyway.* |
| `deepmerge-ts` | `prisma` → `@prisma/config` | **No** — CLI config loading. The runtime package is `@prisma/client`. *Pinned anyway.* |
| `esbuild` (backend) | `tsx`, `vitest` | **No.** The advisory is arbitrary file read *when running the esbuild development server*. `tsx` does not start one |
| `esbuild` (frontend) | `vite`, `lovable-tagger` | **No.** Same advisory. Production serves the static `dist/` build; the Vite dev server is not deployed |
| `react-router` SSR hydration | `react-router-dom` | **No.** `deserializeErrors()` is an SSR-hydration path; this is a client-only SPA with no SSR |
| `react-router` open redirect | `react-router-dom` | **No, but check this if navigation changes.** See below |

**The open redirect is the only one worth re-checking on any change.** It needs
attacker-controlled input to reach `<Link to>` or `navigate()`. There are no
dynamic `navigate()` targets at all, and only two dynamic `<Link to>`:
`MODULE_LINKS` in `pages/Dashboard.tsx` (string literals), and the breadcrumb in
`DashboardLayout.tsx`, which links only *ancestor prefixes* of the current path
— the final segment, the only one an attacker controls, is rendered as
`<BreadcrumbPage>` text rather than a link.

**It becomes exploitable the moment anything passes user input to `navigate()`
or `<Link to>`.** At that point take the `react-router-dom` 7.x upgrade rather
than reasoning about it again.

CI blocks on `critical` rather than `high` for this reason: every remaining item
needs a breaking upgrade nobody can act on today, and a permanently red gate is
one people learn to ignore.

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

## B. Correctness debt on the legacy endpoints

Re-measured 2026-09-05. This was the largest section; it is substantially closed.

| # | Item | 2026-08-19 | 2026-09-05 |
|---|---|---|---|
| B1 | Migrate modules to the service pattern | ❌ 0 of 18 | ✅ all route files use services/`mutate()` |
| B2 | Validation | ❌ 0 of 18 files | ✅ 17 of 17 files; `.strict()` schemas throughout |
| B3 | Transactions | ❌ 4 uses | ✅ `mutate()` writes change + audit in one transaction |
| B4 | Audit coverage | ❌ 3 of 18 | ✅ service writes audited; extension catches the rest |
| B5 | Pagination | ❌ ~9% | ✅ **structurally capped** — see below |
| B6 | Object-level authz | ❌ | 🔷 tenant + campus scoping structural; per-record ownership still per-route |
| B7 | History tables | ❌ | ✅ `GradeHistory`, audit `oldValue`/`newValue` |
| B8 | Foreign keys | ❌ ~40 bare strings | ✅ migrations 0018/0019 + the four declared 2026-09-05 |
| B9 | Soft delete | ❌ | ✅ `deletedAt` + structural filtering on evidence-bearing models |

**B5 deserves the detail.** 260 `findMany` calls still specify no page size, but
they are not unbounded: the tenant extension caps any unpaginated read at
`UNPAGINATED_ROW_CAP = 1000`, reads one row past it, and **throws rather than
truncating** — because a silently truncated read turns a correct attainment
percentage or fee total into a plausible wrong one. `unbounded("<reason>")` is
the explicit, greppable escape hatch. The memory ceiling holds without any
figure ever being quietly wrong.

## C. Academic core — re-measured 2026-09-11, and the earlier reading was wrong

**This section previously said the academic core did not exist. That was
wrong, and the correction matters more than any single item in it.**

The modules exist, are well built, and are mounted. `modules/examination`
covers session → schedule → eligibility (computed from real attendance and fee
records) → registration → hall ticket → marks → moderation gate → publication →
revaluation-as-new-attempt. `modules/results` has versioned `GradeScale`/
`GradeBand`, credit-weighted SGPA/CGPA, transcripts and grade history.
`modules/curriculum` has schemes, elective baskets, prerequisites checked
against real results, and degree progress. `modules/obe` is 1,392 lines of
CO/PO attainment.

The earlier "❌" was measured from the product surface, where none of it was
reachable — which was true, and is the real defect, but it is a wiring problem,
not a missing-module problem. Rebuilding any of this would have been waste.

| # | Module | Status 2026-09-11 |
|---|---|---|
| C1 | **SGPA/CGPA engine** | ✅ **Closed.** Existed and was correct; nothing called it. Publication and revaluation now recompute in the same transaction, the seed ships a grading scale (without one every marks path threw), and CI fails if publication stops recomputing |
| C2 | **Curriculum / electives** | 🔷 Engine real and complete; still no UI reaches it — the one genuinely unbridged module |
| C3 | **Examination lifecycle** | ✅ **Bridged.** Student schedule, hall tickets and revaluation served from the engine; CoE/Registrar oversight derives its figures from it |
| C4 | **OBE (CO/PO/PSO)** | 🔷 Engine real; zero frontend calls |
| C5 | **Transcripts** | ✅ **Bridged.** Published results only, with grade/points/credits and per-semester SGPA/CGPA; provisional and labelled so when nothing is published. The download previously printed course code, name and date per row — no grade, no CGPA anywhere on it |
| C6 | **Attendance eligibility** | ✅ Enforced by `checkEligibility` against real attendance |

### C7 — the redundancy, and what was done about it *(2026-09-11)*

Five systems overlapped. Each is now either bridged onto the engine or
understood as complementary, using the `workflow/bridge.ts` strangler pattern
rather than a cutover:

| # | System | Status |
|---|---|---|
| 1 | **The engine** — `ExamSession`, `CourseResult`, `CurriculumScheme` | Source of truth. Feeds student results, CGPA, exam schedule and hall tickets |
| 2 | Faculty internal marks — `Enrollment` | ✅ **Bridged** (0043). Internal marks got a numeric column and the exam cell inherits them instead of re-typing |
| 3 | Student exam view — `Examination` | ✅ **Bridged.** Engine served when the student is registered; legacy table when not |
| 4 | CoE/Registrar oversight — `ExamProgress` | ✅ **Bridged** (0044). Figures derived from a linked session; stored values kept when none |
| 5 | Curriculum approvals — `CurriculumProposal` | Complementary, not duplicate. An approval workflow, not a scheme |

**Nothing was deleted, deliberately.** Each legacy path stays as the fallback
for an institution that has not adopted the session workflow, which is where
every institution starts. The engine wins the moment there is engine data to
serve; until then the old path answers, and the screen never goes blank.

**Retiring 3 and 4 outright remains a migration, not a refactor** — adopt the
session workflow for a cohort, migrate that cohort's data, confirm the engine
is answering, then drop the tables. The bridges above mean that can happen per
institution, without a coordinated release.

**Found while bridging the transcript, and fixed:** the CGPA recompute had no
status filter. A submitted-but-unmoderated F pulled a live student from 9.00 to
5.14 and manufactured a semester row with SGPA 0. A CGPA moves when a result is
published, not before; the recompute now reads published and revalued results
only, and the CI guard tests that as a second property.

**The seed now walks the engine path.** A fresh database comes up with a
session, an eligible registration, an issued hall ticket with a seat
allocation, a published result and a CGPA of 9.00 computed by the real
recompute. That was the missing feedback loop: the module sat dormant in every
fresh database, so nothing exercised it, so nothing revealed it already
worked — which is most of why this document called it unbuilt.

> The browser also carried a **sixth** grading implementation — its own
> hardcoded scale disagreeing with the institution's, so 85 marks showed a
> student "A" while the record said "A+", plus an invented internal/external
> split (`total × 0.4`, `total × 0.6`). Removed 2026-09-11.

## D. Missing operational modules

Re-measured 2026-09-11.

| # | Module | Status | Effort |
|---|---|---|---|
| D1 | **Notification delivery** | ✅ **Closed.** Real SMTP (`EmailProvider`) and Twilio (`SmsProvider`); both activate on credentials and fail loudly otherwise. Self-service password reset built on it | — |
| D2 | **Fee payment gateway** | ✅ **Closed.** Razorpay order + signature-verified webhook, idempotent against retries, reconciled into the existing ledger. Needs merchant keys | — |
| D3 | **Bulk import/export** | ✅ Was already real — students, faculty, courses, tested. The earlier ❌ was stale | — |
| D4 | **Reporting layer** | 🔷 CSV/JSON real and honest about refusing xlsx/pdf; HOD exports now real too | S |
| D5 | **Workflow/approval engine** | ✅ Real — `workflow.service` + the `bridge.ts` strangler | — |
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

## F. Scale — stated precisely

| # | Blocker | 2026-09-05 |
|---|---|---|
| F1 | Rate limiter is in-process | ✅ **closed 2026-09-05.** Login counters moved to a shared PostgreSQL store (migration 0041). Verified by reproducing the original defect: lockout now survives a full backend restart with the window intact. Broad API limiter stays in-process by design — see `rateLimitStore.ts` |
| F2 | Uploads on local disk | ✅ S3 client present |
| F3 | No job queue | ❌ still open — reports and notifications run in-request |

F3 needs a worker process and a broker that are not available in this
environment, so it has not been attempted: an integration that cannot be
exercised cannot honestly be called done.

F1 was closed without Redis. The requirement is a store shared by every
instance, and PostgreSQL — already a hard dependency — satisfies it and can be
verified here. `RateLimitStore` is the seam if Redis is preferred later.

### Load testing — first measurements taken 2026-09-10

The line that stood here — *"no performance measurement has ever been taken on
this system"* — is no longer true. `backend/scripts/loadtest.mjs` is the
harness; run it with `LOADTEST_PASSWORD` set and the rate limiter raised.

**Read the ratios, not the absolute numbers.** Repeated runs of an identical
configuration varied by up to 3x with nothing changed but ambient CPU load on
the test machine, which idles at ~42% utilisation. The ratios between
endpoints, however, held almost exactly across those runs:

| | health (no DB) | authed tenant read | login |
|---|---|---|---|
| run 1 | 2321 req/s | 194 req/s | 44.3 req/s |
| run 2 | 830 req/s | 74 req/s | 15.0 req/s |
| **ratio** | **1** | **~0.086** | **~0.019** |

So: **an authenticated tenant-scoped read costs ~11x a bare health check, and
a login costs ~55x one.** Those multiples are the transferable result.

**Login is the bottleneck, and the mechanism is confirmed rather than guessed.**
`bcrypt.compare` at work factor 10 measures **90.1 ms of pure CPU** per call.
libuv's default thread pool is 4, so the predicted ceiling was
`4 / 0.090 = 44.4` logins/sec — against 44.3 measured on the first run. The
prediction and the measurement agree to within 0.1 req/sec.

Since bcrypt is **CPU-bound, not I/O-bound**, raising `UV_THREADPOOL_SIZE`
does *not* fix this: tested at 8 threads, throughput got worse, not better.
**No threadpool tuning has been baked into the Dockerfile** — the theory that
it would help did not survive being measured.

Project real capacity from the cost model instead:

> **login ceiling ≈ (vCPUs × 1000 ms) / 90 ms per login**

which on **Render's 0.5-vCPU starter instance is roughly 5–6 logins/sec**.
That is the number that matters for a deployment decision: a campus-wide
Monday-morning or results-day login surge would queue badly. Mitigations, in
order of cost: more vCPU, a login-specific instance, or session cookies that
avoid re-running bcrypt on every request.

**Also found:** `resolveTenantContext` performs one `User.findUnique` on
**every authenticated request** ([tenantContext.ts:52](../../backend/src/middleware/tenantContext.ts)).
That is a deliberate trade — the role is read from the database so a demoted
user loses access immediately rather than in 24 hours — but it is a per-request
round trip, and it is a large part of the 11x multiple above. Worth revisiting
with a short-TTL cache only if measurements on real hardware justify it.

> ⚠️ Still not measured: sustained soak behaviour, memory growth over time,
> connection-pool exhaustion under sustained concurrency, and anything at all
> on production-class hardware. These numbers come from one developer laptop.

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

## Honest summary — rewritten 2026-09-11

**Fixed:** the defects that made the system dangerous — fabricated records, absent audit trail, no migrations, hardcoded secret, public file access, no tenant isolation.

**Closed since 2026-09-10:** notification delivery (real SMTP and SMS), self-service password reset, online fee payment (Razorpay, webhook-verified and idempotent), error monitoring, the first load test ever run here, the high-severity dependency advisories, eight fabricated `hod.ts` endpoints that returned success and did nothing — and **CGPA**.

**The lesson from this round is worth more than the list.** Almost nothing found in it was a missing feature. The academic core was *built* — examination lifecycle, grading scales, credit-weighted CGPA, curriculum, OBE — and this document previously recorded all of it as absent, because it was measured from the product surface where none of it was reachable. The CGPA bug was not a broken calculation; the calculation was correct and unit-tested throughout. Nothing called it.

That is the shape of the remaining risk: **correct parts that are not connected**, and unit tests that pass while the connection is missing. The guards added for it — `verify-results-chain.ts` in CI, `payloadContract.test.ts`, `routeExistence.test.ts`, the tenant mount guard — all test *wiring* rather than units, because that is where this codebase actually fails.

**Outstanding:** the five-way overlap in C7 (a migration and a workflow-adoption decision, not a refactor), the legacy endpoint pattern, compliance (blocked on official NAAC/NIRF documents — cannot be honestly built without them), F3's job queue, research/scholarship modules, and load testing on production-class hardware.

**No longer true: "a sound foundation with one complete module."** The foundation is sound, several modules are complete, and the dominant problem is now integration rather than absence. It is not yet a production ERP for a full-scale rollout, but the distance is smaller than this document has been claiming.
