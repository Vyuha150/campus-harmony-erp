# 20 — Phase 3 Baseline: what migrating a handler actually costs

**Produced:** 2026-08-23, by migrating the examination schedule end to end and
measuring it. Nothing here is estimated from handler counts.

---

## Why this document exists

Phase 3 is "migrate the remaining legacy handlers to the service pattern". Before
committing to that, the plan called for a re-baseline: migrate a real slice,
measure it, and let the measurement set expectations instead of a guess.

The slice chosen was the examination schedule — 5 handlers across two route
files. It was picked because it is small, it is written twice (`coe.ts` and
`registrar.ts` carry the same code), and it turned out to contain a live
cross-tenant defect, which makes it representative rather than convenient.

---

## What the slice contained

`ExamProgress` had **no `institutionId`** and was absent from
`TENANT_OWNED_MODELS`. The examination schedule was shared across every
institution in the deployment. Two handlers made it writable:

```ts
// routes/coe.ts  AND  routes/registrar.ts — the identical line
prisma.examProgress.update({ where: { id }, data: req.body })
```

Two distinct defects in one line, both already seen in this codebase:

| # | Defect | Consequence |
|---|---|---|
| 1 | Update by **unique key** | The tenant extension can constrain a `where` clause but cannot filter a unique-key update. Knowing an id was enough to write another institution's exam. This is what made the pre-0022 approval routes exploitable. |
| 2 | `data: req.body` | Unrestricted mass assignment. Every column writable, including `marksEntered`, `resultsPublished` and `status` — so an exam could be marked published with no marks entered. |

Plus two more found while reading it:

- `DELETE /coe/exams/:id` — hard delete, unscoped, nothing audited.
- `GET /coe/exams` — **fabricated figures**. It ignored the stored
  `totalStudents` and inferred it from StudentProfile counts, falling through
  three guesses to "every student profile in the system", so an exam for one
  programme could report the whole university as its cohort. It then forced
  `marksEntered = totalStudents` for anything published — a progress bar that
  always reads complete at the end regardless of what was entered.

**Demonstrated live, before the fix**, against a planted rival-institution row:

```
CoE of Default Institution → GET /api/coe/exams
  RIVAL CONFIDENTIAL EXAM   ← visible

CoE of Default Institution → PUT /api/coe/exams/rival-exam-probe
  {"examName":"HIJACKED BY ANOTHER INSTITUTION"}
  → {"success":true, "institutionId":"1111...", "examName":"HIJACKED BY ANOTHER INSTITUTION"}
```

---

## The measured cost

| Artefact | Size |
|---|---|
| Migration `0027_exam_progress_tenant_scope` | 84 lines |
| `modules/coe/exams.schema.ts` | 67 lines |
| `modules/coe/exams.service.ts` | 249 lines |
| Rewired routes (`coe.ts` ×4, `registrar.ts` ×1) | ~90 lines |
| `__tests__/serviceScoping.test.ts` | 262 lines |
| `scripts/verify/verify-3a-exam-schedule.sh` | 13 live checks |
| **Handlers migrated** | **5** |

**Roughly 120 lines of production code per handler**, plus a migration, plus
tests, plus a live run. That figure only holds where handlers share a model — the
5 here needed one migration and one service between them. A file of 14 unrelated
handlers will cost proportionally more.

### The part that is not linear

Two of the four defects were found by *reading* the code, and one — the
fabricated figures — could not have been found any other way. It produced
plausible-looking numbers; no test failed, no error surfaced, and the screen
looked correct. That reading time does not shrink with practice, and it is the
reason a per-handler figure understates the work.

---

## What the migration exposed (the more important result)

### 1. The service layer does NOT get automatic tenant scoping

This was the significant find, and it was found by getting it wrong.

Automatic scoping comes from the Prisma extension, which wraps `prisma`. But:

- every service imports **`basePrisma`**, the unscoped client;
- `mutate()` opens its transaction on `basePrisma`, so the `tx` passed to every
  service operation is unscoped too.

Inside a service, tenant safety is therefore **not structural**. It depends on
the author writing `institutionId: context.institutionId` into every `where`.
Nothing in the type system notices when they don't.

The first version of `exams.service.ts` used `basePrisma` without those filters,
copying the *import* pattern from `library.service.ts` without its *where-clause*
pattern. Live verification then showed a rival institution's exam being listed
and successfully renamed — the same authority breach as the pre-0022 approvals
routes, reintroduced **through the service layer that exists to prevent it**.

The unit suite was fully green while this was true. Only the live cross-tenant
probe caught it.

`__tests__/serviceScoping.test.ts` now fails the build if any service queries a
tenant-owned model by id without a tenant filter, with negative controls for both
false-positive shapes it produced on its first run.

### 2. The mass-assignment pattern was systemic — now fixed

`update({ where: { id }, data: req.body })` was not confined to the two handlers
it was found in. It appeared **17 times across 9 route files**, and the second
defect turned out to be worse than the first: **16 of the 17 models had no
`institutionId` at all**. Sports rosters, incident reports, journal entries,
anti-ragging affidavits, transfer requests, broadcast messages, quality metrics
and accreditation checklists were single global tables, readable and writable by
any authenticated holder of the relevant role from any institution.

| File | Handlers | Models |
|---|---|---|
| `sports.ts` | 5 | athletes, teams, attendance, facilities, inventory |
| `registrar.ts` | 3 | transfers, vacancies, accreditation |
| `alumni.ts` | 2 | events, job postings |
| `vc.ts` | 2 | meetings, broadcast messages |
| `admin.ts` | 1 | courses |
| `finance.ts` | 1 | journal entries |
| `grievances.ts` | 1 | anti-ragging affidavits |
| `iqac.ts` | 1 | quality metrics |
| `security.ts` | 1 | incident reports |
| **Total** | **17** | **16 models** |

All 17 were migrated. What that took:

- **Migration 0028** — `institutionId` on all 16 models: backfilled from a
  foreign key where one existed (an affidavit belongs to its student's
  institution, a journal entry to its author's), and otherwise assigned only to
  rows whose id marks them as seed data. Anything else aborts, carrying forward
  the rule from 0027: guessing a tenant is how records end up filed under the
  wrong university.
- **Migration 0029** — `Course.institutionId` from nullable to `NOT NULL`. A
  nullable tenant key is a hole in the filter: a NULL row matches no institution,
  so it becomes invisible and unrepairable rather than leaking. Applying it
  **exposed a live bug** — `dean.ts` and `hod.ts` created courses without a
  tenant key at all, so every course created through those screens was written
  successfully and then unreachable.
- **`modules/common/entityUpdate.service.ts`** — one helper rather than 16
  services. These are plain attribute edits with no cross-entity invariants;
  sixteen near-identical services would be sixteen places to drift, which is
  exactly how the same line ended up in both `coe.ts` and `registrar.ts`.
  Anything with real domain logic still gets its own service.
- **`modules/common/entityUpdate.schemas.ts`** — a `.strict()` schema per
  handler. The omissions are the substance: ledger amounts, counters,
  provenance (`sender`, `sentAt`, `createdBy`, `postedBy`), identity fields, and
  derived values are all refused. `totalValue` on inventory is recomputed from
  its operands rather than accepted, so a stored total cannot contradict them.

Verified live (`verify-3b-mass-assignment.sh`, 14/14): a planted rival-institution
team is neither listed nor writable; ledger amounts, counters and broadcast
provenance are all rejected; a legitimate edit still applies and is audited with
before/after values.

**The ratchet now sits at zero** and was proven to still fail: planting one
violating handler in `sports.ts` produced
`sports.ts has 1 handler(s) writing a model from req.body; 0 recorded`, and
removing it returned the suite to green. A guard at zero that cannot detect a
reintroduction is decoration.

### 2b. Two more fabrications removed on the way

`iqac.ts` **invented quality metrics** whenever the table was empty — writing a
NAAC "Overall Score" of `3.24` against a target of `3.5` on first page load.
Nobody entered those numbers, and once written they were indistinguishable from
measured figures. This is the `getOrCreate*` pattern Phase 0.2 removed elsewhere,
surviving in the module whose entire purpose is accreditation evidence. The
dashboard now reports `N/A` when nothing has been recorded.

The hardcoded `target: "3.5"` in the same response went with it — a goal nobody
had entered, rendered beside a score that may be unknown. A fabricated target is
the same defect as a fabricated score, just less conspicuous.

### 3. Four safe-but-fragile writes, converted anyway

The scoping guard flagged five `notificationDelivery.update({ where: { id } })`
calls. On inspection **none was exploitable** — each was preceded by a
tenant-scoped read or used a server-generated id from the same scope. They were
converted to `updateMany` with the tenant filter regardless, because a reader
cannot tell a safe instance from an unsafe one at a glance, and an exception list
is more expensive to maintain than the fix.

---

## Verification

| Script | Checks |
|---|---|
| `verify-23-workflow-engine.sh` | 15 |
| `verify-24-result-publication.sh` | 12 |
| `verify-3a-exam-schedule.sh` | 13 |
| `verify-3b-mass-assignment.sh` | 14 |

All passing — **54 live checks**. Backend unit suite: **404 tests, 19 files**.

`EXPECTED_CHECKS` earned its keep again here: the 3b script initially declared 16
against 14 real call sites and reported INCOMPLETE. Every check had passed, but
the run was still treated as failed until the constant was corrected by counting
the call sites rather than re-estimating them.

Each script declares `EXPECTED_CHECKS` and reports INCOMPLETE if fewer ran —
added after a broken arithmetic expansion caused one check to abort before
reporting, and the run printed `ALL CHECKS PASSED` having silently skipped it.

---

## What this means for the rest of Phase 3

**Phase 3a is complete and measured. Phase 3b closed the mass-assignment queue
(17 handlers, 16 models). The remaining ~430 handlers are not started.**

Around 450 legacy handlers remain. At the rate measured here, and accounting for
the reading time that does not compress, that is **weeks of work, not a session**
— and the estimate assumes no further finds of the kind that made this slice take
three times longer than the code alone suggested.

Recommended order, highest risk first:

1. ~~The 17 mass-assignment handlers.~~ **Done** — migrations 0028/0029 and
   `modules/common/entityUpdate.*`. See section 2 above.
2. `grievances.ts` (14 handlers) — carries confidential and anonymous
   submissions, so the blast radius of a scoping error is worst here.
3. The remaining oversight modules (`vc.ts`, `iqac.ts`, `admin.ts`).
4. Everything else, module by module.

The single most valuable structural change would be making the service layer
scoped by construction — either by having `mutate()` open its transaction on the
extended client, or by a repository wrapper that requires a `TenantContext`.
Until then, every new service is one forgotten `where` clause away from the
breach described above, and a test is the only thing standing in the way.

---

## Phase 3c outcome (2026-08-24)

Three of the four measured categories were closed **structurally** rather than by
sweeping handlers. The reasoning was the same each time, and it is worth stating
once: editing N handlers closes today's N and does nothing about the N+1th, which
arrives the first time someone adds a handler without knowing the convention.
That argument settled tenant scoping in Phase 3a; 3c applied it three more times.

| Category | Before | After | How |
|---|---|---|---|
| Unaudited hard deletes | 20 | **0** | `deleteTenantEntity` — captures the row before it goes, requires a reason, refuses deletes that would orphan dependents |
| Mass assignment (spread form) | 17 | **0** | `validate({ body })` on the route; the middleware *replaces* `req.body`, so the existing spread now spreads a `.strict()`-checked object |
| Unaudited writes | 105 | **0** | The Prisma extension wraps the query function, so every write leaves a row whether or not its handler asks |
| Unpaginated list reads | 109 | **0** | The extension refuses a `findMany` past 1000 rows rather than truncating it |
| **Unvalidated writes** | 131 | **84** | *Remaining. See below.* |

### What remains: 84 unvalidated writes

Distributed hod 27, dean 16, faculty 15, placements 9, iqac 5, vc 5, sports 3,
grievances 3, alumni 1.

**These are not mass assignment.** The ratchet in `serviceScoping.test.ts` reads
zero: every one of them writes explicitly named fields, so a caller cannot reach
a column the handler did not choose. What they lack is a schema, which means:

- no `.strict()`, so an unknown key is silently ignored rather than refused — a
  client typo becomes a successful no-op
- no length or range bounds, so an arbitrarily long string reaches the column
- a missing required field surfaces as a 500 from Prisma rather than a 400 with
  field errors

Real, and worth closing; materially less severe than what 3c closed.

**Why this one was not made structural.** Validation is per-endpoint semantics —
which fields, which ranges, which combinations are coherent — and no generic rule
can supply them. The generated-schema approach used for the 17 spread-form
handlers does not transfer either: it worked there because those handlers took
whole models, whereas these transform, derive and default individual fields, so
each needs its handler read before a schema can be written without breaking it.
Estimated at roughly a day of careful work, and it must not be rushed: a schema
that rejects a body the handler currently accepts breaks a working endpoint.

### Two mistakes worth keeping

**The ratchet measured the wrong thing.** It counted the syntax
`data: { ...req.body }`. After 3c that string appears in all seventeen *fixed*
handlers and is dangerous in none. It now reads the route and counts only spreads
of an **unvalidated** body. A guard that cannot tell a fixed call site from a
broken one will eventually be silenced rather than fixed.

**The row cap was nearly placed before the tenancy branches.** It read correctly
and would have executed every `findMany` before the `institutionId` filter was
injected. Both the cap and the structural audit now live in the wrapper that
every branch converges on — which is *after* scoping, not before.
