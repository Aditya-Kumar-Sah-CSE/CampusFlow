import React from 'react';
import Link from 'next/link';
import { Calendar, MapPin, Users, ArrowRight, Sparkles } from 'lucide-react';
import { RedPushpin } from '@/components/ui/RedPushpin';
import type { CollegeEvent } from '@/types/events';

interface Props {
  event: CollegeEvent;
  tenantSlug?: string;
}

export function PublicEventCard({ event, tenantSlug }: Props) {
  const eventHref = tenantSlug
    ? `/${tenantSlug}/events/${event.slug}`
    : `/events/${event.slug}`;
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

  return (
    <div className="notice-paper-card relative rounded-[3px] bg-[#fdfbf7] dark:bg-[#1a1309] border border-[#dfd7be] dark:border-[#4d3817] shadow-md hover:shadow-xl transition-all p-4 sm:p-5 flex flex-col justify-between gap-4 group min-w-0 text-slate-800 dark:text-[#faebd0] overflow-visible">
      {/* 3D Red Pushpin Pinned at Top Center */}
      <RedPushpin className="-top-3" />

      <div className="space-y-3 min-w-0">
        {/* Notice Header & Official Badges Bar */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 pb-2 border-b border-dashed border-slate-200 dark:border-[#382713]">
          {event.payment_required ? (
            <span className="px-2 py-0.5 rounded-xs text-[11px] font-bold bg-amber-50 dark:bg-[#2b1f10] text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-700/60 shrink-0">
              ₹{event.payment_amount} Entry Fee
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-xs text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 shrink-0">
              Free Registration
            </span>
          )}

          {isCancelled ? (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-xs bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 shrink-0 border border-red-200 dark:border-red-800/40">
              Cancelled
            </span>
          ) : isClosedReg ? (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-xs bg-slate-100 dark:bg-[#2e2112] text-slate-700 dark:text-amber-300 shrink-0 border border-slate-200 dark:border-[#523c1c]">
              Closed
            </span>
          ) : isUpcomingReg ? (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-xs bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 shrink-0 border border-blue-200 dark:border-blue-800/40">
              Opens Soon
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-xs bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 animate-pulse shrink-0 border border-emerald-200 dark:border-emerald-800/40">
              Open Now
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#faebd0] group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors break-words line-clamp-2">
          {event.title}
        </h3>

        {/* Key Info */}
        <div className="space-y-1.5 text-xs text-slate-600 dark:text-[#c4a97d]">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
            <span className="truncate">
              {startDate} at {startTime}
            </span>
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
      </div>

      {/* Action Button */}
      <div className="pt-2 border-t border-slate-200 dark:border-[#382713]">
        <Link
          href={eventHref}
          className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 sm:px-4 rounded-xs text-xs sm:text-sm font-bold bg-slate-900 dark:bg-[#342414] text-white dark:text-amber-200 hover:bg-amber-700 dark:hover:bg-[#4a341d] border border-transparent dark:border-amber-600/40 transition-colors shadow-2xs group-hover:shadow-xs text-center"
        >
          <span>View Notice &amp; Register</span>
          <ArrowRight className="w-3.5 h-3.5 shrink-0" />
        </Link>
      </div>
    </div>
  );
}
