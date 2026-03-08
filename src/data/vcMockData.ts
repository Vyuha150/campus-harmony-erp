import {
  CampusSummary, InstitutionKPI, LiveUpdate, ExecutiveApproval,
  MeetingAgenda, PolicyScenario, ComplianceReport, BroadcastMessage,
  FinancialOverview, DepartmentPerformance
} from '@/types/vc';

export const campusSummaries: CampusSummary[] = [
  { id: 'c1', name: 'Main Campus', location: 'New Delhi', students: 8500, faculty: 420, programs: 45, placementRate: 87, passRate: 91 },
  { id: 'c2', name: 'South Campus', location: 'Greater Noida', students: 4200, faculty: 210, programs: 22, placementRate: 82, passRate: 88 },
  { id: 'c3', name: 'Research Park', location: 'Gurugram', students: 1200, faculty: 85, programs: 12, placementRate: 94, passRate: 95 },
];

export const institutionKPIs: InstitutionKPI[] = [
  { id: 'k1', label: 'Total Enrollment', value: '13,900', target: '15,000', trend: 'up', trendValue: '+8.2%', status: 'good', category: 'academic' },
  { id: 'k2', label: 'Faculty-Student Ratio', value: '1:19', target: '1:18', trend: 'stable', trendValue: '0%', status: 'average', category: 'academic' },
  { id: 'k3', label: 'Overall Pass Rate', value: '90.5%', target: '92%', trend: 'up', trendValue: '+1.8%', status: 'good', category: 'academic' },
  { id: 'k4', label: 'Placement Rate', value: '86%', target: '90%', trend: 'up', trendValue: '+3%', status: 'average', category: 'placement' },
  { id: 'k5', label: 'Research Funding', value: '₹8.2 Cr', target: '₹10 Cr', trend: 'up', trendValue: '+22%', status: 'good', category: 'research' },
  { id: 'k6', label: 'Publications (H-index)', value: '42', target: '50', trend: 'up', trendValue: '+6', status: 'average', category: 'research' },
  { id: 'k7', label: 'Revenue Collection', value: '₹142 Cr', target: '₹150 Cr', trend: 'up', trendValue: '+5%', status: 'good', category: 'finance' },
  { id: 'k8', label: 'NAAC Score (Projected)', value: '3.42', target: '3.5', trend: 'up', trendValue: '+0.12', status: 'average', category: 'quality' },
  { id: 'k9', label: 'NIRF Rank', value: '#48', target: 'Top 40', trend: 'up', trendValue: '+7 places', status: 'average', category: 'quality' },
  { id: 'k10', label: 'Student Satisfaction', value: '4.1/5', target: '4.3/5', trend: 'up', trendValue: '+0.2', status: 'good', category: 'quality' },
  { id: 'k11', label: 'Dropout Rate', value: '3.2%', target: '<2%', trend: 'down', trendValue: '-0.5%', status: 'average', category: 'academic' },
  { id: 'k12', label: 'Budget Utilization', value: '78%', target: '85%', trend: 'up', trendValue: '+4%', status: 'average', category: 'finance' },
];

export const liveUpdates: LiveUpdate[] = [
  { id: 'u1', message: 'Admissions 2025-26: 1,280 admitted of 1,500 seats (85.3% filled)', type: 'info', timestamp: new Date('2026-03-08T09:30:00'), module: 'Admissions' },
  { id: 'u2', message: 'NAAC Peer Team Visit scheduled in 28 days — 2 criteria reports pending', type: 'warning', timestamp: new Date('2026-03-08T09:15:00'), module: 'Accreditation' },
  { id: 'u3', message: 'Convocation: 2,450 students eligible to graduate this semester', type: 'success', timestamp: new Date('2026-03-08T08:45:00'), module: 'Examinations' },
  { id: 'u4', message: 'Dropout rate increased by 1.2% in B.Sc. Physics — requires attention', type: 'critical', timestamp: new Date('2026-03-08T08:30:00'), module: 'Analytics' },
  { id: 'u5', message: 'Unusual expenditure spike detected in Civil Engineering Dept (+45%)', type: 'critical', timestamp: new Date('2026-03-08T08:00:00'), module: 'Finance' },
  { id: 'u6', message: 'Result publication delayed for MBA Program by 5 days', type: 'warning', timestamp: new Date('2026-03-07T17:30:00'), module: 'Examinations' },
  { id: 'u7', message: 'MoU with TCS signed — 200 internship slots confirmed for 2026', type: 'success', timestamp: new Date('2026-03-07T15:00:00'), module: 'Placements' },
  { id: 'u8', message: 'Research grant of ₹1.2 Cr approved by DST for Nano-Materials Lab', type: 'success', timestamp: new Date('2026-03-07T11:00:00'), module: 'Research' },
];

export const executiveApprovals: ExecutiveApproval[] = [
  { id: 'ea1', type: 'faculty_hire', title: 'Appointment of 3 Assistant Professors — CSE Department', description: 'Selection committee recommends 3 candidates for permanent positions in AI/ML, Cybersecurity, and Cloud Computing specializations.', requestedBy: 'Dean of Engineering', requestedAt: new Date('2026-03-06'), priority: 'high', status: 'pending', forwardedFrom: 'Selection Committee', documents: ['recommendation_letter.pdf', 'candidate_profiles.pdf'] },
  { id: 'ea2', type: 'capital_expenditure', title: 'Construction of New Library Wing — South Campus', description: 'Proposal for 20,000 sq ft library expansion with digital learning center, estimated cost ₹12 Cr.', requestedBy: 'Principal, South Campus', requestedAt: new Date('2026-03-05'), amount: 120000000, priority: 'critical', status: 'pending', documents: ['architectural_plan.pdf', 'cost_estimate.pdf'] },
  { id: 'ea3', type: 'new_program', title: 'Launch of M.Tech in Artificial Intelligence', description: 'New 2-year program with 30 seats, approved by BoS and Academic Council. Needs final VC approval and UGC NOC submission.', requestedBy: 'Dean of Engineering', requestedAt: new Date('2026-03-04'), priority: 'high', status: 'pending', forwardedFrom: 'Academic Council' },
  { id: 'ea4', type: 'mou', title: 'MoU with University of Melbourne — Student Exchange', description: 'Bilateral student exchange program for 20 students per year with joint research in renewable energy.', requestedBy: 'International Relations Office', requestedAt: new Date('2026-03-03'), priority: 'medium', status: 'pending', documents: ['mou_draft.pdf'] },
  { id: 'ea5', type: 'research_center', title: 'Establish Centre for Quantum Computing Research', description: 'Inter-departmental research center with initial funding of ₹5 Cr from DRDO collaboration.', requestedBy: 'Dean of Sciences', requestedAt: new Date('2026-03-02'), amount: 50000000, priority: 'high', status: 'pending', documents: ['proposal.pdf', 'drdo_letter.pdf'] },
  { id: 'ea6', type: 'budget_allocation', title: 'Revised Budget Allocation for FY 2026-27', description: 'Finance Committee recommends 12% increase in research budget and 8% increase in infrastructure allocation.', requestedBy: 'Finance Officer', requestedAt: new Date('2026-03-01'), amount: 2500000000, priority: 'critical', status: 'pending', forwardedFrom: 'Finance Committee' },
  { id: 'ea7', type: 'policy_change', title: 'Revised Attendance Policy — Hybrid Mode', description: 'Proposal to allow 20% online attendance for PG students. Endorsed by Academic Council with conditions.', requestedBy: 'Pro-VC (Academics)', requestedAt: new Date('2026-02-28'), priority: 'medium', status: 'pending', forwardedFrom: 'Academic Council' },
];

export const meetingAgendas: MeetingAgenda[] = [
  {
    id: 'm1', meetingType: 'board_of_management', title: '47th Board of Management Meeting', date: new Date('2026-03-15'), time: '10:00 AM', venue: 'Senate Hall, Main Campus', status: 'upcoming',
    attendees: ['Vice Chancellor', 'Pro-VC', 'Registrar', 'Finance Officer', 'Dean Engineering', 'Dean Sciences', 'External Member 1', 'External Member 2'],
    documents: ['agenda_47th_bom.pdf', 'minutes_46th_bom.pdf', 'action_taken_report.pdf'],
    agendaItems: [
      { id: 'a1', title: 'Confirmation of Minutes of 46th BoM', presenter: 'Registrar', duration: '10 min', status: 'pending' },
      { id: 'a2', title: 'Action Taken Report on Previous Decisions', presenter: 'Registrar', duration: '20 min', status: 'pending', actionItems: [{ id: 'ai1', task: 'Complete faculty recruitment for 12 sanctioned posts', assignedTo: 'Dean of Engineering', deadline: new Date('2026-04-15'), status: 'in_progress' }] },
      { id: 'a3', title: 'Approval of Annual Budget FY 2026-27', presenter: 'Finance Officer', duration: '45 min', status: 'pending' },
      { id: 'a4', title: 'New Academic Programs — M.Tech AI, M.Sc Data Science', presenter: 'Pro-VC Academics', duration: '30 min', status: 'pending' },
      { id: 'a5', title: 'Campus Infrastructure Development Plan', presenter: 'Estate Officer', duration: '25 min', status: 'pending' },
    ],
  },
  {
    id: 'm2', meetingType: 'academic_council', title: '32nd Academic Council Meeting', date: new Date('2026-03-22'), time: '11:00 AM', venue: 'Conference Room A', status: 'upcoming',
    attendees: ['Vice Chancellor', 'Pro-VC', 'All Deans', 'All HODs', 'Student Representatives'],
    documents: ['academic_council_agenda.pdf'],
    agendaItems: [
      { id: 'a6', title: 'Revised Curriculum for B.Tech Programs (NEP 2020)', presenter: 'Dean Academics', duration: '40 min', status: 'pending' },
      { id: 'a7', title: 'Examination Reform — Continuous Assessment Model', presenter: 'CoE', duration: '30 min', status: 'pending' },
      { id: 'a8', title: 'Credit Transfer Policy with Foreign Universities', presenter: 'International Relations', duration: '20 min', status: 'pending' },
    ],
  },
  {
    id: 'm3', meetingType: 'finance_committee', title: '18th Finance Committee Meeting', date: new Date('2026-03-10'), time: '2:00 PM', venue: 'Board Room', status: 'upcoming',
    attendees: ['Vice Chancellor', 'Finance Officer', 'Registrar', 'External Finance Expert'],
    documents: ['budget_proposal.pdf', 'audit_report.pdf'],
    agendaItems: [
      { id: 'a9', title: 'Review of Audit Observations 2024-25', presenter: 'Finance Officer', duration: '30 min', status: 'pending' },
      { id: 'a10', title: 'Fee Revision Proposal for Self-Financed Courses', presenter: 'Finance Officer', duration: '25 min', status: 'pending' },
    ],
  },
];

export const policyScenarios: PolicyScenario[] = [
  { id: 'ps1', title: 'Fee Increase Impact Analysis', description: 'Project revenue change if tuition fees are increased', category: 'finance', parameters: [{ label: 'Fee Increase', currentValue: 0, proposedValue: 10, unit: '%' }, { label: 'Expected Enrollment Drop', currentValue: 0, proposedValue: 3, unit: '%' }], projectedOutcome: 'Net revenue increase of ₹4.8 Cr annually. Enrollment may drop by ~420 students.', impact: 'positive' },
  { id: 'ps2', title: 'Enrollment Growth Projection', description: 'Estimate next intake based on application trends', category: 'enrollment', parameters: [{ label: 'Applications Received', currentValue: 12000, proposedValue: 14500, unit: '' }, { label: 'Conversion Rate', currentValue: 35, proposedValue: 38, unit: '%' }], projectedOutcome: 'Projected enrollment: 5,510 new students (up from 4,200). May need 15 additional sections.', impact: 'positive' },
  { id: 'ps3', title: 'New Attendance Rule Impact', description: 'Impact of stricter 80% attendance rule', category: 'academic', parameters: [{ label: 'Current Threshold', currentValue: 75, proposedValue: 80, unit: '%' }, { label: 'Students Below Threshold', currentValue: 8, proposedValue: 14, unit: '%' }], projectedOutcome: 'Average attendance may improve by 6%. However, 840 additional students may face detention.', impact: 'neutral' },
  { id: 'ps4', title: 'Faculty Hiring Plan', description: 'Impact of filling all vacant positions', category: 'hr', parameters: [{ label: 'Current Vacancies', currentValue: 45, proposedValue: 0, unit: '' }, { label: 'Annual Cost', currentValue: 0, proposedValue: 6.75, unit: 'Cr' }], projectedOutcome: 'Faculty-student ratio improves to 1:15. Teaching load reduces by 18%. Research output expected to increase 25%.', impact: 'positive' },
];

export const complianceReports: ComplianceReport[] = [
  {
    id: 'cr1', framework: 'NAAC', title: 'NAAC Self-Study Report (Cycle 4)', status: 'in_review', score: 3.42, maxScore: 4.0, lastUpdated: new Date('2026-03-06'),
    criteria: [
      { id: 'nc1', name: 'Curricular Aspects', score: 3.5, maxScore: 4.0, status: 'on_track' },
      { id: 'nc2', name: 'Teaching-Learning & Evaluation', score: 3.6, maxScore: 4.0, status: 'on_track' },
      { id: 'nc3', name: 'Research & Extension', score: 3.3, maxScore: 4.0, status: 'at_risk' },
      { id: 'nc4', name: 'Infrastructure & Learning Resources', score: 3.4, maxScore: 4.0, status: 'on_track' },
      { id: 'nc5', name: 'Student Support & Progression', score: 3.5, maxScore: 4.0, status: 'on_track' },
      { id: 'nc6', name: 'Governance & Leadership', score: 3.2, maxScore: 4.0, status: 'at_risk' },
      { id: 'nc7', name: 'Institutional Values', score: 3.5, maxScore: 4.0, status: 'on_track' },
    ],
  },
  {
    id: 'cr2', framework: 'NIRF', title: 'NIRF Data Submission 2026', status: 'draft', score: 52.8, maxScore: 100, lastUpdated: new Date('2026-03-04'),
    criteria: [
      { id: 'nr1', name: 'Teaching, Learning & Resources', score: 58, maxScore: 100, status: 'on_track' },
      { id: 'nr2', name: 'Research & Professional Practice', score: 42, maxScore: 100, status: 'at_risk' },
      { id: 'nr3', name: 'Graduation Outcomes', score: 61, maxScore: 100, status: 'on_track' },
      { id: 'nr4', name: 'Outreach & Inclusivity', score: 55, maxScore: 100, status: 'on_track' },
      { id: 'nr5', name: 'Perception', score: 48, maxScore: 100, status: 'behind' },
    ],
  },
  { id: 'cr3', framework: 'AQAR', title: 'AQAR 2025-26', status: 'draft', maxScore: 100, lastUpdated: new Date('2026-02-20'), criteria: [] },
];

export const broadcastMessages: BroadcastMessage[] = [
  { id: 'bm1', subject: 'Congratulations to Placement Cell', content: 'I am delighted to announce that our university has achieved a record 86% placement rate this year. Special thanks to the Training & Placement Cell and all participating companies.', sender: 'Vice Chancellor', sentAt: new Date('2026-03-05'), recipients: 'All University', type: 'congratulation', pinned: true },
  { id: 'bm2', subject: 'NAAC Preparation — All Departments', content: 'As the NAAC peer team visit approaches in 28 days, I request all HODs and Deans to ensure criterion reports are finalized. Department-level mock visits will be conducted next week.', sender: 'Vice Chancellor', sentAt: new Date('2026-03-03'), recipients: 'All Deans & HODs', type: 'directive', pinned: true },
  { id: 'bm3', subject: 'Annual Convocation Notice', content: 'The 25th Annual Convocation will be held on April 15, 2026. All graduating students are requested to register on the portal.', sender: 'Registrar (on behalf of VC)', sentAt: new Date('2026-03-01'), recipients: 'All Students', type: 'notice', pinned: false },
];

export const financialOverview: FinancialOverview[] = [
  { category: 'Tuition & Fees', budget: 9500, actual: 8800, variance: -700 },
  { category: 'Research Grants', budget: 1000, actual: 820, variance: -180 },
  { category: 'Government Grants', budget: 2500, actual: 2500, variance: 0 },
  { category: 'Infrastructure', budget: 3000, actual: 2400, variance: -600 },
  { category: 'Salaries & Benefits', budget: 7200, actual: 7100, variance: -100 },
  { category: 'Operational Expenses', budget: 1800, actual: 1650, variance: -150 },
];

export const departmentPerformance: DepartmentPerformance[] = [
  { department: 'Computer Science', passRate: 94, placementRate: 95, researchOutput: 42, studentSatisfaction: 4.3, facultyCount: 35, studentCount: 1200 },
  { department: 'Electronics', passRate: 91, placementRate: 82, researchOutput: 28, studentSatisfaction: 4.0, facultyCount: 28, studentCount: 800 },
  { department: 'Mechanical', passRate: 88, placementRate: 78, researchOutput: 22, studentSatisfaction: 3.9, facultyCount: 30, studentCount: 750 },
  { department: 'Civil', passRate: 85, placementRate: 72, researchOutput: 18, studentSatisfaction: 3.7, facultyCount: 22, studentCount: 500 },
  { department: 'Business Admin', passRate: 92, placementRate: 88, researchOutput: 15, studentSatisfaction: 4.1, facultyCount: 25, studentCount: 600 },
  { department: 'Physics', passRate: 87, placementRate: 65, researchOutput: 35, studentSatisfaction: 3.8, facultyCount: 18, studentCount: 350 },
  { department: 'Chemistry', passRate: 89, placementRate: 60, researchOutput: 30, studentSatisfaction: 3.9, facultyCount: 15, studentCount: 280 },
  { department: 'Mathematics', passRate: 86, placementRate: 58, researchOutput: 25, studentSatisfaction: 3.6, facultyCount: 14, studentCount: 250 },
];
