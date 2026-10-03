import type { MetadataRoute } from 'next';

/**
 * Next.js Metadata API sitemap generator.
 * Produces /sitemap.xml at build time with only genuinely public, indexable pages.
 *
 * Excluded by design:
 *  - /admin/* (authenticated dashboards, settings, billing)
 *  - /auth/* (callback routes)
 *  - /api/* (backend endpoints)
 *  - /feedback/* (form-specific, requires valid form IDs)
 *  - /[tenant]/* (dynamic tenant pages — not statically enumerable without DB)
 *  - /events/[slug]/* (dynamic event detail pages — require DB lookup)
 *  - /offline (PWA fallback)
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || 'https://143campusflow.vercel.app';

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/events`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/privacy-policy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms-of-service`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];
}
