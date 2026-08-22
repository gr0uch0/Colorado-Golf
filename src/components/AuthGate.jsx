import { useState } from 'react';
import { requestPasswordReset } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function AuthGate() {
  const { login, setError, error } = useAuth();
  const [mode, setMode] = useState('login');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [forgotEmail, setForgotEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotDevPassword, setForgotDevPassword] = useState('');

  const showError = localError || error;

  const switchToLogin = () => {
    setMode('login');
    setLocalError('');
    setForgotSuccess('');
    setForgotDevPassword('');
    setError(null);
  };

  const switchToForgot = () => {
    setMode('forgot');
    setLocalError('');
    setForgotSuccess('');
    setForgotDevPassword('');
    setError(null);
    setForgotEmail(loginForm.email);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLocalError('');
    setError(null);
    setSubmitting(true);
    try {
      await login(loginForm.email.trim(), loginForm.password.trim());
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setLocalError('');
    setForgotSuccess('');
    setForgotDevPassword('');
    setError(null);
    setSubmitting(true);
    try {
      const data = await requestPasswordReset(forgotEmail.trim());
      setForgotSuccess(data.message || 'Check your email for a temporary password.');
      setForgotDevPassword(data.temporaryPassword || '');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-gate">
      <div className="auth-gate__card">
        <h1 className="auth-gate__title">The Colorado Golf Tour</h1>

        {mode === 'login' ? (
          <>
            <p className="auth-gate__subtitle">
              Log in with the email and password provided by your tour admin.
            </p>

            {showError && (
              <p className="auth-gate__error" role="alert">
                {showError}
              </p>
            )}

            <form className="auth-gate__form" onSubmit={handleLogin}>
              <label className="auth-gate__field">
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={loginForm.email}
                  onChange={(e) =>
                    setLoginForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </label>
              <label className="auth-gate__field">
                <span>Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={loginForm.password}
                  onChange={(e) =>
                    setLoginForm((f) => ({ ...f, password: e.target.value }))
                  }
                />
              </label>
              <button type="submit" className="auth-gate__submit" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Log in'}
              </button>
            </form>

            <button type="button" className="auth-gate__link" onClick={switchToForgot}>
              Forgot password?
            </button>
          </>
        ) : (
          <>
            <p className="auth-gate__subtitle">
              Enter your account email. We will send a temporary password; you must set a
              new password when you log in.
            </p>

            {showError && (
              <p className="auth-gate__error" role="alert">
                {showError}
              </p>
            )}
            {forgotSuccess && (
              <div className="auth-gate__success" role="status">
                <p>{forgotSuccess}</p>
                {forgotDevPassword && (
                  <div className="auth-gate__dev-password">
                    <span>Temporary password:</span>
                    <code className="auth-gate__dev-password-value">{forgotDevPassword}</code>
                    <button
                      type="button"
                      className="auth-gate__copy-btn"
                      onClick={() => {
                        navigator.clipboard?.writeText(forgotDevPassword);
                      }}
                    >
                      Copy
                    </button>
                  </div>
                )}
              </div>
            )}

            <form className="auth-gate__form" onSubmit={handleForgot}>
              <label className="auth-gate__field">
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                />
              </label>
              <button type="submit" className="auth-gate__submit" disabled={submitting}>
                {submitting ? 'Sending…' : 'Email temporary password'}
              </button>
            </form>

            <button type="button" className="auth-gate__link" onClick={switchToLogin}>
              Back to log in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
