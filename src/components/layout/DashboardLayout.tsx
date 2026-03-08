import { ReactNode } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

interface DashboardLayoutProps {
  children: ReactNode;
}

const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  student: 'Student Portal',
  faculty: 'Faculty Portal',
  hod: 'HOD Portal',
  profile: 'Profile',
  courses: 'Courses',
  assignments: 'Assignments',
  attendance: 'Attendance',
  examinations: 'Examinations',
  fees: 'Fees & Payments',
  library: 'Library',
  placements: 'Placements',
  grievances: 'Grievances',
  academics: 'Academics',
  students: 'Student Academics',
  finance: 'Finance',
  research: 'Research',
  settings: 'Settings',
  reports: 'Reports',
  marks: 'Gradebook',
  mentoring: 'Mentoring',
  committees: 'Committees',
  communication: 'Communication',
  workload: 'Workload & Timetable',
  results: 'Results Analysis',
  accreditation: 'Accreditation Data',
  inventory: 'Lab & Inventory',
  dean: 'Dean Portal',
  'faculty-hr': 'Faculty HR',
  'student-affairs': 'Student Affairs',
  coordination: 'Coordination',
  vc: 'VC Portal',
  approvals: 'Approvals & Decisions',
  policy: 'Policy & Planning',
  meetings: 'Meetings & Workflow',
  compliance: 'Compliance & Accreditation',
  analytics: 'Analytics & Reports',
  'global-access': 'Global Access',
};

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const showBack = pathSegments.length > 1;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        {showBack && (
          <div className="flex items-center gap-3 border-b bg-muted/30 px-6 py-2.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="h-4 w-px bg-border" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/dashboard">Home</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {pathSegments.map((segment, index) => {
                  const path = '/' + pathSegments.slice(0, index + 1).join('/');
                  const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
                  const isLast = index === pathSegments.length - 1;

                  return (
                    <span key={path} className="contents">
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        {isLast ? (
                          <BreadcrumbPage>{label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link to={path}>{label}</Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </span>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        )}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
