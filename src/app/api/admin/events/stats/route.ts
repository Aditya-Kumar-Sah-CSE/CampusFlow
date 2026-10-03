import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getCanonicalEventsBatchStats, getCanonicalEventStats } from '@/lib/events/canonical-stats';

export const dynamic = 'force-dynamic';

async function getDb() {
  return createAdminClient() || (await createClient());
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session.isAuthenticated || !session.isActive) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const collegeId = session.activeCollegeId || session.colleges[0]?.collegeId;
    if (!collegeId) {
      return NextResponse.json(
        { error: 'Active institution context required.' },
        { status: 400 }
      );
    }

    // Check if query is for a single event
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    const db = await getDb();

    if (eventId) {
      const stats = await getCanonicalEventStats(collegeId, eventId);
      return NextResponse.json({
        stats: {
          [eventId]: stats,
        },
      });
    }

    // Fetch events for this college
    const { data: events, error } = await db
      .from('events')
      .select('id, title, max_capacity, registration_sheet_id')
      .eq('college_id', collegeId);

    if (error) {
      console.error('[EVENTS_STATS_QUERY_ERROR]', error);
      return NextResponse.json(
        { error: 'Failed to fetch events for stats calculation.' },
        { status: 500 }
      );
    }

    const stats = await getCanonicalEventsBatchStats(collegeId, events || []);

    return NextResponse.json({ stats });
  } catch (err: any) {
    console.error('[EVENTS_STATS_ROUTE_ERROR]', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch event statistics.' },
      { status: 500 }
    );
  }
}
