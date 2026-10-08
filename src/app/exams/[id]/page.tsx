import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPublicExamDetails } from '@/lib/exams/exam-attempt-service';
import { StudentExamPortal } from '@/components/exams/StudentExamPortal';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function StudentExamTakingPage({ params }: Props) {
  const { id } = await params;

  let exam;
  try {
    exam = await getPublicExamDetails(id);
  } catch (err) {
    notFound();
  }

  if (!exam) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar */}
      <div className="bg-slate-900 text-white text-xs py-2 px-4 border-b border-slate-800">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold">{exam.college?.name || 'CampusFlow'} • Online Examination</span>
          </div>
          <Link
            href="/exams"
            className="text-slate-300 hover:text-white flex items-center gap-1 text-xs font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> All Tests
          </Link>
        </div>
      </div>

      <main className="flex-1 py-4">
        <StudentExamPortal exam={exam} />
      </main>
    </div>
  );
}
