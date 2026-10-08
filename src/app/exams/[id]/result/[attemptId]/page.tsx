import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAttemptResult } from '@/lib/exams/exam-attempt-service';
import { StudentResultView } from '@/components/exams/StudentResultView';
import { ArrowLeft } from 'lucide-react';

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
