'use client';

import React from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  ArrowRight,
  Home,
  FileSpreadsheet,
  Calendar,
  Building2,
  Copy,
  Download,
  Loader2,
  Sparkles,
} from 'lucide-react';

export type SuccessType = 'feedback' | 'event';

export interface SuccessStateProps {
  type: SuccessType;
  title?: string;
  subtitle?: string;
  collegeName?: string;
  collegeSlug?: string;
  collegeCode?: string;
  entityTitle?: string; // Form title or Event name
  registrationNumber?: string;
  teamId?: string;
  submittedAt?: string;
  myRegistrationsPath?: string;
  moreActionHref?: string;
  onDownloadPass?: () => void;
  isDownloadingPass?: boolean;
  onDownloadPdf?: () => void;
  isDownloadingPdf?: boolean;
  hasDownloadUrl?: boolean;
  children?: React.ReactNode;
  hideDefaultActions?: boolean;
}

export function SuccessState({
  type,
  title,
  subtitle,
  collegeName,
  collegeSlug,
  entityTitle,
  registrationNumber,
  teamId,
  submittedAt,
  myRegistrationsPath,
  moreActionHref,
  onDownloadPass,
  isDownloadingPass,
  onDownloadPdf,
  isDownloadingPdf,
  hasDownloadUrl,
  children,
  hideDefaultActions,
}: SuccessStateProps) {
  const [copied, setCopied] = React.useState(false);

  const homePath = collegeSlug ? `/${collegeSlug}` : '/';
  const defaultMorePath = type === 'feedback'
    ? (collegeSlug ? `/${collegeSlug}/feedback` : '/feedback')
    : (collegeSlug ? `/${collegeSlug}/events` : '/events');

  const moreHref = moreActionHref || defaultMorePath;

  const handleCopy = (text: string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Default exact copy conforming to prompt requirement 15
  const displayTitle = title || (type === 'feedback'
    ? 'Thank You for Your Feedback'
    : 'Registration Successful');

  const displaySubtitle = subtitle || (type === 'feedback'
    ? 'Your feedback has been submitted successfully.'
    : `Your registration for ${entityTitle || 'the event'} has been submitted successfully.`);

  return (
    <div className="w-full text-center space-y-6">
      {/* Success Icon with pop animation */}
      <div className="relative inline-flex items-center justify-center animate-success-pop">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border-2 border-emerald-200/90 shadow-sm shadow-emerald-500/10">
          <CheckCircle2 className="w-9 h-9 sm:w-11 sm:h-11 text-emerald-500 animate-badge-pulse" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Main Title & Subtitle */}
      <div className="space-y-2 max-w-lg mx-auto">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {displayTitle}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          {displaySubtitle}
        </p>
      </div>

      {/* Clean Minimal Submission Card */}
      <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 sm:p-5 text-left max-w-lg mx-auto space-y-3.5 shadow-sm">
        {/* Entity Title & College */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200/70 pb-3">
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
              {type === 'feedback' ? 'Curriculum Form' : 'Campus Event'}
            </span>
            <div className="text-sm sm:text-base font-bold text-slate-900 truncate">
              {entityTitle || (type === 'feedback' ? 'Faculty Evaluation' : 'Event Registration')}
            </div>
          </div>
          {collegeName && (
            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Institution
              </span>
              <span className="text-xs font-semibold text-slate-700 truncate max-w-[140px] block">
                {collegeName}
              </span>
            </div>
          )}
        </div>

        {/* Event Registration Number Card (if present) */}
        {registrationNumber && (
          <div className="bg-slate-900 rounded-xl p-3.5 text-white flex items-center justify-between gap-2 shadow-inner">
            <div className="min-w-0">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">
                Registration Number
              </span>
              <span className="text-lg sm:text-xl font-mono font-black text-amber-400 tracking-wide truncate block">
                {registrationNumber}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(registrationNumber)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors shrink-0 cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        )}

        {/* Team Identifier (if present) */}
        {teamId && (
          <div className="flex items-center justify-between text-xs py-1 px-1 text-slate-600 border-b border-slate-200/50">
            <span className="text-slate-500 font-medium">Team ID:</span>
            <span className="font-mono font-bold text-slate-900">{teamId}</span>
          </div>
        )}

        {/* Submission Meta Tags */}
        <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
          <div className="flex items-center gap-1.5 text-slate-600">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-500">Status:</span>
            <span className="font-bold text-emerald-700">Submitted</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600 justify-end">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-500">Recorded:</span>
            <span className="font-semibold text-slate-800">
              {submittedAt
                ? new Date(submittedAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                  })
                : 'Just now'}
            </span>
          </div>
        </div>
      </div>

      {/* Custom Children / Interactive Pass Download Component */}
      {children}

      {/* Action Buttons (Strictly matching prompt requirement 15) */}
      {!hideDefaultActions && (
        <div className="max-w-lg mx-auto space-y-2.5 pt-2">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
            {type === 'event' && myRegistrationsPath && (
              <Link
                href={myRegistrationsPath}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/50 active:scale-[0.98]"
              >
                <span>View My Registration</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}

            {/* More Action Button */}
            <Link
              href={moreHref}
              className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm focus:outline-none focus:ring-2 active:scale-[0.98] ${
                type === 'feedback'
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-600/50'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 focus:ring-slate-400'
              }`}
            >
              <span>{type === 'feedback' ? 'Find More Feedback Forms' : 'Explore More Events'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            {/* Go to CampusFlow Button */}
            <Link
              href={homePath}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 active:scale-[0.98]"
            >
              <Home className="w-4 h-4" />
              <span>Go to CampusFlow</span>
            </Link>
          </div>

          {/* Secondary Downloads (Pass PNG or PDF receipt) */}
          {(onDownloadPass || (onDownloadPdf && hasDownloadUrl)) && (
            <div className="pt-2 flex items-center justify-center gap-2">
              {onDownloadPass && (
                <button
                  type="button"
                  onClick={onDownloadPass}
                  disabled={isDownloadingPass}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-xs border border-emerald-200/80 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isDownloadingPass ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>{isDownloadingPass ? 'Preparing Pass...' : 'Download Pass (PNG)'}</span>
                </button>
              )}

              {onDownloadPdf && hasDownloadUrl && (
                <button
                  type="button"
                  onClick={onDownloadPdf}
                  disabled={isDownloadingPdf}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-semibold text-xs border border-indigo-200/80 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isDownloadingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                  )}
                  <span>{isDownloadingPdf ? 'Downloading...' : 'Download Response (PDF)'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
