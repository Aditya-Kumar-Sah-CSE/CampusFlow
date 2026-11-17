'use client';

import React from 'react';
import { FileText, CheckCircle2, Loader2, Sparkles, Download } from 'lucide-react';
import { ExamPadClip } from '@/components/ui/ExamPadCard';

export interface PdfDownloadProgressModalProps {
  isOpen: boolean;
  progress: number; // 0 - 100
  stage: string;
  filename?: string;
  documentTitle?: string;
}

export function PdfDownloadProgressModal({
  isOpen,
  progress,
  stage,
  filename = 'document.pdf',
  documentTitle = 'PDF Report',
}: PdfDownloadProgressModalProps) {
  if (!isOpen) return null;

  const isDone = progress >= 100;
  const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
      {/* ExamPad Wooden / Modern Board Container */}
      <div
        className="relative w-full max-w-sm exam-pad-board-dashboard rounded-lg shadow-2xl p-2.5 sm:p-3 pt-8 sm:pt-9 overflow-visible animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-live="polite"
      >
        <ExamPadClip label={isDone ? 'READY' : 'EXPORT'} size="compact" />

        {/* Brass Corner Accents */}
        <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-amber-500/80 pointer-events-none rounded-tl-xs" />
        <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-amber-500/80 pointer-events-none rounded-tr-xs" />
        <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-amber-500/80 pointer-events-none rounded-bl-xs" />
        <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-amber-500/80 pointer-events-none rounded-br-xs" />

        {/* Pinned Paper Content */}
        <div className="pinned-paper-sheet bg-[#fffdfa] dark:bg-[#191108] border border-amber-900/30 dark:border-[#422e17] rounded-[3px] shadow-sm p-4 sm:p-5 text-slate-800 dark:text-[#faebd0] space-y-4">
          
          {/* Header */}
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm shrink-0 ${
                isDone
                  ? 'bg-emerald-500 text-white shadow-emerald-500/30 scale-105'
                  : 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-blue-500/25'
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="w-5 h-5 animate-in zoom-in duration-200" />
              ) : (
                <Download className="w-5 h-5 animate-bounce" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                <Sparkles className="w-3 h-3" />
                <span>Fast PDF Engine</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#faebd0] truncate">
                {documentTitle}
              </h3>
            </div>
          </div>

          {/* Progress Bar & Percentage */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-slate-600 dark:text-[#c4a97d] truncate pr-2 flex items-center gap-1.5 text-[11px]">
                {!isDone && <Loader2 className="w-3 h-3 animate-spin text-blue-600 dark:text-amber-400" />}
                <span>{stage}</span>
              </span>
              <span
                className={`font-mono text-sm font-black transition-colors ${
                  isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-amber-400'
                }`}
              >
                {clampedProgress}%
              </span>
            </div>

            {/* Glowing animated bar */}
            <div className="relative w-full h-3 rounded-full bg-slate-200/90 dark:bg-[#2d1e0f] overflow-hidden border border-slate-300/80 dark:border-[#4d3817] shadow-inner">
              <div
                className={`h-full transition-all duration-150 ease-out rounded-full relative overflow-hidden ${
                  isDone
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-amber-500'
                }`}
                style={{ width: `${clampedProgress}%` }}
              >
                {/* Shimmer stripe */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="pt-1 border-t border-amber-900/10 dark:border-[#382613] flex items-center justify-between text-[10px] text-slate-500 dark:text-[#a08255]">
            <span className="truncate max-w-[200px] font-mono">{filename}</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {isDone ? 'Completed' : '< 300ms response'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

