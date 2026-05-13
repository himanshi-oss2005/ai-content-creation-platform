import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const location = useLocation();
  const [form, setForm]       = useState({ email: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});
  const successMessage = location.state?.message || '';

  const touch = (field) => setTouched((prev) => ({ ...prev, [field]: true }));

  const emailInvalid    = touched.email    && !/\S+@\S+\.\S+/.test(form.email);
  const passwordInvalid = touched.password && !form.password;

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (emailInvalid || passwordInvalid || !form.email || !form.password) return;
    setLoading(true);
    setError('');
    try {
      await login(form.email, form.password);
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
          <h1 className="text-3xl font-bold gradient-text">{t('login.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('login.subtitle')}</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
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
                  placeholder={t('common.password_placeholder')}
                  className="input-field"
                />
                {passwordInvalid && <p className="text-red-500 text-xs mt-1">{t('validation.password_required')}</p>}
                <div className="text-right mt-1">
                  <Link to="/forgot-password" className="text-xs text-primary-600 dark:text-primary-400 hover:underline">
                    {t('login.forgot_password')}
                  </Link>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              {successMessage && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm">
                  {successMessage}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading && <span className="spinner" />}
                {loading ? t('login.submitting') : t('login.submit')}
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            {t('login.no_account')}{' '}
            <Link to="/signup" className="text-primary-600 dark:text-primary-400 font-semibold hover:underline">
              {t('login.signup_link')}
            </Link>
          </p>
        </div>

        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 text-center">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
            {t('login.demo_hint')}
          </p>
        </div>
      </div>
    </div>
  );
}
