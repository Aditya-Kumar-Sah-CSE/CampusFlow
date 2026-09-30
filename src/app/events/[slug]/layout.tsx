import type { Metadata } from 'next';
import { getPublicEventBySlugGlobal } from '@/lib/events/service';
import { getCampusFlowBrand, getCampusFlowDescription } from '@/lib/tenant/campusflow-brand';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublicEventBySlugGlobal(slug);
  const tenant = { code: event?.college?.code || event?.college?.short_name };
  const brand = getCampusFlowBrand(tenant);
  return {
    title: { default: brand.displayName, template: `%s | ${brand.displayName}` },
    description: getCampusFlowDescription(tenant),
    manifest: event?.college?.slug ? `/api/manifest/${event.college.slug}` : '/manifest.webmanifest',
    openGraph: { title: brand.displayName, description: getCampusFlowDescription(tenant) },
    twitter: { title: brand.displayName, description: getCampusFlowDescription(tenant) },
  };
}

export default function EventLayout({ children }: { children: React.ReactNode }) {
  return children;
}
