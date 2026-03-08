// HOD Portal Type Definitions

export interface DepartmentFaculty {
  id: string;
  name: string;
  employeeId: string;
  designation: 'Professor' | 'Associate Professor' | 'Assistant Professor' | 'Adjunct' | 'Visiting';
  qualification: string;
  specialization: string;
  email: string;
  phone: string;
  dateOfJoining: string;
  type: 'permanent' | 'adjunct' | 'visiting' | 'contract';
  coursesAssigned: number;
  weeklyHours: number;
  publications: number;
  isOnLeave: boolean;
  leaveType?: string;
  roles: string[]; // e.g., "Class Coordinator", "Lab In-charge"
}

export interface DepartmentStudent {
  id: string;
  rollNumber: string;
  name: string;
  program: string;
  year: number;
  semester: number;
  section: string;
  cgpa: number;
  attendance: number;
  advisor: string;
  status: 'active' | 'detained' | 'graduated' | 'suspended';
  email: string;
}

export interface HODApprovalItem {
  id: string;
  type: 'leave' | 'od' | 'purchase' | 'section_change' | 'grievance' | 'grade_change' | 'elective';
  title: string;
  requestedBy: string;
  requestedAt: string;
  details: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'approved' | 'rejected' | 'forwarded';
}

export interface DepartmentCalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  type: 'deadline' | 'meeting' | 'seminar' | 'exam' | 'appraisal';
  description?: string;
}

export interface CourseAssignment {
  id: string;
  courseCode: string;
  courseName: string;
  credits: number;
  semester: number;
  section: string;
  assignedFaculty: string;
  facultyId: string;
  schedule: string;
  students: number;
  type: 'theory' | 'lab' | 'tutorial';
}

export interface TimetableSlot {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  courseCode: string;
  courseName: string;
  faculty: string;
  room: string;
  section: string;
  type: 'lecture' | 'lab' | 'tutorial';
}

export interface CourseResult {
  courseCode: string;
  courseName: string;
  faculty: string;
  totalStudents: number;
  passed: number;
  failed: number;
  passPercentage: number;
  avgScore: number;
  highestScore: number;
  gradeDistribution: { grade: string; count: number }[];
}

export interface LabInventoryItem {
  id: string;
  name: string;
  lab: string;
  category: string;
  quantity: number;
  workingCondition: number;
  lastMaintenance: string;
  purchaseDate: string;
  warrantyExpiry?: string;
  status: 'working' | 'maintenance' | 'faulty' | 'disposed';
}

export interface PurchaseRequest {
  id: string;
  itemName: string;
  lab: string;
  requestedBy: string;
  quantity: number;
  estimatedCost: number;
  justification: string;
  status: 'pending' | 'approved' | 'rejected' | 'ordered' | 'received';
  requestDate: string;
}

export interface AccreditationDataItem {
  id: string;
  criterion: string;
  metric: string;
  value: string;
  year: string;
  status: 'complete' | 'pending' | 'needs_review';
  lastUpdated: string;
  updatedBy: string;
}
