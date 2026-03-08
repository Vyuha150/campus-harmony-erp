import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";

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

// Dean Portal Pages
import DeanDashboard from "./components/dean/DeanDashboard";
import DeanAcademics from "./components/dean/DeanAcademics";
import DeanFacultyHR from "./components/dean/DeanFacultyHR";
import DeanStudentAffairs from "./components/dean/DeanStudentAffairs";
import DeanResults from "./components/dean/DeanResults";
import DeanFinance from "./components/dean/DeanFinance";
import DeanAccreditation from "./components/dean/DeanAccreditation";
import DeanCoordination from "./components/dean/DeanCoordination";

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

const queryClient = new QueryClient();

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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
            {user?.role === 'student' ? <StudentDashboard /> : user?.role === 'faculty' ? <FacultyDashboard /> : user?.role === 'hod' ? <HODDashboard /> : user?.role === 'dean' ? <DeanDashboard /> : (user?.role === 'vice_chancellor' || user?.role === 'pro_vc') ? <VCDashboard /> : <Dashboard />}
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
      <Route path="/hod/faculty" element={<ProtectedRoute><HODFacultyManagement /></ProtectedRoute>} />
      <Route path="/hod/workload" element={<ProtectedRoute><HODWorkload /></ProtectedRoute>} />
      <Route path="/hod/students" element={<ProtectedRoute><HODStudentAcademics /></ProtectedRoute>} />
      <Route path="/hod/results" element={<ProtectedRoute><HODResultsAnalysis /></ProtectedRoute>} />
      <Route path="/hod/accreditation" element={<ProtectedRoute><HODAccreditation /></ProtectedRoute>} />
      <Route path="/hod/inventory" element={<ProtectedRoute><HODInventory /></ProtectedRoute>} />
      <Route path="/hod/grievances" element={<ProtectedRoute><HODGrievances /></ProtectedRoute>} />
      <Route path="/hod/communication" element={<ProtectedRoute><HODCommunication /></ProtectedRoute>} />
      {/* Dean Portal Routes */}
      <Route path="/dean/academics" element={<ProtectedRoute><DeanAcademics /></ProtectedRoute>} />
      <Route path="/dean/faculty-hr" element={<ProtectedRoute><DeanFacultyHR /></ProtectedRoute>} />
      <Route path="/dean/student-affairs" element={<ProtectedRoute><DeanStudentAffairs /></ProtectedRoute>} />
      <Route path="/dean/results" element={<ProtectedRoute><DeanResults /></ProtectedRoute>} />
      <Route path="/dean/finance" element={<ProtectedRoute><DeanFinance /></ProtectedRoute>} />
      <Route path="/dean/accreditation" element={<ProtectedRoute><DeanAccreditation /></ProtectedRoute>} />
      <Route path="/dean/coordination" element={<ProtectedRoute><DeanCoordination /></ProtectedRoute>} />
      {/* Placeholder routes for other modules */}
      <Route path="/academics/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/students/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/examinations/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/finance/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/research/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/placements/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/library/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
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
