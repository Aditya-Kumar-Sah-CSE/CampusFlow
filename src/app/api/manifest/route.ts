import { NextResponse, type NextRequest } from 'next/server';
import { getTenantBySlug } from '@/lib/tenant/resolver';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { getCampusFlowBrand, getCampusFlowDescription } from '@/lib/tenant/campusflow-brand';

export const revalidate = 3600;

function getIconMimeType(url: string): string {
  const cleanUrl = url.toLowerCase();
  if (cleanUrl.endsWith('.svg')) return 'image/svg+xml';
  if (cleanUrl.endsWith('.webp')) return 'image/webp';
  if (cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/png';
}

export async function GET(request?: NextRequest) {
  try {
    let slug: string | null = null;

    if (request?.nextUrl) {
      const { searchParams } = request.nextUrl;
      const queryParam = searchParams.get('college') || searchParams.get('tenant') || searchParams.get('slug');
      if (queryParam && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(queryParam.trim().toLowerCase())) {
        slug = queryParam.trim().toLowerCase();
      }
    }

    if (!slug && request?.headers) {
      const headerSlug = request.headers.get('x-tenant-slug');
      if (headerSlug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(headerSlug.trim().toLowerCase())) {
        slug = headerSlug.trim().toLowerCase();
      }
    }

    if (!slug) {
      try {
        const session = await getAdminSession();
        if (session.isAuthenticated && session.activeCollege?.slug) slug = session.activeCollege.slug;
      } catch {
        // Public root manifest has no selected tenant.
      }
    }

    // If a tenant was resolved, return tenant-specific manifest
    if (slug) {
      const tenant = await getTenantBySlug(slug);
      if (tenant) {
        const shortName = tenant.shortName || tenant.code || 'College';
        const primaryColor = tenant.branding?.primaryColor || '#0B192C';
        const brand = getCampusFlowBrand(tenant);

        const manifest = {
          $schema: 'https://json.schemastore.org/web-manifest-combined.json',
          name: brand.displayName,
          short_name: brand.shortName,
          description: getCampusFlowDescription(tenant),
          id: `/${tenant.slug}/`,
          start_url: `/${tenant.slug}/`,
          scope: `/${tenant.slug}/`,
          display: 'standalone',
          orientation: 'portrait',
          theme_color: primaryColor,
          background_color: primaryColor,
          lang: 'en',
          prefer_related_applications: false,
          icons: [
            ...(tenant.logo
              ? [
                  {
                    src: tenant.logo,
                    sizes: '192x192 512x512',
                    type: getIconMimeType(tenant.logo),
                    purpose: 'any',
                  },
                ]
              : []),
            {
              src: `/api/tenant/${tenant.slug}/icon?size=192`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `/api/tenant/${tenant.slug}/icon?size=512`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `/api/tenant/${tenant.slug}/icon?size=512&maskable=1`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: `/api/tenant/${tenant.slug}/icon?size=512&format=svg`,
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
          shortcuts: [
            {
              name: 'Campus Events',
              short_name: 'Events',
              description: `Explore campus events and registrations for ${shortName}`,
              url: `/${tenant.slug}/events`,
              icons: [
                {
                  src: `/api/tenant/${tenant.slug}/icon?size=192`,
                  sizes: '192x192',
                  type: 'image/png',
                },
              ],
            },
            {
              name: 'Submit Feedback',
              short_name: 'Feedback',
              description: `Submit faculty feedback for ${shortName}`,
              url: `/${tenant.slug}/feedback`,
              icons: [
                {
                  src: `/api/tenant/${tenant.slug}/icon?size=192`,
                  sizes: '192x192',
                  type: 'image/png',
                },
              ],
            },
            {
              name: 'Faculty / Admin Login',
              short_name: 'Admin',
              description: `Login to ${shortName} Faculty & Admin Portal`,
              url: `/${tenant.slug}/admin/login`,
              icons: [
                {
                  src: `/api/tenant/${tenant.slug}/icon?size=192`,
                  sizes: '192x192',
                  type: 'image/png',
                },
              ],
            },
          ],
          categories: ['education', 'productivity'],
        };

        return new NextResponse(JSON.stringify(manifest, null, 2), {
          status: 200,
          headers: {
            'Content-Type': 'application/manifest+json; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
          },
        });
      }
    }

    // Default Fallback: Platform Root Generic Manifest
    const defaultManifest = {
      $schema: 'https://json.schemastore.org/web-manifest-combined.json',
      name: 'CampusFlow',
      short_name: 'CampusFlow',
      description: getCampusFlowDescription(),
      id: 'campusflow-platform',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      theme_color: '#0B192C',
      background_color: '#0B192C',
      lang: 'en',
      prefer_related_applications: false,
      icons: [
        {
          src: '/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/icon-maskable.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
      shortcuts: [
        {
          name: 'Campus Events',
          short_name: 'Events',
          description: 'Explore campus events, programs, and registrations',
          url: '/events',
          icons: [
            {
              src: '/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
          ],
        },
        {
          name: 'Submit Feedback',
          short_name: 'Feedback',
            description: 'Discover and submit faculty feedback',
          url: '/feedback',
          icons: [
            {
              src: '/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
          ],
        },
        {
          name: 'Admin Console',
          short_name: 'Admin',
            description: 'Login to the CampusFlow admin portal',
          url: '/admin/login',
          icons: [
            {
              src: '/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
          ],
        },
      ],
    };

    return new NextResponse(JSON.stringify(defaultManifest, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/manifest+json; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err: unknown) {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    console.error('[API_MANIFEST_ERROR]', errorObj.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
