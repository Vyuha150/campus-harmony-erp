# 19 — Approval Catalogue (Phase 2.1)

**Produced:** 2026-08-23, by reading the routes and exercising them against a
running system. The plan says this is a task, not an assumption — so nothing here
is inferred from endpoint names.

---

## Headline: the approval mechanism was cross-tenant

`ApprovalItem` carried **no `institutionId`** and was absent from
`TENANT_OWNED_MODELS`. The approval queue was therefore **shared across every
institution in the deployment**.

Demonstrated live, before the fix:

```
Default Institution's HOD → GET /api/hod/approvals
  items visible: 2
   - RIVAL UNIVERSITY CONFIDENTIAL | requestedBy: rival-user

Default Institution's HOD → PUT /api/hod/approvals/rival-probe {"status":"approved"}
  {"success":true, ... "title":"RIVAL UNIVERSITY CONFIDENTIAL" ...}
```

This is worse than the tenant leaks closed in 0010 and 0012. Those exposed
**data**; this exposed **authority** — a decision recorded against another
university's budget, made by someone with no standing there, with nothing in the
record showing a boundary had been crossed.

### Three defects in one mechanism

| # | Defect | Consequence |
|---|---|---|
| 1 | No `institutionId`, not tenant-scoped | Every institution shared one approval queue |
| 2 | `data: { status }` written straight from the request body | Any string accepted; states could be skipped entirely |
| 3 | No `decidedBy` / `decidedAt` | The model recorded who *requested*, never who *approved*. An approval with no approver is an assertion, not an approval |

### Fixed — migrations 0022 and 0023

- `institutionId` (backfilled from each requester's own institution), FK to
  Institution, `ApprovalItem` added to `TENANT_OWNED_MODELS`
- `decidedBy` / `decidedAt` / `decisionNote`
- `status` constrained to `pending | approved | rejected | forwarded | published`
- Every transition switched from `update({ where: { id } })` to `updateMany` with
  a `where` clause — **the extension can constrain a where clause but cannot
  filter a unique-key update**, which is precisely why update-by-id was exploitable

**Verified after the fix:**

| Check | Result |
|---|---|
| Rival item visible to another institution's HOD | **No** |
| Approving it | `404 No pending approval with that id` |
| The row afterwards | Still `pending`, `decidedBy` null |
| `{"status":"banana"}` | `400 status must be one of: approved, rejected, forwarded` |
| A legitimate approval | `approved`, `decidedBy: seed-user-hod`, note recorded |
| Deciding the same item twice | `404` — no silent re-decision |

---

## A mistake I made, and what it cost

Migration 0022 constrained `status` to the four values in the model's inline
comment. **The comment was incomplete** — `dean.ts` also writes `published`, so
the constraint broke the result-publication path.

This is exactly the failure mode Phase 1.3 documents: *the code is the authority
on a column's value set, not a comment and not current table contents.* For 0022
I took the comment at its word without auditing the writes. Corrected in 0023
after auditing what the code actually writes.

I then re-audited all 24 columns constrained in 0020 against actual code writes.
**None had the same gap** — the doc-comment method held there because those
comments were written alongside the services. It failed on the one model I did
not write.

Caught in development by a route that had not been exercised. In production it
would have surfaced as result publication silently failing.

---

## The actual approval landscape

**27 tables carry approval state** — far more than the 9 approval-shaped
endpoints, because most approvals are inline status flips rather than a routed
decision.

| Where the state lives | Examples |
|---|---|
| A shared queue | `ApprovalItem` (type, title, priority, status) |
| Per-entity columns | `CurriculumScheme.approvedBy/At/approvingBody`, `InstitutionalPolicy.approvedBy`, `CommitteeMeeting.minutesApproved`, `PromotionRequest`, `RetirementRequest`, `PurchaseOrder`, `JournalEntry`, `LeaveRequest`, `RecordChangeRequest`, `IDCardRequest`, `HostelAccessLog.latePassApproved`, `CurriculumProposal.bosApproved`, `QualityDocument.reviewedBy`, `GradeHistory.approvedBy` |

### Decision handlers found

| Route | Shape | State |
|---|---|---|
| `PUT /hod/approvals/:id` | request-supplied id | **Hardened** — validated, pending-filtered, decider recorded |
| `PUT /registrar/approvals/:id` | request-supplied id | **Hardened** |
| `PUT /finance/approvals/:id` | request-supplied id | **Hardened** |
| `PUT /vc/approvals/:id` | request-supplied id | **Hardened** |
| `coe.ts` result publication | id from a tenant-scoped `findFirst` | Raises a request; converted to `updateMany` |
| `dean.ts` result publication | id from a tenant-scoped `findFirst` | Writes `published`; decider recorded |

### What is NOT a workflow

Several handlers create an `ApprovalItem` with `status: 'approved'` **at creation
time** — `hod.ts` faculty role updates, counselling notes, result verification.
Nothing is routed to anyone; the record is born approved. These are **activity
log entries wearing approval clothing**, and treating them as approvals in a
future engine would be modelling a fiction.

---

## What this means for Phase 2.2 (the engine)

The catalogue changes the design brief in three ways:

1. **The requirement is heterogeneous.** Some approvals are a single flag on an
   entity (`bosApproved`), some are a queue item, some are multi-step
   (result publication: HOD verifies → CoE requests → Dean publishes). A single
   generic engine would need to express all three or leave half the system out.

2. **Most "approvals" are not decisions.** Before building routing, the
   self-approving records should be reclassified as audit entries — otherwise the
   engine inherits rows that were never pending.

3. **The security fix could not wait for the engine.** The cross-tenant breach
   was P0 and is closed now, ahead of any workflow work. Phase 2.2 can proceed on
   a sound base rather than building on top of a live vulnerability.

### Recommended for 2.2
Model a workflow **definition → step → instance → transition**, with the
transition log as the primary record rather than a status column. Migrate the
four hardened `PUT /approvals/:id` handlers onto it first — they are already
uniform — and leave the per-entity flags until their modules are migrated in
Phase 3.

---

## Guards added

`src/__tests__/approvals.test.ts` — `ApprovalItem` must stay tenant-owned; the
model must keep `decidedBy`/`decidedAt`; **no route may decide via update-by-id**
(with a negative control); body-supplied statuses must be validated; terminal
decisions must record a decider.

One property is deliberately **not** asserted: "a decision on a request-supplied
id must filter on the pending state". It is real and implemented, but it is
per-handler while these checks are per-file — `dean.ts` reads `req.params.id` in
one handler and calls `updateMany` in an unrelated one, so a file-level regex
either passes it wrongly or fails it wrongly. Both were tried. It is covered by
the update-by-id ban plus the live verification above.

A test that cannot express its property honestly is worse than a documented gap:
it passes for the wrong reason, and nobody revisits it.
