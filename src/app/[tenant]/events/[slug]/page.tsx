import { notFound } from 'next/navigation';
import Link from 'next/link';
import { resolveTenantOrNotFound } from '@/lib/tenant/resolver';
import { getPublicEventBySlug } from '@/lib/events/service';
import { getCachedAcademicMasters } from '@/lib/supabase/academic-cache';
import { getPublicEventPrograms } from '@/lib/events/programs-service';
import { getPublicEventParticipants } from '@/lib/events/program-registrations-service';
import { PublicEventDetailClient } from '@/components/events/PublicEventDetailClient';
import { ProgramCategorySection } from '@/components/events/programs/ProgramCategorySection';
import { PublicParticipantsList } from '@/components/events/programs/PublicParticipantsList';
import { PublicTenantNavbar } from '@/components/layout/PublicTenantNavbar';
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

  const [event, academic] = await Promise.all([
    getPublicEventBySlug(tenant.collegeId, slug),
    getCachedAcademicMasters(tenant.collegeId),
  ]);

  if (!event || event.status === 'DRAFT') {
    notFound();
  }

  // Fetch programs and public participants in parallel
  const [programData, publicParticipants] = await Promise.all([
    getPublicEventPrograms(event.id, tenant.collegeId),
    getPublicEventParticipants(event.id, tenant.collegeId),
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
      <main className="max-w-5xl mx-auto px-4 py-8 sm:py-10 flex-1 w-full space-y-10">
        <PublicEventDetailClient
          event={event}
          tenant={tenant}
          branches={academic.branches}
          semesters={academic.semesters}
        />

        {/* Programs Section */}
        {programData.categories.length > 0 && (
          <ProgramCategorySection
            event={event}
            tenant={tenant}
            categories={programData.categories}
          />
        )}

        {/* Public Participants */}
        {publicParticipants.length > 0 && (
          <PublicParticipantsList programGroups={publicParticipants} />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-5xl mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} {tenant.name}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
