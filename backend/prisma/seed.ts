import 'dotenv/config';
import bcrypt from 'bcrypt';
import { prisma } from '../src/lib/prisma.js';

const db: any = prisma;

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || 'Password@123';

const IDS = {
  departments: {
    cse: 'seed-dept-cse',
    ece: 'seed-dept-ece',
  },
  users: {
    superAdmin: 'seed-user-super-admin',
    student: 'seed-user-student',
    faculty: 'seed-user-faculty',
    finance: 'seed-user-finance',
    hod: 'seed-user-hod',
    dean: 'seed-user-dean',
    vc: 'seed-user-vc',
    proVc: 'seed-user-pro-vc',
    registrar: 'seed-user-registrar',
    coe: 'seed-user-coe',
    alumniOfficer: 'seed-user-alumni-officer',
    iqac: 'seed-user-iqac',
    placement: 'seed-user-placement',
    sports: 'seed-user-sports',
    grievance: 'seed-user-grievance',
    security: 'seed-user-security',
    librarian: 'seed-user-librarian',
  },
  student: {
    profile: 'seed-student-profile',
  },
  faculty: {
    profile: 'seed-faculty-profile',
  },
  alumni: {
    profile: 'seed-alumni-profile',
  },
  core: {
    course: 'seed-course-cse501',
    class: 'seed-class-cse501-a',
    schedule: 'seed-course-schedule-cse501',
    assignment: 'seed-assignment-cse501',
    exam: 'seed-exam-cse501',
    attendanceSession: 'seed-attendance-session-cse501',
  },
};

const day = 24 * 60 * 60 * 1000;
const daysFromNow = (offset: number): Date => new Date(Date.now() + offset * day);

async function assertSeedSchema() {
  const requiredTables = [
    'User',
    'Department',
    'StudentProfile',
    'FacultyProfile',
    'Course',
    'CourseClass',
    'Enrollment',
    'ClassEnrollment',
    'ModuleConfig',
    'AcademicYear',
    'SystemAuditLog',
    'SystemNotificationRecord',
    'Company',
    'PlacementDrive',
    'SportsTeam',
    'GrievanceCase',
    'IDCardRequest',
  ];

  const tableRows = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
  );

  const existingTables = new Set(tableRows.map((row) => row.tablename));
  const missingTables = requiredTables.filter((tableName) => !existingTables.has(tableName));

  if (missingTables.length > 0) {
    throw new Error(
      `Database schema is not up to date. Missing tables: ${missingTables.join(', ')}. ` +
        "Run your Prisma migrations (or prisma db push) before seeding."
    );
  }
}

async function upsertById(delegate: any, id: string, data: Record<string, unknown>) {
  return delegate.upsert({
    where: { id },
    update: data,
    create: { id, ...data },
  });
}

async function main() {
  await assertSeedSchema();

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  await prisma.department.upsert({
    where: { code: 'CSE' },
    update: { id: IDS.departments.cse, name: 'Computer Science and Engineering', code: 'CSE' },
    create: { id: IDS.departments.cse, name: 'Computer Science and Engineering', code: 'CSE' },
  });

  await prisma.department.upsert({
    where: { code: 'ECE' },
    update: { id: IDS.departments.ece, name: 'Electronics and Communication Engineering', code: 'ECE' },
    create: { id: IDS.departments.ece, name: 'Electronics and Communication Engineering', code: 'ECE' },
  });

  const userSeeds = [
    { id: IDS.users.superAdmin, name: 'System Administrator', email: 'superadmin@campusharmony.edu', role: 'super_admin', designation: 'Super Admin', departmentId: IDS.departments.cse },
    { id: IDS.users.student, name: 'Ananya Student', email: 'student@campusharmony.edu', role: 'student', designation: 'Student', departmentId: IDS.departments.cse },
    { id: IDS.users.faculty, name: 'Dr. Ravi Faculty', email: 'faculty@campusharmony.edu', role: 'faculty', designation: 'Professor', departmentId: IDS.departments.cse },
    { id: IDS.users.finance, name: 'Meera Finance', email: 'finance@campusharmony.edu', role: 'finance_officer', designation: 'Finance Officer', departmentId: IDS.departments.cse },
    { id: IDS.users.hod, name: 'Dr. Kiran HOD', email: 'hod@campusharmony.edu', role: 'hod', designation: 'Head of Department', departmentId: IDS.departments.cse },
    { id: IDS.users.dean, name: 'Dr. Isha Dean', email: 'dean@campusharmony.edu', role: 'dean', designation: 'Dean Academics', departmentId: IDS.departments.cse },
    { id: IDS.users.vc, name: 'Dr. A. Kumar', email: 'vc@campusharmony.edu', role: 'vice_chancellor', designation: 'Vice Chancellor', departmentId: IDS.departments.cse },
    { id: IDS.users.proVc, name: 'Dr. P. Nair', email: 'provc@campusharmony.edu', role: 'pro_vc', designation: 'Pro Vice Chancellor', departmentId: IDS.departments.cse },
    { id: IDS.users.registrar, name: 'Priya Registrar', email: 'registrar@campusharmony.edu', role: 'registrar', designation: 'Registrar', departmentId: IDS.departments.cse },
    { id: IDS.users.coe, name: 'Rahul COE', email: 'coe@campusharmony.edu', role: 'coe', designation: 'Controller of Examinations', departmentId: IDS.departments.cse },
    { id: IDS.users.alumniOfficer, name: 'Rohit Alumni', email: 'alumni@campusharmony.edu', role: 'alumni_officer', designation: 'Alumni Relations Officer', departmentId: IDS.departments.cse },
    { id: IDS.users.iqac, name: 'Farah IQAC', email: 'iqac@campusharmony.edu', role: 'iqac_coordinator', designation: 'IQAC Coordinator', departmentId: IDS.departments.cse },
    { id: IDS.users.placement, name: 'Nitin Placement', email: 'placement@campusharmony.edu', role: 'placement_officer', designation: 'Placement Officer', departmentId: IDS.departments.cse },
    { id: IDS.users.sports, name: 'Arjun Sports', email: 'sports@campusharmony.edu', role: 'sports_director', designation: 'Sports Director', departmentId: IDS.departments.cse },
    { id: IDS.users.grievance, name: 'Leena Grievance', email: 'grievance@campusharmony.edu', role: 'grievance_officer', designation: 'Grievance Officer', departmentId: IDS.departments.cse },
    { id: IDS.users.security, name: 'Kabir Security', email: 'security@campusharmony.edu', role: 'security_officer', designation: 'Chief Security Officer', departmentId: IDS.departments.cse },
    { id: IDS.users.librarian, name: 'Maya Librarian', email: 'librarian@campusharmony.edu', role: 'librarian', designation: 'Librarian', departmentId: IDS.departments.cse },
  ] as const;

  for (const user of userSeeds) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        id: user.id,
        name: user.name,
        role: user.role,
        password: hashedPassword,
        departmentId: user.departmentId,
        designation: user.designation,
        campus: 'Main Campus',
        avatar: null,
      },
      create: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        password: hashedPassword,
        departmentId: user.departmentId,
        designation: user.designation,
        campus: 'Main Campus',
      },
    });
  }

  await prisma.studentProfile.upsert({
    where: { userId: IDS.users.student },
    update: {
      id: IDS.student.profile,
      rollNumber: 'CH2024CS001',
      program: 'B.Tech',
      branch: 'Computer Science',
      semester: 5,
      section: 'A',
      batch: '2024',
      admissionYear: 2024,
      cgpa: 8.7,
      totalCredits: 110,
      earnedCredits: 92,
    },
    create: {
      id: IDS.student.profile,
      userId: IDS.users.student,
      rollNumber: 'CH2024CS001',
      program: 'B.Tech',
      branch: 'Computer Science',
      semester: 5,
      section: 'A',
      batch: '2024',
      admissionYear: 2024,
      cgpa: 8.7,
      totalCredits: 110,
      earnedCredits: 92,
    },
  });

  await prisma.facultyProfile.upsert({
    where: { userId: IDS.users.faculty },
    update: {
      id: IDS.faculty.profile,
      employeeId: 'EMP-CSE-1001',
      qualification: 'Ph.D. in Computer Science',
      specialization: 'Distributed Systems',
      experience: 12,
    },
    create: {
      id: IDS.faculty.profile,
      userId: IDS.users.faculty,
      employeeId: 'EMP-CSE-1001',
      qualification: 'Ph.D. in Computer Science',
      specialization: 'Distributed Systems',
      experience: 12,
    },
  });

  await prisma.alumniProfile.upsert({
    where: { userId: IDS.users.alumniOfficer },
    update: {
      id: IDS.alumni.profile,
      graduationYear: 2019,
      currentCompany: 'Campus Harmony University',
      currentRole: 'Alumni Officer',
      linkedIn: 'https://linkedin.com/in/alumni-officer',
    },
    create: {
      id: IDS.alumni.profile,
      userId: IDS.users.alumniOfficer,
      graduationYear: 2019,
      currentCompany: 'Campus Harmony University',
      currentRole: 'Alumni Officer',
      linkedIn: 'https://linkedin.com/in/alumni-officer',
    },
  });

  await prisma.course.upsert({
    where: { code: 'CSE501' },
    update: {
      id: IDS.core.course,
      name: 'Cloud Computing',
      credits: 4,
      semester: 5,
      departmentId: IDS.departments.cse,
      facultyId: IDS.faculty.profile,
    },
    create: {
      id: IDS.core.course,
      code: 'CSE501',
      name: 'Cloud Computing',
      credits: 4,
      semester: 5,
      departmentId: IDS.departments.cse,
      facultyId: IDS.faculty.profile,
    },
  });

  await upsertById(prisma.courseSchedule, IDS.core.schedule, {
    courseId: IDS.core.course,
    day: 'Monday',
    startTime: '10:00',
    endTime: '11:00',
    room: 'CSE-301',
    type: 'Lecture',
  });

  await prisma.enrollment.upsert({
    where: {
      studentProfileId_courseId: {
        studentProfileId: IDS.student.profile,
        courseId: IDS.core.course,
      },
    },
    update: {
      semester: 5,
      grade: 'A',
    },
    create: {
      studentProfileId: IDS.student.profile,
      courseId: IDS.core.course,
      semester: 5,
      grade: 'A',
    },
  });

  await upsertById(db.courseClass, IDS.core.class, {
    courseId: IDS.core.course,
    facultyId: IDS.faculty.profile,
    section: 'A',
    batch: '2024',
    name: 'CSE501 Section A'
  });

  await db.classEnrollment.upsert({
    where: {
      classId_studentProfileId: {
        classId: IDS.core.class,
        studentProfileId: IDS.student.profile,
      },
    },
    update: {},
    create: {
      classId: IDS.core.class,
      studentProfileId: IDS.student.profile,
    },
  });

  await upsertById(prisma.assignment, IDS.core.assignment, {
    classId: IDS.core.class,
    title: 'Containerized Microservice API',
    description: 'Build and deploy a resilient microservice with observability.',
    dueDate: daysFromNow(10),
    maxMarks: 100,
    status: 'published',
  });

  await prisma.submission.upsert({
    where: {
      assignmentId_studentProfileId: {
        assignmentId: IDS.core.assignment,
        studentProfileId: IDS.student.profile,
      },
    },
    update: {
      status: 'submitted',
      obtainedMarks: 92,
      feedback: 'Very good architecture decisions and clean deployment flow.',
      fileUrl: 'https://example.com/submissions/ch2024cs001-assignment1.pdf',
    },
    create: {
      assignmentId: IDS.core.assignment,
      studentProfileId: IDS.student.profile,
      status: 'submitted',
      obtainedMarks: 92,
      feedback: 'Very good architecture decisions and clean deployment flow.',
      fileUrl: 'https://example.com/submissions/ch2024cs001-assignment1.pdf',
    },
  });

  await upsertById(prisma.examination, IDS.core.exam, {
    courseId: IDS.core.course,
    type: 'midterm',
    date: daysFromNow(7),
    startTime: '09:00',
    endTime: '11:00',
    venue: 'Exam Hall A',
    maxMarks: 100,
  });

  await upsertById(prisma.attendanceSession, IDS.core.attendanceSession, {
    courseId: IDS.core.course,
    facultyId: IDS.faculty.profile,
    date: daysFromNow(-2),
    startTime: '10:00',
    endTime: '11:00',
    type: 'lecture',
  });

  await prisma.attendance.upsert({
    where: {
      attendanceSessionId_studentProfileId: {
        attendanceSessionId: IDS.core.attendanceSession,
        studentProfileId: IDS.student.profile,
      },
    },
    update: { status: 'present' },
    create: {
      attendanceSessionId: IDS.core.attendanceSession,
      studentProfileId: IDS.student.profile,
      status: 'present',
    },
  });

  await upsertById(prisma.publication, 'seed-publication-1', {
    facultyProfileId: IDS.faculty.profile,
    title: 'Adaptive Scheduling in Campus Clouds',
    journal: 'International Journal of ERP Systems',
    year: 2025,
    status: 'published',
  });

  await upsertById(prisma.researchProject, 'seed-research-project-1', {
    facultyProfileId: IDS.faculty.profile,
    title: 'AI-powered Student Success Forecasting',
    fundingAgency: 'DST',
    amount: 1500000,
    status: 'ongoing',
    amountSpent: 425000,
  });

  await upsertById(prisma.leaveRequest, 'seed-leave-request-1', {
    facultyProfileId: IDS.faculty.profile,
    type: 'casual',
    fromDate: daysFromNow(4),
    toDate: daysFromNow(6),
    reason: 'Conference participation',
    status: 'pending',
    approvedBy: null,
  });

  await upsertById(prisma.feeRecord, 'seed-fee-record-1', {
    studentProfileId: IDS.student.profile,
    type: 'tuition',
    description: 'Semester 5 tuition fee',
    amount: 78000,
    dueDate: daysFromNow(12),
    paidDate: null,
    status: 'pending',
    transactionId: null,
    academicYear: '2025-26',
  });

  await upsertById(prisma.gatePass, 'seed-gate-pass-1', {
    studentProfileId: IDS.student.profile,
    type: 'day-pass',
    fromDate: daysFromNow(1),
    toDate: daysFromNow(1),
    reason: 'Medical appointment',
    destination: 'City Hospital',
    status: 'pending',
  });

  await upsertById(prisma.certificateRequest, 'seed-certificate-request-1', {
    studentProfileId: IDS.student.profile,
    type: 'bonafide',
    purpose: 'Education loan renewal',
    copies: 2,
    fee: 200,
    status: 'processing',
    collectionDate: null,
  });

  await upsertById(prisma.libraryBook, 'seed-library-book-1', {
    isbn: '9780132350884',
    title: 'Clean Code',
    author: 'Robert C. Martin',
    category: 'Software Engineering',
    issuedDate: daysFromNow(-5),
    dueDate: daysFromNow(9),
    returnedDate: null,
    fine: 0,
    renewalCount: 1,
    maxRenewals: 2,
    status: 'issued',
    studentProfileId: IDS.student.profile,
  });

  await upsertById(prisma.hostel, 'seed-hostel-1', {
    name: 'Saraswati Hostel',
    block: 'A',
    wardenName: 'Mr. Thomas',
    wardenPhone: '9876543210',
  });

  await prisma.hostelAllocation.upsert({
    where: { studentProfileId: IDS.student.profile },
    update: {
      hostelId: 'seed-hostel-1',
      roomNumber: 'A-203',
      roomType: 'double',
      checkInDate: daysFromNow(-180),
    },
    create: {
      id: 'seed-hostel-allocation-1',
      studentProfileId: IDS.student.profile,
      hostelId: 'seed-hostel-1',
      roomNumber: 'A-203',
      roomType: 'double',
      checkInDate: daysFromNow(-180),
    },
  });

  await upsertById(prisma.notification, 'seed-notification-1', {
    userId: IDS.users.student,
    title: 'Fee reminder',
    message: 'Semester 5 tuition fee due in 12 days.',
    type: 'warning',
    category: 'fee',
    read: false,
    timestamp: new Date(),
  });

  await upsertById(prisma.approvalItem, 'seed-approval-1', {
    type: 'fee_waiver',
    title: 'Merit scholarship partial waiver',
    details: 'Requesting 25% waiver for high academic performance.',
    requestedBy: IDS.users.student,
    amount: 19500,
    priority: 'high',
    status: 'pending',
  });

  await upsertById(prisma.qualityMetric, 'seed-quality-metric-1', {
    category: 'naac',
    metric: 'Graduate Employability',
    currentValue: '82%',
    target: '90%',
    trend: 'upward',
    status: 'on_track',
  });

  await upsertById(prisma.institutionKPI, 'seed-kpi-1', {
    category: 'academics',
    label: 'Overall Pass Percentage',
    value: '88%',
    target: '92%',
    trend: 'upward',
    status: 'improving',
  });

  await prisma.moduleConfig.upsert({
    where: { name: 'Academic Management' },
    update: {
      id: 'seed-module-config-1',
      description: 'Course, enrollment, attendance and exams.',
      icon: 'BookOpen',
      enabled: true,
      roles: ['super_admin', 'faculty', 'student', 'hod', 'dean'],
      subModules: ['courses', 'attendance', 'assignments', 'examinations'],
      lastUpdated: new Date(),
    },
    create: {
      id: 'seed-module-config-1',
      name: 'Academic Management',
      description: 'Course, enrollment, attendance and exams.',
      icon: 'BookOpen',
      enabled: true,
      roles: ['super_admin', 'faculty', 'student', 'hod', 'dean'],
      subModules: ['courses', 'attendance', 'assignments', 'examinations'],
      lastUpdated: new Date(),
    },
  });

  await prisma.academicYear.upsert({
    where: { year: '2025-26' },
    update: {
      id: 'seed-academic-year-1',
      startDate: new Date('2025-07-01T00:00:00.000Z'),
      endDate: new Date('2026-06-30T00:00:00.000Z'),
      isCurrent: true,
      semesters: ['odd', 'even'],
      status: 'active',
    },
    create: {
      id: 'seed-academic-year-1',
      year: '2025-26',
      startDate: new Date('2025-07-01T00:00:00.000Z'),
      endDate: new Date('2026-06-30T00:00:00.000Z'),
      isCurrent: true,
      semesters: ['odd', 'even'],
      status: 'active',
    },
  });

  await upsertById(prisma.systemAuditLog, 'seed-audit-log-1', {
    userId: IDS.users.superAdmin,
    userName: 'System Administrator',
    role: 'super_admin',
    action: 'SEED_EXECUTED',
    module: 'system',
    resource: 'database',
    details: 'Database seeded with baseline data.',
    ipAddress: '127.0.0.1',
    userAgent: 'seed-script',
    timestamp: new Date(),
    severity: 'info',
  });

  await upsertById(prisma.systemNotificationRecord, 'seed-system-notification-1', {
    title: 'ERP seed completed',
    message: 'Baseline records were created/updated successfully.',
    type: 'success',
    targetRoles: ['super_admin'],
    targetDepartments: ['CSE'],
    sentBy: IDS.users.superAdmin,
    sentDate: new Date(),
    readCount: 0,
    totalRecipients: 1,
    status: 'sent',
    scheduledDate: null,
  });

  await upsertById(prisma.backupRecord, 'seed-backup-record-1', {
    type: 'automatic',
    size: '122 MB',
    createdDate: new Date(),
    status: 'completed',
    duration: '00:02:35',
    initiatedBy: IDS.users.superAdmin,
    location: 's3://campus-harmony-backups/daily/',
  });

  await upsertById(prisma.incidentReport, 'seed-incident-1', {
    title: 'Unauthorized lab access attempt',
    description: 'Attempted after-hours entry in CSE lab.',
    location: 'CSE Lab 2',
    severity: 'medium',
    status: 'pending',
  });

  await upsertById(prisma.visitorPass, 'seed-visitor-pass-1', {
    visitorName: 'Suresh Parent',
    purpose: 'Faculty meeting',
    hostName: 'Dr. Ravi Faculty',
    checkInTime: daysFromNow(-1),
    checkOutTime: null,
    status: 'active',
  });

  await upsertById(prisma.facultyRecruitment, 'seed-faculty-recruitment-1', {
    departmentId: IDS.departments.cse,
    position: 'Assistant Professor',
    specialization: 'Data Science',
    applicants: 26,
    shortlisted: 8,
    status: 'requested',
  });

  await prisma.departmentBudget.upsert({
    where: {
      departmentId_year: {
        departmentId: IDS.departments.cse,
        year: '2025-26',
      },
    },
    update: { allocated: 25000000, spent: 9800000 },
    create: {
      id: 'seed-department-budget-1',
      departmentId: IDS.departments.cse,
      allocated: 25000000,
      spent: 9800000,
      year: '2025-26',
    },
  });

  await upsertById(prisma.curriculumProposal, 'seed-curriculum-proposal-1', {
    departmentId: IDS.departments.cse,
    proposedBy: IDS.users.hod,
    type: 'new_course',
    title: 'Applied LLM Engineering',
    description: 'Introduce project-driven LLM systems engineering elective.',
    submittedAt: daysFromNow(-10),
    bosApproved: false,
    status: 'pending_dean',
  });

  await upsertById(prisma.disciplinaryCase, 'seed-disciplinary-case-1', {
    studentName: 'Ananya Student',
    rollNumber: 'CH2024CS001',
    departmentId: IDS.departments.cse,
    type: 'attendance',
    description: 'Repeated absences without notice.',
    reportedBy: IDS.users.hod,
    reportedAt: daysFromNow(-14),
    status: 'escalated',
    severity: 'minor',
  });

  await upsertById(prisma.interDeptEvent, 'seed-interdept-event-1', {
    title: 'Innovation Week 2026',
    type: 'technical_fest',
    date: daysFromNow(20),
    departments: ['CSE', 'ECE'],
    coordinator: IDS.users.dean,
    budget: 500000,
    participants: 240,
    status: 'planned',
  });

  await upsertById(prisma.meeting, 'seed-meeting-1', {
    meetingType: 'academic_council',
    title: 'Semester Performance Review',
    date: daysFromNow(3),
    time: '15:00',
    venue: 'Senate Hall',
    status: 'upcoming',
    agendaItems: ['Result analysis', 'Curriculum changes'],
    attendees: ['dean', 'hod', 'registrar'],
    documents: [],
    minutes: null,
    createdBy: IDS.users.vc,
  });

  await upsertById(prisma.broadcastMessage, 'seed-broadcast-message-1', {
    subject: 'Campus Closed on Friday',
    content: 'Campus will remain closed for maintenance activities.',
    sender: IDS.users.vc,
    sentAt: new Date(),
    recipients: 'all',
    type: 'announcement',
    pinned: true,
  });

  await upsertById(prisma.complianceReport, 'seed-compliance-report-1', {
    framework: 'NAAC',
    title: 'NAAC Self Study Progress',
    status: 'draft',
    score: 78,
    maxScore: 100,
    lastUpdated: new Date(),
    criteria: { criterion1: 'in_progress', criterion2: 'completed' },
  });

  await upsertById(prisma.policyScenario, 'seed-policy-scenario-1', {
    title: 'Attendance Requirement Adjustment',
    description: 'Model impact of changing minimum attendance from 75% to 80%.',
    category: 'academic',
    parameters: { minAttendance: 80 },
    projectedOutcome: 'Slight reduction in exam eligibility but improved class participation.',
    impact: 'moderate',
    createdBy: IDS.users.vc,
    createdAt: new Date(),
  });

  await upsertById(prisma.feeStructure, 'seed-fee-structure-1', {
    academicYear: '2025-26',
    semester: '5',
    program: 'B.Tech CSE',
    feeComponents: {
      tuition: 78000,
      library: 2500,
      lab: 6000,
      misc: 3500,
    },
    totalAmount: 90000,
    dueDate: daysFromNow(15),
    lateFeePenalty: 1000,
    active: true,
  });

  await upsertById(prisma.vendor, 'seed-vendor-1', {
    name: 'Tech Supplies Pvt Ltd',
    contactPerson: 'Vikram Rao',
    email: 'vendor@techsupplies.example',
    phone: '9000012345',
    address: '12 Industrial Estate, Bengaluru',
    gstNumber: '29ABCDE1234F1Z5',
    panNumber: 'ABCDE1234F',
    paymentTerms: 'Net 30',
    status: 'active',
  });

  await prisma.purchaseOrder.upsert({
    where: { poNumber: 'PO-2026-0001' },
    update: {
      id: 'seed-po-1',
      department: 'CSE',
      vendorId: 'seed-vendor-1',
      orderDate: daysFromNow(-4),
      expectedDelivery: daysFromNow(8),
      totalAmount: 148000,
      status: 'pending',
      items: [{ name: 'Workstation', qty: 2, amount: 148000 }],
      approvedBy: IDS.users.finance,
      deliveredDate: null,
      invoiceNumber: null,
      paymentDate: null,
    },
    create: {
      id: 'seed-po-1',
      poNumber: 'PO-2026-0001',
      department: 'CSE',
      vendorId: 'seed-vendor-1',
      orderDate: daysFromNow(-4),
      expectedDelivery: daysFromNow(8),
      totalAmount: 148000,
      status: 'pending',
      items: [{ name: 'Workstation', qty: 2, amount: 148000 }],
      approvedBy: IDS.users.finance,
      deliveredDate: null,
      invoiceNumber: null,
      paymentDate: null,
    },
  });

  await prisma.journalEntry.upsert({
    where: { entryNumber: 'JE-2026-0001' },
    update: {
      id: 'seed-journal-entry-1',
      date: new Date(),
      description: 'Tuition receivable for semester 5',
      reference: 'BILL-SEM5-001',
      totalDebit: 90000,
      totalCredit: 90000,
      status: 'posted',
      createdBy: IDS.users.finance,
      approvedBy: IDS.users.superAdmin,
      accounts: [
        { account: 'Accounts Receivable', debit: 90000, credit: 0 },
        { account: 'Tuition Revenue', debit: 0, credit: 90000 },
      ],
    },
    create: {
      id: 'seed-journal-entry-1',
      entryNumber: 'JE-2026-0001',
      date: new Date(),
      description: 'Tuition receivable for semester 5',
      reference: 'BILL-SEM5-001',
      totalDebit: 90000,
      totalCredit: 90000,
      status: 'posted',
      createdBy: IDS.users.finance,
      approvedBy: IDS.users.superAdmin,
      accounts: [
        { account: 'Accounts Receivable', debit: 90000, credit: 0 },
        { account: 'Tuition Revenue', debit: 0, credit: 90000 },
      ],
    },
  });

  await prisma.payrollRecord.upsert({
    where: {
      employeeId_month_year: {
        employeeId: 'EMP-CSE-1001',
        month: 'March',
        year: 2026,
      },
    },
    update: {
      employeeName: 'Dr. Ravi Faculty',
      department: 'CSE',
      designation: 'Professor',
      basicSalary: 120000,
      allowances: { hra: 24000, da: 12000 },
      deductions: { tax: 18000 },
      grossSalary: 156000,
      netSalary: 138000,
      status: 'processed',
      paymentDate: daysFromNow(-1),
      paymentMethod: 'bank_transfer',
    },
    create: {
      id: 'seed-payroll-record-1',
      employeeId: 'EMP-CSE-1001',
      employeeName: 'Dr. Ravi Faculty',
      department: 'CSE',
      designation: 'Professor',
      month: 'March',
      year: 2026,
      basicSalary: 120000,
      allowances: { hra: 24000, da: 12000 },
      deductions: { tax: 18000 },
      grossSalary: 156000,
      netSalary: 138000,
      status: 'processed',
      paymentDate: daysFromNow(-1),
      paymentMethod: 'bank_transfer',
    },
  });

  await prisma.budgetAllocation.upsert({
    where: {
      department_category_budgetYear: {
        department: 'CSE',
        category: 'infrastructure',
        budgetYear: '2025-26',
      },
    },
    update: {
      allocatedAmount: 5000000,
      spentAmount: 2100000,
      availableAmount: 2900000,
      utilizationPercentage: 42,
      lastUpdated: new Date(),
    },
    create: {
      id: 'seed-budget-allocation-1',
      department: 'CSE',
      category: 'infrastructure',
      budgetYear: '2025-26',
      allocatedAmount: 5000000,
      spentAmount: 2100000,
      availableAmount: 2900000,
      utilizationPercentage: 42,
      lastUpdated: new Date(),
    },
  });

  await prisma.company.upsert({
    where: { name: 'FutureTech Solutions' },
    update: {
      id: 'seed-company-1',
      industry: 'Software',
      email: 'hr@futuretech.example',
      website: 'https://futuretech.example',
      totalHires: 4,
    },
    create: {
      id: 'seed-company-1',
      name: 'FutureTech Solutions',
      industry: 'Software',
      email: 'hr@futuretech.example',
      website: 'https://futuretech.example',
      totalHires: 4,
    },
  });

  await upsertById(prisma.placementDrive, 'seed-placement-drive-1', {
    companyId: 'seed-company-1',
    role: 'Software Engineer',
    package: '12 LPA',
    driveDate: daysFromNow(25),
    registrationDeadline: daysFromNow(15),
    status: 'active',
    location: 'Bengaluru',
    jobDescription: 'Backend and full-stack developer role for campus hires.',
  });

  await prisma.studentApplication.upsert({
    where: {
      placementDriveId_studentProfileId: {
        placementDriveId: 'seed-placement-drive-1',
        studentProfileId: IDS.student.profile,
      },
    },
    update: {
      status: 'shortlisted',
      appliedAt: daysFromNow(-2),
    },
    create: {
      id: 'seed-student-application-1',
      placementDriveId: 'seed-placement-drive-1',
      studentProfileId: IDS.student.profile,
      status: 'shortlisted',
      appliedAt: daysFromNow(-2),
    },
  });

  await upsertById(prisma.trainingSession, 'seed-training-session-1', {
    title: 'Aptitude and DSA Bootcamp',
    type: 'placement_training',
    instructor: 'External Mentor Team',
    date: daysFromNow(5),
    duration: 180,
    venue: 'Placement Hall',
    maxCapacity: 120,
    registeredCount: 75,
    status: 'scheduled',
    description: 'Focused preparation for product-company interviews.',
    materials: ['aptitude-pack.pdf', 'dsa-sheet.pdf'],
  });

  await upsertById(prisma.jobOffer, 'seed-job-offer-1', {
    studentId: IDS.student.profile,
    studentName: 'Ananya Student',
    companyName: 'FutureTech Solutions',
    jobRole: 'Software Engineer',
    package: 12,
    offerDate: daysFromNow(-1),
    joiningDate: daysFromNow(60),
    status: 'pending',
    documents: ['offer-letter.pdf'],
  });

  await upsertById(prisma.placementMessage, 'seed-placement-message-1', {
    title: 'Drive registration open',
    content: 'FutureTech Solutions drive registration is now open.',
    type: 'announcement',
    sentBy: IDS.users.placement,
    sentAt: new Date(),
    targetGroup: 'final-year-cse',
  });

  await upsertById(prisma.donation, 'seed-donation-1', {
    alumniProfileId: IDS.alumni.profile,
    amount: 50000,
    purpose: 'Scholarship fund',
    date: daysFromNow(-30),
    status: 'completed',
  });

  await upsertById(prisma.alumniEvent, 'seed-alumni-event-1', {
    title: 'Annual Alumni Meet 2026',
    description: 'Networking and mentorship event for alumni and students.',
    type: 'meetup',
    date: daysFromNow(40),
    endDate: daysFromNow(40),
    venue: 'Main Auditorium',
    isVirtual: false,
    virtualLink: null,
    maxCapacity: 300,
    registrationDeadline: daysFromNow(35),
    organizer: IDS.users.alumniOfficer,
    targetAudience: ['alumni', 'final-year-students'],
    registrations: [],
    status: 'published',
    images: [],
    documents: [],
  });

  await upsertById(prisma.mentorshipProgram, 'seed-mentorship-program-1', {
    title: 'Career Compass',
    description: 'Industry mentorship for graduating students.',
    type: 'career',
    duration: '12 weeks',
    maxMentees: 60,
    startDate: daysFromNow(2),
    endDate: daysFromNow(86),
    status: 'active',
    mentors: [{ name: 'Rohit Alumni', expertise: 'Product Engineering' }],
    mentees: [{ name: 'Ananya Student', rollNo: 'CH2024CS001' }],
    matches: [{ mentor: 'Rohit Alumni', mentee: 'Ananya Student' }],
  });

  await upsertById(prisma.alumniCommunicationRecord, 'seed-alumni-communication-1', {
    title: 'Quarterly Alumni Newsletter',
    content: 'Highlights of placements, research and campus growth.',
    type: 'newsletter',
    targetAudience: ['all-alumni'],
    sentDate: daysFromNow(-3),
    scheduledDate: null,
    status: 'sent',
    recipientCount: 1200,
    openRate: 42.5,
    clickRate: 11.8,
  });

  await upsertById(prisma.alumniJobPosting, 'seed-alumni-job-posting-1', {
    postedBy: IDS.users.alumniOfficer,
    companyName: 'FutureTech Solutions',
    jobTitle: 'Associate Backend Engineer',
    description: 'Entry-level backend engineering role for new graduates.',
    requirements: ['Node.js', 'SQL', 'REST APIs'],
    location: 'Bengaluru',
    salaryRange: '8-10 LPA',
    jobType: 'full_time',
    applicationDeadline: daysFromNow(30),
    contactEmail: 'jobs@futuretech.example',
    status: 'active',
    postedDate: new Date(),
    views: 140,
    applications: 22,
  });

  await upsertById(prisma.progressionSurvey, 'seed-progression-survey-1', {
    title: 'Graduate Progression Survey 2026',
    graduationYear: 2025,
    program: 'B.Tech CSE',
    surveyPeriod: 'Q1 2026',
    questions: ['Current role?', 'Higher studies?', 'Salary range?'],
    responses: [],
    status: 'active',
    startDate: daysFromNow(-7),
    endDate: daysFromNow(23),
  });

  await upsertById(prisma.iQACActionItem, 'seed-iqac-action-1', {
    title: 'Close NBA documentation gaps',
    description: 'Collect and upload missing criterion evidence.',
    category: 'accreditation',
    priority: 'high',
    assignedTo: IDS.users.iqac,
    department: 'CSE',
    dueDate: daysFromNow(12),
    status: 'pending',
    implementationStatus: 'in_progress',
    evidence: [],
    createdDate: new Date(),
    completedDate: null,
    impact: null,
  });

  await upsertById(prisma.qualityDocument, 'seed-quality-document-1', {
    title: 'NAAC Criterion 2 Evidence Binder',
    criteriaNumber: 2,
    documentType: 'evidence',
    uploadedBy: IDS.users.iqac,
    uploadDate: new Date(),
    filePath: '/iqac/naac-criterion-2.pdf',
    version: '1.0',
    status: 'pending_review',
    reviewComments: null,
    reviewedBy: null,
    reviewDate: null,
    tags: ['naac', 'criterion-2'],
  });

  await upsertById(prisma.feedbackForm, 'seed-feedback-form-1', {
    courseId: IDS.core.course,
    title: 'End Semester Course Feedback',
    status: 'open',
    deadline: daysFromNow(14),
  });

  await upsertById(prisma.feedbackResponse, 'seed-feedback-response-1', {
    feedbackFormId: 'seed-feedback-form-1',
    studentId: IDS.users.student,
    responses: { teaching: 4, content: 5, engagement: 4 },
    submittedAt: daysFromNow(-1),
  });

  await prisma.aQARRecord.upsert({
    where: { academicYear: '2025-26' },
    update: {
      id: 'seed-aqar-record-1',
      institutionDetails: { name: 'Campus Harmony University' },
      criteria: { criterion1: 'complete', criterion2: 'in_progress' },
      keyIndicators: { placementRate: '78%' },
      bestPractices: ['Outcome-based curriculum'],
      distinctiveFeatures: ['Unified ERP workflows'],
      status: 'draft',
      submissionDate: null,
      generatedBy: IDS.users.iqac,
    },
    create: {
      id: 'seed-aqar-record-1',
      academicYear: '2025-26',
      institutionDetails: { name: 'Campus Harmony University' },
      criteria: { criterion1: 'complete', criterion2: 'in_progress' },
      keyIndicators: { placementRate: '78%' },
      bestPractices: ['Outcome-based curriculum'],
      distinctiveFeatures: ['Unified ERP workflows'],
      status: 'draft',
      submissionDate: null,
      generatedBy: IDS.users.iqac,
    },
  });

  await upsertById(prisma.iQACMeeting, 'seed-iqac-meeting-1', {
    title: 'IQAC Quarterly Review',
    date: daysFromNow(9),
    venue: 'Board Room',
    agenda: ['AQAR progress', 'Action item review'],
    attendees: ['iqac_coordinator', 'dean', 'hod'],
    chairperson: IDS.users.iqac,
    minutes: null,
    decisions: [],
    actionItems: [],
    nextMeetingDate: daysFromNow(100),
    status: 'scheduled',
    documentsShared: [],
  });

  await prisma.grievanceCase.upsert({
    where: { grievanceNumber: 'GRV-2026-0001' },
    update: {
      id: 'seed-grievance-case-1',
      complainantId: IDS.users.student,
      complainantName: 'Ananya Student',
      complainantType: 'student',
      category: 'hostel',
      subcategory: 'internet',
      subject: 'Frequent network downtime',
      description: 'Hostel internet is unstable during evening hours.',
      severity: 'high',
      status: 'received',
      submissionDate: daysFromNow(-2),
      lastUpdated: new Date(),
      assignedTo: IDS.users.grievance,
      department: 'CSE',
      expectedResolutionDate: daysFromNow(5),
      actualResolutionDate: null,
      isAnonymous: false,
      evidenceFiles: ['speedtest.png'],
      timeline: [],
      resolution: null,
      satisfactionRating: null,
    },
    create: {
      id: 'seed-grievance-case-1',
      grievanceNumber: 'GRV-2026-0001',
      complainantId: IDS.users.student,
      complainantName: 'Ananya Student',
      complainantType: 'student',
      category: 'hostel',
      subcategory: 'internet',
      subject: 'Frequent network downtime',
      description: 'Hostel internet is unstable during evening hours.',
      severity: 'high',
      status: 'received',
      submissionDate: daysFromNow(-2),
      lastUpdated: new Date(),
      assignedTo: IDS.users.grievance,
      department: 'CSE',
      expectedResolutionDate: daysFromNow(5),
      actualResolutionDate: null,
      isAnonymous: false,
      evidenceFiles: ['speedtest.png'],
      timeline: [],
      resolution: null,
      satisfactionRating: null,
    },
  });

  await upsertById(prisma.complianceItem, 'seed-compliance-item-1', {
    title: 'Anti-ragging compliance renewal',
    type: 'regulatory',
    description: 'Annual anti-ragging compliance submission.',
    applicableTo: 'all_departments',
    dueDate: daysFromNow(20),
    renewalPeriod: 'yearly',
    completionTracking: [],
    documents: [],
    status: 'active',
  });

  await upsertById(prisma.antiRaggingAffidavit, 'seed-antiragging-1', {
    studentId: IDS.student.profile,
    studentName: 'Ananya Student',
    program: 'B.Tech CSE',
    submissionDate: daysFromNow(-25),
    parentAffidavit: true,
    studentAffidavit: true,
    status: 'verified',
    academicYear: '2025-26',
  });

  await prisma.iDCardRequest.upsert({
    where: { requestNumber: 'IDC-00001' },
    update: {
      id: 'seed-id-card-request-1',
      applicantId: IDS.users.student,
      applicantName: 'Ananya Student',
      applicantType: 'student',
      requestType: 'new',
      reason: 'Replacement due to wear',
      requestDate: daysFromNow(-3),
      approvedBy: null,
      approvalDate: null,
      cardIssuedDate: null,
      status: 'pending',
      feesPaid: true,
      documents: ['photo.jpg'],
    },
    create: {
      id: 'seed-id-card-request-1',
      requestNumber: 'IDC-00001',
      applicantId: IDS.users.student,
      applicantName: 'Ananya Student',
      applicantType: 'student',
      requestType: 'new',
      reason: 'Replacement due to wear',
      requestDate: daysFromNow(-3),
      approvedBy: null,
      approvalDate: null,
      cardIssuedDate: null,
      status: 'pending',
      feesPaid: true,
      documents: ['photo.jpg'],
    },
  });

  await prisma.vehiclePass.upsert({
    where: { passNumber: 'VP-00001' },
    update: {
      id: 'seed-vehicle-pass-1',
      ownerName: 'Ananya Student',
      ownerType: 'student',
      ownerIdNumber: 'CH2024CS001',
      vehicleType: 'two_wheeler',
      vehicleNumber: 'KA01AB1234',
      vehicleModel: 'Activa',
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
      validUntil: new Date('2026-12-31T00:00:00.000Z'),
      parkingZone: 'P2',
      status: 'active',
      feesPaid: true,
      documents: ['rc.pdf'],
    },
    create: {
      id: 'seed-vehicle-pass-1',
      passNumber: 'VP-00001',
      ownerName: 'Ananya Student',
      ownerType: 'student',
      ownerIdNumber: 'CH2024CS001',
      vehicleType: 'two_wheeler',
      vehicleNumber: 'KA01AB1234',
      vehicleModel: 'Activa',
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
      validUntil: new Date('2026-12-31T00:00:00.000Z'),
      parkingZone: 'P2',
      status: 'active',
      feesPaid: true,
      documents: ['rc.pdf'],
    },
  });

  await upsertById(prisma.patrolLog, 'seed-patrol-log-1', {
    officerId: IDS.users.security,
    officerName: 'Kabir Security',
    shift: 'night',
    patrolRoute: 'Hostel Zone A',
    startTime: daysFromNow(-1),
    endTime: null,
    checkpoints: ['Gate 1', 'Hostel A', 'Library'],
    status: 'on_duty',
    location: 'Hostel Gate',
    lastUpdate: new Date(),
  });

  await upsertById(prisma.hostelAccessLog, 'seed-hostel-access-1', {
    studentId: IDS.student.profile,
    studentName: 'Ananya Student',
    hostelBlock: 'A',
    roomNumber: 'A-203',
    outTime: daysFromNow(-1),
    inTime: null,
    purpose: 'Medical appointment',
    expectedReturn: daysFromNow(0),
    latePassApproved: false,
    approvedBy: null,
    status: 'outside',
  });

  await prisma.vigilanceCase.upsert({
    where: { caseNumber: 'VIG-00001' },
    update: {
      id: 'seed-vigilance-case-1',
      type: 'disciplinary',
      subject: 'Unauthorized hostel entry',
      description: 'Reported unauthorized entry attempt after curfew.',
      complainantType: 'warden',
      dateReported: daysFromNow(-6),
      status: 'under_investigation',
      investigatingOfficer: IDS.users.security,
      documentsCollected: ['cctv_clip.mp4'],
      peopleInterviewed: ['Warden', 'Security guard'],
      findings: null,
      actionTaken: null,
      closeDate: null,
      confidentialityLevel: 'high',
    },
    create: {
      id: 'seed-vigilance-case-1',
      caseNumber: 'VIG-00001',
      type: 'disciplinary',
      subject: 'Unauthorized hostel entry',
      description: 'Reported unauthorized entry attempt after curfew.',
      complainantType: 'warden',
      dateReported: daysFromNow(-6),
      status: 'under_investigation',
      investigatingOfficer: IDS.users.security,
      documentsCollected: ['cctv_clip.mp4'],
      peopleInterviewed: ['Warden', 'Security guard'],
      findings: null,
      actionTaken: null,
      closeDate: null,
      confidentialityLevel: 'high',
    },
  });

  await prisma.supportTicket.upsert({
    where: { ticketNumber: 'TKT-00001' },
    update: {
      id: 'seed-support-ticket-1',
      reportedBy: IDS.users.student,
      reporterType: 'student',
      contactInfo: 'student@campusharmony.edu',
      category: 'security',
      priority: 'medium',
      subject: 'Lost hostel key',
      description: 'Requesting temporary access and lock replacement.',
      attachments: [],
      assignedTo: IDS.users.security,
      status: 'open',
      createdDate: daysFromNow(-1),
      lastUpdate: new Date(),
      resolutionDate: null,
      resolutionNotes: null,
      satisfactionRating: null,
    },
    create: {
      id: 'seed-support-ticket-1',
      ticketNumber: 'TKT-00001',
      reportedBy: IDS.users.student,
      reporterType: 'student',
      contactInfo: 'student@campusharmony.edu',
      category: 'security',
      priority: 'medium',
      subject: 'Lost hostel key',
      description: 'Requesting temporary access and lock replacement.',
      attachments: [],
      assignedTo: IDS.users.security,
      status: 'open',
      createdDate: daysFromNow(-1),
      lastUpdate: new Date(),
      resolutionDate: null,
      resolutionNotes: null,
      satisfactionRating: null,
    },
  });

  await upsertById(prisma.transferRequest, 'seed-transfer-request-1', {
    studentId: IDS.student.profile,
    studentName: 'Ananya Student',
    type: 'intra_university',
    fromInstitution: 'School of Computing',
    toInstitution: 'School of AI',
    program: 'B.Tech CSE',
    reason: 'Specialization preference',
    status: 'pending',
    requestedAt: daysFromNow(-4),
    documents: ['application.pdf'],
  });

  await prisma.degreeRecord.upsert({
    where: { certificateNo: 'DEG-2026-0001' },
    update: {
      id: 'seed-degree-record-1',
      studentName: 'Ananya Student',
      rollNo: 'CH2024CS001',
      program: 'B.Tech CSE',
      department: 'CSE',
      graduationYear: 2026,
      status: 'eligible',
      convocationDate: daysFromNow(90),
      collectedAt: null,
      verificationCount: 0,
    },
    create: {
      id: 'seed-degree-record-1',
      studentName: 'Ananya Student',
      rollNo: 'CH2024CS001',
      program: 'B.Tech CSE',
      department: 'CSE',
      graduationYear: 2026,
      certificateNo: 'DEG-2026-0001',
      status: 'eligible',
      convocationDate: daysFromNow(90),
      collectedAt: null,
      verificationCount: 0,
    },
  });

  await upsertById(prisma.adminDocument, 'seed-admin-document-1', {
    title: 'Academic Council Proceedings',
    category: 'governance',
    uploadedBy: IDS.users.registrar,
    uploadedAt: new Date(),
    fileSize: '1.2 MB',
    tags: ['minutes', 'council'],
    isConfidential: true,
    accessRoles: ['registrar', 'dean', 'vice_chancellor'],
  });

  await upsertById(prisma.vacancy, 'seed-vacancy-1', {
    position: 'Assistant Professor',
    department: 'CSE',
    type: 'teaching',
    sanctioned: 18,
    filled: 15,
    status: 'advertised',
    postedAt: daysFromNow(-5),
    lastDate: daysFromNow(20),
    applicants: 32,
  });

  await upsertById(prisma.accreditationChecklist, 'seed-accreditation-checklist-1', {
    framework: 'NAAC',
    criterion: 'Criterion 2',
    description: 'Teaching-learning and evaluation evidence collation.',
    responsibleOffice: 'IQAC',
    status: 'in_progress',
    documents: [],
    deadline: daysFromNow(30),
    remarks: null,
  });

  await upsertById(prisma.verificationRequest, 'seed-verification-request-1', {
    type: 'degree_verification',
    requesterName: 'ABC Corp HR',
    requesterOrg: 'ABC Corp',
    studentName: 'Ananya Student',
    studentId: IDS.student.profile,
    details: 'Verify degree eligibility status.',
    status: 'pending',
    receivedAt: daysFromNow(-2),
    respondedAt: null,
    response: null,
  });

  await upsertById(prisma.recordChangeRequest, 'seed-record-change-1', {
    studentId: IDS.student.profile,
    studentName: 'Ananya Student',
    field: 'address',
    oldValue: 'Old Address',
    newValue: 'New Address',
    reason: 'Residence update',
    requestedBy: IDS.users.student,
    requestedAt: daysFromNow(-1),
    status: 'pending',
    approvedBy: null,
    documents: ['address-proof.pdf'],
  });

  await upsertById(prisma.examProgress, 'seed-exam-progress-1', {
    examName: 'Mid Semester Exam',
    semester: '5',
    program: 'B.Tech CSE',
    totalStudents: 120,
    marksEntered: 74,
    resultsPublished: false,
    status: 'evaluation',
    startDate: daysFromNow(-3),
    endDate: daysFromNow(3),
    coordinator: IDS.users.registrar,
  });

  // Registrar — Promotions (uncomment after running migrations)
  // await upsertById(prisma.promotionRequest, 'seed-promotion-request-1', {
  //   facultyProfileId: IDS.faculty.profile,
  //   currentDesignation: 'Assistant Professor',
  //   newDesignation: 'Associate Professor',
  //   reason: 'Eligible based on research publications and teaching experience',
  //   status: 'pending',
  //   appliedAt: daysFromNow(-10),
  // });

  // Registrar — Retirements (uncomment after running migrations)
  // await upsertById(prisma.retirementRequest, 'seed-retirement-request-1', {
  //   facultyProfileId: IDS.faculty.profile,
  //   currentDesignation: 'Professor',
  //   yearsOfService: 32,
  //   lastDate: daysFromNow(180),
  //   status: 'pending',
  //   appliedAt: daysFromNow(-5),
  // });

  await upsertById(prisma.sportsAthlete, 'seed-sports-athlete-1', {
    studentId: IDS.student.profile,
    studentName: 'Ananya Student',
    rollNumber: 'CH2024CS001',
    program: 'B.Tech CSE',
    year: 3,
    email: 'student@campusharmony.edu',
    phone: '9000011111',
    sports: ['basketball'],
    achievements: ['Inter-college silver medal'],
    medicalClearance: true,
    emergencyContact: { name: 'Parent', phone: '9000099999' },
    status: 'active',
  });

  await upsertById(prisma.sportsTeam, 'seed-sports-team-1', {
    sport: 'Basketball',
    category: 'Men',
    level: 'university',
    coach: 'Coach Nair',
    captain: 'Ananya Student',
    members: ['Ananya Student'],
    practiceSchedule: [{ day: 'Tue', time: '17:00' }],
    upcomingMatches: [{ opponent: 'City College', date: daysFromNow(18).toISOString() }],
    season: '2025-26',
    status: 'active',
  });

  await upsertById(prisma.sportsFacility, 'seed-sports-facility-1', {
    name: 'Main Basketball Court',
    type: 'court',
    sports: ['basketball'],
    capacity: 150,
    amenities: ['LED lights', 'Scoreboard'],
    maintenanceSchedule: [{ month: 'April', task: 'Surface polishing' }],
    status: 'available',
  });

  await upsertById(prisma.sportsInventoryItem, 'seed-sports-inventory-1', {
    itemName: 'Basketball',
    category: 'equipment',
    sport: 'basketball',
    brand: 'Spalding',
    quantity: 20,
    availableQuantity: 16,
    unitPrice: 1800,
    totalValue: 36000,
    condition: 'good',
    purchaseDate: daysFromNow(-120),
    lastMaintenance: daysFromNow(-30),
    location: 'Sports Store Room',
  });

  await upsertById(prisma.sportsEvent, 'seed-sports-event-1', {
    name: 'Inter-Department Basketball Tournament',
    type: 'tournament',
    sports: ['basketball'],
    startDate: daysFromNow(18),
    endDate: daysFromNow(20),
    venue: 'Main Court',
    organizer: IDS.users.sports,
    participants: ['CSE', 'ECE'],
    results: [],
    status: 'planning',
  });

  await upsertById(prisma.fitnessRecord, 'seed-fitness-record-1', {
    studentId: IDS.student.profile,
    testDate: daysFromNow(-6),
    testType: 'endurance',
    results: { beepTest: 9.5, sprint50m: '7.2s' },
    overallGrade: 'A',
    recommendations: 'Maintain hydration and cardio routine.',
    restrictions: null,
    nextTestDate: daysFromNow(24),
    conductedBy: IDS.users.sports,
  });

  await upsertById(prisma.sportsAttendance, 'seed-sports-attendance-1', {
    teamId: 'seed-sports-team-1',
    date: daysFromNow(-1),
    attendees: ['Ananya Student'],
    notes: 'Good participation',
    sessionType: 'training',
  });

  console.log('Seed completed successfully.');
  console.log(`Default password for seeded users: ${DEFAULT_PASSWORD}`);
  console.log('Demo logins created (all use the default password):');
  for (const user of userSeeds) {
    console.log(`- ${user.role}: ${user.email}`);
  }
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
