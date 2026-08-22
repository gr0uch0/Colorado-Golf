import { useCallback, useEffect, useState } from 'react';
import { adminUpdateUser, fetchAdminUsers, fetchState } from '../api/client';

const emptyForm = {
  username: '',
  displayName: '',
  email: '',
  password: '',
  confirmPassword: '',
  isAdmin: false,
  handicap: '',
};

export function AdminEditUser({ open, onClose, onUpdated }) {
  const [players, setPlayers] = useState([]);
  const [selected, setSelected] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let users = [];
      try {
        const data = await fetchAdminUsers();
        users = data.users || [];
      } catch {
        const state = await fetchState();
        users = state.players || [];
      }
      setPlayers(users);
      if (!users.length) {
        setError('No players found. Restart the API server if you recently updated the app.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setSelected('');
    setForm(emptyForm);
    setError('');
    loadPlayers();
  }, [open, loadPlayers]);

  useEffect(() => {
    if (!selected) {
      setForm(emptyForm);
      return;
    }
    const player = players.find((p) => p.username === selected);
    if (!player) return;
    setForm({
      username: player.username,
      displayName: player.displayName,
      email: player.email,
      password: '',
      confirmPassword: '',
      isAdmin: Boolean(player.isAdmin),
      handicap:
        player.handicapDisplay ??
        (player.handicap != null ? String(player.handicap) : ''),
    });
    setError('');
  }, [selected, players]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setError('');
    if (!selected) {
      setError('Select a player to edit.');
      return;
    }
    const nextPassword = form.password.trim();
    if (nextPassword) {
      if (nextPassword.length < 8) {
        setError('New password must be at least 8 characters.');
        return;
      }
      if (nextPassword !== form.confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    } else if (form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        isAdmin: form.isAdmin,
        handicap: form.handicap.trim() || null,
      };
      if (nextPassword) payload.password = nextPassword;
      await adminUpdateUser(selected, payload);
      // Close first so a refresh callback cannot keep the dialog open.
      onClose();
      onUpdated?.();
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
        aria-labelledby="edit-player-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <h2 id="edit-player-title" className="modal__title">
            Edit player
          </h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="modal__intro">
          Update a tour member&apos;s account details. Leave password blank to keep their current password.
        </p>
        <form className="modal__form" onSubmit={handleSubmit}>
          {error && <p className="modal__error">{error}</p>}
          <label className="modal__field">
            <span className="modal__label">Player</span>
            <select
              className="modal__input"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={loading}
              required
            >
              <option value="">
                {loading ? 'Loading players…' : 'Select a player…'}
              </option>
              {players.map((p) => (
                <option key={p.username} value={p.username}>
                  {p.displayName} (@{p.username})
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <>
              <label className="modal__field">
                <span className="modal__label">Username (leaderboard)</span>
                <input
                  className="modal__input modal__input--readonly"
                  type="text"
                  value={form.username}
                  readOnly
                  aria-readonly="true"
                />
              </label>
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
                <span className="modal__label">USGA handicap index</span>
                <input
                  className="modal__input"
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 12.4 or +2.1 (leave blank to clear)"
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
                <span className="modal__label">New password (optional)</span>
                <input
                  className="modal__input"
                  type="password"
                  value={form.password}
                  onChange={(e) => set({ password: e.target.value })}
                  autoComplete="new-password"
                />
              </label>
              <label className="modal__field">
                <span className="modal__label">Confirm new password</span>
                <input
                  className="modal__input"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => set({ confirmPassword: e.target.value })}
                  autoComplete="new-password"
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
            </>
          )}
          <div className="modal__actions">
            <button type="button" className="modal__btn modal__btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="modal__btn"
              disabled={submitting || loading || !selected}
            >
              {submitting ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
