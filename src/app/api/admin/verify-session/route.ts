import { NextResponse } from 'next/server';
import { getAdminSession, ACTIVE_TENANT_COOKIE } from '@/lib/auth/admin-auth';
import {
  createAdminSessionRecord,
  detectPlatform,
  ADMIN_SESSION_COOKIE,
  ADMIN_PLATFORM_COOKIE,
  SESSION_REVOKED_CODE,
} from '@/lib/auth/session-service';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    let body: {
      targetCollegeId?: string;
      targetCollegeSlug?: string;
      platform?: 'WEB' | 'ANDROID';
      deviceId?: string;
      isLogin?: boolean;
    } = {};

    try {
      body = await request.json();
    } catch {
      // Body is optional
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { isAuthenticated: false, error: 'Unauthenticated session.' },
        { status: 401 }
      );
    }

    const platform = detectPlatform(
      request.headers.get('x-client-platform'),
      request.headers.get('cookie')?.includes(`${ADMIN_PLATFORM_COOKIE}=ANDROID`) ? 'ANDROID' : null,
      request.headers.get('user-agent'),
      body.platform
    );

    // If this is an explicit login or first verification, claim/create the single concurrent session
    let establishedSessionId: string | null = null;
    if (body.isLogin || !request.headers.get('cookie')?.includes(ADMIN_SESSION_COOKIE)) {
      const claimResult = await createAdminSessionRecord({
        userId: user.id,
        platform,
        deviceId: body.deviceId || null,
        userAgent: request.headers.get('user-agent'),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      });
      establishedSessionId = claimResult.sessionId;
    }

    const session = await getAdminSession();

    if (session.sessionRevoked) {
      return NextResponse.json(
        {
          code: SESSION_REVOKED_CODE,
          error:
            session.sessionRevokedPlatform === 'ANDROID'
              ? 'Your session ended because this account was signed in from another device.'
              : 'Your session ended because this account was signed in from another browser.',
          platform: session.sessionRevokedPlatform,
        },
        { status: 401 }
      );
    }

    if (!session.isAuthenticated) {
      return NextResponse.json(
        { isAuthenticated: false, error: 'Unauthenticated session.' },
        { status: 401 }
      );
    }

    let resolvedTargetCollegeId: string | null = null;

    if (body.targetCollegeId || body.targetCollegeSlug) {
      let query = supabase.from('colleges').select('id, name, slug, code, is_active').eq('is_active', true);

      if (body.targetCollegeId) {
        query = query.eq('id', body.targetCollegeId);
      } else if (body.targetCollegeSlug) {
        query = query.eq('slug', body.targetCollegeSlug.toLowerCase().trim());
      }

      const { data: matchedCollege } = await query.maybeSingle();

      if (!matchedCollege) {
        return NextResponse.json(
          {
            isAuthenticated: true,
            authorizedForCollege: false,
            error: 'Target institution does not exist or is inactive.',
          },
          { status: 404 }
        );
      }

      resolvedTargetCollegeId = matchedCollege.id;

      // Check authorization server-side strictly against auth.uid() session
      const isSuper = session.isPlatformSuperAdmin;
      const isMember = session.colleges.some(
        (c) => c.collegeId === resolvedTargetCollegeId && c.status === 'ACTIVE'
      );

      if (!isSuper && !isMember) {
        return NextResponse.json(
          {
            isAuthenticated: true,
            authorizedForCollege: false,
            error: 'You do not have administrator access to this institution.',
          },
          { status: 403 }
        );
      }
    }

    // Determine cookie value to set
    const cookieCollegeId = resolvedTargetCollegeId || session.activeCollegeId;

    const response = NextResponse.json({
      ...session,
      authorizedForCollege: true,
      activeCollegeId: cookieCollegeId,
      platform,
      sessionId: establishedSessionId || session.sessionId,
    });

    if (cookieCollegeId) {
      response.cookies.set(ACTIVE_TENANT_COOKIE, cookieCollegeId, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }

    if (establishedSessionId) {
      response.cookies.set(ADMIN_SESSION_COOKIE, establishedSessionId, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
      response.cookies.set(ADMIN_PLATFORM_COOKIE, platform, {
        path: '/',
        httpOnly: false, // Accessible to client so client knows platform context
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  } catch (error: any) {
    console.error('Session verification error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
