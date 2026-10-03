import type { MetadataRoute } from 'next';
import { appUrl } from '@/lib/config/app';

/**
 * Next.js Metadata API robots generator.
 * Produces /robots.txt with allow/disallow rules for crawlers.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/auth/',
          '/feedback/',
          '/offline/',
          '/manifest.webmanifest/',
        ],
      },
    ],
    sitemap: appUrl('/sitemap.xml'),
  };
}
