import { resolveTenantOrNotFound } from '@/lib/tenant/resolver';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPublicEventBySlugGlobal } from '@/lib/events/service';
import { getPublicEventPrograms } from '@/lib/events/programs-service';
import { getPublicEventParticipants } from '@/lib/events/program-registrations-service';
import { RootPublicNavbar } from '@/components/layout/RootPublicNavbar';
import { ProgramCategorySection } from '@/components/events/programs/ProgramCategorySection';
import { PublicParticipantsList } from '@/components/events/programs/PublicParticipantsList';
import { Calendar, MapPin, Clock, ArrowLeft, Ticket, ShieldCheck, UserCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{
    slug: string;
  }>;
}

export default async function PublicEventPage({ params }: Props) {
  const { slug } = await params;
  const event = await getPublicEventBySlugGlobal(slug);

  if (!event || event.status === 'DRAFT') {
    notFound();
  }

  const collegeId = event.college_id;
  const [programData, publicParticipants, tenant] = await Promise.all([
    getPublicEventPrograms(event.id, collegeId),
    getPublicEventParticipants(event.id, collegeId),
    resolveTenantOrNotFound(event.college?.slug || 'bce-bgp'),
  ]);

  const startDateFormatted = new Date(event.start_at).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const timeFormatted = `${new Date(event.start_at).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })} - ${new Date(event.end_at).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  const deadlineFormatted = new Date(event.registration_end).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const now = new Date();
  const isPastDeadline = now > new Date(event.registration_end);
  const isUpcoming = now < new Date(event.registration_start);
  const isOpen = event.status === 'PUBLISHED' && event.registration_enabled && !isPastDeadline && !isUpcoming;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <RootPublicNavbar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10 space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/events"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>All Events</span>
          </Link>

          <Link
            href={`/events/${event.slug}/my-registrations`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <UserCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>My Registrations</span>
          </Link>
        </div>

        {/* Hero Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                {event.college?.short_name || event.college?.name || 'Institution Event'}
              </span>
              {event.payment_required ? (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                  ₹{event.payment_amount} Registration Fee
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Free Event Entry
                </span>
              )}
            </div>

            <div>
              {isOpen ? (
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                  Registration Open
                </span>
              ) : isPastDeadline ? (
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                  Registration Closed
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                  Upcoming
                </span>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              {event.title}
            </h1>
            {event.description && (
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed whitespace-pre-line">
                {event.description}
              </p>
            )}
          </div>

          {/* Key Event Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <div className="text-slate-500 font-medium">Date</div>
                <div className="font-bold text-slate-800 mt-0.5">{startDateFormatted}</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <div className="text-slate-500 font-medium">Time &amp; Schedule</div>
                <div className="font-bold text-slate-800 mt-0.5">{timeFormatted}</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <div className="text-slate-500 font-medium">Venue Location</div>
                <div className="font-bold text-slate-800 mt-0.5">{event.venue}</div>
              </div>
            </div>
          </div>

          {/* Action CTA Bar */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              Registration deadline: <span className="font-semibold text-slate-800">{deadlineFormatted}</span>
            </div>

            {isOpen && (
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Link
                  href={`/events/${event.slug}/register`}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm text-center shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Ticket className="w-4 h-4" />
                  <span>Register for Event</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Programs / Competitions Section */}
        {programData.categories.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Programs &amp; Competitions</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Register for the event first, then join your desired programs (Individual or Team).
                </p>
              </div>
            </div>

            <ProgramCategorySection
              event={event}
              tenant={tenant}
              categories={programData.categories}
            />
          </div>
        )}

        {/* Public Registered Participants List */}
        {publicParticipants.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h2 className="text-xl font-bold text-slate-900">Registered Participants</h2>
            </div>
            <PublicParticipantsList programGroups={publicParticipants} />
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-5xl mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} {event.college?.name || 'College'}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
