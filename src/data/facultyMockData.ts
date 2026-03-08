import type {
  FacultyCourse, AttendanceSession, LessonPlanEntry, FacultyAssignment,
  StudentSubmission, InternalMarksEntry, MenteeStudent, Publication,
  ResearchProject, Patent, Committee, FacultyLeave, LeaveBalance,
  FacultyProfile, FeedbackSummary, FacultyGrievance, ClassMessage,
  StudentAttendanceEntry,
} from '@/types/faculty';

export const facultyProfile: FacultyProfile = {
  id: 'fac-001',
  name: 'Prof. Neha Agarwal',
  email: 'neha.agarwal@university.edu',
  phone: '+91-9876543210',
  designation: 'Associate Professor',
  department: 'Computer Science & Engineering',
  employeeId: 'EMP-CS-042',
  dateOfJoining: '2015-08-01',
  qualification: 'Ph.D. (Computer Science), M.Tech, B.Tech',
  specialization: 'Machine Learning, Data Mining, NLP',
  experience: 11,
  totalPublications: 28,
  totalProjects: 5,
  hIndex: 12,
  coursesThisSemester: 3,
  weeklyHours: 16,
  totalStudents: 185,
};

export const facultyCourses: FacultyCourse[] = [
  {
    id: 'fc-1', code: 'CS301', name: 'Data Structures & Algorithms', credits: 4,
    semester: 5, section: 'A', department: 'CSE', program: 'B.Tech',
    totalStudents: 65, averageAttendance: 82, syllabusCompletion: 68,
    averageScore: 72,
    schedule: [
      { day: 'Monday', startTime: '09:00', endTime: '10:00', room: 'LH-301', type: 'lecture' },
      { day: 'Wednesday', startTime: '09:00', endTime: '10:00', room: 'LH-301', type: 'lecture' },
      { day: 'Thursday', startTime: '14:00', endTime: '16:00', room: 'Lab-C2', type: 'lab' },
      { day: 'Friday', startTime: '11:00', endTime: '12:00', room: 'LH-301', type: 'tutorial' },
    ],
  },
  {
    id: 'fc-2', code: 'CS501', name: 'Machine Learning', credits: 4,
    semester: 7, section: 'A', department: 'CSE', program: 'B.Tech',
    totalStudents: 58, averageAttendance: 78, syllabusCompletion: 55,
    averageScore: 68,
    schedule: [
      { day: 'Tuesday', startTime: '10:00', endTime: '11:00', room: 'LH-401', type: 'lecture' },
      { day: 'Thursday', startTime: '10:00', endTime: '11:00', room: 'LH-401', type: 'lecture' },
      { day: 'Friday', startTime: '14:00', endTime: '16:00', room: 'Lab-AI1', type: 'lab' },
    ],
  },
  {
    id: 'fc-3', code: 'CS601', name: 'Deep Learning', credits: 3,
    semester: 7, section: 'B', department: 'CSE', program: 'M.Tech',
    totalStudents: 32, averageAttendance: 88, syllabusCompletion: 72,
    averageScore: 75,
    schedule: [
      { day: 'Monday', startTime: '11:00', endTime: '12:00', room: 'PG-201', type: 'lecture' },
      { day: 'Wednesday', startTime: '11:00', endTime: '12:00', room: 'PG-201', type: 'lecture' },
    ],
  },
];

export const todaySchedule: AttendanceSession[] = [
  {
    id: 'as-1', courseId: 'fc-1', courseCode: 'CS301', courseName: 'Data Structures & Algorithms',
    date: '2026-03-08', startTime: '09:00', endTime: '10:00', room: 'LH-301',
    type: 'lecture', totalStudents: 65, presentCount: 58, absentCount: 7, status: 'completed',
  },
  {
    id: 'as-2', courseId: 'fc-3', courseCode: 'CS601', courseName: 'Deep Learning',
    date: '2026-03-08', startTime: '11:00', endTime: '12:00', room: 'PG-201',
    type: 'lecture', totalStudents: 32, presentCount: 0, absentCount: 0, status: 'pending',
  },
  {
    id: 'as-3', courseId: 'fc-2', courseCode: 'CS501', courseName: 'Machine Learning',
    date: '2026-03-08', startTime: '14:00', endTime: '16:00', room: 'Lab-AI1',
    type: 'lab', totalStudents: 58, presentCount: 0, absentCount: 0, status: 'pending',
  },
];

export const sampleStudentRoster: StudentAttendanceEntry[] = [
  { studentId: 's1', rollNumber: '21CS001', name: 'Aarav Sharma', status: 'present' },
  { studentId: 's2', rollNumber: '21CS002', name: 'Bhavya Patel', status: 'present' },
  { studentId: 's3', rollNumber: '21CS003', name: 'Chitra Nair', status: 'absent' },
  { studentId: 's4', rollNumber: '21CS004', name: 'Dhruv Gupta', status: 'present' },
  { studentId: 's5', rollNumber: '21CS005', name: 'Esha Reddy', status: 'present' },
  { studentId: 's6', rollNumber: '21CS006', name: 'Farhan Khan', status: 'late' },
  { studentId: 's7', rollNumber: '21CS007', name: 'Gauri Joshi', status: 'present' },
  { studentId: 's8', rollNumber: '21CS008', name: 'Harsh Mehta', status: 'present' },
  { studentId: 's9', rollNumber: '21CS009', name: 'Ishita Verma', status: 'absent' },
  { studentId: 's10', rollNumber: '21CS010', name: 'Jayesh Kumar', status: 'present' },
];

export const lessonPlans: LessonPlanEntry[] = [
  { id: 'lp-1', weekNumber: 1, topic: 'Introduction to Data Structures', subtopics: ['Arrays', 'Complexity Analysis'], plannedDate: '2026-01-13', actualDate: '2026-01-13', status: 'completed', courseOutcome: 'CO1' },
  { id: 'lp-2', weekNumber: 2, topic: 'Linked Lists', subtopics: ['Singly', 'Doubly', 'Circular'], plannedDate: '2026-01-20', actualDate: '2026-01-20', status: 'completed', courseOutcome: 'CO1' },
  { id: 'lp-3', weekNumber: 3, topic: 'Stacks & Queues', subtopics: ['Stack operations', 'Queue variants', 'Applications'], plannedDate: '2026-01-27', actualDate: '2026-01-27', status: 'completed', courseOutcome: 'CO2' },
  { id: 'lp-4', weekNumber: 4, topic: 'Trees', subtopics: ['Binary Trees', 'BST', 'AVL Trees'], plannedDate: '2026-02-03', actualDate: '2026-02-03', status: 'completed', courseOutcome: 'CO2' },
  { id: 'lp-5', weekNumber: 5, topic: 'Heaps & Priority Queues', subtopics: ['Min-Heap', 'Max-Heap', 'Applications'], plannedDate: '2026-02-10', actualDate: '2026-02-10', status: 'completed', courseOutcome: 'CO3' },
  { id: 'lp-6', weekNumber: 6, topic: 'Graphs – Basics', subtopics: ['Representation', 'BFS', 'DFS'], plannedDate: '2026-02-17', actualDate: '2026-02-18', status: 'completed', courseOutcome: 'CO3' },
  { id: 'lp-7', weekNumber: 7, topic: 'Shortest Path Algorithms', subtopics: ['Dijkstra', 'Bellman-Ford'], plannedDate: '2026-02-24', status: 'pending', courseOutcome: 'CO4' },
  { id: 'lp-8', weekNumber: 8, topic: 'Hashing', subtopics: ['Hash Functions', 'Collision Resolution'], plannedDate: '2026-03-03', status: 'pending', courseOutcome: 'CO4' },
];

export const facultyAssignments: FacultyAssignment[] = [
  { id: 'fa-1', courseId: 'fc-1', courseCode: 'CS301', courseName: 'Data Structures & Algorithms', title: 'Linked List Implementation', description: 'Implement singly and doubly linked lists with all operations', dueDate: '2026-03-10', totalSubmissions: 52, pendingEvaluation: 18, maxMarks: 20, type: 'assignment', status: 'published' },
  { id: 'fa-2', courseId: 'fc-1', courseCode: 'CS301', courseName: 'Data Structures & Algorithms', title: 'BST Quiz', description: 'Online quiz on BST operations', dueDate: '2026-03-05', totalSubmissions: 63, pendingEvaluation: 0, maxMarks: 10, type: 'quiz', status: 'graded' },
  { id: 'fa-3', courseId: 'fc-2', courseCode: 'CS501', courseName: 'Machine Learning', title: 'Linear Regression Project', description: 'Build a linear regression model on a real-world dataset', dueDate: '2026-03-15', totalSubmissions: 38, pendingEvaluation: 38, maxMarks: 30, type: 'project', status: 'published' },
  { id: 'fa-4', courseId: 'fc-2', courseCode: 'CS501', courseName: 'Machine Learning', title: 'SVM Classification Report', description: 'Lab report on Support Vector Machines', dueDate: '2026-03-20', totalSubmissions: 0, pendingEvaluation: 0, maxMarks: 15, type: 'lab_report', status: 'draft' },
  { id: 'fa-5', courseId: 'fc-3', courseCode: 'CS601', courseName: 'Deep Learning', title: 'CNN Architecture Analysis', description: 'Analyze and compare CNN architectures', dueDate: '2026-03-12', totalSubmissions: 28, pendingEvaluation: 5, maxMarks: 25, type: 'assignment', status: 'published' },
];

export const sampleSubmissions: StudentSubmission[] = [
  { id: 'sub-1', studentId: 's1', rollNumber: '21CS001', studentName: 'Aarav Sharma', submittedAt: '2026-03-08T14:30:00', status: 'submitted', fileUrl: '#' },
  { id: 'sub-2', studentId: 's2', rollNumber: '21CS002', studentName: 'Bhavya Patel', submittedAt: '2026-03-07T22:15:00', status: 'evaluated', marks: 17, feedback: 'Good implementation. Edge cases handled well.' },
  { id: 'sub-3', studentId: 's3', rollNumber: '21CS003', studentName: 'Chitra Nair', submittedAt: '2026-03-09T09:00:00', status: 'late' },
  { id: 'sub-4', studentId: 's4', rollNumber: '21CS004', studentName: 'Dhruv Gupta', submittedAt: '2026-03-08T16:45:00', status: 'submitted' },
  { id: 'sub-5', studentId: 's5', rollNumber: '21CS005', studentName: 'Esha Reddy', submittedAt: '2026-03-07T11:20:00', status: 'evaluated', marks: 19, feedback: 'Excellent work with clean code.' },
];

export const internalMarks: InternalMarksEntry[] = [
  { studentId: 's1', rollNumber: '21CS001', studentName: 'Aarav Sharma', quiz1: 8, quiz2: 9, midterm: 35, assignment: 17, attendance: 9, total: 78, maxTotal: 100 },
  { studentId: 's2', rollNumber: '21CS002', studentName: 'Bhavya Patel', quiz1: 7, quiz2: 8, midterm: 32, assignment: 18, attendance: 10, total: 75, maxTotal: 100 },
  { studentId: 's3', rollNumber: '21CS003', studentName: 'Chitra Nair', quiz1: 5, quiz2: 6, midterm: 22, assignment: 12, attendance: 6, total: 51, maxTotal: 100 },
  { studentId: 's4', rollNumber: '21CS004', studentName: 'Dhruv Gupta', quiz1: 9, quiz2: 10, midterm: 40, assignment: 19, attendance: 10, total: 88, maxTotal: 100 },
  { studentId: 's5', rollNumber: '21CS005', studentName: 'Esha Reddy', quiz1: 10, quiz2: 9, midterm: 42, assignment: 20, attendance: 10, total: 91, maxTotal: 100 },
];

export const menteeStudents: MenteeStudent[] = [
  {
    id: 'm1', rollNumber: '21CS003', name: 'Chitra Nair', program: 'B.Tech CSE', semester: 5, section: 'A',
    cgpa: 6.2, attendance: 62, email: 'chitra@student.university.edu', phone: '9876500003',
    riskLevel: 'high', lastMeetingDate: '2026-02-20',
    counselingNotes: [
      { id: 'cn1', date: '2026-02-20', topic: 'Low Attendance', notes: 'Student has health issues. Advised to get medical certificate and attend regularly.', followUpDate: '2026-03-10', status: 'open' },
      { id: 'cn2', date: '2026-01-15', topic: 'Academic Performance', notes: 'Struggling with DSA. Referred to peer tutoring program.', status: 'resolved' },
    ],
  },
  {
    id: 'm2', rollNumber: '21CS007', name: 'Gauri Joshi', program: 'B.Tech CSE', semester: 5, section: 'A',
    cgpa: 8.5, attendance: 90, email: 'gauri@student.university.edu', phone: '9876500007',
    riskLevel: 'low', lastMeetingDate: '2026-02-25',
    counselingNotes: [
      { id: 'cn3', date: '2026-02-25', topic: 'Career Guidance', notes: 'Interested in ML research. Suggested applying for summer internship at IIIT-H.', status: 'resolved' },
    ],
  },
  {
    id: 'm3', rollNumber: '21CS015', name: 'Karthik Iyer', program: 'B.Tech CSE', semester: 5, section: 'A',
    cgpa: 7.1, attendance: 74, email: 'karthik@student.university.edu', phone: '9876500015',
    riskLevel: 'medium', lastMeetingDate: '2026-02-10',
    counselingNotes: [
      { id: 'cn4', date: '2026-02-10', topic: 'Attendance Warning', notes: 'Attendance below 75% in 2 subjects. Warned about debarment policy.', followUpDate: '2026-03-05', status: 'open' },
    ],
  },
  {
    id: 'm4', rollNumber: '21CS022', name: 'Meera Shankar', program: 'B.Tech CSE', semester: 5, section: 'A',
    cgpa: 9.1, attendance: 95, email: 'meera@student.university.edu', phone: '9876500022',
    riskLevel: 'low', lastMeetingDate: '2026-03-01',
    counselingNotes: [],
  },
  {
    id: 'm5', rollNumber: '21CS030', name: 'Nikhil Bose', program: 'B.Tech CSE', semester: 5, section: 'A',
    cgpa: 5.8, attendance: 58, email: 'nikhil@student.university.edu', phone: '9876500030',
    riskLevel: 'high',
    counselingNotes: [
      { id: 'cn5', date: '2026-01-20', topic: 'Academic Probation', notes: 'CGPA below 6.0. On academic probation. Parents contacted.', followUpDate: '2026-02-28', status: 'open' },
    ],
  },
];

export const publications: Publication[] = [
  { id: 'pub-1', title: 'A Novel Approach to Sentiment Analysis using Transformer Networks', authors: ['Neha Agarwal', 'Vikram Singh'], journal: 'IEEE Transactions on NLP', year: 2025, doi: '10.1109/TNLP.2025.001', indexing: 'SCI', citations: 12, type: 'journal', status: 'published' },
  { id: 'pub-2', title: 'Efficient Feature Selection for High-Dimensional Datasets', authors: ['Neha Agarwal', 'Priya Mehta', 'Rahul Das'], journal: 'Knowledge-Based Systems (Elsevier)', year: 2025, doi: '10.1016/kbs.2025.002', indexing: 'SCI', citations: 8, type: 'journal', status: 'published' },
  { id: 'pub-3', title: 'Deep Reinforcement Learning for Campus Energy Optimization', authors: ['Neha Agarwal', 'Suresh Patel'], journal: 'AAAI 2026', year: 2026, indexing: 'Scopus', citations: 0, type: 'conference', status: 'accepted' },
  { id: 'pub-4', title: 'Explainable AI in Education: A Comprehensive Survey', authors: ['Neha Agarwal'], journal: 'ACM Computing Surveys', year: 2026, indexing: 'SCI', citations: 0, type: 'journal', status: 'under_review' },
  { id: 'pub-5', title: 'Federated Learning for Privacy-Preserving Student Analytics', authors: ['Neha Agarwal', 'Anita Gupta'], journal: 'ICML 2026', year: 2026, indexing: 'Scopus', citations: 0, type: 'conference', status: 'submitted' },
];

export const researchProjects: ResearchProject[] = [
  { id: 'rp-1', title: 'AI-Driven Personalized Learning Framework', fundingAgency: 'DST-SERB', amount: 2500000, startDate: '2024-04-01', endDate: '2027-03-31', status: 'ongoing', coInvestigators: ['Dr. Vikram Singh'], amountSpent: 1200000 },
  { id: 'rp-2', title: 'NLP for Indian Regional Languages', fundingAgency: 'UGC', amount: 1500000, startDate: '2023-01-01', endDate: '2025-12-31', status: 'ongoing', coInvestigators: ['Dr. Priya Mehta', 'Prof. Rajan K.'], amountSpent: 1350000 },
  { id: 'rp-3', title: 'Smart Campus IoT Analytics', fundingAgency: 'Industry (TCS)', amount: 800000, startDate: '2025-06-01', endDate: '2026-05-31', status: 'ongoing', coInvestigators: [], amountSpent: 350000 },
];

export const patents: Patent[] = [
  { id: 'pat-1', title: 'System for Automated Attendance using Face Recognition', applicationNumber: 'IN202100045678', filingDate: '2021-09-15', status: 'granted', inventors: ['Neha Agarwal', 'Vikram Singh'] },
  { id: 'pat-2', title: 'AI-based Student Risk Prediction Engine', applicationNumber: 'IN202300078901', filingDate: '2023-03-20', status: 'published', inventors: ['Neha Agarwal'] },
];

export const committees: Committee[] = [
  { id: 'com-1', name: 'Board of Studies – CSE', role: 'Member', tenure: '2024-2026', meetingsAttended: 3, totalMeetings: 4, nextMeeting: '2026-03-20', documents: ['BoS Minutes Q3', 'Curriculum Revision Draft'] },
  { id: 'com-2', name: 'IQAC Sub-Committee (ICT)', role: 'Convener', tenure: '2025-2027', meetingsAttended: 2, totalMeetings: 2, nextMeeting: '2026-04-05', documents: ['ICT AQAR Section', 'Best Practices Report'] },
  { id: 'com-3', name: 'Anti-Ragging Committee', role: 'Member', tenure: '2025-2026', meetingsAttended: 1, totalMeetings: 1, documents: ['Committee Charter'] },
  { id: 'com-4', name: 'NBA Accreditation Team – CSE', role: 'OBE Coordinator', tenure: '2025-2026', meetingsAttended: 5, totalMeetings: 6, nextMeeting: '2026-03-15', documents: ['CO-PO Mapping', 'Attainment Data'] },
];

export const leaveBalances: LeaveBalance[] = [
  { type: 'Casual Leave', total: 12, used: 4, remaining: 8 },
  { type: 'Earned Leave', total: 30, used: 5, remaining: 25 },
  { type: 'Medical Leave', total: 12, used: 0, remaining: 12 },
  { type: 'Duty Leave', total: 15, used: 3, remaining: 12 },
  { type: 'Academic Leave', total: 10, used: 2, remaining: 8 },
];

export const leaveHistory: FacultyLeave[] = [
  { id: 'lv-1', type: 'casual', fromDate: '2026-02-14', toDate: '2026-02-14', days: 1, reason: 'Personal work', status: 'approved', approvedBy: 'Dr. Vikram Singh (HOD)' },
  { id: 'lv-2', type: 'duty', fromDate: '2026-01-20', toDate: '2026-01-22', days: 3, reason: 'AAAI 2026 Conference, Vancouver', status: 'approved', approvedBy: 'Dr. Priya Mehta (Dean)' },
  { id: 'lv-3', type: 'casual', fromDate: '2026-03-12', toDate: '2026-03-13', days: 2, reason: 'Family function', status: 'pending' },
];

export const feedbackSummaries: FeedbackSummary[] = [
  {
    courseId: 'fc-1', courseCode: 'CS301', courseName: 'Data Structures & Algorithms',
    semester: 'Odd 2025-26', overallRating: 4.2, maxRating: 5, totalResponses: 58,
    categories: [
      { name: 'Course Content', score: 4.3, maxScore: 5 },
      { name: 'Teaching Methodology', score: 4.1, maxScore: 5 },
      { name: 'Accessibility', score: 4.5, maxScore: 5 },
      { name: 'Assessment Fairness', score: 4.0, maxScore: 5 },
    ],
    suggestions: ['More coding examples during lectures', 'Add more practice problems', 'Lab sessions need better TAs'],
  },
  {
    courseId: 'fc-2', courseCode: 'CS501', courseName: 'Machine Learning',
    semester: 'Odd 2025-26', overallRating: 4.5, maxRating: 5, totalResponses: 50,
    categories: [
      { name: 'Course Content', score: 4.6, maxScore: 5 },
      { name: 'Teaching Methodology', score: 4.4, maxScore: 5 },
      { name: 'Accessibility', score: 4.7, maxScore: 5 },
      { name: 'Assessment Fairness', score: 4.3, maxScore: 5 },
    ],
    suggestions: ['Include more real-world projects', 'Pace is slightly fast for some topics'],
  },
];

export const facultyGrievances: FacultyGrievance[] = [
  { id: 'fg-1', type: 'assigned_review', subject: 'Lab equipment not functional', description: 'Students reported non-functional GPUs in Lab-AI1', filedBy: 'Student (Anonymous)', filedAt: '2026-03-01', status: 'under_review' },
  { id: 'fg-2', type: 'self_filed', subject: 'AC not working in PG-201', description: 'Air conditioning in PG-201 has been non-functional for 2 weeks', filedBy: 'Self', filedAt: '2026-02-25', status: 'responded', response: 'Maintenance team scheduled for repair on 28 Feb.' },
];

export const classMessages: ClassMessage[] = [
  { id: 'cm-1', courseId: 'fc-1', courseCode: 'CS301', subject: 'Extra class on Saturday', message: 'There will be an extra class on Saturday 10 AM in LH-301 to cover Graph algorithms.', sentAt: '2026-03-06T10:00:00', recipients: 65, readCount: 48 },
  { id: 'cm-2', courseId: 'fc-2', courseCode: 'CS501', subject: 'Project submission deadline extended', message: 'The Linear Regression project deadline has been extended to 15 March.', sentAt: '2026-03-05T14:30:00', recipients: 58, readCount: 55 },
  { id: 'cm-3', courseId: 'fc-3', courseCode: 'CS601', subject: 'Guest lecture by Dr. Y. LeCun', message: 'A special guest lecture on CNN advances will be held on 12 March at 3 PM in the auditorium.', sentAt: '2026-03-04T09:00:00', recipients: 32, readCount: 30 },
];
