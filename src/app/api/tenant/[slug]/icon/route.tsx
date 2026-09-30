import { type NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { getTenantBySlug } from '@/lib/tenant/resolver';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // 1 hour cache

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const url = new URL(request.url);
    const sizeParam = url.searchParams.get('size');
    const maskable = url.searchParams.get('maskable') === 'true' || url.searchParams.get('maskable') === '1';
    const isApple = url.searchParams.get('apple') === '1' || url.searchParams.get('apple') === 'true';
    const format = url.searchParams.get('format');

    let size = 192;
    if (sizeParam === '512') size = 512;
    else if (sizeParam === '180' || isApple) size = 180;
    else if (sizeParam) size = parseInt(sizeParam, 10) || 192;

    const tenant = slug ? await getTenantBySlug(slug) : null;

    const collegeCode = tenant?.code || tenant?.shortName || 'CF';
    const primaryColor = tenant?.branding?.primaryColor || '#0B192C';
    const secondaryColor = tenant?.branding?.secondaryColor || '#1E3E62';
    const accentColor = tenant?.branding?.accentColor || '#F59E0B';

    // Maskable icons require safe zone (inner 80% circle/squircle)
    const padding = maskable ? Math.round(size * 0.12) : 0;
    const innerSize = size - padding * 2;
    const cornerRadius = maskable ? 0 : Math.round(size * 0.22);

    // Compute font sizes
    const codeLen = collegeCode.length;
    const fontSize = Math.round(innerSize * (codeLen <= 3 ? 0.32 : codeLen <= 5 ? 0.24 : 0.18));
    const subFontSize = Math.max(9, Math.round(innerSize * 0.08));

    // Return pure SVG if specifically requested
    if (format === 'svg') {
      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${secondaryColor}" />
      <stop offset="100%" stop-color="${primaryColor}" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${accentColor}" />
      <stop offset="100%" stop-color="#FCD34D" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="${Math.max(2, Math.round(size * 0.015))}" stdDeviation="${Math.max(2, Math.round(size * 0.02))}" flood-opacity="0.35" />
    </filter>
  </defs>

  <!-- Background Base -->
  <rect x="0" y="0" width="${size}" height="${size}" fill="${primaryColor}" />

  <!-- Inner Badge Container -->
  <rect 
    x="${padding}" 
    y="${padding}" 
    width="${innerSize}" 
    height="${innerSize}" 
    rx="${cornerRadius}" 
    ry="${cornerRadius}" 
    fill="url(#bgGrad)" 
    stroke="${accentColor}" 
    stroke-width="${Math.max(1.5, Math.round(innerSize * 0.012))}" 
    stroke-opacity="0.3"
  />

  <!-- Subtle Accent Crest Bar -->
  <rect 
    x="${padding + Math.round(innerSize * 0.15)}" 
    y="${padding + Math.round(innerSize * 0.14)}" 
    width="${Math.round(innerSize * 0.7)}" 
    height="${Math.max(3, Math.round(innerSize * 0.018))}" 
    rx="${Math.max(1.5, Math.round(innerSize * 0.009))}" 
    fill="url(#accentGrad)" 
  />

  <!-- College Code Initial Badge -->
  <text 
    x="${size / 2}" 
    y="${size / 2 + Math.round(fontSize * 0.28)}" 
    font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" 
    font-size="${fontSize}" 
    font-weight="900" 
    fill="#FFFFFF" 
    text-anchor="middle" 
    letter-spacing="${Math.round(fontSize * 0.04)}"
    filter="url(#shadow)"
  >${collegeCode}</text>

  <!-- Subtitle Tag: FEEDBACK -->
  <text 
    x="${size / 2}" 
    y="${padding + Math.round(innerSize * 0.82)}" 
    font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" 
    font-size="${subFontSize}" 
    font-weight="700" 
    fill="${accentColor}" 
    text-anchor="middle" 
    letter-spacing="${Math.round(subFontSize * 0.18)}"
  >FEEDBACK</text>
</svg>`;

      return new Response(svg, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Default to real pixel-perfect PNG via Next.js ImageResponse for PWA & iOS Safari support
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: primaryColor,
            padding: `${padding}px`,
          }}
        >
          <div
            style={{
              width: `${innerSize}px`,
              height: `${innerSize}px`,
              borderRadius: `${cornerRadius}px`,
              background: `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 100%)`,
              border: `2px solid ${accentColor}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            {/* Top Accent Stripe */}
            <div
              style={{
                width: '65%',
                height: `${Math.max(3, Math.round(innerSize * 0.02))}px`,
                backgroundColor: accentColor,
                borderRadius: '2px',
                position: 'absolute',
                top: `${Math.round(innerSize * 0.12)}px`,
              }}
            />

            {/* Institution Code Display */}
            <div
              style={{
                fontSize: `${fontSize}px`,
                fontWeight: 900,
                color: '#FFFFFF',
                letterSpacing: `${Math.max(1, Math.round(fontSize * 0.04))}px`,
                fontFamily: 'system-ui, sans-serif',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {collegeCode}
            </div>

            {/* Subtitle Badge */}
            <div
              style={{
                fontSize: `${subFontSize}px`,
                fontWeight: 700,
                color: accentColor,
                letterSpacing: '2px',
                fontFamily: 'system-ui, sans-serif',
                position: 'absolute',
                bottom: `${Math.round(innerSize * 0.14)}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              CAMPUSFLOW
            </div>
          </div>
        </div>
      ),
      {
        width: size,
        height: size,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err: unknown) {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    console.error('[TENANT_ICON_ERROR]', errorObj.message);
    return new Response('Icon generation error', { status: 500 });
  }
}
