import { uniqueSorted } from '../utils/filters';
import { HOLE_COUNT_OPTIONS } from '../utils/holes';

export function Filters({ courses, value, onChange }) {
  const cities = uniqueSorted(courses.map((c) => c.city));
  const types = uniqueSorted(courses.map((c) => c.type));
  const holeOptions = HOLE_COUNT_OPTIONS.map(String);

  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <section className="filters" aria-label="Search and filters">
      <label className="field">
        <span className="field__label">Search</span>
        <input
          type="search"
          className="field__input"
          placeholder="Name, city, or address"
          value={value.search}
          onChange={(e) => set({ search: e.target.value })}
          autoComplete="off"
        />
      </label>
      <div className="filters__row">
        <label className="field field--compact">
          <span className="field__label">City</span>
          <select
            className="field__input"
            value={value.city}
            onChange={(e) => set({ city: e.target.value })}
          >
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="field field--compact">
          <span className="field__label">Type</span>
          <select
            className="field__input"
            value={value.type}
            onChange={(e) => set({ type: e.target.value })}
          >
            <option value="">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="field field--compact">
          <span className="field__label">Holes</span>
          <select
            className="field__input"
            value={value.holes}
            onChange={(e) => set({ holes: e.target.value })}
          >
            <option value="">Any</option>
            {holeOptions.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
