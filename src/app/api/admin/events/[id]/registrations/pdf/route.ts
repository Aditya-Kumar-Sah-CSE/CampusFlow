import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { generateGoogleEventParticipantPdf } from '@/lib/google/event-registration-automated';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session.isAuthenticated || !session.isActive) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const responseId = searchParams.get('responseId');
    const targetCollegeId = searchParams.get('collegeId');

    if (!responseId) {
      return new NextResponse('Missing responseId parameter', { status: 400 });
    }

    const collegeId = targetCollegeId || session.activeCollegeId || session.colleges[0]?.collegeId;
    if (!collegeId) {
      return new NextResponse('No active institution context found', { status: 400 });
    }

    // Security check: ensure admin has access to this college
    if (!session.isPlatformSuperAdmin) {
      const hasAccess = session.colleges.some(
        (c) => c.collegeId === collegeId && c.status === 'ACTIVE'
      );
      if (!hasAccess) {
        return new NextResponse('Forbidden: Institutional access denied', { status: 403 });
      }
    }

    const isDownload = searchParams.get('download') === 'true' || searchParams.get('download') === '1';
    const disposition = isDownload ? 'attachment' : 'inline';

    const pdfBuffer = await generateGoogleEventParticipantPdf({
      collegeId,
      eventId: id,
      responseId,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="EventPass-${responseId}.pdf"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: any) {
    console.error('[GENERATE_EVENT_PDF_PASS_ERROR]', err);
    return new NextResponse(err.message || 'Failed to generate participant PDF pass', {
      status: 500,
    });
  }
}
