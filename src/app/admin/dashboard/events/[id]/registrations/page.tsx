import { notFound, redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { getAdminEventById, getEventRegistrations } from '@/lib/events/service';
import { getCachedAcademicMasters } from '@/lib/supabase/academic-cache';
import { EventRegistrationsClient } from '@/components/admin/events/EventRegistrationsClient';
import { GoogleEventRegistrationsClient } from '@/components/admin/events/GoogleEventRegistrationsClient';

export const dynamic = 'force-dynamic';

export default async function EventRegistrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    redirect('/admin/login');
  }

  const { id } = await params;
  const collegeId = session.activeCollegeId || session.colleges[0]?.collegeId;
  if (!collegeId) {
    redirect('/admin/dashboard');
  }

  const event = await getAdminEventById(id, collegeId);
  if (!event) {
    notFound();
  }

  // Small/Cultural Events with Google Form registration use Google Sheets as single source of truth
  if (event.registration_type === 'google_form') {
    return (
      <div className="py-4 sm:py-6 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <GoogleEventRegistrationsClient
          event={event}
          activeCollegeId={collegeId}
        />
      </div>
    );
  }

  const [regData, academic] = await Promise.all([
    getEventRegistrations({ eventId: event.id, collegeId }),
    getCachedAcademicMasters(collegeId),
  ]);

  return (
    <div className="py-4 sm:py-6 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <EventRegistrationsClient
        event={event}
        initialRegistrations={regData.registrations}
        initialStats={regData.stats}
        branches={academic.branches}
        semesters={academic.semesters}
        activeCollegeId={collegeId}
      />
    </div>
  );
}
