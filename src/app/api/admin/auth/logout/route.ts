import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  revokeAdminSession,
  ADMIN_SESSION_COOKIE,
  ADMIN_PLATFORM_COOKIE,
} from '@/lib/auth/session-service';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

    if (sessionId) {
      await revokeAdminSession({
        sessionId,
        reason: 'USER_LOGOUT',
      });
    }

    const response = NextResponse.json({ success: true });

    // Clean up session cookies on logout
    response.cookies.delete(ADMIN_SESSION_COOKIE);
    response.cookies.delete(ADMIN_PLATFORM_COOKIE);

    return response;
  } catch (error: any) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
