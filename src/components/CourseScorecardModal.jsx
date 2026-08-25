import { useEffect, useRef, useState } from 'react';
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
  const dialogRef = useRef(null);
  const gridRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const titleId = 'course-scorecard-title';
  const resolvedUsername = currentUsername ?? user?.username ?? null;
  const resolvedScores = scoresByPlayer ?? course.playerScoresByUser ?? {};
  const holeCount = course.holeCount ?? course.holes;
  const [draftHoleCount, setDraftHoleCount] = useState(holeCount);

  useEffect(() => {
    if (!open) return;
    setDraftHoleCount(holeCount);
    setError('');
    setSaving(false);
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, course?.id, holeCount]);

  if (!open || !course) return null;

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

  const handleCancel = () => {
    if (!readOnly) {
      gridRef.current?.discardChanges();
      setDraftHoleCount(holeCount);
    }
    onClose();
  };

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      if (
        !readOnly &&
        showHoleCountSelect &&
        onSaveCourseLayout &&
        draftHoleCount !== holeCount
      ) {
        const holePars = defaultHolePars(draftHoleCount, course.par);
        await onSaveCourseLayout(course.id, draftHoleCount, holePars);
      }
      await gridRef.current?.saveAll();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={nested ? 'modal-backdrop modal-backdrop--nested' : 'modal-backdrop'}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="modal modal--scorecard"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal__header">
          <h2 id={titleId} className="modal__title">
            {course.name}
          </h2>
          <button
            type="button"
            className="modal__close"
            onClick={handleCancel}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {intro && <p className="modal__intro player-scorecard-modal__intro">{intro}</p>}
        <div className="player-scorecard-modal__body">
          {error && (
            <p className="modal__error player-scorecard-modal__error" role="alert">
              {error}
            </p>
          )}
          {!readOnly && showHoleCountSelect && onSaveCourseLayout && (
            <label className="course-scorecard-modal__hole-select">
              <span className="course-scorecard-modal__hole-select-label">Holes</span>
              <select
                className="course-scorecard-modal__hole-select-input"
                value={String(draftHoleCount)}
                onChange={(e) => setDraftHoleCount(Number(e.target.value))}
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
            ref={gridRef}
            readOnly={readOnly}
            deferSave={!readOnly}
            showNineSummary={showNineSummary}
            hideBlockLabels
            compact
            courseId={course.id}
            holeCount={!readOnly && showHoleCountSelect ? draftHoleCount : holeCount}
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
        {!readOnly && (
          <div className="modal__actions modal__actions--scorecard">
            <button
              type="button"
              className="modal__btn modal__btn--ghost"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="modal__btn"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
