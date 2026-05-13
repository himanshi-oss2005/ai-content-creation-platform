import { useState, useEffect, useCallback, useRef } from 'react';
import { adminApi } from '../api/content';
import { useToast } from '../context/ToastContext';

function StatCard({ icon, label, value, sub, color = 'bg-blue-50 dark:bg-blue-900/20' }) {
  return (
    <div className="card p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3 ${color}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value ?? '—'}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function RoleBadge({ role }) {
  const cls = {
    admin:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    premium: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    free:    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  }[role] ?? 'bg-gray-100 text-gray-600';
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{role}</span>;
}

export default function Admin() {
  const toast = useToast();
  const [stats,     setStats]     = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [users,     setUsers]     = useState([]);
  const [total,     setTotal]     = useState(0);
  const [pages,     setPages]     = useState(1);
  const [page,      setPage]      = useState(1);
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(true);
  const [roleLoading, setRoleLoading] = useState(null);

  useEffect(() => {
    Promise.all([adminApi.getStats(), adminApi.getAnalytics()])
      .then(([s, a]) => { setStats(s); setAnalytics(a); })
      .catch(() => toast.error('Failed to load admin stats'))
      .finally(() => setLoading(false));
  }, [toast]);

  const debounceRef = useRef(null);

  const fetchUsers = useCallback((overrideSearch) => {
    const q = overrideSearch !== undefined ? overrideSearch : search;
    adminApi.getUsers({ page, limit: 20, search: q })
      .then(({ users, total, pages }) => { setUsers(users); setTotal(total); setPages(pages); })
      .catch(() => toast.error('Failed to load users'));
  }, [page, search, toast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    setPage(1);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchUsers(val), 400);
  };

  const handleRoleChange = async (userId, role) => {
    setRoleLoading(userId);
    try {
      const { user: updated } = await adminApi.updateUserRole(userId, role);
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, role: updated.role } : u));
      toast.success(`Role updated to ${role}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRoleLoading(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Platform overview &amp; user management</p>
      </div>

      {/* Platform Stats */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="card p-5 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
            </div>
          ))}
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon="👥" label="Total Users"    value={stats.totalUsers}   color="bg-blue-50 dark:bg-blue-900/20" />
          <StatCard icon="👑" label="Premium Users"  value={stats.premiumUsers} sub={`${stats.freeUsers} free`} color="bg-purple-50 dark:bg-purple-900/20" />
          <StatCard icon="📄" label="Total Content"  value={stats.totalContent} color="bg-green-50 dark:bg-green-900/20" />
          <StatCard icon="⚡" label="Requests/min"   value={analytics?.requestsPerMinute ?? 0} sub="Real-time" color="bg-amber-50 dark:bg-amber-900/20" />
        </div>
      )}

      {/* Analytics */}
      {analytics && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Real-time Analytics</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Requests',    value: analytics.totalRequests },
              { label: 'Requests / min',    value: analytics.requestsPerMinute },
              { label: 'Avg Response (ms)', value: analytics.avgResponseTime ? Math.round(analytics.avgResponseTime) : '—' },
              { label: 'Error Rate',        value: analytics.errorRate != null ? `${(analytics.errorRate * 100).toFixed(1)}%` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center">
                <p className="text-xl font-bold text-gray-900 dark:text-white">{value ?? '—'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Source breakdown */}
          {stats?.sourceBreakdown?.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Content by Source</p>
              <div className="flex flex-wrap gap-2">
                {stats.sourceBreakdown.map(({ _id, count }) => (
                  <span key={_id} className="px-3 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium">
                    {_id}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* User Management */}
      <div className="card p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">User Management</h2>
            <p className="text-xs text-gray-400 mt-0.5">{total} total users</p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder="Search name or email…"
              className="input-field text-sm py-2 w-56"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-left">
                <th className="pb-3 font-medium text-gray-500 dark:text-gray-400">User</th>
                <th className="pb-3 font-medium text-gray-500 dark:text-gray-400">Role</th>
                <th className="pb-3 font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">Credits Today</th>
                <th className="pb-3 font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">Joined</th>
                <th className="pb-3 font-medium text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {users.map(u => (
                <tr key={u._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-gray-900 dark:text-white truncate max-w-[160px]">{u.name}</p>
                    <p className="text-xs text-gray-400 truncate max-w-[160px]">{u.email}</p>
                  </td>
                  <td className="py-3 pr-4"><RoleBadge role={u.role} /></td>
                  <td className="py-3 pr-4 hidden sm:table-cell text-gray-600 dark:text-gray-400">
                    {u.creditsUsedToday ?? 0} / {u.dailyLimit ?? (u.role === 'premium' ? 100 : 10)}
                  </td>
                  <td className="py-3 pr-4 hidden md:table-cell text-gray-400">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3">
                    {u.role !== 'admin' && (
                      <select
                        disabled={roleLoading === u._id}
                        value={u.role}
                        onChange={e => handleRoleChange(u._id, e.target.value)}
                        className="text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                      >
                        <option value="free">free</option>
                        <option value="premium">premium</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-gray-400">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-400">Page {page} of {pages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40"
              >← Prev</button>
              <button
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40"
              >Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
