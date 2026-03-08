// Dean / Principal Portal Type Definitions

export interface DepartmentSummary {
  id: string;
  name: string;
  hod: string;
  totalFaculty: number;
  permanentFaculty: number;
  vacancies: number;
  totalStudents: number;
  avgPassPercentage: number;
  avgAttendance: number;
  researchOutput: number;
  placementRate: number;
}

export interface DeanApproval {
  id: string;
  type: 'purchase' | 'leave' | 'curriculum' | 'transfer' | 'results' | 'budget' | 'recruitment';
  title: string;
  department: string;
  requestedBy: string;
  requestedAt: string;
  amount?: number;
  details: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'approved' | 'rejected' | 'forwarded';
}

export interface CurriculumProposal {
  id: string;
  department: string;
  proposedBy: string;
  type: 'new_course' | 'syllabus_update' | 'program_change' | 'elective_addition';
  title: string;
  description: string;
  submittedAt: string;
  bosApproved: boolean;
  status: 'pending_dean' | 'approved' | 'sent_to_ac' | 'rejected';
}

export interface FacultyRecruitment {
  id: string;
  department: string;
  position: string;
  specialization: string;
  vacancySince: string;
  applicants: number;
  shortlisted: number;
  status: 'requested' | 'approved' | 'in_progress' | 'completed';
}

export interface DisciplinaryCase {
  id: string;
  studentName: string;
  rollNumber: string;
  department: string;
  type: 'malpractice' | 'misconduct' | 'ragging' | 'attendance_shortage';
  description: string;
  reportedBy: string;
  reportedAt: string;
  status: 'escalated' | 'under_review' | 'action_taken' | 'closed';
  severity: 'minor' | 'major' | 'critical';
}

export interface DepartmentBudget {
  department: string;
  allocated: number;
  spent: number;
  remaining: number;
  categories: { name: string; allocated: number; spent: number }[];
}

export interface ResultSummary {
  department: string;
  program: string;
  semester: number;
  totalStudents: number;
  passed: number;
  failed: number;
  passPercentage: number;
  avgGPA: number;
  toppers: { name: string; gpa: number }[];
  status: 'pending_approval' | 'approved' | 'published';
}

export interface QualityMetric {
  id: string;
  metric: string;
  category: 'naac' | 'nirf' | 'internal';
  currentValue: string;
  previousValue: string;
  target: string;
  trend: 'up' | 'down' | 'stable';
  status: 'on_track' | 'at_risk' | 'behind';
}

export interface InterDeptEvent {
  id: string;
  title: string;
  type: 'cultural' | 'technical' | 'sports' | 'seminar' | 'workshop';
  date: string;
  departments: string[];
  coordinator: string;
  budget: number;
  participants: number;
  status: 'planned' | 'ongoing' | 'completed';
}
