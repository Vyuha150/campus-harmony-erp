# 01 — Executive Summary

**System:** Campus Harmony ERP
**Repository:** `Vyuha150/campus-harmony-erp` (public, default branch `main`)
**Audit date:** 2026-08-19
**Auditor scope:** Forensic audit — no rewrite performed, no files modified.
**Local working copy:** `C:\Users\venka\University ERP` (fresh clone, commit as-cloned)

---

## Final verdict

> ## **E — PROTOTYPE / NOT PRODUCTION READY**
>
> **CAMPUS HARMONY OVERALL PRODUCTION READINESS: 23 / 100**

This is a **large, broad, and genuinely non-trivial prototype**. It is not vapourware: 478 API endpoints, 95 database models, and 133 feature components exist, and 121 of the 133 components are wired to real HTTP calls rather than mock arrays. The breadth of ERP surface area covered (18 role modules from Registrar to Sports) is substantial and represents real work.

But it must not be deployed to a live institution in its current state. The reason is not missing features — it is that **the system fabricates authoritative academic and HR records, has no database migration history, has no audit trail despite shipping an audit-log screen, and ships a hardcoded authentication secret in a public repository.**

The distinction that matters for this codebase is between *breadth* (good) and *trustworthiness of the data it produces* (currently unacceptable for an institutional record system).

---

## The five findings that determine the verdict

### 1. The backend invents academic and HR records on read (P0)

`getOrCreateStudentProfile()` — `backend/src/routes/students.ts:122-143` — silently creates a student profile for any authenticated user who lacks one, populated with fabricated data:

```ts
profile = await prisma.studentProfile.create({
  data: {
    userId,
    rollNumber: `STU${userId.substring(0, 6).toUpperCase()}`,
    program: 'B.Tech',  branch: 'Computer Science',
    semester: 5,  section: 'A',  batch: '2024',
    admissionYear: 2024,
    cgpa: 8.5            // ← fabricated academic record
  }
});
```

This function is called on **GET requests**. A read operation writes an invented CGPA of 8.5 and an invented admission year into the institutional record system.

The identical pattern exists for faculty — `backend/src/routes/faculty.ts:38-52` fabricates `qualification: 'Ph.D in CSE'`, `specialization: 'Artificial Intelligence'`, `experience: 5`. It is invoked from **38 separate endpoints** in that one file. Faculty qualification and experience are direct NIRF `TLR` inputs and NAAC teaching-learning evidence; the system will therefore report fabricated figures to an accreditation body.

`backend/src/routes/faculty.ts:560-578` goes further and auto-generates eight weeks of lesson plans per course, **marking weeks 1–4 as `'completed'`** with no human action.

This is the single most serious class of defect in the repository. An ERP that manufactures its own academic data cannot be used as a system of record.

### 2. Zero database migrations (P0)

`backend/prisma/` contains exactly two files — `schema.prisma` and `seed.ts`. There is **no `migrations/` directory**. A 95-model schema for an institutional record system has no version history, no rollback path, and no reproducible deployment. The only way to materialise the schema is `prisma db push`, which is a destructive-by-design dev command.

Compounding this, `backend/src/routes/faculty.ts:10-26` executes DDL **at request time**:

```ts
async function ensureFacultyLessonPlanTable() {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "FacultyLessonPlan" (...)`);
}
```

`FacultyLessonPlan` is a shadow table that exists in production data but not in `schema.prisma`. Prisma does not know it exists; a future `prisma migrate` may not preserve it.

### 3. The audit log is a façade (P0 for compliance)

`SystemAuditLog` is queried in three places (`admin.ts:264`, `:318`, `:339`) to render the Admin → Audit Logs screen. It is **written in zero places** across all 12,108 lines of route code. The only row that will ever exist is the single one inserted by `seed.ts`.

Meanwhile grades are mutated without any history: `faculty.ts:1029` writes `data: { grade: m.grade }` with no old value, no approver, no reason, no immutable record.

Per the audit brief's own standard — *"a compliance page is not compliance"* — this is the clearest instance in the codebase.

### 4. Hardcoded authentication secret in a public repository (P0)

Both `backend/src/middleware/auth.ts:4` and `backend/src/routes/auth.ts:8` contain:

```ts
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';
```

The repository is public. Any deployment where `JWT_SECRET` is unset — which is the default, since **no `.env.example` exists** to tell an operator the variable is required — allows anyone to forge a valid token for any role, including `super_admin`. This is a complete authentication bypass with a publicly known key.

Additionally `.env` is **committed and tracked** in the public repo (currently benign — it holds only `VITE_API_BASE_URL` — but the pattern invites a future secret leak).

### 5. No input validation and effectively no transactions (P1, systemic)

| Measure | Count | Denominator |
|---|---|---|
| API endpoints | **478** | across 18 route files |
| Endpoints using a validation schema | **0** | no `zod`/`joi`/`express-validator` in `backend/package.json` |
| Uses of `prisma.$transaction` | **4** | in 3 files |
| Endpoints with pagination (`take`/`skip`) | 42 | ~9% |

Financially and academically atomic operations are not atomic. Fee payment + receipt, marks approval + result publication, and course registration + seat update are all multi-step writes with no transaction boundary — a mid-operation failure leaves the institution's financial or academic records in a partially-written state.

---

## What is genuinely good

Honest credit where the code earns it:

- **The frontend is not a mock-up.** 121 of 133 non-UI components import the real API layer. `src/data/studentMockData.ts` — the obvious "fake dashboard" candidate — is imported by **zero** components and is dead code. This is much better than the typical ERP prototype.
- **Raw SQL is correctly parameterised.** Every `$queryRawUnsafe`/`$executeRawUnsafe` call in `faculty.ts` uses `$1, $2` placeholders. **No SQL injection was found.**
- **RBAC is enforced server-side, not just hidden in the UI.** `server.ts:47-64` mounts every module behind `authenticate` + `authorizeRoles(...)`. The frontend-hides-but-backend-allows failure mode is largely absent.
- **Student endpoints derive identity from the JWT**, not from client-supplied IDs — the most common IDOR vector is avoided.
- **Passwords are bcrypt-hashed at cost 10** everywhere, consistently.
- **CORS is not a wildcard.**

The architecture is a conventional, comprehensible React SPA → Express → Prisma → PostgreSQL stack. There is no over-engineering to unwind: no premature microservices, no Kafka, no Kubernetes. **The foundation is repairable.** The problems are correctness, integrity and governance — not a wrong-technology choice demanding a rewrite.

---

## Scorecard

| Domain | Score /100 | Basis |
|---|---:|---|
| Architecture | 45 | Sound conventional stack; no service/domain layer, business logic sits in route files (1,882-line `hod.ts`) |
| Frontend completeness | 55 | Broad, API-wired, but 22 type errors and unverified runtime behaviour |
| Backend completeness | 40 | 478 endpoints exist; validation, transactions, error handling largely absent |
| Database integrity | 15 | No migrations, no FKs on ~40 reference fields, no soft delete, no history tables |
| Functional completeness | 45 | Wide ERP surface; admissions/OBE/exam-lifecycle absent |
| Authentication | 20 | Works, but hardcoded secret fallback, no refresh, no lockout, no MFA |
| Authorization | 50 | Server-side RBAC present and consistent; no object-level or hierarchical scoping |
| Security | 15 | P0 secret; unauthenticated file serving; no validation; 53 dependency vulns |
| Reliability | 15 | 4 transactions / 478 endpoints; no idempotency; no retries |
| Testing | 2 | Entire suite is `expect(true).toBe(true)` |
| Performance | 25 | ~9% pagination; N+1 loops; synchronous report generation |
| Scalability | 20 | Single-tenant only; no caching, queues, or workers |
| DevOps | 5 | No CI, no Docker, no migrations, no `.env.example`, no healthcheck beyond `/api/health` |
| Observability | 8 | `console.error` only; no structured logs, correlation IDs, or metrics |
| UX | 55 | Consistent shadcn/Tailwind design system, role-based navigation |
| Accessibility | 30 | Radix primitives give a floor; not verified, no a11y testing |
| NAAC readiness | 12 | Storage models exist; no metric engine, provenance, or verification workflow |
| NIRF readiness | 10 | No data mart; key inputs fabricated (faculty qualification) |
| UGC readiness | 8 | No ABC/NCrF/credit-transfer/multiple-entry-exit support |
| Reporting & data governance | 12 | Reports computed ad-hoc per endpoint; no single source of truth |

> ### **OVERALL: 23 / 100**

---

## Top 10 critical problems

| # | Problem | Severity | Evidence |
|---|---|---|---|
| 1 | Backend fabricates student CGPA/admission records on read | **P0** | `students.ts:122-143` |
| 2 | Backend fabricates faculty PhD/experience (a NIRF input) | **P0** | `faculty.ts:38-52`, called from 38 endpoints |
| 3 | Hardcoded JWT secret `'supersecretkey123'` in public repo | **P0** | `middleware/auth.ts:4`, `routes/auth.ts:8` |
| 4 | Zero database migrations for a 95-model schema | **P0** | `backend/prisma/` has no `migrations/` |
| 5 | Audit log read in 3 places, written in 0 | **P0** | `admin.ts:264/318/339`; no `.create` anywhere |
| 6 | Uploaded files served with no authentication | **P0** | `server.ts:39` static mount precedes auth |
| 7 | Runtime `CREATE TABLE` DDL; shadow table absent from schema | **P1** | `faculty.ts:10-26` |
| 8 | Grades mutated with no history/approver/reason | **P1** | `faculty.ts:1029` |
| 9 | 4 transactions across 478 endpoints | **P1** | repo-wide grep |
| 10 | Predictable default passwords (`'password123'`) | **P1** | `admin.ts:70`, `placements.ts:157` |

## Top 10 architectural problems

1. No service/domain layer — business logic lives in route handlers (`hod.ts` is 1,882 lines).
2. `const db: any = prisma` used throughout to defeat type checking (`faculty.ts:8`, `students.ts:8`).
3. No shared validation layer; every endpoint hand-rolls or omits checks.
4. ~40 reference fields (`createdBy`, `approvedBy`, `studentId`) are bare `String` with no foreign key.
5. No tenant/institution dimension anywhere — single-institution only by construction.
6. Reporting logic duplicated per role module instead of a shared reporting layer.
7. Untyped `Json` blobs used for structured data (`agendaItems`, `criteria`, `accounts`).
8. No background job or queue infrastructure; all work is synchronous in-request.
9. Frontend `api.ts` has a request interceptor but **no response interceptor** — a 401 never triggers logout.
10. Status/state machines expressed as free-text strings with no enum or transition validation.

## Top 10 missing ERP capabilities

1. **Admissions lifecycle** — enquiry → application → merit → counselling → offer → enrolment. Entirely absent.
2. **Examination lifecycle** — registration, hall tickets, question papers, moderation, revaluation, supplementary.
3. **Outcome-Based Education** — CO/PO/PSO definition, mapping, attainment calculation. No models exist.
4. **SGPA/CGPA computation** — CGPA is a stored `Float` that is fabricated, never calculated from grades.
5. **Academic Bank of Credits / NCrF** — no credit accumulation, transfer, or redemption.
6. **Timetable generation** — `TimetableSlot` stores rows; no scheduling or clash detection.
7. **Fee payment gateway integration** — no payment, reconciliation, or receipt generation.
8. **Curriculum/scheme/regulation versioning** — no programme structure or prerequisite modelling.
9. **Bulk import/export** — no Excel/CSV ingestion for legacy institutional data.
10. **Notification delivery** — records are stored; no email/SMS/push transport exists.

## Top 10 security & reliability risks

1. Authentication bypass via known default JWT secret (P0).
2. Confidential documents downloadable without auth — grievance evidence, vigilance case files, `AdminDocument` marked `isConfidential` (P0).
3. No upload MIME allowlist; extension taken from user filename + static serving = stored XSS (P1).
4. No rate limiting or account lockout on `/auth/login` — unrestricted brute force (P1).
5. JWT in `localStorage` with no response interceptor; XSS-exfiltratable, no auto-logout (P1).
6. Raw `error.message` returned to clients on 500 — internal detail disclosure (P2).
7. 53 dependency vulnerabilities: frontend 32 (1 critical, 22 high), backend 21 (13 high) (P1).
8. No transaction boundaries on financial writes — partial-write corruption (P1).
9. No idempotency keys — duplicate submissions create duplicate records (P1).
10. 58 TypeScript errors including real crash paths (`dean.ts:786-790`, `finance.ts:613-616`) (P2).

## Top NAAC / NIRF / UGC data gaps

- No **metric engine**: no criterion ID, formula, numerator/denominator, or calculated result anywhere.
- No **data provenance**: evidence cannot be traced from a report back to the operational row that produced it.
- No **verification/approval workflow** on compliance figures — no owner, verifier, approver, or version history.
- No **framework versioning** — accreditation models are not configurable; `ComplianceReport.framework` is a free-text string.
- **NIRF inputs are fabricated** — faculty qualification and experience are auto-invented (see finding 1).
- No **AISHE** support of any kind.
- No **ABC / NCrF / multiple entry-exit** credit architecture.

---

## Recommended next phase

**Do not begin feature development.** The correct sequence is data-integrity first — see `18_IMPLEMENTATION_ROADMAP.md`. In outline:

1. **Stop the bleeding (days, not weeks):** delete the JWT fallback and fail-fast on missing env; remove all `getOrCreate*` fabrication; put uploads behind auth; add `.env.example`.
2. **Establish a migration baseline** before any schema change, and fold `FacultyLessonPlan` into the schema.
3. **Make audit real** — write `SystemAuditLog` on every mutation; add history tables for grades, marks, fees.
4. **Add validation and transactions** at the boundary, then build outward.

Only after those four does it make sense to build the admissions lifecycle, the OBE engine, and the compliance evidence layer.

---

*Every claim in this document is anchored to a file and line number in the audited commit. Items that could not be verified in this environment are listed as `BLOCKED / NOT VERIFIED` in the relevant domain document and in `17_MASTER_GAP_REGISTER.md`.*
