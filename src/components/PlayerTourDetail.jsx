import { useEffect, useMemo, useState } from 'react';
import { buildPlayerPlayedRounds } from '../utils/playerRounds';
import { CourseScorecardModal } from './CourseScorecardModal';
import { formatHandicap } from '../utils/handicap';

function formatPlayedAt(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatSd(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(1);
}

export function PlayerTourDetail({
  open,
  onClose,
  displayName,
  username,
  indexHcp,
  avgChDisplay,
  played,
  courses,
  progressByUser,
  handicap,
}) {
  const [selectedCourseId, setSelectedCourseId] = useState(null);

  const progressRounds = useMemo(
    () => buildPlayerPlayedRounds(username, courses, progressByUser),
    [username, courses, progressByUser]
  );

  const rounds = useMemo(() => {
    const posted = handicap?.rounds || [];
    const byCourse = Object.fromEntries(posted.map((round) => [round.courseId, round]));
    const seen = new Set();
    const merged = [];
    for (const postedRound of posted) {
      const progress = progressRounds.find((row) => row.courseId === postedRound.courseId);
      seen.add(postedRound.courseId);
      merged.push({
        ...progress,
        courseId: postedRound.courseId,
        name: progress?.name ?? postedRound.courseId,
        city: progress?.city ?? '',
        playedAt: postedRound.playedAt,
        gross: postedRound.gross ?? progress?.gross,
        net: progress?.net ?? null,
        scoreDifferential: postedRound.scoreDifferential,
        counting: postedRound.counting,
        posted: true,
        unpairedNine: postedRound.holes === 9 && !postedRound.counting && postedRound.handicapIndexAfter == null,
        holes: postedRound.holes,
      });
    }
    for (const progress of progressRounds) {
      if (seen.has(progress.courseId)) continue;
      merged.push({
        ...progress,
        scoreDifferential: null,
        counting: false,
        posted: false,
        unpairedNine: false,
      });
    }
    return merged;
  }, [handicap, progressRounds]);

  const selectedCourse = useMemo(
    () => courses?.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId]
  );

  const selectedPlayer = useMemo(
    () =>
      selectedCourse?.playedByDetail?.find((player) => player.username === username) ?? null,
    [selectedCourse, username]
  );

  useEffect(() => {
    if (!open) setSelectedCourseId(null);
  }, [open]);

  useEffect(() => {
    setSelectedCourseId(null);
  }, [username]);

  if (!open) return null;

  const titleId = 'player-tour-detail-title';
  const trend = handicap?.trend || [];
  const established = Boolean(handicap?.established);
  const trendLabel = trend.length
    ? trend
        .slice(-8)
        .map((point) => formatHandicap(point.handicapIndex))
        .join(' → ')
    : null;

  return (
    <>
      <div
        className="modal-backdrop"
        role="presentation"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          className="modal modal--player-tour"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal__header">
            <h2 id={titleId} className="modal__title">
              {displayName}
            </h2>
            <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
          <p className="modal__intro player-tour-detail__handicap">
            {established
              ? `Handicap Index ${indexHcp}`
              : indexHcp && indexHcp !== '—' && indexHcp !== 'Not yet established'
                ? `Index not yet established (admin seed ${indexHcp})`
                : 'Handicap Index not yet established'}
            {avgChDisplay && played > 0 ? ` · CH ${avgChDisplay}` : ''}
            {handicap?.playingHandicapDisplay
              ? ` · PH ${handicap.playingHandicapDisplay}`
              : ''}
          </p>
          {!established && (
            <p className="player-tour-detail__subtitle">
              {handicap?.notEstablishedReason ||
                '3 acceptable 18-hole rounds (or paired 9-hole rounds) are required to establish an Index.'}
            </p>
          )}
          {(handicap?.softCapApplied ||
            handicap?.hardCapApplied ||
            handicap?.exceptionalScoreApplied) && (
            <p className="player-tour-detail__flags" role="status">
              {handicap.exceptionalScoreApplied ? (
                <span className="hcp-flag hcp-flag--esr">Exceptional Score Reduction</span>
              ) : null}
              {handicap.softCapApplied ? (
                <span className="hcp-flag hcp-flag--soft">Soft cap (50% over +3.0 vs Low HI)</span>
              ) : null}
              {handicap.hardCapApplied ? (
                <span className="hcp-flag hcp-flag--hard">Hard cap (+5.0 vs Low HI)</span>
              ) : null}
              {handicap.lowHandicapIndexDisplay != null ? (
                <span className="hcp-flag">Low HI {handicap.lowHandicapIndexDisplay}</span>
              ) : null}
            </p>
          )}
          {trendLabel && (
            <p className="player-tour-detail__trend">
              Index trend: {trendLabel}
            </p>
          )}
          <div className="player-tour-detail">
            <p className="player-tour-detail__subtitle">
              {rounds.length
                ? `${rounds.length} round${rounds.length === 1 ? '' : 's'} · grey rows are not used in the Index · tap for scorecard`
                : 'No courses played yet'}
            </p>
            {rounds.length > 0 ? (
              <ul className="player-tour-detail__list">
                <li className="player-tour-detail__header" aria-hidden="true">
                  <span className="player-tour-detail__course-col">Course</span>
                  <span className="player-tour-detail__score-col">Gross</span>
                  <span className="player-tour-detail__score-col">SD</span>
                </li>
                {rounds.map((round) => {
                  const playedLabel = formatPlayedAt(round.playedAt);
                  const excluded = round.posted && !round.counting;
                  const rowClass = excluded
                    ? 'player-tour-detail__row player-tour-detail__row--excluded'
                    : 'player-tour-detail__row';
                  return (
                    <li key={round.courseId}>
                      <button
                        type="button"
                        className={rowClass}
                        onClick={() => setSelectedCourseId(round.courseId)}
                      >
                        <span className="player-tour-detail__course-col">
                          <span className="player-tour-detail__course-name">{round.name}</span>
                          <span className="player-tour-detail__course-meta">
                            {[
                              round.city,
                              playedLabel,
                              round.posted
                                ? round.counting
                                  ? 'Used in Index'
                                  : round.unpairedNine
                                    ? 'Waiting for a second 9-hole round'
                                    : 'Not used in Index'
                                : 'Not posted (needs rating/slope or a complete card)',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                        <span className="player-tour-detail__score-col">
                          {round.gross ?? '—'}
                        </span>
                        <span className="player-tour-detail__score-col player-tour-detail__score-col--net">
                          {round.posted ? formatSd(round.scoreDifferential) : '—'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="player-tour-detail__empty">
                This player has not marked any courses as played.
              </p>
            )}
          </div>
        </div>
      </div>
      <CourseScorecardModal
        open={Boolean(selectedCourse && selectedPlayer)}
        onClose={() => setSelectedCourseId(null)}
        course={selectedCourse}
        readOnly
        nested
        intro={[
          displayName,
          selectedPlayer?.courseHandicapDisplay
            ? `CH ${selectedPlayer.courseHandicapDisplay}`
            : null,
          selectedCourse?.city ?? null,
        ]
          .filter(Boolean)
          .join(' · ')}
        players={selectedPlayer ? [selectedPlayer] : []}
        scoresByPlayer={
          selectedPlayer
            ? { [selectedPlayer.username]: selectedPlayer.holeScores }
            : {}
        }
        currentUsername={selectedPlayer?.username}
      />
    </>
  );
}
