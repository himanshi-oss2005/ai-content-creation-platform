import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../api/auth';

export default function ResetPassword() {
  const { t } = useTranslation();
  const [searchParams]        = useSearchParams();
  const navigate              = useNavigate();
  const token                 = searchParams.get('token') || '';

  const [form, setForm]       = useState({ password: '', confirm: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const passwordMismatch = form.confirm && form.password !== form.confirm;

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password !== form.confirm) return;
    if (!token) { setError(t('reset_password.missing_token_error')); return; }

    setLoading(true);
    setError('');
    try {
      await authApi.resetPassword(token, form.password);
      navigate('/login', { state: { message: 'Password reset successful. You can now log in.' } });
    } catch (err) {
      setError(err.message || t('common.error_generic'));
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-8 text-center max-w-md w-full">
          <p className="text-red-500 mb-4">{t('reset_password.invalid_token')}</p>
          <Link to="/forgot-password" className="btn-primary">{t('reset_password.request_new_link')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-3xl font-bold gradient-text">{t('reset_password.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('reset_password.subtitle')}</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('reset_password.new_password')}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder={t('reset_password.password_placeholder')}
                  minLength={6}
                  required
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('reset_password.confirm_password')}
                </label>
                <input
                  type="password"
                  value={form.confirm}
                  onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
                  placeholder={t('reset_password.confirm_placeholder')}
                  required
                  className="input-field"
                />
                {passwordMismatch && <p className="text-red-500 text-xs mt-1">{t('validation.passwords_mismatch')}</p>}
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !form.password || !form.confirm || !!passwordMismatch}
                className="btn-primary w-full py-3"
              >
                {loading && <span className="spinner" />}
                {loading ? t('reset_password.submitting') : t('reset_password.submit')}
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            <Link to="/login" className="text-primary-600 dark:text-primary-400 font-semibold hover:underline">
              {t('common.back_to_signin')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
