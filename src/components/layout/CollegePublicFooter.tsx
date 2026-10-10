import React from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

export interface CollegePublicFooterProps {
  collegeName?: string;
  collegeShortName?: string;
  collegeSlug?: string;
  websiteUrl?: string | null;
  campusFlowUrl?: string;
  pwaInstallCount?: number;
  variant?: 'light' | 'dark' | 'navy';
  className?: string;
  showDesignedBy?: boolean;
}

export function CollegePublicFooter({
  collegeName,
  collegeShortName,
  collegeSlug,
  websiteUrl,
  campusFlowUrl,
  pwaInstallCount,
  variant = 'light',
  className = '',
  showDesignedBy = true,
}: CollegePublicFooterProps) {
  const mainSiteUrl = campusFlowUrl || process.env.NEXT_PUBLIC_APP_URL || '/';
  const isDark = variant === 'dark';
  const isNavy = variant === 'navy';

  const bgBorderClass = isNavy
    ? 'bg-bce-navy text-slate-400 border-bce-cobalt/30'
    : isDark
    ? 'bg-slate-900 text-slate-400 border-slate-800'
    : 'bg-white text-slate-500 border-slate-200';

  const headingTextClass = isNavy
    ? 'text-slate-200 hover:text-amber-400'
    : isDark
    ? 'text-slate-200 hover:text-amber-400'
    : 'text-slate-800 hover:text-blue-600';

  const campusFlowLinkClass = isNavy
    ? 'font-bold text-slate-200 hover:text-amber-300 hover:underline'
    : isDark
    ? 'font-bold text-slate-200 hover:text-white hover:underline'
    : 'font-bold text-slate-800 hover:text-blue-600 hover:underline';

  const authorLinkClass = isNavy || isDark
    ? 'text-amber-400 hover:underline font-medium'
    : 'text-blue-600 hover:text-blue-800 hover:underline font-medium';

  const secondaryLinkClass = isNavy || isDark
    ? 'text-slate-400 hover:text-slate-200 hover:underline'
    : 'text-slate-400 hover:text-slate-600 hover:underline';

  return (
    <footer className={`border-t py-6 text-center text-xs mt-auto w-full transition-colors ${bgBorderClass} ${className}`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 space-y-2">
        {/* College Name & Official Link */}
        {collegeName && (
          <div>
            {websiteUrl ? (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 font-bold text-xs sm:text-sm hover:underline transition-colors ${headingTextClass}`}
                title={`Visit Official Website of ${collegeName}`}
              >
                <span>
                  {collegeName} {collegeShortName ? `(${collegeShortName})` : ''}
                </span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70 shrink-0" />
              </a>
            ) : (
              <span className={`font-bold text-xs sm:text-sm ${isDark || isNavy ? 'text-slate-200' : 'text-slate-800'}`}>
                {collegeName} {collegeShortName ? `(${collegeShortName})` : ''}
              </span>
            )}
          </div>
        )}

        {/* Platform Link */}
        <p className="text-xs">
          <Link
            href={mainSiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`transition-colors ${campusFlowLinkClass}`}
            title="Open CampusFlow Main Website"
          >
            CampusFlow
          </Link>
          {' '}· Campus Management Platform
        </p>

        {/* Designed & Developed Line */}
        {showDesignedBy && (
          <p className="text-[11px] leading-relaxed">
            Designed and developed by{' '}
            <a
              href="https://portfolio-two-ashen-zseywond41.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className={`transition-colors ${authorLinkClass}`}
            >
              Mr. Aditya Kumar Sah
            </a>
            {' '}•{' '}
            <a
              href="https://portfolio-two-ashen-zseywond41.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className={`transition-colors ${secondaryLinkClass}`}
            >
              Developer Portfolio
            </a>
            {' '}under the guidance of{' '}
            <a
              href="https://www.bcebhagalpur.ac.in/faculty/abhinav-kumar/"
              target="_blank"
              rel="noopener noreferrer"
              className={`transition-colors ${authorLinkClass}`}
            >
              Dr. Abhinav Kumar
            </a>
            {' '}(Assistant Professor; BCE, Bhagalpur)
          </p>
        )}

        {/* Bottom Metadata & Copyright */}
        <div className={`text-[10px] pt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 ${isDark || isNavy ? 'text-slate-500' : 'text-slate-400'}`}>
          <span>
            &copy; {new Date().getFullYear()}{' '}
            {websiteUrl ? (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline font-medium"
              >
                {collegeName || 'CampusFlow'}
              </a>
            ) : (
              collegeName || 'CampusFlow'
            )}
            . All rights reserved.
          </span>
          <span>•</span>
          <span>
            Powered by{' '}
            <Link
              href={mainSiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`font-semibold hover:underline ${isDark || isNavy ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-blue-600'}`}
              title="CampusFlow Platform"
            >
              CampusFlow
            </Link>
          </span>
          {collegeSlug && (
            <>
              <span>•</span>
              <span>
                Tenant: <code className="font-mono">{collegeSlug}</code>
              </span>
            </>
          )}
          {typeof pwaInstallCount === 'number' && (
            <>
              <span>•</span>
              <span>PWA Installs: {pwaInstallCount}</span>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
