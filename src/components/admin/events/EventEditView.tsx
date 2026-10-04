import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { getAdminEventById } from '@/lib/events/service';
import { EventForm } from '@/components/admin/events/EventForm';
import { ArrowLeft, Users, ExternalLink, Trophy, FileSpreadsheet } from 'lucide-react';

interface EventEditViewProps {
  idOrSlug: string;
}

export async function EventEditView({ idOrSlug }: EventEditViewProps) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    redirect('/admin/login');
  }

  const collegeId = session.activeCollegeId || session.colleges[0]?.collegeId;
  if (!collegeId) {
    redirect('/admin/dashboard');
  }

  // Tenant-scoped event resolution: resolves by UUID or slug within authenticated college
  const event = await getAdminEventById(idOrSlug, collegeId);
  if (!event) {
    notFound();
  }

  const activeCollegeSlug =
    session.activeCollege?.slug ||
    session.colleges.find((c) => c.collegeId === collegeId)?.slug;

  return (
    <div className="py-4 sm:py-6 px-3 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-4 sm:space-y-6">
      {/* Header and Quick Navigation */}
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Link
              href="/admin/dashboard?tab=events"
              className="text-slate-400 hover:text-slate-700 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Events</span>
            </Link>
          </div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2 flex-wrap">
            <span className="break-words">Edit Event: {event.title}</span>
            <span className="text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 break-all">
              /{event.slug}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Update event details, venue, dates, capacity, or payment settings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {event.registration_type !== 'google_form' && (
            <Link
              href={`/admin/dashboard/events/${event.id}/programs`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold rounded-lg transition-colors border border-amber-200"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-600" />
              <span>Manage Programs</span>
            </Link>
          )}

          <Link
            href={`/admin/dashboard/events/${event.id}/registrations`}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
              event.registration_type === 'google_form'
                ? 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
            }`}
          >
            {event.registration_type === 'google_form' ? (
              <>
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                <span>Form Data &amp; PDF</span>
              </>
            ) : (
              <>
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Registrations ({event.active_registrations_count || 0})</span>
              </>
            )}
          </Link>

          {event.google_form_url && (
            <a
              href={event.google_form_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg transition-colors border border-emerald-200"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Google Form</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {activeCollegeSlug && event.status === 'PUBLISHED' && (
            <Link
              href={`/${activeCollegeSlug}/events/${event.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition-colors border border-blue-200"
            >
              <span>Public Page</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>

      <EventForm
        initialEvent={event}
        activeCollegeId={collegeId}
        isEdit={true}
      />
    </div>
  );
}
