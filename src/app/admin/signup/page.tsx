'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAppRouter as useRouter } from '@/lib/hooks/use-app-router';
import { createClient } from '@/lib/supabase/client';
import {
  Building2,
  User,
  Lock,
  Mail,
  ArrowRight,
  ArrowLeft,
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
  ChevronRight,
  Edit2,
} from 'lucide-react';
import { ExamPadCard } from '@/components/ui/ExamPadCard';

const ROLE_OPTIONS = [
  {
    id: 'PRIMARY_ADMIN',
    label: 'Primary College Admin',
    desc: 'Institutional lead. Controls other admins & full college config.',
    badge: 'Full Access + Admin Control',
    icon: ShieldCheck,
    color: 'border-amber-500/80 bg-amber-500/10 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
  },
  {
    id: 'EVENT_COORDINATOR',
    label: 'Event Coordinator',
    desc: 'Organize college events, registrations, competitions & passes.',
    badge: 'Events Tab',
    icon: Calendar,
    color: 'border-purple-500/80 bg-purple-500/10 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400',
  },
  {
    id: 'LIBRARIAN',
    label: 'Librarian',
    desc: 'Manage book inventory, approve student borrows, timings & fines.',
    badge: 'Library Tab',
    icon: BookOpen,
    color: 'border-emerald-500/80 bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  },
  {
    id: 'FEEDBACK_EXAM_COORDINATOR',
    label: 'Feedback & Exam Coordinator',
    desc: 'Manage student feedback surveys, forms & examination schedules.',
    badge: 'Feedback + Exams',
    icon: ClipboardCheck,
    color: 'border-sky-500/80 bg-sky-500/10 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400',
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

  // 2-Step Form Navigation: 1 = College & Role, 2 = Personal & Credentials
  const [step, setStep] = useState<1 | 2>(1);

  const [role, setRole] = useState<AdminRoleType>(defaultRole);
  const [name, setName] = useState(searchParams.get('name') || '');
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [colleges, setColleges] = useState<Array<{ id: string; name: string; code: string; slug?: string }>>([]);
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
            (c: any) =>
              c.slug?.toLowerCase() === collegeParam ||
              c.id === collegeParam ||
              c.code?.toLowerCase() === collegeParam
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

  const selectedCollege = colleges.find((c) => c.id === selectedCollegeId);
  const selectedRoleObj = ROLE_OPTIONS.find((r) => r.id === role);

  const handleNextStep = () => {
    setErrorMsg('');
    if (!selectedCollegeId) {
      setErrorMsg('Please select your institution / college before continuing.');
      return;
    }
    setStep(2);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedCollegeId) {
      setErrorMsg('Please select your institution.');
      setStep(1);
      return;
    }

    if (!name.trim()) {
      setErrorMsg('Please enter your full official name.');
      return;
    }

    if (!email.trim()) {
      setErrorMsg('Please enter your official institutional email.');
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
    <ExamPadCard clipLabel="ADMIN REQUEST" paperClassName="space-y-4 text-slate-900 dark:text-[#faebd0]">
      {/* 2-Step Progress Indicator */}
      <div className="pb-3 border-b border-slate-200/80 dark:border-[#4d3817]">
        <div className="flex items-center justify-between text-xs mb-2">
          <div className="flex items-center gap-2">
            <span
              className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-[2px] uppercase tracking-wider ${
                step === 1
                  ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
              }`}
            >
              Step {step} of 2
            </span>
            <span className="font-bold text-slate-800 dark:text-[#faebd0]">
              {step === 1 ? 'Select Institution & Role' : 'Administrator Credentials'}
            </span>
          </div>

          {step === 2 && (
            <button
              type="button"
              onClick={() => {
                setErrorMsg('');
                setStep(1);
              }}
              className="text-[11px] font-semibold text-bce-cobalt dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Edit2 className="w-3 h-3" />
              <span>Change Role</span>
            </button>
          )}
        </div>

        {/* Visual Progress Steps Bar */}
        <div className="grid grid-cols-2 gap-1.5 h-1.5 w-full">
          <div
            className={`h-full rounded-[2px] transition-all duration-300 ${
              step >= 1 ? 'bg-amber-500' : 'bg-slate-200 dark:bg-[#342414]'
            }`}
          />
          <div
            className={`h-full rounded-[2px] transition-all duration-300 ${
              step === 2 ? 'bg-amber-500' : 'bg-slate-200 dark:bg-[#342414]'
            }`}
          />
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800/70 rounded-[3px] text-red-700 dark:text-red-200 text-xs flex items-start gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800/70 rounded-[3px] text-emerald-800 dark:text-emerald-200 text-xs flex items-start gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{successMsg}</span>
        </div>
      )}

      {/* ========================================================
          PART 1: INSTITUTION & ROLE SELECTION (STEP 1)
          ======================================================== */}
      {step === 1 && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Target Institution Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#c4a97d] mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-bce-cobalt dark:text-amber-400" />
              Target Institution / College *
            </label>
            <div className="relative rounded-[3px] shadow-2xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-[#8a7251]">
                <Building2 className="w-4 h-4" />
              </div>
              <select
                required
                value={selectedCollegeId}
                onChange={(e) => {
                  setSelectedCollegeId(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                className="block w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-[#1f150c] border border-slate-300 dark:border-[#4d3817] rounded-[3px] text-xs sm:text-sm min-h-[44px] text-slate-900 dark:text-[#faebd0] focus:outline-none focus:ring-1 focus:ring-amber-500 dark:focus:border-amber-500 transition-colors cursor-pointer"
              >
                <option value="" disabled>Select your institution...</option>
                <optgroup label="Bihar Engineering Colleges (BEU)">
                  {colleges
                    .filter((c) => !c.code?.startsWith('GP-') && !c.code?.startsWith('GWP-') && !c.name?.toLowerCase().includes('polytechnic'))
                    .map((c) => (
                      <option key={c.id} value={c.id} className="bg-white dark:bg-[#1f150c] text-slate-900 dark:text-[#faebd0]">
                        {c.name} ({c.code})
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Bihar Polytechnic Colleges (SBTE)">
                  {colleges
                    .filter((c) => c.code?.startsWith('GP-') || c.code?.startsWith('GWP-') || c.name?.toLowerCase().includes('polytechnic'))
                    .map((c) => (
                      <option key={c.id} value={c.id} className="bg-white dark:bg-[#1f150c] text-slate-900 dark:text-[#faebd0]">
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
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#c4a97d]">
                Desired Role &amp; Access Level *
              </label>
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                Role controls assigned tabs
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
                    className={`text-left p-3 rounded-[3px] border transition-all cursor-pointer relative ${
                      isSelected
                        ? `${opt.color} ring-1 ring-amber-500/60 shadow-xs`
                        : 'border-slate-300 dark:border-[#4d3817] bg-white/70 dark:bg-[#1b130a] text-slate-700 dark:text-[#d6c4a8] hover:border-slate-400 dark:hover:border-[#6a4f22] hover:bg-slate-50 dark:hover:bg-[#23180c]'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-[3px] flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-amber-600 text-white dark:bg-amber-500 dark:text-slate-950 shadow-2xs'
                            : 'bg-slate-100 dark:bg-[#281b0f] text-slate-600 dark:text-[#a8906c]'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 dark:text-[#faebd0] leading-tight">
                            {opt.label}
                          </span>
                        </div>
                        <span className="inline-block mt-0.5 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-[2px] bg-slate-200/70 dark:bg-[#2d1f11] text-amber-800 dark:text-amber-300 border border-slate-300 dark:border-[#4d3817]">
                          {opt.badge}
                        </span>
                        <p className="text-[10px] text-slate-500 dark:text-[#a8906c] mt-1 leading-snug">
                          {opt.desc}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Student applicant callout banner */}
            <div className="mt-2.5 p-2.5 rounded-[3px] bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 flex items-center justify-between gap-2 text-[11px] text-purple-900 dark:text-purple-200">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                <span>
                  <strong>Students:</strong> You can apply as an <strong>Event Coordinator</strong> for your college!
                </span>
              </div>
              {role !== 'EVENT_COORDINATOR' && (
                <button
                  type="button"
                  onClick={() => setRole('EVENT_COORDINATOR')}
                  className="text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:underline shrink-0 cursor-pointer"
                >
                  Select Role
                </button>
              )}
            </div>
          </div>

          {/* Next Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleNextStep}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 min-h-[44px] rounded-[3px] shadow-sm text-xs sm:text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all cursor-pointer active:scale-98"
            >
              <span>Continue to Personal Details</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          PART 2: PERSONAL & CREDENTIALS FORM (STEP 2)
          ======================================================== */}
      {step === 2 && (
        <form className="space-y-4 animate-in fade-in duration-150" onSubmit={handleSignup}>
          {/* Selected College & Role Summary Badge */}
          <div className="p-3 bg-amber-50/70 dark:bg-[#20150a] border border-amber-300/80 dark:border-[#4d3817] rounded-[3px] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 block">
                Selected Assignment
              </span>
              <div className="text-xs font-bold text-slate-900 dark:text-[#faebd0] truncate">
                {selectedCollege ? selectedCollege.name : 'College Selected'}
              </div>
              <div className="text-[11px] text-slate-600 dark:text-[#c4a97d] flex items-center gap-1.5 mt-0.5">
                <span>Role:</span>
                <span className="font-semibold text-amber-700 dark:text-amber-300">{selectedRoleObj?.label}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setErrorMsg('');
                setStep(1);
              }}
              className="px-2.5 py-1 text-[11px] font-semibold text-bce-cobalt dark:text-amber-400 hover:bg-white dark:hover:bg-[#2c1d0f] border border-slate-300 dark:border-[#4d3817] rounded-[3px] shrink-0 transition-colors cursor-pointer"
            >
              Change
            </button>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#c4a97d] mb-1.5 flex items-center gap-1.5">
              <User className="w-4 h-4 text-bce-cobalt dark:text-amber-400" />
              Full Name *
            </label>
            <div className="relative rounded-[3px] shadow-2xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-[#8a7251]">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Prof. / Dr. / First Last"
                className="block w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-[#1f150c] border border-slate-300 dark:border-[#4d3817] rounded-[3px] text-xs sm:text-sm min-h-[44px] text-slate-900 dark:text-[#faebd0] placeholder:text-slate-400 dark:placeholder:text-[#8a7251] focus:outline-none focus:ring-1 focus:ring-amber-500 dark:focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          {/* Institutional Email */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#c4a97d] mb-1.5 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-bce-cobalt dark:text-amber-400" />
              Institutional Email *
            </label>
            <div className="relative rounded-[3px] shadow-2xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-[#8a7251]">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="faculty@bce.ac.in or authorized email"
                className="block w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-[#1f150c] border border-slate-300 dark:border-[#4d3817] rounded-[3px] text-xs sm:text-sm min-h-[44px] text-slate-900 dark:text-[#faebd0] placeholder:text-slate-400 dark:placeholder:text-[#8a7251] focus:outline-none focus:ring-1 focus:ring-amber-500 dark:focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#c4a97d] mb-1.5 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-bce-cobalt dark:text-amber-400" />
              Password *
            </label>
            <div className="relative rounded-[3px] shadow-2xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-[#8a7251]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="At least 6 characters"
                className="block w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-[#1f150c] border border-slate-300 dark:border-[#4d3817] rounded-[3px] text-xs sm:text-sm min-h-[44px] text-slate-900 dark:text-[#faebd0] placeholder:text-slate-400 dark:placeholder:text-[#8a7251] focus:outline-none focus:ring-1 focus:ring-amber-500 dark:focus:border-amber-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#c4a97d] mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-bce-cobalt dark:text-amber-400" />
                Confirm Password *
              </span>
              {confirmPassword && password !== confirmPassword && (
                <span className="text-[11px] text-rose-600 dark:text-rose-400 font-normal">Passwords do not match</span>
              )}
            </label>
            <div className="relative rounded-[3px] shadow-2xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-[#8a7251]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Re-enter password"
                className={`block w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-[#1f150c] border rounded-[3px] text-xs sm:text-sm min-h-[44px] text-slate-900 dark:text-[#faebd0] placeholder:text-slate-400 dark:placeholder:text-[#8a7251] focus:outline-none focus:ring-1 transition-colors ${
                  confirmPassword && password !== confirmPassword
                    ? 'border-rose-500 focus:ring-rose-500'
                    : 'border-slate-300 dark:border-[#4d3817] focus:ring-amber-500 dark:focus:border-amber-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none cursor-pointer"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="p-3 bg-slate-100/80 dark:bg-[#1a1208] rounded-[3px] border border-slate-200 dark:border-[#4d3817] text-[11px] text-slate-600 dark:text-[#a8906c]">
            ℹ️ New admin registrations require approval from the Super Admin before dashboard access is activated.
          </div>

          {/* Action Buttons Row */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setErrorMsg('');
                setStep(1);
              }}
              disabled={isLoading}
              className="py-3 px-4 min-h-[44px] rounded-[3px] border border-slate-300 dark:border-[#4d3817] bg-white dark:bg-[#1f150c] hover:bg-slate-50 dark:hover:bg-[#2c1d0f] text-slate-700 dark:text-[#faebd0] text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 flex justify-center items-center gap-2 py-3 px-4 min-h-[44px] rounded-[3px] shadow-sm text-xs sm:text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
      )}

      {/* Footer Navigation */}
      <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-[#4d3817] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <Link
          href={redirectParam ? `/admin/login?redirect=${encodeURIComponent(redirectParam)}` : '/admin/login'}
          className="text-amber-700 dark:text-amber-400 hover:underline font-semibold"
        >
          Already have an account? Sign In →
        </Link>

        <Link
          href="/"
          className="text-slate-500 dark:text-[#a8906c] hover:underline"
        >
          ← Back to Student Portal
        </Link>
      </div>
    </ExamPadCard>
  );
}

export default function AdminSignupPage() {
  return (
    <div className="min-h-screen bg-slate-950/40 backdrop-blur-xs text-slate-100 flex flex-col justify-center py-6 sm:py-12 px-2.5 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-1 sm:px-0">
        <Suspense
          fallback={
            <div className="bg-slate-800/90 py-12 px-6 rounded-[3px] border border-slate-700/60 text-center space-y-3">
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
