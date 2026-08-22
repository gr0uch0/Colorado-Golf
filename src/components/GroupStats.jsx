import { useState } from 'react';
import { calcCourseHandicap, formatCourseHandicap, resolveCourseRatingFields } from '../utils/courseHandicap';
import { handicapLabel } from '../utils/handicap';
import { PlayerTourDetail } from './PlayerTourDetail';

function avgCourseHandicapForUser(username, progressByUser, coursesById) {
  const map = progressByUser[username] || {};
  const values = [];
  for (const [courseId, prog] of Object.entries(map)) {
    if (!prog?.played) continue;
    let ch = prog.courseHandicap;
    if (ch == null && prog.handicapIndex != null && coursesById[courseId]) {
      const course = coursesById[courseId];
      if (!course.hasWhsRatings) continue;
      const rating = resolveCourseRatingFields(course);
      ch = calcCourseHandicap(
        prog.handicapIndex,
        rating.slopeRating,
        rating.courseRating,
        rating.par
      );
    }
    if (ch != null) values.push(ch);
  }
  if (!values.length) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export function GroupStats({ members, progressByUser, courses, total, handicapByUser }) {
  const [selectedUsername, setSelectedUsername] = useState(null);
  const coursesById = Object.fromEntries((courses || []).map((c) => [c.id, c]));

  const rows = members
    .map((m) => {
      const username = typeof m === 'string' ? m : m.username;
      const displayName = typeof m === 'string' ? m : m.displayName || m.username;
      const map = progressByUser[username] || {};
      const played = Object.values(map).filter((p) => p?.played).length;
      const percent = total ? Math.round((played / total) * 100) : 0;
      const hcap = handicapByUser?.[username];
      const indexHcp =
        hcap?.handicapDisplay ??
        (typeof m === 'string' ? null : handicapLabel(m.handicap, m.handicapDisplay));
      const avgCh = avgCourseHandicapForUser(username, progressByUser, coursesById);
      const avgChDisplay = formatCourseHandicap(hcap?.courseHandicap ?? avgCh);
      return {
        username,
        displayName,
        played,
        percent,
        indexHcp,
        avgChDisplay,
        established: Boolean(hcap?.established),
        softCapApplied: Boolean(hcap?.softCapApplied),
        hardCapApplied: Boolean(hcap?.hardCapApplied),
        exceptionalScoreApplied: Boolean(hcap?.exceptionalScoreApplied),
        handicap: hcap,
      };
    })
    .sort(
      (a, b) =>
        b.played - a.played ||
        a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
    );

  const selectedPlayer = rows.find((row) => row.username === selectedUsername) ?? null;

  const handlePlayerClick = (username) => {
    setSelectedUsername(username);
  };

  const handleCloseDetail = () => {
    setSelectedUsername(null);
  };

  return (
    <section className="group-stats" aria-label="Group progress">
      <h2 className="group-stats__title">Tour group</h2>
      <p className="group-stats__hint">
        Index is each player&apos;s WHS Handicap Index (3 rounds to establish).
        CH is course handicap on their most-played rated course.
        Tap a player to see which rounds count.
      </p>
      <ul className="group-stats__list">
        {rows.map((r) => {
          const selected = selectedUsername === r.username;
          return (
            <li key={r.username}>
              <button
                type="button"
                className={
                  selected
                    ? 'group-stats__row group-stats__row--selected'
                    : 'group-stats__row'
                }
                aria-haspopup="dialog"
                onClick={() => handlePlayerClick(r.username)}
              >
                <span className="group-stats__name-wrap">
                  <span className="group-stats__name">{r.displayName}</span>
                  <span className="group-stats__hcp" title="Handicap index · course handicap">
                    {r.indexHcp && r.indexHcp !== '—'
                      ? `Index ${r.indexHcp}`
                      : 'Index not yet established'}
                    {r.avgChDisplay && r.played > 0 ? ` · CH ${r.avgChDisplay}` : ''}
                  </span>
                  {(r.softCapApplied || r.hardCapApplied || r.exceptionalScoreApplied) && (
                    <span className="group-stats__flags">
                      {r.exceptionalScoreApplied ? (
                        <span className="hcp-flag hcp-flag--esr">Exceptional score</span>
                      ) : null}
                      {r.softCapApplied ? (
                        <span className="hcp-flag hcp-flag--soft">Soft cap</span>
                      ) : null}
                      {r.hardCapApplied ? (
                        <span className="hcp-flag hcp-flag--hard">Hard cap</span>
                      ) : null}
                    </span>
                  )}
                </span>
                <span className="group-stats__bar-wrap" aria-hidden>
                  <span
                    className="group-stats__bar"
                    style={{ width: `${r.percent}%` }}
                  />
                </span>
                <span className="group-stats__nums">
                  {r.played}/{total} ({r.percent}%)
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <PlayerTourDetail
        open={Boolean(selectedPlayer)}
        onClose={handleCloseDetail}
        displayName={selectedPlayer?.displayName ?? ''}
        username={selectedPlayer?.username ?? ''}
        indexHcp={selectedPlayer?.indexHcp ?? null}
        avgChDisplay={selectedPlayer?.avgChDisplay ?? null}
        played={selectedPlayer?.played ?? 0}
        courses={courses}
        progressByUser={progressByUser}
        handicap={selectedPlayer?.handicap ?? null}
      />
    </section>
  );
}
