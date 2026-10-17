'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, FileDown, X, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';
import { ExamPadClip } from '@/components/ui/ExamPadCard';

export interface PdfDownloadUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceedWithWatermark: () => void;
  isDownloading?: boolean;
  documentTitle?: string;
}

export function PdfDownloadUpgradeModal({
  isOpen,
  onClose,
  onProceedWithWatermark,
  isDownloading = false,
  documentTitle = 'PDF Report',
}: PdfDownloadUpgradeModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleUpgradeNow = () => {
    onClose();
    router.push('/admin/dashboard?tab=billing');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      {/* ExamPad Wooden Hardboard */}
      <div
        className="relative w-full max-w-md exam-pad-board-dashboard rounded-lg shadow-2xl p-2 sm:p-3 pt-8 sm:pt-9 overflow-visible animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Authentic Top Metal Exam Clip */}
        <ExamPadClip label="UPGRADE" size="compact" />

        {/* Brass Corner Accents */}
        <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-amber-500/80 pointer-events-none rounded-tl-xs" />
        <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-amber-500/80 pointer-events-none rounded-tr-xs" />
        <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-amber-500/80 pointer-events-none rounded-bl-xs" />
        <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-amber-500/80 pointer-events-none rounded-br-xs" />

        {/* Pinned Paper Sheet */}
        <div className="pinned-paper-sheet bg-[#fffdfa] dark:bg-[#191108] border border-amber-900/30 dark:border-[#422e17] rounded-[3px] shadow-sm overflow-hidden text-slate-800 dark:text-[#faebd0]">
          {/* Header Banner on Paper */}
          <div className="bg-amber-50/70 dark:bg-[#20150b]/80 border-b border-amber-900/20 dark:border-[#382713] p-4 sm:p-5 relative">
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3.5 right-3.5 p-1.5 rounded-[3px] text-slate-500 hover:text-slate-800 dark:text-amber-300/80 dark:hover:text-amber-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[10px] font-bold bg-amber-200/80 dark:bg-[#34220e] text-amber-950 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/60 uppercase tracking-wider">
                <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                CAMPUSFLOW TRIAL
              </span>
            </div>

            <h2 id="modal-title" className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-[#faebd0]">
              Download PDF Report
            </h2>
            <p className="text-xs text-slate-600 dark:text-[#c4a97d] mt-0.5 line-clamp-1 font-mono">
              {documentTitle}
            </p>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-5 space-y-3.5">
            <div className="flex items-start gap-2.5 p-3 rounded-[3px] bg-amber-100/60 dark:bg-[#26180c] border border-amber-300/80 dark:border-amber-800/60 text-amber-950 dark:text-amber-200 text-xs">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-amber-950 dark:text-amber-200">Trial Watermarks Included</p>
                <p className="text-slate-700 dark:text-[#c4a97d] leading-relaxed text-[11px]">
                  Your institution is currently on the <strong>Free Trial Plan</strong>. This generated PDF will include diagonal CampusFlow trial watermarks across the document.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-[3px] bg-slate-50 dark:bg-[#160f07] border border-slate-200 dark:border-[#382613] text-xs text-slate-700 dark:text-[#c4a97d] space-y-2">
              <p className="font-bold text-slate-900 dark:text-[#faebd0]">Want clean, watermark-free PDFs?</p>
              <ul className="space-y-1 text-[11px] text-slate-600 dark:text-[#a08255]">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Watermarks automatically removed during paid period</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Official institution presentation &amp; white-label exports</span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              {/* Option 1: Upgrade Now */}
              <button
                type="button"
                onClick={handleUpgradeNow}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-[3px] bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm shadow-xs hover:shadow-md transition-all cursor-pointer group"
              >
                <Sparkles className="w-4 h-4 text-amber-200 group-hover:rotate-12 transition-transform" />
                <span>Option 1: Upgrade Now (Remove Watermarks)</span>
                <ArrowRight className="w-4 h-4 text-white/80 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* Option 2: Go with Watermarks */}
              <button
                type="button"
                onClick={onProceedWithWatermark}
                disabled={isDownloading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-[3px] bg-slate-100 hover:bg-slate-200 dark:bg-[#251a0f] dark:hover:bg-[#342211] text-slate-800 dark:text-[#faebd0] font-semibold text-xs border border-slate-300 dark:border-[#4d3817] transition-colors disabled:opacity-50 cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-slate-600 dark:text-amber-400" />
                <span>{isDownloading ? 'Generating PDF...' : 'Option 2: Go with Watermarks'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
