'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  FileEdit,
  ShieldCheck,
  Clock,
  Sparkles,
  UserCheck,
  UserX,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FolderSync,
  Mail,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  getGoogleFormEditorsOverviewAction,
  approveGoogleFormEditorRequestAction,
  rejectGoogleFormEditorRequestAction,
  directGrantGoogleFormEditorAction,
  revokeGoogleFormEditorAction,
} from '@/app/admin/forms/editor-actions';
import { PinnedRosterBoard } from '@/components/ui/PinnedRosterBoard';
import type { GoogleFormEditorRequest, CollegeGoogleFormEditor } from '@/types/database';

interface Props {
  activeCollegeId?: string;
  activeCollegeName?: string;
  isSuperAdmin: boolean;
}

export function GoogleFormEditorsManagementSection({
  activeCollegeId,
  activeCollegeName,
  isSuperAdmin,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [approvedEditors, setApprovedEditors] = useState<CollegeGoogleFormEditor[]>([]);
  const [pendingRequests, setPendingRequests] = useState<GoogleFormEditorRequest[]>([]);
  const [connectedAccountEmail, setConnectedAccountEmail] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  const loadData = async () => {
    if (!activeCollegeId) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await getGoogleFormEditorsOverviewAction(activeCollegeId);
      if (res.success) {
        setApprovedEditors(res.approvedEditors || []);
        setPendingRequests(res.pendingRequests || []);
        setConnectedAccountEmail(res.connectedAccountEmail || null);
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to load editor permissions.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error loading editors.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeCollegeId]);

  const handleApprove = (reqId: string, email: string) => {
    setActiveActionId(reqId);
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await approveGoogleFormEditorRequestAction(reqId);
        if (res.success) {
          setMessage({ type: 'success', text: res.message });
          await loadData();
        } else {
          setMessage({ type: 'error', text: res.message || 'Approval failed.' });
        }
      } catch (err: any) {
        setMessage({ type: 'error', text: err?.message || 'Error approving request.' });
      } finally {
        setActiveActionId(null);
      }
    });
  };

  const handleReject = (reqId: string) => {
    setActiveActionId(reqId);
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await rejectGoogleFormEditorRequestAction(reqId);
        if (res.success) {
          setMessage({ type: 'success', text: res.message });
          await loadData();
        } else {
          setMessage({ type: 'error', text: res.message || 'Rejection failed.' });
        }
      } catch (err: any) {
        setMessage({ type: 'error', text: err?.message || 'Error rejecting request.' });
      } finally {
        setActiveActionId(null);
      }
    });
  };

  const handleDirectGrant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCollegeId || !newEmail) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await directGrantGoogleFormEditorAction(activeCollegeId, newEmail, newName);
        if (res.success) {
          setMessage({ type: 'success', text: res.message });
          setNewEmail('');
          setNewName('');
          await loadData();
        } else {
          setMessage({ type: 'error', text: res.message });
        }
      } catch (err: any) {
        setMessage({ type: 'error', text: err?.message || 'Failed to grant editor access.' });
      }
    });
  };

  const handleRevoke = (editorId: string, email: string) => {
    if (!confirm(`Are you sure you want to revoke Google Form editor permissions for ${email}?`)) {
      return;
    }
    setActiveActionId(editorId);
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await revokeGoogleFormEditorAction(editorId);
        if (res.success) {
          setMessage({ type: 'success', text: res.message });
          await loadData();
        } else {
          setMessage({ type: 'error', text: res.message });
        }
      } catch (err: any) {
        setMessage({ type: 'error', text: err?.message || 'Failed to revoke.' });
      } finally {
        setActiveActionId(null);
      }
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0">
      {/* Banner / Info Card - Exam Pad Pinned Roster Board */}
      <PinnedRosterBoard
        title="Google Forms Collaborative Editors"
        subtitle="Automated Google Drive sharing and real-time form collaboration permissions"
        badge="Google Drive Automation"
        icon={<FolderSync className="w-4 h-4 text-amber-500" />}
        action={
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#1f150c] hover:bg-slate-50 dark:hover:bg-[#281b0f] text-slate-700 dark:text-[#faebd0] rounded-[3px] text-xs font-semibold transition-colors border border-slate-200 dark:border-[#382710] cursor-pointer disabled:opacity-50"
            title="Refresh editor permissions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-500' : ''}`} />
            <span>Refresh</span>
          </button>
        }
      >
        <div className="p-4 sm:p-5 space-y-3 bg-white dark:bg-[#1a1309] text-xs text-slate-700 dark:text-[#faebd0]">
          <p className="leading-relaxed text-slate-600 dark:text-[#c4a97d]">
            Approved administrators receive direct editor access to the Google Drive <strong>Feedback Forms</strong> folder. Once authorized, they can edit both <strong>current forms and all future forms</strong> seamlessly directly inside Google Forms.
          </p>

          {connectedAccountEmail && (
            <div className="pt-2 border-t border-slate-100 dark:border-[#382713] flex items-center gap-2 text-xs flex-wrap">
              <span className="text-slate-400 dark:text-[#8f7553]">Connected Form Owner (Primary Google Account):</span>
              <span className="font-bold text-amber-600 dark:text-amber-400 font-mono bg-amber-50 dark:bg-[#281b0f] px-2 py-0.5 rounded-[2px] border border-amber-200/60 dark:border-amber-700/50">
                {connectedAccountEmail}
              </span>
            </div>
          )}
        </div>
      </PinnedRosterBoard>

      {/* Global Alert */}
      {message && (
        <div
          className={`p-3.5 rounded-[3px] text-xs flex items-center justify-between gap-2 animate-in fade-in ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-900/50'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-900/50'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Direct Add Section (Super Admin Only) */}
      {isSuperAdmin && (
        <div className="bg-white dark:bg-[#1a1309] rounded-[3px] border border-amber-200/80 dark:border-[#382710] p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-[#faebd0]">
            <Plus className="w-4 h-4 text-amber-500" />
            <span>Grant Editor Permission to Administrator (Direct Grant)</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#c4a97d]">
            To grant immediate editor permissions to an administrator without waiting for an incoming request, enter their Google or administrator email:
          </p>

          <form onSubmit={handleDirectGrant} className="flex flex-col sm:flex-row gap-3 pt-1">
            <input
              type="email"
              required
              placeholder="admin.email@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-[3px] text-xs border border-slate-300 dark:border-[#382710] bg-white dark:bg-[#1f150c] text-slate-800 dark:text-[#faebd0] focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
            <input
              type="text"
              placeholder="Admin Name (optional)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="sm:w-56 px-3.5 py-2 rounded-[3px] text-xs border border-slate-300 dark:border-[#382710] bg-white dark:bg-[#1f150c] text-slate-800 dark:text-[#faebd0] focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
            <button
              type="submit"
              disabled={isPending || !newEmail}
              className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-[3px] bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold transition-all disabled:opacity-60 shrink-0 cursor-pointer shadow-xs"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Granting...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Grant All-Forms Access</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Section 1: Pending Requests */}
      <div className="bg-white dark:bg-[#1a1309] rounded-[3px] border border-amber-200/80 dark:border-[#382710] p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-[#faebd0]">
              Pending Editor Access Requests ({pendingRequests.length})
            </h4>
          </div>
          <span className="text-xs text-slate-500 dark:text-[#c4a97d]">
            Administrators requesting editor access to Google Drive forms
          </span>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 dark:text-[#8f7553] bg-slate-50/60 dark:bg-[#1f150c] rounded-[3px] border border-dashed border-slate-200 dark:border-[#382710]">
            No pending editor access requests. All requests have been reviewed.
          </div>
        ) : (
          <div className="space-y-2.5">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-[3px] border border-amber-200/80 dark:border-amber-700/50 bg-amber-50/40 dark:bg-[#281b0f] text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-[#faebd0]">{req.admin_name}</span>
                    <span className="font-mono text-slate-600 dark:text-[#c4a97d] font-semibold">{req.admin_email}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-[#8f7553] flex items-center gap-2">
                    <span>Requested: {new Date(req.requested_at).toLocaleString()}</span>
                  </div>
                </div>

                {isSuperAdmin ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isPending && activeActionId === req.id}
                      onClick={() => handleApprove(req.id, req.admin_email)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[3px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-60 cursor-pointer"
                    >
                      {isPending && activeActionId === req.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserCheck className="w-3.5 h-3.5" />
                      )}
                      <span>Approve & Grant Drive Access</span>
                    </button>
                    <button
                      type="button"
                      disabled={isPending && activeActionId === req.id}
                      onClick={() => handleReject(req.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] bg-white dark:bg-[#1a1309] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 font-semibold text-xs transition-all disabled:opacity-60 cursor-pointer"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                ) : (
                  <span className="px-2.5 py-1 rounded-[2px] bg-amber-100 dark:bg-[#2e1f10] text-amber-800 dark:text-amber-300 text-[11px] font-bold border border-amber-200 dark:border-amber-700/50">
                    Awaiting Super Admin Review
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Approved Editors */}
      <div className="bg-white dark:bg-[#1a1309] rounded-[3px] border border-amber-200/80 dark:border-[#382710] p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-[#faebd0]">
              Active Form Editors ({approvedEditors.length})
            </h4>
          </div>
          <span className="text-xs text-slate-500 dark:text-[#c4a97d]">
            Administrators who have permanent edit rights for available & future forms
          </span>
        </div>

        {approvedEditors.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 dark:text-[#8f7553] bg-slate-50/60 dark:bg-[#1f150c] rounded-[3px] border border-dashed border-slate-200 dark:border-[#382710]">
            No dedicated form editors have been granted access yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#382713] border border-slate-200/70 dark:border-[#382710] rounded-[3px] overflow-hidden">
            {approvedEditors.map((ed) => (
              <div
                key={ed.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white dark:bg-[#1a1309] hover:bg-slate-50/70 dark:hover:bg-[#281b0f] transition-colors text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 dark:text-[#faebd0]">{ed.admin_name || 'Admin'}</span>
                    <span className="font-mono text-slate-600 dark:text-[#c4a97d] font-semibold">{ed.admin_email}</span>
                    <span className="px-2 py-0.2 rounded-[2px] text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                      ALL FORMS ACTIVE
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-[#8f7553]">
                    Granted: {new Date(ed.granted_at).toLocaleDateString()}
                    {ed.granted_by_email && ` by ${ed.granted_by_email}`}
                  </div>
                </div>

                {isSuperAdmin && (
                  <button
                    type="button"
                    disabled={isPending && activeActionId === ed.id}
                    onClick={() => handleRevoke(ed.id, ed.admin_email)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors disabled:opacity-60 cursor-pointer border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50"
                  >
                    {isPending && activeActionId === ed.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UserX className="w-3.5 h-3.5" />
                    )}
                    <span>Revoke Access</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
