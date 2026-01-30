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
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<RoleSelection />} />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      {/* Placeholder routes for navigation */}
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
