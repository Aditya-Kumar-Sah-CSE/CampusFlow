import type { Metadata, Viewport } from 'next';
import { resolveTenantOrNotFound, getAllActiveColleges } from '@/lib/tenant/resolver';
import { TenantProvider } from '@/components/tenant/TenantProvider';
import { CollegePwaInstallPrompt } from '@/components/pwa/CollegePwaInstallPrompt';
import { getCampusFlowBrand, getCampusFlowDescription } from '@/lib/tenant/campusflow-brand';

export const preferredRegion = 'bom1';
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const colleges = await getAllActiveColleges();
    return colleges.map((c) => ({ tenant: c.slug }));
  } catch {
    return [{ tenant: 'bce-bgp' }];
  }
}

interface TenantLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    tenant: string;
  }>;
}

export async function generateViewport({
  params,
}: {
  params: Promise<{ tenant: string }>;
}): Promise<Viewport> {
  const { tenant: rawSlug } = await params;
  try {
    const tenant = await resolveTenantOrNotFound(rawSlug);
    const primaryColor = tenant.branding?.primaryColor || '#0B192C';
    return {
      themeColor: primaryColor,
      width: 'device-width',
      initialScale: 1,
      maximumScale: 5,
      viewportFit: 'cover',
    };
  } catch {
    return {
      themeColor: '#0B192C',
      width: 'device-width',
      initialScale: 1,
      maximumScale: 5,
      viewportFit: 'cover',
    };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>;
}): Promise<Metadata> {
  const { tenant: rawSlug } = await params;
  try {
    const tenant = await resolveTenantOrNotFound(rawSlug);

    const brand = getCampusFlowBrand(tenant);
    const title = brand.displayName;
    const description = getCampusFlowDescription(tenant);

    return {
      title: {
        default: title,
        template: `%s | ${brand.displayName}`,
      },
      description,
      openGraph: { title, description },
      twitter: { title, description },
      manifest: `/api/manifest/${tenant.slug}`,
      appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: brand.shortName,
      },
      applicationName: brand.displayName,
      icons: {
        icon: [
          ...(tenant.logo ? [{ url: tenant.logo, sizes: 'any' }] : []),
          { url: `/api/tenant/${tenant.slug}/icon?size=192`, sizes: '192x192', type: 'image/png' },
          { url: `/api/tenant/${tenant.slug}/icon?size=512`, sizes: '512x512', type: 'image/png' },
        ],
        apple: [
          ...(tenant.logo ? [{ url: tenant.logo, sizes: '180x180' }] : []),
          { url: `/api/tenant/${tenant.slug}/icon?size=180&apple=1`, sizes: '180x180', type: 'image/png' },
        ],
      },
    };
  } catch {
    return {
      title: 'CampusFlow',
    };
  }
}

export default async function TenantLayout({ children, params }: TenantLayoutProps) {
  const { tenant: rawSlug } = await params;
  const tenant = await resolveTenantOrNotFound(rawSlug);

  return (
    <TenantProvider tenant={tenant}>
      {children}
      <CollegePwaInstallPrompt tenant={tenant} />
    </TenantProvider>
  );
}
