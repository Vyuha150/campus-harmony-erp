import {
  DepartmentFaculty, DepartmentStudent, HODApprovalItem,
  DepartmentCalendarEvent, CourseAssignment, TimetableSlot,
  CourseResult, LabInventoryItem, PurchaseRequest, AccreditationDataItem
} from '@/types/hod';

export const departmentFaculty: DepartmentFaculty[] = [
  {
    id: 'df-1', name: 'Prof. Neha Agarwal', employeeId: 'EMP-CSE-101',
    designation: 'Associate Professor', qualification: 'Ph.D. (IIT Delhi)',
    specialization: 'Machine Learning & NLP', email: 'neha@university.edu',
    phone: '9876500001', dateOfJoining: '2018-07-15', type: 'permanent',
    coursesAssigned: 3, weeklyHours: 16, publications: 28, isOnLeave: false,
    roles: ['Mentoring Coordinator', 'NAAC Criterion 3 Lead'],
  },
  {
    id: 'df-2', name: 'Dr. Rahul Deshmukh', employeeId: 'EMP-CSE-102',
    designation: 'Professor', qualification: 'Ph.D. (IISc Bangalore)',
    specialization: 'Computer Networks & Security', email: 'rahul.d@university.edu',
    phone: '9876500002', dateOfJoining: '2012-01-10', type: 'permanent',
    coursesAssigned: 2, weeklyHours: 12, publications: 45, isOnLeave: false,
    roles: ['BoS Chairman', 'PhD Guide'],
  },
  {
    id: 'df-3', name: 'Dr. Sunita Patil', employeeId: 'EMP-CSE-103',
    designation: 'Assistant Professor', qualification: 'Ph.D. (NIT Trichy)',
    specialization: 'Data Science & Big Data', email: 'sunita.p@university.edu',
    phone: '9876500003', dateOfJoining: '2020-08-01', type: 'permanent',
    coursesAssigned: 4, weeklyHours: 18, publications: 12, isOnLeave: false,
    roles: ['Class Coordinator (3rd Year)', 'Lab In-charge (Data Science)'],
  },
  {
    id: 'df-4', name: 'Mr. Amit Jain', employeeId: 'EMP-CSE-104',
    designation: 'Assistant Professor', qualification: 'M.Tech (VIT)',
    specialization: 'Software Engineering', email: 'amit.j@university.edu',
    phone: '9876500004', dateOfJoining: '2021-06-15', type: 'permanent',
    coursesAssigned: 4, weeklyHours: 20, publications: 5, isOnLeave: true,
    leaveType: 'Casual Leave', roles: ['NSS Coordinator'],
  },
  {
    id: 'df-5', name: 'Dr. Kavita Sharma', employeeId: 'EMP-CSE-105',
    designation: 'Associate Professor', qualification: 'Ph.D. (BITS Pilani)',
    specialization: 'Artificial Intelligence & Robotics', email: 'kavita.s@university.edu',
    phone: '9876500005', dateOfJoining: '2016-11-01', type: 'permanent',
    coursesAssigned: 3, weeklyHours: 14, publications: 32, isOnLeave: false,
    roles: ['Exam Coordinator', 'IQAC Member'],
  },
  {
    id: 'df-6', name: 'Prof. James Wilson', employeeId: 'EMP-CSE-ADJ-01',
    designation: 'Adjunct', qualification: 'M.S. (Stanford)',
    specialization: 'Cloud Computing', email: 'james.w@university.edu',
    phone: '9876500006', dateOfJoining: '2024-01-10', type: 'adjunct',
    coursesAssigned: 1, weeklyHours: 6, publications: 8, isOnLeave: false,
    roles: [],
  },
  {
    id: 'df-7', name: 'Dr. Meera Nair', employeeId: 'EMP-CSE-106',
    designation: 'Assistant Professor', qualification: 'Ph.D. (IIT Madras)',
    specialization: 'Theoretical Computer Science', email: 'meera.n@university.edu',
    phone: '9876500007', dateOfJoining: '2022-07-20', type: 'permanent',
    coursesAssigned: 3, weeklyHours: 16, publications: 9, isOnLeave: false,
    roles: ['Lab In-charge (Algorithms)'],
  },
];

export const departmentStudents: DepartmentStudent[] = [
  { id: 'ds-1', rollNumber: '21CS001', name: 'Aarav Sharma', program: 'B.Tech CSE', year: 3, semester: 5, section: 'A', cgpa: 8.5, attendance: 88, advisor: 'Prof. Neha Agarwal', status: 'active', email: 'aarav@student.university.edu' },
  { id: 'ds-2', rollNumber: '21CS002', name: 'Bhavya Patel', program: 'B.Tech CSE', year: 3, semester: 5, section: 'A', cgpa: 7.8, attendance: 82, advisor: 'Prof. Neha Agarwal', status: 'active', email: 'bhavya@student.university.edu' },
  { id: 'ds-3', rollNumber: '21CS003', name: 'Chitra Nair', program: 'B.Tech CSE', year: 3, semester: 5, section: 'A', cgpa: 6.2, attendance: 62, advisor: 'Prof. Neha Agarwal', status: 'active', email: 'chitra@student.university.edu' },
  { id: 'ds-4', rollNumber: '22CS001', name: 'Deepak Verma', program: 'B.Tech CSE', year: 2, semester: 3, section: 'A', cgpa: 9.1, attendance: 95, advisor: 'Dr. Sunita Patil', status: 'active', email: 'deepak@student.university.edu' },
  { id: 'ds-5', rollNumber: '22CS002', name: 'Esha Gupta', program: 'B.Tech CSE', year: 2, semester: 3, section: 'B', cgpa: 7.5, attendance: 78, advisor: 'Dr. Sunita Patil', status: 'active', email: 'esha@student.university.edu' },
  { id: 'ds-6', rollNumber: '20CS001', name: 'Farhan Khan', program: 'B.Tech CSE', year: 4, semester: 7, section: 'A', cgpa: 8.9, attendance: 90, advisor: 'Dr. Rahul Deshmukh', status: 'active', email: 'farhan@student.university.edu' },
  { id: 'ds-7', rollNumber: '23CS001', name: 'Gauri Joshi', program: 'B.Tech CSE', year: 1, semester: 1, section: 'A', cgpa: 8.0, attendance: 91, advisor: 'Dr. Meera Nair', status: 'active', email: 'gauri@student.university.edu' },
  { id: 'ds-8', rollNumber: '23CS002', name: 'Harsh Mehta', program: 'B.Tech CSE', year: 1, semester: 1, section: 'B', cgpa: 5.8, attendance: 58, advisor: 'Dr. Meera Nair', status: 'active', email: 'harsh@student.university.edu' },
  { id: 'ds-9', rollNumber: '21CS050', name: 'Isha Reddy', program: 'M.Tech CSE', year: 2, semester: 3, section: 'PG', cgpa: 9.4, attendance: 96, advisor: 'Dr. Kavita Sharma', status: 'active', email: 'isha@student.university.edu' },
  { id: 'ds-10', rollNumber: '20CS010', name: 'Jay Singh', program: 'B.Tech CSE', year: 4, semester: 7, section: 'B', cgpa: 4.9, attendance: 55, advisor: 'Dr. Rahul Deshmukh', status: 'detained', email: 'jay@student.university.edu' },
];

export const hodApprovals: HODApprovalItem[] = [
  { id: 'ha-1', type: 'leave', title: 'Casual Leave – Mr. Amit Jain', requestedBy: 'Mr. Amit Jain', requestedAt: '2026-03-07', details: '2 days casual leave (10–11 March) for personal reasons', priority: 'medium', status: 'pending' },
  { id: 'ha-2', type: 'purchase', title: 'GPU Server for AI Lab', requestedBy: 'Dr. Sunita Patil', requestedAt: '2026-03-06', details: 'NVIDIA A100 GPU Server – ₹8,50,000 for Data Science Lab upgrades', priority: 'high', status: 'pending' },
  { id: 'ha-3', type: 'section_change', title: 'Section Change – Esha Gupta', requestedBy: 'Esha Gupta (22CS002)', requestedAt: '2026-03-05', details: 'Request to move from Section B to Section A due to timetable conflict with minor elective', priority: 'low', status: 'pending' },
  { id: 'ha-4', type: 'od', title: 'OD Request – Dr. Kavita Sharma', requestedBy: 'Dr. Kavita Sharma', requestedAt: '2026-03-04', details: 'On-duty for IEEE conference presentation at IIT Bombay (12–14 March)', priority: 'medium', status: 'pending' },
  { id: 'ha-5', type: 'grievance', title: 'Lab Facility Complaint', requestedBy: 'Student (Anonymous)', requestedAt: '2026-03-03', details: 'Multiple systems in Lab 3 are non-functional; students unable to complete practicals', priority: 'high', status: 'pending' },
  { id: 'ha-6', type: 'grade_change', title: 'Grade Re-evaluation – CS301', requestedBy: 'Chitra Nair (21CS003)', requestedAt: '2026-03-02', details: 'Request for re-evaluation of midterm answer script in CS301 Data Structures', priority: 'medium', status: 'pending' },
  { id: 'ha-7', type: 'elective', title: 'New Elective: Quantum Computing', requestedBy: 'Dr. Rahul Deshmukh', requestedAt: '2026-03-01', details: 'Proposal to offer "Introduction to Quantum Computing" as open elective for Sem 6', priority: 'low', status: 'pending' },
];

export const departmentCalendar: DepartmentCalendarEvent[] = [
  { id: 'dc-1', title: 'End-Sem Question Paper Submission', date: '2026-03-15', type: 'deadline', description: 'All faculty must submit question papers to Exam Cell' },
  { id: 'dc-2', title: 'Department Faculty Meeting', date: '2026-03-10', time: '03:00 PM', type: 'meeting', description: 'Monthly review of academic progress and research updates' },
  { id: 'dc-3', title: 'Guest Lecture – Dr. Andrew Ng (Online)', date: '2026-03-12', time: '11:00 AM', type: 'seminar', description: 'Talk on "Future of AI in Education" for all CSE students' },
  { id: 'dc-4', title: 'Mid-Semester Exam Week Begins', date: '2026-03-20', type: 'exam' },
  { id: 'dc-5', title: 'Faculty Appraisal Deadline', date: '2026-03-25', type: 'appraisal', description: 'Submit self-appraisal forms for annual performance review' },
  { id: 'dc-6', title: 'Board of Studies Meeting', date: '2026-03-28', time: '10:00 AM', type: 'meeting', description: 'Curriculum revision discussion for next academic year' },
  { id: 'dc-7', title: 'NIRF Data Submission Deadline', date: '2026-03-31', type: 'deadline', description: 'Submit departmental NIRF data to IQAC' },
];

export const courseAssignments: CourseAssignment[] = [
  { id: 'ca-1', courseCode: 'CS301', courseName: 'Data Structures & Algorithms', credits: 4, semester: 5, section: 'A', assignedFaculty: 'Prof. Neha Agarwal', facultyId: 'df-1', schedule: 'Mon/Wed/Fri 09:00–10:00', students: 65, type: 'theory' },
  { id: 'ca-2', courseCode: 'CS301L', courseName: 'DSA Lab', credits: 2, semester: 5, section: 'A', assignedFaculty: 'Prof. Neha Agarwal', facultyId: 'df-1', schedule: 'Thu 14:00–16:00', students: 65, type: 'lab' },
  { id: 'ca-3', courseCode: 'CS401', courseName: 'Computer Networks', credits: 4, semester: 7, section: 'A', assignedFaculty: 'Dr. Rahul Deshmukh', facultyId: 'df-2', schedule: 'Tue/Thu 10:00–11:00', students: 58, type: 'theory' },
  { id: 'ca-4', courseCode: 'CS501', courseName: 'Machine Learning', credits: 4, semester: 5, section: 'A', assignedFaculty: 'Prof. Neha Agarwal', facultyId: 'df-1', schedule: 'Tue/Thu 14:00–16:00', students: 58, type: 'theory' },
  { id: 'ca-5', courseCode: 'CS201', courseName: 'Object Oriented Programming', credits: 4, semester: 3, section: 'A', assignedFaculty: 'Mr. Amit Jain', facultyId: 'df-4', schedule: 'Mon/Wed/Fri 11:00–12:00', students: 70, type: 'theory' },
  { id: 'ca-6', courseCode: 'CS601', courseName: 'Deep Learning', credits: 3, semester: 5, section: 'A', assignedFaculty: 'Dr. Kavita Sharma', facultyId: 'df-5', schedule: 'Mon/Wed 11:00–12:00', students: 32, type: 'theory' },
  { id: 'ca-7', courseCode: 'CS701', courseName: 'Cloud Computing', credits: 3, semester: 7, section: 'A', assignedFaculty: 'Prof. James Wilson', facultyId: 'df-6', schedule: 'Fri 10:00–12:00', students: 45, type: 'theory' },
  { id: 'ca-8', courseCode: 'CS101', courseName: 'Programming Fundamentals', credits: 4, semester: 1, section: 'A', assignedFaculty: 'Dr. Meera Nair', facultyId: 'df-7', schedule: 'Mon/Wed/Fri 09:00–10:00', students: 80, type: 'theory' },
  { id: 'ca-9', courseCode: 'CS302', courseName: 'Database Management Systems', credits: 4, semester: 5, section: 'B', assignedFaculty: 'Dr. Sunita Patil', facultyId: 'df-3', schedule: 'Tue/Thu/Sat 09:00–10:00', students: 62, type: 'theory' },
];

export const departmentTimetable: TimetableSlot[] = [
  { id: 'tt-1', day: 'Monday', startTime: '09:00', endTime: '10:00', courseCode: 'CS301', courseName: 'Data Structures', faculty: 'Prof. Neha Agarwal', room: 'LH-301', section: 'A', type: 'lecture' },
  { id: 'tt-2', day: 'Monday', startTime: '09:00', endTime: '10:00', courseCode: 'CS101', courseName: 'Programming Fundamentals', faculty: 'Dr. Meera Nair', room: 'LH-101', section: 'A (1st Year)', type: 'lecture' },
  { id: 'tt-3', day: 'Monday', startTime: '11:00', endTime: '12:00', courseCode: 'CS201', courseName: 'OOP', faculty: 'Mr. Amit Jain', room: 'LH-201', section: 'A (2nd Year)', type: 'lecture' },
  { id: 'tt-4', day: 'Monday', startTime: '11:00', endTime: '12:00', courseCode: 'CS601', courseName: 'Deep Learning', faculty: 'Dr. Kavita Sharma', room: 'PG-201', section: 'A (3rd Year)', type: 'lecture' },
  { id: 'tt-5', day: 'Tuesday', startTime: '10:00', endTime: '11:00', courseCode: 'CS401', courseName: 'Computer Networks', faculty: 'Dr. Rahul Deshmukh', room: 'LH-401', section: 'A (4th Year)', type: 'lecture' },
  { id: 'tt-6', day: 'Tuesday', startTime: '14:00', endTime: '16:00', courseCode: 'CS501', courseName: 'Machine Learning', faculty: 'Prof. Neha Agarwal', room: 'Lab-AI1', section: 'A', type: 'lab' },
  { id: 'tt-7', day: 'Wednesday', startTime: '09:00', endTime: '10:00', courseCode: 'CS301', courseName: 'Data Structures', faculty: 'Prof. Neha Agarwal', room: 'LH-301', section: 'A', type: 'lecture' },
  { id: 'tt-8', day: 'Thursday', startTime: '14:00', endTime: '16:00', courseCode: 'CS301L', courseName: 'DSA Lab', faculty: 'Prof. Neha Agarwal', room: 'Lab-CS1', section: 'A', type: 'lab' },
  { id: 'tt-9', day: 'Friday', startTime: '09:00', endTime: '10:00', courseCode: 'CS301', courseName: 'Data Structures', faculty: 'Prof. Neha Agarwal', room: 'LH-301', section: 'A', type: 'lecture' },
  { id: 'tt-10', day: 'Friday', startTime: '10:00', endTime: '12:00', courseCode: 'CS701', courseName: 'Cloud Computing', faculty: 'Prof. James Wilson', room: 'LH-701', section: 'A (4th Year)', type: 'lecture' },
];

export const courseResults: CourseResult[] = [
  { courseCode: 'CS301', courseName: 'Data Structures & Algorithms', faculty: 'Prof. Neha Agarwal', totalStudents: 65, passed: 58, failed: 7, passPercentage: 89.2, avgScore: 64.3, highestScore: 96, gradeDistribution: [{ grade: 'O', count: 8 }, { grade: 'A+', count: 12 }, { grade: 'A', count: 15 }, { grade: 'B+', count: 10 }, { grade: 'B', count: 8 }, { grade: 'C', count: 5 }, { grade: 'F', count: 7 }] },
  { courseCode: 'CS401', courseName: 'Computer Networks', faculty: 'Dr. Rahul Deshmukh', totalStudents: 58, passed: 55, failed: 3, passPercentage: 94.8, avgScore: 71.5, highestScore: 98, gradeDistribution: [{ grade: 'O', count: 10 }, { grade: 'A+', count: 14 }, { grade: 'A', count: 12 }, { grade: 'B+', count: 11 }, { grade: 'B', count: 5 }, { grade: 'C', count: 3 }, { grade: 'F', count: 3 }] },
  { courseCode: 'CS201', courseName: 'Object Oriented Programming', faculty: 'Mr. Amit Jain', totalStudents: 70, passed: 60, failed: 10, passPercentage: 85.7, avgScore: 58.2, highestScore: 92, gradeDistribution: [{ grade: 'O', count: 5 }, { grade: 'A+', count: 8 }, { grade: 'A', count: 12 }, { grade: 'B+', count: 15 }, { grade: 'B', count: 12 }, { grade: 'C', count: 8 }, { grade: 'F', count: 10 }] },
  { courseCode: 'CS601', courseName: 'Deep Learning', faculty: 'Dr. Kavita Sharma', totalStudents: 32, passed: 30, failed: 2, passPercentage: 93.8, avgScore: 72.8, highestScore: 95, gradeDistribution: [{ grade: 'O', count: 6 }, { grade: 'A+', count: 8 }, { grade: 'A', count: 7 }, { grade: 'B+', count: 5 }, { grade: 'B', count: 3 }, { grade: 'C', count: 1 }, { grade: 'F', count: 2 }] },
  { courseCode: 'CS101', courseName: 'Programming Fundamentals', faculty: 'Dr. Meera Nair', totalStudents: 80, passed: 72, failed: 8, passPercentage: 90.0, avgScore: 66.1, highestScore: 99, gradeDistribution: [{ grade: 'O', count: 10 }, { grade: 'A+', count: 14 }, { grade: 'A', count: 18 }, { grade: 'B+', count: 12 }, { grade: 'B', count: 10 }, { grade: 'C', count: 8 }, { grade: 'F', count: 8 }] },
];

export const labInventory: LabInventoryItem[] = [
  { id: 'li-1', name: 'Dell OptiPlex 7090 Desktop', lab: 'Computer Lab 1', category: 'Computer', quantity: 40, workingCondition: 38, lastMaintenance: '2026-01-15', purchaseDate: '2023-06-01', warrantyExpiry: '2026-06-01', status: 'working' },
  { id: 'li-2', name: 'NVIDIA RTX 3060 GPU', lab: 'AI/ML Lab', category: 'GPU', quantity: 10, workingCondition: 10, lastMaintenance: '2026-02-10', purchaseDate: '2024-01-15', warrantyExpiry: '2027-01-15', status: 'working' },
  { id: 'li-3', name: 'Cisco Router 2901', lab: 'Networks Lab', category: 'Networking', quantity: 8, workingCondition: 7, lastMaintenance: '2025-12-01', purchaseDate: '2022-03-10', status: 'maintenance' },
  { id: 'li-4', name: 'HP LaserJet Pro M404', lab: 'Computer Lab 1', category: 'Printer', quantity: 2, workingCondition: 1, lastMaintenance: '2026-01-20', purchaseDate: '2023-08-15', status: 'faulty' },
  { id: 'li-5', name: 'BenQ Projector MH733', lab: 'Seminar Hall', category: 'Projector', quantity: 3, workingCondition: 3, lastMaintenance: '2026-02-28', purchaseDate: '2024-07-01', warrantyExpiry: '2027-07-01', status: 'working' },
  { id: 'li-6', name: 'Arduino Mega 2560', lab: 'IoT Lab', category: 'Microcontroller', quantity: 30, workingCondition: 28, lastMaintenance: '2026-01-05', purchaseDate: '2024-02-20', status: 'working' },
];

export const purchaseRequests: PurchaseRequest[] = [
  { id: 'pr-1', itemName: 'NVIDIA A100 GPU Server', lab: 'AI/ML Lab', requestedBy: 'Dr. Sunita Patil', quantity: 1, estimatedCost: 850000, justification: 'Required for deep learning research and M.Tech projects', status: 'pending', requestDate: '2026-03-06' },
  { id: 'pr-2', itemName: 'HP LaserJet Pro Printer', lab: 'Computer Lab 1', requestedBy: 'Lab Assistant', quantity: 1, estimatedCost: 28000, justification: 'Replacement for faulty printer', status: 'approved', requestDate: '2026-02-28' },
  { id: 'pr-3', itemName: 'Raspberry Pi 5 Kit', lab: 'IoT Lab', requestedBy: 'Dr. Meera Nair', quantity: 20, estimatedCost: 120000, justification: 'For IoT elective course lab sessions', status: 'pending', requestDate: '2026-03-04' },
];

export const accreditationData: AccreditationDataItem[] = [
  { id: 'ad-1', criterion: 'Criterion 1 – Curricular Aspects', metric: 'Courses with OBE Mapping', value: '92%', year: '2025-26', status: 'complete', lastUpdated: '2026-02-20', updatedBy: 'Dr. Vikram Singh' },
  { id: 'ad-2', criterion: 'Criterion 2 – Teaching-Learning', metric: 'Student-Faculty Ratio', value: '18:1', year: '2025-26', status: 'complete', lastUpdated: '2026-02-15', updatedBy: 'System' },
  { id: 'ad-3', criterion: 'Criterion 3 – Research', metric: 'Faculty Publications (SCI/Scopus)', value: '45', year: '2025-26', status: 'needs_review', lastUpdated: '2026-02-10', updatedBy: 'System' },
  { id: 'ad-4', criterion: 'Criterion 3 – Research', metric: 'Funded Research Projects', value: '₹1.2 Cr', year: '2025-26', status: 'complete', lastUpdated: '2026-02-18', updatedBy: 'Dr. Vikram Singh' },
  { id: 'ad-5', criterion: 'Criterion 4 – Infrastructure', metric: 'Lab Utilization Rate', value: '78%', year: '2025-26', status: 'pending', lastUpdated: '2026-01-30', updatedBy: 'System' },
  { id: 'ad-6', criterion: 'Criterion 5 – Student Support', metric: 'Placement Rate', value: '86%', year: '2024-25', status: 'complete', lastUpdated: '2026-01-15', updatedBy: 'Placement Cell' },
  { id: 'ad-7', criterion: 'Criterion 6 – Governance', metric: 'Grievances Resolved (within SLA)', value: '94%', year: '2025-26', status: 'complete', lastUpdated: '2026-02-25', updatedBy: 'System' },
  { id: 'ad-8', criterion: 'NIRF', metric: 'Faculty with PhD (%)', value: '85.7%', year: '2025-26', status: 'complete', lastUpdated: '2026-03-01', updatedBy: 'System' },
];
