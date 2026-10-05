import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { RootPublicNavbar } from '@/components/layout/RootPublicNavbar';
import { getSmallEventsGroupedByInstitution } from '@/config/events';
import { SmallEventCard } from '@/components/events/SmallEventCard';
import { Calendar, MapPin, Ticket, ArrowRight, Sparkles, Building2 } from 'lucide-react';
import type { CollegeEvent } from '@/types/events';

export const dynamic = 'force-dynamic';

async function getAllPublishedEvents(): Promise<(CollegeEvent & { college?: { name: string; slug: string; code?: string; logo_url?: string | null } })[]> {
  try {
    const supabase = createAdminClient() || await createClient();
    const { data, error } = await supabase
      .from('events')
      .select('*, college:colleges(name, slug, code, logo_url)')
      .eq('status', 'PUBLISHED')
      .order('start_at', { ascending: true });

    if (error || !data) return [];
    return data as any;
  } catch {
    return [];
  }
}

export default async function PublicEventsDirectoryPage() {
  const [dbEvents, institutionGroups] = await Promise.all([
    getAllPublishedEvents(),
    Promise.resolve(getSmallEventsGroupedByInstitution()),
  ]);

  const totalSmallEvents = institutionGroups.reduce((acc, g) => acc + g.events.length, 0);
  const totalEvents = totalSmallEvents + dbEvents.length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <RootPublicNavbar />

      <main className="flex-1 max-w-6xl mx-auto w-full px-3 sm:px-6 py-6 sm:py-12 space-y-8 sm:space-y-12">
        {/* Hero Header */}
        <div className="text-center max-w-2xl mx-auto space-y-2 sm:space-y-3 px-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200/60">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Campus Activities &amp; Fests</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight break-words">
            Campus Events &amp; Competitions
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Discover workshops, open mics, hackathons, and cultural fests across participating colleges. Register online instantly via verified Google Forms.
          </p>
        </div>

        {totalEvents === 0 ? (
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-6 sm:p-12 text-center max-w-md mx-auto space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No Events Scheduled</h3>
            <p className="text-xs text-slate-500">
              There are currently no active public events published. Please check back later!
            </p>
          </div>
        ) : (
          <div className="space-y-10 sm:space-y-14">
            {/* Institution Sections */}
            {institutionGroups.map((group) => {
              if (group.events.length === 0) return null;

              return (
                <section key={group.institutionId} className="space-y-4">
                  {/* Institution Group Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold border border-blue-100 shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                          {group.institutionName}
                        </h2>
                        <span className="text-xs text-slate-500 font-medium">
                          {group.institutionCode} &bull; {group.events.length} active events
                        </span>
                      </div>
                    </div>

                    <Link
                      href={`/${group.institutionSlug}/events`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors self-start sm:self-auto"
                    >
                      <span>Explore all {group.institutionCode} Events</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {/* Grid of Small Event Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {group.events.map((event) => (
                      <SmallEventCard
                        key={event.id}
                        event={event}
                        tenantSlug={group.institutionSlug}
                        institutionDisplayName={group.institutionName}
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            {/* Additional Database Published Events (if any) */}
            {dbEvents.length > 0 && (
              <section className="space-y-4 pt-6 border-t border-slate-200">
                <div className="pb-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    Additional Campus Programs
                  </h2>
                  <p className="text-xs text-slate-500">Other university programs and sessions</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {dbEvents.map((event) => {
                    const startDate = new Date(event.start_at).toLocaleDateString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    });

                    return (
                      <div
                        key={event.id}
                        className="bg-white rounded-2xl border border-slate-200 hover:border-blue-400 shadow-xs hover:shadow-md transition-all flex flex-col overflow-hidden group min-w-0"
                      >
                        <div className="p-4 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
                          <div className="space-y-2 min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
                              <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100 truncate max-w-[180px]">
                                {event.college?.code || event.college?.name || 'Campus Event'}
                              </span>
                              {event.payment_required ? (
                                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 shrink-0">
                                  ₹{event.payment_amount}
                                </span>
                              ) : (
                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                                  Free Entry
                                </span>
                              )}
                            </div>

                            <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors break-words line-clamp-2">
                              {event.title}
                            </h3>

                            {event.description && (
                              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed break-words">
                                {event.description}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                            <div className="flex items-center gap-2 min-w-0">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{startDate}</span>
                            </div>
                            <div className="flex items-center gap-2 min-w-0">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{event.venue}</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-50/80 px-4 py-3 sm:px-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                            <Ticket className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Programs &amp; Details
                          </span>
                          <Link
                            href={`/events/${event.slug}`}
                            className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors ml-auto sm:ml-0"
                          >
                            <span>View Event</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-6xl mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} CampusFlow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
