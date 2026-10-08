'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Download,
  Search,
  Filter,
  BarChart2,
  Users,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
  ArrowUpDown,
  ArrowLeft,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import type { ExamResultsDashboardData, ExamAttempt } from '@/types/exams';

interface ExamResultsConsoleProps {
  data: ExamResultsDashboardData;
  collegeId: string;
}

export function ExamResultsConsole({ data, collegeId }: ExamResultsConsoleProps) {
  const { exam, summary, attempts, question_analytics } = data;

  const [activeTab, setActiveTab] = useState<'roster' | 'analytics'>('roster');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<'score' | 'percentage' | 'name' | 'date'>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Filter student attempts
  const filteredAttempts = (attempts || []).filter((a: any) => {
    if (statusFilter === 'PASS' && !a.is_passed) return false;
    if (statusFilter === 'FAIL' && (a.is_passed || a.status === 'IN_PROGRESS')) return false;
    if (statusFilter === 'IN_PROGRESS' && a.status !== 'IN_PROGRESS') return false;
    if (branchFilter !== 'ALL' && a.branch_id !== branchFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (a.student_name || '').toLowerCase().includes(q);
      const matchRoll = (a.roll_number || '').toLowerCase().includes(q);
      const matchReg = (a.registration_number || '').toLowerCase().includes(q);
      return matchName || matchRoll || matchReg;
    }
    return true;
  });

  // Sort student attempts
  const sortedAttempts = [...filteredAttempts].sort((a: any, b: any) => {
    let cmp = 0;
    if (sortField === 'score') cmp = (a.obtained_marks || 0) - (b.obtained_marks || 0);
    else if (sortField === 'percentage') cmp = (a.percentage || 0) - (b.percentage || 0);
    else if (sortField === 'name') cmp = (a.student_name || '').localeCompare(b.student_name || '');
    else if (sortField === 'date') {
      const da = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
      const db = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
      cmp = da - db;
    }
    return sortAsc ? cmp : -cmp;
  });

  // Extract unique branches from attempts for filtering
  const availableBranches: { id: string; name: string; code: string }[] = Array.from(
    new Map(
      (attempts || [])
        .filter((a: any) => a.branch)
        .map((a: any) => [a.branch!.id, { id: a.branch!.id, name: a.branch!.name, code: a.branch!.code || '' }])
    ).values()
  );

  const handleDownloadRosterPdf = () => {
    window.open(`/api/exams/pdf/roster?examId=${exam.id}&collegeId=${collegeId}`, '_blank');
  };

  const handleDownloadStudentPdf = (attemptId: string) => {
    window.open(`/api/exams/pdf/result?attemptId=${attemptId}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Navigation */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin/dashboard/exams"
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-bce-navy transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Exams</span>
            </Link>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-mono text-slate-400">{exam.exam_code}</span>
          </div>
          <h1 className="text-lg sm:text-xl font-extrabold text-bce-navy">{exam.title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Subject: {(exam.subjects || []).map((s: any) => s.name).join(', ') || 'N/A'} • Session: {(exam.academic_session as any)?.name || (exam.academic_session as any)?.year_range || 'N/A'} • {exam.duration_minutes} mins
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleDownloadRosterPdf}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-bce-navy hover:bg-slate-900 rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Master Roster PDF</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">Total Attempts</span>
          <span className="text-lg font-extrabold text-slate-900 mt-1 block">{summary.total_attempts}</span>
          <span className="text-[10px] text-slate-400">{summary.unique_students_count} unique students</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">Average Score</span>
          <span className="text-lg font-extrabold text-blue-700 mt-1 block">{summary.average_score}</span>
          <span className="text-[10px] text-blue-600 font-semibold">{summary.average_percentage}% average</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">Highest Score</span>
          <span className="text-lg font-extrabold text-emerald-700 mt-1 block">{summary.highest_score}</span>
          <span className="text-[10px] text-slate-400">out of {exam.total_marks || 0} marks</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">Lowest Score</span>
          <span className="text-lg font-extrabold text-amber-700 mt-1 block">{summary.lowest_score}</span>
          <span className="text-[10px] text-slate-400">submitted attempt</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">Pass Count</span>
          <span className="text-lg font-extrabold text-emerald-700 mt-1 block">{summary.pass_count}</span>
          <span className="text-[10px] text-emerald-600 font-semibold">{summary.pass_percentage}% success</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">Fail Count</span>
          <span className="text-lg font-extrabold text-red-700 mt-1 block">{summary.fail_count}</span>
          <span className="text-[10px] text-red-500 font-semibold">below {exam.passing_percentage}%</span>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="flex items-center gap-1 p-2 border-b border-slate-100 bg-slate-50/70">
          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'roster'
                ? 'bg-bce-navy text-amber-300 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Student Results Roster ({attempts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-bce-navy text-amber-300 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Question Accuracy Analytics ({question_analytics.length})
          </button>
        </div>

        {/* Tab 1: Student Results Roster */}
        {activeTab === 'roster' && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-sm">
                <div className="relative w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search name, roll number, or reg..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-bce-cobalt"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Branch filter */}
                {availableBranches.length > 0 && (
                  <select
                    value={branchFilter}
                    onChange={e => setBranchFilter(e.target.value)}
                    className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="ALL">All Branches</option>
                    {availableBranches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.code || b.name}
                      </option>
                    ))}
                  </select>
                )}

                {/* Status filter */}
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PASS">Passed Only</option>
                  <option value="FAIL">Failed Only</option>
                  <option value="IN_PROGRESS">In Progress</option>
                </select>

                {/* Sorting */}
                <button
                  type="button"
                  onClick={() => {
                    if (sortField === 'score') setSortAsc(!sortAsc);
                    else {
                      setSortField('score');
                      setSortAsc(false);
                    }
                  }}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl border cursor-pointer ${
                    sortField === 'score'
                      ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>Score</span>
                </button>
              </div>
            </div>

            {/* Results Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Roll No</th>
                    <th className="py-2.5 px-3">Reg No</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Branch</th>
                    <th className="py-2.5 px-3">Attempt</th>
                    <th className="py-2.5 px-3">Score</th>
                    <th className="py-2.5 px-3">Pct %</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Submitted At</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedAttempts.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-400">
                        No student attempts match the active filter criteria.
                      </td>
                    </tr>
                  ) : (
                    sortedAttempts.map((att, idx) => (
                      <tr key={att.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{att.roll_number}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{att.registration_number}</td>
                        <td className="py-2.5 px-3 font-bold text-bce-navy">{att.student_name}</td>
                        <td className="py-2.5 px-3 text-slate-600">{att.branch?.code || att.branch?.name || 'General'}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">#{att.attempt_number}</td>
                        <td className="py-2.5 px-3 font-extrabold text-slate-900">
                          {att.obtained_marks} / {att.total_marks}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-700">{att.percentage}%</td>
                        <td className="py-2.5 px-3">
                          {att.status === 'IN_PROGRESS' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                              In Progress
                            </span>
                          ) : att.is_passed ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                              PASS
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-900 border border-red-200">
                              FAIL
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-500">
                          {att.submitted_at ? new Date(att.submitted_at).toLocaleDateString() : 'Active'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDownloadStudentPdf(att.id)}
                            title="Download Official Scorecard PDF"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-bce-navy hover:text-slate-950 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            <span>PDF</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Question Accuracy Analytics */}
        {activeTab === 'analytics' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                Question analytics reflect real student answers. Questions with accuracy below 40% are flagged as high difficulty.
              </span>
            </div>

            <div className="space-y-3">
              {(question_analytics || []).map((qa: any, idx: number) => {
                const isChallenging = qa.accuracy_percentage < 40 && qa.attempted_count > 0;
                const isModerate = qa.accuracy_percentage >= 40 && qa.accuracy_percentage < 75;
                const isEasy = qa.accuracy_percentage >= 75;

                return (
                  <div key={qa.question_id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-extrabold bg-bce-navy text-white">
                          Q{idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-800">{qa.question_text}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isChallenging && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-900 border border-red-200">
                            Challenging (Low Accuracy)
                          </span>
                        )}
                        {isModerate && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                            Moderate
                          </span>
                        )}
                        {isEasy && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                            High Mastery
                          </span>
                        )}
                        <span className="text-xs font-mono font-bold text-slate-700">
                          {qa.accuracy_percentage}% Accuracy
                        </span>
                      </div>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          qa.accuracy_percentage >= 70
                            ? 'bg-emerald-500'
                            : qa.accuracy_percentage >= 40
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                        }`}
                        style={{ width: `${qa.accuracy_percentage}%` }}
                      />
                    </div>

                    {/* Breakdown metrics */}
                    <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1">
                      <span>Total Attempts: <strong className="text-slate-800">{qa.total_attempts}</strong></span>
                      <span className="text-emerald-700">Correct: <strong>{qa.correct_count}</strong></span>
                      <span className="text-red-700">Wrong: <strong>{qa.wrong_count}</strong></span>
                      <span className="text-slate-400">Unanswered: <strong>{qa.unanswered_count}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
