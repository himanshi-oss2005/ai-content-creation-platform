import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { paymentApi } from '../api/payment';

const PREMIUM_LIMIT = parseInt(import.meta.env.VITE_PREMIUM_DAILY_CREDITS) || 100;
const FREE_LIMIT    = parseInt(import.meta.env.VITE_FREE_DAILY_CREDITS)    || 10;

function TransactionBadge({ type, t }) {
  const styles = {
    purchase: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    usage:    'bg-blue-100  dark:bg-blue-900/30  text-blue-700  dark:text-blue-400',
    refund:   'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  };
  const labels = {
    purchase: '💳 ' + t('account.transaction_purchase', 'Purchase'),
    usage:    '⚡ ' + t('account.transaction_usage',    'Usage'),
    refund:   '↩️ ' + t('account.transaction_refund',   'Refund'),
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles[type] ?? styles.usage}`}>
      {labels[type] ?? type}
    </span>
  );
}

export default function Account() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const toast = useToast();

  const [name, setName]                   = useState(user?.name ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [pwForm, setPwForm]               = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwErrors, setPwErrors]           = useState({});
  const [savingPw, setSavingPw]           = useState(false);
  const [credits, setCredits]             = useState(null);
  const [transactions, setTransactions]   = useState([]);
  const [txTotal, setTxTotal]             = useState(0);
  const [txPage, setTxPage]               = useState(1);
  const [txPages, setTxPages]             = useState(1);
  const [txLoading, setTxLoading]         = useState(true);
  const [cancelling, setCancelling]       = useState(false);

  useEffect(() => { setName(user?.name ?? ''); }, [user]);

  useEffect(() => {
    api.get('/users/credits').then((r) => setCredits(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setTxLoading(true);
    api.get('/users/transactions', { params: { page: txPage, limit: 15 } })
      .then((r) => {
        setTransactions(r.data.transactions);
        setTxTotal(r.data.total);
        setTxPages(r.data.pages);
      })
      .finally(() => setTxLoading(false));
  }, [txPage]);

  async function handleSaveProfile(e) {
    e.preventDefault();
    if (!name.trim()) return toast.error(t('validation.name_required'));
    setSavingProfile(true);
    try {
      await api.patch('/users/profile', { name: name.trim() });
      await refreshUser();
      toast.success(t('account.toast_profile_updated'));
    } catch (err) {
      toast.error(err.message || t('account.toast_profile_error'));
    } finally {
      setSavingProfile(false);
    }
  }

  function validatePw() {
    const e = {};
    if (!pwForm.currentPassword)                              e.currentPassword = t('common.required');
    if (pwForm.newPassword.length < 6)                        e.newPassword     = t('validation.min_6_chars');
    if (pwForm.newPassword !== pwForm.confirmPassword)        e.confirmPassword = t('validation.passwords_mismatch');
    setPwErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (!validatePw()) return;
    setSavingPw(true);
    try {
      await api.post('/users/change-password', {
        currentPassword: pwForm.currentPassword,
        newPassword:     pwForm.newPassword,
        confirmPassword: pwForm.confirmPassword,
      });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success(t('account.toast_password_changed'));
    } catch (err) {
      toast.error(err.message || t('account.toast_password_error'));
    } finally {
      setSavingPw(false);
    }
  }

  async function handleCancel() {
    if (!confirm(t('account.cancel_confirm'))) return;
    setCancelling(true);
    try {
      await paymentApi.cancelSubscription();
      await refreshUser();
      toast.success(t('account.toast_cancelled'));
    } catch (err) {
      toast.error(err.message || t('account.toast_cancel_error'));
    } finally {
      setCancelling(false);
    }
  }

  const dailyLimit = credits?.dailyLimit ?? (user?.role === 'premium' ? PREMIUM_LIMIT : FREE_LIMIT);
  const usedToday  = credits?.creditsUsedToday ?? user?.creditsUsedToday ?? 0;
  const usagePct   = Math.round((usedToday / dailyLimit) * 100);
  const barColor   = usagePct > 80 ? 'bg-red-500' : usagePct > 50 ? 'bg-amber-500' : 'bg-primary-500';

  const pwFields = [
    { key: 'currentPassword', label: t('account.current_password') },
    { key: 'newPassword',     label: t('account.new_password') },
    { key: 'confirmPassword', label: t('account.confirm_password') },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('account.title')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-0.5 text-sm">{t('account.subtitle')}</p>
      </div>

      {/* ── Profile edit ── */}
      <div className="card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white text-2xl font-bold shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 dark:text-white text-lg truncate">{user?.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
          </div>
          <span className={user?.role === 'premium' ? 'badge-premium' : 'badge-free'}>
            {user?.role}
          </span>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white text-sm">{t('account.edit_profile')}</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('account.full_name')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="input-field"
              placeholder={t('account.name_placeholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('common.email')}
            </label>
            <input
              type="email"
              value={user?.email ?? ''}
              readOnly
              className="input-field opacity-60 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">{t('account.email_readonly')}</p>
          </div>
          <button type="submit" disabled={savingProfile} className="btn-primary py-2.5 px-5">
            {savingProfile ? <><span className="spinner" /> {t('common.saving')}</> : t('account.save_changes')}
          </button>
        </form>
      </div>

      {/* ── Change password ── */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">{t('account.change_password')}</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          {pwFields.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>
              <input
                type="password"
                value={pwForm[key]}
                onChange={(e) => { setPwForm((f) => ({ ...f, [key]: e.target.value })); setPwErrors((er) => ({ ...er, [key]: '' })); }}
                className={`input-field ${pwErrors[key] ? 'border-red-400 focus:ring-red-400' : ''}`}
                placeholder={t('common.password_placeholder')}
              />
              {pwErrors[key] && <p className="text-red-500 text-xs mt-1">{pwErrors[key]}</p>}
            </div>
          ))}
          <button type="submit" disabled={savingPw} className="btn-primary py-2.5 px-5">
            {savingPw ? <><span className="spinner" /> {t('account.updating')}</> : t('account.update_password')}
          </button>
        </form>
      </div>

      {/* ── Credits ── */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">{t('account.daily_credits')}</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">{t('account.resets_midnight')}</span>
        </div>
        <div className="flex items-end gap-2 mb-3">
          <span className="text-4xl font-bold text-gray-900 dark:text-white">{usedToday}</span>
          <span className="text-gray-400 dark:text-gray-500 mb-1 text-lg">/ {dailyLimit}</span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 mb-3">
          <div className={`h-2.5 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(usagePct, 100)}%` }} />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          <span className="font-semibold text-gray-700 dark:text-gray-300">{Math.max(0, dailyLimit - usedToday)}</span>{' '}
          {t('account.credits_remaining')}
        </p>
        {user?.role === 'free' ? (
          <Link to="/pricing" className="btn-accent text-sm py-2 px-4">{t('account.upgrade_cta')}</Link>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <span className="text-green-500">✓</span>
              <span className="text-sm font-medium text-green-700 dark:text-green-400">{t('account.premium_active')}</span>
            </div>
            <button onClick={handleCancel} disabled={cancelling} className="text-sm text-red-500 hover:text-red-600 hover:underline transition-colors disabled:opacity-50">
              {cancelling ? t('account.cancelling') : t('account.cancel_subscription')}
            </button>
          </div>
        )}
      </div>

      {/* ── Transactions ── */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-900 dark:text-white">{t('account.transaction_history')}</h2>
          <span className="text-sm text-gray-400">{txTotal} total</span>
        </div>
        {txLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                  <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                </div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-400 text-sm">{t('account.no_transactions')}</p>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              {transactions.map((tx) => (
                <div key={tx._id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 ${
                    tx.type === 'purchase' ? 'bg-green-100 dark:bg-green-900/30' :
                    tx.type === 'refund'   ? 'bg-amber-100 dark:bg-amber-900/30' :
                                            'bg-blue-100 dark:bg-blue-900/30'
                  }`}>
                    {tx.type === 'purchase' ? '💳' : tx.type === 'refund' ? '↩️' : '⚡'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{tx.description || tx.type}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <TransactionBadge type={tx.type} t={t} />
                    <span className={`text-sm font-bold tabular-nums ${tx.amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {txPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-5">
                <button onClick={() => setTxPage((p) => p - 1)} disabled={txPage === 1} className="btn-secondary py-1.5 px-3 text-sm disabled:opacity-40">{t('account.prev')}</button>
                <span className="text-sm text-gray-500 dark:text-gray-400">{txPage} / {txPages}</span>
                <button onClick={() => setTxPage((p) => p + 1)} disabled={txPage === txPages} className="btn-secondary py-1.5 px-3 text-sm disabled:opacity-40">{t('account.next')}</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
