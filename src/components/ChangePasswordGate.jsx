import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function ChangePasswordGate() {
  const { changePassword, logout, user } = useAuth();
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.newPassword !== form.confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (form.newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(form.currentPassword, form.newPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-gate">
      <div className="auth-gate__card">
        <h1 className="auth-gate__title">Set your password</h1>
        <p className="auth-gate__subtitle">
          {user?.displayName
            ? `Welcome, ${user.displayName}. `
            : 'Welcome. '}
          Choose a new password before using the tour app. Use the temporary password
          from your admin to confirm your identity.
        </p>

        {error && (
          <p className="auth-gate__error" role="alert">
            {error}
          </p>
        )}

        <form className="auth-gate__form" onSubmit={handleSubmit}>
          <label className="auth-gate__field">
            <span>Current password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={form.currentPassword}
              onChange={(e) => set({ currentPassword: e.target.value })}
            />
          </label>
          <label className="auth-gate__field">
            <span>New password (min. 8 characters)</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={form.newPassword}
              onChange={(e) => set({ newPassword: e.target.value })}
            />
          </label>
          <label className="auth-gate__field">
            <span>Confirm new password</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={form.confirmPassword}
              onChange={(e) => set({ confirmPassword: e.target.value })}
            />
          </label>
          <button type="submit" className="auth-gate__submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save password'}
          </button>
        </form>

        <button
          type="button"
          className="auth-gate__link"
          onClick={() => logout()}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
