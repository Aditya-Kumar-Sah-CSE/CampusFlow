import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { getAuthoritativeProgramReportData, generateIndividualTeamPDF } from '@/lib/events/event-pdf-reports';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; programId: string; teamId: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session.isAuthenticated || !session.isActive) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { id: eventId, programId, teamId } = await params;
    const collegeId = session.activeCollegeId || session.colleges[0]?.collegeId;
    if (!collegeId) {
      return NextResponse.json({ error: 'Active institution context is required.' }, { status: 400 });
    }

    const reportData = await getAuthoritativeProgramReportData({ collegeId, eventId, programId });
    if (!reportData) {
      return NextResponse.json({ error: 'Event or program not found, or unauthorized.' }, { status: 404 });
    }

    const pdfBuffer = await generateIndividualTeamPDF(reportData, teamId);
    const cleanTeam = teamId.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const filename = `${reportData.event.slug}-${reportData.program.slug}-team-${cleanTeam}-${new Date().toISOString().slice(0, 10)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    console.error('[INDIVIDUAL_TEAM_PDF_ROUTE_ERROR]', err);
    return NextResponse.json({ error: (err as Error).message || 'Failed to generate Team PDF.' }, { status: 500 });
  }
}
