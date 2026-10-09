import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { StudentSignupForm } from '@/components/auth/StudentSignupForm';
import { School, GraduationCap, ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Student Registration | CampusFlow',
  description: 'Create your universal student account on CampusFlow to participate in college feedback and evaluations.',
};

export default function StudentSignupPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-100 flex flex-col justify-between py-6 px-3 sm:px-6 lg:px-8">
      {/* Top Bar with back link */}
      <div className="max-w-lg mx-auto w-full flex items-center justify-between text-xs text-slate-400">
        <Link
          href="/feedback"
          className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Feedback Portal</span>
        </Link>
        <span className="text-[11px] font-semibold tracking-wider uppercase text-amber-400">
          Official Student Registration
        </span>
      </div>

      <div className="my-auto max-w-lg mx-auto w-full space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-bce-cobalt to-indigo-500 p-0.5 shadow-xl flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-2xl flex items-center justify-center">
              <GraduationCap className="w-6 h-6 sm:w-7 sm:h-7 text-amber-400" />
            </div>
          </div>

          <div className="pt-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 mb-2">
              <ShieldCheck className="w-3 h-3" /> One Account • All Feedback Forms
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Student Registration
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
              Create your account once to submit feedback across all eligible forms without re-registering.
            </p>
          </div>
        </div>

        {/* Signup Form Container */}
        <Suspense
          fallback={
            <div className="bg-white rounded-3xl p-10 text-center space-y-3 shadow-xl">
              <Loader2 className="w-8 h-8 animate-spin text-bce-cobalt mx-auto" />
              <p className="text-xs text-slate-500">Loading student registration form...</p>
            </div>
          }
        >
          <StudentSignupForm />
        </Suspense>
      </div>

      {/* Footer */}
      <div className="max-w-lg mx-auto w-full text-center text-xs text-slate-500 pt-6">
        CampusFlow Multi-Tenant Portal • Department of Science, Technology & Technical Education
      </div>
    </div>
  );
}
