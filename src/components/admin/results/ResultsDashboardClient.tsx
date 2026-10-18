'use client';

import React, { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import {
  ParameterScoreBarChart,
  ParameterDistributionStackedChart,
  OverallDonutChart,
  FacultyComparisonBarChart,
} from './AnalyticsCharts';
import { AggregatedAnalyticsReport } from '@/lib/analytics/types';
import { getOverallAnalyticsAction } from '@/app/admin/results/actions';
import {
  AcademicYear,
  Branch,
  Semester,
  Faculty,
  Subject,
  FeedbackForm,
} from '@/types/database';
import { downloadPdfFile } from '@/lib/utils/pdf-download';
import { PdfDownloadUpgradeModal } from '@/components/admin/pdf/PdfDownloadUpgradeModal';
import { PaginationControl } from '@/components/ui/PaginationControl';
import { PinnedRosterBoard } from '@/components/ui/PinnedRosterBoard';
import {
  FileDown,
  RefreshCw,
  ChevronRight,
  Filter,
  BarChart3,
  Star,
  Users,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';

interface Props {
  initialReport: AggregatedAnalyticsReport;
  academicYears: AcademicYear[];
  branches: Branch[];
  semesters: Semester[];
  faculties: Faculty[];
  subjects: Subject[];
  forms: FeedbackForm[];
}

export function ResultsDashboardClient({
  initialReport,
  academicYears,
  branches,
  semesters,
  faculties,
  subjects,
  forms,
}: Props) {
  const [report, setReport] = useState<AggregatedAnalyticsReport>(initialReport);
  const [isPending, startTransition] = useTransition();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [navigatingFormId, setNavigatingFormId] = useState<string | null>(null);
  const [downloadingPdfFormId, setDownloadingPdfFormId] = useState<string | null>(null);
  const [downloadingScopePdf, setDownloadingScopePdf] = useState(false);
  const [pdfNotification, setPdfNotification] = useState<string | null>(null);
  const [pendingPdfDownload, setPendingPdfDownload] = useState<{
    url: string;
    defaultFilename: string;
    title: string;
    onDownload: () => Promise<void>;
  } | null>(null);

  const executeDownloadFormPdf = async (formId: string, facultyName?: string) => {
    if (downloadingPdfFormId) return;
    setDownloadingPdfFormId(formId);
    setPdfNotification(null);
    try {
      await downloadPdfFile({
        url: `/api/admin/results/${formId}/pdf`,
        defaultFilename: facultyName ? `evaluation-${encodeURIComponent(facultyName)}.pdf` : `form-report-${formId}.pdf`,
        onError: (err) => {
          setPdfNotification(typeof err === 'string' ? err : err.message);
          setTimeout(() => setPdfNotification(null), 4500);
        },
      });
    } finally {
      setDownloadingPdfFormId(null);
    }
  };

  const executeDownloadScopePdf = async () => {
    if (downloadingScopePdf) return;
    setDownloadingScopePdf(true);
    setPdfNotification(null);
    try {
      await downloadPdfFile({
        url: pdfExportUrl,
        defaultFilename: 'institutional-feedback-report.pdf',
        onError: (err) => {
          setPdfNotification(typeof err === 'string' ? err : err.message);
          setTimeout(() => setPdfNotification(null), 5000);
        },
      });
    } finally {
      setDownloadingScopePdf(false);
    }
  };

  const handleInitiateFormPdf = (formId: string, facultyName?: string, formTitle?: string) => {
    setPendingPdfDownload({
      url: `/api/admin/results/${formId}/pdf`,
      defaultFilename: facultyName ? `evaluation-${encodeURIComponent(facultyName)}.pdf` : `form-report-${formId}.pdf`,
      title: `${formTitle || 'Faculty Feedback Evaluation Report'} (${facultyName || 'Faculty'})`,
      onDownload: () => executeDownloadFormPdf(formId, facultyName),
    });
  };

  const handleInitiateScopePdf = () => {
    setPendingPdfDownload({
      url: pdfExportUrl,
      defaultFilename: 'institutional-feedback-report.pdf',
      title: `Institutional Overall Feedback Report — ${report.scopeTitle || 'Active Scope'}`,
      onDownload: executeDownloadScopePdf,
    });
  };

  const handleProceedWithWatermark = async () => {
    if (!pendingPdfDownload) return;
    const downloadTask = pendingPdfDownload.onDownload;
    setPendingPdfDownload(null);
    await downloadTask();
  };

  // Scope filter states
  const [academicYearId, setAcademicYearId] = useState<string>('ALL');
  const [branchId, setBranchId] = useState<string>('ALL');
  const [semesterId, setSemesterId] = useState<string>('ALL');
  const [facultyId, setFacultyId] = useState<string>('ALL');
  const [subjectId, setSubjectId] = useState<string>('ALL');

  // Multi-tier Branch Filter: exclude hidden branches
  const activeBranches = useMemo(() => {
    return branches.filter(b => b.is_active !== false);
  }, [branches]);

  const activeFiltersCount = [academicYearId, branchId, semesterId, facultyId, subjectId].filter(
    v => v !== 'ALL'
  ).length;

  const handleFilterChange = (
    newYear: string,
    newBranch: string,
    newSemester: string,
    newFaculty: string,
    newSubject: string
  ) => {
    startTransition(async () => {
      const res = await getOverallAnalyticsAction({
        academicYearId: newYear,
        branchId: newBranch,
        semesterId: newSemester,
        facultyId: newFaculty,
        subjectId: newSubject,
      });

      if (res.success && res.report) {
        setReport(res.report);
      }
    });
  };

  const handleResetFilters = () => {
    setAcademicYearId('ALL');
    setBranchId('ALL');
    setSemesterId('ALL');
    setFacultyId('ALL');
    setSubjectId('ALL');
    handleFilterChange('ALL', 'ALL', 'ALL', 'ALL', 'ALL');
  };

  // Form Filter & Pagination Logic
  const matchingForms = useMemo(() => {
    return forms.filter(form => {
      if (academicYearId !== 'ALL' && form.academic_year_id !== academicYearId) return false;
      if (branchId !== 'ALL' && form.branch_id !== branchId) return false;
      if (semesterId !== 'ALL' && form.semester_id !== semesterId) return false;

      const formHasFaculty =
        form.faculty_id === facultyId ||
        (form.items && form.items.some(it => it.faculty_id === facultyId));
      if (facultyId !== 'ALL' && !formHasFaculty) return false;

      const formHasSubject =
        form.subject_id === subjectId ||
        (form.items && form.items.some(it => it.subject_id === subjectId));
      if (subjectId !== 'ALL' && !formHasSubject) return false;

      return true;
    });
  }, [forms, academicYearId, branchId, semesterId, facultyId, subjectId]);

  const displayFormsWithResponses = report.formsWithResponses > 0
    ? report.formsWithResponses
    : matchingForms.filter(f => (f.response_count || 0) > 0).length;

  const displayTotalForms = matchingForms.length > 0
    ? matchingForms.length
    : forms.length;

  const displayTotalResponses = report.totalResponses > 0
    ? report.totalResponses
    : matchingForms.reduce((sum, f) => sum + (f.response_count || 0), 0);

  const getFormFacultyList = (form: FeedbackForm): Faculty[] => {
    if (form.items && form.items.length > 0) {
      const list: Faculty[] = [];
      const seen = new Set<string>();
      for (const it of form.items) {
        if (it.faculty && !seen.has(it.faculty.id)) {
          seen.add(it.faculty.id);
          list.push(it.faculty);
        }
      }
      if (list.length > 0) return list;
    }
    return form.faculty ? [form.faculty] : [];
  };

  const getFormSubjectList = (form: FeedbackForm): Subject[] => {
    if (form.items && form.items.length > 0) {
      const list: Subject[] = [];
      const seen = new Set<string>();
      for (const it of form.items) {
        if (it.subject && !seen.has(it.subject.id)) {
          seen.add(it.subject.id);
          list.push(it.subject);
        }
      }
      if (list.length > 0) return list;
    }
    return form.subject ? [form.subject] : [];
  };

  const getFormSessionName = (form: FeedbackForm): string | undefined => {
    return form.academic_year?.name;
  };

  const pdfExportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (academicYearId !== 'ALL') params.set('academicYearId', academicYearId);
    if (branchId !== 'ALL') params.set('branchId', branchId);
    if (semesterId !== 'ALL') params.set('semesterId', semesterId);
    if (facultyId !== 'ALL') params.set('facultyId', facultyId);
    if (subjectId !== 'ALL') params.set('subjectId', subjectId);
    const qs = params.toString();
    return `/api/admin/results/overall/pdf${qs ? `?${qs}` : ''}`;
  }, [academicYearId, branchId, semesterId, facultyId, subjectId]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalItems = matchingForms.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const validPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedForms = useMemo(() => {
    const from = (validPage - 1) * pageSize;
    return matchingForms.slice(from, from + pageSize);
  }, [matchingForms, validPage, pageSize]);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ==================================================================== */}
      {/* SECTION 1: Notice Board Header & Institutional Filter Scope          */}
      {/* ==================================================================== */}
      <PinnedRosterBoard
        title="FACULTY FEEDBACK RESULTS & ANALYTICS"
        subtitle="Institutional Quality Assurance & Objective Evaluation Metrics"
        badge={
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 dark:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-600/30">
            Analytics Console
          </span>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 dark:bg-[#2e2013] dark:hover:bg-[#3d2c1b] text-slate-800 dark:text-[#faebd0] text-xs font-bold rounded-lg transition-all border border-amber-300 dark:border-[#4d3817] shadow-xs cursor-pointer select-none"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </Link>
            <button
              type="button"
              onClick={handleInitiateScopePdf}
              disabled={downloadingScopePdf}
              aria-busy={downloadingScopePdf}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 bg-bce-navy hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {downloadingScopePdf ? (
                <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>{downloadingScopePdf ? 'Downloading...' : 'Download Overall Scope PDF'}</span>
            </button>
          </div>
        }
      >
        <div className="p-4 sm:p-5 space-y-4 text-slate-800 dark:text-[#faebd0]">
          {pdfNotification && (
            <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/40 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{pdfNotification}</span>
            </div>
          )}

          {/* Google Workspace Reconnection Alert Banner */}
          {report.googleConnectionRequired && (
            <div className="p-3.5 sm:p-4 bg-gradient-to-r from-amber-50/90 via-amber-50 to-orange-50 dark:from-[#2e2013] dark:to-[#22170d] border border-amber-300 dark:border-[#4d3817] rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-3">
                <span className="p-2 bg-amber-500 text-white rounded-lg shrink-0 mt-0.5 shadow-2xs">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                </span>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-[#faebd0] flex flex-wrap items-center gap-1.5">
                    <span>Google Workspace Authorization Expired</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                      Action Required
                    </span>
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-amber-200/70 mt-1 leading-relaxed">
                    The Google account authorization {report.googleAccountEmail ? `(${report.googleAccountEmail})` : ''} has expired. 
                    Submissions are recorded in the database ({displayTotalResponses} total), but reconnecting is required to sync Google Sheets for parameter ratings and analytics charts.
                  </p>
                </div>
              </div>

              <a
                href={`/api/auth/google?collegeId=${encodeURIComponent(report.collegeId || '')}&returnTo=${encodeURIComponent('/admin/dashboard/results')}`}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold rounded-lg transition-all shadow-xs shrink-0 cursor-pointer self-stretch md:self-auto text-center"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reconnect Google Account</span>
              </a>
            </div>
          )}

          {/* Scope Indicator Ribbon */}
          <div className="p-3 bg-amber-500/10 dark:bg-[#1f150c] border border-amber-900/15 dark:border-[#4d3817] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="font-bold text-amber-950 dark:text-amber-200 uppercase tracking-wider text-[10px] shrink-0">
                Active Scope:
              </span>
              <span className="font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-900/60 break-words max-w-full text-[11px] sm:text-xs">
                {report.scopeTitle}
              </span>
              {isPending && (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium shrink-0">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Recalculating...
                </span>
              )}
            </div>

            <span className="text-[11px] text-slate-500 dark:text-amber-200/60 font-medium shrink-0">
              Evaluating {displayFormsWithResponses} active forms ({displayTotalResponses} total student responses)
            </span>
          </div>

          {/* Multi-tier Filter Bar */}
          <div className="pt-3 border-t border-amber-900/15 dark:border-[#4d3817]">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-[#faebd0]">
                <Filter className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                <span>Filter Institutional Scope:</span>
                {activeFiltersCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-blue-600 text-white">
                    {activeFiltersCount}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
                className="md:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-[#2e2013] text-slate-700 dark:text-amber-200 text-xs font-bold border border-amber-300 dark:border-[#4d3817] transition-all cursor-pointer"
              >
                <span>{mobileFiltersOpen ? 'Hide Filters ▲' : 'Filter Options ▼'}</span>
              </button>
            </div>

            <div className={`${mobileFiltersOpen ? 'grid' : 'hidden md:grid'} grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3`}>
              {/* Academic Year */}
              <div>
                <label className="block text-[10px] font-bold text-amber-900/80 dark:text-amber-200/80 uppercase mb-1">
                  Academic Session
                </label>
                <select
                  value={academicYearId}
                  onChange={e => {
                    setAcademicYearId(e.target.value);
                    handleFilterChange(e.target.value, branchId, semesterId, facultyId, subjectId);
                  }}
                  className="w-full text-xs bg-white dark:bg-[#251b10] border border-amber-900/20 dark:border-[#4d3817] rounded-lg px-2.5 py-2 font-semibold text-slate-900 dark:text-[#faebd0] focus:ring-2 focus:ring-amber-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">All Sessions</option>
                  {academicYears.map(y => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Branch / Discipline */}
              <div>
                <label className="block text-[10px] font-bold text-amber-900/80 dark:text-amber-200/80 uppercase mb-1">
                  Branch / Discipline
                </label>
                <select
                  value={branchId}
                  onChange={e => {
                    setBranchId(e.target.value);
                    handleFilterChange(academicYearId, e.target.value, semesterId, facultyId, subjectId);
                  }}
                  aria-label="Filter Branch / Discipline"
                  className="w-full text-xs bg-white dark:bg-[#251b10] border border-amber-900/20 dark:border-[#4d3817] rounded-lg px-2.5 py-2 font-semibold text-slate-900 dark:text-[#faebd0] focus:ring-2 focus:ring-amber-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">All Branches</option>
                  {activeBranches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Semester */}
              <div>
                <label className="block text-[10px] font-bold text-amber-900/80 dark:text-amber-200/80 uppercase mb-1">
                  Semester
                </label>
                <select
                  value={semesterId}
                  onChange={e => {
                    setSemesterId(e.target.value);
                    handleFilterChange(academicYearId, branchId, e.target.value, facultyId, subjectId);
                  }}
                  className="w-full text-xs bg-white dark:bg-[#251b10] border border-amber-900/20 dark:border-[#4d3817] rounded-lg px-2.5 py-2 font-semibold text-slate-900 dark:text-[#faebd0] focus:ring-2 focus:ring-amber-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">All Semesters</option>
                  {semesters.map(s => {
                    const label = s.programme?.name ? `${s.programme.name} — ${s.name}` : s.name;
                    return (
                      <option key={s.id} value={s.id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Faculty */}
              <div>
                <label className="block text-[10px] font-bold text-amber-900/80 dark:text-amber-200/80 uppercase mb-1">
                  Faculty
                </label>
                <select
                  value={facultyId}
                  onChange={e => {
                    setFacultyId(e.target.value);
                    handleFilterChange(academicYearId, branchId, semesterId, e.target.value, subjectId);
                  }}
                  className="w-full text-xs bg-white dark:bg-[#251b10] border border-amber-900/20 dark:border-[#4d3817] rounded-lg px-2.5 py-2 font-semibold text-slate-900 dark:text-[#faebd0] focus:ring-2 focus:ring-amber-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">All Faculty</option>
                  {faculties.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-[10px] font-bold text-amber-900/80 dark:text-amber-200/80 uppercase mb-1">
                  Subject
                </label>
                <select
                  value={subjectId}
                  onChange={e => {
                    setSubjectId(e.target.value);
                    handleFilterChange(academicYearId, branchId, semesterId, facultyId, e.target.value);
                  }}
                  className="w-full text-xs bg-white dark:bg-[#251b10] border border-amber-900/20 dark:border-[#4d3817] rounded-lg px-2.5 py-2 font-semibold text-slate-900 dark:text-[#faebd0] focus:ring-2 focus:ring-amber-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">All Subjects</option>
                  {subjects.map(sub => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} ({sub.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Reset Button */}
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="w-full py-2 text-xs font-bold text-slate-700 dark:text-amber-200/90 bg-slate-100 dark:bg-[#2e2013] hover:bg-slate-200 dark:hover:bg-[#3d2c1b] rounded-lg transition-colors cursor-pointer border border-slate-300 dark:border-[#4d3817]"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      </PinnedRosterBoard>

      {/* ==================================================================== */}
      {/* SECTION 2: Notice Board Pinned KPI Metric Slips                      */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Metric 1: Active Forms */}
        <div className="pinned-paper-sheet bg-[#fffdfa]/95 dark:bg-[#1a1208]/95 border border-amber-900/30 dark:border-[#4d3817] rounded-[4px] p-3 sm:p-4 space-y-1 relative shadow-sm hover:shadow-md transition-all group overflow-hidden">
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-600 border border-red-800 shadow-[0_1px_2px_rgba(0,0,0,0.4)] pointer-events-none" />
          <div className="flex items-center justify-between text-amber-900/80 dark:text-amber-300/80 pt-1">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate">Active Forms</span>
            <FileSpreadsheet className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
          </div>
          <div className="text-lg xs:text-xl sm:text-2xl font-black text-slate-900 dark:text-[#faebd0] mt-1">
            {displayFormsWithResponses}{' '}
            <span className="text-[11px] sm:text-xs font-medium text-slate-400 dark:text-amber-200/50">/ {displayTotalForms}</span>
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-amber-200/60 truncate">
            {displayFormsWithResponses > 0 ? `${displayFormsWithResponses} forms with responses` : 'Synchronized responses'}
          </p>
        </div>

        {/* Metric 2: Total Responses */}
        <div className="pinned-paper-sheet bg-[#fffdfa]/95 dark:bg-[#1a1208]/95 border border-amber-900/30 dark:border-[#4d3817] rounded-[4px] p-3 sm:p-4 space-y-1 relative shadow-sm hover:shadow-md transition-all group overflow-hidden">
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-600 border border-red-800 shadow-[0_1px_2px_rgba(0,0,0,0.4)] pointer-events-none" />
          <div className="flex items-center justify-between text-amber-900/80 dark:text-amber-300/80 pt-1">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate">Total Responses</span>
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          </div>
          <div className="text-lg xs:text-xl sm:text-2xl font-black text-slate-900 dark:text-[#faebd0] mt-1">
            {displayTotalResponses}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-amber-200/60 truncate">
            {displayTotalResponses} valid submissions
          </p>
        </div>

        {/* Metric 3: Scope Rating */}
        <div className="pinned-paper-sheet bg-[#fffdfa]/95 dark:bg-[#1a1208]/95 border border-amber-900/30 dark:border-[#4d3817] rounded-[4px] p-3 sm:p-4 space-y-1 relative shadow-sm hover:shadow-md transition-all group overflow-hidden">
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-600 border border-red-800 shadow-[0_1px_2px_rgba(0,0,0,0.4)] pointer-events-none" />
          <div className="flex items-center justify-between text-amber-900/80 dark:text-amber-300/80 pt-1">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate">Scope Rating</span>
            <Star className="w-4 h-4 text-amber-500 fill-amber-400/20 shrink-0" />
          </div>
          <div className="text-lg xs:text-xl sm:text-2xl font-black text-slate-900 dark:text-[#faebd0] mt-1">
            {report.hasData ? (
              <>
                {report.averageOverallScore.toFixed(2)}{' '}
                <span className="text-[11px] sm:text-xs font-medium text-slate-400 dark:text-amber-200/50">/ 5.00</span>
              </>
            ) : displayTotalResponses > 0 ? (
              <span className="text-xs sm:text-base text-amber-600 dark:text-amber-400 font-bold">Pending Sync</span>
            ) : (
              <span className="text-sm sm:text-lg text-slate-400 font-semibold">No Data</span>
            )}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-amber-200/60 truncate">
            {report.hasData
              ? `Avg: ${report.compositeAverageScore.toFixed(2)}/5.00`
              : displayTotalResponses > 0
              ? `${displayTotalResponses} submissions awaiting sync`
              : 'Pending responses'}
          </p>
        </div>

        {/* Metric 4: Positive Rating */}
        <div className="pinned-paper-sheet bg-[#fffdfa]/95 dark:bg-[#1a1208]/95 border border-amber-900/30 dark:border-[#4d3817] rounded-[4px] p-3 sm:p-4 space-y-1 relative shadow-sm hover:shadow-md transition-all group overflow-hidden">
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-600 border border-red-800 shadow-[0_1px_2px_rgba(0,0,0,0.4)] pointer-events-none" />
          <div className="flex items-center justify-between text-amber-900/80 dark:text-amber-300/80 pt-1">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate">Positive Rating</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </div>
          <div className="text-lg xs:text-xl sm:text-2xl font-black text-slate-900 dark:text-[#faebd0] mt-1">
            {report.hasData ? (
              (() => {
                const posCount =
                  report.distribution.excellentCount +
                  report.distribution.veryGoodCount +
                  report.distribution.goodCount;
                const total = report.distribution.totalValidRatings;
                const pct =
                  report.distribution.positivePct !== undefined
                    ? report.distribution.positivePct
                    : total > 0
                    ? (posCount / total) * 100
                    : 0;
                const safePct = Math.min(100, Math.max(0, pct));
                return safePct >= 99.95 ? '100%' : `${safePct.toFixed(1)}%`;
              })()
            ) : displayTotalResponses > 0 ? (
              <span className="text-xs sm:text-base text-amber-600 dark:text-amber-400 font-bold">Sync Needed</span>
            ) : (
              <span className="text-sm sm:text-lg text-slate-400 font-semibold">0%</span>
            )}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-amber-200/60 truncate">
            {displayTotalResponses > 0 && !report.hasData
              ? 'Reconnect Google to view ratings'
              : 'Positive rating index'}
          </p>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SECTION 3: Visual Analytics Charts (Pinned Parchment Cards)          */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Chart 1: Parameter-wise Average */}
        <div className="pinned-paper-sheet bg-[#fffdfa]/95 dark:bg-[#1a1208]/95 border border-amber-900/30 dark:border-[#4d3817] p-4 sm:p-5 rounded-lg shadow-sm space-y-3 relative overflow-hidden text-slate-800 dark:text-[#faebd0]">
          <div className="absolute top-1.5 left-2 w-1.5 h-1.5 rounded-full bg-red-500/80 pointer-events-none" />
          <div className="border-b border-amber-900/15 dark:border-[#4d3817] pb-3 pl-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#faebd0]">
              Parameter-wise Average Rating (1.00 — 5.00)
            </h3>
            <p className="text-xs text-slate-500 dark:text-amber-200/60 mt-0.5">
              Objective weighted score across all 8 canonical BCE parameters.
            </p>
          </div>
          <ParameterScoreBarChart parameters={report.parameters} hasData={report.hasData} />
        </div>

        {/* Chart 2: Rating Distribution Stacked Bar */}
        <div className="pinned-paper-sheet bg-[#fffdfa]/95 dark:bg-[#1a1208]/95 border border-amber-900/30 dark:border-[#4d3817] p-4 sm:p-5 rounded-lg shadow-sm space-y-3 relative overflow-hidden text-slate-800 dark:text-[#faebd0]">
          <div className="absolute top-1.5 left-2 w-1.5 h-1.5 rounded-full bg-red-500/80 pointer-events-none" />
          <div className="border-b border-amber-900/15 dark:border-[#4d3817] pb-3 pl-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#faebd0]">
              Rating Distribution by Parameter (%)
            </h3>
            <p className="text-xs text-slate-500 dark:text-amber-200/60 mt-0.5">
              Proportion of Excellent, Very Good, Good, Satisfactory, and Unsatisfactory.
            </p>
          </div>
          <ParameterDistributionStackedChart
            parameters={report.parameters}
            hasData={report.hasData}
          />
        </div>

        {/* Chart 3: Overall Distribution Donut */}
        <div className="pinned-paper-sheet bg-[#fffdfa]/95 dark:bg-[#1a1208]/95 border border-amber-900/30 dark:border-[#4d3817] p-4 sm:p-5 rounded-lg shadow-sm space-y-3 relative overflow-hidden text-slate-800 dark:text-[#faebd0]">
          <div className="absolute top-1.5 left-2 w-1.5 h-1.5 rounded-full bg-red-500/80 pointer-events-none" />
          <div className="border-b border-amber-900/15 dark:border-[#4d3817] pb-3 pl-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#faebd0]">Overall Rating Tier Breakdown</h3>
            <p className="text-xs text-slate-500 dark:text-amber-200/60 mt-0.5">
              Institutional breakdown of all valid submitted evaluation items.
            </p>
          </div>
          <OverallDonutChart distribution={report.distribution} hasData={report.hasData} />
        </div>

        {/* Chart 4: Faculty Comparison */}
        <div className="pinned-paper-sheet bg-[#fffdfa]/95 dark:bg-[#1a1208]/95 border border-amber-900/30 dark:border-[#4d3817] p-4 sm:p-5 rounded-lg shadow-sm space-y-3 relative overflow-hidden text-slate-800 dark:text-[#faebd0]">
          <div className="absolute top-1.5 left-2 w-1.5 h-1.5 rounded-full bg-red-500/80 pointer-events-none" />
          <div className="border-b border-amber-900/15 dark:border-[#4d3817] pb-3 pl-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#faebd0]">
              Faculty Comparative Benchmark
            </h3>
            <p className="text-xs text-slate-500 dark:text-amber-200/60 mt-0.5">
              Average overall score comparison for forms with real submissions.
            </p>
          </div>
          <FacultyComparisonBarChart comparisons={report.facultyComparisons} />
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SECTION 4: Forms Performance & Individual Reports (Notice Board)     */}
      {/* ==================================================================== */}
      <PinnedRosterBoard
        title={`FACULTY FEEDBACK FORMS IN SELECTED SCOPE (${totalItems})`}
        subtitle="Access individual faculty analytics dashboards and export faculty PDF reports"
        badge={
          totalPages > 1 ? (
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 dark:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-600/30">
              Page {validPage} of {totalPages}
            </span>
          ) : undefined
        }
      >
        <div className="p-4 sm:p-5 space-y-4 text-slate-800 dark:text-[#faebd0]">
          {matchingForms.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-amber-200/50 space-y-2">
              <p className="text-sm font-bold">No feedback forms match the selected filters.</p>
              <p className="text-xs text-slate-500 dark:text-amber-200/60">Adjust the filters above to view other sessions, branches, or faculty.</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block rounded-xl border border-amber-900/20 dark:border-[#4d3817] overflow-hidden bg-white dark:bg-[#1f1710] shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-amber-500/10 dark:bg-[#281b10] text-amber-950 dark:text-[#faebd0] font-bold uppercase text-[10px] tracking-wider border-b border-amber-900/20 dark:border-[#4d3817]">
                      <th className="px-4 py-3">Faculty Member</th>
                      <th className="px-4 py-3">Subject &amp; Code</th>
                      <th className="px-4 py-3">Branch, Sem &amp; Session</th>
                      <th className="px-4 py-3">Responses</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-900/10 dark:divide-[#382713]">
                    {paginatedForms.map(form => {
                      const compItem = report.facultyComparisons.find(c => c.formId === form.id);
                      const respCount = compItem ? compItem.responseCount : form.response_count || 0;
                      const score = compItem ? compItem.averageScore : null;

                      const facultyList = getFormFacultyList(form);
                      const subjectList = getFormSubjectList(form);
                      const sessionName = getFormSessionName(form);
                      const isMultiFaculty = form.form_type === 'SEMESTER_FEEDBACK' || (form.items && form.items.length > 0);
                      const facultyPdfName = facultyList.map(f => f.name).join(', ') || form.faculty?.name;

                      return (
                        <tr key={form.id} className="hover:bg-amber-500/5 dark:hover:bg-[#261b11] transition-colors">
                          <td className="px-4 py-3.5 align-top">
                            {isMultiFaculty && facultyList.length > 0 ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-2xs">
                                    <Users className="w-3 h-3 text-purple-700 dark:text-purple-400" />
                                    <span>Multi-Faculty ({facultyList.length})</span>
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {facultyList.map((fac, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white dark:bg-[#251b10] text-slate-800 dark:text-[#faebd0] border border-amber-900/20 dark:border-[#4d3817] shadow-2xs"
                                      title={fac.department ? `${fac.name} (${fac.department})` : fac.name}
                                    >
                                      {fac.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : facultyList.length > 0 ? (
                              <div>
                                <div className="font-bold text-slate-900 dark:text-[#faebd0] text-xs sm:text-sm">{facultyList[0].name}</div>
                                {facultyList[0].department && (
                                  <div className="text-[11px] text-slate-500 dark:text-amber-200/60 mt-0.5">{facultyList[0].department}</div>
                                )}
                              </div>
                            ) : (
                              <div>
                                <div className="font-bold text-slate-500 dark:text-amber-200/50 text-xs italic">Faculty Unassigned</div>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            {isMultiFaculty && subjectList.length > 0 ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                    <span>{subjectList.length} Courses</span>
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {subjectList.map((sub, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-amber-500/5 dark:bg-[#251b10] text-slate-700 dark:text-slate-300 border border-amber-900/15 dark:border-[#4d3817]"
                                    >
                                      <span>{sub.name}</span>
                                      {sub.code && (
                                        <span className="font-mono text-[9px] text-slate-400 font-semibold">({sub.code})</span>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : subjectList.length > 0 ? (
                              <div>
                                <div className="font-semibold text-slate-800 dark:text-[#faebd0] text-xs sm:text-sm">{subjectList[0].name}</div>
                                {subjectList[0].code && (
                                  <div className="font-mono text-[10px] text-slate-400 dark:text-amber-200/50 mt-0.5">{subjectList[0].code}</div>
                                )}
                              </div>
                            ) : (
                              <div>
                                <div className="font-semibold text-slate-500 dark:text-amber-200/50 text-xs italic">Subject Unassigned</div>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3.5 align-top text-slate-600 dark:text-slate-300">
                            <div className="font-bold text-slate-900 dark:text-[#faebd0]">{form.branch?.code || form.branch?.name}</div>
                            <div className="text-[11px] text-slate-500 dark:text-amber-200/60 font-medium">{form.semester?.name}</div>
                            {sessionName && (
                              <div className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shadow-2xs">
                                <span>Session {sessionName}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <span className="font-bold text-slate-900 dark:text-[#faebd0]">{respCount}</span>
                            {score !== null && (
                              <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                {score.toFixed(2)}/5.00
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                form.status === 'PUBLISHED'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                  : form.status === 'CLOSED'
                                  ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                              }`}
                            >
                              {form.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 align-top text-right space-x-2">
                            <Link
                              href={`/admin/dashboard/results/${form.id}`}
                              onClick={() => setNavigatingFormId(form.id)}
                              aria-busy={navigatingFormId === form.id ? 'true' : undefined}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-bce-navy text-amber-400 hover:bg-slate-800 rounded-lg text-xs font-bold transition-all shadow-xs"
                            >
                              {navigatingFormId === form.id ? (
                                <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                              ) : null}
                              <span>{navigatingFormId === form.id ? 'Opening...' : 'Analytics'}</span>
                              {navigatingFormId !== form.id && <ChevronRight className="w-3.5 h-3.5" />}
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleInitiateFormPdf(form.id, facultyPdfName, form.title)}
                              disabled={Boolean(downloadingPdfFormId)}
                              aria-busy={downloadingPdfFormId === form.id ? 'true' : undefined}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 hover:bg-amber-200 dark:bg-[#2e2013] dark:hover:bg-[#3d2c1b] text-amber-950 dark:text-amber-200 rounded-lg text-xs font-bold border border-amber-300 dark:border-[#4d3817] transition-all disabled:opacity-50 cursor-pointer"
                            >
                              {downloadingPdfFormId === form.id ? (
                                <Loader2 className="w-3 h-3 text-amber-700 dark:text-amber-400 animate-spin" />
                              ) : (
                                <FileDown className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                              )}
                              <span>{downloadingPdfFormId === form.id ? 'Downloading...' : 'PDF'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="md:hidden space-y-2.5 sm:space-y-3">
                {paginatedForms.map(form => {
                  const compItem = report.facultyComparisons.find(c => c.formId === form.id);
                  const respCount = compItem ? compItem.responseCount : form.response_count || 0;
                  const score = compItem ? compItem.averageScore : null;

                  const facultyList = getFormFacultyList(form);
                  const subjectList = getFormSubjectList(form);
                  const sessionName = getFormSessionName(form);
                  const isMultiFaculty = form.form_type === 'SEMESTER_FEEDBACK' || (form.items && form.items.length > 0);
                  const facultyPdfName = facultyList.map(f => f.name).join(', ') || form.faculty?.name;

                  return (
                    <div key={form.id} className="p-3.5 sm:p-4 bg-amber-500/5 dark:bg-[#1f150c] border border-amber-900/20 dark:border-[#4d3817] rounded-xl space-y-2.5 sm:space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {isMultiFaculty && facultyList.length > 0 ? (
                            <div className="space-y-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-2xs">
                                <Users className="w-3 h-3 text-purple-700" />
                                <span>Multi-Faculty ({facultyList.length})</span>
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {facultyList.map((fac, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white dark:bg-[#251b10] text-slate-800 dark:text-[#faebd0] border border-amber-900/20 dark:border-[#4d3817] shadow-2xs break-words max-w-full"
                                  >
                                    {fac.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <h4 className="font-bold text-slate-900 dark:text-[#faebd0] text-sm leading-snug">{facultyList[0]?.name || 'Faculty Member'}</h4>
                              <p className="text-[11px] text-slate-500 dark:text-amber-200/60 mt-0.5">{facultyList[0]?.department}</p>
                            </div>
                          )}
                        </div>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                            form.status === 'PUBLISHED'
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : form.status === 'CLOSED'
                              ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                              : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          {form.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-white dark:bg-[#251b10] p-2.5 rounded-lg border border-amber-900/15 dark:border-[#4d3817]">
                        <div>
                          <span className="text-[10px] text-amber-900/80 dark:text-amber-200/80 block font-bold uppercase tracking-wider mb-0.5">
                            {isMultiFaculty ? 'Courses' : 'Subject'}
                          </span>
                          {isMultiFaculty ? (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {subjectList.map((sub, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-amber-500/5 dark:bg-[#1f150c] text-slate-700 dark:text-slate-300 border border-amber-900/15 dark:border-[#4d3817]"
                                >
                                  <span>{sub.name}</span>
                                  {sub.code && <span className="font-mono text-[9px] text-slate-400">({sub.code})</span>}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <>
                              <span className="font-bold text-slate-800 dark:text-[#faebd0] text-[11px] line-clamp-1">{subjectList[0]?.name}</span>
                              <span className="font-mono text-[9px] text-slate-400">{subjectList[0]?.code}</span>
                            </>
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] text-amber-900/80 dark:text-amber-200/80 block font-bold uppercase tracking-wider mb-0.5">Cohort &amp; Session</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px] block">{form.branch?.code || form.branch?.name}</span>
                          <span className="text-[10px] text-slate-500 dark:text-amber-200/60 block">{form.semester?.name}</span>
                          {sessionName && (
                            <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                              Session {sessionName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-amber-900/15 dark:border-[#4d3817]">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-500 dark:text-amber-200/60 font-medium">Responses:</span>
                          <span className="font-bold text-slate-900 dark:text-[#faebd0]">{respCount}</span>
                          {score !== null && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                              {score.toFixed(2)} / 5.00
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <Link
                            href={`/admin/dashboard/results/${form.id}`}
                            onClick={() => setNavigatingFormId(form.id)}
                            aria-busy={navigatingFormId === form.id ? 'true' : undefined}
                            className="flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 px-3 py-2 bg-bce-navy text-amber-400 hover:bg-slate-800 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                          >
                            {navigatingFormId === form.id ? (
                              <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                            ) : null}
                            <span>{navigatingFormId === form.id ? 'Opening...' : 'Analytics'}</span>
                            {navigatingFormId !== form.id && <ChevronRight className="w-3.5 h-3.5" />}
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleInitiateFormPdf(form.id, facultyPdfName, form.title)}
                            disabled={Boolean(downloadingPdfFormId)}
                            aria-busy={downloadingPdfFormId === form.id ? 'true' : undefined}
                            className="flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 px-3 py-2 bg-amber-100 hover:bg-amber-200 dark:bg-[#2e2013] dark:hover:bg-[#3d2c1b] text-amber-950 dark:text-amber-200 rounded-lg text-xs font-bold border border-amber-300 dark:border-[#4d3817] transition-all disabled:opacity-50 cursor-pointer"
                          >
                            {downloadingPdfFormId === form.id ? (
                              <Loader2 className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 animate-spin" />
                            ) : (
                              <FileDown className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                            )}
                            <span>{downloadingPdfFormId === form.id ? 'Downloading...' : 'PDF'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              <div className="pt-2 border-t border-amber-900/15 dark:border-[#4d3817]">
                <PaginationControl
                  currentPage={validPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  pageSize={pageSize}
                  onPageChange={(p) => setCurrentPage(p)}
                  onPageSizeChange={(newSize) => {
                    setPageSize(newSize);
                    setCurrentPage(1);
                  }}
                  pageSizeOptions={[5, 10, 20, 50]}
                  isLoading={isPending}
                />
              </div>
            </>
          )}
        </div>
      </PinnedRosterBoard>

      {/* PDF Download Upgrade / Watermark Choice Modal */}
      <PdfDownloadUpgradeModal
        isOpen={Boolean(pendingPdfDownload)}
        onClose={() => setPendingPdfDownload(null)}
        onProceedWithWatermark={handleProceedWithWatermark}
        isDownloading={Boolean(downloadingPdfFormId || downloadingScopePdf)}
        documentTitle={pendingPdfDownload?.title || 'Feedback Report'}
      />
    </div>
  );
}
