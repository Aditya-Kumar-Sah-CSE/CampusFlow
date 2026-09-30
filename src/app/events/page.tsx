import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { RootPublicNavbar } from '@/components/layout/RootPublicNavbar';
import { Calendar, MapPin, Ticket, ArrowRight, Sparkles } from 'lucide-react';
import type { CollegeEvent } from '@/types/events';

export const dynamic = 'force-dynamic';

async function getAllPublishedEvents(): Promise<(CollegeEvent & { college?: { name: string; slug: string; code?: string } })[]> {
  const supabase = createAdminClient() || await createClient();
  const { data, error } = await supabase
    .from('events')
    .select('*, college:colleges(name, slug, code)')
    .eq('status', 'PUBLISHED')
    .order('start_at', { ascending: true });

  if (error || !data) return [];
  return data as any;
}

export default async function PublicEventsDirectoryPage() {
  const events = await getAllPublishedEvents();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <RootPublicNavbar />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Hero Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200/60">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Campus Activities &amp; Fests</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            College Events &amp; Competitions
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Discover workshops, sports tournaments, technical hackathons, and cultural fests across participating colleges. Register online with instant verification.
          </p>
        </div>

        {/* Events Grid */}
        {events.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center max-w-md mx-auto space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No Events Scheduled</h3>
            <p className="text-xs text-slate-500">
              There are currently no active public events published. Please check back later!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => {
              const startDate = new Date(event.start_at).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <div
                  key={event.id}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-blue-400 shadow-xs hover:shadow-md transition-all flex flex-col overflow-hidden group"
                >
                  <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                          {event.college?.code || event.college?.name || 'Campus Event'}
                        </span>
                        {event.payment_required ? (
                          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            ₹{event.payment_amount}
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            Free Entry
                          </span>
                        )}
                      </div>

                      <h2 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                        {event.title}
                      </h2>

                      {event.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {event.description}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{startDate}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{event.venue}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50/80 px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <Ticket className="w-3.5 h-3.5 text-blue-500" /> Programs &amp; Details
                    </span>
                    <Link
                      href={`/events/${event.slug}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <span>View Event</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-6xl mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} CampusFlow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
