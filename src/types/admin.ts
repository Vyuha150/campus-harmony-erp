import { UserRole } from '@/types/erp';

// ─── System Health ───
export interface SystemHealth {
  uptime: string;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  activeUsers: number;
  totalUsers: number;
  databaseSize: string;
  lastBackup: Date;
  apiResponseTime: number;
  errorRate: number;
}

// ─── User Management ───
export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  designation?: string;
  phone?: string;
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  createdDate: Date;
  lastLogin?: Date;
  loginCount: number;
  avatar?: string;
}

export interface UserActivity {
  id: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  details: string;
  ipAddress: string;
  timestamp: Date;
  status: 'success' | 'failed' | 'warning';
}

// ─── Audit Log ───
export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  role: UserRole;
  action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'export' | 'approve' | 'reject';
  module: string;
  resource: string;
  details: string;
  ipAddress: string;
  userAgent?: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'critical';
}

// ─── System Configuration ───
export interface UniversityConfig {
  name: string;
  shortName: string;
  logo?: string;
  website: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  type: 'deemed' | 'central' | 'state' | 'private';
  establishedYear: number;
  ugcRecognized: boolean;
  naacGrade?: string;
  nirfRank?: number;
  chancellor?: string;
  viceChancellor?: string;
}

export interface AcademicYearConfig {
  id: string;
  year: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  semesters: SemesterConfig[];
  status: 'active' | 'completed' | 'upcoming';
}

export interface SemesterConfig {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  registrationDeadline: Date;
  examStartDate?: Date;
  examEndDate?: Date;
  status: 'active' | 'completed' | 'upcoming';
}

export interface DepartmentConfig {
  id: string;
  name: string;
  code: string;
  hod: string;
  faculty: number;
  students: number;
  programs: number;
  established: number;
  status: 'active' | 'inactive';
}

export interface ModuleConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  roles: UserRole[];
  subModules: SubModuleConfig[];
  lastUpdated: Date;
}

export interface SubModuleConfig {
  id: string;
  name: string;
  enabled: boolean;
  path: string;
}

// ─── Notifications ───
export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  targetRoles: UserRole[];
  targetDepartments?: string[];
  sentBy: string;
  sentDate: Date;
  readCount: number;
  totalRecipients: number;
  status: 'draft' | 'sent' | 'scheduled';
  scheduledDate?: Date;
}

// ─── Backup ───
export interface BackupRecord {
  id: string;
  type: 'full' | 'incremental' | 'database' | 'files';
  size: string;
  createdDate: Date;
  status: 'completed' | 'in_progress' | 'failed';
  duration: string;
  initiatedBy: string;
  location: string;
}
