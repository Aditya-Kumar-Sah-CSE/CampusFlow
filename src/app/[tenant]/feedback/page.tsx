import Link from 'next/link';
import { resolveTenantOrNotFound } from '@/lib/tenant/resolver';
import { getCachedAcademicMasters } from '@/lib/supabase/academic-cache';
import { getPublicActiveFormsAction } from '@/app/feedback/actions';
import { StudentDiscoveryFlow } from '@/components/public/StudentDiscoveryFlow';
import { AllFeedbackFormsSection } from '@/components/public/AllFeedbackFormsSection';
import { getPwaInstallCount } from '@/lib/pwa/installations';
import { GraduationCap, ArrowLeft } from 'lucide-react';
import { PublicTenantNavbar } from '@/components/layout/PublicTenantNavbar';
import type { AcademicYear, Branch, Semester } from '@/types/database';
import { getCampusFlowBrand } from '@/lib/tenant/campusflow-brand';

export const dynamic = 'force-dynamic';

interface TenantFeedbackPageProps {
  params: Promise<{
    tenant: string;
  }>;
  searchParams: Promise<{
    page?: string;
    search?: string;
  }>;
}

export default async function TenantFeedbackPortalPage({ params, searchParams }: TenantFeedbackPageProps) {
  const { tenant: rawSlug } = await params;
  const tenant = await resolveTenantOrNotFound(rawSlug);

  // Read URL search params for initial page/search state
  const sp = await searchParams;
  const initialPage = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  const initialSearch = (sp.search || '').trim();

  // Fetch tenant-scoped academic masters and active forms
  const PAGE_SIZE = 6;
  const [{ academicYears, branches, semesters }, initialActiveForms, pwaInstallCount] = await Promise.all([
    getCachedAcademicMasters(tenant.collegeId),
    getPublicActiveFormsAction({ page: initialPage, pageSize: PAGE_SIZE, search: initialSearch || undefined, collegeId: tenant.collegeId }),
    getPwaInstallCount(tenant.collegeId),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white text-[11px] sm:text-xs py-1.5 sm:py-2 px-3 sm:px-4 border-b border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-1 sm:gap-2 text-center sm:text-left">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="truncate">{getCampusFlowBrand(tenant).displayName} · {tenant.name}</span>
          </div>
          <Link
            href={`/${tenant.slug}`}
            className="text-slate-300 hover:text-white flex items-center gap-1 text-[10px] sm:text-xs shrink-0"
          >
            <ArrowLeft className="w-3 h-3" /> {tenant.shortName} Home
          </Link>
        </div>
      </div>

      {/* Main Responsive Header with Tenant Branding & Mobile Drawer */}
      <PublicTenantNavbar tenant={tenant} currentPage="feedback" />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-2.5 sm:px-6 lg:px-8 py-3.5 sm:py-8 space-y-4 sm:space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-2">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Student Feedback Portal</span>
          </div>
          <h2 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Find & Submit Your Faculty Feedback
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Select your academic session, department, semester, faculty member, and subject below to access your real Google Feedback Form for {tenant.shortName}.
          </p>
        </div>

        <StudentDiscoveryFlow
          academicYears={(academicYears as AcademicYear[]) || []}
          branches={(branches as Branch[]) || []}
          semesters={(semesters as Semester[]) || []}
          collegeId={tenant.collegeId}
        />

        {/* All Currently Active Feedback Forms Section for this Tenant */}
        <AllFeedbackFormsSection initialData={initialActiveForms} collegeId={tenant.collegeId} tenantSlug={tenant.slug} initialSearch={initialSearch} />
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-4 px-2.5 sm:px-4 sm:py-6 border-t border-slate-800 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-center sm:text-left">
          <div>
            <span>{tenant.name} ({tenant.shortName}) • Official Student Evaluation Portal</span>
            <div className="text-[11px] text-slate-400 mt-1">
              Designed & Developed by{' '}
              <a
                href="https://portfolio-two-ashen-zseywond41.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:underline font-medium"
              >
                Aditya Kumar Sah
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
                Dr. Abhinav Kumar
              </a>
              {' '}(Assistant Professor)
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span>PWA Installations: {pwaInstallCount}</span>
            <Link href={`/${tenant.slug}`} className="text-slate-300 hover:text-white transition-colors">
              Portal Home
            </Link>
            <span className="text-slate-600">•</span>
            <Link href={`/${tenant.slug}/admin/login`} className="text-amber-400 hover:underline">
              Admin Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
