import { Stats } from './Stats';
import { GroupStats } from './GroupStats';
import { AdminUserManagement } from './AdminUserManagement';
import { useAuth } from '../context/AuthContext';

export function TourCard({ stats, groupMembers, progressByUser, courses, handicapByUser }) {
  const { isAdmin } = useAuth();

  return (
    <section className="tour-card" aria-label="Tour">
      {isAdmin && <AdminUserManagement />}
      <Stats
        total={stats.total}
        played={stats.played}
        remaining={stats.remaining}
        percent={stats.percent}
      />
      <GroupStats
        members={groupMembers}
        progressByUser={progressByUser}
        courses={courses}
        total={stats.total}
        handicapByUser={handicapByUser}
      />
    </section>
  );
}
