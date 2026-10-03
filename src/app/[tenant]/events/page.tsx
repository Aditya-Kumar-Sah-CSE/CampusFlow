import Link from 'next/link';
import { resolveTenantOrNotFound } from '@/lib/tenant/resolver';
import { getPublicTenantEvents } from '@/lib/events/service';
import { PublicEventCard } from '@/components/events/PublicEventCard';
import { PublicTenantNavbar } from '@/components/layout/PublicTenantNavbar';
import { Calendar, ArrowLeft, Ticket } from 'lucide-react';

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

      {/* Main Responsive Header with Tenant Branding & Mobile Drawer */}
      <PublicTenantNavbar tenant={tenant} currentPage="events" />

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-10 flex-1 w-full space-y-5 sm:space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2 px-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-bce-cobalt text-xs font-semibold">
            <Ticket className="w-3.5 h-3.5 shrink-0" />
            <span>Campus Activities &amp; Programs</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 break-words">
            Upcoming College Events
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            Explore workshops, hackathons, guest lectures, and cultural fests. Enroll online with instant verification.
          </p>
        </div>

        {/* Events Grid */}
        {events.length === 0 ? (
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-6 sm:p-12 text-center max-w-lg mx-auto space-y-3 shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No Events Published</h3>
            <p className="text-xs text-slate-500">
              There are currently no active public events scheduled for {tenant.shortName}. Please check back later!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {events.map((event) => (
              <PublicEventCard key={event.id} event={event} tenantSlug={tenant.slug} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-8 sm:mt-12">
        <div className="max-w-6xl mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} {tenant.name}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
