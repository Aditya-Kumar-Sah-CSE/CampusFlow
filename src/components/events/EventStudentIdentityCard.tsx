'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  UserCheck,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Ticket,
  ArrowRight,
  LogOut,
  Sparkles,
} from 'lucide-react';
import type { CollegeEvent } from '@/types/events';
import type { EventSessionPayload } from '@/lib/events/event-session';
import {
  identifyStudentAction,
  logoutFromEventAction,
} from '@/app/admin/events/event-registration-actions';

interface Props {
  event: CollegeEvent;
  initialSession: EventSessionPayload | null;
  tenantSlug?: string;
}

export function EventStudentIdentityCard({ event, initialSession, tenantSlug }: Props) {
  const basePath = tenantSlug ? `/${tenantSlug}/events/${event.slug}` : `/events/${event.slug}`;
  const registerEventPath = `${basePath}/register`;
  const myRegistrationsPath = `${basePath}/my-registrations`;

  // State
  const [participant, setParticipant] = useState<{
    fullName: string;
    registrationNumber: string;
    email: string;
    studentId: string;
    mobile?: string;
    branch?: string;
    semester?: string;
  } | null>(
    initialSession
      ? {
          fullName: initialSession.fullName,
          registrationNumber: initialSession.registrationNumber,
          email: initialSession.email,
          studentId: initialSession.studentId,
          mobile: initialSession.mobile,
          branch: initialSession.branch,
          semester: initialSession.semester,
        }
      : null
  );

  const [identifierInput, setIdentifierInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notFoundQuery, setNotFoundQuery] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // IDENTIFY STUDENT (Email / Registration Number / Roll Number)
  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNotFoundQuery(null);

    const cleanInput = identifierInput.trim();
    if (!cleanInput) {
      setErrorMsg('Please enter your Email Address or Event Registration Number.');
      return;
    }

    setLoading(true);
    try {
      const res = await identifyStudentAction({
        eventId: event.id,
        identifier: cleanInput,
      });

      if (res.success && res.isRegistered && res.participant) {
        setParticipant(res.participant);
        setErrorMsg(null);
        setNotFoundQuery(null);
      } else {
        setNotFoundQuery(cleanInput);
        setErrorMsg(res.error || `No event registration found for "${cleanInput}".`);
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to verify registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // LOGOUT / SWITCH STUDENT
  const handleSwitchStudent = async () => {
    try {
      await logoutFromEventAction(event.id);
    } catch {
      // non-fatal
    }
    setParticipant(null);
    setIdentifierInput('');
    setErrorMsg(null);
    setNotFoundQuery(null);
  };

  const handleCopy = () => {
    if (participant?.registrationNumber) {
      navigator.clipboard.writeText(participant.registrationNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const scrollToPrograms = () => {
    const el = document.getElementById('programs');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // ============================================================
  // VIEW 1: ALREADY REGISTERED / IDENTIFIED STUDENT
  // ============================================================
  if (participant) {
    return (
      <div className="bg-gradient-to-br from-emerald-900/90 via-slate-900 to-slate-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-emerald-500/30 relative overflow-hidden animate-in fade-in duration-300">
        {/* Decorative backdrop light */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-5">
          {/* Header Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Event Registration Verified</span>
              </span>
              <span className="text-[11px] text-slate-400">Google Sheet: EVENT_REGISTRATIONS</span>
            </div>

            <button
              onClick={handleSwitchStudent}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Switch Student</span>
            </button>
          </div>

          {/* Student Info Card */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            <div className="sm:col-span-8 space-y-2">
              <div className="text-xs text-emerald-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Identified Student</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                {participant.fullName}
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                {participant.studentId && (
                  <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                    Roll: {participant.studentId}
                  </span>
                )}
                {participant.branch && (
                  <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                    {participant.branch}
                  </span>
                )}
                {participant.semester && (
                  <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                    Semester {participant.semester}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 pt-1">
                You have exactly 1 event registration for {event.title}. Use this registration to participate in multiple programs below.
              </p>
            </div>

            {/* Registration Number Badge */}
            <div className="sm:col-span-4 bg-slate-900/90 rounded-2xl p-4 border border-slate-800 text-center space-y-2 shadow-inner">
              <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                Event Registration #
              </div>
              <div className="text-xl sm:text-2xl font-mono font-black text-amber-400 tracking-wider">
                {participant.registrationNumber}
              </div>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              onClick={scrollToPrograms}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Ticket className="w-4 h-4" />
              <span>Choose Program to Join</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <Link
              href={myRegistrationsPath}
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs sm:text-sm border border-slate-700 transition-colors flex items-center justify-center gap-2 text-center"
            >
              <UserCheck className="w-4 h-4 text-blue-400" />
              <span>View My Registrations</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // VIEW 2: UNIDENTIFIED -> PROMPT IDENTIFY OR REGISTER
  // ============================================================
  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Student Event Identification
            </h2>
          </div>
          <p className="text-xs text-slate-500 max-w-xl">
            One student must have exactly <strong>ONE Event Registration</strong> to participate in any programs.
            Identify yourself below or register for the event.
          </p>
        </div>

        {event.registration_enabled && event.status === 'PUBLISHED' && (
          <Link
            href={registerEventPath}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all shrink-0"
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>New Student? Register Event</span>
          </Link>
        )}
      </div>

      {/* Error / Not Found Alert */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <p className="font-semibold">{errorMsg}</p>
            {notFoundQuery && (
              <div className="pt-1 flex flex-wrap items-center gap-2">
                <Link
                  href={registerEventPath}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-colors"
                >
                  <span>Register for Event Now</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
                <span className="text-[11px] text-amber-800">
                  After registering, your event registration number will be created automatically.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search Input Bar */}
      <form onSubmit={handleIdentify} className="space-y-3">
        <label className="text-xs font-semibold text-slate-700 block">
          Already registered for {event.title}? Identify your registration:
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              placeholder="Enter your Email (e.g. aditya@example.com) or Reg # (e.g. UMANG27-E001)"
              value={identifierInput}
              onChange={(e) => setIdentifierInput(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-xs sm:text-sm transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Searching Google Sheet...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Check Registration</span>
              </>
            )}
          </button>
        </div>
        <p className="text-[11px] text-slate-400">
          Tip: You can search using your registered Email Address, Event Registration Number, or College Roll Number.
        </p>
      </form>
    </div>
  );
}
