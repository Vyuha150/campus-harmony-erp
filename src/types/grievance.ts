/**
 * Grievance & Compliance Types
 * Aligned with backend/prisma/schema.prisma models
 */

// ─── Grievance Case ───
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
  submissionDate: string | Date;
  lastUpdated: string | Date;
  assignedTo?: string;
  department?: string;
  expectedResolutionDate?: string | Date;
  actualResolutionDate?: string | Date;
  isAnonymous: boolean;
  evidenceFiles?: string[];
  timeline: GrievanceActivity[];
  resolution?: string;
  satisfactionRating?: number;
  complainantFeedback?: string;
}

export interface GrievanceActivity {
  date: string | Date;
  action: string;
  by: string;
  notes?: string;
  status?: string;
  documents?: string[];
}

// ─── Grievance Form Data ───
export interface CreateGrievanceInput {
  complainantName: string;
  complainantType: 'student' | 'faculty' | 'staff' | 'parent' | 'anonymous';
  category: string;
  subcategory?: string;
  subject: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'urgent';
  isAnonymous: boolean;
  evidenceFiles?: File[];
  complainantId?: string;
}

export interface UpdateGrievanceInput {
  status?: string;
  assignedTo?: string;
  department?: string;
  resolution?: string;
  satisfactionRating?: number;
  expectedResolutionDate?: Date;
}

// ─── Compliance ───
export interface ComplianceItem {
  id: string;
  title: string;
  type: 'anti_ragging' | 'sexual_harassment' | 'code_of_conduct' | 'safety_training' | 'other';
  description: string;
  applicableTo: 'students' | 'faculty' | 'staff' | 'all';
  dueDate?: string | Date;
  renewalPeriod?: string;
  completionTracking: ComplianceTracking[];
  documents: string[];
  status: 'active' | 'inactive';
}

export interface ComplianceTracking {
  userId: string;
  userName: string;
  userType: 'student' | 'faculty' | 'staff';
  completionDate?: string | Date;
  certificateIssued: boolean;
  validUntil?: string | Date;
  status: 'pending' | 'completed' | 'expired' | 'renewed';
  attempts?: number;
  score?: number;
}

// ─── Anti-Ragging Affidavit ───
export interface AntiRaggingAffidavit {
  id: string;
  studentId: string;
  studentName: string;
  program: string;
  submissionDate: string | Date;
  parentAffidavit: boolean;
  studentAffidavit: boolean;
  status: 'pending' | 'submitted' | 'verified';
  academicYear: string;
}

// ─── Dashboard Summary ───
export interface GrievanceDashboardData {
  stats: {
    label: string;
    value: string;
    icon: string;
    color: string;
  }[];
  totalCases: number;
  pendingCases: number;
  resolvedCases: number;
  resolutionRate: number;
  byCategory: { category: string; count: number }[];
}

export interface ComplianceResponse {
  complianceItems: ComplianceItem[];
  antiRaggingAffidavits: AntiRaggingAffidavit[];
}

export interface ReportResponse {
  totalCases: number;
  resolvedCases: number;
  pendingCases: number;
  resolutionRate: number;
  byCategory: { category: string; count: number }[];
}

// ─── API Response Wrapper ───
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export type GrievanceTab = 'cases' | 'compliance' | 'reports';
