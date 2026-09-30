import Link from 'next/link';
import { resolveTenantOrNotFound } from '@/lib/tenant/resolver';
import { getCachedAcademicMasters } from '@/lib/supabase/academic-cache';
import { getPublicActiveFormsAction } from '@/app/feedback/actions';
import { getPublicTenantEvents } from '@/lib/events/service';
import { StudentDiscoveryFlow } from '@/components/public/StudentDiscoveryFlow';
import { AllFeedbackFormsSection } from '@/components/public/AllFeedbackFormsSection';
import { PublicEventCard } from '@/components/events/PublicEventCard';
import { CollegeInstallButton } from '@/components/pwa/CollegeInstallButton';
import { getPwaInstallCount } from '@/lib/pwa/installations';
import { School, UserCheck, ArrowRight, ExternalLink, Ticket, Calendar, FileText } from 'lucide-react';
import type { Branch, AcademicYear, Semester } from '@/types/database';
import type { CollegeEvent } from '@/types/events';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface TenantPageProps {
  params: Promise<{
    tenant: string;
  }>;
  searchParams: Promise<{
    page?: string;
    search?: string;
  }>;
}

export default async function TenantHomePage({ params, searchParams }: TenantPageProps) {
  const { tenant: rawSlug } = await params;
  const tenant = await resolveTenantOrNotFound(rawSlug);

  // Read URL search params for initial page/search state
  const sp = await searchParams;
  const initialPage = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  const initialSearch = (sp.search || '').trim();

  // Fetch only active modules based on persistent settings
  const PAGE_SIZE = 6;
  const [academicData, initialActiveForms, events, pwaInstallCount] = await Promise.all([
    tenant.showFeedbacks
      ? getCachedAcademicMasters(tenant.collegeId)
      : Promise.resolve({ academicYears: [], branches: [], semesters: [] }),
    tenant.showFeedbacks
      ? getPublicActiveFormsAction({ page: initialPage, pageSize: PAGE_SIZE, search: initialSearch || undefined, collegeId: tenant.collegeId })
      : Promise.resolve({ success: true, forms: [], totalCount: 0, totalPages: 0, page: initialPage, pageSize: PAGE_SIZE }),
    tenant.showEvents
      ? getPublicTenantEvents(tenant.collegeId)
      : Promise.resolve([] as CollegeEvent[]),
    getPwaInstallCount(tenant.collegeId),
  ]);

  const { academicYears, branches, semesters } = academicData;
  const hasNeitherModule = !tenant.showFeedbacks && !tenant.showEvents;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white text-[11px] sm:text-xs py-1.5 sm:py-2 px-2.5 sm:px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-1 sm:gap-2 text-center sm:text-left">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="truncate">Feedback Management System (FMS) • {tenant.name}</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 text-slate-300 text-[10px] sm:text-xs">
            {tenant.websiteUrl && (
              <>
                <a
                  href={tenant.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-amber-300 transition-colors flex items-center gap-1"
                >
                  Official Website <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <span>•</span>
              </>
            )}
            <Link href={`/${tenant.slug}/admin/login`} className="hover:text-amber-300 transition-colors flex items-center gap-1 font-medium">
              Admin Portal <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Main Header with Tenant Branding */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-2 sm:py-3.5 flex justify-between items-center gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-white flex items-center justify-center font-bold text-lg sm:text-xl shadow-md border border-slate-200 shrink-0 overflow-hidden p-1">
              {tenant.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tenant.logo}
                  alt={`${tenant.name} Logo`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-slate-900 to-blue-900 rounded-lg flex items-center justify-center text-amber-400">
                  <School className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-xl font-bold tracking-tight text-slate-900 truncate sm:whitespace-normal">
                {tenant.name}
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate sm:whitespace-normal">
                Faculty Feedback & Evaluation Portal ({tenant.shortName})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CollegeInstallButton tenant={tenant} />
            {tenant.showFeedbacks && (
              <Link
                href={`/${tenant.slug}/feedback`}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Browse All Forms</span>
              </Link>
            )}
            {tenant.showEvents && (
              <Link
                href={`/${tenant.slug}/events`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-lg transition-colors"
              >
                <Ticket className="w-3.5 h-3.5 text-blue-600" />
                <span>Events</span>
              </Link>
            )}
            <Link
              href={`/${tenant.slug}/admin/login`}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-medium text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-all shrink-0 active:scale-98"
            >
              <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="hidden sm:inline">Faculty / Admin Login</span>
              <span className="sm:hidden font-semibold">Admin</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-2.5 sm:px-6 lg:px-8 py-4 sm:py-10 space-y-10 sm:space-y-14">
        {/* State: Neither Module Active */}
        {hasNeitherModule && (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-14 text-center max-w-xl mx-auto space-y-4 shadow-sm my-8">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 mx-auto flex items-center justify-center border border-slate-200">
              <School className="w-7 h-7 text-slate-600" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              Welcome to {tenant.name} Portal
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Public feedback and campus event modules are currently inactive for this institution. Please check back later or contact your institution administrator.
            </p>
            <div className="pt-2">
              <Link
                href={`/${tenant.slug}/admin/login`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-slate-800 transition-colors shadow-xs"
              >
                <UserCheck className="w-4 h-4 text-amber-400" />
                <span>Faculty &amp; Admin Sign In</span>
              </Link>
            </div>
          </div>
        )}

        {/* 1. Feedbacks Section (Controlled by Feedbacks Toggle) */}
        {tenant.showFeedbacks && (
          <section id="feedback-section" className="space-y-6 scroll-mt-16">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  Find Your Feedback Form
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Follow the discovery path: Year → Branch → Semester → Faculty &amp; Subject.
                </p>
              </div>
            </div>

            {/* Client-side cascading discovery component */}
            <StudentDiscoveryFlow
              academicYears={(academicYears as AcademicYear[]) || []}
              branches={(branches as Branch[]) || []}
              semesters={(semesters as Semester[]) || []}
              collegeId={tenant.collegeId}
            />

            {/* All Published Forms Grid for this Tenant */}
            <div className="mt-8 sm:mt-12">
              <AllFeedbackFormsSection
                initialData={initialActiveForms}
                collegeId={tenant.collegeId}
                tenantSlug={tenant.slug}
                initialSearch={initialSearch}
              />
            </div>
          </section>
        )}

        {/* 2. Events Section (Controlled by Events Toggle) */}
        {tenant.showEvents && (
          <section id="events-section" className="space-y-6 pt-4 border-t border-slate-200/80 scroll-mt-16">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-1 border border-blue-200/60">
                  <Ticket className="w-3 h-3 text-blue-600" />
                  <span>Campus Activities &amp; Programs</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                  Upcoming College Events
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Explore workshops, hackathons, guest lectures, and cultural fests. Enroll online with instant verification.
                </p>
              </div>
              <Link
                href={`/${tenant.slug}/events`}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors self-start sm:self-auto py-1"
              >
                <span>View All Events ({events.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Events Grid */}
            {events.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-8 sm:p-10 text-center max-w-lg mx-auto space-y-2 shadow-2xs">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">No Events Published</h3>
                <p className="text-xs text-slate-500">
                  There are currently no active public events scheduled for {tenant.shortName}. Please check back later!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {events.slice(0, 6).map((event) => (
                  <PublicEventCard key={event.id} event={event} tenantSlug={tenant.slug} />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-8 sm:mt-12 py-5 sm:py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-2.5 sm:px-4 space-y-2">
          <p className="font-medium text-slate-700">
            {tenant.name} ({tenant.shortName})
          </p>
          <p>
            Multi-Tenant Feedback Management System • Confidential & Anonymous Institutional Feedback
          </p>
          <p className="text-[11px] text-slate-500">PWA Installations: {pwaInstallCount}</p>
          <p className="text-[11px] text-slate-500">
            Designed & Developed by{' '}
            <a
              href="https://portfolio-two-ashen-zseywond41.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
            >
              Aditya Kumar Sah
            </a>
            {' '}•{' '}
            <a
              href="https://portfolio-two-ashen-zseywond41.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-slate-600 hover:underline transition-colors"
            >
              Developer Portfolio
            </a>
            {' '}under the guidance of{' '}
            <a
              href="https://www.bcebhagalpur.ac.in/faculty/abhinav-kumar/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
            >
              Dr. Abhinav Kumar
            </a>
            {' '}(Assistant Professor)
          </p>
          <p className="text-[11px] text-slate-400">
            Powered by FMS Platform • Secure Tenant: <code className="text-slate-600 font-mono">{tenant.slug}</code>
          </p>
        </div>
      </footer>
    </div>
  );
}
