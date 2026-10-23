# Campus Harmony ERP — demo recording script

Target length: **12–15 minutes** in one recording (or one short clip per scene, joined later).
Password for every account: `12345678` · logins are `<name>@campusharmony.edu`.

---

## Before you press record (10 min)

1. **Start the app** (VS Code, two terminals):
   - Terminal 1: `cd backend` → `npm run dev` (wait for "server started" on port 5000)
   - Terminal 2 (project folder): `npm run dev` → open **http://localhost:8080**
2. **One browser window per role** — a login is shared by every tab of the same window, so two roles in one window log each other out:
   - **Chrome (normal)** → Student `aarav.sharma`
   - **Chrome Incognito** → HOD `hod`
   - **Edge** (or a second Chrome profile) → everyone else, one after another (log out / log in between scenes)
   Log the Student and HOD in **before** recording.
3. Browser zoom **110 %**, close other tabs, turn on Windows **Do Not Disturb** (no WhatsApp/email pop-ups).
4. **Recorder** — any of these:
   - **Snipping Tool** (Windows 11): `Win + Shift + R` → drag over the whole screen → Start. Records everything, saves MP4.
   - **OBS Studio** (free) if you want your voice + higher quality: Display Capture + Mic, Record.
   - Xbox Game Bar (`Win + Alt + R`) records only ONE window, so it misses window switches — avoid.
5. Record your voice reading the lines below, or record silently and add captions — either is fine.

---

## Scene 1 — Opening (30 s) · *any window*

Show the login page.
> "This is Campus Harmony ERP, a complete university management system. It has 17 role-based dashboards — student, faculty, HOD, dean, registrar, controller of exams, finance, IQAC and more — all connected through approval workflows. I'll show it working across several roles."

## Scene 2 — Super Admin (1.5 min) · *Edge* · `superadmin`

1. Log in → Dashboard.
2. **Users** → scroll the list.
   > "The admin manages every account in the institution."
3. **System Config** → **University Profile** tab, then **Departments** tab.
4. On a department, click **Change HOD** → show the dialog → **Cancel**.
   > "The admin can change or remove a department's HOD; the old HOD returns to faculty automatically and the change is audited."
5. **Audit Logs**. → Log out.

## Scene 3 — Student self-service (2 min) · *Chrome* · `aarav.sharma`

1. Dashboard → **Timetable** → **Attendance**.
2. **Examinations** → **Results** tab → click **Marks memo** (print preview opens) → close it.
   > "Results, SGPA and CGPA are calculated automatically, and the marks memo and transcript print as PDFs."
3. **Fees** → Payment History → click the **download icon** on a paid row (receipt opens) → close.
4. **Hostel & Transport** and **Library** — a quick look.

## Scene 4 — ⭐ Approval workflow: Student → HOD (2 min)

This is the most important scene — it shows the ERP working end to end.

1. *Chrome (Student)* → **Leave & On-duty** → **New request** → type **On duty (OD)**, pick a recent date, reason "Represented the college at a hackathon" → **Submit**.
   > "A student applies for on-duty leave…"
2. Switch to *Incognito (HOD)* → the **bell** shows a new notification → click it.
   > "…the HOD is notified instantly, and clicking the notification opens exactly the request that needs action."
3. **Review** → **Approve** (add a short remark).
4. Switch back to *Chrome (Student)* → refresh **Leave & On-duty** → status **Approved**.
   > "The student sees the decision immediately, and approved on-duty days count as attended."

## Scene 5 — Faculty lesson plan → HOD (1.5 min)

1. *Edge* → log in `faculty.cse2` → **My Courses** → a course → **Lesson Plan** tab — show the weeks.
   > "Faculty plan the syllabus week by week and submit it for approval — HOD first, then the Dean."
2. **Gradebook** → show internal and end-semester marks entry. → Log out.

## Scene 6 — HOD dashboard (1.5 min) · *Incognito* · `hod`

1. **Dashboard** — pending approvals card.
2. **Lesson Plans** — coverage % and "weeks behind".
3. **Results Analysis** — **Verify & send to CoE** buttons (don't click).
   > "The HOD verifies results before they go to the Controller of Examinations."
4. **Accreditation Data** — auto-computed NAAC metrics.

## Scene 7 — Controller of Examinations (1.5 min) · *Edge* · `coe`

1. **Exam Timetable & Registration** → open a session → papers, registrations, hall tickets.
   > "The CoE schedules exams, opens registration, handles attendance condonation and issues hall tickets."
2. **Results** → **Moderation** tab. → Log out.

## Scene 8 — Dean (1 min) · *Edge* · `dean`

1. Dashboard — approvals waiting on the Dean (curriculum, timetable changes, results).
2. **Academics** — all departments. → Log out.

## Scene 9 — Finance (2 min) · *Edge* · `finance`

1. **Fee Management** — payments and receipts.
2. **Payroll Processing** → **Salary structures** tab.
   > "Payroll computes PF, professional tax and TDS under the new tax regime, generates monthly salaries, bank files and payslips."
3. **Accounting** → journal entries; mention the **Tally export**.
4. **Budgets**. → Log out.

## Scene 10 — Registrar (1 min) · *Edge* · `registrar`

1. **Admissions** — cycles, applications, merit list.
   > "Admissions run end to end: applications, eligibility, merit list, seat offers, and confirmation creates the student's login."
2. **Certificates** and **Hostel & Transport**. → Log out.

## Scene 11 — IQAC / NAAC (1 min) · *Edge* · `iqac`

1. **NAAC Criteria** — readiness % per criterion and what's missing.
   > "IQAC sees NAAC readiness live from the ERP's own data, sends criteria for the Principal's sign-off, and generates the AQAR."
2. **AQAR & Reports**. → Log out.

## Scene 12 — Other offices, quick tour (1 min) · *Edge*

Log in to each, show the dashboard for ~10 s, log out:
`librarian` (catalogue, circulation) · `placement` (companies, drives) · `security` (incidents, visitors) · `vc` (approvals, analytics).

## Scene 13 — Closing (20 s)

> "That's Campus Harmony ERP — every role connected through approval workflows, notifications, printable documents and NAAC-ready reporting, running on MongoDB Atlas and ready to deploy on campus-erp.ivyuha.in."

Stop recording.

---

## After recording

- Watch it once at 2× to check nothing private is visible (WhatsApp, email, other tabs).
- Snipping Tool saves to **Videos → Screen Recordings**. If the file is large, upload to Google Drive and send the link instead of the file.

## If something goes wrong mid-recording

- "Something went wrong" screen → **Go back**, continue; cut it later.
- Login keeps failing → the backend terminal stopped; run `npm run dev` there again.
- Data you create (the leave request, approvals) is saved in the demo database — that's fine.
