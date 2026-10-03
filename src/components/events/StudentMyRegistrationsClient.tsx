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
import { getMyTeamInvitationsAction } from '@/app/events/invitations/actions';
import { getMyJoinRequestsAction } from '@/app/events/join-requests/actions';

interface Props {
  event: CollegeEvent;
  initialSession: EventSessionPayload | null;
  initialPrograms: StudentProgramRegistrationItem[];
}

export function StudentMyRegistrationsClient({
  event,
  initialSession,
  initialPrograms,
}: Props) {
  const [session, setSession] = useState<EventSessionPayload | null>(initialSession);
  const [programs, setPrograms] = useState<StudentProgramRegistrationItem[]>(initialPrograms);
  const [selectedTeamProgram, setSelectedTeamProgram] = useState<StudentProgramRegistrationItem | null>(null);

  // Login inputs
  const [loginRegNum, setLoginRegNum] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [unreadInvitationCount, setUnreadInvitationCount] = useState(0);
  const [unreadJoinRequestCount, setUnreadJoinRequestCount] = useState(0);

  // Find Team modal state
  const [findTeamProgram, setFindTeamProgram] = useState<{
    programId: string;
    programName: string;
    initialView?: 'search' | 'requests';
  } | null>(null);

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
          studentId: '',
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
              Registered Email Address
            </label>
            <input
              type="email"
              required
              placeholder="student@college.ac.in"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-xs sm:text-sm transition-all"
            />
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

        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-widest bg-blue-900/60 px-2.5 sm:px-3 py-1 rounded-full border border-blue-800">
              Official Event Pass
            </span>
            <button
              onClick={handleLogout}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out</span>
            </button>
          </div>

          <div className="min-w-0">
            <h2 className="text-lg sm:text-2xl font-black break-words">{event.title}</h2>
            <p className="text-xs text-slate-300 mt-0.5 break-words">{event.venue}</p>
          </div>

          <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3 sm:gap-4 pt-4 border-t border-slate-700/60">
            <div className="space-y-1 min-w-0">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Participant Name</div>
              <div className="text-sm sm:text-base font-bold text-white break-words">{session.fullName}</div>
              <div className="text-xs text-slate-300 break-all">{session.email}</div>
            </div>

            <div className="space-y-1 min-w-0 bg-slate-800/70 sm:bg-transparent p-3 sm:p-0 rounded-xl sm:rounded-none">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Event Registration No.</div>
              <div className="text-lg sm:text-2xl font-mono font-black text-amber-400 tracking-wider break-all">
                {session.registrationNumber}
              </div>
            </div>
          </div>
        </div>
      </div>

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
