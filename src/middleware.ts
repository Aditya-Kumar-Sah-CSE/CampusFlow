import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/supabase/env';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Explicit fast bypass for SEO metadata, PWA root assets, and Digital Asset Links
  if (
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt' ||
    pathname === '/favicon.ico' ||
    pathname === '/sw.js' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/.well-known/assetlinks.json' ||
    pathname.startsWith('/.well-known/')
  ) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);

  // Extract potential tenant slug from first segment (e.g. /bce-bgp -> "bce-bgp")
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0]?.toLowerCase();

  // Known non-tenant reserved prefixes
  const reservedPrefixes = [
    '.well-known',
    'admin',
    'api',
    'auth',
    'events',
    'offline',
    'favicon.ico',
    'manifest.webmanifest',
    'sitemap.xml',
    'robots.txt',
    'privacy-policy',
    'terms-of-service',
    'google63a0b427ff26a6fc.html',
    'overview',
    'about',
    'services',
    'feedback',
    'exams',
  ];
  if (firstSegment && !reservedPrefixes.includes(firstSegment) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(firstSegment)) {
    requestHeaders.set('x-tenant-slug', firstSegment);
  }

  // Forward active admin tenant hint cookie if present (routing/display hint only, not auth proof)
  const activeTenantCookie = request.cookies.get('fms_active_tenant_id')?.value;
  if (activeTenantCookie) {
    requestHeaders.set('x-active-tenant-id', activeTenantCookie);
  }

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (firstSegment && !reservedPrefixes.includes(firstSegment)) {
    response.headers.set('x-tenant-slug', firstSegment);
  }

  // Only initialize Supabase Auth and refresh session cookies for protected/auth routes
  // This completely eliminates database and auth overhead on public pages
  const isAdminRoute = pathname.startsWith('/admin') || pathname.includes('/admin/');
  const isAuthRoute = pathname.startsWith('/auth');

  if (isAdminRoute || isAuthRoute) {
    const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();

    // Protect admin dashboard routes
    if (pathname.startsWith('/admin/dashboard')) {
      if (!user) {
        const loginUrl = new URL('/admin/login', request.url);
        const fullPath = request.nextUrl.pathname + (request.nextUrl.search || '');
        loginUrl.searchParams.set('redirect', fullPath);
        return NextResponse.redirect(loginUrl);
      }

      // Block student accounts from entering admin dashboard
      if (user.user_metadata?.role === 'STUDENT') {
        const loginUrl = new URL('/admin/login', request.url);
        loginUrl.searchParams.set('error', 'Students do not have permission to access the administrator portal.');
        return NextResponse.redirect(loginUrl);
      }
    }

    // Handle student auth pages when already logged in
    const isStudentAuthPage =
      pathname === '/auth/student/login' ||
      pathname === '/auth/student/signup';

    if (isStudentAuthPage && user && (user.email_confirmed_at || user.user_metadata?.email_verified)) {
      const redirectParam = request.nextUrl.searchParams.get('redirect') || request.nextUrl.searchParams.get('returnTo');
      let dest = '/feedback';
      if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//') && !redirectParam.includes(':')) {
        dest = redirectParam;
      } else if (user.user_metadata?.college_slug) {
        dest = `/${user.user_metadata.college_slug}/feedback`;
      }
      return NextResponse.redirect(new URL(dest, request.url));
    }

    // If already authenticated and accessing admin login/signup, redirect to destination or dashboard
    const isLoginOrSignup =
      pathname === '/admin/login' ||
      pathname === '/admin/signup' ||
      pathname.endsWith('/admin/login') ||
      pathname.endsWith('/admin/signup');

    if (isLoginOrSignup && user) {
      // If user is a student, let them view admin login or sign out, do not force them into /admin/dashboard
      if (user.user_metadata?.role === 'STUDENT') {
        return response;
      }

      const reasonParam = request.nextUrl.searchParams.get('reason');
      const hasAdminSessionCookie = request.cookies.has('cf_admin_session_id');

      // If arriving with a reason OR if the single-session cookie is absent, allow login screen
      if (reasonParam || !hasAdminSessionCookie) {
        return response;
      }
      const redirectParam = request.nextUrl.searchParams.get('redirect');
      const dest = redirectParam && redirectParam.startsWith('/admin') ? redirectParam : '/admin/dashboard';
      return NextResponse.redirect(new URL(dest, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt, sw.js, manifest.webmanifest
     * - .well-known/assetlinks.json
     * - Static asset extensions (.svg, .png, .jpg, .jpeg, .gif, .webp, .ico, .html, .txt, .json)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|sw.js|manifest.webmanifest|\\.well-known/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|html|txt|json)$).*)',
  ],
};
