import { useEffect, useState } from 'react';
import { fetchSetupStatus, requestPasswordReset } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function AuthGate() {
  const { login, completeSetup, setError, error } = useAuth();
  const [mode, setMode] = useState('login');
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupChecked, setSetupChecked] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [setupForm, setSetupForm] = useState({
    displayName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [forgotEmail, setForgotEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotDevPassword, setForgotDevPassword] = useState('');

  const showError = localError || error;

  useEffect(() => {
    let cancelled = false;
    fetchSetupStatus()
      .then((data) => {
        if (cancelled) return;
        const setup = Boolean(data.needsSetup);
        setNeedsSetup(setup);
        if (setup) setMode('setup');
      })
      .catch(() => {
        if (!cancelled) setNeedsSetup(false);
      })
      .finally(() => {
        if (!cancelled) setSetupChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const handleSetup = async (e) => {
    e.preventDefault();
    setLocalError('');
    setError(null);
    if (setupForm.password !== setupForm.confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await completeSetup({
        displayName: setupForm.displayName.trim(),
        username: setupForm.username.trim(),
        email: setupForm.email.trim(),
        password: setupForm.password,
        isAdmin: true,
      });
      setNeedsSetup(false);
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

  if (!setupChecked) {
    return (
      <div className="auth-gate">
        <div className="auth-gate__card">
          <h1 className="auth-gate__title">The Colorado Golf Tour</h1>
          <p className="auth-gate__subtitle">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-gate">
      <div className="auth-gate__card">
        <h1 className="auth-gate__title">The Colorado Golf Tour</h1>

        {mode === 'setup' ? (
          <>
            <p className="auth-gate__subtitle">
              No accounts exist on this server yet. Create the first tour admin account
              to get started.
            </p>

            {showError && (
              <p className="auth-gate__error" role="alert">
                {showError}
              </p>
            )}

            <form className="auth-gate__form" onSubmit={handleSetup}>
              <label className="auth-gate__field">
                <span>Full name</span>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  value={setupForm.displayName}
                  onChange={(e) =>
                    setSetupForm((f) => ({ ...f, displayName: e.target.value }))
                  }
                />
              </label>
              <label className="auth-gate__field">
                <span>Username</span>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={32}
                  autoComplete="username"
                  value={setupForm.username}
                  onChange={(e) =>
                    setSetupForm((f) => ({ ...f, username: e.target.value }))
                  }
                />
              </label>
              <label className="auth-gate__field">
                <span>Email</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={setupForm.email}
                  onChange={(e) =>
                    setSetupForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </label>
              <label className="auth-gate__field">
                <span>Password</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={setupForm.password}
                  onChange={(e) =>
                    setSetupForm((f) => ({ ...f, password: e.target.value }))
                  }
                />
              </label>
              <label className="auth-gate__field">
                <span>Confirm password</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={setupForm.confirmPassword}
                  onChange={(e) =>
                    setSetupForm((f) => ({ ...f, confirmPassword: e.target.value }))
                  }
                />
              </label>
              <button type="submit" className="auth-gate__submit" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create admin account'}
              </button>
            </form>
          </>
        ) : mode === 'login' ? (
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
            {needsSetup && (
              <button
                type="button"
                className="auth-gate__link"
                onClick={() => {
                  setMode('setup');
                  setLocalError('');
                  setError(null);
                }}
              >
                Create first admin account
              </button>
            )}
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
