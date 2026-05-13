import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

export default function Signup() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const [form, setForm]       = useState({ name: '', email: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});

  const touch = (field) => setTouched((prev) => ({ ...prev, [field]: true }));

  const nameInvalid     = touched.name     && !form.name.trim();
  const emailInvalid    = touched.email    && !/\S+@\S+\.\S+/.test(form.email);
  const passwordInvalid = touched.password && form.password.length < 6;

  const PERKS = [
    t('signup.perk_generations'),
    t('signup.perk_content_types'),
    t('signup.perk_export'),
    t('signup.perk_history'),
  ];

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true });
    if (nameInvalid || emailInvalid || passwordInvalid || !form.name || !form.email || form.password.length < 6) return;
    setLoading(true);
    setError('');
    try {
      await register(form.name, form.email, form.password);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">✍️</div>
          <h1 className="text-3xl font-bold gradient-text">{t('signup.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('signup.subtitle')}</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('common.name')}
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  onBlur={() => touch('name')}
                  placeholder={t('signup.name_placeholder')}
                  className="input-field"
                />
                {nameInvalid && <p className="text-red-500 text-xs mt-1">{t('validation.name_required')}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('common.email')}
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  onBlur={() => touch('email')}
                  placeholder={t('common.email_placeholder')}
                  className="input-field"
                />
                {emailInvalid && <p className="text-red-500 text-xs mt-1">{t('validation.email_invalid')}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('common.password')}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  onBlur={() => touch('password')}
                  placeholder={t('signup.password_placeholder')}
                  className="input-field"
                />
                {passwordInvalid && <p className="text-red-500 text-xs mt-1">{t('validation.password_min')}</p>}
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading && <span className="spinner" />}
                {loading ? t('signup.submitting') : t('signup.submit')}
              </button>
            </div>
          </form>

          <div className="mt-5 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              {t('signup.free_plan_title')}
            </p>
            <ul className="space-y-1">
              {PERKS.map((p) => (
                <li key={p} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <span className="text-green-500">✓</span> {p}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-5">
            {t('signup.has_account')}{' '}
            <Link to="/login" className="text-primary-600 dark:text-primary-400 font-semibold hover:underline">
              {t('signup.signin_link')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
