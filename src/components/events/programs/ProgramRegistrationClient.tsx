'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  User,
  Users,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  ArrowRight,
  ArrowLeft,
  Ticket,
  QrCode,
  ShieldCheck,
  LogIn,
} from 'lucide-react';
import type { CollegeEvent } from '@/types/events';
import type { EventProgram } from '@/types/programs';
import type { EventSessionPayload } from '@/lib/events/event-session';
import {
  loginToEventAction,
  registerForProgramAction,
  registerForTeamProgramAction,
  submitPaymentReferenceAction,
} from '@/app/admin/events/event-registration-actions';

interface Props {
  event: CollegeEvent;
  program: EventProgram;
  initialSession: EventSessionPayload | null;
}

interface TeamMemberForm {
  fullName: string;
  studentId: string;
  email: string;
  mobile: string;
  branch: string;
  semester: string;
}

export function ProgramRegistrationClient({ event, program, initialSession }: Props) {
  const [session, setSession] = useState<EventSessionPayload | null>(initialSession);

  // Login form state (if not logged in)
  const [loginRegNum, setLoginRegNum] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Registration state
  const isTeam = program.participation_type === 'TEAM';
  const minTeam = program.min_team_size || 1;
  const maxTeam = program.max_team_size || 20;

  const [teamName, setTeamName] = useState('');
  const [members, setMembers] = useState<TeamMemberForm[]>([
    { fullName: '', studentId: '', email: '', mobile: '', branch: '', semester: '' },
  ]);

  // Payment reference
  const isPaid = (event.payment_required || program.registration_fee > 0) && program.registration_fee > 0;
  const [paymentRef, setPaymentRef] = useState('');

  // Status
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    registrationNumber: string;
    teamId?: string;
    paymentStatus?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // 1. LOGIN HANDLER
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!loginRegNum.trim() || !loginEmail.trim()) {
      setLoginError('Please enter both your Registration Number and Email.');
      return;
    }

    setLoginLoading(true);
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
      } else {
        setLoginError(res.error || 'Verification failed. Please check your credentials.');
      }
    } catch (err: unknown) {
      setLoginError((err as Error).message || 'Login failed.');
    } finally {
      setLoginLoading(false);
    }
  };

  // 2. TEAM MEMBER MANAGEMENT
  const addMember = () => {
    if (members.length + 1 >= maxTeam) return;
    setMembers([
      ...members,
      { fullName: '', studentId: '', email: '', mobile: '', branch: '', semester: '' },
    ]);
  };

  const removeMember = (index: number) => {
    if (members.length <= 1) return;
    setMembers(members.filter((_, idx) => idx !== index));
  };

  const updateMember = (index: number, field: keyof TeamMemberForm, value: string) => {
    const updated = [...members];
    updated[index][field] = value;
    setMembers(updated);
  };

  // 3. SUBMIT PROGRAM REGISTRATION
  const handleProgramSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!session) {
      setErrorMsg('Please log in with your Event Registration Number first.');
      return;
    }

    setSubmitting(true);
    try {
      if (!isTeam) {
        // Individual Registration
        const res = await registerForProgramAction(event.id, program.id);
        if (res.success && res.registrationNumber) {
          if (paymentRef.trim()) {
            await submitPaymentReferenceAction(
              event.id,
              res.registrationNumber,
              paymentRef.trim(),
              program.slug
            );
          }
          setSuccessResult({
            registrationNumber: res.registrationNumber,
            paymentStatus: res.paymentStatus,
          });
        } else {
          setErrorMsg(res.error || 'Registration failed.');
        }
      } else {
        // Team Registration
        if (!teamName.trim()) {
          setErrorMsg('Team name is required.');
          setSubmitting(false);
          return;
        }

        const validMembers = members.filter((m) => m.fullName.trim() && m.studentId.trim());
        const totalTeamSize = validMembers.length + 1; // +1 for leader

        if (totalTeamSize < minTeam) {
          setErrorMsg(`Team must have at least ${minTeam} members (including leader). Currently has ${totalTeamSize}.`);
          setSubmitting(false);
          return;
        }

        if (totalTeamSize > maxTeam) {
          setErrorMsg(`Team can have at most ${maxTeam} members (including leader). Currently has ${totalTeamSize}.`);
          setSubmitting(false);
          return;
        }

        const res = await registerForTeamProgramAction(event.id, program.id, {
          teamName: teamName.trim(),
          members: validMembers,
        });

        if (res.success && res.leaderProgramRegNumber) {
          if (paymentRef.trim()) {
            await submitPaymentReferenceAction(
              event.id,
              res.leaderProgramRegNumber,
              paymentRef.trim(),
              program.slug
            );
          }
          setSuccessResult({
            registrationNumber: res.leaderProgramRegNumber,
            teamId: res.teamId,
            paymentStatus: res.paymentStatus,
          });
        } else {
          setErrorMsg(res.error || 'Team registration failed.');
        }
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // SUCCESS CONFIRMATION VIEW
  if (successResult) {
    return (
      <div className="bg-white rounded-3xl border border-emerald-200/80 shadow-xl p-6 sm:p-10 max-w-xl mx-auto space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-slate-900">
            Successfully Registered!
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            You are officially registered for <span className="font-semibold text-slate-900">{program.name}</span> in {event.title}.
          </p>
        </div>

        {/* Credentials Card */}
        <div className="bg-slate-900 rounded-2xl p-5 text-white space-y-3 shadow-inner">
          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
              Program Registration Number
            </div>
            <div className="text-xl sm:text-2xl font-mono font-black text-amber-400">
              {successResult.registrationNumber}
            </div>
          </div>

          {successResult.teamId && (
            <div className="pt-2 border-t border-slate-800 space-y-1">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                Team Identifier
              </div>
              <div className="text-base font-mono font-bold text-emerald-400">
                {successResult.teamId}
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={() => handleCopy(successResult.registrationNumber)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'Copied!' : 'Copy Registration Number'}</span>
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 flex flex-col sm:flex-row gap-3">
          <Link
            href={`/events/${event.slug}/my-registrations`}
            className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            <span>View My Registrations</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href={`/events/${event.slug}`}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition-colors flex items-center justify-center"
          >
            <span>Back to Event</span>
          </Link>
        </div>
      </div>
    );
  }

  // STEP 1: NOT LOGGED IN -> REQUIRE EVENT REGISTRATION VERIFICATION
  if (!session) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 max-w-lg mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
            <Ticket className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Event Registration Required
          </h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            To register for <span className="font-semibold text-slate-800">{program.name}</span>, you must verify your existing Event Registration.
          </p>
        </div>

        {loginError && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{loginError}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Event Registration Number <span className="text-red-500">*</span>
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
              Registered Email Address <span className="text-red-500">*</span>
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
            disabled={loginLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {loginLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Event Identity...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Verify &amp; Continue</span>
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 text-center space-y-2">
          <p className="text-xs text-slate-500">Haven&apos;t registered for {event.title} yet?</p>
          <Link
            href={`/events/${event.slug}/register`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
          >
            <span>Register for the Event First</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // STEP 2: LOGGED IN -> PROGRAM REGISTRATION FORM
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 max-w-2xl mx-auto space-y-6">
      {/* Verified Student Banner */}
      <div className="bg-blue-50/80 rounded-2xl p-4 border border-blue-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">{session.fullName}</div>
            <div className="text-[11px] text-slate-500 font-mono">{session.registrationNumber}</div>
          </div>
        </div>
        <button
          onClick={() => setSession(null)}
          className="text-[11px] text-slate-500 hover:text-red-600 font-semibold transition-colors"
        >
          Change
        </button>
      </div>

      <div className="border-b border-slate-100 pb-3">
        <h2 className="text-xl font-bold text-slate-900">
          {isTeam ? `Team Entry: ${program.name}` : `Individual Entry: ${program.name}`}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {isTeam
            ? `As Team Leader, register your team (${minTeam}–${maxTeam} members). Members without an event pass will be registered automatically.`
            : `Confirm your individual entry for this competition.`}
        </p>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleProgramSubmit} className="space-y-6">
        {/* TEAM FIELDS */}
        {isTeam && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Team Name <span className="text-red-500">*</span></span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Thunder XI"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-xs sm:text-sm font-semibold transition-all"
              />
            </div>

            {/* Team Members List */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Team Members (Leader + {members.length} member{members.length > 1 ? 's' : ''})
                </span>
                {members.length + 1 < maxTeam && (
                  <button
                    type="button"
                    onClick={addMember}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Member</span>
                  </button>
                )}
              </div>

              {members.map((member, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 relative group"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Member #{idx + 1}</span>
                    {members.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMember(idx)}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <input
                        type="text"
                        required
                        placeholder="Full Name *"
                        value={member.fullName}
                        onChange={(e) => updateMember(idx, 'fullName', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        required
                        placeholder="College Roll / Reg No *"
                        value={member.studentId}
                        onChange={(e) => updateMember(idx, 'studentId', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <input
                        type="email"
                        required
                        placeholder="Email Address *"
                        value={member.email}
                        onChange={(e) => updateMember(idx, 'email', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div>
                      <input
                        type="tel"
                        required
                        placeholder="Mobile Number *"
                        value={member.mobile}
                        onChange={(e) => updateMember(idx, 'mobile', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <input
                        type="text"
                        placeholder="Branch / Department"
                        value={member.branch}
                        onChange={(e) => updateMember(idx, 'branch', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Semester"
                        value={member.semester}
                        onChange={(e) => updateMember(idx, 'semester', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PAYMENT SECTION (IF APPLICABLE) */}
        {isPaid && (
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-amber-700" />
                <span>Payment Required: ₹{program.registration_fee}</span>
              </span>
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                {isTeam ? 'Per Team' : 'Individual Entry'}
              </span>
            </div>

            {event.payment_upi_id && (
              <div className="text-xs text-slate-700 flex items-center justify-between bg-white/80 p-2.5 rounded-xl border border-amber-200">
                <span className="text-slate-500">Pay to UPI:</span>
                <span className="font-mono font-bold text-slate-900">{event.payment_upi_id}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Transaction ID / UTR Number / UPI Reference
              </label>
              <input
                type="text"
                placeholder="e.g. 329019284012"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>
        )}

        {/* SUBMIT BUTTON */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Registering in Google Sheets...</span>
            </>
          ) : (
            <>
              <span>Submit Registration</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
