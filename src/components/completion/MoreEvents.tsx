'use client';

import React from 'react';
import Link from 'next/link';
import { Calendar, MapPin, ArrowRight, Sparkles } from 'lucide-react';
import type { CollegeEvent } from '@/types/events';

interface Props {
  events: CollegeEvent[];
  collegeSlug?: string;
  collegeName?: string;
}

export function MoreEvents({ events, collegeSlug, collegeName }: Props) {
  if (!events || events.length === 0) {
    return null; // Zero fake recommendations: strictly hide when no other events exist
  }

  const allEventsPath = collegeSlug ? `/${collegeSlug}/events` : '/events';

  return (
    <section id="more-events" className="w-full space-y-4 pt-8 border-t border-slate-200/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 tracking-tight uppercase">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Explore More Events</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Upcoming campus events and competitions at {collegeName || 'your institution'}.
          </p>
        </div>

        <Link
          href={allEventsPath}
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors self-start sm:self-auto"
        >
          <span>View All Events</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {events.slice(0, 4).map((evt) => {
          const eventLink = collegeSlug
            ? `/${collegeSlug}/events/${evt.slug}`
            : `/events/${evt.slug}`;

          const startDateStr = evt.start_at
            ? new Date(evt.start_at).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : 'Upcoming';

          return (
            <div
              key={evt.id}
              className="bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all flex flex-col justify-between group"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
                    {evt.title}
                  </h4>
                  <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                    {evt.registration_label || 'Campus Event'}
                  </span>
                </div>

                {evt.description && (
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {evt.description}
                  </p>
                )}

                <div className="space-y-1 text-xs text-slate-600 bg-slate-50/80 rounded-lg p-2.5 border border-slate-100">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-600 truncate">
                    <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span>{startDateStr}</span>
                  </div>
                  {evt.venue && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{evt.venue}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-3 mt-1 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                  Registrations Open
                </span>
                <Link
                  href={eventLink}
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <span>Explore Event</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
