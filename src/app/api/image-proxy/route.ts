import { NextRequest, NextResponse } from 'next/server';
import dns from 'dns/promises';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function isPrivateOrReservedIp(ip: string): boolean {
  // IPv4 loopback (127.0.0.0/8)
  if (/^127\./.test(ip)) return true;
  // IPv4 link-local & cloud metadata (169.254.0.0/16)
  if (/^169\.254\./.test(ip)) return true;
  // IPv4 RFC 1918 Private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 0.0.0.0/8)
  if (/^10\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^0\./.test(ip)) return true;

  // IPv6 loopback, link-local, and unique local
  const lower = ip.toLowerCase();
  if (
    lower === '::1' ||
    lower === '::' ||
    lower.startsWith('fe80:') ||
    lower.startsWith('fc') ||
    lower.startsWith('fd')
  ) {
    return true;
  }
  return false;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get('url');
  if (!urlParam) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    const parsed = new URL(urlParam);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return new NextResponse('Invalid protocol. Only HTTP and HTTPS are permitted.', { status: 400 });
    }

    const hostLower = parsed.hostname.toLowerCase();
    if (
      hostLower === 'localhost' ||
      hostLower.endsWith('.localhost') ||
      hostLower === 'metadata.google.internal' ||
      hostLower === '169.254.169.254' ||
      hostLower.endsWith('.internal') ||
      hostLower.endsWith('.local')
    ) {
      return new NextResponse('Forbidden target host', { status: 403 });
    }

    // Resolve DNS and verify that destination IP is not private, loopback, or cloud metadata
    try {
      const resolvedIps = await dns.lookup(parsed.hostname, { all: true });
      for (const entry of resolvedIps) {
        if (isPrivateOrReservedIp(entry.address)) {
          return new NextResponse('Destination IP address is restricted', { status: 403 });
        }
      }
    } catch {
      return new NextResponse('Unable to resolve remote host', { status: 400 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    // Fetch with manual redirect handling to prevent redirect-based SSRF attacks
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: 'error', // Reject automatic redirects
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 CampusFlow/1.0',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return new NextResponse(`Failed to fetch image: ${res.statusText}`, { status: res.status });
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
      return new NextResponse('Forbidden resource type: only image MIME types are permitted', { status: 415 });
    }

    const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_IMAGE_SIZE_BYTES) {
      return new NextResponse('Image exceeds maximum allowed size (5MB)', { status: 413 });
    }

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
      return new NextResponse('Image exceeds maximum allowed size (5MB)', { status: 413 });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return new NextResponse('Image request timed out', { status: 504 });
    }
    return new NextResponse(err?.message || 'Error proxying remote image', { status: 500 });
  }
}
