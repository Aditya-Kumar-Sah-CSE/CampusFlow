'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAppRouter as useRouter } from '@/lib/hooks/use-app-router';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Send,
  HelpCircle,
} from 'lucide-react';
import {
  studentLoginAction,
  resendStudentVerificationAction,
} from '@/app/auth/student/actions';
import { ExamPadCard } from '@/components/ui/ExamPadCard';

export function StudentLoginForm({ preselectedCollegeSlug }: { preselectedCollegeSlug?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showResendBox, setShowResendBox] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendFeedback, setResendFeedback] = useState<{ success?: boolean; message?: string } | null>(null);

  const redirectParam = searchParams.get('redirect') || searchParams.get('returnTo') || searchParams.get('next');
  const queryVerified = searchParams.get('verified');
  const queryReset = searchParams.get('reset');
  const queryError = searchParams.get('error');
  const queryInfo = searchParams.get('info') || searchParams.get('message');
  const initialEmail = searchParams.get('email');

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
      setResendEmail(initialEmail);
    }
    if (queryVerified === 'true') {
      setSuccessMsg('Email verified successfully! You can now sign in with your credentials.');
      setErrorMsg('');
    } else if (queryReset === 'success') {
      setSuccessMsg('Password updated successfully. Please sign in with your new password.');
      setErrorMsg('');
    } else if (queryInfo) {
      setSuccessMsg(queryInfo);
      setErrorMsg('');
    } else if (queryError) {
      setErrorMsg(queryError);
    }
  }, [initialEmail, queryVerified, queryReset, queryInfo, queryError]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const result = await studentLoginAction(
        { email, password },
        redirectParam
      );

      if (!result.success) {
        setErrorMsg(result.error || 'Authentication failed. Please verify your credentials.');
        if (result.requiresVerification) {
          setShowResendBox(true);
          setResendEmail(result.email || email);
        }
        setIsLoading(false);
        return;
      }

      // Successful login - hard navigate to destination to ensure cookie synchronization
      const dest = result.redirectTo || '/feedback';
      window.location.href = dest;
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred during login.');
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const target = (resendEmail || email).trim().toLowerCase();
    if (!target) {
      setErrorMsg('Please enter your email address to receive a verification link.');
      return;
    }

    setIsResending(true);
    setResendFeedback(null);

    try {
      const res = await resendStudentVerificationAction(target);
      if (res.success) {
        setResendFeedback({
          success: true,
          message: res.message || 'Verification link sent! Please check your inbox and spam folder.',
        });
      } else {
        setResendFeedback({
          success: false,
          message: res.error || 'Failed to send verification email.',
        });
      }
    } catch (err: any) {
      setResendFeedback({
        success: false,
        message: err.message || 'Network error dispatching verification email.',
      });
    } finally {
      setIsResending(false);
    }
  };

  const signupUrl = `/auth/student/signup${
    redirectParam ? `?redirect=${encodeURIComponent(redirectParam)}` : ''
  }`;

  return (
    <ExamPadCard clipLabel="STUDENT LOGIN" paperClassName="space-y-5 text-slate-900 dark:text-[#faebd0]">
      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-[3px] text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900/60 rounded-[3px] text-rose-900 dark:text-rose-200 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5" noValidate>
        {/* Email Field */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-[#faebd0] mb-1.5 flex items-center gap-1.5">
            <Mail className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            Registered Email Address *
          </label>
          <input
            id="student-login-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setResendEmail(e.target.value);
              if (errorMsg) setErrorMsg('');
            }}
            placeholder="e.g. student@gmail.com"
            disabled={isLoading}
            className="w-full min-h-[44px] rounded-[3px] border border-slate-300 dark:border-[#4d3817] bg-white dark:bg-[#1f150c] px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-[#faebd0] placeholder:text-slate-400 dark:placeholder:text-[#9e835b] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs transition-all"
          />
        </div>

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-[#faebd0] flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Password *
            </label>
            <Link
              href="/auth/student/forgot-password"
              className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="student-login-password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder="Enter your password"
              disabled={isLoading}
              className="w-full min-h-[44px] rounded-[3px] border border-slate-300 dark:border-[#4d3817] bg-white dark:bg-[#1f150c] px-3.5 pr-10 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-[#faebd0] placeholder:text-slate-400 dark:placeholder:text-[#9e835b] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-[#9e835b] dark:hover:text-amber-300"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-1">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-[3px] bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-xs hover:shadow-md transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-200" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <span>Sign In to Student Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Resend Verification Drawer/Box */}
      <div className="pt-2 border-t border-amber-900/15 dark:border-[#382713]">
        {!showResendBox ? (
          <button
            type="button"
            onClick={() => setShowResendBox(true)}
            className="text-xs text-slate-600 dark:text-[#c4a97d] hover:text-amber-700 dark:hover:text-amber-300 font-medium flex items-center gap-1 mx-auto cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Didn't receive verification email? Click to resend</span>
          </button>
        ) : (
          <div className="p-3.5 bg-amber-50/70 dark:bg-[#20150b] rounded-[3px] border border-amber-200/80 dark:border-[#422e17] space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-[#faebd0] flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Resend Email Verification Link
              </span>
              <button
                type="button"
                onClick={() => setShowResendBox(false)}
                className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer"
              >
                Close
              </button>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-[#c4a97d]">
              Enter your email to receive a fresh verification link. Only unverified student accounts will receive an email.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="student@example.com"
                className="flex-1 min-h-[38px] px-3 py-2 text-xs rounded-[3px] border border-slate-300 dark:border-[#4d3817] bg-white dark:bg-[#1a1208] text-slate-900 dark:text-[#faebd0]"
              />
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={isResending}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-[3px] transition-colors disabled:opacity-50 shrink-0 inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                {isResending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Send Link</span>
              </button>
            </div>
            {resendFeedback && (
              <p className={`text-xs ${resendFeedback.success ? 'text-emerald-700 dark:text-emerald-300 font-semibold' : 'text-rose-600 dark:text-rose-300'}`}>
                {resendFeedback.message}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Switch to Signup */}
      <div className="pt-2 border-t border-amber-900/15 dark:border-[#382713] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-700 dark:text-[#c4a97d] text-center sm:text-left">
        <span>New student? Create an account</span>
        <Link
          href={signupUrl}
          className="font-bold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 hover:underline"
        >
          Create Student Account →
        </Link>
      </div>

      {/* Admin Portal Gateway Link */}
      <div className="pt-2 text-center text-[11px] text-slate-500 dark:text-[#9e835b]">
        Are you a Faculty Member or College Admin?{' '}
        <Link href="/admin/login" className="text-amber-700 dark:text-amber-400 font-semibold hover:underline">
          Go to Platform Admin Sign In
        </Link>
      </div>
    </ExamPadCard>
  );
}
