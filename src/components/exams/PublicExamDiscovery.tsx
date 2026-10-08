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
} from 'lucide-react';
import type { Exam } from '@/types/exams';

interface PublicExamDiscoveryProps {
  exams: Exam[];
  collegeName?: string;
  collegeLogo?: string | null;
  tenantSlug?: string;
}

export function PublicExamDiscovery({
  exams,
  collegeName = 'CampusFlow Examination Hub',
  collegeLogo,
  tenantSlug,
}: PublicExamDiscoveryProps) {
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
    <div className="max-w-6xl mx-auto space-y-6 py-6 px-4 sm:px-6">
      {/* Institution Banner */}
      <div className="bg-gradient-to-r from-bce-navy via-slate-900 to-bce-navy text-white rounded-3xl p-6 sm:p-8 shadow-md border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {collegeLogo && (
              <img
                src={collegeLogo}
                alt="Institution Logo"
                className="w-14 h-14 object-contain bg-white/10 rounded-2xl p-1.5 backdrop-blur-xs border border-white/20"
              />
            )}
            <div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest block">
                Official Examination Portal
              </span>
              <h1 className="text-xl sm:text-2xl font-black mt-0.5">{collegeName}</h1>
              <p className="text-xs text-slate-300 mt-1 max-w-xl">
                Browse and attempt authorized departmental online tests, mid-semester evaluations, and quizzes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/10 px-3.5 py-1.5 rounded-2xl backdrop-blur-xs border border-white/10">
            <GraduationCap className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-slate-200">{exams.length} Open Tests</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by test title, course code, or subject..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30"
          />
        </div>

        {allBranches.length > 0 && (
          <select
            value={branchFilter}
            onChange={e => setBranchFilter(e.target.value)}
            className="text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-200 bg-white"
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

      {/* Exam Cards Grid */}
      {filteredExams.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs space-y-3">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">No Examinations Available</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            There are currently no active or published tests matching your selection. Please check back later or consult your faculty coordinator.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredExams.map(exam => {
            const subjectNames = (exam.subjects || []).map(s => s.name).join(', ') || 'General Assessment';
            const branchText =
              exam.branches && exam.branches.length > 0
                ? exam.branches.map(b => b.code || b.name).join(', ')
                : 'All Branches';

            return (
              <div
                key={exam.id}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-bold text-bce-navy bg-slate-100 px-2.5 py-0.5 rounded-lg">
                      {exam.exam_code}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-200 uppercase">
                      Open
                    </span>
                  </div>

                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 group-hover:text-bce-navy transition-colors line-clamp-1">
                      {exam.title}
                    </h2>
                    <p className="text-xs text-slate-500 line-clamp-1 font-medium mt-0.5">{subjectNames}</p>
                  </div>

                  {exam.description && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {exam.description}
                    </p>
                  )}

                  {/* Metadata grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs py-2.5 border-y border-slate-100 text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>{exam.duration_minutes} Mins</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{exam.total_questions || 0} Questions</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span className="truncate">{branchText}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Pass: {exam.passing_percentage}%</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    href={getExamLink(exam.id)}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-bce-navy hover:bg-slate-900 shadow-xs transition-all cursor-pointer active:scale-95 group-hover:shadow-md"
                  >
                    <span>Begin Examination</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
