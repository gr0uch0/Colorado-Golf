import { useEffect, useState } from 'react';
import { defaultPar } from '../utils/courseHandicap';
import { HOLE_COUNT_OPTIONS, normalizeHoleCount } from '../utils/holes';

const TYPE_OPTIONS = [
  'Public',
  'Private',
  'Municipal',
  'Resort',
  'Semi-private',
  'Indoor',
  'Other',
];

function courseToDraft(course) {
  const fixed = TYPE_OPTIONS.filter((t) => t !== 'Other');
  const isFixed = fixed.includes(course.type);
  return {
    name: course.name,
    city: course.city,
    address: course.address,
    type: isFixed ? course.type : 'Other',
    typeOther: isFixed ? '' : course.type,
    holes: String(normalizeHoleCount(course.holeCount ?? course.holes)),
    lat: String(course.lat),
    lng: String(course.lng),
    website: course.website || '',
    par: String(course.par ?? defaultPar(course.holes)),
    slopeRating: course.hasWhsRatings ? String(course.slopeRating ?? '') : '',
    courseRating: course.hasWhsRatings ? String(course.courseRating ?? '') : '',
  };
}

export function CourseEditModal({
  open,
  course,
  onClose,
  onSaveCourseEdits,
  onResetCourseEdits,
}) {
  const [draft, setDraft] = useState(() => (course ? courseToDraft(course) : {}));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !course) return;
    setDraft(courseToDraft(course));
    setError('');
    setSaving(false);
  }, [open, course?.id]);

  if (!open || !course) return null;

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setError('');
    const name = draft.name.trim();
    if (!name) {
      setError('Course name is required.');
      return;
    }
    const lat = parseFloat(draft.lat);
    const lng = parseFloat(draft.lng);
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
    const holeCount = normalizeHoleCount(draft.holes);
    const par = parseFloat(draft.par);
    const slopeRaw = draft.slopeRating.trim();
    const ratingRaw = draft.courseRating.trim();
    const slopeRating = slopeRaw === '' ? null : parseFloat(slopeRaw);
    const courseRating = ratingRaw === '' ? null : parseFloat(ratingRaw);
    if (!Number.isFinite(par) || par < 27 || par > 80) {
      setError('Par must be between 27 and 80.');
      return;
    }
    if ((slopeRating == null) !== (courseRating == null)) {
      setError('Enter both Course Rating and Slope, or leave both blank.');
      return;
    }
    if (slopeRating != null && (slopeRating < 55 || slopeRating > 155)) {
      setError('Slope rating must be between 55 and 155.');
      return;
    }
    if (courseRating != null && (courseRating < 20 || courseRating > 80)) {
      setError('Course rating must be between 20 and 80.');
      return;
    }

    let type = draft.type.trim() || 'Public';
    if (draft.type === 'Other') {
      const o = draft.typeOther.trim();
      type = o || 'Other';
    }

    setSaving(true);
    try {
      await onSaveCourseEdits(
        course.id,
        {
          name,
          city: draft.city.trim(),
          address: draft.address.trim(),
          type,
          holeCount,
          lat,
          lng,
          website: draft.website.trim(),
          par,
          slopeRating,
          courseRating,
        },
        course.isUserCourse
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const titleId = 'course-edit-title';

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal modal--course-edit"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal__header">
          <h2 id={titleId} className="modal__title">
            Edit course
          </h2>
        </div>
        <p className="modal__intro">{course.name}</p>
        <form className="modal__form" onSubmit={handleSubmit}>
          {error && <p className="modal__error">{error}</p>}
          {course.hasSourceEdits && !course.isUserCourse && onResetCourseEdits && (
            <p className="course-edit-modal__reset-note">
              Some fields differ from map defaults.{' '}
              <button
                type="button"
                className="course-edit-modal__reset"
                onClick={() => {
                  onResetCourseEdits(course.id, course.isUserCourse);
                  const source = course.sourceFields || {};
                  setDraft(
                    courseToDraft({
                      ...course,
                      name: source.name ?? course.name,
                      city: source.city ?? course.city,
                      address: source.address ?? course.address,
                      type: source.type ?? course.type,
                      holes: source.holes ?? course.holes,
                      holeCount: source.holes ?? course.holeCount,
                      lat: source.lat ?? course.lat,
                      lng: source.lng ?? course.lng,
                      website: source.website ?? '',
                      hasWhsRatings: false,
                      slopeRating: null,
                      courseRating: null,
                      par: defaultPar(source.holes ?? course.holes),
                    })
                  );
                }}
              >
                Restore map defaults
              </button>
            </p>
          )}
          <label className="modal__field">
            <span className="modal__label">Course name *</span>
            <input
              className="modal__input"
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              autoComplete="off"
              required
            />
          </label>
          <label className="modal__field">
            <span className="modal__label">City</span>
            <input
              className="modal__input"
              value={draft.city}
              onChange={(e) => set({ city: e.target.value })}
            />
          </label>
          <label className="modal__field">
            <span className="modal__label">Address</span>
            <textarea
              className="modal__input modal__textarea"
              value={draft.address}
              onChange={(e) => set({ address: e.target.value })}
              rows={2}
            />
          </label>
          <label className="modal__field">
            <span className="modal__label">Type</span>
            <select
              className="modal__input"
              value={draft.type}
              onChange={(e) => set({ type: e.target.value })}
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t === 'Other' ? 'Other…' : t}
                </option>
              ))}
            </select>
          </label>
          {draft.type === 'Other' && (
            <label className="modal__field">
              <span className="modal__label">Describe type</span>
              <input
                className="modal__input"
                value={draft.typeOther}
                onChange={(e) => set({ typeOther: e.target.value })}
              />
            </label>
          )}
          <label className="modal__field">
            <span className="modal__label">Holes</span>
            <select
              className="modal__input"
              value={String(normalizeHoleCount(draft.holes))}
              onChange={(e) => set({ holes: e.target.value })}
            >
              {HOLE_COUNT_OPTIONS.map((count) => (
                <option key={count} value={String(count)}>
                  {count} holes
                </option>
              ))}
            </select>
          </label>
          <p className="modal__hint">
            Course Rating and Slope are required to post scores to a WHS Handicap Index.
            Leave them blank until you have the USGA values — do not use placeholders.
          </p>
          <div className="modal__field-row">
            <label className="modal__field modal__field--half">
              <span className="modal__label">Par</span>
              <input
                className="modal__input"
                type="number"
                min={27}
                max={80}
                value={draft.par}
                onChange={(e) => set({ par: e.target.value })}
              />
            </label>
            <label className="modal__field modal__field--half">
              <span className="modal__label">Slope</span>
              <input
                className="modal__input"
                type="number"
                min={55}
                max={155}
                placeholder="e.g. 129"
                value={draft.slopeRating}
                onChange={(e) => set({ slopeRating: e.target.value })}
              />
            </label>
          </div>
          <label className="modal__field">
            <span className="modal__label">Course rating</span>
            <input
              className="modal__input"
              type="number"
              step="0.1"
              placeholder="e.g. 71.2"
              value={draft.courseRating}
              onChange={(e) => set({ courseRating: e.target.value })}
            />
          </label>
          <div className="modal__field-row">
            <label className="modal__field modal__field--half">
              <span className="modal__label">Latitude *</span>
              <input
                className="modal__input"
                inputMode="decimal"
                value={draft.lat}
                onChange={(e) => set({ lat: e.target.value })}
                required
              />
            </label>
            <label className="modal__field modal__field--half">
              <span className="modal__label">Longitude *</span>
              <input
                className="modal__input"
                inputMode="decimal"
                value={draft.lng}
                onChange={(e) => set({ lng: e.target.value })}
                required
              />
            </label>
          </div>
          <label className="modal__field">
            <span className="modal__label">Website (optional)</span>
            <input
              className="modal__input"
              type="url"
              value={draft.website}
              onChange={(e) => set({ website: e.target.value })}
              placeholder="https://…"
            />
          </label>
          <div className="modal__actions">
            <button type="button" className="modal__btn modal__btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="modal__btn" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
