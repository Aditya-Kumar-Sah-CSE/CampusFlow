'use client';

import React, { useState, useEffect } from 'react';
import {
  FileEdit,
  Shield,
  ShieldCheck,
  Clock,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  RefreshCw,
  Send,
  Lock,
} from 'lucide-react';
import {
  checkGoogleFormEditorStatusAction,
  requestGoogleFormEditorAccessAction,
} from '@/app/admin/forms/editor-actions';

export interface GoogleFormEditPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collegeId: string;
  formTitle: string;
  currentUserEmail: string;
  googleFormEditUrl: string;
  isSuperAdmin?: boolean;
}

export function GoogleFormEditPermissionModal({
  isOpen,
  onClose,
  collegeId,
  formTitle,
  currentUserEmail,
  googleFormEditUrl,
  isSuperAdmin = false,
}: GoogleFormEditPermissionModalProps) {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED'>('NONE');
  const [requestedAt, setRequestedAt] = useState<string | null>(null);
  const [connectedAccountEmail, setConnectedAccountEmail] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await checkGoogleFormEditorStatusAction(collegeId);
      if (res.success) {
        setHasAccess(res.hasAccess);
        setIsOwner(res.isOwner);
        setRequestStatus(res.requestStatus);
        setRequestedAt(res.requestedAt || null);
        setConnectedAccountEmail(res.connectedAccountEmail || null);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen, collegeId]);

  if (!isOpen) return null;

  const handleRequestAccess = async () => {
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await requestGoogleFormEditorAccessAction(collegeId);
      if (res.success) {
        if (res.grantedImmediately) {
          setHasAccess(true);
          setRequestStatus('APPROVED');
          setFeedback({
            type: 'success',
            text: res.message || 'Google Drive editor access granted! Click "Open Google Forms" below to edit.',
          });
        } else {
          setRequestStatus('PENDING');
          setFeedback({
            type: 'success',
            text: res.message || 'Permission request sent to Super Admin!',
          });
        }
      } else {
        setFeedback({
          type: 'error',
          text: res.message || 'Failed to submit request.',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Network error occurred.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="perm-modal-title"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-bce-navy via-slate-900 to-indigo-950 text-white p-5 sm:p-6 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
              <Shield className="w-3.5 h-3.5 text-amber-300" />
              GOOGLE FORMS PERMISSION
            </span>
          </div>

          <h2 id="perm-modal-title" className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileEdit className="w-5 h-5 text-amber-400" />
            <span>Edit in Google Forms</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1 line-clamp-1">{formTitle}</p>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              <p className="text-sm font-medium text-slate-600">Checking Google Drive editor permissions...</p>
            </div>
          ) : (
            <>
              {/* Account Status Card */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Logged-in Admin:</span>
                  <span className="font-bold text-slate-800">{currentUserEmail}</span>
                </div>
                {connectedAccountEmail && (
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                    <span className="text-slate-500 font-medium">Form Owner Account:</span>
                    <span className="font-semibold text-slate-700">{connectedAccountEmail}</span>
                  </div>
                )}
              </div>

              {/* Status Banner */}
              {hasAccess || requestStatus === 'APPROVED' ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-900 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>Editor Access Granted!</span>
                  </div>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    Aapke account ko Google Drive editor access mil chuka hai. Aap is form aur aane wale sabhi forms ko bina kisi rukawat direct Google Forms par edit kar sakte hain.
                  </p>
                </div>
              ) : requestStatus === 'PENDING' ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
                    <Clock className="w-5 h-5 text-amber-600 shrink-0 animate-pulse" />
                    <span>Permission Request Pending with Super Admin</span>
                  </div>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Aapki request Super Admin ko bhej di gayi hai. Super Admin ke approve karte hi aapko is form aur <strong>future ke sabhi forms</strong> ka permanent edit access mil jayega (bar-bar poochne ki zaroorat nahi padegi).
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 text-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Lock className="w-5 h-5 text-indigo-600 shrink-0" />
                    <span>Super Admin Permission Required</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Google Forms ko direct <code className="px-1 py-0.5 bg-white rounded text-indigo-700 font-mono">docs.google.com</code> par edit karne ke liye aapke email ko Google Drive par <strong>Editor</strong> banana zaroori hai.
                  </p>
                  <div className="flex items-start gap-2 pt-1 text-xs text-indigo-900 font-medium bg-white/70 p-2.5 rounded-xl border border-indigo-100">
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span>
                      Super Admin ke 1-time approval ke baad, aap <strong>current form aur aage create hone wale sabhi future forms</strong> ko hamesha direct edit kar sakenge!
                    </span>
                  </div>
                </div>
              )}

              {/* Feedback Alert */}
              {feedback && (
                <div
                  className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                    feedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {feedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{feedback.text}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={fetchStatus}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Check Status</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-200 transition-colors"
            >
              Close
            </button>

            {hasAccess || requestStatus === 'APPROVED' ? (
              <a
                href={googleFormEditUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Open Google Forms</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : requestStatus === 'PENDING' ? (
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500/80 text-white rounded-xl text-xs font-bold cursor-not-allowed opacity-90"
              >
                <Clock className="w-3.5 h-3.5 animate-spin" />
                <span>Waiting for Approval</span>
              </button>
            ) : isSuperAdmin ? (
              <button
                type="button"
                onClick={handleRequestAccess}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-xl text-xs font-extrabold shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Granting Drive Access...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Grant Instant Access (Super Admin)</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRequestAccess}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-bce-navy to-indigo-900 hover:from-slate-900 hover:to-indigo-950 text-white rounded-xl text-xs font-bold shadow-md shadow-slate-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending Request...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Ask Super Admin for Permission</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
