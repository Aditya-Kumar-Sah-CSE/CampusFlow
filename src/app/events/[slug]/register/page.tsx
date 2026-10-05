import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPublicEventBySlugGlobal } from '@/lib/events/service';
import { getCachedAcademicMasters } from '@/lib/supabase/academic-cache';
import { RootPublicNavbar } from '@/components/layout/RootPublicNavbar';
import { EventRegistrationForm } from '@/components/events/EventRegistrationForm';
import { ArrowLeft, Ticket } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{
    slug: string;
  }>;
}

export default async function EventRegisterPage({ params }: Props) {
  const { slug } = await params;
  const event = await getPublicEventBySlugGlobal(slug);

  if (!event || event.status !== 'PUBLISHED' || !event.registration_enabled) {
    notFound();
  }

  const academic = await getCachedAcademicMasters(event.college_id);

  const now = new Date();
  if (now > new Date(event.registration_end)) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
        <RootPublicNavbar eventId={event.id} tenantCode={event.college?.code} />
        <main className="flex-1 max-w-md mx-auto w-full px-4 py-16 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center font-bold">
            !
          </div>
          <h1 className="text-xl font-bold text-slate-900">Registration Closed</h1>
          <p className="text-xs text-slate-500">
            The registration deadline for {event.title} has passed.
          </p>
          <Link
            href={`/events/${event.slug}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Event
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <RootPublicNavbar eventId={event.id} tenantCode={event.college?.code} />

      <main className="flex-1 max-w-4xl mx-auto w-full px-3 sm:px-6 py-6 sm:py-10 space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href={`/events/${event.slug}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {event.title}</span>
          </Link>

          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Ticket className="w-3.5 h-3.5 text-blue-600" /> Event Enrollment
          </span>
        </div>

        <EventRegistrationForm
          event={event}
          collegeName={event.college?.name || 'College'}
          collegeLogoUrl={event.college?.logo_url}
          tenantSlug={event.college?.slug}
          branches={academic.branches}
          semesters={academic.semesters}
        />
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-4xl mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} {event.college?.name || 'College'}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
