import { notFound } from 'next/navigation';
import Link from 'next/link';
import { resolveTenantOrNotFound } from '@/lib/tenant/resolver';
import { getPublicEventBySlug } from '@/lib/events/service';
import { getPublicProgramBySlug } from '@/lib/events/programs-service';
import { getCurrentEventSession } from '@/lib/events/event-session';
import { getCachedAcademicMasters } from '@/lib/supabase/academic-cache';
import { PublicTenantNavbar } from '@/components/layout/PublicTenantNavbar';
import { CollegePublicFooter } from '@/components/layout/CollegePublicFooter';
import { ProgramRegistrationClient } from '@/components/events/programs/ProgramRegistrationClient';
import { ArrowLeft, Ticket } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{
    tenant: string;
    slug: string;
    programSlug: string;
  }>;
}

export default async function TenantProgramRegisterPage({ params }: Props) {
  const { tenant: rawSlug, slug, programSlug } = await params;
  const tenant = await resolveTenantOrNotFound(rawSlug);

  const [event, academic] = await Promise.all([
    getPublicEventBySlug(tenant.collegeId, slug),
    getCachedAcademicMasters(tenant.collegeId),
  ]);
  if (!event || event.status !== 'PUBLISHED') notFound();

  const program = await getPublicProgramBySlug(event.id, tenant.collegeId, programSlug);
  if (!program || !program.is_active) notFound();

  const session = await getCurrentEventSession(event.id);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <PublicTenantNavbar tenant={tenant} currentPage="event-detail" />

      <main className="max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-10 flex-1 w-full space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href={`/${tenant.slug}/events/${event.slug}/${program.slug}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {program.name}</span>
          </Link>

          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Ticket className="w-3.5 h-3.5 text-blue-600" /> Program Registration
          </span>
        </div>

        <ProgramRegistrationClient
          event={event}
          program={program}
          initialSession={session}
          tenantSlug={tenant.slug}
          branches={academic.branches}
          semesters={academic.semesters}
        />
      </main>

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
