import { notFound } from 'next/navigation';
import Link from 'next/link';
import { resolveTenantOrNotFound } from '@/lib/tenant/resolver';
import { getPublicEventBySlug } from '@/lib/events/service';
import { getPublicProgramBySlug } from '@/lib/events/programs-service';
import { getCurrentEventSession } from '@/lib/events/event-session';
import { PublicTenantNavbar } from '@/components/layout/PublicTenantNavbar';
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

  const event = await getPublicEventBySlug(tenant.collegeId, slug);
  if (!event || event.status !== 'PUBLISHED') notFound();

  const program = await getPublicProgramBySlug(event.id, tenant.collegeId, programSlug);
  if (!program || !program.is_active) notFound();

  const session = await getCurrentEventSession(event.id);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <PublicTenantNavbar tenant={tenant} currentPage="event-detail" />

      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12 flex-1 w-full space-y-6">
        <div className="flex items-center justify-between">
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
        />
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-4xl mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} {tenant.name}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
