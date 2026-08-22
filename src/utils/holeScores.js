import { normalizeHoleCount } from './holes';

export const MIN_HOLE_SCORE = 1;
export const MAX_HOLE_SCORE = 15;

export function emptyHoleScores(holeCount) {
  const count = normalizeHoleCount(holeCount);
  return Array.from({ length: count }, () => null);
}

export function resolveHoleScores(holeCount, storedScores) {
  const count = normalizeHoleCount(holeCount);
  if (!Array.isArray(storedScores) || storedScores.length !== count) {
    return emptyHoleScores(count);
  }
  return storedScores.map((value) => {
    if (value == null || value === '') return null;
    return clampHoleScore(value);
  });
}

export function clampHoleScore(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return null;
  return Math.min(MAX_HOLE_SCORE, Math.max(MIN_HOLE_SCORE, n));
}

export function sumHoleScores(values) {
  if (!Array.isArray(values)) return null;
  const scored = values.filter((value) => value != null && Number.isFinite(Number(value)));
  if (!scored.length) return null;
  return scored.reduce((total, value) => total + Number(value), 0);
}

export function sumHoleScoresForHoles(values, holeNumbers) {
  if (!Array.isArray(values)) return null;
  return sumHoleScores(holeNumbers.map((holeNumber) => values[holeNumber - 1]));
}
