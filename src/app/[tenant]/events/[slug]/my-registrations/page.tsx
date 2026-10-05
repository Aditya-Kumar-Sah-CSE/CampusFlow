import { notFound } from 'next/navigation';
import Link from 'next/link';
import { resolveTenantOrNotFound } from '@/lib/tenant/resolver';
import { getPublicEventBySlug } from '@/lib/events/service';
import { getCurrentEventSession } from '@/lib/events/event-session';
import { getStudentRegistrationsAction } from '@/app/admin/events/event-registration-actions';
import { PublicTenantNavbar } from '@/components/layout/PublicTenantNavbar';
import { CollegePublicFooter } from '@/components/layout/CollegePublicFooter';
import { StudentMyRegistrationsClient } from '@/components/events/StudentMyRegistrationsClient';
import { ArrowLeft, UserCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{
    tenant: string;
    slug: string;
  }>;
}

export default async function TenantStudentMyRegistrationsPage({ params }: Props) {
  const { tenant: rawSlug, slug } = await params;
  const tenant = await resolveTenantOrNotFound(rawSlug);

  const event = await getPublicEventBySlug(tenant.collegeId, slug);
  if (!event || event.status !== 'PUBLISHED') notFound();

  const session = await getCurrentEventSession(event.id);
  let initialPrograms: any[] = [];

  if (session) {
    const regRes = await getStudentRegistrationsAction(event.id);
    if (regRes.success && regRes.programs) {
      initialPrograms = regRes.programs;
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <PublicTenantNavbar tenant={tenant} currentPage="event-detail" />

      <main className="max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-10 flex-1 w-full space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href={`/${tenant.slug}/events/${event.slug}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {event.title}</span>
          </Link>

          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-blue-600" /> Student Portal
          </span>
        </div>

        <StudentMyRegistrationsClient
          event={event}
          initialSession={session}
          initialPrograms={initialPrograms}
          collegeLogoUrl={tenant.logo}
          collegeName={tenant.name}
          tenantSlug={tenant.slug}
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
