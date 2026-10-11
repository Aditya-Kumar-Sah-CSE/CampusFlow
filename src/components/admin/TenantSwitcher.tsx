'use client';

import { useState, useTransition, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { setActiveCollegeAction } from '@/lib/auth/tenant-actions';
import type { AdminCollegeMembership } from '@/types/auth';
import {
  Building2,
  ChevronDown,
  Check,
  Loader2,
  Search,
  X,
  School,
  GraduationCap,
} from 'lucide-react';

interface TenantSwitcherProps {
  colleges: AdminCollegeMembership[];
  activeCollegeId: string | null;
  isPlatformSuperAdmin: boolean;
}

type CategoryFilter = 'ALL' | 'ENGG' | 'POLY';

const isPolytechnic = (col: { code?: string; slug?: string; name?: string }): boolean => {
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

export function TenantSwitcher({
  colleges,
  activeCollegeId,
  isPlatformSuperAdmin,
}: TenantSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input when dropdown opens, reset search on close
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setSearchQuery('');
      setCategoryFilter('ALL');
    }
  }, [isOpen]);

  // College Admins are LOCKED to their institution — never show switcher dropdown
  if (!isPlatformSuperAdmin) {
    const singleCollege = colleges.find((c) => c.collegeId === activeCollegeId) || colleges[0];
    if (!singleCollege) return null;
    return (
      <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-xs">
        <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="font-semibold text-white truncate max-w-[65px] xs:max-w-[120px] sm:max-w-none">{singleCollege.name}</span>
        <span className="text-[10px] text-slate-400 font-mono hidden xs:inline">({singleCollege.code})</span>
      </div>
    );
  }

  const activeCollege = colleges.find((c) => c.collegeId === activeCollegeId) || colleges[0];

  // Category counts
  const totalEngg = useMemo(() => colleges.filter((c) => !isPolytechnic(c)).length, [colleges]);
  const totalPoly = useMemo(() => colleges.filter((c) => isPolytechnic(c)).length, [colleges]);

  // Filtered colleges by search query (name, code, slug) and category
  const filteredColleges = useMemo(() => {
    const tokens = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);

    return colleges.filter((col) => {
      // 1. Category filter
      if (categoryFilter === 'ENGG' && isPolytechnic(col)) return false;
      if (categoryFilter === 'POLY' && !isPolytechnic(col)) return false;

      // 2. Search tokens match against name, code, slug
      if (tokens.length === 0) return true;
      const target = `${col.name} ${col.code} ${col.slug}`.toLowerCase();
      return tokens.every((token) => target.includes(token));
    });
  }, [colleges, categoryFilter, searchQuery]);

  const handleSelectCollege = (collegeId: string) => {
    if (collegeId === activeCollegeId) {
      setIsOpen(false);
      return;
    }

    startTransition(async () => {
      const res = await setActiveCollegeAction(collegeId);
      if (res.success) {
        setIsOpen(false);
        // Post message to Service Worker to invalidate tenant-specific cached state
        if (typeof window !== 'undefined') {
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'FMS_TENANT_SWITCH' });
          }
          // Small tick allows service worker message event to start cache purge before page reloads
          setTimeout(() => {
            window.location.reload();
          }, 150);
        } else {
          router.refresh();
        }
      } else {
        alert(res.error || 'Failed to switch institution.');
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter' && filteredColleges.length > 0) {
      e.preventDefault();
      handleSelectCollege(filteredColleges[0].collegeId);
    }
  };

  return (
    <div className="relative inline-block text-left z-50 shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        suppressHydrationWarning
        className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-white text-xs border border-amber-500/40 shadow-xs transition-colors focus:outline-hidden focus:ring-2 focus:ring-amber-400"
        title="Switch Active Institution"
      >
        <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <div className="flex flex-col text-left max-w-[80px] xs:max-w-[110px] sm:max-w-[220px]">
          <span className="font-semibold text-white truncate text-xs hidden sm:inline">
            {activeCollege ? activeCollege.name : 'Select Institution'}
          </span>
          <span className="font-semibold text-white truncate text-xs sm:hidden">
            {activeCollege ? activeCollege.code : 'Switch'}
          </span>
          {activeCollege && (
            <span className="text-[9px] sm:text-[10px] text-amber-300 font-mono truncate">
              {activeCollege.code}
            </span>
          )}
        </div>
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
        ) : (
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="origin-top-right absolute right-0 mt-2 w-80 xs:w-96 rounded-xl shadow-2xl bg-slate-800 border border-slate-700 focus:outline-hidden z-50 py-1.5 divide-y divide-slate-700/60 animate-in fade-in zoom-in-95 duration-100">
            {/* 1. Header with Super Admin Tag & Total Count */}
            <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Authorized Institutions</span>
              </span>
              {isPlatformSuperAdmin && (
                <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded font-normal">
                  Super Admin ({colleges.length})
                </span>
              )}
            </div>

            {/* 2. Fast Search Input Bar */}
            <div className="p-2 bg-slate-850">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search by name, code, slug..."
                  className="w-full pl-8 pr-7 py-1.5 bg-slate-900 border border-slate-700/90 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all font-sans"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Category Quick Filter Pills */}
              <div className="flex items-center gap-1 mt-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('ALL')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                    categoryFilter === 'ALL'
                      ? 'bg-amber-400 text-slate-950 font-semibold shadow-xs'
                      : 'bg-slate-750 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  All ({colleges.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('ENGG')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1 ${
                    categoryFilter === 'ENGG'
                      ? 'bg-blue-500 text-white font-semibold shadow-xs'
                      : 'bg-slate-750 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  <GraduationCap className="w-3 h-3" />
                  <span>Engg ({totalEngg})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('POLY')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1 ${
                    categoryFilter === 'POLY'
                      ? 'bg-emerald-500 text-white font-semibold shadow-xs'
                      : 'bg-slate-750 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  <School className="w-3 h-3" />
                  <span>Polytechnic ({totalPoly})</span>
                </button>
              </div>

              {/* Status / Results Count */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5 mt-1.5">
                <span>
                  {filteredColleges.length === colleges.length
                    ? `${colleges.length} institutions available`
                    : `Showing ${filteredColleges.length} of ${colleges.length}`}
                </span>
                {searchQuery && (
                  <span className="text-amber-300 font-mono text-[9px]">
                    Press Enter to select
                  </span>
                )}
              </div>
            </div>

            {/* 3. Filtered Institutions List */}
            <div className="py-1 max-h-72 overflow-y-auto divide-y divide-slate-750 scrollbar-thin">
              {filteredColleges.length === 0 ? (
                <div className="py-7 px-4 text-center">
                  <School className="w-7 h-7 text-slate-500 mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-slate-300 font-semibold">No institutions found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    No match for &ldquo;{searchQuery}&rdquo;
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setCategoryFilter('ALL');
                    }}
                    className="mt-2.5 text-xs text-amber-400 hover:text-amber-300 font-medium underline"
                  >
                    Clear Search Filters
                  </button>
                </div>
              ) : (
                filteredColleges.map((col) => {
                  const isActive = col.collegeId === activeCollegeId;
                  const isPoly = isPolytechnic(col);

                  return (
                    <button
                      key={col.collegeId}
                      type="button"
                      suppressHydrationWarning
                      onClick={() => handleSelectCollege(col.collegeId)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-700/80 transition-colors ${
                        isActive ? 'bg-slate-700/60 text-amber-300 font-medium' : 'text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        {col.logoUrl ? (
                          <div className="w-6 h-6 rounded-md bg-white border border-slate-600/60 p-0.5 flex items-center justify-center shrink-0 overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={col.logoUrl} alt="" className="max-w-full max-h-full object-contain" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-md bg-slate-750 border border-slate-700 flex items-center justify-center shrink-0 text-slate-400">
                            <School className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium">{col.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className={`text-[9px] font-mono px-1 py-0.2 rounded font-semibold ${
                                isPoly
                                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/40'
                                  : 'bg-blue-950/80 text-blue-300 border border-blue-700/40'
                              }`}
                            >
                              {col.code}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono truncate">
                              /{col.slug}
                            </span>
                          </div>
                        </div>
                      </div>
                      {isActive && (
                        <Check className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* 4. Bottom Action — Manage Institutions */}
            {isPlatformSuperAdmin && (
              <div className="pt-1 border-t border-slate-700/60 bg-slate-900/60 rounded-b-xl">
                <Link
                  href="/admin/institutions"
                  onClick={() => setIsOpen(false)}
                  className="w-full text-left px-3 py-2 text-xs flex items-center justify-between text-amber-300 hover:bg-slate-700/80 hover:text-amber-200 transition-colors font-medium rounded-b-xl"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Manage All Institutions</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 -rotate-90 text-amber-400/80 shrink-0" />
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

