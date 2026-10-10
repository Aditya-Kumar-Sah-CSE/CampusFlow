import { NextRequest, NextResponse } from 'next/server';
import { generateStudentResultPdf } from '@/lib/exams/exam-pdf';
import { getStudentSession } from '@/lib/auth/student-auth';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { getExamDbClient } from '@/lib/exams/exam-permission';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const attemptId = searchParams.get('attemptId');

    if (!attemptId) {
      return NextResponse.json({ error: 'Attempt ID is required' }, { status: 400 });
    }

    const adminSession = await getAdminSession();
    const studentSession = await getStudentSession();

    if (!adminSession && (!studentSession || !studentSession.isAuthenticated || !studentSession.user)) {
      return NextResponse.json(
        { error: 'Sign in required: Please sign in to download your examination scorecard.' },
        { status: 401 }
      );
    }

    // Verify ownership for student
    if (!adminSession && studentSession?.user) {
      const db = await getExamDbClient();
      const { data: attempt, error: attErr } = await db
        .from('exam_attempts')
        .select('id, student_email, registration_number')
        .eq('id', attemptId)
        .single();

      if (attErr || !attempt) {
        return NextResponse.json({ error: 'Exam attempt record not found' }, { status: 404 });
      }

      const userEmail = (studentSession.user.email || '').toLowerCase().trim();
      const studentRegNo = (studentSession.student?.registrationNumber || '').toLowerCase().trim();
      const attemptEmail = (attempt.student_email || '').toLowerCase().trim();
      const attemptRegNo = (attempt.registration_number || '').toLowerCase().trim();

      const isOwner =
        (attemptEmail && attemptEmail === userEmail) ||
        (studentRegNo && attemptRegNo && studentRegNo === attemptRegNo);

      if (!isOwner) {
        return NextResponse.json(
          {
            error:
              'Access denied: You can only download your own examination scorecard. Please sign in with the student account that completed this test.',
          },
          { status: 403 }
        );
      }
    }

    const pdfBuffer = await generateStudentResultPdf(attemptId);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="CampusFlow-Exam-Scorecard-${attemptId.slice(0, 8)}.pdf"`,
        'Cache-Control': 'private, max-age=3600, stale-while-revalidate=86400',
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
