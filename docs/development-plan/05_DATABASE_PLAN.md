# 05 — Database Plan

## Migration baseline — DONE ✅

The single most important database change is complete.

```
prisma/migrations/
  20260818212826_0001_baseline/migration.sql
  migration_lock.toml
```

A 95-model schema holding student academic records, financial ledgers and payroll now has version history for the first time. Deployment moves from `prisma db push` (destructive, no rollback) to `prisma migrate deploy`.

Also folded in: **`FacultyLessonPlan`**, previously created at runtime by `CREATE TABLE IF NOT EXISTS` inside a request handler. It now has a real foreign key to `Course` (`onDelete: Cascade`), a `@@unique([courseId, weekNumber])` constraint, and proper timestamps — so deleting a course no longer orphans its lesson plans.

### Rules from here on

1. **Never** `prisma db push` against any shared database.
2. Every schema change is a reviewed migration.
3. Destructive migrations require: data inspection → backup → reversible steps where feasible → test against representative data.
4. `prisma migrate deploy` runs in CI before the application starts.

> **Prisma 7 note:** `migrate dev` no longer accepts `--skip-seed`. Documented because the audit assumed otherwise.

## T-104 — History tables (P0, next)

Grades, marks, fees and attendance are currently mutated with no record of who changed what, from what value, or why. `faculty.ts` updates `Enrollment.grade` directly.

Proposed shape, applied per sensitive entity:

```prisma
model GradeHistory {
  id           String   @id @default(uuid())
  enrollmentId String
  oldGrade     String?
  newGrade     String?
  reason       String              // mandatory for any post-publication change
  changedBy    String
  changedAt    DateTime @default(now())
  approvedBy   String?
  ipAddress    String?

  enrollment Enrollment @relation(fields: [enrollmentId], references: [id])

  @@index([enrollmentId])
  @@index([changedAt])
}
```

Same pattern for `MarksHistory`, `FeeRecordHistory`, `AttendanceHistory`, `CgpaHistory`.

**Rule:** history rows are written **inside the same transaction** as the change (`recordInTransaction` in `lib/audit.ts` exists for this). A grade change that cannot be audited must not commit.

## T-105 — Referential integrity (P1)

~40 reference fields are bare `String` with no FK. Combined with no validation, any client could POST an arbitrary string as `approvedBy` or `studentId` and nothing would reject it.

**Migration strategy** — each field, in order:

1. **Audit** — `SELECT COUNT(*) WHERE ref NOT IN (SELECT id FROM target)` to size the orphan problem.
2. **Clean** — reconcile or null out orphans via a dry-run-capable script (see T-Data-Fix below).
3. **Constrain** — add the FK in a migration.
4. **Verify** — confirm inserts with invalid references now fail.

Priority order (highest integrity impact first):

| Field | Target | Why first |
|---|---|---|
| `SystemAuditLog.userId` | `User.id` | Audit must identify a real actor |
| `GrievanceCase.complainantId`, `.assignedTo` | `User.id` | Statutory workflow |
| `JournalEntry.createdBy`, `.approvedBy` | `User.id` | Financial accountability |
| `RecordChangeRequest.*` | `User.id`, `StudentProfile.id` | Changes student records |
| `DegreeRecord.rollNo` | `StudentProfile.rollNumber` | Degree not joinable to student |
| `DisciplinaryCase.rollNumber` | `StudentProfile.rollNumber` | Same |
| remaining ~34 | various | |

## T-106 — Soft delete & retention (P1)

Current cascade chain destroys history irrecoverably:

```
User → StudentProfile → Enrollment, Attendance, Submission, FeeRecord,
                        LibraryBook, CertificateRequest, HostelAllocation
```

**One `User` delete permanently erases a student's entire academic and financial record**, including fee payments. Indian HEIs generally must retain academic records long-term.

Plan: add `deletedAt DateTime?` + `deletedBy String?`; change destructive cascades to `Restrict`; filter deleted rows in the repository layer (T-203) so it cannot be forgotten per-query; define retention per record class with legal input.

## T-107 — Enums (P2)

No Prisma `enum` exists in 1,554 lines; every status is unconstrained `String` with allowed values in a trailing comment. Convert the highest-risk first: `GrievanceCase.status`, `FeeRecord.status`, `Enrollment.grade`, `Submission.status`, `PlacementDrive.status`, `LeaveRequest.status`.

Pair each with a transition table so illegal jumps (e.g. `received → closed`) are rejected, not just illegal values.

## T-108 — Indexes (P2) — partially done

Added in the baseline: `Course.departmentId`, `Course.facultyId`, `CourseSchedule.courseId`, `FacultyLessonPlan.courseId`.

Still required (from audit D8):

| Table | Index | Query it serves |
|---|---|---|
| `Attendance` | `studentProfileId` | every student dashboard |
| `FeeRecord` | `studentProfileId`, `(status, dueDate)` | fee screens, dues reports |
| `Notification` | `(userId, read)` | **every page load** |
| `SystemAuditLog` | `timestamp`, `userId`, `module` | audit viewer (now growing) |
| `GrievanceCase` | `status`, `assignedTo` | grievance dashboard |
| `Enrollment` | `courseId` | class rosters |

`SystemAuditLog` is newly urgent — it was empty before and will now grow with every mutation.

## T-109 — Backup & restore (P0, not started)

`BackupRecord` is a model with **no implementation** — the seed inserts a row describing a fictional backup to S3 and the Admin UI displays it.

Required: scheduled `pg_dump`, off-host encrypted storage, retention policy, **documented and rehearsed restore**, defined RPO/RTO, separate file-storage backup once T-209 lands.

**A backup that has never been restored is not a backup.**

## Phase 4 — Academic core schema

Blocked on Phase 1–2. The structural gap:

```
Institution → Campus → School → Department → Programme → Batch → Section
                                                 ↓
                        Curriculum → Scheme → CourseBasket → Course
                                                 ↓
                          Enrollment → Assessment → Result → SGPA → CGPA
```

`Programme` does not exist today — `StudentProfile.program` is free text. Nothing can be built on that.

Also required: `GradePoint` mapping, `SemesterResult`, `AcademicRecordSnapshot` (for multi-year NIRF reporting), and **versioned** curriculum/grading so historical records stay interpretable under the rules in force at the time.

## Data-fix script standard

When historical data needs correction:

- `--dry-run` by default; explicit flag to apply
- counts before and after
- idempotent — safe to re-run
- logged to a file
- **never** manual `UPDATE` against production

## Sequence

| Order | Task | Priority | Blocks |
|---:|---|---|---|
| ✅ | T-102 baseline migration | P0 | everything |
| ✅ | T-101 `FacultyLessonPlan` | P1 | — |
| 1 | T-109 backup + tested restore | **P0** | safe destructive migrations |
| 2 | T-104 history tables | **P0** | trustworthy academic records |
| 3 | T-108 indexes | P2 | performance |
| 4 | T-105 foreign keys | P1 | integrity |
| 5 | T-106 soft delete | P1 | retention |
| 6 | T-107 enums | P2 | state correctness |
| 7 | Phase 4 academic core | P1 | all academic features |
