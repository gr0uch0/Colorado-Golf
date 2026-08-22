import { defaultCoursePar } from './holeSss';
import { normalizeHoleCount } from './holes';
import { holeLayoutBlocks } from './holeGrid';

export const MIN_HOLE_PAR = 3;
export const MAX_HOLE_PAR = 5;

export function clampHolePar(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 4;
  return Math.min(MAX_HOLE_PAR, Math.max(MIN_HOLE_PAR, n));
}

export function normalizeHolePars(values) {
  return (values ?? []).map((value) => {
    if (value == null || String(value).trim() === '') return 4;
    return clampHolePar(value);
  });
}

export function isHoleGridCellEmpty(value) {
  return value == null || String(value).trim() === '';
}

export function isHoleGridComplete(values) {
  return Array.isArray(values) && values.every((value) => !isHoleGridCellEmpty(value));
}

export function parForDisplay(value) {
  if (value == null || String(value).trim() === '') return 0;
  return clampHolePar(value);
}

/** Spread course par across holes using 3/4/5 values. */
export function defaultHolePars(holeCount, totalPar) {
  const count = normalizeHoleCount(holeCount);
  const target =
    Number(totalPar) > 0 ? Math.round(Number(totalPar)) : defaultCoursePar(count);
  const pars = Array.from({ length: count }, () => 4);
  let diff = target - pars.reduce((sum, value) => sum + value, 0);
  let index = 0;
  while (diff > 0 && index < count) {
    if (pars[index] < MAX_HOLE_PAR) {
      pars[index] += 1;
      diff -= 1;
    }
    index += 1;
  }
  index = 0;
  while (diff < 0 && index < count) {
    if (pars[index] > MIN_HOLE_PAR) {
      pars[index] -= 1;
      diff += 1;
    }
    index += 1;
  }
  return pars.map(clampHolePar);
}

export function resolveHolePars(holeCount, storedPars, totalPar) {
  const count = normalizeHoleCount(holeCount);
  if (Array.isArray(storedPars) && storedPars.length === count) {
    return storedPars.map(clampHolePar);
  }
  return defaultHolePars(count, totalPar);
}

export function sumHolePars(values) {
  return values.reduce((total, value) => total + parForDisplay(value), 0);
}

export function sumHoleParsForHoles(values, holeNumbers) {
  return holeNumbers.reduce(
    (total, holeNumber) => total + parForDisplay(values[holeNumber - 1]),
    0
  );
}

export { holeLayoutBlocks };
