/** Default par from hole count when course data has no rating. */
export function defaultPar(holes) {
  const n = Number(holes);
  if (Number.isFinite(n) && n > 0 && n <= 9) return 36;
  return 72;
}

/** USGA/WHS Course Handicap (rounded). Index may be negative for plus players. */
export function calcCourseHandicap(handicapIndex, slopeRating = 113, courseRating, par) {
  if (handicapIndex == null || Number.isNaN(handicapIndex)) return null;
  const slope = Number(slopeRating) || 113;
  const rating = Number(courseRating);
  const p = Number(par);
  if (!Number.isFinite(rating) || !Number.isFinite(p)) return null;
  const ch = handicapIndex * (slope / 113) + (rating - p);
  return Math.round(ch);
}

export function resolveCourseRatingFields(course) {
  const holes = course?.holes ?? 18;
  const par =
    course?.par ??
    course?.fieldOverrides?.par ??
    defaultPar(holes);
  const slopeRating = course?.slopeRating ?? course?.fieldOverrides?.slopeRating ?? 113;
  const courseRating =
    course?.courseRating ?? course?.fieldOverrides?.courseRating ?? par;
  return {
    par: Number(par),
    slopeRating: Number(slopeRating) || 113,
    courseRating: Number(courseRating),
  };
}

export function formatCourseHandicap(ch) {
  if (ch == null || Number.isNaN(ch)) return null;
  const n = Math.round(ch);
  if (n < 0) return `+${Math.abs(n)}`;
  return String(n);
}
