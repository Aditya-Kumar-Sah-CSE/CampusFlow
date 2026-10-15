'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Lock,
  CheckCircle2,
  AlertCircle,
  School,
  User,
  Calendar,
  Loader2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { StudentProfile } from '@/types/student';

interface StudentCoordinatorApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentProfile | null;
  userEmail?: string;
  userName?: string;
}

export function StudentCoordinatorApplyModal({
  isOpen,
  onClose,
  student,
  userEmail,
  userName,
}: StudentCoordinatorApplyModalProps) {
  const [mounted, setMounted] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fullName = student?.fullName || userName || '';
  const email = student?.email || userEmail || '';
  const collegeId = student?.collegeId || '';
  const collegeName = student?.collegeName || 'Your College';
  const collegeCode = student?.collegeCode || '';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setConfirmPassword('');
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!collegeId) {
      setErrorMsg('College identifier is missing. Please ensure your student profile is linked to an institution.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg('Please choose an admin login password of at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify your password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/admin/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fullName,
          email: email.trim().toLowerCase(),
          password,
          collegeId,
          role: 'EVENT_COORDINATOR',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to submit coordinator application.');
      }

      setSuccessMsg(
        data?.message ||
          'Your application for Event Coordinator has been submitted! Your college’s Primary Admin will review and grant tab access.'
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred during submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="coordinator-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-bce-navy p-5 text-white relative">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
            className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded-full bg-white/20 text-purple-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-300" /> Student Leadership
            </span>
          </div>

          <h3 id="coordinator-modal-title" className="text-lg font-extrabold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-300" />
            Apply as Event Coordinator
          </h3>
          <p className="text-xs text-purple-200 mt-1">
            Organize campus fests, competitions, ticket passes, and manage student attendance.
          </p>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg ? (
            <div className="space-y-4 py-2">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Application Submitted Successfully!</span>
                </div>
                <p className="text-emerald-700 leading-relaxed">
                  {successMsg}
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1 text-slate-600">
                <p className="font-semibold text-slate-800">Next Steps:</p>
                <p>1. Your college’s Primary Admin or Super Admin will verify your student credentials.</p>
                <p>2. Once approved, you can log in at the Admin Portal using your email and password to access the Events Tab.</p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 bg-bce-navy text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer shadow-sm"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Student Overview Card */}
              <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-200/80 text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-purple-600" /> Student:
                  </span>
                  <span className="font-bold text-slate-900">{fullName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Email:</span>
                  <span className="font-mono text-slate-700">{email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <School className="w-3.5 h-3.5 text-purple-600" /> College:
                  </span>
                  <span className="font-semibold text-slate-800 truncate max-w-[200px]" title={collegeName}>
                    {collegeName} {collegeCode ? `(${collegeCode})` : ''}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-purple-200/50">
                  <span className="text-slate-500">Requested Role:</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                    <Calendar className="w-3 h-3" /> Event Coordinator (Events Tab)
                  </span>
                </div>
              </div>

              {/* Password for admin login */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Create Admin Login Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="block w-full pl-9 pr-10 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="block w-full pl-9 pr-10 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-500 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <span>
                  Applications are verified by the college’s Primary Admin to maintain institutional integrity.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Coordinator Application</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
