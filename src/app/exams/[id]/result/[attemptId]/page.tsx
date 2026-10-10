import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAttemptResult } from '@/lib/exams/exam-attempt-service';
import { StudentResultView } from '@/components/exams/StudentResultView';
import { getStudentSession } from '@/lib/auth/student-auth';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { ArrowLeft, Lock, ShieldAlert, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string; attemptId: string }>;
}

export default async function StudentExamResultPage({ params }: Props) {
  const { id, attemptId } = await params;

  let resultData;
  try {
    resultData = await getAttemptResult(attemptId);
  } catch (err) {
    notFound();
  }

  if (!resultData) {
    notFound();
  }

  const adminSession = await getAdminSession();
  const studentSession = await getStudentSession();

  const currentPath = `/exams/${id}/result/${attemptId}`;

  // 1. Guest user check
  if (!adminSession && (!studentSession || !studentSession.isAuthenticated || !studentSession.user)) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="bg-slate-900 text-white text-xs py-2 px-4 border-b border-slate-800">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
            <span className="font-semibold">
              {resultData.attempt.college?.name || 'CampusFlow'} • Examination Transcript
            </span>
            <Link href="/exams" className="text-slate-300 hover:text-white flex items-center gap-1 text-xs">
              <ArrowLeft className="w-3.5 h-3.5" /> Examination Hub
            </Link>
          </div>
        </div>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 max-w-md w-full text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center mx-auto border border-slate-200">
              <Lock className="w-7 h-7 text-slate-700" />
            </div>
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                <Lock className="w-3.5 h-3.5" />
                <span>Student Sign In Required</span>
              </span>
              <h1 className="text-xl font-bold text-slate-900">Sign In to View Scorecard</h1>
              <p className="text-xs text-slate-600 leading-relaxed">
                Examination results and official scorecards are private. Please sign in to verify your identity and view this transcript.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <Link
                href={`/auth/student/login?redirect=${encodeURIComponent(currentPath)}`}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-bce-navy hover:bg-slate-900 text-white font-bold text-xs shadow-md transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Sign In with Student Account</span>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 2. Ownership check for student accounts
  if (!adminSession && studentSession?.user) {
    const userEmail = (studentSession.user.email || '').toLowerCase().trim();
    const studentRegNo = (studentSession.student?.registrationNumber || '').toLowerCase().trim();
    const attemptEmail = (resultData.attempt.student_email || '').toLowerCase().trim();
    const attemptRegNo = (resultData.attempt.registration_number || '').toLowerCase().trim();

    const isOwner =
      (attemptEmail && attemptEmail === userEmail) ||
      (studentRegNo && attemptRegNo && studentRegNo === attemptRegNo);

    if (!isOwner) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
          <div className="bg-slate-900 text-white text-xs py-2 px-4 border-b border-slate-800">
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
              <span className="font-semibold">
                {resultData.attempt.college?.name || 'CampusFlow'} • Examination Transcript
              </span>
              <Link href="/exams" className="text-slate-300 hover:text-white flex items-center gap-1 text-xs">
                <ArrowLeft className="w-3.5 h-3.5" /> Examination Hub
              </Link>
            </div>
          </div>

          <main className="flex-1 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-red-200 shadow-sm p-6 sm:p-10 max-w-lg w-full text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-200">
                <ShieldAlert className="w-7 h-7 text-red-600" />
              </div>
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Access Restricted</span>
                </span>
                <h1 className="text-xl font-bold text-slate-900">Scorecard Belongs to Another Student</h1>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Students are only authorized to view and download their own examination transcripts.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2">
                <div className="flex justify-between items-center text-slate-600 pb-1.5 border-b border-slate-200/60">
                  <span className="text-slate-400">Scorecard Owner:</span>
                  <span className="font-bold text-slate-900">{resultData.attempt.student_name}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600 pb-1.5 border-b border-slate-200/60">
                  <span className="text-slate-400">Owner Roll/Reg #:</span>
                  <span className="font-mono font-bold text-slate-900">{resultData.attempt.registration_number}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span className="text-slate-400">Currently Logged In:</span>
                  <span className="font-semibold text-slate-800">{studentSession.user.email}</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <Link
                  href={`/auth/student/login?redirect=${encodeURIComponent(currentPath)}`}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-bce-navy hover:bg-slate-900 text-white font-bold text-xs shadow-md transition-colors"
                >
                  <span>Sign In with Owner Account</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href="/exams"
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                >
                  <span>Back to Exam Hub</span>
                </Link>
              </div>
            </div>
          </main>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar */}
      <div className="bg-slate-900 text-white text-xs py-2 px-4 border-b border-slate-800">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-semibold">
              {resultData.attempt.college?.name || 'CampusFlow'} • Examination Transcript
            </span>
          </div>
          <Link
            href="/exams"
            className="text-slate-300 hover:text-white flex items-center gap-1 text-xs font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Examination Hub
          </Link>
        </div>
      </div>

      <main className="flex-1 py-4">
        <StudentResultView resultData={resultData} />
      </main>
    </div>
  );
}
