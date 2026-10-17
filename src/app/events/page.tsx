import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { RootPublicNavbar } from '@/components/layout/RootPublicNavbar';
import { CollegePublicFooter } from '@/components/layout/CollegePublicFooter';
import { getSmallEventsGroupedByInstitution } from '@/config/events';
import { SmallEventCard } from '@/components/events/SmallEventCard';
import { PublicEventCard } from '@/components/events/PublicEventCard';
import { Calendar, ArrowRight, Sparkles, Building2, Pin } from 'lucide-react';
import type { CollegeEvent } from '@/types/events';

import { unstable_cache } from 'next/cache';

export const revalidate = 300;

async function fetchAllPublishedEventsDirect(): Promise<(CollegeEvent & { college?: { name: string; slug: string; code?: string; logo_url?: string | null } })[]> {
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

const getCachedAllPublishedEvents = unstable_cache(
  fetchAllPublishedEventsDirect,
  ['all_published_events_cache'],
  { revalidate: 300, tags: ['events'] }
);

async function getAllPublishedEvents() {
  try {
    return await getCachedAllPublishedEvents();
  } catch {
    return fetchAllPublishedEventsDirect();
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
    <div className="min-h-screen flex flex-col bg-transparent text-slate-800 dark:text-slate-100 transition-colors duration-200">
      <RootPublicNavbar />

      <main className="flex-1 max-w-6xl mx-auto w-full px-3 sm:px-6 py-6 sm:py-10 space-y-8 sm:space-y-10">
        {/* Hero Header */}
        <div className="text-center max-w-2xl mx-auto space-y-2 sm:space-y-3 px-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[3px] bg-blue-50 dark:bg-amber-950/60 text-bce-cobalt dark:text-amber-300 text-xs font-semibold border border-blue-200/60 dark:border-amber-700/50">
            <Sparkles className="w-3.5 h-3.5 text-bce-cobalt dark:text-amber-400 shrink-0" />
            <span>Campus Activities &amp; Fests</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-[#faebd0] tracking-tight break-words">
            Official Campus Notice Board
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-[#c4a97d] leading-relaxed">
            Discover workshops, hackathons, and cultural fests pinned to participating college bulletin boards. Register online instantly via verified college forms.
          </p>
        </div>

        {totalEvents === 0 ? (
          <div className="notice-board-wood-frame p-2 sm:p-3 md:p-4 rounded-xl relative overflow-visible border-2 sm:border-[3px] border-[#362013] dark:border-[#22130a] shadow-xl max-w-md mx-auto">
            <div className="notice-board-felt-surface rounded-lg p-6 sm:p-10 text-center">
              <div className="relative max-w-xs mx-auto bg-[#fdfbf7] dark:bg-[#1a1309] rounded-[3px] p-6 text-center border border-[#dfd7be] dark:border-[#4d3817] shadow-xl text-slate-800 dark:text-[#faebd0]">
                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-[#2b1f10] text-amber-700 dark:text-amber-400 mx-auto flex items-center justify-center mb-2">
                  <Calendar className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-[#faebd0]">No Events Scheduled</h3>
                <p className="text-xs text-slate-600 dark:text-[#c4a97d] mt-1">
                  There are currently no active public events published. Please check back later!
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-10 sm:space-y-14">
            {/* Institution Sections with Authentic Wooden Bulletin Board Frame */}
            {institutionGroups.map((group) => {
              if (group.events.length === 0) return null;

              return (
                <section key={group.institutionId} className="space-y-3">
                  {/* Institution Group Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-amber-900/30 dark:border-[#4d3817]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-[3px] bg-amber-600/15 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold border border-amber-600/30 dark:border-amber-600/40 shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#faebd0]">
                          {group.institutionName}
                        </h2>
                        <span className="text-xs text-slate-600 dark:text-[#c4a97d] font-medium">
                          {group.institutionCode} &bull; {group.events.length} active notices pinned
                        </span>
                      </div>
                    </div>

                    <Link
                      href={`/${group.institutionSlug}/events`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 transition-colors self-start sm:self-auto"
                    >
                      <span>Explore all {group.institutionCode} Events</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {/* Wooden Bulletin Board with Dark Green Felt and Pinned Sheets */}
                  <div className="notice-board-wood-frame p-2 sm:p-3 md:p-4 rounded-xl relative overflow-visible border-2 sm:border-[3px] border-[#362013] dark:border-[#22130a] shadow-xl">
                    {/* Brass Corner Accents */}
                    <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-amber-500/80 pointer-events-none rounded-tl-xs" />
                    <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-amber-500/80 pointer-events-none rounded-tr-xs" />
                    <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-amber-500/80 pointer-events-none rounded-bl-xs" />
                    <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-amber-500/80 pointer-events-none rounded-br-xs" />

                    <div className="notice-board-felt-surface rounded-lg p-3 sm:p-5 md:p-6 min-h-[320px]">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 pt-3 pb-1">
                        {group.events.map((event) => (
                          <SmallEventCard
                            key={event.id}
                            event={event}
                            tenantSlug={group.institutionSlug}
                            institutionDisplayName={group.institutionName}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}

            {/* Additional Database Published Events (if any) */}
            {dbEvents.length > 0 && (
              <section className="space-y-3 pt-6 border-t border-amber-900/30 dark:border-[#4d3817]">
                <div className="pb-2 flex items-center justify-between">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#faebd0] flex items-center gap-1.5">
                      <Pin className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                      <span>Additional Campus Circulars</span>
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-[#c4a97d]">Other university sessions and public event notices</p>
                  </div>
                </div>

                <div className="notice-board-wood-frame p-2 sm:p-3 md:p-4 rounded-xl relative overflow-visible border-2 sm:border-[3px] border-[#362013] dark:border-[#22130a] shadow-xl">
                  {/* Brass Corner Accents */}
                  <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-amber-500/80 pointer-events-none rounded-tl-xs" />
                  <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-amber-500/80 pointer-events-none rounded-tr-xs" />
                  <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-amber-500/80 pointer-events-none rounded-bl-xs" />
                  <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-amber-500/80 pointer-events-none rounded-br-xs" />

                  <div className="notice-board-felt-surface rounded-lg p-3 sm:p-5 md:p-6 min-h-[320px]">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 pt-3 pb-1">
                      {dbEvents.map((event) => (
                        <PublicEventCard
                          key={event.id}
                          event={event}
                          tenantSlug={event.college?.slug}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <CollegePublicFooter variant="dark" className="mt-12" />
    </div>
  );
}
