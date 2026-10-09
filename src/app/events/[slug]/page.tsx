import { resolveTenantOrNotFound } from '@/lib/tenant/resolver';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPublicEventBySlugGlobal } from '@/lib/events/service';
import { getPublicEventPrograms } from '@/lib/events/programs-service';
import { getPublicEventParticipants } from '@/lib/events/program-registrations-service';
import { getCurrentEventSession } from '@/lib/events/event-session';
import { getSmallEventById } from '@/config/events';
import { SmallEventDetailView } from '@/components/events/SmallEventDetailView';
import { RootPublicNavbar } from '@/components/layout/RootPublicNavbar';
import { CollegePublicFooter } from '@/components/layout/CollegePublicFooter';
import { EventStudentIdentityCard } from '@/components/events/EventStudentIdentityCard';
import { ProgramCategorySection } from '@/components/events/programs/ProgramCategorySection';
import { PublicParticipantsList } from '@/components/events/programs/PublicParticipantsList';
import type { Metadata } from 'next';
import { getCampusFlowBrand, getCampusFlowDescription } from '@/lib/tenant/campusflow-brand';
import { Calendar, MapPin, Clock, ArrowLeft, Ticket, ShieldCheck, UserCheck, ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const smallEvent = getSmallEventById(slug);
  if (smallEvent) {
    return {
      title: `${smallEvent.title} | CampusFlow Events`,
      description: smallEvent.shortDescription,
      openGraph: { title: `${smallEvent.title} | CampusFlow Events`, description: smallEvent.shortDescription },
      twitter: { title: `${smallEvent.title} | CampusFlow Events`, description: smallEvent.shortDescription },
    };
  }

  const event = await getPublicEventBySlugGlobal(slug);
  const brand = getCampusFlowBrand({ code: event?.college?.code });
  return {
    title: event ? `${brand.displayName} | ${event.title}` : brand.displayName,
    description: getCampusFlowDescription({ code: event?.college?.code }),
    openGraph: { title: event ? `${brand.displayName} | ${event.title}` : brand.displayName },
    twitter: { title: event ? `${brand.displayName} | ${event.title}` : brand.displayName },
  };
}

interface Props {
  params: Promise<{
    slug: string;
  }>;
}

export default async function PublicEventPage({ params }: Props) {
  const { slug } = await params;

  // 1. Check for Config-Driven Small Event
  const smallEvent = getSmallEventById(slug);
  if (smallEvent) {
    const institutionDisplayName =
      smallEvent.institutionId === 'bce-bgp'
        ? 'Bhagalpur College of Engineering'
        : smallEvent.institutionId === 'gec-gaya'
        ? 'Government Engineering College, Gaya'
        : smallEvent.organizer;

    return (
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
        <RootPublicNavbar />
        <main className="flex-1">
          <SmallEventDetailView
            event={smallEvent}
            tenantSlug={smallEvent.institutionId}
            institutionDisplayName={institutionDisplayName}
            backHref="/events"
          />
        </main>
        <CollegePublicFooter
          collegeName={institutionDisplayName}
          collegeSlug={smallEvent.institutionId}
          variant="light"
          className="mt-12"
        />
      </div>
    );
  }

  // 2. Fallback to Database Events if existing
  const event = await getPublicEventBySlugGlobal(slug);

  if (!event || event.status === 'DRAFT') {
    notFound();
  }
  if (!event.college?.slug) notFound();

  const collegeId = event.college_id;
  const [programData, publicParticipants, tenant, session] = await Promise.all([
    getPublicEventPrograms(event.id, collegeId),
    getPublicEventParticipants(event.id, collegeId),
    resolveTenantOrNotFound(event.college.slug),
    getCurrentEventSession(event.id),
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

  const effectiveDeadline = event.registration_deadline || event.registration_end;
  const deadlineFormatted = new Date(effectiveDeadline).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const now = new Date();
  const isPastDeadline = now > new Date(effectiveDeadline);
  const isUpcoming = now < new Date(event.registration_start);
  const isOpen = event.status === 'PUBLISHED' && event.registration_enabled && !isPastDeadline && !isUpcoming;
  const isGoogleForm = event.registration_type === 'google_form' && Boolean(event.google_form_url);
  const registerButtonLabel = event.registration_label || 'Register Now';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <RootPublicNavbar eventId={event.id} tenantCode={event.college?.code} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-3 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/events"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>All Events</span>
          </Link>

          <Link
            href={`/events/${event.slug}/my-registrations`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>My Registrations</span>
          </Link>
        </div>

        {/* Hero Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                {event.college?.code || event.college?.name || 'Institution Event'}
              </span>
              {event.payment_required ? (
                <span className="px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                  ₹{event.payment_amount} Registration Fee
                </span>
              ) : (
                <span className="px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
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

          <div className="space-y-2 sm:space-y-3 min-w-0">
            <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight break-words">
              {event.title}
            </h1>
            {event.description && (
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line break-words">
                {event.description}
              </p>
            )}
          </div>

          {/* Key Event Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 pt-4 border-t border-slate-100">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="text-xs min-w-0">
                <div className="text-slate-500 font-medium">Date</div>
                <div className="font-bold text-slate-800 mt-0.5 break-words">{startDateFormatted}</div>
              </div>
            </div>

            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="text-xs min-w-0">
                <div className="text-slate-500 font-medium">Time &amp; Schedule</div>
                <div className="font-bold text-slate-800 mt-0.5 break-words">{timeFormatted}</div>
              </div>
            </div>

            <div className="flex items-start gap-3 min-w-0 sm:col-span-2 lg:col-span-1">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="text-xs min-w-0">
                <div className="text-slate-500 font-medium">Venue Location</div>
                <div className="font-bold text-slate-800 mt-0.5 break-words">{event.venue}</div>
              </div>
            </div>
          </div>

          {/* Action CTA Bar */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            <div className="text-xs text-slate-500">
              Registration deadline: <span className="font-semibold text-slate-800">{deadlineFormatted}</span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <a
                href="#identity"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300/90 text-xs sm:text-sm font-bold rounded-xl sm:rounded-2xl transition-all shadow-xs hover:shadow-sm active:scale-95 cursor-pointer text-center"
              >
                <Ticket className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>Already Registered? Download Pass</span>
              </a>

              {isOpen ? (
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {isGoogleForm ? (
                    event.google_form_url ? (
                      <a
                        href={event.google_form_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold text-xs sm:text-sm text-center shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>{registerButtonLabel} &rarr;</span>
                        <ExternalLink className="w-4 h-4 shrink-0" />
                      </a>
                    ) : (
                      <div className="w-full sm:w-auto px-5 sm:px-6 py-2.5 bg-slate-200 text-slate-500 font-semibold text-xs sm:text-sm rounded-xl text-center">
                        Registration temporarily unavailable
                      </div>
                    )
                  ) : session ? (
                    <a
                      href="#programs"
                      className="w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm text-center shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>Registered ({session.registrationNumber}) &bull; Choose Program</span>
                    </a>
                  ) : (
                    <Link
                      href={`/events/${event.slug}/register`}
                      className="w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm text-center shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      <Ticket className="w-4 h-4 shrink-0" />
                      <span>{registerButtonLabel}</span>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="w-full sm:w-auto px-5 sm:px-6 py-2.5 bg-slate-200 text-slate-500 font-semibold text-xs sm:text-sm rounded-xl text-center">
                  {event.registration_type === 'google_form' && (!event.google_form_url || event.google_registration_status === 'ERROR')
                    ? 'Registration temporarily unavailable'
                    : 'Registration Closed'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Student Event Identity / Verification Section */}
        <section id="identity">
          <EventStudentIdentityCard
            event={event}
            initialSession={session}
            tenantSlug={event.college?.slug}
            collegeLogoUrl={event.college?.logo_url}
            collegeName={event.college?.name}
          />
        </section>

        {/* Programs / Competitions Section */}
        {programData.categories.length > 0 && (
          <section id="programs" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">Programs &amp; Competitions</h2>
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
          </section>
        )}

        {/* Public Registered Participants List */}
        {publicParticipants.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">Registered Participants</h2>
            </div>
            <PublicParticipantsList programGroups={publicParticipants} />
          </div>
        )}
      </main>

      <CollegePublicFooter
        collegeName={tenant?.name || event.college?.name}
        collegeShortName={tenant?.shortName || event.college?.code}
        collegeSlug={tenant?.slug || event.college?.slug}
        websiteUrl={tenant?.websiteUrl || event.college?.website_url}
        variant="light"
        className="mt-8 sm:mt-12"
      />
    </div>
  );
}
