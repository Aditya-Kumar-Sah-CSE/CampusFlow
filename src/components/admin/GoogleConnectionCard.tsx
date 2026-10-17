'use client';

import { useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { disconnectCollegeGoogleAction } from '@/lib/google/actions';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  LogOut,
  ExternalLink,
  Loader2,
  Mail,
  Calendar,
  ShieldCheck,
  Globe,
} from 'lucide-react';
import { PinnedRosterBoard } from '@/components/ui/PinnedRosterBoard';

export interface GoogleConnectionCardProps {
  collegeId: string;
  collegeName: string;
  status: {
    connected: boolean;
    accountEmail?: string | null;
    accountName?: string | null;
    connectedAt?: string | null;
    status?: string;
    scopes?: string[];
  };
}

export function GoogleConnectionCard({
  collegeId,
  collegeName,
  status,
}: GoogleConnectionCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const isConnected = status.connected && status.status === 'CONNECTED';
  const isInvalid = status.status === 'INVALID' || status.status === 'EXPIRED';

  const handleConnect = () => {
    setActionError(null);
    const returnTo = encodeURIComponent(pathname || '/admin/dashboard');
    window.location.href = `/api/auth/google?collegeId=${encodeURIComponent(collegeId)}&returnTo=${returnTo}`;
  };

  const handleDisconnect = () => {
    if (
      !confirm(
        `Are you sure you want to disconnect Google Workspace for ${collegeName}?\n\nExisting forms and spreadsheets will remain in Drive, but automated form generation and response sync will be paused until reconnected.`
      )
    ) {
      return;
    }

    setActionError(null);
    startTransition(async () => {
      const res = await disconnectCollegeGoogleAction(collegeId);
      if (res.success) {
        router.refresh();
      } else {
        setActionError(res.error || 'Failed to disconnect Google connection.');
      }
    });
  };

  return (
    <PinnedRosterBoard
      id="google-connection-card"
      title="Google Workspace Connection"
      subtitle={
        <span>
          Institutional Google account authorization for{' '}
          <strong className="text-slate-900 dark:text-amber-300 font-bold">{collegeName}</strong>.
        </span>
      }
      badge={
        isConnected ? (
          <span className="inline-flex items-center gap-1 rounded-[2px] bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 uppercase">
            <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> Connected
          </span>
        ) : isInvalid ? (
          <span className="inline-flex items-center gap-1 rounded-[2px] bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 uppercase">
            <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" /> Reconnect Required
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-[2px] bg-slate-100 dark:bg-[#251a0e] px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-[#a08862] border border-slate-300 dark:border-[#4d3817] uppercase">
            <XCircle className="h-3 w-3" /> Not Connected
          </span>
        )
      }
      icon={<Globe className="w-4 h-4 text-amber-700 dark:text-amber-400" />}
      action={
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <button
                type="button"
                onClick={handleConnect}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-[3px] border border-amber-300/80 dark:border-[#4d3817] bg-white dark:bg-[#251a0e] px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-[#faebd0] hover:bg-amber-50 dark:hover:bg-[#382710] transition-colors disabled:opacity-50 cursor-pointer"
                title="Re-authorize Google Workspace credentials"
              >
                <RefreshCw className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                Reconnect
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-[3px] border border-rose-300 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 text-xs font-bold text-rose-800 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors disabled:opacity-50 cursor-pointer"
                title="Disconnect Google account for this college"
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LogOut className="h-3.5 w-3.5" />
                )}
                Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-[3px] border border-amber-600 bg-amber-500 hover:bg-amber-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ExternalLink className="h-3.5 w-3.5" />
              )}
              Connect Google Workspace
            </button>
          )}
        </div>
      }
    >
      <div className="p-4 sm:p-5 space-y-4">
        {actionError && (
          <div className="rounded-[3px] bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 p-2.5 text-xs text-rose-900 dark:text-rose-200 flex items-center gap-2">
            <XCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{actionError}</span>
          </div>
        )}

        <div className="text-xs">
          {isConnected ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-[3px] bg-white dark:bg-[#1a1309] border border-amber-200/80 dark:border-[#382710] p-3 shadow-xs">
                <span className="text-slate-500 dark:text-[#a08862] flex items-center gap-1.5 mb-1 text-[11px] font-bold uppercase tracking-wider">
                  <Mail className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  Connected Account
                </span>
                <p className="font-bold text-slate-900 dark:text-[#faebd0] truncate text-xs">
                  {status.accountEmail || 'Account Email Unavailable'}
                </p>
                {status.accountName && (
                  <p className="text-[11px] text-slate-500 dark:text-[#a08862] truncate mt-0.5">{status.accountName}</p>
                )}
              </div>

              <div className="rounded-[3px] bg-white dark:bg-[#1a1309] border border-amber-200/80 dark:border-[#382710] p-3 shadow-xs">
                <span className="text-slate-500 dark:text-[#a08862] flex items-center gap-1.5 mb-1 text-[11px] font-bold uppercase tracking-wider">
                  <Calendar className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  Connected Date
                </span>
                <p className="font-bold text-slate-900 dark:text-[#faebd0] text-xs">
                  {status.connectedAt
                    ? new Date(status.connectedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'N/A'}
                </p>
                <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">Authorized for {collegeName}</p>
              </div>

              <div className="rounded-[3px] bg-white dark:bg-[#1a1309] border border-amber-200/80 dark:border-[#382710] p-3 shadow-xs">
                <span className="text-slate-500 dark:text-[#a08862] flex items-center gap-1.5 mb-1 text-[11px] font-bold uppercase tracking-wider">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  Tenant Isolation
                </span>
                <p className="font-bold text-emerald-700 dark:text-emerald-400 text-xs">College-Owned Credential</p>
                <p className="text-[11px] text-slate-500 dark:text-[#a08862] mt-0.5">Forms &amp; Sheets belong to {collegeName}</p>
              </div>
            </div>
          ) : isInvalid ? (
            <div className="rounded-[3px] bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 p-3.5 text-amber-950 dark:text-[#faebd0]">
              <p className="font-bold text-xs mb-1 text-amber-900 dark:text-amber-300">
                Google account connection for {collegeName} needs reconnection.
              </p>
              <p className="text-[11px] text-amber-800 dark:text-[#c4a97d]">
                The Google OAuth grant has expired or was revoked. Click &quot;Connect Google Workspace&quot; above to re-authorize this college.
              </p>
            </div>
          ) : (
            <div className="rounded-[3px] bg-amber-50/50 dark:bg-[#1a1309] border border-amber-200/80 dark:border-[#382710] p-3.5 text-slate-700 dark:text-[#faebd0]">
              <p className="font-bold text-xs mb-1 text-slate-900 dark:text-[#faebd0]">
                Google account not connected for {collegeName}.
              </p>
              <p className="text-[11px] text-slate-600 dark:text-[#c4a97d]">
                Connect an institutional Google Workspace account to generate Google Forms, stream responses into institutional Google Spreadsheets, and manage response synchronization for this college.
              </p>
            </div>
          )}

          {/* OAuth Test User Guidance Banner for Super Admin */}
          <div className="mt-4 rounded-[3px] border border-amber-300/80 dark:border-[#4d3817] bg-amber-50/70 dark:bg-[#1f150c] p-4 text-amber-950 dark:text-[#faebd0]">
            <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-300 text-xs">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Google OAuth Test User Guidance (Testing Mode)</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-700 dark:text-[#faebd0] leading-relaxed">
              The Google OAuth app is currently in <strong>TESTING</strong> mode. Google only permits authorizations from accounts explicitly registered in your Google Cloud Console test users list.
            </p>
            <div className="mt-2.5 p-2.5 rounded-[2px] bg-white dark:bg-[#140e07] border border-amber-200/80 dark:border-[#382710] text-xs font-mono text-amber-900 dark:text-amber-300 font-bold">
              Google Cloud Console &rarr; Google Auth Platform &rarr; Audience &rarr; Test users
            </div>
            <p className="mt-2 text-[11px] text-slate-500 dark:text-[#a08862]">
              Before clicking <strong className="text-slate-900 dark:text-white">Connect Google Workspace</strong>, ensure the intended institutional Google account for {collegeName} is manually added to the Test Users list above.
            </p>
          </div>
        </div>
      </div>
    </PinnedRosterBoard>
  );
}
