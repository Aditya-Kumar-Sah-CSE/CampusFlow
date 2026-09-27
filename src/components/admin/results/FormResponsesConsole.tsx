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

  const handleDownloadResponsePdf = async (responseId: string) => {
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
      <div className="bg-white p-3.5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3.5 sm:space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/admin/dashboard/results/${formId}`}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="Back to Form Results Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">Student Responses</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {data.formType === 'SEMESTER_FEEDBACK' ? 'Multi-Faculty Semester' : 'Faculty Feedback'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {data.formTitle} — <span className="font-bold text-slate-800">{data.totalSubmissions ?? data.totalCount} Total Submissions</span> Recorded •{' '}
                <span className="font-semibold text-emerald-700">{data.includedCount ?? data.totalCount} Included</span> •{' '}
                <span className="font-semibold text-rose-700">{data.excludedCount ?? 0} Excluded</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSync}
              disabled={isSyncing}
              aria-busy={isSyncing ? 'true' : undefined}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-bce-cobalt hover:bg-bce-navy text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Responses'}</span>
            </button>
            <Link
              href={`/admin/dashboard/results/${formId}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-300"
            >
              <span>Back to Analytics</span>
            </Link>
          </div>
        </div>

        {/* Duplicate Submissions Advisory Banner */}
        {(data.duplicateRegCount > 0 || data.duplicateEmailCount > 0) && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs">
            <div className="flex items-start sm:items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
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
                  className="px-2.5 py-1 rounded-lg bg-amber-200/80 hover:bg-amber-300/80 text-amber-900 text-[11px] font-bold transition-colors cursor-pointer"
                >
                  View Duplicate Reg No ({data.duplicateRegCount})
                </button>
              )}
              {data.duplicateEmailCount > 0 && activeFilter !== 'DUPLICATE_EMAIL' && (
                <button
                  type="button"
                  onClick={() => handleFilterChange('DUPLICATE_EMAIL')}
                  className="px-2.5 py-1 rounded-lg bg-amber-200/80 hover:bg-amber-300/80 text-amber-900 text-[11px] font-bold transition-colors cursor-pointer"
                >
                  View Duplicate Email ({data.duplicateEmailCount})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Filter Navigation Tabs Bar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => handleFilterChange('ALL')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <span>All</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeFilter === 'ALL'
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              {data.totalSubmissions ?? data.totalCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('INCLUDED')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'INCLUDED'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Included</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeFilter === 'INCLUDED'
                  ? 'bg-emerald-800 text-white'
                  : 'bg-white text-emerald-700 border border-emerald-200'
              }`}
            >
              {data.includedCount ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('EXCLUDED')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'EXCLUDED'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            <span>Excluded</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeFilter === 'EXCLUDED'
                  ? 'bg-rose-800 text-white'
                  : 'bg-white text-rose-700 border border-rose-200'
              }`}
            >
              {data.excludedCount ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('DUPLICATE_REG')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'DUPLICATE_REG'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Duplicate Registration</span>
            {data.duplicateRegCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeFilter === 'DUPLICATE_REG'
                    ? 'bg-amber-700 text-white'
                    : 'bg-amber-200 text-amber-900'
                }`}
              >
                {data.duplicateRegCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('DUPLICATE_EMAIL')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'DUPLICATE_EMAIL'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Duplicate Email</span>
            {data.duplicateEmailCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeFilter === 'DUPLICATE_EMAIL'
                    ? 'bg-amber-700 text-white'
                    : 'bg-amber-200 text-amber-900'
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
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by student name, reg no, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs text-slate-900 placeholder-slate-400 outline-none transition-all"
            />
          </div>

          <div className="sm:col-span-3 flex items-center gap-1.5 sm:gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                type="date"
                title="Start Date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2 sm:px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 text-xs text-slate-700 outline-none min-w-0"
              />
            </div>
            <span className="text-slate-400 text-xs shrink-0">to</span>
            <div className="relative min-w-0 flex-1">
              <input
                type="date"
                title="End Date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2 sm:px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 text-xs text-slate-700 outline-none min-w-0"
              />
            </div>
          </div>

          <div className="sm:col-span-4 flex flex-wrap items-center justify-between sm:justify-end gap-2">
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
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
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500 ml-auto">
              <span>Show:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </form>
      </div>

      {/* Notification Toast/Banner */}
      {downloadNotification && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-2.5 transition-all ${
            downloadNotification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {downloadNotification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>{downloadNotification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setDownloadNotification(null)}
            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Responses Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isPending ? (
          <div className="py-12 text-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
            <span>Loading responses...</span>
          </div>
        ) : data.responses.length === 0 ? (
          <div className="py-12 text-center text-slate-400 px-4">
            <User className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="font-semibold text-slate-700 text-sm">No Student Responses Found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              {search || startDate || endDate || activeFilter !== 'ALL'
                ? 'No responses match your filter criteria.'
                : 'No students have submitted feedback responses for this form yet, or responses need to be synced.'}
            </p>
            {!search && !startDate && !endDate && activeFilter === 'ALL' && (
              <button
                type="button"
                onClick={handleSync}
                disabled={isSyncing}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-bce-cobalt hover:bg-bce-navy text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
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
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
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
                <tbody className="divide-y divide-slate-100 font-medium">
                  {data.responses.map((row) => (
                    <tr
                      key={row.id}
                      className={`transition-colors ${
                        row.isExcluded
                          ? 'bg-rose-50/30 hover:bg-rose-50/50'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Student Name */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {row.studentName || 'Confidential Student'}
                        </div>
                      </td>

                      {/* University Registration Number & Duplicate Badge */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-medium text-slate-800">
                          {row.registrationNumber || 'N/A'}
                        </div>
                        {row.isDuplicateRegNo && (
                          <div className="mt-1">
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300"
                              title={`Duplicate registration number detected. Found in ${row.duplicateRegCount} submissions.`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                              <span>Duplicate Registration No. — Review Required</span>
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Verified Email & Repeated Email Badge */}
                      <td className="py-3 px-4">
                        <div className="text-slate-600 truncate max-w-[200px]" title={row.studentEmail}>
                          {row.studentEmail}
                        </div>
                        {row.isDuplicateEmail && (
                          <div className="mt-1">
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300"
                              title={`Same email used for ${row.duplicateEmailCount} submissions.`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-700 shrink-0" />
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
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300"
                              title={row.exclusionReason ? `Excluded: ${row.exclusionReason}` : 'Excluded from analytics'}
                            >
                              <Ban className="w-2.5 h-2.5 text-rose-600" />
                              <span>EXCLUDED</span>
                            </span>
                            {row.exclusionReason && (
                              <p
                                className="text-[10px] text-slate-400 truncate max-w-[110px] mt-0.5 mx-auto"
                                title={row.exclusionReason}
                              >
                                {row.exclusionReason}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                            <span>INCLUDED</span>
                          </span>
                        )}
                      </td>

                      {/* Submission Date/Time */}
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap" suppressHydrationWarning>
                        {row.submittedAt ? (
                          isMounted ? (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
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
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-400" title={row.googleResponseId}>
                        {row.googleResponseId.length > 12
                          ? `${row.googleResponseId.slice(0, 10)}…`
                          : row.googleResponseId}
                      </td>

                      {/* Receipt Status */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            row.emailStatus === 'SENT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : row.emailStatus === 'EMAIL_NOT_CONFIGURED'
                              ? 'bg-slate-100 text-slate-600'
                              : row.emailStatus === 'FAILED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
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
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer"
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
                            onClick={() => handleDownloadResponsePdf(row.googleResponseId || row.id)}
                            disabled={downloadingPdfId === (row.googleResponseId || row.id)}
                            aria-busy={downloadingPdfId === (row.googleResponseId || row.id) ? 'true' : undefined}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer"
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
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs transition-colors border border-emerald-300 cursor-pointer"
                              title="Restore and Include in Analytics"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Include</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleInitiateExclude(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs transition-colors border border-rose-200 cursor-pointer"
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
            <div className="md:hidden divide-y divide-slate-100">
              {data.responses.map((row) => (
                <div
                  key={row.id}
                  className={`p-4 space-y-3 transition-colors ${
                    row.isExcluded ? 'bg-rose-50/30' : 'hover:bg-slate-50/50'
                  }`}
                >
                  {/* Card Header: Student Name & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-sm truncate">
                        {row.studentName || 'Confidential Student'}
                      </div>
                      <div className="font-mono text-xs text-slate-600 mt-0.5">
                        Reg: <span className="font-semibold text-slate-800">{row.registrationNumber || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {row.isExcluded ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          <Ban className="w-2.5 h-2.5 text-rose-600" />
                          <span>EXCLUDED</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                          <span>INCLUDED</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Exclusion reason if excluded */}
                  {row.isExcluded && row.exclusionReason && (
                    <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">
                      <span className="font-semibold">Reason:</span> {row.exclusionReason}
                    </div>
                  )}

                  {/* Duplicate Flags */}
                  {(row.isDuplicateRegNo || row.isDuplicateEmail) && (
                    <div className="space-y-1">
                      {row.isDuplicateRegNo && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 w-full">
                          <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                          <span>Duplicate Reg No ({row.duplicateRegCount} submissions)</span>
                        </span>
                      )}
                      {row.isDuplicateEmail && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 w-full">
                          <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                          <span>Repeated Email ({row.duplicateEmailCount} submissions)</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Email & Date metadata */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-500 pt-1 border-t border-slate-100">
                    <div className="truncate text-slate-600" title={row.studentEmail}>
                      ✉️ {row.studentEmail}
                    </div>
                    <div className="flex items-center gap-1" suppressHydrationWarning>
                      <Clock className="w-3 h-3 text-slate-400 shrink-0" />
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
                      className="inline-flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs transition-colors min-h-[38px] cursor-pointer"
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
                      onClick={() => handleDownloadResponsePdf(row.googleResponseId || row.id)}
                      disabled={downloadingPdfId === (row.googleResponseId || row.id)}
                      className="inline-flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors min-h-[38px] cursor-pointer"
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
                        className="inline-flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs border border-emerald-300 transition-colors min-h-[38px] cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Include</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleInitiateExclude(row)}
                        className="inline-flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs border border-rose-200 transition-colors min-h-[38px] cursor-pointer"
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 sm:p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
            <div>
              Showing <span className="font-bold text-slate-900">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-bold text-slate-900">
                {Math.min(currentPage * pageSize, data.totalCount)}
              </span>{' '}
              of <span className="font-bold text-slate-900">{data.totalCount}</span> responses
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 font-semibold text-slate-800">
                {currentPage} / {data.totalPages}
              </span>

              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= data.totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal: Exclude Response */}
      {excludingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-rose-950 text-sm">Exclude Response from Analytics</h3>
                  <p className="text-[11px] text-rose-700">
                    Submission remains permanently preserved for audit & history
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExcludingTarget(null)}
                disabled={isExcludingPending}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Submission Snapshot */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Student:</span>
                  <span className="font-bold text-slate-800">{excludingTarget.studentName || 'Confidential Student'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Registration No:</span>
                  <span className="font-mono font-bold text-slate-800">{excludingTarget.registrationNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Verified Email:</span>
                  <span className="text-indigo-600 font-medium">{excludingTarget.studentEmail}</span>
                </div>
                {excludingTarget.submittedAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Submitted At:</span>
                    <span className="text-slate-600 font-mono">
                      {new Date(excludingTarget.submittedAt).toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
              </div>

              {/* Explanatory Policy Alert */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  This submission will be <strong>omitted from average ratings, faculty reports, and aggregate distributions</strong>.
                  The raw record is <strong>never deleted</strong> and can be restored at any time.
                </p>
              </div>

              {/* Exclusion Reason Preset Selection */}
              <div>
                <label className="block font-bold text-slate-800 mb-1.5">
                  Select Reason for Exclusion:
                </label>
                <select
                  value={selectedPresetReason}
                  onChange={(e) => setSelectedPresetReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-rose-500 text-xs text-slate-800 outline-none"
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
                <label className="block font-bold text-slate-800 mb-1.5">
                  Additional Notes / Justification:
                </label>
                <textarea
                  rows={2}
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Enter details or comments for the audit log..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-rose-500 text-xs text-slate-800 outline-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setExcludingTarget(null)}
                disabled={isExcludingPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmExclude}
                disabled={isExcludingPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-emerald-950 text-sm">Restore Response to Analytics</h3>
                  <p className="text-[11px] text-emerald-700">Re-include submission into institutional ratings</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIncludingTarget(null)}
                disabled={isIncludingPending}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs text-slate-700">
              <p>
                Are you sure you want to restore the submission from{' '}
                <span className="font-bold text-slate-900">
                  {includingTarget.studentName || 'Confidential Student'}
                </span>{' '}
                (Reg No: <span className="font-mono font-bold text-slate-800">{includingTarget.registrationNumber || 'N/A'}</span>)?
              </p>
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-[11px]">
                This response will immediately be re-included in all averages, faculty performance cards, and generated reports.
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIncludingTarget(null)}
                disabled={isIncludingPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmInclude}
                disabled={isIncludingPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">Student Submission Details</h3>
                    {selectedDetail.isExcluded ? (
                      <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        EXCLUDED
                      </span>
                    ) : (
                      <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        INCLUDED
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Response ID: {selectedDetail.responseId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-3.5 sm:p-5 overflow-y-auto space-y-3.5 sm:space-y-5 text-xs text-slate-600">
              {/* Duplicate & Exclusion Warnings */}
              {selectedDetail.isExcluded && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-2">
                  <Ban className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Manually Excluded from Analytics</span>
                    {selectedDetail.exclusionReason && (
                      <p className="text-[11px] mt-0.5 text-rose-800">
                        Reason: {selectedDetail.exclusionReason}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {(selectedDetail.isDuplicateRegNo || selectedDetail.isDuplicateEmail) && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[11px]">Student Name</span>
                  <span className="font-bold text-slate-900">
                    {selectedDetail.studentName || 'Confidential Student'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">University Reg No</span>
                  <span className="font-mono font-bold text-slate-800">
                    {selectedDetail.registrationNumber || 'N/A'}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-2">
                  <span className="text-slate-400 block text-[11px]">Verified Email</span>
                  <span className="font-semibold text-indigo-600 truncate block">
                    {selectedDetail.studentEmail}
                  </span>
                </div>
              </div>

              {/* Faculty Evaluation Grids */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-indigo-600" />
                  <span>Evaluation Parameter Breakdown</span>
                </h4>

                {selectedDetail.facultyEvaluations.map((evalItem, eIdx) => (
                  <div key={eIdx} className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="bg-slate-800 text-white px-4 py-2.5 font-bold text-xs flex items-center justify-between">
                      <span>{evalItem.facultyName}</span>
                      <span className="text-slate-300 font-normal">{evalItem.subjectName}</span>
                    </div>

                    <div className="divide-y divide-slate-100 bg-white">
                      {evalItem.ratings.map((r) => {
                        const rLower = (r.rating || '').toLowerCase();
                        const badgeColor = rLower.includes('excellent')
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : rLower.includes('very good')
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : rLower.includes('good')
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : rLower.includes('satisfactory')
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : rLower.includes('unsatisfactory')
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200';

                        return (
                          <div key={r.parameterId} className="flex items-center justify-between p-3 text-xs">
                            <span className="text-slate-700 max-w-[70%] font-medium">
                              {r.parameterId}. {r.parameterTitle}
                            </span>
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${badgeColor}`}>
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
                  <h4 className="font-bold text-slate-900 text-sm mb-1.5">General Feedback</h4>
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 italic">
                    &ldquo;{selectedDetail.generalFeedback}&rdquo;
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadResponsePdf(selectedDetail.responseId)}
                  disabled={downloadingPdfId === selectedDetail.responseId}
                  aria-busy={downloadingPdfId === selectedDetail.responseId ? 'true' : undefined}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
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
                    className="inline-flex items-center gap-1 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-300 transition-colors cursor-pointer"
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
                    className="inline-flex items-center gap-1 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-xl text-xs font-bold border border-rose-200 transition-colors cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Exclude from Analytics</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
