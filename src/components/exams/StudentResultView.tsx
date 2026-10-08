'use client';

import {
  CheckCircle2,
  XCircle,
  Download,
  FileText,
  Clock,
  Layers,
  Award,
  AlertCircle,
  Calendar,
  HelpCircle,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import type { ExamAttemptResult } from '@/types/exams';

interface StudentResultViewProps {
  resultData: ExamAttemptResult;
  tenantSlug?: string;
}

export function StudentResultView({ resultData, tenantSlug }: StudentResultViewProps) {
  const { attempt, exam, breakdown, can_view_breakdown, can_view_answers } = resultData;

  const isPassed = attempt.is_passed;
  const backLink = tenantSlug ? `/${tenantSlug}/exams` : '/exams';

  const handleDownloadPdf = () => {
    window.open(`/api/exams/pdf/result?attemptId=${attempt.id}`, '_blank');
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href={backLink}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-bce-navy transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Tests</span>
        </Link>

        <button
          type="button"
          onClick={handleDownloadPdf}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-bce-navy hover:bg-slate-900 rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download Scorecard PDF</span>
        </button>
      </div>

      {/* Main Score Card Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <span className="text-xs font-mono font-bold text-slate-400 block">{exam.exam_code}</span>
            <h1 className="text-xl sm:text-2xl font-black text-bce-navy mt-0.5">{exam.title}</h1>
            <p className="text-xs text-slate-500 mt-1">
              Subject: {(exam.subjects || []).map((s: any) => s.name).join(', ') || 'N/A'} • Completed on {new Date(attempt.submitted_at || attempt.created_at).toLocaleString()}
            </p>
          </div>

          <div className="text-right">
            <span
              className={`px-3.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider inline-flex items-center gap-1.5 ${
                isPassed
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  : 'bg-red-100 text-red-900 border border-red-300'
              }`}
            >
              {isPassed ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
              <span>{isPassed ? 'PASSED' : 'FAILED'}</span>
            </span>
          </div>
        </div>

        {/* Score Display Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Big Score Box */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/50 border border-slate-200/80 flex flex-col justify-center items-center text-center space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Score</span>
            <div className="text-3xl sm:text-4xl font-black text-bce-navy">
              {attempt.obtained_marks}
              <span className="text-lg font-bold text-slate-400 font-sans"> / {attempt.total_marks}</span>
            </div>
            <span className="text-xs font-extrabold text-blue-700 bg-blue-100/80 px-2.5 py-0.5 rounded-full">
              {attempt.percentage}% Score
            </span>
          </div>

          {/* Student Info Box */}
          <div className="md:col-span-2 p-5 rounded-2xl bg-slate-50 border border-slate-200/80 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block font-semibold">Student Name</span>
              <span className="font-extrabold text-slate-900 text-sm">{attempt.student_name}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold">Roll Number</span>
              <span className="font-mono font-bold text-slate-900">{attempt.roll_number}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold">Registration No</span>
              <span className="font-mono font-bold text-slate-900">{attempt.registration_number}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold">Attempt & Status</span>
              <span className="font-bold text-slate-800">
                Attempt #{attempt.attempt_number} • {attempt.status}
              </span>
            </div>
          </div>
        </div>

        {/* Breakdown Metric Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2">
          <div className="p-3 rounded-xl border border-slate-200 bg-white text-center">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Questions</span>
            <span className="text-base font-extrabold text-slate-900">{attempt.total_questions || 0}</span>
          </div>
          <div className="p-3 rounded-xl border border-slate-200 bg-white text-center">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Attempted</span>
            <span className="text-base font-extrabold text-blue-700">{attempt.attempted_count || 0}</span>
          </div>
          <div className="p-3 rounded-xl border border-slate-200 bg-white text-center">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Correct</span>
            <span className="text-base font-extrabold text-emerald-700">{attempt.correct_count || 0}</span>
          </div>
          <div className="p-3 rounded-xl border border-slate-200 bg-white text-center">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Wrong</span>
            <span className="text-base font-extrabold text-red-700">{attempt.wrong_count || 0}</span>
          </div>
          <div className="p-3 rounded-xl border border-slate-200 bg-white text-center">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Unanswered</span>
            <span className="text-base font-extrabold text-amber-700">{attempt.unanswered_count || 0}</span>
          </div>
        </div>
      </div>

      {/* Question Breakdown Section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-bce-navy">Question-by-Question Evaluation</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review your answers and verified marks awarded per question.
            </p>
          </div>
        </div>

        {!can_view_breakdown ? (
          <div className="p-6 text-center text-slate-400 space-y-2">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold">
              Detailed question solutions will be released once all examination cohorts conclude.
            </p>
          </div>
        ) : breakdown.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">
            No questions available for breakdown.
          </div>
        ) : (
          <div className="space-y-3">
            {breakdown.map((q: any, idx: number) => {
              const isCorrect = q.is_correct;
              const isUnanswered = q.is_unanswered;

              return (
                <div
                  key={q.question_id}
                  className={`p-4 rounded-2xl border text-xs space-y-2.5 transition-all ${
                    isCorrect
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : isUnanswered
                        ? 'border-slate-200 bg-slate-50/50'
                        : 'border-red-200 bg-red-50/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                        Q{idx + 1}
                      </span>
                      <span className="font-bold text-slate-900">{q.question_text}</span>
                    </div>

                    <div className="shrink-0 text-right">
                      <span
                        className={`font-mono font-extrabold ${
                          q.marks_awarded > 0
                            ? 'text-emerald-700'
                            : q.marks_awarded < 0
                              ? 'text-red-700'
                              : 'text-slate-400'
                        }`}
                      >
                        {q.marks_awarded > 0 ? `+${q.marks_awarded}` : q.marks_awarded} / {q.max_marks}m
                      </span>
                    </div>
                  </div>

                  {/* Answers summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Your Selection</span>
                      <span
                        className={`font-semibold ${
                          isCorrect ? 'text-emerald-700' : isUnanswered ? 'text-slate-400 italic' : 'text-red-700'
                        }`}
                      >
                        {q.selected_option_text || (isUnanswered ? 'Not Attempted' : '—')}
                      </span>
                    </div>

                    {can_view_answers && (
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Correct Answer</span>
                        <span className="font-semibold text-emerald-700">
                          {q.correct_option_text || '—'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Explanation if present */}
                  {q.explanation && can_view_answers && (
                    <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-200/60 text-blue-900 text-[11px]">
                      <strong>Explanation:</strong> {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
