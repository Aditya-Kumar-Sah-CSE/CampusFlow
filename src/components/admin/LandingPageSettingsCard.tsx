'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Globe, ExternalLink, FileText, Ticket, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { updateLandingTogglesAction } from '@/app/admin/institutions/actions';

interface Props {
  collegeId: string;
  collegeName: string;
  collegeSlug: string;
  isSuperAdmin: boolean;
  initialFeedbacks?: boolean;
  initialEvents?: boolean;
}

export function LandingPageSettingsCard({
  collegeId,
  collegeName,
  collegeSlug,
  isSuperAdmin,
  initialFeedbacks = true,
  initialEvents = true,
}: Props) {
  const [showFeedbacks, setShowFeedbacks] = useState(initialFeedbacks);
  const [showEvents, setShowEvents] = useState(initialEvents);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Sync state if props change (e.g. tenant switched)
  useEffect(() => {
    setShowFeedbacks(initialFeedbacks);
    setShowEvents(initialEvents);
  }, [initialFeedbacks, initialEvents, collegeId]);

  const showToast = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3500);
  };

  const handleToggle = async (module: 'feedbacks' | 'events') => {
    if (!isSuperAdmin) return;

    const nextFeedbacks = module === 'feedbacks' ? !showFeedbacks : showFeedbacks;
    const nextEvents = module === 'events' ? !showEvents : showEvents;

    // Optimistic UI update
    if (module === 'feedbacks') setShowFeedbacks(nextFeedbacks);
    if (module === 'events') setShowEvents(nextEvents);

    setLoading(true);
    const res = await updateLandingTogglesAction(collegeId, {
      showFeedbacks: nextFeedbacks,
      showEvents: nextEvents,
    });
    setLoading(false);

    if (res.success && res.settings) {
      setShowFeedbacks(res.settings.showFeedbacks);
      setShowEvents(res.settings.showEvents);
      showToast(
        `Landing Page ${module === 'feedbacks' ? 'Feedbacks' : 'Events'} set to ${
          (module === 'feedbacks' ? res.settings.showFeedbacks : res.settings.showEvents) ? 'ON' : 'OFF'
        } for ${collegeName}.`,
        'success'
      );
    } else {
      // Revert on failure
      if (module === 'feedbacks') setShowFeedbacks(!nextFeedbacks);
      if (module === 'events') setShowEvents(!nextEvents);
      showToast(res.error || 'Failed to update landing page setting.', 'error');
    }
  };

  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Public Landing Page Display Settings</h4>
            <p className="text-[11px] text-slate-500">
              Control public section visibility on the tenant portal. Settings persist server-side.
            </p>
          </div>
        </div>

        <Link
          href={`/${collegeSlug}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200/60 rounded-xl transition-colors self-start sm:self-auto"
        >
          <span>Preview Live Portal</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Toast */}
      {message && (
        <div
          className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold animate-in fade-in duration-150 ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Toggle Controls Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Feedbacks Toggle */}
        <div className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/50 flex flex-col justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-900">Feedbacks Section</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  showFeedbacks
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {showFeedbacks ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Shows the feedback discovery path, academic selectors, and published forms on the landing page.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              Direct form URLs remain functional.
            </span>
            <button
              type="button"
              disabled={loading || !isSuperAdmin}
              onClick={() => handleToggle('feedbacks')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
                showFeedbacks ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  showFeedbacks ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Events Toggle */}
        <div className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/50 flex flex-col justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ticket className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900">Events Section</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  showEvents
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {showEvents ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Shows upcoming college events, workshops, cultural programs, and registration cards on the landing page.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              Direct event registration URLs remain functional.
            </span>
            <button
              type="button"
              disabled={loading || !isSuperAdmin}
              onClick={() => handleToggle('events')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
                showEvents ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  showEvents ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-end gap-1.5 text-[11px] text-slate-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Saving and revalidating cache...</span>
        </div>
      )}
    </div>
  );
}
