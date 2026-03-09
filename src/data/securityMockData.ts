import type { SecurityIncident, IDCardRequest, VehiclePass, VisitorPass, SupportTicket, UserAccount, AuditLog, VigilanceCase } from '@/types/security';

export const securityIncidents: SecurityIncident[] = [
  { id: 'SI001', incidentNumber: 'INC-2026-0034', type: 'theft', location: 'Library – 2nd Floor', reportedDate: new Date('2026-03-07'), reportedBy: 'Library Staff', description: 'Laptop bag reported missing from reading area. CCTV footage being reviewed.', peopleInvolved: [
    { name: 'Arun Kumar', type: 'student', idNumber: 'STU2024088', role: 'complainant', statement: 'Left bag at seat for 10 minutes, found missing on return' },
  ], witnesses: [], actionTaken: 'CCTV footage collected, investigation ongoing', status: 'investigating', severity: 'moderate', investigatingOfficer: 'SI Rajan', evidenceFiles: ['CCTV_Clip.mp4'], followUpRequired: true, followUpDate: new Date('2026-03-10') },
  { id: 'SI002', incidentNumber: 'INC-2026-0035', type: 'medical', location: 'Sports Ground', reportedDate: new Date('2026-03-08'), reportedBy: 'Sports Coach', description: 'Student sustained ankle injury during cricket practice. First aid administered, referred to hospital.', peopleInvolved: [
    { name: 'Vikas Patel', type: 'student', idNumber: 'STU2023067', role: 'victim' },
  ], witnesses: [{ name: 'Ravi Shastri', contactNumber: '9876543300', statement: 'Student slipped while fielding', verified: true }], actionTaken: 'First aid provided, ambulance called, parents notified', status: 'resolved', severity: 'moderate', investigatingOfficer: 'Guard Suresh', evidenceFiles: [], followUpRequired: true, followUpDate: new Date('2026-03-12') },
];

export const idCardRequests: IDCardRequest[] = [
  { id: 'ID001', requestNumber: 'IDR-2026-0122', applicantId: 'STU2026001', applicantName: 'Riya Sharma', applicantType: 'student', requestType: 'new', requestDate: new Date('2026-03-05'), status: 'approved', feesPaid: true, documents: ['Photo.jpg', 'AdmissionLetter.pdf'] },
  { id: 'ID002', requestNumber: 'IDR-2026-0123', applicantId: 'STU2024055', applicantName: 'Amit Joshi', applicantType: 'student', requestType: 'replacement', reason: 'Lost during sports event', requestDate: new Date('2026-03-07'), status: 'pending', feesPaid: true, documents: ['FIR_Copy.pdf'] },
];

export const vehiclePasses: VehiclePass[] = [
  { id: 'VP001', passNumber: 'VP-2026-0456', ownerName: 'Dr. Rajesh Kumar', ownerType: 'faculty', ownerIdNumber: 'EMP001', vehicleType: 'four_wheeler', vehicleNumber: 'KA-01-AB-1234', vehicleModel: 'Honda City', validFrom: new Date('2025-07-01'), validUntil: new Date('2026-06-30'), parkingZone: 'Zone A – Faculty', status: 'active', feesPaid: true, documents: ['RC.pdf', 'Insurance.pdf'] },
  { id: 'VP002', passNumber: 'VP-2026-0789', ownerName: 'Rahul Sharma', ownerType: 'student', ownerIdNumber: 'STU2023045', vehicleType: 'two_wheeler', vehicleNumber: 'KA-05-EF-5678', vehicleModel: 'Honda Activa', validFrom: new Date('2025-07-01'), validUntil: new Date('2026-06-30'), parkingZone: 'Zone C – Students', status: 'active', feesPaid: true, documents: ['RC.pdf'] },
];

export const visitorPasses: VisitorPass[] = [
  { id: 'VIS001', passNumber: 'VISIT-2026-0089', visitorName: 'Mr. Ramesh Agarwal', contactNumber: '9876543310', organization: 'Agilent Technologies', purposeOfVisit: 'Lab Equipment Delivery & Installation', personToMeet: 'Dr. Anand Patel (Physics HOD)', departmentToVisit: 'Physics', expectedDate: new Date('2026-03-10'), expectedTime: '10:00 AM', duration: '4 hours', vehicleNumber: 'TS-09-CD-4567', requestedBy: 'Physics Dept', status: 'approved', escortRequired: false },
  { id: 'VIS002', passNumber: 'VISIT-2026-0090', visitorName: 'Ms. Pooja Desai', contactNumber: '9876543262', organization: 'Microsoft', purposeOfVisit: 'Pre-Placement Talk', personToMeet: 'Placement Officer', departmentToVisit: 'T&P Cell', expectedDate: new Date('2026-03-12'), expectedTime: '2:00 PM', duration: '3 hours', requestedBy: 'T&P Cell', status: 'approved', escortRequired: false },
];

export const supportTickets: SupportTicket[] = [
  { id: 'TK001', ticketNumber: 'TKT-2026-0234', reportedBy: 'Dr. Priya Nair', reporterType: 'faculty', contactInfo: 'priya.nair@univ.ac.in', category: 'software', priority: 'high', subject: 'ERP Grade Upload Not Working', description: 'Unable to upload marks for ECE 4th semester. System shows timeout error.', attachments: ['Screenshot.png'], assignedTo: 'IT Support – Suresh', status: 'in_progress', createdDate: new Date('2026-03-08'), lastUpdate: new Date('2026-03-09') },
  { id: 'TK002', ticketNumber: 'TKT-2026-0235', reportedBy: 'Rahul Gupta', reporterType: 'student', contactInfo: 'rahul.g@univ.ac.in', category: 'account', priority: 'medium', subject: 'Cannot Reset Password', description: 'Forgot password and reset link not received on email.', attachments: [], assignedTo: 'IT Support – Kavitha', status: 'open', createdDate: new Date('2026-03-09'), lastUpdate: new Date('2026-03-09') },
  { id: 'TK003', ticketNumber: 'TKT-2026-0233', reportedBy: 'Mr. Suresh (Accounts)', reporterType: 'staff', contactInfo: 'suresh.accounts@univ.ac.in', category: 'network', priority: 'urgent', subject: 'Accounts Server Unreachable', description: 'Finance module server down since 9 AM. Payroll processing blocked.', attachments: ['ErrorLog.txt'], assignedTo: 'IT Admin – Ravi', status: 'resolved', createdDate: new Date('2026-03-07'), lastUpdate: new Date('2026-03-07'), resolutionDate: new Date('2026-03-07'), resolutionNotes: 'Database connection pool exhausted. Restarted service and increased pool size.', satisfactionRating: 5 },
];

export const userAccounts: UserAccount[] = [
  { id: 'UA001', username: 'rajesh.kumar', email: 'rajesh.kumar@univ.ac.in', fullName: 'Dr. Rajesh Kumar', userType: 'faculty', roles: ['faculty', 'hod'], department: 'Computer Science', status: 'active', lastLogin: new Date('2026-03-09'), passwordLastChanged: new Date('2026-01-15'), failedLoginAttempts: 0, createdDate: new Date('2020-06-15'), permissions: [
    { module: 'Courses', actions: ['read', 'write', 'manage'] },
    { module: 'Attendance', actions: ['read', 'write'] },
    { module: 'Department', actions: ['read', 'write', 'manage'] },
  ]},
  { id: 'UA002', username: 'aisha.sharma', email: 'aisha.sharma@univ.ac.in', fullName: 'Aisha Sharma', userType: 'student', roles: ['student'], department: 'Computer Science', status: 'active', lastLogin: new Date('2026-03-08'), passwordLastChanged: new Date('2025-09-01'), failedLoginAttempts: 0, createdDate: new Date('2024-07-01'), permissions: [
    { module: 'Courses', actions: ['read'] },
    { module: 'Attendance', actions: ['read'] },
    { module: 'Fees', actions: ['read', 'pay'] },
  ]},
];

export const auditLogs: AuditLog[] = [
  { id: 'LOG001', timestamp: new Date('2026-03-09T10:15:00'), userId: 'rajesh.kumar', userRole: 'HOD', action: 'Grade Modified', module: 'Marks', recordId: 'MK-2026-CS301-045', oldValue: { marks: 72 }, newValue: { marks: 78 }, ipAddress: '192.168.1.45', success: true },
  { id: 'LOG002', timestamp: new Date('2026-03-09T09:30:00'), userId: 'finance.admin', userRole: 'Finance Officer', action: 'Payment Approved', module: 'Procurement', recordId: 'PO-2026-0041', oldValue: { status: 'pending' }, newValue: { status: 'approved', amount: 3200000 }, ipAddress: '192.168.1.22', success: true },
  { id: 'LOG003', timestamp: new Date('2026-03-08T16:45:00'), userId: 'unknown', userRole: 'N/A', action: 'Failed Login Attempt', module: 'Authentication', ipAddress: '103.45.67.89', success: false, errorMessage: 'Invalid credentials – 5th attempt, account locked' },
];

export const vigilanceCases: VigilanceCase[] = [
  { id: 'VC001', caseNumber: 'VIG-2026-0005', type: 'financial_irregularity', subject: 'Irregular Procurement Process', description: 'Audit identified a purchase order processed without required 3 quotations for amount exceeding ₹5 lakhs.', complainantType: 'internal_audit', dateReported: new Date('2026-02-20'), status: 'under_investigation', investigatingOfficer: 'Chief Vigilance Officer', documentsCollected: ['PO_Copy.pdf', 'AuditReport.pdf'], peopleInterviewed: [
    { personName: 'Purchase Officer', designation: 'Asst. Registrar', interviewDate: new Date('2026-02-25'), interviewSummary: 'Claimed urgency justified single-source procurement', keyPoints: ['Emergency procurement clause cited', 'No written approval from competent authority found'], followUpRequired: true },
  ], confidentialityLevel: 'high' },
];