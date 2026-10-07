import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminSession } from '@/lib/auth/admin-auth';
import {
  getActiveAdminSessions,
  revokeOtherAdminSessions,
  ADMIN_SESSION_COOKIE,
  SESSION_REVOKED_CODE,
} from '@/lib/auth/session-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (session.sessionRevoked) {
      return NextResponse.json(
        { code: SESSION_REVOKED_CODE, error: 'Session has been revoked.' },
        { status: 401 }
      );
    }
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const currentSessionId = cookieStore.get(ADMIN_SESSION_COOKIE)?.value || session.sessionId;

    const activeSessions = await getActiveAdminSessions(session.userId, currentSessionId);
    return NextResponse.json({
      success: true,
      sessions: activeSessions,
      currentSessionId,
    });
  } catch (error: any) {
    console.error('GET /api/admin/sessions error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await getAdminSession();
    if (session.sessionRevoked) {
      return NextResponse.json(
        { code: SESSION_REVOKED_CODE, error: 'Session has been revoked.' },
        { status: 401 }
      );
    }
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const currentSessionId = cookieStore.get(ADMIN_SESSION_COOKIE)?.value || session.sessionId;

    if (!currentSessionId) {
      return NextResponse.json({ error: 'No active session token identified.' }, { status: 400 });
    }

    const { revokedCount } = await revokeOtherAdminSessions({
      userId: session.userId,
      currentSessionId,
    });

    const refreshedSessions = await getActiveAdminSessions(session.userId, currentSessionId);

    return NextResponse.json({
      success: true,
      revokedCount,
      sessions: refreshedSessions,
      message: `Signed out ${revokedCount} other active session(s).`,
    });
  } catch (error: any) {
    console.error('POST /api/admin/sessions error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
