import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin-auth';
import {
  getAuthoritativeProgramReportData,
  generateProgramTeamsPDF,
  generateIndividualTeamPDF,
  generateProgramIndividualsPDF,
  generateProgramCompleteReportPDF,
} from '@/lib/events/event-pdf-reports';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; programId: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session.isAuthenticated || !session.isActive) {
      return NextResponse.json({ error: 'Unauthorized: Administrator session required.' }, { status: 401 });
    }

    const { id: eventId, programId } = await params;
    const collegeId = session.activeCollegeId || session.colleges[0]?.collegeId;
    if (!collegeId) {
      return NextResponse.json({ error: 'Active institution context is required.' }, { status: 400 });
    }

    const reportData = await getAuthoritativeProgramReportData({
      collegeId,
      eventId,
      programId,
    });

    if (!reportData) {
      return NextResponse.json({ error: 'Event or program not found, or unauthorized.' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type')?.toLowerCase();
    const teamId = searchParams.get('teamId');

    let pdfBuffer: Buffer;
    let filenameSuffix = 'complete-participants';

    if (teamId) {
      pdfBuffer = await generateIndividualTeamPDF(reportData, teamId);
      const cleanTeam = teamId.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      filenameSuffix = `team-${cleanTeam}`;
    } else if (type === 'teams') {
      pdfBuffer = await generateProgramTeamsPDF(reportData);
      filenameSuffix = 'all-teams';
    } else if (type === 'individuals' || type === 'individual') {
      pdfBuffer = await generateProgramIndividualsPDF(reportData);
      filenameSuffix = 'individual-participants';
    } else {
      // Default: Report 4 — Complete Participant Report (Consolidated)
      pdfBuffer = await generateProgramCompleteReportPDF(reportData);
      filenameSuffix = 'complete-participants';
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `${reportData.event.slug}-${reportData.program.slug}-${filenameSuffix}-${dateStr}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    console.error('[PROGRAM_PDF_ROUTE_ERROR]', err);
    return NextResponse.json({ error: (err as Error).message || 'Failed to generate PDF.' }, { status: 500 });
  }
}
