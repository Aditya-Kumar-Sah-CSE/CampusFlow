import React from 'react';
import Link from 'next/link';
import { Calendar, MapPin, Users, ArrowRight } from 'lucide-react';
import type { CollegeEvent } from '@/types/events';

interface Props {
  event: CollegeEvent;
  tenantSlug: string;
}

export function PublicEventCard({ event, tenantSlug }: Props) {
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
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all duration-200 p-4 sm:p-5 flex flex-col justify-between gap-4 group min-w-0">
      <div className="space-y-3 min-w-0">
        {/* Badges Bar */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
          {event.payment_required ? (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 shrink-0">
              ₹{event.payment_amount} Registration Fee
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
              Free Registration
            </span>
          )}

          {isCancelled ? (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-100 text-red-800 shrink-0">
              Cancelled
            </span>
          ) : isClosedReg ? (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">
              Registration Closed
            </span>
          ) : isUpcomingReg ? (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800 shrink-0">
              Opens Soon
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 animate-pulse shrink-0">
              Open Now
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-bce-cobalt transition-colors break-words line-clamp-2">
          {event.title}
        </h3>

        {/* Key Info */}
        <div className="space-y-1.5 text-xs text-slate-600">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">
              {startDate} at {startTime}
            </span>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{event.venue}</span>
          </div>

          {event.max_capacity && (
            <div className="flex items-center gap-2 min-w-0">
              <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">Limited to {event.max_capacity} Seats</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Button */}
      <div className="pt-2 border-t border-slate-100">
        <Link
          href={`/${tenantSlug}/events/${event.slug}`}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold bg-slate-900 text-white hover:bg-bce-cobalt transition-colors shadow-2xs group-hover:shadow-xs text-center"
        >
          <span>View Details &amp; Register</span>
          <ArrowRight className="w-3.5 h-3.5 shrink-0" />
        </Link>
      </div>
    </div>
  );
}
