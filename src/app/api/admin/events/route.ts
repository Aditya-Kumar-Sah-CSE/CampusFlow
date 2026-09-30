import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { getAdminEvents } from '@/lib/events/service';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session.isAuthenticated || !session.isActive) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const collegeId = session.activeCollegeId || session.colleges[0]?.collegeId;
    if (!collegeId) {
      return NextResponse.json({ error: 'Active institution context required.' }, { status: 400 });
    }

    const events = await getAdminEvents(collegeId);
    return NextResponse.json({ events });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch events.' }, { status: 500 });
  }
}
