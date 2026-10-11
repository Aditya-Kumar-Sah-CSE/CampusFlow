'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Lock,
  CheckCircle2,
  AlertCircle,
  School,
  User,
  GraduationCap,
  Loader2,
  Save,
  Check,
} from 'lucide-react';
import { updateStudentRegistrationNumberAction } from '@/app/auth/student/actions';
import type { StudentProfile } from '@/types/student';

interface StudentEditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentProfile | null;
  userEmail?: string;
  userName?: string;
  onUpdated?: (newRegNumber: string | null) => void;
}

export function StudentEditProfileModal({
  isOpen,
  onClose,
  student,
  userEmail,
  userName,
  onUpdated,
}: StudentEditProfileModalProps) {
  const [mounted, setMounted] = useState(false);
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const initialReg = student?.registrationNumber || '';
  const displayName = student?.fullName || userName || 'Student';
  const email = student?.email || userEmail || '';
  const collegeName = student?.collegeName || 'Enrolled College';
  const collegeCode = student?.collegeCode || '';

  // Track hydration for client-side portal rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Synchronize input with current student state when modal opens
  useEffect(() => {
    if (isOpen) {
      setRegistrationNumber(initialReg);
      setError(null);
      setSuccess(false);

      // Auto focus the editable registration number input
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialReg]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scrolling while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await updateStudentRegistrationNumberAction(registrationNumber);
      if (!res.success) {
        setError(res.error || 'Failed to update registration number.');
        setIsPending(false);
        return;
      }

      setSuccess(true);
      if (onUpdated) {
        onUpdated(res.registrationNumber || null);
      }

      // Automatically close modal after brief confirmation feedback
      setTimeout(() => {
        setIsPending(false);
        onClose();
      }, 900);
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred while saving.');
      setIsPending(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] overflow-y-auto bg-slate-900/65 backdrop-blur-xs p-4 sm:p-6 flex min-h-screen items-center justify-center animate-in fade-in duration-200"
      style={{ zIndex: 99999 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="relative w-full max-w-lg my-auto bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)]">
        {/* Modal Top Header (Always visible, shrink-0) */}
        <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-gradient-to-r from-slate-50 via-white to-blue-50/40 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0 ring-4 ring-blue-50">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 id="modal-title" className="text-base sm:text-lg font-bold text-slate-900 truncate">
                Edit Student Profile
              </h3>
              <p className="text-xs text-slate-500 truncate">
                Set your institutional registration number
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50 shrink-0"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 min-h-0">
            {/* Status Banners */}
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{error}</div>
              </div>
            )}

            {success && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 animate-in fade-in duration-150">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="flex-1 font-semibold">
                  Registration Number saved successfully!
                </div>
              </div>
            )}

            {/* Compact Verified Student Info Card (Read-only / Locked) */}
            <div className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Student Identity</span>
                </span>
                <span className="text-[10px] text-slate-500 flex items-center gap-1 bg-white px-2 py-0.5 rounded-full border border-slate-200 font-semibold shadow-2xs">
                  <Lock className="w-2.5 h-2.5 text-slate-400" /> Verified &amp; Locked
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
                  <span className="text-[10px] text-slate-400 font-medium block">Full Name</span>
                  <span className="font-bold text-slate-800 text-xs sm:text-sm truncate block mt-0.5">
                    {displayName}
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-medium block">Email Address</span>
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> Verified
                    </span>
                  </div>
                  <span className="font-mono text-slate-700 text-xs truncate block mt-0.5">
                    {email}
                  </span>
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                    <School className="w-3 h-3 text-slate-400" /> Enrolled Institution
                  </span>
                  <span className="font-semibold text-slate-800 text-xs truncate block mt-0.5">
                    {collegeName}
                  </span>
                </div>
                {collegeCode && (
                  <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md shrink-0">
                    Code: {collegeCode}
                  </span>
                )}
              </div>
            </div>

            {/* EDITABLE FIELD: Registration Number */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="student-reg-number" className="font-bold text-blue-900 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-blue-600" />
                  <span>Registration Number (रजिस्ट्रेशन नंबर)</span>
                </label>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                  Editable
                </span>
              </div>

              <div className="relative">
                <input
                  ref={inputRef}
                  id="student-reg-number"
                  type="text"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  placeholder="e.g. 24105108040 or GP-140/2021"
                  maxLength={50}
                  disabled={isPending}
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-blue-500/70 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 rounded-xl text-xs sm:text-sm text-slate-900 font-mono font-bold placeholder-slate-400 outline-hidden transition-all shadow-xs"
                />
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed pt-0.5">
                Enter your official University (BEU) or Board (SBTE) registration number as printed on your admit card or fee receipt.
              </p>
            </div>
          </div>

          {/* Modal Actions Footer (Pinned to bottom of modal card) */}
          <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-98 shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : success ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Registration No.</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
