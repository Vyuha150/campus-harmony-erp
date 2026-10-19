import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  // Wait for the saved session to be checked. Redirecting while it was still
  // loading sent every full page reload of "/" to the login screen, which
  // looked like being logged out.
  if (isLoading) return null;

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
}
