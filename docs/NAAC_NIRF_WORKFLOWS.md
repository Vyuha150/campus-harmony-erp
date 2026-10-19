# Workflows required by NAAC and NIRF

> Generated from `backend/prisma/naacNirfWorkflows.ts` by `npm run docs:workflows`. Do not edit by hand.

This lists every approval workflow the ERP needs so that the data NAAC and NIRF ask for is produced by a recorded,
role-based process rather than assembled at the last minute. It is derived from the *Comprehensive ERP Blueprint for
Indian Universities (NAAC/UGC/NIRF Aligned)*, mapped to the seven NAAC criteria and the five NIRF parameters.

**59 workflows.** 3 are built into the application and wired to its screens;
the other 56 are loaded into the workflow engine by the demo seed as definitions, ready to be started
through `POST /api/workflow/instances` and acted on from each role's inbox (`GET /api/workflow/inbox`).

Each step names the role that must act, the time allowed, and who it escalates to when that time runs out.
NAAC key-indicator numbers follow the manual for universities and autonomous colleges; confirm them against the
edition the institution is assessed under before quoting them in an SSR.

## Summary

### By NAAC criterion

| Criterion | Workflows |
|---|---|
| 1. Curricular Aspects | 5 |
| 2. Teaching-Learning and Evaluation | 12 |
| 3. Research, Innovations and Extension | 7 |
| 4. Infrastructure and Learning Resources | 5 |
| 5. Student Support and Progression | 12 |
| 6. Governance, Leadership and Management | 14 |
| 7. Institutional Values and Best Practices | 4 |

### By NIRF parameter

| Parameter | Workflows that feed it |
|---|---|
| **TLR** — Teaching, Learning and Resources | Introduction of a new programme or course; Admission and reserved-category seat allotment; Faculty workload and timetable approval; Faculty qualification and experience verification; Purchase indent and procurement; Library book / e-resource acquisition; IT infrastructure upgrade request; Maintenance and repair request; Department budget allocation and utilisation review; Faculty recruitment; Faculty promotion (Career Advancement Scheme); Monthly payroll approval; Internal and external financial audit — objection settlement; NIRF annual data capture and submission; NIRF financial resources data certification (FRU) |
| **RP** — Research and Professional Practice | Research project proposal and seed-grant sanction; Research grant utilisation and closure; Patent / IPR filing and start-up incubation approval; Research publication verification; Consultancy and corporate-training approval; MoU and collaboration approval; NIRF annual data capture and submission |
| **GO** — Graduation Outcomes | Slow / advanced learner identification and mentoring; Result moderation and publication; CO-PO attainment review (Outcome-Based Education); Capacity-building and skill-enhancement programme approval; Campus placement drive and offer recording; Higher-studies and competitive-examination progression record; NIRF annual data capture and submission; NIRF graduation outcomes verification (GPH / GUE / GMS / GPHD) |
| **OI** — Outreach and Inclusivity | Admission and reserved-category seat allotment; Extension and outreach activity approval (NSS / NCC / community); Scholarship and fee-waiver sanction; Internal Complaints Committee (sexual harassment) complaint; Gender, green, energy and environment audit — action plan; NIRF annual data capture and submission; NIRF outreach and inclusivity data validation (RD / WD / ESCS / PCS) |
| **PR** — Perception | Stakeholder feedback on curriculum — analysis and action taken; Student Satisfaction Survey (SSS); MoU and collaboration approval; Alumni registration, contribution and engagement; Best practice documentation; Institutional distinctiveness statement; NIRF annual data capture and submission; NIRF perception — peer and employer outreach |

### All workflows

| # | Workflow | NAAC | NIRF | Approval chain |
|---|---|---|---|---|
| 1 | Curriculum design and revision *(built in)* | 1.1 | — | Faculty member → Dean |
| 2 | Introduction of a new programme or course | 1.2 | TLR | Head of Department → Dean → Registrar → Finance Officer → Vice-Chancellor |
| 3 | Value-added / certificate course approval | 1.3 | — | Faculty member → HOD → Dean → IQAC Coordinator |
| 4 | Stakeholder feedback on curriculum — analysis and action taken | 1.4 | PR | IQAC Coordinator → HOD → Dean → IQAC Coordinator |
| 5 | Academic calendar approval | 1.1 | — | Registrar office → Dean → Controller of Examinations → Principal |
| 6 | Admission and reserved-category seat allotment | 2.1 | TLR, OI | Admissions office → Registrar → Finance Officer → Principal |
| 7 | Faculty workload and timetable approval | 2.2 | TLR | Department timetable coordinator → HOD → Dean |
| 8 | Lesson plan approval and syllabus-coverage review | 2.3 | — | Faculty member → HOD → Dean |
| 9 | Slow / advanced learner identification and mentoring | 2.3 | GO | Faculty mentor → HOD → Dean |
| 10 | Faculty qualification and experience verification | 2.4 | TLR | Faculty member → HOD → Registrar |
| 11 | Attendance shortage condonation | 2.5 | — | Student → Faculty → HOD → Dean → Controller of Examinations |
| 12 | Internal assessment marks verification and lock | 2.5 | — | Faculty member → HOD → Controller of Examinations |
| 13 | Result moderation and publication *(built in)* | 2.6 | GO | Controller of Examinations → Dean |
| 14 | Revaluation / re-totalling request | 2.5 | — | Student → Finance Officer → Controller of Examinations → Controller of Examinations |
| 15 | CO-PO attainment review (Outcome-Based Education) | 2.6 | GO | Course coordinator → HOD → Dean → IQAC Coordinator |
| 16 | Student Satisfaction Survey (SSS) | 2.7 | PR | IQAC Coordinator → Registrar → IQAC Coordinator → Principal |
| 17 | Research project proposal and seed-grant sanction | 3.1 | RP | Faculty member → HOD → Dean → Finance Officer → Vice-Chancellor |
| 18 | Research grant utilisation and closure | 3.2 | RP | Principal Investigator → Finance Officer → Registrar → Dean |
| 19 | Patent / IPR filing and start-up incubation approval | 3.3 | RP | Faculty member → HOD → Dean → Finance Officer |
| 20 | Research publication verification | 3.4 | RP | Faculty member → HOD → IQAC Coordinator |
| 21 | Consultancy and corporate-training approval | 3.5 | RP | Faculty member → HOD → Dean → Finance Officer |
| 22 | Extension and outreach activity approval (NSS / NCC / community) | 3.6 | OI | Programme officer → HOD → Dean → IQAC Coordinator |
| 23 | MoU and collaboration approval | 3.7 | RP, PR | Head of Department → Dean → Registrar → Vice-Chancellor |
| 24 | Purchase indent and procurement *(built in)* | 4.1 | TLR | Lab staff → Dean |
| 25 | Library book / e-resource acquisition | 4.2 | TLR | Faculty member → HOD → Librarian → Finance Officer |
| 26 | IT infrastructure upgrade request | 4.3 | TLR | System administrator → IT Administrator → Finance Officer → Principal |
| 27 | Maintenance and repair request | 4.4 | TLR | Lab assistant → HOD → Finance Officer |
| 28 | Department budget allocation and utilisation review | 4.4 | TLR | Head of Department → Dean → Finance Officer → Vice-Chancellor |
| 29 | Scholarship and fee-waiver sanction | 5.1 | OI | Student → HOD → Dean → Finance Officer |
| 30 | Capacity-building and skill-enhancement programme approval | 5.1 | GO | Placement Officer → Placement Officer → Dean |
| 31 | Student grievance redressal | 5.1 | — | Student → Grievance Officer → HOD → Grievance Officer |
| 32 | Anti-ragging complaint | 5.1 | — | Student → Security Officer → Dean → Principal |
| 33 | Internal Complaints Committee (sexual harassment) complaint | 5.1 | OI | Complainant → Grievance Officer → Principal |
| 34 | Campus placement drive and offer recording | 5.2 | GO | Placement Officer → Dean → Placement Officer → IQAC Coordinator |
| 35 | Higher-studies and competitive-examination progression record | 5.2 | GO | Graduating student → Alumni Officer → HOD → IQAC Coordinator |
| 36 | Sports and cultural participation and awards | 5.3 | — | Student → Sports Director → HOD → Dean |
| 37 | Certificate issue (bonafide / transfer / transcript / degree) | 5.1 | — | Student → Finance Officer → HOD → Registrar |
| 38 | Alumni registration, contribution and engagement | 5.4 | PR | Alumnus → Alumni Officer → Finance Officer |
| 39 | Statutory body meeting — agenda, minutes and action-taken report | 6.1 | — | Member secretary of the body → Registrar → Principal → IQAC Coordinator |
| 40 | Institutional policy and strategic-plan approval | 6.2 | — | Drafting committee → IQAC Coordinator → Registrar → Vice-Chancellor |
| 41 | Faculty leave and on-duty approval | 6.2 | — | Faculty member → HOD → Dean → Registrar |
| 42 | Faculty recruitment | 6.2 | TLR | Head of Department → Dean → Registrar → Finance Officer → Vice-Chancellor |
| 43 | Faculty performance appraisal (PBAS / API) | 6.3 | — | Faculty member → HOD → Dean → IQAC Coordinator → Principal |
| 44 | Faculty promotion (Career Advancement Scheme) | 6.3 | TLR | Faculty member → HOD → Dean → Registrar → Vice-Chancellor |
| 45 | Financial support for conferences, FDPs and professional bodies | 6.3 | — | Faculty member → HOD → Dean → Finance Officer |
| 46 | Monthly payroll approval | 6.4 | TLR | Accounts section → Registrar → Finance Officer |
| 47 | Internal and external financial audit — objection settlement | 6.4 | TLR | Internal auditor → Finance Officer → Registrar → Vice-Chancellor |
| 48 | AQAR preparation and submission | 6.5 | — | IQAC Coordinator → HOD → IQAC Coordinator → Principal → Vice-Chancellor |
| 49 | Academic and Administrative Audit (AAA) | 6.5 | — | IQAC Coordinator → HOD → IQAC Coordinator → Dean → Principal |
| 50 | SSR / NBA criterion data sign-off | 6.5 | — | Criterion coordinator → IQAC Coordinator → Principal |
| 51 | Gender, green, energy and environment audit — action plan | 7.1 | OI | IQAC Coordinator → IQAC Coordinator → Finance Officer → Principal |
| 52 | Code of conduct and professional-ethics compliance | 7.1 | — | Any stakeholder → HOD → Dean → Principal |
| 53 | Best practice documentation | 7.2 | PR | Department → IQAC Coordinator → Principal |
| 54 | Institutional distinctiveness statement | 7.3 | PR | IQAC Coordinator → Principal → Vice-Chancellor |
| 55 | NIRF annual data capture and submission | 6.5 | TLR, RP, GO, OI, PR | IQAC Coordinator → HOD → IQAC Coordinator → Registrar → Vice-Chancellor |
| 56 | NIRF financial resources data certification (FRU) | 6.4 | TLR | Finance Officer → Finance Officer → Principal → Registrar |
| 57 | NIRF graduation outcomes verification (GPH / GUE / GMS / GPHD) | 5.2 | GO | Placement Officer → Placement Officer → Controller of Examinations → IQAC Coordinator |
| 58 | NIRF outreach and inclusivity data validation (RD / WD / ESCS / PCS) | 2.1 | OI | Registrar office → Registrar → Finance Officer → IQAC Coordinator |
| 59 | NIRF perception — peer and employer outreach | 5.4 | PR | Placement Officer → Alumni Officer → Placement Officer → Dean |

## Criterion 1 — Curricular Aspects

### Curriculum design and revision

- **Code:** `CURRICULUM_PROPOSAL` (built into the application)
- **NAAC key indicator:** 1.1 Curriculum Design and Development
- **NIRF parameter:** none
- **Started by:** Faculty member / Board of Studies
- **Record approved:** `CurriculumProposal`
- **Why it is needed:** A department proposes a syllabus change, the Board of Studies reviews it and the Dean approves it, so every revision is traceable to the body that approved it.
- **Evidence it leaves:** Approved proposal, BoS and Academic Council minutes, syllabus version history.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Dean approval | Dean | 7 days | Vice-Chancellor |

### Introduction of a new programme or course

- **Code:** `NEW_PROGRAMME_INTRODUCTION`
- **NAAC key indicator:** 1.2 Academic Flexibility
- **NIRF parameter:** TLR (Teaching, Learning and Resources)
- **Started by:** Head of Department
- **Record approved:** `Programme`
- **Why it is needed:** New programmes, electives and CBCS options are approved before intake is sanctioned, which is what NAAC counts under academic flexibility.
- **Evidence it leaves:** Programme proposal, need analysis, statutory approval letters, sanctioned intake.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Dean — academic need and resources | Dean | 7 days | Principal |
| 2 | Registrar — Academic Council agenda | Registrar | 7 days | Pro Vice-Chancellor |
| 3 | Finance Officer — financial viability | Finance Officer | 5 days | Registrar |
| 4 | Vice-Chancellor — final sanction | Vice-Chancellor | 10 days | — |

### Value-added / certificate course approval

- **Code:** `VALUE_ADDED_COURSE_APPROVAL`
- **NAAC key indicator:** 1.3 Curriculum Enrichment
- **NIRF parameter:** none
- **Started by:** Faculty member
- **Record approved:** `Course`
- **Why it is needed:** Add-on, certificate and skill courses are approved with their hours and outcomes, and enrolment is recorded for the enrichment metric.
- **Evidence it leaves:** Course brochure, approval note, list of students enrolled and completing.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | HOD recommendation | HOD | 3 days | Dean |
| 2 | Dean approval | Dean | 4 days | Principal |
| 3 | IQAC — record for AQAR | IQAC Coordinator | 3 days | — |

### Stakeholder feedback on curriculum — analysis and action taken

- **Code:** `STAKEHOLDER_FEEDBACK_ACTION`
- **NAAC key indicator:** 1.4 Feedback System
- **NIRF parameter:** PR (Perception)
- **Started by:** IQAC Coordinator
- **Record approved:** `FeedbackForm`
- **Why it is needed:** Feedback from students, teachers, employers and alumni is collected, analysed, and closed with an action-taken report — NAAC scores the action, not the collection.
- **Evidence it leaves:** Feedback forms, analysis report, action-taken report hosted on the website.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | HOD — analysis and proposed action | HOD | 7 days | Dean |
| 2 | Dean — action plan approval | Dean | 5 days | Principal |
| 3 | IQAC — action-taken report sign-off | IQAC Coordinator | 5 days | Principal |

### Academic calendar approval

- **Code:** `ACADEMIC_CALENDAR_APPROVAL`
- **NAAC key indicator:** 1.1 Curriculum Design and Development
- **NIRF parameter:** none
- **Started by:** Registrar office
- **Record approved:** `AcademicYear`
- **Why it is needed:** Teaching days, internal assessment windows, examinations and result dates are fixed and published before the term begins.
- **Evidence it leaves:** Published academic calendar and its adherence report.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Dean Academics review | Dean | 4 days | Principal |
| 2 | Controller of Examinations — exam dates | Controller of Examinations | 3 days | Registrar |
| 3 | Principal approval and publication | Principal | 4 days | Vice-Chancellor |


## Criterion 2 — Teaching-Learning and Evaluation

### Admission and reserved-category seat allotment

- **Code:** `ADMISSION_SEAT_ALLOTMENT`
- **NAAC key indicator:** 2.1 Student Enrolment and Profile
- **NIRF parameter:** TLR (Teaching, Learning and Resources), OI (Outreach and Inclusivity)
- **Started by:** Admissions office
- **Record approved:** `AdmissionApplication`
- **Why it is needed:** Seats are offered against the sanctioned intake and the statutory reservation roster; filled-versus-sanctioned and category-wise counts feed both frameworks.
- **Evidence it leaves:** Seat matrix, merit list, category-wise admission register, offer letters.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Document verification | Registrar | 3 days | Principal |
| 2 | Finance — fee realisation | Finance Officer | 2 days | Registrar |
| 3 | Principal — admission confirmation | Principal | 3 days | — |

### Faculty workload and timetable approval

- **Code:** `TIMETABLE_WORKLOAD_APPROVAL`
- **NAAC key indicator:** 2.2 Student Teacher Ratio
- **NIRF parameter:** TLR (Teaching, Learning and Resources)
- **Started by:** Department timetable coordinator
- **Record approved:** `TimetableSlot`
- **Why it is needed:** Teaching load is allotted within the workload norms and the timetable is frozen, giving a defensible student-teacher ratio.
- **Evidence it leaves:** Workload statement per faculty member, approved timetable.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | HOD approval | HOD | 3 days | Dean |
| 2 | Dean approval | Dean | 3 days | Principal |

### Lesson plan approval and syllabus-coverage review

- **Code:** `LESSON_PLAN_APPROVAL`
- **NAAC key indicator:** 2.3 Teaching-Learning Process
- **NIRF parameter:** none
- **Started by:** Faculty member
- **Record approved:** `FacultyLessonPlan`
- **Why it is needed:** Each course has an approved teaching plan mapped to course outcomes, and coverage is reviewed mid-term so shortfalls are corrected in time.
- **Evidence it leaves:** Lesson plans, course files, coverage review reports.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | HOD — plan approval | HOD | 3 days | Dean |
| 2 | Dean — coverage review | Dean | 7 days | Principal |

### Slow / advanced learner identification and mentoring

- **Code:** `MENTOR_LEARNER_SUPPORT`
- **NAAC key indicator:** 2.3 Teaching-Learning Process
- **NIRF parameter:** GO (Graduation Outcomes)
- **Started by:** Faculty mentor
- **Record approved:** `MenteeAssignment`
- **Why it is needed:** Learners are identified from attendance and marks, assigned a mentor, and given remedial or enrichment support with the outcome recorded.
- **Evidence it leaves:** Mentor-mentee lists, counselling notes, remedial class registers.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | HOD — support plan approval | HOD | 4 days | Dean |
| 2 | Dean — outcome review | Dean | 7 days | — |

### Faculty qualification and experience verification

- **Code:** `FACULTY_QUALIFICATION_VERIFICATION`
- **NAAC key indicator:** 2.4 Teacher Profile and Quality
- **NIRF parameter:** TLR (Teaching, Learning and Resources)
- **Started by:** Faculty member / HR
- **Record approved:** `FacultyProfile`
- **Why it is needed:** Ph.D. and experience claims are verified against certificates before they are counted, because NIRF FQE and NAAC 2.4 are both checked in data validation.
- **Evidence it leaves:** Verified degree certificates, experience letters, appointment orders.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | HOD — document check | HOD | 4 days | Dean |
| 2 | Registrar — verification and lock | Registrar | 5 days | Principal |

### Attendance shortage condonation

- **Code:** `ATTENDANCE_CONDONATION`
- **NAAC key indicator:** 2.5 Evaluation Process and Reforms
- **NIRF parameter:** none
- **Started by:** Student
- **Record approved:** `ExamRegistration`
- **Why it is needed:** A student below the attendance threshold is admitted to an examination only on a recorded decision with a reason, never by silently editing the register.
- **Evidence it leaves:** Condonation application, medical or other proof, signed order.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Class teacher recommendation | Faculty | 2 days | HOD |
| 2 | HOD recommendation | HOD | 2 days | Dean |
| 3 | Dean / Principal sanction | Dean | 3 days | Principal |
| 4 | CoE — eligibility update | Controller of Examinations | 1 day | — |

### Internal assessment marks verification and lock

- **Code:** `INTERNAL_MARKS_LOCK`
- **NAAC key indicator:** 2.5 Evaluation Process and Reforms
- **NIRF parameter:** none
- **Started by:** Faculty member
- **Record approved:** `Enrollment`
- **Why it is needed:** Internal marks are verified by the HOD and locked before they reach the examination branch, so later changes need a recorded reason.
- **Evidence it leaves:** Signed internal marks statements and the change log.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | HOD verification and lock | HOD | 3 days | Dean |
| 2 | CoE acceptance | Controller of Examinations | 2 days | Registrar |

### Result moderation and publication

- **Code:** `RESULT_PUBLICATION` (built into the application)
- **NAAC key indicator:** 2.6 Student Performance and Learning Outcomes
- **NIRF parameter:** GO (Graduation Outcomes)
- **Started by:** Controller of Examinations
- **Record approved:** `Department`
- **Why it is needed:** Results are released only after sign-off, and the pass percentage that results is the figure reported under NAAC 2.6 and NIRF GUE.
- **Evidence it leaves:** Moderation committee minutes, result notification, pass-percentage statement.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Dean publication | Dean | 3 days | — |

### Revaluation / re-totalling request

- **Code:** `REVALUATION_REQUEST`
- **NAAC key indicator:** 2.5 Evaluation Process and Reforms
- **NIRF parameter:** none
- **Started by:** Student
- **Record approved:** `RevaluationRequest`
- **Why it is needed:** Examination grievances are handled transparently and within a time limit, with any change of marks recorded against the original.
- **Evidence it leaves:** Revaluation applications, fee receipts, revised marks orders, grade history.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Finance — revaluation fee | Finance Officer | 1 day | Controller of Examinations |
| 2 | CoE — assign second evaluator | Controller of Examinations | 3 days | Registrar |
| 3 | CoE — approve revised result | Controller of Examinations | 5 days | Registrar |

### CO-PO attainment review (Outcome-Based Education)

- **Code:** `OBE_ATTAINMENT_REVIEW`
- **NAAC key indicator:** 2.6 Student Performance and Learning Outcomes
- **NIRF parameter:** GO (Graduation Outcomes)
- **Started by:** Course coordinator
- **Record approved:** `Course`
- **Why it is needed:** Course and programme outcome attainment is computed, compared with targets, and gaps are closed with a documented action plan (also required for NBA).
- **Evidence it leaves:** CO-PO mapping, attainment sheets, gap analysis and action plan.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | HOD — attainment validation | HOD | 5 days | Dean |
| 2 | Dean — action plan approval | Dean | 5 days | Principal |
| 3 | IQAC — record and follow-up | IQAC Coordinator | 7 days | — |

### Student Satisfaction Survey (SSS)

- **Code:** `STUDENT_SATISFACTION_SURVEY`
- **NAAC key indicator:** 2.7 Student Satisfaction Survey
- **NIRF parameter:** PR (Perception)
- **Started by:** IQAC Coordinator
- **Record approved:** `FeedbackForm`
- **Why it is needed:** The student database is certified and shared, the survey is run, and results are acted upon.
- **Evidence it leaves:** Certified student list, survey responses, analysis and action-taken report.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Registrar — certify student database | Registrar | 4 days | Principal |
| 2 | IQAC — analysis report | IQAC Coordinator | 7 days | Principal |
| 3 | Principal — action plan | Principal | 7 days | — |

### NIRF outreach and inclusivity data validation (RD / WD / ESCS / PCS)

- **Code:** `NIRF_DIVERSITY_DATA_VALIDATION`
- **NAAC key indicator:** 2.1 Student Enrolment and Profile
- **NIRF parameter:** OI (Outreach and Inclusivity)
- **Started by:** Registrar office
- **Record approved:** `StudentProfile`
- **Why it is needed:** Region, gender, economically and socially challenged student counts and facilities for differently-abled students are validated from admission records.
- **Evidence it leaves:** Admission register extracts, category and income certificates, accessibility audit.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Registrar — admission data extract | Registrar | 5 days | Principal |
| 2 | Finance Officer — fee reimbursement data | Finance Officer | 4 days | Registrar |
| 3 | IQAC — validation and lock | IQAC Coordinator | 5 days | — |


## Criterion 3 — Research, Innovations and Extension

### Research project proposal and seed-grant sanction

- **Code:** `RESEARCH_PROJECT_SANCTION`
- **NAAC key indicator:** 3.1 Promotion of Research and Facilities
- **NIRF parameter:** RP (Research and Professional Practice)
- **Started by:** Faculty member (Principal Investigator)
- **Record approved:** `ResearchProject`
- **Why it is needed:** Internal seed money and externally funded projects are sanctioned with a budget head, so funding received and spent is traceable per project.
- **Evidence it leaves:** Proposal, sanction order, budget, utilisation certificate.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | HOD recommendation | HOD | 4 days | Dean |
| 2 | Dean (Research) approval | Dean | 5 days | Pro Vice-Chancellor |
| 3 | Finance Officer — budget head | Finance Officer | 4 days | Registrar |
| 4 | Vice-Chancellor sanction | Vice-Chancellor | 7 days | — |

### Research grant utilisation and closure

- **Code:** `RESEARCH_GRANT_UTILISATION`
- **NAAC key indicator:** 3.2 Resource Mobilization for Research
- **NIRF parameter:** RP (Research and Professional Practice)
- **Started by:** Principal Investigator
- **Record approved:** `ResearchProject`
- **Why it is needed:** Expenditure against each grant is certified and the project is closed with a utilisation certificate; NIRF FPPP counts the amounts.
- **Evidence it leaves:** Statement of expenditure, audited utilisation certificate, completion report.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Finance Officer — statement of expenditure | Finance Officer | 5 days | Registrar |
| 2 | Registrar — audited utilisation certificate recorded | Registrar | 7 days | Principal |
| 3 | Dean (Research) — closure | Dean | 4 days | — |

### Patent / IPR filing and start-up incubation approval

- **Code:** `INNOVATION_IPR_FILING`
- **NAAC key indicator:** 3.3 Innovation Ecosystem
- **NIRF parameter:** RP (Research and Professional Practice)
- **Started by:** Faculty member / student innovator
- **Record approved:** `Patent`
- **Why it is needed:** Patent filings and incubation support are approved and their status (filed, published, granted) tracked for the IPR metric.
- **Evidence it leaves:** Invention disclosure, filing receipts, grant certificates.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | HOD recommendation | HOD | 4 days | Dean |
| 2 | Dean (Research) — IPR cell review | Dean | 7 days | Pro Vice-Chancellor |
| 3 | Finance Officer — filing fee | Finance Officer | 3 days | Registrar |

### Research publication verification

- **Code:** `PUBLICATION_VERIFICATION`
- **NAAC key indicator:** 3.4 Research Publications and Awards
- **NIRF parameter:** RP (Research and Professional Practice)
- **Started by:** Faculty member
- **Record approved:** `Publication`
- **Why it is needed:** Each paper is checked for indexing (Scopus / Web of Science / UGC-CARE) before it is counted, since both frameworks cross-check publications externally.
- **Evidence it leaves:** Paper, DOI, indexing proof, plagiarism report.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | HOD — indexing and affiliation check | HOD | 4 days | Dean |
| 2 | IQAC — verification and lock | IQAC Coordinator | 5 days | Dean |

### Consultancy and corporate-training approval

- **Code:** `CONSULTANCY_APPROVAL`
- **NAAC key indicator:** 3.5 Consultancy
- **NIRF parameter:** RP (Research and Professional Practice)
- **Started by:** Faculty member
- **Record approved:** `ResearchProject`
- **Why it is needed:** Consultancy assignments are approved under the revenue-sharing policy and the revenue generated is recorded.
- **Evidence it leaves:** Consultancy agreement, invoices, revenue-sharing statement.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | HOD recommendation | HOD | 3 days | Dean |
| 2 | Dean approval | Dean | 4 days | Principal |
| 3 | Finance Officer — revenue sharing | Finance Officer | 4 days | Registrar |

### Extension and outreach activity approval (NSS / NCC / community)

- **Code:** `EXTENSION_ACTIVITY_APPROVAL`
- **NAAC key indicator:** 3.6 Extension Activities
- **NIRF parameter:** OI (Outreach and Inclusivity)
- **Started by:** Programme officer / faculty coordinator
- **Record approved:** `InterDeptEvent`
- **Why it is needed:** Outreach programmes are approved, conducted and reported with participant numbers.
- **Evidence it leaves:** Activity proposal, attendance, geotagged photographs, report.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | HOD recommendation | HOD | 3 days | Dean |
| 2 | Dean (Student Welfare) approval | Dean | 3 days | Principal |
| 3 | IQAC — activity report | IQAC Coordinator | 7 days | — |

### MoU and collaboration approval

- **Code:** `MOU_COLLABORATION_APPROVAL`
- **NAAC key indicator:** 3.7 Collaboration
- **NIRF parameter:** RP (Research and Professional Practice), PR (Perception)
- **Started by:** Head of Department / Placement Officer
- **Record approved:** `AdminDocument`
- **Why it is needed:** MoUs are vetted and signed, then tracked by the activities actually conducted under them — NAAC counts functional MoUs only.
- **Evidence it leaves:** Signed MoU, list of activities and beneficiaries under it.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Dean — academic value | Dean | 5 days | Principal |
| 2 | Registrar — legal vetting | Registrar | 7 days | Pro Vice-Chancellor |
| 3 | Vice-Chancellor — signing authority | Vice-Chancellor | 7 days | — |


## Criterion 4 — Infrastructure and Learning Resources

### Purchase indent and procurement

- **Code:** `PURCHASE_REQUEST` (built into the application)
- **NAAC key indicator:** 4.1 Physical Facilities
- **NIRF parameter:** TLR (Teaching, Learning and Resources)
- **Started by:** Lab staff / faculty member
- **Record approved:** `PurchaseRequest`
- **Why it is needed:** A department raises a purchase request, the HOD endorses it and the Dean sanctions the spend; the capital expenditure is what NIRF FRU and NAAC 4.1 report.
- **Evidence it leaves:** Indent, quotations, comparative statement, purchase order, stock entry.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Dean sanction | Dean | 5 days | Principal |

### Library book / e-resource acquisition

- **Code:** `LIBRARY_ACQUISITION`
- **NAAC key indicator:** 4.2 Library as a Learning Resource
- **NIRF parameter:** TLR (Teaching, Learning and Resources)
- **Started by:** Faculty member
- **Record approved:** `LibraryBook`
- **Why it is needed:** Recommended titles and subscriptions are approved against the library budget, and annual library expenditure is recorded.
- **Evidence it leaves:** Recommendation list, library committee minutes, invoices, accession register.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | HOD recommendation | HOD | 3 days | Dean |
| 2 | Librarian — availability and budget | Librarian | 4 days | Principal |
| 3 | Finance Officer — purchase sanction | Finance Officer | 4 days | Registrar |

### IT infrastructure upgrade request

- **Code:** `IT_INFRASTRUCTURE_UPGRADE`
- **NAAC key indicator:** 4.3 IT Infrastructure
- **NIRF parameter:** TLR (Teaching, Learning and Resources)
- **Started by:** System administrator / HOD
- **Record approved:** `PurchaseRequest`
- **Why it is needed:** Computers, bandwidth and software are upgraded on an approved plan, keeping the student-computer ratio and bandwidth figures current.
- **Evidence it leaves:** IT policy, upgrade plan, purchase records, bandwidth bills.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | IT administrator — technical specification | IT Administrator | 4 days | Registrar |
| 2 | Finance Officer — budget availability | Finance Officer | 4 days | Registrar |
| 3 | Principal sanction | Principal | 5 days | Vice-Chancellor |

### Maintenance and repair request

- **Code:** `MAINTENANCE_REQUEST`
- **NAAC key indicator:** 4.4 Maintenance of Campus Infrastructure
- **NIRF parameter:** TLR (Teaching, Learning and Resources)
- **Started by:** Lab assistant / faculty member / hostel warden
- **Record approved:** `LabInventoryItem`
- **Why it is needed:** Faults are reported, sanctioned and closed, with maintenance expenditure captured against the right head.
- **Evidence it leaves:** Complaint register, work orders, maintenance expenditure statement.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | HOD approval | HOD | 2 days | Dean |
| 2 | Finance Officer — sanction | Finance Officer | 3 days | Registrar |

### Department budget allocation and utilisation review

- **Code:** `DEPARTMENT_BUDGET_ALLOCATION`
- **NAAC key indicator:** 4.4 Maintenance of Campus Infrastructure
- **NIRF parameter:** TLR (Teaching, Learning and Resources)
- **Started by:** Head of Department
- **Record approved:** `DepartmentBudget`
- **Why it is needed:** Annual budgets are proposed, allocated and monitored against utilisation.
- **Evidence it leaves:** Budget proposal, allocation order, utilisation statement.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Dean recommendation | Dean | 5 days | Principal |
| 2 | Finance Officer — allocation | Finance Officer | 5 days | Registrar |
| 3 | Vice-Chancellor — Finance Committee approval | Vice-Chancellor | 10 days | — |


## Criterion 5 — Student Support and Progression

### Scholarship and fee-waiver sanction

- **Code:** `SCHOLARSHIP_FEE_WAIVER`
- **NAAC key indicator:** 5.1 Student Support
- **NIRF parameter:** OI (Outreach and Inclusivity)
- **Started by:** Student
- **Record approved:** `FeeWaiverRequest`
- **Why it is needed:** Government and institutional scholarships and freeships are sanctioned with a reason; the number of beneficiaries and amounts feed NAAC 5.1 and NIRF ESCS.
- **Evidence it leaves:** Applications, income / category certificates, sanction orders, disbursement list.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | HOD recommendation | HOD | 3 days | Dean |
| 2 | Dean (Student Welfare) recommendation | Dean | 4 days | Principal |
| 3 | Finance Officer — sanction | Finance Officer | 4 days | Registrar |

### Capacity-building and skill-enhancement programme approval

- **Code:** `CAPACITY_BUILDING_PROGRAMME`
- **NAAC key indicator:** 5.1 Student Support
- **NIRF parameter:** GO (Graduation Outcomes)
- **Started by:** Placement Officer / faculty coordinator
- **Record approved:** `TrainingSession`
- **Why it is needed:** Soft-skill, language, ICT and competitive-examination coaching programmes are approved and their participation recorded.
- **Evidence it leaves:** Programme schedule, attendance, feedback, list of students benefited.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Placement Officer — programme plan | Placement Officer | 3 days | Dean |
| 2 | Dean approval | Dean | 4 days | Principal |

### Student grievance redressal

- **Code:** `GRIEVANCE_REDRESSAL`
- **NAAC key indicator:** 5.1 Student Support
- **NIRF parameter:** none
- **Started by:** Student / staff member
- **Record approved:** `GrievanceCase`
- **Why it is needed:** Every complaint is acknowledged, routed and resolved within a time limit, escalating automatically when it is not — as UGC regulations require.
- **Evidence it leaves:** Grievance register, committee minutes, resolution note, time taken.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Grievance Officer — acknowledge and route | Grievance Officer | 1 day | Registrar |
| 2 | HOD / office concerned — resolution | HOD | 5 days | Dean |
| 3 | Grievance Officer — closure with complainant | Grievance Officer | 3 days | Registrar |

### Anti-ragging complaint

- **Code:** `ANTI_RAGGING_COMPLAINT`
- **NAAC key indicator:** 5.1 Student Support
- **NIRF parameter:** none
- **Started by:** Student / warden / anti-ragging squad
- **Record approved:** `DisciplinaryCase`
- **Why it is needed:** Complaints are investigated by the Anti-Ragging Committee within the period fixed by the UGC regulations and the action taken is recorded.
- **Evidence it leaves:** Complaint, squad report, committee minutes, order, report to authorities.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Security Officer — immediate report | Security Officer | 12 h | Principal |
| 2 | Dean (Student Welfare) — committee inquiry | Dean | 3 days | Principal |
| 3 | Principal — order | Principal | 2 days | Vice-Chancellor |

### Internal Complaints Committee (sexual harassment) complaint

- **Code:** `ICC_COMPLAINT`
- **NAAC key indicator:** 5.1 Student Support
- **NIRF parameter:** OI (Outreach and Inclusivity)
- **Started by:** Complainant (identity restricted to the committee)
- **Record approved:** `GrievanceCase`
- **Why it is needed:** Complaints are handled confidentially by the ICC within statutory timelines.
- **Evidence it leaves:** Restricted-access case file, ICC report, action-taken record, annual return.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Grievance Officer — refer to ICC | Grievance Officer | 1 day | Principal |
| 2 | Principal — action on ICC report | Principal | 10 days | Vice-Chancellor |

### Campus placement drive and offer recording

- **Code:** `PLACEMENT_DRIVE_APPROVAL`
- **NAAC key indicator:** 5.2 Student Progression
- **NIRF parameter:** GO (Graduation Outcomes)
- **Started by:** Placement Officer
- **Record approved:** `PlacementDrive`
- **Why it is needed:** Drives are approved, and every offer is recorded with its package and proof; the placement count and median salary are the NIRF GPH and GMS figures.
- **Evidence it leaves:** Drive notification, attendance, offer letters, salary statement.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Dean — drive approval | Dean | 2 days | Principal |
| 2 | Placement Officer — offers and proof uploaded | Placement Officer | 7 days | Dean |
| 3 | IQAC — outcome data verified | IQAC Coordinator | 5 days | — |

### Higher-studies and competitive-examination progression record

- **Code:** `HIGHER_STUDIES_PROGRESSION`
- **NAAC key indicator:** 5.2 Student Progression
- **NIRF parameter:** GO (Graduation Outcomes)
- **Started by:** Graduating student / alumni officer
- **Record approved:** `ProgressionSurvey`
- **Why it is needed:** Admissions to postgraduate programmes and qualification in GATE, GRE, CAT and similar examinations are captured with proof.
- **Evidence it leaves:** Admission letters, scorecards, progression register.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Alumni Officer — collect proof | Alumni Officer | 7 days | Dean |
| 2 | HOD — verification | HOD | 4 days | Dean |
| 3 | IQAC — lock for reporting | IQAC Coordinator | 5 days | — |

### Sports and cultural participation and awards

- **Code:** `STUDENT_ACTIVITY_PARTICIPATION`
- **NAAC key indicator:** 5.3 Student Participation and Activities
- **NIRF parameter:** none
- **Started by:** Student / team coach
- **Record approved:** `SportsEvent`
- **Why it is needed:** Participation in inter-university and national events is sanctioned (with on-duty attendance) and awards are recorded.
- **Evidence it leaves:** Sanction order, on-duty list, certificates and medals.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Sports Director recommendation | Sports Director | 2 days | Dean |
| 2 | HOD — on-duty attendance | HOD | 2 days | Dean |
| 3 | Dean (Student Welfare) sanction | Dean | 3 days | — |

### Certificate issue (bonafide / transfer / transcript / degree)

- **Code:** `CERTIFICATE_ISSUE`
- **NAAC key indicator:** 5.1 Student Support
- **NIRF parameter:** none
- **Started by:** Student / alumnus
- **Record approved:** `CertificateRequest`
- **Why it is needed:** Requests are cleared for dues and issued from verified records within a service-level time.
- **Evidence it leaves:** Request, no-dues clearance, issue register.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Finance — no-dues clearance | Finance Officer | 2 days | Registrar |
| 2 | HOD verification | HOD | 2 days | Dean |
| 3 | Registrar — issue | Registrar | 3 days | — |

### Alumni registration, contribution and engagement

- **Code:** `ALUMNI_ENGAGEMENT`
- **NAAC key indicator:** 5.4 Alumni Engagement
- **NIRF parameter:** PR (Perception)
- **Started by:** Alumnus / Alumni Officer
- **Record approved:** `Donation`
- **Why it is needed:** Alumni profiles are verified and financial or other contributions are receipted and acknowledged.
- **Evidence it leaves:** Alumni association registration, contribution receipts, event reports.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Alumni Officer — profile verification | Alumni Officer | 4 days | Dean |
| 2 | Finance Officer — receipt of contribution | Finance Officer | 3 days | Registrar |

### NIRF graduation outcomes verification (GPH / GUE / GMS / GPHD)

- **Code:** `NIRF_GRADUATION_OUTCOME_VERIFICATION`
- **NAAC key indicator:** 5.2 Student Progression
- **NIRF parameter:** GO (Graduation Outcomes)
- **Started by:** Placement Officer
- **Record approved:** `JobOffer`
- **Why it is needed:** For each graduating batch: students placed, median salary, students in higher studies, on-time graduates and Ph.D.s awarded are reconciled with offer letters and results.
- **Evidence it leaves:** Batch-wise list with offer letters, admission proofs, result gazette, Ph.D. award notifications.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Placement Officer — placement and salary data | Placement Officer | 7 days | Dean |
| 2 | CoE — on-time graduation figures | Controller of Examinations | 5 days | Registrar |
| 3 | IQAC — reconciliation and lock | IQAC Coordinator | 7 days | Registrar |

### NIRF perception — peer and employer outreach

- **Code:** `NIRF_PERCEPTION_OUTREACH`
- **NAAC key indicator:** 5.4 Alumni Engagement
- **NIRF parameter:** PR (Perception)
- **Started by:** Placement Officer / Alumni Officer
- **Record approved:** `AlumniCommunicationRecord`
- **Why it is needed:** Employer, academic-peer and alumni contact lists are kept current and engagement is planned through the year.
- **Evidence it leaves:** Verified contact lists, engagement calendar, communication log.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Alumni Officer — contact list verification | Alumni Officer | 7 days | Dean |
| 2 | Placement Officer — employer list verification | Placement Officer | 7 days | Dean |
| 3 | Dean — engagement plan approval | Dean | 5 days | — |


## Criterion 6 — Governance, Leadership and Management

### Statutory body meeting — agenda, minutes and action-taken report

- **Code:** `COMMITTEE_MEETING_ATR`
- **NAAC key indicator:** 6.1 Institutional Vision and Leadership
- **NIRF parameter:** none
- **Started by:** Member secretary of the body
- **Record approved:** `CommitteeMeeting`
- **Why it is needed:** Governing Body, Academic Council, Finance Committee, BoS and IQAC meetings leave an agenda, approved minutes and a closed action-taken report.
- **Evidence it leaves:** Notice, agenda, attendance, minutes, action-taken report.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Registrar — circulate agenda | Registrar | 3 days | Principal |
| 2 | Chairperson — approve minutes | Principal | 7 days | Vice-Chancellor |
| 3 | IQAC — action-taken report | IQAC Coordinator | 14 days | — |

### Institutional policy and strategic-plan approval

- **Code:** `POLICY_APPROVAL`
- **NAAC key indicator:** 6.2 Strategy Development and Deployment
- **NIRF parameter:** none
- **Started by:** Drafting committee / office concerned
- **Record approved:** `InstitutionalPolicy`
- **Why it is needed:** Policies and the perspective plan are approved by the competent body, versioned and published.
- **Evidence it leaves:** Policy document with version, approving body resolution, publication link.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | IQAC — quality review | IQAC Coordinator | 5 days | Principal |
| 2 | Registrar — statutory vetting | Registrar | 5 days | Pro Vice-Chancellor |
| 3 | Vice-Chancellor — approval | Vice-Chancellor | 7 days | — |

### Faculty leave and on-duty approval

- **Code:** `FACULTY_LEAVE`
- **NAAC key indicator:** 6.2 Strategy Development and Deployment
- **NIRF parameter:** none
- **Started by:** Faculty member
- **Record approved:** `LeaveRequest`
- **Why it is needed:** Leave follows the delegation of powers — faculty to HOD to Dean to Registrar — with class adjustment recorded.
- **Evidence it leaves:** Leave application, alternate-arrangement note, sanction.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | HOD — sanction / forward | HOD | 1 day | Dean |
| 2 | Dean — extended leave | Dean | 2 days | Registrar |
| 3 | Registrar — service record | Registrar | 3 days | — |

### Faculty recruitment

- **Code:** `FACULTY_RECRUITMENT`
- **NAAC key indicator:** 6.2 Strategy Development and Deployment
- **NIRF parameter:** TLR (Teaching, Learning and Resources)
- **Started by:** Head of Department
- **Record approved:** `FacultyRecruitment`
- **Why it is needed:** Vacancies are sanctioned, advertised and filled through a selection committee as per UGC / AICTE norms, protecting the faculty-student ratio.
- **Evidence it leaves:** Vacancy statement, advertisement, selection committee minutes, appointment order.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Dean — vacancy justification | Dean | 4 days | Principal |
| 2 | Registrar — roster and advertisement | Registrar | 7 days | Pro Vice-Chancellor |
| 3 | Finance Officer — post sanction | Finance Officer | 4 days | Registrar |
| 4 | Vice-Chancellor — appointment | Vice-Chancellor | 7 days | — |

### Faculty performance appraisal (PBAS / API)

- **Code:** `FACULTY_APPRAISAL`
- **NAAC key indicator:** 6.3 Faculty Empowerment Strategies
- **NIRF parameter:** none
- **Started by:** Faculty member (self-appraisal)
- **Record approved:** `FacultyProfile`
- **Why it is needed:** Self-appraisal is scored against teaching, research and service, combining student feedback and results.
- **Evidence it leaves:** Self-appraisal forms, API scores, feedback summary, review remarks.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | HOD — review | HOD | 7 days | Dean |
| 2 | Dean — review | Dean | 7 days | Principal |
| 3 | IQAC — API score verification | IQAC Coordinator | 7 days | Principal |
| 4 | Principal — acceptance | Principal | 7 days | — |

### Faculty promotion (Career Advancement Scheme)

- **Code:** `FACULTY_PROMOTION_CAS`
- **NAAC key indicator:** 6.3 Faculty Empowerment Strategies
- **NIRF parameter:** TLR (Teaching, Learning and Resources)
- **Started by:** Faculty member
- **Record approved:** `PromotionRequest`
- **Why it is needed:** Promotion applications are screened against the eligibility norms and decided by a selection committee.
- **Evidence it leaves:** Application, screening committee report, selection minutes, promotion order.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | HOD recommendation | HOD | 5 days | Dean |
| 2 | Dean recommendation | Dean | 5 days | Registrar |
| 3 | Registrar — screening committee | Registrar | 10 days | Pro Vice-Chancellor |
| 4 | Vice-Chancellor — order | Vice-Chancellor | 10 days | — |

### Financial support for conferences, FDPs and professional bodies

- **Code:** `FDP_FINANCIAL_SUPPORT`
- **NAAC key indicator:** 6.3 Faculty Empowerment Strategies
- **NIRF parameter:** none
- **Started by:** Faculty member
- **Record approved:** `TrainingSession`
- **Why it is needed:** Support to attend conferences and development programmes is sanctioned and the number of teachers supported is counted.
- **Evidence it leaves:** Application, sanction order, participation certificate, settlement of advance.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | HOD recommendation | HOD | 3 days | Dean |
| 2 | Dean approval | Dean | 3 days | Principal |
| 3 | Finance Officer — sanction and settlement | Finance Officer | 4 days | Registrar |

### Monthly payroll approval

- **Code:** `PAYROLL_APPROVAL`
- **NAAC key indicator:** 6.4 Financial Management and Resource Mobilization
- **NIRF parameter:** TLR (Teaching, Learning and Resources)
- **Started by:** Accounts section
- **Record approved:** `PayrollRecord`
- **Why it is needed:** Salaries are released after attendance and leave are reconciled; salary expenditure is part of the operational spend NIRF FRU reports.
- **Evidence it leaves:** Pay bill, attendance reconciliation, bank statement.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Registrar — attendance and leave certified | Registrar | 2 days | Principal |
| 2 | Finance Officer — pay bill approval | Finance Officer | 2 days | Registrar |

### Internal and external financial audit — objection settlement

- **Code:** `FINANCIAL_AUDIT_COMPLIANCE`
- **NAAC key indicator:** 6.4 Financial Management and Resource Mobilization
- **NIRF parameter:** TLR (Teaching, Learning and Resources)
- **Started by:** Internal auditor
- **Record approved:** `ComplianceReport`
- **Why it is needed:** Audit objections are replied to and settled, giving the audited statement that both frameworks ask for.
- **Evidence it leaves:** Audit report, replies to objections, settlement record, audited statements.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Finance Officer — reply to objections | Finance Officer | 10 days | Registrar |
| 2 | Registrar — settlement recorded against the audit report | Registrar | 10 days | Principal |
| 3 | Vice-Chancellor — Finance Committee adoption | Vice-Chancellor | 14 days | — |

### AQAR preparation and submission

- **Code:** `AQAR_SUBMISSION`
- **NAAC key indicator:** 6.5 Internal Quality Assurance System
- **NIRF parameter:** none
- **Started by:** IQAC Coordinator
- **Record approved:** `AQARRecord`
- **Why it is needed:** Departments submit criterion-wise data, IQAC verifies it against evidence, and the report is approved before submission to NAAC.
- **Evidence it leaves:** Department data sheets, IQAC verification sheet, approved AQAR, submission acknowledgement.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | HOD — department data submitted | HOD | 10 days | Dean |
| 2 | IQAC — data validation against evidence | IQAC Coordinator | 10 days | Principal |
| 3 | Principal — approval | Principal | 5 days | Vice-Chancellor |
| 4 | Vice-Chancellor — Governing Body adoption | Vice-Chancellor | 7 days | — |

### Academic and Administrative Audit (AAA)

- **Code:** `ACADEMIC_ADMIN_AUDIT`
- **NAAC key indicator:** 6.5 Internal Quality Assurance System
- **NIRF parameter:** none
- **Started by:** IQAC Coordinator
- **Record approved:** `ComplianceReport`
- **Why it is needed:** Departments are audited annually and each finding is closed with corrective action.
- **Evidence it leaves:** Audit schedule, audit reports, corrective-action report.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | HOD — self-assessment | HOD | 7 days | Dean |
| 2 | IQAC — audit findings | IQAC Coordinator | 10 days | Principal |
| 3 | Dean — corrective action | Dean | 10 days | Principal |
| 4 | Principal — closure | Principal | 5 days | — |

### SSR / NBA criterion data sign-off

- **Code:** `ACCREDITATION_CRITERION_SIGNOFF`
- **NAAC key indicator:** 6.5 Internal Quality Assurance System
- **NIRF parameter:** none
- **Started by:** Criterion coordinator
- **Record approved:** `AccreditationChecklist`
- **Why it is needed:** Each criterion is marked verified only after its metrics and supporting documents have been checked, ready for data validation and verification (DVV).
- **Evidence it leaves:** Criterion-wise data templates, supporting documents, DVV clarification log.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | IQAC — metric and evidence check | IQAC Coordinator | 7 days | Principal |
| 2 | Principal — sign-off | Principal | 5 days | Vice-Chancellor |

### NIRF annual data capture and submission

- **Code:** `NIRF_DATA_SUBMISSION`
- **NAAC key indicator:** 6.5 Internal Quality Assurance System
- **NIRF parameter:** TLR (Teaching, Learning and Resources), RP (Research and Professional Practice), GO (Graduation Outcomes), OI (Outreach and Inclusivity), PR (Perception)
- **Started by:** IQAC Coordinator (NIRF nodal officer)
- **Record approved:** `ComplianceReport`
- **Why it is needed:** Data for every NIRF parameter is collected from its owning office, validated, approved and submitted on the Data Capturing System, and the same figures are published on the website as NIRF requires.
- **Evidence it leaves:** Parameter-wise data sheets with source, approval note, DCS submission copy, website disclosure.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | HOD — department data | HOD | 7 days | Dean |
| 2 | IQAC — validation against source records | IQAC Coordinator | 10 days | Registrar |
| 3 | Registrar — certification | Registrar | 5 days | Pro Vice-Chancellor |
| 4 | Vice-Chancellor — approval to submit | Vice-Chancellor | 5 days | — |

### NIRF financial resources data certification (FRU)

- **Code:** `NIRF_FINANCIAL_DATA_CERTIFICATION`
- **NAAC key indicator:** 6.4 Financial Management and Resource Mobilization
- **NIRF parameter:** TLR (Teaching, Learning and Resources)
- **Started by:** Finance Officer
- **Record approved:** `JournalEntry`
- **Why it is needed:** Capital and operational expenditure for the last three years is extracted from the audited accounts under the NIRF heads and certified.
- **Evidence it leaves:** Head-wise expenditure statement, audited accounts, auditor certificate.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Finance Officer — head-wise statement | Finance Officer | 7 days | Registrar |
| 2 | Principal — certified against the audited accounts | Principal | 7 days | Registrar |
| 3 | Registrar — countersign | Registrar | 3 days | — |


## Criterion 7 — Institutional Values and Best Practices

### Gender, green, energy and environment audit — action plan

- **Code:** `GENDER_GREEN_AUDIT`
- **NAAC key indicator:** 7.1 Institutional Values and Social Responsibilities
- **NIRF parameter:** OI (Outreach and Inclusivity)
- **Started by:** IQAC Coordinator
- **Record approved:** `ComplianceItem`
- **Why it is needed:** Audits are commissioned and their recommendations adopted as a tracked action plan; accessibility measures here also support NIRF PCS.
- **Evidence it leaves:** Audit reports, action plan, photographs of facilities, policy documents.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | IQAC — audit report and recommendations | IQAC Coordinator | 10 days | Principal |
| 2 | Finance Officer — budget for measures | Finance Officer | 5 days | Registrar |
| 3 | Principal — action plan approval | Principal | 5 days | — |

### Code of conduct and professional-ethics compliance

- **Code:** `CODE_OF_CONDUCT_COMPLIANCE`
- **NAAC key indicator:** 7.1 Institutional Values and Social Responsibilities
- **NIRF parameter:** none
- **Started by:** Any stakeholder / vigilance officer
- **Record approved:** `DisciplinaryCase`
- **Why it is needed:** Breaches of the published code of conduct are examined and decided with a recorded order.
- **Evidence it leaves:** Code of conduct, complaint, inquiry report, order.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | HOD — preliminary report | HOD | 3 days | Dean |
| 2 | Dean — disciplinary committee | Dean | 7 days | Principal |
| 3 | Principal — order | Principal | 4 days | Vice-Chancellor |

### Best practice documentation

- **Code:** `BEST_PRACTICE_DOCUMENTATION`
- **NAAC key indicator:** 7.2 Best Practices
- **NIRF parameter:** PR (Perception)
- **Started by:** Department / cell coordinator
- **Record approved:** `QualityDocument`
- **Why it is needed:** Two institutional best practices are written up in the NAAC format with evidence of success and published.
- **Evidence it leaves:** Best-practice write-up in NAAC format, evidence of success, website link.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | IQAC — review against NAAC format | IQAC Coordinator | 7 days | Principal |
| 2 | Principal — approval and publication | Principal | 5 days | — |

### Institutional distinctiveness statement

- **Code:** `INSTITUTIONAL_DISTINCTIVENESS`
- **NAAC key indicator:** 7.3 Institutional Distinctiveness
- **NIRF parameter:** PR (Perception)
- **Started by:** IQAC Coordinator
- **Record approved:** `QualityDocument`
- **Why it is needed:** The institution's distinctive area is documented with performance evidence and approved by the leadership.
- **Evidence it leaves:** Distinctiveness write-up with supporting data.

| Step | Action | Role | Time allowed | Escalates to |
|---|---|---|---|---|
| 1 | Principal — review | Principal | 7 days | Vice-Chancellor |
| 2 | Vice-Chancellor — approval | Vice-Chancellor | 7 days | — |

