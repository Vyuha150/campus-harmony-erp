# 09 — ERP Feature Coverage Matrix

Values: `YES` · `PARTIAL` · `NO` · `MOCK` · `BROKEN` · `NOT VERIFIED`

**Standing caveats applying to every row:**
- **Tests** = `NO` universally — the entire suite is one trivial assertion (`14_TESTING_RELIABILITY.md`).
- **Validation** = `NO` universally — no backend validation library exists (`04_BACKEND_AUDIT.md` B2).
- **Production Ready** = `NO` universally — gated by the P0 findings.
- **UI** columns reflect static analysis only; the application was never run (`03_FRONTEND_AUDIT.md`).

---

## Implemented modules

| Module | UI | Backend | DB | API | Permissions | Validation | Reporting | Tests | Prod Ready |
|---|---|---|---|---|---|---|---|---|---|
| Authentication | YES | PARTIAL | YES | 2 | YES | NO | n/a | NO | **NO** |
| Student portal | YES | PARTIAL | YES | 32 | YES | NO | PARTIAL | NO | NO |
| Faculty portal | YES | PARTIAL | YES | 44 | YES | NO | PARTIAL | NO | NO |
| HOD | YES | PARTIAL | YES | 70 | YES | NO | PARTIAL | NO | NO |
| Dean | YES | PARTIAL | YES | 40 | YES | NO | PARTIAL | NO | NO |
| VC / Pro-VC | YES | PARTIAL | YES | 33 | YES | NO | PARTIAL | NO | NO |
| Registrar | YES | PARTIAL | YES | 34 | YES | NO | PARTIAL | NO | NO |
| COE | YES | PARTIAL | YES | 8 | YES | NO | PARTIAL | NO | NO |
| Finance | YES | PARTIAL | YES | 34 | YES | NO | PARTIAL | NO | NO |
| Placements | YES | PARTIAL | YES | 33 | YES | NO | PARTIAL | NO | NO |
| Alumni | YES | PARTIAL | YES | 20 | YES | NO | PARTIAL | NO | NO |
| IQAC | YES | PARTIAL | YES | 17 | YES | NO | PARTIAL | NO | NO |
| Grievances | YES | YES | YES | 14 | YES | NO | PARTIAL | NO | NO |
| Security | YES | PARTIAL | YES | 35 | YES | NO | PARTIAL | NO | NO |
| Sports | YES | PARTIAL | YES | 30 | YES | NO | PARTIAL | NO | NO |
| Library | YES | PARTIAL | YES | 7 | YES | NO | PARTIAL | NO | NO |
| Admin | YES | PARTIAL | YES | 24 | YES | NO | PARTIAL | NO | NO |
| File uploads | PARTIAL | PARTIAL | NO | 1 | **NO** | NO | n/a | NO | NO |

`Backend = PARTIAL` throughout because endpoints exist but lack validation, transactions, pagination and audit. Grievances is the one module rated `YES` — it is the most completely modelled workflow, though its anonymity guarantee is broken by unauthenticated file serving.

## Detailed coverage by ERP domain

### Institution administration

| Capability | Status | Evidence |
|---|---|---|
| University/institution setup | **NO** | No `Institution` model — single-tenant by construction |
| Schools / colleges / campuses | **NO** | `User.campus` is a free-text `String?` |
| Departments | YES | `Department` with unique name/code |
| Centres | NO | — |
| **Programmes** | **NO** | **No `Programme` model** — `StudentProfile.program` is free text |
| Academic years | PARTIAL | `AcademicYear` with `isCurrent`; semesters in `Json` |
| Academic calendar | NO | — |

The absence of `Programme` is structural: without it, curriculum, credits, electives, prerequisites and multiple entry/exit are all unrepresentable.

### Admissions — **entirely absent**

| Capability | Status |
|---|---|
| Enquiry, application, eligibility, merit, counselling | **NO** — no models |
| Document verification | **NO** |
| Admission decision, fee collection at admission | **NO** |
| Enrollment | PARTIAL — `Enrollment` is course-level, not admission |
| Cancellation / refund | **NO** |

**The system has no way to admit a student.** In practice, students appear via `getOrCreateStudentProfile` fabrication (`students.ts:122`) or `seed.ts`. This is the single largest functional gap.

### Student Information System

| Capability | Status | Notes |
|---|---|---|
| Student master profile | PARTIAL | Exists; **no demographics** (gender, category, domicile) |
| Academic history | PARTIAL | `Enrollment.grade` only; no semester results |
| Documents | PARTIAL | `CertificateRequest`; storage insecure |
| Attendance | YES | `AttendanceSession` + `Attendance` with unique constraint |
| **Credits** | **PARTIAL** | Stored scalars, **never computed** |
| **CGPA** | **BROKEN** | **Fabricated as `8.5`**, never calculated |
| Progression | NO | No promotion/detention workflow |
| Disciplinary history | PARTIAL | `DisciplinaryCase` — no FK to student |
| Scholarships | **NO** | No model |

### Academic management

| Capability | Status |
|---|---|
| Curriculum / schemes / catalogues | **NO** |
| Credits | PARTIAL — `Course.credits` unaggregated |
| **Electives / prerequisites** | **NO** |
| Course registration | PARTIAL — `Enrollment`, no seat/eligibility logic |
| Timetable | PARTIAL — `TimetableSlot` stores rows; **no generation or clash detection** |
| Faculty allocation | PARTIAL — `Course.facultyId` |
| Classrooms | NO |
| Attendance | YES |

### Outcome-Based Education — **entirely absent**

| Capability | Status |
|---|---|
| CO / PO / PSO definition | **NO** — no models |
| CO-PO mapping | **NO** |
| Attainment calculation | **NO** |
| Direct / indirect assessment | **NO** |
| Gap analysis, action taken reports | **NO** |

The only CO reference is **fabricated**: `faculty.ts:573` writes `CO${Math.min(week, 5)}` into auto-generated lesson plans. OBE is mandatory for NBA accreditation and central to NAAC teaching-learning evidence.

### Examination

| Capability | Status |
|---|---|
| Exam registration, hall tickets | **NO** |
| Question paper workflow | **NO** |
| Internal marks | PARTIAL — `Submission.obtainedMarks` |
| External marks, moderation, evaluation | **NO** |
| **Result processing** | **NO** — `ExamProgress` tracks status only |
| Grades | PARTIAL — `Enrollment.grade` free text |
| **SGPA / CGPA** | **NO** — no computation |
| Revaluation, supplementary | **NO** |
| **Transcripts** | **NO** |
| Certificates | PARTIAL — request tracking only |

The COE module has 8 endpoints — the smallest in the system — for what is one of the most complex domains in any HEI ERP.

### Faculty & HR

| Capability | Status |
|---|---|
| Faculty profiles | PARTIAL — **fabricated** (`faculty.ts:38-52`) |
| **Qualifications** | **BROKEN** — free text, auto-set to `'Ph.D in CSE'` |
| Experience | **BROKEN** — auto-set to `5` |
| Workload | PARTIAL — `HODWorkload` UI |
| Attendance (staff) | **NO** |
| Leave | YES — `LeaveRequest` |
| Recruitment | PARTIAL — `FacultyRecruitment`, `Vacancy` (counts only) |
| Appraisal | **NO** |
| Promotion / retirement | PARTIAL — models exist, **seed blocks commented out pending migrations** |
| FDP | **NO** |
| Publications | PARTIAL |
| Payroll | PARTIAL — `PayrollRecord`; no statutory compliance (PF/ESI/TDS) |

### Research

| Capability | Status |
|---|---|
| Publications | PARTIAL — no DOI, ISSN, indexing, co-authors |
| **Citations, patents, consultancy** | **NO** |
| Funded projects, grants | YES — `ResearchProject` |
| **PhD scholars / supervisors** | **NO** |
| **Conferences, collaborations** | **NO** |

### Finance

| Capability | Status |
|---|---|
| Fees | PARTIAL — `FeeRecord`, `FeeStructure` |
| **Payment gateway** | **NO** — no integration, no reconciliation |
| **Receipts** | **NO** |
| Concessions / scholarships / refunds | **NO** |
| Accounting | PARTIAL — `JournalEntry` with `accounts Json`; no chart of accounts, no double-entry enforcement |
| Budgets, expenditure | YES |
| Procurement | PARTIAL — `PurchaseOrder`, `Vendor` |
| Reconciliation | **NO** |

**No transactions anywhere in finance** — see `14_TESTING_RELIABILITY.md` T1.

### Placement

| Capability | Status |
|---|---|
| Companies, drives, applications, offers | YES |
| Eligibility rules | **NO** — no criteria engine |
| Packages | YES |
| **Internships** | **NO** |
| Statistics | PARTIAL |
| Higher education / entrepreneurship outcomes | PARTIAL — `ProgressionSurvey` |

### IQAC / Quality, Student support, Operations, Alumni, Communication

| Domain | Status | Key gap |
|---|---|---|
| IQAC / accreditation | PARTIAL | Storage only — **no metric engine** (`10_NAAC_READINESS.md`) |
| Grievances | YES | **Anonymity broken** by public file serving |
| Anti-ragging | PARTIAL | Affidavits only; no incident workflow |
| Counselling / mentoring | PARTIAL | `MenteeAssignment`, `CounselingNote` |
| **Scholarships, clubs, welfare** | **NO** | — |
| Library | PARTIAL | `LibraryBook` conflates title and copy — **cannot model multiple copies** |
| Hostel | PARTIAL | Allocation only; no fees, mess, complaints |
| **Transport** | **NO** | — |
| Inventory / assets | PARTIAL | `LabInventoryItem`, `SportsInventoryItem` — no depreciation |
| Sports, events, security | PARTIAL–YES | Reasonable coverage |
| Alumni | YES | Best-covered non-core module |
| **Notifications** | **BROKEN** | Records stored; **no email/SMS/push transport exists** |

`Notification` and `SystemNotificationRecord` persist messages with `readCount`/`totalRecipients`, and `AdminNotifications` renders a UI — but **nothing sends anything**. Another storage-without-capability façade.

### Data import/export & reporting

| Capability | Status |
|---|---|
| Excel/CSV import, validation, preview, dedup, rollback | **NO** — none exists |
| Import history | **NO** |
| Excel/CSV/PDF export | **NO** — no export library in either `package.json` |
| Institutional reports | PARTIAL — per-endpoint ad-hoc aggregation |
| API/JSON | YES |

**No bulk import means no legacy data migration path** — a hard blocker for onboarding any real institution.

## Summary

| Assessment | Count |
|---|---:|
| Domains substantially covered | Alumni, Sports, Security, Grievances, Attendance, Leave |
| Domains partially covered | Student, Faculty, Finance, Placement, Library, Hostel, IQAC, Research |
| **Domains entirely absent** | **Admissions, OBE, Examination lifecycle, Programme/Curriculum, Credits/ABC, Scholarships, Transport, Import/Export, Notification delivery, Payment gateway** |

**Functional completeness: 45 / 100.** Breadth is real; the absent domains are the ones that make an ERP authoritative — admissions creates the student, examinations create the result, credits create the degree. Without them the system administers around an academic core it does not actually contain.
