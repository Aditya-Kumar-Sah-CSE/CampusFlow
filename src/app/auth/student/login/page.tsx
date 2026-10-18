import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { StudentLoginForm } from '@/components/auth/StudentLoginForm';
import { ArrowLeft, Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Student Sign In | CampusFlow',
  description: 'Sign in to your CampusFlow student account to view and submit institutional feedback forms.',
};

export default function StudentLoginPage() {
  return (
    <div className="min-h-screen bg-slate-950/40 backdrop-blur-xs text-slate-100 flex flex-col justify-between py-6 px-3 sm:px-6 lg:px-8">
      {/* Top Bar with back link */}
      <div className="max-w-md mx-auto w-full flex items-center justify-between text-xs text-slate-400">
        <Link
          href="/feedback"
          className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Feedback Portal</span>
        </Link>
        <span className="text-[11px] font-semibold tracking-wider uppercase text-amber-400">
          Student Sign In
        </span>
      </div>

      <div className="my-auto max-w-md mx-auto w-full">
        {/* Login Form Container */}
        <Suspense
          fallback={
            <div className="bg-white rounded-3xl p-10 text-center space-y-3 shadow-xl">
              <Loader2 className="w-8 h-8 animate-spin text-bce-cobalt mx-auto" />
              <p className="text-xs text-slate-500">Loading student sign-in...</p>
            </div>
          }
        >
          <StudentLoginForm />
        </Suspense>
      </div>

      {/* Footer */}
      <div className="max-w-md mx-auto w-full text-center text-xs text-slate-500 pt-6">
        CampusFlow • Multi-Tenant Feedback System
      </div>
    </div>
  );
}
