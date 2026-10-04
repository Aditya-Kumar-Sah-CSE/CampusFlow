'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
  Building2,
  Tag,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  WifiOff,
  Share2,
} from 'lucide-react';
import type { SmallEvent } from '@/config/events';

interface Props {
  event: SmallEvent;
  tenantSlug?: string;
  institutionDisplayName?: string;
  backHref: string;
}

export function SmallEventDetailView({
  event,
  institutionDisplayName,
  backHref,
}: Props) {
  const [isOnline, setIsOnline] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const formattedDate = new Date(event.date).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const isClosed = event.status === 'COMPLETED' || event.status === 'CANCELLED';
  const hasDeadlinePassed = event.registrationDeadline
    ? new Date() > new Date(event.registrationDeadline)
    : false;
  const canRegister = event.registrationEnabled && !isClosed && !hasDeadlinePassed;

  const handleRegisterClick = () => {
    if (!isOnline) {
      alert('Registration requires an active internet connection to open Google Forms.');
      return;
    }
    window.open(event.registrationUrl, '_blank', 'noopener,noreferrer');
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: event.shortDescription,
          url: window.location.href,
        });
      } catch {
        // Ignored if cancelled
      }
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full px-3 sm:px-6 py-6 sm:py-10 space-y-6 animate-fade-in">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 py-1.5 px-3 rounded-xl transition-colors shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Events</span>
        </Link>

        <button
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 py-1.5 px-3 rounded-xl transition-colors shadow-2xs cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5 text-slate-500" />
          <span>{copied ? 'Link Copied!' : 'Share Event'}</span>
        </button>
      </div>

      {/* Offline Alert if disconnected */}
      {!isOnline && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-start gap-3 shadow-xs">
          <WifiOff className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">You&apos;re currently offline</p>
            <p className="text-amber-800 text-xs leading-relaxed">
              Viewing cached event information. Opening Google Form registration requires an internet connection.
            </p>
          </div>
        </div>
      )}

      {/* Main Event Card */}
      <article className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Banner Hero */}
        <div className="relative h-56 sm:h-80 w-full bg-slate-950 overflow-hidden">
          {event.banner && (
            <Image
              src={event.banner}
              alt={event.title}
              fill
              priority
              className="object-cover opacity-60"
              sizes="(max-width: 1024px) 100vw, 896px"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

          {/* Badges Overlay */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2 z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/95 text-slate-900 backdrop-blur-xs shadow-md">
              <Tag className="w-3.5 h-3.5 text-blue-600" />
              <span>{event.category}</span>
            </span>

            <span
              className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-md ${
                isClosed || hasDeadlinePassed
                  ? 'bg-slate-800 text-slate-300'
                  : 'bg-emerald-500 text-white'
              }`}
            >
              {isClosed ? 'Event Completed' : hasDeadlinePassed ? 'Registration Closed' : 'Registration Active'}
            </span>
          </div>

          {/* Title & Organizer on Hero */}
          <div className="absolute bottom-5 left-5 right-5 z-10 space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-amber-300 font-semibold drop-shadow-sm">
              <Building2 className="w-4 h-4 shrink-0" />
              <span>{institutionDisplayName || event.organizer}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight drop-shadow-md">
              {event.title}
            </h1>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-8 space-y-6 sm:space-y-8">
          {/* Key Logistics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs sm:text-sm">
            <div className="flex items-start gap-2.5">
              <Calendar className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Date</span>
                <span className="font-bold text-slate-900">{formattedDate}</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Time</span>
                <span className="font-bold text-slate-900">
                  {event.startTime} {event.endTime ? `– ${event.endTime}` : ''}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Venue</span>
                <span className="font-bold text-slate-900">{event.venue}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-4 text-slate-700 leading-relaxed text-sm sm:text-base">
            <h2 className="text-lg font-bold text-slate-900">About this Event</h2>
            <div className="whitespace-pre-line text-slate-600 leading-relaxed space-y-2">
              {event.description}
            </div>
          </div>

          {/* Registration Box */}
          <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <h3 className="text-base font-bold text-slate-900 flex items-center justify-center sm:justify-start gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span>Google Form Registration</span>
              </h3>
              <p className="text-xs text-slate-600 max-w-md">
                Fast and verified submission. Form responses and participant data are collected directly in the college Google Form.
              </p>
              {event.registrationDeadline && (
                <p className="text-[11px] text-slate-500">
                  Deadline:{' '}
                  <strong className="text-slate-700">
                    {new Date(event.registrationDeadline).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </strong>
                </p>
              )}
            </div>

            {canRegister ? (
              <button
                onClick={handleRegisterClick}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-md hover:shadow-lg active:scale-98 cursor-pointer shrink-0"
              >
                <span>{event.registrationLabel || 'Register Now'}</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-200 text-slate-600 shrink-0">
                <AlertCircle className="w-4 h-4 text-slate-500" />
                <span>Registration Closed</span>
              </div>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
