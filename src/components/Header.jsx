import { useAuth } from '../context/AuthContext';

export function Header({ view, onViewChange }) {
  const { user, logout } = useAuth();
  const display = user?.handicapDisplay;
  const hcpLine =
    !display || display === '—'
      ? ''
      : display === 'Not yet established'
        ? ' · Handicap not yet established'
        : ` · HCP ${display}`;

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <span className="app-header__title">The Colorado Golf Tour</span>
        <span className="app-header__subtitle">
          {user?.displayName || user?.username}
          {hcpLine} · {user?.email}
        </span>
        <button type="button" className="app-header__logout" onClick={() => logout()}>
          Log out
        </button>
      </div>
      <div className="segmented" role="tablist" aria-label="View mode">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'tour'}
          className={view === 'tour' ? 'segmented__btn is-active' : 'segmented__btn'}
          onClick={() => onViewChange('tour')}
        >
          Tour
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'list'}
          className={view === 'list' ? 'segmented__btn is-active' : 'segmented__btn'}
          onClick={() => onViewChange('list')}
        >
          Course List
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'map'}
          className={view === 'map' ? 'segmented__btn is-active' : 'segmented__btn'}
          onClick={() => onViewChange('map')}
        >
          Course Map
        </button>
      </div>
    </header>
  );
}
