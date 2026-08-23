# 11 — NIRF Readiness

## Source validation

| Item | Source | Status |
|---|---|---|
| Five parameters: Teaching Learning & Resources; Research and Professional Practice; Graduation Outcome; Outreach & Inclusivity; Perception | [nirfindia.org](https://www.nirfindia.org/Home) | ✅ **Verified from the official NIRF site** |
| Most recent completed cycle featured on the official site | nirfindia.org | ✅ **2025 rankings** are the current cycle shown |
| Parameter **weightages** (commonly cited as TLR 30 / RP 30 / GO 20 / OI 10 / PR 10) | Secondary sources only | ⚠️ **NOT VERIFIED** — the official homepage did not state weightages; the figures circulate widely on consultancy sites but were not confirmed against the official methodology document |
| Sub-metric definitions per discipline | Not retrieved | ❌ **NOT VERIFIED** |
| Category list and current Data Capture System (DCS) submission window | Not retrieved | ❌ **NOT VERIFIED** |

**Before building any NIRF feature, download the current official methodology and DCS document for the institution's discipline from nirfindia.org.** The parameter *names* below are official; the weightages and every sub-metric are not.

---

## Assessment against the five official parameters

### TLR — Teaching, Learning & Resources

| Typical input | Data in system | Status |
|---|---|---|
| Total students / sanctioned intake | `StudentProfile` rows; `Vacancy.sanctioned` (staff only) | 🟡 No programme-wise sanctioned intake model |
| Faculty–student ratio | `FacultyProfile` + `StudentProfile` counts | 🟡 Computable, but see below |
| **Faculty with PhD** | `FacultyProfile.qualification` — **free-text String** | 🔴 **FABRICATED** |
| **Faculty experience** | `FacultyProfile.experience Int` | 🔴 **FABRICATED** |
| Financial resources & utilisation | `DepartmentBudget`, `BudgetAllocation` | 🟡 Present, not NIRF-shaped |
| Library & infrastructure | `LibraryBook`, `SportsFacility`, `LabInventoryItem` | 🟡 Counts only |

**Critical:** `backend/src/routes/faculty.ts:38-52` auto-creates faculty profiles with `qualification: 'Ph.D in CSE'` and `experience: 5`, invoked from 38 endpoints. **The two headline TLR faculty inputs are invented by the application.** Submitting them would constitute misreporting to a national ranking body.

Additionally `qualification` is unstructured text — "Ph.D", "PhD", "Ph.D." and "Doctorate" are unaggregatable. A structured qualification model is required.

### RP — Research and Professional Practice

| Typical input | Data in system | Status |
|---|---|---|
| Publications | `Publication` — `title`, `journal`, `year`, `status` | 🟡 Minimal: **no DOI, no ISSN, no indexing (Scopus/WoS), no co-authors, no institutional affiliation** |
| **Citations** | — | 🔴 **No model** |
| **Patents** | — | 🔴 **No model** |
| Funded projects | `ResearchProject` — `fundingAgency`, `amount`, `amountSpent` | 🟢 Closest to adequate |
| **Consultancy** | — | 🔴 **No model** |
| **PhD scholars / supervisors** | — | 🔴 **No model** |
| **Conferences / collaborations** | — | 🔴 **No model** |

RP is a top-weighted parameter and is the **weakest** area of the data model. Citations, patents, consultancy earnings and PhD output — all standard RP inputs — have no representation whatsoever.

### GO — Graduation Outcome

| Typical input | Data in system | Status |
|---|---|---|
| Placement | `StudentApplication`, `JobOffer.package` | 🟢 Reasonable |
| Higher studies | `ProgressionSurvey`, `AlumniProfile` | 🟡 Survey-based, unstructured `Json` |
| **Graduation / pass percentage** | `DegreeRecord`, `ExamProgress` | 🔴 Not derivable — **no semester results or SGPA model** |
| **Mean salary** | `JobOffer.package Float` | 🟡 Computable, no verification |
| University exam performance | — | 🔴 **CGPA is fabricated, never computed** |

`StudentProfile.cgpa` is a stored `Float` written as a literal `8.5`. There is **no grade-point mapping, no SGPA model, no semester result entity**, and no calculation deriving CGPA from `Enrollment.grade` + `Course.credits`. GO cannot be substantiated.

### OI — Outreach and Inclusivity

| Typical input | Data in system | Status |
|---|---|---|
| **Region diversity (other states/countries)** | — | 🔴 **No model** — `StudentProfile` has no domicile/state/nationality |
| **Women representation** | — | 🔴 **No gender field on `User` or `StudentProfile`** |
| **Economically/socially disadvantaged** | — | 🔴 **No category, income, or reservation fields** |
| **Facilities for physically challenged** | — | 🔴 **No model** |

**OI is entirely unsupported.** The student data model captures no demographic dimension at all. This is the largest single structural gap for NIRF — and the same fields underpin UGC equity reporting and AISHE. Note that adding them requires a privacy/legal review (see `12_UGC_READINESS.md`).

### PR — Perception

Externally collected by NIRF from peers and employers. **Not an ERP responsibility.** ✅ Correctly out of scope.

## Architectural gap: no data mart

The brief's target flow:

```
Daily ERP activity → validated institutional data → NIRF data mart → calculations → verification → NIRF-ready report
```

Actual: `QualityMetric` with `category: 'nirf'` and `currentValue String` — a manually-typed value with no link to operational data. There is:

- no NIRF data mart or reporting layer,
- no calculation engine,
- no academic-year snapshotting (NIRF requires three preceding years; the schema keeps only current state with no history),
- no validation or verification workflow,
- no DCS-format export.

**The three-year requirement is structurally unmeetable.** With no history tables, no soft delete, and cascade deletes that destroy academic history, the system cannot reconstruct prior-year figures.

## Readiness score: 10 / 100

| Parameter | Score | Basis |
|---|---:|---|
| TLR | 20 | Counts derivable; **key faculty inputs fabricated and unstructured** |
| RP | 10 | Publications minimal; citations/patents/consultancy/PhD absent |
| GO | 15 | Placement usable; **graduation outcomes not derivable** |
| OI | **0** | No demographic data of any kind |
| PR | n/a | Externally collected |
| Data mart / calculation | 0 | Does not exist |
| Historical snapshots | 0 | No history; cascade deletes destroy it |
| Verification & export | 0 | Neither exists |

## Recommendations

1. **Stop fabricating faculty data** (`P0`) — this is misreporting risk, not a feature gap.
2. **Obtain the official NIRF methodology + DCS** for the discipline before designing anything.
3. **Add the demographic dimension** to `StudentProfile` — gender, domicile state, nationality, category — with legal review on collection and retention. Unlocks OI, UGC equity, and AISHE simultaneously.
4. **Build the results/credits engine** — grade points, SGPA, CGPA computed from `Enrollment` + `Course.credits`. Prerequisite for GO.
5. **Extend the research model** — DOI, indexing, citations, patents, consultancy, PhD scholars.
6. **Introduce academic-year snapshots** so prior-year figures are reconstructible.
7. **Then** build the data mart and calculation layer.

Sequence matters: steps 3–6 are operational data-model work that must precede any reporting layer.

## Sources

- [NIRF — Official site (parameters, current cycle)](https://www.nirfindia.org/Home)

*Weightages and sub-metrics were not obtainable from official sources in this environment and are recorded as NOT VERIFIED.*
