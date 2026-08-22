import { useState } from 'react';
import { AdminCreateUser } from './AdminCreateUser';
import { AdminEditUser } from './AdminEditUser';

export function AdminUserManagement({ onUsersChanged }) {
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const [editPlayerOpen, setEditPlayerOpen] = useState(false);

  const bump = () => {
    onUsersChanged?.();
  };

  return (
    <div className="admin-users">
      <section className="admin-approvals" aria-label="Player management">
        <div className="admin-users__toolbar">
          <h2 className="admin-approvals__title">Players</h2>
          <div className="admin-users__actions">
            <button
              type="button"
              className="admin-users__action-btn admin-users__action-btn--primary"
              onClick={() => setAddPlayerOpen(true)}
            >
              Add player
            </button>
            <button
              type="button"
              className="admin-users__action-btn"
              onClick={() => setEditPlayerOpen(true)}
            >
              Edit player
            </button>
          </div>
        </div>
        <p className="admin-approvals__hint">
          Create and edit accounts for tour members. Only admins can manage players.
        </p>
      </section>
      <AdminCreateUser
        open={addPlayerOpen}
        onClose={() => setAddPlayerOpen(false)}
        onCreated={bump}
      />
      <AdminEditUser
        open={editPlayerOpen}
        onClose={() => setEditPlayerOpen(false)}
        onUpdated={bump}
      />
    </div>
  );
}
