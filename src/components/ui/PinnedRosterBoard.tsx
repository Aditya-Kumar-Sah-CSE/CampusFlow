'use client';

import React from 'react';
import { RedPushpin } from '@/components/ui/RedPushpin';

export interface PinnedRosterBoardProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  sheetClassName?: string;
  id?: string;
}

/**
 * PinnedRosterBoard:
 * Displays administrative lists and rosters (Faculty, Subjects, Assignments)
 * as an official document sheet pinned with a 3D Red Pushpin to a matching
 * wooden campus notice/ledger board with uniform sharp corners and Day/Night mode support.
 */
export function PinnedRosterBoard({
  children,
  title,
  subtitle,
  badge,
  icon,
  action,
  className = '',
  sheetClassName = '',
  id,
}: PinnedRosterBoardProps) {
  return (
    <div
      id={id}
      className={`exam-pad-board-dashboard rounded-lg p-2 sm:p-2.5 md:p-3 pt-6 sm:pt-7 relative overflow-visible shadow-md min-w-0 w-full ${className}`}
    >
      {/* Authentic 3D Red Pushpin Pinning the Document to the Board */}
      <RedPushpin className="-top-3" />

      {/* Decorative Brass Corner Accents for Academic Polish */}
      <div className="absolute top-1 left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-amber-500/60 pointer-events-none rounded-tl-xs" />
      <div className="absolute top-1 right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-amber-500/60 pointer-events-none rounded-tr-xs" />
      <div className="absolute bottom-1 left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-amber-500/60 pointer-events-none rounded-bl-xs" />
      <div className="absolute bottom-1 right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-amber-500/60 pointer-events-none rounded-br-xs" />

      {/* The Pinned Paper Document Sheet (Sharp corners rounded-[3px], Day/Night responsive) */}
      <div
        className={`pinned-paper-sheet rounded-[3px] overflow-hidden flex flex-col min-w-0 w-full text-slate-800 dark:text-[#faebd0] transition-colors ${sheetClassName}`}
      >
        {/* Optional Header Banner if title is provided */}
        {(title || icon || badge || action) && (
          <div className="px-3.5 sm:px-5 py-2.5 sm:py-3 border-b border-slate-200/80 dark:border-[#382713] bg-slate-50/70 dark:bg-[#1f150c]/80 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              {icon && (
                <div className="w-7 h-7 rounded-sm bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20 dark:border-amber-500/30">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {typeof title === 'string' ? (
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-[#faebd0] tracking-tight truncate">
                      {title}
                    </h3>
                  ) : (
                    title
                  )}
                  {badge && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-xs bg-amber-100/80 dark:bg-[#2e1f10] text-amber-900 dark:text-amber-300 border border-amber-200/80 dark:border-amber-700/50">
                      {badge}
                    </span>
                  )}
                </div>
                {subtitle && (
                  <p className="text-[11px] text-slate-500 dark:text-[#c4a97d] truncate">{subtitle}</p>
                )}
              </div>
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </div>
        )}

        {/* Paper Document Content (Search, Filters, Data Table, Pagination) */}
        {children}
      </div>
    </div>
  );
}

export default PinnedRosterBoard;
