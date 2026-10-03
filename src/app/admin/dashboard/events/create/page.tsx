import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { EventForm } from '@/components/admin/events/EventForm';

export const dynamic = 'force-dynamic';

export default async function CreateEventPage() {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    redirect('/admin/login');
  }

  return (
    <div className="py-4 sm:py-6 px-3 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-4 sm:space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Create College Event</h1>
        <p className="text-xs text-slate-500 mt-1">
          Configure a new event for {session.activeCollege?.name || 'your institution'} with registration schedules and capacity limits.
        </p>
      </div>

      <EventForm activeCollegeId={session.activeCollegeId} isEdit={false} />
    </div>
  );
}
