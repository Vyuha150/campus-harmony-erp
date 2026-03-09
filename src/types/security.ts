// Security, Vigilance & Support Portal Type Definitions

export interface SecurityDashboard {
  activeIncidents: number;
  resolvedIncidents: number;
  activeVisitorPasses: number;
  securityAlerts: SecurityAlert[];
  recentIncidents: SecurityIncident[];
  patrolStatus: PatrolStatus[];
  accessViolations: number;
  emergencyContacts: EmergencyContact[];
}

export interface SecurityAlert {
  id: string;
  type: 'intrusion' | 'fire' | 'medical' | 'suspicious_activity' | 'system_failure';
  location: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  description: string;
  status: 'active' | 'investigating' | 'resolved' | 'false_alarm';
  assignedOfficer?: string;
  responseTime?: number;
}

export interface SecurityIncident {
  id: string;
  incidentNumber: string;
  type: 'theft' | 'vandalism' | 'accident' | 'fight' | 'harassment' | 'trespassing' | 'medical' | 'fire' | 'other';
  location: string;
  reportedDate: Date;
  reportedBy: string;
  description: string;
  peopleInvolved: PersonInvolved[];
  witnesses: Witness[];
  actionTaken: string;
  status: 'reported' | 'investigating' | 'resolved' | 'closed';
  severity: 'minor' | 'moderate' | 'serious' | 'critical';
  investigatingOfficer?: string;
  evidenceFiles: string[];
  followUpRequired: boolean;
  followUpDate?: Date;
}

export interface PersonInvolved {
  name: string;
  type: 'student' | 'faculty' | 'staff' | 'visitor' | 'outsider';
  idNumber?: string;
  contactNumber?: string;
  role: 'complainant' | 'respondent' | 'victim' | 'witness';
  statement?: string;
}

export interface Witness {
  name: string;
  contactNumber: string;
  statement: string;
  verified: boolean;
}

export interface IDCardRequest {
  id: string;
  requestNumber: string;
  applicantId: string;
  applicantName: string;
  applicantType: 'student' | 'faculty' | 'staff';
  requestType: 'new' | 'replacement' | 'renewal';
  reason?: string;
  requestDate: Date;
  approvedBy?: string;
  approvalDate?: Date;
  cardIssuedDate?: Date;
  status: 'pending' | 'approved' | 'issued' | 'rejected';
  feesPaid: boolean;
  documents: string[];
  emergencyContact?: EmergencyContact;
}

export interface VehiclePass {
  id: string;
  passNumber: string;
  ownerName: string;
  ownerType: 'student' | 'faculty' | 'staff';
  ownerIdNumber: string;
  vehicleType: 'two_wheeler' | 'four_wheeler' | 'bicycle';
  vehicleNumber: string;
  vehicleModel?: string;
  validFrom: Date;
  validUntil: Date;
  parkingZone: string;
  status: 'active' | 'expired' | 'suspended' | 'cancelled';
  feesPaid: boolean;
  documents: string[];
}

export interface VisitorPass {
  id: string;
  passNumber: string;
  visitorName: string;
  contactNumber: string;
  organization?: string;
  purposeOfVisit: string;
  personToMeet: string;
  departmentToVisit: string;
  expectedDate: Date;
  expectedTime: string;
  duration: string;
  vehicleNumber?: string;
  accompaniedBy?: string;
  requestedBy: string;
  approvedBy?: string;
  status: 'requested' | 'approved' | 'issued' | 'expired' | 'cancelled';
  actualEntryTime?: Date;
  actualExitTime?: Date;
  escortRequired: boolean;
  restrictedAreas?: string[];
}

export interface HostelAccess {
  studentId: string;
  studentName: string;
  hostelBlock: string;
  roomNumber: string;
  outTime?: Date;
  inTime?: Date;
  purpose?: string;
  expectedReturn?: Date;
  latePassApproved: boolean;
  approvedBy?: string;
  status: 'inside' | 'outside' | 'late_return' | 'missing';
}

export interface PatrolStatus {
  officerId: string;
  officerName: string;
  shift: 'morning' | 'afternoon' | 'evening' | 'night';
  patrolRoute: string;
  startTime: Date;
  endTime?: Date;
  checkpoints: CheckpointStatus[];
  status: 'on_duty' | 'break' | 'off_duty' | 'emergency';
  location?: string;
  lastUpdate: Date;
}

export interface CheckpointStatus {
  checkpointId: string;
  checkpointName: string;
  expectedTime: Date;
  actualTime?: Date;
  status: 'pending' | 'completed' | 'missed';
  notes?: string;
}

export interface EmergencyContact {
  name: string;
  designation: string;
  department?: string;
  primaryPhone: string;
  alternatePhone?: string;
  email?: string;
  available247: boolean;
  category: 'security' | 'medical' | 'fire' | 'maintenance' | 'administration';
}

// Vigilance & Audit Types

export interface VigilanceCase {
  id: string;
  caseNumber: string;
  type: 'financial_irregularity' | 'misconduct' | 'corruption' | 'policy_violation' | 'fraud';
  subject: string;
  description: string;
  complainantType: 'anonymous' | 'whistleblower' | 'internal_audit' | 'external_complaint';
  dateReported: Date;
  status: 'under_investigation' | 'evidence_gathering' | 'closed' | 'referred_to_authorities';
  investigatingOfficer: string;
  documentsCollected: string[];
  peopleInterviewed: InterviewRecord[];
  findings?: string;
  actionTaken?: string;
  closeDate?: Date;
  confidentialityLevel: 'low' | 'medium' | 'high' | 'classified';
}

export interface InterviewRecord {
  personName: string;
  designation: string;
  interviewDate: Date;
  interviewSummary: string;
  keyPoints: string[];
  followUpRequired: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  userRole: string;
  action: string;
  module: string;
  recordId?: string;
  oldValue?: any;
  newValue?: any;
  ipAddress: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

export interface ComplianceCheck {
  id: string;
  checkType: 'financial' | 'academic' | 'administrative' | 'policy' | 'legal';
  title: string;
  description: string;
  criteria: ComplianceCriteria[];
  schedule: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  lastCheck: Date;
  nextCheck: Date;
  status: 'passed' | 'failed' | 'warning' | 'pending';
  findings: ComplianceFinding[];
  assignedOfficer: string;
}

export interface ComplianceCriteria {
  id: string;
  description: string;
  requirement: string;
  checkMethod: string;
  expectedValue?: string;
  tolerance?: string;
}

export interface ComplianceFinding {
  criteriaId: string;
  status: 'compliant' | 'non_compliant' | 'partial';
  actualValue?: string;
  deviation?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendation?: string;
  actionRequired?: string;
  timeline?: string;
}

// IT Support & System Admin Types

export interface SystemHealth {
  serverStatus: ServerStatus[];
  databaseStatus: DatabaseStatus;
  applicationServices: ServiceStatus[];
  userSessions: number;
  systemLoad: number;
  memoryUsage: number;
  diskUsage: DiskUsage[];
  lastBackup: Date;
  scheduledMaintenance?: MaintenanceWindow[];
}

export interface ServerStatus {
  serverName: string;
  type: 'web' | 'database' | 'application' | 'file' | 'backup';
  status: 'online' | 'offline' | 'maintenance' | 'error';
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  uptime: number;
  lastCheck: Date;
  issues?: string[];
}

export interface DatabaseStatus {
  name: string;
  status: 'online' | 'offline' | 'slow' | 'error';
  connections: number;
  maxConnections: number;
  queryPerformance: number;
  lastBackup: Date;
  backupStatus: 'success' | 'failed' | 'in_progress';
  size: number;
}

export interface ServiceStatus {
  serviceName: string;
  status: 'running' | 'stopped' | 'error' | 'restarting';
  port?: number;
  responseTime?: number;
  lastCheck: Date;
  errorMessage?: string;
}

export interface DiskUsage {
  drive: string;
  totalSpace: number;
  usedSpace: number;
  availableSpace: number;
  usagePercentage: number;
  status: 'normal' | 'warning' | 'critical';
}

export interface MaintenanceWindow {
  id: string;
  title: string;
  description: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  impactedServices: string[];
  maintenanceType: 'routine' | 'security' | 'upgrade' | 'emergency';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  notificationsSent: boolean;
}

export interface UserAccount {
  id: string;
  username: string;
  email: string;
  fullName: string;
  userType: 'student' | 'faculty' | 'staff' | 'admin';
  roles: string[];
  department?: string;
  status: 'active' | 'inactive' | 'suspended' | 'locked';
  lastLogin: Date;
  passwordLastChanged: Date;
  failedLoginAttempts: number;
  createdDate: Date;
  expiryDate?: Date;
  permissions: Permission[];
}

export interface Permission {
  module: string;
  actions: string[];
  restrictions?: string[];
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  reportedBy: string;
  reporterType: 'student' | 'faculty' | 'staff';
  contactInfo: string;
  category: 'hardware' | 'software' | 'network' | 'account' | 'email' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  subject: string;
  description: string;
  attachments: string[];
  assignedTo?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'escalated';
  createdDate: Date;
  lastUpdate: Date;
  resolutionDate?: Date;
  resolutionNotes?: string;
  satisfactionRating?: number;
}

export interface SystemConfiguration {
  module: string;
  configKey: string;
  configValue: any;
  dataType: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  category: 'general' | 'security' | 'performance' | 'features' | 'integrations';
  lastModified: Date;
  modifiedBy: string;
  defaultValue?: any;
  validationRules?: string[];
}