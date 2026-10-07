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
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-all">
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-slate-100 bg-linear-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-md shrink-0">
            <FolderSync className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Production Data Backup & Drive Sync
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Primary: Supabase Postgres
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Automated, structured Google Drive & Sheets backups for <span className="font-semibold text-white">{collegeName}</span>. Zero data loss guarantee.
            </p>
          </div>
        </div>

        {/* Quick status pill */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {lastStatus === 'SUCCESS' && verificationStatus === 'VERIFIED' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Synced & Verified
            </span>
          )}
          {lastStatus === 'SUCCESS' && verificationStatus !== 'VERIFIED' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Synced (Unverified)
            </span>
          )}
          {lastStatus === 'PARTIAL' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Mismatch
            </span>
          )}
          {lastStatus === 'FAILED' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              <XCircle className="w-3.5 h-3.5 text-rose-400" /> Error
            </span>
          )}
          {lastStatus === 'IN_PROGRESS' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 text-blue-300 animate-spin" /> In Progress
            </span>
          )}
          {lastStatus === 'NEVER_RUN' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-slate-700/60 text-slate-300 border border-slate-600">
              <Clock className="w-3.5 h-3.5" /> Standby
            </span>
          )}
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* Architecture Notice Banner */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-3 text-xs text-slate-600">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold text-slate-900">Database Role:</span> Supabase PostgreSQL is the{' '}
            <strong className="text-slate-900">PRIMARY source of truth</strong> for all operational workflows. Google Drive and Google Sheets are{' '}
            <strong className="text-slate-900">BACKUP & EXPORT copies only</strong>. Application reads never query Google Sheets during normal page renders.
          </div>
        </div>

        {/* Status & Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Google Drive Status */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
              <span className="font-medium text-slate-600">Google Drive Connection</span>
              <Cloud className={`w-4 h-4 ${googleConnected ? 'text-emerald-600' : 'text-slate-400'}`} />
            </div>
            <div className="font-bold text-slate-900 text-base">
              {googleConnected ? (
                <span className="text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  Connected
                </span>
              ) : (
                <span className="text-amber-700 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  Disconnected
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 truncate">
              {googleAccountEmail || 'No Google Workspace account linked'}
            </div>
          </div>

          {/* Last Backup */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
              <span className="font-medium text-slate-600">Last Backup</span>
              <Clock className="w-4 h-4 text-slate-400" />
            </div>
            <div className="font-bold text-slate-900 text-base flex items-center gap-1.5">
              {lastStatus === 'SUCCESS' && <span className="text-emerald-700">Synchronized</span>}
              {lastStatus === 'PARTIAL' && <span className="text-amber-700">Partial Mismatch</span>}
              {lastStatus === 'FAILED' && <span className="text-rose-700">Failed</span>}
              {lastStatus === 'IN_PROGRESS' && <span className="text-blue-700">In Progress</span>}
              {lastStatus === 'NEVER_RUN' && <span className="text-slate-500">Never Run</span>}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Time: <span className="font-medium text-slate-700">{lastBackupDate}</span>
            </div>
          </div>

          {/* Verification & Total */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
              <span className="font-medium text-slate-600">Verification Status</span>
              <ShieldCheck className={`w-4 h-4 ${verificationStatus === 'VERIFIED' ? 'text-emerald-600' : 'text-slate-400'}`} />
            </div>
            <div className="font-bold text-slate-900 text-base flex items-center gap-1.5">
              {verificationStatus === 'VERIFIED' ? (
                <span className="text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  VERIFIED
                </span>
              ) : verificationStatus === 'MISMATCH' ? (
                <span className="text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  MISMATCH
                </span>
              ) : (
                <span className="text-slate-500">UNVERIFIED</span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Records Processed: <span className="font-bold text-slate-800">{state?.total_records_backed_up ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Dynamic Records from Supabase Breakdown */}
        <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              Live Academic & Institutional Records (Supabase)
            </span>
            <span className="text-[11px] font-normal text-slate-500">Strictly Isolated per College</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Colleges</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">1</div>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Faculty</div>
              <div className="text-sm font-bold text-indigo-700 mt-0.5">
                {liveCounts !== null ? liveCounts.faculties : '...'}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Subjects</div>
              <div className="text-sm font-bold text-indigo-700 mt-0.5">
                {liveCounts !== null ? liveCounts.subjects : '...'}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Branches</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {liveCounts !== null ? liveCounts.branches : '...'}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Semesters</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {liveCounts !== null ? liveCounts.semesters : '...'}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Assignments</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {liveCounts !== null ? liveCounts.assignments : '...'}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Feedback & Events</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {liveCounts !== null ? (liveCounts.feedbackForms + liveCounts.events) : '...'}
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Result Message Banner */}
        {resultMessage && (
          <div
            className={`p-4 rounded-xl border text-xs leading-relaxed space-y-3 ${
              resultMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : resultMessage.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-950'
                : 'bg-rose-50 border-rose-200 text-rose-950'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                {resultMessage.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : resultMessage.type === 'warning' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-sm tracking-tight">{resultMessage.title}</div>
                  <p className="mt-0.5 text-xs text-slate-700">{resultMessage.text}</p>
                </div>
              </div>

              {/* Status pill inside banner */}
              <span
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                  resultMessage.type === 'success'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : resultMessage.type === 'warning'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}
              >
                Verification: {activeVerification?.status || activeExecution?.verificationStatus || 'UNKNOWN'}
              </span>
            </div>

            {/* Structured Verification Report Table */}
            {activeVerification?.details && (
              <div className="bg-white/90 rounded-lg p-3 border border-slate-200/80 text-[11px] space-y-2">
                <div className="font-semibold text-slate-800 flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span>Academic Structure Sync & Verification Breakdown</span>
                  <span className="text-[10px] text-slate-500 font-normal">Drive Count / Supabase Count</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  <div className="p-2 rounded bg-slate-50 border border-slate-100">
                    <span className="text-slate-500 block text-[10px]">Faculty</span>
                    <span className="font-bold text-slate-900">
                      {activeVerification.details.faculties?.driveCount ?? 0}/{activeVerification.details.faculties?.supabaseCount ?? 0}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-100">
                    <span className="text-slate-500 block text-[10px]">Subjects</span>
                    <span className="font-bold text-slate-900">
                      {activeVerification.details.subjects?.driveCount ?? 0}/{activeVerification.details.subjects?.supabaseCount ?? 0}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-100">
                    <span className="text-slate-500 block text-[10px]">Branches</span>
                    <span className="font-bold text-slate-900">
                      {activeVerification.details.branches?.driveCount ?? 0}/{activeVerification.details.branches?.supabaseCount ?? 0}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-100">
                    <span className="text-slate-500 block text-[10px]">Semesters</span>
                    <span className="font-bold text-slate-900">
                      {activeVerification.details.semesters?.driveCount ?? 0}/{activeVerification.details.semesters?.supabaseCount ?? 0}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-100">
                    <span className="text-slate-500 block text-[10px]">Years</span>
                    <span className="font-bold text-slate-900">
                      {activeVerification.details.academic_years?.driveCount ?? 0}/{activeVerification.details.academic_years?.supabaseCount ?? 0}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-100">
                    <span className="text-slate-500 block text-[10px]">Assignments</span>
                    <span className="font-bold text-slate-900">
                      {activeVerification.details.faculty_subject_assignments?.driveCount ?? 0}/{activeVerification.details.faculty_subject_assignments?.supabaseCount ?? 0}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-slate-600 border-t border-slate-100">
                  <div>
                    Processed: <span className="font-semibold text-slate-800">{activeExecution?.recordsExported ?? activeVerification.totalDrive}</span>
                  </div>
                  {activeExecution && (
                    <>
                      <div>Created: <span className="font-semibold text-slate-800">{activeExecution.recordsCreated}</span></div>
                      <div>Updated: <span className="font-semibold text-slate-800">{activeExecution.recordsUpdated}</span></div>
                      <div>Skipped: <span className="font-semibold text-slate-800">{activeExecution.recordsSkipped ?? 0}</span></div>
                    </>
                  )}
                  <div>
                    Missing:{' '}
                    <span className={`font-semibold ${activeVerification.totalMissing > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {activeVerification.totalMissing}
                    </span>
                  </div>
                  <div>
                    Duplicates:{' '}
                    <span className={`font-semibold ${activeVerification.totalDuplicates > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
                      {activeVerification.totalDuplicates}
                    </span>
                  </div>
                  <div>
                    Failed:{' '}
                    <span className={`font-semibold ${activeExecution?.recordsFailed ? 'text-rose-600' : 'text-slate-600'}`}>
                      {activeExecution?.recordsFailed ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Drive Cleanup Summary & Logs */}
            {activeExecution?.cleanupReport && (
              <div className="bg-white/80 rounded-lg p-2.5 border border-slate-200/60 text-[11px]">
                <div className="flex items-center justify-between">
                  <div className="text-slate-700">
                    <span className="font-semibold text-slate-900">Drive Structure Cleanup:</span>{' '}
                    {activeExecution.cleanupReport.removedFoldersCount} redundant empty folder(s) safely removed,{' '}
                    {activeExecution.cleanupReport.migratedFilesCount} file(s) safely migrated.
                  </div>
                  {activeExecution.cleanupReport.logs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowCleanupLogs(!showCleanupLogs)}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5 cursor-pointer"
                    >
                      {showCleanupLogs ? 'Hide Details' : 'Show Details'}
                      {showCleanupLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                </div>

                {showCleanupLogs && (
                  <div className="mt-2 p-2 bg-slate-900 text-slate-200 rounded font-mono text-[10px] max-h-36 overflow-y-auto space-y-0.5">
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
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Last Noticed Discrepancy:</span> {state.last_error}
            </div>
          </div>
        )}

        {/* Action Controls & External Links */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            {/* Run Backup Button */}
            <button
              type="button"
              onClick={handleRunBackup}
              disabled={isPending || isVerifying || !googleConnected}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white font-medium text-xs hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
              {isPending ? 'Backing Up to Drive...' : 'Backup Now'}
            </button>

            {/* Verify Backup Button */}
            <button
              type="button"
              onClick={handleVerifyBackup}
              disabled={isPending || isVerifying || isCleaning || !state?.drive_academic_sheet_id}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-medium text-xs hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ShieldCheck className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : 'text-emerald-600'}`} />
              {isVerifying ? 'Verifying Records...' : 'Verify Backup'}
            </button>

            {/* Clean Empty & Redundant Drive Folders Button */}
            <button
              type="button"
              onClick={handleCleanupDrive}
              disabled={isPending || isVerifying || isCleaning || !googleConnected}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-medium text-xs hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="Safely remove redundant empty folders in Google Drive"
            >
              <Trash2 className={`w-3.5 h-3.5 ${isCleaning ? 'animate-spin text-amber-600' : 'text-slate-500'}`} />
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
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-800 bg-amber-400 hover:bg-amber-300 transition-colors shadow-xs"
              >
                <FolderSync className="w-3.5 h-3.5 text-slate-900" />
                Open Google Drive
                <ExternalLink className="w-3 h-3 text-slate-700" />
              </a>
            ) : null}

            {state?.drive_academic_sheet_url && (
              <a
                href={state.drive_academic_sheet_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                Academic Structure Sheet
                <ExternalLink className="w-3 h-3 text-emerald-500" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
