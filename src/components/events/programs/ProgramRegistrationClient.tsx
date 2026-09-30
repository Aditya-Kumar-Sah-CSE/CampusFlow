'use client';

import React, { useState, useEffect } from 'react';
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
  Ticket,
  QrCode,
  ShieldCheck,
  Search,
  Mail,
  Phone,
  Hash,
} from 'lucide-react';
import type { CollegeEvent } from '@/types/events';
import type { EventProgram } from '@/types/programs';
import type { EventSessionPayload } from '@/lib/events/event-session';
import type { Branch, Semester } from '@/types/database';
import { formatOrdinal } from '@/lib/events/academic-formatter';
import {
  verifyEventRegistrationAction,
  resolveCurrentEventRegistrationAction,
  checkProgramRegistrationAction,
  lookupTeamMemberAction,
  registerForProgramAction,
  registerForTeamProgramAction,
  submitPaymentReferenceAction,
  logoutFromEventAction,
  getEventAcademicMastersAction,
} from '@/app/admin/events/event-registration-actions';
import { FindTeamModal } from '@/components/events/FindTeamModal';

export interface VerifiedParticipant {
  fullName: string;
  registrationNumber: string;
  email: string;
  studentId: string;
  mobile: string;
  branch: string;
  semester: string;
  gender?: string;
}

export interface ExistingProgramReg {
  registrationNumber: string;
  programName: string;
  participationType: string;
  teamId?: string;
  teamName?: string;
  participantRole?: string;
  paymentStatus: string;
  registeredAt: string;
}

interface TeamMemberItem {
  id: string;
  // Mode: 'verified' (looked up via Event Registration Number) or 'manual' (unregistered student)
  mode: 'verified' | 'manual';
  // If verified
  eventRegNumber: string;
  isVerified: boolean;
  verifying?: boolean;
  verifyError?: string;
  // Details (read-only if verified, editable if manual)
  fullName: string;
  studentId: string;
  email: string;
  mobile: string;
  branch: string;
  semester: string;
  gender: string;
  isCustomBranch?: boolean;
  isCustomSemester?: boolean;
}

interface Props {
  event: CollegeEvent;
  program: EventProgram;
  initialSession: EventSessionPayload | null;
  tenantSlug?: string;
  branches?: Branch[];
  semesters?: Semester[];
}

export function ProgramRegistrationClient({
  event,
  program,
  initialSession,
  tenantSlug,
  branches: initialBranches,
  semesters: initialSemesters,
}: Props) {
  // Navigation prefix helper
  const basePath = tenantSlug ? `/${tenantSlug}/events/${event.slug}` : `/events/${event.slug}`;
  const myRegistrationsPath = tenantSlug ? `/${tenantSlug}/events/${event.slug}/my-registrations` : `/events/${event.slug}/my-registrations`;
  const registerEventPath = tenantSlug ? `/${tenantSlug}/events/${event.slug}/register` : `/events/${event.slug}/register`;

  // Academic master data for member manual entry dropdowns
  const [branches, setBranches] = useState<Branch[]>(initialBranches || []);
  const [semesters, setSemesters] = useState<Semester[]>(initialSemesters || []);

  useEffect(() => {
    if (initialBranches && initialBranches.length > 0) setBranches(initialBranches);
  }, [initialBranches]);

  useEffect(() => {
    if (initialSemesters && initialSemesters.length > 0) setSemesters(initialSemesters);
  }, [initialSemesters]);

  useEffect(() => {
    if ((!initialBranches || initialBranches.length === 0) && event.college_id) {
      getEventAcademicMastersAction(event.college_id)
        .then((res) => {
          if (res.branches && res.branches.length > 0) setBranches(res.branches);
          if (res.semesters && res.semesters.length > 0) setSemesters(res.semesters);
        })
        .catch(() => {});
    }
  }, [event.college_id, initialBranches]);

  // 1. Session & Verified Participant
  const [participant, setParticipant] = useState<VerifiedParticipant | null>(
    initialSession
      ? {
          fullName: initialSession.fullName,
          registrationNumber: initialSession.registrationNumber,
          email: initialSession.email,
          studentId: initialSession.studentId,
          mobile: initialSession.mobile || '',
          branch: initialSession.branch || '',
          semester: initialSession.semester || '',
          gender: initialSession.gender || '',
        }
      : null
  );

  // Verification form state (when not verified)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginRegNum, setLoginRegNum] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // 2. Existing program registration (duplicate detection)
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [existingReg, setExistingReg] = useState<ExistingProgramReg | null>(null);

  // 3. Registration Type
  // Program participation type: INDIVIDUAL | TEAM | BOTH
  const allowedType = program.participation_type;
  const [regType, setRegType] = useState<'INDIVIDUAL' | 'TEAM'>(
    allowedType === 'TEAM' ? 'TEAM' : 'INDIVIDUAL'
  );

  // 4. Team Fields
  const minTeam = program.min_team_size || 1;
  const maxTeam = program.max_team_size || 20;
  const [teamName, setTeamName] = useState('');
  const [members, setMembers] = useState<TeamMemberItem[]>([]);

  // 5. Payment Fields
  const isPaid = (event.payment_required || program.registration_fee > 0) && program.registration_fee > 0;
  const [paymentRef, setPaymentRef] = useState('');

  // 6. Submission & Results
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    registrationNumber: string;
    teamId?: string;
    paymentStatus?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isFindTeamOpen, setIsFindTeamOpen] = useState(false);

  // Resolve full details and check duplicate if already logged in on mount
  useEffect(() => {
    let isMounted = true;

    async function initCheck() {
      // 1. Resolve full student details from Google Sheet
      const res = await resolveCurrentEventRegistrationAction(event.id);
      if (!isMounted) return;

      if (res.isValid && res.participant) {
        setParticipant(res.participant);

        // 2. Check if already registered for this program
        setCheckingDuplicate(true);
        const dupCheck = await checkProgramRegistrationAction(event.id, program.id);
        if (!isMounted) return;
        setCheckingDuplicate(false);

        if (dupCheck.isRegistered && dupCheck.registration) {
          setExistingReg(dupCheck.registration);
        }
      }
    }

    if (initialSession) {
      initCheck();
    }

    return () => {
      isMounted = false;
    };
  }, [event.id, program.id, initialSession]);

  // HANDLE EVENT REGISTRATION VERIFICATION
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const cleanEmail = loginEmail.trim().toLowerCase();
    const cleanReg = loginRegNum.trim().toUpperCase();

    if (!cleanEmail && !cleanReg) {
      setLoginError('Please enter your Email Address or Event Registration Number.');
      return;
    }

    setLoginLoading(true);
    try {
      const res = await verifyEventRegistrationAction({
        eventId: event.id,
        email: cleanEmail || undefined,
        registrationNumber: cleanReg || undefined,
      });

      if (res.success && res.participant) {
        setParticipant(res.participant);
        setLoginError(null);

        // Check duplicate program registration for this student
        setCheckingDuplicate(true);
        const dupCheck = await checkProgramRegistrationAction(event.id, program.id);
        setCheckingDuplicate(false);

        if (dupCheck.isRegistered && dupCheck.registration) {
          setExistingReg(dupCheck.registration);
        }
      } else {
        setLoginError(res.error || 'Verification failed. Please check your Registration Number or Email.');
      }
    } catch (err: unknown) {
      setLoginError((err as Error).message || 'An error occurred during verification.');
    } finally {
      setLoginLoading(false);
    }
  };

  // LOGOUT / CHANGE STUDENT
  const handleChangeStudent = async () => {
    try {
      await logoutFromEventAction(event.id);
    } catch {
      // ignore
    }
    setParticipant(null);
    setExistingReg(null);
    setLoginRegNum('');
    setLoginEmail('');
    setMembers([]);
    setTeamName('');
    setErrorMsg(null);
  };

  // ADD TEAM MEMBER ROW
  const handleAddMember = () => {
    if (members.length + 1 >= maxTeam) return;
    const newId = `m-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setMembers((prev) => [
      ...prev,
      {
        id: newId,
        mode: 'verified',
        eventRegNumber: '',
        isVerified: false,
        fullName: '',
        studentId: '',
        email: '',
        mobile: '',
        branch: '',
        semester: '',
        gender: '',
      },
    ]);
  };

  // REMOVE TEAM MEMBER ROW
  const handleRemoveMember = (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  // LOOKUP TEAM MEMBER BY REGISTRATION NUMBER
  const handleLookupMember = async (id: string, regNumber: string) => {
    const cleanReg = regNumber.trim().toUpperCase();
    if (!cleanReg) return;

    setMembers((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, verifying: true, verifyError: undefined } : m
      )
    );

    try {
      const res = await lookupTeamMemberAction(event.id, cleanReg);
      if (res.success && res.member) {
        setMembers((prev) =>
          prev.map((m) =>
            m.id === id
              ? {
                  ...m,
                  verifying: false,
                  isVerified: true,
                  eventRegNumber: res.member!.registrationNumber,
                  fullName: res.member!.fullName,
                  studentId: res.member!.studentId,
                  email: res.member!.email,
                  branch: res.member!.branch,
                  semester: res.member!.semester,
                  gender: res.member!.gender,
                  verifyError: undefined,
                }
              : m
          )
        );
      } else {
        setMembers((prev) =>
          prev.map((m) =>
            m.id === id
              ? {
                  ...m,
                  verifying: false,
                  isVerified: false,
                  verifyError: res.error || 'Event registration not found.',
                }
              : m
          )
        );
      }
    } catch {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                verifying: false,
                isVerified: false,
                verifyError: 'Verification lookup failed.',
              }
            : m
        )
      );
    }
  };

  // UPDATE MANUAL MEMBER FIELD
  const handleUpdateManualMember = (
    id: string,
    field: keyof Omit<TeamMemberItem, 'id' | 'mode' | 'isVerified' | 'verifying' | 'verifyError'>,
    val: string
  ) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: val } : m))
    );
  };

  // SUBMIT PROGRAM REGISTRATION
  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!participant) {
      setErrorMsg('Event registration verification is required before joining this program.');
      return;
    }

    setSubmitting(true);
    try {
      if (regType === 'INDIVIDUAL') {
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
        } else if (res.isDuplicate && res.existingRegistration) {
          setExistingReg(res.existingRegistration);
          setErrorMsg('You are already registered for this program.');
        } else {
          setErrorMsg(res.error || 'Registration failed. Please try again.');
        }
      } else {
        // Team Registration
        if (!teamName.trim()) {
          setErrorMsg('Team name is required.');
          setSubmitting(false);
          return;
        }

        const totalTeamSize = members.length + 1; // leader + members
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

        // Validate each member
        for (let i = 0; i < members.length; i++) {
          const m = members[i];
          if (m.mode === 'verified' && !m.isVerified) {
            setErrorMsg(`Member #${i + 1} has not been verified yet. Please enter a valid Event Registration Number and click Verify, or switch to manual entry.`);
            setSubmitting(false);
            return;
          }
          if (m.mode === 'manual') {
            if (!m.fullName.trim() || !m.studentId.trim() || !m.email.trim()) {
              setErrorMsg(`Member #${i + 1} requires Name, Student ID, and Email.`);
              setSubmitting(false);
              return;
            }
          }
        }

        const formattedMembers = members.map((m) => ({
          fullName: m.fullName.trim(),
          studentId: m.studentId.trim().toUpperCase(),
          email: m.email.trim().toLowerCase(),
          mobile: m.mobile.trim(),
          branch: m.branch.trim(),
          semester: m.semester.trim(),
          gender: m.gender.trim(),
          eventRegNumber: m.mode === 'verified' && m.isVerified ? m.eventRegNumber.trim() : undefined,
        }));

        const res = await registerForTeamProgramAction(event.id, program.id, {
          teamName: teamName.trim(),
          members: formattedMembers,
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
          setErrorMsg(res.error || 'Team registration failed. Please try again.');
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

  // ============================================================
  // VIEW A: SUCCESS CONFIRMATION
  // ============================================================
  if (successResult) {
    return (
      <div className="bg-white rounded-3xl border border-emerald-200/90 shadow-xl p-6 sm:p-10 max-w-xl mx-auto space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-2xl font-extrabold text-slate-900">
            Registration Successful!
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Registration Number'}</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 flex flex-col sm:flex-row gap-3">
          <Link
            href={myRegistrationsPath}
            className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            <span>View My Registrations</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href={basePath}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition-colors flex items-center justify-center"
          >
            <span>Back to Event</span>
          </Link>
        </div>
      </div>
    );
  }

  // ============================================================
  // VIEW B: ALREADY REGISTERED FOR THIS PROGRAM (DUPLICATE PROTECTION)
  // ============================================================
  if (participant && existingReg) {
    return (
      <div className="bg-white rounded-3xl border border-blue-200 shadow-md p-6 sm:p-8 max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Event Registration Verified</span>
          </div>
          <button
            onClick={handleChangeStudent}
            className="text-xs text-slate-500 hover:text-blue-600 font-medium underline"
          >
            Switch Student
          </button>
        </div>

        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            You are already registered for this program.
          </h2>
          <p className="text-xs text-slate-500">
            Our records confirm that you have already joined <span className="font-semibold text-slate-800">{program.name}</span>.
          </p>
        </div>

        {/* Existing Registration Details */}
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Program Registration No:</span>
            <span className="font-mono font-bold text-slate-900 text-sm">{existingReg.registrationNumber}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Participant Name:</span>
            <span className="font-semibold text-slate-900">{participant.fullName}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Event Registration No:</span>
            <span className="font-mono text-slate-700">{participant.registrationNumber}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Participation Type:</span>
            <span className="font-semibold text-slate-800">{existingReg.participationType}</span>
          </div>
          {existingReg.teamName && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Team:</span>
              <span className="font-semibold text-purple-700 flex items-center gap-1.5">
                <span>{existingReg.teamName}</span>
                {existingReg.participantRole && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-800 font-bold">
                    {existingReg.participantRole === 'TEAM LEADER' ? 'Leader' : 'Member'}
                  </span>
                )}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Payment Status:</span>
            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {existingReg.paymentStatus}
            </span>
          </div>
        </div>

        {existingReg.teamName && existingReg.participantRole === 'TEAM LEADER' && (
          <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5 text-center sm:text-left">
              <div className="font-bold text-purple-900 flex items-center justify-center sm:justify-start gap-1">
                <Users className="w-3.5 h-3.5 text-purple-700" />
                <span>Team Leader Controls</span>
              </div>
              <p className="text-purple-700 text-[11px]">
                You can add, edit, or remove team members while registration remains open.
              </p>
            </div>
            <Link
              href={`${myRegistrationsPath}?manageTeam=${existingReg.teamId || ''}`}
              className="px-3.5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Manage Team</span>
            </Link>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link
            href={myRegistrationsPath}
            className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5"
          >
            <span>View All My Registrations</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href={basePath}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm transition-colors flex items-center justify-center"
          >
            <span>Back to Event</span>
          </Link>
        </div>
      </div>
    );
  }

  // ============================================================
  // VIEW C: UNVERIFIED -> SHOW EMAIL + REGISTRATION NUMBER VERIFICATION
  // ============================================================
  if (!participant) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 max-w-lg mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
            <Ticket className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Already registered for this event?
          </h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            To register for <span className="font-semibold text-slate-800">{program.name}</span>, verify your existing Event Registration details.
          </p>
        </div>

        {loginError && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{loginError}</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Email Address
            </label>
            <input
              type="email"
              placeholder="e.g. adityakumarsah8709@gmail.com"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-xs sm:text-sm transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Event Registration Number
            </label>
            <input
              type="text"
              placeholder="e.g. UMANG27-E001"
              value={loginRegNum}
              onChange={(e) => setLoginRegNum(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-xs sm:text-sm font-mono uppercase transition-all"
            />
          </div>

          <p className="text-[11px] text-slate-400">
            Provide either your registered Email Address or Event Registration Number (or both).
          </p>

          <button
            type="submit"
            disabled={loginLoading}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {loginLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Event Registration...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Verify Event Registration</span>
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 text-center space-y-2">
          <p className="text-xs text-slate-500">Haven&apos;t registered for {event.title} yet?</p>
          <Link
            href={registerEventPath}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
          >
            <span>Register for the Event First</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // ============================================================
  // VIEW D: VERIFIED -> PROGRAM REGISTRATION ENTRY
  // ============================================================
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 max-w-2xl mx-auto space-y-6">
      {checkingDuplicate && (
        <div className="flex items-center justify-center gap-2 p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-700 font-medium animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
          <span>Checking program enrollment status...</span>
        </div>
      )}

      {/* 1. Verified Banner & Read-Only Participant Details */}
      <div className="bg-gradient-to-br from-emerald-50/90 to-blue-50/60 rounded-2xl p-5 border border-emerald-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs sm:text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>✓ Event Registration Verified</span>
          </div>
          <button
            type="button"
            onClick={handleChangeStudent}
            className="text-xs text-slate-500 hover:text-red-600 font-medium transition-colors cursor-pointer"
          >
            Change
          </button>
        </div>

        {/* Read-only Student Card */}
        <div className="pt-2 border-t border-emerald-200/60 space-y-2">
          <div>
            <div className="text-base font-extrabold text-slate-900">
              {participant.fullName}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-slate-600">
              <span className="font-mono font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded">
                {participant.registrationNumber}
              </span>
              {(participant.branch || participant.semester) && (
                <span className="font-medium text-slate-700">
                  {participant.branch}{participant.branch && participant.semester ? ' • ' : ''}{participant.semester}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px] text-slate-600">
            <div className="flex items-center gap-1.5 truncate">
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{participant.email}</span>
            </div>
            {participant.studentId && (
              <div className="flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Roll / ID: {participant.studentId}</span>
              </div>
            )}
            {participant.mobile && (
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{participant.mobile}</span>
              </div>
            )}
            {participant.gender && (
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{participant.gender}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Registration Type Selector */}
      {allowedType === 'BOTH' && (
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Registration Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRegType('INDIVIDUAL')}
              className={`p-3.5 rounded-2xl border-2 text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                regType === 'INDIVIDUAL'
                  ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold'
                  : 'border-slate-200 hover:border-slate-300 text-slate-600 font-medium'
              }`}
            >
              <User className={`w-5 h-5 ${regType === 'INDIVIDUAL' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="text-xs sm:text-sm">Individual</span>
            </button>
            <button
              type="button"
              onClick={() => setRegType('TEAM')}
              className={`p-3.5 rounded-2xl border-2 text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                regType === 'TEAM'
                  ? 'border-purple-600 bg-purple-50/70 text-purple-900 font-bold'
                  : 'border-slate-200 hover:border-slate-300 text-slate-600 font-medium'
              }`}
            >
              <Users className={`w-5 h-5 ${regType === 'TEAM' ? 'text-purple-600' : 'text-slate-400'}`} />
              <span className="text-xs sm:text-sm">Team</span>
            </button>
          </div>
        </div>
      )}

      {/* Program Header */}
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-base sm:text-lg font-bold text-slate-900">
          {regType === 'TEAM' ? `Team Registration: ${program.name}` : `Individual Entry: ${program.name}`}
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {regType === 'TEAM'
            ? `As Team Leader, register your team (${minTeam}–${maxTeam} members). Members already registered will be linked; others will be auto-registered.`
            : `Confirm your individual entry. Participant details are loaded from your verified event registration.`}
        </p>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{errorMsg}</span>
        </div>
      )}

      {/* Option to find/request to join existing team instead of creating one */}
      {(regType === 'TEAM' || allowedType === 'TEAM') && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-700" />
              <span>Looking to join an existing team?</span>
            </p>
            <p className="text-[11px] text-indigo-700">
              Browse teams with open slots in this program and send a join request to the team leader.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsFindTeamOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Find Team &amp; Join</span>
          </button>
        </div>
      )}

      <form onSubmit={handleSubmitRegistration} className="space-y-6">
        {/* TEAM FIELDS */}
        {regType === 'TEAM' && (
          <div className="space-y-4">
            {/* Team Name */}
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 text-xs sm:text-sm font-semibold transition-all"
              />
            </div>

            {/* Team Leader Indicator */}
            <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200 flex items-center justify-between text-xs">
              <div>
                <div className="text-[10px] uppercase font-bold text-purple-600 tracking-wider">
                  Participant Role: TEAM_LEADER
                </div>
                <div className="font-bold text-slate-900 mt-0.5">
                  {participant.fullName} ({participant.registrationNumber})
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-purple-200/80 text-purple-900 font-bold text-[10px]">
                Leader
              </span>
            </div>

            {/* Team Members List */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Team Members (Leader + {members.length} member{members.length !== 1 ? 's' : ''})
                </span>
                {members.length + 1 < maxTeam && (
                  <button
                    type="button"
                    onClick={handleAddMember}
                    className="inline-flex items-center gap-1 text-xs font-bold text-purple-600 hover:text-purple-800 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Member</span>
                  </button>
                )}
              </div>

              {members.length === 0 && (
                <div className="text-center py-6 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                  <p className="text-xs text-slate-500">
                    Click &ldquo;Add Member&rdquo; to add teammates using their Event Registration Number or details.
                  </p>
                </div>
              )}

              {members.map((member, idx) => (
                <div
                  key={member.id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 relative group"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-2">
                      <span>Member #{idx + 1}</span>
                      {member.isVerified && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                          ✓ Verified
                        </span>
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.id)}
                      className="text-slate-400 hover:text-red-600 transition-colors cursor-pointer p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Mode Selector Tabs */}
                  <div className="flex items-center gap-2 text-[11px] pb-1 border-b border-slate-200/80">
                    <button
                      type="button"
                      onClick={() =>
                        setMembers((prev) =>
                          prev.map((m) =>
                            m.id === member.id ? { ...m, mode: 'verified' } : m
                          )
                        )
                      }
                      className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-colors ${
                        member.mode === 'verified'
                          ? 'bg-purple-100 text-purple-800'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Event Reg Number Lookup
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setMembers((prev) =>
                          prev.map((m) =>
                            m.id === member.id ? { ...m, mode: 'manual' } : m
                          )
                        )
                      }
                      className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-colors ${
                        member.mode === 'manual'
                          ? 'bg-purple-100 text-purple-800'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Manual Entry (Auto-Register)
                    </button>
                  </div>

                  {/* MODE A: Event Registration Lookup */}
                  {member.mode === 'verified' && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. UMANG27-E002"
                          value={member.eventRegNumber}
                          onChange={(e) =>
                            setMembers((prev) =>
                              prev.map((m) =>
                                m.id === member.id
                                  ? {
                                      ...m,
                                      eventRegNumber: e.target.value.toUpperCase(),
                                      isVerified: false,
                                    }
                                  : m
                              )
                            )
                          }
                          className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                        />
                        <button
                          type="button"
                          disabled={member.verifying || !member.eventRegNumber.trim()}
                          onClick={() => handleLookupMember(member.id, member.eventRegNumber)}
                          className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                        >
                          {member.verifying ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Search className="w-3.5 h-3.5" />
                          )}
                          <span>Verify</span>
                        </button>
                      </div>

                      {member.verifyError && (
                        <p className="text-[11px] text-red-600 font-medium">
                          {member.verifyError}
                        </p>
                      )}

                      {/* Verified Member Display (Read-Only) */}
                      {member.isVerified && (
                        <div className="p-3 bg-white rounded-xl border border-emerald-200 text-xs space-y-1 animate-in fade-in">
                          <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>✓ Member verified</span>
                          </div>
                          <div className="font-bold text-slate-900 text-sm">
                            {member.fullName}
                          </div>
                          <div className="text-slate-600 font-medium text-[11px]">
                            <span className="font-mono text-purple-700 font-bold">{member.eventRegNumber}</span>
                            {(member.branch || member.semester) && (
                              <span> • {member.branch}{member.branch && member.semester ? ' • ' : ''}{member.semester}</span>
                            )}
                          </div>
                          {member.studentId && (
                            <div className="text-[10px] text-slate-500">
                              Roll / ID: {member.studentId}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* MODE B: Manual Entry for Unregistered Teammates */}
                  {member.mode === 'manual' && (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Full Name *"
                          value={member.fullName}
                          onChange={(e) => handleUpdateManualMember(member.id, 'fullName', e.target.value)}
                          className="px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                        />
                        <input
                          type="text"
                          required
                          placeholder="Roll / Student ID *"
                          value={member.studentId}
                          onChange={(e) => handleUpdateManualMember(member.id, 'studentId', e.target.value.toUpperCase())}
                          className="px-3 py-2 rounded-xl border border-slate-300 text-xs uppercase focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="email"
                          required
                          placeholder="Email Address *"
                          value={member.email}
                          onChange={(e) => handleUpdateManualMember(member.id, 'email', e.target.value)}
                          className="px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                        />
                        <input
                          type="tel"
                          placeholder="Mobile Number"
                          value={member.mobile}
                          onChange={(e) => handleUpdateManualMember(member.id, 'mobile', e.target.value)}
                          className="px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Branch Dropdown with Other / Custom */}
                        <div className="space-y-1">
                          {branches.length > 0 && !member.isCustomBranch ? (
                            <select
                              value={member.branch}
                              onChange={(e) => {
                                if (e.target.value === '__OTHER__') {
                                  setMembers((prev) =>
                                    prev.map((m) =>
                                      m.id === member.id
                                        ? { ...m, isCustomBranch: true, branch: '' }
                                        : m
                                    )
                                  );
                                } else {
                                  handleUpdateManualMember(member.id, 'branch', e.target.value);
                                }
                              }}
                              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
                            >
                              <option value="">Select Branch (e.g. CSE)</option>
                              {branches.map((b) => (
                                <option key={b.id} value={b.code || b.name}>
                                  {b.name} {b.code ? `(${b.code})` : ''}
                                </option>
                              ))}
                              <option value="__OTHER__">Other / Custom Branch...</option>
                            </select>
                          ) : (
                            <div className="space-y-1">
                              {branches.length > 0 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-purple-700 font-semibold">Custom Branch</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setMembers((prev) =>
                                        prev.map((m) =>
                                          m.id === member.id
                                            ? { ...m, isCustomBranch: false, branch: '' }
                                            : m
                                        )
                                      )
                                    }
                                    className="text-[10px] text-purple-600 hover:underline cursor-pointer"
                                  >
                                    Select from list
                                  </button>
                                </div>
                              )}
                              <input
                                type="text"
                                placeholder="Branch (e.g. Civil Engineering)"
                                value={member.branch}
                                onChange={(e) => handleUpdateManualMember(member.id, 'branch', e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                              />
                            </div>
                          )}
                        </div>

                        {/* Semester Dropdown with Other / Custom */}
                        <div className="space-y-1">
                          {semesters.length > 0 && !member.isCustomSemester ? (
                            <select
                              value={member.semester}
                              onChange={(e) => {
                                if (e.target.value === '__OTHER__') {
                                  setMembers((prev) =>
                                    prev.map((m) =>
                                      m.id === member.id
                                        ? { ...m, isCustomSemester: true, semester: '' }
                                        : m
                                    )
                                  );
                                } else {
                                  handleUpdateManualMember(member.id, 'semester', e.target.value);
                                }
                              }}
                              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
                            >
                              <option value="">Select Semester (e.g. 4th Sem)</option>
                              {semesters.map((s) => {
                                const semLabel = s.name.toLowerCase().startsWith('semester')
                                  ? `${formatOrdinal(s.semester_number)} Semester`
                                  : `${s.name} (${formatOrdinal(s.semester_number)} Sem)`;
                                return (
                                  <option key={s.id} value={semLabel}>
                                    {semLabel}
                                  </option>
                                );
                              })}
                              <option value="__OTHER__">Other / Custom Semester...</option>
                            </select>
                          ) : (
                            <div className="space-y-1">
                              {semesters.length > 0 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-purple-700 font-semibold">Custom Semester</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setMembers((prev) =>
                                        prev.map((m) =>
                                          m.id === member.id
                                            ? { ...m, isCustomSemester: false, semester: '' }
                                            : m
                                        )
                                      )
                                    }
                                    className="text-[10px] text-purple-600 hover:underline cursor-pointer"
                                  >
                                    Select from list
                                  </button>
                                </div>
                              )}
                              <input
                                type="text"
                                placeholder="Semester (e.g. 4th Semester)"
                                value={member.semester}
                                onChange={(e) => handleUpdateManualMember(member.id, 'semester', e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PAYMENT SECTION (IF APPLICABLE) */}
        {isPaid && (
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-amber-700" />
                <span>Payment Required: ₹{program.registration_fee}</span>
              </span>
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                {regType === 'TEAM' ? 'Per Team' : 'Individual'}
              </span>
            </div>

            {event.payment_upi_id && (
              <div className="text-xs text-slate-700 flex items-center justify-between bg-white/80 p-2.5 rounded-xl border border-amber-200">
                <span className="text-slate-500">Pay to UPI:</span>
                <span className="font-mono font-bold text-slate-900">{event.payment_upi_id}</span>
              </div>
            )}

            {event.payment_qr_url && (
              <div className="flex flex-col items-center p-2 bg-white rounded-xl border border-amber-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={event.payment_qr_url} alt="Payment QR" className="w-36 h-36 object-contain rounded-lg" />
                <span className="text-[10px] text-slate-500 mt-1">Scan QR to pay</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Transaction ID / UTR / Reference ID
              </label>
              <input
                type="text"
                placeholder="e.g. 329019284012"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>
        )}

        {/* SUBMIT REGISTRATION BUTTON */}
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
              <CheckCircle2 className="w-4 h-4" />
              <span>Complete Registration</span>
            </>
          )}
        </button>
      </form>

      {/* Find Team & Request to Join Modal */}
      {isFindTeamOpen && participant && (
        <FindTeamModal
          isOpen={isFindTeamOpen}
          onClose={() => setIsFindTeamOpen(false)}
          eventId={event.id}
          programId={program.id}
          programName={program.name}
          userRegistrationNumber={participant.registrationNumber}
          onTeamJoined={async () => {
            setIsFindTeamOpen(false);
            setCheckingDuplicate(true);
            const dupCheck = await checkProgramRegistrationAction(event.id, program.id);
            setCheckingDuplicate(false);
            if (dupCheck.isRegistered && dupCheck.registration) {
              setExistingReg(dupCheck.registration);
            }
          }}
        />
      )}
    </div>
  );
}
