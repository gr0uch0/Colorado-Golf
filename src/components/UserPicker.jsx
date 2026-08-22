import { useUser } from '../context/UserContext';

export function UserPicker() {
  const { users, currentUser, setCurrentUser } = useUser();

  return (
    <div className="user-picker">
      <label className="user-picker__label" htmlFor="cg-user-select">
        Playing as
      </label>
      <select
        id="cg-user-select"
        className="user-picker__select"
        value={currentUser ?? ''}
        onChange={(e) => setCurrentUser(e.target.value || null)}
      >
        <option value="">Choose your name…</option>
        {users.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
      <p className="user-picker__hint">
        Everyone in the group can see each other&apos;s played courses and custom additions.
      </p>
    </div>
  );
}
