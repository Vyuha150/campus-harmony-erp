# 16 — Remediation Plan (phase-wise)

**Written:** 2026-08-22
**Covers:** every item outstanding as measured on 2026-08-22, including work blocked
on external inputs.
**Supersedes:** the sequencing in `01_MASTER_IMPLEMENTATION_PLAN.md` for remaining
work. `13_BLUEPRINT_GAP_MAP.md` is **stale** and is corrected in Phase 0.

---

## How this plan is ordered

Not by size, and not by what is most visible. By one question:

> **What makes the next piece of work cheaper, and what makes it more expensive if
> done in the wrong order?**

Three sequencing decisions follow from that, and they are the substance of this plan:

**1. Schema surgery precedes the legacy migration.**
Converting 474 handlers means touching their queries. Changing date columns and
string-references-to-foreign-keys *also* means touching those queries. Doing the
handlers first means touching all of them twice.

**2. The workflow engine precedes the legacy migration.**
A substantial share of the 474 handlers implement ad-hoc approval steps inline —
`hod.ts` (70 handlers) and `dean.ts` (40) are largely approvals. Migrating them to
the service pattern and *then* introducing a workflow engine would rewrite them a
second time.

**3. The frontend must be runnable before six modules of UI are written.**
The application has never been opened in a browser. Writing screens for six
modules against an unverified shell is how you accumulate six modules of untested
UI.

**Two tracks run in parallel.** Backend debt (Phases 1–3) and frontend (Phases 0, 4)
touch different files and different skills. They are numbered for dependency, not
for staffing — a second person can run the frontend track concurrently from Phase 0.

---

## Estimating basis — read this before trusting any number

There is exactly **one** measured data point for migration cost: the library module
(T-203b, checkpoint 13).

| Measured | Value |
|---|---|
| Handlers migrated | 7 |
| Code produced | ~1,050 lines (service, routes, pure functions, tests) |
| Migrations required | 2 |
| Other files that turned out to be coupled | 1 (`students.ts`) |
| Defects found in the original 298 lines | 12 |

Every estimate below is derived from that one sample and is labelled with a
confidence. **Library was an expensive case** — it required schema surgery. Modules
whose tables already carry `institutionId` should be materially cheaper. Treat the
ranges as planning aids, not commitments, and re-baseline after Phase 3a.

---

## Phase 0 — Stop the bleeding

**Entry:** none. Start here.
**Confidence in estimate:** high — the work is fully understood.

| # | Item | Why now |
|---|---|---|
| 0.1 | **Fix the librarian screen** | A live regression I introduced. The return flow errors, dashboard tiles read 0, and the book list reads five dropped fields. |
| 0.2 | **Open the application in a browser** | It has never been run, in any session. Every frontend claim currently rests on reading code. |
| 0.3 | **Record what actually works** | Walk each existing screen; write down what loads, what errors, what is a dead button. This becomes the real frontend baseline. |
| 0.4 | **Clear the 22 TypeScript errors** | Mostly `unknown` types in `AdminUserManagement.tsx` and similar. They block a clean build. |
| 0.5 | **Correct `13_BLUEPRINT_GAP_MAP.md`** | It still marks OBE and curriculum as missing. A stale gap map causes wrong decisions. |

**Exit criteria — all verifiable:**
- Librarian screen: issue, renew and return all complete against the running API.
- A written per-screen inventory exists, produced from the browser, not from code.
- `npx tsc --noEmit -p tsconfig.app.json` → 0 errors.

**Risk:** 0.3 will almost certainly find more broken screens than the one known
regression. That is the point of doing it; budget for the findings.

---

## Phase 1 — Make the foundation safe to build on

**Entry:** Phase 0 complete.
**Confidence:** medium — 1.1 and 1.2 are invasive and their blast radius is only
partly known.

| # | Item | Detail |
|---|---|---|
| 1.1 | **`timestamptz` across the schema** | Every date column is `timestamp` without time zone. Prisma is self-consistent, so production is unaffected today — but any hand-written SQL or second tool writing local time is read back as UTC. This already produced a wrong test fixture (checkpoint 13). |
| 1.2 | **~40 string references → foreign keys** | T-105. Orphaned references are currently possible and undetectable. |
| 1.3 | **Status columns → enums** | T-107. Free-text status is how `'issued'` and `'Issued'` end up in the same column. |
| 1.4 | **Soft delete** | T-106. Institutional records should not be hard-deleted. |
| 1.5 | **Performance baseline** | Now possible: the bulk importer can load 20,000 students. Measure before optimising anything. |
| 1.6 | **Build the Docker image** | Needs Docker installed. Written but never executed. |
| 1.7 | **Off-host backup replication** | The restore drill was real; losing the host still loses the backups. |

**Sequencing within the phase:** 1.1–1.4 are one migration campaign. Do them
together, in one maintenance window, with a verified restore point taken first.

**Exit criteria:**
- Migration applies cleanly to a **copy of production-shaped data**, not just seed data.
- Restore from backup verified *after* the schema change.
- A recorded baseline: p50/p95 latency for the ten heaviest endpoints at realistic volume.
- `docker compose up` produces a serving container.

**Risk — the significant one in this plan.** 1.1 and 1.2 touch every table. If a
backfill is wrong, it is wrong everywhere. Mitigations: take the restore point
first; use the two-migration pattern proven in 0010/0011 and 0012/0013 (derive what
is unambiguous, halt loudly on the rest, let a human resolve, then enforce); never
guess an owner.

---

## Phase 2 — Workflow and approval engine

**Entry:** Phase 1 complete.
**Confidence:** low — this is design work, and the requirement is only partly known.

Before this can be built, the **actual approval flows must be catalogued** from
`hod.ts`, `dean.ts`, `registrar.ts` and `vc.ts`. That inventory is the first task,
not an assumption.

| # | Item |
|---|---|
| 2.1 | Catalogue every approval path currently hardcoded across the legacy routes |
| 2.2 | Model: definition, step, assignment rule, instance, transition, escalation |
| 2.3 | Engine with an audited transition log — a state change with no record is not an approval |
| 2.4 | Migrate 2–3 real flows onto it as proof, before depending on it |

**Exit criteria:** three real approval flows run on the engine end-to-end, each
transition audited, and an institution can change routing without code.

**Why this sits before Phase 3:** doing it after means rewriting the approval
handlers twice.

---

## Phase 3 — The 474 legacy handlers

**Entry:** Phases 1 and 2 complete.
**Confidence:** medium for 3a, low beyond it until 3a re-baselines the estimate.

474 handlers across 17 files. Ordered by **risk × traffic**, not by file size.

### 3a — Re-baseline (do this first, alone)
Migrate **`coe.ts` (8 handlers)** and **`grievances.ts` (14)**. Both are small, and
their tables already carry `institutionId`, so no schema surgery is needed. Measure
the real per-handler cost on a module *without* library's complications, then
re-estimate everything below.

### 3b — Highest risk first
| Order | File | Handlers | Why this order |
|---|---|---|---|
| 1 | `finance.ts` | 34 | Money. Payroll, journals and purchase orders are still legacy and untransacted. |
| 2 | `students.ts` | 32 | Largest personal-data surface; already partly touched in T-203b. |
| 3 | `admin.ts` | 24 | User and role management — the highest-privilege endpoints. |
| 4 | `registrar.ts` | 34 | Records of record. |
| 5 | `security.ts` | 35 | Incident and vigilance data, some confidential. |

### 3c — Highest volume
`hod.ts` (70), `faculty.ts` (44), `dean.ts` (40), `vc.ts` (33), `placements.ts` (33),
`sports.ts` (30), `alumni.ts` (20), `iqac.ts` (17).

**Per-module definition of done** — the same bar T-203b met:
- Service layer; no Prisma in route handlers
- zod validation with `.strict()`
- Mutations transactional, audited in the same transaction
- Pagination on every list
- Object-level authorisation where the answer depends on a path parameter
- Tests, plus live verification against a running server
- Every consumer updated — **the library migration proved a module is not
  self-contained just because it has its own route file**

**Exit criteria:** `src/routes/` contains only `auth.ts` and `uploads.ts`.

---

## Phase 4 — Frontend (parallel track, starts after Phase 0)

**Entry:** Phase 0 complete. Does **not** wait for Phases 1–3.
**Confidence:** low — no screen has yet been built for these APIs.

Ordered by who is blocked without it.

| Order | Module | Frontend files today | Who cannot work without it |
|---|---|---|---|
| 1 | **Bulk import** | 0 | Nobody can onboard an institution at all |
| 2 | **Admissions** | 0 | The admissions office |
| 3 | **Examinations** | 3 (partial) | Controller of Examinations |
| 4 | **Results** | 3 (partial) | Students and faculty |
| 5 | **Curriculum** | 0 | Academic planning |
| 6 | **OBE attainment** | 0 | NBA coordinator |
| 7 | **Notifications** | 0 | Anyone sending anything |

**Cross-cutting frontend work, not optional:**
- Empty states — a screen with no data must say so, not render a blank panel
- Error surfaces that show the API's actual message (the backend returns good ones; the UI currently discards them)
- Code-splitting — the bundle is ~2.1 MB unsplit
- One accessibility pass: focus states, labels, keyboard paths

**Exit criteria:** every rebuilt module reachable through the UI, verified in a
browser, with empty and error states shown.

---

## Phase 5 — Close the functional gaps

**Entry:** Phase 3a complete (the service pattern is proven and re-baselined).
**Confidence:** high for 5.1–5.2, low for 5.4–5.5.

| # | Item | Note |
|---|---|---|
| 5.1 | **Wire library fines to fee collection** | Both halves exist; they were never connected. Smallest item here, and a visible gap. |
| 5.2 | **Attainment snapshots** | Freeze a computed figure with its inputs and policy. Without this, a published attainment number changes when marks are corrected — unusable for a submission. |
| 5.3 | **Question-level OBE granularity** | Optional. Only if the institution tags COs per question. |
| 5.4 | **Timetable generation** | Clash detection exists per slot; there is no generator. This is a genuinely hard scheduling problem — scope it deliberately. |
| 5.5 | **Transport and payroll** | No models exist. Greenfield, on the service pattern from the start. |
| 5.6 | **Hostel and procurement services** | Tables exist; no rebuilt service behind them. |

---

## Phase 6 — Compliance (blocked; not schedulable)

**Entry:** the documents arrive. **This phase cannot be dated until then.**

The reporting layer beneath it is built and waiting — every figure already carries
its source tables and formula. What is missing is authoritative input.

| # | Unblocking action | Owner |
|---|---|---|
| 6.1 | Obtain the **official NAAC manual** for your institution's category | Institution |
| 6.2 | Obtain the **NIRF methodology + Data Capture Schedule** for the ranking year | Institution |
| 6.3 | Obtain the **UGC clause texts** relied upon | Institution |
| 6.4 | **DPDP review with counsel** — purpose limitation, consent, retention for caste/category and disability data (T-407) | Institution + counsel |

**This will not be built from secondary sources.** Building to a vendor blog's
description of the framework produces figures that cannot be defended to an
assessor, which is worse than having none. Until 6.4 concludes, the bulk importer
continues to refuse those columns, and Aadhaar outright.

**Once unblocked:** criterion-by-criterion mapping onto existing reports, evidence
attachment, and a submission-shaped export — sequenced after Phase 5.2, since a
submission needs frozen figures.

---

## Continuous — not a phase

These run throughout and are not "done" at any point:

- Tests written **with** each change, never after
- Audit coverage on every new mutation
- CI green before merge
- `IMPLEMENTATION_STATUS.md` checkpoint per session, recording what was **verified**, not what was written
- Dependency triage — **never run `npm audit fix --force`** on this repository; see `15_DEPENDENCY_TRIAGE.md`

---

## What would make this plan wrong

Stated plainly, so the assumptions are checkable:

1. **Phase 0.3 finds many more broken screens.** Likely. The library regression was
   found by the compiler; screens that fail at runtime would not be.
2. **The Phase 1 migration campaign hits data that cannot be backfilled
   automatically.** Already happened twice (0011, 0013). The two-migration pattern
   handles it, but it costs a human decision each time.
3. **Phase 2's requirement is larger than 2.1 suggests.** If the approval flows
   turn out to be genuinely heterogeneous, a generic engine may be the wrong
   answer and per-domain flows may be right.
4. **Phase 3 cost is derived from one sample.** 3a exists specifically to correct
   this. If 3a comes in far above estimate, re-plan 3b and 3c before proceeding.
5. **No performance data exists yet.** Phase 1.5 could surface a problem that
   reorders everything after it.
