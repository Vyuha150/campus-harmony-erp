# 03 — Epic Breakdown

Every unresolved audit finding maps to at least one epic. Epic IDs are referenced by `04_MODULE_TASK_MATRIX.md` and `IMPLEMENTATION_STATUS.md`.

---

## EPIC-00 — Repository Stabilization `P0` `Phase 0`

**Goal:** stable, safe development baseline. No P0 security holes, no fabricated data.

| Feature | Audit ID | Tasks |
|---|---|---|
| Fail-fast config | P0-04, P1-17 | Central `config/env.ts` with validation; `.env.example`; remove `JWT_SECRET` fallback; make CORS/port configurable |
| Remove fabrication | P0-01, P0-02, P0-03 | Delete `getOrCreateStudentProfile`, `getOrCreateFacultyProfile`, `getOrCreateFacultyClasses`, `getOrCreateStudentClassEnrollments`, lesson-plan auto-generation; return typed empty state / 404 |
| Secure uploads | P0-05, P1-08, P0-09 | Authenticated download route; MIME + extension allowlist; `Content-Disposition: attachment` |
| Auth hardening | P1-07, P1-10, P0-11 | Rate limit login; remove default passwords; guard `seed.ts` by `NODE_ENV` |
| Session handling | P1-09 | Frontend 401 interceptor + auto-logout |
| Type errors | P2-01, P2-02 | 58 errors; `DashboardLayout` duplicate keys is a real bug |
| Dependency triage | P1-11 | 1 critical + 35 high |

**DoD:** app boots with no fallback secret; no read mutates state; uploads require auth; `tsc` clean; login rate-limited.

## EPIC-01 — Database Foundation `P0` `Phase 1`

| Feature | Audit ID | Tasks |
|---|---|---|
| **Migration baseline** | P0-07 | Fold `FacultyLessonPlan` into schema; generate baseline; switch to `migrate deploy` |
| Audit infrastructure | P0-06 | Audit service; write on every mutation; index `SystemAuditLog` |
| History tables | P0-10 | Grade, marks, attendance, fee, CGPA history with actor/old/new/reason |
| Referential integrity | P1-03 | ~40 string refs → real FKs + data cleanup migration |
| Soft delete + retention | P1-04 | Replace cascade deletes that destroy academic history |
| Enums + indexes | P2-06, P2-07 | Status strings → Prisma enums; indexes per audit D8 |
| Backup & restore | P0-08 | Automated backup; **tested** restore; document RPO/RTO |

**DoD:** migrations run clean on empty DB; every mutation audited; a restore has been performed successfully.

## EPIC-02 — Architectural Foundation `P1` `Phase 2`

| Feature | Audit ID | Tasks |
|---|---|---|
| **Service layer** | P2-05 | Extract `routes → service → repository` per module; remove `const db: any` |
| Error taxonomy | P2-04 | `ValidationError`, `AuthorizationError`, `NotFoundError`, `ConflictError`, `BusinessRuleError`…; stop leaking `error.message` |
| Validation | P1-01 | zod schema per endpoint as middleware |
| Transactions | P1-02 | Wrap all multi-step writes |
| Idempotency | P1-23 | Keys on financial + enrolment endpoints |
| Pagination | P1-16 | Mandatory on all list endpoints |
| Observability | P1-21 | Structured logs, correlation IDs, real health check |
| Security headers | P2-09 | helmet, CSP, HSTS |
| File engine | P1-19 | Storage abstraction; object storage; metadata model |

**DoD:** every mutation validated, transactional, audited; consistent error contract; no `any` in data access.

## EPIC-03 — Institution Structure & Identity `P1` `Phase 3`

| Feature | Audit ID | Tasks |
|---|---|---|
| Institutional hierarchy | P1-13 | `Institution → Campus → School → Department → Programme → Batch → Section` |
| **Tenancy decision** | 13-multi-tenancy | Decide single vs multi; if multi, `institutionId` everywhere + isolation tests |
| Configurable RBAC | P2-12, P1-14 | Permission tables; consult `ModuleConfig.roles`; add read-only `auditor` |
| Object-level authz | P1-13 | Faculty→own classes; HOD→own department |
| Fix over-privilege | P1-12, P2-10, P2-11 | Remove `librarian` from student mount; restrict uploads; differentiate `pro_vc` |
| Identity lifecycle | R3 | Centralised user creation, password reset, activation, bulk provisioning |
| Institution config | Phase 4 brief | Academic years, semesters, grading schemes, credit schemes, calendar, policies |

**DoD:** authz tests prove cross-department and cross-user access fail correctly.

## EPIC-04 — Academic Core `P1` `Phase 4` ← **highest functional value**

| Feature | Audit ID | Tasks |
|---|---|---|
| **Programme model** | 09-Institution | The structural gap blocking all academic work |
| Curriculum | 09-Academic | Scheme → course basket → electives → prerequisites |
| Credit engine | P1-05, 12-ABC | Credits from real enrolment; accumulation |
| **Grade & results** | P1-05 | Grade-point mapping, semester results, **SGPA/CGPA computed** |
| Transcripts | 12-Digital | Generation + verification code |
| Demographics | 11-OI | **After legal review**; unlocks NIRF OI + UGC equity + AISHE |
| Historical snapshots | 11-History | Academic-year snapshots for multi-year reporting |
| Rule versioning | Brief §64 | Curriculum/grading versioned so history stays interpretable |

**DoD:** system computes a CGPA from real grades and produces a defensible transcript.

## EPIC-05 — Admissions `P2` `Phase 5`

Enquiry → Application → Documents → Verification → Eligibility → Merit → Selection → Approval → Payment → **Student record** → Enrollment.

Replaces deleted fabrication. Includes **bulk import engine** (upload→parse→map→validate→preview→dedupe→confirm→batched import→report) — without it no institution can onboard legacy data.

## EPIC-06 — Examination & Results `P2` `Phase 6`

Config → Registration → Hall ticket → Assessment → Marks entry → Verification → Moderation → Approval → Grade processing → SGPA/CGPA → Publishing → Revaluation/Supplementary → Transcript.

**Mission-critical:** transactional throughout; partial publication must be impossible; every marks change audited with approver.

## EPIC-07 — OBE Engine `P2` `Phase 7`

CO/PO/PSO definition, CO-PO mapping, direct/indirect assessment, **configurable** attainment formulas, thresholds, gap analysis, action-taken reports. No hardcoded formulas.

## EPIC-08 — Finance `P2` `Phase 8`

Fee structures, invoices, payments, concessions, scholarships, penalties, receipts, refunds, reconciliation, dues, reports. **All money operations transactional, idempotent, auditable.** Payment confirmation never trusted from frontend state.

## EPIC-09 — Cross-Cutting Engines `P2` `Phase 9`

| Engine | Replaces |
|---|---|
| Workflow/approval | Bespoke per-module approval logic |
| Notification | `Notification` rows with **no delivery transport** |
| Search | Client-side filtering of full tables |
| Domain events | Direct cross-module coupling |

## EPIC-10 — Reporting `P2` `Phase 10`

Single source of truth over authoritative operational data. Filters, drilldowns, export (Excel/CSV/PDF — **none exists today**), academic-year/department/programme selection, comparisons. Background generation.

## EPIC-11 — Compliance Engine `P2` `Phase 11`

**Blocked** on obtaining official framework documents.

Framework → FrameworkVersion → Criterion → Metric → Definition → Applicability → DataSource → Formula → EvidenceRequirement → ReportingPeriod → Owner → Verifier → Approver → Status.

**Compliance is generated from operational data, never re-entered.** Full provenance: every number traceable to source records.

## EPIC-12 — Supporting Modules `P3` `Phase 9+`

Library (fix: cannot model multiple copies), hostel, transport, inventory, procurement, assets, alumni, sports — all integrated with common master data, no duplicate student/faculty records.

## EPIC-13 — Testing & CI `P1` `continuous`

| Feature | Audit ID |
|---|---|
| Backend test runner | P1-22 |
| **RBAC/authz tests first** | P1-22 — highest value, protects what already works |
| Integration tests per atomic operation | P1-02 |
| E2E: admission, enrollment, results, payment, compliance | Brief §79 |
| Security tests: cross-user, cross-department, cross-tenant | Brief §78 |
| CI: install→lint→typecheck→test→audit→build→migration-check | P1-20 |

## EPIC-14 — Performance `P3` `Phase 12`

Measured, never speculative. Pagination and indexes first; queue for reports/notifications; caching only where profiling justifies it.

## Epic → priority summary

| Priority | Epics |
|---|---|
| **P0** | EPIC-00, EPIC-01 |
| **P1** | EPIC-02, EPIC-03, EPIC-04, EPIC-13 |
| **P2** | EPIC-05…EPIC-11 |
| **P3** | EPIC-12, EPIC-14 |
