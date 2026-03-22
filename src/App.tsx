import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { UserRole } from "@/types/erp";

// Pages
import Index from "./pages/Index";
import RoleSelection from "./pages/RoleSelection";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

// Student Portal Pages
import StudentDashboard from "./components/student/StudentDashboard";
import StudentProfile from "./components/student/StudentProfile";
import StudentCourses from "./components/student/StudentCourses";
import StudentAssignments from "./components/student/StudentAssignments";
import StudentExaminations from "./components/student/StudentExaminations";
import StudentAttendance from "./components/student/StudentAttendance";
import StudentFees from "./components/student/StudentFees";
import StudentLibrary from "./components/student/StudentLibrary";
import StudentPlacements from "./components/student/StudentPlacements";
import StudentGrievances from "./components/student/StudentGrievances";
import StudentCommunication from "./components/student/StudentCommunication";
import StudentMentoring from "./components/student/StudentMentoring";

// Faculty Portal Pages
import FacultyDashboard from "./components/faculty/FacultyDashboard";
import FacultyProfile from "./components/faculty/FacultyProfile";
import FacultyCourses from "./components/faculty/FacultyCourses";
import FacultyAttendance from "./components/faculty/FacultyAttendance";
import FacultyAssignments from "./components/faculty/FacultyAssignments";
import FacultyMarks from "./components/faculty/FacultyMarks";
import FacultyMentoring from "./components/faculty/FacultyMentoring";
import FacultyResearch from "./components/faculty/FacultyResearch";
import FacultyCommittees from "./components/faculty/FacultyCommittees";
import FacultyGrievancesFeedback from "./components/faculty/FacultyGrievances";
import FacultyCommunication from "./components/faculty/FacultyCommunication";

// HOD Portal Pages
import HODDashboard from "./components/hod/HODDashboard";
import HODFacultyManagement from "./components/hod/HODFacultyManagement";
import HODWorkload from "./components/hod/HODWorkload";
import HODStudentAcademics from "./components/hod/HODStudentAcademics";
import HODResultsAnalysis from "./components/hod/HODResultsAnalysis";
import HODAccreditation from "./components/hod/HODAccreditation";
import HODInventory from "./components/hod/HODInventory";
import HODGrievances from "./components/hod/HODGrievances";
import HODCommunication from "./components/hod/HODCommunication";
import HODCourseManagement from "./components/hod/HODCourseManagement";
import HODFacilityManagement from "./components/hod/HODFacilityManagement";
import HODApprovals from "./components/hod/HODApprovals";

// Dean Portal Pages
import DeanDashboard from "./components/dean/DeanDashboard";
import DeanAcademics from "./components/dean/DeanAcademics";
import DeanFacultyHR from "./components/dean/DeanFacultyHR";
import DeanStudentAffairs from "./components/dean/DeanStudentAffairs";
import DeanResults from "./components/dean/DeanResults";
import DeanFinance from "./components/dean/DeanFinance";
import DeanAccreditation from "./components/dean/DeanAccreditation";
import DeanCoordination from "./components/dean/DeanCoordination";
import DeanCourseManagement from "./components/dean/DeanCourseManagement";
import DeanFacilityManagement from "./components/dean/DeanFacilityManagement";
import DeanSemesterManagement from "./components/dean/DeanSemesterManagement";
import DeanMeetings from "./components/dean/DeanMeetings";

// Registrar Portal Pages
import RegistrarDashboard from "./components/registrar/RegistrarDashboard";
import RegistrarStudentRecords from "./components/registrar/RegistrarStudentRecords";
import RegistrarTransfers from "./components/registrar/RegistrarTransfers";
import RegistrarCertificates from "./components/registrar/RegistrarCertificates";
import RegistrarExamOversight from "./components/registrar/RegistrarExamOversight";
import RegistrarDocuments from "./components/registrar/RegistrarDocuments";
import RegistrarHR from "./components/registrar/RegistrarHR";
import RegistrarAccreditation from "./components/registrar/RegistrarAccreditation";
import RegistrarQueries from "./components/registrar/RegistrarQueries";
import COEResultSubmission from "./components/coe/COEResultSubmission";
import COEExamOversight from "./components/coe/COEExamOversight";
import COEDashboard from "./components/coe/COEDashboard";
import COESubmissionTracker from "./components/coe/COESubmissionTracker";

// VC / Pro-VC Portal Pages
import VCDashboard from "./components/vc/VCDashboard";
import VCApprovals from "./components/vc/VCApprovals";
import VCPolicyPlanning from "./components/vc/VCPolicyPlanning";
import VCMeetings from "./components/vc/VCMeetings";
import VCCommunication from "./components/vc/VCCommunication";
import VCCompliance from "./components/vc/VCCompliance";
import VCFinance from "./components/vc/VCFinance";
import VCAnalytics from "./components/vc/VCAnalytics";
import VCGlobalAccess from "./components/vc/VCGlobalAccess";

// Finance Portal Pages
import FinanceDashboard from "./components/finance/FinanceDashboard";
import FeeManagement from "./components/finance/FeeManagement";
import Accounting from "./components/finance/Accounting";
import Procurement from "./components/finance/Procurement";
import Payroll from "./components/finance/Payroll";
import FinancialReports from "./components/finance/FinancialReports";
import FinanceBudgets from "./components/finance/FinanceBudgets";

// Placement Portal Pages
import PlacementDashboard from "./components/placement/PlacementDashboard";
import PlacementStudents from "./components/placement/PlacementStudents";
import PlacementCompanies from "./components/placement/PlacementCompanies";
import PlacementDrives from "./components/placement/PlacementDrives";
import PlacementTraining from "./components/placement/PlacementTraining";
import PlacementReports from "./components/placement/PlacementReports";
import PlacementCommunication from "./components/placement/PlacementCommunication";

// Sports Portal Pages
import SportsDashboard from "./components/sports/SportsDashboard";
import SportsAthletes from "./components/sports/SportsAthletes";
import SportsTeams from "./components/sports/SportsTeams";
import SportsAttendance from "./components/sports/SportsAttendance";
import SportsFacilities from "./components/sports/SportsFacilities";
import SportsInventory from "./components/sports/SportsInventory";
import SportsEvents from "./components/sports/SportsEvents";
import SportsHealth from "./components/sports/SportsHealth";

// Alumni Portal Pages
import AlumniDashboard from "./components/alumni/AlumniDashboard";
import AlumniDirectory from "./components/alumni/AlumniDirectory";
import AlumniCommunication from "./components/alumni/AlumniCommunication";
import AlumniEvents from "./components/alumni/AlumniEvents";
import AlumniMentorship from "./components/alumni/AlumniMentorship";
import AlumniDonations from "./components/alumni/AlumniDonations";
import AlumniProgression from "./components/alumni/AlumniProgression";
import AlumniJobs from "./components/alumni/AlumniJobs";

// IQAC Portal Pages
import IQACDashboard from "./components/iqac/IQACDashboard";
import IQACCriteria from "./components/iqac/IQACCriteria";
import IQACActions from "./components/iqac/IQACActions";
import IQACDocuments from "./components/iqac/IQACDocuments";
import IQACFeedback from "./components/iqac/IQACFeedback";
import IQACReports from "./components/iqac/IQACReports";

// Super Admin Portal Pages
import SuperAdminDashboard from "./components/admin/SuperAdminDashboard";
import AdminUserManagement from "./components/admin/AdminUserManagement";
import AdminSystemConfig from "./components/admin/AdminSystemConfig";
import AdminAuditLogs from "./components/admin/AdminAuditLogs";
import AdminNotifications from "./components/admin/AdminNotifications";

// Grievance Portal Pages
import GrievanceDashboard from "./components/grievance/GrievanceDashboard";

// Security Portal Pages
import SecurityDashboard from "./components/security/SecurityDashboard";
import LibrarianLibrary from "./components/library/LibrarianLibrary";
import LibraryCatalog from "./components/library/LibraryCatalog";
import LibraryCirculation from "./components/library/LibraryCirculation";
import LibraryAcquisitions from "./components/library/LibraryAcquisitions";

const queryClient = new QueryClient();

const PATH_ROLE_RULES: Array<{ prefix: string; roles: UserRole[] }> = [
  { prefix: '/student', roles: ['student'] },
  { prefix: '/faculty', roles: ['faculty'] },
  { prefix: '/hod', roles: ['hod'] },
  { prefix: '/dean', roles: ['dean'] },
  { prefix: '/vc', roles: ['vice_chancellor', 'pro_vc'] },
  { prefix: '/registrar', roles: ['registrar'] },
  { prefix: '/coe', roles: ['coe'] },
  { prefix: '/finance', roles: ['finance_officer'] },
  { prefix: '/placement', roles: ['placement_officer'] },
  { prefix: '/sports', roles: ['sports_director'] },
  { prefix: '/alumni', roles: ['alumni_officer'] },
  { prefix: '/iqac', roles: ['iqac_coordinator'] },
  { prefix: '/admin', roles: ['super_admin'] },
  { prefix: '/grievance', roles: ['grievance_officer'] },
  { prefix: '/security', roles: ['security_officer'] },
  { prefix: '/library', roles: ['librarian'] },
];

function roleCanAccessPath(role: UserRole, pathname: string): boolean {
  if (role === 'super_admin') return true;
  const matchedRule = PATH_ROLE_RULES.find((rule) => pathname.startsWith(rule.prefix));
  if (!matchedRule) return true;
  return matchedRule.roles.includes(role);
}

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return null;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user && !roleCanAccessPath(user.role, location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

// App Routes component
function AppRoutes() {
  const { user } = useAuth();
  
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<RoleSelection />} />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            {user?.role === 'super_admin' ? <SuperAdminDashboard /> : user?.role === 'student' ? <StudentDashboard /> : user?.role === 'faculty' ? <FacultyDashboard /> : user?.role === 'hod' ? <HODDashboard /> : user?.role === 'dean' ? <DeanDashboard /> : (user?.role === 'vice_chancellor' || user?.role === 'pro_vc') ? <VCDashboard /> : user?.role === 'registrar' ? <RegistrarDashboard /> : user?.role === 'coe' ? <COEDashboard /> : user?.role === 'finance_officer' ? <FinanceDashboard /> : user?.role === 'placement_officer' ? <PlacementDashboard /> : user?.role === 'sports_director' ? <SportsDashboard /> : user?.role === 'alumni_officer' ? <AlumniDashboard /> : user?.role === 'iqac_coordinator' ? <IQACDashboard /> : user?.role === 'grievance_officer' ? <GrievanceDashboard /> : user?.role === 'security_officer' ? <SecurityDashboard /> : user?.role === 'librarian' ? <LibrarianLibrary /> : <Dashboard />}
          </ProtectedRoute>
        } 
      />
      {/* Student Portal Routes */}
      <Route path="/student/profile" element={<ProtectedRoute><StudentProfile /></ProtectedRoute>} />
      <Route path="/student/courses" element={<ProtectedRoute><StudentCourses /></ProtectedRoute>} />
      <Route path="/student/assignments" element={<ProtectedRoute><StudentAssignments /></ProtectedRoute>} />
      <Route path="/student/examinations" element={<ProtectedRoute><StudentExaminations /></ProtectedRoute>} />
      <Route path="/student/attendance" element={<ProtectedRoute><StudentAttendance /></ProtectedRoute>} />
      <Route path="/student/fees" element={<ProtectedRoute><StudentFees /></ProtectedRoute>} />
      <Route path="/student/library" element={<ProtectedRoute><StudentLibrary /></ProtectedRoute>} />
      <Route path="/student/placements" element={<ProtectedRoute><StudentPlacements /></ProtectedRoute>} />
      <Route path="/student/grievances" element={<ProtectedRoute><StudentGrievances /></ProtectedRoute>} />
      <Route path="/student/communication" element={<ProtectedRoute><StudentCommunication /></ProtectedRoute>} />
      <Route path="/student/mentoring" element={<ProtectedRoute><StudentMentoring /></ProtectedRoute>} />
      {/* Faculty Portal Routes */}
      <Route path="/faculty/profile" element={<ProtectedRoute><FacultyProfile /></ProtectedRoute>} />
      <Route path="/faculty/courses" element={<ProtectedRoute><FacultyCourses /></ProtectedRoute>} />
      <Route path="/faculty/attendance" element={<ProtectedRoute><FacultyAttendance /></ProtectedRoute>} />
      <Route path="/faculty/assignments" element={<ProtectedRoute><FacultyAssignments /></ProtectedRoute>} />
      <Route path="/faculty/marks" element={<ProtectedRoute><FacultyMarks /></ProtectedRoute>} />
      <Route path="/faculty/mentoring" element={<ProtectedRoute><FacultyMentoring /></ProtectedRoute>} />
      <Route path="/faculty/research" element={<ProtectedRoute><FacultyResearch /></ProtectedRoute>} />
      <Route path="/faculty/committees" element={<ProtectedRoute><FacultyCommittees /></ProtectedRoute>} />
      <Route path="/faculty/grievances" element={<ProtectedRoute><FacultyGrievancesFeedback /></ProtectedRoute>} />
      <Route path="/faculty/communication" element={<ProtectedRoute><FacultyCommunication /></ProtectedRoute>} />
      {/* HOD Portal Routes */}
      <Route path="/hod/approvals" element={<ProtectedRoute><HODApprovals /></ProtectedRoute>} />
      <Route path="/hod/faculty" element={<ProtectedRoute><HODFacultyManagement /></ProtectedRoute>} />
      <Route path="/hod/workload" element={<ProtectedRoute><HODWorkload /></ProtectedRoute>} />
      <Route path="/hod/courses" element={<ProtectedRoute><HODCourseManagement /></ProtectedRoute>} />
      <Route path="/hod/facilities" element={<ProtectedRoute><HODFacilityManagement /></ProtectedRoute>} />
      <Route path="/hod/students" element={<ProtectedRoute><HODStudentAcademics /></ProtectedRoute>} />
      <Route path="/hod/results" element={<ProtectedRoute><HODResultsAnalysis /></ProtectedRoute>} />
      <Route path="/hod/accreditation" element={<ProtectedRoute><HODAccreditation /></ProtectedRoute>} />
      <Route path="/hod/inventory" element={<ProtectedRoute><HODInventory /></ProtectedRoute>} />
      <Route path="/hod/grievances" element={<ProtectedRoute><HODGrievances /></ProtectedRoute>} />
      <Route path="/hod/communication" element={<ProtectedRoute><HODCommunication /></ProtectedRoute>} />
      {/* Dean Portal Routes */}
      <Route path="/dean/academics" element={<ProtectedRoute><DeanAcademics /></ProtectedRoute>} />
      <Route path="/dean/meetings" element={<ProtectedRoute><DeanMeetings /></ProtectedRoute>} />
      <Route path="/dean/courses" element={<ProtectedRoute><DeanCourseManagement /></ProtectedRoute>} />
      <Route path="/dean/facilities" element={<ProtectedRoute><DeanFacilityManagement /></ProtectedRoute>} />
      <Route path="/dean/semesters" element={<ProtectedRoute><DeanSemesterManagement /></ProtectedRoute>} />
      <Route path="/dean/faculty-hr" element={<ProtectedRoute><DeanFacultyHR /></ProtectedRoute>} />
      <Route path="/dean/student-affairs" element={<ProtectedRoute><DeanStudentAffairs /></ProtectedRoute>} />
      <Route path="/dean/results" element={<ProtectedRoute><DeanResults /></ProtectedRoute>} />
      <Route path="/dean/finance" element={<ProtectedRoute><DeanFinance /></ProtectedRoute>} />
      <Route path="/dean/accreditation" element={<ProtectedRoute><DeanAccreditation /></ProtectedRoute>} />
      <Route path="/dean/coordination" element={<ProtectedRoute><DeanCoordination /></ProtectedRoute>} />
      {/* VC / Pro-VC Portal Routes */}
      <Route path="/vc/approvals" element={<ProtectedRoute><VCApprovals /></ProtectedRoute>} />
      <Route path="/vc/policy" element={<ProtectedRoute><VCPolicyPlanning /></ProtectedRoute>} />
      <Route path="/vc/meetings" element={<ProtectedRoute><VCMeetings /></ProtectedRoute>} />
      <Route path="/vc/communication" element={<ProtectedRoute><VCCommunication /></ProtectedRoute>} />
      <Route path="/vc/compliance" element={<ProtectedRoute><VCCompliance /></ProtectedRoute>} />
      <Route path="/vc/finance" element={<ProtectedRoute><VCFinance /></ProtectedRoute>} />
      <Route path="/vc/analytics" element={<ProtectedRoute><VCAnalytics /></ProtectedRoute>} />
      <Route path="/vc/global-access" element={<ProtectedRoute><VCGlobalAccess /></ProtectedRoute>} />
      {/* Registrar Portal Routes */}
      <Route path="/registrar/student-records" element={<ProtectedRoute><RegistrarStudentRecords /></ProtectedRoute>} />
      <Route path="/registrar/transfers" element={<ProtectedRoute><RegistrarTransfers /></ProtectedRoute>} />
      <Route path="/registrar/certificates" element={<ProtectedRoute><RegistrarCertificates /></ProtectedRoute>} />
      <Route path="/registrar/exam-oversight" element={<ProtectedRoute><RegistrarExamOversight /></ProtectedRoute>} />
      <Route path="/registrar/documents" element={<ProtectedRoute><RegistrarDocuments /></ProtectedRoute>} />
      <Route path="/registrar/hr" element={<ProtectedRoute><RegistrarHR /></ProtectedRoute>} />
      <Route path="/registrar/accreditation" element={<ProtectedRoute><RegistrarAccreditation /></ProtectedRoute>} />
      <Route path="/registrar/queries" element={<ProtectedRoute><RegistrarQueries /></ProtectedRoute>} />
      {/* COE Portal Routes */}
      <Route path="/coe/dashboard" element={<ProtectedRoute><COEDashboard /></ProtectedRoute>} />
      <Route path="/coe/exam-oversight" element={<ProtectedRoute><COEExamOversight /></ProtectedRoute>} />
      <Route path="/coe/results" element={<ProtectedRoute><COEResultSubmission /></ProtectedRoute>} />
      <Route path="/coe/submissions" element={<ProtectedRoute><COESubmissionTracker /></ProtectedRoute>} />
      {/* Finance Portal Routes */}
      <Route path="/finance/fees" element={<ProtectedRoute><FeeManagement /></ProtectedRoute>} />
      <Route path="/finance/accounting" element={<ProtectedRoute><Accounting /></ProtectedRoute>} />
      <Route path="/finance/procurement" element={<ProtectedRoute><Procurement /></ProtectedRoute>} />
      <Route path="/finance/payroll" element={<ProtectedRoute><Payroll /></ProtectedRoute>} />
      <Route path="/finance/reports" element={<ProtectedRoute><FinancialReports /></ProtectedRoute>} />
      <Route path="/finance/budgets" element={<ProtectedRoute><FinanceBudgets /></ProtectedRoute>} />
      {/* Placement Portal Routes */}
      <Route path="/placement/students" element={<ProtectedRoute><PlacementStudents /></ProtectedRoute>} />
      <Route path="/placement/companies" element={<ProtectedRoute><PlacementCompanies /></ProtectedRoute>} />
      <Route path="/placement/drives" element={<ProtectedRoute><PlacementDrives /></ProtectedRoute>} />
      <Route path="/placement/training" element={<ProtectedRoute><PlacementTraining /></ProtectedRoute>} />
      <Route path="/placement/reports" element={<ProtectedRoute><PlacementReports /></ProtectedRoute>} />
      <Route path="/placement/communication" element={<ProtectedRoute><PlacementCommunication /></ProtectedRoute>} />
      {/* Sports Portal Routes */}
      <Route path="/sports/athletes" element={<ProtectedRoute><SportsAthletes /></ProtectedRoute>} />
      <Route path="/sports/teams" element={<ProtectedRoute><SportsTeams /></ProtectedRoute>} />
      <Route path="/sports/attendance" element={<ProtectedRoute><SportsAttendance /></ProtectedRoute>} />
      <Route path="/sports/facilities" element={<ProtectedRoute><SportsFacilities /></ProtectedRoute>} />
      <Route path="/sports/inventory" element={<ProtectedRoute><SportsInventory /></ProtectedRoute>} />
      <Route path="/sports/events" element={<ProtectedRoute><SportsEvents /></ProtectedRoute>} />
      <Route path="/sports/health" element={<ProtectedRoute><SportsHealth /></ProtectedRoute>} />
      {/* Alumni Portal Routes */}
      <Route path="/alumni/directory" element={<ProtectedRoute><AlumniDirectory /></ProtectedRoute>} />
      <Route path="/alumni/communication" element={<ProtectedRoute><AlumniCommunication /></ProtectedRoute>} />
      <Route path="/alumni/events" element={<ProtectedRoute><AlumniEvents /></ProtectedRoute>} />
      <Route path="/alumni/mentorship" element={<ProtectedRoute><AlumniMentorship /></ProtectedRoute>} />
      <Route path="/alumni/donations" element={<ProtectedRoute><AlumniDonations /></ProtectedRoute>} />
      <Route path="/alumni/progression" element={<ProtectedRoute><AlumniProgression /></ProtectedRoute>} />
      <Route path="/alumni/jobs" element={<ProtectedRoute><AlumniJobs /></ProtectedRoute>} />
      {/* IQAC Portal Routes */}
      <Route path="/iqac/criteria" element={<ProtectedRoute><IQACCriteria /></ProtectedRoute>} />
      <Route path="/iqac/actions" element={<ProtectedRoute><IQACActions /></ProtectedRoute>} />
      <Route path="/iqac/documents" element={<ProtectedRoute><IQACDocuments /></ProtectedRoute>} />
      <Route path="/iqac/feedback" element={<ProtectedRoute><IQACFeedback /></ProtectedRoute>} />
      <Route path="/iqac/reports" element={<ProtectedRoute><IQACReports /></ProtectedRoute>} />
      {/* Super Admin Portal Routes */}
      <Route path="/admin/users" element={<ProtectedRoute><AdminUserManagement /></ProtectedRoute>} />
      <Route path="/admin/config" element={<ProtectedRoute><AdminSystemConfig /></ProtectedRoute>} />
      <Route path="/admin/audit" element={<ProtectedRoute><AdminAuditLogs /></ProtectedRoute>} />
      <Route path="/admin/notifications" element={<ProtectedRoute><AdminNotifications /></ProtectedRoute>} />
      {/* Grievance Portal Routes */}
      <Route path="/grievance/cases" element={<ProtectedRoute><GrievanceDashboard initialTab="cases" /></ProtectedRoute>} />
      <Route path="/grievance/compliance" element={<ProtectedRoute><GrievanceDashboard initialTab="compliance" /></ProtectedRoute>} />
      <Route path="/grievance/reports" element={<ProtectedRoute><GrievanceDashboard initialTab="reports" /></ProtectedRoute>} />
      {/* Security Portal Routes */}
      <Route path="/security/incidents" element={<ProtectedRoute><SecurityDashboard initialTab="incidents" /></ProtectedRoute>} />
      <Route path="/security/visitors" element={<ProtectedRoute><SecurityDashboard initialTab="visitors" /></ProtectedRoute>} />
      <Route path="/security/ids" element={<ProtectedRoute><SecurityDashboard initialTab="ids" /></ProtectedRoute>} />
      <Route path="/security/vehicles" element={<ProtectedRoute><SecurityDashboard initialTab="vehicles" /></ProtectedRoute>} />
      <Route path="/security/audit" element={<ProtectedRoute><SecurityDashboard initialTab="audit" /></ProtectedRoute>} />
      <Route path="/security/vigilance" element={<ProtectedRoute><SecurityDashboard initialTab="vigilance" /></ProtectedRoute>} />
      {/* Librarian Portal Routes */}
      <Route path="/library" element={<ProtectedRoute><LibrarianLibrary initialTab="catalog" /></ProtectedRoute>} />
      <Route path="/library/catalog" element={<ProtectedRoute><LibraryCatalog /></ProtectedRoute>} />
      <Route path="/library/circulation" element={<ProtectedRoute><LibraryCirculation /></ProtectedRoute>} />
      <Route path="/library/acquisitions" element={<ProtectedRoute><LibraryAcquisitions /></ProtectedRoute>} />
      {/* Placeholder routes for other modules */}
      <Route path="/academics/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/students/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/examinations/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/research/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/placements/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/grievances/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/reports/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/settings/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
