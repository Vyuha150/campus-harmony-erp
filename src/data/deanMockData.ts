import {
  DepartmentSummary, DeanApproval, CurriculumProposal, FacultyRecruitment,
  DisciplinaryCase, DepartmentBudget, ResultSummary, QualityMetric, InterDeptEvent
} from '@/types/dean';

export const departmentSummaries: DepartmentSummary[] = [
  { id: 'ds-cse', name: 'Computer Science & Engineering', hod: 'Dr. Vikram Singh', totalFaculty: 7, permanentFaculty: 6, vacancies: 2, totalStudents: 320, avgPassPercentage: 90.5, avgAttendance: 82, researchOutput: 45, placementRate: 92 },
  { id: 'ds-ece', name: 'Electronics & Communication', hod: 'Dr. Anand Kumar', totalFaculty: 6, permanentFaculty: 5, vacancies: 1, totalStudents: 280, avgPassPercentage: 88.3, avgAttendance: 79, researchOutput: 32, placementRate: 85 },
  { id: 'ds-me', name: 'Mechanical Engineering', hod: 'Dr. Ramesh Iyer', totalFaculty: 8, permanentFaculty: 7, vacancies: 0, totalStudents: 250, avgPassPercentage: 85.1, avgAttendance: 76, researchOutput: 18, placementRate: 78 },
  { id: 'ds-ce', name: 'Civil Engineering', hod: 'Dr. Sunita Verma', totalFaculty: 5, permanentFaculty: 5, vacancies: 1, totalStudents: 180, avgPassPercentage: 91.2, avgAttendance: 84, researchOutput: 15, placementRate: 72 },
  { id: 'ds-eee', name: 'Electrical Engineering', hod: 'Dr. Mohan Das', totalFaculty: 5, permanentFaculty: 4, vacancies: 2, totalStudents: 200, avgPassPercentage: 82.7, avgAttendance: 74, researchOutput: 22, placementRate: 80 },
];

export const deanApprovals: DeanApproval[] = [
  { id: 'da-1', type: 'purchase', title: 'GPU Server for AI Lab', department: 'CSE', requestedBy: 'Dr. Vikram Singh (HOD)', requestedAt: '2026-03-07', amount: 850000, details: 'NVIDIA A100 GPU Server for deep learning research – forwarded by HOD CSE', priority: 'high', status: 'pending' },
  { id: 'da-2', type: 'leave', title: 'Sabbatical Leave – Dr. Rahul Deshmukh', department: 'CSE', requestedBy: 'Dr. Vikram Singh (HOD)', requestedAt: '2026-03-06', details: '6-month sabbatical for collaborative research at MIT. HOD recommends approval.', priority: 'medium', status: 'pending' },
  { id: 'da-3', type: 'curriculum', title: 'New Elective: Quantum Computing', department: 'CSE', requestedBy: 'Board of Studies – CSE', requestedAt: '2026-03-05', details: 'BoS approved new open elective "Intro to Quantum Computing" for Sem 6. Needs Dean approval before Academic Council.', priority: 'medium', status: 'pending' },
  { id: 'da-4', type: 'results', title: 'Approve Mid-Sem Results – ECE', department: 'ECE', requestedBy: 'CoE Office', requestedAt: '2026-03-04', details: 'Mid-semester results for all ECE programs compiled and verified. Awaiting Dean release.', priority: 'high', status: 'pending' },
  { id: 'da-5', type: 'recruitment', title: 'Faculty Recruitment – 2 positions (EEE)', department: 'EEE', requestedBy: 'Dr. Mohan Das (HOD)', requestedAt: '2026-03-03', details: 'Request to initiate recruitment for 2 Assistant Professor positions in Power Systems and Control Engineering', priority: 'medium', status: 'pending' },
  { id: 'da-6', type: 'budget', title: 'Annual Lab Upgrade Budget – ME', department: 'ME', requestedBy: 'Dr. Ramesh Iyer (HOD)', requestedAt: '2026-03-02', details: 'Proposed budget of ₹25L for CNC machine and 3D printer upgrades in manufacturing lab', priority: 'high', status: 'pending' },
  { id: 'da-7', type: 'transfer', title: 'Inter-dept Transfer – Student (ECE→CSE)', department: 'ECE/CSE', requestedBy: 'Student (Ravi Nair)', requestedAt: '2026-03-01', details: 'Branch change request from ECE to CSE based on CGPA 9.2. Both HODs have reviewed.', priority: 'low', status: 'pending' },
];

export const curriculumProposals: CurriculumProposal[] = [
  { id: 'cp-1', department: 'CSE', proposedBy: 'Dr. Rahul Deshmukh', type: 'new_course', title: 'Introduction to Quantum Computing', description: 'Open elective covering quantum gates, algorithms, and applications. 3 credits.', submittedAt: '2026-03-05', bosApproved: true, status: 'pending_dean' },
  { id: 'cp-2', department: 'ECE', proposedBy: 'Dr. Anand Kumar', type: 'syllabus_update', title: 'Update VLSI Design Syllabus', description: 'Add FinFET technology and advanced node design chapters. Remove legacy bipolar content.', submittedAt: '2026-02-28', bosApproved: true, status: 'pending_dean' },
  { id: 'cp-3', department: 'ME', proposedBy: 'Dr. Ramesh Iyer', type: 'program_change', title: 'Add M.Tech in Additive Manufacturing', description: 'New postgraduate program in Additive Manufacturing/3D Printing with industry collaboration.', submittedAt: '2026-02-20', bosApproved: true, status: 'pending_dean' },
  { id: 'cp-4', department: 'CSE', proposedBy: 'Dr. Kavita Sharma', type: 'elective_addition', title: 'Responsible AI & Ethics', description: 'Interdisciplinary elective on AI ethics, bias, fairness, and policy implications. 2 credits.', submittedAt: '2026-02-15', bosApproved: false, status: 'pending_dean' },
];

export const facultyRecruitments: FacultyRecruitment[] = [
  { id: 'fr-1', department: 'EEE', position: 'Assistant Professor', specialization: 'Power Systems', vacancySince: '2025-12-01', applicants: 42, shortlisted: 8, status: 'requested' },
  { id: 'fr-2', department: 'EEE', position: 'Assistant Professor', specialization: 'Control Engineering', vacancySince: '2025-10-15', applicants: 35, shortlisted: 6, status: 'requested' },
  { id: 'fr-3', department: 'CSE', position: 'Associate Professor', specialization: 'Cybersecurity', vacancySince: '2025-08-01', applicants: 28, shortlisted: 5, status: 'in_progress' },
  { id: 'fr-4', department: 'CE', position: 'Assistant Professor', specialization: 'Structural Engineering', vacancySince: '2026-01-01', applicants: 18, shortlisted: 0, status: 'approved' },
];

export const disciplinaryCases: DisciplinaryCase[] = [
  { id: 'dc-1', studentName: 'Jay Singh', rollNumber: '20CS010', department: 'CSE', type: 'malpractice', description: 'Caught with prohibited material during CS401 quiz. HOD has investigated and recommends suspension for one exam.', reportedBy: 'Dr. Vikram Singh (HOD)', reportedAt: '2026-02-25', status: 'escalated', severity: 'major' },
  { id: 'dc-2', studentName: 'Rajan Mehta', rollNumber: '22ME045', department: 'ME', type: 'ragging', description: 'Reported for verbal intimidation of first-year student in hostel. Anti-ragging committee has initial report.', reportedBy: 'Anti-Ragging Committee', reportedAt: '2026-03-01', status: 'under_review', severity: 'critical' },
  { id: 'dc-3', studentName: 'Priya Desai', rollNumber: '21ECE033', department: 'ECE', type: 'attendance_shortage', description: 'Attendance 48% in 4 subjects. Medical certificate submitted covers only 2 weeks. Dean condonation requested.', reportedBy: 'Dr. Anand Kumar (HOD)', reportedAt: '2026-03-05', status: 'escalated', severity: 'minor' },
];

export const departmentBudgets: DepartmentBudget[] = [
  { department: 'Computer Science', allocated: 5000000, spent: 3200000, remaining: 1800000, categories: [
    { name: 'Lab Equipment', allocated: 2000000, spent: 1500000 },
    { name: 'Consumables', allocated: 500000, spent: 350000 },
    { name: 'Faculty Development', allocated: 800000, spent: 400000 },
    { name: 'Events & Conferences', allocated: 700000, spent: 550000 },
    { name: 'Maintenance', allocated: 1000000, spent: 400000 },
  ]},
  { department: 'Electronics & Comm', allocated: 4500000, spent: 2800000, remaining: 1700000, categories: [
    { name: 'Lab Equipment', allocated: 2000000, spent: 1200000 },
    { name: 'Consumables', allocated: 600000, spent: 500000 },
    { name: 'Faculty Development', allocated: 600000, spent: 300000 },
    { name: 'Events & Conferences', allocated: 500000, spent: 400000 },
    { name: 'Maintenance', allocated: 800000, spent: 400000 },
  ]},
  { department: 'Mechanical Engg', allocated: 6000000, spent: 4500000, remaining: 1500000, categories: [
    { name: 'Lab Equipment', allocated: 3000000, spent: 2500000 },
    { name: 'Consumables', allocated: 800000, spent: 700000 },
    { name: 'Faculty Development', allocated: 500000, spent: 300000 },
    { name: 'Events & Conferences', allocated: 400000, spent: 350000 },
    { name: 'Maintenance', allocated: 1300000, spent: 650000 },
  ]},
  { department: 'Civil Engineering', allocated: 3500000, spent: 1800000, remaining: 1700000, categories: [
    { name: 'Lab Equipment', allocated: 1500000, spent: 800000 },
    { name: 'Consumables', allocated: 400000, spent: 200000 },
    { name: 'Faculty Development', allocated: 500000, spent: 300000 },
    { name: 'Events & Conferences', allocated: 400000, spent: 200000 },
    { name: 'Maintenance', allocated: 700000, spent: 300000 },
  ]},
  { department: 'Electrical Engg', allocated: 4000000, spent: 2600000, remaining: 1400000, categories: [
    { name: 'Lab Equipment', allocated: 1800000, spent: 1200000 },
    { name: 'Consumables', allocated: 500000, spent: 400000 },
    { name: 'Faculty Development', allocated: 500000, spent: 200000 },
    { name: 'Events & Conferences', allocated: 400000, spent: 300000 },
    { name: 'Maintenance', allocated: 800000, spent: 500000 },
  ]},
];

export const resultSummaries: ResultSummary[] = [
  { department: 'CSE', program: 'B.Tech CSE', semester: 5, totalStudents: 130, passed: 118, failed: 12, passPercentage: 90.8, avgGPA: 7.6, toppers: [{ name: 'Deepak Verma', gpa: 9.8 }, { name: 'Isha Reddy', gpa: 9.5 }], status: 'approved' },
  { department: 'CSE', program: 'M.Tech CSE', semester: 3, totalStudents: 30, passed: 29, failed: 1, passPercentage: 96.7, avgGPA: 8.2, toppers: [{ name: 'Isha Reddy', gpa: 9.4 }], status: 'approved' },
  { department: 'ECE', program: 'B.Tech ECE', semester: 5, totalStudents: 140, passed: 124, failed: 16, passPercentage: 88.6, avgGPA: 7.2, toppers: [{ name: 'Sneha Rao', gpa: 9.6 }], status: 'pending_approval' },
  { department: 'ME', program: 'B.Tech ME', semester: 5, totalStudents: 125, passed: 106, failed: 19, passPercentage: 84.8, avgGPA: 6.9, toppers: [{ name: 'Arun Pillai', gpa: 9.3 }], status: 'pending_approval' },
  { department: 'CE', program: 'B.Tech CE', semester: 5, totalStudents: 90, passed: 82, failed: 8, passPercentage: 91.1, avgGPA: 7.5, toppers: [{ name: 'Mita Shah', gpa: 9.7 }], status: 'published' },
  { department: 'EEE', program: 'B.Tech EEE', semester: 5, totalStudents: 100, passed: 83, failed: 17, passPercentage: 83.0, avgGPA: 6.8, toppers: [{ name: 'Karan Roy', gpa: 9.1 }], status: 'pending_approval' },
];

export const qualityMetrics: QualityMetric[] = [
  { id: 'qm-1', metric: 'Student-Faculty Ratio', category: 'nirf', currentValue: '18:1', previousValue: '20:1', target: '15:1', trend: 'up', status: 'on_track' },
  { id: 'qm-2', metric: 'Overall Placement Rate', category: 'nirf', currentValue: '86%', previousValue: '82%', target: '90%', trend: 'up', status: 'on_track' },
  { id: 'qm-3', metric: 'Faculty with PhD', category: 'naac', currentValue: '78%', previousValue: '72%', target: '85%', trend: 'up', status: 'at_risk' },
  { id: 'qm-4', metric: 'SCI/Scopus Publications', category: 'nirf', currentValue: '132', previousValue: '108', target: '150', trend: 'up', status: 'on_track' },
  { id: 'qm-5', metric: 'Student Satisfaction Score', category: 'naac', currentValue: '3.8/5', previousValue: '3.6/5', target: '4.0/5', trend: 'up', status: 'on_track' },
  { id: 'qm-6', metric: 'Research Funding', category: 'nirf', currentValue: '₹3.2 Cr', previousValue: '₹2.5 Cr', target: '₹4 Cr', trend: 'up', status: 'at_risk' },
  { id: 'qm-7', metric: 'Median Salary (Placed)', category: 'nirf', currentValue: '₹6.8 LPA', previousValue: '₹6.2 LPA', target: '₹7.5 LPA', trend: 'up', status: 'on_track' },
  { id: 'qm-8', metric: 'Grievance Resolution Rate', category: 'naac', currentValue: '94%', previousValue: '91%', target: '95%', trend: 'up', status: 'on_track' },
  { id: 'qm-9', metric: 'Pass Percentage (Overall)', category: 'internal', currentValue: '87.4%', previousValue: '85.1%', target: '90%', trend: 'up', status: 'at_risk' },
  { id: 'qm-10', metric: 'Average Attendance', category: 'internal', currentValue: '79%', previousValue: '77%', target: '85%', trend: 'up', status: 'behind' },
];

export const interDeptEvents: InterDeptEvent[] = [
  { id: 'ev-1', title: 'TechVista 2026 – Annual Techfest', type: 'technical', date: '2026-04-10', departments: ['CSE', 'ECE', 'EEE', 'ME', 'CE'], coordinator: 'Prof. Neha Agarwal', budget: 500000, participants: 800, status: 'planned' },
  { id: 'ev-2', title: 'Industry-Academia Conclave', type: 'seminar', date: '2026-03-20', departments: ['CSE', 'ECE', 'ME'], coordinator: 'Dr. Rahul Deshmukh', budget: 150000, participants: 200, status: 'planned' },
  { id: 'ev-3', title: 'Inter-Department Sports Meet', type: 'sports', date: '2026-03-15', departments: ['CSE', 'ECE', 'EEE', 'ME', 'CE'], coordinator: 'Mr. Ravi Kumar', budget: 100000, participants: 500, status: 'ongoing' },
  { id: 'ev-4', title: 'Faculty Development Program on NEP 2020', type: 'workshop', date: '2026-02-25', departments: ['CSE', 'ECE', 'EEE', 'ME', 'CE'], coordinator: 'Dr. Meena Krishnan', budget: 80000, participants: 35, status: 'completed' },
  { id: 'ev-5', title: 'Cultural Fest – Euphoria', type: 'cultural', date: '2026-04-20', departments: ['CSE', 'ECE', 'EEE', 'ME', 'CE'], coordinator: 'Ms. Kavitha Nair', budget: 300000, participants: 1200, status: 'planned' },
];
