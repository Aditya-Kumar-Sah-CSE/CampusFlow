'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, Loader2, CheckCircle2, AlertCircle, KeyRound, ArrowRight } from 'lucide-react';
import { studentForgotPasswordAction } from '@/app/auth/student/actions';

export default function StudentForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setErrorMsg(null);

    try {
      const res = await studentForgotPasswordAction(email);
      if (res.success) {
        setMessage(res.message || 'If an account exists with this email, password reset instructions have been sent.');
      } else {
        setErrorMsg(res.error || 'Failed to request password reset.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-100 flex flex-col justify-between py-6 px-3 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto w-full flex items-center justify-between text-xs text-slate-400">
        <Link
          href="/auth/student/login"
          className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Sign In</span>
        </Link>
        <span className="text-[11px] font-semibold tracking-wider uppercase text-amber-400">
          Password Recovery
        </span>
      </div>

      <div className="my-auto max-w-md mx-auto w-full">
        <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-xl border border-slate-200/90 text-slate-800 space-y-5">
          <div className="text-center space-y-1.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center border border-amber-100">
              <KeyRound className="w-6 h-6 text-amber-600" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              Reset Your Password
            </h1>
            <p className="text-xs text-slate-600 max-w-xs mx-auto">
              Enter your registered student email address and we’ll send you a password reset link.
            </p>
          </div>

          {message && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-bce-cobalt" />
                Student Email Address *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@example.com"
                disabled={isLoading}
                className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/30"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-bce-cobalt hover:bg-bce-navy text-white font-bold text-sm shadow-md transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending Reset Link...</span>
                </>
              ) : (
                <>
                  <span>Send Password Reset Link</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100 text-center text-xs text-slate-600">
            Remember your password?{' '}
            <Link href="/auth/student/login" className="font-bold text-bce-cobalt hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto w-full text-center text-xs text-slate-500 pt-6">
        CampusFlow • Multi-Tenant Feedback System
      </div>
    </div>
  );
}
