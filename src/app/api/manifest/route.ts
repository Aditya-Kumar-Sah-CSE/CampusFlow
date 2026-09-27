import { NextResponse, type NextRequest } from 'next/server';
import { getTenantBySlug } from '@/lib/tenant/resolver';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

function getIconMimeType(url: string): string {
  const cleanUrl = url.toLowerCase();
  if (cleanUrl.endsWith('.svg')) return 'image/svg+xml';
  if (cleanUrl.endsWith('.webp')) return 'image/webp';
  if (cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/png';
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    // 1. Resolve slug from query params: ?college=... or ?tenant=...
    let slug = url.searchParams.get('college') || url.searchParams.get('tenant') || null;

    // 2. If not in query, check middleware forwarded header
    if (!slug) {
      slug = request.headers.get('x-tenant-slug');
    }

    // 3. If still not found, check active tenant cookie (for logged-in admin)
    if (!slug) {
      const activeCollegeId = request.cookies.get('fms_active_tenant_id')?.value;
      if (activeCollegeId) {
        const supabase = createAdminClient();
        if (supabase) {
          const { data: college } = await supabase
            .from('colleges')
            .select('slug')
            .eq('id', activeCollegeId)
            .maybeSingle();
          if (college?.slug) {
            slug = college.slug;
          }
        }
      }
    }

    // 4. If still not found, check Referer URL path (e.g. /bce-bgp/...)
    if (!slug) {
      const referer = request.headers.get('referer');
      if (referer) {
        try {
          const refUrl = new URL(referer);
          const firstSegment = refUrl.pathname.split('/').filter(Boolean)[0];
          const reserved = ['admin', 'api', 'auth', 'offline', 'privacy-policy', 'terms-of-service'];
          if (firstSegment && !reserved.includes(firstSegment.toLowerCase())) {
            slug = firstSegment.toLowerCase();
          }
        } catch {
          // Ignore invalid referer URL
        }
      }
    }

    // If a tenant was resolved, return tenant-specific manifest
    if (slug) {
      const tenant = await getTenantBySlug(slug);
      if (tenant) {
        const collegeName = tenant.name;
        const shortName = tenant.shortName || tenant.code || 'College';
        const primaryColor = tenant.branding?.primaryColor || '#0B192C';

        const formattedName = collegeName.toLowerCase().includes('feedback')
          ? collegeName
          : `${collegeName} Feedback`;
        const formattedShortName = shortName.toLowerCase().includes('feedback')
          ? shortName
          : `${shortName} Feedback`;

        const manifest = {
          $schema: 'https://json.schemastore.org/web-manifest-combined.json',
          name: formattedName,
          short_name: formattedShortName,
          description: `Official Faculty Evaluation & Feedback Management System for ${collegeName} (${shortName})`,
          id: `/${tenant.slug}/`,
          start_url: `/${tenant.slug}`,
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
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          },
        });
      }
    }

    // Default Fallback: Platform Root Generic Manifest
    const defaultManifest = {
      $schema: 'https://json.schemastore.org/web-manifest-combined.json',
      name: 'Feedback Management System',
      short_name: 'FMS Portal',
      description: 'Multi-Tenant Institutional Faculty Feedback & Evaluation Management System',
      id: 'fms-feedback-portal',
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
          description: 'Login to Faculty Feedback Admin Portal',
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
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err: unknown) {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    console.error('[API_MANIFEST_ERROR]', errorObj.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
