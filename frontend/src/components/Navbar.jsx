import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const NAV_LINKS = [
  { to: '/dashboard',   label: 'Dashboard',   icon: '📊' },
  { to: '/generate',    label: 'Generate',    icon: '✨' },
  { to: '/templates',   label: 'Templates',   icon: '📋' },
  { to: '/history',     label: 'History',     icon: '📚' },
  { to: '/collections', label: 'Collections', icon: '📁' },
  { to: '/pricing',     label: 'Pricing',     icon: '💎' },
  { to: '/account',     label: 'Account',     icon: '👤' },
];

const linkClass = ({ isActive }) =>
  `flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
    isActive
      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-semibold'
      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
  }`;

export default function Navbar() {
  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const dailyLimit = user?.role === 'premium'
    ? (parseInt(import.meta.env.VITE_PREMIUM_DAILY_CREDITS) || 100)
    : (parseInt(import.meta.env.VITE_FREE_DAILY_CREDITS) || 10);

  return (
    <nav className="sticky top-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-b border-gray-100 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">
              W
            </div>
            <span className="font-bold text-lg text-gray-900 dark:text-white">
              WriteGen <span className="gradient-text">AI</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className={linkClass}>
                <span>{l.icon}</span>{l.label}
              </NavLink>
            ))}
            {user?.role === 'admin' && (
              <NavLink to="/admin" className={linkClass}>
                <span>🛡️</span>Admin
              </NavLink>
            )}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {user && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm">
                <span className="text-amber-500">⚡</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {user.creditsUsedToday}/{dailyLimit}
                </span>
                <span className={user.role === 'premium' ? 'badge-premium' : 'badge-free'}>
                  {user.role}
                </span>
              </div>
            )}

            <button
              onClick={toggle}
              title="Toggle theme"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {isDark ? '☀️' : '🌙'}
            </button>

            <button
              onClick={logout}
              className="hidden sm:flex btn-secondary text-sm py-1.5 px-3"
            >
              Sign out
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <span className="text-gray-600 dark:text-gray-300 text-lg">
                {mobileOpen ? '✕' : '☰'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 space-y-1 animate-fade-in">
          {NAV_LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`
              }
            >
              <span>{l.icon}</span>{l.label}
            </NavLink>
          ))}
          {user?.role === 'admin' && (
            <NavLink
              to="/admin"
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`
              }
            >
              <span>🛡️</span>Admin
            </NavLink>
          )}
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            🚪 Sign out
          </button>
        </div>
      )}
    </nav>
  );
}
