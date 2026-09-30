import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin-auth';
import {
  getAuthoritativeEventReportData,
  generateCompleteEventProgramsPDF,
} from '@/lib/events/event-pdf-reports';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session.isAuthenticated || !session.isActive) {
      return NextResponse.json({ error: 'Unauthorized: Administrator session required.' }, { status: 401 });
    }

    const { id: eventId } = await params;
    const collegeId = session.activeCollegeId || session.colleges[0]?.collegeId;
    if (!collegeId) {
      return NextResponse.json({ error: 'Active institution context is required.' }, { status: 400 });
    }

    const eventReportData = await getAuthoritativeEventReportData({
      collegeId,
      eventId,
    });

    if (!eventReportData) {
      return NextResponse.json({ error: 'Event not found or unauthorized.' }, { status: 404 });
    }

    const pdfBuffer = await generateCompleteEventProgramsPDF(eventReportData);
    const filename = `${eventReportData.event.slug}-all-programs-report-${new Date().toISOString().slice(0, 10)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    console.error('[EVENT_PROGRAMS_PDF_ROUTE_ERROR]', err);
    return NextResponse.json({ error: (err as Error).message || 'Failed to generate PDF.' }, { status: 500 });
  }
}
