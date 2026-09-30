import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPublicEventBySlugGlobal } from '@/lib/events/service';
import { getCurrentEventSession } from '@/lib/events/event-session';
import { getStudentRegistrationsAction } from '@/app/admin/events/event-registration-actions';
import { RootPublicNavbar } from '@/components/layout/RootPublicNavbar';
import { StudentMyRegistrationsClient } from '@/components/events/StudentMyRegistrationsClient';
import { ArrowLeft, UserCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{
    slug: string;
  }>;
}

export default async function StudentMyRegistrationsPage({ params }: Props) {
  const { slug } = await params;
  const event = await getPublicEventBySlugGlobal(slug);
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
      <RootPublicNavbar />

      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12 flex-1 w-full space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href={`/events/${event.slug}`}
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
