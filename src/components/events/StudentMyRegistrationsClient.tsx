'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  UserCheck,
  Ticket,
  Trophy,
  Users,
  AlertCircle,
  Loader2,
  LogIn,
  ArrowRight,
  LogOut,
  Bell,
  Send,
  ChevronRight,
  Edit3,
  Download,
  Clock,
  Lock,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import type { CollegeEvent } from '@/types/events';
import type { EventSessionPayload } from '@/lib/events/event-session';
import {
  loginToEventAction,
  logoutFromEventAction,
  getStudentRegistrationsAction,
  type StudentProgramRegistrationItem,
} from '@/app/admin/events/event-registration-actions';
import { ManageTeamModal } from './ManageTeamModal';
import { FindTeamModal } from './FindTeamModal';
import { EditEventPassModal } from './EditEventPassModal';
import { generateAndDownloadPassPNG } from '@/lib/events/download-pass-png';
import { resolveCollegeLogoUrl } from '@/lib/events/college-logos';
import { getMyTeamInvitationsAction } from '@/app/events/invitations/actions';
import { getMyJoinRequestsAction } from '@/app/events/join-requests/actions';
import { useStudentSession } from '@/lib/auth/use-student-session';

interface Props {
  event: CollegeEvent;
  initialSession: EventSessionPayload | null;
  initialPrograms: StudentProgramRegistrationItem[];
  collegeLogoUrl?: string | null;
  collegeName?: string | null;
  tenantSlug?: string;
}

export function StudentMyRegistrationsClient({
  event,
  initialSession,
  initialPrograms,
  collegeLogoUrl,
  collegeName,
  tenantSlug,
}: Props) {
  const { session: studentAuthSession, isAuthenticated, user, student, loading: sessionLoading } = useStudentSession();
  const [session, setSession] = useState<EventSessionPayload | null>(initialSession);
  const [programs, setPrograms] = useState<StudentProgramRegistrationItem[]>(initialPrograms);
  const [selectedTeamProgram, setSelectedTeamProgram] = useState<StudentProgramRegistrationItem | null>(null);

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

  // Login inputs
  const [loginRegNum, setLoginRegNum] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [unreadInvitationCount, setUnreadInvitationCount] = useState(0);
  const [unreadJoinRequestCount, setUnreadJoinRequestCount] = useState(0);

  // Auto-fill student email when authenticated
  useEffect(() => {
    if (user?.email) {
      setLoginEmail(user.email);
    }
  }, [user]);

  // Find Team modal state
  const [findTeamProgram, setFindTeamProgram] = useState<{
    programId: string;
    programName: string;
    initialView?: 'search' | 'requests';
  } | null>(null);

  // Edit pass & download pass states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [downloadingPass, setDownloadingPass] = useState(false);

  // Verified paid programs (verified by Admin)
  const verifiedPaidPrograms = programs.filter(
    (p) => (p.paymentStatus === 'PAID' || p.paymentStatus === 'VERIFIED') && p.registrationStatus !== 'CANCELLED'
  );

  // Pending paid programs (awaiting Admin payment verification)
  const pendingPaidPrograms = programs.filter(
    (p) =>
      (p.paymentAmount > 0 || p.paymentStatus === 'PENDING' || p.paymentStatus === 'SUBMITTED') &&
      p.paymentStatus !== 'PAID' &&
      p.paymentStatus !== 'VERIFIED' &&
      p.paymentStatus !== 'REJECTED' &&
      p.registrationStatus !== 'CANCELLED'
  );

  // Free programs
  const freePrograms = programs.filter(
    (p) =>
      (!p.paymentAmount || p.paymentAmount === 0 || p.paymentStatus === 'NOT_REQUIRED' || p.paymentStatus === 'FREE') &&
      p.registrationStatus !== 'CANCELLED'
  );

  const totalPaidAmount = verifiedPaidPrograms.reduce((sum, p) => sum + (p.paymentAmount || 0), 0);
  const specialEntryName = verifiedPaidPrograms.map((p) => p.programName).filter(Boolean).join(', ');
  const pendingAmount = pendingPaidPrograms.reduce((sum, p) => sum + (p.paymentAmount || 0), 0);
  const pendingProgramNames = pendingPaidPrograms.map((p) => p.programName).filter(Boolean).join(', ');

  // Pass generation locked if student registered ONLY for paid program and it has not been verified yet
  const isPaidPassPending =
    programs.length > 0 &&
    verifiedPaidPrograms.length === 0 &&
    freePrograms.length === 0 &&
    pendingPaidPrograms.length > 0;

  const handleDownloadPass = async () => {
    if (!session) return;
    if (isPaidPassPending) {
      alert(
        `Payment verification is pending by Admin for ${pendingProgramNames}. Once the college admin verifies your payment, your official pass will be unlocked.`
      );
      return;
    }

    setDownloadingPass(true);
    try {
      await generateAndDownloadPassPNG({
        eventTitle: event.title,
        collegeName: effectiveCollegeName,
        collegeLogoUrl: effectiveCollegeLogo,
        collegeCode: effectiveCollegeCode,
        collegeSlug: effectiveCollegeSlug,
        venue: event.venue,
        participantName: session.fullName,
        email: session.email,
        registrationNumber: session.registrationNumber,
        studentId: session.studentId,
        branch: session.branch,
        semester: session.semester,
        mobile: session.mobile,
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

  useEffect(() => {
    if (!session) { setUnreadInvitationCount(0); setUnreadJoinRequestCount(0); return; }
    getMyTeamInvitationsAction(event.id).then(result => {
      if (result.success) setUnreadInvitationCount(result.unreadCount || 0);
    });
    getMyJoinRequestsAction(event.id).then(result => {
      if (result.success) setUnreadJoinRequestCount(result.unreadCount || 0);
    });
  }, [event.id, session]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!loginRegNum.trim() || !loginEmail.trim()) {
      setErrorMsg('Please enter both your Event Registration Number and Email.');
      return;
    }

    if (user?.email && loginEmail.trim().toLowerCase() !== user.email.toLowerCase().trim()) {
      setErrorMsg(`Access restricted: You are signed in as ${user.email}. You can only access your own registrations.`);
      return;
    }

    setLoading(true);
    try {
      const res = await loginToEventAction({
        event_id: event.id,
        college_id: event.college_id,
        registration_number: loginRegNum.trim().toUpperCase(),
        email: loginEmail.trim().toLowerCase(),
      });

      if (res.success && res.session) {
        setSession({
          registrationNumber: res.session.registrationNumber,
          email: res.session.email,
          fullName: res.session.fullName,
          studentId: res.session.studentId || '',
          mobile: res.session.mobile || '',
          branch: res.session.branch || '',
          semester: res.session.semester || '',
          eventId: event.id,
          collegeId: event.college_id,
          issuedAt: Date.now(),
          expiresAt: Date.now() + 86400000,
        });

        // Fetch their programs
        const regRes = await getStudentRegistrationsAction(event.id);
        if (regRes.success && regRes.programs) {
          setPrograms(regRes.programs);
        }
      } else {
        setErrorMsg(res.error || 'Verification failed. Please check your credentials.');
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutFromEventAction(event.id);
    setSession(null);
    setPrograms([]);
    setSelectedTeamProgram(null);
  };

  const refreshRegistrations = async () => {
    const regRes = await getStudentRegistrationsAction(event.id);
    if (regRes.success && regRes.programs) {
      setPrograms(regRes.programs);
      if (selectedTeamProgram) {
        const updated = regRes.programs.find(
          pr =>
            pr.registrationNumber === selectedTeamProgram.registrationNumber ||
            (pr.teamId && pr.teamId === selectedTeamProgram.teamId)
        );
        if (updated) setSelectedTeamProgram(updated);
      }
    }
  };

  // Support ?manageTeam=<teamId> query param to open modal automatically
  useEffect(() => {
    if (typeof window !== 'undefined' && programs.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const targetTeam = params.get('manageTeam');
      if (targetTeam) {
        const match = programs.find(p => p.teamId?.toUpperCase() === targetTeam.toUpperCase());
        if (match) {
          setSelectedTeamProgram(match);
        }
      }
    }
  }, [programs]);

  // NOT LOGGED IN VIEW
  if (!session) {
    if (!isAuthenticated && !sessionLoading) {
      const returnUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';
      return (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 max-w-md w-full mx-auto space-y-4 text-center animate-in fade-in duration-300">
          <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center mx-auto border border-slate-200">
            <Lock className="w-7 h-7 text-slate-700" />
          </div>
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
              <Lock className="w-3.5 h-3.5" />
              <span>Student Sign In Required</span>
            </span>
            <h2 className="text-xl font-bold text-slate-900">
              Sign In to View Registrations
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Official event registrations, pass downloads, and team memberships are locked to verified student accounts.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2.5">
            <Link
              href={`/auth/student/login?redirect=${encodeURIComponent(returnUrl)}`}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md transition-colors"
            >
              <Lock className="w-4 h-4" />
              <span>Sign In with Student Account</span>
            </Link>
            <Link
              href={`/auth/student/signup?redirect=${encodeURIComponent(returnUrl)}`}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs sm:text-sm transition-colors"
            >
              <span>New Student Signup</span>
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-8 max-w-md w-full mx-auto space-y-5 sm:space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 break-words">Access Your Registrations</h2>
          <p className="text-xs text-slate-500">
            View your event pass, joined programs, and team details for {event.title}.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span className="break-words">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-3.5 sm:space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Event Registration Number
            </label>
            <input
              type="text"
              required
              placeholder="e.g. UMANG27-E001"
              value={loginRegNum}
              onChange={(e) => setLoginRegNum(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-xs sm:text-sm font-mono uppercase transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Verified Student Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                required
                readOnly
                placeholder="student@college.ac.in"
                value={loginEmail}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 font-medium text-slate-700 cursor-not-allowed focus:outline-none text-xs sm:text-sm"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Checking Records...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 shrink-0" />
                <span>View Registrations</span>
              </>
            )}
          </button>
        </form>

        <div className="pt-3 border-t border-slate-100 text-center">
          <Link
            href={`/events/${event.slug}/register`}
            className="text-xs font-bold text-blue-600 hover:underline inline-block"
          >
            Don&apos;t have an event pass? Register here &rarr;
          </Link>
        </div>
      </div>
    );
  }

  // LOGGED IN DASHBOARD VIEW
  return (
    <div className="space-y-5 sm:space-y-6 max-w-4xl mx-auto">
      {/* Event Pass Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Ticket className="w-48 h-48" />
        </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/60 pb-3">
            <div className="flex items-center gap-3">
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

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-300 border border-amber-500/30 transition-all cursor-pointer"
                title="Edit Pass Details"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                <span>Edit Pass</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPass}
                disabled={downloadingPass || isPaidPassPending}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
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

              <button
                onClick={handleLogout}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 px-1.5 py-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log out</span>
              </button>
            </div>
          </div>

          <div className="min-w-0">
            <h2 className="text-lg sm:text-2xl font-black break-words">{event.title}</h2>
            <p className="text-xs text-slate-300 mt-0.5 break-words">{event.venue}</p>
          </div>

          <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3 sm:gap-4 pt-4 border-t border-slate-700/60">
            <div className="space-y-1.5 min-w-0">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>Participant Name</span>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="text-amber-400 hover:text-amber-300 text-[10px] inline-flex items-center gap-0.5 cursor-pointer underline"
                >
                  <Edit3 className="w-2.5 h-2.5" />
                  <span>Edit</span>
                </button>
              </div>
              <div className="text-sm sm:text-base font-bold text-white break-words">{session.fullName}</div>
              <div className="text-xs text-slate-300 break-all">{session.email}</div>

              {(session.studentId || session.branch || session.semester) && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                  {session.studentId && (
                    <button
                      type="button"
                      onClick={() => setIsEditModalOpen(true)}
                      className="bg-slate-800/80 hover:bg-slate-700/80 px-2 py-0.5 rounded-md border border-slate-700/60 font-mono text-[11px] text-slate-300 transition-colors cursor-pointer"
                      title="Click to edit"
                    >
                      Roll: {session.studentId}
                    </button>
                  )}
                  {session.branch && (
                    <button
                      type="button"
                      onClick={() => setIsEditModalOpen(true)}
                      className="bg-slate-800/80 hover:bg-slate-700/80 px-2 py-0.5 rounded-md border border-slate-700/60 text-[11px] text-slate-300 transition-colors cursor-pointer"
                      title="Click to edit"
                    >
                      {session.branch}
                    </button>
                  )}
                  {session.semester && (
                    <button
                      type="button"
                      onClick={() => setIsEditModalOpen(true)}
                      className="bg-slate-800/80 hover:bg-slate-700/80 px-2 py-0.5 rounded-md border border-slate-700/60 text-[11px] text-slate-300 transition-colors cursor-pointer"
                      title="Click to edit"
                    >
                      {session.semester}
                    </button>
                  )}
                </div>
              )}

              {/* Inclusions Badges */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
                  ✓ Allowed for all FREE programs
                </span>
                {specialEntryName && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-bold">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Special Entry: {specialEntryName} (Verified Paid ₹{totalPaidAmount})</span>
                  </span>
                )}
                {pendingPaidPrograms.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-semibold">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Payment Verification Pending: {pendingProgramNames} (₹{pendingAmount})</span>
                  </span>
                )}
                {!specialEntryName && pendingPaidPrograms.length === 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700 text-slate-400 text-[10px]">
                    Entry: Free Pass
                  </span>
                )}
              </div>

              {/* Notice when paid pass is pending verification */}
              {isPaidPassPending && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2.5 mt-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold text-amber-300">Paid Pass Pending Admin Verification</div>
                    <div className="text-slate-300 text-[11px]">
                      Your payment of ₹{pendingAmount} for <span className="font-semibold text-white">{pendingProgramNames}</span> has been submitted. Pass download will unlock automatically once college administrators verify your payment.
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1 min-w-0 bg-slate-800/70 sm:bg-transparent p-3 sm:p-0 rounded-xl sm:rounded-none">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Event Registration No.</div>
              <div className="text-lg sm:text-2xl font-mono font-black text-amber-400 tracking-wider break-all">
                {session.registrationNumber}
              </div>
            </div>
          </div>
        </div>

        {/* Edit Pass Modal */}
        {session && (
          <EditEventPassModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            event={event}
            participant={session}
            onSuccess={(updated) => {
              setSession((prev) =>
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
        )}

      <Link href={`/events/invitations?eventId=${encodeURIComponent(event.id)}`} className="flex items-center justify-between rounded-xl sm:rounded-2xl border border-violet-200 bg-white p-3.5 sm:p-4 shadow-sm hover:bg-violet-50 transition-colors">
        <span className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-800"><Bell className="h-4 w-4 text-violet-700 shrink-0"/> My Invitations</span>
        {unreadInvitationCount > 0 && <span className="rounded-full bg-violet-700 px-2.5 py-0.5 text-xs font-bold text-white">{unreadInvitationCount} unread</span>}
      </Link>

      {/* My Team Requests link */}
      <button
        type="button"
        onClick={() => setFindTeamProgram({ programId: '', programName: '', initialView: 'requests' })}
        className="w-full flex items-center justify-between rounded-xl sm:rounded-2xl border border-amber-200 bg-white p-3.5 sm:p-4 shadow-sm hover:bg-amber-50/50 transition-colors cursor-pointer text-left"
      >
        <span className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-800">
          <Send className="h-4 w-4 text-amber-600 shrink-0" />
          <span>My Team Join Requests</span>
        </span>
        <div className="flex items-center gap-2">
          {unreadJoinRequestCount > 0 && (
            <span className="rounded-full bg-amber-600 px-2.5 py-0.5 text-xs font-bold text-white">
              {unreadJoinRequestCount} new
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        </div>
      </button>

      {/* Programs Joined Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
            <span>Programs &amp; Competitions Joined ({programs.length})</span>
          </h3>

          <Link
            href={`/events/${event.slug}`}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors self-start sm:self-auto"
          >
            <span>Explore More Programs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {programs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 text-center space-y-3">
            <p className="text-xs text-slate-500">
              You haven&apos;t joined any individual or team programs yet.
            </p>
            <Link
              href={`/events/${event.slug}`}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-colors w-full sm:w-auto"
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>Browse Programs &amp; Join</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {programs.map((p, idx) => {
              const isTeamProgram = Boolean(p.teamId || p.participationType === 'TEAM');
              const isLeader = p.participantRole === 'TEAM LEADER';
              const memberCount = p.teamMembers?.length || 1;

              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-3 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 break-words">{p.programName}</span>
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 shrink-0">
                        {p.participationType}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400">Program ID:</span>
                        <span className="font-mono font-bold text-slate-800 break-all">{p.registrationNumber}</span>
                      </div>

                      {p.teamName && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-400">Team:</span>
                          <span className="font-bold text-purple-700 flex items-center gap-1 truncate">
                            <span className="truncate">{p.teamName}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-800 font-semibold shrink-0">
                              {isLeader ? 'Leader' : 'Member'}
                            </span>
                          </span>
                        </div>
                      )}

                      {isTeamProgram && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Roster:</span>
                          <span className="text-slate-700 font-medium">
                            {memberCount} member{memberCount > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Payment:</span>
                        <span
                          className={`font-semibold ${
                            p.paymentStatus === 'VERIFIED' || p.paymentStatus === 'PAID'
                              ? 'text-emerald-600'
                              : 'text-amber-600'
                          }`}
                        >
                          {p.paymentStatus}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Team Management Action Button */}
                  {isTeamProgram && (
                    <div className="pt-2 border-t border-slate-100">
                      {isLeader ? (
                        p.isRegistrationOpen ? (
                          <button
                            type="button"
                            onClick={() => setSelectedTeamProgram(p)}
                            className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer text-center"
                          >
                            <Users className="w-3.5 h-3.5 shrink-0" />
                            <span>Manage Team Members ({memberCount})</span>
                          </button>
                        ) : (
                          <div className="space-y-1">
                            <button
                              type="button"
                              onClick={() => setSelectedTeamProgram(p)}
                              className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center"
                            >
                              <Users className="w-3.5 h-3.5 shrink-0" />
                              <span>View Team Roster (Locked)</span>
                            </button>
                            <div className="text-[10px] text-amber-700 text-center font-medium">
                              Registration closed • Team roster finalized
                            </div>
                          </div>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedTeamProgram(p)}
                          className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center"
                        >
                          <Users className="w-3.5 h-3.5 shrink-0" />
                          <span>View Teammates ({memberCount})</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manage Team Modal */}
      {selectedTeamProgram && session && (
        <ManageTeamModal
          isOpen={Boolean(selectedTeamProgram)}
          onClose={() => setSelectedTeamProgram(null)}
          eventId={event.id}
          program={selectedTeamProgram}
          userRegistrationNumber={session.registrationNumber}
          onTeamUpdated={refreshRegistrations}
        />
      )}

      {/* Find Team Modal */}
      {findTeamProgram && session && (
        <FindTeamModal
          isOpen={Boolean(findTeamProgram)}
          onClose={() => setFindTeamProgram(null)}
          eventId={event.id}
          programId={findTeamProgram.programId}
          programName={findTeamProgram.programName}
          initialView={findTeamProgram.initialView}
          userRegistrationNumber={session.registrationNumber}
          onTeamJoined={refreshRegistrations}
        />
      )}
    </div>
  );
}
