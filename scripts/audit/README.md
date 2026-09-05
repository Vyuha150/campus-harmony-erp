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
