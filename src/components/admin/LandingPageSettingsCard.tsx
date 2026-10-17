'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Globe, ExternalLink, FileText, Ticket, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { updateLandingTogglesAction } from '@/app/admin/institutions/actions';
import { PinnedRosterBoard } from '@/components/ui/PinnedRosterBoard';

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
    <PinnedRosterBoard
      id="landing-page-settings-card"
      title="Public Landing Page Display Settings"
      subtitle={
        <span>
          Control public section visibility on the tenant portal for{' '}
          <strong className="text-slate-900 dark:text-amber-300 font-bold">{collegeName}</strong>.
        </span>
      }
      badge="PORTAL CONFIG"
      icon={<Globe className="w-4 h-4 text-amber-700 dark:text-amber-400" />}
      action={
        <Link
          href={`/${collegeSlug}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-[3px] transition-colors shadow-xs"
        >
          <span>Preview Live Portal</span>
          <ExternalLink className="w-3.5 h-3.5 text-slate-900" />
        </Link>
      }
    >
      <div className="p-4 sm:p-5 space-y-4">
        {/* Toast */}
        {message && (
          <div
            className={`p-3 rounded-[3px] border flex items-center gap-2 text-xs font-bold animate-in fade-in duration-150 ${
              message.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Toggle Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Feedbacks Toggle */}
          <div className="p-4 rounded-[3px] border border-amber-200/80 dark:border-[#382710] bg-white dark:bg-[#1a1309] shadow-xs flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-[#faebd0]">Feedbacks Section</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-[2px] text-[10px] font-bold uppercase tracking-wider ${
                    showFeedbacks
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60'
                      : 'bg-slate-100 dark:bg-[#251a0e] text-slate-600 dark:text-[#a08862] border border-slate-300 dark:border-[#4d3817]'
                  }`}
                >
                  {showFeedbacks ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#a08862] leading-relaxed">
                Shows the feedback discovery path, academic selectors, and published forms on the landing page.
              </p>
            </div>

            <div className="pt-2 border-t border-amber-200/60 dark:border-[#2a1d0f] flex items-center justify-between">
              <span className="text-[11px] text-slate-500 dark:text-[#a08862]">
                Direct form URLs remain functional.
              </span>
              <button
                type="button"
                disabled={loading || !isSuperAdmin}
                onClick={() => handleToggle('feedbacks')}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
                  showFeedbacks ? 'bg-amber-500 dark:bg-amber-400' : 'bg-slate-300 dark:bg-[#382710]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-slate-950 shadow-sm ring-0 transition duration-200 ease-in-out ${
                    showFeedbacks ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Events Toggle */}
          <div className="p-4 rounded-[3px] border border-amber-200/80 dark:border-[#382710] bg-white dark:bg-[#1a1309] shadow-xs flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-[#faebd0]">Events Section</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-[2px] text-[10px] font-bold uppercase tracking-wider ${
                    showEvents
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60'
                      : 'bg-slate-100 dark:bg-[#251a0e] text-slate-600 dark:text-[#a08862] border border-slate-300 dark:border-[#4d3817]'
                  }`}
                >
                  {showEvents ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#a08862] leading-relaxed">
                Shows upcoming college events, workshops, cultural programs, and registration cards on the landing page.
              </p>
            </div>

            <div className="pt-2 border-t border-amber-200/60 dark:border-[#2a1d0f] flex items-center justify-between">
              <span className="text-[11px] text-slate-500 dark:text-[#a08862]">
                Direct event registration URLs remain functional.
              </span>
              <button
                type="button"
                disabled={loading || !isSuperAdmin}
                onClick={() => handleToggle('events')}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
                  showEvents ? 'bg-amber-500 dark:bg-amber-400' : 'bg-slate-300 dark:bg-[#382710]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-slate-950 shadow-sm ring-0 transition duration-200 ease-in-out ${
                    showEvents ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-end gap-1.5 text-[11px] text-slate-500 dark:text-[#a08862]">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 dark:text-amber-400" />
            <span>Saving and revalidating cache...</span>
          </div>
        )}
      </div>
    </PinnedRosterBoard>
  );
}
