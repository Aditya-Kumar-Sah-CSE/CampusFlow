'use client';

import { useState, useTransition, useEffect } from 'react';
import {
  Cloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  FileSpreadsheet,
  FolderSync,
  Info,
  Layers,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import {
  getCollegeBackupStateAction,
  runCollegeBackupAction,
  verifyCollegeBackupAction,
  cleanupCollegeDriveFoldersAction,
  type LiveCollegeEntityCounts,
} from '@/app/admin/backup/actions';
import type {
  CollegeBackupState,
  BackupExecutionResult,
  BackupVerificationResult,
} from '@/types/backup';

import { PinnedRosterBoard } from '@/components/ui/PinnedRosterBoard';

interface Props {
  collegeId: string;
  collegeName: string;
  isSuperAdmin: boolean;
  initialState?: CollegeBackupState | null;
  googleConnected?: boolean;
  googleAccountEmail?: string | null;
  initialLiveCounts?: LiveCollegeEntityCounts | null;
}

export function DataBackupCard({
  collegeId,
  collegeName,
  isSuperAdmin: _isSuperAdmin,
  initialState,
  googleConnected: initialGoogleConnected = false,
  googleAccountEmail: initialGoogleEmail,
  initialLiveCounts,
}: Props) {
  const [state, setState] = useState<CollegeBackupState | null>(initialState || null);
  const [googleConnected, setGoogleConnected] = useState<boolean>(initialGoogleConnected);
  const [googleAccountEmail, setGoogleAccountEmail] = useState<string | null>(initialGoogleEmail || null);
  const [liveCounts, setLiveCounts] = useState<LiveCollegeEntityCounts | null>(initialLiveCounts || null);
  const [isPending, startTransition] = useTransition();
  const [isVerifying, startVerifyTransition] = useTransition();
  const [isCleaning, startCleanTransition] = useTransition();
  const [showCleanupLogs, setShowCleanupLogs] = useState(false);
  const [resultMessage, setResultMessage] = useState<{
    type: 'success' | 'warning' | 'error';
    title: string;
    text: string;
    executionResult?: BackupExecutionResult;
    verificationResult?: BackupVerificationResult;
  } | null>(null);

  // Refresh state and live entity counts on mount or when collegeId changes
  useEffect(() => {
    if (!collegeId) return;
    let isSubscribed = true;

    startTransition(async () => {
      const res = await getCollegeBackupStateAction(collegeId);
      if (isSubscribed && res.success) {
        setState(res.state);
        setGoogleConnected(res.googleConnected);
        if (res.googleAccountEmail) setGoogleAccountEmail(res.googleAccountEmail);
        if (res.liveCounts) setLiveCounts(res.liveCounts);
      }
    });

    return () => {
      isSubscribed = false;
    };
  }, [collegeId]);

  const handleRunBackup = () => {
    if (!collegeId) return;
    setResultMessage(null);

    startTransition(async () => {
      try {
        const res: BackupExecutionResult = await runCollegeBackupAction(collegeId);
        if (res.success) {
          const isVerified = res.verificationStatus === 'VERIFIED';

          // STRICT REQUIREMENT: The UI must NEVER say "Backup Successful" unless verification actually passes.
          const title = isVerified
            ? 'Backup Synchronized & 100% Verified'
            : 'Backup Synchronized with Verification Mismatch';

          setResultMessage({
            type: isVerified ? 'success' : 'warning',
            title,
            text: isVerified
              ? `All records processed in ${(res.durationMs / 1000).toFixed(1)}s. Academic entities verified 100% between Supabase PostgreSQL and Google Drive backup.`
              : `Records were exported to Google Drive in ${(res.durationMs / 1000).toFixed(1)}s, but verification detected discrepancies: ${res.error || 'Counts or IDs differ'}.`,
            executionResult: res,
            verificationResult: res.verification,
          });

          // Refresh state & live counts
          const refreshed = await getCollegeBackupStateAction(collegeId);
          if (refreshed.success) {
            if (refreshed.state) setState(refreshed.state);
            if (refreshed.liveCounts) setLiveCounts(refreshed.liveCounts);
          }
        } else {
          setResultMessage({
            type: 'error',
            title: 'Backup Failed',
            text: res.error || 'Backup operation encountered an error and could not complete.',
            executionResult: res,
          });
        }
      } catch (err: any) {
        setResultMessage({
          type: 'error',
          title: 'Unexpected Error',
          text: err.message || 'An unexpected error occurred during backup execution.',
        });
      }
    });
  };

  const handleVerifyBackup = () => {
    if (!collegeId) return;
    setResultMessage(null);

    startVerifyTransition(async () => {
      try {
        const res: BackupVerificationResult = await verifyCollegeBackupAction(collegeId);
        if (res.isVerified && res.status === 'VERIFIED') {
          setResultMessage({
            type: 'success',
            title: 'Backup Integrity 100% Verified',
            text: 'All academic entity IDs and record counts match 100% between Supabase PostgreSQL and the Google Drive spreadsheet.',
            verificationResult: res,
          });
        } else {
          setResultMessage({
            type: 'warning',
            title: 'Integrity Verification Discrepancy',
            text: `Discrepancy detected: ${res.errors.join('; ') || 'Differences detected between Supabase and Google Sheets.'}`,
            verificationResult: res,
          });
        }
      } catch (err: any) {
        setResultMessage({
          type: 'error',
          title: 'Verification Failed',
          text: err.message || 'Verification check failed to execute.',
        });
      }
    });
  };

  const handleCleanupDrive = () => {
    if (!collegeId) return;
    setResultMessage(null);

    startCleanTransition(async () => {
      try {
        const res = await cleanupCollegeDriveFoldersAction(collegeId);
        if (res.success && res.report) {
          setResultMessage({
            type: 'success',
            title: 'Drive Structure Cleaned Successfully',
            text: `Drive cleanup complete: ${res.report.removedFoldersCount} redundant empty folder(s) safely removed, ${res.report.migratedFilesCount} file(s) safely migrated.`,
            executionResult: { cleanupReport: res.report } as any,
          });
        } else {
          setResultMessage({
            type: 'error',
            title: 'Cleanup Notice',
            text: res.error || 'Drive cleanup could not be completed.',
          });
        }
      } catch (err: any) {
        setResultMessage({
          type: 'error',
          title: 'Cleanup Error',
          text: err.message || 'An error occurred during Drive cleanup.',
        });
      }
    });
  };

  const lastBackupDate = state?.last_backup_at
    ? new Date(state.last_backup_at).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Never Run';

  const lastStatus = state?.last_backup_status || 'NEVER_RUN';
  const verificationStatus = state?.last_verification_status || 'UNVERIFIED';

  const activeVerification = resultMessage?.verificationResult;
  const activeExecution = resultMessage?.executionResult;

  return (
    <PinnedRosterBoard
      id="data-backup-card"
      title="Production Data Backup & Drive Sync"
      subtitle={
        <span>
          Automated, structured Google Drive &amp; Sheets backups for{' '}
          <strong className="text-slate-900 dark:text-amber-300 font-bold">{collegeName}</strong>. Zero data loss guarantee.
        </span>
      }
      badge="PRIMARY: SUPABASE POSTGRES"
      icon={<FolderSync className="w-4 h-4 text-amber-700 dark:text-amber-400" />}
      action={
        <div className="flex items-center gap-2">
          {lastStatus === 'SUCCESS' && verificationStatus === 'VERIFIED' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Synced &amp; Verified
            </span>
          )}
          {lastStatus === 'SUCCESS' && verificationStatus !== 'VERIFIED' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Synced (Unverified)
            </span>
          )}
          {lastStatus === 'PARTIAL' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Mismatch
            </span>
          )}
          {lastStatus === 'FAILED' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] text-xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700/60">
              <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> Error
            </span>
          )}
          {lastStatus === 'IN_PROGRESS' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] text-xs font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700/60 animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-spin" /> In Progress
            </span>
          )}
          {lastStatus === 'NEVER_RUN' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] text-xs font-bold bg-slate-100 dark:bg-[#251a0e] text-slate-700 dark:text-[#a08862] border border-slate-300 dark:border-[#4d3817]">
              <Clock className="w-3.5 h-3.5" /> Standby
            </span>
          )}
        </div>
      }
    >
      <div className="p-4 sm:p-5 space-y-5">
        {/* Architecture Notice Banner */}
        <div className="p-3.5 rounded-[3px] bg-amber-50/80 dark:bg-[#1f150c] border border-amber-300/80 dark:border-[#4d3817] flex items-start gap-3 text-xs text-amber-950 dark:text-[#faebd0]">
          <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold text-amber-950 dark:text-amber-300">Database Role:</span> Supabase PostgreSQL is the{' '}
            <strong className="text-amber-950 dark:text-white font-bold">PRIMARY source of truth</strong> for all operational workflows. Google Drive and Google Sheets are{' '}
            <strong className="text-amber-950 dark:text-white font-bold">BACKUP &amp; EXPORT copies only</strong>. Application reads never query Google Sheets during normal page renders.
          </div>
        </div>

        {/* Status & Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Google Drive Status */}
          <div className="p-4 rounded-[3px] border border-amber-200/80 dark:border-[#382710] bg-white dark:bg-[#1a1309] shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-[#a08862] text-xs mb-1.5">
              <span className="font-bold uppercase tracking-wider text-[11px] text-slate-600 dark:text-[#c4a97d]">Google Drive Connection</span>
              <Cloud className={`w-4 h-4 ${googleConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`} />
            </div>
            <div className="font-bold text-slate-900 dark:text-[#faebd0] text-base">
              {googleConnected ? (
                <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  Connected
                </span>
              ) : (
                <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  Disconnected
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-[#a08862] mt-1 truncate">
              {googleAccountEmail || 'No Google Workspace account linked'}
            </div>
          </div>

          {/* Last Backup */}
          <div className="p-4 rounded-[3px] border border-amber-200/80 dark:border-[#382710] bg-white dark:bg-[#1a1309] shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-[#a08862] text-xs mb-1.5">
              <span className="font-bold uppercase tracking-wider text-[11px] text-slate-600 dark:text-[#c4a97d]">Last Backup</span>
              <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            </div>
            <div className="font-bold text-slate-900 dark:text-[#faebd0] text-base flex items-center gap-1.5">
              {lastStatus === 'SUCCESS' && <span className="text-emerald-700 dark:text-emerald-400">Synchronized</span>}
              {lastStatus === 'PARTIAL' && <span className="text-amber-700 dark:text-amber-400">Partial Mismatch</span>}
              {lastStatus === 'FAILED' && <span className="text-rose-700 dark:text-rose-400">Failed</span>}
              {lastStatus === 'IN_PROGRESS' && <span className="text-blue-700 dark:text-blue-400">In Progress</span>}
              {lastStatus === 'NEVER_RUN' && <span className="text-slate-500 dark:text-[#a08862]">Never Run</span>}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-[#a08862] mt-1">
              Time: <span className="font-medium text-slate-700 dark:text-[#faebd0]">{lastBackupDate}</span>
            </div>
          </div>

          {/* Verification & Total */}
          <div className="p-4 rounded-[3px] border border-amber-200/80 dark:border-[#382710] bg-white dark:bg-[#1a1309] shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-[#a08862] text-xs mb-1.5">
              <span className="font-bold uppercase tracking-wider text-[11px] text-slate-600 dark:text-[#c4a97d]">Verification Status</span>
              <ShieldCheck className={`w-4 h-4 ${verificationStatus === 'VERIFIED' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`} />
            </div>
            <div className="font-bold text-slate-900 dark:text-[#faebd0] text-base flex items-center gap-1.5">
              {verificationStatus === 'VERIFIED' ? (
                <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  VERIFIED
                </span>
              ) : verificationStatus === 'MISMATCH' ? (
                <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  MISMATCH
                </span>
              ) : (
                <span className="text-slate-500 dark:text-[#a08862]">UNVERIFIED</span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-[#a08862] mt-1">
              Records Processed: <span className="font-bold text-slate-800 dark:text-amber-400">{state?.total_records_backed_up ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Dynamic Records from Supabase Breakdown */}
        <div className="rounded-[3px] border border-amber-300/80 dark:border-[#382710] bg-amber-50/50 dark:bg-[#181109] p-4">
          <div className="text-xs font-bold text-slate-800 dark:text-[#faebd0] uppercase tracking-wider mb-2.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              Live Academic &amp; Institutional Records (Supabase)
            </span>
            <span className="text-[11px] font-normal text-slate-500 dark:text-[#a08862]">Strictly Isolated per College</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
            <div className="p-2.5 rounded-[3px] bg-white dark:bg-[#1a1309] border border-amber-200/80 dark:border-[#382710] shadow-2xs">
              <div className="text-[10px] font-bold text-slate-500 dark:text-[#a08862] uppercase tracking-wide">Colleges</div>
              <div className="text-sm font-bold text-slate-900 dark:text-amber-400 mt-0.5">1</div>
            </div>
            <div className="p-2.5 rounded-[3px] bg-white dark:bg-[#1a1309] border border-amber-200/80 dark:border-[#382710] shadow-2xs">
              <div className="text-[10px] font-bold text-slate-500 dark:text-[#a08862] uppercase tracking-wide">Faculty</div>
              <div className="text-sm font-bold text-indigo-700 dark:text-amber-300 mt-0.5">
                {liveCounts !== null ? liveCounts.faculties : '...'}
              </div>
            </div>
            <div className="p-2.5 rounded-[3px] bg-white dark:bg-[#1a1309] border border-amber-200/80 dark:border-[#382710] shadow-2xs">
              <div className="text-[10px] font-bold text-slate-500 dark:text-[#a08862] uppercase tracking-wide">Subjects</div>
              <div className="text-sm font-bold text-indigo-700 dark:text-amber-300 mt-0.5">
                {liveCounts !== null ? liveCounts.subjects : '...'}
              </div>
            </div>
            <div className="p-2.5 rounded-[3px] bg-white dark:bg-[#1a1309] border border-amber-200/80 dark:border-[#382710] shadow-2xs">
              <div className="text-[10px] font-bold text-slate-500 dark:text-[#a08862] uppercase tracking-wide">Branches</div>
              <div className="text-sm font-bold text-slate-900 dark:text-[#faebd0] mt-0.5">
                {liveCounts !== null ? liveCounts.branches : '...'}
              </div>
            </div>
            <div className="p-2.5 rounded-[3px] bg-white dark:bg-[#1a1309] border border-amber-200/80 dark:border-[#382710] shadow-2xs">
              <div className="text-[10px] font-bold text-slate-500 dark:text-[#a08862] uppercase tracking-wide">Semesters</div>
              <div className="text-sm font-bold text-slate-900 dark:text-[#faebd0] mt-0.5">
                {liveCounts !== null ? liveCounts.semesters : '...'}
              </div>
            </div>
            <div className="p-2.5 rounded-[3px] bg-white dark:bg-[#1a1309] border border-amber-200/80 dark:border-[#382710] shadow-2xs">
              <div className="text-[10px] font-bold text-slate-500 dark:text-[#a08862] uppercase tracking-wide">Assignments</div>
              <div className="text-sm font-bold text-slate-900 dark:text-[#faebd0] mt-0.5">
                {liveCounts !== null ? liveCounts.assignments : '...'}
              </div>
            </div>
            <div className="p-2.5 rounded-[3px] bg-white dark:bg-[#1a1309] border border-amber-200/80 dark:border-[#382710] shadow-2xs">
              <div className="text-[10px] font-bold text-slate-500 dark:text-[#a08862] uppercase tracking-wide">Feedback &amp; Events</div>
              <div className="text-sm font-bold text-slate-900 dark:text-[#faebd0] mt-0.5">
                {liveCounts !== null ? (liveCounts.feedbackForms + liveCounts.events) : '...'}
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Result Message Banner */}
        {resultMessage && (
          <div
            className={`p-4 rounded-[3px] border text-xs leading-relaxed space-y-3 ${
              resultMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
                : resultMessage.type === 'warning'
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-200'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                {resultMessage.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : resultMessage.type === 'warning' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-sm tracking-tight">{resultMessage.title}</div>
                  <p className="mt-0.5 text-xs text-slate-700 dark:text-[#faebd0]">{resultMessage.text}</p>
                </div>
              </div>

              {/* Status pill inside banner */}
              <span
                className={`px-2.5 py-1 rounded-[2px] text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                  resultMessage.type === 'success'
                    ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                    : resultMessage.type === 'warning'
                    ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                    : 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700'
                }`}
              >
                Verification: {activeVerification?.status || activeExecution?.verificationStatus || 'UNKNOWN'}
              </span>
            </div>

            {/* Structured Verification Report Table */}
            {activeVerification?.details && (
              <div className="bg-white/90 dark:bg-[#1a1309] rounded-[3px] p-3 border border-amber-200/80 dark:border-[#382710] text-[11px] space-y-2">
                <div className="font-bold text-slate-800 dark:text-[#faebd0] flex items-center justify-between border-b border-amber-200/60 dark:border-[#2a1d0f] pb-1.5">
                  <span>Academic Structure Sync &amp; Verification Breakdown</span>
                  <span className="text-[10px] text-slate-500 dark:text-[#a08862] font-normal">Drive Count / Supabase Count</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  <div className="p-2 rounded-[2px] bg-amber-50/50 dark:bg-[#140e07] border border-amber-200/60 dark:border-[#2a1d0f]">
                    <span className="text-slate-500 dark:text-[#a08862] block text-[10px]">Faculty</span>
                    <span className="font-bold text-slate-900 dark:text-[#faebd0]">
                      {activeVerification.details.faculties?.driveCount ?? 0}/{activeVerification.details.faculties?.supabaseCount ?? 0}
                    </span>
                  </div>
                  <div className="p-2 rounded-[2px] bg-amber-50/50 dark:bg-[#140e07] border border-amber-200/60 dark:border-[#2a1d0f]">
                    <span className="text-slate-500 dark:text-[#a08862] block text-[10px]">Subjects</span>
                    <span className="font-bold text-slate-900 dark:text-[#faebd0]">
                      {activeVerification.details.subjects?.driveCount ?? 0}/{activeVerification.details.subjects?.supabaseCount ?? 0}
                    </span>
                  </div>
                  <div className="p-2 rounded-[2px] bg-amber-50/50 dark:bg-[#140e07] border border-amber-200/60 dark:border-[#2a1d0f]">
                    <span className="text-slate-500 dark:text-[#a08862] block text-[10px]">Branches</span>
                    <span className="font-bold text-slate-900 dark:text-[#faebd0]">
                      {activeVerification.details.branches?.driveCount ?? 0}/{activeVerification.details.branches?.supabaseCount ?? 0}
                    </span>
                  </div>
                  <div className="p-2 rounded-[2px] bg-amber-50/50 dark:bg-[#140e07] border border-amber-200/60 dark:border-[#2a1d0f]">
                    <span className="text-slate-500 dark:text-[#a08862] block text-[10px]">Semesters</span>
                    <span className="font-bold text-slate-900 dark:text-[#faebd0]">
                      {activeVerification.details.semesters?.driveCount ?? 0}/{activeVerification.details.semesters?.supabaseCount ?? 0}
                    </span>
                  </div>
                  <div className="p-2 rounded-[2px] bg-amber-50/50 dark:bg-[#140e07] border border-amber-200/60 dark:border-[#2a1d0f]">
                    <span className="text-slate-500 dark:text-[#a08862] block text-[10px]">Years</span>
                    <span className="font-bold text-slate-900 dark:text-[#faebd0]">
                      {activeVerification.details.academic_years?.driveCount ?? 0}/{activeVerification.details.academic_years?.supabaseCount ?? 0}
                    </span>
                  </div>
                  <div className="p-2 rounded-[2px] bg-amber-50/50 dark:bg-[#140e07] border border-amber-200/60 dark:border-[#2a1d0f]">
                    <span className="text-slate-500 dark:text-[#a08862] block text-[10px]">Assignments</span>
                    <span className="font-bold text-slate-900 dark:text-[#faebd0]">
                      {activeVerification.details.faculty_subject_assignments?.driveCount ?? 0}/{activeVerification.details.faculty_subject_assignments?.supabaseCount ?? 0}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-slate-600 dark:text-[#c4a97d] border-t border-amber-200/60 dark:border-[#2a1d0f]">
                  <div>
                    Processed: <span className="font-bold text-slate-800 dark:text-[#faebd0]">{activeExecution?.recordsExported ?? activeVerification.totalDrive}</span>
                  </div>
                  {activeExecution && (
                    <>
                      <div>Created: <span className="font-bold text-slate-800 dark:text-[#faebd0]">{activeExecution.recordsCreated}</span></div>
                      <div>Updated: <span className="font-bold text-slate-800 dark:text-[#faebd0]">{activeExecution.recordsUpdated}</span></div>
                      <div>Skipped: <span className="font-bold text-slate-800 dark:text-[#faebd0]">{activeExecution.recordsSkipped ?? 0}</span></div>
                    </>
                  )}
                  <div>
                    Missing:{' '}
                    <span className={`font-bold ${activeVerification.totalMissing > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                      {activeVerification.totalMissing}
                    </span>
                  </div>
                  <div>
                    Duplicates:{' '}
                    <span className={`font-bold ${activeVerification.totalDuplicates > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                      {activeVerification.totalDuplicates}
                    </span>
                  </div>
                  <div>
                    Failed:{' '}
                    <span className={`font-bold ${activeExecution?.recordsFailed ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-[#a08862]'}`}>
                      {activeExecution?.recordsFailed ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Drive Cleanup Summary & Logs */}
            {activeExecution?.cleanupReport && (
              <div className="bg-white/90 dark:bg-[#1a1309] rounded-[3px] p-2.5 border border-amber-200/80 dark:border-[#382710] text-[11px]">
                <div className="flex items-center justify-between">
                  <div className="text-slate-700 dark:text-[#faebd0]">
                    <span className="font-bold text-slate-900 dark:text-amber-300">Drive Structure Cleanup:</span>{' '}
                    {activeExecution.cleanupReport.removedFoldersCount} redundant empty folder(s) safely removed,{' '}
                    {activeExecution.cleanupReport.migratedFilesCount} file(s) safely migrated.
                  </div>
                  {activeExecution.cleanupReport.logs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowCleanupLogs(!showCleanupLogs)}
                      className="text-[10px] text-amber-700 dark:text-amber-400 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      {showCleanupLogs ? 'Hide Details' : 'Show Details'}
                      {showCleanupLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                </div>

                {showCleanupLogs && (
                  <div className="mt-2 p-2 bg-slate-950 text-slate-200 rounded-[2px] font-mono text-[10px] max-h-36 overflow-y-auto space-y-0.5 border border-slate-800">
                    {activeExecution.cleanupReport.logs.map((log, idx) => (
                      <div key={idx} className="leading-tight">{log}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error message from persistent state if no recent run message */}
        {state?.last_error && !resultMessage && (
          <div className="p-3.5 rounded-[3px] bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Last Noticed Discrepancy:</span> {state.last_error}
            </div>
          </div>
        )}

        {/* Action Controls & External Links */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-amber-200/80 dark:border-[#382710]">
          <div className="flex flex-wrap items-center gap-2">
            {/* Run Backup Button */}
            <button
              type="button"
              onClick={handleRunBackup}
              disabled={isPending || isVerifying || !googleConnected}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[3px] bg-bce-navy text-amber-300 hover:bg-slate-900 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400 font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
              {isPending ? 'Backing Up to Drive...' : 'Backup Now'}
            </button>

            {/* Verify Backup Button */}
            <button
              type="button"
              onClick={handleVerifyBackup}
              disabled={isPending || isVerifying || isCleaning || !state?.drive_academic_sheet_id}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-[3px] bg-amber-100/80 dark:bg-[#251a0e] text-slate-800 dark:text-[#faebd0] border border-amber-300/80 dark:border-[#4d3817] font-bold text-xs hover:bg-amber-200 dark:hover:bg-[#382710] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ShieldCheck className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : 'text-emerald-600 dark:text-emerald-400'}`} />
              {isVerifying ? 'Verifying Records...' : 'Verify Backup'}
            </button>

            {/* Clean Empty & Redundant Drive Folders Button */}
            <button
              type="button"
              onClick={handleCleanupDrive}
              disabled={isPending || isVerifying || isCleaning || !googleConnected}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-[3px] bg-amber-100/80 dark:bg-[#251a0e] text-slate-800 dark:text-[#faebd0] border border-amber-300/80 dark:border-[#4d3817] font-bold text-xs hover:bg-amber-200 dark:hover:bg-[#382710] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="Safely remove redundant empty folders in Google Drive"
            >
              <Trash2 className={`w-3.5 h-3.5 ${isCleaning ? 'animate-spin text-amber-600' : 'text-slate-500 dark:text-[#a08862]'}`} />
              {isCleaning ? 'Cleaning Folders...' : 'Clean Empty Folders'}
            </button>
          </div>

          {/* Open Google Drive and Academic Structure Links */}
          <div className="flex flex-wrap items-center gap-2">
            {state?.drive_institution_folder_id ? (
              <a
                href={`https://drive.google.com/drive/folders/${state.drive_institution_folder_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-[3px] text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors shadow-xs"
              >
                <FolderSync className="w-3.5 h-3.5 text-slate-950" />
                Open Google Drive
                <ExternalLink className="w-3 h-3 text-slate-900" />
              </a>
            ) : null}

            {state?.drive_academic_sheet_url && (
              <a
                href={state.drive_academic_sheet_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-[3px] text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700/60 transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Academic Structure Sheet
                <ExternalLink className="w-3 h-3 text-emerald-500" />
              </a>
            )}
          </div>
        </div>
      </div>
    </PinnedRosterBoard>
  );
}
