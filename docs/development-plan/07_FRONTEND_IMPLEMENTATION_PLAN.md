# 07 — Frontend Implementation Plan

## Starting position: better than expected

The audit's central suspicion — "a beautiful dashboard with mock data is not an implemented ERP" — **does not apply here**.

| Measure | Count |
|---|---:|
| Non-UI feature components/pages | 133 |
| Importing the real API layer | **121 (91%)** |
| Importing mock data | **0** |
| Containing `console.log` | 0 |
| Containing `TODO`/`FIXME` | 0 |
| Empty `catch {}` blocks | 0 |

`src/data/studentMockData.ts` and `src/lib/dataStore.ts` have **zero importers** — dead code, not live fakery.

**Implication for this plan: repair, do not rewrite.** The frontend work is correctness and typing, not reconstruction.

## Done in Phase 0 ✅

### 401 handling and session lifecycle (P1-09)

`src/lib/api.ts` had a request interceptor and **no response interceptor**. When the 24-hour JWT expired, every request returned 401 and the app never noticed — the user sat in a logged-in shell where every action failed silently until a manual reload.

Implemented:

- Response interceptor clears the token on 401 and dispatches `SESSION_EXPIRED_EVENT`
- `AuthContext` listens, resets state, and exposes `sessionExpired` so the login screen can explain what happened
- **Cross-tab sync** via the `storage` event — logging out in one tab no longer leaves another tab appearing authenticated
- `ApiError` class carrying `code`, `details`, `retryable` and `requestId`
- `getErrorMessage()` helper so components stop showing "Something went wrong"

`requestId` is quotable in a bug report and correlates directly to the server log line.

**Status: IMPLEMENTED, not yet browser-verified** — see Verification below.

## Immediate work

### F-01 — Empty states are now reachable (P1) ← do first

Removing the backend fabrication changed frontend behaviour, by design. Endpoints that previously always returned invented data now legitimately return **404** or empty arrays.

**This is correct and must not be "fixed" by restoring the fabrication.**

Every component consuming student/faculty profile data needs:

| State | Requirement |
|---|---|
| Loading | Skeleton, not a blank screen |
| Empty | Explain *why* and what to do — "No student record exists for this account. Contact the admissions office." |
| Error | Actionable message from `ApiError.message` |
| 404 specifically | Distinguish "not set up yet" from "failed" |

Priority: student dashboard, faculty dashboard, lesson plans, class lists, then the rest.

### F-02 — Fix the 22 TypeScript errors (P2)

| File | Errors | Nature |
|---|---:|---|
| `layout/DashboardLayout.tsx:72,84,87,106` | 4 | **`TS1117` duplicate object keys — a real bug**: earlier values are silently discarded, so part of that config never applies |
| `admin/AdminUserManagement.tsx:162-167` | 6 | Untyped API response → `unknown` |
| `finance/FinanceBudgets.tsx:213,222` | 6 | Same |
| `finance/Payroll.tsx:164` | 3 | Same |
| `admin/SuperAdminDashboard.tsx:40-42` | 3 | Same |

`DashboardLayout` is a correctness fix, not a typing nit — do it first. The other 18 all share one root cause: **no shared types between frontend and backend**.

### F-03 — Shared API types (P2)

The backend is at 0 type errors; the frontend's remaining errors are all `unknown` at the API boundary.

Once zod schemas exist (T-202), generate types from them so frontend and backend cannot drift. Interim: hand-write DTOs in `src/types/api/` for the highest-traffic endpoints.

### F-04 — Verify route guards (P2) — **NOT VERIFIED**

`Sidebar.tsx` filters menu items by role, but whether `<Route>` elements are wrapped in a guard was never confirmed. If navigation is filtered only by hiding menu items, a user could reach another role's page by typing the URL.

The backend would reject the API calls — server-side RBAC is genuinely solid — so this is information disclosure and broken UX, not a data breach. Still needs a `<RequireRole>` wrapper.

### F-05 — Server-side tables (P1, with T-206)

Per audit rule 69, large tables (students, marks, attendance, payments, applications) must use server-side pagination, search, filter and sort. Loading 50,000 records into the browser is not acceptable. Blocked on backend pagination (T-206).

## Later phases

| Phase | Work |
|---|---|
| 4 | Academic core UI — programme, curriculum, credits, **real** CGPA display |
| 5 | Admissions workflow UI + bulk import (upload → map → validate → preview → confirm) |
| 6 | Examination UI — marks entry with verification/moderation/approval states |
| 9 | Notification centre (backend currently stores messages and sends nothing) |
| 10 | Reporting UI with filters, drilldown, export |

## Component architecture (audit rule 30)

Do not mix page + API calls + business rules + validation + formatting + permissions in one file. Target:

```
pages/<Module>Page.tsx      layout + composition
  hooks/use<Module>.ts      react-query data access
  components/<Module>/      presentational
  lib/api/<module>.ts       typed API calls
```

**Refactor only where it removes real friction** — 121 working components are not a refactoring backlog.

## UX standards

- Error messages must be specific: "Marks cannot be edited after final publication", not "Something went wrong". The backend now returns usable messages — surface them.
- Loading, empty and error states on every data-driven view.
- Accessibility: Radix gives a floor; add labels, focus management, contrast checks. **Never tested — no axe/Lighthouse run has been performed.**
- Responsive: adaptive, not a desktop table crushed onto mobile.

## Verification required

**The application has never been loaded in a browser during this work.** Before any frontend item is marked `VERIFIED`:

1. Start backend + `npm run dev`; log in with a seeded account
2. Confirm dashboards render and the 401 interceptor logs out on an expired/cleared token
3. Confirm empty states appear where fabrication was removed — **the key regression risk**
4. Check the browser console and network tab for errors
5. Test cross-tab logout

Until then every frontend status stays `IMPLEMENTED`, not `VERIFIED`.

## Sequence

| Order | Task | Priority |
|---:|---|---|
| ✅ | 401 interceptor + session handling | P1 |
| 1 | **Browser verification of Phase 0** | P1 |
| 2 | F-01 empty states | P1 |
| 3 | F-02 `DashboardLayout` duplicate keys | P2 |
| 4 | F-04 route guards | P2 |
| 5 | F-03 shared types | P2 |
| 6 | F-05 server-side tables | P1 (blocked on T-206) |
| 7 | Delete dead code after confirming no dynamic imports | P3 |
