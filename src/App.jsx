import { useMemo, useState } from 'react';
import { Header } from './components/Header';
import { TourCard } from './components/TourCard';
import { Filters } from './components/Filters';
import { CourseList } from './components/CourseList';
import { MapView } from './components/MapView';
import { AddCourseForm } from './components/AddCourseForm';
import { CourseEditModal } from './components/CourseEditModal';
import { AuthGate } from './components/AuthGate';
import { ChangePasswordGate } from './components/ChangePasswordGate';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useCourses } from './hooks/useCourses';
import { filterCourses } from './utils/filters';

const defaultFilters = {
  search: '',
  city: '',
  type: '',
  holes: '',
};

function AppBody() {
  const { isAuthenticated, mustChangePassword, booting } = useAuth();
  const {
    courses,
    setPlayed,
    saveCourseEdits,
    resetCourseEdits,
    addCourse,
    saveCourseLayout,
    saveCourseHoleStrokeIndex,
    savePlayerHoleScores,
    stats,
    progressByUser,
    handicapByUser,
    groupMembers,
    loading,
    error,
    syncing,
  } = useCourses();
  const [view, setView] = useState('tour');
  const [filters, setFilters] = useState(defaultFilters);
  const [selectedId, setSelectedId] = useState(null);
  const [editCourseId, setEditCourseId] = useState(null);
  const [addCourseOpen, setAddCourseOpen] = useState(false);
  const [addCourseDraft, setAddCourseDraft] = useState(null);

  const filtered = useMemo(
    () => filterCourses(courses, filters),
    [courses, filters]
  );

  const editCourse = useMemo(
    () => (editCourseId ? courses.find((c) => c.id === editCourseId) ?? null : null),
    [courses, editCourseId]
  );

  const openMapCourseEdit = (id) => {
    setSelectedId(id);
    setEditCourseId(id);
  };

  if (booting) {
    return (
      <div className="app app--gate">
        <p className="app-status">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthGate />;
  }

  if (mustChangePassword) {
    return <ChangePasswordGate />;
  }

  return (
    <>
      <div className="app">
        <Header
          view={view}
          onViewChange={(next) => {
            setSelectedId(null);
            setEditCourseId(null);
            setView(next);
          }}
        />
        {error && (
          <p className="app-status app-status--error" role="alert">
            Sync issue: {error}
          </p>
        )}
        {syncing && (
          <p className="app-status app-status--sync" aria-live="polite">
            Saving…
          </p>
        )}
        <main className="app-main">
          {view === 'tour' ? (
            <TourCard
              stats={stats}
              groupMembers={groupMembers}
              progressByUser={progressByUser}
              courses={courses}
              handicapByUser={handicapByUser}
            />
          ) : (
            <>
              <Filters courses={courses} value={filters} onChange={setFilters} />
              {loading && courses.length === 0 ? (
                <p className="app-status">Loading shared data…</p>
              ) : view === 'list' ? (
                <CourseList
                  courses={filtered}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onTogglePlayed={setPlayed}
                  onSaveCourseEdits={saveCourseEdits}
                  onResetCourseEdits={resetCourseEdits}
                  onSaveCourseLayout={saveCourseLayout}
                  onSaveCourseHoleStrokeIndex={saveCourseHoleStrokeIndex}
                  onSavePlayerHoleScores={savePlayerHoleScores}
                />
              ) : (
                <MapView
                  courses={filtered}
                  selectedId={selectedId}
                  onEditCourse={openMapCourseEdit}
                  addCourseFormOpen={addCourseOpen}
                  onAddCourseAtLocation={(lat, lng) => {
                    setAddCourseDraft({ lat, lng });
                    setAddCourseOpen(true);
                  }}
                />
              )}
            </>
          )}
        </main>
        <AddCourseForm
          open={addCourseOpen}
          initialLat={addCourseDraft?.lat}
          initialLng={addCourseDraft?.lng}
          onClose={() => {
            setAddCourseOpen(false);
            setAddCourseDraft(null);
          }}
          onSave={async (payload) => {
            const id = await addCourse(payload);
            setAddCourseOpen(false);
            setAddCourseDraft(null);
            setSelectedId(id);
          }}
        />
        <CourseEditModal
          open={Boolean(editCourse)}
          course={editCourse}
          onClose={() => setEditCourseId(null)}
          onSaveCourseEdits={saveCourseEdits}
          onResetCourseEdits={resetCourseEdits}
        />
      </div>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppBody />
    </AuthProvider>
  );
}
