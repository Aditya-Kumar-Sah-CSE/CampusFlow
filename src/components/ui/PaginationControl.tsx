'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  isLoading?: boolean;
}

export function PaginationControl({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  isLoading = false,
}: PaginationControlProps) {
  if (totalItems === 0) return null;

  const startItem = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate visible page numbers with smart ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="px-2.5 sm:px-4 py-3 bg-slate-50/70 dark:bg-[#1a1309]/90 border-t border-slate-200/80 dark:border-[#382713] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-[#c4a97d] transition-colors">
      {/* Item summary & Page size */}
      <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-start text-[11px] sm:text-xs">
        <span>
          Showing <strong className="font-semibold text-slate-900 dark:text-[#faebd0]">{startItem}</strong>–
          <strong className="font-semibold text-slate-900 dark:text-[#faebd0]">{endItem}</strong> of{' '}
          <strong className="font-semibold text-slate-900 dark:text-[#faebd0]">{totalItems}</strong> entries
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2">
            <label htmlFor="pageSizeSelect" className="text-slate-500 dark:text-[#a8906c] text-[11px] hidden sm:inline">
              Per page:
            </label>
            <select
              id="pageSizeSelect"
              value={pageSize}
              disabled={isLoading}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-white dark:bg-[#22180e] border border-slate-200 dark:border-[#4d3817] rounded-[3px] px-2 py-1 text-xs text-slate-800 dark:text-[#faebd0] focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer disabled:opacity-50"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt} className="bg-white dark:bg-[#22180e] text-slate-900 dark:text-[#faebd0]">
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-1 flex-wrap justify-center">
        {/* Previous button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || isLoading}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[3px] border border-slate-200 dark:border-[#4d3817] bg-white dark:bg-[#22180e] hover:bg-slate-100 dark:hover:bg-[#2e2013] text-slate-700 dark:text-[#faebd0] font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Previous</span>
        </button>

        {/* Page buttons */}
        <div className="flex items-center gap-1 flex-wrap justify-center">
          {pageNumbers.map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`ellipsis-${idx}`} className="px-1.5 py-1 text-slate-400 dark:text-[#7d684e] text-xs">
                  …
                </span>
              );
            }

            const pageNum = Number(p);
            const isActive = pageNum === currentPage;

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                disabled={isLoading}
                className={`min-w-[28px] h-7 px-1.5 rounded-[3px] text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-bce-navy text-amber-400 dark:bg-[#342414] dark:text-amber-300 dark:border dark:border-amber-600/50 shadow-2xs'
                    : 'text-slate-600 dark:text-[#c4a97d] hover:bg-slate-100 dark:hover:bg-[#281b0f] border border-transparent'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Next button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || isLoading}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[3px] border border-slate-200 dark:border-[#4d3817] bg-white dark:bg-[#22180e] hover:bg-slate-100 dark:hover:bg-[#2e2013] text-slate-700 dark:text-[#faebd0] font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
