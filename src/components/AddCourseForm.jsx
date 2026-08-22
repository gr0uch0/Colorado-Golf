import { useEffect, useState } from 'react';
import { HOLE_COUNT_OPTIONS } from '../utils/holes';

const empty = {
  name: '',
  city: '',
  address: '',
  type: 'Public',
  typeOther: '',
  holes: '18',
  lat: '',
  lng: '',
  website: '',
};

export function AddCourseForm({ open, onClose, onSave, initialLat, initialLng }) {
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm({
      ...empty,
      lat:
        initialLat != null && Number.isFinite(initialLat)
          ? String(initialLat)
          : '',
      lng:
        initialLng != null && Number.isFinite(initialLng)
          ? String(initialLng)
          : '',
    });
  }, [open, initialLat, initialLng]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const name = form.name.trim();
    if (!name) {
      setError('Course name is required.');
      return;
    }
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError('Latitude and longitude must be valid numbers.');
      return;
    }
    if (lat < -90 || lat > 90) {
      setError('Latitude must be between -90 and 90.');
      return;
    }
    if (lng < -180 || lng > 180) {
      setError('Longitude must be between -180 and 180.');
      return;
    }
    const holeCount = HOLE_COUNT_OPTIONS.includes(Number(form.holes))
      ? Number(form.holes)
      : 18;

    let type = form.type.trim() || 'Public';
    if (form.type === 'Other') {
      const o = form.typeOther.trim();
      type = o || 'Other';
    }

    onSave({
      name,
      city: form.city.trim(),
      address: form.address.trim(),
      type,
      holeCount,
      lat,
      lng,
      website: form.website.trim(),
    });
  };

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-course-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <h2 id="add-course-title" className="modal__title">
            Add course
          </h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <form className="modal__form" onSubmit={handleSubmit}>
          {error && <p className="modal__error">{error}</p>}
          <label className="modal__field">
            <span className="modal__label">Course name *</span>
            <input
              className="modal__input"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              autoComplete="off"
              required
            />
          </label>
          <label className="modal__field">
            <span className="modal__label">City</span>
            <input
              className="modal__input"
              value={form.city}
              onChange={(e) => set({ city: e.target.value })}
              autoComplete="address-level2"
            />
          </label>
          <label className="modal__field">
            <span className="modal__label">Address</span>
            <textarea
              className="modal__textarea"
              value={form.address}
              onChange={(e) => set({ address: e.target.value })}
              rows={2}
            />
          </label>
          <label className="modal__field">
            <span className="modal__label">Type</span>
            <select
              className="modal__input"
              value={form.type}
              onChange={(e) => set({ type: e.target.value })}
            >
              <option value="Public">Public</option>
              <option value="Private">Private</option>
              <option value="Municipal">Municipal</option>
              <option value="Resort">Resort</option>
              <option value="Semi-private">Semi-private</option>
              <option value="Indoor">Indoor</option>
              <option value="Other">Other…</option>
            </select>
          </label>
          {form.type === 'Other' && (
            <label className="modal__field">
              <span className="modal__label">Describe type</span>
              <input
                className="modal__input"
                value={form.typeOther}
                onChange={(e) => set({ typeOther: e.target.value })}
                placeholder="e.g. Academy"
              />
            </label>
          )}
          <label className="modal__field">
            <span className="modal__label">Holes</span>
            <select
              className="modal__input"
              value={form.holes}
              onChange={(e) => set({ holes: e.target.value })}
            >
              {HOLE_COUNT_OPTIONS.map((count) => (
                <option key={count} value={String(count)}>
                  {count} holes
                </option>
              ))}
            </select>
          </label>
          <div className="modal__row">
            <label className="modal__field modal__field--half">
              <span className="modal__label">Latitude *</span>
              <input
                className="modal__input"
                inputMode="decimal"
                value={form.lat}
                onChange={(e) => set({ lat: e.target.value })}
                placeholder="39.7392"
              />
            </label>
            <label className="modal__field modal__field--half">
              <span className="modal__label">Longitude *</span>
              <input
                className="modal__input"
                inputMode="decimal"
                value={form.lng}
                onChange={(e) => set({ lng: e.target.value })}
                placeholder="-104.9903"
              />
            </label>
          </div>
          <label className="modal__field">
            <span className="modal__label">Website (optional)</span>
            <input
              className="modal__input"
              type="url"
              value={form.website}
              onChange={(e) => set({ website: e.target.value })}
              placeholder="https://…"
            />
          </label>
          <div className="modal__actions">
            <button type="button" className="modal__btn modal__btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="modal__btn">
              Save course
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
