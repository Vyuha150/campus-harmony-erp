export interface AdminFile {
  id: string;
  type: 'affiliation' | 'record_change' | 'transfer' | 'certificate' | 'policy' | 'recruitment' | 'budget' | 'general';
  title: string;
  description: string;
  submittedBy: string;
  submittedAt: Date;
  status: 'pending' | 'approved' | 'rejected' | 'forwarded' | 'in_progress';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  forwardedTo?: string;
  documents?: string[];
  remarks?: string;
}

export interface StudentRecord {
  id: string;
  name: string;
  rollNo: string;
  program: string;
  department: string;
  batch: string;
  admissionDate: Date;
  status: 'active' | 'graduated' | 'transferred' | 'discontinued' | 'suspended';
  cgpa: number;
  email: string;
  phone: string;
  address: string;
  fatherName: string;
  dob: Date;
  category: string;
  bloodGroup: string;
}

export interface RecordChangeRequest {
  id: string;
  studentId: string;
  studentName: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
  requestedBy: string;
  requestedAt: Date;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  documents: string[];
}

export interface TransferRequest {
  id: string;
  studentId: string;
  studentName: string;
  type: 'incoming' | 'outgoing';
  fromInstitution: string;
  toInstitution: string;
  program: string;
  reason: string;
  status: 'pending' | 'noc_issued' | 'migration_issued' | 'completed' | 'rejected';
  requestedAt: Date;
  documents: string[];
}

export interface DegreeRecord {
  id: string;
  studentName: string;
  rollNo: string;
  program: string;
  department: string;
  graduationYear: number;
  certificateNo: string;
  status: 'eligible' | 'generated' | 'printed' | 'dispatched' | 'collected';
  convocationDate?: Date;
  collectedAt?: Date;
  verificationCount: number;
}

export interface ExamProgress {
  id: string;
  examName: string;
  semester: string;
  program: string;
  totalStudents: number;
  marksEntered: number;
  resultsPublished: boolean;
  status: 'scheduling' | 'ongoing' | 'mark_entry' | 'moderation' | 'published';
  startDate: Date;
  endDate: Date;
  coordinator: string;
}

export interface AdminDocument {
  id: string;
  title: string;
  category: 'government_order' | 'ugc_communication' | 'circular' | 'minutes' | 'policy' | 'notification' | 'audit_report';
  uploadedBy: string;
  uploadedAt: Date;
  fileSize: string;
  tags: string[];
  isConfidential: boolean;
  accessRoles: string[];
}

export interface Vacancy {
  id: string;
  position: string;
  department: string;
  type: 'teaching' | 'non_teaching';
  sanctioned: number;
  filled: number;
  status: 'advertised' | 'applications_received' | 'shortlisted' | 'interview_scheduled' | 'selected' | 'joined' | 'closed';
  postedAt: Date;
  lastDate?: Date;
  applicants: number;
}

export interface AccreditationChecklist {
  id: string;
  framework: 'NAAC' | 'NIRF' | 'UGC' | 'NBA';
  criterion: string;
  description: string;
  responsibleOffice: string;
  status: 'not_started' | 'in_progress' | 'submitted' | 'verified';
  documents: string[];
  deadline: Date;
  remarks?: string;
}

export interface VerificationRequest {
  id: string;
  type: 'employer' | 'rti' | 'court' | 'internal' | 'transcript';
  requesterName: string;
  requesterOrg: string;
  studentName: string;
  studentId: string;
  details: string;
  status: 'pending' | 'processing' | 'responded' | 'closed';
  receivedAt: Date;
  respondedAt?: Date;
  response?: string;
}

export interface EstablishmentSummary {
  totalSanctioned: number;
  totalFilled: number;
  teaching: { sanctioned: number; filled: number };
  nonTeaching: { sanctioned: number; filled: number };
  pendingPromotions: number;
  pendingRetirements: number;
  activeRecruitments: number;
}
