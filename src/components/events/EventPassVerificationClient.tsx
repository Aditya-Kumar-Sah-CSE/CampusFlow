'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Search,
  Loader2,
  Download,
  Ticket,
  ArrowLeft,
  Calendar,
  MapPin,
  GraduationCap,
  Mail,
  Phone,
  Hash,
  ExternalLink,
  Copy,
  Sparkles,
  Clock,
  Lock,
} from 'lucide-react';
import type { CollegeEvent } from '@/types/events';
import { identifyStudentAction } from '@/app/admin/events/event-registration-actions';
import { generateAndDownloadPassPNG } from '@/lib/events/download-pass-png';

interface Props {
  event: CollegeEvent;
  collegeName: string;
  initialRegNumber?: string;
  tenantSlug?: string;
}

export function EventPassVerificationClient({
  event,
  collegeName,
  initialRegNumber = '',
  tenantSlug,
}: Props) {
  const [query, setQuery] = useState(initialRegNumber.trim());
  const [loading, setLoading] = useState(false);
  const [downloadingPass, setDownloadingPass] = useState(false);
  const [copied, setCopied] = useState(false);
  const [verificationTime, setVerificationTime] = useState<string>('');

  const [result, setResult] = useState<{
    searched: boolean;
    isRegistered: boolean;
    error?: string;
    participant?: {
      fullName: string;
      registrationNumber: string;
      email: string;
      studentId: string;
      mobile: string;
      branch: string;
      semester: string;
      gender: string;
      totalPaidAmount?: number;
      isPaid?: boolean;
      specialEntryName?: string;
      hasPendingPayment?: boolean;
      pendingPaymentProgram?: string;
      pendingPaymentAmount?: number;
      canGeneratePass?: boolean;
    };
  }>({
    searched: false,
    isRegistered: false,
  });

  const eventHomePath = tenantSlug ? `/${tenantSlug}/events/${event.slug}` : `/events/${event.slug}`;
  const myRegistrationsPath = `${eventHomePath}/my-registrations`;

  // Verify on initial load if reg query was passed
  useEffect(() => {
    if (initialRegNumber.trim()) {
      handleVerify(initialRegNumber.trim());
    }
  }, [initialRegNumber, event.id]);

  const handleVerify = async (identifier: string) => {
    const clean = identifier.trim();
    if (!clean) return;

    setLoading(true);
    try {
      const res = await identifyStudentAction({
        eventId: event.id,
        identifier: clean,
      });

      setVerificationTime(
        new Date().toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'medium',
        })
      );

      if (res.success && res.isRegistered && res.participant) {
        setResult({
          searched: true,
          isRegistered: true,
          participant: res.participant,
        });
      } else {
        setResult({
          searched: true,
          isRegistered: false,
          error: res.error || `No registered pass found matching "${clean}".`,
        });
      }
    } catch (err: unknown) {
      setResult({
        searched: true,
        isRegistered: false,
        error: (err as Error).message || 'Failed to verify pass. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerify(query);
  };

  const handleDownload = async () => {
    if (!result.participant) return;
    if (result.participant.canGeneratePass === false) {
      alert(
        `This pass is locked because payment is awaiting Admin verification for ${result.participant.pendingPaymentProgram || 'your registered program'}. Once the admin confirms the payment, pass download will be activated.`
      );
      return;
    }
    setDownloadingPass(true);
    try {
      const college = (event as any).college;
      const isPaid = Boolean(result.participant.totalPaidAmount && result.participant.totalPaidAmount > 0);
      await generateAndDownloadPassPNG({
        eventTitle: event.title,
        collegeName: collegeName || college?.name,
        collegeLogoUrl: college?.logo_url,
        collegeCode: college?.code,
        venue: event.venue,
        participantName: result.participant.fullName,
        email: result.participant.email,
        registrationNumber: result.participant.registrationNumber,
        studentId: result.participant.studentId,
        branch: result.participant.branch,
        semester: result.participant.semester,
        mobile: result.participant.mobile,
        eventSlug: event.slug,
        isPaid: isPaid,
        totalPaidAmount: result.participant.totalPaidAmount || 0,
        specialEntryName: result.participant.specialEntryName || undefined,
      });
    } catch (err) {
      console.error('Failed to download pass:', err);
      alert('Could not download pass. Please try again.');
    } finally {
      setDownloadingPass(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={eventHomePath}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to {event.title}</span>
        </Link>

        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          <span>Official Pass Verification</span>
        </span>
      </div>

      {/* Manual Search Bar */}
      <form onSubmit={handleFormSubmit} className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            required
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter Event Registration # or Email (e.g. UMANG27-E001)"
            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shrink-0 shadow-sm"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>Verifying...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Verify Pass</span>
            </>
          )}
        </button>
      </form>

      {/* CASE 1: SUCCESSFUL VERIFICATION */}
      {result.searched && result.isRegistered && result.participant && (
        <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 rounded-3xl p-5 sm:p-8 text-white shadow-2xl border-2 border-emerald-500/40 relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          {/* Decorative ambient lights */}
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-6">
            {/* Header Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                  <ShieldCheck className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Official Pass Verified</span>
                  </div>
                  <div className="text-[11px] text-slate-400">Institutional Event Registry</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider">
                  ✓ Authorised Access
                </span>
              </div>
            </div>

            {/* Registration Number Highlight */}
            <div className="bg-slate-900/90 rounded-2xl p-4 sm:p-5 border border-slate-800/90 text-center space-y-1 shadow-inner">
              <div className="text-[10px] sm:text-[11px] uppercase font-bold tracking-widest text-slate-400">
                Official Event Registration Number
              </div>
              <div className="text-2xl sm:text-3xl font-mono font-black text-amber-400 tracking-wider break-all">
                {result.participant.registrationNumber}
              </div>
              <button
                type="button"
                onClick={() => handleCopy(result.participant!.registrationNumber)}
                className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer pt-1"
              >
                <Copy className="w-3 h-3" />
                <span>{copied ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>

            {/* Participant Information Grid */}
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Participant Details
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Full Name */}
                <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/60 space-y-0.5">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Full Name</div>
                  <div className="text-base font-bold text-white break-words">
                    {result.participant.fullName}
                  </div>
                </div>

                {/* Roll Number / Student ID */}
                <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/60 space-y-0.5">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                    <Hash className="w-3 h-3 text-slate-400" />
                    <span>Roll Number / Student ID</span>
                  </div>
                  <div className="text-base font-mono font-bold text-white">
                    {result.participant.studentId || '—'}
                  </div>
                </div>

                {/* Branch / Department */}
                <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/60 space-y-0.5">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                    <GraduationCap className="w-3 h-3 text-slate-400" />
                    <span>Department / Branch</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-200">
                    {result.participant.branch || '—'}
                  </div>
                </div>

                {/* Semester */}
                <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/60 space-y-0.5">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>Semester / Year</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-200">
                    {result.participant.semester || '—'}
                  </div>
                </div>

                {/* Email */}
                <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/60 space-y-0.5">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span>Registered Email</span>
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-slate-300 break-all">
                    {result.participant.email}
                  </div>
                </div>

                {/* Phone */}
                <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/60 space-y-0.5">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>Contact Number</span>
                  </div>
                  <div className="text-sm font-medium text-slate-300">
                    {result.participant.mobile || '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Payment & Access Privileges Section */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3.5 shadow-inner">
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Ticket className="w-3.5 h-3.5" />
                  <span>Pass Privileges &amp; Payment Status</span>
                </div>
                {result.participant.totalPaidAmount && result.participant.totalPaidAmount > 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                    ★ VIP PAID ACCESS
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
                    FREE PASS
                  </span>
                )}
              </div>

              {/* Payment Summary */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Payment Status</div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    {result.participant.totalPaidAmount && result.participant.totalPaidAmount > 0 ? (
                      <span className="text-amber-400 font-mono text-base">
                        TOTAL PAID: ₹{result.participant.totalPaidAmount}
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-medium">FREE ENTRY PASS (₹0)</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>VERIFIED AT GATE</span>
                  </span>
                </div>
              </div>

              {/* Inclusions */}
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <div className="flex-1 font-semibold text-emerald-300">
                    ALLOWED FOR ALL FREE PROGRAMS
                  </div>
                  <div className="text-[11px] text-slate-400 hidden sm:block">
                    Sports, Competitions &amp; Open Access
                  </div>
                </div>

                {result.participant.specialEntryName && (
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <div className="flex-1 font-bold text-amber-300 uppercase tracking-wide">
                      ★ SPECIAL ENTRY: {result.participant.specialEntryName}
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      PAID &amp; VERIFIED ✓
                    </span>
                  </div>
                )}

                {result.participant.hasPendingPayment && (
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs">
                    <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <div className="flex-1 text-amber-300">
                      <span className="font-bold">ADMIN VERIFICATION PENDING: </span>
                      {result.participant.pendingPaymentProgram} (₹{result.participant.pendingPaymentAmount})
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                      NOT YET VERIFIED
                    </span>
                  </div>
                )}
              </div>

              {/* Keywords */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  PHOTO ID MANDATORY
                </span>
                <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  ALL-DAY ENTRY
                </span>
                <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  NON-TRANSFERABLE
                </span>
              </div>
            </div>

            {/* Event Summary Box */}
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Event &amp; Institution
              </div>
              <div className="font-bold text-white text-sm">{event.title}</div>
              <div className="text-slate-400 flex flex-wrap items-center gap-3 text-xs">
                <span>📍 {event.venue}</span>
                {collegeName && <span>🏛️ {collegeName}</span>}
              </div>
            </div>

            {/* Verification Timestamp */}
            {verificationTime && (
              <div className="text-center text-[11px] text-slate-400 pt-1">
                Verified at: <span className="text-slate-300 font-mono">{verificationTime}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloadingPass || result.participant.canGeneratePass === false}
                className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
                  result.participant.canGeneratePass === false
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 cursor-not-allowed opacity-80'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20 cursor-pointer disabled:opacity-50'
                }`}
              >
                {downloadingPass ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : result.participant.canGeneratePass === false ? (
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                ) : (
                  <Download className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {result.participant.canGeneratePass === false
                    ? 'Pass Locked (Admin Payment Pending)'
                    : 'Download Pass (PNG)'}
                </span>
              </button>

              <Link
                href={myRegistrationsPath}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm border border-slate-700 transition-colors flex items-center justify-center gap-2 text-center"
              >
                <Ticket className="w-4 h-4 text-blue-400 shrink-0" />
                <span>View Registered Programs</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* CASE 2: SEARCHED BUT NOT REGISTERED / INVALID */}
      {result.searched && !result.isRegistered && (
        <div className="bg-red-50 border-2 border-red-200 rounded-3xl p-6 sm:p-8 text-center space-y-4 animate-in fade-in duration-200">
          <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-inner">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-lg sm:text-xl font-black text-red-950">
              Unverified / Invalid Event Pass
            </h3>
            <p className="text-xs sm:text-sm text-red-700">
              {result.error || 'The scanned registration number was not found in the official event records.'}
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
            <Link
              href={`${eventHomePath}/register`}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all"
            >
              Register for Event Now
            </Link>
            <button
              type="button"
              onClick={() => {
                setResult({ searched: false, isRegistered: false });
                setQuery('');
              }}
              className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Search Another Code
            </button>
          </div>
        </div>
      )}

      {/* CASE 3: PROMPT / INITIAL EMPTY STATE */}
      {!result.searched && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-12 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Instant Event Pass Verification
            </h3>
            <p className="text-xs text-slate-500">
              Scan the QR code on any participant&apos;s digital pass or enter their Event Registration Number above to verify authenticity against Google Sheets records.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
