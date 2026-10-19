# Campus Harmony ERP — role-by-role testing checklist

All demo accounts: `<login>@campusharmony.edu`, password `12345678`.
Clicking a notification (bell, top right) opens the page where the action is needed.
Every approval opens in **Approvals & Workflows → Review** with the full request and its chain.

Work through the **end-to-end flows** first (they cross roles), then each role's own screens.

---

## A. End-to-end flows (do these in order)

### 1. Exam timetable → registration → condonation → hall ticket
1. **CoE** (`coe@`) → *Exam Timetable & Registration* → **New exam session** (registration window must include today; exams after it; e.g. supplementary, semester 5).
2. **Add paper** for 2 semester-5 courses (dates inside the exam window).
3. **Open registration** → **Register all students** → note the "Blocked (any paper)" count.
4. Pick a blocked student under *Blocked & condonation*, log in as them → *Examinations → Registration & hall ticket* → **Request condonation** (reason ≥ 20 characters, optional certificate).
5. Approve in turn: that **course's teacher** (only they see it), **HOD**, **Dean**, **CoE** — each from the bell or *Approvals*.
6. CoE → the paper now shows *Condoned* → **Issue hall tickets**.
7. Student → *Registration & hall ticket* → **Hall ticket** opens a printable PDF.

### 2. Marks → results → revaluation
1. **Faculty** (`faculty.cse2@`) → *Gradebook → End-Semester Entry* → enter paper marks for CSE502 → **Save marks** (total = 40% internals + 60% paper).
2. **HOD** (`hod@`) → *Results Analysis* → **Verify & send to CoE** (or **Return to faculty** with a reason).
3. Repeat 1–2 for every CSE paper (CSE502–506).
4. **CoE** → *Result Submission → Moderation* → each paper **Accept & moderate** (or revise a total with a reason) → *Submit to Dean*.
5. **Dean** (`dean@`) → approve the result publication.
6. **Student** → *Examinations → Results*: grades, SGPA/CGPA; **Marks memo** / **Transcript** print.
7. Student → *Revaluation* → apply; **CoE** → *Revaluations* → **Record outcome**; student is notified.

### 3. Student leave / on-duty
1. **Student** (`aarav.sharma@`) → *Leave & On-duty* → **New request** → type *On duty*, a past date he was absent.
2. **HOD** → approve.
3. Student → *Attendance*: that class now counts as attended.

### 4. Hostel & transport
1. **Registrar** (`registrar@`) → *Hostel & Transport* → **Add hostel** (beds, fee per semester) and **Add route** (stops with yearly fee).
2. **Student** → *Hostel & Transport* → request a hostel seat and a bus pass.
3. Registrar → *Requests* → **Allocate** (room number) / issue pass.
4. Student → sees the room and pass; *Fees* shows the hostel and transport fees.
5. **Finance** → *Fee Management* → mark them paid → student gets a receipt (Payment History → print).

### 5. Admissions
1. **Registrar** → *Admissions* → **New admission cycle** (programme, seats per category) → **Open applications**.
2. **Record application** ×3 (one below the qualifying %).
3. **Eligible / Ineligible** for each → **Generate merit list** → **Offer seat** to rank 1 → **Confirm admission**.
4. Note the roll number + one-time password; log in as the new student.

### 6. Lesson plans
1. **Faculty** → *My Courses* → a course → *Lesson Plan* → **Add week** until ≥ 4 weeks → **Submit for approval**.
2. **HOD** → approve; **Dean** → approve.
3. HOD → *Lesson Plans*: status *Approved*, coverage %, weeks behind.

### 7. Payroll
1. **Finance** (`finance@`) → *Payroll Processing → Salary structures* → **Set up** for 2–3 staff (basic, DA %, HRA %, bank, PAN). Check gross, PF, PT, TDS, net.
2. **Generate <month>** → **Approve drafts** → **Bank file** (CSV) → **Disburse approved**.
3. **Faculty** → *Profile → Payslips* (other staff: *Account → Payslips*) → **Download** (PDF; bank account and PAN masked).
4. Finance → *Accounting* → **Tally export** (XML) and **Export Ledger** (CSV).

### 8. NAAC
1. **HOD** → *Accreditation Data* → verify the computed metrics.
2. **IQAC** (`iqac@`) → *NAAC Criteria*: readiness % per criterion and what is missing → **Send for sign-off** on a criterion.
3. **Principal** (`principal@`) → approve the sign-off → readiness rises.
4. IQAC → *AQAR & Reports* → **Submit for approval** → **Principal** → **VC** (`vc@`) approve.

### 9. Earlier flows (already verified, re-check if time permits)
Faculty leave (faculty → HOD → Dean → Registrar) · fee waiver (student → HOD → Dean → Finance) · certificates (student → Finance → HOD → Registrar → Issue → print) · record correction (student → Registrar) · promotion (HOD → Dean → Registrar → VC) · research publication/project/patent · timetable change (HOD → Dean) · purchase request and curriculum proposal (HOD → Dean) · grievance (student → grievance officer) · placement (student applies → placement officer) · HOD change (Admin).

---

## B. Each role's own screens

| Role | Login | Check |
|---|---|---|
| Student | `aarav.sharma@` | Profile (Edit profile saves; Record Corrections; certificate Print) · Timetable · Courses · Assignments (upload → faculty grades) · Attendance · **Leave & On-duty** · Examinations (Schedule, **Registration & hall ticket**, Results + print, Revaluation) · Fees (no online payment; receipts print; Waivers) · Library (Renew) · Placements (Apply) · **Hostel & Transport** · Grievances & feedback · Communication |
| Faculty | `faculty.cse2@` | Attendance (mark a past class) · Gradebook (internal + end-semester) · Assignments (create, grade) · **Lesson plan (Add week, Submit)** · Research (publication/project/patent) · Mentoring notes · Class messages · Profile → Leave, **Payslips** · Grievances |
| HOD | `hod@` | Dashboard approvals (Review) · Faculty management (roles, promotion) · Workload & timetable (allocation, changes to Dean, substitutions) · Course management · **Lesson Plans** · Facility management · Student academics (record, notes, email, export) · Results (verify / return) · Accreditation data · Lab & inventory (purchase → Dean) · Grievances · Communication (staff get notified) |
| Dean | `dean@` | Dashboard approvals · Academics (curriculum, timetable changes) · Course/class management · Faculty HR · Student affairs · Results publication · Accreditation · Facilities · Meetings |
| Registrar | `registrar@` | Student records & corrections · **Admissions** · **Hostel & Transport** · Transfers · Certificates (issue, verify, graduands) · Exam oversight (read-only) · Documents · HR (vacancies, promotions) · Accreditation checklist · Queries |
| CoE | `coe@` | **Exam Timetable & Registration** · Exam Oversight (create, edit dates = postpone, delete only while scheduling, advance to moderation) · Results (Moderation, Submit to Dean, Revaluations) · Submission tracker |
| Finance | `finance@` | Fee management (record payment → receipt) · Accounting (journal → post, **Tally export**, ledger CSV) · Procurement (PO) · **Payroll (structures, generate, approve, disburse)** · Reports (each downloads CSV) · Budgets · Approvals (waivers, certificates, research) |
| VC / Pro-VC | `vc@`, `provc@` | Approvals (final sanctions) · Policy scenarios · Meetings & minutes · Communication (broadcast reaches users' bells) · Compliance · Finance overview · Analytics · Global access |
| Principal | `principal@` | Dean/Registrar/Finance views · **NAAC criterion sign-off** and **AQAR** approval in Approvals |
| IQAC | `iqac@` | **NAAC Criteria (readiness, live figures, sign-off)** · Action items · Document review · Feedback analysis · **AQAR (generate, edit, submit)** · Meetings |
| Placement | `placement@` | Companies · Drives (students see them; shortlist applicants) · Training · Messages · Reports |
| Library | `librarian@` | Catalogue a book · Issue → student sees it → Renew → Return (fine) · Waive fine |
| Sports | `sports@` | Teams · Athletes · Attendance · Events · Inventory · Fitness tests · Facility booking |
| Alumni | `alumni@` | Sync graduates · Events · Jobs · Mentorship · Donations · Communications · Progression survey |
| Security | `security@` | Incidents · Visitors (check out) · Vehicle passes · Vigilance cases · ID cards · Guards & duty |
| Grievance | `grievance@` | Cases (status, timeline — complainant is notified) · Compliance |
| Auditor | `auditor@` | Read-only: every page opens; any save is refused |
| Admin | `superadmin@` | Users (create, edit, delete with reason) · System config (university profile saves; academic years; **Departments: Change / Remove HOD**, activate/deactivate) · Audit logs · Notifications |

### Not available by design
- Online fee payment (no gateway keys): students pay at the Finance office; Finance records it and the receipt appears.
- Email / SMS: in-app notifications only until SMTP / SMS accounts are configured.
