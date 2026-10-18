'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Clock,
  HelpCircle,
  Layers,
  Calendar,
  ArrowRight,
  Search,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Lock,
  Sparkles,
} from 'lucide-react';
import { useStudentSession } from '@/lib/auth/use-student-session';
import type { Exam } from '@/types/exams';
import { ExamPadCard } from '@/components/ui/ExamPadCard';
import { RedPushpin } from '@/components/ui/RedPushpin';

interface PublicExamDiscoveryProps {
  exams: Exam[];
  collegeName?: string;
  collegeLogo?: string | null;
  tenantSlug?: string;
}

export function PublicExamDiscovery({
  exams,
  collegeName = 'Examination Hub',
  collegeLogo,
  tenantSlug,
}: PublicExamDiscoveryProps) {
  const { isAuthenticated, loading: sessionLoading } = useStudentSession();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');

  // Collect branches for filtering
  const allBranches = Array.from(
    new Map(
      exams
        .flatMap(e => e.branches || [])
        .map(b => [b.id, { id: b.id, name: b.name, code: b.code }])
    ).values()
  );

  const filteredExams = exams.filter(e => {
    if (branchFilter !== 'ALL') {
      const hasBranch = !e.branches || e.branches.length === 0 || e.branches.some(b => b.id === branchFilter);
      if (!hasBranch) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = e.title.toLowerCase().includes(q);
      const matchCode = (e.exam_code || '').toLowerCase().includes(q);
      const matchSub = (e.subjects || []).some(s => s.name.toLowerCase().includes(q));
      return matchTitle || matchCode || matchSub;
    }
    return true;
  });

  const getExamLink = (examId: string) => {
    return tenantSlug ? `/${tenantSlug}/exams/${examId}` : `/exams/${examId}`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-6 px-3 sm:px-6">
      {/* 1. ExamPad Header Banner */}
      <ExamPadCard variant="dashboard" clipLabel="EXAMINATION PORTAL">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            {collegeLogo && (
              <img
                src={collegeLogo}
                alt="Institution Logo"
                className="w-12 h-12 sm:w-14 sm:h-14 object-contain bg-white dark:bg-[#1a1208] rounded-[3px] p-1.5 border border-amber-900/30 dark:border-[#4d3817] shadow-xs shrink-0"
              />
            )}
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest block">
                Official Examination Portal
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-[#faebd0] truncate mt-0.5">
                {collegeName}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-[#c4a97d] mt-1 max-w-2xl leading-relaxed">
                Browse and attempt authorized departmental online tests, mid-semester evaluations, and quizzes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-amber-100/80 dark:bg-[#2b1f11] px-3.5 py-1.5 rounded-[3px] border border-amber-300/80 dark:border-amber-700/60 shrink-0">
            <GraduationCap className="w-4 h-4 text-amber-700 dark:text-amber-400" />
            <span className="text-xs font-bold text-amber-950 dark:text-amber-200">
              {exams.length} Open Test{exams.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </ExamPadCard>

      {/* 2. Search & Filter Ledger Bar */}
      <div className="exam-pad-board-dashboard rounded-lg p-2 sm:p-2.5 relative shadow-md">
        <RedPushpin className="-top-3" />
        <div className="pinned-paper-sheet bg-[#fffdfa] dark:bg-[#1a1208] border border-amber-900/30 dark:border-[#422e17] rounded-[3px] p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 dark:text-[#9e835b] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by test title, course code, or subject..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-[3px] border border-slate-300 dark:border-[#4d3817] bg-white dark:bg-[#1f150c] text-slate-900 dark:text-[#faebd0] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
            />
          </div>

          {allBranches.length > 0 && (
            <select
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              className="text-xs sm:text-sm px-3 py-2 rounded-[3px] border border-slate-300 dark:border-[#4d3817] bg-white dark:bg-[#1f150c] text-slate-900 dark:text-[#faebd0] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
            >
              <option value="ALL">All Departments / Branches</option>
              {allBranches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.code || b.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 3. Large Green Chalkboard Examination Bulletin Board */}
      <div className="border-8 sm:border-[12px] border-[#38210f] dark:border-[#201105] rounded-xl shadow-2xl p-4 sm:p-6 bg-[#143527] dark:bg-[#091a13] relative overflow-visible">
        {/* Brass Corner Brackets */}
        <div className="absolute top-1 left-1 w-4 h-4 border-t-2 border-l-2 border-amber-400/80 pointer-events-none rounded-tl-xs" />
        <div className="absolute top-1 right-1 w-4 h-4 border-t-2 border-r-2 border-amber-400/80 pointer-events-none rounded-tr-xs" />
        <div className="absolute bottom-1 left-1 w-4 h-4 border-b-2 border-l-2 border-amber-400/80 pointer-events-none rounded-bl-xs" />
        <div className="absolute bottom-1 right-1 w-4 h-4 border-b-2 border-r-2 border-amber-400/80 pointer-events-none rounded-br-xs" />

        {/* Chalk Title Bar */}
        <div className="text-center pb-5 mb-5 border-b border-dashed border-emerald-900/60 dark:border-emerald-950/60">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[3px] bg-emerald-950/70 border border-emerald-600/40 text-emerald-300 text-xs font-bold uppercase tracking-widest mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>CAMPUS EXAMINATION BULLETIN</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-amber-100 tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] font-mono">
            Official Scheduled Evaluations &amp; Quizzes
          </h2>
          <p className="text-xs sm:text-sm text-emerald-200/80 mt-1 max-w-xl mx-auto">
            Papers pinned below are verified departmental examinations. Verify your student session to attempt.
          </p>
        </div>

        {/* Exam Cards Grid */}
        {filteredExams.length === 0 ? (
          <div className="relative max-w-md mx-auto pinned-paper-sheet bg-[#fffdfa] dark:bg-[#191108] border border-amber-900/30 dark:border-[#422e17] rounded-[3px] p-8 sm:p-10 text-center shadow-2xl">
            <RedPushpin className="-top-3" />
            <FileText className="w-12 h-12 text-amber-700/60 dark:text-amber-400/60 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#faebd0]">No Examinations Available</h3>
            <p className="text-xs text-slate-600 dark:text-[#c4a97d] max-w-sm mx-auto mt-1">
              There are currently no active or published tests matching your selection. Please check back later or consult your faculty coordinator.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-3">
            {filteredExams.map(exam => {
              const subjectNames = (exam.subjects || []).map(s => s.name).join(', ') || 'General Assessment';
              const branchText =
                exam.branches && exam.branches.length > 0
                  ? exam.branches.map(b => b.code || b.name).join(', ')
                  : 'All Branches';

              return (
                <div
                  key={exam.id}
                  className="relative pinned-paper-sheet bg-[#fffdfa] dark:bg-[#191108] border border-amber-900/30 dark:border-[#422e17] hover:border-amber-600/60 rounded-[3px] p-5 shadow-xl hover:shadow-2xl transition-all flex flex-col justify-between space-y-4 group overflow-visible"
                >
                  {/* Red pushpin on top of each exam paper */}
                  <RedPushpin className="-top-3" />

                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-dashed border-amber-900/20 dark:border-[#382713]">
                      <span className="text-[11px] font-mono font-bold text-amber-950 dark:text-amber-200 bg-amber-100/80 dark:bg-[#2b1f11] px-2 py-0.5 rounded-[2px] border border-amber-300/80 dark:border-amber-800/60">
                        {exam.exam_code}
                      </span>
                      <span className="px-2 py-0.5 rounded-[2px] text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 uppercase">
                        Open
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-[#faebd0] group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors line-clamp-1">
                        {exam.title}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-[#c4a97d] line-clamp-1 font-medium mt-0.5">
                        {subjectNames}
                      </p>
                    </div>

                    {exam.description && (
                      <p className="text-xs text-slate-600 dark:text-[#c4a97d] line-clamp-2 leading-relaxed">
                        {exam.description}
                      </p>
                    )}

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs py-2.5 border-y border-amber-900/15 dark:border-[#382713] text-slate-700 dark:text-[#c4a97d]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>{exam.duration_minutes} Mins</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>{exam.total_questions || 0} Questions</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span className="truncate">{branchText}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>Pass: {exam.passing_percentage}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    {!isAuthenticated && !sessionLoading ? (
                      <Link
                        href={`/auth/student/login?redirect=${encodeURIComponent(getExamLink(exam.id))}`}
                        className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-[3px] text-xs font-bold text-slate-800 dark:text-[#faebd0] bg-amber-100/70 hover:bg-amber-200/80 dark:bg-[#2b1f11] dark:hover:bg-[#382613] border border-amber-300/80 dark:border-amber-800/60 shadow-2xs transition-all cursor-pointer active:scale-95"
                      >
                        <Lock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                        <span>Sign In to Attempt</span>
                      </Link>
                    ) : (
                      <Link
                        href={getExamLink(exam.id)}
                        className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-[3px] text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-2xs transition-all cursor-pointer active:scale-95 group-hover:shadow-md"
                      >
                        <span>Begin Examination</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
