// Student Portal Type Definitions

export interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  faculty: string;
  facultyEmail: string;
  schedule: CourseSchedule[];
  attendance: number;
  internalMarks: number;
  maxInternalMarks: number;
  syllabus?: string;
  semester: number;
  department: string;
}

export interface CourseSchedule {
  day: string;
  startTime: string;
  endTime: string;
  room: string;
  type: 'lecture' | 'lab' | 'tutorial';
}

export interface Assignment {
  id: string;
  courseId: string;
  semester?: number;
  courseName: string;
  courseCode: string;
  title: string;
  description: string;
  dueDate: Date;
  submittedAt?: Date;
  status: 'pending' | 'submitted' | 'graded' | 'late' | 'overdue';
  maxMarks: number;
  obtainedMarks?: number;
  feedback?: string;
  attachments?: string[];
  submissionUrl?: string;
}

export interface Examination {
  id: string;
  courseId: string;
  courseName: string;
  courseCode: string;
  type: 'midterm' | 'endterm' | 'internal' | 'practical' | 'viva';
  date: Date;
  startTime: string;
  endTime: string;
  venue: string;
  seatNumber?: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'result_declared';
  maxMarks: number;
  obtainedMarks?: number;
  grade?: string;
}

export interface AttendanceRecord {
  date: Date;
  courseId: string;
  courseName: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  markedBy: string;
}

export interface SemesterResult {
  semester: number;
  year: string;
  sgpa: number;
  cgpa: number;
  totalCredits: number;
  earnedCredits: number;
  courses: CourseResult[];
  status: 'declared' | 'withheld' | 'pending';
}

export interface CourseResult {
  courseId: string;
  courseCode: string;
  courseName: string;
  credits: number;
  grade: string;
  gradePoints: number;
  internalMarks: number;
  externalMarks: number;
  totalMarks: number;
  result: 'pass' | 'fail' | 'absent';
}

export interface FeeRecord {
  id: string;
  type: 'tuition' | 'hostel' | 'exam' | 'library' | 'lab' | 'transport' | 'other';
  description: string;
  amount: number;
  dueDate: Date;
  paidDate?: Date;
  status: 'paid' | 'pending' | 'overdue' | 'partial';
  transactionId?: string;
  semester?: number;
  academicYear: string;
}

export interface LibraryBook {
  id: string;
  isbn: string;
  title: string;
  author: string;
  category: string;
  issuedDate: Date;
  dueDate: Date;
  returnedDate?: Date;
  fine?: number;
  renewalCount: number;
  maxRenewals: number;
  status: 'issued' | 'returned' | 'overdue' | 'reserved';
}

export interface HostelInfo {
  hostelName: string;
  roomNumber: string;
  roomType: 'single' | 'double' | 'triple';
  floorNumber: number;
  blockName: string;
  wardenName: string;
  wardenContact: string;
  roommates?: string[];
  checkInDate: Date;
  messMenu?: MealSchedule[];
}

export interface MealSchedule {
  day: string;
  breakfast: string;
  lunch: string;
  snacks: string;
  dinner: string;
}

export interface GatePass {
  id: string;
  type: 'day' | 'night' | 'weekend' | 'vacation';
  fromDate: Date;
  toDate: Date;
  reason: string;
  destination: string;
  guardianContact: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  approvedBy?: string;
  remarks?: string;
}

export interface PlacementDrive {
  id: string;
  companyName: string;
  companyLogo?: string;
  role: string;
  package: string;
  eligibility: PlacementEligibility;
  driveDate: Date;
  registrationDeadline: Date;
  rounds: PlacementRound[];
  status: 'upcoming' | 'ongoing' | 'completed';
  applicationStatus?: 'not_applied' | 'applied' | 'shortlisted' | 'selected' | 'rejected';
  location: string;
  jobDescription: string;
}

export interface PlacementEligibility {
  minCgpa: number;
  allowedBranches: string[];
  backlogs: number;
  batch: string;
}

export interface PlacementRound {
  name: string;
  date?: Date;
  status: 'pending' | 'qualified' | 'not_qualified' | 'absent';
  venue?: string;
}

export interface Grievance {
  id: string;
  category: 'academic' | 'hostel' | 'fees' | 'faculty' | 'infrastructure' | 'ragging' | 'other';
  subject: string;
  description: string;
  submittedAt: Date;
  status: 'submitted' | 'under_review' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  resolution?: string;
  resolvedAt?: Date;
  attachments?: string[];
}

export interface FeedbackForm {
  id: string;
  courseId: string;
  courseName: string;
  facultyName: string;
  semester: number;
  status: 'pending' | 'completed';
  deadline: Date;
  questions: FeedbackQuestion[];
}

export interface FeedbackQuestion {
  id: string;
  question: string;
  type: 'rating' | 'text' | 'multiple_choice';
  options?: string[];
  required: boolean;
}

export interface Certificate {
  id: string;
  type: 'bonafide' | 'character' | 'migration' | 'degree' | 'provisional' | 'transcript' | 'noc';
  requestedAt: Date;
  status: 'pending' | 'processing' | 'ready' | 'collected' | 'rejected';
  purpose: string;
  copies: number;
  fee: number;
  downloadUrl?: string;
  collectionDate?: Date;
  remarks?: string;
}

export interface StudentProfile {
  // Personal Information
  id: string;
  rollNumber: string;
  name: string;
  email: string;
  personalEmail?: string;
  phone: string;
  alternatePhone?: string;
  dateOfBirth: Date;
  gender: 'male' | 'female' | 'other';
  bloodGroup: string;
  nationality: string;
  religion?: string;
  category: 'general' | 'obc' | 'sc' | 'st' | 'ews';
  aadharNumber?: string;
  
  // Address
  permanentAddress: Address;
  currentAddress: Address;
  
  // Academic Information
  program: string;
  branch: string;
  specialization?: string;
  semester: number;
  section: string;
  batch: string;
  admissionYear: number;
  admissionType: 'regular' | 'lateral' | 'management';
  cgpa: number;
  totalCredits: number;
  earnedCredits: number;
  
  // Guardian Information
  fatherName: string;
  fatherOccupation: string;
  fatherPhone: string;
  fatherEmail?: string;
  motherName: string;
  motherOccupation: string;
  motherPhone?: string;
  guardianName?: string;
  guardianRelation?: string;
  guardianPhone?: string;
  
  // Other Details
  hostelResident: boolean;
  transportUser: boolean;
  scholarshipHolder: boolean;
  scholarshipName?: string;
  mentorName?: string;
  mentorEmail?: string;
  avatar?: string;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface ScheduleEvent {
  id: string;
  title: string;
  type: 'class' | 'lab' | 'exam' | 'event' | 'meeting' | 'deadline';
  courseCode?: string;
  startTime: string;
  endTime: string;
  venue: string;
  faculty?: string;
  color?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error' | 'reminder';
  category: 'academic' | 'exam' | 'fee' | 'placement' | 'general' | 'hostel';
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}
