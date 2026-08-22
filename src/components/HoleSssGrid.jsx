import { useEffect, useMemo, useRef, useState } from 'react';
import {
  clampSss,
  holeSssBlocks,
  MAX_SSS,
  MIN_SSS,
  sumHoleSss,
} from '../utils/holeSss';

export function HoleSssGrid({ courseId, holeCount, holeSss, onSave }) {
  const [values, setValues] = useState(holeSss);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');
  const saveTimer = useRef(null);

  useEffect(() => {
    setValues(holeSss);
    setLocalError('');
  }, [courseId, holeSss]);

  const blocks = useMemo(() => holeSssBlocks(holeCount), [holeCount]);
  const total = useMemo(() => sumHoleSss(values), [values]);

  const persist = async (nextValues) => {
    setSaving(true);
    setLocalError('');
    try {
      await onSave(courseId, holeCount, nextValues);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
      setValues(holeSss);
    } finally {
      setSaving(false);
    }
  };

  const queueSave = (nextValues) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persist(nextValues);
    }, 450);
  };

  const updateHole = (holeIndex, raw) => {
    const next = [...values];
    next[holeIndex] = clampSss(raw);
    setValues(next);
    queueSave(next);
  };

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    []
  );

  return (
    <section className="hole-sss" aria-label="Standard Scratch Score by hole">
      <div className="hole-sss__header">
        <h3 className="hole-sss__title">Standard Scratch Score</h3>
        <span className="hole-sss__meta">
          {holeCount} holes · total {total}
          {saving ? ' · saving…' : ''}
        </span>
      </div>
      {localError && (
        <p className="hole-sss__error" role="alert">
          {localError}
        </p>
      )}
      {blocks.map((block) => (
        <div key={block.label} className="hole-sss__block">
          <p className="hole-sss__block-label">{block.label}</p>
          <div className="hole-sss__scorecard">
            <div className="hole-sss__row">
              <span className="hole-sss__row-label" aria-hidden="true" />
              {block.holes.map((holeNumber) => (
                <span key={holeNumber} className="hole-sss__hole-num">
                  {holeNumber}
                </span>
              ))}
            </div>
            <div className="hole-sss__row">
              <span className="hole-sss__row-label">SSS</span>
              {block.holes.map((holeNumber) => {
                const index = holeNumber - 1;
                return (
                  <input
                    key={holeNumber}
                    className="hole-sss__input"
                    type="number"
                    min={MIN_SSS}
                    max={MAX_SSS}
                    inputMode="numeric"
                    value={values[index] ?? ''}
                    aria-label={`Hole ${holeNumber} Standard Scratch Score`}
                    onChange={(e) => updateHole(index, e.target.value)}
                    onBlur={() => {
                      if (saveTimer.current) {
                        clearTimeout(saveTimer.current);
                        saveTimer.current = null;
                      }
                      persist(values);
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
