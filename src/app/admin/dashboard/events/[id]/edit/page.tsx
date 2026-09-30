import { notFound, redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { getAdminEventById } from '@/lib/events/service';
import { EventForm } from '@/components/admin/events/EventForm';

export const dynamic = 'force-dynamic';

export default async function EditEventPage({
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

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">Edit Event: {event.title}</h1>
        <p className="text-xs text-slate-500 mt-1">
          Update event details, venue, dates, or payment settings.
        </p>
      </div>

      <EventForm
        initialEvent={event}
        activeCollegeId={collegeId}
        isEdit={true}
      />
    </div>
  );
}
