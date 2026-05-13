import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import { ProtectedRoute, GuestRoute, AdminRoute } from './components/ProtectedRoute';

import Login          from './pages/auth/Login';
import Signup         from './pages/auth/Signup';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword  from './pages/auth/ResetPassword';
import Dashboard from './pages/Dashboard';
import Generator from './pages/Generator';
import History   from './pages/History';
import Pricing   from './pages/Pricing';
import Account   from './pages/Account';
import Templates      from './pages/Templates';
import Collections from './pages/Collections';
import SharedContent from './pages/SharedContent';
import Admin     from './pages/Admin';

export default function App() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      {user && <Navbar />}

      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route path="/login"           element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/signup"          element={<GuestRoute><Signup /></GuestRoute>} />
        <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
        <Route path="/reset-password"  element={<GuestRoute><ResetPassword /></GuestRoute>} />
        <Route path="/oauth-callback"   element={<Navigate to="/login" replace />} />

        <Route path="/dashboard"  element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/generate"   element={<ProtectedRoute><Generator /></ProtectedRoute>} />
        <Route path="/history"    element={<ProtectedRoute><History /></ProtectedRoute>} />
        <Route path="/templates"  element={<ProtectedRoute><Templates /></ProtectedRoute>} />
        <Route path="/account"    element={<ProtectedRoute><Account /></ProtectedRoute>} />
        <Route path="/collections" element={<ProtectedRoute><Collections /></ProtectedRoute>} />
        <Route path="/pricing"    element={<Pricing />} />
        <Route path="/share/:token" element={<SharedContent />} />
        <Route path="/admin"      element={<AdminRoute><Admin /></AdminRoute>} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  );
}
