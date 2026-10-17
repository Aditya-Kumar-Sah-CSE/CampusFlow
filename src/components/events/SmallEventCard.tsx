'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, MapPin, ExternalLink, ArrowRight, Clock, Building2, Tag, WifiOff } from 'lucide-react';
import { RedPushpin } from '@/components/ui/RedPushpin';
import type { SmallEvent } from '@/config/events';

interface Props {
  event: SmallEvent;
  tenantSlug?: string;
  institutionDisplayName?: string;
}

export function SmallEventCard({ event, tenantSlug, institutionDisplayName }: Props) {
  const [isOnline, setIsOnline] = useState(true);
  const [offlineNotice, setOfflineNotice] = useState(false);

  useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

    const handleOnline = () => {
      setIsOnline(true);
      setOfflineNotice(false);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const formattedDate = new Date(event.date).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const detailHref = tenantSlug
    ? `/${tenantSlug}/events/${event.id}`
    : `/events/${event.id}`;

  const isClosed = event.status === 'COMPLETED' || event.status === 'CANCELLED';
  const hasDeadlinePassed = event.registrationDeadline
    ? new Date() > new Date(event.registrationDeadline)
    : false;

  const canRegister = event.registrationEnabled && !isClosed && !hasDeadlinePassed;

  const handleRegisterClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isOnline) {
      setOfflineNotice(true);
      return;
    }
    window.open(event.registrationUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <article className="notice-paper-card relative rounded-[3px] bg-[#fdfbf7] dark:bg-[#1a1309] border border-[#dfd7be] dark:border-[#4d3817] shadow-md hover:shadow-xl transition-all flex flex-col justify-between overflow-visible group min-w-0 text-slate-800 dark:text-[#faebd0]">
      {/* 3D Red Pushpin Pinned at Top Center */}
      <RedPushpin className="-top-3" />

      {/* Banner / Category Header */}
      <div className="relative h-40 sm:h-44 w-full bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 overflow-hidden shrink-0 rounded-t-[2px]">
        {event.banner && (
          <Image
            src={event.banner}
            alt={event.title}
            fill
            className="object-cover opacity-60 group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xs text-[11px] font-bold bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-white backdrop-blur-xs shadow-xs">
            <Tag className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>{event.category}</span>
          </span>

          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-xs shadow-xs ${
              isClosed || hasDeadlinePassed
                ? 'bg-slate-800/90 text-slate-300'
                : 'bg-emerald-600 text-white animate-pulse'
            }`}
          >
            {isClosed ? 'Closed' : hasDeadlinePassed ? 'Reg Closed' : 'Open'}
          </span>
        </div>

        {/* Institution Badge on Image */}
        <div className="absolute bottom-3 left-3 right-3 z-10">
          <div className="flex items-center gap-1.5 text-xs text-amber-300 font-semibold drop-shadow-sm">
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{institutionDisplayName || event.organizer}</span>
          </div>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-4">
        <div className="space-y-2.5">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#faebd0] group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors break-words line-clamp-2">
            {event.title}
          </h3>

          <p className="text-xs text-slate-600 dark:text-[#c4a97d] line-clamp-2 leading-relaxed">
            {event.shortDescription}
          </p>

          {/* Key Event Logistics */}
          <div className="pt-2 space-y-1.5 text-xs text-slate-600 dark:text-[#c4a97d] border-t border-slate-200 dark:border-[#382713]">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
              <span>{formattedDate}</span>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
              <span className="truncate">
                {event.startTime} {event.endTime ? `– ${event.endTime}` : ''}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
              <span className="truncate">{event.venue}</span>
            </div>
          </div>
        </div>

        {/* Offline Warning if triggered */}
        {offlineNotice && (
          <div className="p-2.5 rounded-xs bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 text-[11px] flex items-center gap-2 animate-fade-in">
            <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Registration requires an internet connection.</span>
          </div>
        )}

        {/* Dual CTA Buttons: View Details & Register Now */}
        <div className="pt-3 border-t border-slate-200 dark:border-[#382713] grid grid-cols-2 gap-2">
          <Link
            href={detailHref}
            className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xs text-xs font-semibold bg-slate-100 dark:bg-[#251b11] hover:bg-slate-200 dark:hover:bg-[#342414] text-slate-800 dark:text-[#faebd0] border border-slate-200/80 dark:border-[#4d3817] transition-colors text-center cursor-pointer"
          >
            <span>Notice</span>
            <ArrowRight className="w-3 h-3 shrink-0" />
          </Link>

          {canRegister ? (
            <button
              onClick={handleRegisterClick}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xs text-xs font-bold bg-amber-600 hover:bg-amber-700 dark:bg-[#4a341d] dark:hover:bg-[#5e4225] text-white dark:text-amber-100 transition-all shadow-xs hover:shadow-sm active:scale-98 text-center cursor-pointer border border-transparent dark:border-amber-600/40"
              title="Open Google Form in a new tab"
            >
              <span>{event.registrationLabel || 'Register'}</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </button>
          ) : (
            <button
              disabled
              className="inline-flex items-center justify-center gap-1 py-2 px-3 rounded-xs text-xs font-semibold bg-slate-100 dark:bg-[#20170f] text-slate-400 dark:text-[#6a5336] cursor-not-allowed text-center"
            >
              <span>Closed</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
