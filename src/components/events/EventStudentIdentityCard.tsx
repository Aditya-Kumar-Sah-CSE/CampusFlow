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
  Edit3,
  Download,
  Clock,
  Lock,
} from 'lucide-react';
import type { CollegeEvent } from '@/types/events';
import type { EventSessionPayload } from '@/lib/events/event-session';
import {
  identifyStudentAction,
  logoutFromEventAction,
  getStudentRegistrationsAction,
  checkStudentPassAuthStatusAction,
  type CheckStudentPassAuthResult,
  type StudentProgramRegistrationItem,
} from '@/app/admin/events/event-registration-actions';
import { EditEventPassModal } from './EditEventPassModal';
import { generateAndDownloadPassPNG } from '@/lib/events/download-pass-png';
import { resolveCollegeLogoUrl } from '@/lib/events/college-logos';
import { useStudentSession } from '@/lib/auth/use-student-session';

interface Props {
  event: CollegeEvent;
  initialSession: EventSessionPayload | null;
  tenantSlug?: string;
  collegeLogoUrl?: string | null;
  collegeName?: string | null;
}

export function EventStudentIdentityCard({
  event,
  initialSession,
  tenantSlug,
  collegeLogoUrl,
  collegeName,
}: Props) {
  const basePath = tenantSlug ? `/${tenantSlug}/events/${event.slug}` : `/events/${event.slug}`;
  const registerEventPath = `${basePath}/register`;
  const myRegistrationsPath = `${basePath}/my-registrations`;

  const college = (event as any).college;
  const effectiveCollegeLogo = resolveCollegeLogoUrl({
    collegeLogoUrl: collegeLogoUrl || college?.logo_url,
    collegeCode: college?.code,
    collegeSlug: tenantSlug || college?.slug,
    collegeName: collegeName || college?.name,
  });
  const effectiveCollegeName = collegeName || college?.name || 'Bhagalpur College of Engineering';
  const effectiveCollegeCode = college?.code || '108';
  const effectiveCollegeSlug = tenantSlug || college?.slug || 'bce-bgp';

  // State
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
    hasPendingPayment?: boolean;
    canGeneratePass?: boolean;
    paymentStatus?: string;
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

  const { isAuthenticated, user, student, loading: sessionLoading } = useStudentSession();

  const [identifierInput, setIdentifierInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notFoundQuery, setNotFoundQuery] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [downloadingPass, setDownloadingPass] = useState(false);
  const [enrolledPrograms, setEnrolledPrograms] = useState<StudentProgramRegistrationItem[]>([]);
  const [passAuth, setPassAuth] = useState<CheckStudentPassAuthResult | null>(null);

  // Auto-identify student when logged in
  React.useEffect(() => {
    if (user?.email && !participant) {
      let isMounted = true;
      identifyStudentAction({
        eventId: event.id,
        identifier: user.email,
      })
        .then((res) => {
          if (isMounted && res.success && res.participant) {
            setParticipant(res.participant);
          } else if (isMounted && student?.registrationNumber) {
            identifyStudentAction({
              eventId: event.id,
              identifier: student.registrationNumber,
            })
              .then((res2) => {
                if (isMounted && res2.success && res2.participant) {
                  setParticipant(res2.participant);
                }
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
      return () => {
        isMounted = false;
      };
    }
  }, [user?.email, event.id, participant, student?.registrationNumber]);

  // Check student authentication whenever participant changes
  React.useEffect(() => {
    if (!participant?.email) {
      setPassAuth(null);
      return;
    }
    let isMounted = true;
    const currentReturnUrl = typeof window !== 'undefined'
      ? window.location.pathname + window.location.search
      : '';
    checkStudentPassAuthStatusAction({
      email: participant.email,
      eventId: event.id,
      returnUrl: currentReturnUrl,
    })
      .then((res) => {
        if (isMounted) setPassAuth(res);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [participant?.email, event.id]);

  // Fetch enrolled programs whenever participant changes
  React.useEffect(() => {
    if (!participant) {
      setEnrolledPrograms([]);
      return;
    }
    let isMounted = true;
    getStudentRegistrationsAction(event.id)
      .then((res) => {
        if (isMounted && res.success && res.programs) {
          setEnrolledPrograms(res.programs);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [participant, event.id]);

  // Verified paid programs (verified by Admin)
  const verifiedPaidPrograms = enrolledPrograms.filter(
    (p) => (p.paymentStatus === 'PAID' || p.paymentStatus === 'VERIFIED') && p.registrationStatus !== 'CANCELLED'
  );

  // Pending paid programs (awaiting Admin payment verification)
  const pendingPaidPrograms = enrolledPrograms.filter(
    (p) =>
      (p.paymentAmount > 0 || p.paymentStatus === 'PENDING' || p.paymentStatus === 'SUBMITTED') &&
      p.paymentStatus !== 'PAID' &&
      p.paymentStatus !== 'VERIFIED' &&
      p.paymentStatus !== 'REJECTED' &&
      p.registrationStatus !== 'CANCELLED'
  );

  // Free programs
  const freePrograms = enrolledPrograms.filter(
    (p) =>
      (!p.paymentAmount || p.paymentAmount === 0 || p.paymentStatus === 'NOT_REQUIRED' || p.paymentStatus === 'FREE') &&
      p.registrationStatus !== 'CANCELLED'
  );

  const totalPaidAmount = verifiedPaidPrograms.reduce((sum, p) => sum + (p.paymentAmount || 0), 0);
  const specialEntryName = verifiedPaidPrograms.map((p) => p.programName).filter(Boolean).join(', ');
  const pendingAmount = pendingPaidPrograms.reduce((sum, p) => sum + (p.paymentAmount || 0), 0);
  const pendingProgramNames = pendingPaidPrograms.map((p) => p.programName).filter(Boolean).join(', ');

  // Pass generation locked if payment is awaiting admin verification
  const isPaidPassPending =
    (enrolledPrograms.length > 0 &&
      verifiedPaidPrograms.length === 0 &&
      freePrograms.length === 0 &&
      pendingPaidPrograms.length > 0) ||
    participant?.canGeneratePass === false ||
    participant?.hasPendingPayment === true;

  const handleDownloadPass = async () => {
    if (!participant) return;
    if (isPaidPassPending) {
      alert(
        `Payment verification is pending by Admin for ${pendingProgramNames || event.title}. Once the college admin verifies your payment, your official pass will be unlocked.`
      );
      return;
    }

    setDownloadingPass(true);
    try {
      const currentReturnUrl =
        typeof window !== 'undefined'
          ? window.location.pathname + window.location.search
          : '';

      const authCheck = await checkStudentPassAuthStatusAction({
        email: participant.email,
        eventId: event.id,
        returnUrl: currentReturnUrl,
      });

      setPassAuth(authCheck);

      if (!authCheck.canDownload) {
        if (authCheck.status === 'LOGIN_REQUIRED') {
          window.location.href = authCheck.loginUrl || `/auth/student/login?email=${encodeURIComponent(participant.email)}`;
          return;
        }
        if (authCheck.status === 'SIGNUP_REQUIRED') {
          window.location.href = authCheck.signupUrl || `/auth/student/signup?email=${encodeURIComponent(participant.email)}`;
          return;
        }
        alert(authCheck.message);
        return;
      }

      await generateAndDownloadPassPNG({
        eventTitle: event.title,
        collegeName: effectiveCollegeName,
        collegeLogoUrl: effectiveCollegeLogo,
        collegeCode: effectiveCollegeCode,
        collegeSlug: effectiveCollegeSlug,
        venue: event.venue,
        participantName: participant.fullName,
        email: participant.email,
        registrationNumber: participant.registrationNumber,
        studentId: participant.studentId,
        branch: participant.branch,
        semester: participant.semester,
        mobile: participant.mobile,
        eventSlug: event.slug,
        isPaid: totalPaidAmount > 0,
        totalPaidAmount: totalPaidAmount,
        specialEntryName: specialEntryName || undefined,
      });
    } catch (err) {
      console.error('Failed to download pass:', err);
      alert('Could not download pass. Please try again.');
    } finally {
      setDownloadingPass(false);
    }
  };

  // IDENTIFY STUDENT (Email / Registration Number / Roll Number)
  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNotFoundQuery(null);

    if (!isAuthenticated) {
      const currentReturnUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';
      window.location.href = `/auth/student/login?redirect=${encodeURIComponent(currentReturnUrl)}`;
      return;
    }

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
        const userRole = user?.user_metadata?.role;
        const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'COLLEGE_SUPER_ADMIN' || userRole === 'FACULTY_ADMIN';
        if (!isAdmin && user?.email && res.participant.email.toLowerCase().trim() !== user.email.toLowerCase().trim()) {
          setErrorMsg(`Access restricted: You are logged in as ${user.email}. You can only access and download passes registered to your own account.`);
          return;
        }

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
      <div className="bg-gradient-to-br from-emerald-900/90 via-slate-900 to-slate-950 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 text-white shadow-xl border border-emerald-500/30 relative overflow-hidden animate-in fade-in duration-300">
        {/* Decorative backdrop light */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4 sm:space-y-5">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3 sm:pb-4">
            <div className="flex items-center gap-3">
              {/* Official College Crest on Pass */}
              {effectiveCollegeLogo ? (
                <div className="w-11 h-11 rounded-full bg-white p-0.5 shadow-md border-2 border-emerald-500/50 flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src={effectiveCollegeLogo}
                    alt={effectiveCollegeName || 'College Logo'}
                    crossOrigin="anonymous"
                    className="w-full h-full object-contain rounded-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/images/colleges/bce-bgp.png';
                    }}
                  />
                </div>
              ) : (
                <div className="w-11 h-11 rounded-full bg-slate-800 border-2 border-emerald-500/50 flex items-center justify-center font-black text-xs text-emerald-400 shrink-0">
                  {(effectiveCollegeCode || effectiveCollegeSlug || 'BCE').slice(0, 3).toUpperCase()}
                </div>
              )}

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Official Event Pass Verified</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {effectiveCollegeSlug ? `/${effectiveCollegeSlug}` : 'EVENT_REGISTRATIONS'}
                  </span>
                </div>
                {effectiveCollegeName && (
                  <div className="text-xs font-semibold text-slate-300 mt-0.5">
                    {effectiveCollegeName}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              {/* Download PNG Pass Button or Auth Unlock Button */}
              {passAuth && !passAuth.canDownload ? (
                <Link
                  href={passAuth.loginUrl || passAuth.signupUrl || `/auth/student/login?email=${encodeURIComponent(participant.email)}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 transition-all cursor-pointer"
                  title={passAuth.message}
                >
                  <Lock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>
                    {passAuth.status === 'SIGNUP_REQUIRED'
                      ? 'Sign Up to Unlock Pass'
                      : passAuth.status === 'ACCOUNT_MISMATCH'
                      ? 'Switch Account to Unlock'
                      : 'Sign In to Unlock Pass'}
                  </span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleDownloadPass}
                  disabled={downloadingPass || isPaidPassPending}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs transition-all ${
                    isPaidPassPending
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 cursor-not-allowed opacity-85'
                      : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 cursor-pointer disabled:opacity-50'
                  }`}
                  title={
                    isPaidPassPending
                      ? `Payment verification pending by Admin for ${pendingProgramNames}`
                      : 'Download PNG Pass'
                  }
                >
                  {downloadingPass ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isPaidPassPending ? (
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>{isPaidPassPending ? 'Pass Pending Verification' : 'Download Pass'}</span>
                </button>
              )}

              {/* Switch Student */}
              <button
                type="button"
                onClick={handleSwitchStudent}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer px-1.5 py-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Switch Student</span>
              </button>
            </div>
          </div>

          {/* Student Info Card */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-stretch sm:items-center">
            <div className="sm:col-span-7 md:col-span-8 space-y-2 min-w-0">
              <div className="text-xs text-emerald-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Identified Student</span>
              </div>
              <h3 className="text-lg sm:text-2xl font-black text-white break-words">
                {participant.fullName}
              </h3>
              <p className="text-xs text-slate-300 break-all">
                {participant.email}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-slate-300 pt-1">
                {participant.studentId && (
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(true)}
                    className="bg-slate-800/80 hover:bg-slate-700/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono transition-colors cursor-pointer text-left"
                    title="Click to edit"
                  >
                    Roll: {participant.studentId}
                  </button>
                )}
                {participant.branch && (
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(true)}
                    className="bg-slate-800/80 hover:bg-slate-700/80 px-2.5 py-1 rounded-lg border border-slate-700/60 transition-colors cursor-pointer text-left"
                    title="Click to edit"
                  >
                    {participant.branch}
                  </button>
                )}
                {participant.semester && (
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(true)}
                    className="bg-slate-800/80 hover:bg-slate-700/80 px-2.5 py-1 rounded-lg border border-slate-700/60 transition-colors cursor-pointer text-left"
                    title="Click to edit"
                  >
                    {participant.semester}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer transition-colors px-1 py-0.5"
                  title="Edit details"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              </div>

              {/* Access Inclusions Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Allowed for all FREE programs</span>
                </span>

                {specialEntryName && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Special Entry: {specialEntryName} (Verified Paid ₹{totalPaidAmount})</span>
                  </span>
                )}

                {pendingPaidPrograms.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Payment Verification Pending: {pendingProgramNames} (₹{pendingAmount})</span>
                  </span>
                )}

                {!specialEntryName && pendingPaidPrograms.length === 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/70 border border-slate-700/80 text-slate-400 text-[11px]">
                    <span>Entry: Free Pass</span>
                  </span>
                )}
              </div>

              {/* Notice when paid pass is pending verification */}
              {isPaidPassPending && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold text-amber-300">Paid Pass Pending Admin Verification</div>
                    <div className="text-slate-300 text-[11px]">
                      Your payment of ₹{pendingAmount} for <span className="font-semibold text-white">{pendingProgramNames}</span> has been submitted. Pass download will unlock automatically once college administrators verify your payment.
                    </div>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-400 pt-1">
                You have exactly 1 event registration for {event.title}. Use this registration to participate in multiple programs below.
              </p>
            </div>

            {/* Registration Number Badge */}
            <div className="sm:col-span-5 md:col-span-4 bg-slate-900/90 rounded-2xl p-3 sm:p-4 border border-slate-800 text-center space-y-2 shadow-inner w-full min-w-0">
              <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                Event Registration #
              </div>
              <div className="text-lg sm:text-2xl font-mono font-black text-amber-400 tracking-wider break-all">
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 pt-2">
            <button
              onClick={handleDownloadPass}
              disabled={downloadingPass}
              className="w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              {downloadingPass ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Download className="w-4 h-4 shrink-0" />}
              <span>{downloadingPass ? 'Generating Official Pass...' : 'Download Pass (PNG)'}</span>
            </button>

            {event.registration_type !== 'google_form' && (
              <button
                onClick={scrollToPrograms}
                className="w-full sm:w-auto px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs sm:text-sm border border-slate-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Ticket className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>Choose Program to Join</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            )}

            <Link
              href={myRegistrationsPath}
              className="w-full sm:w-auto px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs sm:text-sm border border-slate-700 transition-colors flex items-center justify-center gap-2 text-center"
            >
              <UserCheck className="w-4 h-4 text-blue-400 shrink-0" />
              <span>View Registration Details</span>
            </Link>
          </div>
        </div>

        {/* Edit Pass Modal */}
        <EditEventPassModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          event={event}
          participant={participant}
          onSuccess={(updated) => {
            setParticipant((prev) =>
              prev
                ? {
                    ...prev,
                    fullName: updated.fullName,
                    studentId: updated.studentId,
                    mobile: updated.mobile,
                    branch: updated.branch,
                    semester: updated.semester,
                  }
                : null
            );
          }}
        />
      </div>
    );
  }

  // ============================================================
  // VIEW 2: UNIDENTIFIED -> PROMPT IDENTIFY OR REGISTER
  // ============================================================
  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 sm:pb-5">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 break-words">
              Student Event Pass &amp; Verification
            </h2>
          </div>
          <p className="text-xs text-slate-500 max-w-xl">
            {event.registration_type === 'google_form'
              ? 'Already registered for this event? Enter your details below to download your official entry pass (PNG).'
              : 'One student must have exactly ONE Event Registration to participate in any programs. Identify yourself below or register for the event.'}
          </p>
        </div>

        {event.registration_enabled && event.status === 'PUBLISHED' && (
          !isAuthenticated && !sessionLoading ? (
            <Link
              href={`/auth/student/login?redirect=${encodeURIComponent(registerEventPath)}`}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all shrink-0 text-center"
            >
              <Lock className="w-3.5 h-3.5 text-amber-300" />
              <span>Register via Form &rarr;</span>
            </Link>
          ) : event.registration_type === 'google_form' && event.google_form_url ? (
            <a
              href={event.google_form_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all shrink-0 text-center"
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>Register via Form &rarr;</span>
            </a>
          ) : (
            <Link
              href={registerEventPath}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all shrink-0 text-center"
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>Register via Form &rarr;</span>
            </Link>
          )
        )}
      </div>

      {/* Error / Not Found Alert */}
      {errorMsg && (
        <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1 min-w-0">
            <p className="font-semibold break-words">{errorMsg}</p>
            {notFoundQuery && (
              <div className="pt-1 flex flex-col sm:flex-row sm:items-center gap-2">
                {event.registration_type === 'google_form' && event.google_form_url ? (
                  <a
                    href={event.google_form_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-colors w-full sm:w-auto"
                  >
                    <span>Register for Event Now</span>
                    <ArrowRight className="w-3 h-3" />
                  </a>
                ) : (
                  <Link
                    href={registerEventPath}
                    className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-colors w-full sm:w-auto"
                  >
                    <span>Register for Event Now</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
                <span className="text-[11px] text-amber-800">
                  After registering, your event pass will be available for download here.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search Input Bar / Locked Card */}
      {!isAuthenticated && !sessionLoading ? (
        <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-slate-600" />
          </div>
          <h4 className="text-sm font-bold text-slate-900">
            Student Sign In Required
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Official event entry passes are locked to verified students. Sign in with your student account to check registration and download your entry pass.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
            <Link
              href={`/auth/student/login?redirect=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname + window.location.search : '')}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Sign In with Student Account</span>
            </Link>
            <Link
              href={`/auth/student/signup?redirect=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname + window.location.search : '')}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs transition-colors"
            >
              <span>New Student Signup</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
            <UserCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold">Signed in as {user?.email}</span>
              <p className="text-[11px] text-blue-800">
                No entry pass was automatically found for your email. If you registered using your College Roll Number or an alternate Event Registration #, check below:
              </p>
            </div>
          </div>

          <form onSubmit={handleIdentify} className="space-y-3">
            <label className="text-xs font-semibold text-slate-700 block">
              Identify and download your pass:
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="Enter College Roll No (e.g. 24533) or Reg # (e.g. DANDIY-REG-0001)"
                  value={identifierInput}
                  onChange={(e) => setIdentifierInput(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-xs sm:text-sm transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shrink-0"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Searching Google Sheet...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Check Registration</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Tip: Pass access is locked to your authenticated account ({user?.email}).
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
