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
  'library-management': 'Library Management',
  catalog: 'Catalog',
  circulation: 'Circulation & Issues',
  acquisitions: 'Acquisitions',
  placements: 'Placements',
  grievances: 'Grievances',
  grievance: 'Grievance Portal',
  'grievance-portal': 'Grievance Portal',
  cases: 'Case Management',
  compliance: 'Compliance Tracking',
  security: 'Security Operations',
  'security-operations': 'Security Operations',
  incidents: 'Incident Reporting',
  visitors: 'Visitor Management',
  ids: 'ID Card Requests',
  vehicles: 'Vehicle Passes',
  vigilance: 'Vigilance Cases',
  audit: 'Audit & Logs',
  academics: 'Academics',
  students: 'Student Academics',
  finance: 'Finance',
  research: 'Research',
  settings: 'Settings',
  reports: 'Reports & Analytics',
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
  registrar: 'Registrar Portal',
  'student-records': 'Student Records',
  transfers: 'Transfers & Migration',
  certificates: 'Degree Certificates',
  'exam-oversight': 'Exam Oversight',
  documents: 'Document Repository',
  hr: 'Establishment & HR',
  queries: 'Queries & Verification',
  coe: 'COE Portal',
  'exam-oversight': 'Exam Oversight',
  'result-submission': 'Result Submission',
  submissions: 'Submission Tracker',
  finance: 'Finance Officer',
  'fee-management': 'Fee Management',
  accounting: 'Accounting & Ledger',
  procurement: 'Procurement & Payments',
  payroll: 'Payroll Processing',
  budgets: 'Budget Management',
  placement: 'Placement Portal',
  'student-profiles': 'Student Profiles',
  companies: 'Company Management',
  drives: 'Placement Drives',
  training: 'Training & Internships',
  sports: 'Sports Portal',
  athletes: 'Athletes Database',
  teams: 'Team Management',
  facilities: 'Facility Booking',
  events: 'Events & Tournaments',
  health: 'Health & Fitness',
  alumni: 'Alumni Portal',
  directory: 'Alumni Directory',
  events: 'Events & Reunions',
  mentorship: 'Mentorship Programs',
  donations: 'Fundraising & Donations',
  progression: 'Progression Data',
  jobs: 'Job Board',
  iqac: 'IQAC Portal',
  criteria: 'NAAC Criteria',
  actions: 'Action Items',
  feedback: 'Feedback Analysis',
  admin: 'Admin Portal',
  users: 'User Management',
  config: 'System Config',
  notifications: 'Notifications',
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
