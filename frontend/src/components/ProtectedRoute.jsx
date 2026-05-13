import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Redirects to /login if not authenticated */
export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageSpinner />;
  return user ? children : <Navigate to="/login" replace />;
}

/** Redirects to /dashboard if not admin */
export function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return user.role === 'admin' ? children : <Navigate to="/dashboard" replace />;
}

/** Redirects to /dashboard if already authenticated */
export function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageSpinner />;
  return !user ? children : <Navigate to="/dashboard" replace />;
}

function PageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <span className="spinner w-8 h-8 border-primary-500" />
    </div>
  );
}
