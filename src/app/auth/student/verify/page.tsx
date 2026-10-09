'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { resendStudentVerificationAction } from '@/app/auth/student/actions';

function VerifyContent() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';
  const redirectParam = searchParams.get('redirect');
  const errorParam = searchParams.get('error');

  const [email, setEmail] = useState(emailParam);
  const [isResending, setIsResending] = useState(false);
  const [feedback, setFeedback] = useState<{ success?: boolean; message?: string } | null>(null);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setFeedback({ success: false, message: 'Please provide a valid email address.' });
      return;
    }

    setIsResending(true);
    setFeedback(null);

    try {
      const result = await resendStudentVerificationAction(email);
      if (result.success) {
        setFeedback({
          success: true,
          message: result.message || 'Verification email sent! Please check your inbox and spam folder.',
        });
      } else {
        setFeedback({
          success: false,
          message: result.error || 'Failed to dispatch verification email.',
        });
      }
    } catch (err: any) {
      setFeedback({
        success: false,
        message: err.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsResending(false);
    }
  };

  const loginUrl = `/auth/student/login${
    redirectParam ? `?redirect=${encodeURIComponent(redirectParam)}` : ''
  }`;

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-xl border border-slate-200/90 text-slate-800 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 text-bce-cobalt mx-auto flex items-center justify-center border border-blue-100 shadow-xs">
          <Mail className="w-7 h-7 text-bce-cobalt" />
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
          Check Your Inbox
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
          We’ve sent a secure email verification link to{' '}
          {email ? <strong className="text-slate-900 break-all">{email}</strong> : 'your email address'}.
        </p>
      </div>

      {errorParam && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>The previous link has expired or was invalid. You can request a fresh verification link below.</span>
        </div>
      )}

      {feedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs flex items-start gap-2 ${
            feedback.success
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {feedback.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs text-slate-600">
        <div className="font-bold text-slate-900 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Next Steps:</span>
        </div>
        <ol className="list-decimal pl-4 space-y-1 text-slate-600 text-[11px] sm:text-xs">
          <li>Open your email client and find the verification email from <strong>CampusFlow</strong>.</li>
          <li>Click the <strong>Verify Email Address</strong> button in the email.</li>
          <li>Once confirmed, you will automatically be signed in or redirected to your feedback form.</li>
        </ol>
      </div>

      {/* Resend Action Form */}
      <form onSubmit={handleResend} className="space-y-3 pt-2 border-t border-slate-100">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
          Didn't receive the email? Resend link:
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@example.com"
            disabled={isResending}
            className="flex-1 min-h-[42px] px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/30"
          />
          <button
            type="submit"
            disabled={isResending}
            className="px-5 py-2.5 bg-bce-cobalt hover:bg-bce-navy text-white text-xs font-bold rounded-xl transition-colors shadow-xs disabled:opacity-50 inline-flex items-center justify-center gap-1.5 shrink-0"
          >
            {isResending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Resend Email</span>
              </>
            )}
          </button>
        </div>
        <p className="text-[11px] text-slate-400">
          Rate limited to protect mail quotas. Please also check your spam / junk folder.
        </p>
      </form>

      {/* Back to Login */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
        <Link
          href={loginUrl}
          className="font-bold text-bce-cobalt hover:text-bce-navy hover:underline inline-flex items-center gap-1"
        >
          <span>Already clicked the link? Sign In</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

export default function StudentVerifyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-100 flex flex-col justify-between py-6 px-3 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto w-full flex items-center justify-between text-xs text-slate-400">
        <Link
          href="/feedback"
          className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Feedback Portal</span>
        </Link>
        <span className="text-[11px] font-semibold tracking-wider uppercase text-amber-400">
          Email Verification
        </span>
      </div>

      <div className="my-auto max-w-md mx-auto w-full">
        <Suspense
          fallback={
            <div className="bg-white rounded-3xl p-10 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-bce-cobalt mx-auto" />
              <p className="text-xs text-slate-500">Loading verification status...</p>
            </div>
          }
        >
          <VerifyContent />
        </Suspense>
      </div>

      <div className="max-w-md mx-auto w-full text-center text-xs text-slate-500 pt-6">
        CampusFlow • Multi-Tenant Feedback System
      </div>
    </div>
  );
}
