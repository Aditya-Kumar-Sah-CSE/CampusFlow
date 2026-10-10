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
} from 'lucide-react';
import {
  getGoogleFormEditorsOverviewAction,
  approveGoogleFormEditorRequestAction,
  rejectGoogleFormEditorRequestAction,
  directGrantGoogleFormEditorAction,
  revokeGoogleFormEditorAction,
} from '@/app/admin/forms/editor-actions';
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
    <div className="space-y-6">
      {/* Banner / Info Card */}
      <div className="bg-gradient-to-r from-bce-navy via-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                <FolderSync className="w-3.5 h-3.5" />
                GOOGLE DRIVE SHARING AUTOMATION
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold tracking-tight">
              Google Forms Collaborative Editors
            </h3>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Yahan approve kiye gaye administrators ko Google Drive ke <strong>Feedback Forms</strong> folder ka direct editor access milta hai. Approve hone ke baad wo <strong>current forms aur aage aane wale sabhi future forms</strong> ko bina kisi rukawat direct Google Forms par edit kar sakte hain.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors border border-white/15"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {connectedAccountEmail && (
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 text-xs text-slate-300">
            <span className="text-slate-400">Connected Form Owner (Primary Google Account):</span>
            <span className="font-bold text-amber-300 font-mono">{connectedAccountEmail}</span>
          </div>
        )}
      </div>

      {/* Global Alert */}
      {message && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center gap-2 shadow-xs ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="font-medium">{message.text}</span>
        </div>
      )}

      {/* Direct Add Section (Super Admin Only) */}
      {isSuperAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Plus className="w-4 h-4 text-amber-500" />
            <span>Grant Editor Permission to Administrator (Direct Grant)</span>
          </div>
          <p className="text-xs text-slate-500">
            Agar aap kisi admin ko bina request aane ka intezar kiye turant editor banana chahte hain, toh unka Google/admin email enter karein:
          </p>

          <form onSubmit={handleDirectGrant} className="flex flex-col sm:flex-row gap-3 pt-1">
            <input
              type="email"
              required
              placeholder="admin.email@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-bce-navy/20 focus:border-bce-navy"
            />
            <input
              type="text"
              placeholder="Admin Name (optional)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="sm:w-56 px-3.5 py-2 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-bce-navy/20 focus:border-bce-navy"
            />
            <button
              type="submit"
              disabled={isPending || !newEmail}
              className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-bce-navy hover:bg-slate-900 text-white text-xs font-bold transition-all disabled:opacity-60 shrink-0"
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
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h4 className="text-sm font-bold text-slate-900">
              Pending Editor Access Requests ({pendingRequests.length})
            </h4>
          </div>
          <span className="text-xs text-slate-500">
            Admins who clicked &quot;Edit in Google Forms&quot; and need approval
          </span>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
            Koi pending request nahi hai. Sabhi requests processed hain.
          </div>
        ) : (
          <div className="space-y-2.5">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-amber-200/80 bg-amber-50/40 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{req.admin_name}</span>
                    <span className="font-mono text-slate-600 font-semibold">{req.admin_email}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                    <span>Requested: {new Date(req.requested_at).toLocaleString()}</span>
                  </div>
                </div>

                {isSuperAdmin ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isPending && activeActionId === req.id}
                      onClick={() => handleApprove(req.id, req.admin_email)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-60"
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-xs transition-all disabled:opacity-60"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                    Awaiting Super Admin Review
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Approved Editors */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h4 className="text-sm font-bold text-slate-900">
              Active Form Editors ({approvedEditors.length})
            </h4>
          </div>
          <span className="text-xs text-slate-500">
            Admins who have permanent edit rights for available & future forms
          </span>
        </div>

        {approvedEditors.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
            Abhi tak kisi admin ko separate editor access grant nahi kiya gaya hai.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200/70 rounded-xl overflow-hidden">
            {approvedEditors.map((ed) => (
              <div
                key={ed.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white hover:bg-slate-50/70 transition-colors text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{ed.admin_name || 'Admin'}</span>
                    <span className="font-mono text-slate-600 font-semibold">{ed.admin_email}</span>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      ALL FORMS ACTIVE
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Granted: {new Date(ed.granted_at).toLocaleDateString()}
                    {ed.granted_by_email && ` by ${ed.granted_by_email}`}
                  </div>
                </div>

                {isSuperAdmin && (
                  <button
                    type="button"
                    disabled={isPending && activeActionId === ed.id}
                    onClick={() => handleRevoke(ed.id, ed.admin_email)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs font-semibold transition-colors disabled:opacity-60"
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
