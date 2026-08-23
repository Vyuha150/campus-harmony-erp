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

### 2. The mass-assignment pattern is systemic

`update({ where: { id }, data: req.body })` was not confined to the two handlers
it was found in. It appears **17 times across 9 route files**:

| File | Occurrences |
|---|---|
| `sports.ts` | 5 |
| `registrar.ts` | 3 |
| `alumni.ts` | 2 |
| `vc.ts` | 2 |
| `admin.ts` | 1 |
| `finance.ts` | 1 |
| `grievances.ts` | 1 |
| `iqac.ts` | 1 |
| `security.ts` | 1 |
| **Total** | **17 across 9 files** |

`grievances.ts` was missing from the first version of this inventory: it was
compiled with an exact-string grep, and that file spaces the expression
differently. The count now comes from the same regex the ratchet test uses, so
the document and the guard cannot disagree.

Every one carries both defects. Each fix needs its own validation schema and
service — the exam pair alone took a migration, a schema, a service, five
rewired handlers and a live run.

**These are not fixed.** Claiming otherwise, or quietly excluding them so the
suite stays green, would both be false. Instead the counts are recorded as a
ratchet in `serviceScoping.test.ts`:

- the total may not **grow**, which stops the pattern spreading;
- lowering it requires editing the inventory, so a migration is deliberate;
- the debt shows up in a test run rather than being buried in a document.

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

All passing. Backend unit suite: **336 tests, 18 files**.

Each script declares `EXPECTED_CHECKS` and reports INCOMPLETE if fewer ran —
added after a broken arithmetic expansion caused one check to abort before
reporting, and the run printed `ALL CHECKS PASSED` having silently skipped it.

---

## What this means for the rest of Phase 3

**Phase 3a is complete and measured. Phases 3b and 3c are not started.**

Around 450 legacy handlers remain. At the rate measured here, and accounting for
the reading time that does not compress, that is **weeks of work, not a session**
— and the estimate assumes no further finds of the kind that made this slice take
three times longer than the code alone suggested.

Recommended order, highest risk first:

1. **The 17 mass-assignment handlers.** Each is a live cross-tenant write. This
   is a security queue, not a refactor queue, and should not wait for its
   module's turn.
2. `grievances.ts` (14 handlers) — carries confidential and anonymous
   submissions, so the blast radius of a scoping error is worst here.
3. The remaining oversight modules (`vc.ts`, `iqac.ts`, `admin.ts`).
4. Everything else, module by module.

The single most valuable structural change would be making the service layer
scoped by construction — either by having `mutate()` open its transaction on the
extended client, or by a repository wrapper that requires a `TenantContext`.
Until then, every new service is one forgotten `where` clause away from the
breach described above, and a test is the only thing standing in the way.
