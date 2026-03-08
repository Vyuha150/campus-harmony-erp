// Faculty Portal Type Definitions

export interface FacultyCourse {
  id: string;
  code: string;
  name: string;
  credits: number;
  semester: number;
  section: string;
  department: string;
  program: string;
  totalStudents: number;
  schedule: FacultyScheduleSlot[];
  averageAttendance: number;
  syllabusCompletion: number;
  averageScore: number;
}

export interface FacultyScheduleSlot {
  day: string;
  startTime: string;
  endTime: string;
  room: string;
  type: 'lecture' | 'lab' | 'tutorial';
}

export interface AttendanceSession {
  id: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  type: 'lecture' | 'lab' | 'tutorial';
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  status: 'pending' | 'completed' | 'cancelled';
}

export interface StudentAttendanceEntry {
  studentId: string;
  rollNumber: string;
  name: string;
  status: 'present' | 'absent' | 'late' | 'excused';
}

export interface LessonPlanEntry {
  id: string;
  weekNumber: number;
  topic: string;
  subtopics: string[];
  plannedDate: string;
  actualDate?: string;
  status: 'pending' | 'completed' | 'skipped';
  resources?: string[];
  courseOutcome?: string;
}

export interface FacultyAssignment {
  id: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  title: string;
  description: string;
  dueDate: string;
  totalSubmissions: number;
  pendingEvaluation: number;
  maxMarks: number;
  type: 'assignment' | 'quiz' | 'project' | 'lab_report';
  status: 'draft' | 'published' | 'closed' | 'graded';
}

export interface StudentSubmission {
  id: string;
  studentId: string;
  rollNumber: string;
  studentName: string;
  submittedAt: string;
  status: 'submitted' | 'evaluated' | 'late';
  marks?: number;
  feedback?: string;
  fileUrl?: string;
}

export interface InternalMarksEntry {
  studentId: string;
  rollNumber: string;
  studentName: string;
  quiz1?: number;
  quiz2?: number;
  midterm?: number;
  assignment?: number;
  attendance?: number;
  total: number;
  maxTotal: number;
}

export interface MenteeStudent {
  id: string;
  rollNumber: string;
  name: string;
  program: string;
  semester: number;
  section: string;
  cgpa: number;
  attendance: number;
  email: string;
  phone: string;
  riskLevel: 'low' | 'medium' | 'high';
  lastMeetingDate?: string;
  counselingNotes: CounselingNote[];
}

export interface CounselingNote {
  id: string;
  date: string;
  topic: string;
  notes: string;
  followUpDate?: string;
  status: 'open' | 'resolved';
}

export interface Publication {
  id: string;
  title: string;
  authors: string[];
  journal: string;
  year: number;
  doi?: string;
  indexing: 'SCI' | 'Scopus' | 'UGC' | 'Other';
  citations: number;
  type: 'journal' | 'conference' | 'book_chapter' | 'book';
  status: 'published' | 'accepted' | 'under_review' | 'submitted';
}

export interface ResearchProject {
  id: string;
  title: string;
  fundingAgency: string;
  amount: number;
  startDate: string;
  endDate: string;
  status: 'ongoing' | 'completed' | 'submitted';
  coInvestigators: string[];
  amountSpent: number;
}

export interface Patent {
  id: string;
  title: string;
  applicationNumber: string;
  filingDate: string;
  status: 'filed' | 'published' | 'granted' | 'rejected';
  inventors: string[];
}

export interface Committee {
  id: string;
  name: string;
  role: string;
  tenure: string;
  meetingsAttended: number;
  totalMeetings: number;
  nextMeeting?: string;
  documents: string[];
}

export interface FacultyLeave {
  id: string;
  type: 'casual' | 'earned' | 'medical' | 'duty' | 'academic' | 'maternity';
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
}

export interface LeaveBalance {
  type: string;
  total: number;
  used: number;
  remaining: number;
}

export interface FacultyProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  employeeId: string;
  dateOfJoining: string;
  qualification: string;
  specialization: string;
  experience: number;
  avatar?: string;
  // Academic
  totalPublications: number;
  totalProjects: number;
  hIndex: number;
  // Teaching
  coursesThisSemester: number;
  weeklyHours: number;
  totalStudents: number;
}

export interface FeedbackSummary {
  courseId: string;
  courseCode: string;
  courseName: string;
  semester: string;
  overallRating: number;
  maxRating: number;
  categories: FeedbackCategory[];
  totalResponses: number;
  suggestions: string[];
}

export interface FeedbackCategory {
  name: string;
  score: number;
  maxScore: number;
}

export interface FacultyGrievance {
  id: string;
  type: 'student_complaint' | 'assigned_review' | 'self_filed';
  subject: string;
  description: string;
  filedBy: string;
  filedAt: string;
  status: 'new' | 'under_review' | 'responded' | 'closed';
  response?: string;
}

export interface ClassMessage {
  id: string;
  courseId: string;
  courseCode: string;
  subject: string;
  message: string;
  sentAt: string;
  recipients: number;
  readCount: number;
}
