'use client';

import { useState, useEffect } from 'react';
import {
  Laptop,
  Smartphone,
  ShieldCheck,
  LogOut,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { PinnedRosterBoard } from '@/components/ui/PinnedRosterBoard';

interface SessionData {
  id: string;
  sessionId: string;
  browser?: string;
  os?: string;
  device?: string;
  lastSeenAt: string;
  createdAt: string;
  isCurrent: boolean;
}

interface ActiveSessionsResponse {
  webSession: SessionData | null;
  androidSession: SessionData | null;
}

function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return 'Never';
  const time = new Date(dateString).getTime();
  const diff = Date.now() - time;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Active just now';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

export function AdminSessionsCard() {
  const [sessions, setSessions] = useState<ActiveSessionsResponse>({
    webSession: null,
    androidSession: null,
  });
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/sessions');
      if (res.ok) {
        const data = await res.json();
        if (data.sessions) {
          setSessions(data.sessions);
        }
      }
    } catch (err) {
      console.warn('Failed to load active sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleSignOutOthers = async () => {
    try {
      setRevoking(true);
      setNotice(null);
      const res = await fetch('/api/admin/sessions', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotice({
          type: 'success',
          text: data.message || 'Other sessions signed out successfully.',
        });
        if (data.sessions) {
          setSessions(data.sessions);
        }
      } else {
        setNotice({
          type: 'error',
          text: data.error || 'Failed to sign out other sessions.',
        });
      }
    } catch {
      setNotice({ type: 'error', text: 'Network error signing out other sessions.' });
    } finally {
      setRevoking(false);
    }
  };

  const hasOtherSessions =
    (sessions.webSession && !sessions.webSession.isCurrent) ||
    (sessions.androidSession && !sessions.androidSession.isCurrent);

  return (
    <PinnedRosterBoard
      id="admin-sessions-card"
      title="Active Platform Sessions"
      subtitle="System allows at most one active Web browser and one active Android session concurrently."
      badge="SECURITY SCOPED"
      icon={<ShieldCheck className="w-4 h-4 text-amber-700 dark:text-amber-400" />}
      action={
        <button
          type="button"
          onClick={fetchSessions}
          disabled={loading}
          className="p-1.5 rounded-[3px] border border-amber-300/80 dark:border-[#4d3817] bg-white dark:bg-[#1a1309] text-slate-700 dark:text-[#faebd0] hover:bg-amber-50 dark:hover:bg-[#251a0e] transition-colors cursor-pointer"
          title="Refresh active sessions"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      }
    >
      <div className="p-4 sm:p-5 space-y-4">
        {notice && (
          <div
            className={`p-3 rounded-[3px] border text-xs flex items-center gap-2 ${
              notice.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            }`}
          >
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span>{notice.text}</span>
          </div>
        )}

        {loading ? (
          <div className="py-6 text-center text-xs text-slate-400 dark:text-[#a08862] flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-amber-600 dark:text-amber-400" />
            <span>Verifying active device sessions...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Active Web Session */}
            <div
              className={`p-4 rounded-[3px] border transition-all ${
                sessions.webSession
                  ? 'bg-white dark:bg-[#1a1309] border-amber-200/80 dark:border-[#382710]'
                  : 'bg-amber-50/20 dark:bg-[#140e07]/40 border-dashed border-amber-200/50 dark:border-[#2a1d0f] opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-[2px] bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/30 flex items-center justify-center font-bold">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-[#faebd0]">Active Web Session</p>
                    <p className="text-[11px] text-slate-500 dark:text-[#a08862]">
                      {sessions.webSession
                        ? `${sessions.webSession.browser || 'Browser'} on ${sessions.webSession.os || 'Desktop'}`
                        : 'No active web session'}
                    </p>
                  </div>
                </div>
                {sessions.webSession?.isCurrent && (
                  <span className="px-2 py-0.5 rounded-[2px] text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 uppercase">
                    Current Session
                  </span>
                )}
              </div>
              {sessions.webSession && (
                <div className="mt-3 pt-2.5 border-t border-amber-200/60 dark:border-[#2a1d0f] flex items-center justify-between text-[11px] text-slate-500 dark:text-[#a08862]">
                  <span>Last active:</span>
                  <span className="font-bold text-slate-800 dark:text-[#faebd0]">
                    {formatRelativeTime(sessions.webSession.lastSeenAt)}
                  </span>
                </div>
              )}
            </div>

            {/* Active Android Session */}
            <div
              className={`p-4 rounded-[3px] border transition-all ${
                sessions.androidSession
                  ? 'bg-white dark:bg-[#1a1309] border-amber-200/80 dark:border-[#382710]'
                  : 'bg-amber-50/20 dark:bg-[#140e07]/40 border-dashed border-amber-200/50 dark:border-[#2a1d0f] opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-[2px] bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/30 flex items-center justify-center font-bold">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-[#faebd0]">Active Android Session</p>
                    <p className="text-[11px] text-slate-500 dark:text-[#a08862]">
                      {sessions.androidSession
                        ? sessions.androidSession.device || 'Android TWA Application'
                        : 'No active Android session'}
                    </p>
                  </div>
                </div>
                {sessions.androidSession?.isCurrent ? (
                  <span className="px-2 py-0.5 rounded-[2px] text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 uppercase">
                    Current Session
                  </span>
                ) : sessions.androidSession ? (
                  <span className="px-2 py-0.5 rounded-[2px] text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700/60 uppercase">
                    Active
                  </span>
                ) : null}
              </div>
              {sessions.androidSession && (
                <div className="mt-3 pt-2.5 border-t border-amber-200/60 dark:border-[#2a1d0f] flex items-center justify-between text-[11px] text-slate-500 dark:text-[#a08862]">
                  <span>Last active:</span>
                  <span className="font-bold text-slate-800 dark:text-[#faebd0]">
                    {formatRelativeTime(sessions.androidSession.lastSeenAt)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sign out other sessions action */}
        {hasOtherSessions && (
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleSignOutOthers}
              disabled={revoking}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[3px] border border-rose-300 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-800 dark:text-rose-300 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              {revoking ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <LogOut className="w-3.5 h-3.5" />
              )}
              <span>Sign out other sessions</span>
            </button>
          </div>
        )}
      </div>
    </PinnedRosterBoard>
  );
}
