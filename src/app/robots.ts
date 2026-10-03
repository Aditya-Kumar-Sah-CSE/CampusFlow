import type { MetadataRoute } from 'next';

/**
 * Next.js Metadata API robots generator.
 * Produces /robots.txt with allow/disallow rules for crawlers.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || 'https://143campusflow.vercel.app';

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
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
