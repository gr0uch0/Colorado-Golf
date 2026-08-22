import { normalizeHoleCount } from './holes';
import { holeLayoutBlocks } from './holeGrid';

const MIN_SSS = 1;
const MAX_SSS = 10;

export function defaultCoursePar(holeCount) {
  const count = normalizeHoleCount(holeCount);
  if (count === 9) return 36;
  if (count === 27) return 108;
  return 72;
}

/** Spread total par across holes (used when no per-hole SSS is stored). */
export function defaultHoleSss(holeCount, totalPar) {
  const count = normalizeHoleCount(holeCount);
  const par = Number(totalPar);
  const target = Number.isFinite(par) && par > 0 ? Math.round(par) : defaultCoursePar(count);
  const base = Math.floor(target / count);
  const extra = target % count;
  return Array.from({ length: count }, (_, index) => base + (index < extra ? 1 : 0));
}

export function resolveHoleSss(holeCount, storedSss, totalPar) {
  const count = normalizeHoleCount(holeCount);
  if (Array.isArray(storedSss) && storedSss.length === count) {
    return storedSss.map((value) => clampSss(value));
  }
  return defaultHoleSss(count, totalPar);
}

export function clampSss(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 4;
  return Math.min(MAX_SSS, Math.max(MIN_SSS, n));
}

export function holeSssBlocks(holeCount) {
  return holeLayoutBlocks(holeCount);
}

export function sumHoleSss(values) {
  return values.reduce((total, value) => total + clampSss(value), 0);
}

export { MIN_SSS, MAX_SSS };
