import React from 'react';
import Link from 'next/link';

interface Props {
  collegeName?: string;
  collegeSlug?: string;
  className?: string;
}

export function CompletionFooter({ collegeName, collegeSlug, className = '' }: Props) {
  const homePath = collegeSlug ? `/${collegeSlug}` : '/';

  return (
    <footer className={`mt-auto pt-10 pb-8 text-center text-xs text-slate-500 w-full ${className}`}>
      <div className="max-w-xl mx-auto px-4 space-y-3">
        {/* Brand Link */}
        <div>
          <Link
            href={homePath}
            className="inline-flex items-center gap-1.5 font-bold text-slate-700 hover:text-slate-900 transition-colors"
          >
            <span>CampusFlow</span>
            {collegeName && (
              <>
                <span className="text-slate-300 font-normal">·</span>
                <span className="text-slate-500 font-normal">{collegeName}</span>
              </>
            )}
          </Link>
        </div>

        {/* Required Professional Attribution (Subtle and Unobtrusive) */}
        <p className="text-[11px] leading-relaxed text-slate-400 font-normal">
          Designed and developed by{' '}
          <a
            href="https://portfolio-two-ashen-zseywond41.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-600 hover:text-blue-600 underline decoration-slate-300 transition-colors"
          >
            Mr. Aditya Kumar Sah
          </a>
          <br className="sm:hidden" />
          {' '}under the guidance of{' '}
          <a
            href="https://www.bcebhagalpur.ac.in/faculty/abhinav-kumar/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-600 hover:text-blue-600 underline decoration-slate-300 transition-colors"
          >
            Dr. Avinav (Assistant Professor)
          </a>
        </p>

        {/* System copyright */}
        <p className="text-[10px] text-slate-400">
          &copy; {new Date().getFullYear()} CampusFlow. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
