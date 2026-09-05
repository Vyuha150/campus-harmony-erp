# Connection map and test matrix

Generated from the code, not written by hand, so it cannot drift from reality
without the generator saying so.

| Script | What it does |
|---|---|
| `build-connection-map.mjs` | For every endpoint, records the Prisma models it reads and writes, plus the roles its mount permits. Emits `connection-map.json`. |
| `run-authorization.mjs` | Calls every role-mounted endpoint as a role outside that mount and asserts 403. |
| `run-tenant-isolation.mjs` | Calls every parameterless GET as a Rival University user and asserts no Default Institution data appears. |

Both runners respect the application's own rate limiter — a 429 says nothing
about the property under test, so they wait and re-ask rather than recording a
verdict the test did not establish.

## Known limits of the static analysis

- **Dynamic delegates are invisible.** `registrarService.decideRequest()` picks
  its model at runtime (`basePrisma[spec.model]`), so models written only that
  way look write-less. `verificationRequest`, `promotionRequest`,
  `retirementRequest` and `recordChangeRequest` are false positives for that
  reason.
- **Only four API helpers are matched** (`fetchApi`/`postApi`/`putApi`/
  `deleteApi`). `POST /auth/login` and `POST /uploads` go through `api.post`
  and `uploadApi`, so they read as orphaned when they are not.

Both limits are one-directional: they over-report orphans, never under-report.

## Cross-role sweep: triage of the first run

The runner reports *candidates*, not defects. Sharing a Prisma model does not
mean the written row — or the written column — is in that reader's scope, so
every "invisible" pair needs a judgement. All 21 from the first run:

| Pairs | Verdict | Why |
|---|---|---|
| 6 | **Bug, fixed** | `POST /registrar/hr/promotions/forward` stored `status: 'forwarded'`. Every dashboard counts `'pending'` and every decision handler updates `where: { status: 'pending' }`, so the VC could see the recommendation and could not act on it. |
| 1 | **Bug, fixed** | `POST /hod/messages` stored `recipients: 'department'`, which no reader selects on. The broadcast reached nobody. |
| 1 | **Bug, fixed** | `POST /students/certificates/request` stored `status: 'processing'`, absent from this model's vocabulary, so the registrar's queue never showed the request arriving. |
| 7 | Correct | `PUT /faculty/profile` writes `qualification`/`specialization`/`experience`; the paired readers return `id`/`name`/`email`. Different columns of one model. |
| 4 | Correct | `POST /dean/mentoring/assignments` re-assigned the same faculty to the same student, because both ids come from the seed. An idempotent write shows no change. |
| 2 | Correct | Grievance reads scope to `complainantId: userId` with a matching `complainantType`, so each role sees only its own. |

A separate finding came out of the placements cluster rather than the pass/fail
column: `POST /placements/students` sets no `departmentId`, so those students
are invisible to every department-scoped view. Two of six students in the dev
database are already in that state. It is filed as a decision rather than
patched, because placements may not amend or delete a student record either —
whether it should create one is a scope question, not a defect.

**All three bugs share one shape:** a row written in a state no reader selects
on. The write returns 200, the data lands, and it reaches nobody. That is
precisely the failure a status-code check calls a pass, and it is why the
sweep judges on before-versus-after instead.
