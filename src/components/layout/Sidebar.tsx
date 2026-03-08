import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { 
  LayoutDashboard, Users, GraduationCap, ClipboardList, 
  BookOpen, Calendar, Wallet, FileBarChart, Settings,
  Building2, Award, Briefcase, MessageSquare, Library,
  ChevronDown, ChevronRight, LogOut, Bell, Search,
  Menu, X, Shield, Trophy, Users2, ShieldCheck,
  BarChart3, Package, FileText, Megaphone
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { ROLE_INFO, UserRole } from '@/types/erp';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
  children?: MenuItem[];
  roles?: UserRole[];
}

// Faculty-specific menu items
const facultyMenuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'profile', label: 'Profile & Service', icon: Users, path: '/faculty/profile' },
  { id: 'courses', label: 'My Courses', icon: BookOpen, path: '/faculty/courses' },
  { id: 'attendance', label: 'Attendance', icon: ClipboardList, path: '/faculty/attendance' },
  { id: 'assignments', label: 'Assignments', icon: ClipboardList, path: '/faculty/assignments' },
  { id: 'marks', label: 'Gradebook', icon: ClipboardList, path: '/faculty/marks' },
  { id: 'mentoring', label: 'Mentoring', icon: Users, path: '/faculty/mentoring' },
  { id: 'research', label: 'Research', icon: Award, path: '/faculty/research' },
  { id: 'committees', label: 'Committees', icon: Building2, path: '/faculty/committees' },
  { id: 'grievances', label: 'Grievances & Feedback', icon: MessageSquare, path: '/faculty/grievances' },
  { id: 'communication', label: 'Communication', icon: MessageSquare, path: '/faculty/communication' },
];

// HOD-specific menu items
const hodMenuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'faculty', label: 'Faculty Management', icon: Users, path: '/hod/faculty' },
  { id: 'workload', label: 'Workload & Timetable', icon: Calendar, path: '/hod/workload' },
  { id: 'students', label: 'Student Academics', icon: GraduationCap, path: '/hod/students' },
  { id: 'results', label: 'Results Analysis', icon: BarChart3, path: '/hod/results' },
  { id: 'accreditation', label: 'Accreditation Data', icon: FileText, path: '/hod/accreditation' },
  { id: 'inventory', label: 'Lab & Inventory', icon: Package, path: '/hod/inventory' },
  { id: 'grievances', label: 'Grievances', icon: MessageSquare, path: '/hod/grievances' },
  { id: 'communication', label: 'Communication', icon: Megaphone, path: '/hod/communication' },
];

// Dean-specific menu items
const deanMenuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'academics', label: 'Academic Oversight', icon: GraduationCap, path: '/dean/academics' },
  { id: 'faculty-hr', label: 'Faculty HR', icon: Users, path: '/dean/faculty-hr' },
  { id: 'student-affairs', label: 'Student Affairs', icon: Shield, path: '/dean/student-affairs' },
  { id: 'results', label: 'Exams & Results', icon: BarChart3, path: '/dean/results' },
  { id: 'finance', label: 'Finance', icon: Wallet, path: '/dean/finance' },
  { id: 'accreditation', label: 'Accreditation', icon: Award, path: '/dean/accreditation' },
  { id: 'coordination', label: 'Coordination', icon: Building2, path: '/dean/coordination' },
];

// VC / Pro-VC specific menu items
const vcMenuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'approvals', label: 'Approvals & Decisions', icon: ClipboardList, path: '/vc/approvals' },
  { id: 'policy', label: 'Policy & Planning', icon: FileBarChart, path: '/vc/policy' },
  { id: 'meetings', label: 'Meetings & Workflow', icon: Calendar, path: '/vc/meetings' },
  { id: 'communication', label: 'Communication', icon: Megaphone, path: '/vc/communication' },
  { id: 'compliance', label: 'Compliance & Accreditation', icon: Award, path: '/vc/compliance' },
  { id: 'finance', label: 'Financial Overview', icon: Wallet, path: '/vc/finance' },
  { id: 'analytics', label: 'Analytics & Reports', icon: BarChart3, path: '/vc/analytics' },
  { id: 'global-access', label: 'Global Access', icon: Search, path: '/vc/global-access' },
];

// Student-specific menu items
const studentMenuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'profile', label: 'My Profile', icon: Users, path: '/student/profile' },
  { id: 'courses', label: 'My Courses', icon: BookOpen, path: '/student/courses' },
  { id: 'assignments', label: 'Assignments', icon: ClipboardList, path: '/student/assignments' },
  { id: 'attendance', label: 'Attendance', icon: Calendar, path: '/student/attendance' },
  { id: 'examinations', label: 'Examinations', icon: GraduationCap, path: '/student/examinations' },
  { id: 'fees', label: 'Fees & Payments', icon: Wallet, path: '/student/fees' },
  { id: 'library', label: 'Library', icon: Library, path: '/student/library' },
  { id: 'placements', label: 'Placements', icon: Briefcase, path: '/student/placements' },
  { id: 'grievances', label: 'Grievances', icon: MessageSquare, path: '/student/grievances' },
];

const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
  },
  {
    id: 'academics',
    label: 'Academics',
    icon: GraduationCap,
    path: '/academics',
    children: [
      { id: 'programs', label: 'Programs & Curriculum', icon: BookOpen, path: '/academics/programs' },
      { id: 'timetable', label: 'Timetable', icon: Calendar, path: '/academics/timetable' },
      { id: 'attendance', label: 'Attendance', icon: ClipboardList, path: '/academics/attendance' },
    ],
  },
  {
    id: 'students',
    label: 'Students',
    icon: Users,
    path: '/students',
    roles: ['super_admin', 'registrar', 'dean', 'hod', 'faculty'],
  },
  {
    id: 'examinations',
    label: 'Examinations',
    icon: ClipboardList,
    path: '/examinations',
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: Wallet,
    path: '/finance',
    roles: ['super_admin', 'finance_officer', 'registrar', 'vice_chancellor'],
  },
  {
    id: 'research',
    label: 'Research',
    icon: Award,
    path: '/research',
    roles: ['super_admin', 'faculty', 'hod', 'dean', 'vice_chancellor', 'pro_vc'],
  },
  {
    id: 'placements',
    label: 'Placements',
    icon: Briefcase,
    path: '/placements',
  },
  {
    id: 'library',
    label: 'Library',
    icon: Library,
    path: '/library',
  },
  {
    id: 'grievances',
    label: 'Grievances',
    icon: MessageSquare,
    path: '/grievances',
  },
  {
    id: 'reports',
    label: 'Reports & Analytics',
    icon: FileBarChart,
    path: '/reports',
    roles: ['super_admin', 'vice_chancellor', 'pro_vc', 'registrar', 'dean', 'iqac_coordinator'],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    path: '/settings',
    roles: ['super_admin'],
  },
];

const iconMap: Record<string, React.ElementType> = {
  Shield, Crown: Award, Star: Award, FileText: ClipboardList, Building2,
  Users, GraduationCap, BookOpen, Wallet, Award, Briefcase,
  Users2, Trophy, MessageSquare, ShieldCheck, Library
};

export function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(['academics']);

  if (!user) return null;

  const roleInfo = ROLE_INFO[user.role];
  const RoleIcon = iconMap[roleInfo.icon] || Shield;

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const isActiveRoute = (path: string) => location.pathname.startsWith(path);

  // Use role-specific menus
  const filteredMenuItems = user.role === 'student' 
    ? studentMenuItems 
    : user.role === 'faculty'
    ? facultyMenuItems
    : user.role === 'hod'
    ? hodMenuItems
    : user.role === 'dean'
    ? deanMenuItems
    : menuItems.filter(item => {
        if (!item.roles) return true;
        return item.roles.includes(user.role);
      });

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <aside
      className={cn(
        'flex h-screen flex-col bg-sidebar text-sidebar-foreground transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
              <GraduationCap className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">Campus ERP</span>
              <span className="text-[10px] text-sidebar-foreground/60">University Management</span>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {isCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </Button>
      </div>

      {/* User Info */}
      {!isCollapsed && (
        <div className="border-b border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-sidebar-primary">
              <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-sm">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-sidebar-foreground">{user.name}</p>
              <div className="flex items-center gap-1">
                <RoleIcon className="h-3 w-3 text-sidebar-primary" />
                <span className="text-xs text-sidebar-foreground/60">{roleInfo.label}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 px-2 py-4">
        <nav className="space-y-1">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActiveRoute(item.path);
            const isExpanded = expandedItems.includes(item.id);
            const hasChildren = item.children && item.children.length > 0;

            return (
              <div key={item.id}>
                {hasChildren ? (
                  <button
                    onClick={() => toggleExpanded(item.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {!isCollapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </>
                    )}
                  </button>
                ) : (
                  <Link
                    to={item.path}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {!isCollapsed && <span>{item.label}</span>}
                  </Link>
                )}

                {/* Children */}
                {hasChildren && isExpanded && !isCollapsed && (
                  <div className="ml-4 mt-1 space-y-1 border-l border-sidebar-border pl-4">
                    {item.children!.map((child) => {
                      const ChildIcon = child.icon;
                      const isChildActive = location.pathname === child.path;

                      return (
                        <Link
                          key={child.id}
                          to={child.path}
                          className={cn(
                            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                            isChildActive
                              ? 'bg-sidebar-primary/10 text-sidebar-primary'
                              : 'text-sidebar-foreground/60 hover:text-sidebar-foreground'
                          )}
                        >
                          {ChildIcon && <ChildIcon className="h-4 w-4" />}
                          <span>{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                isCollapsed && 'justify-center px-0'
              )}
            >
              <LogOut className="h-4 w-4" />
              {!isCollapsed && <span>Logout</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Are you sure?</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
