# 03 — Frontend Audit

**Scope:** `src/` — 228 `.ts`/`.tsx` files; **133 non-UI feature components/pages** (excluding `src/components/ui/`, the shadcn primitive library).

---

## Headline finding: the frontend is genuinely wired, not a mock-up

This is the strongest part of the repository and it deserves to be stated plainly, because it contradicts the usual expectation for an ERP prototype of this size.

| Measure | Count | % |
|---|---:|---:|
| Non-UI feature components/pages | 133 | 100% |
| Importing the real API layer | **121** | **91%** |
| Importing `src/data/studentMockData.ts` | **0** | 0% |
| Importing `src/lib/dataStore.ts` | **0** | 0% |
| Containing `console.log` | **0** | 0% |
| Containing `TODO`/`FIXME` | **0** | 0% |
| Containing empty `catch {}` blocks | **0** | 0% |

The API layer is `@/lib/api`, `@/lib/apiService`, `@/lib/iqacApi`, and the hooks `useApiData`, `useRoleData`, `useStudentData`.

**`src/data/studentMockData.ts` — the single file matching the mock-data search patterns — is imported by zero components. It is dead code.** So is `src/lib/dataStore.ts`. The audit brief's central suspicion ("a beautiful dashboard with mock data is not an implemented ERP") does **not** apply to this frontend in the way it usually does.

## The 12 components not importing the API layer

All 12 were inspected. **None is a mock-data dashboard.**

| File | Classification | Reason |
|---|---|---|
| `components/dashboard/StatCard.tsx` | 🔵 FRONTEND-ONLY | Presentational; receives props |
| `components/dashboard/WidgetCard.tsx` | 🔵 FRONTEND-ONLY | Presentational wrapper |
| `components/layout/DashboardLayout.tsx` | 🔵 FRONTEND-ONLY | Layout shell |
| `components/layout/Sidebar.tsx` | 🔵 FRONTEND-ONLY | Role-based navigation config |
| `components/NavLink.tsx` | 🔵 FRONTEND-ONLY | Router link wrapper |
| `pages/Index.tsx` | 🔵 FRONTEND-ONLY | Landing |
| `pages/NotFound.tsx` | 🔵 FRONTEND-ONLY | 404 |
| `pages/RoleSelection.tsx` | 🔵 FRONTEND-ONLY | Role picker UI |
| `pages/Dashboard.tsx` | 🔵 FRONTEND-ONLY | Routes to role dashboards |
| `components/library/LibraryCatalog.tsx` | 🟣 DUPLICATE (thin) | 5-line delegation: `<LibrarianLibrary initialTab="catalog" />` |
| `components/library/LibraryCirculation.tsx` | 🟣 DUPLICATE (thin) | Same pattern |
| `components/library/LibraryAcquisitions.tsx` | 🟣 DUPLICATE (thin) | Same pattern |

The three library files are **intentional thin wrappers** around `LibrarianLibrary.tsx` (which does import the API) to give each tab its own route. Acceptable pattern, not dead code.

**Conclusion: there is no "fake dashboard" problem in this codebase.** Data displayed in the UI originates from the API.

---

## F1 — No 401 handling; session dies silently (P1)

`src/lib/api.ts` — complete file, 23 lines:

```ts
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);
```

There is a **request** interceptor and **no response interceptor**.

When the 24-hour JWT expires (`backend/routes/auth.ts:37`), every subsequent request returns 401. The application does not detect this. `AuthContext` only checks the token on mount (`hydrateUser`, `AuthContext.tsx:19-36`). The user is left inside a logged-in shell where every action fails, with no message and no redirect to login, until they manually reload the page.

**Fix:** add a response interceptor that, on 401, clears the token, resets auth state, and redirects to login.

## F2 — Token stored in `localStorage` (P1)

`src/context/AuthContext.tsx:44` — `localStorage.setItem('token', data.token)`.

Readable by any injected script. Combined with the unauthenticated file-upload/serving chain (`07_SECURITY_AUDIT.md` S2/S3), which permits stored XSS on the API origin, this is an exploitable token-theft path. An `httpOnly`, `SameSite=Strict` cookie would not be script-readable.

No refresh token exists; sessions terminate hard at 24 hours.

## F3 — Frontend type errors (P2)

`npx tsc --noEmit -p tsconfig.app.json` → **22 errors**, all from untyped API responses (`unknown`) reaching JSX:

| File | Errors | Nature |
|---|---:|---|
| `admin/AdminUserManagement.tsx:162-167` | 6 | `Property 'name'/'email'/'role'/'designation'/'departmentId'/'password' does not exist on type 'unknown'` |
| `admin/SuperAdminDashboard.tsx:40-42` | 3 | `Property 'value' does not exist on type 'unknown'` |
| `finance/FinanceBudgets.tsx:213,222` | 6 | `unknown` not assignable to `Key`/`ReactNode`; `.toLowerCase` on `unknown` |
| `finance/Payroll.tsx:164` | 3 | Same pattern |
| `layout/DashboardLayout.tsx:72,84,87,106` | 4 | **`TS1117: An object literal cannot have multiple properties with the same name`** |

The `DashboardLayout` errors are a **real bug**, not a typing nit: duplicate keys in an object literal mean earlier values are silently discarded. Whatever configuration that object drives (likely route or title mapping) is partially ignored at runtime.

The root cause of the other 18 is that API responses are untyped — mirroring `const db: any = prisma` on the backend. There are no shared request/response types between frontend and backend.

## F4 — `toast()` used in 98 components — verification incomplete (❓)

98 of 133 components call `toast({...})`. Toast-on-success is the correct pattern *when preceded by a real API call*, and the 91% API-import rate suggests most are legitimate. However, **I did not verify every handler individually** to confirm that each toast follows an actual awaited mutation rather than firing optimistically on local state change.

This is the one place where "a button is not a feature" could still hide. See BLOCKED below.

## F5 — Route guarding not verified (❓)

`src/App.tsx` and `src/components/layout/Sidebar.tsx` implement role-based navigation (`Sidebar.tsx:207` defines `librarianMenuItems`, `:381-382` selects the menu by `user.role`). Menu *rendering* is role-aware.

**Not verified:** whether `<Route>` elements are wrapped in a guard component. If navigation is filtered only by hiding menu items, a user typing a URL directly could reach another role's page. The backend would reject the API calls (RBAC is enforced server-side — a genuine strength), so this is a UX/information-disclosure concern rather than a data-breach one, but it needs confirmation.

## F6 — Design system and UX (positive)

- Consistent shadcn/ui over Radix primitives across all modules — Radix provides a reasonable accessibility floor (focus management, ARIA on dialogs/menus).
- Tailwind with `next-themes` for dark mode.
- `recharts` for dashboards; `react-hook-form` + `zod` for forms — **frontend validation exists even though backend validation does not**.
- `@tanstack/react-query` available for server state.

## Classification summary

| Classification | Count | Notes |
|---|---:|---|
| ✅ COMPLETE / 🟡 PARTIAL (API-backed) | 121 | Split between the two not individually verified — see BLOCKED |
| 🔵 FRONTEND-ONLY (legitimately) | 9 | Layout, presentational, landing/404 |
| 🟣 DUPLICATE (thin, intentional) | 3 | Library tab wrappers |
| ⚪ STATIC/MOCK | **0** | No mock-data components found |
| 🔴 BROKEN | 0 confirmed | None found statically |
| ⚫ UNREACHABLE | 2 modules | `src/data/studentMockData.ts`, `src/lib/dataStore.ts` — dead code |

## BLOCKED / NOT VERIFIED

Stated explicitly, per the audit rules:

1. **No runtime browser verification was performed.** The application was never loaded in a browser during this audit — the database was not migrated or seeded, so no meaningful UI session was possible. **Every "COMPLETE" classification is static-analysis-based and should be treated as provisional.**
2. **The COMPLETE vs PARTIAL split within the 121 API-backed components is not resolved.** Determining this requires per-component inspection of loading states, error states, empty states, and whether every action control completes a round trip.
3. **F4 (toast-only handlers) is unresolved** — 98 components use `toast()`; individual handler verification was not completed.
4. **F5 (route guards) is unresolved** — `App.tsx` route-guard structure not traced.
5. **Accessibility was not tested.** Radix provides a floor; no axe/Lighthouse run was performed. No keyboard-navigation or screen-reader testing.
6. **Responsive behaviour was not tested** at any breakpoint.
7. **A delegated background agent tasked with the exhaustive 228-file component pass failed (stalled).** Its output was not recovered. The findings above come from targeted analysis plus repository-wide pattern measurement, which is why aggregate counts are firm but per-component classification is not.

## Priority fixes

1. Add a 401 response interceptor with auto-logout (**P1**).
2. Move the token to an `httpOnly` cookie, or accept the XSS risk explicitly and eliminate the stored-XSS vector first (**P1**).
3. Fix `DashboardLayout.tsx` duplicate object keys — real runtime bug (**P2**).
4. Generate shared API types from the Prisma schema / an OpenAPI spec; eliminate `unknown` at the boundary (**P2**).
5. Confirm route guards wrap role-restricted routes (**P2**).
6. Delete dead code: `src/data/studentMockData.ts`, `src/lib/dataStore.ts` — **after** confirming no dynamic import (**P3**).
7. Complete the per-component COMPLETE/PARTIAL classification with the app actually running (**P2**).
