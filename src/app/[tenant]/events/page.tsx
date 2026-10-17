import Link from 'next/link';
import { resolveTenantOrNotFound } from '@/lib/tenant/resolver';
import { getPublicTenantEvents } from '@/lib/events/service';
import { getEventsForTenant } from '@/config/events';
import { SmallEventCard } from '@/components/events/SmallEventCard';
import { PublicEventCard } from '@/components/events/PublicEventCard';
import { PublicTenantNavbar } from '@/components/layout/PublicTenantNavbar';
import { CollegePublicFooter } from '@/components/layout/CollegePublicFooter';
import { Calendar, ArrowLeft, Ticket } from 'lucide-react';

export const revalidate = 300;

interface Props {
  params: Promise<{
    tenant: string;
  }>;
}

export default async function PublicTenantEventsPage({ params }: Props) {
  const { tenant: rawSlug } = await params;
  const t0 = performance.now();
  const tenant = await resolveTenantOrNotFound(rawSlug);
  const tTenant = (performance.now() - t0).toFixed(1);
  console.log(`[PERF] route=/[tenant]/events op=tenant_lookup duration_ms=${tTenant} success=true`);

  const t1 = performance.now();
  const [dbEvents, smallEvents] = await Promise.all([
    getPublicTenantEvents(tenant.collegeId).catch(() => []),
    Promise.resolve(getEventsForTenant(tenant.slug)),
  ]);
  const tEvents = (performance.now() - t1).toFixed(1);
  console.log(`[PERF] route=/[tenant]/events op=events_lookup duration_ms=${tEvents} success=true`);

  const totalCount = dbEvents.length + smallEvents.length;

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-slate-800 dark:text-slate-100 transition-colors duration-200">
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
        <div className="text-center max-w-2xl mx-auto space-y-2.5 px-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[3px] bg-blue-50 dark:bg-amber-950/60 text-bce-cobalt dark:text-amber-300 text-xs font-semibold border border-blue-200/60 dark:border-amber-700/50">
            <Ticket className="w-3.5 h-3.5 text-bce-cobalt dark:text-amber-400 shrink-0" />
            <span>Campus Activities &amp; Programs</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#faebd0] break-words">
            Upcoming College Events
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-[#c4a97d] leading-relaxed">
            Explore workshops, cultural fests, open mics, hackathons, and competitions at {tenant.shortName}. Register online via verified Google Forms.
          </p>
        </div>

        {/* Notice Board */}
        {totalCount === 0 ? (
          <div className="notice-board-wood-frame p-2 sm:p-3 md:p-4 rounded-xl relative overflow-visible border-2 sm:border-[3px] border-[#362013] dark:border-[#22130a] shadow-xl max-w-lg mx-auto">
            <div className="notice-board-felt-surface rounded-lg p-6 sm:p-10 text-center">
              <div className="relative max-w-xs mx-auto bg-[#fdfbf7] dark:bg-[#1a1309] rounded-[3px] p-6 text-center border border-[#dfd7be] dark:border-[#4d3817] shadow-xl text-slate-800 dark:text-[#faebd0]">
                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-[#2b1f10] text-amber-700 dark:text-amber-400 mx-auto flex items-center justify-center mb-2">
                  <Calendar className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-[#faebd0]">No Events Published</h3>
                <p className="text-xs text-slate-600 dark:text-[#c4a97d] mt-1">
                  There are currently no active public events scheduled for {tenant.shortName}. Please check back later!
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="notice-board-wood-frame p-2 sm:p-3 md:p-4 rounded-xl relative overflow-visible border-2 sm:border-[3px] border-[#362013] dark:border-[#22130a] shadow-xl">
            {/* Brass Corner Accents */}
            <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-amber-500/80 pointer-events-none rounded-tl-xs" />
            <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-amber-500/80 pointer-events-none rounded-tr-xs" />
            <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-amber-500/80 pointer-events-none rounded-bl-xs" />
            <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-amber-500/80 pointer-events-none rounded-br-xs" />

            {/* Dark Green Felt Surface with Pinned Circulars */}
            <div className="notice-board-felt-surface rounded-lg p-3 sm:p-5 md:p-6 min-h-[360px]">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 pt-3 pb-1">
                {/* Small Events Configured for this Tenant */}
                {smallEvents.map((event) => (
                  <SmallEventCard
                    key={event.id}
                    event={event}
                    tenantSlug={tenant.slug}
                    institutionDisplayName={tenant.name}
                  />
                ))}

                {/* Any Database-Driven Events for this College */}
                {dbEvents.map((event) => (
                  <PublicEventCard key={event.id} event={event} tenantSlug={tenant.slug} />
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <CollegePublicFooter
        collegeName={tenant.name}
        collegeShortName={tenant.shortName}
        collegeSlug={tenant.slug}
        websiteUrl={tenant.websiteUrl}
        variant="light"
        className="mt-8 sm:mt-12"
      />
    </div>
  );
}

