import { notFound } from 'next/navigation';
import Link from 'next/link';
import { resolveTenantOrNotFound } from '@/lib/tenant/resolver';
import { getPublicEventBySlug } from '@/lib/events/service';
import { getCachedAcademicMasters } from '@/lib/supabase/academic-cache';
import { getPublicEventPrograms } from '@/lib/events/programs-service';
import { getPublicEventParticipants } from '@/lib/events/program-registrations-service';
import { getCurrentEventSession } from '@/lib/events/event-session';
import { getSmallEventById } from '@/config/events';
import { SmallEventDetailView } from '@/components/events/SmallEventDetailView';
import { EventStudentIdentityCard } from '@/components/events/EventStudentIdentityCard';
import { PublicEventDetailClient } from '@/components/events/PublicEventDetailClient';
import { ProgramCategorySection } from '@/components/events/programs/ProgramCategorySection';
import { PublicParticipantsList } from '@/components/events/programs/PublicParticipantsList';
import { PublicTenantNavbar } from '@/components/layout/PublicTenantNavbar';
import { CollegePublicFooter } from '@/components/layout/CollegePublicFooter';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{
    tenant: string;
    slug: string;
  }>;
}

export default async function PublicEventDetailPage({ params }: Props) {
  const { tenant: rawSlug, slug } = await params;
  const tenant = await resolveTenantOrNotFound(rawSlug);

  // 1. Check for Config-Driven Small Event (Google Forms registration)
  const smallEvent = getSmallEventById(slug, tenant.slug);
  if (smallEvent) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
        {/* Top Banner */}
        <div className="bg-slate-900 text-white text-[11px] sm:text-xs py-1.5 sm:py-2 px-3 sm:px-4 border-b border-slate-800">
          <div className="max-w-5xl mx-auto flex justify-between items-center">
            <span>{tenant.name} &bull; Event Portal</span>
            <Link
              href={`/${tenant.slug}/events`}
              className="text-slate-300 hover:text-white flex items-center gap-1 text-[11px]"
            >
              <ArrowLeft className="w-3 h-3" /> All Events
            </Link>
          </div>
        </div>

        {/* Navbar */}
        <PublicTenantNavbar tenant={tenant} currentPage="events" />

        {/* Small Event Details */}
        <main className="flex-1">
          <SmallEventDetailView
            event={smallEvent}
            tenantSlug={tenant.slug}
            institutionDisplayName={tenant.name}
            backHref={`/${tenant.slug}/events`}
          />
        </main>

        {/* Footer */}
        <CollegePublicFooter
          collegeName={tenant.name}
          collegeShortName={tenant.shortName}
          collegeSlug={tenant.slug}
          websiteUrl={tenant.websiteUrl}
          variant="light"
          className="mt-12"
        />
      </div>
    );
  }

  // 2. Fallback to Database Events if existing
  const [event, academic] = await Promise.all([
    getPublicEventBySlug(tenant.collegeId, slug),
    getCachedAcademicMasters(tenant.collegeId),
  ]);

  if (!event || event.status === 'DRAFT') {
    notFound();
  }

  // Fetch programs, public participants, and student session in parallel
  const [programData, publicParticipants, session] = await Promise.all([
    getPublicEventPrograms(event.id, tenant.collegeId),
    getPublicEventParticipants(event.id, tenant.collegeId),
    getCurrentEventSession(event.id),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white text-[11px] sm:text-xs py-1.5 sm:py-2 px-3 sm:px-4 border-b border-slate-800">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <span>{tenant.name} &bull; Event Portal</span>
          <Link
            href={`/${tenant.slug}/events`}
            className="text-slate-300 hover:text-white flex items-center gap-1 text-[11px]"
          >
            <ArrowLeft className="w-3 h-3" /> All Events
          </Link>
        </div>
      </div>

      {/* Main Responsive Header with Tenant Branding & Mobile Drawer */}
      <PublicTenantNavbar tenant={tenant} currentPage="event-detail" />

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-10 flex-1 w-full space-y-6 sm:space-y-10">
        <PublicEventDetailClient
          event={event}
          tenant={tenant}
          branches={academic.branches}
          semesters={academic.semesters}
        />

        {/* Student Event Identity / Verification Section (Only needed for internal multi-program registration) */}
        {event.registration_type !== 'google_form' && (
          <section id="identity">
            <EventStudentIdentityCard
              event={event}
              initialSession={session}
              tenantSlug={tenant.slug}
              collegeLogoUrl={tenant.logo}
              collegeName={tenant.name}
            />
          </section>
        )}

        {/* Programs Section */}
        {programData.categories.length > 0 && (
          <section id="programs">
            <ProgramCategorySection
              event={event}
              tenant={tenant}
              categories={programData.categories}
            />
          </section>
        )}

        {/* Public Participants */}
        {publicParticipants.length > 0 && (
          <PublicParticipantsList programGroups={publicParticipants} />
        )}
      </main>

      {/* Footer */}
      <CollegePublicFooter
        collegeName={tenant.name}
        collegeShortName={tenant.shortName}
        collegeSlug={tenant.slug}
        websiteUrl={tenant.websiteUrl}
        variant="light"
        className="mt-12"
      />
    </div>
  );
}
