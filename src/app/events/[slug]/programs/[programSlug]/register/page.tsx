import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPublicEventBySlugGlobal } from '@/lib/events/service';
import { getPublicProgramBySlug } from '@/lib/events/programs-service';
import { getCurrentEventSession } from '@/lib/events/event-session';
import { getCachedAcademicMasters } from '@/lib/supabase/academic-cache';
import { RootPublicNavbar } from '@/components/layout/RootPublicNavbar';
import { ProgramRegistrationClient } from '@/components/events/programs/ProgramRegistrationClient';
import { CollegePublicFooter } from '@/components/layout/CollegePublicFooter';
import { ArrowLeft, Ticket } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{
    slug: string;
    programSlug: string;
  }>;
}

export default async function ProgramRegisterPage({ params }: Props) {
  const { slug, programSlug } = await params;
  const event = await getPublicEventBySlugGlobal(slug);
  if (!event || event.status !== 'PUBLISHED') notFound();

  const [program, academic, session] = await Promise.all([
    getPublicProgramBySlug(event.id, event.college_id, programSlug),
    getCachedAcademicMasters(event.college_id),
    getCurrentEventSession(event.id),
  ]);
  if (!program || !program.is_active) notFound();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <RootPublicNavbar eventId={event.id} tenantCode={event.college?.code} />

      <main className="max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-10 flex-1 w-full space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href={`/events/${event.slug}/programs/${program.slug}`}
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
          branches={academic.branches}
          semesters={academic.semesters}
        />
      </main>

      <CollegePublicFooter
        collegeName={event.college?.name}
        collegeShortName={event.college?.code}
        collegeSlug={event.college?.slug}
        websiteUrl={event.college?.website_url}
        variant="light"
        className="mt-12"
      />
    </div>
  );
}
