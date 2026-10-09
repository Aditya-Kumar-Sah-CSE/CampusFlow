'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAppRouter as useRouter } from '@/lib/hooks/use-app-router';
import {
  School,
  Building2,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import {
  getActiveCollegesForSignupAction,
  studentSignupAction,
} from '@/app/auth/student/actions';

interface CollegeItem {
  id: string;
  name: string;
  slug: string;
  code: string;
  logoUrl: string | null;
}

export function StudentSignupForm({ preselectedCollegeSlug }: { preselectedCollegeSlug?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [colleges, setColleges] = useState<CollegeItem[]>([]);
  const [loadingColleges, setLoadingColleges] = useState(true);
  const [selectedCollegeId, setSelectedCollegeId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const redirectParam = searchParams.get('redirect') || searchParams.get('returnTo') || searchParams.get('next');
  const initialEmail = searchParams.get('email');

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  // Load active colleges from Supabase
  useEffect(() => {
    async function fetchColleges() {
      setLoadingColleges(true);
      const res = await getActiveCollegesForSignupAction();
      if (res.success && res.colleges) {
        setColleges(res.colleges);

        // Preselection resolution
        const collegeParam = (
          preselectedCollegeSlug ||
          searchParams.get('college') ||
          searchParams.get('tenant') ||
          ''
        ).toLowerCase().trim();

        if (collegeParam) {
          const match = res.colleges.find(
            (c) =>
              c.slug.toLowerCase() === collegeParam ||
              c.id.toLowerCase() === collegeParam ||
              c.code.toLowerCase() === collegeParam
          );
          if (match) {
            setSelectedCollegeId(match.id);
          }
        } else if (res.colleges.length === 1) {
          setSelectedCollegeId(res.colleges[0].id);
        }
      } else {
        setErrorMsg('Failed to load institutions list. Please refresh the page.');
      }
      setLoadingColleges(false);
    }
    fetchColleges();
  }, [preselectedCollegeSlug, searchParams]);

  // Password strength checks
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setFieldErrors({});

    if (!selectedCollegeId) {
      setErrorMsg('Please select your institution.');
      setFieldErrors({ collegeId: 'Please select your institution.' });
      return;
    }

    if (!termsAccepted) {
      setErrorMsg('You must agree to the Terms of Service & Privacy Policy.');
      setFieldErrors({ termsAccepted: 'Consent is required to continue.' });
      return;
    }

    setIsLoading(true);

    try {
      const result = await studentSignupAction({
        collegeId: selectedCollegeId,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
        termsAccepted,
      });

      if (!result.success) {
        setErrorMsg(result.error || 'Failed to register account.');
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        setIsLoading(false);
        return;
      }

      // Successful signup - redirect to verification pending page
      const verifyUrl = new URL('/auth/student/verify', window.location.origin);
      if (result.email) verifyUrl.searchParams.set('email', result.email);
      if (redirectParam) verifyUrl.searchParams.set('redirect', redirectParam);
      router.push(verifyUrl.pathname + verifyUrl.search);
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred during signup.');
      setIsLoading(false);
    }
  };

  const selectedCollege = colleges.find((c) => c.id === selectedCollegeId);

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-xl border border-slate-200/90 text-slate-800">
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" noValidate>
        {errorMsg && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">{errorMsg}</span>
            </div>
          </div>
        )}

        {/* 1. College Selector */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <School className="w-4 h-4 text-bce-cobalt shrink-0" />
              1. Select Your Institution *
            </span>
            {loadingColleges && <Loader2 className="w-3.5 h-3.5 animate-spin text-bce-cobalt" />}
          </label>

          <select
            id="student-signup-college"
            value={selectedCollegeId}
            onChange={(e) => {
              setSelectedCollegeId(e.target.value);
              setFieldErrors((prev) => ({ ...prev, collegeId: '' }));
            }}
            disabled={loadingColleges || isLoading}
            className={`w-full min-h-[46px] rounded-xl border ${
              fieldErrors.collegeId ? 'border-red-400 bg-red-50/30' : 'border-slate-300 bg-slate-50'
            } px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/30 transition-all`}
          >
            <option value="">
              {loadingColleges ? 'Loading institutions...' : '-- Choose your College / Institute --'}
            </option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code || c.slug})
              </option>
            ))}
          </select>

          {selectedCollege && (
            <p className="mt-1.5 text-[11px] text-slate-500 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-emerald-600" />
              <span>Selected: <strong>{selectedCollege.name}</strong></span>
            </p>
          )}

          {fieldErrors.collegeId && (
            <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.collegeId}</p>
          )}
        </div>

        {/* 2. Full Name */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
            <User className="w-4 h-4 text-bce-cobalt" />
            2. Full Name *
          </label>
          <input
            id="student-signup-name"
            type="text"
            required
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              setFieldErrors((prev) => ({ ...prev, fullName: '' }));
            }}
            placeholder="e.g. Rahul Kumar"
            disabled={isLoading}
            className={`w-full min-h-[46px] rounded-xl border ${
              fieldErrors.fullName ? 'border-red-400 bg-red-50/30' : 'border-slate-300 bg-slate-50'
            } px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/30 transition-all`}
          />
          {fieldErrors.fullName && (
            <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.fullName}</p>
          )}
        </div>

        {/* 3. Email Address */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
            <Mail className="w-4 h-4 text-bce-cobalt" />
            3. Email Address *
          </label>
          <input
            id="student-signup-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldErrors((prev) => ({ ...prev, email: '' }));
            }}
            placeholder="e.g. student@gmail.com"
            disabled={isLoading}
            className={`w-full min-h-[46px] rounded-xl border ${
              fieldErrors.email ? 'border-red-400 bg-red-50/30' : 'border-slate-300 bg-slate-50'
            } px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/30 transition-all`}
          />
          <p className="mt-1 text-[11px] text-slate-500">
            A secure verification link will be sent to this email to activate your account.
          </p>
          {fieldErrors.email && (
            <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.email}</p>
          )}
        </div>

        {/* 4. Password & Confirm Password */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-bce-cobalt" />
              4. Password *
            </label>
            <div className="relative">
              <input
                id="student-signup-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, password: '' }));
                }}
                placeholder="Min. 8 characters"
                disabled={isLoading}
                className={`w-full min-h-[46px] rounded-xl border ${
                  fieldErrors.password ? 'border-red-400 bg-red-50/30' : 'border-slate-300 bg-slate-50'
                } px-3.5 pr-10 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/30 transition-all`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.password}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-bce-cobalt" />
              5. Confirm Password *
            </label>
            <div className="relative">
              <input
                id="student-signup-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
                }}
                placeholder="Re-enter password"
                disabled={isLoading}
                className={`w-full min-h-[46px] rounded-xl border ${
                  fieldErrors.confirmPassword ? 'border-red-400 bg-red-50/30' : 'border-slate-300 bg-slate-50'
                } px-3.5 pr-10 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/30 transition-all`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.confirmPassword}</p>
            )}
          </div>
        </div>

        {/* Real-time Password Rules Checklist */}
        {password.length > 0 && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] grid grid-cols-2 gap-2 text-slate-600">
            <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
              <Check className={`w-3.5 h-3.5 ${hasMinLength ? 'text-emerald-600' : 'text-slate-300'}`} />
              <span>At least 8 characters</span>
            </div>
            <div className={`flex items-center gap-1.5 ${hasUppercase ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
              <Check className={`w-3.5 h-3.5 ${hasUppercase ? 'text-emerald-600' : 'text-slate-300'}`} />
              <span>Uppercase letter (A-Z)</span>
            </div>
            <div className={`flex items-center gap-1.5 ${hasLowercase ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
              <Check className={`w-3.5 h-3.5 ${hasLowercase ? 'text-emerald-600' : 'text-slate-300'}`} />
              <span>Lowercase letter (a-z)</span>
            </div>
            <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
              <Check className={`w-3.5 h-3.5 ${hasNumber ? 'text-emerald-600' : 'text-slate-300'}`} />
              <span>Number (0-9)</span>
            </div>
          </div>
        )}

        {/* 5. Terms & Privacy Consent Checkbox */}
        <div className="pt-1">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              id="student-signup-terms"
              type="checkbox"
              required
              checked={termsAccepted}
              onChange={(e) => {
                setTermsAccepted(e.target.checked);
                setFieldErrors((prev) => ({ ...prev, termsAccepted: '' }));
              }}
              disabled={isLoading}
              className="w-4 h-4 mt-0.5 rounded-sm border-slate-300 text-bce-cobalt focus:ring-bce-cobalt shrink-0"
            />
            <span className="text-xs text-slate-600 leading-relaxed">
              I certify that I am a bona fide student of the selected institution. I agree to the{' '}
              <Link href="/terms-of-service" target="_blank" className="text-bce-cobalt font-semibold hover:underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy-policy" target="_blank" className="text-bce-cobalt font-semibold hover:underline">
                Privacy Policy
              </Link>.
            </span>
          </label>
          {fieldErrors.termsAccepted && (
            <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.termsAccepted}</p>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading || loadingColleges}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-bce-navy via-bce-cobalt to-indigo-700 hover:from-slate-900 hover:to-indigo-800 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Creating Student Account...</span>
              </>
            ) : (
              <>
                <span>Create Student Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Footer links */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600 text-center sm:text-left">
          <span>Already registered your account?</span>
          <Link
            href={`/auth/student/login${redirectParam ? `?redirect=${encodeURIComponent(redirectParam)}` : ''}`}
            className="font-bold text-bce-cobalt hover:text-bce-navy hover:underline"
          >
            Sign In with Email & Password →
          </Link>
        </div>
      </form>
    </div>
  );
}
