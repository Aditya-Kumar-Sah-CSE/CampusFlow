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
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { updateStudentProfileAction, checkStudentRegistrationNumberAction } from '@/app/auth/student/actions';
import type { StudentProfile } from '@/types/student';
import { ExamPadClip } from '@/components/ui/ExamPadCard';

interface StudentEditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentProfile | null;
  userEmail?: string;
  userName?: string;
  onUpdated?: (updated: { fullName?: string; registrationNumber?: string | null }) => void;
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
  const [fullName, setFullName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regError, setRegError] = useState<string | null>(null);
  const [checkingReg, setCheckingReg] = useState(false);
  const [success, setSuccess] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const initialName = student?.fullName || userName || '';
  const initialReg = student?.registrationNumber || '';
  const email = student?.email || userEmail || '';
  const collegeName = student?.collegeName || 'Enrolled College';
  const collegeCode = student?.collegeCode || '';

  // Track hydration for client-side portal rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Synchronize inputs with current student state when modal opens
  useEffect(() => {
    if (isOpen) {
      setFullName(initialName);
      setRegistrationNumber(initialReg);
      setError(null);
      setRegError(null);
      setSuccess(false);

      // Auto focus the editable full name input
      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialName, initialReg]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen && !isPending) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isPending]);

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
    const cleanName = fullName.trim();

    if (!cleanName) {
      setError('Please enter your full name.');
      return;
    }
    if (cleanName.length < 2) {
      setError('Full name must be at least 2 characters long.');
      return;
    }
    if (cleanName.length > 100) {
      setError('Full name cannot exceed 100 characters.');
      return;
    }

    if (regError) {
      setError(regError);
      return;
    }

    setIsPending(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await updateStudentProfileAction({
        fullName: cleanName,
        registrationNumber: registrationNumber.trim() || null,
      });

      if (!res.success) {
        setError(res.error || 'Failed to update profile.');
        if (
          res.error?.toLowerCase().includes('registration') ||
          res.error?.toLowerCase().includes('already exists')
        ) {
          setRegError(res.error);
        }
        setIsPending(false);
        return;
      }

      setSuccess(true);
      if (onUpdated) {
        onUpdated({
          fullName: res.fullName,
          registrationNumber: res.registrationNumber,
        });
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
      <div className="relative w-full max-w-lg my-auto exam-pad-board-dashboard rounded-lg shadow-2xl p-2 sm:p-3 pt-8 sm:pt-9 overflow-visible animate-in zoom-in-95 duration-200 flex flex-col max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)]">
        {/* Authentic Top Metal Exam Clip */}
        <ExamPadClip label="PROFILE" size="compact" />

        {/* Brass Corner Brackets */}
        <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-amber-500/80 pointer-events-none rounded-tl-xs" />
        <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-amber-500/80 pointer-events-none rounded-tr-xs" />
        <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-amber-500/80 pointer-events-none rounded-bl-xs" />
        <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-amber-500/80 pointer-events-none rounded-br-xs" />

        {/* The Paper Sheet */}
        <div className="relative z-10 w-full pinned-paper-sheet bg-[#fffdfa] dark:bg-[#191108] border border-amber-900/30 dark:border-[#422e17] rounded-[3px] shadow-sm flex flex-col flex-1 overflow-hidden min-h-0">
          {/* Modal Top Header (Always visible, shrink-0) */}
          <div className="px-5 py-3 sm:px-6 sm:py-3.5 border-b border-amber-900/20 dark:border-[#382713] flex items-center justify-between gap-3 bg-amber-50/70 dark:bg-[#20150b]/80 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-[3px] bg-amber-600/20 text-amber-900 dark:text-amber-300 border border-amber-600/30 flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 id="modal-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#faebd0] truncate">
                  Edit Student Profile
                </h3>
                <p className="text-xs text-slate-600 dark:text-[#c4a97d] truncate">
                  Update your full name &amp; registration number
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="text-slate-500 hover:text-slate-800 dark:text-amber-300/80 dark:hover:text-amber-200 hover:bg-black/5 dark:hover:bg-white/5 p-1.5 rounded-[3px] transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Container */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4.5 min-h-0">
            {/* Status Banners */}
            {error && (
              <div className="p-3.5 rounded-[3px] bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{error}</div>
              </div>
            )}

            {success && (
              <div className="p-3.5 rounded-[3px] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2.5 animate-in fade-in duration-150">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="flex-1 font-semibold">
                  Profile updated successfully!
                </div>
              </div>
            )}

            {/* EDITABLE FIELD 1: Full Name */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="student-full-name" className="font-bold text-slate-900 dark:text-[#faebd0] flex items-center gap-1.5">
                  <User className="w-4 h-4 text-amber-500" />
                  <span>Full Name</span>
                  <span className="text-rose-500 font-bold">*</span>
                </label>
                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 px-2 py-0.5 rounded-[2px]">
                  Editable
                </span>
              </div>

              <div className="relative">
                <input
                  ref={nameInputRef}
                  id="student-full-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Aditya Kumar"
                  maxLength={100}
                  disabled={isPending}
                  required
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1f150c] border border-slate-300 dark:border-[#382710] focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-[3px] text-xs sm:text-sm text-slate-900 dark:text-[#faebd0] font-bold placeholder-slate-400 dark:placeholder-slate-500 outline-hidden transition-all shadow-xs"
                />
              </div>

              <p className="text-[11px] text-slate-500 dark:text-[#c4a97d] leading-relaxed pt-0.5">
                Enter your official name as registered with your college and official certificates.
              </p>
            </div>

            {/* EDITABLE FIELD 2: Registration Number */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <label
                  htmlFor="student-reg-number"
                  className={`font-bold flex items-center gap-1.5 transition-colors ${
                    regError ? 'text-rose-700 dark:text-rose-400' : 'text-slate-900 dark:text-[#faebd0]'
                  }`}
                >
                  <GraduationCap className={`w-4 h-4 ${regError ? 'text-rose-600' : 'text-amber-500'}`} />
                  <span>Registration Number</span>
                </label>
                <div className="flex items-center gap-1.5">
                  {checkingReg && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                      Checking...
                    </span>
                  )}
                  <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-[#281b0f] border border-slate-200 dark:border-[#382710] px-2 py-0.5 rounded-[2px]">
                    Optional
                  </span>
                </div>
              </div>

              <div className="relative">
                <input
                  id="student-reg-number"
                  type="text"
                  value={registrationNumber}
                  onChange={(e) => {
                    setRegistrationNumber(e.target.value);
                    if (regError) setRegError(null);
                    if (error) setError(null);
                  }}
                  onBlur={async () => {
                    const trimmed = registrationNumber.trim();
                    if (!trimmed || trimmed.toUpperCase() === (initialReg || '').trim().toUpperCase()) {
                      setRegError(null);
                      return;
                    }
                    setCheckingReg(true);
                    try {
                      const res = await checkStudentRegistrationNumberAction(trimmed);
                      if (!res.available) {
                        setRegError(res.error || `Registration number "${trimmed}" already exists.`);
                      } else {
                        setRegError(null);
                      }
                    } catch {
                      // Non-blocking
                    } finally {
                      setCheckingReg(false);
                    }
                  }}
                  placeholder="e.g. 24105108040 or GP-140/2021"
                  maxLength={50}
                  disabled={isPending}
                  className={`w-full px-3.5 py-2.5 bg-white dark:bg-[#1f150c] border rounded-[3px] text-xs sm:text-sm font-mono font-bold placeholder-slate-400 dark:placeholder-slate-500 outline-hidden transition-all shadow-xs ${
                    regError
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 text-rose-900 bg-rose-50/20'
                      : 'border-slate-300 dark:border-[#382710] focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-slate-900 dark:text-[#faebd0]'
                  }`}
                />
              </div>

              {regError ? (
                <div className="flex items-start gap-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400 pt-0.5 animate-in fade-in duration-150">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                  <span className="leading-snug">{regError}</span>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-[#c4a97d] leading-relaxed pt-0.5">
                  Official University (BEU) or Board (SBTE) registration number printed on your admit card or fee receipt.
                </p>
              )}
            </div>

            {/* Verified Student Info Card (Read-only / Institutional Locked) */}
            <div className="bg-slate-50/90 dark:bg-[#1f150c] rounded-[3px] p-3.5 border border-slate-200/80 dark:border-[#382710] space-y-2.5 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#c4a97d] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                  <span>Institutional Verification</span>
                </span>
                <span className="text-[10px] text-slate-500 dark:text-[#faebd0] flex items-center gap-1 bg-white dark:bg-[#1a1309] px-2 py-0.5 rounded-[2px] border border-slate-200 dark:border-[#382710] font-semibold shadow-2xs">
                  <Lock className="w-2.5 h-2.5 text-slate-400" /> Verified &amp; Protected
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="bg-white dark:bg-[#1a1309] p-2.5 rounded-[3px] border border-slate-200/70 dark:border-[#382710]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 dark:text-[#c4a97d] font-medium flex items-center gap-1">
                      <Mail className="w-3 h-3 text-slate-400" /> Email Address
                    </span>
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 px-1.5 py-0.2 rounded-[2px] border border-emerald-200 dark:border-emerald-900 flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> Verified
                    </span>
                  </div>
                  <span className="font-mono text-slate-700 dark:text-[#faebd0] text-xs truncate block mt-0.5">
                    {email}
                  </span>
                </div>

                <div className="bg-white dark:bg-[#1a1309] p-2.5 rounded-[3px] border border-slate-200/70 dark:border-[#382710]">
                  <span className="text-[10px] text-slate-400 dark:text-[#c4a97d] font-medium flex items-center gap-1">
                    <School className="w-3 h-3 text-slate-400" /> Enrolled College
                  </span>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <span className="font-semibold text-slate-800 dark:text-[#faebd0] text-xs truncate block">
                      {collegeName}
                    </span>
                    {collegeCode && (
                      <span className="text-[9px] font-mono font-bold text-blue-700 dark:text-amber-300 bg-blue-50 dark:bg-[#281b0f] border border-blue-200 dark:border-amber-700/50 px-1.5 py-0.2 rounded-[2px] shrink-0">
                        Code: {collegeCode}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 dark:text-[#c4a97d] italic">
                Enrolled institution and email are tied to your academic verification and cannot be changed directly.
              </p>
            </div>
          </div>

          {/* Modal Actions Footer (Pinned to bottom of modal card) */}
          <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-t border-slate-100 dark:border-[#382713] bg-slate-50/70 dark:bg-[#1a1309] flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 rounded-[3px] text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#281b0f] transition-colors cursor-pointer disabled:opacity-50 border border-slate-200 dark:border-[#382710]"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-[3px] text-xs sm:text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 active:scale-98 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : success ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Profile Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>,
  document.body
);
}
