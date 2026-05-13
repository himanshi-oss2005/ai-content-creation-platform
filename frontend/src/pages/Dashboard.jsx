import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { contentApi } from '../api/content';
import { useAuth } from '../context/AuthContext';
import { typeIcon, typeLabel, CONTENT_TYPES } from '../utils/contentTypes';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

function SkeletonCard() {
  return (
    <div className="card p-5 space-y-3">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse" />
    </div>
  );
}

/** Minimal bar chart — no external library */
function BarChart({ data, height = 80, color = 'bg-primary-500', hoverColor = 'bg-primary-400' }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group">
          <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium leading-none">
            {d.count}
          </span>
          <div
            className={`w-full rounded-t-sm ${color} hover:${hoverColor} cursor-default transition-all duration-500`}
            style={{ height: `${Math.max((d.count / max) * (height - 16), d.count > 0 ? 4 : 0)}px` }}
          />
          <span className="text-[10px] text-gray-400 leading-none">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    contentApi.getStats().then(setStats).finally(() => setLoading(false));
  }, []);

  const firstName    = user?.name?.split(' ')[0] ?? 'there';
  const usagePercent = stats ? Math.round((stats.creditsUsedToday / stats.dailyLimit) * 100) : 0;

  const creditSegments = useMemo(() => {
    if (!stats) return [];
    const filled = Math.round((stats.creditsUsedToday / stats.dailyLimit) * 10);
    return Array.from({ length: 10 }, (_, i) => i < filled);
  }, [stats]);

  // 7-day generation chart
  const weeklyChartData = useMemo(() => {
    if (!stats) return [];
    const map = new Map(stats.weeklyUsage.map((d) => [d._id, d.count]));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().split('T')[0];
      return { label: DAYS[d.getDay()], count: map.get(key) ?? 0 };
    });
  }, [stats]);

  // 30-day credits chart
  const creditsChartData = useMemo(() => {
    if (!stats?.dailyCreditsUsed) return [];
    const map = new Map(stats.dailyCreditsUsed.map((d) => [d._id, d.count]));
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      const key = d.toISOString().split('T')[0];
      const label = i % 7 === 0 ? DAYS[d.getDay()] : '';
      return { label, count: map.get(key) ?? 0 };
    });
  }, [stats]);

  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      { icon: '📄', label: 'Total Content',    value: stats.totalContent,    badge: 'All time', badgeClass: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
      { icon: '⚡', label: 'Used Today',        value: stats.creditsUsedToday, badge: `of ${stats.dailyLimit}`, badgeClass: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
      { icon: '🚀', label: 'Total Generations', value: stats.totalGenerations, badge: 'Lifetime', badgeClass: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-900/20' },
      { icon: '👑', label: 'Current Plan',      value: stats.role === 'premium' ? 'Premium' : 'Free', badge: stats.role === 'premium' ? '✓ Active' : 'Upgrade', badgeClass: stats.role === 'premium' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    ];
  }, [stats]);

  const segColor = usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-amber-500' : 'bg-primary-500';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Good {getGreeting()}, {firstName}! 👋
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-0.5 text-sm">
            Here's your content overview for today
          </p>
        </div>
        <Link to="/generate" className="btn-primary text-sm">✨ New Content</Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : stats && (
        <>
          {/* Premium upgrade banner */}
          {stats.role === 'free' && (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-accent-600 via-purple-600 to-primary-600 p-5 text-white">
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                }}
              />
              <div className="relative flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-bold text-lg">🚀 Unlock Premium — 100 generations/day</p>
                  <p className="text-white/80 text-sm mt-0.5">
                    Free plan: {stats.creditsUsedToday}/{stats.dailyLimit} used today
                  </p>
                </div>
                <Link
                  to="/pricing"
                  className="shrink-0 px-5 py-2.5 bg-white text-accent-600 font-bold rounded-xl hover:bg-gray-50 transition-colors text-sm shadow-md"
                >
                  Upgrade Now →
                </Link>
              </div>
            </div>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {statCards.map((s) => (
              <div key={s.label} className="card p-4 sm:p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-lg sm:text-xl ${s.bg}`}>
                    {s.icon}
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${s.badgeClass}`}>
                    {s.badge}
                  </span>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{s.value}</p>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Most-used type callout */}
          {stats.mostUsedType && (
            <div className="card p-4 flex items-center gap-4 bg-gradient-to-r from-primary-50 to-accent-50 dark:from-primary-900/10 dark:to-accent-900/10 border-primary-100 dark:border-primary-900/30">
              <div className="w-12 h-12 rounded-2xl bg-white dark:bg-gray-800 flex items-center justify-center text-2xl shadow-sm shrink-0">
                {typeIcon(stats.mostUsedType)}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Most Generated
                </p>
                <p className="font-bold text-gray-900 dark:text-white">
                  {typeLabel(stats.mostUsedType)}
                </p>
              </div>
              <Link
                to={`/generate?type=${stats.mostUsedType}`}
                className="ml-auto btn-primary text-sm py-2 px-4 shrink-0"
              >
                Generate →
              </Link>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Credits */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-white">Daily Credits</h2>
                <span className={stats.role === 'premium' ? 'badge-premium' : 'badge-free'}>
                  {stats.role}
                </span>
              </div>
              <div className="flex items-end gap-2 mb-3">
                <span className="text-4xl font-bold text-gray-900 dark:text-white">
                  {stats.creditsUsedToday}
                </span>
                <span className="text-gray-400 dark:text-gray-500 mb-1 text-lg">
                  / {stats.dailyLimit}
                </span>
              </div>
              <div className="flex gap-0.5 mb-3">
                {creditSegments.map((filled, i) => (
                  <div
                    key={i}
                    className={`h-2.5 flex-1 rounded-sm transition-all duration-500 ${
                      filled ? segColor : 'bg-gray-100 dark:bg-gray-800'
                    }`}
                  />
                ))}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {stats.dailyLimit - stats.creditsUsedToday}
                </span>{' '}
                credits remaining today
              </p>
              {stats.role === 'free' && (
                <Link to="/pricing" className="btn-accent w-full mt-4 text-sm py-2.5">
                  ⚡ Upgrade to Premium
                </Link>
              )}
            </div>

            {/* 7-day activity chart */}
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-4">7-Day Activity</h2>
              {stats.weeklyUsage.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-24 text-gray-400 text-sm">
                  <span className="text-3xl mb-2">📈</span>
                  Start generating to see activity
                </div>
              ) : (
                <BarChart data={weeklyChartData} height={96} />
              )}
            </div>

            {/* Content breakdown */}
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Content Breakdown</h2>
              {stats.byType.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-24 text-gray-400 text-sm">
                  <span className="text-3xl mb-2">📊</span>No content yet
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.byType.map((item) => (
                    <div key={item._id} className="flex items-center gap-3">
                      <span className="text-lg w-6 text-center">{typeIcon(item._id)}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="capitalize text-gray-700 dark:text-gray-300">
                            {typeLabel(item._id)}
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {item.count}
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                          <div
                            className="bg-gradient-to-r from-primary-500 to-accent-500 h-1.5 rounded-full transition-all duration-700"
                            style={{ width: `${(item.count / stats.totalContent) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 14-day credits chart */}
          {creditsChartData.some((d) => d.count > 0) && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Credits Used — Last 14 Days</h2>
              <p className="text-xs text-gray-400 mb-4">Daily credit consumption trend</p>
              <BarChart
                data={creditsChartData}
                height={80}
                color="bg-accent-500"
                hoverColor="bg-accent-400"
              />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent activity */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
                <Link
                  to="/history"
                  className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium"
                >
                  View all →
                </Link>
              </div>
              {stats.recentActivity.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <span className="text-4xl mb-3">🌱</span>
                  <p className="text-gray-400 text-sm mb-4">No content yet. Start generating!</p>
                  <Link to="/generate" className="btn-primary text-sm py-2">✨ Generate Now</Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {stats.recentActivity.map((item, i) => (
                    <Link
                      key={i}
                      to="/history"
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition-transform">
                        {typeIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                          {item.prompt}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 capitalize">
                          {typeLabel(item.type)}
                        </p>
                      </div>
                      <span className="text-xs text-gray-300 dark:text-gray-600 shrink-0">→</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Quick generate */}
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Quick Generate</h2>
              <div className="grid grid-cols-3 gap-3">
                {CONTENT_TYPES.map((type) => (
                  <Link
                    key={type.value}
                    to={`/generate?type=${type.value}`}
                    className="flex flex-col items-center gap-2 p-3 sm:p-4 bg-gray-50 dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 border border-transparent hover:border-primary-200 dark:hover:border-primary-800 rounded-xl transition-all duration-200 group"
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                      {type.icon}
                    </span>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400 text-center leading-tight">
                      {type.label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
