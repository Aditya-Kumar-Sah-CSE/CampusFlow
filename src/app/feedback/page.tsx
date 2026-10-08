import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { StudentDiscoveryFlow } from '@/components/public/StudentDiscoveryFlow';
import { AllFeedbackFormsSection } from '@/components/public/AllFeedbackFormsSection';
import { getPublicActiveFormsAction } from '@/app/feedback/actions';
import { School, ArrowLeft, GraduationCap, ExternalLink } from 'lucide-react';

import type { AcademicYear, Branch, Semester } from '@/types/database';

import type { Metadata } from 'next';
import { getCampusFlowBrand, getCampusFlowDescription } from '@/lib/tenant/campusflow-brand';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/supabase/env';

export const revalidate = 300;

const publicClient = createSupabaseClient(getSupabaseUrl(), getSupabaseAnonKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: getCampusFlowBrand().displayName,
    description: getCampusFlowDescription(),
    openGraph: { title: getCampusFlowBrand().displayName },
    twitter: { title: getCampusFlowBrand().displayName },
  };
}

export default async function FeedbackPortalPage() {
  const supabase = publicClient;
  const collegeQuery = supabase
    .from('colleges')
    .select('id, name, code, slug, logo_url, website_url')
    .eq('is_active', true)
    .order('name', { ascending: true });

  // Fetch active academic masters, initial active forms, and active college branding
  const [
    { data: academicYears },
    { data: branches },
    { data: semesters },
    initialActiveForms,
    { data: activeColleges },
  ] = await Promise.all([
    supabase.from('academic_years').select('id, name, is_active').eq('is_active', true).order('name', { ascending: false }),
    supabase.from('branches').select('id, name, code, is_active').eq('is_active', true).order('name', { ascending: true }),
    supabase.from('semesters').select('id, name, year_number, semester_number, is_active').eq('is_active', true).order('semester_number', { ascending: true }),
    getPublicActiveFormsAction({ page: 1, pageSize: 6 }),
    collegeQuery.limit(1),
  ]);

  const activeCollege = activeColleges && activeColleges.length > 0 ? activeColleges[0] : null;
  const collegeLogo = activeCollege?.logo_url || null;
  const collegeName = activeCollege?.name || 'College';
  const collegeCode = activeCollege?.code || null;
  const brand = getCampusFlowBrand({ code: collegeCode });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Banner */}
      <div className="bg-bce-navy text-white text-[11px] sm:text-xs py-1.5 sm:py-2 px-3 sm:px-4 border-b border-bce-cobalt/40">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-1 sm:gap-2 text-center sm:text-left">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="truncate">Government of Bihar | Department of Science, Technology & Technical Education</span>
          </div>
          <Link href={activeCollege ? `/${activeCollege.slug}` : '/'} className="text-slate-300 hover:text-white flex items-center gap-1 text-[10px] sm:text-xs shrink-0">
            <ArrowLeft className="w-3 h-3" /> {collegeCode ? `${collegeCode} Home` : 'Portal Home'}
          </Link>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-2.5 sm:px-6 lg:px-8 h-14 sm:h-16 flex justify-between items-center gap-2">
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white flex items-center justify-center font-bold text-base sm:text-lg shadow-xs border border-slate-200 shrink-0 overflow-hidden p-1">
              {collegeLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={collegeLogo}
                  alt={`${collegeName} Logo`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-bce-navy to-bce-cobalt rounded-lg flex items-center justify-center text-amber-400">
                  <School className="w-5 h-5 text-amber-400" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-base font-bold tracking-tight text-bce-navy truncate max-w-[170px] xs:max-w-[220px] sm:max-w-none">
                {brand.displayName}
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate max-w-[170px] xs:max-w-[220px] sm:max-w-none">
                Student Feedback Portal
              </p>
            </div>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-2.5 sm:px-6 lg:px-8 py-3.5 sm:py-8 space-y-4 sm:space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-bce-cobalt text-xs font-semibold mb-2">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Student Feedback Portal</span>
          </div>
          <h2 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Find & Submit Your Faculty Feedback
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Select your academic session, department, semester, faculty member, and subject below to access your real Google Feedback Form.
          </p>
        </div>

        <StudentDiscoveryFlow
          academicYears={(academicYears as AcademicYear[]) || []}
          branches={(branches as Branch[]) || []}
          semesters={(semesters as Semester[]) || []}
        />

        {/* All Currently Active Feedback Forms Section */}
        <AllFeedbackFormsSection initialData={initialActiveForms} />
      </main>

      {/* Footer */}
      <footer className="bg-bce-navy text-slate-400 text-xs py-4 px-2.5 sm:px-4 sm:py-6 border-t border-bce-cobalt/30 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-center sm:text-left">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              {activeCollege?.website_url ? (
                <a
                  href={activeCollege.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-slate-200 hover:text-amber-400 hover:underline inline-flex items-center gap-1 transition-colors"
                  title={`Visit Official Website of ${collegeName}`}
                >
                  <span>{collegeName}</span>
                  <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                </a>
              ) : (
                <span className="font-bold text-slate-200">{collegeName}</span>
              )}
              <span>· {brand.displayName} · Official Student Evaluation Portal</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              <Link
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-slate-200 hover:text-amber-300 hover:underline transition-colors"
                title="Open CampusFlow Main Website"
              >
                CampusFlow
              </Link>
              {' '}• Designed and developed by{' '}
              <a
                href="https://portfolio-two-ashen-zseywond41.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:underline font-medium"
              >
                Mr. Aditya Kumar Sah
              </a>
              {' '}•{' '}
              <a
                href="https://portfolio-two-ashen-zseywond41.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-slate-200 hover:underline transition-colors"
              >
                Developer Portfolio
              </a>
              {' '}under the guidance of{' '}
              <a
                href="https://www.bcebhagalpur.ac.in/faculty/abhinav-kumar/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:underline font-medium"
              >
                Dr. Avinav
              </a>
              {' '}(Assistant Professor)
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-300 hover:text-white transition-colors">
              Platform Home
            </Link>
            <span className="text-slate-600">•</span>
            <Link href="/admin/login" className="text-amber-400 hover:underline">
              Admin Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
