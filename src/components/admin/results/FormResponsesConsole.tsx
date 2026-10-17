'use client';

import React, { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Download,
  ArrowLeft,
  X,
  AlertCircle,
  Loader2,
  User,
  GraduationCap,
  CheckCircle2,
  RefreshCw,
  Ban,
  RotateCcw,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Info,
} from 'lucide-react';
import {
  AdminResponseItem,
  AdminResponsesResult,
  StudentResponseDetail,
  getFormResponsesAction,
  getResponseDetailAction,
  toggleResponseExclusionAction,
} from '@/app/admin/results/responses/actions';
import { syncSingleFormResponsesAction } from '@/app/admin/results/actions';
import { downloadPdfFile } from '@/lib/utils/pdf-download';
import { PdfDownloadUpgradeModal } from '@/components/admin/pdf/PdfDownloadUpgradeModal';
import { ExamPadCard } from '@/components/ui/ExamPadCard';
import { PinnedRosterBoard } from '@/components/ui/PinnedRosterBoard';

interface Props {
  formId: string;
  initialData: AdminResponsesResult;
}

const PRESET_EXCLUSION_REASONS = [
  'Duplicate registration number (older submission)',
  'Duplicate registration number (superseded)',
  'Repeated email submission',
  'Corrupted or invalid evaluation entry',
  'Student requested resubmission',
  'Test or unauthorized submission',
  'Other custom reason',
];

export function FormResponsesConsole({ formId, initialData }: Props) {
  const [data, setData] = useState<AdminResponsesResult>(initialData);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pageSize, setPageSize] = useState<number>(initialData.pageSize || 20);
  const [currentPage, setCurrentPage] = useState<number>(initialData.page || 1);
  const [activeFilter, setActiveFilter] = useState<
    'ALL' | 'INCLUDED' | 'EXCLUDED' | 'DUPLICATE_REG' | 'DUPLICATE_EMAIL'
  >(initialData.activeFilter || 'ALL');

  const [isPending, startTransition] = useTransition();
  const [selectedDetail, setSelectedDetail] = useState<StudentResponseDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [downloadNotification, setDownloadNotification] = useState<{
    type: 'error' | 'success';
    message: string;
  } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Exclusion & Restoration Modal State
  const [excludingTarget, setExcludingTarget] = useState<AdminResponseItem | null>(null);
  const [selectedPresetReason, setSelectedPresetReason] = useState<string>(PRESET_EXCLUSION_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [isExcludingPending, setIsExcludingPending] = useState(false);

  const [includingTarget, setIncludingTarget] = useState<AdminResponseItem | null>(null);
  const [isIncludingPending, setIsIncludingPending] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    setDownloadNotification(null);
    try {
      const res = await syncSingleFormResponsesAction(formId);
      if (res.success) {
        setDownloadNotification({
          type: 'success',
          message: res.message || `Responses synchronized successfully. Total: ${res.totalResponses}.`,
        });
        loadResponses(1, search, startDate, endDate, pageSize, activeFilter);
      } else {
        setDownloadNotification({
          type: 'error',
          message: res.error || 'Failed to synchronize responses.',
        });
      }
    } catch (err: any) {
      setDownloadNotification({
        type: 'error',
        message: err?.message || 'Error triggering response sync.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const [pendingResponsePdfId, setPendingResponsePdfId] = useState<string | null>(null);

  const handleInitiateResponsePdf = (responseId: string) => {
    setPendingResponsePdfId(responseId);
  };

  const executeDownloadResponsePdf = async (responseId: string) => {
    if (!responseId) {
      setDownloadNotification({
        type: 'error',
        message: 'Invalid response identifier.',
      });
      return;
    }

    setDownloadingPdfId(responseId);
    setDownloadNotification(null);

    try {
      await downloadPdfFile({
        url: `/api/admin/results/${formId}/responses/${encodeURIComponent(responseId)}/pdf`,
        defaultFilename: `student-response-${responseId.slice(0, 8)}.pdf`,
        onError: (err) => {
          const msg = typeof err === 'string' ? err : err.message;
          setDownloadNotification({
            type: 'error',
            message: `PDF Download Error: ${msg}`,
          });
        },
        onSuccess: () => {
          setDownloadNotification({
            type: 'success',
            message: 'Student Response PDF downloaded successfully.',
          });
          setTimeout(() => setDownloadNotification(null), 4000);
        },
      });
    } catch (err: any) {
      console.error('PDF download error:', err);
      setDownloadNotification({
        type: 'error',
        message: `Failed to download PDF: ${err?.message || 'Network error'}`,
      });
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const handleProceedWithWatermark = async () => {
    if (!pendingResponsePdfId) return;
    const respId = pendingResponsePdfId;
    setPendingResponsePdfId(null);
    await executeDownloadResponsePdf(respId);
  };

  // Fetch responses on search, filter, or pagination changes
  const loadResponses = (
    page: number,
    currentSearch = search,
    currentStart = startDate,
    currentEnd = endDate,
    currentSize = pageSize,
    currentFilter = activeFilter
  ) => {
    startTransition(async () => {
      const res = await getFormResponsesAction({
        formId,
        page,
        pageSize: currentSize,
        search: currentSearch,
        startDate: currentStart,
        endDate: currentEnd,
        filter: currentFilter,
      });
      if (res.success) {
        setData(res);
        setCurrentPage(page);
      }
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadResponses(1, search, startDate, endDate, pageSize, activeFilter);
  };

  const handleFilterChange = (
    newFilter: 'ALL' | 'INCLUDED' | 'EXCLUDED' | 'DUPLICATE_REG' | 'DUPLICATE_EMAIL'
  ) => {
    setActiveFilter(newFilter);
    loadResponses(1, search, startDate, endDate, pageSize, newFilter);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > data.totalPages) return;
    loadResponses(newPage, search, startDate, endDate, pageSize, activeFilter);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    loadResponses(1, search, startDate, endDate, newSize, activeFilter);
  };

  const handleViewDetail = async (responseId: string) => {
    setLoadingDetail(responseId);
    try {
      const res = await getResponseDetailAction({ formId, responseId });
      if (res.success && res.detail) {
        setSelectedDetail(res.detail);
      } else {
        setDownloadNotification({
          type: 'error',
          message: res.error || 'Failed to load response detail.',
        });
      }
    } catch (err) {
      console.error(err);
      setDownloadNotification({
        type: 'error',
        message: 'Error fetching response detail.',
      });
    } finally {
      setLoadingDetail(null);
    }
  };

  // Initiate Exclusion
  const handleInitiateExclude = (item: AdminResponseItem) => {
    setExcludingTarget(item);
    setSelectedPresetReason(
      item.isDuplicateRegNo
        ? 'Duplicate registration number (superseded)'
        : item.isDuplicateEmail
        ? 'Repeated email submission'
        : PRESET_EXCLUSION_REASONS[0]
    );
    setCustomReason('');
  };

  // Confirm Exclusion
  const handleConfirmExclude = async () => {
    if (!excludingTarget) return;

    setIsExcludingPending(true);
    setDownloadNotification(null);

    const finalReason =
      selectedPresetReason === 'Other custom reason'
        ? customReason.trim() || 'Manual exclusion by administrator'
        : customReason.trim()
        ? `${selectedPresetReason}: ${customReason.trim()}`
        : selectedPresetReason;

    try {
      const targetId = excludingTarget.googleResponseId || excludingTarget.id;
      const res = await toggleResponseExclusionAction({
        formId,
        responseId: targetId,
        exclude: true,
        reason: finalReason,
      });

      if (res.success) {
        setDownloadNotification({
          type: 'success',
          message: res.message || 'Response excluded from analytics successfully.',
        });
        setExcludingTarget(null);

        // If the detail modal is currently showing this item, update it
        if (selectedDetail && (selectedDetail.responseId === targetId || selectedDetail.responseId === excludingTarget.id)) {
          setSelectedDetail((prev) => (prev ? { ...prev, isExcluded: true, exclusionReason: finalReason } : null));
        }

        loadResponses(currentPage, search, startDate, endDate, pageSize, activeFilter);
      } else {
        setDownloadNotification({
          type: 'error',
          message: res.error || 'Failed to exclude response.',
        });
      }
    } catch (err: any) {
      setDownloadNotification({
        type: 'error',
        message: err?.message || 'Error occurred while excluding response.',
      });
    } finally {
      setIsExcludingPending(false);
    }
  };

  // Initiate Include / Restore
  const handleInitiateInclude = (item: AdminResponseItem) => {
    setIncludingTarget(item);
  };

  // Confirm Include / Restore
  const handleConfirmInclude = async () => {
    if (!includingTarget) return;

    setIsIncludingPending(true);
    setDownloadNotification(null);

    try {
      const targetId = includingTarget.googleResponseId || includingTarget.id;
      const res = await toggleResponseExclusionAction({
        formId,
        responseId: targetId,
        exclude: false,
      });

      if (res.success) {
        setDownloadNotification({
          type: 'success',
          message: res.message || 'Response restored to analytics successfully.',
        });
        setIncludingTarget(null);

        // If the detail modal is currently showing this item, update it
        if (selectedDetail && (selectedDetail.responseId === targetId || selectedDetail.responseId === includingTarget.id)) {
          setSelectedDetail((prev) => (prev ? { ...prev, isExcluded: false, exclusionReason: null } : null));
        }

        loadResponses(currentPage, search, startDate, endDate, pageSize, activeFilter);
      } else {
        setDownloadNotification({
          type: 'error',
          message: res.error || 'Failed to restore response.',
        });
      }
    } catch (err: any) {
      setDownloadNotification({
        type: 'error',
        message: err?.message || 'Error occurred while restoring response.',
      });
    } finally {
      setIsIncludingPending(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Header Card */}
      <ExamPadCard variant="dashboard" clipLabel="STUDENT RESPONSES LEDGER" className="space-y-3.5 sm:space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/admin/dashboard/results/${formId}`}
              className="p-2 rounded-[3px] text-slate-500 hover:text-slate-900 dark:text-[#c4a97d] dark:hover:text-[#faebd0] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Back to Form Results Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-[#faebd0]">Student Responses</h1>
                <span className="px-2 py-0.5 rounded-[2px] text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                  {data.formType === 'SEMESTER_FEEDBACK' ? 'Multi-Faculty Semester' : 'Faculty Feedback'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#c4a97d] font-medium mt-0.5">
                {data.formTitle} — <span className="font-bold text-slate-800 dark:text-[#faebd0]">{data.totalSubmissions ?? data.totalCount} Total Submissions</span> Recorded •{' '}
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">{data.includedCount ?? data.totalCount} Included</span> •{' '}
                <span className="font-semibold text-rose-700 dark:text-rose-400">{data.excludedCount ?? 0} Excluded</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSync}
              disabled={isSyncing}
              aria-busy={isSyncing ? 'true' : undefined}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-bce-cobalt hover:bg-bce-navy text-white rounded-[3px] text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Responses'}</span>
            </button>
            <Link
              href={`/admin/dashboard/results/${formId}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-[#1a1208] hover:bg-slate-50 dark:hover:bg-[#25180c] text-slate-700 dark:text-[#faebd0] rounded-[3px] text-xs font-bold transition-all border border-slate-300 dark:border-[#4d3817]"
            >
              <span>Back to Analytics</span>
            </Link>
          </div>
        </div>

        {/* Duplicate Submissions Advisory Banner */}
        {(data.duplicateRegCount > 0 || data.duplicateEmailCount > 0) && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-[3px] bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/50 text-amber-900 dark:text-amber-200 text-xs">
            <div className="flex items-start sm:items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <span className="font-bold">Duplicate Submissions Review Required:</span>{' '}
                <span>
                  {data.duplicateRegCount > 0 && `${data.duplicateRegCount} submission(s) share a Registration Number. `}
                  {data.duplicateEmailCount > 0 && `${data.duplicateEmailCount} submission(s) share a Verified Email. `}
                  Students are permitted to submit multiple times without restriction. Review submission timestamps to decide which response(s) remain included in analytics.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 pl-6 sm:pl-0">
              {data.duplicateRegCount > 0 && activeFilter !== 'DUPLICATE_REG' && (
                <button
                  type="button"
                  onClick={() => handleFilterChange('DUPLICATE_REG')}
                  className="px-2.5 py-1 rounded-[2px] bg-amber-200/80 dark:bg-amber-900/60 hover:bg-amber-300/80 dark:hover:bg-amber-800/60 text-amber-900 dark:text-amber-200 text-[11px] font-bold transition-colors cursor-pointer"
                >
                  View Duplicate Reg No ({data.duplicateRegCount})
                </button>
              )}
              {data.duplicateEmailCount > 0 && activeFilter !== 'DUPLICATE_EMAIL' && (
                <button
                  type="button"
                  onClick={() => handleFilterChange('DUPLICATE_EMAIL')}
                  className="px-2.5 py-1 rounded-[2px] bg-amber-200/80 dark:bg-amber-900/60 hover:bg-amber-300/80 dark:hover:bg-amber-800/60 text-amber-900 dark:text-amber-200 text-[11px] font-bold transition-colors cursor-pointer"
                >
                  View Duplicate Email ({data.duplicateEmailCount})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Filter Navigation Tabs Bar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200 dark:border-[#382613]">
          <button
            type="button"
            onClick={() => handleFilterChange('ALL')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'ALL'
                ? 'bg-slate-900 dark:bg-[#382613] text-white shadow-xs border border-slate-800 dark:border-amber-500/40'
                : 'bg-slate-100 dark:bg-[#1a1208] hover:bg-slate-200 dark:hover:bg-[#25180c] text-slate-700 dark:text-[#c4a97d] border border-slate-200 dark:border-[#3d2c18]'
            }`}
          >
            <span>All</span>
            <span
              className={`px-1.5 py-0.2 rounded-[2px] text-[10px] font-bold ${
                activeFilter === 'ALL'
                  ? 'bg-slate-800 dark:bg-black/40 text-white'
                  : 'bg-white dark:bg-[#120b04] text-slate-600 dark:text-[#c4a97d] border border-slate-200 dark:border-[#3d2c18]'
              }`}
            >
              {data.totalSubmissions ?? data.totalCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('INCLUDED')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'INCLUDED'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Included</span>
            <span
              className={`px-1.5 py-0.2 rounded-[2px] text-[10px] font-bold ${
                activeFilter === 'INCLUDED'
                  ? 'bg-emerald-800 text-white'
                  : 'bg-white dark:bg-[#120b04] text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
              }`}
            >
              {data.includedCount ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('EXCLUDED')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'EXCLUDED'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50'
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            <span>Excluded</span>
            <span
              className={`px-1.5 py-0.2 rounded-[2px] text-[10px] font-bold ${
                activeFilter === 'EXCLUDED'
                  ? 'bg-rose-800 text-white'
                  : 'bg-white dark:bg-[#120b04] text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40'
              }`}
            >
              {data.excludedCount ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('DUPLICATE_REG')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'DUPLICATE_REG'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Duplicate Registration</span>
            {data.duplicateRegCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-[2px] text-[10px] font-bold ${
                  activeFilter === 'DUPLICATE_REG'
                    ? 'bg-amber-700 text-white'
                    : 'bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200'
                }`}
              >
                {data.duplicateRegCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('DUPLICATE_EMAIL')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'DUPLICATE_EMAIL'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Duplicate Email</span>
            {data.duplicateEmailCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-[2px] text-[10px] font-bold ${
                  activeFilter === 'DUPLICATE_EMAIL'
                    ? 'bg-amber-700 text-white'
                    : 'bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200'
                }`}
              >
                {data.duplicateEmailCount}
              </span>
            )}
          </button>
        </div>

        {/* Search & Date Filter Toolbar */}
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-[#8c7453] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by student name, reg no, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-[3px] bg-white dark:bg-[#1a1208] border border-slate-200 dark:border-[#3d2c18] focus:bg-white dark:focus:bg-[#1a1208] focus:border-indigo-500 dark:focus:border-amber-500 text-xs text-slate-900 dark:text-[#faebd0] placeholder-slate-400 dark:placeholder-[#8c7453] outline-none transition-all"
            />
          </div>

          <div className="sm:col-span-3 flex items-center gap-1.5 sm:gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                type="date"
                title="Start Date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2 sm:px-3 py-2 rounded-[3px] bg-white dark:bg-[#1a1208] border border-slate-200 dark:border-[#3d2c18] focus:border-indigo-500 dark:focus:border-amber-500 text-xs text-slate-700 dark:text-[#faebd0] outline-none min-w-0"
              />
            </div>
            <span className="text-slate-400 dark:text-[#8c7453] text-xs shrink-0">to</span>
            <div className="relative min-w-0 flex-1">
              <input
                type="date"
                title="End Date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2 sm:px-3 py-2 rounded-[3px] bg-white dark:bg-[#1a1208] border border-slate-200 dark:border-[#3d2c18] focus:border-indigo-500 dark:focus:border-amber-500 text-xs text-slate-700 dark:text-[#faebd0] outline-none min-w-0"
              />
            </div>
          </div>

          <div className="sm:col-span-4 flex flex-wrap items-center justify-between sm:justify-end gap-2">
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 dark:bg-amber-600 hover:bg-indigo-700 dark:hover:bg-amber-700 text-white rounded-[3px] text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                <span>Filter</span>
              </button>

            {(search || startDate || endDate || activeFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStartDate('');
                  setEndDate('');
                  setActiveFilter('ALL');
                  loadResponses(1, '', '', '', pageSize, 'ALL');
                }}
                className="px-3 py-2 rounded-[3px] text-xs font-semibold text-slate-600 dark:text-[#c4a97d] hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#c4a97d] ml-auto">
              <span>Show:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="px-2 py-1.5 rounded-[3px] bg-white dark:bg-[#1a1208] border border-slate-200 dark:border-[#3d2c18] text-xs font-medium text-slate-700 dark:text-[#faebd0] outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </form>
      </ExamPadCard>

      {/* Notification Toast/Banner */}
      {downloadNotification && (
        <div
          className={`p-3.5 rounded-[3px] border text-xs flex items-center justify-between gap-2.5 transition-all ${
            downloadNotification.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800/50 text-rose-800 dark:text-rose-200'
              : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {downloadNotification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
            <span>{downloadNotification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setDownloadNotification(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Responses Table Card */}
      <PinnedRosterBoard className="space-y-0 p-0 overflow-hidden">
        {isPending ? (
          <div className="py-12 text-center text-slate-400 dark:text-[#8c7453]">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500 dark:text-amber-500" />
            <span>Loading responses...</span>
          </div>
        ) : data.responses.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-[#8c7453] px-4">
            <User className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-[#523e26]" />
            <p className="font-semibold text-slate-700 dark:text-[#faebd0] text-sm">No Student Responses Found</p>
            <p className="text-xs text-slate-500 dark:text-[#c4a97d] mt-1 max-w-md mx-auto">
              {search || startDate || endDate || activeFilter !== 'ALL'
                ? 'No responses match your filter criteria.'
                : 'No students have submitted feedback responses for this form yet, or responses need to be synced.'}
            </p>
            {!search && !startDate && !endDate && activeFilter === 'ALL' && (
              <button
                type="button"
                onClick={handleSync}
                disabled={isSyncing}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-bce-cobalt hover:bg-bce-navy text-white rounded-[3px] text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Responses Now'}</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View (>= md: 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-[#c4a97d]">
                <thead className="bg-slate-100/90 dark:bg-[#140e06] text-slate-700 dark:text-[#faebd0] font-bold border-b border-slate-200 dark:border-[#382613] text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">University Reg No</th>
                    <th className="py-3 px-4">Verified Email</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Submission Date</th>
                    <th className="py-3 px-4">Response ID</th>
                    <th className="py-3 px-4 text-center">Receipt</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#25180c] font-medium">
                  {data.responses.map((row) => (
                    <tr
                      key={row.id}
                      className={`transition-colors ${
                        row.isExcluded
                          ? 'bg-rose-50/20 dark:bg-rose-950/20 hover:bg-rose-50/40 dark:hover:bg-rose-950/30'
                          : 'bg-white dark:bg-[#1a1208] hover:bg-amber-50/40 dark:hover:bg-[#25180c]'
                      }`}
                    >
                      {/* Student Name */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-[#faebd0]">
                          {row.studentName || 'Confidential Student'}
                        </div>
                      </td>

                      {/* University Registration Number & Duplicate Badge */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-medium text-slate-800 dark:text-[#faebd0]">
                          {row.registrationNumber || 'N/A'}
                        </div>
                        {row.isDuplicateRegNo && (
                          <div className="mt-1">
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/50"
                              title={`Duplicate registration number detected. Found in ${row.duplicateRegCount} submissions.`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-700 dark:text-amber-400 shrink-0" />
                              <span>Duplicate Registration No. — Review Required</span>
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Verified Email & Repeated Email Badge */}
                      <td className="py-3 px-4">
                        <div className="text-slate-600 dark:text-[#c4a97d] truncate max-w-[200px]" title={row.studentEmail}>
                          {row.studentEmail &&
                          row.studentEmail.toUpperCase() !== 'N/A' &&
                          !row.studentEmail.includes('@bcebhagalpur.ac.in') &&
                          !row.studentEmail.includes('@student.campusflow.in') ? (
                            row.studentEmail
                          ) : (
                            <span className="font-mono text-slate-400 dark:text-[#8c7453] font-medium text-xs">N/A</span>
                          )}
                        </div>
                        {row.isDuplicateEmail && (
                          <div className="mt-1">
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/50"
                              title={`Same email used for ${row.duplicateEmailCount} submissions.`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-700 dark:text-amber-400 shrink-0" />
                              <span>Repeated Email</span>
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Inclusion Status Badge */}
                      <td className="py-3 px-4 text-center">
                        {row.isExcluded ? (
                          <div>
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800/50"
                              title={row.exclusionReason ? `Excluded: ${row.exclusionReason}` : 'Excluded from analytics'}
                            >
                              <Ban className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" />
                              <span>EXCLUDED</span>
                            </span>
                            {row.exclusionReason && (
                              <p
                                className="text-[10px] text-slate-400 dark:text-[#8c7453] truncate max-w-[110px] mt-0.5 mx-auto"
                                title={row.exclusionReason}
                              >
                                {row.exclusionReason}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/50">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                            <span>INCLUDED</span>
                          </span>
                        )}
                      </td>

                      {/* Submission Date/Time */}
                      <td className="py-3 px-4 text-slate-500 dark:text-[#c4a97d] whitespace-nowrap" suppressHydrationWarning>
                        {row.submittedAt ? (
                          isMounted ? (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400 dark:text-[#8c7453]" />
                              <span>
                                {new Date(row.submittedAt).toLocaleString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          ) : (
                            row.submittedAt.slice(0, 16).replace('T', ' ')
                          )
                        ) : (
                          'Google Form Recorded'
                        )}
                      </td>

                      {/* Response ID */}
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-400 dark:text-[#8c7453]" title={row.googleResponseId}>
                        {row.googleResponseId.length > 12
                          ? `${row.googleResponseId.slice(0, 10)}…`
                          : row.googleResponseId}
                      </td>

                      {/* Receipt Status */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-[2px] text-[10px] font-bold ${
                            row.emailStatus === 'SENT'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/50'
                              : row.emailStatus === 'EMAIL_NOT_CONFIGURED'
                              ? 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-[#c4a97d] border border-slate-200 dark:border-[#382613]'
                              : row.emailStatus === 'FAILED'
                              ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800/50'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50'
                          }`}
                        >
                          {row.emailStatus}
                        </span>
                      </td>

                      {/* Actions: View | PDF | Exclude / Include */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleViewDetail(row.googleResponseId || row.id)}
                            disabled={loadingDetail === (row.googleResponseId || row.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[3px] bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer"
                            title="View Submission Details"
                          >
                            {loadingDetail === (row.googleResponseId || row.id) ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                            <span>View</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleInitiateResponsePdf(row.googleResponseId || row.id)}
                            disabled={downloadingPdfId === (row.googleResponseId || row.id)}
                            aria-busy={downloadingPdfId === (row.googleResponseId || row.id) ? 'true' : undefined}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[3px] bg-slate-100 dark:bg-[#1a1208] hover:bg-slate-200 dark:hover:bg-[#25180c] text-slate-700 dark:text-[#faebd0] border border-slate-200 dark:border-[#3d2c18] font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer"
                            title="Download Student Response PDF"
                          >
                            {downloadingPdfId === (row.googleResponseId || row.id) ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                            ) : (
                              <Download className="w-3.5 h-3.5 text-slate-500" />
                            )}
                            <span>PDF</span>
                          </button>

                          {row.isExcluded ? (
                            <button
                              type="button"
                              onClick={() => handleInitiateInclude(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[3px] bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-semibold text-xs transition-colors border border-emerald-300 dark:border-emerald-800/50 cursor-pointer"
                              title="Restore and Include in Analytics"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Include</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleInitiateExclude(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[3px] bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-semibold text-xs transition-colors border border-rose-200 dark:border-rose-800/50 cursor-pointer"
                              title="Exclude from Analytics and Reports"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Exclude</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View (< md: 768px) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-[#25180c]">
              {data.responses.map((row) => (
                <div
                  key={row.id}
                  className={`p-4 space-y-3 transition-colors ${
                    row.isExcluded ? 'bg-rose-50/20 dark:bg-rose-950/20' : 'bg-white dark:bg-[#1a1208] hover:bg-slate-50/50 dark:hover:bg-[#25180c]'
                  }`}
                >
                  {/* Card Header: Student Name & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-[#faebd0] text-sm truncate">
                        {row.studentName || 'Confidential Student'}
                      </div>
                      <div className="font-mono text-xs text-slate-600 dark:text-[#c4a97d] mt-0.5">
                        Reg: <span className="font-semibold text-slate-800 dark:text-[#faebd0]">{row.registrationNumber || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {row.isExcluded ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800/50">
                          <Ban className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" />
                          <span>EXCLUDED</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/50">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                          <span>INCLUDED</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Exclusion reason if excluded */}
                  {row.isExcluded && row.exclusionReason && (
                    <div className="text-[11px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/50 rounded-[3px] p-2">
                      <span className="font-semibold">Reason:</span> {row.exclusionReason}
                    </div>
                  )}

                  {/* Duplicate Flags */}
                  {(row.isDuplicateRegNo || row.isDuplicateEmail) && (
                    <div className="space-y-1">
                      {row.isDuplicateRegNo && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/50 w-full">
                          <AlertTriangle className="w-3 h-3 text-amber-700 dark:text-amber-400 shrink-0" />
                          <span>Duplicate Reg No ({row.duplicateRegCount} submissions)</span>
                        </span>
                      )}
                      {row.isDuplicateEmail && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/50 w-full">
                          <AlertTriangle className="w-3 h-3 text-amber-700 dark:text-amber-400 shrink-0" />
                          <span>Repeated Email ({row.duplicateEmailCount} submissions)</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Email & Date metadata */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-500 dark:text-[#c4a97d] pt-1 border-t border-slate-100 dark:border-[#25180c]">
                    <div className="truncate text-slate-600 dark:text-[#c4a97d]" title={row.studentEmail}>
                      ✉️ {row.studentEmail &&
                      row.studentEmail.toUpperCase() !== 'N/A' &&
                      !row.studentEmail.includes('@bcebhagalpur.ac.in') &&
                      !row.studentEmail.includes('@student.campusflow.in') ? (
                        row.studentEmail
                      ) : (
                        <span className="font-mono text-slate-400 dark:text-[#8c7453] font-medium">N/A</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1" suppressHydrationWarning>
                      <Clock className="w-3 h-3 text-slate-400 dark:text-[#8c7453] shrink-0" />
                      <span>
                        {row.submittedAt
                          ? isMounted
                            ? new Date(row.submittedAt).toLocaleString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : row.submittedAt.slice(0, 16).replace('T', ' ')
                          : 'Recorded'}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons: Full width on mobile */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleViewDetail(row.googleResponseId || row.id)}
                      disabled={loadingDetail === (row.googleResponseId || row.id)}
                      className="inline-flex items-center justify-center gap-1 py-2 px-2 rounded-[3px] bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 font-semibold text-xs transition-colors min-h-[38px] cursor-pointer"
                    >
                      {loadingDetail === (row.googleResponseId || row.id) ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                      <span>View</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleInitiateResponsePdf(row.googleResponseId || row.id)}
                      disabled={downloadingPdfId === (row.googleResponseId || row.id)}
                      className="inline-flex items-center justify-center gap-1 py-2 px-2 rounded-[3px] bg-slate-100 dark:bg-[#1a1208] hover:bg-slate-200 dark:hover:bg-[#25180c] text-slate-700 dark:text-[#faebd0] border border-slate-200 dark:border-[#3d2c18] font-semibold text-xs transition-colors min-h-[38px] cursor-pointer"
                    >
                      {downloadingPdfId === (row.googleResponseId || row.id) ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                      )}
                      <span>PDF</span>
                    </button>

                    {row.isExcluded ? (
                      <button
                        type="button"
                        onClick={() => handleInitiateInclude(row)}
                        className="inline-flex items-center justify-center gap-1 py-2 px-2 rounded-[3px] bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-semibold text-xs border border-emerald-300 dark:border-emerald-800/50 transition-colors min-h-[38px] cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Include</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleInitiateExclude(row)}
                        className="inline-flex items-center justify-center gap-1 py-2 px-2 rounded-[3px] bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-semibold text-xs border border-rose-200 dark:border-rose-800/50 transition-colors min-h-[38px] cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Exclude</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination Bar */}
        {data.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 sm:p-4 bg-slate-50 dark:bg-[#140e06] border-t border-slate-200 dark:border-[#382613] text-xs text-slate-600 dark:text-[#c4a97d]">
            <div>
              Showing <span className="font-bold text-slate-900 dark:text-[#faebd0]">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-bold text-slate-900 dark:text-[#faebd0]">
                {Math.min(currentPage * pageSize, data.totalCount)}
              </span>{' '}
              of <span className="font-bold text-slate-900 dark:text-[#faebd0]">{data.totalCount}</span> responses
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-[3px] border border-slate-200 dark:border-[#3d2c18] bg-white dark:bg-[#1a1208] hover:bg-slate-100 dark:hover:bg-[#25180c] disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 dark:text-[#faebd0] cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 font-semibold text-slate-800 dark:text-[#faebd0]">
                {currentPage} / {data.totalPages}
              </span>

              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= data.totalPages}
                className="p-1.5 rounded-[3px] border border-slate-200 dark:border-[#3d2c18] bg-white dark:bg-[#1a1208] hover:bg-slate-100 dark:hover:bg-[#25180c] disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 dark:text-[#faebd0] cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </PinnedRosterBoard>

      {/* Confirmation Modal: Exclude Response */}
      {excludingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#19120a] w-full max-w-lg rounded-[4px] shadow-2xl border border-slate-200 dark:border-[#3d2c18] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 dark:border-rose-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-[3px] bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 flex items-center justify-center font-bold">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-rose-950 dark:text-rose-200 text-sm">Exclude Response from Analytics</h3>
                  <p className="text-[11px] text-rose-700 dark:text-rose-400">
                    Submission remains permanently preserved for audit & history
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExcludingTarget(null)}
                disabled={isExcludingPending}
                className="p-1.5 rounded-[3px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Submission Snapshot */}
              <div className="p-3 bg-slate-50 dark:bg-[#140e06] rounded-[3px] border border-slate-200 dark:border-[#382613] space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400 dark:text-[#8c7453]">Student:</span>
                  <span className="font-bold text-slate-800 dark:text-[#faebd0]">{excludingTarget.studentName || 'Confidential Student'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 dark:text-[#8c7453]">Registration No:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-[#faebd0]">{excludingTarget.registrationNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 dark:text-[#8c7453]">Verified Email:</span>
                  <span className="text-indigo-600 dark:text-amber-400 font-medium">{excludingTarget.studentEmail}</span>
                </div>
                {excludingTarget.submittedAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 dark:text-[#8c7453]">Submitted At:</span>
                    <span className="text-slate-600 dark:text-[#c4a97d] font-mono">
                      {new Date(excludingTarget.submittedAt).toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
              </div>

              {/* Explanatory Policy Alert */}
              <div className="p-3 rounded-[3px] bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  This submission will be <strong>omitted from average ratings, faculty reports, and aggregate distributions</strong>.
                  The raw record is <strong>never deleted</strong> and can be restored at any time.
                </p>
              </div>

              {/* Exclusion Reason Preset Selection */}
              <div>
                <label className="block font-bold text-slate-800 dark:text-[#faebd0] mb-1.5">
                  Select Reason for Exclusion:
                </label>
                <select
                  value={selectedPresetReason}
                  onChange={(e) => setSelectedPresetReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-[3px] bg-slate-50 dark:bg-[#140e06] border border-slate-200 dark:border-[#382613] focus:bg-white dark:focus:bg-[#140e06] focus:border-rose-500 text-xs text-slate-800 dark:text-[#faebd0] outline-none"
                >
                  {PRESET_EXCLUSION_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Reason / Notes Input */}
              <div>
                <label className="block font-bold text-slate-800 dark:text-[#faebd0] mb-1.5">
                  Additional Notes / Justification:
                </label>
                <textarea
                  rows={2}
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Enter details or comments for the audit log..."
                  className="w-full px-3 py-2 rounded-[3px] bg-slate-50 dark:bg-[#140e06] border border-slate-200 dark:border-[#382613] focus:bg-white dark:focus:bg-[#140e06] focus:border-rose-500 text-xs text-slate-800 dark:text-[#faebd0] outline-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-[#382613] bg-slate-50 dark:bg-[#140e06] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setExcludingTarget(null)}
                disabled={isExcludingPending}
                className="px-4 py-2 rounded-[3px] text-xs font-semibold text-slate-600 dark:text-[#c4a97d] hover:bg-slate-200 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmExclude}
                disabled={isExcludingPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-[3px] text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isExcludingPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Ban className="w-3.5 h-3.5" />
                )}
                <span>{isExcludingPending ? 'Excluding...' : 'Confirm Exclusion'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Restore / Include Response */}
      {includingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#19120a] w-full max-w-md rounded-[4px] shadow-2xl border border-slate-200 dark:border-[#3d2c18] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-[3px] bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-emerald-950 dark:text-emerald-200 text-sm">Restore Response to Analytics</h3>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">Re-include submission into institutional ratings</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIncludingTarget(null)}
                disabled={isIncludingPending}
                className="p-1.5 rounded-[3px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs text-slate-700 dark:text-[#c4a97d]">
              <p>
                Are you sure you want to restore the submission from{' '}
                <span className="font-bold text-slate-900 dark:text-[#faebd0]">
                  {includingTarget.studentName || 'Confidential Student'}
                </span>{' '}
                (Reg No: <span className="font-mono font-bold text-slate-800 dark:text-[#faebd0]">{includingTarget.registrationNumber || 'N/A'}</span>)?
              </p>
              <div className="p-3 rounded-[3px] bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-300 text-[11px]">
                This response will immediately be re-included in all averages, faculty performance cards, and generated reports.
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-[#382613] bg-slate-50 dark:bg-[#140e06] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIncludingTarget(null)}
                disabled={isIncludingPending}
                className="px-4 py-2 rounded-[3px] text-xs font-semibold text-slate-600 dark:text-[#c4a97d] hover:bg-slate-200 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmInclude}
                disabled={isIncludingPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[3px] text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isIncludingPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                <span>{isIncludingPending ? 'Restoring...' : 'Restore & Include'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Submission Detail Modal */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#19120a] w-full max-w-2xl rounded-[4px] shadow-2xl border border-slate-200 dark:border-[#3d2c18] overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-3 sm:p-4 bg-slate-50 dark:bg-[#140e06] border-b border-slate-200 dark:border-[#382613] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[3px] bg-indigo-100 dark:bg-amber-950/60 text-indigo-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-[#faebd0] text-sm">Student Submission Details</h3>
                    {selectedDetail.isExcluded ? (
                      <span className="px-2 py-0.2 rounded-[2px] text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50">
                        EXCLUDED
                      </span>
                    ) : (
                      <span className="px-2 py-0.2 rounded-[2px] text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                        INCLUDED
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-[#c4a97d]">
                    Response ID: {selectedDetail.responseId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="p-1.5 rounded-[3px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-3.5 sm:p-5 overflow-y-auto space-y-3.5 sm:space-y-5 text-xs text-slate-600 dark:text-[#c4a97d]">
              {/* Duplicate & Exclusion Warnings */}
              {selectedDetail.isExcluded && (
                <div className="p-3 rounded-[3px] bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-900 dark:text-rose-200 flex items-start gap-2">
                  <Ban className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Manually Excluded from Analytics</span>
                    {selectedDetail.exclusionReason && (
                      <p className="text-[11px] mt-0.5 text-rose-800 dark:text-rose-300">
                        Reason: {selectedDetail.exclusionReason}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {(selectedDetail.isDuplicateRegNo || selectedDetail.isDuplicateEmail) && (
                <div className="p-3 rounded-[3px] bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Duplicate Notice:</span>{' '}
                    <span>
                      {selectedDetail.isDuplicateRegNo && 'Multiple submissions with this Registration Number exist. '}
                      {selectedDetail.isDuplicateEmail && 'Multiple submissions with this Verified Email exist. '}
                      You can exclude this response if an updated submission was made.
                    </span>
                  </div>
                </div>
              )}

              {/* Identity Details Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 dark:bg-[#140e06] rounded-[3px] border border-slate-200 dark:border-[#382613]">
                <div>
                  <span className="text-slate-400 dark:text-[#8c7453] block text-[11px]">Student Name</span>
                  <span className="font-bold text-slate-900 dark:text-[#faebd0]">
                    {selectedDetail.studentName || 'Confidential Student'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-[#8c7453] block text-[11px]">University Reg No</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-[#faebd0]">
                    {selectedDetail.registrationNumber || 'N/A'}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-2">
                  <span className="text-slate-400 dark:text-[#8c7453] block text-[11px]">Verified Email</span>
                  <span className="font-semibold text-indigo-600 dark:text-amber-400 truncate block">
                    {selectedDetail.studentEmail &&
                    selectedDetail.studentEmail.toUpperCase() !== 'N/A' &&
                    !selectedDetail.studentEmail.includes('@bcebhagalpur.ac.in') &&
                    !selectedDetail.studentEmail.includes('@student.campusflow.in') ? (
                      selectedDetail.studentEmail
                    ) : (
                      <span className="font-mono text-slate-400 dark:text-[#8c7453] font-medium text-xs">N/A</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Faculty Evaluation Grids */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 dark:text-[#faebd0] text-sm flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-amber-400" />
                  <span>Evaluation Parameter Breakdown</span>
                </h4>

                {selectedDetail.facultyEvaluations.map((evalItem, eIdx) => (
                  <div key={eIdx} className="rounded-[3px] border border-slate-200 dark:border-[#382613] overflow-hidden">
                    <div className="bg-slate-800 dark:bg-[#120b04] text-white px-4 py-2.5 font-bold text-xs flex items-center justify-between border-b border-slate-700 dark:border-[#382613]">
                      <span>{evalItem.facultyName}</span>
                      <span className="text-slate-300 dark:text-[#c4a97d] font-normal">{evalItem.subjectName}</span>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-[#25180c] bg-white dark:bg-[#1a1208]">
                      {evalItem.ratings.map((r) => {
                        const rLower = (r.rating || '').toLowerCase();
                        const badgeColor = rLower.includes('excellent')
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60'
                          : rLower.includes('very good')
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                          : rLower.includes('good')
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60'
                          : rLower.includes('satisfactory')
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                          : rLower.includes('unsatisfactory')
                          ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
                          : 'bg-slate-50 dark:bg-[#140e06] text-slate-600 dark:text-[#c4a97d] border-slate-200 dark:border-[#382613]';

                        return (
                          <div key={r.parameterId} className="flex items-center justify-between p-3 text-xs">
                            <span className="text-slate-700 dark:text-[#faebd0] max-w-[70%] font-medium">
                              {r.parameterId}. {r.parameterTitle}
                            </span>
                            <span className={`px-2.5 py-1 rounded-[2px] text-[11px] font-bold border ${badgeColor}`}>
                              {r.rating || 'Not Rated'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* General Feedback Comments */}
              {selectedDetail.generalFeedback && (
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-[#faebd0] text-sm mb-1.5">General Feedback</h4>
                  <div className="p-3.5 bg-slate-50 dark:bg-[#140e06] rounded-[3px] border border-slate-200 dark:border-[#382613] text-slate-700 dark:text-[#c4a97d] italic">
                    &ldquo;{selectedDetail.generalFeedback}&rdquo;
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-[#382613] bg-slate-50 dark:bg-[#140e06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleInitiateResponsePdf(selectedDetail.responseId)}
                  disabled={downloadingPdfId === selectedDetail.responseId}
                  aria-busy={downloadingPdfId === selectedDetail.responseId ? 'true' : undefined}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 dark:bg-amber-600 hover:bg-indigo-700 dark:hover:bg-amber-700 text-white rounded-[3px] text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {downloadingPdfId === selectedDetail.responseId ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>{downloadingPdfId === selectedDetail.responseId ? 'Downloading...' : 'PDF'}</span>
                </button>

                {selectedDetail.isExcluded ? (
                  <button
                    type="button"
                    onClick={() => {
                      const matchedItem = data.responses.find(
                        (r) => r.googleResponseId === selectedDetail.responseId || r.id === selectedDetail.responseId
                      );
                      if (matchedItem) {
                        handleInitiateInclude(matchedItem);
                      }
                    }}
                    className="inline-flex items-center gap-1 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 rounded-[3px] text-xs font-bold border border-emerald-300 dark:border-emerald-800/50 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore to Analytics</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const matchedItem = data.responses.find(
                        (r) => r.googleResponseId === selectedDetail.responseId || r.id === selectedDetail.responseId
                      );
                      if (matchedItem) {
                        handleInitiateExclude(matchedItem);
                      }
                    }}
                    className="inline-flex items-center gap-1 px-3 py-2 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-800 dark:text-rose-300 rounded-[3px] text-xs font-bold border border-rose-200 dark:border-rose-800/50 transition-colors cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Exclude from Analytics</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="px-4 py-2 rounded-[3px] text-xs font-semibold text-slate-600 dark:text-[#c4a97d] hover:bg-slate-200 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Download Upgrade / Watermark Choice Modal */}
      <PdfDownloadUpgradeModal
        isOpen={Boolean(pendingResponsePdfId)}
        onClose={() => setPendingResponsePdfId(null)}
        onProceedWithWatermark={handleProceedWithWatermark}
        isDownloading={Boolean(downloadingPdfId)}
        documentTitle={`Student Response Submission Record — #${(pendingResponsePdfId || '').slice(0, 8)}`}
      />
    </div>
  );
}
