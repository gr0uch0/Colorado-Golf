import { CourseCard } from './CourseCard';

export function CourseList({
  courses,
  selectedId,
  onSelect,
  onTogglePlayed,
  onSaveCourseEdits,
  onResetCourseEdits,
  onSaveCourseLayout,
  onSaveCourseHoleStrokeIndex,
  onSavePlayerHoleScores,
}) {
  if (!courses.length) {
    return (
      <p className="empty-state">No courses match your filters.</p>
    );
  }

  return (
    <div className="course-list" role="list">
      {courses.map((c) => (
        <div key={c.id} role="listitem">
          <CourseCard
            course={c}
            selected={c.id === selectedId}
            onSelect={onSelect}
            onTogglePlayed={onTogglePlayed}
            onSaveCourseEdits={onSaveCourseEdits}
            onResetCourseEdits={onResetCourseEdits}
            onSaveCourseLayout={onSaveCourseLayout}
            onSaveCourseHoleStrokeIndex={onSaveCourseHoleStrokeIndex}
            onSavePlayerHoleScores={onSavePlayerHoleScores}
          />
        </div>
      ))}
    </div>
  );
}
