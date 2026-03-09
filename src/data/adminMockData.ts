import type { SystemUser, AuditLog, SystemHealth, AcademicYearConfig, DepartmentConfig, ModuleConfig, SystemNotification, BackupRecord, UserActivity } from '@/types/admin';

export const systemHealth: SystemHealth = {
  uptime: '45d 12h 33m',
  cpuUsage: 34,
  memoryUsage: 62,
  diskUsage: 48,
  activeUsers: 342,
  totalUsers: 15847,
  databaseSize: '28.4 GB',
  lastBackup: new Date('2026-03-09T02:00:00'),
  apiResponseTime: 142,
  errorRate: 0.3,
};

export const systemUsers: SystemUser[] = [
  { id: 'U001', name: 'Dr. Ramesh Venkataraman', email: 'vc@university.edu', role: 'vice_chancellor', designation: 'Vice Chancellor', department: 'Administration', phone: '+91-9876543210', status: 'active', createdDate: new Date('2022-01-15'), lastLogin: new Date('2026-03-09T08:30:00'), loginCount: 1247 },
  { id: 'U002', name: 'Prof. Anita Sharma', email: 'registrar@university.edu', role: 'registrar', designation: 'Registrar', department: 'Administration', phone: '+91-9876543211', status: 'active', createdDate: new Date('2022-03-01'), lastLogin: new Date('2026-03-09T09:15:00'), loginCount: 2156 },
  { id: 'U003', name: 'Dr. Rajesh Kumar', email: 'rajesh.cs@university.edu', role: 'hod', designation: 'HOD - Computer Science', department: 'Computer Science', phone: '+91-9876543212', status: 'active', createdDate: new Date('2023-06-15'), lastLogin: new Date('2026-03-08T17:45:00'), loginCount: 892 },
  { id: 'U004', name: 'Dr. Meena Nair', email: 'meena.ee@university.edu', role: 'faculty', designation: 'Associate Professor', department: 'Electrical Engineering', phone: '+91-9876543213', status: 'active', createdDate: new Date('2023-08-01'), lastLogin: new Date('2026-03-09T07:20:00'), loginCount: 654 },
  { id: 'U005', name: 'Arun Patel', email: 'arun.student@university.edu', role: 'student', designation: 'B.Tech CS - 3rd Year', department: 'Computer Science', status: 'active', createdDate: new Date('2024-08-15'), lastLogin: new Date('2026-03-09T10:00:00'), loginCount: 423 },
  { id: 'U006', name: 'Prof. Sunita Rao', email: 'dean.science@university.edu', role: 'dean', designation: 'Dean - Faculty of Science', department: 'Science', phone: '+91-9876543214', status: 'active', createdDate: new Date('2022-07-01'), lastLogin: new Date('2026-03-07T14:30:00'), loginCount: 567 },
  { id: 'U007', name: 'Mr. Vikram Singh', email: 'finance@university.edu', role: 'finance_officer', designation: 'Finance Officer', department: 'Finance', phone: '+91-9876543215', status: 'active', createdDate: new Date('2022-04-01'), lastLogin: new Date('2026-03-09T09:00:00'), loginCount: 1890 },
  { id: 'U008', name: 'Dr. Priya Kapoor', email: 'placement@university.edu', role: 'placement_officer', designation: 'Placement Officer', department: 'T&P Cell', status: 'suspended', createdDate: new Date('2024-01-10'), lastLogin: new Date('2026-02-15T11:00:00'), loginCount: 234 },
  { id: 'U009', name: 'Mr. Harish Menon', email: 'sports@university.edu', role: 'sports_director', designation: 'Sports Director', department: 'Sports', status: 'active', createdDate: new Date('2023-09-01'), lastLogin: new Date('2026-03-08T16:00:00'), loginCount: 312 },
  { id: 'U010', name: 'Ms. Kavita Joshi', email: 'alumni@university.edu', role: 'alumni_officer', designation: 'Alumni Relations Officer', department: 'Alumni Cell', status: 'inactive', createdDate: new Date('2024-06-01'), lastLogin: new Date('2025-12-20T10:00:00'), loginCount: 89 },
];

export const auditLogs: AuditLog[] = [
  { id: 'AL001', userId: 'U001', userName: 'Dr. Ramesh Venkataraman', role: 'vice_chancellor', action: 'approve', module: 'Governance', resource: 'Budget Proposal FY2026-27', details: 'Approved annual budget of ₹142 Cr', ipAddress: '192.168.1.101', timestamp: new Date('2026-03-09T08:45:00'), severity: 'info' },
  { id: 'AL002', userId: 'U002', userName: 'Prof. Anita Sharma', role: 'registrar', action: 'export', module: 'Student Records', resource: 'Convocation List 2026', details: 'Exported 1,847 graduate records for convocation', ipAddress: '192.168.1.102', timestamp: new Date('2026-03-09T09:20:00'), severity: 'info' },
  { id: 'AL003', userId: 'admin-001', userName: 'System Administrator', role: 'super_admin', action: 'update', module: 'System Config', resource: 'Academic Calendar', details: 'Updated exam dates for Even Semester 2026', ipAddress: '192.168.1.100', timestamp: new Date('2026-03-08T14:30:00'), severity: 'warning' },
  { id: 'AL004', userId: 'U004', userName: 'Dr. Meena Nair', role: 'faculty', action: 'create', module: 'Academics', resource: 'Assignment – EE301', details: 'Created new assignment for Power Systems course', ipAddress: '192.168.2.45', timestamp: new Date('2026-03-08T11:15:00'), severity: 'info' },
  { id: 'AL005', userId: 'unknown', userName: 'Unknown', role: 'student', action: 'login', module: 'Authentication', resource: 'Login Attempt', details: 'Failed login – invalid credentials (3 attempts)', ipAddress: '10.0.0.55', timestamp: new Date('2026-03-08T23:45:00'), severity: 'critical' },
  { id: 'AL006', userId: 'U007', userName: 'Mr. Vikram Singh', role: 'finance_officer', action: 'approve', module: 'Finance', resource: 'Purchase Order PO-2026-0892', details: 'Approved lab equipment purchase – ₹4.8L', ipAddress: '192.168.1.107', timestamp: new Date('2026-03-07T16:00:00'), severity: 'info' },
  { id: 'AL007', userId: 'admin-001', userName: 'System Administrator', role: 'super_admin', action: 'delete', module: 'User Management', resource: 'User Account', details: 'Deleted inactive test account test@university.edu', ipAddress: '192.168.1.100', timestamp: new Date('2026-03-07T10:30:00'), severity: 'warning' },
  { id: 'AL008', userId: 'U003', userName: 'Dr. Rajesh Kumar', role: 'hod', action: 'update', module: 'Faculty', resource: 'Workload Allocation', details: 'Reassigned 2 courses from Dr. Sharma to Dr. Gupta', ipAddress: '192.168.2.30', timestamp: new Date('2026-03-06T15:20:00'), severity: 'info' },
];

export const userActivities: UserActivity[] = [
  { id: 'UA001', userId: 'U001', userName: 'Dr. Ramesh Venkataraman', action: 'Viewed Dashboard', module: 'VC Portal', details: 'Accessed system analytics', ipAddress: '192.168.1.101', timestamp: new Date('2026-03-09T08:30:00'), status: 'success' },
  { id: 'UA002', userId: 'U002', userName: 'Prof. Anita Sharma', action: 'Generated Certificate', module: 'Registrar', details: 'Batch generated 45 degree certificates', ipAddress: '192.168.1.102', timestamp: new Date('2026-03-09T09:15:00'), status: 'success' },
  { id: 'UA003', userId: 'U005', userName: 'Arun Patel', action: 'Submitted Assignment', module: 'Student Portal', details: 'Submitted DS Lab Assignment 4', ipAddress: '10.0.1.23', timestamp: new Date('2026-03-09T10:05:00'), status: 'success' },
  { id: 'UA004', userId: 'unknown', userName: 'Unknown IP', action: 'Failed Login', module: 'Auth', details: 'Brute force attempt detected', ipAddress: '10.0.0.55', timestamp: new Date('2026-03-08T23:45:00'), status: 'failed' },
];

export const academicYears: AcademicYearConfig[] = [
  {
    id: 'AY001', year: '2025-26', startDate: new Date('2025-07-01'), endDate: new Date('2026-06-30'), isCurrent: true, status: 'active',
    semesters: [
      { id: 'S1', name: 'Odd Semester', startDate: new Date('2025-07-15'), endDate: new Date('2025-12-15'), registrationDeadline: new Date('2025-07-31'), examStartDate: new Date('2025-12-01'), examEndDate: new Date('2025-12-15'), status: 'completed' },
      { id: 'S2', name: 'Even Semester', startDate: new Date('2026-01-10'), endDate: new Date('2026-06-15'), registrationDeadline: new Date('2026-01-25'), examStartDate: new Date('2026-05-15'), examEndDate: new Date('2026-06-10'), status: 'active' },
    ],
  },
  {
    id: 'AY002', year: '2026-27', startDate: new Date('2026-07-01'), endDate: new Date('2027-06-30'), isCurrent: false, status: 'upcoming',
    semesters: [
      { id: 'S3', name: 'Odd Semester', startDate: new Date('2026-07-15'), endDate: new Date('2026-12-15'), registrationDeadline: new Date('2026-07-31'), status: 'upcoming' },
    ],
  },
];

export const departments: DepartmentConfig[] = [
  { id: 'D001', name: 'Computer Science & Engineering', code: 'CSE', hod: 'Dr. Rajesh Kumar', faculty: 32, students: 580, programs: 4, established: 1995, status: 'active' },
  { id: 'D002', name: 'Electrical Engineering', code: 'EE', hod: 'Dr. Meena Nair', faculty: 28, students: 420, programs: 3, established: 1990, status: 'active' },
  { id: 'D003', name: 'Mechanical Engineering', code: 'ME', hod: 'Dr. Suresh Patel', faculty: 30, students: 460, programs: 3, established: 1988, status: 'active' },
  { id: 'D004', name: 'Civil Engineering', code: 'CE', hod: 'Dr. Anuradha Joshi', faculty: 22, students: 350, programs: 3, established: 1988, status: 'active' },
  { id: 'D005', name: 'Electronics & Communication', code: 'ECE', hod: 'Dr. Vikram Reddy', faculty: 26, students: 390, programs: 3, established: 1992, status: 'active' },
  { id: 'D006', name: 'Information Technology', code: 'IT', hod: 'Dr. Priya Menon', faculty: 18, students: 320, programs: 2, established: 2002, status: 'active' },
  { id: 'D007', name: 'Physics', code: 'PHY', hod: 'Dr. Arvind Mishra', faculty: 15, students: 180, programs: 2, established: 1985, status: 'active' },
  { id: 'D008', name: 'Mathematics', code: 'MATH', hod: 'Dr. Sunita Das', faculty: 12, students: 150, programs: 2, established: 1985, status: 'active' },
  { id: 'D009', name: 'Biotechnology', code: 'BT', hod: 'Dr. Kavita Sharma', faculty: 14, students: 200, programs: 2, established: 2005, status: 'active' },
  { id: 'D010', name: 'Architecture', code: 'ARCH', hod: 'Dr. Raman Gupta', faculty: 10, students: 120, programs: 1, established: 2010, status: 'inactive' },
];

export const moduleConfigs: ModuleConfig[] = [
  { id: 'MOD01', name: 'Academics', description: 'Programs, curriculum, timetable, attendance management', icon: 'GraduationCap', enabled: true, roles: ['super_admin','vice_chancellor','dean','hod','faculty','student'], subModules: [{ id: 'SM01', name: 'Programs & Curriculum', enabled: true, path: '/academics/programs' }, { id: 'SM02', name: 'Timetable', enabled: true, path: '/academics/timetable' }, { id: 'SM03', name: 'Attendance', enabled: true, path: '/academics/attendance' }], lastUpdated: new Date('2026-02-15') },
  { id: 'MOD02', name: 'Examinations', description: 'Exam scheduling, results, mark sheets, grade management', icon: 'ClipboardList', enabled: true, roles: ['super_admin','registrar','dean','hod','faculty','student'], subModules: [{ id: 'SM04', name: 'Exam Schedule', enabled: true, path: '/examinations/schedule' }, { id: 'SM05', name: 'Results', enabled: true, path: '/examinations/results' }], lastUpdated: new Date('2026-01-20') },
  { id: 'MOD03', name: 'Finance', description: 'Fee management, payroll, budgets, procurement', icon: 'Wallet', enabled: true, roles: ['super_admin','finance_officer','registrar','vice_chancellor'], subModules: [{ id: 'SM06', name: 'Fee Management', enabled: true, path: '/finance/fees' }, { id: 'SM07', name: 'Payroll', enabled: true, path: '/finance/payroll' }, { id: 'SM08', name: 'Budgets', enabled: true, path: '/finance/budgets' }], lastUpdated: new Date('2026-03-01') },
  { id: 'MOD04', name: 'Research', description: 'Publications, projects, funding, patents', icon: 'Award', enabled: true, roles: ['super_admin','faculty','hod','dean','vice_chancellor'], subModules: [{ id: 'SM09', name: 'Publications', enabled: true, path: '/research/publications' }, { id: 'SM10', name: 'Projects', enabled: true, path: '/research/projects' }], lastUpdated: new Date('2026-02-28') },
  { id: 'MOD05', name: 'Library', description: 'Catalog, circulation, digital resources', icon: 'Library', enabled: true, roles: ['super_admin','student','faculty'], subModules: [{ id: 'SM11', name: 'Catalog', enabled: true, path: '/library/catalog' }, { id: 'SM12', name: 'E-Resources', enabled: false, path: '/library/e-resources' }], lastUpdated: new Date('2026-01-10') },
  { id: 'MOD06', name: 'Placements', description: 'Company drives, student profiles, training', icon: 'Briefcase', enabled: true, roles: ['super_admin','placement_officer','student'], subModules: [{ id: 'SM13', name: 'Drives', enabled: true, path: '/placement/drives' }, { id: 'SM14', name: 'Training', enabled: true, path: '/placement/training' }], lastUpdated: new Date('2026-03-05') },
  { id: 'MOD07', name: 'Sports', description: 'Athletes, teams, facilities, events', icon: 'Trophy', enabled: true, roles: ['super_admin','sports_director','student'], subModules: [{ id: 'SM15', name: 'Athletes', enabled: true, path: '/sports/athletes' }, { id: 'SM16', name: 'Facilities', enabled: true, path: '/sports/facilities' }], lastUpdated: new Date('2026-02-20') },
  { id: 'MOD08', name: 'Hostel & Transport', description: 'Room allocation, mess, bus routes', icon: 'Building2', enabled: false, roles: ['super_admin','student'], subModules: [{ id: 'SM17', name: 'Room Allocation', enabled: false, path: '/hostel/rooms' }], lastUpdated: new Date('2025-12-01') },
];

export const systemNotifications: SystemNotification[] = [
  { id: 'N001', title: 'System Maintenance – March 15', message: 'Scheduled maintenance window from 2:00 AM to 5:00 AM IST. ERP will be unavailable.', type: 'warning', targetRoles: ['super_admin','vice_chancellor','registrar','dean','hod','faculty','student','finance_officer','placement_officer','sports_director','alumni_officer','iqac_coordinator','grievance_officer','security_officer','pro_vc'], sentBy: 'System Administrator', sentDate: new Date('2026-03-08'), readCount: 8420, totalRecipients: 15847, status: 'sent' },
  { id: 'N002', title: 'Even Semester Registration Deadline', message: 'Last date for course registration is January 25, 2026. Students with pending fees will not be able to register.', type: 'info', targetRoles: ['student','faculty','hod'], sentBy: 'Registrar Office', sentDate: new Date('2026-01-15'), readCount: 11200, totalRecipients: 12458, status: 'sent' },
  { id: 'N003', title: 'NAAC Peer Team Visit', message: 'NAAC Peer Team visit scheduled for April 15-17, 2026. All departments must ensure documentation readiness.', type: 'info', targetRoles: ['vice_chancellor','dean','hod','iqac_coordinator','registrar'], sentBy: 'IQAC Cell', sentDate: new Date('2026-03-05'), readCount: 42, totalRecipients: 58, status: 'sent' },
];

export const backupRecords: BackupRecord[] = [
  { id: 'BK001', type: 'full', size: '28.4 GB', createdDate: new Date('2026-03-09T02:00:00'), status: 'completed', duration: '45 min', initiatedBy: 'Automated', location: 'AWS S3 – ap-south-1' },
  { id: 'BK002', type: 'incremental', size: '1.2 GB', createdDate: new Date('2026-03-08T02:00:00'), status: 'completed', duration: '8 min', initiatedBy: 'Automated', location: 'AWS S3 – ap-south-1' },
  { id: 'BK003', type: 'database', size: '12.6 GB', createdDate: new Date('2026-03-07T03:00:00'), status: 'completed', duration: '22 min', initiatedBy: 'System Administrator', location: 'Local NAS' },
  { id: 'BK004', type: 'full', size: '27.8 GB', createdDate: new Date('2026-03-02T02:00:00'), status: 'completed', duration: '43 min', initiatedBy: 'Automated', location: 'AWS S3 – ap-south-1' },
  { id: 'BK005', type: 'incremental', size: '0.8 GB', createdDate: new Date('2026-03-09T14:00:00'), status: 'in_progress', duration: '—', initiatedBy: 'System Administrator', location: 'AWS S3 – ap-south-1' },
];
