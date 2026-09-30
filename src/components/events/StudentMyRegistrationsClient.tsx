'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  UserCheck,
  Ticket,
  Trophy,
  Users,
  User,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  LogIn,
  ArrowRight,
  LogOut,
  IndianRupee,
} from 'lucide-react';
import type { CollegeEvent } from '@/types/events';
import type { EventSessionPayload } from '@/lib/events/event-session';
import {
  loginToEventAction,
  logoutFromEventAction,
  getStudentRegistrationsAction,
} from '@/app/admin/events/event-registration-actions';

interface ProgramRegItem {
  registrationNumber: string;
  programName: string;
  participationType: string;
  teamId: string;
  teamName: string;
  participantRole: string;
  paymentAmount: number;
  paymentStatus: string;
  paymentReference: string;
  registrationStatus: string;
  registeredAt: string;
}

interface Props {
  event: CollegeEvent;
  initialSession: EventSessionPayload | null;
  initialPrograms: ProgramRegItem[];
}

export function StudentMyRegistrationsClient({
  event,
  initialSession,
  initialPrograms,
}: Props) {
  const [session, setSession] = useState<EventSessionPayload | null>(initialSession);
  const [programs, setPrograms] = useState<ProgramRegItem[]>(initialPrograms);

  // Login inputs
  const [loginRegNum, setLoginRegNum] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
          setPrograms(regRes.programs as ProgramRegItem[]);
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
  };

  // NOT LOGGED IN VIEW
  if (!session) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 max-w-md mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
            <UserCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Access Your Registrations</h2>
          <p className="text-xs text-slate-500">
            View your event pass, joined programs, and team details for {event.title}.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
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
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Checking Records...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>View Registrations</span>
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 text-center">
          <Link
            href={`/events/${event.slug}/register`}
            className="text-xs font-bold text-blue-600 hover:underline"
          >
            Don&apos;t have an event pass? Register here &rarr;
          </Link>
        </div>
      </div>
    );
  }

  // LOGGED IN DASHBOARD VIEW
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Event Pass Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Ticket className="w-48 h-48" />
        </div>

        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-widest bg-blue-900/60 px-3 py-1 rounded-full border border-blue-800">
              Official Event Pass
            </span>
            <button
              onClick={handleLogout}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out</span>
            </button>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-black">{event.title}</h2>
            <p className="text-xs text-slate-300 mt-0.5">{event.venue}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-700/60">
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Participant Name</div>
              <div className="text-base font-bold text-white">{session.fullName}</div>
              <div className="text-xs text-slate-400">{session.email}</div>
            </div>

            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Event Registration No.</div>
              <div className="text-xl font-mono font-black text-amber-400 tracking-wider">
                {session.registrationNumber}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Programs Joined Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span>Programs &amp; Competitions Joined ({programs.length})</span>
          </h3>

          <Link
            href={`/events/${event.slug}`}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
          >
            <span>Explore More Programs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {programs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
            <p className="text-xs text-slate-500">
              You haven&apos;t joined any individual or team programs yet.
            </p>
            <Link
              href={`/events/${event.slug}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-colors"
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>Browse Programs &amp; Join</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {programs.map((p, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900">{p.programName}</span>
                  <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                    {p.participationType}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Program ID:</span>
                    <span className="font-mono font-bold text-slate-800">{p.registrationNumber}</span>
                  </div>

                  {p.teamName && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Team:</span>
                      <span className="font-bold text-purple-700">{p.teamName} ({p.participantRole})</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Payment:</span>
                    <span className={`font-semibold ${p.paymentStatus === 'VERIFIED' || p.paymentStatus === 'PAID' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {p.paymentStatus}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
