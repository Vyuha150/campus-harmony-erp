# 19 — Compliance Traceability Matrix

## Governing rule

Per the brief's source-validation requirement, **nothing in this matrix is marked compliant.** A requirement is only compliant when (a) the authoritative text has been read, and (b) the implementation has been verified against it. **Neither condition is satisfied for any row**, because the official framework documents could not be fully retrieved in this environment (see `10_NAAC_READINESS.md`, `11_NIRF_READINESS.md`, `12_UGC_READINESS.md`).

The "Requirement" column below therefore describes **commonly understood reporting needs**, not verified statutory clauses. Treat this matrix as a **gap-analysis scaffold to be completed once official documents are obtained**, not as a compliance assessment.

Status values: `NOT SUPPORTED` · `PARTIALLY SUPPORTED` · `NOT APPLICABLE` · `REQUIRES POLICY/LEGAL REVIEW` · `NOT VERIFIED`

---

## NAAC

Framework version: **NOT VERIFIED** — official manuals not machine-readable in this environment. Binary Accreditation Framework + MBGL reforms are confirmed to exist as published NAAC documents; attribute counts, level definitions and AQAR status are unverified.

| Authority | Framework ver. | Criterion / Metric | Requirement (unverified) | ERP Module | DB Source | Evidence | Calculation | Responsible Role | Status | Gap |
|---|---|---|---|---|---|---|---|---|---|---|
| NAAC | NOT VERIFIED | Curricular aspects | Curriculum design, revision, feedback | IQAC, Dean | `Course`, `CurriculumProposal`, `FeedbackForm` | ✗ | ✗ | `iqac_coordinator` | PARTIALLY SUPPORTED | No programme/scheme model; no metric engine |
| NAAC | NOT VERIFIED | Teaching-learning & evaluation | Faculty qualification, student-teacher ratio, evaluation reforms | Faculty, COE | `FacultyProfile`, `Enrollment`, `Attendance` | ✗ | ✗ | `iqac_coordinator` | **NOT SUPPORTED** | **Faculty qualification FABRICATED** (`faculty.ts:38-52`) |
| NAAC | NOT VERIFIED | Research, innovation, extension | Publications, projects, extension activities | Faculty | `Publication`, `ResearchProject` | ✗ | ✗ | `iqac_coordinator` | PARTIALLY SUPPORTED | No citations, patents, consultancy, PhD scholars |
| NAAC | NOT VERIFIED | Infrastructure & learning resources | Physical/academic facilities, library | Library, HOD | `LibraryBook`, `SportsFacility`, `LabInventoryItem` | ✗ | ✗ | `registrar` | PARTIALLY SUPPORTED | Counts only; no utilisation metrics |
| NAAC | NOT VERIFIED | Student support & progression | Support services, progression, placement | Placements, Grievances | `PlacementDrive`, `GrievanceCase`, `ProgressionSurvey` | 🟡 | ✗ | `placement_officer` | PARTIALLY SUPPORTED | Best-covered area; no calculation |
| NAAC | NOT VERIFIED | Governance, leadership, management | Strategy, faculty empowerment, financial management | VC, Dean | `Meeting`, `ApprovalItem`, `DepartmentBudget` | ✗ | ✗ | `vice_chancellor` | PARTIALLY SUPPORTED | Data only |
| NAAC | NOT VERIFIED | Institutional values & best practices | Best practices, distinctiveness | IQAC | `AQARRecord.bestPractices` (Json) | ✗ | ✗ | `iqac_coordinator` | **NOT SUPPORTED** | Free-text Json only |
| NAAC | NOT VERIFIED | AQAR submission | Annual quality assurance report | IQAC | `AQARRecord` | 🟡 | ✗ | `iqac_coordinator` | **NOT VERIFIED** | **Whether AQAR still required is unverified** |
| NAAC | NOT VERIFIED | Evidence integrity | Verifiable, traceable evidence | All | `QualityDocument` | 🔴 | ✗ | — | **NOT SUPPORTED** | **Evidence files publicly downloadable** (`server.ts:39`) |
| NAAC | NOT VERIFIED | Data provenance | Metrics traceable to source | — | — | ✗ | ✗ | — | **NOT SUPPORTED** | No provenance anywhere; no audit trail |

## NIRF

Parameter names **verified** from [nirfindia.org](https://www.nirfindia.org/Home). Weightages and sub-metrics **NOT VERIFIED**.

| Authority | Framework ver. | Parameter | Requirement (unverified detail) | ERP Module | DB Source | Calculation | Status | Gap |
|---|---|---|---|---|---|---|---|---|
| NIRF | 2025 cycle (current per official site) | **TLR** — Teaching, Learning & Resources | Student strength, faculty-student ratio, faculty qualification & experience, financial resources | Faculty, Finance | `FacultyProfile`, `StudentProfile`, `BudgetAllocation` | ✗ | **NOT SUPPORTED** | **Faculty qualification & experience FABRICATED**; `qualification` unstructured free text |
| NIRF | 2025 | **RP** — Research & Professional Practice | Publications, citations, patents, funded projects | Faculty | `Publication`, `ResearchProject` | ✗ | **NOT SUPPORTED** | **No citations, patents, consultancy, PhD models**; no DOI/indexing |
| NIRF | 2025 | **GO** — Graduation Outcome | Placement, higher studies, graduation rate, university exams | Placements, COE | `JobOffer`, `StudentApplication`, `DegreeRecord` | ✗ | **NOT SUPPORTED** | **No semester results, no SGPA/CGPA computation** |
| NIRF | 2025 | **OI** — Outreach & Inclusivity | Region/gender diversity, disadvantaged students, facilities for PWD | — | **none** | ✗ | **NOT SUPPORTED** | **No demographic fields exist at all** |
| NIRF | 2025 | **PR** — Perception | Peer/employer perception | — | — | — | **NOT APPLICABLE** | Externally collected by NIRF ✅ |
| NIRF | 2025 | 3-year historical data | Prior-year figures | — | — | ✗ | **NOT SUPPORTED** | **No history; cascade deletes destroy it** |
| NIRF | 2025 | DCS submission | Data Capture System format | — | — | ✗ | **NOT SUPPORTED** | No export of any kind |

## UGC

Regulation titles and dates **verified** from [ugc.gov.in/regulations](https://www.ugc.gov.in/regulations). **Clause texts NOT retrieved** — all requirements below are unverified.

| Authority | Regulation (verified title/date) | Requirement (unverified) | ERP Module | DB Source | Status | Gap |
|---|---|---|---|---|---|---|
| UGC | ABC Regulations (First Amendment) 2021 | Credit deposit, accumulation, transfer, redemption | — | **none** | **NOT SUPPORTED** | No ABC/APAAR ID; no credit ledger |
| UGC | *Minimum Standards of Instruction for UG & PG Degree Regulations, 2025* (02/04/2025) | Programme structure, instruction standards | — | **none** | **NOT SUPPORTED** | **No `Programme` model exists** |
| UGC | *Redressal of Grievances of Students Regulations, 2023* | Grievance mechanism, committee, timelines, appeal | Grievances | `GrievanceCase` | **PARTIALLY SUPPORTED** | No committee/Ombudsperson, no appeal, **anonymity broken** |
| UGC | *Promotion of Equity in HEIs Regulations, 2026* (13/01/2026) | Equity monitoring and reporting | — | **none** | **NOT SUPPORTED** · ⚖️ **REQUIRES LEGAL REVIEW** | **No demographic fields**; collection needs DPDP review |
| UGC | *Recognition & Equivalence of Foreign Qualifications 2025* (04/04/2025) | Foreign qualification equivalence | Registrar | `VerificationRequest` | **NOT SUPPORTED** | No equivalence workflow |
| UGC | NCrF (status unverified) | Credit levels, learning hours, mobility | — | **none** | **NOT SUPPORTED** | No credit framework |
| UGC | Multiple entry/exit (NEP) | Exit awards, re-entry, credit banking | — | **none** | **NOT SUPPORTED** | Unrepresentable |
| UGC | Anti-ragging (status unverified) | Prevention, committee, incident handling, helpline | Grievances | `AntiRaggingAffidavit` | **PARTIALLY SUPPORTED** | Affidavits only; no incident workflow |
| UGC | Digital academic records | Transcripts, DigiLocker, verification | Registrar | `DegreeRecord` | **NOT SUPPORTED** | **CGPA fabricated; no transcript generation** |
| UGC | Institutional disclosure | Mandatory public disclosure | — | **none** | **NOT SUPPORTED** | No module |
| UGC | Student protection / refunds | Fee refund policy, admission cancellation | Finance | `FeeRecord` | **NOT SUPPORTED** | No refund or cancellation model |

## AISHE

| Authority | Requirement | ERP Module | DB Source | Status | Gap |
|---|---|---|---|---|---|
| AISHE | Annual institutional data return (DCF) | — | **none** | **NOT SUPPORTED** | No AISHE model, mapping, or export; blocked by demographic gap |

---

## Cross-cutting compliance blockers

These defeat **every** framework simultaneously and must be fixed before any compliance feature is built:

| # | Blocker | Evidence | Effect |
|---|---|---|---|
| 1 | **Source data is fabricated** | `students.ts:122-143`, `faculty.ts:38-52`, `faculty.ts:560-578` | Every downstream metric would be built on invented values — including faculty PhD counts submitted to NIRF |
| 2 | **No audit trail** | `SystemAuditLog` written 0 times | No metric can demonstrate who produced it, when, or on what authority |
| 3 | **No data provenance** | No source-module/source-field linkage on any metric | Evidence cannot be traced back to the operational rows substantiating it |
| 4 | **No calculation engine** | `AccreditationData.value` and `QualityMetric.currentValue` are `String` | Every figure is manually typed; nothing is computed from operational data |
| 5 | **No verification/approval workflow** | No owner/verifier/approver on any metric | Figures cannot be signed off |
| 6 | **No framework versioning** | `framework` is a free-text `String` | Framework changes require code changes, not configuration |
| 7 | **Evidence publicly exposed** | `server.ts:39` — static mount before auth | Confidential accreditation evidence downloadable by anyone |
| 8 | **No historical snapshots** | No history tables; cascade deletes | Multi-year reporting structurally impossible |
| 9 | **No read-only auditor role** | 17 roles, none read-only | External assessors cannot be given safe inspection access |
| 10 | **No demographic data** | No gender/category/domicile fields | Blocks NIRF OI, UGC equity, and AISHE together |

## Required metric schema — current coverage: 3 of 24 fields

| Field | Present? | Where |
|---|---|---|
| framework | 🟡 Free-text string | `ComplianceReport.framework` |
| version | ❌ | — |
| criterion ID | 🟡 Free-text | `AccreditationData.criterion` |
| metric ID | ❌ | — |
| definition | ❌ | — |
| applicable institution type | ❌ | — |
| academic year | ✅ | `AQARRecord.academicYear` |
| reporting period | ❌ | — |
| source module | ❌ | — |
| source fields | ❌ | — |
| calculation formula | ❌ | — |
| numerator | ❌ | — |
| denominator | ❌ | — |
| calculated result | ❌ | Only manually-typed values |
| manual overrides | ❌ | — |
| override justification | ❌ | — |
| evidence | 🟡 | `QualityDocument` |
| evidence URL / document | 🟡 **insecure** | `QualityDocument.filePath` |
| owner | 🟡 | `uploadedBy` |
| verifier | 🟡 | `reviewedBy` |
| approver | ❌ | — |
| status | ✅ | Multiple models |
| timestamps | 🟡 Partial | — |
| version history | ❌ | Manual string only |

## Prerequisite actions before any compliance work

1. **Obtain official documents** — current NAAC manual for the institution's category; NIRF methodology + DCS for the discipline; UGC regulation texts. Resolve every `NOT VERIFIED` above. **This is a blocking prerequisite, not a parallel task.**
2. **Fix the cross-cutting blockers** — especially #1 (fabrication), #2 (audit), #7 (evidence exposure). A compliance engine over fabricated, unaudited, publicly-exposed data is *worse than none*: it lends institutional credibility to unreliable figures.
3. **Then** design the compliance engine per `18_IMPLEMENTATION_ROADMAP.md` Phase 8 — framework definitions as versioned configuration data, never hardcoded.
4. **Never label a feature "NAAC/NIRF/UGC compliant"** without citing the specific clause it satisfies and the evidence of verification.

## Sources

- [NIRF — Official site](https://www.nirfindia.org/Home) — parameters verified
- [UGC — Regulations index](https://www.ugc.gov.in/regulations) — titles and dates verified
- [NAAC — Implementation of Binary Accreditation (Item 15, Annexure 10)](http://naac.gov.in/images/docs/item_annexure/Item_15_Annexure_10.pdf) — exists; contents not extracted
- [NAAC — Press Release, 10 February 2025](http://naac.gov.in/images/docs/announcement/NAAC_Press_Release_10022025.pdf) — exists; contents not extracted
- [PIB — Reforms in Accreditation](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2041287&reg=3&lang=2) — HTTP 403 on retrieval

**No vendor blog, consultancy site, or ERP marketing page was used as an authoritative source anywhere in this matrix.**
