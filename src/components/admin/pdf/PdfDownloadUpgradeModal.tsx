'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, FileDown, X, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Top Header Decorative Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-5 sm:p-6 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
              <Sparkles className="w-3 h-3 text-amber-300" />
              CAMPUSFLOW TRIAL
            </span>
          </div>

          <h2 id="modal-title" className="text-lg sm:text-xl font-bold tracking-tight text-white">
            Download PDF Report
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 line-clamp-1">
            {documentTitle}
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-950">Trial Watermarks Included</p>
              <p className="text-amber-800 leading-relaxed">
                Your institution is currently on the <strong>Free Trial Plan</strong>. This generated PDF will include diagonal CampusFlow trial watermarks across the document.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
            <p className="font-semibold text-slate-900">Want clean, watermark-free PDFs?</p>
            <ul className="space-y-1 text-slate-600">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Watermarks automatically removed during paid period</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Official institution presentation & white-label exports</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            {/* Option 1: Upgrade Now */}
            <button
              type="button"
              onClick={handleUpgradeNow}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer group"
            >
              <Sparkles className="w-4 h-4 text-amber-300 group-hover:rotate-12 transition-transform" />
              <span>Option 1: Upgrade Now (Remove Watermarks)</span>
              <ArrowRight className="w-4 h-4 text-white/80 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* Option 2: Go with Watermarks */}
            <button
              type="button"
              onClick={onProceedWithWatermark}
              disabled={isDownloading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm border border-slate-300/80 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-slate-600" />
              <span>{isDownloading ? 'Generating PDF...' : 'Option 2: Go with Watermarks'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
