/** Format USGA Handicap Index for display (+ prefix for plus handicaps). */
export function formatHandicap(handicap) {
  if (handicap == null || Number.isNaN(handicap)) return null;
  const num = Number(handicap);
  if (num < 0) return `+${Math.abs(num).toString()}`;
  return String(num);
}

/** Label for UI: "12.4" or "—" if unset. */
export function handicapLabel(handicap, handicapDisplay) {
  if (handicapDisplay) return handicapDisplay;
  return formatHandicap(handicap) ?? '—';
}

/** Parse admin input; returns empty string for unset. */
export function parseHandicapInput(raw) {
  const s = String(raw ?? '').trim();
  return s;
}
