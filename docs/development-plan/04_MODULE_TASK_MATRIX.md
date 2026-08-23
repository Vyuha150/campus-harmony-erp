# 04 — Module Task Matrix

Every unresolved audit finding converted to an engineering task.
**Complexity:** S ≤2d · M ≤2w · L ≤2m · XL >2m

---

## Phase 0 — Repository Stabilization (EPIC-00)

| Task ID | Epic | Module | Problem | Required Change | Deps | Pri | Risk | Cx | Test Required | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| T-001 | 00 | config | `JWT_SECRET \|\| 'supersecretkey123'` in public repo | Central `config/env.ts`, fail-fast on boot | — | **P0** | Low | S | Boot fails without secret | ✅ IMPLEMENTED |
| T-002 | 00 | config | No `.env.example` | Add with all vars + safe placeholders | T-001 | **P0** | Low | S | Manual | ✅ IMPLEMENTED |
| T-003 | 00 | config | CORS/port hardcoded | Env-driven, comma-separated origins | T-001 | P1 | Low | S | Config unit test | ✅ IMPLEMENTED |
| T-004 | 00 | students | `getOrCreateStudentProfile` fabricates `cgpa: 8.5` on GET | Delete; throw `NotFoundError` | — | **P0** | **Med** — UIs go empty | S | No-fabrication test | ✅ IMPLEMENTED |
| T-005 | 00 | faculty | `getOrCreateFacultyProfile` fabricates PhD; 38 call sites | Delete; throw `NotFoundError` | — | **P0** | **Med** | S | No-fabrication test | ✅ IMPLEMENTED |
| T-006 | 00 | faculty | Auto-generates 8 lesson plans, marks 1–4 `completed` | Delete generation; return `[]` | — | **P0** | Low | S | Returns empty | ✅ IMPLEMENTED |
| T-007 | 00 | faculty | `getOrCreateFacultyClasses` synthesises classes | Delete; read-only | T-005 | **P0** | Med | S | — | ✅ IMPLEMENTED |
| T-008 | 00 | students | `getOrCreateStudentClassEnrollments` synthesises enrolments | Delete; read-only | T-004 | **P0** | Med | S | — | ✅ IMPLEMENTED |
| T-009 | 00 | uploads | `express.static` before auth → public confidential files | Authenticated download route | — | **P0** | Med | M | Unauth returns 401 | ✅ IMPLEMENTED |
| T-010 | 00 | uploads | No MIME allowlist → stored XSS | Allowlist + `Content-Disposition` | T-009 | P1 | Low | S | `.html` rejected | ✅ IMPLEMENTED |
| T-011 | 00 | auth | No rate limiting → unlimited brute force | Rate limiter on `/login` | T-001 | P1 | Low | S | 6th attempt → 429 | ✅ IMPLEMENTED |
| T-012 | 00 | admin | `bcrypt.hash(password \|\| 'password123')` | Require explicit password + policy | — | P1 | Low | S | Weak rejected | ✅ IMPLEMENTED |
| T-013 | 00 | placements | Default `'Student@123'` | Same | — | P1 | Low | S | — | ✅ IMPLEMENTED |
| T-014 | 00 | seed | 17 privileged accounts, shared password, no env guard | Refuse outside development | T-001 | **P0** | Low | S | Prod run refused | ✅ IMPLEMENTED |
| T-015 | 00 | frontend | No 401 interceptor → session dies silently | Response interceptor + logout | — | P1 | Low | S | 401 → redirect | ✅ IMPLEMENTED |
| T-016 | 00 | backend | 36 TS errors incl. crash paths | Fix `dean.ts:786`, `finance.ts:613`, `students.ts:107` | — | P2 | Low | M | `tsc` clean | ✅ IMPLEMENTED |
| T-017 | 00 | frontend | 22 TS errors; `DashboardLayout` duplicate keys = real bug | Fix duplicates; type responses | — | P2 | Low | M | `tsc` clean | ✅ IMPLEMENTED |
| T-018 | 00 | deps | 53 vulns (1 critical) | Triage critical/high | — | P1 | Med | M | `npm audit` | ⬜ NOT STARTED |

## Phase 1 — Database Foundation (EPIC-01)

| Task ID | Module | Problem | Required Change | Deps | Pri | Cx | Test | Status |
|---|---|---|---|---|---|---|---|---|
| T-101 | prisma | `FacultyLessonPlan` created at runtime, absent from schema | Add model; delete runtime DDL | T-006 | P1 | S | Migration applies | ✅ IMPLEMENTED |
| T-102 | prisma | **No migrations for 95 models** | Generate baseline; `migrate deploy` | T-101 | **P0** | S | Clean apply on empty DB | ✅ IMPLEMENTED |
| T-103 | audit | `SystemAuditLog` written 0 times | Audit service + emit on mutations | T-102 | **P0** | M | Row per mutation | 🔷 PARTIAL — service built |
| T-104 | prisma | No history on grades/marks/fees | History tables + actor/old/new/reason | T-103 | **P0** | M | Change → history row | ⬜ NOT STARTED |
| T-105 | prisma | ~40 refs are bare strings | Convert to FKs + cleanup migration | T-102 | P1 | L | Orphan rejected | ⬜ NOT STARTED |
| T-106 | prisma | Cascade deletes destroy academic history | Soft delete + retention | T-102 | P1 | M | Delete preserves history | ⬜ NOT STARTED |
| T-107 | prisma | No enums; status = free text | Prisma enums + transitions | T-102 | P2 | M | Invalid rejected | ⬜ NOT STARTED |
| T-108 | prisma | Sparse indexes | Add per audit D8 | T-102 | P2 | S | Query plan | ⬜ NOT STARTED |
| T-109 | devops | Backup is a façade | Automated backup + **tested restore** | T-102 | **P0** | M | Restore drill | ⬜ NOT STARTED |

## Phase 2 — Architectural Foundation (EPIC-02)

| Task ID | Module | Problem | Required Change | Deps | Pri | Cx | Status |
|---|---|---|---|---|---|---|---|
| T-201 | shared | No error taxonomy; raw `error.message` leaked | Typed errors + handler | — | P2 | M | ✅ IMPLEMENTED |
| T-202 | shared | No validation library in backend | zod middleware per endpoint | T-201 | P1 | L | 🔷 PARTIAL — middleware built |
| T-203 | all | Logic in 1,882-line route files | Extract service layer | T-201 | P2 | XL | ⬜ NOT STARTED |
| T-204 | all | 4 transactions / 478 endpoints | Wrap multi-step writes | T-203 | P1 | L | ⬜ NOT STARTED |
| T-205 | all | No idempotency | Keys on finance + enrolment | T-203 | P1 | M | ⬜ NOT STARTED |
| T-206 | all | Pagination on ~9% | Mandatory on lists | T-203 | P1 | M | ⬜ NOT STARTED |
| T-207 | obs | No structured logs | Logger + correlation IDs | T-201 | P1 | M | ✅ IMPLEMENTED |
| T-208 | security | No helmet/CSP/HSTS | Security headers | T-001 | P2 | S | ✅ IMPLEMENTED |
| T-209 | files | Ephemeral local disk | Storage abstraction → object storage | T-009 | P1 | M | ⬜ NOT STARTED |
| T-210 | health | `/api/health` doesn't check DB | Real health + readiness | — | P2 | S | ✅ IMPLEMENTED |
| T-211 | db | `rejectUnauthorized: false` on DB TLS | Proper CA config | T-001 | P1 | S | ⬜ NOT STARTED |
| T-212 | db | Pool unconfigured | Tunable pool via env | T-001 | P2 | S | ✅ IMPLEMENTED |

## Phase 3 — Institution & Identity (EPIC-03)

| Task ID | Problem | Change | Pri | Cx | Status |
|---|---|---|---|---|---|
| T-301 | **No tenancy decision** | Decide single vs multi — **blocks schema** | **P0** | S | ⬜ **DECISION NEEDED** |
| T-302 | No institutional hierarchy | Institution→Campus→School→Dept→Programme→Batch→Section | P1 | L | ⬜ NOT STARTED |
| T-303 | `librarian` has all 32 student endpoints | Narrow lookup endpoint | P1 | S | ⬜ NOT STARTED |
| T-304 | No read-only role | Add `auditor` | P1 | S | ⬜ NOT STARTED |
| T-305 | No object-level authz | Faculty→own classes; HOD→own dept | P1 | L | ⬜ NOT STARTED |
| T-306 | Permissions hardcoded | Data-driven via `ModuleConfig.roles` | P2 | M | ⬜ NOT STARTED |
| T-307 | User creation scattered | Centralised audited identity service | P1 | M | ⬜ NOT STARTED |
| T-308 | `pro_vc` == `vice_chancellor` | Differentiate | P2 | S | ⬜ NOT STARTED |

## Phase 4 — Academic Core (EPIC-04)

| Task ID | Problem | Change | Pri | Cx | Status |
|---|---|---|---|---|---|
| T-401 | **No `Programme` model** | Add — blocks all academic work | P1 | M | ⬜ NOT STARTED |
| T-402 | No curriculum | Scheme→basket→electives→prerequisites | P1 | L | ⬜ NOT STARTED |
| T-403 | **CGPA fabricated, never computed** | Grade-point + SGPA/CGPA engine | P1 | L | ⬜ NOT STARTED |
| T-404 | No semester results | Result model + publication state | P1 | L | ⬜ NOT STARTED |
| T-405 | No transcripts | Generation + verification | P2 | M | ⬜ NOT STARTED |
| T-406 | Credits stored not derived | Compute from enrolment | P1 | M | ⬜ NOT STARTED |
| T-407 | **No demographics** | After **legal review** — unlocks OI/equity/AISHE | P2 | M | ⬜ **BLOCKED — legal** |
| T-408 | No history for multi-year reporting | Academic-year snapshots | P2 | M | ⬜ NOT STARTED |
| T-409 | Rules not versioned | Version curriculum/grading | P2 | M | ⬜ NOT STARTED |

## Phases 5–12 — summary

| Phase | Epic | Key tasks | Pri | Status |
|---|---|---|---|---|
| 5 | 05 | Admissions lifecycle; **bulk import engine** | P2 | ⬜ |
| 6 | 06 | Exam lifecycle → transcript; transactional publication | P2 | ⬜ |
| 7 | 07 | OBE: CO/PO/PSO, configurable attainment | P2 | ⬜ |
| 8 | 08 | Finance: transactional, idempotent, auditable | P2 | ⬜ |
| 9 | 09 | Workflow · notification delivery · search · events | P2 | ⬜ |
| 10 | 10 | Reporting layer + export (none exists) | P2 | ⬜ |
| 11 | 11 | Compliance engine | P2 | ⬜ **BLOCKED — official docs** |
| 12 | 14 | Performance, measured | P3 | ⬜ |
| — | 13 | **RBAC tests + CI** — start immediately | P1 | 🔷 PARTIAL |

## Blocked tasks

| Task | Blocker | Resolution |
|---|---|---|
| T-301 | Product decision: multi-institution? | **Decide before Phase 3** |
| T-407 | DPDP legal review for demographics | Qualified counsel |
| EPIC-11 | Official NAAC/NIRF/UGC documents | Obtain from authorities |

## Counts

| Priority | Tasks | Implemented |
|---|---:|---:|
| P0 | 14 | **11** |
| P1 | 29 | 8 |
| P2 | 24 | 5 |
| P3 | 8 | 0 |
| **Total** | **75** | **24** |
