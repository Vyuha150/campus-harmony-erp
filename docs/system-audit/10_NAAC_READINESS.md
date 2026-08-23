# 10 — NAAC Readiness

## Source validation notice — read first

The audit brief requires official sources only, and requires that nothing be marked compliant without verifying the underlying requirement. That standard is applied strictly here, including to my own research limits.

**What I could verify from official sources:**

| Item | Source | Authority | Status |
|---|---|---|---|
| NAAC reforms proceed in two phases: Binary Accreditation Framework (BAF) then Maturity Based Graded Levels (MBGL) | `naac.gov.in/images/docs/item_annexure/Item_15_Annexure_10.pdf` — "Implementation of Binary Accreditation" | NAAC | Document exists and is published on the official NAAC domain |
| Reforms driven by the Dr. K. Radhakrishnan Committee | Same + `pib.gov.in` "Reforms in Accreditation" (PRID 2041287) | NAAC / PIB | Titles verified |
| NAAC press release dated 10 Feb 2025 | `naac.gov.in/images/docs/announcement/NAAC_Press_Release_10022025.pdf` | NAAC | Document exists; **contents could not be extracted** |
| RAF/RAS website notification, Nov 2024 | `naac.gov.in/images/docs/notification/RAS_RAF_website_notification-Nov_2024.pdf` | NAAC | Document exists; contents not extracted |

**`BLOCKED / NOT VERIFIED` — significant:**

- The official NAAC PDFs **could not be parsed** in this environment (`WebFetch` returned raw binary; no PDF text extraction available). Document *existence* and *titles* are verified; **contents are not**.
- `naac.gov.in` root returned only a redirect stub; `assessmentonline.naac.gov.in` **refused the connection** (`ECONNREFUSED`).
- Secondary sources (edhitch, raysolute, kramah, bhavyagyan) consistently describe a **10-attribute binary model with 5 MBGL levels effective 10 Feb 2025**, and state that CGPA A++–D grading no longer applies to new applications. **These are ERP-vendor and consultancy blogs — precisely the sources the brief excludes.** I record what they claim but **do not treat the attribute count, level definitions, or AQAR status as verified.**
- Whether **AQAR remains required**, and in what form, is **NOT VERIFIED**.
- The mapping to the seven legacy criteria below is retained because the brief asks for it "where applicable", but under the binary framework its applicability is **itself unverified**.

**Action required before any NAAC feature is built:** obtain the current manual directly from NAAC for the institution's specific category. Do not build to the secondary-source description, and do not build to the seven-criteria model without confirming it still applies.

---

## The architectural finding (independent of framework version)

**This finding does not depend on which NAAC framework is current, so it stands regardless of the research gap above.**

Campus Harmony has **NAAC-shaped storage and no NAAC capability**. The system can hold accreditation records; it cannot produce accreditation evidence from operational data.

### What exists

| Model | Purpose | Nature |
|---|---|---|
| `AQARRecord` | `academicYear` (unique), `institutionDetails`, `criteria`, `keyIndicators`, `bestPractices`, `distinctiveFeatures`, `status`, `generatedBy` | All content in untyped `Json` |
| `QualityDocument` | Evidence with `criteriaNumber`, `documentType`, `version`, review workflow fields | Closest to a real evidence registry |
| `AccreditationData` | `criterion`, `metric`, `value`, `year`, `updatedBy`, `departmentId` | `value` is `String` — manually entered |
| `AccreditationChecklist` | `framework`, `criterion`, `responsibleOffice`, `deadline` | Task tracker |
| `ComplianceReport` | `framework`, `score`, `maxScore`, `criteria Json` | `framework` is free text |
| `QualityMetric` | `category` ('naac'/'nirf'), `metric`, `currentValue`, `target` | `currentValue` is `String` |
| `IQACActionItem`, `IQACMeeting`, `FeedbackForm/Response` | IQAC operations | Functional records |

Backend: `/api/iqac` — 17 endpoints. Frontend: `IQACCriteria`, `IQACDocuments`, `IQACReports`, `IQACActions`, `IQACFeedback`, plus `HODAccreditation`, `DeanAccreditation`, `RegistrarAccreditation`.

### The gap: every metric is a manually-typed string

`AccreditationData.value` is `String`. `QualityMetric.currentValue` is `String`. `ComplianceReport.score` is a `Float` with no derivation.

**There is no calculation anywhere in the codebase that derives an accreditation metric from operational data.** A user types "82%" into a form and the system stores the characters `82%`. Nothing connects that figure to the `Enrollment`, `Attendance`, `Publication`, `StudentApplication` or `FeeRecord` rows that would substantiate it.

Against the brief's required metric definition, the system has **3 of 24 fields**:

| Required field | Present? |
|---|---|
| framework | Partial — free-text string, not versioned |
| version, criterion ID, metric ID, definition | ❌ |
| applicable institution type | ❌ |
| academic year | ✅ (`AQARRecord.academicYear`, `AccreditationData.year`) |
| reporting period | ❌ |
| **source module, source fields** | ❌ — **no provenance of any kind** |
| **calculation formula, numerator, denominator** | ❌ |
| calculated result | ❌ — only a manually-typed value |
| manual override + justification | ❌ |
| evidence, evidence URL | Partial — `QualityDocument.filePath` |
| owner, verifier, approver | Partial — `QualityDocument` has `uploadedBy`/`reviewedBy`; no approver |
| status | ✅ |
| timestamps | Partial |
| version history | ❌ — `QualityDocument.version` is a manually-typed string |

### Required chain vs actual

```
Requirement → ERP Data Source → Responsible Module → Evidence → Calculation → Verification → Approval → Submission
     ✗              ✗                   ~                ~            ✗             ~            ✗          ✗
```

Only "Responsible Module" (`AccreditationChecklist.responsibleOffice`) and partial "Evidence" (`QualityDocument`) exist. **The links that make evidence defensible — data source, calculation, approval — are all absent.**

## Three compounding integrity problems

These are what make the NAAC position worse than "incomplete":

1. **Submitted figures would be fabricated.** `getOrCreateFacultyProfile` (`faculty.ts:38-52`) invents `qualification: 'Ph.D in CSE'` and `experience: 5` for any faculty user without a profile, across 38 endpoints. Faculty qualification is core teaching-learning evidence. `getOrCreateStudentProfile` invents `cgpa: 8.5`. **The operational data an evidence engine would draw on is itself partly manufactured.**

2. **Evidence documents are publicly downloadable.** `QualityDocument.filePath` points into `/uploads`, served by `express.static` with **no authentication** (`server.ts:39`). Accreditation evidence, including anything marked confidential, is exposed to anyone with the URL.

3. **No audit trail.** `SystemAuditLog` is never written. Who changed a metric, when, from what value, and on whose authority is unrecorded. Accreditation evidence that cannot demonstrate its own provenance is not defensible under scrutiny.

## Legacy seven-criteria coverage — applicability UNVERIFIED

Retained per the brief; **do not treat this table as a compliance plan** until the current framework is confirmed.

| Criterion | Operational data present | Metric engine | Status |
|---|---|---|---|
| 1. Curricular Aspects | `Course`, `CurriculumProposal`, `FeedbackForm` | ✗ | 🟡 Data only |
| 2. Teaching-Learning & Evaluation | `Enrollment`, `Attendance`, `Examination`, `Submission` | ✗ | 🟡 Data only — **faculty qualification fabricated** |
| 3. Research, Innovation & Extension | `Publication`, `ResearchProject` | ✗ | 🟡 Thin — no citations, patents, consultancy, PhD scholars |
| 4. Infrastructure & Learning Resources | `LibraryBook`, `Hostel`, `SportsFacility`, `LabInventoryItem` | ✗ | 🟡 Data only |
| 5. Student Support & Progression | `GrievanceCase`, `PlacementDrive`, `ProgressionSurvey`, `AntiRaggingAffidavit` | ✗ | 🟡 Reasonable coverage |
| 6. Governance, Leadership & Management | `Meeting`, `ApprovalItem`, `PolicyScenario`, `DepartmentBudget` | ✗ | 🟡 Data only |
| 7. Institutional Values & Best Practices | `AQARRecord.bestPractices` (Json) | ✗ | 🔴 Free-text only |

## Readiness score: 12 / 100

| Dimension | Score | Basis |
|---|---:|---|
| Evidence storage | 35 | `QualityDocument` is a reasonable starting point |
| Operational data breadth | 40 | Most criteria have *some* underlying data |
| Metric definition | 0 | No criterion/metric IDs, no definitions |
| Calculation engine | 0 | No formula, numerator, denominator anywhere |
| Data provenance | 0 | No link from metric to source row |
| Verification workflow | 10 | `QualityDocument` review fields only |
| Approval workflow | 0 | No approver on any metric |
| Version control | 5 | Manual string field |
| Framework configurability | 0 | Hardcoded free-text strings |
| Evidence security | 0 | Publicly downloadable |
| Auditability | 0 | Audit log never written |

## Recommendations

**Do not build NAAC features yet.** In order:

1. **Obtain the current official NAAC manual** for the institution's category. Resolve every `NOT VERIFIED` item above. This is a prerequisite, not a parallel task.
2. **Fix the data first** — remove fabrication (`P0`), enable audit logging (`P0`), secure evidence files (`P0`). An evidence engine over fabricated, unaudited, publicly-exposed data is worse than none: it lends false credibility.
3. **Then** design the compliance engine as `13_` describes — framework-versioned and configurable, never hardcoded, so a framework change is a data change rather than a redeploy.
4. Add a **read-only auditor role** (absent today) for external assessors.

## Sources

- [NAAC — Implementation of Binary Accreditation (Item 15, Annexure 10)](http://naac.gov.in/images/docs/item_annexure/Item_15_Annexure_10.pdf)
- [NAAC — Press Release, 10 February 2025](http://naac.gov.in/images/docs/announcement/NAAC_Press_Release_10022025.pdf)
- [NAAC — RAS/RAF website notification, November 2024](http://naac.gov.in/images/docs/notification/RAS_RAF_website_notification-Nov_2024.pdf)
- [PIB — Reforms in Accreditation](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2041287&reg=3&lang=2)
- [NAAC — Home](http://www.naac.gov.in/index.php/en/)

*PDF contents were not machine-readable in this environment; only titles, dates and hosting domain are verified.*
