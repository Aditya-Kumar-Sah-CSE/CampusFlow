import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { resolveTenantOrNotFound } from '@/lib/tenant/resolver';
import { getPublicEventBySlug } from '@/lib/events/service';
import { PublicTenantNavbar } from '@/components/layout/PublicTenantNavbar';
import { EventPassVerificationClient } from '@/components/events/EventPassVerificationClient';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{
    tenant: string;
    slug: string;
  }>;
  searchParams: Promise<{
    reg?: string;
  }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tenant: rawSlug, slug } = await params;
  const tenant = await resolveTenantOrNotFound(rawSlug);
  const event = await getPublicEventBySlug(tenant.collegeId, slug);
  return {
    title: event ? `Verify Event Pass | ${event.title}` : 'Verify Event Pass',
    description: 'Verify digital student event pass authenticity and participation status.',
  };
}

export default async function TenantEventPassVerifyPage({ params, searchParams }: Props) {
  const { tenant: rawSlug, slug } = await params;
  const { reg } = await searchParams;

  const tenant = await resolveTenantOrNotFound(rawSlug);
  const event = await getPublicEventBySlug(tenant.collegeId, slug);

  if (!event) {
    notFound();
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <PublicTenantNavbar tenant={tenant} currentPage="events" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-3 sm:px-6 py-6 sm:py-10">
        <EventPassVerificationClient
          event={event}
          collegeName={tenant.name}
          initialRegNumber={reg || ''}
          tenantSlug={tenant.slug}
          collegeLogoUrl={tenant.logo}
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
