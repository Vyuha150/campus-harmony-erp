import {
  AdminFile, StudentRecord, RecordChangeRequest, TransferRequest,
  DegreeRecord, ExamProgress, AdminDocument, Vacancy,
  AccreditationChecklist, VerificationRequest, EstablishmentSummary
} from '@/types/registrar';

export const adminFiles: AdminFile[] = [
  { id: 'af1', type: 'record_change', title: 'Name Correction — Aarav Sharma (STD-2023-089)', description: 'Student requests name correction from "Aarav Sharma" to "Aarav Kumar Sharma" as per Gazette notification.', submittedBy: 'Exam Branch', submittedAt: new Date('2026-03-06'), status: 'pending', priority: 'medium', documents: ['gazette_notification.pdf', 'id_proof.pdf'] },
  { id: 'af2', type: 'transfer', title: 'Inter-University Transfer — Meera Joshi to JNU', description: 'Outgoing transfer request. Student has secured admission at JNU for M.A. Political Science.', submittedBy: 'Student Affairs', submittedAt: new Date('2026-03-05'), status: 'pending', priority: 'high', documents: ['jnu_admission_letter.pdf'] },
  { id: 'af3', type: 'certificate', title: 'Duplicate Mark Sheet Request — Batch 2020', description: '3 alumni requesting duplicate mark sheets due to damage/loss. Verification completed.', submittedBy: 'Certificate Section', submittedAt: new Date('2026-03-04'), status: 'pending', priority: 'low', documents: ['fir_copies.pdf', 'affidavits.pdf'] },
  { id: 'af4', type: 'recruitment', title: 'Faculty Selection Committee Report — ECE Dept', description: 'Selection committee recommends 2 candidates for Assistant Professor positions. Awaiting Registrar approval to forward to VC.', submittedBy: 'HR Office', submittedAt: new Date('2026-03-03'), status: 'pending', priority: 'high', forwardedTo: 'Vice Chancellor', documents: ['selection_report.pdf'] },
  { id: 'af5', type: 'policy', title: 'Revised Examination Guidelines — NEP 2020 Compliance', description: 'Updated examination guidelines incorporating continuous assessment as per NEP 2020. Needs Registrar review before circulation.', submittedBy: 'CoE Office', submittedAt: new Date('2026-03-02'), status: 'pending', priority: 'urgent', documents: ['exam_guidelines_v3.pdf'] },
  { id: 'af6', type: 'budget', title: 'Annual Stationery & Printing Budget FY 2026-27', description: 'Budget proposal for printing of certificates, mark sheets, and office stationery.', submittedBy: 'Admin Section', submittedAt: new Date('2026-03-01'), status: 'approved', priority: 'medium' },
  { id: 'af7', type: 'general', title: 'UGC Compliance Report — Anti-Ragging Committee', description: 'Annual report on anti-ragging measures to be submitted to UGC portal.', submittedBy: 'Student Welfare', submittedAt: new Date('2026-02-28'), status: 'in_progress', priority: 'high', documents: ['anti_ragging_report.pdf'] },
];

export const studentRecords: StudentRecord[] = [
  { id: 'sr1', name: 'Arjun Reddy', rollNo: 'CSE-2023-001', program: 'B.Tech CSE', department: 'Computer Science', batch: '2023-27', admissionDate: new Date('2023-08-01'), status: 'active', cgpa: 8.7, email: 'arjun.reddy@student.edu', phone: '+91-9876543210', address: '45, MG Road, Hyderabad', fatherName: 'Ramesh Reddy', dob: new Date('2005-05-15'), category: 'OBC', bloodGroup: 'B+' },
  { id: 'sr2', name: 'Priya Sharma', rollNo: 'ECE-2022-045', program: 'B.Tech ECE', department: 'Electronics', batch: '2022-26', admissionDate: new Date('2022-08-01'), status: 'active', cgpa: 9.1, email: 'priya.sharma@student.edu', phone: '+91-9876543211', address: '12, Sector 15, Noida', fatherName: 'Anil Sharma', dob: new Date('2004-03-22'), category: 'General', bloodGroup: 'A+' },
  { id: 'sr3', name: 'Rahul Verma', rollNo: 'ME-2024-102', program: 'B.Tech Mechanical', department: 'Mechanical', batch: '2024-28', admissionDate: new Date('2024-08-01'), status: 'active', cgpa: 7.9, email: 'rahul.verma@student.edu', phone: '+91-9876543212', address: '78, Civil Lines, Jaipur', fatherName: 'Suresh Verma', dob: new Date('2006-11-08'), category: 'SC', bloodGroup: 'O+' },
  { id: 'sr4', name: 'Ananya Gupta', rollNo: 'MBA-2024-015', program: 'MBA', department: 'Business Admin', batch: '2024-26', admissionDate: new Date('2024-07-15'), status: 'active', cgpa: 8.3, email: 'ananya.gupta@student.edu', phone: '+91-9876543213', address: '23, Park Street, Kolkata', fatherName: 'Vikash Gupta', dob: new Date('2002-09-30'), category: 'General', bloodGroup: 'AB+' },
  { id: 'sr5', name: 'Karan Singh', rollNo: 'CSE-2021-033', program: 'B.Tech CSE', department: 'Computer Science', batch: '2021-25', admissionDate: new Date('2021-08-01'), status: 'graduated', cgpa: 8.9, email: 'karan.singh@alumni.edu', phone: '+91-9876543214', address: '56, Rajpur Road, Dehradun', fatherName: 'Hardev Singh', dob: new Date('2003-01-14'), category: 'General', bloodGroup: 'B-' },
  { id: 'sr6', name: 'Meera Joshi', rollNo: 'POL-2023-012', program: 'B.A. Political Science', department: 'Humanities', batch: '2023-26', admissionDate: new Date('2023-08-01'), status: 'active', cgpa: 7.5, email: 'meera.joshi@student.edu', phone: '+91-9876543215', address: '11, Connaught Place, Delhi', fatherName: 'Prakash Joshi', dob: new Date('2005-07-19'), category: 'OBC', bloodGroup: 'A-' },
];

export const recordChangeRequests: RecordChangeRequest[] = [
  { id: 'rcr1', studentId: 'sr1', studentName: 'Arjun Reddy', field: 'Name', oldValue: 'Arjun Reddy', newValue: 'Arjun Kumar Reddy', reason: 'As per updated Aadhaar card and Gazette notification', requestedBy: 'Student Self-Service', requestedAt: new Date('2026-03-06'), status: 'pending', documents: ['aadhaar_updated.pdf', 'gazette.pdf'] },
  { id: 'rcr2', studentId: 'sr2', studentName: 'Priya Sharma', field: 'Date of Birth', oldValue: '22-03-2004', newValue: '22-03-2003', reason: 'Error in original admission form. School certificate submitted as proof.', requestedBy: 'Admission Office', requestedAt: new Date('2026-03-04'), status: 'pending', documents: ['school_certificate.pdf'] },
  { id: 'rcr3', studentId: 'sr3', studentName: 'Rahul Verma', field: 'Category', oldValue: 'SC', newValue: 'ST', reason: 'Corrected caste certificate issued by District Magistrate', requestedBy: 'Student Affairs', requestedAt: new Date('2026-03-02'), status: 'pending', documents: ['caste_cert_corrected.pdf'] },
];

export const transferRequests: TransferRequest[] = [
  { id: 'tr1', studentId: 'sr6', studentName: 'Meera Joshi', type: 'outgoing', fromInstitution: 'Our University', toInstitution: 'JNU, New Delhi', program: 'M.A. Political Science', reason: 'Secured admission for higher studies', status: 'pending', requestedAt: new Date('2026-03-05'), documents: ['jnu_admission.pdf', 'no_dues.pdf'] },
  { id: 'tr2', studentId: '', studentName: 'Ravi Kumar', type: 'incoming', fromInstitution: 'NIT Warangal', toInstitution: 'Our University', program: 'B.Tech CSE (Lateral Entry)', reason: 'Family relocation to Delhi NCR', status: 'pending', requestedAt: new Date('2026-03-03'), documents: ['nit_transcript.pdf', 'migration_cert.pdf', 'transfer_cert.pdf'] },
  { id: 'tr3', studentId: '', studentName: 'Sneha Patel', type: 'outgoing', fromInstitution: 'Our University', toInstitution: 'IIT Bombay', program: 'M.Tech', reason: 'GATE qualified, admission at IIT Bombay', status: 'noc_issued', requestedAt: new Date('2026-02-20'), documents: ['gate_scorecard.pdf', 'iitb_offer.pdf'] },
];

export const degreeRecords: DegreeRecord[] = [
  { id: 'dr1', studentName: 'Karan Singh', rollNo: 'CSE-2021-033', program: 'B.Tech CSE', department: 'Computer Science', graduationYear: 2025, certificateNo: 'DEG-2025-0001', status: 'generated', convocationDate: new Date('2026-04-15'), verificationCount: 0 },
  { id: 'dr2', studentName: 'Divya Nair', rollNo: 'ECE-2021-018', program: 'B.Tech ECE', department: 'Electronics', graduationYear: 2025, certificateNo: 'DEG-2025-0002', status: 'printed', convocationDate: new Date('2026-04-15'), verificationCount: 1 },
  { id: 'dr3', studentName: 'Amit Patel', rollNo: 'ME-2021-055', program: 'B.Tech Mechanical', department: 'Mechanical', graduationYear: 2025, certificateNo: 'DEG-2025-0003', status: 'eligible', convocationDate: new Date('2026-04-15'), verificationCount: 0 },
  { id: 'dr4', studentName: 'Sonal Mishra', rollNo: 'MBA-2023-008', program: 'MBA', department: 'Business Admin', graduationYear: 2025, certificateNo: 'DEG-2025-0004', status: 'collected', convocationDate: new Date('2026-04-15'), collectedAt: new Date('2026-02-10'), verificationCount: 2 },
  { id: 'dr5', studentName: 'Vikas Yadav', rollNo: 'CSE-2021-042', program: 'B.Tech CSE', department: 'Computer Science', graduationYear: 2025, certificateNo: 'DEG-2025-0005', status: 'dispatched', convocationDate: new Date('2026-04-15'), verificationCount: 1 },
];

export const examProgress: ExamProgress[] = [
  { id: 'ep1', examName: 'End Semester Examination', semester: 'Semester V', program: 'B.Tech (All Branches)', totalStudents: 1800, marksEntered: 1440, resultsPublished: false, status: 'mark_entry', startDate: new Date('2026-02-01'), endDate: new Date('2026-02-28'), coordinator: 'Dr. Anil Kumar' },
  { id: 'ep2', examName: 'End Semester Examination', semester: 'Semester III', program: 'B.Tech (All Branches)', totalStudents: 2100, marksEntered: 2100, resultsPublished: false, status: 'moderation', startDate: new Date('2026-02-01'), endDate: new Date('2026-02-25'), coordinator: 'Dr. Priya Sen' },
  { id: 'ep3', examName: 'End Semester Examination', semester: 'Semester I', program: 'MBA', totalStudents: 120, marksEntered: 120, resultsPublished: true, status: 'published', startDate: new Date('2026-01-15'), endDate: new Date('2026-02-10'), coordinator: 'Prof. Ramesh Jha' },
  { id: 'ep4', examName: 'Supplementary Examination', semester: 'Sem IV', program: 'B.Tech CSE/ECE', totalStudents: 85, marksEntered: 0, resultsPublished: false, status: 'scheduling', startDate: new Date('2026-03-15'), endDate: new Date('2026-03-30'), coordinator: 'Dr. Anil Kumar' },
];

export const adminDocuments: AdminDocument[] = [
  { id: 'ad1', title: 'UGC Regulations on Academic Standards 2025', category: 'ugc_communication', uploadedBy: 'Registrar Office', uploadedAt: new Date('2026-02-15'), fileSize: '2.4 MB', tags: ['UGC', 'Regulations', 'NEP'], isConfidential: false, accessRoles: ['all'] },
  { id: 'ad2', title: 'Minutes — 46th Board of Management Meeting', category: 'minutes', uploadedBy: 'Registrar', uploadedAt: new Date('2026-01-20'), fileSize: '1.8 MB', tags: ['BoM', 'Minutes', 'Governance'], isConfidential: true, accessRoles: ['registrar', 'vice_chancellor', 'pro_vc'] },
  { id: 'ad3', title: 'Government Order — Fee Regulation for Private Universities 2026', category: 'government_order', uploadedBy: 'Legal Cell', uploadedAt: new Date('2026-02-01'), fileSize: '3.1 MB', tags: ['Fee', 'Government', 'Regulation'], isConfidential: false, accessRoles: ['all'] },
  { id: 'ad4', title: 'Circular — Revised Leave Policy for Teaching Staff', category: 'circular', uploadedBy: 'HR Office', uploadedAt: new Date('2026-01-10'), fileSize: '0.5 MB', tags: ['HR', 'Leave', 'Policy'], isConfidential: false, accessRoles: ['all'] },
  { id: 'ad5', title: 'NAAC SSR — Self Study Report (Draft v3)', category: 'policy', uploadedBy: 'IQAC', uploadedAt: new Date('2026-03-01'), fileSize: '15.2 MB', tags: ['NAAC', 'SSR', 'Accreditation'], isConfidential: true, accessRoles: ['registrar', 'vice_chancellor', 'iqac_coordinator'] },
  { id: 'ad6', title: 'Internal Audit Report FY 2024-25', category: 'audit_report', uploadedBy: 'Finance Office', uploadedAt: new Date('2026-01-05'), fileSize: '8.7 MB', tags: ['Audit', 'Finance', 'FY2025'], isConfidential: true, accessRoles: ['registrar', 'vice_chancellor', 'finance_officer'] },
  { id: 'ad7', title: 'Notification — Academic Calendar 2026-27', category: 'notification', uploadedBy: 'Academic Section', uploadedAt: new Date('2026-02-20'), fileSize: '0.8 MB', tags: ['Calendar', 'Academic', 'Schedule'], isConfidential: false, accessRoles: ['all'] },
];

export const vacancies: Vacancy[] = [
  { id: 'v1', position: 'Assistant Professor', department: 'Computer Science', type: 'teaching', sanctioned: 40, filled: 35, status: 'interview_scheduled', postedAt: new Date('2026-01-15'), lastDate: new Date('2026-02-15'), applicants: 142 },
  { id: 'v2', position: 'Associate Professor', department: 'Electronics', type: 'teaching', sanctioned: 30, filled: 26, status: 'shortlisted', postedAt: new Date('2026-01-20'), lastDate: new Date('2026-02-20'), applicants: 78 },
  { id: 'v3', position: 'Lab Technician', department: 'Physics', type: 'non_teaching', sanctioned: 5, filled: 3, status: 'advertised', postedAt: new Date('2026-03-01'), lastDate: new Date('2026-03-31'), applicants: 25 },
  { id: 'v4', position: 'System Administrator', department: 'IT Services', type: 'non_teaching', sanctioned: 3, filled: 2, status: 'selected', postedAt: new Date('2026-01-01'), applicants: 95 },
  { id: 'v5', position: 'Professor', department: 'Mechanical', type: 'teaching', sanctioned: 8, filled: 6, status: 'applications_received', postedAt: new Date('2026-02-10'), lastDate: new Date('2026-03-10'), applicants: 34 },
];

export const accreditationChecklist: AccreditationChecklist[] = [
  { id: 'ac1', framework: 'NAAC', criterion: 'Criterion 1 — Curricular Aspects', description: 'Upload curriculum design documents, BoS minutes, and CBCS structure', responsibleOffice: 'Dean Academics', status: 'submitted', documents: ['bos_minutes.pdf', 'cbcs_structure.pdf'], deadline: new Date('2026-03-20'), remarks: 'All 5 sub-criteria completed' },
  { id: 'ac2', framework: 'NAAC', criterion: 'Criterion 2 — Teaching-Learning & Evaluation', description: 'Student-teacher ratio, mentor-mentee records, ICT usage reports', responsibleOffice: 'All HODs', status: 'in_progress', documents: ['ict_report.pdf'], deadline: new Date('2026-03-20'), remarks: '3 of 6 sub-criteria done' },
  { id: 'ac3', framework: 'NAAC', criterion: 'Criterion 3 — Research, Innovation & Extension', description: 'Research publications, patents, funded projects, extension activities', responsibleOffice: 'R&D Cell', status: 'in_progress', documents: [], deadline: new Date('2026-03-20'), remarks: 'Waiting for publication data from departments' },
  { id: 'ac4', framework: 'NAAC', criterion: 'Criterion 5 — Student Support & Progression', description: 'Scholarships, placement data, alumni feedback, student activities', responsibleOffice: 'Student Welfare / TPO', status: 'not_started', documents: [], deadline: new Date('2026-03-20') },
  { id: 'ac5', framework: 'NAAC', criterion: 'Criterion 6 — Governance, Leadership & Management', description: 'Organogram, strategic plan, e-governance adoption, financial audits', responsibleOffice: 'Registrar Office', status: 'in_progress', documents: ['organogram.pdf', 'strategic_plan.pdf'], deadline: new Date('2026-03-20') },
  { id: 'ac6', framework: 'NIRF', criterion: 'Teaching, Learning & Resources (TLR)', description: 'Faculty data, financial resources, student strength by program', responsibleOffice: 'IQAC', status: 'submitted', documents: ['nirf_tlr_data.xlsx'], deadline: new Date('2026-03-15') },
  { id: 'ac7', framework: 'NIRF', criterion: 'Research & Professional Practice (RP)', description: 'Publications, patents, sponsored projects, consultancy', responsibleOffice: 'R&D Cell', status: 'not_started', documents: [], deadline: new Date('2026-03-15') },
  { id: 'ac8', framework: 'UGC', criterion: 'Annual Quality Assurance Report', description: 'AQAR submission for FY 2025-26', responsibleOffice: 'IQAC', status: 'in_progress', documents: ['aqar_draft.pdf'], deadline: new Date('2026-06-30') },
];

export const verificationRequests: VerificationRequest[] = [
  { id: 'vr1', type: 'employer', requesterName: 'TCS HR Department', requesterOrg: 'Tata Consultancy Services', studentName: 'Karan Singh', studentId: 'CSE-2021-033', details: 'Please verify B.Tech CSE degree (2025 batch), CGPA, and no disciplinary actions.', status: 'pending', receivedAt: new Date('2026-03-07') },
  { id: 'vr2', type: 'transcript', requesterName: 'Amit Patel', requesterOrg: 'Self (Alumni)', studentName: 'Amit Patel', studentId: 'ME-2021-055', details: 'Request for consolidated transcript for MS application at TU Munich.', status: 'processing', receivedAt: new Date('2026-03-05') },
  { id: 'vr3', type: 'rti', requesterName: 'Public Information Officer', requesterOrg: 'District Office, Delhi', studentName: 'N/A', studentId: '', details: 'RTI query regarding number of SC/ST students admitted in last 3 years and scholarship disbursement data.', status: 'pending', receivedAt: new Date('2026-03-04') },
  { id: 'vr4', type: 'employer', requesterName: 'Infosys Recruitment', requesterOrg: 'Infosys Ltd', studentName: 'Priya Sharma', studentId: 'ECE-2022-045', details: 'Background verification for campus placement offer.', status: 'responded', receivedAt: new Date('2026-02-28'), respondedAt: new Date('2026-03-01'), response: 'Verified: Active student, 4th year B.Tech ECE, CGPA 9.1, no disciplinary record.' },
];

export const establishmentSummary: EstablishmentSummary = {
  totalSanctioned: 950,
  totalFilled: 812,
  teaching: { sanctioned: 550, filled: 480 },
  nonTeaching: { sanctioned: 400, filled: 332 },
  pendingPromotions: 12,
  pendingRetirements: 5,
  activeRecruitments: 8,
};
