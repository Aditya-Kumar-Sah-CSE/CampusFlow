'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Plus,
  Search,
  Filter,
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

interface ExamsManagementTabProps {
  initialExams: Exam[];
  collegeId: string;
}

export function ExamsManagementTab({ initialExams, collegeId }: ExamsManagementTabProps) {
  const [exams, setExams] = useState<Exam[]>(initialExams);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-bce-navy">
            Examinations & Online Testing
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Create, manage, and evaluate multi-tenant examinations with automatic grading and official scorecards.
          </p>
        </div>

        <Link
          href="/admin/dashboard/exams/create"
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-bce-navy hover:bg-slate-900 rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Exam</span>
        </Link>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {['ALL', 'PUBLISHED', 'ACTIVE', 'DRAFT', 'CLOSED', 'ARCHIVED'].map(st => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-bce-navy text-amber-300 shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'ALL' ? 'All Exams' : st}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[200px] max-w-xs flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search exam, code, or subject..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-bce-cobalt"
          />
        </div>
      </div>

      {/* Exams Grid */}
      {filteredExams.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs space-y-3">
          <FileText className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">No Examinations Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {searchQuery || statusFilter !== 'ALL'
              ? 'No exams match your current filters. Try resetting the search or filter.'
              : 'Create your first online examination with the guided wizard to get started.'}
          </p>
          {!searchQuery && statusFilter === 'ALL' && (
            <Link
              href="/admin/dashboard/exams/create"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-bce-navy hover:bg-slate-900 rounded-xl transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Exam</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExams.map(exam => {
            const isLoading = loadingId === exam.id;
            const subjectNames = (exam.subjects || []).map(s => s.name).join(', ') || 'General';
            const branchText = (exam.branches && exam.branches.length > 0)
              ? exam.branches.map(b => b.code).join(', ')
              : 'All Branches';

            return (
              <div
                key={exam.id}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                {/* Header & Status */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-mono text-slate-400 font-semibold truncate">
                      {exam.exam_code}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider shrink-0 ${
                        exam.status === 'PUBLISHED' || exam.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                          : exam.status === 'DRAFT'
                            ? 'bg-amber-100 text-amber-900 border border-amber-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {exam.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-extrabold text-bce-navy line-clamp-1">{exam.title}</h3>
                  <p className="text-xs text-slate-500 line-clamp-1 font-medium">{subjectNames}</p>
                </div>

                {/* Metadata Pills */}
                <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-100 text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{exam.duration_minutes} mins</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{exam.total_questions || 0} Questions</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{branchText}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Pass: {exam.passing_percentage}%</span>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="flex items-center justify-between gap-1.5 pt-1">
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/admin/dashboard/exams/${exam.id}`}
                      title="Edit exam & questions"
                      className="p-2 text-slate-600 hover:text-bce-navy hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                    >
                      <Edit className="w-4 h-4" />
                    </Link>

                    <Link
                      href={`/admin/dashboard/exams/${exam.id}/results`}
                      title="View Student Results & Analytics"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors cursor-pointer"
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
                      className={`p-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        exam.status === 'PUBLISHED' || exam.status === 'ACTIVE'
                          ? 'text-amber-700 hover:bg-amber-50'
                          : 'text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : exam.status === 'PUBLISHED' || exam.status === 'ACTIVE' ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleDelete(exam)}
                      title="Delete or Archive Exam"
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
