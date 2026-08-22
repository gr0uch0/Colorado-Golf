/**
 * USGA/WHS stroke allocation and net scoring.
 * Positive Course Handicap: strokes from lowest stroke index (hardest hole) upward.
 * Plus Course Handicap: strokes given back from highest stroke index (SI 18) downward.
 */

export function strokesOnHole(courseHandicap, strokeIndex, holeCount) {
  if (courseHandicap == null || !Number.isFinite(Number(courseHandicap))) return 0;
  if (strokeIndex == null || !Number.isFinite(Number(strokeIndex))) return 0;

  const count = Math.max(1, Math.round(Number(holeCount)));
  const si = Math.round(Number(strokeIndex));
  const ch = Math.round(Number(courseHandicap));
  if (ch === 0) return 0;

  const absCh = Math.abs(ch);
  const fullRounds = Math.floor(absCh / count);
  const remainder = absCh % count;
  if (ch > 0) {
    const extra = si <= remainder ? 1 : 0;
    return fullRounds + extra;
  }
  const extra = remainder && si >= count - remainder + 1 ? 1 : 0;
  return -(fullRounds + extra);
}

export function netHoleScore(grossScore, courseHandicap, strokeIndex, holeCount) {
  if (grossScore == null || !Number.isFinite(Number(grossScore))) return null;
  const strokes = strokesOnHole(courseHandicap, strokeIndex, holeCount);
  return Number(grossScore) - strokes;
}

export function sumNetScoresForHoles(
  scores,
  strokeIndexes,
  courseHandicap,
  holeCount,
  holeNumbers
) {
  let total = 0;
  let hasScore = false;
  for (const holeNumber of holeNumbers) {
    const index = holeNumber - 1;
    const net = netHoleScore(
      scores?.[index],
      courseHandicap,
      strokeIndexes?.[index],
      holeCount
    );
    if (net != null) {
      total += net;
      hasScore = true;
    }
  }
  return hasScore ? total : null;
}

export function sumNetScores(scores, strokeIndexes, courseHandicap, holeCount) {
  const count = Math.max(1, Math.round(Number(holeCount)));
  const holeNumbers = Array.from({ length: count }, (_, index) => index + 1);
  return sumNetScoresForHoles(
    scores,
    strokeIndexes,
    courseHandicap,
    holeCount,
    holeNumbers
  );
}
