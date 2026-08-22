const normalize = (s) => (s ?? '').toString().trim().toLowerCase();

/**
 * @param {Array<{ name: string; city: string; address: string; type: string; holeCount: number }>} courses
 * @param {{ search: string; city: string; type: string; holes: string }} filters
 */
export function filterCourses(courses, { search, city, type, holes }) {
  const q = normalize(search);
  return courses.filter((c) => {
    if (q) {
      const hay = `${c.name} ${c.city} ${c.address}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (city && c.city !== city) return false;
    if (type && c.type !== type) return false;
    if (holes && String(c.holeCount ?? c.holes) !== holes) return false;
    return true;
  });
}

/** @param {string[]} values */
export function uniqueSorted(values) {
  return [...new Set(values)].filter(Boolean).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
}
