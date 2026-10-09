'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Download,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Ticket,
  Copy,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Home,
} from 'lucide-react';
import type { EventSessionPayload } from '@/lib/events/event-session';
import { identifyStudentAction } from '@/app/admin/events/event-registration-actions';
import { generateAndDownloadPassPNG } from '@/lib/events/download-pass-png';

interface EventSuccessPassCardProps {
  event: {
    id: string;
    title: string;
    slug: string;
    venue?: string;
  };
  college: {
    name: string;
    slug: string;
    code?: string;
    logoUrl?: string | null;
  };
  initialSession?: EventSessionPayload | null;
  initialReg?: string;
  myRegistrationsPath?: string;
  moreActionHref?: string;
}

export function EventSuccessPassCard({
  event,
  college,
  initialSession,
  initialReg,
  myRegistrationsPath,
  moreActionHref,
}: EventSuccessPassCardProps) {
  const [participant, setParticipant] = useState<{
    fullName: string;
    registrationNumber: string;
    email: string;
    studentId: string;
    mobile?: string;
    branch?: string;
    semester?: string;
    isPaid?: boolean;
    totalPaidAmount?: number;
    specialEntryName?: string;
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

  const [identifierInput, setIdentifierInput] = useState(initialReg || '');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // If initialReg was passed in query params and no session yet, auto-identify
  useEffect(() => {
    if (!participant && initialReg?.trim()) {
      let isMounted = true;
      identifyStudentAction({
        eventId: event.id,
        identifier: initialReg.trim(),
      })
        .then((res) => {
          if (isMounted && res.success && res.participant) {
            setParticipant(res.participant);
          }
        })
        .catch(() => {});
      return () => {
        isMounted = false;
      };
    }
  }, [event.id, initialReg, participant]);

  const triggerDownload = async (targetParticipant?: typeof participant) => {
    const p = targetParticipant || participant;
    if (!p) return;

    setDownloading(true);
    setErrorMessage(null);
    try {
      await generateAndDownloadPassPNG({
        eventTitle: event.title,
        collegeName: college.name,
        collegeLogoUrl: college.logoUrl || undefined,
        collegeCode: college.code || 'BCE',
        collegeSlug: college.slug || 'bce-bgp',
        venue: event.venue,
        participantName: p.fullName,
        email: p.email,
        registrationNumber: p.registrationNumber,
        studentId: p.studentId,
        branch: p.branch,
        semester: p.semester,
        mobile: p.mobile,
        eventSlug: event.slug,
        isPaid: Boolean(p.isPaid),
        totalPaidAmount: p.totalPaidAmount || 0,
        specialEntryName: p.specialEntryName,
      });
      setDownloadSuccess(true);
    } catch (err: any) {
      console.error('Failed to generate pass:', err);
      setErrorMessage(err?.message || 'Could not download pass. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleLookupAndDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = identifierInput.trim();
    if (!cleanId) {
      setErrorMessage('Please enter your College Roll No, Registration No, or Email.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await identifyStudentAction({
        eventId: event.id,
        identifier: cleanId,
      });

      if (res.success && res.isRegistered && res.participant) {
        setParticipant(res.participant);
        // Automatically trigger VIP PNG pass generation right after successful verification
        await triggerDownload(res.participant);
      } else {
        setErrorMessage(
          res.error || `No registration record found for "${cleanId}". Please ensure you submitted the form.`
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (participant?.registrationNumber && typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(participant.registrationNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const viewRegHref = myRegistrationsPath || `/${college.slug}/events/${event.slug}/my-registrations`;
  const moreEventsHref = moreActionHref || `/${college.slug}/events`;
  const homeHref = college.slug ? `/${college.slug}` : '/';

  return (
    <div className="w-full max-w-lg mx-auto space-y-4 pt-2">
      {/* 1. VERIFIED PARTICIPANT PASS DOWNLOAD BOX */}
      {participant ? (
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 rounded-2xl p-4 sm:p-5 border border-emerald-500/40 text-white shadow-xl space-y-3.5 animate-in fade-in zoom-in-95 duration-300">
          <div className="absolute -top-16 -right-16 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Top Tag Row */}
          <div className="flex items-center justify-between gap-2 border-b border-emerald-500/20 pb-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Official Event Pass Ready</span>
            </span>

            <div className="flex items-center gap-1 text-xs">
              <span className="font-mono text-amber-400 font-black tracking-wide">
                {participant.registrationNumber}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Copy pass registration number"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Student Info */}
          <div className="flex items-start justify-between gap-3 text-xs">
            <div className="space-y-0.5 min-w-0">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Participant
              </div>
              <div className="font-bold text-sm sm:text-base text-white truncate">
                {participant.fullName}
              </div>
              <div className="text-slate-300 text-[11px] flex flex-wrap gap-x-2">
                {participant.studentId && <span>Roll: {participant.studentId}</span>}
                {participant.branch && <span>&bull; {participant.branch}</span>}
                {participant.semester && <span>&bull; {participant.semester}</span>}
              </div>
            </div>

            {/* Direct Download Button */}
            <button
              type="button"
              onClick={() => triggerDownload()}
              disabled={downloading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm shadow-md transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Download className="w-4 h-4 shrink-0" />
              )}
              <span>{downloading ? 'Generating...' : 'Download Pass (PNG)'}</span>
            </button>
          </div>

          {downloadSuccess && (
            <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold pt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Pass downloaded to your device! Keep it handy for campus entry.</span>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-semibold pt-0.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      ) : (
        /* 2. UNIDENTIFIED: QUICK ONE-FIELD PASS DOWNLOAD CLAIM */
        <div className="bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-800 text-white shadow-xl space-y-3 text-left">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Ticket className="w-4 h-4" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                Download Your Official Event Pass
              </h3>
            </div>
            <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
              Instant Pass
            </span>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Enter your <strong>College Roll No</strong> (e.g. 24533), <strong>University Reg No</strong>, or <strong>Email</strong> to download your VIP entry pass (PNG):
          </p>

          <form onSubmit={handleLookupAndDownload} className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                required
                value={identifierInput}
                onChange={(e) => setIdentifierInput(e.target.value)}
                placeholder="Roll No (e.g. 24533) or Email"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
              />
              <button
                type="submit"
                disabled={loading || downloading}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
              >
                {loading || downloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 shrink-0" />
                    <span>Download Pass (PNG)</span>
                  </>
                )}
              </button>
            </div>

            {errorMessage && (
              <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-semibold pt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </form>
        </div>
      )}

      {/* 3. NAVIGATION ACTION BUTTONS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 pt-2">
        <Link
          href={viewRegHref}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/50 active:scale-[0.98]"
        >
          <span>View My Registration</span>
          <ArrowRight className="w-4 h-4" />
        </Link>

        <Link
          href={moreEventsHref}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-xs sm:text-sm transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400 active:scale-[0.98]"
        >
          <span>Explore More Events</span>
          <ArrowRight className="w-4 h-4" />
        </Link>

        <Link
          href={homeHref}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 active:scale-[0.98]"
        >
          <Home className="w-4 h-4" />
          <span>Go to CampusFlow</span>
        </Link>
      </div>
    </div>
  );
}
