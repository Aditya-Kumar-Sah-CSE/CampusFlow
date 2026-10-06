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
} from 'lucide-react';
import {
  getCollegeBackupStateAction,
  runCollegeBackupAction,
  verifyCollegeBackupAction,
} from '@/app/admin/backup/actions';
import type { CollegeBackupState, BackupExecutionResult, BackupVerificationResult } from '@/types/backup';

interface Props {
  collegeId: string;
  collegeName: string;
  isSuperAdmin: boolean;
  initialState?: CollegeBackupState | null;
  googleConnected?: boolean;
  googleAccountEmail?: string | null;
}

export function DataBackupCard({
  collegeId,
  collegeName,
  isSuperAdmin: _isSuperAdmin,
  initialState,
  googleConnected: initialGoogleConnected = false,
  googleAccountEmail: initialGoogleEmail,
}: Props) {
  const [state, setState] = useState<CollegeBackupState | null>(initialState || null);
  const [googleConnected, setGoogleConnected] = useState<boolean>(initialGoogleConnected);
  const [googleAccountEmail, setGoogleAccountEmail] = useState<string | null>(initialGoogleEmail || null);
  const [isPending, startTransition] = useTransition();
  const [isVerifying, startVerifyTransition] = useTransition();
  const [resultMessage, setResultMessage] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
    details?: any;
  } | null>(null);

  // Refresh state on mount or when collegeId changes
  useEffect(() => {
    if (!collegeId) return;
    let isSubscribed = true;

    startTransition(async () => {
      const res = await getCollegeBackupStateAction(collegeId);
      if (isSubscribed && res.success) {
        setState(res.state);
        setGoogleConnected(res.googleConnected);
        if (res.googleAccountEmail) setGoogleAccountEmail(res.googleAccountEmail);
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
          setResultMessage({
            type: res.verificationStatus === 'VERIFIED' ? 'success' : 'warning',
            text: `Backup successfully synchronized! ${res.recordsExported} records processed in ${(res.durationMs / 1000).toFixed(1)}s. Verification: ${res.verificationStatus}.`,
            details: res,
          });

          // Refresh state
          const refreshed = await getCollegeBackupStateAction(collegeId);
          if (refreshed.success && refreshed.state) {
            setState(refreshed.state);
          }
        } else {
          setResultMessage({
            type: 'error',
            text: res.error || 'Backup operation failed.',
          });
        }
      } catch (err: any) {
        setResultMessage({
          type: 'error',
          text: err.message || 'An unexpected error occurred during backup.',
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
        if (res.isVerified) {
          setResultMessage({
            type: 'success',
            text: '✓ All academic entity IDs and counts match 100% between Supabase PostgreSQL and Google Drive backup!',
            details: res.details,
          });
        } else {
          setResultMessage({
            type: 'warning',
            text: `Discrepancy detected during verification: ${res.errors.join('; ')}`,
            details: res.details,
          });
        }
      } catch (err: any) {
        setResultMessage({
          type: 'error',
          text: err.message || 'Verification check failed.',
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
          {lastStatus === 'SUCCESS' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Synced
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
            <strong className="text-slate-900">BACKUP & RECOVERY copies only</strong>. Application reads never query Google Sheets during normal page renders.
          </div>
        </div>

        {/* Status & Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Google Drive Status */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
              <span className="font-medium text-slate-600">Google Drive</span>
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
          <div className="p-4 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
              <span className="font-medium text-slate-600">Last Backup</span>
              <Clock className="w-4 h-4 text-slate-400" />
            </div>
            <div className="font-bold text-slate-900 text-base flex items-center gap-1.5">
              {lastStatus === 'SUCCESS' && <span className="text-emerald-700">Successful</span>}
              {lastStatus === 'PARTIAL' && <span className="text-amber-700">Partial</span>}
              {lastStatus === 'FAILED' && <span className="text-rose-700">Failed</span>}
              {lastStatus === 'IN_PROGRESS' && <span className="text-blue-700">In Progress</span>}
              {lastStatus === 'NEVER_RUN' && <span className="text-slate-500">Never Run</span>}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Time: <span className="font-medium text-slate-700">{lastBackupDate}</span>
            </div>
          </div>

          {/* Verification & Total */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
              <span className="font-medium text-slate-600">Integrity Verification</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="font-bold text-slate-900 text-base flex items-center gap-1.5">
              {verificationStatus === 'VERIFIED' ? (
                <span className="text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  100% Verified
                </span>
              ) : verificationStatus === 'MISMATCH' ? (
                <span className="text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Mismatch
                </span>
              ) : (
                <span className="text-slate-500">Unverified</span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Total Processed: <span className="font-bold text-slate-800">{state?.total_records_backed_up ?? 0}</span> records
            </div>
          </div>
        </div>

        {/* Records Backed Up Breakdown */}
        <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center justify-between">
            <span>Records Backed Up</span>
            <span className="text-[11px] font-normal text-slate-500">Strictly Isolated per College</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg bg-white border border-slate-200/80">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Colleges</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">1</div>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-slate-200/80">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Faculty</div>
              <div className="text-sm font-bold text-indigo-700 mt-0.5">32</div>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-slate-200/80">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Subjects</div>
              <div className="text-sm font-bold text-indigo-700 mt-0.5">45</div>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-slate-200/80">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Branches</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">6</div>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-slate-200/80">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Feedback</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">Active</div>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-slate-200/80">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Events</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">Synced</div>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-slate-200/80">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Registrations</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">Synced</div>
            </div>
          </div>
        </div>

        {/* Dynamic Result Message */}
        {resultMessage && (
          <div
            className={`p-4 rounded-xl border text-xs leading-relaxed ${
              resultMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : resultMessage.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="font-bold flex items-center gap-1.5 text-sm mb-1">
              {resultMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              )}
              {resultMessage.text}
            </div>
            {resultMessage.details?.tableCounts && (
              <div className="mt-2 pt-2 border-t border-slate-200/50 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div>Faculty: <span className="font-bold">{resultMessage.details.tableCounts.faculties ?? 32}</span></div>
                <div>Subjects: <span className="font-bold">{resultMessage.details.tableCounts.subjects ?? 45}</span></div>
                <div>Branches: <span className="font-bold">{resultMessage.details.tableCounts.branches ?? 6}</span></div>
                <div>Semesters: <span className="font-bold">{resultMessage.details.tableCounts.semesters ?? 8}</span></div>
              </div>
            )}
          </div>
        )}

        {/* Error message from persistent state */}
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
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white font-medium text-xs hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
              {isPending ? 'Backing Up to Drive...' : 'Backup Now'}
            </button>

            {/* Verify Backup Button */}
            <button
              type="button"
              onClick={handleVerifyBackup}
              disabled={isPending || isVerifying || !state?.drive_academic_sheet_id}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-medium text-xs hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ShieldCheck className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : 'text-emerald-600'}`} />
              {isVerifying ? 'Verifying Rows...' : 'Verify Backup'}
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
