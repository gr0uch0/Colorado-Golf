import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { holeCountBadge } from '../utils/holes';
import { CourseEditModal } from './CourseEditModal';
import { CourseScorecardModal } from './CourseScorecardModal';

export function CourseCard({
  course,
  selected,
  onSelect,
  onTogglePlayed,
  onSaveCourseEdits,
  onResetCourseEdits,
  onSaveCourseLayout,
  onSaveCourseHoleStrokeIndex,
  onSavePlayerHoleScores,
}) {
  const { user } = useAuth();
  const [scorecardOpen, setScorecardOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const stop = (e) => e.stopPropagation();

  const openScorecard = () => {
    setScorecardOpen(true);
  };

  const openEdit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setEditOpen(true);
  };

  const scorecardIntro = [
    course.city,
    course.type,
    course.played && course.myCourseHandicapDisplay != null
      ? `CH ${course.myCourseHandicapDisplay}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <article
        className={selected ? 'course-card course-card--selected' : 'course-card'}
        onClick={openScorecard}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openScorecard();
          }
        }}
      >
        <label className="course-card__check" onClick={stop}>
          <input
            type="checkbox"
            checked={course.played}
            onChange={() => onTogglePlayed(course.id, !course.played)}
            aria-label={`Mark ${course.name} as ${course.played ? 'not played' : 'played'}`}
          />
        </label>
        <div className="course-card__body">
          <h3 className="course-card__name">{course.name}</h3>
          <p className="course-card__meta">
            {course.city} · {course.type}
            {course.played && course.myCourseHandicapDisplay != null && (
              <> · CH {course.myCourseHandicapDisplay}</>
            )}
          </p>
          {course.playedByDetail?.length > 0 && (
            <p className="course-card__group">
              {course.playedByDetail.length} played
              {course.playedByDetail.length <= 3
                ? `: ${course.playedByDetail
                    .map((p) =>
                      p.courseHandicapDisplay
                        ? `${p.displayName} (CH ${p.courseHandicapDisplay})`
                        : p.displayName
                    )
                    .join(', ')}`
                : ''}
            </p>
          )}
          <button
            type="button"
            className="course-card__edit-btn"
            onClick={openEdit}
            aria-label={`Edit ${course.name}`}
          >
            Edit course
          </button>
        </div>
        <span className="course-card__hole-count" aria-label={`${course.holeCount} holes`}>
          {holeCountBadge(course.holeCount)}
        </span>
        {course.played && <span className="course-card__badge">You</span>}
        {!course.played && course.playedBy?.length > 0 && (
          <span className="course-card__badge course-card__badge--others">Group</span>
        )}
      </article>
      <CourseScorecardModal
        open={scorecardOpen}
        onClose={() => setScorecardOpen(false)}
        course={course}
        intro={scorecardIntro}
        currentUsername={user?.username}
        onSaveCourseLayout={onSaveCourseLayout}
        onSaveCourseHoleStrokeIndex={onSaveCourseHoleStrokeIndex}
        onSavePlayerHoleScores={onSavePlayerHoleScores}
        showHoleCountSelect
      />
      <CourseEditModal
        open={editOpen}
        course={course}
        onClose={() => setEditOpen(false)}
        onSaveCourseEdits={onSaveCourseEdits}
        onResetCourseEdits={onResetCourseEdits}
      />
    </>
  );
}
