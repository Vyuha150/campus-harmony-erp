# 10 — Compliance Data Architecture Plan

## Blocking prerequisite — read first

**Do not begin implementation.** Two conditions must hold, and neither does today.

### 1. Official framework documents have not been obtained

| Source | Status |
|---|---|
| NAAC manual (institution's category) | ❌ Official PDFs were not machine-readable; **framework version, attribute count and AQAR status are unverified** |
| NIRF methodology + DCS | 🔶 Parameter *names* verified from nirfindia.org; **weightages and all sub-metrics unverified** |
| UGC regulation texts | 🔶 Titles and dates verified from ugc.gov.in; **no clause text retrieved** |
| AISHE DCF | ❌ Not retrieved |

Every secondary source found during research was an ERP-vendor or consultancy blog — exactly what must not be built against.

**Action: obtain these directly from the authorities before writing a line of compliance code.** Building to a vendor blog's description of the Binary/MBGL framework would produce a system that is confidently wrong.

### 2. The data underneath must be trustworthy first

Phase 0 removed the fabrication that would have poisoned every metric — fabricated faculty PhDs are a direct NIRF `TLR` input. Still outstanding:

| Blocker | Status |
|---|---|
| Fabricated source data | ✅ **RESOLVED** |
| Audit trail | ✅ **RESOLVED** — now writes |
| Evidence files publicly downloadable | ✅ **RESOLVED** — authenticated |
| History tables (multi-year reporting) | ❌ T-104 |
| CGPA computed rather than stored | ❌ T-403 |
| Demographics (NIRF OI, UGC equity, AISHE) | ❌ T-407 — **needs legal review** |
| Research depth (citations, patents, PhD) | ❌ Phase 14 |
| Read-only auditor role | ❌ T-304 |

> A compliance engine over untrustworthy data is **worse than none** — it lends institutional credibility to unreliable figures.

## Architecture: generated, never re-entered

The current model is: a user types "82%" into a form and the system stores the characters `82%`. `AccreditationData.value` and `QualityMetric.currentValue` are both `String`, connected to nothing.

Target:

```
Operational Module (attendance, results, placements, research)
        ↓
Authoritative Records  ← audited, versioned, transactional
        ↓
Reporting Layer        ← single source of truth (Phase 10)
        ↓
Metric Engine          ← formula + numerator + denominator
        ↓
Evidence Registry      ← documents linked to the records that justify them
        ↓
Verification → Approval Workflow
        ↓
Versioned Report (NAAC / NIRF / UGC / AISHE)
```

**Institutions must never enter the same information twice.**

## Metric model

Current coverage is **3 of 24 required fields**. Target schema, framework-versioned so a framework change is a *data* change, not a redeploy:

```prisma
model ComplianceFramework {
  id       String @id @default(uuid())
  code     String                    // NAAC | NIRF | UGC | AISHE
  name     String
  versions ComplianceFrameworkVersion[]
  @@unique([code])
}

model ComplianceFrameworkVersion {
  id            String   @id @default(uuid())
  frameworkId   String
  version       String                  // e.g. "BAF-2025"
  effectiveFrom DateTime
  effectiveTo   DateTime?
  sourceUrl     String                  // link to the OFFICIAL document
  sourceDate    DateTime                // its publication date
  metrics       ComplianceMetric[]
  @@unique([frameworkId, version])
}

model ComplianceMetric {
  id                 String  @id @default(uuid())
  frameworkVersionId String
  criterionId        String
  metricId           String
  definition         String
  applicableTo       Json    // institution types
  sourceModule       String  // WHICH module produces this
  sourceFields       Json    // WHICH fields
  formula            String  // how numerator/denominator are derived
  evidenceRequired   Boolean @default(true)
  @@unique([frameworkVersionId, metricId])
}

model ComplianceMetricValue {
  id             String   @id @default(uuid())
  metricId       String
  academicYear   String
  reportingStart DateTime
  reportingEnd   DateTime

  numerator        Float?
  denominator      Float?
  calculatedResult Float?
  computedAt       DateTime?

  manualOverride      Float?
  overrideJustification String?   // REQUIRED when overriding
  overriddenBy        String?

  ownerId    String
  verifierId String?
  verifiedAt DateTime?
  approverId String?
  approvedAt DateTime?
  status     String   @default("draft")

  provenance Json     // source record IDs behind the number

  @@unique([metricId, academicYear])
  @@index([status])
}
```

`sourceModule`, `sourceFields`, `formula` and `provenance` are what make a figure defensible. Without them a metric is an assertion, not evidence.

## Data provenance

The system must be able to answer: **"Where did this number come from?"**

```
NIRF metric "Faculty with PhD" = 0.62
  ↓ formula: count(FacultyProfile WHERE qualificationLevel = 'DOCTORATE') / count(FacultyProfile)
  ↓ numerator 31, denominator 50, computed 2026-08-19
  ↓ provenance: [facultyProfile IDs...]
  ↓ each traceable to an audited record with its own change history
```

This is why `qualification` must become a **structured** field. Free text makes "Ph.D", "PhD", "Ph.D." and "Doctorate" unaggregatable — and it is precisely the field the old code fabricated.

## Evidence registry

Extends `QualityDocument` with: link to the specific metric and reporting period, checksum, version history, upload provenance, and **access control** (now that files are authenticated — T-209 adds per-file authorization).

## Never claim compliance

Per audit rule 67, the system must never render "100% UGC compliant" or "NAAC certified". Permitted vocabulary only:

```
SUPPORTED · PARTIALLY SUPPORTED · NOT SUPPORTED
NOT APPLICABLE · REQUIRES POLICY/LEGAL REVIEW · VALIDATION PENDING
```

Each claim carries a citation to the specific clause and the date it was verified. This should be enforced in code — a metric cannot reach `approved` without `sourceUrl` and `sourceDate` populated.

## Implementation sequence

| Order | Task | Gate |
|---:|---|---|
| 0 | **Obtain official documents** | Blocks everything below |
| 1 | Structured faculty qualification + research depth | Phase 12/14 |
| 2 | Demographics — after legal review | T-407 |
| 3 | History + academic-year snapshots | T-104, T-408 |
| 4 | Reporting layer | Phase 10 |
| 5 | Framework/version/metric schema | Phase 11 |
| 6 | Metric engine + provenance capture | Phase 11 |
| 7 | Evidence registry + approval workflow | Phase 11 |
| 8 | Read-only auditor role | T-304 |
| 9 | Export (NAAC SSR, NIRF DCS, AISHE DCF) | Phase 11 |

Steps 1–3 are operational data-model work and must precede any reporting layer.

## Honest current position

| Framework | Readiness | Principal gap |
|---|---:|---|
| NAAC | 12/100 | No metric engine, provenance, or verification workflow |
| NIRF | 10/100 | No data mart; `OI` has **no demographic data at all** |
| UGC | 8/100 | No credit architecture (ABC/NCrF/multiple entry-exit) |
| AISHE | 0/100 | No model of any kind |

Phase 0 improved the *foundation* these depend on — data is no longer fabricated, actions are audited, evidence is no longer public — but none of the compliance capability itself has been built, and none should be until the prerequisites above are met.
