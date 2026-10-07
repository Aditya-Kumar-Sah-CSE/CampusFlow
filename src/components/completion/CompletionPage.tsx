'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { School, ShieldCheck } from 'lucide-react';
import { CompletionFooter } from './CompletionFooter';
import { resolveCollegeLogoUrl } from '@/lib/events/college-logos';

interface Props {
  collegeName?: string;
  collegeSlug?: string;
  collegeCode?: string;
  collegeLogoUrl?: string | null;
  children: React.ReactNode;
  className?: string;
}

export function CompletionPage({
  collegeName,
  collegeSlug,
  collegeCode,
  collegeLogoUrl,
  children,
  className = '',
}: Props) {
  const [logoError, setLogoError] = useState(false);
  const homePath = collegeSlug ? `/${collegeSlug}` : '/';

  // Use centralized college logo resolver per Requirement 5
  const effectiveLogoUrl = resolveCollegeLogoUrl({
    collegeLogoUrl,
    collegeSlug,
    collegeName,
    collegeCode,
  });

  return (
    <div className={`min-h-screen flex flex-col bg-slate-50/70 text-slate-800 antialiased ${className}`}>
      {/* Top Ambient Bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900" />

      {/* Branded Header */}
      <header className="w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          {/* Left: College & CampusFlow Brand */}
          <Link
            href={homePath}
            className="flex items-center gap-2.5 sm:gap-3 min-w-0 group focus:outline-none focus:ring-2 focus:ring-slate-900/30 rounded-xl p-1"
          >
            {/* College Logo with Centralized Fallback & Img Error Protection */}
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-sm group-hover:scale-[1.02] transition-transform">
              {effectiveLogoUrl && !logoError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={effectiveLogoUrl}
                  alt={`${collegeName || 'College'} Logo`}
                  className="w-full h-full object-contain"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div className="w-full h-full bg-slate-900 rounded-lg flex items-center justify-center text-amber-400">
                  <School className="w-4 h-4 text-amber-400" />
                </div>
              )}
            </div>

            {/* Institution & Portal Title */}
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-extrabold text-slate-900 truncate tracking-tight group-hover:text-indigo-600 transition-colors">
                {collegeName || 'CampusFlow'}
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate flex items-center gap-1">
                <span>CampusFlow Platform</span>
                <span className="text-slate-300">·</span>
                <span className="text-emerald-600 font-semibold">Verified</span>
              </div>
            </div>
          </Link>

          {/* Right: Security Badge */}
          <div className="hidden xs:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200/80 shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Secure Submission</span>
          </div>
        </div>
      </header>

      {/* Main Content Container with smooth entrance */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col justify-center space-y-8 animate-completion-in">
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-8 md:p-10 space-y-8 transition-all">
          {children}
        </div>
      </main>

      {/* Professional Attribution Footer */}
      <CompletionFooter collegeName={collegeName} collegeSlug={collegeSlug} />
    </div>
  );
}
