'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useAppRouter as useRouter } from '@/lib/hooks/use-app-router';
import {
  ParameterScoreBarChart,
  ParameterDistributionStackedChart,
  OverallDonutChart,
} from './AnalyticsCharts';
import { FormAnalyticsReport } from '@/lib/analytics/types';
import { getPerformanceGradeInfo } from '@/lib/analytics/engine';
import { syncSingleFormResponsesAction, getFormAnalyticsAction } from '@/app/admin/results/actions';
import { useHydrated, formatDateTimeFull } from '@/lib/hooks/use-hydrated';
import { downloadPdfFile } from '@/lib/utils/pdf-download';
import { PdfDownloadUpgradeModal } from '@/components/admin/pdf/PdfDownloadUpgradeModal';
import { ExternalActionLink } from '@/components/ui/ExternalActionLink';
import {
  ArrowLeft,
  FileDown,
  RefreshCw,
  ExternalLink,
  Users,
  Award,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
  FileCode2,
  Info,
  Layers,
  User,
  GraduationCap,
  Loader2,
} from 'lucide-react';
import { ExamPadCard } from '@/components/ui/ExamPadCard';
import { PinnedRosterBoard } from '@/components/ui/PinnedRosterBoard';

interface Props {
  initialReport: FormAnalyticsReport;
}

export function FormResultsConsole({ initialReport }: Props) {
  const router = useRouter();
  const [report, setReport] = useState<FormAnalyticsReport>(initialReport);
  const [selectedGridIndex, setSelectedGridIndex] = useState<number>(-1); // -1 = All Subjects Combined
  const [isSyncing, startSync] = useTransition();
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isNavigatingResponses, setIsNavigatingResponses] = useState(false);
  const [downloadingPdfType, setDownloadingPdfType] = useState<string | null>(null);
  const [pendingPdfDownload, setPendingPdfDownload] = useState<{
    url: string;
    defaultFilename: string;
    typeKey: string;
  } | null>(null);
  const hydrated = useHydrated();

  const handleInitiatePdfDownload = (url: string, defaultFilename: string, typeKey: string) => {
    setPendingPdfDownload({ url, defaultFilename, typeKey });
  };

  const handleDownloadPdf = async (url: string, defaultFilename: string, typeKey: string) => {
    if (downloadingPdfType) return;
    setDownloadingPdfType(typeKey);
    setSyncMessage(null);
    try {
      const res = await downloadPdfFile({
        url,
        defaultFilename,
        onError: (err) => {
          setSyncMessage({
            type: 'error',
            text: typeof err === 'string' ? err : err.message,
          });
        },
      });

      if (res.success) {
        setSyncMessage({
          type: 'success',
          text: `Report PDF downloaded successfully (${res.filename}).`,
        });
        setTimeout(() => setSyncMessage(null), 4500);
      }
    } finally {
      setDownloadingPdfType(null);
    }
  };

  const handleProceedWithWatermark = async () => {
    if (!pendingPdfDownload) return;
    const { url, defaultFilename, typeKey } = pendingPdfDownload;
    setPendingPdfDownload(null);
    await handleDownloadPdf(url, defaultFilename, typeKey);
  };

  const handleSync = () => {
    setSyncMessage(null);
    startSync(async () => {
      const res = await syncSingleFormResponsesAction(report.formId);
      if (res.success) {
        setSyncMessage({
          type: 'success',
          text: res.message || `Synced ${res.syncedCount} new response(s). Total: ${res.totalResponses}.`,
        });
        const updated = await getFormAnalyticsAction(report.formId);
        if (updated.success && updated.report) {
          setReport(updated.report);
        }
        router.refresh();
      } else {
        setSyncMessage({
          type: 'error',
          text: res.error || 'Failed to synchronize responses.',
        });
      }
    });
  };

  // Determine active displayed report
  const isSemester = Boolean(report.isSemesterForm && report.facultyGrids && report.facultyGrids.length > 0);
  const currentReport: FormAnalyticsReport =
    selectedGridIndex >= 0 && report.facultyGrids?.[selectedGridIndex]
      ? report.facultyGrids[selectedGridIndex].report
      : report;

  const activeFacultyGrid =
    selectedGridIndex >= 0 && report.facultyGrids?.[selectedGridIndex]
      ? report.facultyGrids[selectedGridIndex]
      : null;

  const gradeInfo =
    currentReport.performanceGradeInfo ||
    getPerformanceGradeInfo(currentReport.averageOverallScore, currentReport.hasData);

  // PDF download links
  const semesterOverviewPdfUrl = `/api/admin/results/${report.formId}/pdf?scope=SEMESTER`;
  const facultyPdfUrl = activeFacultyGrid
    ? `/api/admin/results/${report.formId}/pdf?faculty=${encodeURIComponent(activeFacultyGrid.facultyName)}`
    : `/api/admin/results/${report.formId}/pdf`;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Header on Authentic Exam Pad */}
      <ExamPadCard
        variant="dashboard"
        clipLabel="ANALYTICS CONSOLE"
        title={
          <div className="flex items-start sm:items-center gap-2 sm:gap-2.5">
            <Link
              href="/admin/dashboard/results"
              className="p-1.5 rounded-[3px] text-slate-400 dark:text-[#8c7453] hover:text-slate-700 dark:hover:text-[#faebd0] hover:bg-slate-100 dark:hover:bg-[#25180c] transition-colors shrink-0 mt-0.5 sm:mt-0"
              title="Back to All Results"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-lg md:text-xl font-bold text-slate-900 dark:text-[#faebd0] leading-tight">
                  {isSemester
                    ? selectedGridIndex === -1
                      ? `Semester Feedback — ${report.branch} (${report.semester})`
                      : `${activeFacultyGrid?.facultyName} — ${activeFacultyGrid?.subjectName}`
                    : report.facultyName}
                </h1>
                {isSemester && (
                  <span className="px-2.5 py-0.5 rounded-[2px] text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                    Multi-Faculty Semester Form
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-[#c4a97d] font-medium mt-1">
                <span>{report.branch} • {report.semester} • {report.academicYear}</span>
                {isSemester && report.facultyGrids ? <span>• {report.facultyGrids.length} Teachers Evaluated</span> : null}
                <span className="text-slate-300 dark:text-[#523c21]">•</span>
                <span className="font-semibold text-slate-800 dark:text-[#faebd0]">
                  {report.totalSubmissions ?? report.totalResponses} total submissions •{' '}
                  <span className="text-emerald-700 dark:text-emerald-400">{report.includedCount ?? report.totalResponses} included</span> •{' '}
                  <span className="text-rose-700 dark:text-rose-400">{report.excludedCount ?? 0} excluded</span>
                </span>
              </div>
            </div>
          </div>
        }
        badge={`STATUS: ${report.status}`}
      >
        <div className="space-y-3.5 pt-1">
          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleSync}
                disabled={isSyncing}
                aria-busy={isSyncing ? 'true' : undefined}
                className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-bce-cobalt hover:bg-bce-navy text-white rounded-[3px] text-xs font-bold transition-all disabled:opacity-50 shadow-xs cursor-pointer ${
                  isSyncing ? 'btn-request-active' : ''
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Responses'}</span>
              </button>

              <Link
                href={`/admin/dashboard/results/${report.formId}/responses`}
                onClick={() => setIsNavigatingResponses(true)}
                aria-busy={isNavigatingResponses ? 'true' : undefined}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-[3px] text-xs font-bold transition-all border border-indigo-200 dark:border-indigo-800 shadow-xs"
              >
                {isNavigatingResponses ? (
                  <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                ) : (
                  <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                )}
                <span>{isNavigatingResponses ? 'Opening Responses...' : 'Student Responses'}</span>
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isSemester ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleInitiatePdfDownload(semesterOverviewPdfUrl, `semester-report-${report.formId}.pdf`, 'SEMESTER')}
                    disabled={Boolean(downloadingPdfType)}
                    aria-busy={downloadingPdfType === 'SEMESTER' ? 'true' : undefined}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-bce-navy hover:bg-slate-800 text-white rounded-[3px] text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {downloadingPdfType === 'SEMESTER' ? (
                      <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                    ) : (
                      <FileDown className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>{downloadingPdfType === 'SEMESTER' ? 'Downloading Semester PDF...' : 'Download Semester PDF'}</span>
                  </button>
                  {activeFacultyGrid && (
                    <button
                      type="button"
                      onClick={() => handleInitiatePdfDownload(facultyPdfUrl, `faculty-${encodeURIComponent(activeFacultyGrid.facultyName)}.pdf`, 'FACULTY_GRID')}
                      disabled={Boolean(downloadingPdfType)}
                      aria-busy={downloadingPdfType === 'FACULTY_GRID' ? 'true' : undefined}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-[#140e07] hover:bg-slate-200 dark:hover:bg-[#25180c] text-slate-800 dark:text-[#faebd0] rounded-[3px] text-xs font-bold transition-all border border-slate-300 dark:border-[#382710] disabled:opacity-50 cursor-pointer"
                    >
                      {downloadingPdfType === 'FACULTY_GRID' ? (
                        <Loader2 className="w-3.5 h-3.5 text-bce-cobalt animate-spin" />
                      ) : (
                        <FileDown className="w-3.5 h-3.5 text-bce-cobalt" />
                      )}
                      <span>{downloadingPdfType === 'FACULTY_GRID' ? 'Generating PDF...' : 'Faculty PDF'}</span>
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handleInitiatePdfDownload(facultyPdfUrl, `faculty-report-${report.formId}.pdf`, 'FACULTY')}
                  disabled={Boolean(downloadingPdfType)}
                  aria-busy={downloadingPdfType === 'FACULTY' ? 'true' : undefined}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-bce-navy hover:bg-slate-800 text-white rounded-[3px] text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {downloadingPdfType === 'FACULTY' ? (
                    <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  ) : (
                    <FileDown className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>{downloadingPdfType === 'FACULTY' ? 'Generating PDF...' : 'Download Faculty Report (PDF)'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Sync / Notification Alert */}
          {syncMessage && (
            <div
              className={`p-3 rounded-[3px] border text-xs flex items-center gap-2 ${
                syncMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{syncMessage.text}</span>
            </div>
          )}

          {/* Form Metadata & Quick Google Links */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/80 dark:border-[#382710] text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-500 dark:text-[#c4a97d] text-[11px]">
                Last synced: {report.lastSyncedAt ? formatDateTimeFull(report.lastSyncedAt, hydrated) : 'Not yet synced'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {report.googleSheetUrl && (
                <ExternalActionLink
                  href={report.googleSheetUrl}
                  openingText="Opening Sheet..."
                  className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-semibold"
                  icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
                >
                  <span>Google Sheet Responses</span>
                  <ExternalLink className="w-3 h-3" />
                </ExternalActionLink>
              )}
              {report.googleFormUrl && (
                <ExternalActionLink
                  href={report.googleFormUrl}
                  openingText="Opening Form..."
                  className="text-purple-700 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 font-semibold"
                  icon={<FileCode2 className="w-3.5 h-3.5" />}
                >
                  <span>Public Form</span>
                  <ExternalLink className="w-3 h-3" />
                </ExternalActionLink>
              )}
            </div>
          </div>
        </div>
      </ExamPadCard>

      {/* Scope Selector Tabs for Semester Forms */}
      {isSemester && report.facultyGrids && (
        <div className="bg-white dark:bg-[#1a1309] p-2.5 sm:p-3.5 rounded-[3px] border border-slate-200 dark:border-[#4d3817] shadow-xs space-y-2">
          <div className="flex items-center justify-between px-1 pt-0.5 pb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#c4a97d] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              Analytics View Scope
            </span>
            <span className="text-[11px] text-slate-400 dark:text-[#8c7453] font-medium">
              {report.facultyGrids.length} Evaluated Faculty-Subject Grids
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedGridIndex(-1)}
              className={`px-3.5 py-1.5 rounded-[3px] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedGridIndex === -1
                  ? 'bg-bce-navy dark:bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-[#140e07] text-slate-700 dark:text-[#c4a97d] hover:bg-slate-200 dark:hover:bg-[#25180c] border border-slate-200 dark:border-[#382710]'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>All Subjects Combined (Semester Benchmark)</span>
            </button>

            {report.facultyGrids.map((fg, idx) => {
              const isSelected = selectedGridIndex === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedGridIndex(idx)}
                  className={`px-3 py-1.5 rounded-[3px] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-bce-cobalt dark:bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-[#140e07] text-slate-700 dark:text-[#c4a97d] hover:bg-slate-200 dark:hover:bg-[#25180c] border border-slate-200 dark:border-[#382710]'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>{fg.facultyName}</span>
                  <span className="text-[10px] opacity-75 font-normal">({fg.subjectCode || fg.subjectName})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Exclusion Advisory Notice */}
      {Boolean(report.excludedCount && report.excludedCount > 0) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-[3px] bg-amber-50 dark:bg-[#25180c] border border-amber-300 dark:border-[#4d3817] text-amber-900 dark:text-amber-200 text-xs shadow-xs">
          <div className="flex items-center gap-2.5">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">Manual Response Moderation Active:</span>{' '}
              <span>
                {report.excludedCount} submission(s) are currently excluded. All average ratings, faculty reports, and distribution metrics reflect only the{' '}
                <strong>{report.includedCount ?? report.totalResponses} included submission(s)</strong>.
              </span>
            </div>
          </div>
          <Link
            href={`/admin/dashboard/results/${report.formId}/responses`}
            className="inline-flex items-center gap-1 font-bold text-amber-800 dark:text-amber-300 hover:underline shrink-0 cursor-pointer"
          >
            <span>Review Excluded Responses</span>
          </Link>
        </div>
      )}

      {/* KPI Metric Summary Blocks */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total Responses */}
        <div className="bg-white dark:bg-[#1a1309] p-3 sm:p-5 rounded-[3px] border border-amber-900/20 dark:border-[#4d3817] shadow-xs">
          <div className="flex items-center justify-between text-slate-400 dark:text-[#8c7453]">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#c4a97d]">
              {isSemester && selectedGridIndex === -1 ? 'Included Students' : 'Included Submissions'}
            </span>
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-[#faebd0] mt-1.5 sm:mt-2">
            {isSemester && selectedGridIndex === -1
              ? (currentReport.includedCount ?? currentReport.totalStudents ?? currentReport.totalResponses)
              : (currentReport.includedCount ?? currentReport.totalResponses)}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-[#8c7453] mt-0.5 sm:mt-1 truncate">
            {currentReport.totalSubmissions !== undefined && currentReport.excludedCount !== undefined && currentReport.excludedCount > 0
              ? `${currentReport.totalSubmissions} total • ${currentReport.excludedCount} excluded`
              : isSemester && selectedGridIndex === -1
              ? 'Unique student submission(s)'
              : 'Active in ratings calculation'}
          </p>
        </div>

        {/* Valid Responses */}
        <div className="bg-white dark:bg-[#1a1309] p-3 sm:p-5 rounded-[3px] border border-amber-900/20 dark:border-[#4d3817] shadow-xs">
          <div className="flex items-center justify-between text-slate-400 dark:text-[#8c7453]">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#c4a97d]">
              {isSemester && selectedGridIndex === -1 ? 'Evaluated Items' : 'Valid Evaluations'}
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-[#faebd0] mt-1.5 sm:mt-2">
            {isSemester && selectedGridIndex === -1
              ? (currentReport.evaluatedItems ?? currentReport.validResponses)
              : currentReport.validResponses}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-[#8c7453] mt-0.5 sm:mt-1 truncate">
            {isSemester && selectedGridIndex === -1
              ? `${report.facultyGrids?.length || 0} faculty grids`
              : `${currentReport.unansweredResponses} incomplete`}
          </p>
        </div>

        {/* Overall Average Score */}
        <div className="bg-white dark:bg-[#1a1309] p-3 sm:p-5 rounded-[3px] border border-amber-900/20 dark:border-[#4d3817] shadow-xs">
          <div className="flex items-center justify-between text-slate-400 dark:text-[#8c7453]">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#c4a97d]">
              {isSemester && selectedGridIndex === -1 ? 'Semester Avg' : 'Overall Rating'}
            </span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-[#faebd0] mt-1.5 sm:mt-2">
            {currentReport.hasData ? (
              <>
                {currentReport.averageOverallScore.toFixed(2)}{' '}
                <span className="text-[11px] sm:text-xs font-medium text-slate-400 dark:text-[#8c7453]">/ 5.00</span>
              </>
            ) : (
              <span className="text-sm sm:text-lg text-slate-400 dark:text-[#8c7453] font-semibold">No Data</span>
            )}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-[#8c7453] mt-0.5 sm:mt-1 truncate">
            {currentReport.hasData
              ? `Avg: ${(currentReport.parameterAverageScore ?? currentReport.compositeAverageScore).toFixed(2)}`
              : 'Requires responses'}
          </p>
        </div>

        {/* Performance Grade */}
        <div className="bg-white dark:bg-[#1a1309] p-3 sm:p-5 rounded-[3px] border border-amber-900/20 dark:border-[#4d3817] shadow-xs">
          <div className="flex items-center justify-between text-slate-400 dark:text-[#8c7453]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#c4a97d]">Performance Grade</span>
            <Info className="w-4 h-4 text-slate-400 dark:text-[#8c7453]" />
          </div>
          <div className="mt-2">
            <span
              className={`inline-block px-2.5 py-1 rounded-[2px] text-xs font-extrabold border ${gradeInfo.bgColor} ${gradeInfo.color} ${gradeInfo.borderColor}`}
            >
              {gradeInfo.label}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-[#8c7453] mt-1">Institutional 5-point rating scale</p>
        </div>
      </div>

      {/* Comparative Matrix Section for Semester Forms (When All Subjects Combined is Selected) */}
      {isSemester && selectedGridIndex === -1 && report.facultyGrids && report.facultyGrids.length > 0 && (
        <PinnedRosterBoard
          title="Semester Faculty Comparative Performance Matrix"
          subtitle="Comparative ranking and parameter evaluation scores for all course faculty."
          badge={`${report.facultyGrids.length} FACULTY MEMBERS`}
          icon={<Award className="w-4 h-4 text-amber-500" />}
        >
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[550px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#382710] bg-slate-50/70 dark:bg-[#140e07] text-slate-500 dark:text-[#c4a97d] font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-4">Faculty Member</th>
                  <th className="py-2.5 px-4">Subject</th>
                  <th className="py-2.5 px-4 text-center">Submissions</th>
                  <th className="py-2.5 px-4 text-center">Average Rating</th>
                  <th className="py-2.5 px-4">Performance Benchmark</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2d1f11]">
                {report.facultyGrids.map((fg, idx) => {
                  const score = fg.report.compositeAverageScore;
                  const scoreColor =
                    score >= 4.0
                      ? 'text-indigo-700 dark:text-indigo-400 font-bold'
                      : score >= 3.0
                      ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                      : score >= 2.0
                      ? 'text-amber-700 dark:text-amber-400 font-bold'
                      : 'text-red-700 dark:text-red-400 font-bold';

                  return (
                    <tr key={idx} className="bg-white dark:bg-[#1a1208] hover:bg-amber-50/50 dark:hover:bg-[#25180c] transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-[#faebd0]">{fg.facultyName}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-[#c4a97d]">
                        {fg.subjectName} {fg.subjectCode && `(${fg.subjectCode})`}
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-700 dark:text-[#faebd0]">
                        {fg.report.validResponses}
                      </td>
                      <td className={`py-3 px-4 text-center ${scoreColor}`}>
                        {fg.report.hasData ? `${score.toFixed(2)} / 5.00` : 'No Data'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-36 bg-slate-100 dark:bg-[#140e07] rounded-full h-2 overflow-hidden border border-slate-200 dark:border-[#382710]">
                          <div
                            className={`h-2 rounded-full ${
                              score >= 4.0
                                ? 'bg-indigo-500'
                                : score >= 3.0
                                ? 'bg-emerald-500'
                                : score >= 2.0
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${fg.report.hasData ? (score / 5) * 100 : 0}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedGridIndex(idx)}
                          className="px-2.5 py-1 text-[11px] font-bold text-bce-cobalt dark:text-amber-400 bg-blue-50 dark:bg-[#25180c] hover:bg-blue-100 dark:hover:bg-[#382710] border border-blue-200 dark:border-[#4d3817] rounded-[3px] transition-colors cursor-pointer"
                        >
                          View Details →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="md:hidden p-3.5 space-y-2.5">
            {report.facultyGrids.map((fg, idx) => {
              const score = fg.report.compositeAverageScore;
              const scoreBadgeColor =
                score >= 4.0
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                  : score >= 3.0
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : score >= 2.0
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                  : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';

              return (
                <div key={idx} className="p-3 bg-slate-50 dark:bg-[#140e07] border border-slate-200 dark:border-[#382710] rounded-[3px] space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-[#faebd0] text-sm leading-snug">{fg.facultyName}</h4>
                      <p className="text-xs text-slate-600 dark:text-[#c4a97d] mt-0.5">
                        {fg.subjectName} {fg.subjectCode && <span className="font-mono text-[10px] text-slate-400 dark:text-[#8c7453]">({fg.subjectCode})</span>}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-[2px] text-[10px] font-bold border shrink-0 ${scoreBadgeColor}`}>
                      {fg.report.hasData ? `${score.toFixed(2)} / 5.00` : 'No Data'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#c4a97d]">
                      <span>Submissions: <strong className="text-slate-800 dark:text-[#faebd0]">{fg.report.validResponses}</strong></span>
                      <span>Benchmark: {fg.report.hasData ? `${Math.round((score / 5) * 100)}%` : '0%'}</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-[#20150b] rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full ${
                          score >= 4.0
                            ? 'bg-indigo-500'
                            : score >= 3.0
                            ? 'bg-emerald-500'
                            : score >= 2.0
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${fg.report.hasData ? (score / 5) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedGridIndex(idx)}
                    className="w-full py-1.5 text-xs font-bold text-bce-cobalt dark:text-amber-400 bg-white dark:bg-[#1a1309] hover:bg-blue-50 dark:hover:bg-[#25180c] border border-blue-200 dark:border-[#4d3817] rounded-[3px] transition-all cursor-pointer text-center"
                  >
                    View Details →
                  </button>
                </div>
              );
            })}
          </div>
        </PinnedRosterBoard>
      )}

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Parameter-wise Average */}
        <PinnedRosterBoard className="space-y-3">
          <div className="border-b border-slate-200 dark:border-[#382613] pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#faebd0]">
              Evaluation Parameter Scores (1.00 — 5.00)
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#c4a97d]">
              Weighted average rating calculated across valid student submissions.
            </p>
          </div>
          <ParameterScoreBarChart parameters={currentReport.parameters} hasData={currentReport.hasData} />
        </PinnedRosterBoard>

        {/* Parameter Distribution Stacked Bar */}
        <PinnedRosterBoard className="space-y-3">
          <div className="border-b border-slate-200 dark:border-[#382613] pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#faebd0]">
              Parameter Rating Distribution (%)
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#c4a97d]">
              Detailed percentage breakdown of Excellent, Very Good, Good, Satisfactory, and Unsatisfactory.
            </p>
          </div>
          <ParameterDistributionStackedChart
            parameters={currentReport.parameters}
            hasData={currentReport.hasData}
          />
        </PinnedRosterBoard>

        {/* Overall Distribution Donut */}
        <PinnedRosterBoard className="space-y-3 lg:col-span-2">
          <div className="border-b border-slate-200 dark:border-[#382613] pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#faebd0]">Overall Rating Tier Breakdown</h3>
            <p className="text-xs text-slate-500 dark:text-[#c4a97d]">
              Institutional breakdown of all valid submitted evaluation items.
            </p>
          </div>
          <OverallDonutChart distribution={currentReport.distribution} hasData={currentReport.hasData} />
        </PinnedRosterBoard>
      </div>

      {/* Parameter-by-Parameter Breakdown (8 Cards) */}
      <PinnedRosterBoard className="space-y-3.5 sm:space-y-4">
        <div className="border-b border-slate-200 dark:border-[#382613] pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#faebd0]">
              Standard BCE 8-Parameter Detailed Performance Breakdown
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#c4a97d]">
              Itemized metrics, score calculations, and data-driven interpretations.
            </p>
          </div>
          <span className="text-xs text-slate-500 dark:text-[#a88d67] font-medium">8 Parameters Configured</span>
        </div>

        {!currentReport.hasData ? (
          <div className="py-10 text-center text-slate-400 dark:text-[#8c7453] space-y-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-[#faebd0]">No feedback responses are available yet.</p>
            <p className="text-xs text-slate-500 dark:text-[#c4a97d] max-w-md mx-auto">
              Once responses are recorded in the Google Sheet, this section will automatically display itemized scores, response percentages, and objective observations.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentReport.parameters.map(p => {
              const scoreColor =
                p.averageScore >= 4.0
                  ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800/60'
                  : p.averageScore >= 3.0
                  ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/60'
                  : p.averageScore >= 2.0
                  ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/60'
                  : 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800/60';

              return (
                <div
                  key={p.parameterId}
                  className="p-3 sm:p-4 bg-white/80 dark:bg-[#1a1209] rounded-[3px] border border-slate-200 dark:border-[#3d2c18] space-y-2.5 sm:space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-xs text-slate-900 dark:text-[#faebd0]">
                          {p.parameterId}. {p.title}
                        </h4>
                        {p.parameterId === 8 ? (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-[2px] border border-amber-300 dark:border-amber-700/50">
                            Overall Rating (Q8)
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-[2px] border border-blue-200 dark:border-blue-800/50">
                            Evaluation Parameter
                          </span>
                        )}
                      </div>
                      {p.description && (
                        <p className="text-[11px] text-slate-500 dark:text-[#c4a97d] mt-0.5">{p.description}</p>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-[2px] text-xs font-bold border shrink-0 ${scoreColor}`}
                    >
                      {p.validCount > 0 ? `${p.averageScore.toFixed(2)} / 5.00` : 'N/A'}
                    </span>
                  </div>

                  {/* Progress Bar Visual */}
                  <div className="w-full bg-slate-200 dark:bg-[#20150b] rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-bce-cobalt dark:bg-amber-500 h-1.5 rounded-full transition-all"
                      style={{
                        width: `${p.validCount > 0 ? (p.averageScore / 5) * 100 : 0}%`,
                      }}
                    />
                  </div>

                  {/* 5 Tiers Breakdown Grid */}
                  <div className="grid grid-cols-5 gap-1 text-center pt-1 border-t border-slate-200/60 dark:border-[#382613] text-[10px]">
                    <div className="p-1 bg-white dark:bg-[#140e06] rounded-[2px] border border-slate-200 dark:border-[#2f2010]">
                      <span className="text-indigo-700 dark:text-indigo-400 font-bold block">Excellent</span>
                      <span className="text-slate-800 dark:text-[#faebd0] font-semibold">{p.excellentCount}</span>
                      <span className="text-slate-400 dark:text-[#8c7453] block text-[9px]">({p.excellentPct}%)</span>
                    </div>
                    <div className="p-1 bg-white dark:bg-[#140e06] rounded-[2px] border border-slate-200 dark:border-[#2f2010]">
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold block">V. Good</span>
                      <span className="text-slate-800 dark:text-[#faebd0] font-semibold">{p.veryGoodCount}</span>
                      <span className="text-slate-400 dark:text-[#8c7453] block text-[9px]">({p.veryGoodPct}%)</span>
                    </div>
                    <div className="p-1 bg-white dark:bg-[#140e06] rounded-[2px] border border-slate-200 dark:border-[#2f2010]">
                      <span className="text-blue-700 dark:text-blue-400 font-bold block">Good</span>
                      <span className="text-slate-800 dark:text-[#faebd0] font-semibold">{p.goodCount}</span>
                      <span className="text-slate-400 dark:text-[#8c7453] block text-[9px]">({p.goodPct}%)</span>
                    </div>
                    <div className="p-1 bg-white dark:bg-[#140e06] rounded-[2px] border border-slate-200 dark:border-[#2f2010]">
                      <span className="text-amber-700 dark:text-amber-400 font-bold block">Satisfactory</span>
                      <span className="text-slate-800 dark:text-[#faebd0] font-semibold">{p.satisfactoryCount}</span>
                      <span className="text-slate-400 dark:text-[#8c7453] block text-[9px]">({p.satisfactoryPct}%)</span>
                    </div>
                    <div className="p-1 bg-white dark:bg-[#140e06] rounded-[2px] border border-slate-200 dark:border-[#2f2010]">
                      <span className="text-red-700 dark:text-red-400 font-bold block">Unsat.</span>
                      <span className="text-slate-800 dark:text-[#faebd0] font-semibold">{p.unsatisfactoryCount}</span>
                      <span className="text-slate-400 dark:text-[#8c7453] block text-[9px]">({p.unsatisfactoryPct}%)</span>
                    </div>
                  </div>

                  {/* Factual Interpretation */}
                  <p className="text-[11px] text-slate-600 dark:text-[#c4a97d] italic bg-white dark:bg-[#140e06] p-2 rounded-[2px] border border-slate-200 dark:border-[#2f2010]">
                    &ldquo;{p.interpretation}&rdquo;
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </PinnedRosterBoard>

      {/* PDF Download Upgrade / Watermark Choice Modal */}
      <PdfDownloadUpgradeModal
        isOpen={Boolean(pendingPdfDownload)}
        onClose={() => setPendingPdfDownload(null)}
        onProceedWithWatermark={handleProceedWithWatermark}
        isDownloading={Boolean(downloadingPdfType)}
        documentTitle={
          pendingPdfDownload?.typeKey === 'SEMESTER'
            ? `Semester Feedback Comparative Evaluation — ${report.branch} (${report.semester})`
            : activeFacultyGrid
            ? `Faculty Feedback Report — ${activeFacultyGrid.facultyName} (${activeFacultyGrid.subjectName})`
            : `Faculty Feedback Report — ${report.facultyName}`
        }
      />
    </div>
  );
}
