import { useEffect, useState } from 'react';
import { defaultPar } from '../utils/courseHandicap';
import { HOLE_COUNT_OPTIONS, normalizeHoleCount } from '../utils/holes';

import { HoleSssGrid } from './HoleSssGrid';
import { HoleParGrid } from './HoleParGrid';
import { useAuth } from '../context/AuthContext';

const TYPE_OPTIONS = [
  'Public',
  'Private',
  'Municipal',
  'Resort',
  'Semi-private',
  'Indoor',
  'Other',
];

function formatWebsiteLabel(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '') || url;
  } catch {
    return url;
  }
}

function formatDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return null;
  }
}

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

export function CourseDetail({
  course,
  onClose,
  onTogglePlayed,
  onSaveCourseEdits,
  onResetCourseEdits,
  onSaveCourseHoleSss,
  onSaveCourseLayout,
  onSaveCourseHoleStrokeIndex,
  onSavePlayerHoleScores,
}) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() =>
    course ? courseToDraft(course) : {}
  );
  const [error, setError] = useState('');

  useEffect(() => {
    setEditing(false);
    setDraft(course ? courseToDraft(course) : {});
    setError('');
  }, [course?.id]);

  if (!course) return null;

  const playedLabel = formatDate(course.playedAt);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const startEdit = () => {
    setDraft(courseToDraft(course));
    setError('');
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft(courseToDraft(course));
    setError('');
  };

  const saveEdits = () => {
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

    onSaveCourseEdits(
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
    setEditing(false);
  };

  return (
    <aside className="course-detail" aria-label="Course details">
      <div className="course-detail__header">
        {!editing && (
          <>
            <h2 className="course-detail__title">{course.name}</h2>
            <div className="course-detail__header-actions">
              <button
                type="button"
                className="course-detail__edit-link"
                onClick={startEdit}
              >
                Edit course
              </button>
              <button
                type="button"
                className="course-detail__close"
                onClick={onClose}
                aria-label="Close details"
              >
                ×
              </button>
            </div>
          </>
        )}
        {editing && (
          <>
            <h2 className="course-detail__title course-detail__title--edit">
              Edit course
            </h2>
            <button
              type="button"
              className="course-detail__close"
              onClick={cancelEdit}
              aria-label="Cancel editing"
            >
              ×
            </button>
          </>
        )}
      </div>

      {editing ? (
        <div className="course-detail__form">
          {error && <p className="course-detail__form-error">{error}</p>}
          <label className="course-detail__field">
            <span className="course-detail__field-label">Course name *</span>
            <input
              className="course-detail__field-input"
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              autoComplete="off"
            />
          </label>
          <label className="course-detail__field">
            <span className="course-detail__field-label">City</span>
            <input
              className="course-detail__field-input"
              value={draft.city}
              onChange={(e) => set({ city: e.target.value })}
            />
          </label>
          <label className="course-detail__field">
            <span className="course-detail__field-label">Address</span>
            <textarea
              className="course-detail__field-textarea"
              value={draft.address}
              onChange={(e) => set({ address: e.target.value })}
              rows={2}
            />
          </label>
          <label className="course-detail__field">
            <span className="course-detail__field-label">Type</span>
            <select
              className="course-detail__field-input"
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
            <label className="course-detail__field">
              <span className="course-detail__field-label">Describe type</span>
              <input
                className="course-detail__field-input"
                value={draft.typeOther}
                onChange={(e) => set({ typeOther: e.target.value })}
              />
            </label>
          )}
          <label className="course-detail__field">
            <span className="course-detail__field-label">Holes</span>
            <select
              className="course-detail__field-input"
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
          <p className="course-detail__field-note">
            Course Rating and Slope are required to post scores to a WHS Handicap Index.
            Leave them blank until you have the USGA values for these tees — do not use 113 / par as placeholders.
          </p>
          <div className="course-detail__field-row">
            <label className="course-detail__field course-detail__field--half">
              <span className="course-detail__field-label">Par</span>
              <input
                className="course-detail__field-input"
                type="number"
                min={27}
                max={80}
                value={draft.par}
                onChange={(e) => set({ par: e.target.value })}
              />
            </label>
            <label className="course-detail__field course-detail__field--half">
              <span className="course-detail__field-label">Slope</span>
              <input
                className="course-detail__field-input"
                type="number"
                min={55}
                max={155}
                placeholder="e.g. 129"
                value={draft.slopeRating}
                onChange={(e) => set({ slopeRating: e.target.value })}
              />
            </label>
          </div>
          <label className="course-detail__field">
            <span className="course-detail__field-label">Course rating</span>
            <input
              className="course-detail__field-input"
              type="number"
              step="0.1"
              placeholder="e.g. 71.2"
              value={draft.courseRating}
              onChange={(e) => set({ courseRating: e.target.value })}
            />
          </label>
          <div className="course-detail__field-row">
            <label className="course-detail__field course-detail__field--half">
              <span className="course-detail__field-label">Latitude *</span>
              <input
                className="course-detail__field-input"
                inputMode="decimal"
                value={draft.lat}
                onChange={(e) => set({ lat: e.target.value })}
              />
            </label>
            <label className="course-detail__field course-detail__field--half">
              <span className="course-detail__field-label">Longitude *</span>
              <input
                className="course-detail__field-input"
                inputMode="decimal"
                value={draft.lng}
                onChange={(e) => set({ lng: e.target.value })}
              />
            </label>
          </div>
          <label className="course-detail__field">
            <span className="course-detail__field-label">Website (optional)</span>
            <input
              className="course-detail__field-input"
              type="url"
              value={draft.website}
              onChange={(e) => set({ website: e.target.value })}
              placeholder="https://…"
            />
          </label>
          <div className="course-detail__edit-actions">
            <button type="button" className="course-detail__btn course-detail__btn--ghost" onClick={cancelEdit}>
              Cancel
            </button>
            <button type="button" className="course-detail__btn" onClick={saveEdits}>
              Save
            </button>
          </div>
        </div>
      ) : (
        <>
          {course.hasSourceEdits && !course.isUserCourse && (
            <p className="course-detail__name-note">
              Some fields differ from GPX data.{' '}
              <button
                type="button"
                className="course-detail__reset-inline"
                onClick={() => onResetCourseEdits(course.id, course.isUserCourse)}
              >
                Restore map defaults
              </button>
            </p>
          )}
          <dl className="course-detail__dl">
            <div>
              <dt>City</dt>
              <dd>{course.city}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{course.address}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{course.type}</dd>
            </div>
            <div>
              <dt>Holes</dt>
              <dd>{normalizeHoleCount(course.holeCount ?? course.holes)}</dd>
            </div>
            <div>
              <dt>Par / slope / rating</dt>
              <dd>
                {course.hasWhsRatings
                  ? `${course.par} · slope ${course.slopeRating} · rating ${course.courseRating}`
                  : `${course.par} · Course Rating / Slope not set`}
              </dd>
            </div>
            {!course.hasWhsRatings && (
              <div>
                <dt>Handicap posting</dt>
                <dd>
                  Scores on this course will not count toward a Handicap Index until
                  Course Rating and Slope are entered (Edit course). Existing scorecards
                  are kept; re-save a complete card after ratings are set to post it.
                </dd>
              </div>
            )}
            {course.played && course.myCourseHandicapDisplay != null && (
              <div>
                <dt>Your course handicap</dt>
                <dd>
                  CH {course.myCourseHandicapDisplay}
                  {course.handicapAtPlayDisplay && course.handicapAtPlayDisplay !== '—' && (
                    <span className="course-detail__hcp-note">
                      {' '}
                      (index {course.handicapAtPlayDisplay} when played)
                    </span>
                  )}
                </dd>
              </div>
            )}
            <div>
              <dt>Latitude</dt>
              <dd>{course.lat}</dd>
            </div>
            <div>
              <dt>Longitude</dt>
              <dd>{course.lng}</dd>
            </div>
            {course.website && (
              <div>
                <dt>Website</dt>
                <dd>
                  <a
                    className="course-detail__link"
                    href={course.website}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {formatWebsiteLabel(course.website)}
                  </a>
                </dd>
              </div>
            )}
            {course.played && playedLabel && (
              <div>
                <dt>Your played date</dt>
                <dd>{playedLabel}</dd>
              </div>
            )}
            {course.playedByDetail?.length > 0 && (
              <div>
                <dt>Played by ({course.playedByDetail.length})</dt>
                <dd>
                  <ul className="course-detail__played-list">
                    {course.playedByDetail.map((p) => (
                      <li key={p.username}>
                        {p.displayName}
                        {p.handicapDisplay && p.handicapDisplay !== '—'
                          ? ` · Player Handicap ${p.handicapDisplay}`
                          : ''}
                        {p.courseHandicapDisplay
                          ? ` · CH ${p.courseHandicapDisplay}`
                          : ''}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
          </dl>
        </>
      )}

      <HoleParGrid
        courseId={course.id}
        holeCount={course.holeCount ?? course.holes}
        holePars={course.holePars}
        holeStrokeIndex={course.holeStrokeIndex}
        onSave={onSaveCourseLayout}
        onSaveStrokeIndex={onSaveCourseHoleStrokeIndex}
        players={course.playedByDetail}
        scoresByPlayer={course.playerScoresByUser}
        currentUsername={user?.username}
        onSavePlayerScores={onSavePlayerHoleScores}
      />

      <HoleSssGrid
        courseId={course.id}
        holeCount={course.holeCount ?? course.holes}
        holeSss={course.holeSss}
        onSave={onSaveCourseHoleSss}
      />

      {!editing && (
        <label className="course-detail__toggle">
          <input
            type="checkbox"
            checked={course.played}
            onChange={() => onTogglePlayed(course.id, !course.played)}
          />
          <span>Mark as played</span>
        </label>
      )}
    </aside>
  );
}
