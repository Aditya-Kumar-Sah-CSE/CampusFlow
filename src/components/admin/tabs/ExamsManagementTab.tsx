'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  FileText,
  Plus,
  Search,
  BarChart3,
  Edit,
  Trash2,
  Send,
  EyeOff,
  Clock,
  Layers,
  HelpCircle,
  AlertTriangle,
  Loader2,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import {
  publishExamAction,
  unpublishExamAction,
  deleteOrArchiveExamAction,
} from '@/app/admin/exams/actions';
import type { Exam } from '@/types/exams';
import { ExamPadCard } from '@/components/ui/ExamPadCard';
import { PinnedRosterBoard } from '@/components/ui/PinnedRosterBoard';

const VALID_EXAM_STATUSES = ['ALL', 'PUBLISHED', 'ACTIVE', 'DRAFT', 'CLOSED', 'ARCHIVED'] as const;
type ExamStatusFilter = (typeof VALID_EXAM_STATUSES)[number];

function normalizeExamStatus(val?: string | null): ExamStatusFilter {
  if (!val) return 'ALL';
  const upper = val.toUpperCase().trim();
  if (VALID_EXAM_STATUSES.includes(upper as ExamStatusFilter)) {
    return upper as ExamStatusFilter;
  }
  return 'ALL';
}

interface ExamsManagementTabProps {
  initialExams: Exam[];
  collegeId: string;
  initialSubTab?: string;
}

export function ExamsManagementTab({ initialExams, collegeId, initialSubTab }: ExamsManagementTabProps) {
  const searchParams = useSearchParams();

  const resolveStatusFilter = useCallback((): ExamStatusFilter => {
    const fromParam = searchParams?.get('subtab') || searchParams?.get('status');
    if (fromParam) {
      return normalizeExamStatus(fromParam);
    }
    if (initialSubTab) {
      return normalizeExamStatus(initialSubTab);
    }
    return 'ALL';
  }, [searchParams, initialSubTab]);

  const [exams, setExams] = useState<Exam[]>(initialExams);
  const [statusFilter, setStatusFilter] = useState<ExamStatusFilter>(() => resolveStatusFilter());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleStatusFilterChange = useCallback((nextStatus: ExamStatusFilter) => {
    setStatusFilter(nextStatus);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'exams');
      if (nextStatus === 'ALL') {
        url.searchParams.delete('subtab');
        url.searchParams.delete('status');
      } else {
        url.searchParams.set('subtab', nextStatus.toLowerCase());
      }
      window.history.pushState(null, '', url.toString());
    }
  }, []);

  // Listen for browser Back/Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sub = urlParams.get('subtab') || urlParams.get('status');
      setStatusFilter(normalizeExamStatus(sub || initialSubTab));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [initialSubTab]);

  // Sync on searchParams update
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sub = urlParams.get('subtab') || urlParams.get('status');
    const target = normalizeExamStatus(sub || initialSubTab);
    if (target !== statusFilter) {
      setStatusFilter(target);
    }
  }, [searchParams, initialSubTab, statusFilter]);

  // Filter exams
  const filteredExams = exams.filter(e => {
    if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = e.title.toLowerCase().includes(q);
      const matchCode = (e.exam_code || '').toLowerCase().includes(q);
      const matchSub = (e.subjects || []).some(s => s.name.toLowerCase().includes(q));
      return matchTitle || matchCode || matchSub;
    }
    return true;
  });

  const handleTogglePublish = async (exam: Exam) => {
    setLoadingId(exam.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      if (exam.status === 'PUBLISHED' || exam.status === 'ACTIVE') {
        if (!confirm(`Are you sure you want to unpublish "${exam.title}"? Students will no longer be able to take it.`)) {
          setLoadingId(null);
          return;
        }
        const res = await unpublishExamAction(exam.id, collegeId);
        if (!res.success) throw new Error(res.error);
        setExams(prev => prev.map(item => (item.id === exam.id ? { ...item, status: 'CLOSED' } : item)));
        setSuccessMsg(`Exam "${exam.title}" unpublished successfully.`);
      } else {
        const res = await publishExamAction(exam.id, collegeId);
        if (!res.success) throw new Error(res.error);
        setExams(prev => prev.map(item => (item.id === exam.id ? { ...item, status: 'PUBLISHED' } : item)));
        setSuccessMsg(`Exam "${exam.title}" published live.`);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Operation failed.');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (exam: Exam) => {
    if (!confirm(`Are you sure you want to remove or archive "${exam.title}"?`)) {
      return;
    }
    setLoadingId(exam.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await deleteOrArchiveExamAction(exam.id, collegeId);
      if (!res.success) throw new Error(res.message);

      if (res.actionTaken === 'DELETED') {
        setExams(prev => prev.filter(item => item.id !== exam.id));
        setSuccessMsg(`Exam "${exam.title}" deleted.`);
      } else {
        setExams(prev => prev.map(item => (item.id === exam.id ? { ...item, status: 'ARCHIVED' } : item)));
        setSuccessMsg(`Exam has existing student attempts and was safely ARCHIVED to protect student historical records.`);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Deletion failed.');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0">
      {/* Top Header Card on Authentic Exam Pad Card */}
      <ExamPadCard
        variant="dashboard"
        title="Examinations & Online Testing"
        subtitle="Create, manage, and evaluate multi-tenant examinations with automatic grading and official scorecards."
        icon={<FileText className="w-5 h-5 text-amber-700 dark:text-amber-400" />}
        badge="EXAM CONTROLLER"
        clipLabel="EXAM CONTROLLER"
        action={
          <Link
            href="/admin/dashboard/exams/create"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-[3px] shadow-xs transition-all cursor-pointer active:scale-95 border border-amber-500/40"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Exam</span>
          </Link>
        }
      >
        <div className="text-xs text-slate-600 dark:text-[#c4a97d] flex items-center justify-between flex-wrap gap-2 pt-1">
          <span>Official institutional examination roster and computer-based testing system.</span>
          <span className="font-mono text-[11px] text-amber-800 dark:text-amber-400 font-bold">
            Total Examinations: {exams.length} • Active/Published: {exams.filter(e => e.status === 'PUBLISHED' || e.status === 'ACTIVE').length}
          </span>
        </div>
      </ExamPadCard>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-[3px] text-red-900 dark:text-red-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-[3px] text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Examinations on Pinned Roster Board */}
      <PinnedRosterBoard
        title={`Configured Examinations (${filteredExams.length})`}
        subtitle="Institutional testing rosters and automated scorecards"
        badge={`${filteredExams.length} EXAMS`}
        icon={<FileText className="w-4 h-4" />}
        className="w-full"
      >
        {/* Filters & Search Header */}
        <div className="p-3 sm:p-4 border-b border-slate-200/80 dark:border-[#382713] flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-[#1f150c]/80">
          {/* Status Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {VALID_EXAM_STATUSES.map(st => (
              <button
                key={st}
                type="button"
                onClick={() => handleStatusFilterChange(st)}
                className={`px-3 py-1.5 rounded-[3px] text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-amber-500 text-slate-950 shadow-2xs border border-amber-600/50'
                    : 'bg-white dark:bg-[#1a1309] text-slate-600 dark:text-[#faebd0] hover:bg-slate-100 dark:hover:bg-[#2a1d10] border border-slate-200/90 dark:border-[#4d3817]'
                }`}
              >
                {st === 'ALL' ? 'All Exams' : st}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative min-w-[200px] max-w-xs flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search exam, code, or subject..."
              className="w-full pl-8 pr-3 py-1.5 min-h-[36px] bg-white dark:bg-[#1a1309] text-xs rounded-[3px] border border-slate-200/90 dark:border-[#4d3817] text-slate-800 dark:text-[#faebd0] placeholder:text-slate-400 dark:placeholder:text-[#c4a97d]/50 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Exams Grid Content */}
        <div className="p-3.5 sm:p-5">
          {filteredExams.length === 0 ? (
            <div className="bg-slate-50/70 dark:bg-[#1a1309] border border-slate-200/80 dark:border-[#382713] rounded-[3px] p-8 sm:p-12 text-center shadow-xs space-y-3">
              <FileText className="w-10 h-10 text-slate-300 dark:text-[#c4a97d]/40 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-[#faebd0]">No Examinations Found</h3>
              <p className="text-xs text-slate-400 dark:text-[#c4a97d]/70 max-w-md mx-auto">
                {searchQuery || statusFilter !== 'ALL'
                  ? 'No exams match your current filters. Try resetting the search or filter.'
                  : 'Create your first online examination with the guided wizard to get started.'}
              </p>
              {!searchQuery && statusFilter === 'ALL' && (
                <Link
                  href="/admin/dashboard/exams/create"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-[3px] transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Exam</span>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {filteredExams.map(exam => {
                const isLoading = loadingId === exam.id;
                const subjectNames = (exam.subjects || []).map(s => s.name).join(', ') || 'General';
                const branchText = (exam.branches && exam.branches.length > 0)
                  ? exam.branches.map(b => b.code).join(', ')
                  : 'All Branches';

                return (
                  <div
                    key={exam.id}
                    className="bg-white dark:bg-[#1f150c] border border-slate-200/90 dark:border-[#4d3817] hover:border-amber-500/50 dark:hover:border-amber-600/60 rounded-[3px] p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3.5 relative overflow-hidden"
                  >
                    {/* Corner accent for physical paper feel */}
                    <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-amber-600/40 pointer-events-none" />

                    {/* Header & Status */}
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-mono text-slate-400 dark:text-[#c4a97d] font-bold truncate">
                          {exam.exam_code}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-[2px] text-[10px] font-extrabold uppercase tracking-wider shrink-0 ${
                            exam.status === 'PUBLISHED' || exam.status === 'ACTIVE'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                              : exam.status === 'DRAFT'
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                                : 'bg-slate-100 dark:bg-[#2e1f10] text-slate-700 dark:text-[#c4a97d] border border-slate-200 dark:border-[#4d3817]'
                          }`}
                        >
                          {exam.status}
                        </span>
                      </div>

                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-[#faebd0] line-clamp-1">{exam.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-[#c4a97d] line-clamp-1 font-medium">{subjectNames}</p>
                    </div>

                    {/* Metadata Pills */}
                    <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-100 dark:border-[#382713] text-slate-600 dark:text-[#c4a97d]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-[#c4a97d]/70 shrink-0" />
                        <span>{exam.duration_minutes} mins</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-slate-400 dark:text-[#c4a97d]/70 shrink-0" />
                        <span>{exam.total_questions || 0} Questions</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-slate-400 dark:text-[#c4a97d]/70 shrink-0" />
                        <span className="truncate">{branchText}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-[#c4a97d]/70 shrink-0" />
                        <span>Pass: {exam.passing_percentage}%</span>
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div className="flex items-center justify-between gap-1.5 pt-1">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/admin/dashboard/exams/${exam.id}`}
                          title="Edit exam & questions"
                          className="p-1.5 sm:p-2 text-slate-600 dark:text-[#faebd0] hover:text-amber-700 hover:bg-slate-100 dark:hover:bg-[#2a1d10] rounded-[3px] border border-slate-200/80 dark:border-[#4d3817] transition-colors cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Link>

                        <Link
                          href={`/admin/dashboard/exams/${exam.id}/results`}
                          title="View Student Results & Analytics"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-[3px] border border-blue-200/80 dark:border-blue-800/60 transition-colors cursor-pointer"
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                          <span>Results</span>
                        </Link>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleTogglePublish(exam)}
                          title={exam.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                          className={`p-1.5 sm:p-2 rounded-[3px] text-xs font-bold transition-colors cursor-pointer border border-slate-200/80 dark:border-[#4d3817] ${
                            exam.status === 'PUBLISHED' || exam.status === 'ACTIVE'
                              ? 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-[#2e1f10]'
                              : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                          }`}
                        >
                          {isLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : exam.status === 'PUBLISHED' || exam.status === 'ACTIVE' ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleDelete(exam)}
                          title="Delete or Archive Exam"
                          className="p-1.5 sm:p-2 text-slate-400 dark:text-[#c4a97d] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-[3px] border border-slate-200/80 dark:border-[#4d3817] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PinnedRosterBoard>
    </div>
  );
}
