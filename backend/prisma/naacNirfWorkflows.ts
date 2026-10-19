/**
 * Catalogue of approval workflows required by NAAC and NIRF.
 *
 * Source: "Comprehensive ERP Blueprint for Indian Universities (NAAC/UGC/NIRF
 * Aligned)", read against the NAAC key indicators (Criteria 1–7) and the NIRF
 * parameters (TLR, RP, GO, OI, PR).
 *
 * This file is the single source for two things, so they cannot drift apart:
 *   - `prisma/seed-demo.ts` loads every entry into the workflow engine as a
 *     WorkflowDefinition with its steps;
 *   - `scripts/generate-workflow-doc.ts` renders docs/NAAC_NIRF_WORKFLOWS.md.
 *
 * `assigneeRole` values are the application's own role names, because the
 * engine authorises each step by comparing it with the caller's role.
 *
 * No step is assigned to `auditor`. That role is read-only by design — an
 * auditor who could approve would be auditing their own decisions — so where an
 * audit certificate is part of a process, the office that receives it records
 * it, and the auditor reviews the trail.
 *
 * NAAC key-indicator numbers follow the manual for universities / autonomous
 * colleges. NAAC revises its manuals, so confirm the numbering against the
 * edition the institution is being assessed under before quoting it in an SSR.
 */

export type Role =
  | 'student' | 'faculty' | 'hod' | 'dean' | 'principal' | 'registrar' | 'coe'
  | 'vice_chancellor' | 'pro_vc' | 'finance_officer' | 'iqac_coordinator'
  | 'placement_officer' | 'librarian' | 'grievance_officer' | 'security_officer'
  | 'sports_director' | 'alumni_officer' | 'auditor' | 'super_admin';

export interface WorkflowStepSpec {
  name: string;
  role: Role;
  /** Hours allowed at this step before it is overdue. */
  slaHours: number;
  /** Who it escalates to when overdue. */
  escalateTo?: Role;
}

export interface WorkflowSpec {
  code: string;
  name: string;
  /** The record the workflow approves. */
  entityType: string;
  /** NAAC criterion number, 1–7. */
  naacCriterion: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** NAAC key indicator, e.g. "2.5 Evaluation Process and Reforms". */
  naacIndicator: string;
  /** NIRF parameters this workflow produces data for. Empty when none. */
  nirf: string[];
  /** Who starts it. */
  initiatedBy: string;
  /** What the workflow is for and why the framework needs it. */
  purpose: string;
  /** The record left behind that an assessor can be shown. */
  evidence: string;
  steps: WorkflowStepSpec[];
  /** True when the application already ships this as a built-in workflow. */
  builtIn?: boolean;
}

const step = (name: string, role: Role, slaHours: number, escalateTo?: Role): WorkflowStepSpec =>
  escalateTo ? { name, role, slaHours, escalateTo } : { name, role, slaHours };

export const NAAC_CRITERIA: Record<number, string> = {
  1: 'Curricular Aspects',
  2: 'Teaching-Learning and Evaluation',
  3: 'Research, Innovations and Extension',
  4: 'Infrastructure and Learning Resources',
  5: 'Student Support and Progression',
  6: 'Governance, Leadership and Management',
  7: 'Institutional Values and Best Practices'
};

export const NIRF_PARAMETERS: Record<string, string> = {
  TLR: 'Teaching, Learning and Resources',
  RP: 'Research and Professional Practice',
  GO: 'Graduation Outcomes',
  OI: 'Outreach and Inclusivity',
  PR: 'Perception'
};

export const WORKFLOWS: WorkflowSpec[] = [
  // ── Criterion 1: Curricular Aspects ───────────────────────────────────────
  {
    code: 'CURRICULUM_PROPOSAL', builtIn: true,
    name: 'Curriculum design and revision',
    entityType: 'CurriculumProposal', naacCriterion: 1,
    naacIndicator: '1.1 Curriculum Design and Development', nirf: [],
    initiatedBy: 'Faculty member / Board of Studies',
    purpose: 'A department proposes a syllabus change, the Board of Studies reviews it and the Dean approves it, so every revision is traceable to the body that approved it.',
    evidence: 'Approved proposal, BoS and Academic Council minutes, syllabus version history.',
    steps: [step('Dean approval', 'dean', 168, 'vice_chancellor')]
  },
  {
    code: 'NEW_PROGRAMME_INTRODUCTION',
    name: 'Introduction of a new programme or course',
    entityType: 'Programme', naacCriterion: 1,
    naacIndicator: '1.2 Academic Flexibility', nirf: ['TLR'],
    initiatedBy: 'Head of Department',
    purpose: 'New programmes, electives and CBCS options are approved before intake is sanctioned, which is what NAAC counts under academic flexibility.',
    evidence: 'Programme proposal, need analysis, statutory approval letters, sanctioned intake.',
    steps: [
      step('Dean — academic need and resources', 'dean', 168, 'principal'),
      step('Registrar — Academic Council agenda', 'registrar', 168, 'pro_vc'),
      step('Finance Officer — financial viability', 'finance_officer', 120, 'registrar'),
      step('Vice-Chancellor — final sanction', 'vice_chancellor', 240)
    ]
  },
  {
    code: 'VALUE_ADDED_COURSE_APPROVAL',
    name: 'Value-added / certificate course approval',
    entityType: 'Course', naacCriterion: 1,
    naacIndicator: '1.3 Curriculum Enrichment', nirf: [],
    initiatedBy: 'Faculty member',
    purpose: 'Add-on, certificate and skill courses are approved with their hours and outcomes, and enrolment is recorded for the enrichment metric.',
    evidence: 'Course brochure, approval note, list of students enrolled and completing.',
    steps: [step('HOD recommendation', 'hod', 72, 'dean'), step('Dean approval', 'dean', 96, 'principal'), step('IQAC — record for AQAR', 'iqac_coordinator', 72)]
  },
  {
    code: 'STAKEHOLDER_FEEDBACK_ACTION',
    name: 'Stakeholder feedback on curriculum — analysis and action taken',
    entityType: 'FeedbackForm', naacCriterion: 1,
    naacIndicator: '1.4 Feedback System', nirf: ['PR'],
    initiatedBy: 'IQAC Coordinator',
    purpose: 'Feedback from students, teachers, employers and alumni is collected, analysed, and closed with an action-taken report — NAAC scores the action, not the collection.',
    evidence: 'Feedback forms, analysis report, action-taken report hosted on the website.',
    steps: [step('HOD — analysis and proposed action', 'hod', 168, 'dean'), step('Dean — action plan approval', 'dean', 120, 'principal'), step('IQAC — action-taken report sign-off', 'iqac_coordinator', 120, 'principal')]
  },
  {
    code: 'ACADEMIC_CALENDAR_APPROVAL',
    name: 'Academic calendar approval',
    entityType: 'AcademicYear', naacCriterion: 1,
    naacIndicator: '1.1 Curriculum Design and Development', nirf: [],
    initiatedBy: 'Registrar office',
    purpose: 'Teaching days, internal assessment windows, examinations and result dates are fixed and published before the term begins.',
    evidence: 'Published academic calendar and its adherence report.',
    steps: [step('Dean Academics review', 'dean', 96, 'principal'), step('Controller of Examinations — exam dates', 'coe', 72, 'registrar'), step('Principal approval and publication', 'principal', 96, 'vice_chancellor')]
  },

  // ── Criterion 2: Teaching-Learning and Evaluation ─────────────────────────
  {
    code: 'ADMISSION_SEAT_ALLOTMENT',
    name: 'Admission and reserved-category seat allotment',
    entityType: 'AdmissionApplication', naacCriterion: 2,
    naacIndicator: '2.1 Student Enrolment and Profile', nirf: ['TLR', 'OI'],
    initiatedBy: 'Admissions office',
    purpose: 'Seats are offered against the sanctioned intake and the statutory reservation roster; filled-versus-sanctioned and category-wise counts feed both frameworks.',
    evidence: 'Seat matrix, merit list, category-wise admission register, offer letters.',
    steps: [step('Document verification', 'registrar', 72, 'principal'), step('Finance — fee realisation', 'finance_officer', 48, 'registrar'), step('Principal — admission confirmation', 'principal', 72)]
  },
  {
    code: 'TIMETABLE_WORKLOAD_APPROVAL',
    name: 'Faculty workload and timetable approval',
    // The HOD raises the change (timetable slot or subject allocation) from
    // Workload & Timetable, so an "HOD approval" step would be the HOD
    // approving their own request. The Dean approves; it is applied then.
    entityType: 'TimetableChange', naacCriterion: 2,
    naacIndicator: '2.2 Student Teacher Ratio', nirf: ['TLR'],
    initiatedBy: 'HOD',
    purpose: 'Teaching load is allotted within the workload norms and the timetable is frozen, giving a defensible student-teacher ratio.',
    evidence: 'Workload statement per faculty member, approved timetable.',
    steps: [step('Dean approval', 'dean', 72, 'principal')]
  },
  {
    code: 'LESSON_PLAN_APPROVAL',
    name: 'Lesson plan approval and syllabus-coverage review',
    entityType: 'FacultyLessonPlan', naacCriterion: 2,
    naacIndicator: '2.3 Teaching-Learning Process', nirf: [],
    initiatedBy: 'Faculty member',
    purpose: 'Each course has an approved teaching plan mapped to course outcomes, and coverage is reviewed mid-term so shortfalls are corrected in time.',
    evidence: 'Lesson plans, course files, coverage review reports.',
    steps: [step('HOD — plan approval', 'hod', 72, 'dean'), step('Dean — coverage review', 'dean', 168, 'principal')]
  },
  {
    code: 'MENTOR_LEARNER_SUPPORT',
    name: 'Slow / advanced learner identification and mentoring',
    entityType: 'MenteeAssignment', naacCriterion: 2,
    naacIndicator: '2.3 Teaching-Learning Process', nirf: ['GO'],
    initiatedBy: 'Faculty mentor',
    purpose: 'Learners are identified from attendance and marks, assigned a mentor, and given remedial or enrichment support with the outcome recorded.',
    evidence: 'Mentor-mentee lists, counselling notes, remedial class registers.',
    steps: [step('HOD — support plan approval', 'hod', 96, 'dean'), step('Dean — outcome review', 'dean', 168)]
  },
  {
    code: 'FACULTY_QUALIFICATION_VERIFICATION',
    name: 'Faculty qualification and experience verification',
    entityType: 'FacultyProfile', naacCriterion: 2,
    naacIndicator: '2.4 Teacher Profile and Quality', nirf: ['TLR'],
    initiatedBy: 'Faculty member / HR',
    purpose: 'Ph.D. and experience claims are verified against certificates before they are counted, because NIRF FQE and NAAC 2.4 are both checked in data validation.',
    evidence: 'Verified degree certificates, experience letters, appointment orders.',
    steps: [step('HOD — document check', 'hod', 96, 'dean'), step('Registrar — verification and lock', 'registrar', 120, 'principal')]
  },
  {
    code: 'ATTENDANCE_CONDONATION',
    name: 'Attendance shortage condonation',
    entityType: 'ExamRegistration', naacCriterion: 2,
    naacIndicator: '2.5 Evaluation Process and Reforms', nirf: [],
    initiatedBy: 'Student',
    purpose: 'A student below the attendance threshold is admitted to an examination only on a recorded decision with a reason, never by silently editing the register.',
    evidence: 'Condonation application, medical or other proof, signed order.',
    steps: [step('Class teacher recommendation', 'faculty', 48, 'hod'), step('HOD recommendation', 'hod', 48, 'dean'), step('Dean / Principal sanction', 'dean', 72, 'principal'), step('CoE — eligibility update', 'coe', 24)]
  },
  {
    code: 'INTERNAL_MARKS_LOCK',
    name: 'Internal assessment marks verification and lock',
    entityType: 'Enrollment', naacCriterion: 2,
    naacIndicator: '2.5 Evaluation Process and Reforms', nirf: [],
    initiatedBy: 'Faculty member',
    purpose: 'Internal marks are verified by the HOD and locked before they reach the examination branch, so later changes need a recorded reason.',
    evidence: 'Signed internal marks statements and the change log.',
    steps: [step('HOD verification and lock', 'hod', 72, 'dean'), step('CoE acceptance', 'coe', 48, 'registrar')]
  },
  {
    code: 'RESULT_PUBLICATION', builtIn: true,
    name: 'Result moderation and publication',
    entityType: 'Department', naacCriterion: 2,
    naacIndicator: '2.6 Student Performance and Learning Outcomes', nirf: ['GO'],
    initiatedBy: 'Controller of Examinations',
    purpose: 'Results are released only after sign-off, and the pass percentage that results is the figure reported under NAAC 2.6 and NIRF GUE.',
    evidence: 'Moderation committee minutes, result notification, pass-percentage statement.',
    steps: [step('Dean publication', 'dean', 72)]
  },
  {
    code: 'REVALUATION_REQUEST',
    name: 'Revaluation / re-totalling request',
    entityType: 'RevaluationRequest', naacCriterion: 2,
    naacIndicator: '2.5 Evaluation Process and Reforms', nirf: [],
    initiatedBy: 'Student',
    purpose: 'Examination grievances are handled transparently and within a time limit, with any change of marks recorded against the original.',
    evidence: 'Revaluation applications, fee receipts, revised marks orders, grade history.',
    steps: [step('Finance — revaluation fee', 'finance_officer', 24, 'coe'), step('CoE — assign second evaluator', 'coe', 72, 'registrar'), step('CoE — approve revised result', 'coe', 120, 'registrar')]
  },
  {
    code: 'OBE_ATTAINMENT_REVIEW',
    name: 'CO-PO attainment review (Outcome-Based Education)',
    entityType: 'Course', naacCriterion: 2,
    naacIndicator: '2.6 Student Performance and Learning Outcomes', nirf: ['GO'],
    initiatedBy: 'Course coordinator',
    purpose: 'Course and programme outcome attainment is computed, compared with targets, and gaps are closed with a documented action plan (also required for NBA).',
    evidence: 'CO-PO mapping, attainment sheets, gap analysis and action plan.',
    steps: [step('HOD — attainment validation', 'hod', 120, 'dean'), step('Dean — action plan approval', 'dean', 120, 'principal'), step('IQAC — record and follow-up', 'iqac_coordinator', 168)]
  },
  {
    code: 'STUDENT_SATISFACTION_SURVEY',
    name: 'Student Satisfaction Survey (SSS)',
    entityType: 'FeedbackForm', naacCriterion: 2,
    naacIndicator: '2.7 Student Satisfaction Survey', nirf: ['PR'],
    initiatedBy: 'IQAC Coordinator',
    purpose: 'The student database is certified and shared, the survey is run, and results are acted upon.',
    evidence: 'Certified student list, survey responses, analysis and action-taken report.',
    steps: [step('Registrar — certify student database', 'registrar', 96, 'principal'), step('IQAC — analysis report', 'iqac_coordinator', 168, 'principal'), step('Principal — action plan', 'principal', 168)]
  },

  // ── Criterion 3: Research, Innovations and Extension ──────────────────────
  {
    code: 'RESEARCH_PROJECT_SANCTION',
    name: 'Research project proposal and seed-grant sanction',
    entityType: 'ResearchProject', naacCriterion: 3,
    naacIndicator: '3.1 Promotion of Research and Facilities', nirf: ['RP'],
    initiatedBy: 'Faculty member (Principal Investigator)',
    purpose: 'Internal seed money and externally funded projects are sanctioned with a budget head, so funding received and spent is traceable per project.',
    evidence: 'Proposal, sanction order, budget, utilisation certificate.',
    steps: [step('HOD recommendation', 'hod', 96, 'dean'), step('Dean (Research) approval', 'dean', 120, 'pro_vc'), step('Finance Officer — budget head', 'finance_officer', 96, 'registrar'), step('Vice-Chancellor sanction', 'vice_chancellor', 168)]
  },
  {
    code: 'RESEARCH_GRANT_UTILISATION',
    name: 'Research grant utilisation and closure',
    entityType: 'ResearchProject', naacCriterion: 3,
    naacIndicator: '3.2 Resource Mobilization for Research', nirf: ['RP'],
    initiatedBy: 'Principal Investigator',
    purpose: 'Expenditure against each grant is certified and the project is closed with a utilisation certificate; NIRF FPPP counts the amounts.',
    evidence: 'Statement of expenditure, audited utilisation certificate, completion report.',
    steps: [step('Finance Officer — statement of expenditure', 'finance_officer', 120, 'registrar'), step('Registrar — audited utilisation certificate recorded', 'registrar', 168, 'principal'), step('Dean (Research) — closure', 'dean', 96)]
  },
  {
    code: 'INNOVATION_IPR_FILING',
    name: 'Patent / IPR filing and start-up incubation approval',
    entityType: 'Patent', naacCriterion: 3,
    naacIndicator: '3.3 Innovation Ecosystem', nirf: ['RP'],
    initiatedBy: 'Faculty member / student innovator',
    purpose: 'Patent filings and incubation support are approved and their status (filed, published, granted) tracked for the IPR metric.',
    evidence: 'Invention disclosure, filing receipts, grant certificates.',
    steps: [step('HOD recommendation', 'hod', 96, 'dean'), step('Dean (Research) — IPR cell review', 'dean', 168, 'pro_vc'), step('Finance Officer — filing fee', 'finance_officer', 72, 'registrar')]
  },
  {
    code: 'PUBLICATION_VERIFICATION',
    name: 'Research publication verification',
    entityType: 'Publication', naacCriterion: 3,
    naacIndicator: '3.4 Research Publications and Awards', nirf: ['RP'],
    initiatedBy: 'Faculty member',
    purpose: 'Each paper is checked for indexing (Scopus / Web of Science / UGC-CARE) before it is counted, since both frameworks cross-check publications externally.',
    evidence: 'Paper, DOI, indexing proof, plagiarism report.',
    steps: [step('HOD — indexing and affiliation check', 'hod', 96, 'dean'), step('IQAC — verification and lock', 'iqac_coordinator', 120, 'dean')]
  },
  {
    code: 'CONSULTANCY_APPROVAL',
    name: 'Consultancy and corporate-training approval',
    entityType: 'ResearchProject', naacCriterion: 3,
    naacIndicator: '3.5 Consultancy', nirf: ['RP'],
    initiatedBy: 'Faculty member',
    purpose: 'Consultancy assignments are approved under the revenue-sharing policy and the revenue generated is recorded.',
    evidence: 'Consultancy agreement, invoices, revenue-sharing statement.',
    steps: [step('HOD recommendation', 'hod', 72, 'dean'), step('Dean approval', 'dean', 96, 'principal'), step('Finance Officer — revenue sharing', 'finance_officer', 96, 'registrar')]
  },
  {
    code: 'EXTENSION_ACTIVITY_APPROVAL',
    name: 'Extension and outreach activity approval (NSS / NCC / community)',
    entityType: 'InterDeptEvent', naacCriterion: 3,
    naacIndicator: '3.6 Extension Activities', nirf: ['OI'],
    initiatedBy: 'Programme officer / faculty coordinator',
    purpose: 'Outreach programmes are approved, conducted and reported with participant numbers.',
    evidence: 'Activity proposal, attendance, geotagged photographs, report.',
    steps: [step('HOD recommendation', 'hod', 72, 'dean'), step('Dean (Student Welfare) approval', 'dean', 72, 'principal'), step('IQAC — activity report', 'iqac_coordinator', 168)]
  },
  {
    code: 'MOU_COLLABORATION_APPROVAL',
    name: 'MoU and collaboration approval',
    entityType: 'AdminDocument', naacCriterion: 3,
    naacIndicator: '3.7 Collaboration', nirf: ['RP', 'PR'],
    initiatedBy: 'Head of Department / Placement Officer',
    purpose: 'MoUs are vetted and signed, then tracked by the activities actually conducted under them — NAAC counts functional MoUs only.',
    evidence: 'Signed MoU, list of activities and beneficiaries under it.',
    steps: [step('Dean — academic value', 'dean', 120, 'principal'), step('Registrar — legal vetting', 'registrar', 168, 'pro_vc'), step('Vice-Chancellor — signing authority', 'vice_chancellor', 168)]
  },

  // ── Criterion 4: Infrastructure and Learning Resources ────────────────────
  {
    code: 'PURCHASE_REQUEST', builtIn: true,
    name: 'Purchase indent and procurement',
    entityType: 'PurchaseRequest', naacCriterion: 4,
    naacIndicator: '4.1 Physical Facilities', nirf: ['TLR'],
    initiatedBy: 'Lab staff / faculty member',
    purpose: 'A department raises a purchase request, the HOD endorses it and the Dean sanctions the spend; the capital expenditure is what NIRF FRU and NAAC 4.1 report.',
    evidence: 'Indent, quotations, comparative statement, purchase order, stock entry.',
    steps: [step('Dean sanction', 'dean', 120, 'principal')]
  },
  {
    code: 'LIBRARY_ACQUISITION',
    name: 'Library book / e-resource acquisition',
    entityType: 'LibraryBook', naacCriterion: 4,
    naacIndicator: '4.2 Library as a Learning Resource', nirf: ['TLR'],
    initiatedBy: 'Faculty member',
    purpose: 'Recommended titles and subscriptions are approved against the library budget, and annual library expenditure is recorded.',
    evidence: 'Recommendation list, library committee minutes, invoices, accession register.',
    steps: [step('HOD recommendation', 'hod', 72, 'dean'), step('Librarian — availability and budget', 'librarian', 96, 'principal'), step('Finance Officer — purchase sanction', 'finance_officer', 96, 'registrar')]
  },
  {
    code: 'IT_INFRASTRUCTURE_UPGRADE',
    name: 'IT infrastructure upgrade request',
    entityType: 'PurchaseRequest', naacCriterion: 4,
    naacIndicator: '4.3 IT Infrastructure', nirf: ['TLR'],
    initiatedBy: 'System administrator / HOD',
    purpose: 'Computers, bandwidth and software are upgraded on an approved plan, keeping the student-computer ratio and bandwidth figures current.',
    evidence: 'IT policy, upgrade plan, purchase records, bandwidth bills.',
    steps: [step('IT administrator — technical specification', 'super_admin', 96, 'registrar'), step('Finance Officer — budget availability', 'finance_officer', 96, 'registrar'), step('Principal sanction', 'principal', 120, 'vice_chancellor')]
  },
  {
    code: 'MAINTENANCE_REQUEST',
    name: 'Maintenance and repair request',
    entityType: 'LabInventoryItem', naacCriterion: 4,
    naacIndicator: '4.4 Maintenance of Campus Infrastructure', nirf: ['TLR'],
    initiatedBy: 'Lab assistant / faculty member / hostel warden',
    purpose: 'Faults are reported, sanctioned and closed, with maintenance expenditure captured against the right head.',
    evidence: 'Complaint register, work orders, maintenance expenditure statement.',
    steps: [step('HOD approval', 'hod', 48, 'dean'), step('Finance Officer — sanction', 'finance_officer', 72, 'registrar')]
  },
  {
    code: 'DEPARTMENT_BUDGET_ALLOCATION',
    name: 'Department budget allocation and utilisation review',
    entityType: 'DepartmentBudget', naacCriterion: 4,
    naacIndicator: '4.4 Maintenance of Campus Infrastructure', nirf: ['TLR'],
    initiatedBy: 'Head of Department',
    purpose: 'Annual budgets are proposed, allocated and monitored against utilisation.',
    evidence: 'Budget proposal, allocation order, utilisation statement.',
    steps: [step('Dean recommendation', 'dean', 120, 'principal'), step('Finance Officer — allocation', 'finance_officer', 120, 'registrar'), step('Vice-Chancellor — Finance Committee approval', 'vice_chancellor', 240)]
  },

  // ── Criterion 5: Student Support and Progression ──────────────────────────
  {
    code: 'SCHOLARSHIP_FEE_WAIVER',
    name: 'Scholarship and fee-waiver sanction',
    entityType: 'FeeWaiverRequest', naacCriterion: 5,
    naacIndicator: '5.1 Student Support', nirf: ['OI'],
    initiatedBy: 'Student',
    purpose: 'Government and institutional scholarships and freeships are sanctioned with a reason; the number of beneficiaries and amounts feed NAAC 5.1 and NIRF ESCS.',
    evidence: 'Applications, income / category certificates, sanction orders, disbursement list.',
    steps: [step('HOD recommendation', 'hod', 72, 'dean'), step('Dean (Student Welfare) recommendation', 'dean', 96, 'principal'), step('Finance Officer — sanction', 'finance_officer', 96, 'registrar')]
  },
  {
    code: 'CAPACITY_BUILDING_PROGRAMME',
    name: 'Capacity-building and skill-enhancement programme approval',
    entityType: 'TrainingSession', naacCriterion: 5,
    naacIndicator: '5.1 Student Support', nirf: ['GO'],
    initiatedBy: 'Placement Officer / faculty coordinator',
    purpose: 'Soft-skill, language, ICT and competitive-examination coaching programmes are approved and their participation recorded.',
    evidence: 'Programme schedule, attendance, feedback, list of students benefited.',
    steps: [step('Placement Officer — programme plan', 'placement_officer', 72, 'dean'), step('Dean approval', 'dean', 96, 'principal')]
  },
  {
    code: 'GRIEVANCE_REDRESSAL',
    name: 'Student grievance redressal',
    entityType: 'GrievanceCase', naacCriterion: 5,
    naacIndicator: '5.1 Student Support', nirf: [],
    initiatedBy: 'Student / staff member',
    purpose: 'Every complaint is acknowledged, routed and resolved within a time limit, escalating automatically when it is not — as UGC regulations require.',
    evidence: 'Grievance register, committee minutes, resolution note, time taken.',
    steps: [step('Grievance Officer — acknowledge and route', 'grievance_officer', 24, 'registrar'), step('HOD / office concerned — resolution', 'hod', 120, 'dean'), step('Grievance Officer — closure with complainant', 'grievance_officer', 72, 'registrar')]
  },
  {
    code: 'ANTI_RAGGING_COMPLAINT',
    name: 'Anti-ragging complaint',
    entityType: 'DisciplinaryCase', naacCriterion: 5,
    naacIndicator: '5.1 Student Support', nirf: [],
    initiatedBy: 'Student / warden / anti-ragging squad',
    purpose: 'Complaints are investigated by the Anti-Ragging Committee within the period fixed by the UGC regulations and the action taken is recorded.',
    evidence: 'Complaint, squad report, committee minutes, order, report to authorities.',
    steps: [step('Security Officer — immediate report', 'security_officer', 12, 'principal'), step('Dean (Student Welfare) — committee inquiry', 'dean', 72, 'principal'), step('Principal — order', 'principal', 48, 'vice_chancellor')]
  },
  {
    code: 'ICC_COMPLAINT',
    name: 'Internal Complaints Committee (sexual harassment) complaint',
    entityType: 'GrievanceCase', naacCriterion: 5,
    naacIndicator: '5.1 Student Support', nirf: ['OI'],
    initiatedBy: 'Complainant (identity restricted to the committee)',
    purpose: 'Complaints are handled confidentially by the ICC within statutory timelines.',
    evidence: 'Restricted-access case file, ICC report, action-taken record, annual return.',
    steps: [step('Grievance Officer — refer to ICC', 'grievance_officer', 24, 'principal'), step('Principal — action on ICC report', 'principal', 240, 'vice_chancellor')]
  },
  {
    code: 'PLACEMENT_DRIVE_APPROVAL',
    name: 'Campus placement drive and offer recording',
    entityType: 'PlacementDrive', naacCriterion: 5,
    naacIndicator: '5.2 Student Progression', nirf: ['GO'],
    initiatedBy: 'Placement Officer',
    purpose: 'Drives are approved, and every offer is recorded with its package and proof; the placement count and median salary are the NIRF GPH and GMS figures.',
    evidence: 'Drive notification, attendance, offer letters, salary statement.',
    steps: [step('Dean — drive approval', 'dean', 48, 'principal'), step('Placement Officer — offers and proof uploaded', 'placement_officer', 168, 'dean'), step('IQAC — outcome data verified', 'iqac_coordinator', 120)]
  },
  {
    code: 'HIGHER_STUDIES_PROGRESSION',
    name: 'Higher-studies and competitive-examination progression record',
    entityType: 'ProgressionSurvey', naacCriterion: 5,
    naacIndicator: '5.2 Student Progression', nirf: ['GO'],
    initiatedBy: 'Graduating student / alumni officer',
    purpose: 'Admissions to postgraduate programmes and qualification in GATE, GRE, CAT and similar examinations are captured with proof.',
    evidence: 'Admission letters, scorecards, progression register.',
    steps: [step('Alumni Officer — collect proof', 'alumni_officer', 168, 'dean'), step('HOD — verification', 'hod', 96, 'dean'), step('IQAC — lock for reporting', 'iqac_coordinator', 120)]
  },
  {
    code: 'STUDENT_ACTIVITY_PARTICIPATION',
    name: 'Sports and cultural participation and awards',
    entityType: 'SportsEvent', naacCriterion: 5,
    naacIndicator: '5.3 Student Participation and Activities', nirf: [],
    initiatedBy: 'Student / team coach',
    purpose: 'Participation in inter-university and national events is sanctioned (with on-duty attendance) and awards are recorded.',
    evidence: 'Sanction order, on-duty list, certificates and medals.',
    steps: [step('Sports Director recommendation', 'sports_director', 48, 'dean'), step('HOD — on-duty attendance', 'hod', 48, 'dean'), step('Dean (Student Welfare) sanction', 'dean', 72)]
  },
  {
    code: 'CERTIFICATE_ISSUE',
    name: 'Certificate issue (bonafide / transfer / transcript / degree)',
    entityType: 'CertificateRequest', naacCriterion: 5,
    naacIndicator: '5.1 Student Support', nirf: [],
    initiatedBy: 'Student / alumnus',
    purpose: 'Requests are cleared for dues and issued from verified records within a service-level time.',
    evidence: 'Request, no-dues clearance, issue register.',
    steps: [step('Finance — no-dues clearance', 'finance_officer', 48, 'registrar'), step('HOD verification', 'hod', 48, 'dean'), step('Registrar — issue', 'registrar', 72)]
  },
  {
    code: 'ALUMNI_ENGAGEMENT',
    name: 'Alumni registration, contribution and engagement',
    entityType: 'Donation', naacCriterion: 5,
    naacIndicator: '5.4 Alumni Engagement', nirf: ['PR'],
    initiatedBy: 'Alumnus / Alumni Officer',
    purpose: 'Alumni profiles are verified and financial or other contributions are receipted and acknowledged.',
    evidence: 'Alumni association registration, contribution receipts, event reports.',
    steps: [step('Alumni Officer — profile verification', 'alumni_officer', 96, 'dean'), step('Finance Officer — receipt of contribution', 'finance_officer', 72, 'registrar')]
  },

  // ── Criterion 6: Governance, Leadership and Management ────────────────────
  {
    code: 'COMMITTEE_MEETING_ATR',
    name: 'Statutory body meeting — agenda, minutes and action-taken report',
    entityType: 'CommitteeMeeting', naacCriterion: 6,
    naacIndicator: '6.1 Institutional Vision and Leadership', nirf: [],
    initiatedBy: 'Member secretary of the body',
    purpose: 'Governing Body, Academic Council, Finance Committee, BoS and IQAC meetings leave an agenda, approved minutes and a closed action-taken report.',
    evidence: 'Notice, agenda, attendance, minutes, action-taken report.',
    steps: [step('Registrar — circulate agenda', 'registrar', 72, 'principal'), step('Chairperson — approve minutes', 'principal', 168, 'vice_chancellor'), step('IQAC — action-taken report', 'iqac_coordinator', 336)]
  },
  {
    code: 'POLICY_APPROVAL',
    name: 'Institutional policy and strategic-plan approval',
    entityType: 'InstitutionalPolicy', naacCriterion: 6,
    naacIndicator: '6.2 Strategy Development and Deployment', nirf: [],
    initiatedBy: 'Drafting committee / office concerned',
    purpose: 'Policies and the perspective plan are approved by the competent body, versioned and published.',
    evidence: 'Policy document with version, approving body resolution, publication link.',
    steps: [step('IQAC — quality review', 'iqac_coordinator', 120, 'principal'), step('Registrar — statutory vetting', 'registrar', 120, 'pro_vc'), step('Vice-Chancellor — approval', 'vice_chancellor', 168)]
  },
  {
    code: 'FACULTY_LEAVE',
    name: 'Faculty leave and on-duty approval',
    entityType: 'LeaveRequest', naacCriterion: 6,
    naacIndicator: '6.2 Strategy Development and Deployment', nirf: [],
    initiatedBy: 'Faculty member',
    purpose: 'Leave follows the delegation of powers — faculty to HOD to Dean to Registrar — with class adjustment recorded.',
    evidence: 'Leave application, alternate-arrangement note, sanction.',
    steps: [step('HOD — sanction / forward', 'hod', 24, 'dean'), step('Dean — extended leave', 'dean', 48, 'registrar'), step('Registrar — service record', 'registrar', 72)]
  },
  {
    code: 'FACULTY_RECRUITMENT',
    name: 'Faculty recruitment',
    entityType: 'FacultyRecruitment', naacCriterion: 6,
    naacIndicator: '6.2 Strategy Development and Deployment', nirf: ['TLR'],
    initiatedBy: 'Head of Department',
    purpose: 'Vacancies are sanctioned, advertised and filled through a selection committee as per UGC / AICTE norms, protecting the faculty-student ratio.',
    evidence: 'Vacancy statement, advertisement, selection committee minutes, appointment order.',
    steps: [step('Dean — vacancy justification', 'dean', 96, 'principal'), step('Registrar — roster and advertisement', 'registrar', 168, 'pro_vc'), step('Finance Officer — post sanction', 'finance_officer', 96, 'registrar'), step('Vice-Chancellor — appointment', 'vice_chancellor', 168)]
  },
  {
    code: 'FACULTY_APPRAISAL',
    name: 'Faculty performance appraisal (PBAS / API)',
    entityType: 'FacultyProfile', naacCriterion: 6,
    naacIndicator: '6.3 Faculty Empowerment Strategies', nirf: [],
    initiatedBy: 'Faculty member (self-appraisal)',
    purpose: 'Self-appraisal is scored against teaching, research and service, combining student feedback and results.',
    evidence: 'Self-appraisal forms, API scores, feedback summary, review remarks.',
    steps: [step('HOD — review', 'hod', 168, 'dean'), step('Dean — review', 'dean', 168, 'principal'), step('IQAC — API score verification', 'iqac_coordinator', 168, 'principal'), step('Principal — acceptance', 'principal', 168)]
  },
  {
    code: 'FACULTY_PROMOTION_CAS',
    name: 'Faculty promotion (Career Advancement Scheme)',
    entityType: 'PromotionRequest', naacCriterion: 6,
    naacIndicator: '6.3 Faculty Empowerment Strategies', nirf: ['TLR'],
    initiatedBy: 'Faculty member',
    purpose: 'Promotion applications are screened against the eligibility norms and decided by a selection committee.',
    evidence: 'Application, screening committee report, selection minutes, promotion order.',
    steps: [step('HOD recommendation', 'hod', 120, 'dean'), step('Dean recommendation', 'dean', 120, 'registrar'), step('Registrar — screening committee', 'registrar', 240, 'pro_vc'), step('Vice-Chancellor — order', 'vice_chancellor', 240)]
  },
  {
    code: 'FDP_FINANCIAL_SUPPORT',
    name: 'Financial support for conferences, FDPs and professional bodies',
    entityType: 'TrainingSession', naacCriterion: 6,
    naacIndicator: '6.3 Faculty Empowerment Strategies', nirf: [],
    initiatedBy: 'Faculty member',
    purpose: 'Support to attend conferences and development programmes is sanctioned and the number of teachers supported is counted.',
    evidence: 'Application, sanction order, participation certificate, settlement of advance.',
    steps: [step('HOD recommendation', 'hod', 72, 'dean'), step('Dean approval', 'dean', 72, 'principal'), step('Finance Officer — sanction and settlement', 'finance_officer', 96, 'registrar')]
  },
  {
    code: 'PAYROLL_APPROVAL',
    name: 'Monthly payroll approval',
    entityType: 'PayrollRecord', naacCriterion: 6,
    naacIndicator: '6.4 Financial Management and Resource Mobilization', nirf: ['TLR'],
    initiatedBy: 'Accounts section',
    purpose: 'Salaries are released after attendance and leave are reconciled; salary expenditure is part of the operational spend NIRF FRU reports.',
    evidence: 'Pay bill, attendance reconciliation, bank statement.',
    steps: [step('Registrar — attendance and leave certified', 'registrar', 48, 'principal'), step('Finance Officer — pay bill approval', 'finance_officer', 48, 'registrar')]
  },
  {
    code: 'FINANCIAL_AUDIT_COMPLIANCE',
    name: 'Internal and external financial audit — objection settlement',
    entityType: 'ComplianceReport', naacCriterion: 6,
    naacIndicator: '6.4 Financial Management and Resource Mobilization', nirf: ['TLR'],
    initiatedBy: 'Internal auditor',
    purpose: 'Audit objections are replied to and settled, giving the audited statement that both frameworks ask for.',
    evidence: 'Audit report, replies to objections, settlement record, audited statements.',
    steps: [step('Finance Officer — reply to objections', 'finance_officer', 240, 'registrar'), step('Registrar — settlement recorded against the audit report', 'registrar', 240, 'principal'), step('Vice-Chancellor — Finance Committee adoption', 'vice_chancellor', 336)]
  },
  {
    code: 'AQAR_SUBMISSION',
    name: 'AQAR preparation and submission',
    entityType: 'AQARRecord', naacCriterion: 6,
    naacIndicator: '6.5 Internal Quality Assurance System', nirf: [],
    initiatedBy: 'IQAC Coordinator',
    purpose: 'Departments submit criterion-wise data, IQAC verifies it against evidence, and the report is approved before submission to NAAC.',
    evidence: 'Department data sheets, IQAC verification sheet, approved AQAR, submission acknowledgement.',
    steps: [step('HOD — department data submitted', 'hod', 240, 'dean'), step('IQAC — data validation against evidence', 'iqac_coordinator', 240, 'principal'), step('Principal — approval', 'principal', 120, 'vice_chancellor'), step('Vice-Chancellor — Governing Body adoption', 'vice_chancellor', 168)]
  },
  {
    code: 'ACADEMIC_ADMIN_AUDIT',
    name: 'Academic and Administrative Audit (AAA)',
    entityType: 'ComplianceReport', naacCriterion: 6,
    naacIndicator: '6.5 Internal Quality Assurance System', nirf: [],
    initiatedBy: 'IQAC Coordinator',
    purpose: 'Departments are audited annually and each finding is closed with corrective action.',
    evidence: 'Audit schedule, audit reports, corrective-action report.',
    steps: [step('HOD — self-assessment', 'hod', 168, 'dean'), step('IQAC — audit findings', 'iqac_coordinator', 240, 'principal'), step('Dean — corrective action', 'dean', 240, 'principal'), step('Principal — closure', 'principal', 120)]
  },
  {
    code: 'ACCREDITATION_CRITERION_SIGNOFF',
    name: 'SSR / NBA criterion data sign-off',
    entityType: 'AccreditationChecklist', naacCriterion: 6,
    naacIndicator: '6.5 Internal Quality Assurance System', nirf: [],
    initiatedBy: 'Criterion coordinator',
    purpose: 'Each criterion is marked verified only after its metrics and supporting documents have been checked, ready for data validation and verification (DVV).',
    evidence: 'Criterion-wise data templates, supporting documents, DVV clarification log.',
    steps: [step('IQAC — metric and evidence check', 'iqac_coordinator', 168, 'principal'), step('Principal — sign-off', 'principal', 120, 'vice_chancellor')]
  },

  // ── Criterion 7: Institutional Values and Best Practices ──────────────────
  {
    code: 'GENDER_GREEN_AUDIT',
    name: 'Gender, green, energy and environment audit — action plan',
    entityType: 'ComplianceItem', naacCriterion: 7,
    naacIndicator: '7.1 Institutional Values and Social Responsibilities', nirf: ['OI'],
    initiatedBy: 'IQAC Coordinator',
    purpose: 'Audits are commissioned and their recommendations adopted as a tracked action plan; accessibility measures here also support NIRF PCS.',
    evidence: 'Audit reports, action plan, photographs of facilities, policy documents.',
    steps: [step('IQAC — audit report and recommendations', 'iqac_coordinator', 240, 'principal'), step('Finance Officer — budget for measures', 'finance_officer', 120, 'registrar'), step('Principal — action plan approval', 'principal', 120)]
  },
  {
    code: 'CODE_OF_CONDUCT_COMPLIANCE',
    name: 'Code of conduct and professional-ethics compliance',
    entityType: 'DisciplinaryCase', naacCriterion: 7,
    naacIndicator: '7.1 Institutional Values and Social Responsibilities', nirf: [],
    initiatedBy: 'Any stakeholder / vigilance officer',
    purpose: 'Breaches of the published code of conduct are examined and decided with a recorded order.',
    evidence: 'Code of conduct, complaint, inquiry report, order.',
    steps: [step('HOD — preliminary report', 'hod', 72, 'dean'), step('Dean — disciplinary committee', 'dean', 168, 'principal'), step('Principal — order', 'principal', 96, 'vice_chancellor')]
  },
  {
    code: 'BEST_PRACTICE_DOCUMENTATION',
    name: 'Best practice documentation',
    entityType: 'QualityDocument', naacCriterion: 7,
    naacIndicator: '7.2 Best Practices', nirf: ['PR'],
    initiatedBy: 'Department / cell coordinator',
    purpose: 'Two institutional best practices are written up in the NAAC format with evidence of success and published.',
    evidence: 'Best-practice write-up in NAAC format, evidence of success, website link.',
    steps: [step('IQAC — review against NAAC format', 'iqac_coordinator', 168, 'principal'), step('Principal — approval and publication', 'principal', 120)]
  },
  {
    code: 'INSTITUTIONAL_DISTINCTIVENESS',
    name: 'Institutional distinctiveness statement',
    entityType: 'QualityDocument', naacCriterion: 7,
    naacIndicator: '7.3 Institutional Distinctiveness', nirf: ['PR'],
    initiatedBy: 'IQAC Coordinator',
    purpose: 'The institution\'s distinctive area is documented with performance evidence and approved by the leadership.',
    evidence: 'Distinctiveness write-up with supporting data.',
    steps: [step('Principal — review', 'principal', 168, 'vice_chancellor'), step('Vice-Chancellor — approval', 'vice_chancellor', 168)]
  },

  // ── NIRF data-capture workflows ───────────────────────────────────────────
  {
    code: 'NIRF_DATA_SUBMISSION',
    name: 'NIRF annual data capture and submission',
    entityType: 'ComplianceReport', naacCriterion: 6,
    naacIndicator: '6.5 Internal Quality Assurance System', nirf: ['TLR', 'RP', 'GO', 'OI', 'PR'],
    initiatedBy: 'IQAC Coordinator (NIRF nodal officer)',
    purpose: 'Data for every NIRF parameter is collected from its owning office, validated, approved and submitted on the Data Capturing System, and the same figures are published on the website as NIRF requires.',
    evidence: 'Parameter-wise data sheets with source, approval note, DCS submission copy, website disclosure.',
    steps: [step('HOD — department data', 'hod', 168, 'dean'), step('IQAC — validation against source records', 'iqac_coordinator', 240, 'registrar'), step('Registrar — certification', 'registrar', 120, 'pro_vc'), step('Vice-Chancellor — approval to submit', 'vice_chancellor', 120)]
  },
  {
    code: 'NIRF_FINANCIAL_DATA_CERTIFICATION',
    name: 'NIRF financial resources data certification (FRU)',
    entityType: 'JournalEntry', naacCriterion: 6,
    naacIndicator: '6.4 Financial Management and Resource Mobilization', nirf: ['TLR'],
    initiatedBy: 'Finance Officer',
    purpose: 'Capital and operational expenditure for the last three years is extracted from the audited accounts under the NIRF heads and certified.',
    evidence: 'Head-wise expenditure statement, audited accounts, auditor certificate.',
    steps: [step('Finance Officer — head-wise statement', 'finance_officer', 168, 'registrar'), step('Principal — certified against the audited accounts', 'principal', 168, 'registrar'), step('Registrar — countersign', 'registrar', 72)]
  },
  {
    code: 'NIRF_GRADUATION_OUTCOME_VERIFICATION',
    name: 'NIRF graduation outcomes verification (GPH / GUE / GMS / GPHD)',
    entityType: 'JobOffer', naacCriterion: 5,
    naacIndicator: '5.2 Student Progression', nirf: ['GO'],
    initiatedBy: 'Placement Officer',
    purpose: 'For each graduating batch: students placed, median salary, students in higher studies, on-time graduates and Ph.D.s awarded are reconciled with offer letters and results.',
    evidence: 'Batch-wise list with offer letters, admission proofs, result gazette, Ph.D. award notifications.',
    steps: [step('Placement Officer — placement and salary data', 'placement_officer', 168, 'dean'), step('CoE — on-time graduation figures', 'coe', 120, 'registrar'), step('IQAC — reconciliation and lock', 'iqac_coordinator', 168, 'registrar')]
  },
  {
    code: 'NIRF_DIVERSITY_DATA_VALIDATION',
    name: 'NIRF outreach and inclusivity data validation (RD / WD / ESCS / PCS)',
    entityType: 'StudentProfile', naacCriterion: 2,
    naacIndicator: '2.1 Student Enrolment and Profile', nirf: ['OI'],
    initiatedBy: 'Registrar office',
    purpose: 'Region, gender, economically and socially challenged student counts and facilities for differently-abled students are validated from admission records.',
    evidence: 'Admission register extracts, category and income certificates, accessibility audit.',
    steps: [step('Registrar — admission data extract', 'registrar', 120, 'principal'), step('Finance Officer — fee reimbursement data', 'finance_officer', 96, 'registrar'), step('IQAC — validation and lock', 'iqac_coordinator', 120)]
  },
  {
    code: 'NIRF_PERCEPTION_OUTREACH',
    name: 'NIRF perception — peer and employer outreach',
    entityType: 'AlumniCommunicationRecord', naacCriterion: 5,
    naacIndicator: '5.4 Alumni Engagement', nirf: ['PR'],
    initiatedBy: 'Placement Officer / Alumni Officer',
    purpose: 'Employer, academic-peer and alumni contact lists are kept current and engagement is planned through the year.',
    evidence: 'Verified contact lists, engagement calendar, communication log.',
    steps: [step('Alumni Officer — contact list verification', 'alumni_officer', 168, 'dean'), step('Placement Officer — employer list verification', 'placement_officer', 168, 'dean'), step('Dean — engagement plan approval', 'dean', 120)]
  }
];
