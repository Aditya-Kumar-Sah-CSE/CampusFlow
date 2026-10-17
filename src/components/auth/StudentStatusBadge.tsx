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
  Pencil,
  UserCog,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { studentSignOutAction } from '@/app/auth/student/actions';
import { useStudentSession } from '@/lib/auth/use-student-session';
import { StudentEditProfileModal } from './StudentEditProfileModal';
import { StudentCoordinatorApplyModal } from './StudentCoordinatorApplyModal';
import { RedPushpin } from '@/components/ui/RedPushpin';

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
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isCoordinatorModalOpen, setIsCoordinatorModalOpen] = useState(false);
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
        <div className="inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-[3px] bg-amber-500/10 dark:bg-amber-900/20 border border-amber-500/20 animate-pulse">
          <div className="w-7 h-7 rounded-[2px] bg-amber-200 dark:bg-amber-900/40" />
          <div className="w-14 h-3 bg-amber-200 dark:bg-amber-900/40 rounded-[2px]" />
        </div>
      );
    }
    return (
      <div className="w-full h-16 rounded-[3px] bg-amber-500/10 dark:bg-amber-900/20 animate-pulse border border-amber-500/20" />
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
  // LOGGED IN STATE: Sharp Ledger Badge + ExamPad Popover
  // ============================================================
  if (isAuthenticated && user) {
    if (compact) {
      return (
        <div className="relative inline-flex items-center" ref={dropdownRef}>
          {/* Sharp ExamPad Ledger Profile Trigger Button */}
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={`inline-flex items-center gap-2 pl-1 pr-2.5 sm:pr-3 py-1 rounded-[3px] transition-all cursor-pointer group select-none active:scale-98 ${
              dropdownOpen
                ? 'bg-amber-100/90 dark:bg-[#2b1c0e] border-amber-500 ring-2 ring-amber-500/30 text-amber-950 dark:text-amber-200 shadow-sm'
                : 'bg-[#fffdfa] dark:bg-[#1a1208] hover:bg-amber-50/80 dark:hover:bg-[#24170b] border border-amber-900/30 dark:border-[#4d3817] shadow-2xs'
            }`}
            aria-expanded={dropdownOpen}
            title={`${displayName} (${email}) - Click to view profile & options`}
          >
            {/* Sharp Initial Badge with Active Online Indicator */}
            <div className="relative shrink-0">
              <div className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-[2px] bg-amber-600 dark:bg-amber-700 text-white font-black text-[11px] sm:text-xs flex items-center justify-center shadow-xs border border-amber-700/60 dark:border-amber-500/60">
                {initials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full ring-1 ring-white dark:ring-black" />
            </div>

            {/* Student Name */}
            <span className="font-bold text-xs text-slate-900 dark:text-[#faebd0] group-hover:text-amber-800 dark:group-hover:text-amber-300 truncate max-w-[85px] xs:max-w-[110px] sm:max-w-[140px]">
              {displayName}
            </span>

            {/* Subtle Dropdown Chevron */}
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-500 dark:text-amber-400/80 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-transform duration-200 ${
                dropdownOpen ? 'rotate-180 text-amber-600 dark:text-amber-400' : ''
              }`}
            />
          </button>

          {/* ExamPad Wooden Board Popover Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 sm:w-84 max-h-[min(540px,calc(100vh-4.5rem))] exam-pad-board-dashboard p-1.5 sm:p-2 pt-5 sm:pt-6 rounded-lg shadow-2xl z-50 flex flex-col overflow-visible animate-in fade-in zoom-in-95 duration-150">
              {/* Pushpin at top (overflow-visible ensures pin head is never clipped) */}
              <RedPushpin className="-top-3" />

              {/* Brass Corner Accents */}
              <div className="absolute top-1 left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-amber-500/70 pointer-events-none rounded-tl-xs" />
              <div className="absolute top-1 right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-amber-500/70 pointer-events-none rounded-tr-xs" />
              <div className="absolute bottom-1 left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-amber-500/70 pointer-events-none rounded-bl-xs" />
              <div className="absolute bottom-1 right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-amber-500/70 pointer-events-none rounded-br-xs" />

              {/* Pinned Paper Sheet Container */}
              <div className="pinned-paper-sheet bg-[#fffdfa] dark:bg-[#1a1208] border border-amber-900/30 dark:border-[#422e17] rounded-[3px] flex flex-col max-h-[min(500px,calc(100vh-6rem))] shadow-xs text-slate-800 dark:text-[#faebd0] overflow-hidden">
                {/* 1. FIXED TOP HEADER: Student Details (Permanently visible, never scrolls away or hides) */}
                <div className="shrink-0 px-3.5 py-2.5 border-b border-amber-900/25 dark:border-[#382713] bg-[#fcf8f0] dark:bg-[#20140a] flex items-start gap-2.5 shadow-2xs">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-[2px] bg-amber-600 dark:bg-amber-700 text-white font-black text-sm flex items-center justify-center shadow-xs border border-amber-700/60 dark:border-amber-500/60">
                      {initials}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-1 ring-white dark:ring-black" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-[#faebd0] truncate">
                        {displayName}
                      </h4>
                      {isVerified ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[2px] text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Verified</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[2px] text-[9px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          <AlertCircle className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                          <span>Unverified</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-[#c4a97d] truncate font-mono">{email}</p>
                    {collegeName && (
                      <p className="text-[10px] text-slate-500 dark:text-[#9e835b] truncate flex items-center gap-1 pt-0.5">
                        <School className="w-3 h-3 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>{collegeName}</span>
                      </p>
                    )}
                    {registrationNumber ? (
                      <div className="pt-0.5">
                        <span className="inline-block text-[10px] font-mono font-bold text-amber-900 dark:text-amber-300 bg-amber-100/70 dark:bg-[#2b1f11] border border-amber-300/80 dark:border-[#4d3817] px-1.5 py-0.5 rounded-[2px]">
                          Reg #{registrationNumber}
                        </span>
                      </div>
                    ) : (
                      <div className="pt-0.5">
                        <span className="inline-block text-[10px] font-medium text-slate-500 dark:text-[#a08255] bg-slate-100 dark:bg-[#22160d] border border-slate-200 dark:border-[#382713] px-1.5 py-0.5 rounded-[2px] italic">
                          Reg: Not Set
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. FIXED EDIT PROFILE ACTION */}
                <div className="shrink-0 py-1 px-1.5 border-b border-amber-900/15 dark:border-[#332311] bg-[#fffdfa] dark:bg-[#1a1208]">
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      setIsEditProfileOpen(true);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-[3px] text-xs font-semibold text-slate-800 dark:text-[#faebd0] hover:text-amber-900 dark:hover:text-amber-200 hover:bg-amber-100/70 dark:hover:bg-[#281b0f] transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-[2px] bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                        <UserCog className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-xs text-slate-900 dark:text-[#faebd0] leading-tight">
                          Edit Profile
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-[#a08255] font-normal">
                          {registrationNumber ? `Reg #${registrationNumber}` : 'Update name & registration'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>

                {/* 3. SCROLLABLE NAVIGATION LINKS ONLY (Scrolls smoothly without hiding the top profile) */}
                <div className="flex-1 overflow-y-auto scrollbar-thin">

                {/* Student Portal Navigation */}
                <div className="py-1 px-1.5 space-y-0.5 text-xs">
                  <p className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#9e835b]">
                    Student Portals
                  </p>
                  <Link
                    href={effectiveTenant ? `/${effectiveTenant}/feedback` : '/feedback'}
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-[3px] text-slate-800 dark:text-[#faebd0] hover:text-amber-900 dark:hover:text-amber-200 hover:bg-amber-100/60 dark:hover:bg-[#281b0f] transition-colors font-semibold"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Feedback Forms</span>
                  </Link>
                  <Link
                    href={effectiveTenant ? `/${effectiveTenant}/exams` : '/exams'}
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-[3px] text-slate-800 dark:text-[#faebd0] hover:text-amber-900 dark:hover:text-amber-200 hover:bg-amber-100/60 dark:hover:bg-[#281b0f] transition-colors font-semibold"
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Examination Portal</span>
                  </Link>
                  <Link
                    href={effectiveTenant ? `/${effectiveTenant}/events` : '/events'}
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-[3px] text-slate-800 dark:text-[#faebd0] hover:text-amber-900 dark:hover:text-amber-200 hover:bg-amber-100/60 dark:hover:bg-[#281b0f] transition-colors font-semibold"
                  >
                    <Ticket className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Events &amp; Entry Passes</span>
                  </Link>
                </div>

                {/* Faculty / Administration Login Section */}
                <div className="pt-1 mt-1 border-t border-amber-900/15 dark:border-[#332311] px-1.5">
                  <p className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#9e835b]">
                    Staff &amp; Administration
                  </p>
                  <Link
                    href={targetAdminUrl}
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-[3px] text-xs font-semibold text-slate-800 dark:text-[#faebd0] hover:text-amber-900 dark:hover:text-amber-200 hover:bg-amber-100/60 dark:hover:bg-[#281b0f] transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-[2px] bg-slate-100 dark:bg-[#2b1f11] text-slate-700 dark:text-amber-300 flex items-center justify-center shrink-0 border border-slate-300 dark:border-[#4d3817]">
                        <UserCheck className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="font-bold text-xs text-slate-900 dark:text-[#faebd0] leading-tight">
                          Faculty / Admin Login
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-[#a08255] font-normal">
                          Switch to institutional portal
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>

                {/* Student Leadership: Apply as Event Coordinator */}
                <div className="pt-1 mt-1 border-t border-amber-900/15 dark:border-[#332311] px-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      setIsCoordinatorModalOpen(true);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-[3px] text-xs font-semibold text-amber-950 dark:text-amber-200 bg-amber-100/60 dark:bg-[#291b0e] hover:bg-amber-200/70 dark:hover:bg-[#342211] transition-colors group cursor-pointer border border-amber-300/80 dark:border-amber-800/60"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-[2px] bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <Calendar className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-xs text-amber-950 dark:text-amber-200 leading-tight">
                          Apply as Event Coordinator
                        </p>
                        <p className="text-[10px] text-amber-800/80 dark:text-amber-400/80 font-normal">
                          Organize events &amp; campus programs
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-amber-600 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>

                {/* Account Sign Out Action */}
                <div className="pt-1 mt-1 border-t border-amber-900/15 dark:border-[#332311] px-1.5">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={loggingOut}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[3px] text-xs font-bold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {loggingOut ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                    ) : (
                      <LogOut className="w-3.5 h-3.5 text-rose-600" />
                    )}
                    <span>Sign Out / Logout</span>
                  </button>
                </div>
                </div>
              </div>
            </div>
          )}

          {/* Student Edit Profile Modal Dialog */}
          <StudentEditProfileModal
            isOpen={isEditProfileOpen}
            onClose={() => setIsEditProfileOpen(false)}
            student={student}
            userEmail={email}
            userName={displayName}
            onUpdated={() => {
              refreshSession();
            }}
          />

          {/* Apply as Event Coordinator Modal */}
          <StudentCoordinatorApplyModal
            isOpen={isCoordinatorModalOpen}
            onClose={() => setIsCoordinatorModalOpen(false)}
            student={student}
            userEmail={email}
            userName={displayName}
          />
        </div>
      );
    }

    // NON-COMPACT VIEW (e.g. In Feedback Discovery Banners or Drawer)
    return (
      <div className="exam-pad-board-dashboard rounded-lg p-2 sm:p-2.5 relative overflow-visible shadow-md w-full">
        <RedPushpin className="-top-3" />
        <div className="pinned-paper-sheet bg-[#fffdfa] dark:bg-[#1a1208] border border-amber-900/30 dark:border-[#422e17] rounded-[3px] p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-slate-800 dark:text-[#faebd0]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[2px] bg-amber-600 dark:bg-amber-700 text-white font-black text-sm flex items-center justify-center shadow-xs border border-amber-700/60 dark:border-amber-500/60">
                {initials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-1 ring-white dark:ring-black" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-slate-900 dark:text-[#faebd0] text-xs sm:text-sm truncate">
                  {displayName}
                </span>
                {isVerified ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Verified Student
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    <AlertCircle className="w-3 h-3 text-amber-600" />
                    Email Unverified
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-[#c4a97d] truncate mt-0.5 font-mono">
                {email} {collegeName ? `• ${collegeName}` : ''}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {registrationNumber ? (
                  <span className="text-[10px] font-mono font-bold text-amber-900 dark:text-amber-300 bg-amber-100/70 dark:bg-[#2b1f11] border border-amber-300/80 dark:border-[#4d3817] px-2 py-0.5 rounded-[2px]">
                    Reg #{registrationNumber}
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-800 dark:text-amber-300 bg-amber-100/60 dark:bg-[#2b1f11] border border-amber-300/80 dark:border-[#4d3817] px-2 py-0.5 rounded-[2px] font-semibold">
                    Reg. Number Not Set
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(true)}
                  className="text-[11px] text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Pencil className="w-2.5 h-2.5" />
                  <span>Edit Profile</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0 flex-wrap">
            {!isVerified && (
              <Link
                href={`/auth/student/verify?email=${encodeURIComponent(email)}`}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-[3px] text-xs font-bold transition-colors shadow-2xs"
              >
                Verify Email
              </Link>
            )}
            <button
              type="button"
              onClick={() => setIsCoordinatorModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100/80 hover:bg-amber-200/80 dark:bg-[#2a1c0e] dark:hover:bg-[#382613] text-amber-950 dark:text-amber-200 rounded-[3px] text-xs font-bold border border-amber-300/80 dark:border-amber-800/60 transition-colors shadow-2xs cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Apply as Coordinator</span>
            </button>
            <Link
              href={targetAdminUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#1a1208] hover:bg-slate-100 dark:hover:bg-[#281b0f] text-slate-800 dark:text-[#faebd0] rounded-[3px] text-xs font-semibold border border-slate-300 dark:border-[#4d3817] transition-colors shadow-2xs"
            >
              <UserCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Faculty Login</span>
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={loggingOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#1a1208] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-400 rounded-[3px] text-xs font-bold border border-rose-300 dark:border-rose-900/60 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            >
              {loggingOut ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
              ) : (
                <LogOut className="w-3.5 h-3.5 text-rose-600" />
              )}
              <span>Sign Out</span>
            </button>
          </div>

          <StudentEditProfileModal
            isOpen={isEditProfileOpen}
            onClose={() => setIsEditProfileOpen(false)}
            student={student}
            userEmail={email}
            userName={displayName}
            onUpdated={() => {
              refreshSession();
            }}
          />

          <StudentCoordinatorApplyModal
            isOpen={isCoordinatorModalOpen}
            onClose={() => setIsCoordinatorModalOpen(false)}
            student={student}
            userEmail={email}
            userName={displayName}
          />
        </div>
      </div>
    );
  }

  // ============================================================
  // GUEST (UNAUTHENTICATED) STATE: Sharp ExamPad Login Button
  // ============================================================
  if (compact) {
    return (
      <Link
        href={`/auth/student/login?redirect=${encodeURIComponent(pathname)}`}
        className="inline-flex items-center gap-2 pl-1 pr-3 sm:pr-3.5 py-1 rounded-[3px] bg-[#fffdfa] dark:bg-[#1a1208] hover:bg-amber-50/80 dark:hover:bg-[#25190c] border border-amber-900/30 dark:border-[#4d3817] shadow-2xs transition-all active:scale-98 shrink-0 group select-none"
        title="Sign in with student account"
      >
        <div className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-[2px] bg-amber-500/15 dark:bg-amber-900/30 border border-amber-600/30 flex items-center justify-center text-amber-800 dark:text-amber-300 group-hover:text-amber-950 dark:group-hover:text-amber-100 transition-all shrink-0">
          <User className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-bold text-slate-900 dark:text-[#faebd0] group-hover:text-amber-900 dark:group-hover:text-amber-200 transition-colors">
          <span className="hidden sm:inline">Student </span>Login
        </span>
      </Link>
    );
  }

  return (
    <div className="exam-pad-board-dashboard rounded-lg p-2 sm:p-2.5 relative overflow-visible shadow-md w-full">
      <RedPushpin className="-top-3" />
      <div className="pinned-paper-sheet bg-[#fffdfa] dark:bg-[#1a1208] border border-amber-900/30 dark:border-[#422e17] rounded-[3px] p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-slate-800 dark:text-[#faebd0]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[2px] bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900 dark:text-[#faebd0]">Student Login Required</p>
            <p className="text-[11px] text-slate-600 dark:text-[#c4a97d]">
              Sign in to submit faculty feedback, attempt online tests, and access official event passes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <Link
            href={`/auth/student/signup?redirect=${encodeURIComponent(pathname)}`}
            className="px-3.5 py-1.5 bg-slate-100 dark:bg-[#251a0f] hover:bg-slate-200 dark:hover:bg-[#342211] text-slate-800 dark:text-[#faebd0] rounded-[3px] text-xs font-semibold border border-slate-300 dark:border-[#4d3817] transition-colors"
          >
            Register
          </Link>
          <Link
            href={`/auth/student/login?redirect=${encodeURIComponent(pathname)}`}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-[3px] text-xs font-bold transition-colors shadow-2xs active:scale-98"
          >
            <span>Login</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
