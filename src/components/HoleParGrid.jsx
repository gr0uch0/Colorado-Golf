import { useEffect, useMemo, useRef, useState } from 'react';
import {
  clampHolePar,
  holeLayoutBlocks,
  isHoleGridComplete,
  MAX_HOLE_PAR,
  MIN_HOLE_PAR,
  normalizeHolePars,
  sumHolePars,
  sumHoleParsForHoles,
} from '../utils/holePars';
import {
  netHoleScore,
  sumNetScores,
  sumNetScoresForHoles,
} from '../utils/netScore';
import {
  clampHoleScore,
  MAX_HOLE_SCORE,
  MIN_HOLE_SCORE,
  resolveHoleScores,
  sumHoleScores,
  sumHoleScoresForHoles,
} from '../utils/holeScores';
import {
  clampStrokeIndex,
  normalizeHoleStrokeIndex,
  resolveHoleStrokeIndex,
} from '../utils/holeStrokeIndex';

function nineSummaryColumnLabel(block, blockIndex, totalBlocks) {
  if (totalBlocks === 2 && block.holes.length === 9) {
    return blockIndex === 0 ? 'Out' : 'In';
  }
  const first = block.holes[0];
  const last = block.holes[block.holes.length - 1];
  return first === last ? `H${first}` : `${first}–${last}`;
}

export function HoleParGrid({
  courseId,
  holeCount,
  holePars,
  holeStrokeIndex,
  onSave,
  onSaveStrokeIndex,
  compact = false,
  readOnly = false,
  showNineSummary = false,
  hideBlockLabels = false,
  players = [],
  scoresByPlayer = {},
  currentUsername,
  onSavePlayerScores,
}) {
  const [values, setValues] = useState(() => holePars ?? []);
  const [strokeIndexValues, setStrokeIndexValues] = useState(() =>
    resolveHoleStrokeIndex(holeCount, holeStrokeIndex)
  );
  const [myScores, setMyScores] = useState(() =>
    resolveHoleScores(holeCount, scoresByPlayer[currentUsername])
  );
  const [localError, setLocalError] = useState('');
  const saveTimer = useRef(null);
  const scoreTimer = useRef(null);
  const strokeIndexTimer = useRef(null);
  const valuesRef = useRef(values);
  const strokeIndexRef = useRef(strokeIndexValues);
  const myScoresRef = useRef(myScores);
  const remoteScoresKeyRef = useRef('');
  const scoresDirtyRef = useRef(false);
  const remoteParKeyRef = useRef('');
  const parDirtyRef = useRef(false);
  const remoteStrokeIndexKeyRef = useRef('');
  const strokeIndexDirtyRef = useRef(false);

  const scoresKey = (scores) => JSON.stringify(scores ?? []);
  const parKey = (values) => JSON.stringify(values ?? []);
  const strokeIndexKey = (values) => JSON.stringify(values ?? []);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    strokeIndexRef.current = strokeIndexValues;
  }, [strokeIndexValues]);

  useEffect(() => {
    myScoresRef.current = myScores;
  }, [myScores]);

  useEffect(() => {
    scoresDirtyRef.current = false;
    remoteScoresKeyRef.current = '';
    parDirtyRef.current = false;
    remoteParKeyRef.current = '';
    strokeIndexDirtyRef.current = false;
    remoteStrokeIndexKeyRef.current = '';
  }, [courseId]);

  useEffect(() => {
    const remoteKey = parKey(holePars);
    if (remoteKey === remoteParKeyRef.current) return;
    if (parDirtyRef.current) return;
    remoteParKeyRef.current = remoteKey;
    const next = holePars ?? [];
    valuesRef.current = next;
    setValues(next);
    setLocalError('');
  }, [courseId, holeCount, holePars]);

  useEffect(() => {
    const remote = resolveHoleStrokeIndex(holeCount, holeStrokeIndex);
    const remoteKey = strokeIndexKey(remote);
    if (remoteKey === remoteStrokeIndexKeyRef.current) return;
    if (strokeIndexDirtyRef.current) return;
    remoteStrokeIndexKeyRef.current = remoteKey;
    strokeIndexRef.current = remote;
    setStrokeIndexValues(remote);
  }, [courseId, holeCount, holeStrokeIndex]);

  useEffect(() => {
    const remote = resolveHoleScores(holeCount, scoresByPlayer[currentUsername]);
    const remoteKey = scoresKey(remote);
    if (remoteKey === remoteScoresKeyRef.current) return;
    if (scoresDirtyRef.current) return;
    remoteScoresKeyRef.current = remoteKey;
    myScoresRef.current = remote;
    setMyScores(remote);
  }, [courseId, holeCount, currentUsername, scoresByPlayer]);

  const blocks = useMemo(() => holeLayoutBlocks(holeCount), [holeCount]);
  const total = useMemo(() => sumHolePars(values), [values]);
  const playedPlayers = useMemo(
    () => [...players].sort((a, b) =>
      a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
    ),
    [players]
  );

  const persistPars = async (nextValues) => {
    if (!onSave || !isHoleGridComplete(nextValues)) return;
    setLocalError('');
    const normalized = normalizeHolePars(nextValues);
    try {
      await onSave(courseId, holeCount, normalized, { silent: true });
      valuesRef.current = normalized;
      setValues(normalized);
      parDirtyRef.current = false;
      remoteParKeyRef.current = parKey(normalized);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
      parDirtyRef.current = true;
    }
  };

  const persistScores = async (nextScores) => {
    if (!onSavePlayerScores || !currentUsername) return;
    setLocalError('');
    try {
      await onSavePlayerScores(courseId, nextScores);
      scoresDirtyRef.current = false;
      remoteScoresKeyRef.current = scoresKey(nextScores);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
      scoresDirtyRef.current = true;
    }
  };

  const persistStrokeIndex = async (nextValues) => {
    if (!onSaveStrokeIndex || !isHoleGridComplete(nextValues)) return;
    setLocalError('');
    const normalized = normalizeHoleStrokeIndex(holeCount, nextValues);
    try {
      await onSaveStrokeIndex(courseId, holeCount, normalized, { silent: true });
      strokeIndexRef.current = normalized;
      setStrokeIndexValues(normalized);
      strokeIndexDirtyRef.current = false;
      remoteStrokeIndexKeyRef.current = strokeIndexKey(normalized);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
      strokeIndexDirtyRef.current = true;
    }
  };

  const queueSaveStrokeIndex = (nextValues) => {
    if (strokeIndexTimer.current) clearTimeout(strokeIndexTimer.current);
    strokeIndexTimer.current = setTimeout(() => {
      persistStrokeIndex(nextValues);
    }, 450);
  };

  const flushSaveStrokeIndex = () => {
    if (strokeIndexTimer.current) {
      clearTimeout(strokeIndexTimer.current);
      strokeIndexTimer.current = null;
    }
    persistStrokeIndex(strokeIndexRef.current);
  };

  const updateStrokeIndex = (holeIndex, raw) => {
    const next = [...strokeIndexRef.current];
    const trimmed = String(raw).trim();
    next[holeIndex] = trimmed === '' ? null : clampStrokeIndex(raw, holeCount);
    strokeIndexRef.current = next;
    strokeIndexDirtyRef.current = true;
    setStrokeIndexValues(next);
    if (isHoleGridComplete(next)) {
      queueSaveStrokeIndex(next);
    }
  };

  const queueSavePars = (nextValues) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persistPars(nextValues);
    }, 450);
  };

  const queueSaveScores = (nextScores) => {
    if (scoreTimer.current) clearTimeout(scoreTimer.current);
    scoreTimer.current = setTimeout(() => {
      persistScores(nextScores);
    }, 450);
  };

  const flushSavePars = () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    persistPars(valuesRef.current);
  };

  const flushSaveScores = () => {
    if (scoreTimer.current) {
      clearTimeout(scoreTimer.current);
      scoreTimer.current = null;
    }
    persistScores(myScoresRef.current);
  };

  const updateHole = (holeIndex, raw) => {
    const next = [...valuesRef.current];
    const trimmed = String(raw).trim();
    next[holeIndex] = trimmed === '' ? null : clampHolePar(raw);
    valuesRef.current = next;
    parDirtyRef.current = true;
    setValues(next);
    if (isHoleGridComplete(next)) {
      queueSavePars(next);
    }
  };

  const updateMyScore = (holeIndex, raw) => {
    const next = [...myScoresRef.current];
    const trimmed = String(raw).trim();
    next[holeIndex] = trimmed === '' ? null : clampHoleScore(raw);
    myScoresRef.current = next;
    scoresDirtyRef.current = true;
    setMyScores(next);
    queueSaveScores(next);
  };

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (scoreTimer.current) clearTimeout(scoreTimer.current);
      if (strokeIndexTimer.current) clearTimeout(strokeIndexTimer.current);
    },
    []
  );

  const rootClass = compact ? 'hole-par hole-par--compact' : 'hole-par';

  return (
    <section className={rootClass} aria-label="Par and scores by hole">
      {!compact && (
        <div className="hole-par__header">
          <h3 className="hole-par__title">Par &amp; scores</h3>
          <span className="hole-par__meta">
            {holeCount} holes · total par {total}
          </span>
        </div>
      )}
      {compact && (
        <p className="hole-par__meta hole-par__meta--compact">
          Total par {total}
        </p>
      )}
      {localError && (
        <p className="hole-par__error" role="alert">
          {localError}
        </p>
      )}
      {blocks.map((block) => (
        <div key={block.label} className="hole-par__block">
          {!hideBlockLabels && <p className="hole-par__block-label">{block.label}</p>}
          <div className="hole-par__scorecard">
            <div className="hole-par__scorecard-row-wrap">
              <div className="hole-par__row">
                <span className="hole-par__row-label" aria-hidden="true" />
                {block.holes.map((holeNumber) => (
                  <span key={holeNumber} className="hole-par__hole-num">
                    {holeNumber}
                  </span>
                ))}
                <span className="hole-par__row-total hole-par__row-total--label">Tot</span>
              </div>
            </div>
            <div className="hole-par__scorecard-row-wrap">
              <div className="hole-par__row">
                <span className="hole-par__row-label">Par</span>
                {block.holes.map((holeNumber) => {
                  const index = holeNumber - 1;
                  if (readOnly) {
                    return (
                      <span
                        key={holeNumber}
                        className="hole-par__score-readout"
                        aria-label={`Hole ${holeNumber} par`}
                      >
                        {values[index] ?? '—'}
                      </span>
                    );
                  }
                  return (
                    <input
                      key={holeNumber}
                      className="hole-par__input"
                      type="number"
                      min={MIN_HOLE_PAR}
                      max={MAX_HOLE_PAR}
                      inputMode="numeric"
                      value={values[index] ?? ''}
                      aria-label={`Hole ${holeNumber} par`}
                      onChange={(e) => updateHole(index, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={flushSavePars}
                    />
                  );
                })}
                <span
                  className="hole-par__row-total"
                  aria-label={`Par subtotal holes ${block.holes[0]}–${block.holes[block.holes.length - 1]}`}
                >
                  {sumHoleParsForHoles(values, block.holes)}
                </span>
              </div>
            </div>
            <div className="hole-par__scorecard-row-wrap">
              <div className="hole-par__row hole-par__row--stroke-index">
                <span className="hole-par__row-label" title="Stroke Index">
                  SI
                </span>
                {block.holes.map((holeNumber) => {
                  const index = holeNumber - 1;
                  if (readOnly) {
                    return (
                      <span
                        key={holeNumber}
                        className="hole-par__score-readout"
                        aria-label={`Hole ${holeNumber} stroke index`}
                      >
                        {strokeIndexValues[index] ?? '—'}
                      </span>
                    );
                  }
                  return (
                    <input
                      key={holeNumber}
                      className="hole-par__input hole-par__input--stroke-index"
                      type="number"
                      min={1}
                      max={holeCount}
                      inputMode="numeric"
                      value={strokeIndexValues[index] ?? ''}
                      aria-label={`Hole ${holeNumber} stroke index`}
                      onChange={(e) => updateStrokeIndex(index, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={flushSaveStrokeIndex}
                    />
                  );
                })}
                <span className="hole-par__row-total" aria-hidden="true" />
              </div>
            </div>
            {playedPlayers.map((player) => {
              const isMe = !readOnly && player.username === currentUsername;
              const scores = isMe
                ? myScores
                : resolveHoleScores(holeCount, scoresByPlayer[player.username]);
              const blockTotal = sumHoleScoresForHoles(scores, block.holes);
              const blockNetTotal = sumNetScoresForHoles(
                scores,
                strokeIndexValues,
                player.courseHandicap,
                holeCount,
                block.holes
              );
              return (
                <div key={player.username} className="hole-par__player-block">
                  <aside className="hole-par__player-info" aria-label={player.displayName}>
                    <span className="hole-par__player-name">{player.displayName}</span>
                    <span className="hole-par__player-handicap">
                      {player.courseHandicapDisplay
                        ? `CH ${player.courseHandicapDisplay}`
                        : '—'}
                    </span>
                  </aside>
                  <div className="hole-par__player-rows">
                    <div className="hole-par__row hole-par__row--gross">
                      <span className="hole-par__row-label">Gross</span>
                      {block.holes.map((holeNumber) => {
                        const index = holeNumber - 1;
                        const value = scores[index];
                        if (isMe) {
                          return (
                            <input
                              key={holeNumber}
                              className="hole-par__input hole-par__input--score"
                              type="number"
                              min={MIN_HOLE_SCORE}
                              max={MAX_HOLE_SCORE}
                              inputMode="numeric"
                              value={value ?? ''}
                              aria-label={`${player.displayName} hole ${holeNumber} gross score`}
                              onChange={(e) => updateMyScore(index, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onBlur={flushSaveScores}
                            />
                          );
                        }
                        return (
                          <span
                            key={holeNumber}
                            className="hole-par__score-readout"
                            aria-label={`${player.displayName} hole ${holeNumber} gross score`}
                          >
                            {value ?? '—'}
                          </span>
                        );
                      })}
                      <span
                        className="hole-par__row-total"
                        aria-label={`${player.displayName} gross subtotal holes ${block.holes[0]}–${block.holes[block.holes.length - 1]}`}
                      >
                        {blockTotal ?? '—'}
                      </span>
                    </div>
                    <div className="hole-par__row hole-par__row--net">
                      <span className="hole-par__row-label hole-par__row-label--net">Net</span>
                      {block.holes.map((holeNumber) => {
                        const index = holeNumber - 1;
                        const net = netHoleScore(
                          scores[index],
                          player.courseHandicap,
                          strokeIndexValues[index],
                          holeCount
                        );
                        return (
                          <span
                            key={holeNumber}
                            className="hole-par__score-readout hole-par__score-readout--net"
                            aria-label={`${player.displayName} hole ${holeNumber} net score`}
                          >
                            {net ?? '—'}
                          </span>
                        );
                      })}
                      <span
                        className="hole-par__row-total hole-par__row-total--net"
                        aria-label={`${player.displayName} net subtotal holes ${block.holes[0]}–${block.holes[block.holes.length - 1]}`}
                      >
                        {blockNetTotal ?? '—'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {showNineSummary && playedPlayers.length > 0 && (
        <div className="hole-par__nine-summary">
          {playedPlayers.map((player) => {
            const scores = resolveHoleScores(holeCount, scoresByPlayer[player.username]);
            const columns = blocks.map((block, blockIndex) => ({
              key: `${block.holes[0]}-${block.holes[block.holes.length - 1]}`,
              label: nineSummaryColumnLabel(block, blockIndex, blocks.length),
              gross: sumHoleScoresForHoles(scores, block.holes),
              net: sumNetScoresForHoles(
                scores,
                strokeIndexValues,
                player.courseHandicap,
                holeCount,
                block.holes
              ),
            }));
            const totalGross = sumHoleScores(scores);
            const totalNet = sumNetScores(
              scores,
              strokeIndexValues,
              player.courseHandicap,
              holeCount
            );

            return (
              <div key={`summary-${player.username}`} className="hole-par__nine-summary-player">
                <p className="hole-par__nine-summary-title">
                  {playedPlayers.length === 1
                    ? 'Nine totals'
                    : `${player.displayName} — nine totals`}
                </p>
                <div className="hole-par__nine-summary-grid">
                  {[
                    {
                      key: 'head',
                      className: 'hole-par__nine-summary-row hole-par__nine-summary-row--head',
                      cells: [
                        { key: 'label', className: 'hole-par__nine-summary-label', value: '' },
                        ...columns.map((column) => ({
                          key: column.key,
                          className: 'hole-par__nine-summary-col',
                          value: column.label,
                        })),
                        { key: 'tot', className: 'hole-par__nine-summary-col', value: 'Tot' },
                      ],
                    },
                    {
                      key: 'gross',
                      className: 'hole-par__nine-summary-row',
                      cells: [
                        { key: 'label', className: 'hole-par__nine-summary-label', value: 'Gross' },
                        ...columns.map((column) => ({
                          key: `${column.key}-gross`,
                          className: 'hole-par__nine-summary-col',
                          value: column.gross ?? '—',
                        })),
                        {
                          key: 'tot-gross',
                          className:
                            'hole-par__nine-summary-col hole-par__nine-summary-col--total',
                          value: totalGross ?? '—',
                        },
                      ],
                    },
                    {
                      key: 'net',
                      className: 'hole-par__nine-summary-row hole-par__nine-summary-row--net',
                      cells: [
                        { key: 'label', className: 'hole-par__nine-summary-label', value: 'Net' },
                        ...columns.map((column) => ({
                          key: `${column.key}-net`,
                          className: 'hole-par__nine-summary-col',
                          value: column.net ?? '—',
                        })),
                        {
                          key: 'tot-net',
                          className:
                            'hole-par__nine-summary-col hole-par__nine-summary-col--total',
                          value: totalNet ?? '—',
                        },
                      ],
                    },
                  ].map((row) => (
                    <div
                      key={row.key}
                      className={row.className}
                      style={{
                        gridTemplateColumns: `minmax(3.25rem, auto) repeat(${columns.length}, minmax(2.5rem, 1fr)) minmax(2.5rem, 1fr)`,
                      }}
                    >
                      {row.cells.map((cell) => (
                        <span key={cell.key} className={cell.className}>
                          {cell.value}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
