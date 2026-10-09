'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  Ticket,
  ArrowLeft,
  Lock,
  ExternalLink,
} from 'lucide-react';
import type { CollegeEvent } from '@/types/events';
import type { Branch, Semester } from '@/types/database';
import type { TenantContext } from '@/types/tenant';
import { StudentRegistrationModal } from './StudentRegistrationModal';

interface Props {
  event: CollegeEvent;
  tenant: TenantContext;
  branches: Branch[];
  semesters: Semester[];
}

export function PublicEventDetailClient({ event, tenant, branches, semesters }: Props) {
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  const now = new Date();
  const regStart = new Date(event.registration_start);
  const effectiveDeadline = event.registration_deadline || event.registration_end;
  const regEnd = new Date(effectiveDeadline);

  const isUpcoming = now < regStart;
  const isPastDeadline = now > regEnd;
  const isClosed = event.status === 'CLOSED';
  const isCancelled = event.status === 'CANCELLED';

  const isFull =
    event.max_capacity !== null &&
    (event.active_registrations_count || 0) >= event.max_capacity;

  const canRegister =
    event.status === 'PUBLISHED' &&
    event.registration_enabled &&
    !isUpcoming &&
    !isPastDeadline &&
    !isFull;

  const isGoogleForm =
    event.registration_type === 'google_form' && Boolean(event.google_form_url);
  const registerButtonLabel = event.registration_label || 'Register Now';

  const availableSeats =
    event.max_capacity !== null
      ? Math.max(0, event.max_capacity - (event.active_registrations_count || 0))
      : null;

  const eventDateFormatted = new Date(event.start_at).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const eventTimeFormatted = `${new Date(event.start_at).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })} - ${new Date(event.end_at).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  const deadlineFormatted = regEnd.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <div>
        <Link
          href={`/${tenant.slug}/events`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All {tenant.shortName} Events</span>
        </Link>
      </div>

      {/* Main Event Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
        {/* Badges Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {event.payment_required ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                ₹{event.payment_amount} Registration Fee
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                Free Registration
              </span>
            )}
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
              {tenant.shortName} Event
            </span>
          </div>

          <div>
            {isCancelled ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-red-100 text-red-800">
                Event Cancelled
              </span>
            ) : isClosed ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-slate-100 text-slate-700">
                Registration Closed
              </span>
            ) : isFull ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-red-100 text-red-800">
                Capacity Reached
              </span>
            ) : isPastDeadline ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-amber-100 text-amber-800">
                Deadline Expired
              </span>
            ) : isUpcoming ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-blue-100 text-blue-800">
                Opens {new Date(event.registration_start).toLocaleDateString('en-IN')}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-emerald-100 text-emerald-800 animate-pulse">
                Registration Open
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 leading-tight break-words">
          {event.title}
        </h1>

        {/* Key Logistics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 p-4 sm:p-5 bg-slate-50/80 rounded-xl sm:rounded-2xl border border-slate-200/80 text-xs">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-bce-cobalt shrink-0" />
              <span>Date</span>
            </span>
            <p className="font-bold text-slate-900 break-words">{eventDateFormatted}</p>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-bce-cobalt shrink-0" />
              <span>Time</span>
            </span>
            <p className="font-bold text-slate-900 break-words">{eventTimeFormatted}</p>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-bce-cobalt shrink-0" />
              <span>Venue</span>
            </span>
            <p className="font-bold text-slate-900 break-words">{event.venue}</p>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-bce-cobalt shrink-0" />
              <span>Seats Available</span>
            </span>
            <p className="font-bold text-slate-900">
              {availableSeats !== null ? `${availableSeats} Seats left` : 'Open Enrollment'}
            </p>
          </div>
        </div>

        {/* Description */}
        {event.description && (
          <div className="space-y-2 border-t border-slate-100 pt-4 sm:pt-5">
            <h3 className="text-sm font-bold text-slate-900">About the Event</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line break-words">
              {event.description}
            </p>
          </div>
        )}

        {/* Registration CTA Bar (Only displayed if registration is enabled) */}
        {event.registration_enabled && (
          <div className="border-t border-slate-100 pt-4 sm:pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              Registration Deadline: <span className="font-semibold text-slate-800">{deadlineFormatted}</span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <a
                href="#identity"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300/90 text-xs sm:text-sm font-bold rounded-xl sm:rounded-2xl transition-all shadow-xs hover:shadow-sm active:scale-95 cursor-pointer text-center"
              >
                <Ticket className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>Already Registered? Download Pass</span>
              </a>

              {canRegister ? (
                isGoogleForm ? (
                  event.google_form_url ? (
                    <a
                      href={event.google_form_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        if (typeof navigator !== 'undefined' && !navigator.onLine) {
                          e.preventDefault();
                          alert('Registration requires an active internet connection to open Google Forms.');
                        }
                      }}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-bce-cobalt to-slate-900 hover:from-slate-900 hover:to-bce-cobalt text-white text-xs sm:text-sm font-bold rounded-xl sm:rounded-2xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95 cursor-pointer text-center"
                    >
                      <span>{registerButtonLabel} &rarr;</span>
                      <ExternalLink className="w-4 h-4 shrink-0" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 bg-slate-200 text-slate-500 text-xs sm:text-sm font-semibold rounded-xl sm:rounded-2xl cursor-not-allowed text-center"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Registration temporarily unavailable</span>
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsRegisterOpen(true)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-2.5 sm:py-3 bg-bce-cobalt hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl sm:rounded-2xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95 cursor-pointer text-center"
                  >
                    <Ticket className="w-4 h-4" />
                    <span>{registerButtonLabel}</span>
                  </button>
                )
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 bg-slate-200 text-slate-500 text-xs sm:text-sm font-semibold rounded-xl sm:rounded-2xl cursor-not-allowed text-center"
                >
                  <Lock className="w-4 h-4" />
                  <span>
                    {isCancelled
                      ? 'Event Cancelled'
                      : isClosed || isPastDeadline
                      ? 'Registration Closed'
                      : event.registration_type === 'google_form' && (!event.google_form_url || event.google_registration_status === 'ERROR')
                      ? 'Registration temporarily unavailable'
                      : isUpcoming
                      ? `Opens ${new Date(event.registration_start).toLocaleDateString('en-IN')}`
                      : isFull
                      ? 'Capacity Reached'
                      : 'Registration Closed'}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Student Registration Modal */}
      <StudentRegistrationModal
        event={event}
        tenantSlug={tenant.slug}
        branches={branches}
        semesters={semesters}
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
      />
    </div>
  );
}
