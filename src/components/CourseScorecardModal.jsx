import { useAuth } from '../context/AuthContext';
import { HOLE_COUNT_OPTIONS } from '../utils/holes';
import { defaultHolePars } from '../utils/holePars';
import { HoleParGrid } from './HoleParGrid';

export function CourseScorecardModal({
  open,
  onClose,
  course,
  readOnly = false,
  showNineSummary = true,
  nested = false,
  intro,
  players,
  scoresByPlayer,
  currentUsername,
  onSaveCourseLayout,
  onSaveCourseHoleStrokeIndex,
  onSavePlayerHoleScores,
  showHoleCountSelect = false,
}) {
  const { user } = useAuth();

  if (!open || !course) return null;

  const titleId = 'course-scorecard-title';
  const resolvedUsername = currentUsername ?? user?.username ?? null;
  const resolvedScores = scoresByPlayer ?? course.playerScoresByUser ?? {};
  const holeCount = course.holeCount ?? course.holes;

  // Always include the signed-in player on editable scorecards so scores can be
  // entered without first marking the course played in the list.
  let resolvedPlayers = players ?? course.playedByDetail ?? [];
  if (!readOnly && resolvedUsername && user) {
    const hasMe = resolvedPlayers.some((p) => p.username === resolvedUsername);
    if (!hasMe) {
      resolvedPlayers = [
        ...resolvedPlayers,
        {
          username: resolvedUsername,
          displayName: user.displayName || resolvedUsername,
          courseHandicap: course.myCourseHandicap ?? null,
          courseHandicapDisplay: course.myCourseHandicapDisplay ?? null,
        },
      ];
    }
  }

  const handleHoleCountChange = async (e) => {
    if (!onSaveCourseLayout) return;
    const nextHoleCount = Number(e.target.value);
    const holePars = defaultHolePars(nextHoleCount, course.par);
    await onSaveCourseLayout(course.id, nextHoleCount, holePars);
  };

  return (
    <div
      className={nested ? 'modal-backdrop modal-backdrop--nested' : 'modal-backdrop'}
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal modal--scorecard"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <h2 id={titleId} className="modal__title">
            {course.name}
          </h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {intro && <p className="modal__intro player-scorecard-modal__intro">{intro}</p>}
        <div className="player-scorecard-modal__body">
          {!readOnly && showHoleCountSelect && onSaveCourseLayout && (
            <label className="course-scorecard-modal__hole-select">
              <span className="course-scorecard-modal__hole-select-label">Holes</span>
              <select
                className="course-scorecard-modal__hole-select-input"
                value={String(holeCount)}
                onChange={handleHoleCountChange}
              >
                {HOLE_COUNT_OPTIONS.map((count) => (
                  <option key={count} value={String(count)}>
                    {count} holes
                  </option>
                ))}
              </select>
            </label>
          )}
          <HoleParGrid
            readOnly={readOnly}
            showNineSummary={showNineSummary}
            hideBlockLabels
            compact
            courseId={course.id}
            holeCount={holeCount}
            holePars={course.holePars}
            holeStrokeIndex={course.holeStrokeIndex}
            onSave={readOnly ? undefined : onSaveCourseLayout}
            onSaveStrokeIndex={readOnly ? undefined : onSaveCourseHoleStrokeIndex}
            players={resolvedPlayers}
            scoresByPlayer={resolvedScores}
            currentUsername={resolvedUsername}
            onSavePlayerScores={readOnly ? undefined : onSavePlayerHoleScores}
          />
        </div>
      </div>
    </div>
  );
}
