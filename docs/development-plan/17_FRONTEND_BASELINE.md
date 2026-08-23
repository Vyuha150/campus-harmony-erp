# 17 — Frontend Baseline (Phase 0.3)

**Produced:** 2026-08-22, **from a browser**, against a running backend and database.
**Method:** logged in as each role through the real login form, loaded the dashboard,
read rendered text, console errors and network traffic.

> Every previous statement about the frontend in this repository was derived from
> reading code. This is the first record taken from the running application.

---

## Headline

**The frontend is in materially better shape than the audit implied.** Five role
dashboards render real, tenant-scoped data from the API with **zero console
errors**. The pessimistic reading — that untested UI would be broadly broken —
was wrong.

What is genuinely wrong is narrower and more specific than "it doesn't work".

---

## Verified working

| Screen | Evidence observed in the browser |
|---|---|
| **Login** | Authenticates, stores the token, redirects to `/dashboard` |
| **Librarian — Library Operations** | Tiles show real values (2 copies, 1 on loan, **₹20.00** outstanding). Both copies of one ISBN listed by distinct accession number. Overdue computed. Borrower resolved. |
| **Librarian — return flow** | Returned through the UI; toast showed the server's derivation: *"6 day(s) overdue, less 1 grace day(s) = 5 chargeable day(s) x Rs.2/day = Rs.10.00"*. Tiles updated live; empty state rendered. |
| **Student dashboard** | CGPA **0** (computed, not fabricated), attendance 94%, 1 active course, fee due ₹80,500 |
| **Faculty dashboard** | Semester 5, 1 course, 1 student, 4h weekly hours, 1 publication, today's schedule |
| **HOD dashboard** | Department named, 1 faculty, 4 students with year split, 1 pending approval |
| **Finance dashboard** | Budget ₹50.0L, revenue ₹75,000, outstanding ₹80,500 |
| **Registrar dashboard** | 1 pending file, 5 active students, 15/18 staff positions |

---

## Defects found by running it

### F-1 — Student dashboard shows "Semester 0" · **confirmed**
The header reads `• Semester 0 •`. The database holds `semester = 5` for that
student. A student is shown the wrong academic position on their own dashboard.

### F-2 — Finance dashboard reports "0 students defaulting" · **confirmed**
Shown directly beneath `Outstanding Dues ₹80,500`. The database has **2 pending
fee records totalling ₹80,500**.

This is the **same dead-status pattern** the library had: a count filtered on a
status value nothing ever assigns, so it reads zero while looking like a working
metric. Worth grepping for other counts filtered on `'overdue'` or `'defaulter'`.

### F-3 — Finance cash-flow chart renders all zeros
Six months, every bar `0M`, with no indication whether that means "no data" or
"nothing happened". Needs an empty state.

### F-4 — Screenshots unavailable in this environment
The Browser pane is not displayed, so pages do not composite frames. All evidence
here is text, DOM and network — sufficient to confirm behaviour, insufficient for
visual/layout regressions. **Layout and styling remain unverified.**

---

## Fixed during Phase 0

| Item | Detail |
|---|---|
| **Librarian screen** | Was fully dead: `GET /library/students` had been deleted in the migration, so `Promise.all` rejected and blanked the screen. Rewritten for the new contract; borrower lookup restored **narrowly** (id, roll number, name, open loans) rather than returning full student profiles as before. |
| **API error messages** | `getApiErrorMessage` read only `data.message`, but rebuilt modules return `{error:{message,details}}` — **every error from every rebuilt module was discarded** and shown as "API Error". Now surfaces the real message plus field-level detail. |
| **Breadcrumb labels** | Four duplicate keys in `routeLabels` meant `/sports/events` breadcrumbed as "Events & Reunions" and the security officer's compliance page showed IQAC's title. |
| **Admin bulk user import** | Posted each record with `password: 'password123'`. The backend now rejects that value, so the feature had been failing on the first record. Disabled and pointed at the real import engine — it validated nothing, was not atomic, and duplicated a working engine badly. |
| **TypeScript** | 22 errors → **0**. |

---

## Environment findings

### E-1 — `npm run dev` points at PRODUCTION
The committed `.env` sets `VITE_API_BASE_URL` to a live host. Any developer
running the frontend locally reads and writes the production system.

A gitignored `.env.local` now overrides it to `localhost:5000`. **The committed
`.env` was deliberately left alone** — it is deployment configuration and changing
it is the owner's call.

### E-2 — Very slow first paint in development
The dev server streams a large module graph; first render took roughly 20 seconds.
This is the unsplit ~2.1 MB bundle showing up at dev time, and it is the same
condition Phase 4 addresses through code-splitting.

### E-3 — Local Postgres is fragile under memory pressure
It died mid-session (`terminated by exception 0xC0000142`) when the machine ran
out of commit charge, which surfaced as a **500 on login** that looked like an
application bug and was not.

Also corrected: the server log had been started **inside** `PGDATA`, so crash
recovery hit a sharing violation on its own log file. The log now lives in
`pgsql/logs/`. Recovery then completed cleanly with **no data loss** — 26 users,
15 migrations intact.

---

## What this baseline does not cover

- Only 6 of 15+ role portals were walked. The rest are unverified.
- Only dashboards were exercised; **deep pages and forms were not**, except the
  librarian issue/return path.
- No layout or visual verification (see F-4).
- No mobile or responsive checking.
- Interaction note: Radix tab triggers do not respond to a synthetic `.click()` —
  they need pointer events. A tab that appeared broken was the test method, not
  the app. Recorded so the next person does not file the same false bug.
