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
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-bce-cobalt" />
            Active Platform Sessions
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            CampusFlow allows at most one active Web browser and one active Android session concurrently.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchSessions}
          disabled={loading}
          className="self-start sm:self-auto p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
          title="Refresh active sessions"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {notice && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {loading ? (
        <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-bce-cobalt" />
          <span>Verifying active device sessions...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Active Web Session */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              sessions.webSession
                ? 'bg-slate-50/70 border-slate-200'
                : 'bg-slate-50/30 border-dashed border-slate-200 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-bce-cobalt flex items-center justify-center font-bold">
                  <Laptop className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Active Web Session</p>
                  <p className="text-[11px] text-slate-500">
                    {sessions.webSession
                      ? `${sessions.webSession.browser || 'Browser'} on ${sessions.webSession.os || 'Desktop'}`
                      : 'No active web session'}
                  </p>
                </div>
              </div>
              {sessions.webSession?.isCurrent && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Current Session
                </span>
              )}
            </div>
            {sessions.webSession && (
              <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                <span>Last active:</span>
                <span className="font-semibold text-slate-700">
                  {formatRelativeTime(sessions.webSession.lastSeenAt)}
                </span>
              </div>
            )}
          </div>

          {/* Active Android Session */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              sessions.androidSession
                ? 'bg-slate-50/70 border-slate-200'
                : 'bg-slate-50/30 border-dashed border-slate-200 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Active Android Session</p>
                  <p className="text-[11px] text-slate-500">
                    {sessions.androidSession
                      ? sessions.androidSession.device || 'Android TWA Application'
                      : 'No active Android session'}
                  </p>
                </div>
              </div>
              {sessions.androidSession?.isCurrent ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Current Session
                </span>
              ) : sessions.androidSession ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700">
                  Active
                </span>
              ) : null}
            </div>
            {sessions.androidSession && (
              <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                <span>Last active:</span>
                <span className="font-semibold text-slate-700">
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
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
  );
}
