import type { CriteriaProgress, IQACActionItem, QualityDocument, FeedbackSummary, GrievanceCase, ComplianceItem, GrievanceTrend, CategoryStats } from '@/types/iqac';

export const criteriaProgress: CriteriaProgress[] = [
  { criteriaNumber: 1, title: 'Curricular Aspects', dataProgress: 92, documentsUploaded: 23, requiredDocuments: 25, status: 'in_progress', lastUpdated: new Date('2026-03-07'), issues: ['Course feedback forms for 2 programs pending'] },
  { criteriaNumber: 2, title: 'Teaching-Learning and Evaluation', dataProgress: 85, documentsUploaded: 30, requiredDocuments: 35, status: 'in_progress', lastUpdated: new Date('2026-03-06'), issues: ['Student mentoring records incomplete', 'Advanced learner programs not documented'] },
  { criteriaNumber: 3, title: 'Research, Innovations and Extension', dataProgress: 78, documentsUploaded: 18, requiredDocuments: 28, status: 'needs_attention', lastUpdated: new Date('2026-03-05'), issues: ['Faculty publication list not updated', 'Consultancy revenue data missing', 'MOU copies pending from 3 departments'] },
  { criteriaNumber: 4, title: 'Infrastructure and Learning Resources', dataProgress: 95, documentsUploaded: 19, requiredDocuments: 20, status: 'completed', lastUpdated: new Date('2026-03-08'), issues: [] },
  { criteriaNumber: 5, title: 'Student Support and Progression', dataProgress: 70, documentsUploaded: 15, requiredDocuments: 22, status: 'needs_attention', lastUpdated: new Date('2026-03-04'), issues: ['Alumni progression data incomplete', 'Capacity building program details pending', 'Awards/medals documentation needed'] },
  { criteriaNumber: 6, title: 'Governance, Leadership and Management', dataProgress: 88, documentsUploaded: 20, requiredDocuments: 22, status: 'in_progress', lastUpdated: new Date('2026-03-07'), issues: ['E-governance audit report pending'] },
  { criteriaNumber: 7, title: 'Institutional Values and Best Practices', dataProgress: 90, documentsUploaded: 16, requiredDocuments: 18, status: 'in_progress', lastUpdated: new Date('2026-03-08'), issues: ['Gender audit report pending'] },
];

export const iqacActionItems: IQACActionItem[] = [
  { id: 'IA001', title: 'Launch Certificate Courses in AI/ML', description: 'Start at least 2 new certificate courses in emerging technologies', category: 'curriculum', priority: 'high', assignedTo: 'Dr. Rajesh Kumar (CS HOD)', department: 'Computer Science', dueDate: new Date('2026-06-30'), status: 'in_progress', implementationStatus: '2 courses introduced – AI Fundamentals & ML Applications', createdDate: new Date('2025-09-15'), impact: 'Enhances Criterion 1.2' },
  { id: 'IA002', title: 'Faculty Development Programs', description: 'Ensure minimum 5 FDPs per semester across departments', category: 'faculty', priority: 'medium', assignedTo: 'Dean – Academic Affairs', dueDate: new Date('2026-04-30'), status: 'in_progress', implementationStatus: '3 FDPs completed, 2 scheduled', createdDate: new Date('2025-10-01'), impact: 'Enhances Criterion 6.3' },
  { id: 'IA003', title: 'Update Alumni Progression Database', description: 'Collect and verify progression data for last 3 graduating batches', category: 'student_support', priority: 'high', assignedTo: 'Alumni Officer', dueDate: new Date('2026-03-31'), status: 'pending', createdDate: new Date('2026-01-15'), impact: 'Critical for Criterion 5.2' },
];

export const qualityDocuments: QualityDocument[] = [
  { id: 'QD001', title: 'Academic Calendar 2025-26', criteriaNumber: 1, documentType: 'policy', uploadedBy: 'Registrar Office', uploadDate: new Date('2025-07-01'), filePath: '/documents/academic_calendar.pdf', version: '1.0', status: 'approved', reviewedBy: 'IQAC Coordinator', reviewDate: new Date('2025-07-05'), tags: ['academic', 'calendar', 'planning'] },
  { id: 'QD002', title: 'Student Feedback Analysis – Odd Sem 2025', criteriaNumber: 2, documentType: 'report', uploadedBy: 'IQAC Cell', uploadDate: new Date('2026-02-15'), filePath: '/documents/feedback_odd2025.pdf', version: '1.0', status: 'approved', tags: ['feedback', 'students', 'analysis'] },
  { id: 'QD003', title: 'Research Publication List 2025', criteriaNumber: 3, documentType: 'data', uploadedBy: 'Research Cell', uploadDate: new Date('2026-01-20'), filePath: '/documents/publications_2025.xlsx', version: '2.0', status: 'needs_revision', reviewComments: 'Missing 12 entries from Mechanical Dept – please verify', reviewedBy: 'IQAC Coordinator', reviewDate: new Date('2026-01-25'), tags: ['research', 'publications'] },
];

export const feedbackSummaries: FeedbackSummary[] = [
  { type: 'student', respondents: 4250, averageRating: 4.1, satisfactionLevel: 'very_good', keyFindings: ['Teaching quality highly rated', 'Lab facilities need upgrades'], improvementAreas: ['More industry exposure', 'Better Wi-Fi'], lastCollected: new Date('2026-01-15') },
  { type: 'alumni', respondents: 820, averageRating: 3.8, satisfactionLevel: 'good', keyFindings: ['Strong foundational education', 'Good placement support'], improvementAreas: ['More practical projects', 'Industry collaborations'], lastCollected: new Date('2025-12-20') },
  { type: 'employer', respondents: 45, averageRating: 3.9, satisfactionLevel: 'good', keyFindings: ['Strong technical skills', 'Good teamwork'], improvementAreas: ['Communication skills', 'Domain knowledge'], lastCollected: new Date('2025-11-30') },
];

export const grievanceCases: GrievanceCase[] = [
  { id: 'GR001', grievanceNumber: 'GRV-2026-0042', complainantName: 'Student A', complainantType: 'student', category: 'academic', subject: 'Unfair Evaluation in Mid-Semester Exam', description: 'Student claims marks were incorrectly calculated in Data Structures mid-sem.', severity: 'medium', status: 'investigating', submissionDate: new Date('2026-03-02'), lastUpdated: new Date('2026-03-07'), assignedTo: 'Dr. Anand (CS HOD)', department: 'Computer Science', expectedResolutionDate: new Date('2026-03-20'), isAnonymous: false, evidenceFiles: ['AnswerSheet.pdf', 'MarksReport.pdf'], timeline: [
    { id: 'GA1', date: new Date('2026-03-02'), activity: 'Grievance received', performedBy: 'System', status: 'received' },
    { id: 'GA2', date: new Date('2026-03-03'), activity: 'Assigned to CS HOD for review', performedBy: 'Grievance Officer', status: 'under_review' },
    { id: 'GA3', date: new Date('2026-03-07'), activity: 'Answer sheet re-evaluation initiated', performedBy: 'Dr. Anand', comments: 'Referred to alternate faculty for independent re-check', status: 'investigating' },
  ]},
  { id: 'GR002', grievanceNumber: 'GRV-2026-0043', complainantName: 'Anonymous', complainantType: 'anonymous', category: 'facility', subject: 'Hostel Water Supply Issues', description: 'Block-C has irregular water supply for past 2 weeks. Multiple students affected.', severity: 'high', status: 'pending_action', submissionDate: new Date('2026-03-04'), lastUpdated: new Date('2026-03-06'), assignedTo: 'Estate Officer', expectedResolutionDate: new Date('2026-03-12'), isAnonymous: true, evidenceFiles: [], timeline: [
    { id: 'GA4', date: new Date('2026-03-04'), activity: 'Grievance received', performedBy: 'System', status: 'received' },
    { id: 'GA5', date: new Date('2026-03-05'), activity: 'Forwarded to Estate Office', performedBy: 'Grievance Officer', status: 'under_review' },
  ]},
  { id: 'GR003', grievanceNumber: 'GRV-2026-0041', complainantName: 'Faculty B', complainantType: 'faculty', category: 'administrative', subject: 'Delay in Travel Reimbursement', description: 'Conference travel reimbursement pending for 3 months despite submitting all documents.', severity: 'low', status: 'resolved', submissionDate: new Date('2026-02-15'), lastUpdated: new Date('2026-03-01'), assignedTo: 'Accounts Section', department: 'Finance', actualResolutionDate: new Date('2026-03-01'), resolutionDays: 14, isAnonymous: false, evidenceFiles: ['TravelClaim.pdf'], timeline: [], resolution: 'Reimbursement processed on 01-Mar-2026 via bank transfer.', satisfactionRating: 4 },
];

export const grievanceTrends: GrievanceTrend[] = [
  { month: 'Oct', received: 12, resolved: 10, pending: 8 },
  { month: 'Nov', received: 15, resolved: 14, pending: 9 },
  { month: 'Dec', received: 8, resolved: 11, pending: 6 },
  { month: 'Jan', received: 18, resolved: 15, pending: 9 },
  { month: 'Feb', received: 14, resolved: 16, pending: 7 },
  { month: 'Mar', received: 10, resolved: 8, pending: 9 },
];

export const categoryStats: CategoryStats[] = [
  { category: 'Academic', count: 28, averageResolutionDays: 12, satisfactionRating: 3.8 },
  { category: 'Administrative', count: 18, averageResolutionDays: 15, satisfactionRating: 3.5 },
  { category: 'Facility', count: 22, averageResolutionDays: 8, satisfactionRating: 4.0 },
  { category: 'Financial', count: 12, averageResolutionDays: 20, satisfactionRating: 3.2 },
  { category: 'Harassment', count: 3, averageResolutionDays: 25, satisfactionRating: 3.0 },
];

export const complianceItems: ComplianceItem[] = [
  { id: 'CI001', title: 'Anti-Ragging Affidavit Submission', type: 'anti_ragging', description: 'All students must submit anti-ragging affidavit at beginning of each academic year', applicableTo: 'students', dueDate: new Date('2025-09-30'), renewalPeriod: 'Annual', completionTracking: [], documents: ['AntiRaggingForm.pdf'], status: 'active' },
  { id: 'CI002', title: 'POSH Training Completion', type: 'sexual_harassment', description: 'All faculty and staff must complete Prevention of Sexual Harassment training', applicableTo: 'all', renewalPeriod: 'Annual', completionTracking: [], documents: ['POSHModule.pdf'], status: 'active' },
];