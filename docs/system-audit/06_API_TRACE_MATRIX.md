# 06 — Frontend ↔ API ↔ Backend ↔ DB Trace Matrix

## Coverage statement — read first

The brief requires a per-endpoint trace across all 478 endpoints. **That is not fully delivered here, and this document states exactly what is and is not verified rather than presenting inference as fact.**

| Scope | Status |
|---|---|
| `server.ts`, `middleware/auth.ts`, `routes/auth.ts`, `routes/uploads.ts` | ✅ Read in full |
| `students.ts`, `faculty.ts` — `getOrCreate*` and raw-SQL sections | ✅ Read |
| Remaining ~14 route files | 🟡 **Analysed by repository-wide pattern measurement, not line-by-line** |
| Per-endpoint UI consumer mapping | ❌ **NOT VERIFIED** |
| Runtime request tracing | ❌ **NOT PERFORMED** — app never run |

**Why:** two delegated background agents tasked with the exhaustive per-endpoint and per-component passes **failed (stalled with no recoverable output)**. Rather than fabricate 478 rows, the systemic measurements below are reported — these are firm, mechanically derived, and repository-wide — and the per-endpoint matrix is declared outstanding work.

**Aggregate counts in this document are verified. Per-endpoint classifications are not.**

---

## Module-level trace matrix

| Module | UI components | API prefix | Endpoints | Backend logic | DB models | Validation | AuthZ | Audit | Status | Missing link |
|---|---|---|---|---|---|---|---|---|---|---|
| Auth | `AuthContext`, `RoleSelection` | `/api/auth` | 2 | ✅ In-route | `User` | ❌ presence only | ✅ | ❌ | 🟡 PARTIAL | No refresh, no reset, no lockout |
| Students | 12+ | `/api/students` | 32 | 🟡 In-route | `StudentProfile`, `Enrollment`, `Attendance`, `FeeRecord` +8 | ❌ | ✅ module-level | ❌ | 🔴 **BROKEN** | **Fabricates records on read** |
| Faculty | 11 | `/api/faculty` | 44 | 🟡 In-route | `FacultyProfile`, `Course`, `Submission` +6 | ❌ | ✅ module-level | ❌ | 🔴 **BROKEN** | **Fabricates HR + lesson plans** |
| HOD | 12 | `/api/hod` | 70 | 🟡 In-route | `LabInventoryItem`, `TimetableSlot`, `AccreditationData` +5 | ❌ | ✅ | ❌ | 🟡 PARTIAL | No dept scoping |
| Dean | 13 | `/api/dean` | 40 | 🟡 In-route | `CurriculumProposal`, `DisciplinaryCase`, `InterDeptEvent` | ❌ | ✅ | ❌ | 🟡 PARTIAL | TS errors at `:786-790` |
| VC / Pro-VC | — | `/api/vc` | 33 | 🟡 In-route | `Meeting`, `BroadcastMessage`, `ComplianceReport`, `PolicyScenario` | ❌ | ✅ | ❌ | 🟡 PARTIAL | `pro_vc` undifferentiated |
| Registrar | 9 | `/api/registrar` | 34 | 🟡 In-route | `TransferRequest`, `DegreeRecord`, `VerificationRequest` +4 | ❌ | ✅ | ❌ | 🟡 PARTIAL | `DegreeRecord.rollNo` no FK |
| COE | 4 | `/api/coe` | 8 | 🟡 In-route | `Examination`, `ExamProgress` | ❌ | ✅ | ❌ | 🟡 PARTIAL | **No result processing** |
| Finance | 7 | `/api/finance` | 34 | 🟡 In-route | `FeeRecord`, `JournalEntry`, `PayrollRecord` +4 | ❌ | ✅ | ❌ | 🟡 PARTIAL | **No transactions**; TS errors `:613-616` |
| Placements | 7 | `/api/placements` | 33 | 🟡 In-route | `Company`, `PlacementDrive`, `JobOffer` +3 | ❌ | ✅ | ❌ | 🟡 PARTIAL | Creates users w/ default password |
| Alumni | 8 | `/api/alumni` | 20 | 🟡 In-route | `AlumniProfile`, `Donation`, `AlumniEvent` +4 | ❌ | ✅ | ❌ | 🟡 PARTIAL | — |
| IQAC | 6 | `/api/iqac` | 17 | 🟡 In-route | `AQARRecord`, `QualityDocument`, `IQACActionItem` +2 | ❌ | ✅ | ❌ | 🟡 PARTIAL | **No metric engine** |
| Grievances | 4 | `/api/grievances` | 14 | ✅ + `grievanceStatus.ts` | `GrievanceCase`, `ComplianceItem`, `AntiRaggingAffidavit` | ❌ | ✅ | ❌ | 🟡 PARTIAL | **Anonymity broken by public uploads** |
| Security | — | `/api/security` | 35 | 🟡 In-route | `VisitorPass`, `VehiclePass`, `VigilanceCase` +4 | ❌ | ✅ | ❌ | 🟡 PARTIAL | Password reset outside admin |
| Sports | — | `/api/sports` | 30 | 🟡 In-route | `SportsAthlete`, `SportsTeam`, `SportsEvent` +4 | ❌ | ✅ | ❌ | 🟡 PARTIAL | — |
| Library | 4 | `/api/library` | 7 | 🟡 In-route | `LibraryBook` | ❌ | ⚠️ over-broad | ❌ | 🟡 PARTIAL | Cannot model multiple copies |
| Admin | 5 | `/api/admin` | 24 | 🟡 In-route | `SystemAuditLog`(read-only), `ModuleConfig`, `AcademicYear`, `BackupRecord` | ❌ | ✅ | ❌ | 🔴 **BROKEN** | **Audit + backup are façades** |
| Uploads | — | `/api/uploads` | 1 | ✅ | none | ❌ | 🔴 **any user** | ❌ | 🔴 **BROKEN** | No auth on retrieval |

## Verified systemic measurements

Mechanically derived across all 18 route files — these numbers are firm.

| Property | Count | Denominator | % |
|---|---:|---:|---:|
| Endpoints | 478 | — | — |
| Route files | 18 | — | — |
| Backend LOC (routes) | 12,108 | — | — |
| **Endpoints with schema validation** | **0** | 478 | **0%** |
| **`$transaction` uses** | **4** | 478 | **0.8%** |
| Endpoints with pagination | 42 | 478 | 8.8% |
| **`SystemAuditLog.create` calls** | **0** | 478 | **0%** |
| `console.log` in routes | 0 | — | ✅ |
| SQL injection vectors | 0 | 6 raw-SQL sites | ✅ |
| Path traversal vectors | 0 | 1 upload site | ✅ |
| Frontend components importing API layer | 121 | 133 | **91%** |
| Components importing mock data | **0** | 133 | **0%** |

## Chain verification — the brief's standard

> *UI → validation → authorization → API → business logic → database → auditability → error handling → reporting → tests*

Applied to the whole system:

| Link | Status | Evidence |
|---|---|---|
| UI | ✅ Present | 133 components, 91% API-wired |
| Validation | 🟡 **Frontend only** | `zod` in frontend deps; **absent from backend** |
| Authorization | ✅ **Server-side** | `server.ts:47-64` — genuine strength |
| API | ✅ Present | 478 endpoints |
| Business logic | 🟡 Present but unlayered | In route files; `hod.ts` 1,882 lines |
| Database | ✅ Present | 95 models — **but no migrations, no FKs on ~40 fields** |
| **Auditability** | ❌ **ABSENT** | `SystemAuditLog` never written |
| Error handling | 🟡 Uniform but wrong | All failures → 500 + raw message |
| Reporting | 🟡 Ad-hoc | Per-endpoint aggregation, no single source of truth |
| **Tests** | ❌ **ABSENT** | One trivial assertion |

**Two links are entirely broken — auditability and tests — and validation exists only where it provides no security value.** By the brief's own standard, no workflow in this system is fully "implemented".

## Orphan analysis

**Backend without frontend:** `/api/sports` (30 endpoints), `/api/security` (35), `/api/vc` (33) have substantial APIs; corresponding UI folders were not confirmed in the component sweep. **NOT VERIFIED** — may exist under different names.

**Frontend without backend:** none confirmed. 121 of 133 components import the API layer; the 12 that don't are presentational or thin wrappers (`03_FRONTEND_AUDIT.md`).

**DB models without API:** `Facility`, `Team`, `QualityMetric`, `IncidentReport` are removal candidates pending usage tracing (`17_MASTER_GAP_REGISTER.md`). `FacultyLessonPlan` is the inverse — an API-backed table absent from the schema.

**Dead code:** `src/data/studentMockData.ts` and `src/lib/dataStore.ts` — zero importers.

## Outstanding work

To complete this matrix as specified:

1. Per-endpoint pass over the ~14 unread route files → METHOD | ROUTE | AUTH | VALIDATION | CONTROLLER | SERVICE | DB | RESPONSE | CONSUMER.
2. Map each endpoint to its consuming component(s) (static import + call-site analysis).
3. Identify unused endpoints (defined but never called by any component).
4. Runtime verification against a migrated, seeded database with network tracing.

Items 1–3 are static and mechanical. Item 4 requires completing the local environment setup — which was in progress when the audit was requested and is the prerequisite for converting every 🟡 above into a verified ✅ or 🔴.
