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
            {user?.role === 'student' ? <StudentDashboard /> : user?.role === 'faculty' ? <FacultyDashboard /> : <Dashboard />}
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
