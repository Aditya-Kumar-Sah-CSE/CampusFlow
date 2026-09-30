'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  User,
  Mail,
  Phone,
  FileText,
  GraduationCap,
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2,
  Copy,
  ArrowRight,
  Ticket,
  ShieldCheck,
  Search,
  LogOut,
  Sparkles,
} from 'lucide-react';
import {
  registerForEventAction,
  identifyStudentAction,
  resolveCurrentEventRegistrationAction,
  logoutFromEventAction,
  getEventAcademicMastersAction,
} from '@/app/admin/events/event-registration-actions';
import type { CollegeEvent } from '@/types/events';
import type { Branch, Semester } from '@/types/database';
import { formatOrdinal } from '@/lib/events/academic-formatter';

interface Props {
  event: CollegeEvent;
  collegeName: string;
  branches?: Branch[];
  semesters?: Semester[];
}

export function EventRegistrationForm({
  event,
  collegeName,
  branches: initialBranches,
  semesters: initialSemesters,
}: Props) {
  // Mode: 'register' (Form) or 'lookup' (Check existing registration)
  const [activeTab, setActiveTab] = useState<'register' | 'lookup'>('register');

  // Academic master data for dropdowns
  const [branches, setBranches] = useState<Branch[]>(initialBranches || []);
  const [semesters, setSemesters] = useState<Semester[]>(initialSemesters || []);
  const [customBranch, setCustomBranch] = useState(false);
  const [customSemester, setCustomSemester] = useState(false);

  // Existing verified participant if already registered
  const [alreadyRegisteredParticipant, setAlreadyRegisteredParticipant] = useState<{
    fullName: string;
    registrationNumber: string;
    email: string;
    studentId: string;
    mobile?: string;
    branch?: string;
    semester?: string;
  } | null>(null);

  // New Registration form fields
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [branch, setBranch] = useState('');
  const [semester, setSemester] = useState('');
  const [gender, setGender] = useState('');

  // Lookup fields
  const [lookupInput, setLookupInput] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Status
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successRegNumber, setSuccessRegNumber] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Check if session cookie already exists on mount
  useEffect(() => {
    let isMounted = true;
    async function checkExisting() {
      try {
        const res = await resolveCurrentEventRegistrationAction(event.id);
        if (isMounted && res.isValid && res.participant) {
          setAlreadyRegisteredParticipant(res.participant);
        }
      } catch {
        // ignore
      }
    }
    checkExisting();
    return () => {
      isMounted = false;
    };
  }, [event.id]);

  useEffect(() => {
    if (initialBranches && initialBranches.length > 0) {
      setBranches(initialBranches);
    }
  }, [initialBranches]);

  useEffect(() => {
    if (initialSemesters && initialSemesters.length > 0) {
      setSemesters(initialSemesters);
    }
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

  // SUBMIT NEW EVENT REGISTRATION
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim() || !studentId.trim() || !email.trim() || !mobile.trim()) {
      setErrorMsg('Please complete all required fields.');
      return;
    }

    setLoading(true);
    try {
      const res = await registerForEventAction({
        college_id: event.college_id,
        event_id: event.id,
        full_name: fullName.trim(),
        student_id: studentId.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        mobile: mobile.trim(),
        branch: branch.trim(),
        semester: semester.trim(),
        gender: gender.trim(),
      });

      if (res.success && res.registrationNumber) {
        setSuccessRegNumber(res.registrationNumber);
      } else {
        setErrorMsg(res.error || 'Registration failed. Please try again.');
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // CHECK / LOOKUP EXISTING REGISTRATION
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);

    const cleanInput = lookupInput.trim();
    if (!cleanInput) {
      setLookupError('Please enter your Email Address or Event Registration Number.');
      return;
    }

    setLookupLoading(true);
    try {
      const res = await identifyStudentAction({
        eventId: event.id,
        identifier: cleanInput,
      });

      if (res.success && res.isRegistered && res.participant) {
        setAlreadyRegisteredParticipant(res.participant);
        setLookupError(null);
      } else {
        setLookupError(res.error || `No event registration found for "${cleanInput}".`);
      }
    } catch (err: unknown) {
      setLookupError((err as Error).message || 'Failed to check registration.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSwitchStudent = async () => {
    try {
      await logoutFromEventAction(event.id);
    } catch {
      // ignore
    }
    setAlreadyRegisteredParticipant(null);
    setSuccessRegNumber(null);
    setLookupInput('');
    setActiveTab('register');
  };

  // ============================================================
  // VIEW 1: ALREADY REGISTERED (Detected on mount or via lookup)
  // ============================================================
  if (alreadyRegisteredParticipant) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl p-6 sm:p-10 max-w-xl mx-auto space-y-6 text-center animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
          <ShieldCheck className="w-9 h-9" />
        </div>

        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Already Registered</span>
          </span>
          <h2 className="text-2xl font-extrabold text-slate-900">
            Welcome back, {alreadyRegisteredParticipant.fullName}!
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            You are already registered for <span className="font-semibold text-slate-900">{event.title}</span> at {collegeName}.
          </p>
        </div>

        {/* Big Registration Number Card */}
        <div className="bg-slate-900 rounded-2xl p-5 text-white space-y-2 shadow-inner">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
            Your Event Registration Number
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-black text-amber-400 tracking-wider">
            {alreadyRegisteredParticipant.registrationNumber}
          </div>
          <p className="text-[11px] text-slate-400">
            This registration number is your permanent event identity. Use it alongside your registered email to join programs.
          </p>
          <div className="pt-2">
            <button
              onClick={() => handleCopy(alreadyRegisteredParticipant.registrationNumber)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Registration Number'}</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <Link
            href={`/events/${event.slug}#programs`}
            className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            <Ticket className="w-4 h-4" />
            <span>Choose Program to Join</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href={`/events/${event.slug}/my-registrations`}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition-colors flex items-center justify-center"
          >
            <span>View My Registrations</span>
          </Link>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <button
            onClick={handleSwitchStudent}
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 mx-auto transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Not you? Register a different student</span>
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // VIEW 2: SUCCESS VIEW (Just Registered)
  // ============================================================
  if (successRegNumber) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl p-6 sm:p-10 max-w-xl mx-auto space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
          <CheckCircle className="w-9 h-9" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-slate-900">
            Registration Confirmed!
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            You are now successfully registered for <span className="font-semibold text-slate-900">{event.title}</span> at {collegeName}.
          </p>
        </div>

        {/* Big Registration Number Card */}
        <div className="bg-slate-900 rounded-2xl p-5 text-white space-y-2 shadow-inner">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
            Your Event Registration Number
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-black text-amber-400 tracking-wider">
            {successRegNumber}
          </div>
          <p className="text-[11px] text-slate-400">
            This registration number is your permanent event identity. Use it alongside your registered email to join programs.
          </p>
          <div className="pt-2">
            <button
              onClick={() => handleCopy(successRegNumber)}
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
            href={`/events/${event.slug}#programs`}
            className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            <Ticket className="w-4 h-4" />
            <span>Choose Program to Join</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href={`/events/${event.slug}/my-registrations`}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition-colors flex items-center justify-center"
          >
            <span>View My Registrations</span>
          </Link>
        </div>
      </div>
    );
  }

  // ============================================================
  // VIEW 3: REGISTRATION / LOOKUP FORM VIEW
  // ============================================================
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 max-w-xl mx-auto space-y-6">
      {/* Tab Switcher */}
      <div className="flex rounded-2xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => { setActiveTab('register'); setErrorMsg(null); }}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'register'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          Register for Event
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('lookup'); setLookupError(null); }}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'lookup'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          Already Registered? Check Status
        </button>
      </div>

      {activeTab === 'lookup' ? (
        /* ================= LOOKUP TAB ================= */
        <div className="space-y-5">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900">
              Verify Event Registration
            </h2>
            <p className="text-xs text-slate-500">
              Already registered for {event.title}? Enter your Email Address or Event Registration Number to retrieve your details.
            </p>
          </div>

          {lookupError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{lookupError}</span>
            </div>
          )}

          <form onSubmit={handleLookup} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span>Email Address or Event Registration Number <span className="text-red-500">*</span></span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. aditya@example.com or UMANG27-E001"
                value={lookupInput}
                onChange={(e) => setLookupInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-xs sm:text-sm transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={lookupLoading}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {lookupLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Searching Google Sheet...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Check Registration</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setActiveTab('register')}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
            >
              Haven&apos;t registered yet? Switch to Registration Form
            </button>
          </div>
        </div>
      ) : (
        /* ================= REGISTRATION TAB ================= */
        <div className="space-y-5">
          <div className="border-b border-slate-100 pb-3 space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              Register for {event.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Please provide your student details. Registration for the event is required before participating in any programs.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Full Name <span className="text-red-500">*</span></span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rahul Kumar"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-xs sm:text-sm transition-all"
              />
            </div>

            {/* Student ID / Roll Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>College Roll / Registration Number <span className="text-red-500">*</span></span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 21105129001"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-xs sm:text-sm uppercase transition-all"
              />
            </div>

            {/* Email & Mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Email Address <span className="text-red-500">*</span></span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="student@college.ac.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-xs sm:text-sm transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Mobile Number <span className="text-red-500">*</span></span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="10-digit number"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-xs sm:text-sm transition-all"
                />
              </div>
            </div>

            {/* Branch & Semester */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                    <span>Branch / Department</span>
                  </label>
                  {branches.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomBranch(!customBranch);
                        setBranch('');
                      }}
                      className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    >
                      {customBranch ? 'Select from list' : 'Not listed?'}
                    </button>
                  )}
                </div>

                {branches.length > 0 && !customBranch ? (
                  <select
                    value={branch}
                    onChange={(e) => {
                      if (e.target.value === '__OTHER__') {
                        setCustomBranch(true);
                        setBranch('');
                      } else {
                        setBranch(e.target.value);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-xs sm:text-sm transition-all bg-white text-slate-800 cursor-pointer"
                  >
                    <option value="">Select Branch / Department</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.code || b.name}>
                        {b.name} {b.code ? `(${b.code})` : ''}
                      </option>
                    ))}
                    <option value="__OTHER__">Other / Not Listed (Type manually)...</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="e.g. Computer Science"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-xs sm:text-sm transition-all"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Semester</span>
                  </label>
                  {semesters.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomSemester(!customSemester);
                        setSemester('');
                      }}
                      className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    >
                      {customSemester ? 'Select from list' : 'Not listed?'}
                    </button>
                  )}
                </div>

                {semesters.length > 0 && !customSemester ? (
                  <select
                    value={semester}
                    onChange={(e) => {
                      if (e.target.value === '__OTHER__') {
                        setCustomSemester(true);
                        setSemester('');
                      } else {
                        setSemester(e.target.value);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-xs sm:text-sm transition-all bg-white text-slate-800 cursor-pointer"
                  >
                    <option value="">Select Semester</option>
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
                    <option value="__OTHER__">Other / Not Listed (Type manually)...</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="e.g. 6th Semester"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-xs sm:text-sm transition-all"
                  />
                )}
              </div>
            </div>

            {/* Gender */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Gender
              </label>
              <div className="flex items-center gap-4 text-xs text-slate-700">
                {['Male', 'Female', 'Other'].map((g) => (
                  <label key={g} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value={g}
                      checked={gender === g}
                      onChange={(e) => setGender(e.target.value)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>{g}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying &amp; Registering in Google Sheet...</span>
                  </>
                ) : (
                  <>
                    <span>Complete Event Registration</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
