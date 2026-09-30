import Link from 'next/link';
import { resolveTenantOrNotFound } from '@/lib/tenant/resolver';
import { getPublicTenantEvents } from '@/lib/events/service';
import { PublicEventCard } from '@/components/events/PublicEventCard';
import { Calendar, ArrowLeft, School, Ticket } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{
    tenant: string;
  }>;
}

export default async function PublicTenantEventsPage({ params }: Props) {
  const { tenant: rawSlug } = await params;
  const tenant = await resolveTenantOrNotFound(rawSlug);

  const events = await getPublicTenantEvents(tenant.collegeId);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white text-[11px] sm:text-xs py-1.5 sm:py-2 px-3 sm:px-4 border-b border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-1 sm:gap-2 text-center sm:text-left">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="truncate">Events &amp; Registrations Portal &bull; {tenant.name}</span>
          </div>
          <Link
            href={`/${tenant.slug}`}
            className="text-slate-300 hover:text-white flex items-center gap-1 text-[10px] sm:text-xs shrink-0"
          >
            <ArrowLeft className="w-3 h-3" /> {tenant.shortName} Portal
          </Link>
        </div>
      </div>

      {/* Header with College Branding */}
      <header className="bg-white border-b border-slate-200 shadow-xs sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {tenant.logo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={tenant.logo}
                alt={`${tenant.name} Logo`}
                className="w-10 h-10 object-contain rounded-lg"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs shrink-0"
                style={{ backgroundColor: tenant.branding.primaryColor || '#0B192C' }}
              >
                <School className="w-5 h-5" />
              </div>
            )}
            <div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 line-clamp-1">
                {tenant.name}
              </h1>
              <p className="text-[11px] text-slate-500">Official Student Events</p>
            </div>
          </div>

          <Link
            href={`/${tenant.slug}/feedback`}
            className="text-xs font-semibold text-slate-600 hover:text-bce-cobalt border border-slate-200 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Faculty Feedback &rarr;
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-4 py-8 sm:py-10 flex-1 w-full space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-bce-cobalt text-xs font-semibold">
            <Ticket className="w-3.5 h-3.5" />
            <span>Campus Activities &amp; Programs</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Upcoming College Events
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Explore workshops, hackathons, guest lectures, and cultural fests. Enroll online with instant verification.
          </p>
        </div>

        {/* Events Grid */}
        {events.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center max-w-lg mx-auto space-y-3 shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No Events Published</h3>
            <p className="text-xs text-slate-500">
              There are currently no active public events scheduled for {tenant.shortName}. Please check back later!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.map((event) => (
              <PublicEventCard key={event.id} event={event} tenantSlug={tenant.slug} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-6xl mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} {tenant.name}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
