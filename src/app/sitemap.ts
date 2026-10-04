import type { MetadataRoute } from 'next';
import { appUrl, APP_URL } from '@/lib/config/app';
import { getAllSmallEvents } from '@/config/events';

/**
 * Next.js Metadata API sitemap generator.
 * Produces /sitemap.xml at build time with only genuinely public, indexable pages.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const smallEvents = getAllSmallEvents();

  const eventEntries: MetadataRoute.Sitemap = smallEvents.map((e) => ({
    url: appUrl(`/${e.institutionId}/events/${e.id}`),
    lastModified: new Date(e.createdAt),
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [
    {
      url: APP_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: appUrl('/events'),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: appUrl('/bce-bgp'),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: appUrl('/bce-bgp/events'),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: appUrl('/gec-gaya'),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: appUrl('/gec-gaya/events'),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    ...eventEntries,
    {
      url: appUrl('/privacy-policy'),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: appUrl('/terms-of-service'),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];
}

