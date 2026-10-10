'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useAppRouter as useRouter } from '@/lib/hooks/use-app-router';
import {
  User,
  LogOut,
  CheckCircle2,
  AlertCircle,
  School,
  GraduationCap,
  ChevronDown,
  ChevronRight,
  UserCheck,
  Loader2,
  FileText,
  Ticket,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { studentSignOutAction } from '@/app/auth/student/actions';
import { useStudentSession } from '@/lib/auth/use-student-session';

function getStudentInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    const username = email.split('@')[0];
    return username.slice(0, 2).toUpperCase();
  }
  return 'ST';
}

export function StudentStatusBadge({
  compact = false,
  tenantSlug,
  adminLoginUrl,
}: {
  compact?: boolean;
  tenantSlug?: string;
  adminLoginUrl?: string;
}) {
  const { session, isAuthenticated, user, student, loading, refreshSession } = useStudentSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const routeTenant = (params?.tenant as string) || (params?.slug as string);
  const effectiveTenant = tenantSlug || routeTenant;
  const targetAdminUrl =
    adminLoginUrl || (effectiveTenant ? `/${effectiveTenant}/admin/login` : '/admin/login');

  // Listen to Supabase auth state changes to keep badge in sync reactively
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refreshSession();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, refreshSession]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && dropdownOpen) {
        setDropdownOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dropdownOpen]);

  // Close dropdown on route change
  useEffect(() => {
    setDropdownOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await studentSignOutAction();
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setDropdownOpen(false);
      setLoggingOut(false);
      router.refresh();
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  };

  // Loading skeleton
  if (loading) {
    if (compact) {
      return (
        <div className="inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-slate-100 border border-slate-200 animate-pulse">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-200" />
          <div className="w-14 h-3 bg-slate-200 rounded-full" />
        </div>
      );
    }
    return (
      <div className="w-full h-16 rounded-2xl bg-slate-100 animate-pulse border border-slate-200" />
    );
  }

  const displayName =
    student?.fullName ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Student';

  const email = student?.email || user?.email || '';
  const collegeName = student?.collegeName || user?.user_metadata?.college_name || '';
  const registrationNumber = student?.registrationNumber || '';
  const isVerified = Boolean(student?.emailVerified || user?.user_metadata?.email_verified);
  const initials = getStudentInitials(displayName, email);

  // ============================================================
  // LOGGED IN STATE: Clean Circular Avatar Pill + Unified Profile Dropdown
  // (Faculty Login and Logout are professionally unified inside the profile)
  // ============================================================
  if (isAuthenticated && user) {
    if (compact) {
      return (
        <div className="relative inline-flex items-center" ref={dropdownRef}>
          {/* Circular Modern Avatar + Student Name Pill Button */}
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={`inline-flex items-center gap-2 pl-1 pr-2.5 sm:pr-3 py-1 rounded-full transition-all cursor-pointer group select-none active:scale-98 ${
              dropdownOpen
                ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-100 text-blue-900 shadow-xs'
                : 'bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 shadow-2xs hover:shadow-xs'
            }`}
            aria-expanded={dropdownOpen}
            title={`${displayName} (${email}) - Click to view profile & options`}
          >
            {/* Circular Modern Avatar with Active Emerald Online Badge */}
            <div className="relative shrink-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white font-extrabold text-[11px] sm:text-xs flex items-center justify-center shadow-xs ring-2 ring-white">
                {initials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white" />
            </div>

            {/* Student Name */}
            <span className="font-bold text-xs text-slate-800 group-hover:text-slate-900 truncate max-w-[85px] xs:max-w-[110px] sm:max-w-[140px]">
              {displayName}
            </span>

            {/* Subtle Dropdown Chevron */}
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform duration-200 ${
                dropdownOpen ? 'rotate-180 text-blue-600' : ''
              }`}
            />
          </button>

          {/* Unified Modern Profile Dropdown Card */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              {/* Dropdown Header: Large Avatar + Student Details */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-start gap-3">
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white font-black text-sm flex items-center justify-center shadow-xs ring-2 ring-blue-100">
                    {initials}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-white" />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                      {displayName}
                    </h4>
                    {isVerified ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                        <span>Verified</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertCircle className="w-2.5 h-2.5 text-amber-600" />
                        <span>Unverified</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate font-medium">{email}</p>
                  {collegeName && (
                    <p className="text-[10px] text-slate-400 truncate flex items-center gap-1 pt-0.5">
                      <School className="w-3 h-3 shrink-0" />
                      <span>{collegeName}</span>
                    </p>
                  )}
                  {registrationNumber && (
                    <p className="text-[10px] font-mono font-semibold text-slate-400">
                      Reg #{registrationNumber}
                    </p>
                  )}
                </div>
              </div>

              {/* Student Portal Navigation */}
              <div className="py-1 px-1.5 space-y-0.5 text-xs">
                <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Student Portals
                </p>
                <Link
                  href={effectiveTenant ? `/${effectiveTenant}/feedback` : '/feedback'}
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors font-semibold"
                >
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Feedback Forms</span>
                </Link>
                <Link
                  href={effectiveTenant ? `/${effectiveTenant}/exams` : '/exams'}
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors font-semibold"
                >
                  <GraduationCap className="w-4 h-4 text-indigo-600" />
                  <span>Examination Portal</span>
                </Link>
                <Link
                  href={effectiveTenant ? `/${effectiveTenant}/events` : '/events'}
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors font-semibold"
                >
                  <Ticket className="w-4 h-4 text-purple-600" />
                  <span>Events &amp; Entry Passes</span>
                </Link>
              </div>

              {/* Faculty / Administration Login Section */}
              <div className="pt-1 mt-1 border-t border-slate-100 px-1.5">
                <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Staff &amp; Administration
                </p>
                <Link
                  href={targetAdminUrl}
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-blue-700 hover:bg-blue-50/70 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-2xs">
                      <UserCheck className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="font-bold text-xs text-slate-800 group-hover:text-blue-900 leading-tight">
                        Faculty / Admin Login
                      </p>
                      <p className="text-[10px] text-slate-400 font-normal">
                        Switch to institutional portal
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>

              {/* Account Sign Out Action */}
              <div className="pt-1 mt-1 border-t border-slate-100 px-1.5">
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={loggingOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loggingOut ? (
                    <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                  ) : (
                    <LogOut className="w-4 h-4 text-red-500" />
                  )}
                  <span>Sign Out / Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    // NON-COMPACT VIEW (e.g. In Feedback Discovery Banners or Drawer)
    return (
      <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-slate-50 border border-blue-200/80 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white font-black text-sm flex items-center justify-center shadow-xs ring-2 ring-white">
              {initials}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-slate-900 text-xs sm:text-sm truncate">
                {displayName}
              </span>
              {isVerified ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Verified Student
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  <AlertCircle className="w-3 h-3 text-amber-600" />
                  Email Unverified
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              {email} {collegeName ? `• ${collegeName}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0 flex-wrap">
          {!isVerified && (
            <Link
              href={`/auth/student/verify?email=${encodeURIComponent(email)}`}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
            >
              Verify Email
            </Link>
          )}
          <Link
            href={targetAdminUrl}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-semibold border border-slate-200 transition-colors shadow-2xs"
          >
            <UserCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Faculty Login</span>
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={loggingOut}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-red-50 text-slate-700 hover:text-red-600 rounded-xl text-xs font-bold border border-slate-200 hover:border-red-200 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            {loggingOut ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
            ) : (
              <LogOut className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
            )}
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // GUEST (UNAUTHENTICATED) STATE: Modern Circular Avatar + Login
  // ============================================================
  if (compact) {
    return (
      <Link
        href={`/auth/student/login?redirect=${encodeURIComponent(pathname)}`}
        className="inline-flex items-center gap-2 pl-1 pr-3 sm:pr-3.5 py-1 rounded-full bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-blue-300 shadow-2xs hover:shadow-xs transition-all active:scale-98 shrink-0 group select-none"
        title="Sign in with student account"
      >
        {/* Modern Circular Avatar Placeholder */}
        <div className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full bg-gradient-to-tr from-slate-100 to-slate-200 border border-slate-300/70 group-hover:from-blue-50 group-hover:to-indigo-50 group-hover:border-blue-300 flex items-center justify-center text-slate-500 group-hover:text-blue-600 transition-all shrink-0">
          <User className="w-3.5 h-3.5" />
        </div>

        {/* Login Text */}
        <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700 transition-colors">
          <span className="hidden sm:inline">Student </span>Login
        </span>
      </Link>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200/80 text-blue-600 flex items-center justify-center shrink-0">
          <User className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-900">Student Login Required</p>
          <p className="text-[11px] text-slate-500">
            Sign in once to submit feedback, take examinations, and access official event passes.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        <Link
          href={`/auth/student/signup?redirect=${encodeURIComponent(pathname)}`}
          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold border border-slate-200 transition-colors"
        >
          Register
        </Link>
        <Link
          href={`/auth/student/login?redirect=${encodeURIComponent(pathname)}`}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs active:scale-98"
        >
          <span>Login</span>
        </Link>
      </div>
    </div>
  );
}
