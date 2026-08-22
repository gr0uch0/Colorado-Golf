import { useEffect, useState } from 'react';
import { adminCreateUser } from '../api/client';

const empty = {
  displayName: '',
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  isAdmin: false,
  handicap: '',
};

export function AdminCreateUser({ open, onClose, onCreated }) {
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(empty);
  }, [open]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await adminCreateUser({
        displayName: form.displayName.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        isAdmin: form.isAdmin,
        handicap: form.handicap.trim() || null,
      });
      onCreated?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-player-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <h2 id="add-player-title" className="modal__title">
            Add player
          </h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="modal__intro">
          Create an account for a tour member. Share the email and password with them so they can log in.
        </p>
        <form className="modal__form" onSubmit={handleSubmit}>
          {error && <p className="modal__error">{error}</p>}
          <label className="modal__field">
            <span className="modal__label">Full name</span>
            <input
              className="modal__input"
              type="text"
              required
              value={form.displayName}
              onChange={(e) => set({ displayName: e.target.value })}
            />
          </label>
          <label className="modal__field">
            <span className="modal__label">Username (leaderboard)</span>
            <input
              className="modal__input"
              type="text"
              required
              minLength={2}
              maxLength={32}
              value={form.username}
              onChange={(e) => set({ username: e.target.value })}
            />
          </label>
          <label className="modal__field">
            <span className="modal__label">USGA handicap index</span>
            <input
              className="modal__input"
              type="text"
              inputMode="decimal"
              placeholder="e.g. 12.4 or +2.1"
              value={form.handicap}
              onChange={(e) => set({ handicap: e.target.value })}
            />
          </label>
          <label className="modal__field">
            <span className="modal__label">Email</span>
            <input
              className="modal__input"
              type="email"
              required
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
            />
          </label>
          <label className="modal__field">
            <span className="modal__label">Password (min. 8 characters)</span>
            <input
              className="modal__input"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => set({ password: e.target.value })}
            />
          </label>
          <label className="modal__field">
            <span className="modal__label">Confirm password</span>
            <input
              className="modal__input"
              type="password"
              required
              value={form.confirmPassword}
              onChange={(e) => set({ confirmPassword: e.target.value })}
            />
          </label>
          <label className="modal__field modal__field--row">
            <input
              type="checkbox"
              checked={form.isAdmin}
              onChange={(e) => set({ isAdmin: e.target.checked })}
            />
            <span className="modal__label">Tour admin</span>
          </label>
          <div className="modal__actions">
            <button type="button" className="modal__btn modal__btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="modal__btn" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create player'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
