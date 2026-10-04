'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Search,
  Download,
  FileSpreadsheet,
  FolderOpen,
  Eye,
  Loader2,
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileText,
  Users,
  Award,
  Printer,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import type { CollegeEvent, GoogleFormParticipantResponse } from '@/types/events';
import {
  getEventGoogleRegistrationsAction,
  resyncEventGoogleResourcesAction,
} from '@/app/admin/events/actions';

interface Props {
  event: CollegeEvent;
  activeCollegeId?: string;
}

type SortField = 'submittedAt' | 'participantName' | 'rollNumber' | 'registrationNumber';
type SortOrder = 'asc' | 'desc';

export function GoogleEventRegistrationsClient({ event, activeCollegeId }: Props) {
  const [responses, setResponses] = useState<GoogleFormParticipantResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('submittedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Detail Modal
  const [selected, setSelected] = useState<GoogleFormParticipantResponse | null>(null);

  // Re-sync action
  const [resyncing, setResyncing] = useState(false);
  const [resyncMsg, setResyncMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchRegistrations = useCallback(
    async (bypassCache = false) => {
      try {
        if (bypassCache) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const res = await getEventGoogleRegistrationsAction(event.id, bypassCache, activeCollegeId);
        if (res.success && res.data) {
          setResponses(res.data);
          setSyncedAt(res.syncedAt || new Date().toISOString());
          setSource(res.source || 'GOOGLE_SHEETS');
        } else {
          setError(res.error || 'Failed to fetch registration records from Google Sheets.');
        }
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred while communicating with Google Sheets.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [event.id, activeCollegeId]
  );

  useEffect(() => {
    fetchRegistrations(false);
  }, [fetchRegistrations]);

  const handleResyncResources = async () => {
    try {
      setResyncing(true);
      setResyncMsg(null);
      const res = await resyncEventGoogleResourcesAction(event.id, activeCollegeId);
      if (res.success) {
        setResyncMsg({ type: 'success', text: res.message || 'Google registration resources synchronized.' });
        fetchRegistrations(true);
      } else {
        setResyncMsg({ type: 'error', text: res.error || 'Failed to resync Google resources.' });
      }
    } catch (err: any) {
      setResyncMsg({ type: 'error', text: err.message || 'Error resyncing resources.' });
    } finally {
      setResyncing(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 ml-1 inline-block" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-bce-cobalt ml-1 inline-block" />
    ) : (
      <ArrowDown className="w-3 h-3 text-bce-cobalt ml-1 inline-block" />
    );
  };

  // Derive unique branches and categories for filter dropdowns
  const availableBranches = useMemo(
    () => Array.from(new Set(responses.map((r) => r.branch).filter(Boolean))).sort(),
    [responses]
  );

  const availableCategories = useMemo(
    () => Array.from(new Set(responses.map((r) => r.performanceType).filter(Boolean))).sort(),
    [responses]
  );

  // Filtered and Sorted rows
  const sortedFiltered = useMemo(() => {
    const filtered = responses.filter((r) => {
      if (yearFilter !== 'ALL' && r.year !== yearFilter) return false;
      if (branchFilter !== 'ALL' && r.branch !== branchFilter) return false;
      if (categoryFilter !== 'ALL' && r.performanceType !== categoryFilter) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchName = r.participantName?.toLowerCase().includes(q);
        const matchReg = r.registrationNumber?.toLowerCase().includes(q);
        const matchCollegeReg = r.collegeRegistrationNumber?.toLowerCase().includes(q);
        const matchRoll = r.rollNumber?.toLowerCase().includes(q);
        const matchEmail = r.email?.toLowerCase().includes(q);
        const matchMobile = r.contactNumber?.toLowerCase().includes(q);
        const matchNotes = r.notes?.toLowerCase().includes(q);
        if (!matchName && !matchReg && !matchCollegeReg && !matchRoll && !matchEmail && !matchMobile && !matchNotes) {
          return false;
        }
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortField === 'submittedAt') {
        const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }
      const valA = a[sortField] || '';
      const valB = b[sortField] || '';
      const cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [responses, yearFilter, branchFilter, categoryFilter, search, sortField, sortOrder]);

  // CSV Export helper
  const handleExportCsv = () => {
    if (sortedFiltered.length === 0) return;

    const headers = [
      'Timestamp',
      'Pass / Registration Number',
      'College Registration Number',
      'Participant Name',
      'Roll Number',
      'Year',
      'Branch',
      'Contact',
      'Email',
      'Performance Category',
      'Participation Mode',
      'Notes',
    ];

    const rows = sortedFiltered.map((r) => [
      `"${r.submittedAt || ''}"`,
      `"${r.registrationNumber || ''}"`,
      `"${r.collegeRegistrationNumber || ''}"`,
      `"${(r.participantName || '').replace(/"/g, '""')}"`,
      `"${r.rollNumber || ''}"`,
      `"${r.year || ''}"`,
      `"${(r.branch || '').replace(/"/g, '""')}"`,
      `"${r.contactNumber || ''}"`,
      `"${r.email || ''}"`,
      `"${(r.performanceType || '').replace(/"/g, '""')}"`,
      `"${(r.participationType || '').replace(/"/g, '""')}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${event.slug}-google-registrations.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPdfViewUrl = (responseId: string) =>
    `/api/admin/events/${event.id}/registrations/pdf?responseId=${encodeURIComponent(responseId)}&collegeId=${activeCollegeId || ''}`;

  const getPdfDownloadUrl = (responseId: string) =>
    `/api/admin/events/${event.id}/registrations/pdf?responseId=${encodeURIComponent(responseId)}&collegeId=${activeCollegeId || ''}&download=true`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Print-specific style */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-registrations-container,
          #printable-registrations-container * {
            visibility: visible;
          }
          #printable-registrations-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 16px;
            background: white;
            color: black;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Top Header & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <Link
            href="/admin/dashboard?tab=events"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>Back to Events</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {event.title}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
              Small Event • Google Form Mode
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
            <span>Direct Google Form Responses</span>
            <span>&bull;</span>
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Google Sheets is Sole Source of Truth (No Categories/Programs Needed)</span>
            </span>
          </p>
        </div>

        {/* Quick Resource Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {event.google_form_url && (
            <a
              href={event.google_form_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Open Form</span>
            </a>
          )}

          {event.google_spreadsheet_url && (
            <a
              href={event.google_spreadsheet_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Open Response Sheet</span>
            </a>
          )}

          {event.google_drive_folder_url && (
            <a
              href={event.google_drive_folder_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-all"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Drive Folder</span>
            </a>
          )}

          <a
            href={`/api/admin/events/${event.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-700 border border-red-200 shadow-2xs transition-all"
            title="Download Complete Event Registrations PDF"
          >
            <Download className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span>Complete Event PDF</span>
          </a>

          <button
            type="button"
            onClick={() => fetchRegistrations(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-bce-cobalt text-white text-xs font-semibold hover:bg-blue-800 shadow-xs transition-all disabled:opacity-60 cursor-pointer"
            title="Sync latest responses from Google Sheets"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Syncing...' : 'Sync Form Data'}</span>
          </button>
        </div>
      </div>

      {/* Re-sync feedback if triggered */}
      {resyncMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-3 no-print ${
            resyncMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {resyncMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{resyncMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setResyncMsg(null)}
            className="text-[11px] underline font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error state if fetch failed */}
      {error && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Google Registration Read Notice</p>
              <p className="mt-0.5 text-amber-800">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResyncResources}
            disabled={resyncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 text-xs font-bold transition-colors cursor-pointer"
          >
            {resyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>Re-sync Resources</span>
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Registrations
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {loading ? '—' : responses.length}
            </span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700">
              Google Sheet
            </span>
          </div>
          <span className="text-[11px] text-slate-500 block truncate">
            {syncedAt ? `Last checked: ${new Date(syncedAt).toLocaleTimeString('en-IN')}` : 'Live data'}
          </span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Performance Categories
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {availableCategories.length}
            </span>
            <Award className="w-4 h-4 text-purple-600" />
          </div>
          <span className="text-[11px] text-slate-500 block truncate">
            {availableCategories.slice(0, 2).join(', ') || 'Various entries'}
          </span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Academic Branches
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {availableBranches.length}
            </span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <span className="text-[11px] text-slate-500 block truncate">
            {availableBranches.slice(0, 2).join(', ') || 'All active departments'}
          </span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Storage Engine
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>{source === 'GOOGLE_FORMS_API' ? 'Google Forms API' : 'Google Sheets'}</span>
            </span>
            <span className="text-[10px] font-semibold text-slate-400">Zero DB Rows</span>
          </div>
          <span className="text-[11px] text-slate-500 block truncate">
            Verified institutional owner
          </span>
        </div>
      </div>

      {/* Main Table & Filters Card (also printable) */}
      <div id="printable-registrations-container" className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Printable Header - only visible when printing */}
        <div className="hidden print:block p-6 border-b border-slate-300">
          <h2 className="text-xl font-black text-slate-900">{event.title}</h2>
          <p className="text-xs text-slate-600 mt-1">
            Official Participant Registrations &bull; Total Registered: {sortedFiltered.length}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Printed on: {new Date().toLocaleString('en-IN')} &bull; Source: Google Sheets
          </p>
        </div>

        {/* Controls Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, roll, pass no, reg no, mobile..."
                className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt bg-slate-50/50"
              />
            </div>

            {/* Year Filter */}
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20"
            >
              <option value="ALL">All Years</option>
              <option value="1st Year">1st Year</option>
              <option value="2nd Year">2nd Year</option>
              <option value="3rd Year">3rd Year</option>
              <option value="Final Year">Final Year</option>
            </select>

            {/* Branch Filter */}
            {availableBranches.length > 0 && (
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 max-w-[160px] truncate"
              >
                <option value="ALL">All Branches</option>
                {availableBranches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            )}

            {/* Category Filter */}
            {availableCategories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 max-w-[160px] truncate"
              >
                <option value="ALL">All Categories</option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <span>Sort:</span>
              <select
                value={`${sortField}-${sortOrder}`}
                onChange={(e) => {
                  const [f, o] = e.target.value.split('-') as [SortField, SortOrder];
                  setSortField(f);
                  setSortOrder(o);
                }}
                className="px-2.5 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20"
              >
                <option value="submittedAt-desc">Latest Submission</option>
                <option value="submittedAt-asc">Earliest Submission</option>
                <option value="participantName-asc">Name (A-Z)</option>
                <option value="participantName-desc">Name (Z-A)</option>
                <option value="rollNumber-asc">Roll Number (Asc)</option>
                <option value="registrationNumber-asc">Pass No (Asc)</option>
              </select>
            </div>
          </div>

          {/* Action Buttons: Complete Event PDF, Export CSV, Print Roster */}
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/api/admin/events/${event.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-700 border border-red-200 shadow-2xs transition-colors ${
                sortedFiltered.length === 0 ? 'opacity-50 pointer-events-none' : ''
              }`}
              title="Download Complete Event Registrations PDF"
            >
              <Download className="w-3.5 h-3.5 text-red-600" />
              <span>Complete Event PDF</span>
            </a>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={sortedFiltered.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              disabled={sortedFiltered.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
              title="Print Registrations"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Content Table / Empty States */}
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 text-bce-cobalt animate-spin mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-800">Reading Google Sheet...</p>
            <p className="text-xs text-slate-400 mt-1">
              Synchronizing participant responses directly from your connected Google Spreadsheet.
            </p>
          </div>
        ) : sortedFiltered.length === 0 ? (
          <div className="py-16 text-center px-4 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Registrations Found</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {responses.length === 0
                ? 'Small events use direct Google Form registration — no category or program setup needed! When students submit the form, their responses sync here automatically and you can generate official PDF passes & complete registration reports.'
                : 'No responses matched your search and filter criteria.'}
            </p>
            {event.google_form_url && (
              <a
                href={event.google_form_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 mt-4 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition-colors no-print"
              >
                <span>Submit Test Response in Google Form</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <tr>
                  <th
                    className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                    onClick={() => handleSort('registrationNumber')}
                  >
                    <span>Pass / Reg No</span>
                    {renderSortIndicator('registrationNumber')}
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                    onClick={() => handleSort('participantName')}
                  >
                    <span>Participant Name</span>
                    {renderSortIndicator('participantName')}
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                    onClick={() => handleSort('rollNumber')}
                  >
                    <span>Roll &amp; Year</span>
                    {renderSortIndicator('rollNumber')}
                  </th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Category &amp; Mode</th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                    onClick={() => handleSort('submittedAt')}
                  >
                    <span>Submitted</span>
                    {renderSortIndicator('submittedAt')}
                  </th>
                  <th className="py-3 px-4 text-right no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedFiltered.map((r, idx) => (
                  <tr key={r.responseId || idx} className="hover:bg-slate-50/70 transition-colors">
                    {/* Pass No & College Reg No */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono font-bold text-slate-900 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 w-fit text-[11px]">
                          {r.registrationNumber}
                        </span>
                        {r.collegeRegistrationNumber && (
                          <span className="text-[10px] text-slate-400 font-mono" title="College Registration Number">
                            Reg: {r.collegeRegistrationNumber}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Name & Email */}
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block truncate max-w-[180px]">
                        {r.participantName}
                      </span>
                      <span className="text-[11px] text-slate-400 block truncate max-w-[180px]">
                        {r.email}
                      </span>
                    </td>

                    {/* Roll & Year */}
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800 block">{r.rollNumber || '—'}</span>
                      <span className="text-[11px] text-slate-500 block">{r.year}</span>
                    </td>

                    {/* Branch */}
                    <td className="py-3 px-4 font-medium text-slate-800 max-w-[140px] truncate">
                      {r.branch || '—'}
                    </td>

                    {/* Contact */}
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {r.contactNumber || '—'}
                    </td>

                    {/* Category & Mode */}
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200 block w-fit truncate max-w-[140px]">
                        {r.performanceType || 'General Entry'}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Mode: {r.participationType || 'Solo'}
                      </span>
                    </td>

                    {/* Submitted At */}
                    <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                      {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('en-IN') : '—'}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap no-print">
                      <button
                        type="button"
                        onClick={() => setSelected(r)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
                        title="View Submission Details"
                      >
                        <Eye className="w-3 h-3 text-slate-500" />
                        <span>View</span>
                      </button>

                      <a
                        href={getPdfViewUrl(r.responseId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 text-[11px] font-semibold hover:bg-blue-100 shadow-2xs transition-colors"
                        title="Preview Official PDF Pass"
                      >
                        <FileText className="w-3 h-3 text-blue-600" />
                        <span>Pass</span>
                      </a>

                      <a
                        href={getPdfDownloadUrl(r.responseId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-bce-cobalt text-white text-[11px] font-semibold hover:bg-blue-800 shadow-2xs transition-colors"
                        title="Download PDF Pass"
                      >
                        <Download className="w-3 h-3" />
                        <span>PDF</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Participant Submission Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Participant Registration
                </span>
                <h3 className="text-lg font-black text-slate-900">{selected.participantName}</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Confirmed Entry
              </span>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">CampusFlow Pass No</span>
                <span className="font-mono font-bold text-slate-900 block">{selected.registrationNumber}</span>
              </div>

              {selected.collegeRegistrationNumber ? (
                <div className="p-3 bg-slate-50 rounded-xl space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">College Reg No</span>
                  <span className="font-mono font-bold text-slate-900 block">{selected.collegeRegistrationNumber}</span>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-xl space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Roll Number</span>
                  <span className="font-bold text-slate-900 block">{selected.rollNumber || '—'}</span>
                </div>
              )}

              {selected.collegeRegistrationNumber && (
                <div className="p-3 bg-slate-50 rounded-xl space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Roll Number</span>
                  <span className="font-bold text-slate-900 block">{selected.rollNumber || '—'}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-xl space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Year</span>
                <span className="font-semibold text-slate-800 block">{selected.year}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Branch</span>
                <span className="font-semibold text-slate-800 block truncate">{selected.branch || '—'}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Contact Mobile</span>
                <span className="font-mono font-semibold text-slate-900 block">{selected.contactNumber}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Email</span>
                <span className="font-semibold text-slate-900 block truncate">{selected.email}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Performance Category</span>
                <span className="font-bold text-purple-900 block">{selected.performanceType || 'General Entry'}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Participation Mode</span>
                <span className="font-bold text-slate-900 block">{selected.participationType || 'Solo'}</span>
              </div>

              {selected.submittedAt && (
                <div className="p-3 bg-slate-50 rounded-xl space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Submission Time</span>
                  <span className="font-medium text-slate-800 block">
                    {new Date(selected.submittedAt).toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>

            {/* Performance Notes */}
            {selected.notes && (
              <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Performance Title / Notes</span>
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{selected.notes}</p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <a
                  href={getPdfViewUrl(selected.responseId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 text-xs font-bold hover:bg-blue-100 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  <span>Preview Pass</span>
                </a>

                <a
                  href={getPdfDownloadUrl(selected.responseId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-bce-cobalt text-white text-xs font-bold hover:bg-blue-800 shadow-md transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF Pass</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

