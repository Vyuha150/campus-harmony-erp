export interface CampusSummary {
  id: string;
  name: string;
  location: string;
  students: number;
  faculty: number;
  programs: number;
  placementRate: number;
  passRate: number;
}

export interface InstitutionKPI {
  id: string;
  label: string;
  value: string | number;
  target: string | number;
  trend: 'up' | 'down' | 'stable';
  trendValue: string;
  status: 'good' | 'average' | 'poor';
  category: 'academic' | 'research' | 'finance' | 'placement' | 'quality';
}

export interface LiveUpdate {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'critical';
  timestamp: Date;
  module: string;
}

export interface ExecutiveApproval {
  id: string;
  type: 'faculty_hire' | 'capital_expenditure' | 'new_program' | 'mou' | 'research_center' | 'policy_change' | 'budget_allocation';
  title: string;
  description: string;
  requestedBy: string;
  requestedAt: Date;
  amount?: number;
  status: 'pending' | 'approved' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'critical';
  documents?: string[];
  forwardedFrom?: string;
}

export interface MeetingAgenda {
  id: string;
  meetingType: 'board_of_management' | 'academic_council' | 'finance_committee' | 'executive_council' | 'senate';
  title: string;
  date: Date;
  time: string;
  venue: string;
  status: 'upcoming' | 'in_progress' | 'completed';
  agendaItems: AgendaItem[];
  attendees: string[];
  documents: string[];
}

export interface AgendaItem {
  id: string;
  title: string;
  presenter: string;
  duration: string;
  status: 'pending' | 'discussed' | 'deferred';
  actionItems?: ActionItem[];
}

export interface ActionItem {
  id: string;
  task: string;
  assignedTo: string;
  deadline: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
}

export interface PolicyScenario {
  id: string;
  title: string;
  description: string;
  category: 'enrollment' | 'finance' | 'academic' | 'hr';
  parameters: ScenarioParam[];
  projectedOutcome: string;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface ScenarioParam {
  label: string;
  currentValue: number;
  proposedValue: number;
  unit: string;
}

export interface ComplianceReport {
  id: string;
  framework: 'NAAC' | 'NIRF' | 'UGC' | 'AQAR' | 'SSR';
  title: string;
  status: 'draft' | 'in_review' | 'submitted' | 'approved';
  score?: number;
  maxScore: number;
  lastUpdated: Date;
  criteria: CriterionScore[];
}

export interface CriterionScore {
  id: string;
  name: string;
  score: number;
  maxScore: number;
  status: 'on_track' | 'at_risk' | 'behind';
}

export interface BroadcastMessage {
  id: string;
  subject: string;
  content: string;
  sender: string;
  sentAt: Date;
  recipients: string;
  type: 'announcement' | 'congratulation' | 'directive' | 'notice';
  pinned: boolean;
}

export interface FinancialOverview {
  category: string;
  budget: number;
  actual: number;
  variance: number;
}

export interface DepartmentPerformance {
  department: string;
  passRate: number;
  placementRate: number;
  researchOutput: number;
  studentSatisfaction: number;
  facultyCount: number;
  studentCount: number;
}
