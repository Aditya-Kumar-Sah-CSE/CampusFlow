import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { getAdminEventById, getEventRegistrations } from '@/lib/events/service';
import { generateEventEnrollmentPDF } from '@/lib/events/pdf-generator';
import { getCollegeBranding } from '@/lib/tenant/branding';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session.isAuthenticated || !session.isActive) {
      return NextResponse.json(
        { error: 'Unauthorized: Active administrator session required.' },
        { status: 401 }
      );
    }

    const { id: eventId } = await params;
    const targetCollegeId = session.activeCollegeId;

    if (!targetCollegeId && !session.isPlatformSuperAdmin) {
      return NextResponse.json(
        { error: 'Active institution context is required.' },
        { status: 400 }
      );
    }

    // Determine target college: if platform super admin and no active college, fetch event to resolve college
    const collegeId = targetCollegeId || session.colleges[0]?.collegeId;
    if (!collegeId) {
      return NextResponse.json({ error: 'Institution not resolved.' }, { status: 400 });
    }

    // Fetch event strictly verifying college ownership
    const event = await getAdminEventById(eventId, collegeId);
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found or unauthorized for this institution.' },
        { status: 404 }
      );
    }

    // Read query filters if passed
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const branchId = searchParams.get('branchId') || undefined;
    const semesterId = searchParams.get('semesterId') || undefined;
    const paymentStatus = (searchParams.get('paymentStatus') as any) || 'ALL';
    const registrationStatus = (searchParams.get('registrationStatus') as any) || 'ALL';

    // Fetch college branding and details
    const branding = await getCollegeBranding(collegeId);
    const collegeName = session.activeCollege?.name || 'College';
    const collegeCode = session.activeCollege?.code || 'COLLEGE';

    const db = (await import('@/lib/supabase/admin')).createAdminClient() || await (await import('@/lib/supabase/server')).createClient();
    const { data: collegeDetails } = await db.from('colleges').select('*').eq('id', collegeId).maybeSingle();

    // Small Event (Google Form mode): generate roster directly from Google Sheets
    if (event.registration_type === 'google_form') {
      const { fetchGoogleFormEventResponses } = await import('@/lib/google/event-registration-automated');
      const { generateGoogleEventEnrollmentPDF } = await import('@/lib/events/event-pdf-reports');

      const syncResult = await fetchGoogleFormEventResponses({ collegeId, eventId: event.id });
      let responses = syncResult.responses || [];

      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        responses = responses.filter(r =>
          r.participantName?.toLowerCase().includes(q) ||
          r.rollNumber?.toLowerCase().includes(q) ||
          r.registrationNumber?.toLowerCase().includes(q) ||
          r.collegeRegistrationNumber?.toLowerCase().includes(q)
        );
      }

      const pdfBuffer = await generateGoogleEventEnrollmentPDF({
        event,
        responses,
        collegeName,
        collegeCode,
        branding,
        collegeDetails: collegeDetails || undefined,
      });

      const safeTitle = event.slug || 'event';
      const filename = `${safeTitle}-roster-${new Date().toISOString().slice(0, 10)}.pdf`;

      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const { registrations, stats } = await getEventRegistrations({
      eventId: event.id,
      collegeId,
      search,
      branchId,
      semesterId,
      paymentStatus,
      registrationStatus,
    });

    const pdfBuffer = await generateEventEnrollmentPDF({
      event,
      registrations,
      stats,
      collegeName,
      collegeCode,
      branding,
      collegeDetails: collegeDetails || undefined,
    });

    const safeTitle = event.slug || 'event';
    const filename = `${safeTitle}-enrollment-${new Date().toISOString().slice(0, 10)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('[EVENT_PDF_ROUTE_ERROR]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate enrollment PDF.' },
      { status: 500 }
    );
  }
}
