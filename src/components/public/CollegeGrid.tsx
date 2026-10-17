'use client';

import { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Share2,
  School,
  Building2,
  Check,
  CheckCircle2,
  MapPin,
  Download,
  Search,
  X,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import type { TenantContext } from '@/types/tenant';
import { resolveCollegeLogoUrl } from '@/lib/events/college-logos';
import { ExamPadCard } from '@/components/ui/ExamPadCard';
import { RedPushpin } from '@/components/ui/RedPushpin';

interface CollegeGridProps {
  colleges: TenantContext[];
}

type CategoryType = 'ALL' | 'ENGG' | 'POLY';

const isPolytechnic = (col: TenantContext): boolean => {
  const code = (col.code || '').toUpperCase();
  const slug = (col.slug || '').toLowerCase();
  const name = (col.name || '').toLowerCase();
  return (
    code.startsWith('GP-') ||
    code.startsWith('GWP-') ||
    slug.startsWith('gp-') ||
    slug.startsWith('gwp-') ||
    slug.startsWith('ngp-') ||
    slug.includes('polytechnic') ||
    name.includes('polytechnic')
  );
};

export function CollegeGrid({ colleges }: CollegeGridProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [justCopiedId, setJustCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<CategoryType>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const gridTopRef = useRef<HTMLDivElement>(null);

  // Category counts
  const totalEngg = useMemo(() => colleges.filter((c) => !isPolytechnic(c)).length, [colleges]);
  const totalPoly = useMemo(() => colleges.filter((c) => isPolytechnic(c)).length, [colleges]);

  // Fast filtered colleges list
  const filteredColleges = useMemo(() => {
    const tokens = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);

    return colleges.filter((college) => {
      // 1. Category check
      if (category === 'ENGG' && isPolytechnic(college)) return false;
      if (category === 'POLY' && !isPolytechnic(college)) return false;

      // 2. Search query check against name, code, slug, address
      if (tokens.length === 0) return true;
      const target = `${college.name} ${college.code} ${college.slug} ${college.shortName || ''} ${college.address || ''}`.toLowerCase();
      return tokens.every((token) => target.includes(token));
    });
  }, [colleges, category, searchQuery]);

  // Pagination calculations
  const totalItems = filteredColleges.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const activePage = Math.min(currentPage, totalPages);

  const startIndex = (activePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const paginatedColleges = useMemo(() => {
    return filteredColleges.slice(startIndex, endIndex);
  }, [filteredColleges, startIndex, endIndex]);

  const handlePageChange = (newPage: number) => {
    const clampedPage = Math.max(1, Math.min(newPage, totalPages));
    setCurrentPage(clampedPage);
    if (gridTopRef.current) {
      gridTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    if (gridTopRef.current) {
      gridTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleCategoryChange = (newCat: CategoryType) => {
    setCategory(newCat);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setCategory('ALL');
    setCurrentPage(1);
  };

  const getPaginationRange = (): (number | '...')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | '...')[] = [];
    const showSet = new Set<number>();
    showSet.add(1);
    showSet.add(totalPages);
    showSet.add(activePage);
    if (activePage - 1 >= 1) showSet.add(activePage - 1);
    if (activePage + 1 <= totalPages) showSet.add(activePage + 1);
    if (activePage <= 3) {
      showSet.add(2);
      showSet.add(3);
      showSet.add(4);
    }
    if (activePage >= totalPages - 2) {
      showSet.add(totalPages - 1);
      showSet.add(totalPages - 2);
      showSet.add(totalPages - 3);
    }

    let prev = 0;
    for (let i = 1; i <= totalPages; i++) {
      if (showSet.has(i)) {
        if (prev && i - prev > 1) {
          pages.push('...');
        }
        pages.push(i);
        prev = i;
      }
    }
    return pages;
  };

  const handleShare = async (college: TenantContext) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const tenantUrl = `${origin}/${college.slug}`;

    // 1. Try Web Share API where available
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: college.name,
          text: `Open ${college.name} Feedback Portal`,
          url: tenantUrl,
        });
        return;
      } catch (err: unknown) {
        // If user cancelled / dismissed the native share dialog, don't show copy fallback
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
      }
    }

    // 2. Fallback: Copy to clipboard and trigger notification toast
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(tenantUrl);
        setJustCopiedId(college.collegeId);
        setToastMessage(`Link copied for ${college.shortName || college.name}`);

        setTimeout(() => setJustCopiedId(null), 2000);
        setTimeout(() => setToastMessage(null), 2500);
      } catch {
        setToastMessage('Could not copy link to clipboard');
        setTimeout(() => setToastMessage(null), 2500);
      }
    }
  };

  // Empty state when no active colleges exist at all
  if (!colleges || colleges.length === 0) {
    return (
      <div className="text-center py-16 px-4 max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400 border border-slate-200">
          <Building2 className="w-7 h-7" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">No college portals available</h3>
        <p className="text-sm text-slate-500 mt-1">Please check back later.</p>
      </div>
    );
  }

  return (
    <div ref={gridTopRef} className="space-y-6">
      {/* Top College Search in Official Exam Pad */}
      <ExamPadCard
        variant="dashboard"
        clipLabel="INSTITUTION SEARCH"
        title="Institutional Directory Search"
        subtitle="Search and filter government engineering colleges and polytechnic institutes across Bihar"
        icon={<Building2 className="w-5 h-5 text-amber-700 dark:text-amber-400" />}
        badge={`${totalItems} AVAILABLE`}
      >
        <div className="space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Real-time Search Box */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 dark:text-[#8c7453] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by college name, code (e.g. 108, GP-111), slug, district..."
                className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-[#140e07] border border-slate-300 dark:border-[#382710] rounded-[3px] text-xs sm:text-sm text-slate-900 dark:text-[#faebd0] placeholder-slate-400 dark:placeholder-[#8c7453] focus:bg-white dark:focus:bg-[#1f150c] focus:outline-hidden focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Result Count Badge */}
            <div className="text-xs font-semibold text-slate-600 dark:text-[#c4a97d] shrink-0 self-end sm:self-center px-1">
              {totalItems === 0 ? (
                <span>0 institutions found</span>
              ) : (
                <span>
                  Showing <span className="text-slate-900 dark:text-[#faebd0] font-bold">{startIndex + 1}–{endIndex}</span> of{' '}
                  <span className="text-slate-900 dark:text-[#faebd0] font-bold">{totalItems}</span>
                  {filteredColleges.length !== colleges.length && (
                    <span className="text-slate-400 dark:text-[#8c7453] font-normal"> (from {colleges.length})</span>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Quick Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80 dark:border-[#382710] text-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#c4a97d] mr-1 hidden sm:inline">
              Category:
            </span>
            <button
              type="button"
              onClick={() => handleCategoryChange('ALL')}
              className={`px-3 py-1.5 rounded-[3px] font-semibold transition-all text-xs flex items-center gap-1.5 cursor-pointer select-none ${
                category === 'ALL'
                  ? 'bg-slate-900 dark:bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-[#1f150c] text-slate-700 dark:text-[#c4a97d] hover:bg-slate-200 dark:hover:bg-[#2a1d10] border border-slate-200 dark:border-[#382710]'
              }`}
            >
              <span>All Institutions</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${category === 'ALL' ? 'bg-slate-700 dark:bg-amber-800 text-slate-200' : 'bg-slate-200 dark:bg-[#2e1f10] text-slate-600 dark:text-amber-300'}`}>
                {colleges.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleCategoryChange('ENGG')}
              className={`px-3 py-1.5 rounded-[3px] font-semibold transition-all text-xs flex items-center gap-1.5 cursor-pointer select-none ${
                category === 'ENGG'
                  ? 'bg-blue-600 dark:bg-blue-700 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-[#1f150c] text-slate-700 dark:text-[#c4a97d] hover:bg-slate-200 dark:hover:bg-[#2a1d10] border border-slate-200 dark:border-[#382710]'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Engineering</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${category === 'ENGG' ? 'bg-blue-700 dark:bg-blue-900 text-blue-100' : 'bg-slate-200 dark:bg-[#2e1f10] text-slate-600 dark:text-amber-300'}`}>
                {totalEngg}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleCategoryChange('POLY')}
              className={`px-3 py-1.5 rounded-[3px] font-semibold transition-all text-xs flex items-center gap-1.5 cursor-pointer select-none ${
                category === 'POLY'
                  ? 'bg-emerald-600 dark:bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-[#1f150c] text-slate-700 dark:text-[#c4a97d] hover:bg-slate-200 dark:hover:bg-[#2a1d10] border border-slate-200 dark:border-[#382710]'
              }`}
            >
              <School className="w-3.5 h-3.5" />
              <span>Polytechnic</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${category === 'POLY' ? 'bg-emerald-700 dark:bg-emerald-900 text-emerald-100' : 'bg-slate-200 dark:bg-[#2e1f10] text-slate-600 dark:text-amber-300'}`}>
                {totalPoly}
              </span>
            </button>

            {(searchQuery || category !== 'ALL') && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="ml-auto text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 hover:underline cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </ExamPadCard>

      {/* Large Rustic Green Chalkboard Notice Board Container */}
      <div className="relative border-8 sm:border-[12px] md:border-[14px] border-[#38210f] dark:border-[#201105] rounded-xl shadow-2xl p-4 sm:p-6 md:p-8 bg-[#143527] dark:bg-[#091a13] overflow-visible my-4">
        {/* Decorative Brass Corner Brackets */}
        <div className="absolute top-1 left-1 w-4 h-4 border-t-2 border-l-2 border-amber-400/80 pointer-events-none rounded-tl-xs" />
        <div className="absolute top-1 right-1 w-4 h-4 border-t-2 border-r-2 border-amber-400/80 pointer-events-none rounded-tr-xs" />
        <div className="absolute bottom-1 left-1 w-4 h-4 border-b-2 border-l-2 border-amber-400/80 pointer-events-none rounded-bl-xs" />
        <div className="absolute bottom-1 right-1 w-4 h-4 border-b-2 border-r-2 border-amber-400/80 pointer-events-none rounded-br-xs" />

        {/* Vintage Chalkboard Title Banner in Authentic Chalk Lettering */}
        <div className="text-center mb-6 sm:mb-8 pb-3 border-b border-emerald-800/40 dark:border-emerald-950/60 relative">
          <div className="inline-block px-3 py-0.5 rounded-[2px] bg-emerald-900/40 border border-emerald-700/30 text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.22em] text-amber-200/95 font-bold mb-1 shadow-2xs">
            DEPARTMENT OF SCIENCE, TECHNOLOGY &amp; TECHNICAL EDUCATION • BIHAR
          </div>
          <h2 className="text-base sm:text-xl md:text-2xl font-serif font-black tracking-wider text-emerald-50 dark:text-emerald-100 uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
            STATE INSTITUTIONAL NOTICE BOARD
          </h2>
          <p className="text-[11px] sm:text-xs text-emerald-200/80 font-mono tracking-wide mt-0.5">
            Official Registry of Government Engineering Colleges &amp; Polytechnics
          </p>
        </div>

        {/* Filtered Colleges Grid inside the Green Chalkboard */}
        {filteredColleges.length === 0 ? (
          <div className="bg-[#faf8f5]/95 dark:bg-[#1a1309]/95 rounded-[3px] border border-amber-900/30 dark:border-[#4d3817] p-8 sm:p-12 text-center max-w-md mx-auto shadow-lg relative pt-7">
            <RedPushpin className="-top-3" />
            <div className="w-12 h-12 rounded-[3px] bg-amber-100/60 dark:bg-[#25180c] border border-amber-200 dark:border-[#4d3817] flex items-center justify-center mx-auto mb-3 text-amber-800 dark:text-amber-400">
              <School className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-[#faebd0]">No institutions found</h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-[#c4a97d] mt-1">
              No college matched &ldquo;{searchQuery}&rdquo;. Try searching by name, code, slug, or district.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-[3px] shadow-xs transition-colors cursor-pointer"
            >
              Reset Search
            </button>
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {paginatedColleges.map((college) => {
                const isCopied = justCopiedId === college.collegeId;
                const isPoly = isPolytechnic(college);

                return (
                  <div
                    key={college.collegeId}
                    className="relative group bg-[#faf8f5] dark:bg-[#19120a] text-slate-900 dark:text-[#faebd0] border border-amber-900/25 dark:border-[#4d3817] rounded-[3px] p-3.5 sm:p-5 text-center flex flex-col shadow-md hover:shadow-xl transition-all duration-200 pt-6"
                  >
                    {/* Authentic 3D Red Pushpin Pinning the College Card */}
                    <RedPushpin className="-top-3" />

                    {/* College Logo or Fallback App Icon */}
                    <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2.5 sm:mb-4 rounded-[3px] bg-white dark:bg-[#25180c] border border-slate-200/80 dark:border-[#4d3817] flex items-center justify-center p-2 text-slate-700 overflow-hidden shrink-0 shadow-2xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          college.logo ||
                          resolveCollegeLogoUrl({
                            collegeCode: college.code,
                            collegeSlug: college.slug,
                            collegeName: college.name,
                          }) ||
                          '/icon-192.png'
                        }
                        alt={`${college.name} Logo`}
                        className="max-w-full max-h-full object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/icon-192.png';
                        }}
                      />
                    </div>

                    {/* College Name */}
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#faebd0] group-hover:text-amber-800 dark:group-hover:text-amber-300 transition-colors line-clamp-2 min-h-[2.5rem] flex items-center justify-center leading-snug">
                      {college.name}
                    </h2>

                    {/* Short Code & Type Badge */}
                    <div className="flex items-center justify-center gap-1.5 mt-1.5 mb-1.5 sm:mb-2">
                      <span
                        className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-[2px] border ${
                          isPoly
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60'
                            : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700/60'
                        }`}
                      >
                        {college.code}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-[#c4a97d]">
                        /{college.slug}
                      </span>
                    </div>

                    {/* Optional Location / City */}
                    {college.address && (
                      <p className="text-[11px] text-slate-600 dark:text-[#c4a97d] flex items-center justify-center gap-1 mb-2.5 sm:mb-4 truncate">
                        <MapPin className="w-3 h-3 text-slate-400 dark:text-[#8c7453] shrink-0" />
                        <span className="truncate">{college.address}</span>
                      </p>
                    )}

                    {/* Card Actions */}
                    <div className="mt-auto pt-2.5 sm:pt-4 border-t border-slate-200/80 dark:border-[#382710] flex items-center justify-between gap-2">
                      <Link
                        href={`/${college.slug}`}
                        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-bce-cobalt dark:text-amber-400 hover:text-bce-navy dark:hover:text-amber-300 transition-colors py-1 group/btn"
                      >
                        <span>Open Portal</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                      </Link>

                      <div className="flex items-center gap-1 shrink-0">
                        <Link
                          href={`/${college.slug}?install=true`}
                          className="p-1.5 sm:p-2 rounded-[3px] text-slate-500 dark:text-[#c4a97d] hover:text-bce-cobalt dark:hover:text-amber-400 hover:bg-slate-200/70 dark:hover:bg-[#25180c] transition-colors focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 group/pwa relative"
                          aria-label={`Install ${college.name} App (PWA)`}
                          title={`Install ${college.shortName || college.name} App (PWA)`}
                        >
                          <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        </Link>

                        <button
                          type="button"
                          onClick={() => handleShare(college)}
                          className="p-1.5 sm:p-2 rounded-[3px] text-slate-500 dark:text-[#c4a97d] hover:text-slate-800 dark:hover:text-[#faebd0] hover:bg-slate-200/70 dark:hover:bg-[#25180c] transition-colors focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
                          aria-label={`Share ${college.name} portal link`}
                          title={`Share ${college.name} Portal`}
                        >
                          {isCopied ? (
                            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Share2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Footer Controls pinned within the notice board */}
            {totalItems > 0 && (totalPages > 1 || colleges.length > 12) && (
              <div className="bg-[#faf8f5]/95 dark:bg-[#19120a]/95 rounded-[3px] border border-amber-900/30 dark:border-[#4d3817] p-3 sm:p-4 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 dark:text-[#c4a97d]">
                {/* Left: Summary + Per Page */}
                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                  <span className="text-slate-700 dark:text-[#c4a97d] text-xs">
                    Page <strong className="font-bold text-slate-900 dark:text-[#faebd0]">{activePage}</strong> of{' '}
                    <strong className="font-bold text-slate-900 dark:text-[#faebd0]">{totalPages}</strong>{' '}
                    <span className="text-slate-500 dark:text-[#8c7453]">({totalItems} {totalItems === 1 ? 'college' : 'colleges'})</span>
                  </span>

                  <div className="flex items-center gap-1.5 pl-2.5 border-l border-slate-300 dark:border-[#382710]">
                    <label htmlFor="collegePageSizeSelect" className="text-slate-500 dark:text-[#c4a97d] text-[11px] hidden sm:inline">
                      Per page:
                    </label>
                    <select
                      id="collegePageSizeSelect"
                      value={pageSize}
                      onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                      className="bg-white dark:bg-[#140e07] border border-slate-300 dark:border-[#382710] rounded-[3px] px-2.5 py-1 text-xs text-slate-900 dark:text-[#faebd0] font-semibold focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 cursor-pointer transition-colors"
                    >
                      {[12, 24, 36, 48].map((size) => (
                        <option key={size} value={size}>
                          {size} / page
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Right: Page Navigation */}
                {totalPages > 1 && (
                  <nav aria-label="Colleges pagination" className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center">
                    {/* First Page (Desktop) */}
                    <button
                      type="button"
                      onClick={() => handlePageChange(1)}
                      disabled={activePage <= 1}
                      className="hidden md:inline-flex items-center justify-center p-1.5 sm:p-2 rounded-[3px] border border-slate-300 dark:border-[#382710] bg-white dark:bg-[#140e07] text-slate-700 dark:text-[#c4a97d] hover:bg-slate-100 dark:hover:bg-[#20150b] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label="First page"
                      title="First page"
                    >
                      <ChevronsLeft className="w-3.5 h-3.5" />
                    </button>

                    {/* Previous Page */}
                    <button
                      type="button"
                      onClick={() => handlePageChange(activePage - 1)}
                      disabled={activePage <= 1}
                      className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-[3px] border border-slate-300 dark:border-[#382710] bg-white dark:bg-[#140e07] text-slate-700 dark:text-[#c4a97d] hover:bg-slate-100 dark:hover:bg-[#20150b] font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Prev</span>
                    </button>

                    {/* Page Number Buttons */}
                    <div className="flex items-center gap-1">
                      {getPaginationRange().map((p, idx) => {
                        if (p === '...') {
                          return (
                            <span key={`ellipsis-${idx}`} className="px-1.5 py-1 text-slate-400 dark:text-[#8c7453] font-medium select-none text-xs">
                              …
                            </span>
                          );
                        }
                        const pageNum = Number(p);
                        const isActive = pageNum === activePage;
                        return (
                          <button
                            key={pageNum}
                            type="button"
                            onClick={() => handlePageChange(pageNum)}
                            className={`min-w-[32px] h-8 rounded-[3px] text-xs font-bold transition-all cursor-pointer ${
                              isActive
                                ? 'bg-amber-600 dark:bg-amber-500 text-white shadow-xs'
                                : 'border border-slate-300 dark:border-[#382710] bg-white dark:bg-[#140e07] text-slate-700 dark:text-[#c4a97d] hover:bg-slate-100 dark:hover:bg-[#20150b]'
                            }`}
                            aria-label={`Page ${pageNum}`}
                            aria-current={isActive ? 'page' : undefined}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    {/* Next Page */}
                    <button
                      type="button"
                      onClick={() => handlePageChange(activePage + 1)}
                      disabled={activePage >= totalPages}
                      className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-[3px] border border-slate-300 dark:border-[#382710] bg-white dark:bg-[#140e07] text-slate-700 dark:text-[#c4a97d] hover:bg-slate-100 dark:hover:bg-[#20150b] font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label="Next page"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    {/* Last Page (Desktop) */}
                    <button
                      type="button"
                      onClick={() => handlePageChange(totalPages)}
                      disabled={activePage >= totalPages}
                      className="hidden md:inline-flex items-center justify-center p-1.5 sm:p-2 rounded-[3px] border border-slate-300 dark:border-[#382710] bg-white dark:bg-[#140e07] text-slate-700 dark:text-[#c4a97d] hover:bg-slate-100 dark:hover:bg-[#20150b] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label="Last page"
                      title="Last page"
                    >
                      <ChevronsRight className="w-3.5 h-3.5" />
                    </button>
                  </nav>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Clipboard Copy Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-[3px] bg-slate-900 text-white text-xs sm:text-sm font-medium shadow-xl border border-slate-700 animate-in fade-in slide-in-from-bottom-3"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

