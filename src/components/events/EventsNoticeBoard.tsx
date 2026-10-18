'use client';

import React from 'react';
import Link from 'next/link';
import { Calendar, MapPin, Users, ArrowRight, Sparkles, Pin } from 'lucide-react';
import { RedPushpin } from '@/components/ui/RedPushpin';
import type { CollegeEvent } from '@/types/events';

interface EventsNoticeBoardProps {
  events: CollegeEvent[];
  tenantSlug?: string;
  title?: string;
  subtitle?: string;
  className?: string;
}

export function EventsNoticeBoard({
  events,
  tenantSlug,
  title = 'Official Campus Notice Board',
  subtitle = 'Academic Events, Hackathons, Workshops & Cultural Competitions',
  className = '',
}: EventsNoticeBoardProps) {
  return (
    <div className={`relative overflow-visible w-full scroll-mt-28 ${className}`}>
      {/* 1. Wooden Moulding Frame */}
      <div className="notice-board-wood-frame p-2 sm:p-3 md:p-4 rounded-xl relative overflow-visible border-2 sm:border-[3px] border-[#362013] dark:border-[#22130a] shadow-2xl">
        {/* Brass Corner Brackets */}
        <div className="absolute top-1 left-1 w-3.5 h-3.5 border-t-2 border-l-2 border-amber-500/90 pointer-events-none rounded-tl-xs" />
        <div className="absolute top-1 right-1 w-3.5 h-3.5 border-t-2 border-r-2 border-amber-500/90 pointer-events-none rounded-tr-xs" />
        <div className="absolute bottom-1 left-1 w-3.5 h-3.5 border-b-2 border-l-2 border-amber-500/90 pointer-events-none rounded-bl-xs" />
        <div className="absolute bottom-1 right-1 w-3.5 h-3.5 border-b-2 border-r-2 border-amber-500/90 pointer-events-none rounded-br-xs" />

        {/* 2. Top Brass Nameplate / Header Banner */}
        <div className="mx-auto max-w-md text-center mb-4 sm:mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-sm bg-gradient-to-r from-amber-700 via-amber-600 to-amber-800 text-amber-100 border border-amber-400/50 shadow-md">
            <Pin className="w-3.5 h-3.5 text-amber-200" />
            <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-widest">
              {title}
            </span>
          </div>
          {subtitle && (
            <p className="text-[11px] sm:text-xs text-amber-200/80 font-medium mt-1">
              {subtitle}
            </p>
          )}
        </div>

        {/* 3. Dark Green Felt / Bulletin Surface */}
        <div className="notice-board-felt-surface rounded-lg p-3 sm:p-6 md:p-8 min-h-[360px]">
          {events.length === 0 ? (
            /* Empty Notice State */
            <div className="relative max-w-sm mx-auto my-8 bg-[#fdfbf7] dark:bg-[#1a1309] text-slate-800 dark:text-[#faebd0] rounded-[3px] p-6 sm:p-8 text-center border border-[#dfd7be] dark:border-[#4d3817] shadow-xl">
              <RedPushpin className="-top-3" />
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-[#2b1f10] text-amber-700 dark:text-amber-400 mx-auto flex items-center justify-center mb-3">
                <Calendar className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-[#faebd0]">
                No Active Event Notices
              </h4>
              <p className="text-xs text-slate-600 dark:text-[#c4a97d] mt-1">
                There are currently no events pinned to the institutional notice board. Please check back later.
              </p>
            </div>
          ) : (
            /* Pinned Event Notices Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 pt-4 pb-2">
              {events.map((event, index) => {
                const startDate = new Date(event.start_at).toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });

                const startTime = new Date(event.start_at).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                const now = new Date();
                const regStart = new Date(event.registration_start);
                const regEnd = new Date(event.registration_end);

                const isUpcomingReg = now < regStart;
                const isClosedReg = now > regEnd || event.status === 'CLOSED';
                const isCancelled = event.status === 'CANCELLED';

                const rotations = ['-0.75deg', '0.6deg', '-0.5deg', '0.8deg', '-0.6deg', '0.5deg'];
                const delays = ['0s', '1s', '0.5s', '1.5s', '0.8s', '1.2s'];
                const durations = ['5.2s', '6.0s', '5.5s', '6.3s', '5.4s', '5.8s'];

                const rot = rotations[index % rotations.length];
                const delay = delays[index % delays.length];
                const dur = durations[index % durations.length];

                const eventHref = tenantSlug
                  ? `/${tenantSlug}/events/${event.slug}`
                  : `/events/${event.slug}`;

                return (
                  <div
                    key={event.id}
                    style={{
                      ['--notice-rot' as any]: rot,
                      ['--notice-delay' as any]: delay,
                      ['--notice-dur' as any]: dur,
                    }}
                    className="notice-paper-card relative rounded-[3px] p-4 sm:p-5 flex flex-col justify-between group transition-all overflow-visible shadow-md hover:shadow-xl bg-[#fdfbf7] dark:bg-[#1a1309] text-slate-800 dark:text-[#faebd0] border border-[#dfd7be] dark:border-[#4d3817]"
                  >
                    {/* Realistic 3D Red Pushpin Pinned at Top Center */}
                    <RedPushpin className="-top-3" />

                    <div className="space-y-3 min-w-0">
                      {/* Notice Header & Official Badge */}
                      <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-dashed border-slate-300 dark:border-[#382713]">
                        <span className="text-[10px] font-extrabold tracking-wider uppercase text-amber-800 dark:text-amber-400 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Official Notice
                        </span>

                        {isCancelled ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-xs bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/40">
                            Cancelled
                          </span>
                        ) : isClosedReg ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-xs bg-slate-100 dark:bg-[#2e2112] text-slate-700 dark:text-amber-300 border border-slate-200 dark:border-[#523c1c]">
                            Closed
                          </span>
                        ) : isUpcomingReg ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-xs bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                            Opens Soon
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-xs bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 animate-pulse">
                            Open Now
                          </span>
                        )}
                      </div>

                      {/* Event Title */}
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#faebd0] group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors line-clamp-2">
                        {event.title}
                      </h3>

                      {/* Schedule and Location */}
                      <div className="space-y-1.5 text-xs text-slate-600 dark:text-[#c4a97d]">
                        <div className="flex items-center gap-2 min-w-0">
                          <Calendar className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                          <span className="truncate">{startDate} at {startTime}</span>
                        </div>

                        <div className="flex items-center gap-2 min-w-0">
                          <MapPin className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                          <span className="truncate">{event.venue}</span>
                        </div>

                        {event.max_capacity && (
                          <div className="flex items-center gap-2 min-w-0">
                            <Users className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                            <span className="truncate">Limit: {event.max_capacity} Seats</span>
                          </div>
                        )}
                      </div>

                      {/* Fee Badge */}
                      <div className="pt-1">
                        {event.payment_required ? (
                          <span className="inline-block px-2 py-0.5 rounded-xs text-[11px] font-bold bg-amber-50 dark:bg-[#2b1f10] text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-700/60">
                            ₹{event.payment_amount} Registration Fee
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-xs text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                            Free Registration
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Notice Action Button */}
                    <div className="pt-3 mt-3 border-t border-slate-200 dark:border-[#382713]">
                      <Link
                        href={eventHref}
                        className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xs text-xs font-bold bg-slate-900 dark:bg-[#342414] text-white dark:text-amber-200 hover:bg-amber-700 dark:hover:bg-[#4a341d] border border-transparent dark:border-amber-600/40 transition-colors shadow-xs"
                      >
                        <span>View Notice &amp; Register</span>
                        <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EventsNoticeBoard;
