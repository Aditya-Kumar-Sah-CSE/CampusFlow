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
  AlertCircle,
  Home,
  Lock,
  UserCheck,
  UserPlus,
  AlertTriangle,
  Mail,
  LogIn,
} from 'lucide-react';
import type { EventSessionPayload } from '@/lib/events/event-session';
import type { StudentSession } from '@/types/student';
import {
  identifyStudentAction,
  checkStudentPassAuthStatusAction,
  type CheckStudentPassAuthResult,
  type StudentPassAuthStatus,
} from '@/app/admin/events/event-registration-actions';
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
  initialStudentSession?: StudentSession | null;
  initialReg?: string;
  myRegistrationsPath?: string;
  moreActionHref?: string;
}

export function EventSuccessPassCard({
  event,
  college,
  initialSession,
  initialStudentSession,
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

  // Student auth security states
  const [authStatus, setAuthStatus] = useState<StudentPassAuthStatus | 'CHECKING' | 'IDLE'>('IDLE');
  const [authDetails, setAuthDetails] = useState<CheckStudentPassAuthResult | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(false);

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

  // Whenever participant is identified, verify student account & login authorization
  useEffect(() => {
    if (!participant?.email) {
      setAuthStatus('IDLE');
      setAuthDetails(null);
      return;
    }

    let isMounted = true;
    setCheckingAuth(true);

    const currentReturnUrl =
      typeof window !== 'undefined'
        ? window.location.pathname + window.location.search
        : '';

    checkStudentPassAuthStatusAction({
      email: participant.email,
      eventId: event.id,
      returnUrl: currentReturnUrl,
    })
      .then((res) => {
        if (isMounted) {
          setAuthDetails(res);
          setAuthStatus(res.status);
        }
      })
      .catch((err) => {
        console.warn('[EventSuccessPassCard] Auth verification error:', err);
      })
      .finally(() => {
        if (isMounted) {
          setCheckingAuth(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [participant?.email, event.id]);

  const triggerDownload = async (targetParticipant?: typeof participant) => {
    const p = targetParticipant || participant;
    if (!p) return;

    setDownloading(true);
    setErrorMessage(null);

    try {
      const currentReturnUrl =
        typeof window !== 'undefined'
          ? window.location.pathname + window.location.search
          : '';

      // Server security re-verification prior to pass generation
      const authCheck = await checkStudentPassAuthStatusAction({
        email: p.email,
        eventId: event.id,
        returnUrl: currentReturnUrl,
      });

      setAuthDetails(authCheck);
      setAuthStatus(authCheck.status);

      if (!authCheck.canDownload) {
        setErrorMessage(authCheck.message);
        setDownloading(false);
        return;
      }

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
      console.error('[EventSuccessPassCard] Failed to generate pass:', err);
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
        // Note: Does NOT directly download. It sets participant, which runs the student auth check.
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
      {/* 1. PARTICIPANT FOUND & AUTH CHECKED */}
      {participant ? (
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-700/60 text-white shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="absolute -top-16 -right-16 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Top Tag Row */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
            {checkingAuth ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 shrink-0" />
                <span>Checking Student Verification...</span>
              </span>
            ) : authStatus === 'AUTHORIZED' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Official Event Pass Ready</span>
              </span>
            ) : authStatus === 'LOGIN_REQUIRED' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Sign-In Required to Download</span>
              </span>
            ) : authStatus === 'SIGNUP_REQUIRED' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                <UserPlus className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Student Account Required</span>
              </span>
            ) : authStatus === 'ACCOUNT_MISMATCH' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Account Mismatch</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Mail className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Email Verification Pending</span>
              </span>
            )}

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

          {/* Student Info Details */}
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50 space-y-1 text-xs text-left">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center justify-between">
              <span>Registered Participant</span>
              <span className="font-mono text-slate-300 lowercase">{participant.email}</span>
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

          {/* AUTH STATUS NOTICES & ACTION BUTTONS */}
          {checkingAuth ? (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              <span>Verifying student account status...</span>
            </div>
          ) : authStatus === 'AUTHORIZED' ? (
            /* 1. AUTHORIZED — UNLOCKED DOWNLOAD */
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2.5">
                <UserCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                <span className="truncate">
                  Authenticated Student: <strong>{authDetails?.loggedInEmail || participant.email}</strong>
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-[11px] text-slate-300">
                  Ready to download your official VIP event pass.
                </span>
                <button
                  type="button"
                  onClick={() => triggerDownload()}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm shadow-md transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
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
                <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Pass downloaded to your device! Keep it handy for campus entry.</span>
                </div>
              )}
            </div>
          ) : authStatus === 'LOGIN_REQUIRED' ? (
            /* 2. LOGIN REQUIRED — REGISTERED ACCOUNT EXISTS BUT USER NOT SIGNED IN */
            <div className="space-y-3 text-left">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-amber-300">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>Student Sign-In Required</span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  A registered student account exists for <strong>{participant.email}</strong>. To protect student passes and prevent unauthorized downloads, please sign in to verify ownership and unlock your pass.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Link
                  href={authDetails?.loginUrl || `/auth/student/login?email=${encodeURIComponent(participant.email)}`}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-bce-cobalt to-blue-600 hover:from-indigo-400 hover:to-blue-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all hover:scale-[1.01] active:scale-95 text-center"
                >
                  <LogIn className="w-4 h-4 shrink-0" />
                  <span>Sign In as {participant.email.split('@')[0]} to Unlock Pass</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </Link>
              </div>
            </div>
          ) : authStatus === 'SIGNUP_REQUIRED' ? (
            /* 3. SIGNUP REQUIRED — NO STUDENT ACCOUNT EXISTS FOR THIS EMAIL */
            <div className="space-y-3 text-left">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-xs text-blue-200 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-blue-300">
                  <UserPlus className="w-4 h-4 shrink-0" />
                  <span>Student Account Required</span>
                </div>
                <p className="text-[11px] text-blue-200/90 leading-relaxed">
                  This registration is recorded for <strong>{participant.email}</strong>, but no student account exists for this email on CampusFlow. Please create a student account using this email to activate and download your official VIP pass.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Link
                  href={authDetails?.signupUrl || `/auth/student/signup?email=${encodeURIComponent(participant.email)}`}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm shadow-md transition-all hover:scale-[1.01] active:scale-95 text-center"
                >
                  <UserPlus className="w-4 h-4 shrink-0" />
                  <span>Create Student Account ({participant.email.split('@')[0]})</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </Link>
              </div>
            </div>
          ) : authStatus === 'ACCOUNT_MISMATCH' ? (
            /* 4. ACCOUNT MISMATCH */
            <div className="space-y-3 text-left">
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-200 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-rose-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Account Mismatch</span>
                </div>
                <p className="text-[11px] text-rose-200/90 leading-relaxed">
                  You are currently signed in as <strong>{authDetails?.loggedInEmail}</strong>, but this event pass belongs to <strong>{participant.email}</strong>. For security and fraud prevention, passes can only be downloaded by the registered student.
                </p>
              </div>

              <div className="pt-1">
                <Link
                  href={authDetails?.loginUrl || `/auth/student/login?email=${encodeURIComponent(participant.email)}`}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all"
                >
                  <LogIn className="w-4 h-4 shrink-0" />
                  <span>Switch & Sign In as {participant.email}</span>
                </Link>
              </div>
            </div>
          ) : (
            /* 5. EMAIL NOT VERIFIED */
            <div className="space-y-3 text-left">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-amber-300">
                  <Mail className="w-4 h-4 shrink-0" />
                  <span>Email Verification Pending</span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  Your student account (<strong>{participant.email}</strong>) has not been verified yet. Please check your inbox or sign in to resend the verification link.
                </p>
              </div>

              <div className="pt-1">
                <Link
                  href={authDetails?.loginUrl || `/auth/student/login?email=${encodeURIComponent(participant.email)}`}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs sm:text-sm shadow-md transition-all"
                >
                  <LogIn className="w-4 h-4 shrink-0" />
                  <span>Sign In & Verify Email</span>
                </Link>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-semibold pt-1">
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
            Enter your <strong>College Roll No</strong> (e.g. 24533), <strong>University Reg No</strong>, or <strong>Email</strong> to verify and download your VIP entry pass (PNG):
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
                    <span>Verify & Download Pass</span>
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
