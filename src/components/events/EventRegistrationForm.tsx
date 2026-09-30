'use client';

import React, { useState } from 'react';
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
  ArrowLeft,
  Ticket,
} from 'lucide-react';
import { registerForEventAction } from '@/app/admin/events/event-registration-actions';
import type { CollegeEvent } from '@/types/events';

interface Props {
  event: CollegeEvent;
  collegeName: string;
}

export function EventRegistrationForm({ event, collegeName }: Props) {
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [branch, setBranch] = useState('');
  const [semester, setSemester] = useState('');
  const [gender, setGender] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successRegNumber, setSuccessRegNumber] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const handleCopy = () => {
    if (successRegNumber) {
      navigator.clipboard.writeText(successRegNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // SUCCESS CONFIRMATION VIEW
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
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Registration Number'}</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 flex flex-col sm:flex-row gap-3">
          <Link
            href={`/events/${event.slug}`}
            className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            <Ticket className="w-4 h-4" />
            <span>Join Event Programs</span>
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

  // REGISTRATION FORM VIEW
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 max-w-xl mx-auto space-y-6">
      <div className="border-b border-slate-100 pb-4 space-y-1">
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
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
              <span>Branch / Department</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Computer Science"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-xs sm:text-sm transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Semester</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 6th Semester"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-xs sm:text-sm transition-all"
            />
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
                <span>Verifying &amp; Registering...</span>
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
  );
}
