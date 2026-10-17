'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useAppRouter as useRouter } from '@/lib/hooks/use-app-router';
import {
  FeedbackForm,
  FeedbackFormStatus,
  AuditLog,
} from '@/types/database';
import {
  updateFormStatusAction,
  syncFormResponsesAction,
  deleteFeedbackFormAction,
} from '@/app/admin/forms/actions';
import { BCE_FEEDBACK_PARAMETERS } from '@/lib/google/template';
import { useHydrated, formatDateShort, formatTime, formatDateTimeFull } from '@/lib/hooks/use-hydrated';
import { ExternalActionLink } from '@/components/ui/ExternalActionLink';
import {
  ArrowLeft,
  FileSpreadsheet,
  FileCode2,
  ExternalLink,
  CheckCircle2,
  Clock,
  Ban,
  Archive,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  Calendar,
  GraduationCap,
  Activity,
  BarChart3,
  Trash2,
  Lock,
  Loader2,
} from 'lucide-react';
import { GoogleFormEditPermissionModal } from './GoogleFormEditPermissionModal';
import { ExamPadCard } from '@/components/ui/ExamPadCard';
import { PinnedRosterBoard } from '@/components/ui/PinnedRosterBoard';

interface Props {
  form: FeedbackForm;
  auditLogs: AuditLog[];
  currentUserEmail: string;
  hasAnalyticsAccess?: boolean;
  isSuperAdmin?: boolean;
}

export function FormDetailConsole({
  form: initialForm,
  auditLogs,
  currentUserEmail,
  hasAnalyticsAccess = false,
  isSuperAdmin = false,
}: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [form, setForm] = useState<FeedbackForm>(initialForm);
  const [showEditPermModal, setShowEditPermModal] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<
    'PUBLISH' | 'CLOSE' | 'REOPEN' | 'ARCHIVE' | 'RESTORE' | 'DELETE' | 'SYNC' | null
  >(null);
  const [isNavigatingResults, setIsNavigatingResults] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isNative = form.response_destination_type === 'NATIVE_SHEET';
  const targetGoogleFormEditUrl = form.google_form_edit_url || (form.google_form_id ? `https://docs.google.com/forms/d/${form.google_form_id}/edit` : null);

  const handleCopyLink = () => {
    if (form.google_form_url) {
      navigator.clipboard.writeText(form.google_form_url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const handleStatusChange = (
    newStatus: FeedbackFormStatus,
    actionKey?: 'PUBLISH' | 'CLOSE' | 'REOPEN' | 'ARCHIVE' | 'RESTORE'
  ) => {
    setMessage(null);
    setPendingAction(actionKey || (newStatus === 'PUBLISHED' ? 'PUBLISH' : newStatus === 'CLOSED' ? 'CLOSE' : 'ARCHIVE'));
    setForm((prev) => ({ ...prev, status: newStatus }));
    startTransition(async () => {
      try {
        const res = await updateFormStatusAction(form.id, newStatus);
        if (res.success) {
          setMessage({ type: 'success', text: res.message || `Form status changed to ${newStatus}.` });
        } else {
          setForm(initialForm); // rollback
          setMessage({ type: 'error', text: res.error || 'Failed to update status.' });
        }
      } finally {
        setPendingAction(null);
      }
    });
  };

  const handleSyncResponses = () => {
    setMessage(null);
    setPendingAction('SYNC');
    startTransition(async () => {
      try {
        const res = await syncFormResponsesAction(form.id);
        if (res.success) {
          if (res.totalResponses !== undefined) {
            setForm((prev) => ({ ...prev, response_count: res.totalResponses ?? prev.response_count }));
          }
          setMessage({
            type: 'success',
            text: res.message || `Synced ${res.syncedCount} response(s). Total: ${res.totalResponses}.`,
          });
        } else {
          setMessage({ type: 'error', text: res.error || 'Failed to sync responses.' });
        }
      } finally {
        setPendingAction(null);
      }
    });
  };

  const handleDeleteForm = () => {
    const isConfirmed = window.confirm(
      `Are you sure you want to delete this feedback form?\n\n"${form.title}"\n\nThis will permanently remove the form from the BCE portal. (Google Drive files remain intact).`
    );
    if (!isConfirmed) return;

    setMessage(null);
    setPendingAction('DELETE');
    startTransition(async () => {
      try {
        const res = await deleteFeedbackFormAction(form.id);
        if (res.success) {
          router.push('/admin/dashboard/forms');
        } else {
          setMessage({ type: 'error', text: res.error || 'Failed to delete feedback form.' });
        }
      } finally {
        setPendingAction(null);
      }
    });
  };

  const statusBadge = (status: FeedbackFormStatus) => {
    switch (status) {
      case 'PUBLISHED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
            <CheckCircle2 className="w-4 h-4" /> PUBLISHED (Accepting Feedback)
          </span>
        );
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-xs">
            <Clock className="w-4 h-4" /> DRAFT (Not Published)
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 shadow-xs">
            <Ban className="w-4 h-4" /> CLOSED (Feedback Concluded)
          </span>
        );
      case 'ARCHIVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700 border border-slate-300 shadow-xs">
            <Archive className="w-4 h-4" /> ARCHIVED (Historical Record)
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Header on Official Exam Pad */}
      <ExamPadCard
        variant="dashboard"
        clipLabel="FORM CONSOLE"
        title={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/dashboard/forms"
              className="p-1 rounded-[3px] text-slate-400 dark:text-[#8c7453] hover:text-slate-700 dark:hover:text-[#faebd0] hover:bg-slate-100 dark:hover:bg-[#25180c] transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-base sm:text-lg md:text-xl font-bold text-slate-900 dark:text-[#faebd0] break-words">
              {form.title}
            </h1>
          </div>
        }
        subtitle={
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-[#c4a97d] sm:ml-8 mt-1">
            <span>Form ID: <code className="font-mono text-[11px] text-slate-700 dark:text-[#ebd5b3]" title={form.id}>{form.id.length > 12 ? `${form.id.slice(0, 8)}…` : form.id}</code></span>
            <span>•</span>
            <span>Created {formatDateShort(form.created_at, hydrated)}</span>
            {currentUserEmail && (
              <>
                <span>•</span>
                <span className="truncate max-w-[200px]">Console: <strong className="text-slate-700 dark:text-[#ebd5b3] font-mono text-[11px]">{currentUserEmail}</strong></span>
              </>
            )}
          </div>
        }
        badge={statusBadge(form.status)}
      >
        <div className="space-y-3.5 pt-1">
          {/* Message Banner */}
          {message && (
            <div
              className={`p-3 rounded-[3px] border text-xs flex items-center gap-2 ${
                message.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{message.text}</span>
            </div>
          )}

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/80 dark:border-[#382710]">
            {/* External Google Links */}
            <div className="flex flex-wrap items-center gap-2">
              {form.google_form_url && (
                <>
                  <ExternalActionLink
                    href={form.google_form_url}
                    openingText="Opening Student Form..."
                    className="px-3 py-1.5 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-700/60 rounded-[3px] text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                    icon={<FileCode2 className="w-4 h-4 text-purple-700 dark:text-purple-400" />}
                  >
                    <span>Open Student Form</span>
                    <ExternalLink className="w-3 h-3" />
                  </ExternalActionLink>

                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-[#140e07] hover:bg-slate-200 dark:hover:bg-[#25180c] text-slate-700 dark:text-[#faebd0] border border-slate-200 dark:border-[#382710] rounded-[3px] text-xs font-medium transition-colors cursor-pointer"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? 'Copied' : 'Copy Form URL'}</span>
                  </button>
                </>
              )}

              {targetGoogleFormEditUrl && (
                <button
                  type="button"
                  onClick={() => setShowEditPermModal(true)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-[#140e07] hover:bg-slate-200 dark:hover:bg-[#25180c] text-slate-700 dark:text-[#faebd0] border border-slate-200 dark:border-[#382710] rounded-[3px] text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>Edit in Google Forms</span>
                  <ExternalLink className="w-3 h-3 text-slate-400 dark:text-[#8c7453]" />
                </button>
              )}

              {form.google_sheet_url || form.google_sheet_id ? (
                <ExternalActionLink
                  href={
                    form.google_sheet_url ||
                    `https://docs.google.com/spreadsheets/d/${form.google_sheet_id}/edit`
                  }
                  openingText="Opening Response Sheet..."
                  className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/60 rounded-[3px] text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                  icon={<FileSpreadsheet className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />}
                >
                  <span>Open Response Sheet</span>
                  <ExternalLink className="w-3 h-3" />
                </ExternalActionLink>
              ) : null}

              {hasAnalyticsAccess ? (
                <Link
                  href={`/admin/dashboard/results/${form.id}`}
                  onClick={() => setIsNavigatingResults(true)}
                  aria-busy={isNavigatingResults ? 'true' : undefined}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bce-navy hover:bg-slate-800 text-amber-300 border border-slate-700 rounded-[3px] text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                >
                  {isNavigatingResults ? (
                    <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                  ) : (
                    <BarChart3 className="w-4 h-4 text-amber-400" />
                  )}
                  <span>{isNavigatingResults ? 'Opening Hub...' : 'Results & Analytics'}</span>
                </Link>
              ) : (
                <Link
                  href={`/admin/dashboard/results/${form.id}`}
                  title="Full Analytics Access Required - Click to upgrade your plan"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/95 hover:bg-slate-800 text-slate-300 hover:text-white border border-amber-500/40 rounded-[3px] text-xs font-bold transition-all shadow-2xs group cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                  <BarChart3 className="w-4 h-4 text-slate-400" />
                  <span>Results & Analytics</span>
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded-[2px] ml-0.5 uppercase tracking-wider">
                    Locked
                  </span>
                </Link>
              )}
            </div>

            {/* Lifecycle State Changer */}
            <div className="flex items-center gap-2">
              {form.status === 'DRAFT' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('PUBLISHED', 'PUBLISH')}
                  disabled={isPending}
                  aria-busy={pendingAction === 'PUBLISH' ? 'true' : undefined}
                  className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[3px] text-xs font-bold transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  {pendingAction === 'PUBLISH' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>{pendingAction === 'PUBLISH' ? 'Publishing Form...' : 'Publish Form'}</span>
                </button>
              )}

              {form.status === 'PUBLISHED' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('CLOSED', 'CLOSE')}
                  disabled={isPending}
                  aria-busy={pendingAction === 'CLOSE' ? 'true' : undefined}
                  className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-[3px] text-xs font-bold transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  {pendingAction === 'CLOSE' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Ban className="w-4 h-4" />
                  )}
                  <span>{pendingAction === 'CLOSE' ? 'Closing Submissions...' : 'Close Submissions'}</span>
                </button>
              )}

              {form.status === 'CLOSED' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleStatusChange('PUBLISHED', 'REOPEN')}
                    disabled={isPending}
                    aria-busy={pendingAction === 'REOPEN' ? 'true' : undefined}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[3px] text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {pendingAction === 'REOPEN' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>{pendingAction === 'REOPEN' ? 'Reopening...' : 'Reopen Form'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusChange('ARCHIVED', 'ARCHIVE')}
                    disabled={isPending}
                    aria-busy={pendingAction === 'ARCHIVE' ? 'true' : undefined}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-[3px] text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {pendingAction === 'ARCHIVE' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Archive className="w-4 h-4" />
                    )}
                    <span>{pendingAction === 'ARCHIVE' ? 'Archiving...' : 'Archive Form'}</span>
                  </button>
                </>
              )}

              {form.status === 'ARCHIVED' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('DRAFT', 'RESTORE')}
                  disabled={isPending}
                  aria-busy={pendingAction === 'RESTORE' ? 'true' : undefined}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-[3px] text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {pendingAction === 'RESTORE' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  <span>{pendingAction === 'RESTORE' ? 'Restoring...' : 'Restore to Draft'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDeleteForm}
                disabled={isPending}
                aria-busy={pendingAction === 'DELETE' ? 'true' : undefined}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-600 rounded-[3px] text-xs font-bold transition-all disabled:opacity-50 shadow-xs cursor-pointer"
                title="Delete this feedback form permanently"
              >
                {pendingAction === 'DELETE' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>{pendingAction === 'DELETE' ? 'Deleting...' : 'Delete Form'}</span>
              </button>
            </div>
          </div>
        </div>
      </ExamPadCard>

      {/* Grid: Response Synchronization + Academic Metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left 2 Cols: Response Synchronization & Evaluation Parameters */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Response Destination & Sync Pinned Board */}
          <PinnedRosterBoard
            title="Google Form Response Destination & Sync"
            subtitle="Real responses collected in the Google Form and synced to the connected Google Sheet."
            icon={<RefreshCw className={`w-4 h-4 text-amber-600 dark:text-amber-400 ${isPending ? 'animate-spin' : ''}`} />}
            badge={isNative ? '⚡ NATIVE DESTINATION' : '🔄 APPLICATION-MANAGED SYNC'}
          >
            <div className="p-3.5 sm:p-5 space-y-3.5 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 text-center">
                <div className="p-3 sm:p-4 bg-slate-50 dark:bg-[#140e07] rounded-[3px] border border-slate-200 dark:border-[#382710]">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#c4a97d] block">
                    Responses Recorded
                  </span>
                  <span className="text-2xl font-bold text-slate-900 dark:text-[#faebd0] mt-1 block">
                    {form.response_count || 0}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-[#8c7453]">In Google Sheet</span>
                </div>

                <div className="p-3 sm:p-4 bg-slate-50 dark:bg-[#140e07] rounded-[3px] border border-slate-200 dark:border-[#382710]">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#c4a97d] block">
                    Last Synced
                  </span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-[#faebd0] mt-2 block">
                    {form.last_synced_at
                      ? formatTime(form.last_synced_at, hydrated) + ' (' + formatDateShort(form.last_synced_at, hydrated) + ')'
                      : 'Never synced'}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-[#8c7453]">Forms → Sheet</span>
                </div>

                <div className="p-3 sm:p-4 bg-slate-50 dark:bg-[#140e07] rounded-[3px] border border-slate-200 dark:border-[#382710] flex flex-col justify-center items-center">
                  <button
                    type="button"
                    onClick={handleSyncResponses}
                    disabled={isPending || !form.google_form_id || !form.google_sheet_id}
                    aria-busy={pendingAction === 'SYNC' ? 'true' : undefined}
                    className="w-full inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 bg-bce-cobalt hover:bg-bce-navy text-white text-xs font-bold rounded-[3px] transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${pendingAction === 'SYNC' ? 'animate-spin' : ''}`} />
                    <span>{pendingAction === 'SYNC' ? 'Syncing Responses...' : 'Sync Responses Now'}</span>
                  </button>
                  <span className="text-[10px] text-slate-400 dark:text-[#8c7453] mt-1">Appends new responses</span>
                </div>
              </div>

              <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/40 rounded-[3px] text-xs text-blue-900 dark:text-blue-200 space-y-1">
                <p className="font-semibold">
                  {isNative
                    ? 'Native Response Flow Active:'
                    : 'Application Response Synchronization Flow:'}
                </p>
                <p className="text-[11px] text-blue-800/90 dark:text-blue-300/90 leading-relaxed">
                  {isNative
                    ? 'When students submit the Google Form, responses automatically stream directly into the connected Google Sheet via native Google Forms destination.'
                    : 'Click "Sync Responses Now" to fetch submitted responses from the official Google Forms API and append them into the formatted Google Sheet. Duplicate submissions are automatically detected and skipped.'}
                </p>
              </div>

              {!isNative && form.google_form_edit_url && (
                <div className="p-3 bg-amber-50/80 dark:bg-[#25180c] border border-amber-200 dark:border-[#4d3817] rounded-[3px] text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5 text-amber-950 dark:text-amber-100">
                      💡 Enable Instant Real-Time Auto-Sync in Google Forms
                    </span>
                    <a
                      href={form.google_form_edit_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-[3px] text-[11px] font-bold transition-colors shadow-xs"
                    >
                      <span>Open Form in Google</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                    To stream student submissions automatically into Google Sheets without clicking &quot;Sync Responses&quot;: open the Google Form above &rarr; go to the <strong>Responses</strong> tab &rarr; click <strong>Link to Sheets</strong> &rarr; choose <strong>Select existing spreadsheet</strong> and select this form&apos;s sheet.
                  </p>
                </div>
              )}
            </div>
          </PinnedRosterBoard>

          {/* Form Structure & Questionnaire Pinned Board */}
          <PinnedRosterBoard
            title="Form Structure & Questionnaire"
            subtitle="Student identification, 8-parameter rating scale, and optional suggestion box."
            icon={<FileCode2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
            badge="11 FIELDS ACTIVE"
          >
            <div className="p-3.5 sm:p-5 space-y-3.5 sm:space-y-4">
              {/* Identification Fields */}
              <div className="p-3 sm:p-3.5 bg-blue-50/50 dark:bg-blue-950/30 rounded-[3px] border border-blue-100 dark:border-blue-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-950 dark:text-blue-200">Student Identification</span>
                  <span className="px-1.5 py-0.5 rounded-[2px] text-[9px] bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-semibold">Required *</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-white dark:bg-[#140e07] rounded-[3px] border border-blue-100/80 dark:border-blue-900/30">
                    <span className="font-bold text-slate-800 dark:text-[#faebd0]">Student Name</span>
                    <p className="text-[10px] text-slate-500 dark:text-[#c4a97d] mt-0.5">Short text (Official college records)</p>
                  </div>
                  <div className="p-2 bg-white dark:bg-[#140e07] rounded-[3px] border border-blue-100/80 dark:border-blue-900/30">
                    <span className="font-bold text-slate-800 dark:text-[#faebd0]">University Registration Number</span>
                    <p className="text-[10px] text-slate-500 dark:text-[#c4a97d] mt-0.5">Short text (University / Roll number)</p>
                  </div>
                </div>
              </div>

              {/* 8 Rating Parameters */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-[#faebd0]">8 Faculty Evaluation Parameters</span>
                  <span className="text-[10px] text-slate-500 dark:text-[#c4a97d] font-medium">5-Point Rating Scale (Required)</span>
                </div>
                {BCE_FEEDBACK_PARAMETERS.map(param => (
                  <div
                    key={param.id}
                    className="p-2.5 sm:p-3.5 bg-slate-50 dark:bg-[#140e07] rounded-[3px] border border-slate-200/80 dark:border-[#382710] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-800 dark:text-[#faebd0]">
                        {param.id}. {param.title}
                      </div>
                      {param.description && (
                        <div className="text-[11px] text-slate-500 dark:text-[#c4a97d] mt-0.5">{param.description}</div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      {param.options.map(opt => (
                        <span
                          key={opt}
                          className="px-2 py-0.5 rounded-[2px] text-[10px] font-medium bg-white dark:bg-[#1f150c] border border-slate-200 dark:border-[#382710] text-slate-700 dark:text-[#c4a97d]"
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Optional Suggestions */}
              <div className="p-2.5 sm:p-3.5 bg-slate-50 dark:bg-[#140e07] rounded-[3px] border border-slate-200/80 dark:border-[#382710] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-800 dark:text-[#faebd0]">Comments / Suggestions</span>
                    <span className="px-1.5 py-0.5 rounded-[2px] text-[9px] bg-slate-200 dark:bg-[#25180c] text-slate-600 dark:text-[#c4a97d] font-medium">Optional</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-[#c4a97d] mt-0.5">
                    Long-form paragraph for student suggestions, observations, and constructive remarks.
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-[2px] text-[10px] font-medium bg-white dark:bg-[#1f150c] border border-slate-200 dark:border-[#382710] text-slate-600 dark:text-[#c4a97d] shrink-0">
                  Paragraph Text
                </span>
              </div>
            </div>
          </PinnedRosterBoard>
        </div>

        {/* Right Col: Academic Metadata & Audit Trail */}
        <div className="space-y-4 sm:space-y-6">
          {/* Academic Details Pinned Board */}
          <PinnedRosterBoard
            title="Academic Assignment Details"
            icon={<GraduationCap className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
          >
            <div className="p-3.5 sm:p-5 space-y-2 text-xs text-slate-700 dark:text-[#ebd5b3]">
              {form.form_type === 'SEMESTER_FEEDBACK' ? (
                <>
                  <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-[#382710]">
                    <span className="text-slate-500 dark:text-[#c4a97d]">Scope:</span>
                    <span className="font-bold text-purple-900 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-[2px] border border-purple-200 dark:border-purple-800">Multi-Faculty Semester</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-[#382710]">
                    <span className="text-slate-500 dark:text-[#c4a97d]">Branch:</span>
                    <span className="font-semibold text-slate-900 dark:text-[#faebd0]">{form.branch?.name || '—'} ({form.branch?.code})</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-[#382710]">
                    <span className="text-slate-500 dark:text-[#c4a97d]">Semester:</span>
                    <span className="font-semibold text-slate-900 dark:text-[#faebd0]">{form.semester?.name || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-[#382710]">
                    <span className="text-slate-500 dark:text-[#c4a97d]">Academic Session:</span>
                    <span className="font-semibold text-slate-900 dark:text-[#faebd0]">{form.academic_year?.name || '—'}</span>
                  </div>
                  <div className="py-1.5">
                    <span className="text-slate-500 dark:text-[#c4a97d] block mb-1">Evaluated Courses ({form.items?.length || 0}):</span>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {(form.items || []).map((it, idx) => (
                        <div key={idx} className="p-1.5 bg-slate-50 dark:bg-[#140e07] rounded-[2px] border border-slate-200 dark:border-[#382710] text-[11px] flex justify-between">
                          <span className="font-medium text-slate-800 dark:text-[#faebd0]">{it.grid_title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-[#382710]">
                    <span className="text-slate-500 dark:text-[#c4a97d]">Faculty:</span>
                    <span className="font-bold text-slate-900 dark:text-[#faebd0]">{form.faculty?.name || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-[#382710]">
                    <span className="text-slate-500 dark:text-[#c4a97d]">Designation:</span>
                    <span className="text-slate-800 dark:text-[#faebd0]">{form.faculty?.designation || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-[#382710]">
                    <span className="text-slate-500 dark:text-[#c4a97d]">Department:</span>
                    <span className="text-slate-800 dark:text-[#faebd0]">{form.faculty?.department || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-[#382710]">
                    <span className="text-slate-500 dark:text-[#c4a97d]">Subject:</span>
                    <span className="font-semibold text-slate-900 dark:text-[#faebd0]">{form.subject?.name || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-[#382710]">
                    <span className="text-slate-500 dark:text-[#c4a97d]">Subject Code:</span>
                    <span className="font-mono text-slate-800 dark:text-[#faebd0]">{form.subject?.code || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-[#382710]">
                    <span className="text-slate-500 dark:text-[#c4a97d]">Branch:</span>
                    <span className="text-slate-800 dark:text-[#faebd0]">{form.branch?.name || '—'} ({form.branch?.code})</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-[#382710]">
                    <span className="text-slate-500 dark:text-[#c4a97d]">Semester:</span>
                    <span className="text-slate-800 dark:text-[#faebd0]">{form.semester?.name || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-[#382710]">
                    <span className="text-slate-500 dark:text-[#c4a97d]">Academic Session:</span>
                    <span className="font-semibold text-slate-900 dark:text-[#faebd0]">{form.academic_year?.name || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500 dark:text-[#c4a97d]">Form Type:</span>
                    <span className="font-mono text-[11px] font-semibold text-slate-800 dark:text-[#faebd0]">{form.form_type}</span>
                  </div>
                </>
              )}
            </div>
          </PinnedRosterBoard>

          {/* Form Timestamps Pinned Board */}
          <PinnedRosterBoard
            title="Lifecycle Timestamps"
            icon={<Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
          >
            <div className="p-3.5 sm:p-5 space-y-2 text-xs text-slate-700 dark:text-[#ebd5b3]">
              <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-[#382710]">
                <span className="text-slate-500 dark:text-[#c4a97d]">Created:</span>
                <span className="font-medium text-slate-900 dark:text-[#faebd0]">{formatDateTimeFull(form.created_at, hydrated)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-[#382710]">
                <span className="text-slate-500 dark:text-[#c4a97d]">Published:</span>
                <span className="font-medium text-slate-900 dark:text-[#faebd0]">{form.published_at ? formatDateTimeFull(form.published_at, hydrated) : 'Not published'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-[#382710]">
                <span className="text-slate-500 dark:text-[#c4a97d]">Closed:</span>
                <span className="font-medium text-slate-900 dark:text-[#faebd0]">{form.closed_at ? formatDateTimeFull(form.closed_at, hydrated) : 'Not closed'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500 dark:text-[#c4a97d]">Archived:</span>
                <span className="font-medium text-slate-900 dark:text-[#faebd0]">{form.archived_at ? formatDateTimeFull(form.archived_at, hydrated) : 'Not archived'}</span>
              </div>
            </div>
          </PinnedRosterBoard>

          {/* Form Audit Trail Pinned Board */}
          <PinnedRosterBoard
            title={`Form Audit Trail (${auditLogs.length})`}
            icon={<Activity className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
          >
            <div className="p-3.5 sm:p-5">
              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-[#8c7453] py-3 text-center">No audit logs recorded for this form.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {auditLogs.map(log => (
                    <div key={log.id} className="p-2.5 bg-slate-50 dark:bg-[#140e07] rounded-[3px] border border-slate-200/80 dark:border-[#382710] text-[11px] space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-[#faebd0] font-mono text-[10px]">{log.action}</span>
                        <span className="text-[9px] text-slate-500 dark:text-[#c4a97d]">
                          {formatTime(log.created_at, hydrated)}
                        </span>
                      </div>
                      {log.details && <p className="text-slate-600 dark:text-[#c4a97d]">{log.details}</p>}
                      <span className="text-[9px] text-slate-400 dark:text-[#8c7453] font-mono block">By: {log.actor_email || 'System'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </PinnedRosterBoard>
        </div>
      </div>

      {targetGoogleFormEditUrl && (
        <GoogleFormEditPermissionModal
          isOpen={showEditPermModal}
          onClose={() => setShowEditPermModal(false)}
          collegeId={form.college_id || ''}
          formTitle={form.title}
          currentUserEmail={currentUserEmail}
          googleFormEditUrl={targetGoogleFormEditUrl}
          isSuperAdmin={isSuperAdmin}
        />
      )}
    </div>
  );
}
