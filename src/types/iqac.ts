// IQAC & Grievance Officer Portal Type Definitions

export interface QualityDashboard {
  overallScore: number;
  naacGrade?: string;
  lastAccreditationDate?: Date;
  nextAccreditationDate?: Date;
  criteriaProgress: CriteriaProgress[];
  recentFeedback: FeedbackSummary[];
  facultyDevelopmentCount: number;
  studentSatisfactionScore: number;
  actionItemsCount: number;
  documentsUploaded: number;
  totalDocumentsRequired: number;
}

export interface CriteriaProgress {
  criteriaNumber: number;
  title: string;
  dataProgress: number;
  documentsUploaded: number;
  requiredDocuments: number;
  status: 'completed' | 'in_progress' | 'not_started' | 'needs_attention';
  lastUpdated: Date;
  issues: string[];
}

export interface IQACActionItem {
  id: string;
  title: string;
  description: string;
  category: 'curriculum' | 'infrastructure' | 'faculty' | 'student_support' | 'governance' | 'research';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo: string;
  department?: string;
  dueDate: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  implementationStatus?: string;
  evidence?: string[];
  createdDate: Date;
  completedDate?: Date;
  impact?: string;
}

export interface QualityDocument {
  id: string;
  title: string;
  criteriaNumber: number;
  documentType: 'policy' | 'procedure' | 'certificate' | 'report' | 'data' | 'evidence';
  uploadedBy: string;
  uploadDate: Date;
  filePath: string;
  version: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'needs_revision';
  reviewComments?: string;
  reviewedBy?: string;
  reviewDate?: Date;
  tags: string[];
}

export interface FeedbackSummary {
  type: 'student' | 'alumni' | 'employer' | 'faculty' | 'parent';
  respondents: number;
  averageRating: number;
  satisfactionLevel: 'excellent' | 'very_good' | 'good' | 'satisfactory' | 'needs_improvement';
  keyFindings: string[];
  improvementAreas: string[];
  lastCollected: Date;
}

export interface IQACMeeting {
  id: string;
  title: string;
  date: Date;
  venue: string;
  agenda: string[];
  attendees: MeetingAttendee[];
  chairperson: string;
  minutes?: string;
  decisions: string[];
  actionItems: string[];
  nextMeetingDate?: Date;
  status: 'scheduled' | 'completed' | 'cancelled';
  documentsShared: string[];
}

export interface MeetingAttendee {
  name: string;
  designation: string;
  department?: string;
  attended: boolean;
  role: 'chairperson' | 'member' | 'secretary' | 'invitee';
}

export interface AQARData {
  academicYear: string;
  institutionDetails: InstitutionInfo;
  criteria: AQARCriteria[];
  keyIndicators: Record<string, any>;
  bestPractices: BestPractice[];
  distinctiveFeatures: string[];
  status: 'draft' | 'under_review' | 'submitted' | 'approved';
  submissionDate?: Date;
  generatedBy: string;
}

export interface InstitutionInfo {
  name: string;
  address: string;
  website: string;
  accreditationStatus: string;
  accreditationGrade?: string;
  validityPeriod?: string;
}

export interface AQARCriteria {
  criteriaNumber: number;
  title: string;
  keyIndicators: KeyIndicator[];
  quantitativeData: Record<string, number>;
  qualitativeData: string[];
  bestPractices?: string[];
}

export interface KeyIndicator {
  code: string;
  description: string;
  value: number | string;
  benchmark?: number | string;
  achievement?: 'exceeded' | 'met' | 'partially_met' | 'not_met';
}

export interface BestPractice {
  id: string;
  title: string;
  description: string;
  objectives: string[];
  implementation: string;
  outcomes: string[];
  sustainability: string;
  evidence: string[];
}

// Grievance Management Types

export interface GrievanceDashboard {
  totalGrievances: number;
  openGrievances: number;
  closedGrievances: number;
  averageResolutionTime: number;
  categoricalBreakdown: CategoryStats[];
  monthlyTrends: GrievanceTrend[];
  urgentCases: number;
  overdueGrievances: number;
}

export interface CategoryStats {
  category: string;
  count: number;
  averageResolutionDays: number;
  satisfactionRating: number;
}

export interface GrievanceTrend {
  month: string;
  received: number;
  resolved: number;
  pending: number;
}

export interface GrievanceCase {
  id: string;
  grievanceNumber: string;
  complainantId?: string;
  complainantName: string;
  complainantType: 'student' | 'faculty' | 'staff' | 'parent' | 'anonymous';
  category: 'academic' | 'administrative' | 'harassment' | 'discrimination' | 'facility' | 'financial' | 'other';
  subcategory?: string;
  subject: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'urgent';
  status: 'received' | 'under_review' | 'investigating' | 'pending_action' | 'resolved' | 'closed' | 'escalated';
  submissionDate: Date;
  lastUpdated: Date;
  assignedTo?: string;
  department?: string;
  expectedResolutionDate?: Date;
  actualResolutionDate?: Date;
  resolutionDays?: number;
  isAnonymous: boolean;
  evidenceFiles: string[];
  timeline: GrievanceActivity[];
  resolution?: string;
  satisfactionRating?: number;
  complainantFeedback?: string;
}

export interface GrievanceActivity {
  id: string;
  date: Date;
  activity: string;
  performedBy: string;
  comments?: string;
  status: string;
  documents?: string[];
}

export interface ComplianceItem {
  id: string;
  title: string;
  type: 'anti_ragging' | 'sexual_harassment' | 'code_of_conduct' | 'safety_training' | 'other';
  description: string;
  applicableTo: 'students' | 'faculty' | 'staff' | 'all';
  mandatoryForPrograms?: string[];
  dueDate?: Date;
  renewalPeriod?: string;
  completionTracking: ComplianceTracking[];
  documents: string[];
  status: 'active' | 'inactive';
}

export interface ComplianceTracking {
  userId: string;
  userName: string;
  userType: 'student' | 'faculty' | 'staff';
  completionDate?: Date;
  certificateIssued: boolean;
  validUntil?: Date;
  status: 'pending' | 'completed' | 'expired' | 'renewed';
  attempts?: number;
  score?: number;
}

export interface GrievanceReport {
  id: string;
  reportType: 'monthly' | 'quarterly' | 'annual' | 'custom';
  period: string;
  generatedDate: Date;
  metrics: GrievanceMetrics;
  recommendations: string[];
  trendAnalysis: string;
  departmentalBreakdown: DepartmentalStats[];
}

export interface GrievanceMetrics {
  totalReceived: number;
  totalResolved: number;
  averageResolutionTime: number;
  satisfactionScore: number;
  repeatComplaints: number;
  escalationRate: number;
  compliancePercentage: number;
}

export interface DepartmentalStats {
  department: string;
  received: number;
  resolved: number;
  averageResolutionTime: number;
  satisfactionScore: number;
  majorIssues: string[];
}

export interface AntiRaggingAffidavit {
  id: string;
  studentId: string;
  studentName: string;
  program: string;
  submissionDate: Date;
  parentAffidavit: boolean;
  studentAffidavit: boolean;
  digitalSignature?: string;
  witnessDetails?: string;
  status: 'submitted' | 'verified' | 'pending';
  academicYear: string;
}

export interface CommitteeInfo {
  name: string;
  type: 'grievance' | 'disciplinary' | 'anti_ragging' | 'sexual_harassment' | 'academic';
  chairperson: string;
  members: CommitteeMember[];
  contactEmail: string;
  contactPhone: string;
  meetingSchedule: string;
  jurisdiction: string;
}

export interface CommitteeMember {
  name: string;
  designation: string;
  department?: string;
  role: 'chairperson' | 'member' | 'secretary' | 'external_expert';
  expertise?: string[];
}