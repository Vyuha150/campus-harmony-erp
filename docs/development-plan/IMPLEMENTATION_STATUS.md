# Implementation Status

**Last updated:** 2026-08-19 · **Current phase:** Phase 0 complete · Multi-tenancy complete · Phase 1 in progress

---

## Session checkpoint 2 — Multi-tenancy (2026-08-19)

**Input:** product decision "multi-institution" + *Comprehensive ERP Blueprint for Indian Universities*.

### COMPLETED & VERIFIED

| Item | Evidence |
|---|---|
| **ADR-0001** — shared-DB row-scoped tenancy | `docs/adr/0001-multi-tenancy-strategy.md` |
| **Institution hierarchy** — Institution→Campus→School→Dept→**Programme**→Batch→Section | Migration `0002_multi_tenancy`; 6 new tables |
| **`Programme` model** | The structural gap that blocked curriculum, credits, electives, multiple entry/exit |
| **Data preserved** | 17 users, 2 departments, 1 course, 1 student profile — **0 orphans** |
| **Tenant-scoped uniqueness** | Two institutions now both hold a "CSE" department — impossible before |
| **Tenant context middleware** | Derived from DB per request, never from the client |
| **Cross-tenant isolation** | Live test: Default admin sees 17 users, Rival admin sees **1** |
| **Cross-tenant IDOR blocked** | Rival admin → `PUT /admin/users/seed-user-student` = **403**, target unchanged |
| **Client tenant override rejected** | `?institutionId=` → **403**; `X-Tenant-Id` header → **403** |
| **Campus scoping** | VC/Registrar/CoE = all campuses; faculty/student/librarian = own campus |
| **Structured NIRF fields** | `qualificationLevel`, verification, employment type; demographics (legal-gated) |
| Backend typecheck | **0 errors** |
| Test suite | **39 passing** (was 19) |

### NEWLY DISCOVERED ISSUES

| Finding | Detail | Action |
|---|---|---|
| **Two more fabrication sites** — missed by the original audit | `dean.ts` and `hod.ts` auto-created a "Computer Science & Engg" department via a **global** `{ code: 'CSE' }` lookup. Under multi-tenancy this could have matched **another institution's** department and assigned the user across the tenant boundary. | ✅ **FIXED** |
| **Temp-password generator could produce a password its own policy rejects** | Uniform draw over a 64-char alphabet missed the digit+symbol classes ~0.3% of the time → an admin reset that silently fails. Caught by a test. | ✅ **FIXED** — guarantees all four classes, rejection sampling removes modulo bias |
| **Tenant scoping applied to only 2 of 19 route files** | Middleware is mounted everywhere, but only `admin.ts`/`dean.ts` apply the scope in queries. | ⚠️ **T-320 — TOP OPEN RISK** |

### NEXT DEPENDENCY
~~T-320~~ — **RESOLVED**, see checkpoint 3.

---

## Session checkpoint 3 — Tenant scoping made structural (2026-08-19)

**T-320 was the top open risk: middleware was mounted everywhere but only 2 of 19 route files actually applied the scope.**

### The decision

Manually adding `campusScope(ctx)` to 478 handlers would have "fixed" it — but a security property that depends on 478 correct decisions is not a security property, it is a probability distribution. One forgotten spread leaks another university's student records.

Instead, scoping is now **structural and automatic**:

```
AsyncLocalStorage (tenantStore.ts)   holds the request's tenant context
        ↓
Prisma extension (tenantExtension.ts) injects institutionId into EVERY query
        ↓
prisma  = tenant-scoped client   ← what route handlers use
basePrisma = unscoped client     ← auth, migrations, seeds only
```

A developer must now **actively opt out** via `runUnscoped(reason, fn)` — which is greppable in review — rather than actively opt in.

### VERIFIED

| Property | Evidence |
|---|---|
| **Automatic scoping on untouched handlers** | `/hod/faculty` has **no tenant filter in its code**. Default HOD → `['Dr. Ravi Faculty']`; Rival HOD → `['Rival Faculty']` |
| Endpoint sweep | `/admin/users` 17 vs 3 · `/admin/departments` 2 vs 1 · `/admin/academic-years` 1 vs 0 |
| Tenant-scoped uniqueness | Both institutions hold a `CSE` department; each admin sees only its own |
| Creates stamped with tenant | `withInstitution` + extension override client-supplied `institutionId` |
| Unique-key IDOR blocked | `findUnique` results verified against caller's institution → "not found" |
| **Fail-closed** | Tenant-owned model queried with no context → throws, never returns unscoped rows |
| **Coverage guard** | Test parses `schema.prisma`; fails CI if a model gains `institutionId` without being scoped |
| `principal` role | `/dean/dashboard` **200**, `/admin/users` **403** |
| `auditor` role | GET `/iqac/dashboard` **200**, GET `/vc/dashboard` **200**, PUT `/hod/approvals` **403** |
| **P1-12 fixed** | `librarian` → `/students/dashboard` **403** (was full access to 32 endpoints); `/library/books` **200** |
| Governance models | `GovernanceCommittee`, `CommitteeMember`, `CommitteeMeeting`, `InstitutionalPolicy` — migration `0003` |
| Typecheck | **0 errors** |
| Tests | **42 passing** (was 39) |

### Limits of this layer — stated honestly

| Limit | Detail |
|---|---|
| **Raw SQL is not covered** | `$queryRaw`/`$executeRaw` bypass the extension. Only `faculty.ts` used raw SQL and that path was removed, but new raw SQL must scope manually |
| **Campus granularity still manual** | The extension enforces *institution*. Campus-level narrowing still needs `campusScope(ctx)` where it matters |
| **`select` without institutionId can't be verified** | Narrow selects on `findUnique` skip result verification; the `where`-based path covers the general case |
| **RLS still deferred** | PostgreSQL Row-Level Security remains the intended second layer (ADR-0001) |

### NEWLY DISCOVERED
| Finding | Action |
|---|---|
| `dean.ts`/`hod.ts` looked up `{ code: 'CSE' }` **globally** — under tenancy this could have matched another institution's department and assigned a user across the boundary | ✅ Fixed (also removed the fabrication) |
| Seed/`AcademicYear`/`Course` unique lookups broke once codes became tenant-scoped — **the type system caught every one** | ✅ Fixed |

### NEXT DEPENDENCY
~~T-203~~ / ~~admissions~~ — **DONE**, see checkpoint 4.

---

## Session checkpoint 4 — Service layer + Admissions (2026-08-19)

### T-203 — service layer

Built as infrastructure, then **proven on greenfield admissions** rather than retrofitted onto a legacy module. Retrofitting first would have meant refactoring working code before the pattern was validated.

| Component | Purpose |
|---|---|
| `middleware/validate.ts` | zod request validation; `.strict()` rejects unknown keys |
| `lib/service.ts` | `mutate()` — change + audit in ONE transaction; pagination helpers |
| `schemas/common.ts` | Shared primitives: Indian phone, reservation category, academic year |
| `modules/admissions/*` | Reference implementation: `routes → service → schema` |

`mutate()` is the load-bearing piece: **if the audit write fails, the business change rolls back.** For institutional records an untraceable change is worse than a failed request.

### EPIC-05 — Admissions (was the largest functional gap: nothing existed)

Migration `0004_admissions`: `AdmissionCycle`, `AdmissionSeatMatrix`, `AdmissionApplication`, `AdmissionDocument`, `AdmissionOffer`.

**Verified live, full workflow:**

| Step | Result |
|---|---|
| Create cycle with statutory seat matrix | GENERAL 5 · OBC_NCL 2 · SC 2 · ST 1 = 10 |
| Seat matrix must sum to intake | `VALIDATION_ERROR — totals 7 but declares 10` |
| Applications blocked on draft cycle | `BUSINESS_RULE_VIOLATION` |
| 5 applications submitted | `BTCSE2026-00001`…`00005` |
| Invalid phone | `{'phone': ['Must be a valid Indian mobile number.']}` |
| Duplicate email per cycle | `CONFLICT` |
| **Mass assignment** (`status:'admitted'`, `meritRank:1`) | **`VALIDATION_ERROR` — unknown keys rejected** |
| **Eligibility rule overrides the verifier** | Verifier said eligible; 55% < 60% → **auto-rejected with reason recorded** |
| Merit ranked **within category** | SC: Chetan 91 → Asha 88 → Bhanu 76; GENERAL ranked separately |
| **Statutory quota enforced** | 3 SC candidates, 2 SC seats → 3rd gets `No seats remain in the SC category` |
| **Atomic admission** | Users 22→23, StudentProfiles 1→2, FeeRecords 1→2 — all three together |
| **No fabrication** | New student `cgpa: 0`, not invented. Demographics carried from application (SC/MALE/Karnataka) |
| Decline releases seat | SC 2/2 → 1/2 |
| Waitlist promotion | Bhanu (rank 3) offered the freed seat → SC 2/2 |
| Seat utilisation (NAAC Criterion 2) | **Derived** from records: 20%, per-category vacancy |
| Audit trail | `CREATE/critical`, `APPROVE/warning`, `PUBLISH/warning` |
| **Tenant isolation** | Rival lists **0** cycles; reads Default's cycle by id → **404** |
| **Read-only auditor** | `POST /admissions/cycles` → **403** |

### Status
Typecheck **0 errors** · Tests **66 passing** (was 42) · Migrations **4**

### NEWLY DISCOVERED
| Finding | Action |
|---|---|
| Express 5 types `req.params.x` as `string \| string[]` | Added `pathParam()` helper rather than casting per call site |
| My own login rate limiter locked out the test account mid-run | Working as designed; noted that integration tests (T-213) must use a dedicated account or a raised limit |

### NEXT DEPENDENCY
~~T-109 / T-020~~ — **DONE**, see checkpoint 5.

---

## Session checkpoint 5 — Phase 1 production blockers (2026-08-19)

### A1 — Backups ✅ **with a verified restore**

`BackupRecord` was a façade: a model the Admin UI read, populated by a seed row describing a fictional 122 MB S3 backup. No backup code existed.

**Now real, and proven:**

```
BACKUP    121 tables · 236 KB · 0.9s · SHA-256 recorded · verified at creation
DRILL     restored into a scratch DB · 121 tables · 2.5s · RESULT: PASS
```

Row counts, live vs restored — **all matched**: User 23/23 · StudentProfile 2/2 · Institution 2/2 · AdmissionApplication 5/5 · SystemAuditLog 20/20 · FeeRecord 2/2. The admitted student `BTCSE20260001` and both institutions survived — **tenant isolation persists through a restore**.

Safety verified: restore **refuses** to overwrite the live database —
`BLOCKED - Refusing to restore over the live database "campus_harmony"`.

Fictional seed row deleted. `BackupRecord` now reflects reality.
Runbook: `docs/runbooks/backup-and-recovery.md`.

### A2 — CI pipeline ✅

`.github/workflows/ci.yml` — 6 gates: typecheck · tests · migrations (against an **empty** DB, plus backup+restore drill) · dependency audit · container build · frontend build.

**Each gate verified locally before committing.** The secret-detection gate was tested **both ways**: passes on clean code, and *caught* a deliberately reintroduced fallback.

### A3 — Dependencies ✅ **53 → 8 (−85%), critical eliminated**

| | Before | After |
|---|---:|---:|
| Frontend | 32 (1 critical) | **4** |
| Backend | 21 | **4** |

Verified after upgrade: frontend build ✅ · typecheck 0 ✅ · 66 tests ✅ · migrations ✅

**Rejected one "fix":** npm proposed resolving 3 Prisma advisories with `prisma@6.12.0` — a **downgrade** from v7 that would break the driver adapter, the tenant-isolation extension and all four migrations. Rationale recorded in `15_DEPENDENCY_TRIAGE.md`. Remaining 8 are dev-server-only or not attacker-reachable.

### A4 — Deployment target ✅ *(build unverified — see below)*

Multi-stage `backend/Dockerfile` + `docker-compose.yml`. Non-root, tini for signal handling (so the existing graceful shutdown fires), `postgresql-client` included **because the backup service shells out to it**, healthcheck on `/api/ready` (verifies the DB, unlike `/api/health`), `NODE_ENV=production` (the old `ecosystem.config.cjs` said `development`).

### First frontend production build ever run ✅
Passes in 13.6s. **Bundle is 2,157 kB (490 kB gzipped)** — over Vite's 500 kB warning. Code-splitting is now a known task.

### NEWLY DISCOVERED
| Finding | Action |
|---|---|
| **My first CI secret-gate had a false positive** — a naive grep matched the *rejection logic and its documentation*, which would pressure a maintainer to delete the code preventing the problem | Fixed: strips comments, targets the auth path, verified with a negative control |
| npm's audit resolver proposes **downgrades** as "fixes" | Rejected with rationale; do not run `npm audit fix --force` on this repo |
| Frontend bundle is 2.1 MB unsplit | Logged as frontend work |

### ⚠️ NOT VERIFIED
- **The Docker image has never been built** — Docker is not installed on this machine. All `COPY` paths were checked to exist and the fail-fast boot behaviour was verified natively (`JWT_SECRET is required but was not set.`), but **the image itself is unbuilt**. CI's `docker` job is its first real test; a failure there is expected-and-informative.
- Off-host backup replication, scheduling, and upload backup remain **outstanding** (see runbook "Outstanding gaps").

### A5 — File storage & per-file authorization ✅

Migration `0005_file_metadata`. Closes a gap **documented honestly in Phase 0**: removing the public `express.static` mount stopped world-readable files, but with no metadata *any authenticated user could download any file whose id they knew*.

**Verified live:**

| Check | Result |
|---|---|
| `.html` upload (stored-XSS payload) | `VALIDATION_ERROR — File type ".html" is not permitted.` |
| Uploader downloads own file | **200** |
| Unrelated user (faculty) | **403** |
| **Admin on a CONFIDENTIAL file** | **403** — admin role alone is not enough |
| Other institution | **404** — no disclosure that the id exists |
| Unauthenticated | **401** |
| Download headers | `nosniff` · `attachment` · `private, no-store` |
| Confidential access audited | `FILE_DOWNLOAD` / `warning` rows written |
| Storage layout | `uploads/<institutionId>/<module>/<uuid>.ext` — tenant-partitioned |

Storage is now behind a `StorageProvider` interface, so the same `FileMetadata` row resolves through local disk today and object storage tomorrow. The S3 provider is a **deliberate stub that fails loudly** — a silent fallback to local disk in production would look like it worked while writing to a container about to be replaced.

### NEWLY DISCOVERED
| Finding | Detail |
|---|---|
| **My first live upload test failed with HTTP 000** | Not a code fault — curl is a Windows binary and cannot resolve Git Bash `/tmp/...` paths. Worth knowing for anyone testing uploads on Windows |

---

## Phase 1 complete — summary

| Item | Status |
|---|---|
| A1 Backups + **verified restore drill** | ✅ 121 tables restored, PASS |
| A2 CI pipeline (6 gates) | ✅ Each gate verified locally |
| A3 Dependencies **53 → 8 (−85%)** | ✅ Critical eliminated |
| A4 Dockerfile + compose | ✅ Written; **image unbuilt** — no Docker here |
| A5 Object storage + per-file authz | ✅ Verified live |

**Typecheck 0 · Tests 90 (was 66) · Migrations 5**

### Still outstanding from Phase 1
- **Off-host backup replication** — backups are verified and restorable but still local-disk; a host loss takes them with the data
- **Backup scheduling** — manual until a cron/job runs it
- **S3 provider implementation** — interface ready, needs `@aws-sdk/client-s3` + bucket
- **Docker image never built** — CI's `docker` job is its first real test

### NEXT DEPENDENCY
~~T-403 / T-104~~ — **DONE**, see checkpoint 6.

---

## Session checkpoint 6 — Academic results engine (2026-08-19)

Migration `0006_academic_results`: `GradeScale`, `GradeBand`, `CourseResult`, `SemesterResult`, `GradeHistory`.

### T-403 — CGPA is now COMPUTED

`StudentProfile.cgpa` was a stored Float that nothing computed; the old code wrote a literal `cgpa: 8.5`. Phase 0 removed the fabrication and left it at zero — correct, but the system still could not produce a transcript.

**The decisive test.** Recorded three courses; the engine returned **CGPA 8.5** — *the very number the old code used to fabricate*. So it was tested again by changing one mark:

```
PH101  65 → 95   (B+ 7pts → O 10pts)
CGPA   8.5 → 9.4
hand-check  (10×4)+(8×3)+(10×3) = 94 / 10 = 9.4  ✓
```

**It moves with the marks. It is derived.**

| Property | Evidence |
|---|---|
| Marks → grade via the institution's own scale | 92→O(10) · 78→A(8) · 65→B+(7) |
| SGPA credit-weighted | `(10×4)+(8×3)+(7×3)/10 = 8.5` — matches hand-check |
| CGPA = cache of a calculation | Recompute rebuilds from `CourseResult`; never trusted |
| **Grading scheme is configurable + versioned** | `CBCS10 v1.0`, 8 bands — not hard-coded |
| **A gapped scale is rejected** | `Grading scale has a gap between 39 and 80` |
| Transcript | Produced end-to-end — **impossible before** |

### T-104 — grade history

Grades were mutated with **no old value, no actor, no reason**. Now every change writes `GradeHistory` **inside the same transaction** — a grade change that cannot be recorded does not commit.

```
(initial)  → O    initial      Initial entry
B+         → O    correction   Correction before publication
O          → A+   correction   Revaluation request REV-2026-014 upheld…
```

Amending a **published** result without a reason is refused:
`BUSINESS_RULE_VIOLATION — Amending a published result requires a reason of at least 10 characters.`

Publication is transactional across all results for the semester — partial publication is impossible.

### NEWLY DISCOVERED — two real bugs, both caught by my own checks

| Finding | Detail |
|---|---|
| **My gap validation was wrong** | It treated `W` (withdrawal) as a mark range, so a *legitimate* scale looked gapped. Administrative grades are outcomes, not scores — now excluded from the continuity check |
| **`P2002` leaked Prisma internals to clients** | The conflict response carried model name, DB constraint name and the driver-adapter error object — the exact disclosure the error taxonomy exists to prevent. Now returns field names only; full detail goes to the log |

### NOT a defect
A test run reported 1 failure and a **17-minute** duration. Investigated rather than assumed: the password generator measures **12ms per 50 calls with 50/50 uniqueness**, and a clean re-run gives **109/109 in 1.58s**. The machine slept mid-run.

### Status
Typecheck **0** · Tests **109** (was 90) · Migrations **6**

### NEXT DEPENDENCY
~~Curriculum~~ — **DONE**, see checkpoint 7.

---

## Session checkpoint 7 — Curriculum, prerequisites & OBE foundation (2026-08-19)

Migration `0007_curriculum_obe`: `CurriculumScheme`, `CourseBasket`, `SchemeCourse`, `CoursePrerequisite`, `ProgrammeOutcome`, `CourseOutcome`, `CoPoMapping`.

`Programme` had no structure beneath it, so course registration was an unconstrained insert — a student could register for a final-year course in semester 1, skip prerequisites, or exceed any credit load. Nothing checked.

### VERIFIED LIVE

| Rule | Evidence |
|---|---|
| Basket credits must equal the graduation requirement | `Basket credits total 10 but the scheme requires 30 to graduate.` |
| A scheme whose baskets **cannot be satisfied** can't be activated | `Basket CORE requires 22 credits but only 18 are available… No student could satisfy this requirement.` |
| **Prerequisites block registration** | Student B: `MA201 BLOCKED — Prerequisite MA101 has not been passed.` |
| Students who met them proceed | Student A: `MA201 ALLOWED · CS201 ALLOWED` → `registered ['MA201','CS201'] — 8 credits` |
| Whole-request rejection (no partial registration) | `BUSINESS_RULE_VIOLATION — Registration rejected: 2 course(s) failed validation.` |
| Duplicate registration rejected | `MA201: Already registered for this course.` |
| **Degree progress from real results** | `earned 10 / 30 (33%) · CORE 10/22 · PE 0/8 · eligible to graduate: False` |

Prerequisites are checked against **`CourseResult`** — i.e. against grades actually earned, not against a claim. Curriculum is **versioned**, so a student admitted under R2026 graduates under R2026 (audit rule 64).

OBE models (`ProgrammeOutcome`, `CourseOutcome`, `CoPoMapping`) are in place — the schema NBA attainment reporting needs. The only prior reference to outcomes in this codebase was **fabricated**: `faculty.ts` wrote `CO${week}` into auto-generated lesson plans.

### NEWLY DISCOVERED — one real bug

| Finding | Detail |
|---|---|
| **Malformed JSON returned 500, not 400** | body-parser's `entity.parse.failed` fell through to the generic handler, so a bad request body was reported as a server fault *and* logged as "unhandled". Now `HTTP 400 VALIDATION_ERROR — The request body is not valid JSON.` Payload-too-large mapped likewise |

### Test-harness note (not a product defect)
Several verification runs failed with `Bad control character in JSON`. Cause: Windows `psql` emits `\r\n`, and `tr -d ' \n'` leaves the `\r` inside shell variables. Stripping `\r` fixed it — worth knowing for anyone scripting against this on Windows.

### Status
Typecheck **0** · Tests **109** · Migrations **7**

### NEXT DEPENDENCY
~~Examination lifecycle~~ — **DONE**, see checkpoint 8.

---

## Session checkpoint 8 — Examination lifecycle (2026-08-20)

Migration `0008_examination`: `ExamSession`, `ExamSchedule`, `ExamRegistration`, `HallTicket`, `HallTicketEntry`, `RevaluationRequest`.

Blueprint: *"The ERP ensures only eligible students (attendance and fee compliance) can register, enforcing academic rules."* The audit found **8 endpoints** for this domain and **no lifecycle at all**.

### VERIFIED LIVE — with a deliberately failing student

Seeded a real attendance history: **MA101 60%** (6/10 sessions), **CS101 90%** (9/10), and **₹75,000 outstanding fees**.

| Step | Result |
|---|---|
| Paper scheduled outside the exam window | `The exam date falls outside the session window (2026-11-10 to 2026-11-30).` |
| **Eligibility computed from real records** | `MA101 60% NOT ELIGIBLE — below the required 75%` · `CS101 90% NOT ELIGIBLE — outstanding fees` |
| Ineligible papers **recorded, not skipped** | `0/2 papers eligible`, each with its reason stored |
| **Hall ticket refused** while any paper ineligible | `A hall ticket cannot be issued: 2 paper(s) are still ineligible.` |
| Fees paid → re-check | `1/2 eligible` — MA101 still blocked on attendance alone |
| Condonation without a reason | `VALIDATION_ERROR` |
| Condonation by VC with reason | `condoned: True` — recorded with who and why |
| **Hall ticket then issues** | `HT-2026-000001 verify 110011B7E59D` with both papers |
| Condonation audited | `APPROVE / critical — Condoned attendance shortfall (60%)` |

### Design decisions worth noting

- **Attendance thresholds are per-session DATA**, not constants. UGC/AICTE commonly mandate 75%, but institutions differ and rules change year to year.
- **`null` attendance ≠ 0%.** A course with no sessions held cannot produce a shortfall — treating it as 0 would block students for an administrative gap.
- **Fee dues are NOT condonable** through the academic path. A financial obligation must be cleared or formally waived on the fee record, not waived by an exam officer.
- **Eligibility figures are snapshotted** on the registration, so a refusal remains explainable months later rather than being recomputed against changed data.

### Status
Typecheck **0** · Tests **109** · Migrations **8**

### NEXT DEPENDENCY
~~Marks / moderation / revaluation~~ — **DONE**, see checkpoint 9.

---

## Session checkpoint 9 — Marks, moderation & revaluation (2026-08-20)

Connects the examination lifecycle to the results engine. `marks.service.ts` enforces the rules an institution would be asked to defend.

### VERIFIED LIVE

| Rule | Evidence |
|---|---|
| **No registration → no marks** | `This student has no registration for MA101 in session ESE2026NOV. Marks cannot be entered for an unregistered candidate.` |
| Ineligible student → no marks | Blocked with the stored ineligibility reasons |
| **Publication REFUSED before moderation** | `Publication refused: 1 result(s) have not been moderated.` |
| Moderation requires a real reason | `VALIDATION_ERROR` on a 5-character reason |
| Moderation applied | `58 → 62 (B → B+)`, status `moderated` |
| **Publication then succeeds** | `published 1 result(s) for ESE2026DEC` |
| **Both values preserved in history** | `(none) → B (– → 58) initial` · `B → B+ (58 → 62) moderation` with the reason |
| Already-published result protected | `This result is already published. Use moderation or revaluation to change it.` |
| Audit severity | moderation and publication both recorded `critical` |

### Design decisions

- **Absence is not a zero.** An absent candidate takes the scale's excluded-from-GPA band, so absence does not silently score as 0 and drag the GPA down.
- **Revaluation creates a NEW ATTEMPT**, never overwrites. The original evaluation stays in the record — that is what makes a revaluation defensible rather than a quiet correction.
- **Moderation that changes nothing is still recorded.** Accepting a result as entered is a decision too.
- **Only published results can be revalued.** Before publication the route is moderation; there is nothing yet to dispute.

### NEWLY DISCOVERED — the seed was still fabricating a CGPA

The runtime fabrication went in Phase 0, but `seed.ts` still wrote a plausible-looking **`cgpa: 8.7`** at two sites. Same defect in a different place: a stored CGPA no calculation produced, which would silently disagree with the results engine.

Fixed to `cgpa: 0`, with a **test guard** (`/cgpa:\s*[1-9]/`) so it cannot come back.

### Status
Typecheck **0** · Tests **110** · Migrations **8**

### NEXT DEPENDENCY
~~Notification delivery~~ — **DONE**, see checkpoint 10.

---

## Session checkpoint 10 — Notification engine (2026-08-20)

Migration `0009_notifications`: `NotificationTemplate`, `NotificationPolicy`, `NotificationDelivery`.

**The defect:** the system stored messages, displayed `readCount` and `totalRecipients`, and **sent nothing**. It reported delivery statistics for messages never delivered — the failure was invisible because everything *looked* fine.

Blueprint chain now implemented: `event → policy → recipients → channel → template → provider → delivery status`.

### VERIFIED LIVE

| Property | Evidence |
|---|---|
| Policy without a template is refused | `No active template exists for event "fee.overdue" on channel(s): email.` |
| Placeholders auto-extracted | `vars=['studentName','feeType','amount','dueDate']` |
| **Dispatch actually delivers** | `policies 1 · deliveries 4 · sent 4 · failed 0` |
| Per-recipient, per-channel rows | 2× `email` + 2× `in_app`, each with provider + message id |
| Templates rendered | `Dear Chetan Das, your Admission fee of Rs 75000 was due on 2026-09-15.` |
| Statistics from **real attempts** | `total 4, delivery rate 100%` — not a stored counter |
| **Unconfigured channel FAILS LOUDLY** | `sms/email/push/whatsapp` all throw `IntegrationError` in `live` mode |
| Failure message is actionable | names MSG91/Gupshup/Twilio, and the `NOTIFICATION_DRIVER=log` escape hatch |
| One bad channel doesn't abort the rest | Failures recorded per delivery, dispatch continues |

### Design decisions

- **No silent no-op provider.** A provider returning success while discarding is precisely the original defect; a test asserts at most two `delivered: true` sites exist.
- **Unknown placeholders stay visible** (`{{missing}}`) rather than rendering blank — "Dear ," reads as correct, a visible token reads as a bug.
- **`in_app` works in live mode**; only external channels need vendors.

### NEWLY DISCOVERED — my own code, caught by my own tests

| Finding | Detail |
|---|---|
| **The driver was read once at module load** | `NOTIFICATION_DRIVER` was resolved at import, so it could not be changed without a restart — and could not be tested at all. A setting nobody can exercise is a setting nobody verifies. Now read at call time |
| `InAppProvider.send()` took no arguments | Diverged from `ChannelProvider`; typecheck caught it once the test called it properly |

### Status
Typecheck **0** · Tests **121** (was 110) · Migrations **9**

### NEXT DEPENDENCY
~~Reporting layer~~ — **DONE**, see checkpoint 11.

---

## Session checkpoint 11 — Reporting layer & export (2026-08-20)

The audit found reporting logic re-implemented per endpoint, no shared layer, and **no export capability anywhere** — no CSV, Excel or PDF. An institution could not get its own data out, which is a hard blocker for NAAC/NIRF submission.

### Provenance is the point

Every report declares `sourceModels` and a plain-language `formula`, and both travel with the response. For figures an institution must defend, an untraceable number is an assertion, not evidence — and this layer is what the compliance engine will sit on.

Five reports, all computed from operational records — never from a separate statistics table:

| Report | Sources |
|---|---|
| `STUDENT_PERFORMANCE` | StudentProfile, SemesterResult, CourseResult |
| `EXAM_PASS_RATE` | CourseResult, Course |
| `ADMISSIONS_INTAKE` | AdmissionCycle, AdmissionSeatMatrix, AdmissionApplication |
| `FACULTY_QUALIFICATION` | FacultyProfile |
| `ATTENDANCE_COMPLIANCE` | AttendanceSession, Attendance, StudentProfile |

### VERIFIED LIVE

| Check | Result |
|---|---|
| Pass rate from real results | `CH101 100% (avgGP 7)` · `MA101 100% (avgGP 10)` — derived, not stored |
| Admissions intake by statutory category | `SC 2/2 util 100%` · `GENERAL 0/5` · overall `20%` |
| **CSV export** | Correct headers, `Content-Disposition: attachment`, `nosniff`, UTF-8 BOM for Excel |
| Unsupported format **refused** | `XLSX export requires the exceljs dependency` — not silently downgraded |
| Export audited | `EXPORT / reporting / warning — Exported 4 row(s) as csv` |

### The faculty report is the clearest contrast

The removed fabrication defaulted every faculty member to `'Ph.D in CSE'` — the exact NIRF `TLR` input. The report now returns:

```
UNKNOWN  count 1  verified 0  unverified 1
doctorates: 0 (0%)
DATA QUALITY WARNING: 1 faculty record(s) have no recorded qualification
level. This figure is incomplete and must not be submitted as-is.
```

It refuses to let an unknown pass as a doctorate, and says so.

### Design decisions

- **CSV injection defence.** A field starting with `=`, `+`, `-` or `@` executes as a formula in Excel and Sheets. A student name stored as `=cmd|...` would run when a registrar opens the export. Such fields are prefixed and neutralised — most CSV writers miss this.
- **UTF-8 BOM** on CSV, so Indian names with diacritics do not render as mojibake in Excel on a default Windows install.
- **No new dependency.** CSV is ~40 lines and the escaping rules *are* the risk; XLSX/PDF are declined outright rather than faked.

### Status
Typecheck **0** · Tests **142** (was 121) · Migrations **9**

### NEXT DEPENDENCY
**Compliance engine (EPIC-11)** — the reporting layer and provenance it needs now exist. Still **BLOCKED** on obtaining the official NAAC manual, NIRF methodology/DCS and UGC clause texts.

---

## Session checkpoint 12 — Finance: transactional payments & receipts (2026-08-20)

Taken up because EPIC-11 remains blocked on external documents. This closes the
P1 the audit named directly: **4 uses of `$transaction` across 478 endpoints**,
with fee payment + receipt creation called out as an operation that must be
atomic and was not.

### What was actually wrong

- Fee payment and receipt creation were **not atomic**. A mid-operation failure could leave money recorded with no receipt, or a receipt with no money — reconciled by hand, weeks later, with no way to tell which.
- **No idempotency existed anywhere in the codebase.** A double-clicked Submit, a browser retry, or a redelivered payment-gateway webhook each created a duplicate payment. Gateways redeliver *by design*; a receiver that cannot tolerate it is broken, not unlucky.
- `FeeRecord` and `FeeStructure` were **not tenant-scoped**. A fee query without an explicit filter returned every institution's dues. Neither model appeared in `TENANT_OWNED_MODELS`.
- `FeeRecord.status` was stored and trusted, with nothing reconciling it against the amounts.

### VERIFIED LIVE (15/15 checks, against a running server + psql)

| Check | Result |
|---|---|
| `Idempotency-Key` required on payments | refused without one |
| Payment → allocation → fee update → receipt | all four in ONE transaction |
| Oldest due settled first | library ₹2,500 → `paid`, tuition untouched |
| **Replay with the same key** | **payment rows 1 → 1, no second charge** |
| Replay response | returned the ORIGINAL `PAY-2026-000001` |
| Fee record after replay | `paidAmount` still 2500, not doubled |
| Same key + different body | refused, not silently replayed |
| Overpayment ₹999,999 vs ₹78,000 due | refused, excess named |
| Cheque with no instrument number | refused as unreconcilable |
| Receipt verification | genuine verifies, wrong code rejected |
| Audit trail | 1 row, `CREATE / finance / warning` |
| Audit on replay | **not** duplicated |

Receipt issued: `RCP-2026-27-000001`, "Rupees Two Thousand Five Hundred Only".

### NEWLY DISCOVERED — my own defect, found only by querying the audit table

The first cut routed payments through `withIdempotency`, which owns its own
transaction, so `mutate()` was never called and **money was recorded with no
audit row at all**. Every functional check passed while this was broken. It was
caught only because the verification script queried `SystemAuditLog` directly.

Fixed by calling `recordInTransaction` on the *same* `tx`. Guarded by a test
asserting `executePayment` calls it with the transaction client — an audit row
that can commit independently of the payment is not an audit trail.

The lesson generalises: **a feature check that does not assert on the audit
trail will not notice its absence.**

### NEWLY DISCOVERED — a stale dev server invalidated an earlier run

Three `tsx watch` processes were found on port 5000; one from 01:46 was serving
**pre-edit code** while a newly started process logged success without binding.
The finance routes 404'd despite being correctly mounted. All were killed and
the run repeated against a clean server.

This is a harness defect, not a code defect — but it means **any live check in
this session should be trusted only if the server was started after the code it
exercises**. Verify with `netstat -ano | grep :5000` and compare process
creation time before believing a live result.

### Migration split — 0010 and 0011

An initial single migration raised an exception when `FeeStructure` ownership
was ambiguous. Correct to refuse, but it left the operator stuck: the failed
migration rolls back, so the column they were told to populate did not exist.
Split into `0010` (add nullable, derive what is derivable) and `0011` (enforce
`NOT NULL`), giving a point at which a human records the decision. Documented in
[`docs/runbooks/finance-migration.md`](../runbooks/finance-migration.md).

Both paths were exercised for real: 0011 failed on the ambiguous seed row, the
row was assigned from evidence in `seed.ts`, and the migration then applied.

### Design decisions

- **Overpayments refused, not held as credit.** There is no credit-balance model, and inventing one implicitly — money in a column no report reads — is worse than declining.
- **Cheques and DDs stay `pending`.** Recording an uncleared instrument as `success` is how a bounced cheque becomes an untraceable shortfall. The receipt is issued when it clears.
- **Receipts are cancelled, never deleted or renumbered.** A gap in a receipt series is the first thing an auditor asks about. Cancellation reverses the allocations and requires a reason of ≥10 characters.
- **`FOR UPDATE` on fee records, ordered by id.** Without the lock, two concurrent payments both read `paidAmount = 0` and both allocate against the same balance. Ordering prevents deadlock under load.
- **Same key + different body is refused, not replayed.** That combination means a client bug (a key minted per session rather than per request); returning an unrelated earlier response would hide it. Stripe behaves the same way.
- **Money is still `Float`.** `Decimal(12,2)` is the correct column type; every result passes through `round2()` and comparisons use a half-paisa epsilon to contain drift. **This is a mitigation, not a fix** — recorded as outstanding work below.

### Status
Typecheck **0** · Tests **172** (was 142) · Migrations **11**

### OUTSTANDING in this module
- `FeeRecord.amount` / `Payment.amount` should be `Decimal(12,2)`, not `Float`.
- No payment-gateway integration — `gateway`/`transactionReference` are recorded but nothing is called. Requires a merchant account.
- No refund flow. The `Payment.amount > 0` check deliberately blocks negative amounts rather than letting refunds in through the payment path unapproved.
- `purgeExpiredKeys()` exists but is not scheduled — there is no job runner in this repository yet.
- Concurrency is enforced by `FOR UPDATE` and a unique index, but **no concurrent load test has been run**. The locking is reasoned, not measured.

### NEXT DEPENDENCY
Unchanged: EPIC-11 stays blocked on official documents. The unblocked queue is
**T-203b** (migrate the 479 legacy endpoints, starting with `library.ts`) and the
**bulk import engine** (without which no institution can onboard legacy data).

---

## Session checkpoint 15 — OBE attainment engine (2026-08-20)

### The finding that determined the whole design

Migration 0007 added `CourseOutcome`, `ProgrammeOutcome` and `CoPoMapping`, so
the repository *looked* like it supported outcome-based education. **Nothing
linked student marks to an outcome.** `CourseResult` records only course totals
(internal / external / total).

The available shortcut — split a student's course total evenly across that
course's COs — would have produced a full set of attainment figures in an
afternoon. Every CO would attain identically by construction, the numbers would
look plausible, and they could end up in an accreditation submission. That is
the fabrication pattern this project has spent its entire effort removing, so
migration 0015 builds the missing link instead: assessments with a CO-wise mark
distribution, and marks recorded **per student, per outcome**.

### VERIFIED LIVE against a hand-computed example (26/26 checks)

Four students, one 50-mark CIE split CO1=20 / CO2=20 / CO3=10, target 60%:

| CO | Marks | Clearing target | Level | Checked |
|---|---|---|---|---|
| CO1 | 18, 14, 12, 8 | 3 of 4 = 75% | **3** | ✅ |
| CO2 | 12, 11, 10, 9 | 1 of 4 = 25% | **0** | ✅ |
| CO3 | 8, 7, 5, **absent** | 2 of **3** = 66.67% | **2** | ✅ |

- `PO1 = (CS101.CO1(L3 x 3) + CS101.CO2(L0 x 2)) / 5 = 1.8` — **strength-weighted**,
  not the plain mean of 1.5 an unweighted average would give.
- `PO2 = (CS101.CO3(L2 x 1)) / 1 = 2` → 66.67%.
- Indirect survey level 2 blended: `(3 x 80 + 2 x 20) / 100 = 2.8`.

### Four decisions that change the numbers, each verified

1. **Absent students are EXCLUDED, not scored zero.** CO3 reports 3 assessed, not
   4 — 66.67% rather than 50%. An absence says nothing about whether the outcome
   was taught.
2. **"NOT MEASURED" is distinct from "not attained".** A CO with no marks returns
   level 0 *with an explanation saying there is no evidence either way*. Same for
   a PO whose contributing COs are all unmeasured.
3. **A missing survey does not drag the figure down.** With no indirect record the
   direct level is used as-is and flagged `DIRECT ONLY`, rather than blending
   against an implicit zero — which would report a data-collection gap as a
   learning deficit.
4. **Aggregation sums marks and maxima**, never averages per-assessment
   percentages: `(4+25)/(5+50) = 52.7%`, not `(80%+50%)/2 = 65%`. The naive form
   gives a 5-mark quiz the same weight as a 50-mark exam and would flip a student
   across the target.

### No threshold is hardcoded

**NBA prescribes no attainment formula.** Every threshold, level band and weight
comes from `ObeAttainmentPolicy`, and every response carries the policy plus an
explicit caveat that the output **must not be described as "NBA compliant"**.
Proven live: with the same marks, tightening the bands to 90/80/70 moved CO1 from
level 3 to level 1. A test greps the source to ensure no bare percentage literal
creeps back in.

### Also enforced
- CO-wise distribution must total the paper (`totals 40 but the assessment is out of 50`).
- An assessment cannot map another course's outcome.
- A mark above the CO's allocation is refused (`25 exceeds the 20 marks allocated`).
- Marks upsert on (assessment, student, CO) — re-entry after a correction replaced rather than appended (12 rows before and after).
- Only **published** assessments contribute; drafts are listed as excluded with the reason, so "low because marks are still in draft" is distinguishable from genuinely low.
- Publishing is audited at `warning` — it moves an accreditation-facing figure.
- `PSO1`, deliberately left unmapped, is reported as a **curriculum gap**: nothing in the scheme addresses it, so it cannot be attained by construction.
- Coverage is reported (`3 of 3 COs measured across 5 courses`) — a PO computed from 2 of 40 COs is not the same claim as one from all 40.

### Status
Typecheck **0** · Tests **275** (was 246) · Migrations **15**

### OUTSTANDING in this module
- **Question-level granularity is not implemented.** Marks map to a CO per assessment, not per question. Institutions doing question-wise CO tagging would need a finer model.
- No CO/PO **target-setting** or year-on-year trend comparison.
- Attainment is computed on demand and never snapshotted — a published figure could change if marks are later corrected. An accreditation submission needs a frozen record.
- Indirect attainment is a recorded number; no survey instrument exists to produce it.

### NEXT DEPENDENCY
EPIC-11 still blocked on the official NAAC manual, NIRF methodology + DCS and UGC
clause texts. Unblocked: **478 legacy endpoints**, fee **collection** wired to
library fines, the **workflow/approval engine**, and attainment **snapshotting**.

---

## Session checkpoint 14 — Bulk import engine (2026-08-20)

The largest unblocked gap. Without it an institution cannot onboard at all: its
existing records live in spreadsheets, and the alternative is typing a few
thousand students into a web form.

### The constraint that shaped the design

A half-finished import is worse than a failed one. If 3,000 of 5,000 students
load and row 3,001 fails, the registrar cannot tell which records are real, and
the usual recovery — delete and retry — stops working the moment anything
references the new rows.

So the order is fixed: parse the whole file → validate EVERY row → if any row is
bad, write NOTHING → otherwise write all rows in ONE transaction. `dryRun`
stops after validation, and **defaults to true**: the safe outcome is the one
that happens by accident.

### VERIFIED LIVE (27/27 checks, clean run)

- **Dry run left the database untouched** (2 students before, 2 after) while
  reporting all 3 rows valid.
- **One bad row rejected the whole file**: 4 rows, 2 valid, 2 invalid → `status:
  failed`, `importedRows: 0`, and the count stayed at 2. **The 2 valid rows were
  NOT written.**
- Unknown department reported as `reference_not_found` with *"it will not be
  created automatically"* — the phase-0.2 fabrication pattern refused at scale.
- In-file duplicates caught before any write.
- Formula-leading values (`=cmd|' /C calc'!A0`) refused on INPUT.
- Real import: 3 rows, count 2 → 5, **all CGPA = 0** (computed, never imported).
- `"Iyer, Meera"` survived parsing with its comma intact.
- Passwords bcrypt-hashed, none returned in the response, none accepted from the file.
- Re-uploading the identical file refused by content hash, naming the prior job.
- 8 jobs and 4 row errors persisted; bulk creation audited at `warning`.

### A hand-written RFC 4180 parser

The repo had a compliant CSV *writer* but no reader. `split(',')` corrupts every
address and any name written "Rao, Asha". This handles quoted commas, doubled
quotes, embedded newlines, CRLF/LF/lone-CR, and a UTF-8 BOM — which Excel writes
by default and which otherwise becomes part of the FIRST column's name, so
header mapping fails on exactly one column and nothing says why.

A dependency would do this, but adding one to a tree already under triage
(15_DEPENDENCY_TRIAGE.md) is a worse trade than ~200 lines with 20 tests.

### DPDP gate enforced, not assumed

The schema records that caste/category and disability collection is **gated on
legal review (T-407)**. An importer is exactly how such a gate gets bypassed by
accident, so files carrying those columns are refused outright, as is any
Aadhaar column. Verified live.

### A test that found a real defect

"Collects EVERY problem in a row" failed — because a schema violation returned
early, so a row with a bad email AND an unknown department reported only the
email. The operator fixes it, re-uploads, and only then learns about the
department. Each such round trip is a reason imports get abandoned. Reference
resolution now runs on the RAW values, independently of the schema parse. That
was a genuine fix, not a test adjusted to pass.

### Deliberate limits, stated rather than hidden
- **20,000 rows per file.** The whole file is validated in memory, so this is a
  real limit; beyond it, split the file. Better than an OOM crash mid-write.
- **500 errors reported per job**, then truncated with a flag.
- **No streaming and no background queue** — a very large import blocks its
  request. The transaction timeout is raised to 120s for password hashing.
- **No rollback of a completed import.** Undo is not implemented; the duplicate-
  file guard and dry-run are what stand between an operator and a bad load.
- Only students, faculty and courses. Attendance, results and fee history are
  not importable yet.

### Status
Typecheck **0** · Tests **246** (was 193) · Migrations **14**

### NEXT DEPENDENCY
EPIC-11 still blocked on the official NAAC manual, NIRF methodology + DCS, and
UGC clause texts. Unblocked work remaining: **478 legacy endpoints** on the old
pattern, the **OBE attainment engine** (schema exists, no computation), fee
**collection** wired to library fines, and the **workflow/approval engine**.

---

## Session checkpoint 13 — T-203b: library migrated to the service pattern (2026-08-20)

The reference migration. `library.ts` was 298 lines and 7 endpoints, small
enough to migrate completely and representative enough that the cost measured
here is a real estimate for the remaining modules.

### Defects found in one 298-line file

| # | Defect | Consequence |
|---|---|---|
| 1 | **No tenant scoping at all** — `LibraryBook` had no `institutionId` and was absent from `TENANT_OWNED_MODELS` | `libraryBook.count()` counted every institution's books; a `findUnique` by id returned another institution's copy |
| 2 | `isbn` globally `@unique` | A library could hold only ONE copy of any title, and once one institution catalogued a book, no other institution could |
| 3 | No transaction, no row lock on issue | Two concurrent issues both read `available` and both succeeded — one physical book, two borrowers |
| 4 | **Fine taken from the request body** (`req.body?.fine`) | The caller decided what a student owed. `{"fine": 0}` cleared any liability; `{"fine": 99999}` invented one |
| 5 | No audit on any mutation | Nothing recorded who issued, renewed or returned anything |
| 6 | Return set `studentProfileId = null` | Borrowing history destroyed; the fine stayed attached to the copy with no link to who owed it |
| 7 | No pagination | `/books` and `/students` returned entire tables |
| 8 | `/students` returned full profiles | Every student's record exposed to any caller reaching the router |
| 9 | Dashboard counted `status = 'overdue'` | Nothing ever set that status — the figure was permanently zero while looking like a working metric |
| 10 | `collectedFines` summed fines on **unreturned** books | Reported uncollected money under a name claiming the opposite |
| 11 | Renewal permitted on overdue loans | A borrower could extend indefinitely and never incur the fine |
| 12 | `maxRenewals` read from the request body | A book could be catalogued with an arbitrary renewal allowance |

### VERIFIED LIVE (18/18 checks)

Two copies of one ISBN now coexist · pagination metadata returned · mass
assignment rejected (`Unrecognized key: "maxRenewals"`) · issue creates exactly
one loan · second issue refused · renewal policy-driven · **client-supplied fine
refused** (`Unrecognized key: "fine"`) · fine computed as
`6 days overdue, less 1 grace day = 5 chargeable x Rs.2/day = Rs.10.00` ·
borrower retained after return · overdue renewal refused · circulation audited
(3 rows) · no unscoped copies.

### Defence in depth, demonstrated rather than asserted

A partial unique index (`WHERE status = 'active'`) allows one open loan per copy.
Its value was proved accidentally: a seed defect left a copy marked `available`
while its loan was still open. The application-level status check *passed*, and
the index still blocked the double-issue. That state is now a deliberate test —
the catalogue is desynchronised on purpose and the issue must still fail.

The raw `P2002` was translated into a message naming the actual condition, since
"A record with these details already exists" tells a librarian nothing.

### NEWLY DISCOVERED — the seed was failing silently

`npx prisma db seed` returned **exit 0 while the seed itself failed** with a
`P2002`: it upserted `LibraryPolicy` on a synthetic id, colliding with the row
migration 0012 creates per institution (`institutionId` is unique). Everything
after that line never ran.

Two lessons: the seed wrapper's exit code cannot be trusted, and a fixture that
duplicates what a migration already creates will collide. Now upserted on
`institutionId`, and re-run with `tsx` directly to see the real exit code.

### NEWLY DISCOVERED — hidden coupling in a second file

`students.ts` also queried `LibraryBook` directly, duplicating the renewal logic
with the same defects. The compiler surfaced it only after the schema changed.
Both endpoints now delegate to the service, with borrower ownership enforced
*inside* the transaction (`restrictToStudentProfileId`) after the row lock —
a pre-check by the caller could be raced.

**This is the honest cost signal for the remaining migration:** a module is not
self-contained just because it has its own route file.

### NEWLY DISCOVERED — `timestamp` without time zone

`dueAt` is `timestamp(3)` (no zone). Any tool writing local wall-clock — `psql`'s
`NOW()`, for instance — is read back by Prisma as UTC, a 5.5-hour skew here.
Production is unaffected (Prisma writes and reads UTC consistently), but it made
a test fixture wrong and would corrupt any hand-written data fix. **`timestamptz`
is the correct type across the schema** — recorded, not changed, because it
touches every date column and does not belong in this change.

### The superseded file was deleted, not left unmounted

`src/routes/library.ts` is removed (recoverable from commit `6e01c3a`). Left in
place it could be re-mounted, reintroducing a router with no tenant scoping over
tables that now carry `institutionId`. A test asserts it stays gone.

### A test that caught its own bad assertion

The check for "the fine is never read from the request body" initially matched
the *comment* in the route file describing the removed pattern — which would have
pressured a maintainer into deleting the documentation to make the test pass.
Same trap as the CI secret-detection gate. Comments are now stripped first, and a
negative control asserts the regex still detects the real pattern.

### Status
Typecheck **0** · Tests **193** (was 172) · Migrations **13**

### Cost measured, for planning the rest
One 298-line module → ~1,050 lines across service/routes/fines/tests, 2
migrations, plus edits to a second route file. The schema work dominated; modules
whose tables already carry `institutionId` should be substantially cheaper.
**478 endpoints remain on the legacy pattern.**

### OUTSTANDING in this module
- No reservation/hold queue; no fine *collection* (fines are computed and tracked, but settling one is not wired to the finance module's payment flow).
- `LibraryBook.status` and `LibraryLoan` can still disagree if written outside the service; the constraint catches the dangerous case but there is no reconciliation report.
- No concurrent load test — the locking is reasoned and constraint-backed, not measured.

### NEXT DEPENDENCY
Unchanged. EPIC-11 blocked on official documents; **bulk import engine** is the
largest unblocked gap.

---


Statuses: `NOT STARTED` · `IN PROGRESS` · `BLOCKED` · `IMPLEMENTED` (code written) · `TESTED` (tests pass) · `VERIFIED` (full chain demonstrated against a running system)

> A task is **not** `VERIFIED` merely because code was written.

---

## Session checkpoint — 2026-08-19

### COMPLETED & VERIFIED

All verified against a **running server** with a migrated + seeded PostgreSQL database, by live HTTP request.

| Task | What was proven | Evidence |
|---|---|---|
| T-001 | JWT secret fallback removed; boot fails without it | Forged token signed with legacy `supersecretkey123` → **401** |
| T-002 | `.env.example` documents all variables | File present |
| T-003 | CORS/port/pool configurable | Server boots from `config/env.ts` |
| T-004/5/6/7/8 | **No data fabrication** | `GET /students/dashboard` as a user with no student profile → **404**, `StudentProfile` count unchanged (1 → 1) |
| T-009 | Uploads require auth | Old public path `/uploads/...` → **404**; `/api/uploads/...` without token → **401** |
| T-010 | MIME allowlist | `.html`/`.svg` rejected by `fileFilter` |
| T-011 | Login rate limiting | Attempts 1-4 → 401, **attempt 5+ → 429** |
| T-012/13 | No default passwords | No password → **400**; `password123` → **400** with 3 policy violations |
| T-014 | Seed env guard | Refuses unless `NODE_ENV=development` or `ALLOW_SEED=yes` |
| T-015 | Frontend 401 interceptor | Response interceptor + `SESSION_EXPIRED_EVENT` wired to `AuthContext` |
| T-016 | Backend typecheck | **36 errors → 0** |
| T-101 | `FacultyLessonPlan` modelled | 5 references in `migration.sql`; runtime DDL deleted |
| T-102 | **Baseline migration** | `20260818212826_0001_baseline` created and applied |
| T-201 | Error taxonomy | 404/400/403/409 now returned correctly instead of blanket 500 |
| T-207 | Structured logging | JSON logs with `requestId`; secrets redacted |
| T-208 | Security headers | `X-Content-Type-Options`, `X-Frame-Options`, CSP, `Referrer-Policy` present |
| T-210 | Real readiness check | `/api/ready` → `{"status":"ready","database":"connected"}` |
| T-212 | Pool configured; DB TLS verified | `rejectUnauthorized` now defaults ON |
| T-103 | **Audit trail writes** | `SystemAuditLog` row created on user creation — **first real audit row this system has ever produced** |

**Also verified:** RBAC still enforced correctly — `registrar` → `/admin/users` returns **403**.

### Regression check
Backend typecheck clean (0 errors). All 478 handlers migrated from the leaky `res.status(500).json({message: error.message})` pattern to `sendError(res, error)` — no raw internal messages reach clients. No existing endpoint signature changed.

### NEWLY DISCOVERED ISSUES
| Finding | Detail | Action |
|---|---|---|
| `exactOptionalPropertyTypes` is enabled | Stricter than the audit assumed; required `\| undefined` on optional context types | Fixed |
| Prisma 7 dropped `--skip-seed` on `migrate dev` | Audit's assumed command is wrong for this version | Noted in `05_DATABASE_PLAN.md` |
| Rate limiter state is per-process | Confirmed live: restarting the server cleared the lockout | Documented in code; needs Redis for multi-instance (T-P2) |
| `userName` recorded as "unknown" in audit rows | Audit context takes id/role from JWT, which carries no name | **T-110** — resolve name in the audit service |

### BLOCKED
| Item | Blocker |
|---|---|
| T-301 tenancy decision | Product decision needed — **must be made before Phase 3** |
| T-407 demographics | DPDP legal review required before collecting caste/income/disability |
| EPIC-11 compliance engine | Official NAAC manual / NIRF DCS / UGC clause texts not obtained |

### NEXT DEPENDENCY
**T-203 — extract the service layer.** It gates validation, transactions and object-level authz at reasonable cost (18 modules vs 478 endpoints).

---

## Task register

### Phase 0 — Repository Stabilization ✅ COMPLETE

| Task | Priority | Status | Tests | Files Changed | Notes |
|---|---|---|---|---|---|
| T-001 | P0 | **VERIFIED** | Manual (live) | `config/env.ts`, `middleware/auth.ts`, `routes/auth.ts` | Rejects legacy secret explicitly |
| T-002 | P0 | **VERIFIED** | — | `.env.example` | |
| T-003 | P1 | **VERIFIED** | — | `config/env.ts`, `server.ts` | |
| T-004 | P0 | **VERIFIED** | Manual (live) | `routes/students.ts` | Fabricated `cgpa: 8.5` removed |
| T-005 | P0 | **VERIFIED** | Manual (live) | `routes/faculty.ts` | Fabricated PhD removed; 38 call sites |
| T-006 | P0 | **VERIFIED** | Manual (live) | `routes/faculty.ts` | 8-week auto lesson plans removed |
| T-007 | P0 | **VERIFIED** | — | `routes/faculty.ts` | Class synthesis removed |
| T-008 | P0 | **VERIFIED** | — | `routes/students.ts` | Enrolment synthesis removed |
| T-009 | P0 | **VERIFIED** | Manual (live) | `server.ts`, `routes/uploads.ts` | `express.static` mount deleted |
| T-010 | P1 | **VERIFIED** | Manual (live) | `routes/uploads.ts` | Extension+MIME must agree |
| T-011 | P1 | **VERIFIED** | Manual (live) | `middleware/rateLimit.ts` | Keyed on ip+email |
| T-012 | P1 | **VERIFIED** | Manual (live) | `lib/password.ts`, `routes/admin.ts` | Also fixed mass assignment on role |
| T-013 | P1 | **VERIFIED** | Manual (live) | `routes/placements.ts` | Temp password returned once |
| T-014 | P0 | **IMPLEMENTED** | — | `prisma/seed.ts` | |
| T-015 | P1 | **IMPLEMENTED** | — | `src/lib/api.ts`, `src/context/AuthContext.tsx` | Needs browser verification |
| T-016 | P2 | **VERIFIED** | `tsc` | `routes/finance.ts`, others | 36 → 0 errors |
| T-017 | P2 | IN PROGRESS | — | — | 22 frontend errors remain |
| T-018 | P1 | NOT STARTED | — | — | 53 dependency vulns |

### Phase 1 — Database Foundation 🔷 IN PROGRESS

| Task | Priority | Status | Notes |
|---|---|---|---|
| T-101 | P1 | **VERIFIED** | `FacultyLessonPlan` modelled with real FK |
| T-102 | P0 | **VERIFIED** | Baseline migration applied |
| T-103 | P0 | **VERIFIED** | Audit service live; **emitted on admin user create/update, lesson plans, uploads only** — remaining mutations pending T-203 |
| T-104 | P0 | NOT STARTED | History tables for grades/marks/fees |
| T-105 | P1 | NOT STARTED | ~40 string refs → FKs |
| T-106 | P1 | NOT STARTED | Soft delete + retention |
| T-107 | P2 | NOT STARTED | Enums |
| T-108 | P2 | 🔷 PARTIAL | Indexes added on `Course`, `CourseSchedule`, `FacultyLessonPlan` |
| T-109 | P0 | NOT STARTED | **Backup + tested restore** |
| T-110 | P2 | NOT STARTED | *(new)* Resolve `userName` in audit records |

### Phase 2 — Architectural Foundation 🔷 PARTIAL

| Task | Priority | Status | Notes |
|---|---|---|---|
| T-201 | P2 | **VERIFIED** | Taxonomy + `sendError` across all 478 handlers |
| T-202 | P1 | NOT STARTED | zod middleware |
| T-203 | P2 | NOT STARTED | **Service layer — next critical dependency** |
| T-204 | P1 | NOT STARTED | Transactions |
| T-205 | P1 | NOT STARTED | Idempotency |
| T-206 | P1 | NOT STARTED | Pagination |
| T-207 | P1 | **VERIFIED** | Structured logging |
| T-208 | P2 | **VERIFIED** | Security headers |
| T-209 | P1 | NOT STARTED | Object storage |
| T-210 | P2 | **VERIFIED** | `/api/ready` |
| T-211 | P1 | **VERIFIED** | DB TLS verification on by default |
| T-212 | P2 | **VERIFIED** | Pool sized |

### Phases 3–12 — NOT STARTED

See `04_MODULE_TASK_MATRIX.md`.

---

## Progress

| Priority | Total | Verified | Implemented | Remaining |
|---|---:|---:|---:|---:|
| **P0** | 14 | **11** | 1 | 2 |
| P1 | 29 | 8 | 1 | 20 |
| P2 | 24 | 5 | 0 | 19 |
| P3 | 8 | 0 | 0 | 8 |
| **Total** | **75** | **24** | **2** | **49** |

## How to run this locally

```bash
cd backend
cp .env.example .env    # then set DATABASE_URL and generate JWT_SECRET
npx prisma migrate deploy
npx prisma db seed      # development only
npm run start
```

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Session checkpoint 16 — Phase 0 complete, Phase 1.1 partial (2026-08-22)

### Phase 0 — done
Librarian regression fixed and **verified in a browser** (return produced
`6 day(s) overdue, less 1 grace day(s) = 5 chargeable x Rs.2/day = Rs.10.00`).
App run in a browser for the first time; 6 role dashboards render real data with
zero console errors. Frontend TypeScript **22 -> 0**. Gap map corrected (44 edits).
Baseline recorded in `17_FRONTEND_BASELINE.md`.

Also fixed en route: `getApiErrorMessage` read only `data.message`, so **every
error from every rebuilt module was discarded** and shown as "API Error".

### Phase 1.1 — timestamptz conversion APPLIED, but it surfaced a deeper defect

Migration `0016_timestamptz` converted **277 columns** to `timestamptz(3)` using
`AT TIME ZONE 'UTC'`, with an in-migration drift check that aborts if any instant
moves. Applied cleanly. Typecheck 0, **275 tests pass**, API responses unchanged.

**Restore point taken first and PROVEN restorable:**
`campus_harmony_2026-08-22T17-56-34-493Z.dump` — 156 tables, restore drill PASS.

### THE FINDING — a pre-existing driver-level timezone skew

An empirical probe (write a known instant through Prisma, read it back, compare
against the raw row) shows:

```
WROTE (JS, UTC)      : 2026-01-15T10:00:00.000Z
READ BACK via Prisma : 2026-01-15T10:00:00.000Z    <- self-consistent
RAW stored, as UTC   : 2026-01-15 04:30:00         <- a DIFFERENT instant
```

**Prisma writes 10:00Z, the database stores 04:30Z, and Prisma reads back 10:00Z.**
Write and read apply the local +5:30 in opposite directions, so the application
never notices while every stored value is off by the local offset.

`src/lib/prisma.ts` creates its `Pool` with **no session timezone**, so
node-postgres uses the server default (IST here).

**This predates migration 0016.** Evidence: before the migration the librarian UI
already displayed `8/17/2026` for a loan whose stored value was `2026-08-16
21:34:20`. The conversion preserved the existing relationship rather than creating
it — which is why nothing broke.

### Why this matters
- Any consumer other than Prisma — psql, BI tools, a hand-written data fix,
  `pg_dump` inspection — reads every timestamp 5.5 hours off.
- On a server in a different zone, the skew differs, so the same code produces
  different stored values per deployment.
- It already bit once: the checkpoint-13 fixture that produced a wrong fine.

### RESOLVED — driver pinned to UTC, history realigned

**Decision: fix the driver AND move the rows**, because the application's
semantic truth is what Prisma reported. Fixing the driver alone would leave every
historical record reading one offset earlier than it always had — an audit entry
stamped 16:48 would become 11:18. Silently rewriting an audit trail to work
around a driver bug is not acceptable in an institutional record system.

| Change | Detail |
|---|---|
| `src/lib/prisma.ts` | Pool now sets `options: '-c timezone=UTC'` |
| Migration `0017` | Realigns rows written under the skew, via `AT TIME ZONE` per row rather than a fixed interval, so it stays correct across a DST boundary in any zone that has one |

**Verified after the fix:**
```
WROTE (JS, UTC)      : 2026-01-15T10:00:00.000Z
RAW stored, as UTC   : 2026-01-15 10:00:00      <- now the same instant
READ BACK via Prisma : 2026-01-15T10:00:00.000Z
```
And the decisive check — an application-visible value BEFORE and AFTER the whole
campaign:
```
API dueAt before : 2026-08-17T03:04:20.356Z
API dueAt after  : 2026-08-17T03:04:20.356Z   MATCH
DB row moved     : 2026-08-16 21:34:20+00  ->  2026-08-17 03:04:20+00
```
The database moved to the instant it should always have held; nothing a user sees
changed.

**Guards added** (`src/__tests__/timezone.test.ts`): the pool must stay pinned to
UTC, every `DateTime` field must declare `@db.Timestamptz`, migration 0016 must
assert UTC explicitly, and 0017 must refuse to run twice — applying the shift
again would move everything by another offset with nothing reporting an error.
Includes a negative control so the pool assertion is known to fail when it should.

### Status
Typecheck **0** · Tests **280** · Migrations **17** · Frontend TS **0**

### NEXT
Phase 1.2 — the ~40 string references that should be foreign keys.

## Session checkpoint 17 — Phase 1.2a: Institution foreign keys (2026-08-23)

### The estimate in the plan was wrong — corrected
`16_REMEDIATION_PLAN.md` said "~40 string references". The real survey found
**110 unconstrained `*Id` columns**. Recording that because the plan's other
estimates rest on the same kind of guess.

### Survey first, migration second
| Finding | Count |
|---|---|
| Unconstrained `*Id` columns | 110 |
| Target inferable from the name | 77 |
| **Orphaned references among those 77** | **0** |
| `institutionId` (handled in 0018) | 44 |

**Not references, despite the name** — excluded deliberately:
`FacultyProfile.employeeId` (staff number), `FeeRecord.transactionId` (gateway
string), `NotificationDelivery.providerMessageId`, `Institution.nirfId`,
`LibraryBook.currentLoanId` (denormalised; a FK would cycle with
`LibraryLoan.bookId`), and `FileMetadata.relatedEntityId` — **polymorphic**, its
target depends on `relatedEntityType`, so a foreign key cannot express it at all.

### Ambiguous columns resolved by EVIDENCE, not by name
For 25 columns the target was genuinely ambiguous (`studentId` → StudentProfile
or User?). Each candidate was tested against the actual values; 13 resolved to
exactly one table, 12 have no rows and were left alone.

**This caught one that name-matching would have got wrong:**
`FeedbackResponse.studentId` points at **User**, not StudentProfile — consistent
with the schema's note that feedback is anonymised. Guessing from the name would
have attached the wrong table.

### Why institutionId first
It is the TENANT KEY. Every read is scoped by it (ADR-0001), so a row naming a
non-existent institution is not merely inconsistent — it matches no caller, and
vanishes from every query, export and report. **Invisible data loss, with no
error anywhere.**

### VERIFIED
- **50 `institutionId` foreign keys** in place (44 added, 6 pre-existing)
- 44 Prisma `@relation` declarations + back-relations added, so schema.prisma and
  the database agree — a DB-only constraint would have drifted from the schema
- Orphan rejected in practice:
  `insert ... violates foreign key constraint "FeeRecord_institutionId_fkey"`
- **`ON DELETE RESTRICT` proven**: deleting an institution that still has data
  fails —`still referenced from table "Campus"`. CASCADE would have erased a
  university's entire record set from one statement.
- Live API unchanged after the campaign.

### Status
Typecheck **0** · Tests **280** · Migrations **18** · Frontend TS **0**

### NOT DONE — Phase 1.2b
33 non-`institutionId` references remain unconstrained (Campus 7, StudentProfile
7, Department 6, User 5, plus the 13 empirically resolved). Same method applies:
survey, check orphans, declare in Prisma, constrain. Then 1.3 (enums) and 1.4
(soft delete).

## Session checkpoint 18 — Phase 1.2b: remaining foreign keys (2026-08-23)

### Result
**190 foreign key constraints** in the database. Only **6** references remain
unconstrained, all deliberately.

Migration `0019` added 52: StudentProfile 16, User 12, Campus 7, Department 6,
Course 2, Section 2, and one each to Batch, Programme, SchemeCourse, ExamSession,
FeeRecord, SportsTeam. Orphan check across all 52 returned **zero** before any
constraint was added.

### `ON DELETE` differs per column, deliberately
| Nullability | Action | Reasoning |
|---|---|---|
| Required | `RESTRICT` | A grade with no student, or an allocation with no fee record, is not a meaningful row |
| Optional | `SET NULL` | `classAdvisorUserId`, `hodUserId` are *assignments* — a departing staff member should clear the assignment, not block deletion or destroy the department |

### The one that name-matching would have got wrong
`FeedbackResponse.studentId` references **User**, not StudentProfile — every
other `studentId` in the schema means StudentProfile, but feedback is anonymised.
Confirmed by testing the values against both candidates in 1.2a. A name-based
guess would have pointed the constraint at the wrong table and silently rejected
valid feedback from then on.

### NOT constrained — 6 columns, deliberately
`ClassMessage.facultyId`, `Committee.facultyId`, `MenteeAssignment.facultyId`,
`CounselingNote.menteeAssignId`, `RevaluationRequest.courseResultId`,
`InstitutionalPolicy.supersedesPolicyId`.

All have zero rows, so the target could not be confirmed empirically, and the
name alone is ambiguous — `facultyId` could mean FacultyProfile or User. **A
wrong guess is worse than no constraint**: it rejects valid inserts later, and
nothing points at the migration as the cause.

### VERIFIED
- Orphan rejected in practice:
  `insert on "Payment" violates foreign key constraint "Payment_studentProfileId_fkey"`
- Typecheck 0 · **280 tests** · live API unchanged (library history, reports)
- 52 Prisma relations + back-relations declared, so schema.prisma and the
  database agree rather than drifting

### A mistake worth recording
Adding the `Department.hodUserId -> User` relation made the PRE-EXISTING
`User.department` pair ambiguous, and my first fix used an unscoped regex that
renamed a field in the wrong model — three models each have `users User[]`.
Reverted from backup and redone with model-scoped edits. **Blind regex over a
2,000-line schema is not a safe editing method**; every subsequent edit was
confined to a single model block.

### Status
Typecheck **0** · Tests **280** · Migrations **19** · Frontend TS **0**
FK constraints **190** · Unconstrained references **6** (documented above)

### NEXT
Phase 1.3 (status columns -> enums) and 1.4 (soft delete), then 1.5 performance
baseline, 1.6 Docker build, 1.7 off-host backups.

## Session checkpoint 19 — Phase 1.5 and 1.7; 1.3/1.4/1.6 not done (2026-08-23)

### 1.5 Performance baseline — DONE (first ever taken)
5,005 students / 10,003 fee records / 5,004 results. **Nothing exceeded 35 ms at
p95.** Heaviest was `reports/EXAM_PASS_RATE` (p50 13 ms, p95 34 ms). Pagination
caps held — `pageSize=100` was not materially slower than 25. Synthetic rows were
tagged and removed; the database is back to 5 students. Full numbers and the
explicit limits of this measurement are in `18_PERFORMANCE_BASELINE.md`.

**Dev-machine figures**: no network, no concurrency, warm local database. A floor
and a regression reference, not a capacity estimate.

### The bug the measurement found
Calling the ledger as each role returned **403 for `finance_officer`**. Cause: the
finance module gated on **`accountant`, a role that does not exist here**. The
finance officer — the one person who records payments and reads ledgers — could
not use any of the finance module, read or write. Every earlier verification had
run as `super_admin` or `registrar`, so nothing caught it.

Fixed and verified HTTP 200. Guard added (`src/__tests__/roles.test.ts`): any
`authorizeRoles()` referencing a role the system does not issue now fails the
build, with a negative control proving the check rejects `accountant`. A sweep
found no other invented roles.

**Why this class is dangerous:** a nonexistent role does not throw. The gate never
matches, and the endpoint is silently unreachable — indistinguishable from a
deliberate permissions decision.

### 1.7 Off-host backup replication — MECHANISM DONE
`BACKUP_REPLICA_DIR` copies every verified backup to a second location and
**re-hashes at the destination** rather than trusting the copy. Three paths tested:

| Case | Behaviour |
|---|---|
| Unset | Warns loudly that the backup exists on one host only |
| Set and reachable | Copied; source and replica checksums matched |
| Set and unreachable | **Fails, exit 1** — never silently skips |

A process that quietly skips replication is worse than one that fails: it reports
success while leaving a single point of failure. **The destination is yours to
provide** (network share, mounted volume, sync target) — the mechanism is built,
the target is configuration.

### NOT DONE, and why

| Item | Status |
|---|---|
| **1.3 enums** | **Not started.** 136 status-like columns, 91 distinct `status` columns, each needing its own type. Values must come from what the CODE writes — an empty table does not reveal its valid set — and a wrong set makes valid writes fail. Too large to do safely in the remaining budget. |
| **1.4 soft delete** | **Not started.** Correctness-critical: every query must filter `deletedAt`, including the tenant extension, or deleted rows silently reappear. |
| **1.6 Docker build** | **Blocked.** Docker is not installed on this machine (`docker: command not found`). Unchanged from the original assessment; the Dockerfile remains unbuilt and unverified. |

### Status
Typecheck **0** · Tests **284** · Migrations **19** · Frontend TS **0**
FK constraints **190** · Perf baseline recorded · Backup replication built

## Session checkpoint 20 — Phase 1.3 and 1.4 complete (2026-08-23)

Restore point first: `campus_harmony_2026-08-22T19-45-53-092Z.dump` (156 tables).

### 1.3 Status constraints — DONE (24 columns)

**A deliberate deviation from the plan.** It said "status columns -> enums";
CHECK constraints were used instead:

1. A Prisma enum changes the generated TypeScript type from `string` to a union.
   Every service assigning a status, every zod schema and every fixture would
   need rewriting across 91 columns — for no integrity the constraint does not
   already provide.
2. Adding a value later is `ALTER TYPE ... ADD VALUE`, which cannot remove a
   value at all. Replacing a CHECK is one reversible statement, and institutions
   *do* extend their workflows.
3. Prisma does not model CHECK constraints, so there is no schema drift.
   (Contrast foreign keys, which it does model — hence 0018/0019 also declared
   relations.)

**Values came from the schema's own doc comments**, e.g. `/// pending | partial |
paid | waived | overdue`, written alongside the services that assign them.
Current table contents were explicitly NOT the authority: an empty table yields
an empty set, and a constraint built from that rejects every future write.

Verified: `UPDATE ... SET status='Issued'` → **rejected**; `status='damaged'` →
accepted. That is precisely the `'issued'`/`'Issued'` drift the plan named.

**Scope:** 24 columns with a documented state machine. ~67 legacy status columns
have no documented set; guessing would reject writes the application still makes.
Left until their modules are migrated (Phase 3).

### 1.4 Soft delete — DONE (14 models)

`deletedAt` + `deletedBy` on people, academic units and records — **not** on
append-only history (audit log, grade history, deliveries), which is evidence and
is already protected by ON DELETE RESTRICT.

Filtering is **structural**, injected by the Prisma extension in the same place
tenant scoping is. A rule enforced at 500 call sites is not a rule. Bypassing
requires an explicit, greppable `includeDeleted(reason, fn)`. `softDelete()`
requires a reason of 10+ characters and audits at `warning`.

Verified against a live database: count dropped by exactly 1, the row became
invisible to `findFirst`, and the escape hatch reached it.

### THE BUG THIS UNCOVERED — a latent flaw in `runUnscoped`

The escape hatch failed on first test. Cause: **Prisma queries are lazy.**
`prisma.x.findFirst()` returns a PrismaPromise that does not execute until
awaited, so returning it from `storage.run()` means the query runs AFTER the
AsyncLocalStorage context has exited — the flag is unset and ordinary filters
apply.

**`runUnscoped` had the identical flaw** and had carried it since checkpoint 3.
It failed *closed* (the tenant check throws rather than leaking), which is why
nothing surfaced — but it failed for a reason no call site could see. Every
existing caller happened to use the `async () => { await ... }` form, which works.

Both now await inside the context (`async () => await fn()`). Typecheck confirmed
every call site was already async-compatible.

### Status
Typecheck **0** · Tests **295** · Migrations **21** · Frontend TS **0**
FK constraints **190** · Status constraints **24** · Soft delete **14 models**

### Phase 1 remaining
Only **1.6 Docker build**, still blocked — Docker is not installed on this
machine. Everything else in Phase 1 is done.

## Session checkpoint 21 — Phase 2.1 catalogue + a P0 fix (2026-08-23)

### The catalogue found a cross-tenant AUTHORITY breach

`ApprovalItem` had no `institutionId` and was not in `TENANT_OWNED_MODELS`, so
**every institution shared one approval queue**. Demonstrated live: the Default
Institution's HOD listed another institution's confidential item and then
successfully **approved** it.

Worse than the leaks closed in 0010/0012 — those exposed data, this exposed
authority. A decision on another university's budget, by someone with no standing
there, with nothing in the record showing a boundary was crossed.

Three defects in one mechanism:
1. Not tenant-scoped
2. `data: { status }` written raw from the request body — any string, states skippable
3. No `decidedBy`/`decidedAt` — recorded who requested, never who approved

**Fixed (0022, 0023) and verified:** rival item invisible; approving it returns
404; row untouched (`pending`, no decider); `"banana"` rejected; a legitimate
approval records the decider; deciding twice returns 404.

The key mechanic: every transition moved from `update({ where: { id } })` to
`updateMany` — **the tenant extension can constrain a where clause but cannot
filter a unique-key update**, which is exactly why update-by-id was exploitable.

### A mistake, and the cost

0022 constrained `status` to the four values in the model's inline comment. The
comment was incomplete — `dean.ts` also writes `published` — so the constraint
**broke the result-publication path**. Corrected in 0023 after auditing the code.

This is the failure mode Phase 1.3 documents: the CODE is the authority, not a
comment. I followed that rule for the 24 columns in 0020 and did not follow it
for the one model I had not written. Re-audited all 24 afterwards — none had the
same gap.

### Also recorded
- **27 tables** carry approval state, against only 9 approval-shaped endpoints —
  most approvals are inline status flips, not routed decisions.
- Several handlers create an `ApprovalItem` already `approved`. Nothing is routed
  to anyone; they are **activity log entries wearing approval clothing**, and a
  future engine must not inherit them as approvals.

### A test I removed rather than bent
"A decision on a request-supplied id must filter on the pending state" is real
and implemented, but per-HANDLER while the checks are per-FILE. `dean.ts` reads
`req.params.id` in one handler and calls `updateMany` in another, so a file-level
regex either passes it wrongly or fails it wrongly — both were tried. Replaced
with a documented gap plus the live verification. A test that cannot express its
property passes for the wrong reason and nobody revisits it.

### Status
Typecheck **0** · Tests **302** · Migrations **23** · Frontend TS **0**
Full catalogue: `19_APPROVAL_CATALOGUE.md`

### NEXT — Phase 2.2
The catalogue changes the brief: the requirement is heterogeneous (entity flags,
queue items, multi-step publication), so a single generic engine may be the wrong
shape. Recommendation: model definition → step → instance → transition with the
transition LOG as the primary record, migrate the four uniform
`PUT /approvals/:id` handlers first, and leave per-entity flags to Phase 3.

---

## Checkpoint 22 — Phases 2.3, 2.4 and 3a

### 2.3 — Workflow engine, verification closed at 15/15
Two of three earlier failures were harness defects, not product defects: a grep
for wording migration 0025 had replaced, and a fixture cleanup that deleted
definitions before instances (`WorkflowInstance → WorkflowDefinition` is
ON DELETE RESTRICT *by design* — a process must not be removable while decisions
made under it still exist).

The third was worse than a failure. A broken arithmetic expansion made one check
abort before calling `pass` or `fail`, and the run printed **ALL CHECKS PASSED**
having silently skipped it. Both scripts now declare `EXPECTED_CHECKS` and report
INCOMPLETE if fewer ran. A harness that can skip a check and still report success
is worse than no harness.

### 2.4 — Result publication on the engine
Closed a governance defect, not just a refactor. `PUT /dean/results/:id/approve`
did not require a submission: finding no row it **created one already marked
`published`**, so results the CoE never submitted could be published and the
record afterwards showed an approval with no request behind it. And
`POST /coe/results/:id/submit` reset any existing row to `pending`, including one
already published — a decided item reopened in place, published twice, no trace.

Both follow from keeping a process in a status column, which cannot express
"this may only happen after that". HTTP contracts unchanged; `ApprovalItem`
gained `workflowInstanceId` (0026) and became a projection of the transition log.
**12/12 live**, including a `principal` — allowed by the route mount, refused by
the step.

### 3a — Examination schedule, and the measured cost
`ExamProgress` had no tenant key. The identical line in `coe.ts` and
`registrar.ts`:

    prisma.examProgress.update({ where: { id }, data: req.body })

— a unique-key update the extension cannot constrain, carrying an unfiltered
body. Proven live: a planted rival exam was listed by another institution's CoE
and then renamed through the API. Closed by 0027 + `modules/coe/exams.*`.
**13/13 live.**

### The find that matters most
**The service layer does not get automatic tenant scoping.** The extension wraps
`prisma`, but services import `basePrisma`, and `mutate()` opens its transaction
on `basePrisma` — so `tx` is unscoped too. Safety depends on the author writing
`institutionId` into every `where`.

Found by getting it wrong: my first `exams.service.ts` copied library's *import*
pattern without its *where-clause* pattern, and reintroduced the same
cross-tenant authority breach **through the layer meant to prevent it**. The unit
suite was green throughout; only the live probe caught it.

### Debt recorded, not hidden
`update({ where: { id }, data: req.body })` appears **17 times across 9 route
files**. These are NOT fixed. They are held by a ratchet in
`serviceScoping.test.ts`: the count may not grow, and lowering it means editing
the inventory. My first count missed `grievances.ts` because I used an
exact-string grep; the number now comes from the same regex as the test.

### Also fixed while verifying
- The **seed threw at line 694 of 1829** — `ApprovalItem.institutionId` became
  required in 0022 and the seed was never updated. ~60% of the seed had never run
  on a fresh database: `academicYear`, `feeStructure`, `moduleConfig`,
  `departmentBudget`.
- **`principal` and `auditor` existed only as ad-hoc rows.** A fresh
  `migrate reset && seed` produced neither, while `server.ts` mounts `principal`
  on five routers and `auditor` on every oversight router. Two roles that could
  not be logged into, so were never exercised.
- `WorkflowInstance.endedAt` lacked `@db.Timestamptz(3)`.
- Verification scripts moved into `backend/scripts/verify/`. They had lived
  outside the repository, so none of the evidence behind any phase was
  reproducible by anyone else.
- `.gitignore` now excludes `backend/backups/` and `backend/uploads/` — the
  uploads first staged included **vigilance material** that Phase 0.3 put behind
  authentication.

### Status
Typecheck **0** · Tests **336** (18 files) · Migrations **27** · Live checks **40/40**

### NEXT — Phase 3b
Not started. ~450 handlers remain: weeks of work, not a session. Order by risk:
the **17 mass-assignment handlers first** — each is a live cross-tenant write, a
security queue rather than a refactor queue — then `grievances.ts` (confidential
and anonymous submissions, worst blast radius), then the oversight modules.

The highest-value structural change would be making the service layer scoped by
construction: have `mutate()` open its transaction on the extended client, or add
a repository wrapper requiring a `TenantContext`. Until then every new service is
one forgotten `where` clause away from the breach above, and a test is the only
thing in the way. Full numbers: `20_PHASE_3_BASELINE.md`.

---

## Checkpoint 23 — Phase 3b: the mass-assignment queue, closed

All **17 handlers across 9 route files** that carried
`update({ where: { id }, data: req.body })` are migrated. Both defects are gone.

### The second defect was the worse one
16 of the 17 models had **no `institutionId` at all**. Sports rosters, incident
reports, journal entries, anti-ragging affidavits, transfer requests, broadcast
messages, quality metrics and accreditation checklists were single global tables
— readable and writable by any authenticated holder of the relevant role, from
any institution. Fixing only the request-body half would have left that open.

- **0028** — tenant keys on all 16, backfilled from a foreign key where one
  existed, otherwise only for rows whose id marks them as seed data. Anything
  else aborts, per the rule set in 0027.
- **0029** — `Course.institutionId` nullable → NOT NULL. A nullable tenant key is
  a hole in the filter: a NULL row matches no institution and becomes invisible
  rather than leaking. Applying it **exposed a live bug** — `dean.ts` and
  `hod.ts` created courses with no tenant key, so every course created through
  those screens was written successfully and then unreachable.
- **`modules/common/entityUpdate.*`** — one helper plus a `.strict()` schema per
  handler. The omissions are the point: ledger amounts, counters, provenance
  (`sender`, `sentAt`, `createdBy`), identity fields and derived values are all
  refused. `totalValue` is recomputed from its operands, never accepted.

### Two more fabrications removed
`iqac.ts` **invented quality metrics** when the table was empty — a NAAC
"Overall Score" of 3.24 against a target of 3.5, written on first page load and
thereafter indistinguishable from measured figures. That is the `getOrCreate*`
pattern Phase 0.2 removed elsewhere, surviving in the module whose whole purpose
is accreditation evidence. The hardcoded `target: "3.5"` went with it. The
dashboard now says `N/A` / `Not set` when nothing has been recorded.

### Guards added
- `serviceScoping.test.ts` ratchet is at **zero**, and was **proven to still
  fail**: planting one violating handler produced
  `sports.ts has 1 handler(s) writing a model from req.body; 0 recorded`;
  removing it returned the suite to green.
- `seedTenancy.test.ts` — the seed writes most rows through
  `upsertById(delegate: any, ...)`, which erases the Prisma input type, so a
  missing required column is invisible to `tsc` and `prisma db seed` exits 0 even
  when the seed throws. That combination has now bitten this project three times
  (0022, 0027, and 0028 would have been the third). This checks it without a
  database.

### Status
Typecheck **0** (backend + frontend) · Tests **404** (19 files) ·
Migrations **29** · Live checks **54/54**

### NEXT
~430 handlers remain, and the security queue is now empty — what is left is
refactoring rather than exposure. Order: `grievances.ts` (confidential and
anonymous submissions, worst blast radius), then the oversight modules.

Still outstanding, recorded rather than fixed: **five tenant-owned models keep a
nullable `institutionId`** — User, StudentProfile, FacultyProfile, Department,
AcademicYear. All hold zero NULL rows today. Each is load-bearing for
authentication or enrolment and deserves its own migration with its own
verification, rather than being swept into a change about something else.

The structural fix remains the highest-value change: make the service layer
scoped by construction, so a forgotten `where` clause cannot reach production.

---

## Checkpoint 24 — Fabricated figures removed from five modules

Triggered by "fix the module with issues". Every module dashboard returned 200,
so nothing was hard-broken; the issues were **figures that were invented rather
than measured**. Found by reading responses, not by any failing test.

### students.ts — the screen students actually see
| Defect | What it did |
|---|---|
| `change: '+0.2', changeType: 'increase'` | A literal. The CGPA tile claimed a rise of 0.2 on **every render**, including for a student never graded. |
| `value: profile.cgpa` | Read a stored column that defaults to 0 and, per its own schema comment, is never written directly. Real results are in `SemesterResult`, so every student saw 0. |
| attendance `: 100` fallback (**3 sites**) | No attendance records rendered as **100%**. Absence of data shown as perfect attendance. |
| `internalMarks : 0` | "Not yet graded" collapsed into "scored zero". |
| `upcomingEvents` | One invented row, `title: 'Mid Semester Exams Check'`, dated `new Date()` — permanently happening now. |
| fee filter | Only `pending`, so a part payment made the balance understate what was owed. |

Now: CGPA from published `SemesterResult` with a **real** delta between the last
two semesters; attendance reports "No records" with `present/total` provenance;
events come from `ExamSchedule`; fees include `pending|partial|overdue`.

**Proven on real data**, not just the empty branch — two published semesters were
planted (7.80 → 8.15) and the tile returned `8.15` with `+0.35`, then the probe
rows were removed.

### faculty.ts — feedback scores were invented
`responses.length > 0 ? 4.0 : 0`, plus 4.1 / 4.0 / 3.9 for three fixed
categories. A course with one scathing response and one with fifty glowing ones
both reported 4.0 — nothing read what students wrote. The category names
("Course Delivery", "Clarity", "Assessment Quality") did not even match the
questions; responses are JSON keyed by the actual form fields.

Now averaged from the real answers, reporting the keys students answered.
Verified live: the one seeded response `{content:5, teaching:4, engagement:4}`
now yields **4.33**, not 4.0.

### coe.ts / dean.ts / vc.ts
`avgGPA: 7.2` — identical for every department, semester and cohort, on the
result-oversight screens. `trend: '+0.0%'` on every VC revenue line with no prior
period loaded. Both now null.

### The frontend was fabricating too
`StudentAttendance.tsx` divided by a **hardcoded 46** ("46 classes") for every
course, and computed shortfall as `(75 - attendance) * 0.46`. With the API now
sending `null`, `null < 75` is **true** in JavaScript — so an unmarked course
would have been reported as *below the eligibility threshold*, and
"Need 35 more classes" for a course with no sessions at all.

Fixed to carry real `present`/`totalClasses`, exclude unmarked courses from the
average and the low-attendance warning, and render "No records".

### Guard added
`noFabricatedMetrics.test.ts` bans three shapes across every route file:
existence-scoring (`.length > 0 ? <literal> : <literal>`), literal trends, and
`: 100` fallbacks — with negative controls.

**The negative control earned its place immediately.** The `: 100` matcher used
`[^)]*`, which cannot span the nested parens in `Math.round((p / n) * 100)` — so
it was dead while all file checks passed. Fixing the regex then found a **third**
`: 100` site in `students.ts` that I had missed by hand.

### Status
Typecheck **0** (backend + frontend) · Tests **460** (20 files) ·
Live checks **54/54**

### Verified in the browser — and it found two more defects
The session was moved into this repository and the screens were opened against
the running dev server. Authentication was done by injecting a token obtained
from the API, rather than typing a password into the form.

Confirmed on `/student/attendance`: **"No records"**, **"No sessions marked"** and
**"Attendance not yet marked"** where the fabricated 100%, "46/46 classes" and
"Need 35 more classes" used to be — and the course correctly excluded from the
Low Attendance count. Proven by temporarily removing the 31 attendance rows and
restoring them afterwards.

**The browser check earned its place.** Two defects the API-level checks could
not see:

1. **"Semester 0"** — the long-standing bug, now diagnosed. The dashboard
   endpoint returned only `stats` and `upcomingEvents`, while
   `StudentDashboard.tsx` reads `dashboard.profile.semester`, `.cgpa`,
   `.rollNumber` and the credit totals. Every one resolved to `undefined` and was
   normalised to **0**, so a student in semester 5 saw "Semester 0", no
   programme and no roll number. The frontend's own defaults turned missing data
   into confident zeroes — the same defect as the fabrications, arriving from the
   other direction. Now returns a real `profile` block.

2. **The Academic Performance panel contradicted the tile above it** — "0.00
   CGPA" beside "Not published". It used `(profile.cgpa || 0).toFixed(2)`. Now
   reports "Not published" consistently.

Header now reads **"B.Tech Computer Science • Semester 5 • CH2024CS001"**. With
two published semesters planted, both CGPA displays showed **8.15** with
**46/48 credits** and **96% completion**; the probe rows were then removed.

---

## Checkpoint 25 — the last nullable tenant keys, and what they exposed

The five models recorded as outstanding in checkpoint 23 are done: **User,
StudentProfile, FacultyProfile, Department and AcademicYear** now require
`institutionId` (migration **0030**). Every tenant-owned model in the system now
has a non-null tenant key.

For `User` this was more than tidiness. `resolveTenantContext` derives the
request's institution *from the user row*, so a user with a NULL institution
could authenticate and then be rejected by every tenant-scoped route — an account
that logs in and can do nothing.

### Tightening them exposed four more defects

| Where | Defect |
|---|---|
| `security.ts` `POST /guards` | Created accounts with the **hardcoded password `'Guard@123'`** when none was supplied. The literal is in a public repository, the accounts are real, and nothing forced a change at first login. It survived Phase 0.4 because it calls `bcrypt.hash` directly instead of `hashPassword()`, which is where the policy check lives. Also set **no institution**. |
| `admin.ts` `POST /departments` | `create({ data: req.body })` — every column writable **including `institutionId`**, so a caller could plant a department inside another institution by naming it. |
| `students.ts` `PUT /profile` | `update({ data: req.body })` on the student's **own** record. The row was correctly theirs; the columns were not. A student could set their own `cgpa`, `semester`, `rollNumber`, `earnedCredits` or `institutionId` from the profile screen. |
| 9 more handlers | `create({ data: req.body })` across alumni, finance, registrar and sports. |

### The ratchet was too narrow, and said so
Phase 3b's guard banned `update({ where: { id }, data: req.body })` and reported
**zero**. It never looked at `create`. Widening it to
`create|createMany|update|updateMany` found **10 more sites** — the 9 above plus
the student self-profile one.

A guard is only as wide as the shape it was written against, and I wrote it
against the shape I had just finished fixing.

### One good result worth stating precisely
Tenancy on the create path was **already safe**. Routes use the extended client,
and the Prisma extension injects `institutionId` on create and **overrides** a
client-supplied one. Verified live: posting `institutionId: <rival>` to
`POST /sports/teams` produced a row in the caller's own institution. What the
9 creates leaked was ordinary mass assignment, not tenancy.

### Second dead matcher in two checkpoints
The widened pattern initially used `[^{}]*`, which cannot cross the `{ id }` in
`where: { id }` — so it matched `create` but silently stopped matching `update`,
the shape the ratchet existed for. That is the **second** `[^…]*` dead matcher in
this suite (the first was `: 100` in `noFabricatedMetrics.test.ts`). Both were
caught only by their negative controls.

A verification check also passed **for the wrong reason** and was corrected: the
"transfer cannot be created pre-approved" check used 1-character institution
names, so it passed on a length error rather than on `status` being refused.

### Status
Typecheck **0** (backend + frontend) · Tests **465** (20 files) ·
Migrations **30** · Live checks **66/66** across 5 scripts

Seed runs clean; all **19** seeded role logins verified after the User change.

### Remaining
No known nullable tenant keys and no known `data: req.body` writes. What is left
in Phase 3 is refactoring, not exposure: roughly 430 legacy handlers, with
`grievances.ts` first on blast radius (confidential and anonymous submissions).

The structural fix is still the highest-value change: make the service layer
scoped by construction, so a forgotten `where` clause cannot reach production.

---

## Checkpoint 26 — scoped by construction, and the grievance module

### The structural fix
`mutate()` now opens its transaction on the **extended** client. That one line
makes the service layer scoped by construction: the `tx` handed to every service
carries tenant scoping and soft-delete filtering, so isolation no longer depends
on each author remembering a `where` clause.

**Measured before changing it**, because the answer was not obvious. With a rival
row planted directly in the database:

```
prisma.$transaction     -> 1 row, rival NOT visible
basePrisma.$transaction -> 2 rows, rival visible
```

**Proven after**: a service that deliberately omits `institutionId` — the exact
Phase 3a mistake — now writes **0 rows** and reads **0 rows**, and the rival row
is byte-for-byte unchanged. `scripts/verify/verify-service-scoping.ts`.

The explicit filters already written across the services are kept. They are now
redundant rather than load-bearing, which is the right posture for tenant
isolation: two independent mechanisms, either of which alone would hold.

### Grievances — the highest blast radius, and it showed
`GrievanceCase` and `ComplianceItem` had **no tenant key** and were absent from
`TENANT_OWNED_MODELS`. Both tables were global: every grievance officer in the
deployment could read and write every institution's harassment and ragging
complaints, complainant identities, evidence references and investigation
timelines. Closed by migration **0031**.

Three more defects, all in the handling of identity:

| Defect | What it meant |
|---|---|
| **Anonymity defeated by the timeline** | The handler correctly omitted `complainantId` for an anonymous case, then wrote `by: req.user?.id` into the timeline **on the same row**. The identity it promised to withhold was stored anyway. The option offered the appearance of protection. |
| **Impersonation** | `complainantId` was read from the **request body**, so a caller could file a complaint attributed to another person — in the module where the complainant's identity is the most consequential field. |
| **Named anonymous cases** | `complainantName` was required even when anonymous, so a real name was stored on a submission that had asked not to be identified. |

Now: the complainant is the authenticated caller or nobody; an anonymous case
records `anonymous` as the timeline actor and a placeholder name; and
`isAnonymous`, `complainantId`, `complainantName` and `complainantType` cannot be
changed after filing — flipping `isAnonymous` would be the single most damaging
write in this module.

Also fixed: `grievanceNumber` was **globally unique**, so two universities each
numbering a case GRV-2026-0001 would collide and the second could not file it.

**Stated, not implied:** anonymity here protects the *case record*. Uploaded
evidence still carries its own object-store metadata, so this is not an
unlinkability guarantee against someone with database and file-store access.

### A guard caught a bug in the guards
The check-counter added after checkpoint 22 had an arithmetic flaw: when MORE
checks ran than declared, it **subtracted** the difference from the failure
count. In the grievance run that turned a genuine failure into
`ALL CHECKS PASSED`. Fixed in all six scripts — the adjustment can now only ever
add, and an over-count is reported as `MISCOUNTED`.

`seedTenancy.test.ts` also earned its place again, catching a `ComplianceItem`
seeded without a tenant key that `tsc` could not see.

### Status
Typecheck **0** (backend + frontend) · Tests **471** (20 files) ·
Migrations **31** · Live checks **85/85** across 7 scripts

### Remaining
No known nullable tenant keys, no known `data: req.body` writes, no known
globally-unique columns that should be per-tenant. ~415 legacy handlers remain;
what is left is refactoring rather than exposure.

---

## Checkpoint 27 — coe.ts complete, and a P0 I had wrongly declared closed

### A correction first
In checkpoint 26 I wrote that the security queue was empty and what remained was
"refactoring, not exposure". **That was wrong.** Scanning the remaining handlers
before migrating them found 22 `update`/`delete({ where: { id } })` calls on
tenant-owned models, and one of them proved exploitable.

### The P0
`security.ts` `DELETE /incidents/:id`, against a planted rival-institution row:

```
API  -> {"success":false,"message":"Record was not found."}
rows -> BEFORE: 1   AFTER: 0
```

The row was **deleted across a tenant boundary while the API reported failure**.

Cause: the extension put `update` and `delete` in `UNIQUE_OPERATIONS`, which runs
the query and then inspects the RESULT. That is sound for a read — nothing has
changed yet — and catastrophic for a write, because the row is already gone when
`verifyResultTenancy` throws. A destructive cross-tenant write that reports
failure is worse than one that reports success: nothing looks wrong, so nobody
investigates.

**Fixed structurally**, not per handler: `update` and `delete` now have
`institutionId` injected into their `where` BEFORE execution. Prisma permits a
non-unique filter alongside the unique field and raises P2025 when nothing
matches — measured with a probe, not assumed. All 22 sites are covered by the
one change.

Verified live: the rival row survives both a cross-tenant delete and update,
unchanged, while own-institution deletes still work.
`verify-service-scoping.ts` now covers this (8 checks).

### coe.ts — complete
All 8 handlers migrated. The last three were reads:

- `avgGPA` is **computed** from published `SemesterResult` reached through
  Department → Programme → StudentProfile. It was the literal `7.2`, identical
  for every department, on the screen used to decide whether results are fit to
  publish; it was then `null` after the fabrication sweep. Live: **9.1** for CSE
  from its one published result, `null` for ECE which has none.
- `passPercentage` is now over GRADED enrolments and `null` when none are
  graded — an ungraded enrolment is not a pass.
- `GET /submissions` is paginated; it returned every row.

### Measured inventory of what remains
Not an estimate — counted across all 17 legacy route files:

| | count |
|---|---|
| Total handlers | 474 |
| Unpaginated list endpoints | 211 |
| Write handlers without a validation schema | 237 |
| Hard deletes | 31 |
| `update`/`delete` by unique key | 80 (22 on tenant-owned models — **now structurally safe**) |

### Status
Typecheck **0** (backend + frontend) · Tests **472** · Migrations **31** ·
Live checks **88/88** across 7 scripts

---

## Checkpoint 28 — Phase 2 audited, and actually completed

### The audit found Phase 2 incomplete
I had reported Phase 2 done. Checking it against its own written exit criteria —
"three real approval flows run on the engine end-to-end, each transition audited,
and an institution can change routing without code" — showed two gaps:

1. **One flow, not three.** Only `RESULT_PUBLICATION` was migrated.
   `FEE_WAIVER` in the database was my own test fixture, not a real flow.
2. **Escalation was never built.** Item 2.2 listed it in the model. Steps carried
   `slaHours`, and the inbox used it to compute an `overdue` flag that nothing
   acted on. A deadline nobody enforces is a comment.

### Both closed
**Two more real flows**, both cross-module and previously ad-hoc status flips:

- **PURCHASE_REQUEST** — HOD raises (`hod.ts`), Dean sanctions (`dean.ts`). The
  two handlers did not know about each other and both wrote `status` directly,
  so for a request that commits money "who approved this" was answerable only by
  guessing from the last write.
- **CURRICULUM_PROPOSAL** — HOD raises, Dean decides. The decision handler was
  `update({ where: { id }, data: { status } })` with **no validation at all**.

**I modelled both as ONE step, not two.** My first draft gave each an extra
approval stage that the handler names implied. Reading them showed
`hod.ts PUT /purchaserequests/:id/status` is a 403 stub saying only the Dean may
approve. Inventing that second stage would have put a governance step in the
record that nobody sits in — the exact mistake the approval catalogue warned
about.

**`bosApproved` is no longer accepted from the request body.** It was
`Boolean(req.body.bosApproved)`: the proposer asserting that the Board of Studies
had approved their own proposal. An institution wanting a real BoS stage defines
one through `POST /workflow/definitions` — which is the "change routing without
code" criterion, used for its intended purpose.

**Escalation (migration 0032)** — `escalationRole` on the step, `escalatedAt` and
`escalatedFromRole` on the instance, and `POST /workflow/escalate`.

It **widens who may act; it decides nothing.** The approval stays at the same
step, still pending, and the original assignee keeps access. A system that
auto-approved on a deadline would record decisions nobody made. Steps with no
escalation role are reported and left alone — escalating to someone without the
standing to decide is worse than leaving it late.

### Two things the test told me
- My own **append-only trigger blocked the test** from backdating a transition.
  That is the guarantee working. The test now builds an aged instance by INSERT
  instead of rewriting history.
- The **purchase flow was unreachable on a fresh database**: no lab `Facility`
  exists, so every request was refused with "Please select a valid lab". Seeded.

### Status
Typecheck **0** · Tests **472** · Migrations **32** ·
Live checks **103/103** across 8 scripts

**Phase 2 now meets its exit criteria.** Verified by
`verify-2-exit-criteria.sh`, which checks the wording literally: 15/15.

---

## Checkpoint 29 — Phase 3b complete (5 of 5 modules)

`finance.ts`, `students.ts`, `admin.ts`, `registrar.ts`, `security.ts` — 159
handlers. Every module yielded a genuine integrity or security defect rather
than mechanical refactoring.

| Module | The finding |
|---|---|
| `finance.ts` | Not one write audited or validated, in the module that moves money. Purchase orders could be recorded approved/delivered/paid before anything happened; budgets accepted `availableAmount` so one could report headroom it lacked; payroll took `netSalary` as client input and could disburse twice. |
| `students.ts` | **A student could clear their own fees.** `transactionId` came from the request body — generated in the browser as `TXN-${Date.now()}-${random}` — and the server marked the fee paid and said "Payment successful". |
| `admin.ts` | **`accreditation: 'NAAC A+'` hardcoded**, reported to every caller of every deployment. Plus unaudited account deletion, an unvalidated `role`, and nothing stopping the last administrator being removed. |
| `registrar.ts` | The register could be rewritten without a trace: `...profileData` spread into `StudentProfile` for ANY student, unvalidated and unaudited. |
| `security.ts` | **Eight unaudited DELETE endpoints**, including vigilance cases — confidential investigations the investigating office could destroy with no record. |

### Tenant keys added in this phase
33 tables that were globally shared. Migrations 0033–0035:
payroll, purchase orders, budgets, vendors; certificate and degree-verification
requests, record changes, staff promotions and retirements, admin documents,
gate passes; visitor passes, patrol logs, ID cards, vehicle passes, vigilance
cases, support tickets, hostel access.

### Soft delete where deletion destroys evidence
`VigilanceCase` and `IncidentReport` are now soft-deleted. An investigation the
investigating office can erase is not evidence of anything, and the erasure is
precisely what an auditor would want to see. Verified live: the row is retained,
`deletedAt` set, the case disappears from the API, and the deletion is audited
at `critical` with the row captured before removal.

### Mistakes made and corrected in this phase
- A verification run reported a record "unchanged" while **the dev server was
  down** — nothing had been tested. Re-run live. Second vacuous check this
  session; both were caught by looking at the evidence rather than the result.
- `seedTenancy.test.ts` flagged two **commented-out** seed blocks. A commented
  call cannot throw; the guard now strips comments like the others.
- A migration assumed `studentProfileId` where the column is `studentId` —
  the same assumption 0034 had already been rewritten to avoid. Both now read
  `information_schema` instead of guessing.
- The mass-assignment ratchet missed the SPREAD form `data: { ...req.body }`,
  its **third** too-narrow pattern. Widened; 17 sites remain recorded.

### Status
Typecheck **0** · Tests **494** · Migrations **35** ·
Live checks **103/103** across 8 scripts

### Remaining in Phase 3
3c: `hod.ts` (70), `faculty.ts` (44), `dean.ts` (40), `vc.ts` (33),
`placements.ts` (33), `sports.ts` (30), `alumni.ts` (20), `iqac.ts` (17) —
about 287 handlers, plus `grievances.ts` 8 of 14 still legacy.
