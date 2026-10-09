'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppRouter as useRouter } from '@/lib/hooks/use-app-router';
import { User, LogOut, CheckCircle2, AlertCircle, School, GraduationCap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { studentSignOutAction } from '@/app/auth/student/actions';

interface StudentInfo {
  name: string;
  email: string;
  collegeName?: string;
  collegeSlug?: string;
  isVerified: boolean;
}

export function StudentStatusBadge({ compact = false }: { compact?: boolean }) {
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.user_metadata?.role === 'STUDENT') {
          setStudent({
            name: user.user_metadata?.name || user.email?.split('@')[0] || 'Student',
            email: user.email || '',
            collegeName: user.user_metadata?.college_name || 'College',
            collegeSlug: user.user_metadata?.college_slug,
            isVerified: Boolean(user.email_confirmed_at || user.user_metadata?.email_verified),
          });
        } else {
          setStudent(null);
        }
      } catch (err) {
        setStudent(null);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [pathname, supabase]);

  const handleSignOut = async () => {
    await studentSignOutAction();
    await supabase.auth.signOut();
    setStudent(null);
    router.refresh();
  };

  if (loading) return null;

  if (student) {
    if (compact) {
      return (
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-bce-cobalt font-semibold border border-blue-200/80">
            <GraduationCap className="w-3.5 h-3.5 text-bce-cobalt" />
            <span className="truncate max-w-[120px]">{student.name}</span>
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            title="Sign out of student account"
            className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    return (
      <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-slate-50 border border-blue-200/80 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-bce-cobalt text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
            <GraduationCap className="w-5 h-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                {student.name}
              </span>
              {student.isVerified ? (
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
              {student.email} • {student.collegeName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          {!student.isVerified && (
            <Link
              href={`/auth/student/verify?email=${encodeURIComponent(student.email)}`}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-colors"
            >
              Verify Email
            </Link>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 hover:text-red-600 rounded-lg text-xs font-semibold border border-slate-200 transition-colors shadow-2xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  // Not logged in
  if (compact) {
    return (
      <Link
        href={`/auth/student/login?redirect=${encodeURIComponent(pathname)}`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-bce-cobalt bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors shrink-0"
      >
        <GraduationCap className="w-3.5 h-3.5" />
        <span>Student Sign In</span>
      </Link>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
          <User className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-900">
            Student Authentication Required
          </p>
          <p className="text-[11px] text-slate-500">
            Sign in once to submit official course feedback across all eligible forms.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        <Link
          href={`/auth/student/signup?redirect=${encodeURIComponent(pathname)}`}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold border border-slate-200 transition-colors"
        >
          Register
        </Link>
        <Link
          href={`/auth/student/login?redirect=${encodeURIComponent(pathname)}`}
          className="px-3.5 py-1.5 bg-bce-cobalt hover:bg-bce-navy text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
}
