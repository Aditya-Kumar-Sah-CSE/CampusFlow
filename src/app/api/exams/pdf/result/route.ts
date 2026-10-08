import { NextRequest, NextResponse } from 'next/server';
import { generateStudentResultPdf } from '@/lib/exams/exam-pdf';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const attemptId = searchParams.get('attemptId');

    if (!attemptId) {
      return NextResponse.json({ error: 'Attempt ID is required' }, { status: 400 });
    }

    const pdfBuffer = await generateStudentResultPdf(attemptId);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="CampusFlow-Exam-Scorecard-${attemptId.slice(0, 8)}.pdf"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error('Error generating student result PDF:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate result scorecard PDF' },
      { status: 500 }
    );
  }
}
