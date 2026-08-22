export const HOLE_COUNT_OPTIONS = [9, 18, 27];

/** Map any hole value to 9, 18, or 27 for display and ratings. */
export function normalizeHoleCount(value) {
  const n = Number(value);
  if (HOLE_COUNT_OPTIONS.includes(n)) return n;
  if (!Number.isFinite(n) || n <= 0) return 18;
  if (n <= 9) return 9;
  if (n <= 18) return 18;
  return 27;
}

export function holeCountLabel(value) {
  return `${normalizeHoleCount(value)} holes`;
}

export function holeCountBadge(value) {
  return `${normalizeHoleCount(value)}-hole`;
}
