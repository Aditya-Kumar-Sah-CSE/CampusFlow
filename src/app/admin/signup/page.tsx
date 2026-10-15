'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAppRouter as useRouter } from '@/lib/hooks/use-app-router';
import { createClient } from '@/lib/supabase/client';
import {
  School,
  Building2,
  User,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
  Calendar,
  BookOpen,
  ClipboardCheck,
  Sparkles,
} from 'lucide-react';

const ROLE_OPTIONS = [
  {
    id: 'PRIMARY_ADMIN',
    label: 'Primary College Admin',
    desc: 'Institutional lead. Controls other admins & full college config.',
    badge: 'Full Access + Admin Control',
    icon: ShieldCheck,
    color: 'border-amber-500/50 bg-amber-500/10 text-amber-400',
  },
  {
    id: 'EVENT_COORDINATOR',
    label: 'Event Coordinator',
    desc: 'Organize college events, registrations, competitions & passes.',
    badge: 'Events Tab',
    icon: Calendar,
    color: 'border-purple-500/50 bg-purple-500/10 text-purple-400',
  },
  {
    id: 'LIBRARIAN',
    label: 'Librarian',
    desc: 'Manage book inventory, approve student borrows, timings & fines.',
    badge: 'Library Tab',
    icon: BookOpen,
    color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400',
  },
  {
    id: 'FEEDBACK_EXAM_COORDINATOR',
    label: 'Feedback & Exam Coordinator',
    desc: 'Manage student feedback surveys, forms & examination schedules.',
    badge: 'Feedback + Exams',
    icon: ClipboardCheck,
    color: 'border-sky-500/50 bg-sky-500/10 text-sky-400',
  },
] as const;

type AdminRoleType = (typeof ROLE_OPTIONS)[number]['id'];

function AdminSignupForm() {
  const searchParams = useSearchParams();
  const initialRoleParam = searchParams.get('role')?.toUpperCase();
  const defaultRole: AdminRoleType =
    initialRoleParam === 'EVENT_COORDINATOR' ||
    initialRoleParam === 'LIBRARIAN' ||
    initialRoleParam === 'FEEDBACK_EXAM_COORDINATOR' ||
    initialRoleParam === 'PRIMARY_ADMIN'
      ? (initialRoleParam as AdminRoleType)
      : 'PRIMARY_ADMIN';

  const [role, setRole] = useState<AdminRoleType>(defaultRole);
  const [name, setName] = useState(searchParams.get('name') || '');
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [colleges, setColleges] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const roleParam = searchParams.get('role')?.toUpperCase();
    if (
      roleParam === 'EVENT_COORDINATOR' ||
      roleParam === 'LIBRARIAN' ||
      roleParam === 'FEEDBACK_EXAM_COORDINATOR' ||
      roleParam === 'PRIMARY_ADMIN'
    ) {
      setRole(roleParam as AdminRoleType);
    }
    const nameParam = searchParams.get('name');
    if (nameParam && !name) setName(nameParam);
    const emailParam = searchParams.get('email');
    if (emailParam && !email) setEmail(emailParam);
  }, [searchParams]);

  useEffect(() => {
    async function loadColleges() {
      const { data } = await supabase
        .from('colleges')
        .select('id, name, code, slug')
        .eq('is_active', true)
        .order('name');
      if (data && data.length > 0) {
        setColleges(data);
        const collegeParam = searchParams.get('college')?.toLowerCase().trim();
        if (collegeParam) {
          const matched = data.find(
            (c: any) => c.slug?.toLowerCase() === collegeParam || c.id === collegeParam || c.code?.toLowerCase() === collegeParam
          );
          if (matched) {
            setSelectedCollegeId(matched.id);
            return;
          }
        }
        if (data.length === 1) {
          setSelectedCollegeId(data[0].id);
        }
      }
    }
    loadColleges();
  }, [supabase, searchParams]);

  const redirectParam = searchParams.get('redirect');
  const targetDestination =
    redirectParam && redirectParam.startsWith('/admin')
      ? redirectParam
      : '/admin/dashboard';

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedCollegeId) {
      setErrorMsg('Please select your institution.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify your password.');
      return;
    }

    setIsLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const formattedName = name.trim();

      // Submit request directly to Server API (creates confirmed user without SMTP email timeouts)
      const reqRes = await fetch('/api/admin/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formattedName,
          email: cleanEmail,
          password,
          collegeId: selectedCollegeId,
          role,
        }),
      });

      let reqData: any;
      try {
        reqData = await reqRes.json();
      } catch {
        throw new Error(`Server returned unexpected response (Status: ${reqRes.status})`);
      }

      if (!reqRes.ok || !reqData) {
        setErrorMsg(reqData?.error || 'Failed to submit admin request.');
        setIsLoading(false);
        return;
      }

      // Automatically establish session via password login (instant, ~300ms)
      try {
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
      } catch {
        // Non-fatal if session isn't immediately created in browser
      }

      // If auto-promoted (Super Admin)
      if (reqData.isSuperAdmin) {
        router.push(targetDestination);
        router.refresh();
        return;
      }

      // If request is already pending
      if (reqData.alreadyPending) {
        setSuccessMsg(
          reqData.message ||
            'Your administrator access request is already registered and pending approval.'
        );
        setTimeout(() => {
          router.push('/admin/pending');
        }, 1200);
        return;
      }

      // Standard pending notification
      setSuccessMsg(
        'Your request for administrator access has been registered and is pending approval.'
      );
      setTimeout(() => {
        router.push('/admin/pending');
      }, 1200);
    } catch (err: unknown) {
      console.error('Signup error:', err);
      const msg =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred during request submission.';
      setErrorMsg(msg);
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-800/90 backdrop-blur-md py-5 px-3.5 sm:py-8 sm:px-10 shadow-2xl rounded-2xl border border-slate-700/60">
      <form className="space-y-4" onSubmit={handleSignup}>
        {errorMsg && (
          <div className="p-3.5 bg-red-950/60 border border-red-800/70 rounded-xl text-red-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-950/60 border border-emerald-800/70 rounded-xl text-emerald-200 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Institution Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Target Institution / College
          </label>
          <div className="relative rounded-xl shadow-xs">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Building2 className="w-4 h-4" />
            </div>
            <select
              required
              value={selectedCollegeId}
              onChange={(e) => setSelectedCollegeId(e.target.value)}
              className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-base sm:text-sm min-h-[44px] text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all cursor-pointer"
            >
              <option value="" disabled>Select your institution...</option>
              <optgroup label="Bihar Engineering Colleges (BEU)">
                {colleges
                  .filter((c) => !c.code?.startsWith('GP-') && !c.code?.startsWith('GWP-') && !c.name?.toLowerCase().includes('polytechnic'))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Bihar Polytechnic Colleges (SBTE)">
                {colleges
                  .filter((c) => c.code?.startsWith('GP-') || c.code?.startsWith('GWP-') || c.name?.toLowerCase().includes('polytechnic'))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>
        </div>

        {/* Desired Admin Role Selection */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Desired Role &amp; Access Level
            </label>
            <span className="text-[10px] text-amber-400 font-medium">
              Role controls assigned dashboard tabs
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ROLE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = role === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRole(opt.id)}
                  className={`text-left p-3 rounded-xl border transition-all cursor-pointer relative ${
                    isSelected
                      ? `${opt.color} ring-2 ring-amber-400/40 shadow-md`
                      : 'border-slate-700/80 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-white/10 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-white leading-tight">
                          {opt.label}
                        </span>
                      </div>
                      <span className="inline-block mt-0.5 text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-black/30 text-amber-300">
                        {opt.badge}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                        {opt.desc}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Student applicant callout */}
          <div className="mt-2.5 p-2.5 rounded-lg bg-purple-950/40 border border-purple-800/40 flex items-center justify-between gap-2 text-[11px] text-purple-200">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>
                <strong>Students:</strong> You can apply as an <strong>Event Coordinator</strong> for your college!
              </span>
            </div>
            {role !== 'EVENT_COORDINATOR' && (
              <button
                type="button"
                onClick={() => setRole('EVENT_COORDINATOR')}
                className="text-[10px] font-bold text-amber-300 hover:text-amber-200 underline shrink-0 cursor-pointer"
              >
                Select Role
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Full Name
          </label>
          <div className="relative rounded-xl shadow-xs">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <User className="w-4 h-4" />
            </div>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Prof. / Dr. / First Last"
              className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-base sm:text-sm min-h-[44px] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Institutional Email
          </label>
          <div className="relative rounded-xl shadow-xs">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail className="w-4 h-4" />
            </div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="faculty@bce.ac.in"
              className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-base sm:text-sm min-h-[44px] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
            />
          </div>
        </div>


        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Password
          </label>
          <div className="relative rounded-xl shadow-xs">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="block w-full pl-10 pr-10 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-base sm:text-sm min-h-[44px] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 focus:outline-none transition-colors cursor-pointer"
              title={showPassword ? 'Hide password' : 'Show password'}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>Confirm Password</span>
            {confirmPassword && password !== confirmPassword && (
              <span className="text-[11px] text-rose-400 font-normal">Passwords do not match</span>
            )}
          </label>
          <div className="relative rounded-xl shadow-xs">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className={`block w-full pl-10 pr-10 py-2.5 bg-slate-900/90 border rounded-xl text-base sm:text-sm min-h-[44px] text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                confirmPassword && password !== confirmPassword
                  ? 'border-rose-500/80 focus:ring-rose-500/30 focus:border-rose-500'
                  : 'border-slate-700 focus:ring-amber-500/30 focus:border-amber-500'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 focus:outline-none transition-colors cursor-pointer"
              title={showConfirmPassword ? 'Hide password' : 'Show password'}
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/50 text-[11px] text-slate-400">
          ℹ️ New admin registrations require approval from the Super Admin before dashboard access is granted.
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center items-center gap-2 py-3 px-4 min-h-[44px] border border-transparent rounded-xl shadow-md text-sm font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Submitting Request...</span>
              </>
            ) : (
              <>
                <span>Submit Admin Request</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <Link
          href={redirectParam ? `/admin/login?redirect=${encodeURIComponent(redirectParam)}` : '/admin/login'}
          className="text-amber-400 hover:text-amber-300 transition-colors font-medium"
        >
          Already have an account? Sign In →
        </Link>

        <Link
          href="/"
          className="text-slate-400 hover:text-slate-300 transition-colors"
        >
          ← Back to Student Portal
        </Link>
      </div>
    </div>
  );
}

export default function AdminSignupPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center py-5 sm:py-12 px-2.5 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-950 via-bce-navy to-slate-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-bce-cobalt to-amber-500 p-0.5 shadow-xl flex items-center justify-center">
          <div className="w-full h-full bg-bce-navy rounded-2xl flex items-center justify-center">
            <School className="w-7 h-7 sm:w-8 sm:h-8 text-amber-400" />
          </div>
        </div>

        <h2 className="mt-4 sm:mt-5 text-xl sm:text-3xl font-extrabold tracking-tight text-white">
          Request Admin Access
        </h2>
        <p className="mt-1 sm:mt-1.5 text-xs text-slate-400 font-medium">
          Campus Management Platform • Administrator Portal
        </p>
      </div>

      <div className="mt-4 sm:mt-8 sm:mx-auto sm:w-full sm:max-w-md px-1 sm:px-0">
        <Suspense
          fallback={
            <div className="bg-slate-800/90 py-12 px-6 rounded-2xl border border-slate-700/60 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto" />
              <p className="text-xs text-slate-400">Loading registration form...</p>
            </div>
          }
        >
          <AdminSignupForm />
        </Suspense>
      </div>
    </div>
  );
}
