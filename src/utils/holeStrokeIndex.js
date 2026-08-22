import { normalizeHoleCount } from './holes';

export function defaultHoleStrokeIndex(holeCount) {
  const count = normalizeHoleCount(holeCount);
  return Array.from({ length: count }, (_, index) => index + 1);
}

export function resolveHoleStrokeIndex(holeCount, storedStrokeIndex) {
  const count = normalizeHoleCount(holeCount);
  if (Array.isArray(storedStrokeIndex) && storedStrokeIndex.length === count) {
    return storedStrokeIndex.map((value) => clampStrokeIndex(value, count));
  }
  return defaultHoleStrokeIndex(count);
}

export function clampStrokeIndex(value, holeCount) {
  const count = normalizeHoleCount(holeCount);
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 1;
  return Math.min(count, Math.max(1, n));
}

export function normalizeHoleStrokeIndex(holeCount, values) {
  const count = normalizeHoleCount(holeCount);
  const defaults = defaultHoleStrokeIndex(count);
  return Array.from({ length: count }, (_, index) => {
    const value = values?.[index];
    if (value == null || String(value).trim() === '') {
      return defaults[index];
    }
    return clampStrokeIndex(value, count);
  });
}
