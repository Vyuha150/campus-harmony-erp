# 13 — Blueprint Gap Map

**Source:** *Comprehensive ERP Blueprint for Indian Universities (NAAC/UGC/NIRF Aligned)* — 444 sections, 15 modules, 11 role portals.
**Mapped against:** repository as of **2026-08-22**, after checkpoints 1–15.

> **Revised 2026-08-22.** The 2026-08-19 version was materially wrong by this date:
> it still recorded examinations, results, curriculum, OBE, notifications, finance
> and reporting as missing, all of which have since been built and verified against
> a running system. A stale gap map causes wrong prioritisation, so every row below
> was re-checked rather than carried forward.
>
> **"DONE" here means built and exercised against a running server** — not
> production-hardened. Nothing in this document has yet been seen in a browser.

Legend: ✅ **DONE** · 🔷 **PARTIAL** · ❌ **MISSING** · ⚠️ **BROKEN** (exists but produces untrustworthy output)

---

## Blueprint requirements resolved in this session

| Blueprint requirement | Quote | Status |
|---|---|---|
| Multi-campus architecture | *"Data is segmented by campus/college while remaining in one database"* | ✅ **DONE** — ADR-0001, migration 0002 |
| Campus-scoped roles | *"Principal at Campus A cannot see or edit data of Campus B"* | ✅ **DONE** — verified live: two institutions, 17 vs 1 users |
| Institution-wide roles | *"VC, Registrar, or Group Finance Officer have access to all campuses"* | ✅ **DONE** — `scopeLevel: INSTITUTION` |
| Data segregation | *"users only access their relevant campus data"* | ✅ **DONE** — cross-tenant IDOR returns 403; client tenant override rejected |
| Programme structure | *"Define the structure of each academic program (courses, credits, syllabus)"* | ✅ **DONE** — `CurriculumScheme` → baskets → `SchemeCourse`, with credits and prerequisites (migration 0007) |
| Faculty qualification for NIRF | *"track faculty with PhDs and their experience"* | 🔷 **PARTIAL** — structured `qualificationLevel` + verification fields; fabrication removed; the importer normalises only unambiguous spellings and leaves the rest UNKNOWN. **Existing rows still need backfill** |
| Student demographics | *"capture demographics (state, country, gender, category)"* | 🔷 **PARTIAL** — columns added; **collection gated on legal review** |
| Audit trail | *"maintain an audit trail of any grade changes for transparency"* | ✅ **DONE** — `GradeHistory` records every change immutably (T-104); the audit write shares the business transaction, so an untraceable change cannot commit |

---

## Module-by-module

### 1. Admissions & Enrollment — ✅ **CORE WORKFLOW DONE**

Migration `0004_admissions`. Verified end-to-end against a running server.

| Feature | Status |
|---|---|
| Applications with entrance-exam score/rank capture | ✅ |
| **Quota / reservation seat allocation** | ✅ Statutory categories; row-locked allocation |
| Eligibility screening | ✅ Rule enforced over verifier input; reason recorded |
| Merit ranking **within category** | ✅ |
| Offers with expiry; decline releases the seat | ✅ |
| **Student registration + roll-number generation** | ✅ Atomic: User + StudentProfile + FeeRecord |
| Admission analytics (intake vs filled — NAAC Criterion 2) | ✅ **Derived** from records |
| Programme allotment | ✅ Via `Programme`/`Batch` |
| Document upload + verification trail | 🔷 Model and file storage exist; verification endpoints still pending |
| Counselling rounds | ❌ |
| Application-fee payment gateway | 🔷 Payment recording, allocation and receipts exist (0010); **no gateway integration** — offline and reference-based methods only |
| Offer-letter PDF generation | ❌ CSV/JSON export exists; **PDF is explicitly refused** rather than silently downgraded |

**This closes the audit's largest functional gap.** The system can now admit a student through a defensible, audited, quota-compliant workflow. Blueprint: *"Do not treat admission as a basic CRUD table"* — the implementation is a state machine with transactional boundaries, not CRUD.

### 2. Academic Management — ✅ **MOSTLY DONE**

| Feature | Status |
|---|---|
| Programme & curriculum setup | ✅ Versioned `CurriculumScheme`, baskets, credits, prerequisites (0007) |
| Outcome-Based Education (CO mapping) | ✅ CO/PO/PSO, CO–PO mapping with correlation strength, and **attainment computed from outcome-wise marks** (0015). Verified against a hand computation |
| Academic calendar | 🔷 `AcademicYear` (now tenant-scoped); no calendar events |
| **Timetable & scheduling** | 🔷 Clash detection exists on individual slot writes (`dean.ts`, `hod.ts`); **no generation engine** |
| Attendance recording | ✅ Models + endpoints exist |
| Attendance % + shortage alerts | 🔷 Computed ad-hoc; **no alerting** |
| Lesson plans & syllabus coverage | ✅ Now a real model (was runtime DDL + fabricated) |
| Content distribution / LMS | ❌ |

### 3. Examination & Evaluation — ✅ **MOSTLY DONE** (was the largest gap)

| Feature | Status |
|---|---|
| Exam planning, hall/invigilator allocation | 🔷 `ExamSession`/`ExamSchedule` exist; **no invigilator allocation** |
| Question paper workflow | ❌ |
| Student exam registration + **eligibility enforcement** | ✅ Eligibility computed from attendance % + fee dues; condonation requires a recorded reason (0008) |
| Hall tickets | ✅ Issued against a verified registration |
| Marks entry | ✅ Gated on registration and eligibility |
| **Moderation & approval workflow** | ✅ submit → verify → moderate → approve → publish |
| **Grade computation, SGPA, CGPA** | ✅ Credit-weighted and **computed**, never stored-and-trusted. Versioned `GradeScale`; CGPA is not the mean of SGPAs |
| Result publication (atomic) | ✅ Publication gated on moderation |
| Re-evaluation / supplementary | ✅ Revaluation recomputes and writes grade history |
| Transcripts, degree certificates | ❌ Blocked on PDF generation |
| Exam analytics (pass % → NIRF GO) | ✅ `EXAM_PASS_RATE` report derived from `CourseResult`, with provenance |

8 endpoints for the most complex domain in any HEI ERP. **The system cannot currently produce a defensible transcript.**

### 4. Student Information & Lifecycle — 🔷 **PARTIAL**

| Feature | Status |
|---|---|
| Student profile | ✅ (fabrication removed) |
| **Demographics for diversity reports** | 🔷 Columns added; ⚠️ **legal review required** |
| Guardian/contact, previous education | ❌ |
| Course registration | ✅ Prerequisites and credit limits enforced at registration, not advisory |
| Attendance summary | ✅ |
| Continuous assessment | 🔷 |
| Certificates & service requests | 🔷 Request tracking only; no issuance |
| Disciplinary records | 🔷 No FK to student |
| Academic progression / promotion | ❌ |

### 5. HR & Faculty — 🔷 **PARTIAL**

| Feature | Status |
|---|---|
| Faculty profiles | ✅ (fabrication removed) |
| **Qualifications (NIRF TLR)** | 🔷 `qualificationLevel` + verification added; needs backfill |
| Experience, employment type | 🔷 Structured fields added |
| Workload | 🔷 |
| Leave | ✅ |
| Recruitment | 🔷 Counts only |
| Appraisal, FDP | ❌ |
| Promotion / retirement | 🔷 Models exist |
| Payroll | 🔷 No statutory compliance (PF/ESI/TDS) |

### 6. Finance & Procurement — 🔷 **PARTIAL**

| Feature | Status |
|---|---|
| Fee structures, invoices | 🔷 Now tenant-scoped (0010); `FeeRecord` tracks paid/waived and derives its status |
| **Payment gateway** | ❌ Payments are recorded and allocated, but **no gateway is integrated** |
| **Receipts** | ✅ Issued in the SAME transaction as the payment; numbered per financial year; cancellation requires a reason and never reuses a number |
| Concessions, scholarships, refunds | ❌ |
| Accounting | 🔷 `JournalEntry` with untyped `Json`; no chart of accounts |
| Budgets, procurement | ✅ |
| Reconciliation | 🔷 `reconciledAt` and gateway reference are captured; no reconciliation process |
| **Transactional money operations** | 🔷 The payment path is atomic and idempotent (verified: a repeated key returns the original payment, no second charge). **Payroll, journals and purchase orders remain legacy and untransacted** |

### 7. Library — ✅ **MOSTLY DONE**
The title/copy conflation is fixed: a row is now a physical copy keyed by accession number, so a library can hold several copies of one ISBN (migration 0012). Circulation history survives return, fines are computed from institutional policy rather than typed in by whoever is at the desk, and double-issue is blocked by a partial unique index — verified even with the catalogue deliberately desynchronised. **Still missing:** acquisitions workflow, OPAC, reservations/holds, and fine collection wired to the finance module.

### 8. Research — 🔷 **THIN**

| Feature | Status |
|---|---|
| Publications | 🔷 No DOI, ISSN, indexing, co-authors |
| **Citations** | ❌ NIRF RP input |
| **Patents** | ❌ NIRF RP input |
| Projects, grants | ✅ |
| **Consultancy** | ❌ |
| **PhD scholars / supervisors** | ❌ |
| Conferences, collaborations | ❌ |

RP is a top-weighted NIRF parameter and the weakest area of the data model.

### 9. Student Support & Campus Life — 🔷 **PARTIAL**
Grievances ✅ (best-modelled workflow, but see anonymity fix), anti-ragging 🔷 (affidavits only), mentoring 🔷, sports ✅, hostel 🔷. **Scholarships, clubs, cultural activities, welfare schemes: ❌**

### 10. Placements — ✅ **MOSTLY DONE**
Companies, drives, applications, offers all exist. Missing: **eligibility criteria engine**, internships, higher-studies tracking depth.

### 11. Governance & NAAC/NIRF Reporting — 🔷 **FOUNDATION BUILT, ENGINE BLOCKED**

| Feature | Status |
|---|---|
| **Committee management** | ✅ `GovernanceCommittee`, members and meetings (migration 0003) |
| **Policy documentation repository** | ✅ `InstitutionalPolicy` (migration 0003) |
| NAAC criterion-wise data organisation | 🔷 `AccreditationData.value` is a **typed-in String** |
| **SSR / AQAR generation** | ❌ |
| **NIRF report generator** | ❌ |
| **Metric engine (formula/numerator/denominator)** | 🔷 The reporting layer computes from operational records and declares its formula; **criterion mapping is blocked on official documents** |
| **Data provenance** | ✅ Every report carries its source models and formula |
| Evidence repository | 🔷 `QualityDocument`; ✅ now access-controlled |
| Audit trail for evidence | ✅ Audit service live |

**Calculation now exists**, and figures are derived from operational records with provenance. What remains blocked is the **criterion-by-criterion mapping**, which needs the official NAAC manual, the NIRF methodology + DCS, and the UGC clause texts. It will not be built from secondary sources — see `16_REMEDIATION_PLAN.md` Phase 6.

### 12. Grievance & Feedback — ✅ **MOSTLY DONE**
Filing, categories, workflow, resolution tracking, feedback forms all exist. **Anonymity was broken** by public file serving — ✅ fixed. Missing: escalation timers, Ombudsperson/ICC model, appeals.

### 13. Communication & Notification — 🔷 **PARTIAL**
The store-and-discard defect is fixed. Templates, policies, channel providers and per-recipient delivery tracking exist (migration 0009), and messages are dispatched and recorded rather than counted and dropped. Email, SMS, push and WhatsApp providers are **fail-loud stubs** — they refuse rather than silently discard, and need vendor accounts plus DLT registration to become real. **No frontend exists for this module.**

### 14. Analytics & Dashboards — 🔷 **PARTIAL**
A shared reporting layer now exists: reports declare their source models and formula, and CSV/JSON export is implemented with formula-injection defence and a UTF-8 BOM so Excel reads Indian names correctly. XLSX and PDF are **explicitly refused** rather than silently downgraded. Legacy per-endpoint aggregation still exists across the unmigrated routes, and there is no drilldown.

### 15. Multi-Campus — ✅ **DONE (this session)**
Architecture, data segregation, campus-scoped roles, institution-wide roles, unified rollup — all implemented and verified. Remaining: campus-specific configuration UI, inter-campus course registration.

---

## Role portals

| Portal | Blueprint | Status |
|---|---|---|
| Student | ✅ specified | 🔷 Exists; empty states now needed |
| Faculty | ✅ | 🔷 Exists |
| HOD / Dean | ✅ | 🔷 Exists; fabrication removed this session |
| **Principal (constituent college)** | ✅ specified | ❌ **Role does not exist** — required by multi-campus |
| VC / Pro-VC | ✅ | 🔷 Exists; `pro_vc` undifferentiated |
| **Chancellor / Pro-Chancellor** | ✅ specified | ❌ Not modelled |
| Registrar, CoE, Finance, Placement, Sports, Alumni, IQAC, Grievance, Security | ✅ | 🔷 All exist |
| **Auditor (read-only)** | implied by vigilance/audit | ❌ **No read-only role** |

**Two blueprint roles are missing and now matter:** `principal` (campus head — the natural campus-scoped authority) and a read-only `auditor`.

---

## Revised priorities

Blueprint alignment changes the ordering from `18_IMPLEMENTATION_ROADMAP.md` in three ways:

| Change | Reason |
|---|---|
| **Multi-tenancy moved to done** | Was Phase 3 blocker; resolved |
| **Add `principal` role — now Phase 3** | Multi-campus without a campus head is incoherent |
| **Notification engine promoted** | Blueprint treats WhatsApp/SMS alerts as core, not optional; currently stores-and-discards |
| **Committee & policy modules added** | Explicit NAAC evidence requirements with no model at all |

### Progress against the original list

| # | Task | Status |
|---|---|---|
| 1 | Tenant scoping across all route files | ✅ **DONE** — made automatic via Prisma extension, not per-file |
| 2 | `principal` role | ✅ **DONE** |
| 3 | Read-only `auditor` role | ✅ **DONE** |
| 4 | Service layer (T-203) | ✅ Infrastructure done; **library migrated as the reference case**. 474 legacy handlers across 17 files remain |
| 5 | Curriculum & syllabus on `Programme` | ✅ **DONE** — migration 0007 |
| 6 | Grade-point + SGPA/CGPA engine | ✅ **DONE** — computed, credit-weighted (0006) |
| 7 | Committee + policy repository | ✅ **DONE** — migration `0003` |
| 8 | Notification delivery engine | ✅ **DONE** — messages dispatched and tracked (0009); vendor providers remain fail-loud stubs |
| 9 | Admissions lifecycle | ✅ **DONE** — migration `0004` |
| 10 | Backups + CI | ✅ CI pipeline live; backup taken with a **restore actually performed**. Still local-disk only — off-host replication outstanding |

### Next tasks

Superseded. Sequencing now lives in **`16_REMEDIATION_PLAN.md`**, which orders the
remaining work by dependency rather than by module, and separates what is unblocked
from what is waiting on documents that only the institution can obtain.

The short form, as of 2026-08-22:

| Phase | Work |
|---|---|
| **0** | Fix the librarian screen regression; run the app in a browser for the first time; clear 22 TypeScript errors |
| **1** | Schema surgery — `timestamptz`, foreign keys, enums, soft delete — plus a performance baseline and off-host backups |
| **2** | Workflow/approval engine, **before** the legacy migration so approval handlers are not rewritten twice |
| **3** | The 474 legacy handlers, risk-ordered, starting with a re-baseline on two small modules |
| **4** | Frontend for the rebuilt modules — a parallel track; six modules currently have **no UI at all** |
| **5** | Fine collection, attainment snapshots, timetable generation, transport, payroll |
| **6** | Compliance — **blocked** on the official NAAC manual, NIRF methodology + DCS, UGC clause texts, and a DPDP review |
