# 12 — UGC / NEP / Credit Architecture Readiness

## Source validation

Retrieved from the official UGC regulations index at [ugc.gov.in/regulations](https://www.ugc.gov.in/regulations):

| Regulation | Published | Status |
|---|---|---|
| Promotion of Equity in Higher Education Institutions Regulations, **2026** | 13/01/2026 | ✅ Verified as listed |
| Lower Division Clerk and Multi Tasking Staff Recruitment Rules 2025 | 19/12/2025 | ✅ Verified (not ERP-relevant) |
| Recognition and Grant of Equivalence to Qualifications obtained from Foreign Educational Institutions Regulations 2025 | 04/04/2025 | ✅ Verified as listed |
| **Minimum Standards of Instruction for Undergraduate and Postgraduate Degree Regulations, 2025** | 02/04/2025 | ✅ Verified as listed |
| UGC (Establishment and Operation of **Academic Bank of Credits**) (First Amendment) Regulations, 2021 | Jan 2022 | ✅ Verified as listed |
| UGC (**Redressal of Grievances of Students**) Regulations, **2023** | 2023 | ✅ Verified as listed |

**`BLOCKED / NOT VERIFIED`:** only regulation *titles and dates* were retrieved. **The clause-level requirements of every regulation above are unverified** — I did not retrieve or read the regulation texts. Anti-ragging regulations and the National Credit Framework (NCrF) were not located in the retrieved index and their current status is unverified.

**Nothing below is marked compliant.** Per the brief's rule, a feature is only "UGC compliant" once the underlying requirement *and* the implementation have both been verified. Neither condition is met for any item.

---

## Readiness by requirement

Classifications: `VERIFIED` · `PARTIALLY SUPPORTED` · `NOT SUPPORTED` · `NOT APPLICABLE` · `REQUIRES POLICY/LEGAL REVIEW`

### Academic Bank of Credits (ABC) — **NOT SUPPORTED**

No ABC integration exists. Specifically absent:

- No ABC student ID / APAAR ID field on `User` or `StudentProfile`
- No credit deposit, accumulation, transfer or redemption model
- No ABC API integration
- No credit-history ledger

`StudentProfile` has `totalCredits Int` and `earnedCredits Int` — **stored scalars, never calculated** from `Enrollment` + `Course.credits`. `Course.credits Int` exists, so the raw input is present, but nothing aggregates it.

### National Credit Framework (NCrF) — **NOT SUPPORTED**

No credit-level model, no learning-hours accounting, no vertical/lateral mobility mapping, no NSQF alignment. `Course.credits` is a bare integer with no framework semantics.

### Multiple entry / multiple exit — **NOT SUPPORTED**

No exit-award model (Certificate / Diploma / Degree exit points), no re-entry tracking, no credit-bank linkage on exit. `StudentProfile.program` is free text.

### Multidisciplinary programmes / electives — **NOT SUPPORTED**

No programme-structure model. Absent: programme → scheme → course-basket, elective pools, prerequisites, major/minor, honours, honours-with-research. `Course` links directly to `Department` with no intervening programme entity.

### UG/PG structure, honours, honours-with-research — **NOT SUPPORTED**

Four-year UG with honours variants is unrepresentable. `program: 'B.Tech'` is an unconstrained string.

### Digital academic records / transcripts — **NOT SUPPORTED**

`DegreeRecord` and `CertificateRequest` exist as request-tracking records. But:

- No semester result or SGPA model
- CGPA fabricated, never computed (`students.ts:138`)
- No transcript generation
- No digital signing, verification code, or DigiLocker integration
- `DegreeRecord.rollNo` is free text with **no foreign key** to `StudentProfile`

**The system cannot currently produce a defensible transcript.**

### Student grievance redressal — **PARTIALLY SUPPORTED**

The strongest area. `GrievanceCase` carries `grievanceNumber` (unique), category/subcategory, severity, status, `submissionDate`, `expectedResolutionDate`, `actualResolutionDate`, `isAnonymous`, `evidenceFiles`, `timeline`, `resolution`, `satisfactionRating`. Backed by 14 endpoints and a full UI (`GrievanceDashboard`, `GrievanceForm`, `GrievanceDetail`, `ComplianceTracking`), with role-aware status mapping in `lib/grievanceStatus.ts`.

Gaps: no Ombudsperson or Grievance Redressal Committee model; no statutory escalation ladder or timeline enforcement; **no appeal workflow**; `timeline` is untyped `Json`.

**Serious defect:** `isAnonymous` is recorded, but `evidenceFiles` are served from `/uploads` with **no authentication** (`server.ts:39`). **Anonymous complainants' evidence is publicly downloadable.** This actively undermines the anonymity the model promises.

Whether the implementation satisfies the 2023 Regulations is **NOT VERIFIED** — clause text not retrieved.

### Anti-ragging — **PARTIALLY SUPPORTED**

`AntiRaggingAffidavit` tracks `studentAffidavit`, `parentAffidavit`, `status`, `academicYear`. That is affidavit collection only.

Absent: incident reporting workflow, anti-ragging committee/squad, escalation, national helpline integration, action-taken records. `studentId` has no foreign key.

### Equity / inclusion — **NOT SUPPORTED · REQUIRES POLICY/LEGAL REVIEW**

Given the *Promotion of Equity in Higher Education Institutions Regulations, 2026* (published 13/01/2026 — recent and directly relevant), this is a notable gap:

**`StudentProfile` and `User` contain no demographic fields whatsoever** — no gender, category, domicile state, nationality, disability status, or income band. Equity monitoring, reporting, or intervention is impossible.

This is the same gap that blocks NIRF `OI` (`11_NIRF_READINESS.md`) and AISHE.

**REQUIRES POLICY/LEGAL REVIEW:** collecting caste, disability and income data engages India's data-protection regime. Purpose limitation, consent, retention and access control must be settled with qualified counsel **before** schema work. Note the system currently has no encryption at rest, no field-level access control, no audit trail, and publicly-served uploads — it is not currently a safe place for sensitive personal data.

### Student protection / institutional disclosure — **NOT SUPPORTED**

No public-disclosure/mandatory-disclosure module, no fee-refund policy engine (`FeeRecord` has no refund model), no admission-cancellation workflow, no prospectus/programme disclosure records.

### ODL / online programmes — **NOT APPLICABLE (currently)**

No ODL modelling. Marked NOT APPLICABLE only because there is no indication the institution offers ODL; if it does, this becomes NOT SUPPORTED.

### AISHE — **NOT SUPPORTED**

No AISHE data model, DCF mapping, or export. Blocked by the same demographic gap.

## Summary

| Requirement | Status |
|---|---|
| Academic Bank of Credits | ❌ NOT SUPPORTED |
| National Credit Framework | ❌ NOT SUPPORTED |
| Credit accumulation / transfer / redemption | ❌ NOT SUPPORTED |
| Multidisciplinary programmes | ❌ NOT SUPPORTED |
| Multiple entry / exit | ❌ NOT SUPPORTED |
| UG/PG structures, honours | ❌ NOT SUPPORTED |
| Academic mobility | ❌ NOT SUPPORTED |
| Digital academic records / transcripts | ❌ NOT SUPPORTED |
| Grievance redressal | 🟡 PARTIALLY SUPPORTED — anonymity compromised |
| Anti-ragging | 🟡 PARTIALLY SUPPORTED — affidavits only |
| Equity / inclusion | ❌ NOT SUPPORTED · ⚖️ REQUIRES LEGAL REVIEW |
| Institutional disclosure | ❌ NOT SUPPORTED |
| Student protection / refunds | ❌ NOT SUPPORTED |
| ODL | ⚪ NOT APPLICABLE (unconfirmed) |
| AISHE | ❌ NOT SUPPORTED |

**Readiness score: 8 / 100.** Credit architecture — the centre of NEP-aligned UGC compliance — is entirely absent, and the two partially-supported areas have integrity defects.

## Recommendations

1. **Retrieve and read the actual regulation texts** for the institution's type before any implementation. Titles are not requirements.
2. **Fix grievance evidence exposure immediately** (`P0`) — anonymity is currently defeated by unauthenticated file serving.
3. **Build the credit architecture** — programme → scheme → course-basket → credits, then SGPA/CGPA computation, then ABC/NCrF alignment. This is the largest single missing subsystem and gates transcripts, GO reporting, and mobility.
4. **Add demographics only after** legal review and after the security P0s are closed.
5. Never label a feature "UGC compliant" without a citation to the specific clause it satisfies and evidence of verification.

## Sources

- [UGC — Regulations index](https://www.ugc.gov.in/regulations)
- [UGC — Home](https://www.ugc.gov.in/)

*Only titles and publication dates were verified. No regulation text was retrieved; all clause-level requirements remain NOT VERIFIED.*
