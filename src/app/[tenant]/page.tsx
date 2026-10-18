import Link from 'next/link';
import { resolveTenantOrNotFound } from '@/lib/tenant/resolver';
import { getCachedAcademicMasters } from '@/lib/supabase/academic-cache';
import { getPublicActiveFormsAction } from '@/app/feedback/actions';
import { getPublicTenantEvents } from '@/lib/events/service';
import { StudentDiscoveryFlow } from '@/components/public/StudentDiscoveryFlow';
import { AllFeedbackFormsSection } from '@/components/public/AllFeedbackFormsSection';
import { PublicEventCard } from '@/components/events/PublicEventCard';
import { getPwaInstallCount } from '@/lib/pwa/installations';
import { School, UserCheck, ArrowRight, ExternalLink, Ticket, Calendar, BookOpen } from 'lucide-react';
import { PublicTenantNavbar } from '@/components/layout/PublicTenantNavbar';
import { CollegePublicFooter } from '@/components/layout/CollegePublicFooter';
import type { Branch, AcademicYear, Semester } from '@/types/database';
import type { CollegeEvent } from '@/types/events';
import { getCampusFlowBrand } from '@/lib/tenant/campusflow-brand';
import { getLibrarySettings } from '@/lib/library/service';
import { StudentLibraryBorrowForm } from '@/components/public/StudentLibraryBorrowForm';
import { RedPushpin } from '@/components/ui/RedPushpin';

export const revalidate = 300;

interface TenantPageProps {
  params: Promise<{
    tenant: string;
  }>;
}

export default async function TenantHomePage({ params }: TenantPageProps) {
  const { tenant: rawSlug } = await params;
  const t0 = performance.now();
  const tenant = await resolveTenantOrNotFound(rawSlug);
  const tTenant = (performance.now() - t0).toFixed(1);
  console.log(`[PERF] route=/[tenant] op=tenant_lookup duration_ms=${tTenant} success=true`);

  // Default page 1 for static/ISR pre-rendering; client-side component manages interactive pagination
  const initialPage = 1;
  const initialSearch = '';

  // Fetch only active modules based on persistent settings
  const PAGE_SIZE = 6;
  const t1 = performance.now();
  const [academicData, initialActiveForms, events, pwaInstallCount, librarySettings] = await Promise.all([
    tenant.showFeedbacks
      ? getCachedAcademicMasters(tenant.collegeId)
      : Promise.resolve({ academicYears: [], branches: [], semesters: [] }),
    tenant.showFeedbacks
      ? getPublicActiveFormsAction({ page: initialPage, pageSize: PAGE_SIZE, collegeId: tenant.collegeId })
      : Promise.resolve({ success: true, forms: [], totalCount: 0, totalPages: 0, page: initialPage, pageSize: PAGE_SIZE }),
    tenant.showEvents
      ? getPublicTenantEvents(tenant.collegeId)
      : Promise.resolve([] as CollegeEvent[]),
    getPwaInstallCount(tenant.collegeId),
    getLibrarySettings(tenant.collegeId).catch(() => null),
  ]);
  const tData = (performance.now() - t1).toFixed(1);
  console.log(`[PERF] route=/[tenant] op=parallel_data_queries duration_ms=${tData} success=true`);

  const { academicYears, branches, semesters } = academicData;
  const hasNeitherModule = !tenant.showFeedbacks && !tenant.showEvents && !librarySettings?.isEnabled;
  const brand = getCampusFlowBrand(tenant);
  const isLibraryEnabled = librarySettings?.isEnabled ?? false;

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {/* Top Banner */}
      <div className="bg-slate-900 dark:bg-[#120b07]/95 text-white text-[11px] sm:text-xs py-1.5 sm:py-2 px-2.5 sm:px-4 border-b border-slate-800 dark:border-amber-950/60">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-1 sm:gap-2 text-center sm:text-left">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="truncate">{brand.displayName} · {tenant.name}</span>
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

      {/* Main Responsive Header with Tenant Branding & Mobile Drawer */}
      <PublicTenantNavbar tenant={tenant} currentPage="home" />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-2.5 sm:px-6 lg:px-8 py-4 sm:py-10 space-y-10 sm:space-y-14">
        {/* State: Neither Module Active */}
        {hasNeitherModule && (
          <div className="bg-white dark:bg-[#111724] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-8 sm:p-14 text-center max-w-xl mx-auto space-y-4 shadow-sm my-8">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 mx-auto flex items-center justify-center border border-slate-200 dark:border-slate-700">
              <School className="w-7 h-7 text-slate-600 dark:text-slate-300" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              Welcome to {tenant.name} Portal
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Public feedback and campus event modules are currently inactive for this institution. Please check back later or contact your institution administrator.
            </p>
            <div className="pt-2">
              <Link
                href={`/${tenant.slug}/admin/login`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-amber-600 hover:bg-slate-800 dark:hover:bg-amber-500 text-white dark:text-slate-950 rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-xs"
              >
                <UserCheck className="w-4 h-4 text-amber-400 dark:text-slate-950" />
                <span>Faculty &amp; Admin Sign In</span>
              </Link>
            </div>
          </div>
        )}

        {/* 1. Feedbacks Section (Controlled by Feedbacks Toggle) */}
        {tenant.showFeedbacks && (
          <section id="feedback-section" className="space-y-6 scroll-mt-16">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-white/85 dark:bg-[#18110b]/85 backdrop-blur-md border border-slate-200/80 dark:border-amber-950/70 shadow-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                  Find Your Feedback Form
                </h2>
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

        {/* 2. Events Section (Inside Green Chalkboard Notice Board) */}
        {tenant.showEvents && (
          <section id="events-section" className="scroll-mt-16 pt-4">
            <div className="border-8 sm:border-[12px] border-[#38210f] dark:border-[#201105] rounded-xl shadow-2xl p-4 sm:p-6 bg-[#143527] dark:bg-[#091a13] relative overflow-visible">
              {/* Brass Corner Brackets */}
              <div className="absolute top-1 left-1 w-4 h-4 border-t-2 border-l-2 border-amber-400/80 pointer-events-none rounded-tl-xs" />
              <div className="absolute top-1 right-1 w-4 h-4 border-t-2 border-r-2 border-amber-400/80 pointer-events-none rounded-tr-xs" />
              <div className="absolute bottom-1 left-1 w-4 h-4 border-b-2 border-l-2 border-amber-400/80 pointer-events-none rounded-bl-xs" />
              <div className="absolute bottom-1 right-1 w-4 h-4 border-b-2 border-r-2 border-amber-400/80 pointer-events-none rounded-br-xs" />

              {/* Notice Board Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 mb-5 border-b border-dashed border-emerald-900/60 dark:border-emerald-950/60">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[3px] bg-emerald-950/80 text-emerald-300 text-xs font-bold mb-1 border border-emerald-600/40">
                    <Ticket className="w-3.5 h-3.5 text-amber-300" />
                    <span>CAMPUS ACTIVITIES &amp; EVENTS BULLETIN</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-amber-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
                    Upcoming College Events
                  </h2>
                  <p className="text-xs sm:text-sm text-emerald-200/80 font-medium">
                    Explore workshops, hackathons, guest lectures, and cultural fests. Enroll online with instant verification.
                  </p>
                </div>
                <Link
                  href={`/${tenant.slug}/events`}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-amber-300 hover:text-amber-200 transition-colors self-start sm:self-auto py-1 px-3 rounded-[3px] bg-emerald-950/60 border border-emerald-600/30"
                >
                  <span>View All Events ({events.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Events Grid */}
              {events.length === 0 ? (
                <div className="relative max-w-md mx-auto pinned-paper-sheet bg-[#fffdfa] dark:bg-[#191108] border border-amber-900/30 dark:border-[#422e17] rounded-[3px] p-8 sm:p-10 text-center shadow-2xl">
                  <RedPushpin className="-top-3" />
                  <Calendar className="w-10 h-10 text-amber-700/60 dark:text-amber-400/60 mx-auto mb-2" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-[#faebd0]">No Events Published</h3>
                  <p className="text-xs text-slate-600 dark:text-[#c4a97d] mt-1">
                    There are currently no active public events scheduled for {tenant.shortName}. Please check back later!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                  {events.slice(0, 6).map((event: CollegeEvent) => (
                    <PublicEventCard key={event.id} event={event} tenantSlug={tenant.slug} />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* 3. Library Section */}
        {isLibraryEnabled && (
          <section id="library-section" className="space-y-6 pt-6 border-t border-slate-200/80 dark:border-amber-950/40 scroll-mt-16">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-xs font-semibold mb-1 border border-purple-200/60 dark:border-purple-800">
                  <BookOpen className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                  <span>Campus Library</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600 dark:bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                  Borrow a Book
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-amber-100/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] font-medium">
                  Browse available books and submit a borrow request. Admin approval required.
                </p>
              </div>
            </div>

            <StudentLibraryBorrowForm
              collegeId={tenant.collegeId}
              collegeName={tenant.name}
              collegeLogoUrl={tenant.logo}
              collegeSlug={tenant.slug}
            />
          </section>
        )}
      </main>

      {/* Footer */}
      <CollegePublicFooter
        collegeName={tenant.name}
        collegeShortName={tenant.shortName}
        collegeSlug={tenant.slug}
        websiteUrl={tenant.websiteUrl}
        pwaInstallCount={pwaInstallCount}
        variant="light"
        className="mt-8 sm:mt-12"
      />
    </div>
  );
}
