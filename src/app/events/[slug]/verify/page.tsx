import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPublicEventBySlugGlobal } from '@/lib/events/service';
import { RootPublicNavbar } from '@/components/layout/RootPublicNavbar';
import { EventPassVerificationClient } from '@/components/events/EventPassVerificationClient';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    reg?: string;
  }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublicEventBySlugGlobal(slug);
  return {
    title: event ? `Verify Event Pass | ${event.title}` : 'Verify Event Pass',
    description: 'Verify digital student event pass authenticity and participation status.',
  };
}

export default async function EventPassVerifyPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { reg } = await searchParams;

  const event = await getPublicEventBySlugGlobal(slug);
  if (!event) {
    notFound();
  }

  const collegeName = event.college?.name || 'College';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <RootPublicNavbar eventId={event.id} tenantCode={event.college?.code} />

      <main className="flex-1 max-w-4xl mx-auto w-full px-3 sm:px-6 py-6 sm:py-10">
        <EventPassVerificationClient
          event={event}
          collegeName={collegeName}
          initialRegNumber={reg || ''}
          tenantSlug={event.college?.slug}
          collegeLogoUrl={event.college?.logo_url}
        />
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-4xl mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} {collegeName}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
