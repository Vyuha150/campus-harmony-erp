# 05 — Database Audit

**Schema:** `backend/prisma/schema.prisma` — 1,554 lines, **95 models**, PostgreSQL provider.
**Migrations:** **NONE.** `backend/prisma/` contains only `schema.prisma` and `seed.ts`.

---

## D1 — Zero migrations (P0)

```
$ ls backend/prisma/
schema.prisma   seed.ts
$ ls backend/prisma/migrations/
ls: cannot access 'prisma/migrations/': No such file or directory
```

A 95-model schema holding student academic records, financial ledgers and payroll has **no version history**. Implications:

- No reproducible deployment — schema can only be materialised via `prisma db push`, which is destructive by design and intended for prototyping.
- No rollback path if a schema change corrupts data.
- No review trail for schema changes affecting academic records.
- `seed.ts:83-88` itself acknowledges the gap: it throws *"Database schema is not up to date… Run your Prisma migrations (or prisma db push) before seeding."*
- `seed.ts:1493-1511` contains commented-out seed blocks labelled *"uncomment after running migrations"* for `PromotionRequest` and `RetirementRequest` — evidence that migration drift was already a known problem to the authors.

**Fix:** generate a baseline migration from the current schema *before* any further schema edit, and switch deployment to `prisma migrate deploy`.

## D2 — Runtime-created shadow table (P1)

`backend/src/routes/faculty.ts:10-26` creates `FacultyLessonPlan` via `$executeRawUnsafe` on every request that touches lesson plans. This table:

- is **not** in `schema.prisma` — Prisma has no knowledge of it;
- has **no foreign key** to `Course` (`course_id TEXT NOT NULL`), so deleting a course orphans its lesson plans;
- executes DDL on a request hot path (lock contention risk under concurrency);
- will not survive or be reconciled by a future `prisma migrate`.

## D3 — Referential integrity largely absent (P0 for data integrity)

Approximately **40 reference fields across the "Phase 2" models are bare `String` with no `@relation`**, meaning PostgreSQL enforces nothing. Confirmed examples:

| Model | Field | Should reference | Enforced? |
|---|---|---|---|
| `Meeting` | `createdBy` | `User.id` | ✗ |
| `BroadcastMessage` | `sender` | `User.id` | ✗ |
| `PolicyScenario` | `createdBy` | `User.id` | ✗ |
| `TransferRequest` | `studentId` | `StudentProfile.id` | ✗ |
| `RecordChangeRequest` | `studentId`, `requestedBy`, `approvedBy` | `StudentProfile.id`, `User.id` | ✗ |
| `JournalEntry` | `createdBy`, `approvedBy` | `User.id` | ✗ |
| `PurchaseOrder` | `approvedBy` | `User.id` | ✗ |
| `PayrollRecord` | `employeeId` | `FacultyProfile.employeeId` | ✗ |
| `JobOffer` | `studentId` | `StudentProfile.id` | ✗ |
| `SportsAthlete` | `studentId` | `StudentProfile.id` | ✗ (only `@unique`) |
| `IQACActionItem` | `assignedTo` | `User.id` | ✗ |
| `QualityDocument` | `uploadedBy`, `reviewedBy` | `User.id` | ✗ |
| `GrievanceCase` | `complainantId`, `assignedTo` | `User.id` | ✗ |
| `AntiRaggingAffidavit` | `studentId` | `StudentProfile.id` | ✗ |
| `IDCardRequest` | `applicantId`, `approvedBy` | `User.id` | ✗ |
| `VigilanceCase` | `investigatingOfficer` | `User.id` | ✗ |
| `SystemAuditLog` | `userId` | `User.id` | ✗ |
| `DegreeRecord` | `rollNo` | `StudentProfile.rollNumber` | ✗ |
| `DisciplinaryCase` | `rollNumber`, `reportedBy` | — | ✗ |
| `ExamProgress` | `coordinator` | `User.id` | ✗ |

Combined with **zero input validation** (see `04_BACKEND_AUDIT.md`), any client may POST an arbitrary string as `approvedBy` or `studentId`. Nothing rejects it at the API layer and nothing rejects it at the database layer. Orphaned and fabricated references are silently accepted into institutional records.

Worse, `DisciplinaryCase` and `DegreeRecord` denormalise `studentName`/`rollNumber` as free text with no link to `StudentProfile` — a student's disciplinary record and degree certificate are not reliably joinable to the student.

## D4 — No audit trail on authoritative records (P0 for compliance)

`SystemAuditLog` exists as a model with the right shape (`userId`, `action`, `module`, `resource`, `details`, `ipAddress`, `userAgent`, `timestamp`, `severity`).

**It is never written.** Repository-wide search of `backend/src/routes/`:

- `systemAuditLog.findMany` / `.count` / `.groupBy` → 3 occurrences (`admin.ts:264`, `:318`, `:339`)
- `systemAuditLog.create` → **0 occurrences**

The Admin → Audit Logs screen therefore renders whatever `seed.ts` inserted, permanently.

Separately, **no model has history/versioning**. Critically:

| Record type | Model | Mutated at | Old value kept? | Approver? | Reason? |
|---|---|---|---|---|---|
| Course grade | `Enrollment.grade` | `faculty.ts:1029` | ✗ | ✗ | ✗ |
| Assignment marks | `Submission.obtainedMarks` | `faculty.ts:986` | ✗ | ✗ | ✗ |
| Attendance | `Attendance.status` | various | ✗ | ✗ | ✗ |
| Fee status | `FeeRecord.status` | `finance.ts` | ✗ | ✗ | ✗ |
| CGPA | `StudentProfile.cgpa` | `students.ts:138` | ✗ | ✗ | ✗ |

**A faculty member can change a published grade and leave no trace.** For an institutional record system subject to accreditation and legal scrutiny, this is disqualifying. The audit brief's required fields (`created_by`, `updated_by`, `approved_by`, timestamp, reason, old value, new value, IP/session) are present on **no** model.

`User` has `createdAt`/`updatedAt`; most other models have neither.

## D5 — CGPA is stored and fabricated, never computed (P0)

`StudentProfile.cgpa Float @default(0)` is a stored scalar. There is **no computation** anywhere deriving it from `Enrollment.grade` + `Course.credits`. Instead:

- `students.ts:138` writes a literal `cgpa: 8.5` when auto-creating a profile;
- `seed.ts:174` writes `cgpa: 8.7`.

`totalCredits` and `earnedCredits` are likewise stored, never calculated. There is no grade-point mapping table, no SGPA model, and no semester result entity. **The system cannot currently produce a defensible transcript.**

## D6 — No soft delete, archival, or retention (P1)

No model has `deletedAt`, `isDeleted`, `archivedAt`, or a status enum covering archival. Cascade behaviour is aggressive:

`User` → `StudentProfile` (`onDelete: Cascade`) → `Enrollment`, `Attendance`, `Submission`, `FeeRecord`, `LibraryBook`, `CertificateRequest`, `HostelAllocation` (all `Cascade`).

**Deleting one `User` row permanently destroys that student's entire academic and financial history**, including fee payment records. There is no recovery path, no tombstone, and no retention policy. Indian HEIs are generally required to retain student academic records long-term; this schema actively prevents it.

## D7 — Weak typing of domain state (P2)

Every state field is an unconstrained `String` with the allowed values written only as a trailing comment:

```prisma
status String @default("applied") // 'applied', 'shortlisted', 'selected', 'rejected'
status String @default("pending") // pending, approved, rejected
```

No Prisma `enum` is used anywhere in 1,554 lines. With no backend validation, any string is persistable — including typos and states no code path handles. Transition rules (e.g. `received → under_investigation → resolved`) exist only as convention; `lib/grievanceStatus.ts` maps statuses per role but does not enforce legal transitions.

Structured data is stored in untyped `Json` columns (`agendaItems`, `criteria`, `keyIndicators`, `accounts`, `allowances`, `deductions`, `feeComponents`, `results`, `timeline`). These are unqueryable in a typed way, unvalidatable, and unindexed — a significant obstacle for the compliance reporting the product intends.

## D8 — Indexing is sparse (P2)

Only `CourseClass`, `ClassEnrollment`, `Committee`, `ClassMessage`, `CounselingNote`, `LabInventoryItem`, `PurchaseRequest`, `TimetableSlot`, `AccreditationData`, `CurriculumProposal`, `DisciplinaryCase`, `Meeting`, `FitnessRecord`, `SportsAttendance` carry `@@index`. High-traffic lookups are unindexed, notably:

- `Attendance.studentProfileId` (only a composite unique with session)
- `FeeRecord.studentProfileId`, `.status`, `.dueDate`
- `Notification.userId` + `.read` (dashboard query on every page load)
- `SystemAuditLog.timestamp`, `.userId` (the log-viewer query)
- `GrievanceCase.status`, `.assignedTo`

Combined with ~9% pagination coverage, dashboard and list endpoints will degrade linearly with institutional data volume.

## D9 — Duplicate/superseded models (P3, do not delete yet)

| Model | Apparent successor | Evidence | Safe to remove? |
|---|---|---|---|
| `Facility` | `SportsFacility` | schema comment: *"enhanced from existing Facility model"* (line 1106) | **Verify first** — check `sports.ts` usage |
| `Team` | `SportsTeam` | schema comment: *"enhanced from existing Team model"* (line 1091) | **Verify first** |
| `QualityMetric` | `AccreditationData` / `ComplianceReport` | overlapping purpose | **Verify first** |
| `IncidentReport` | `VigilanceCase` / `SupportTicket` | overlapping purpose | **Verify first** |

Per audit rules, **nothing was deleted**. Each requires a usage trace before removal.

## Integrity risk summary

| Risk | Present? | Consequence |
|---|---|---|
| Duplicate student records | **Yes** — `getOrCreateStudentProfile` creates on read | Phantom students with fabricated CGPA |
| Duplicate employee records | **Yes** — `getOrCreateFacultyProfile` | Phantom faculty with fabricated PhD |
| Registration/roll number collision | Partially mitigated — `rollNumber @unique`, but generated from a UUID slice (`STU` + 6 chars) → collision possible |
| Academic record modified without trace | **Yes** | Grades alterable silently |
| Financial record modified without trace | **Yes** | No ledger immutability |
| Cascade data loss | **Yes** | One user delete destroys full academic history |
| Orphaned references | **Yes** | ~40 unenforced reference fields |
| Partial writes | **Yes** | 4 transactions / 478 endpoints |

## Priority remediation

1. **Baseline migration now**, before any other schema work (P0).
2. Remove `getOrCreate*` fabrication; profiles must be created by an explicit admissions/HR workflow (P0).
3. Add `SystemAuditLog` writes on every mutation; add history tables for grade, marks, fee, attendance (P0).
4. Convert the ~40 reference strings into real foreign keys (P0) — requires a data-cleanup migration.
5. Replace cascade deletes with soft delete + retention policy (P1).
6. Compute CGPA/SGPA from grades; introduce grade-point and semester-result models (P1).
7. Convert status strings to Prisma `enum`s with transition validation (P2).
8. Add indexes for the query patterns listed in D8 (P2).
9. Fold `FacultyLessonPlan` into `schema.prisma` and delete the runtime DDL (P1).
