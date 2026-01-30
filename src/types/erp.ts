// Campus ERP Type Definitions

export type UserRole = 
  | 'super_admin'
  | 'vice_chancellor'
  | 'pro_vc'
  | 'registrar'
  | 'dean'
  | 'hod'
  | 'faculty'
  | 'student'
  | 'finance_officer'
  | 'iqac_coordinator'
  | 'placement_officer'
  | 'alumni_officer'
  | 'sports_director'
  | 'grievance_officer'
  | 'security_officer'
  | 'librarian';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  department?: string;
  designation?: string;
  campus?: string;
}

export interface RoleInfo {
  id: UserRole;
  label: string;
  description: string;
  icon: string;
  color: string;
  modules: string[];
}

export const ROLE_INFO: Record<UserRole, RoleInfo> = {
  super_admin: {
    id: 'super_admin',
    label: 'Super Admin',
    description: 'Full system access and configuration',
    icon: 'Shield',
    color: 'primary',
    modules: ['all'],
  },
  vice_chancellor: {
    id: 'vice_chancellor',
    label: 'Vice Chancellor',
    description: 'Institution-wide oversight and strategic decisions',
    icon: 'Crown',
    color: 'secondary',
    modules: ['dashboard', 'analytics', 'approvals', 'reports', 'compliance'],
  },
  pro_vc: {
    id: 'pro_vc',
    label: 'Pro Vice Chancellor',
    description: 'Domain-specific institutional oversight',
    icon: 'Star',
    color: 'accent',
    modules: ['dashboard', 'analytics', 'academics', 'approvals'],
  },
  registrar: {
    id: 'registrar',
    label: 'Registrar',
    description: 'Academic administration and records management',
    icon: 'FileText',
    color: 'info',
    modules: ['students', 'examinations', 'certificates', 'approvals'],
  },
  dean: {
    id: 'dean',
    label: 'Dean',
    description: 'Faculty/School level academic oversight',
    icon: 'Building2',
    color: 'primary',
    modules: ['academics', 'faculty', 'curriculum', 'approvals'],
  },
  hod: {
    id: 'hod',
    label: 'Head of Department',
    description: 'Department administration and faculty management',
    icon: 'Users',
    color: 'accent',
    modules: ['department', 'faculty', 'timetable', 'approvals'],
  },
  faculty: {
    id: 'faculty',
    label: 'Faculty',
    description: 'Teaching, research, and student mentoring',
    icon: 'GraduationCap',
    color: 'info',
    modules: ['courses', 'attendance', 'assessments', 'research', 'mentoring'],
  },
  student: {
    id: 'student',
    label: 'Student',
    description: 'Academic activities and campus services',
    icon: 'BookOpen',
    color: 'success',
    modules: ['courses', 'attendance', 'examinations', 'fees', 'library', 'placements'],
  },
  finance_officer: {
    id: 'finance_officer',
    label: 'Finance Officer',
    description: 'Financial management and accounting',
    icon: 'Wallet',
    color: 'warning',
    modules: ['fees', 'payroll', 'budget', 'accounts', 'procurement'],
  },
  iqac_coordinator: {
    id: 'iqac_coordinator',
    label: 'IQAC Coordinator',
    description: 'Quality assurance and accreditation',
    icon: 'Award',
    color: 'accent',
    modules: ['aqar', 'feedback', 'compliance', 'reports'],
  },
  placement_officer: {
    id: 'placement_officer',
    label: 'Placement Officer',
    description: 'Campus recruitment and career services',
    icon: 'Briefcase',
    color: 'success',
    modules: ['placements', 'companies', 'internships', 'training'],
  },
  alumni_officer: {
    id: 'alumni_officer',
    label: 'Alumni Officer',
    description: 'Alumni relations and progression tracking',
    icon: 'Users2',
    color: 'primary',
    modules: ['alumni', 'events', 'mentorship', 'donations'],
  },
  sports_director: {
    id: 'sports_director',
    label: 'Sports Director',
    description: 'Sports programs and facilities management',
    icon: 'Trophy',
    color: 'warning',
    modules: ['sports', 'events', 'facilities', 'teams'],
  },
  grievance_officer: {
    id: 'grievance_officer',
    label: 'Grievance Officer',
    description: 'Complaint handling and resolution',
    icon: 'MessageSquare',
    color: 'destructive',
    modules: ['grievances', 'compliance', 'reports'],
  },
  security_officer: {
    id: 'security_officer',
    label: 'Security Officer',
    description: 'Campus security and access management',
    icon: 'ShieldCheck',
    color: 'primary',
    modules: ['security', 'visitors', 'incidents', 'access'],
  },
  librarian: {
    id: 'librarian',
    label: 'Librarian',
    description: 'Library management and resources',
    icon: 'Library',
    color: 'info',
    modules: ['library', 'catalog', 'circulation', 'acquisitions'],
  },
};

export interface Module {
  id: string;
  name: string;
  description: string;
  icon: string;
  path: string;
  submodules?: SubModule[];
}

export interface SubModule {
  id: string;
  name: string;
  path: string;
  icon?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

export interface DashboardStat {
  label: string;
  value: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease';
  icon: string;
  color?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high';
  publishedAt: Date;
  expiresAt?: Date;
  author: string;
  targetRoles?: UserRole[];
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  priority: 'low' | 'medium' | 'high';
  dueDate: Date;
  assignee?: string;
  category: string;
}

export interface ApprovalItem {
  id: string;
  type: string;
  title: string;
  requestedBy: string;
  requestedAt: Date;
  status: 'pending' | 'approved' | 'rejected';
  priority: 'low' | 'medium' | 'high';
  details?: Record<string, unknown>;
}
