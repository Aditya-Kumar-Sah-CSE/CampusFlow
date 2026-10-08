import { NextRequest, NextResponse } from 'next/server';
import { assertExamFacultyAccess } from '@/lib/exams/exam-permission';
import { generateExamRosterPdf } from '@/lib/exams/exam-pdf';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const examId = searchParams.get('examId');
    const collegeId = searchParams.get('collegeId') || undefined;

    if (!examId) {
      return NextResponse.json({ error: 'Exam ID is required' }, { status: 400 });
    }

    const { authorizedCollegeId } = await assertExamFacultyAccess(collegeId);

    const pdfBuffer = await generateExamRosterPdf(examId, authorizedCollegeId);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="CampusFlow-Exam-Roster-${examId.slice(0, 8)}.pdf"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error('Error generating exam roster PDF:', error);
    const status = error?.message?.includes('Unauthorized')
      ? 401
      : error?.message?.includes('Forbidden')
        ? 403
        : 500;
    return NextResponse.json(
      { error: error?.message || 'Failed to generate exam results roster PDF' },
      { status }
    );
  }
}
