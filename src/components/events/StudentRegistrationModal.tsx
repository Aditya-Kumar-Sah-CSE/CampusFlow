'use client';

import React, { useState } from 'react';
import {
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Copy,
  ArrowRight,
  ArrowLeft,
  Upload,
} from 'lucide-react';
import type { CollegeEvent } from '@/types/events';
import type { Branch, Semester } from '@/types/database';
import { submitPublicEventRegistrationAction } from '@/app/events/actions';

interface Props {
  event: CollegeEvent;
  tenantSlug: string;
  branches: Branch[];
  semesters: Semester[];
  isOpen: boolean;
  onClose: () => void;
}

export function StudentRegistrationModal({
  event,
  tenantSlug,
  branches,
  semesters,
  isOpen,
  onClose,
}: Props) {
  const isPaid = event.payment_required;

  // Step 1: Details, Step 2: Payment (if paid), Step 3: Success
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form inputs
  const [studentName, setStudentName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [branchId, setBranchId] = useState('');
  const [semesterId, setSemesterId] = useState('');

  // Payment inputs
  const [transactionId, setTransactionId] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Status
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [registrationId, setRegistrationId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyUpi = () => {
    if (event.payment_upi_id) {
      navigator.clipboard.writeText(event.payment_upi_id);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    }
  };

  const handleProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg('Proof file must be under 5MB.');
        return;
      }
      setProofFile(file);
      setProofPreview(URL.createObjectURL(file));
    }
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!studentName.trim() || !registrationNumber.trim() || !email.trim() || !mobile.trim()) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    if (isPaid) {
      setStep(2);
    } else {
      executeRegistration();
    }
  };

  const executeRegistration = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    if (isPaid && !transactionId.trim()) {
      setErrorMsg('Transaction ID / UTR number is required for verification.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('tenantSlug', tenantSlug);
      formData.append('eventId', event.id);
      formData.append('studentName', studentName.trim());
      formData.append('registrationNumber', registrationNumber.trim().toUpperCase());
      formData.append('email', email.trim());
      formData.append('mobile', mobile.trim());
      if (branchId) formData.append('branchId', branchId);
      if (semesterId) formData.append('semesterId', semesterId);
      if (transactionId.trim()) formData.append('transactionId', transactionId.trim());
      if (proofFile) formData.append('paymentProof', proofFile);

      const res = await submitPublicEventRegistrationAction(formData);

      if (res.success && res.registrationId) {
        setRegistrationId(res.registrationId);
        setStep(3);
      } else {
        setErrorMsg(res.error || 'Registration failed.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl w-[calc(100vw-16px)] sm:w-full max-w-lg max-h-[calc(100vh-24px)] overflow-y-auto p-4 sm:p-7 shadow-2xl border border-slate-200/90 space-y-4 sm:space-y-5 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-2">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
              {step === 3 ? 'Registration Confirmed' : `Register: ${event.title}`}
            </h3>
            {step < 3 && (
              <p className="text-xs text-slate-500 mt-0.5">
                {isPaid ? `Step ${step} of 2 &bull; ${step === 1 ? 'Student Details' : 'Payment Details'}` : 'Student Enrollment'}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 sm:p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span className="break-words">{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: Student Information */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="space-y-3.5 sm:space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Full Name *</label>
              <input
                type="text"
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="e.g. Rahul Kumar"
                className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Registration / Roll Number *</label>
              <input
                type="text"
                required
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder="e.g. 21105123001"
                className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt font-mono uppercase"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="rahul@example.com"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Mobile Number *</label>
                <input
                  type="tel"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="9876543210"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Branch (Optional)</label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20"
                >
                  <option value="">Select Branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} - {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Semester (Optional)</label>
                <select
                  value={semesterId}
                  onChange={(e) => setSemesterId(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20"
                >
                  <option value="">Select Semester</option>
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      Semester {s.semester_number}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-bce-cobalt hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50 text-center"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                <span>{isPaid ? 'Proceed to Payment' : 'Confirm Registration'}</span>
                {isPaid && <ArrowRight className="w-3.5 h-3.5 shrink-0" />}
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Payment Details (For Paid Events Only) */}
        {step === 2 && isPaid && (
          <form onSubmit={executeRegistration} className="space-y-3.5 sm:space-y-4">
            <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 uppercase">Registration Fee:</span>
                <span className="text-xl font-extrabold text-amber-950">₹{event.payment_amount}</span>
              </div>

              {event.payment_instructions && (
                <p className="text-xs text-amber-900/90 leading-relaxed border-t border-amber-200/60 pt-2 break-words">
                  {event.payment_instructions}
                </p>
              )}

              {/* UPI ID display */}
              {event.payment_upi_id && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-white rounded-xl border border-amber-200 text-xs">
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block font-semibold">UPI ID:</span>
                    <span className="font-mono font-bold text-slate-900 break-all">{event.payment_upi_id}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1 text-xs font-semibold text-bce-cobalt hover:bg-blue-50 rounded-lg transition-colors self-start sm:self-auto"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedUpi ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              )}

              {/* QR Image display */}
              {event.payment_qr_url && (
                <div className="text-center pt-1">
                  <p className="text-[11px] font-semibold text-amber-900 mb-1.5">Scan QR to Pay:</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={event.payment_qr_url}
                    alt="Payment QR"
                    className="w-32 h-32 sm:w-36 sm:h-36 mx-auto object-contain bg-white p-2 rounded-xl border border-amber-200 shadow-2xs"
                  />
                </div>
              )}
            </div>

            {/* Transaction ID input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Transaction ID / UTR Reference *</label>
              <input
                type="text"
                required
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="e.g. 123456789012 or UPI Ref"
                className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt font-mono"
              />
              <span className="text-[11px] text-slate-400">
                Enter the 12-digit UTR/reference number from your UPI receipt.
              </span>
            </div>

            {/* Optional screenshot */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Payment Screenshot (Optional)</label>
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleProofChange}
                  id="student-proof-upload"
                  className="hidden"
                />
                <label
                  htmlFor="student-proof-upload"
                  className="inline-flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-400" />
                  <span>Choose Image</span>
                </label>
                {proofFile && <span className="text-xs text-slate-500 truncate max-w-[200px]">{proofFile.name}</span>}
              </div>
              {proofPreview && (
                <div className="mt-1.5 p-1 border border-slate-200 rounded-lg inline-block bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={proofPreview} alt="Screenshot Preview" className="w-16 h-16 object-contain rounded" />
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-bce-cobalt hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50 text-center"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                <span>Submit Registration</span>
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Success Screen */}
        {step === 3 && (
          <div className="py-4 text-center space-y-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shrink-0">
              <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="text-base sm:text-lg font-bold text-slate-900">Registration Successful!</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {isPaid
                  ? 'Your registration has been submitted. Payment status is PENDING and will be manually verified by the college coordinators.'
                  : 'You are successfully enrolled for this event. Please arrive on time at the venue.'}
              </p>
            </div>

            {registrationId && (
              <div className="p-3.5 sm:p-4 bg-slate-900 rounded-2xl text-white inline-block text-center max-w-xs mx-auto shadow-inner space-y-1 min-w-0 w-full">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Event Registration Number
                </span>
                <p className="font-mono text-base font-black text-amber-400 select-all break-all">
                  {registrationId}
                </p>
                <p className="text-[10px] text-slate-400">Save this number to join individual or team programs.</p>
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  const el = document.getElementById('programs-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs text-center"
              >
                Join Event Programs &rarr;
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors text-center"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
