import { redirect, notFound } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { getAdminEventById } from '@/lib/events/service';
import { getAdminEventCategories } from '@/lib/events/categories-service';
import { getAdminEventPrograms, getEventProgramsStats, checkProgramsSchemaReady } from '@/lib/events/programs-service';
import { ProgramDashboard } from '@/components/admin/events/programs/ProgramDashboard';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EventProgramsPage({ params }: Props) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    redirect('/admin/login');
  }

  const { id } = await params;
  const collegeId = session.activeCollegeId || session.colleges[0]?.collegeId;
  if (!collegeId) redirect('/admin/dashboard');

  const event = await getAdminEventById(id, collegeId);
  if (!event) notFound();

  const [categories, programs, stats, isSchemaReady] = await Promise.all([
    getAdminEventCategories(event.id, collegeId),
    getAdminEventPrograms(event.id, collegeId),
    getEventProgramsStats(event.id, collegeId),
    checkProgramsSchemaReady(),
  ]);

  return (
    <div className="py-4 sm:py-6 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <ProgramDashboard
        event={event}
        categories={categories}
        programs={programs}
        stats={stats}
        activeCollegeId={collegeId}
        isSchemaReady={isSchemaReady}
      />
    </div>
  );
}
