'use client';

import React, { useState, useTransition, useCallback, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Sparkles,
  Search,
  Building2,
  Calendar,
  GraduationCap,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Layers,
  User,
  Clock,
  Lock,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import {
  PublicActiveFormsResult,
  getPublicActiveFormsAction,
} from '@/app/feedback/actions';
import { useHydrated, formatDateShort } from '@/lib/hooks/use-hydrated';
import { useStudentSession } from '@/lib/auth/use-student-session';
import {
  checkBatchStudentFormSubmissionsAction,
  checkStudentFormEligibilityAction,
} from '@/app/auth/student/actions';
import { RedPushpin } from '@/components/ui/RedPushpin';
import { ExamPadClip } from '@/components/ui/ExamPadCard';
import { resolveAcademicLevel } from '@/lib/academic/level-utils';

/** Forms per page — desktop shows a 3×2 grid */
const PAGE_SIZE = 6;

interface Props {
  initialData: PublicActiveFormsResult;
  collegeId?: string;
  /** Tenant slug, used to construct URL-state paths */
  tenantSlug?: string;
  /** Initial search term from URL (SSR) */
  initialSearch?: string;
}

/**
 * Generate an array of page numbers and '...' ellipsis markers for pagination.
 * Shows first, last, current and 1 neighbour on each side.
 */
function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | '...')[] = [];
  const showSet = new Set<number>();

  // Always show first and last
  showSet.add(1);
  showSet.add(total);

  // Current and neighbours
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    showSet.add(i);
  }

  const sorted = Array.from(showSet).sort((a, b) => a - b);

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      pages.push('...');
    }
    pages.push(sorted[i]);
  }

  return pages;
}

export function AllFeedbackFormsSection({ initialData, collegeId, tenantSlug, initialSearch = '' }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [data, setData] = useState<PublicActiveFormsResult>(initialData);
  const [search, setSearch] = useState(initialSearch);
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'B.Tech' | 'M.Tech'>('ALL');
  const [currentPage, setCurrentPage] = useState(initialData.page || 1);
  const [isPending, startTransition] = useTransition();
  const hydrated = useHydrated();

  // Academic level filtering & count calculation
  const filteredForms = React.useMemo(() => {
    if (levelFilter === 'ALL') return data.forms;
    return data.forms.filter(f => {
      const lvl = f.academicLevel || resolveAcademicLevel(null, `${f.title} ${f.branch} ${f.semester}`);
      return lvl === levelFilter;
    });
  }, [data.forms, levelFilter]);

  const { btechCount, mtechCount } = React.useMemo(() => {
    let btech = 0;
    let mtech = 0;
    (data.forms || []).forEach(f => {
      const lvl = f.academicLevel || resolveAcademicLevel(null, `${f.title} ${f.branch} ${f.semester}`);
      if (lvl === 'M.Tech') mtech++;
      else btech++;
    });
    return { btechCount: btech, mtechCount: mtech };
  }, [data.forms]);

  // Student auth session & submission tracking
  const { isAuthenticated, loading: sessionLoading } = useStudentSession();
  const [submittedFormIds, setSubmittedFormIds] = useState<Set<string>>(new Set());

  // Check submissions for displayed forms whenever forms or auth state change
  useEffect(() => {
    if (isAuthenticated && data.forms?.length) {
      const ids = data.forms.map((f) => f.id).filter(Boolean);
      checkBatchStudentFormSubmissionsAction(ids).then((res) => {
        if (res.submittedFormIds?.length) {
          setSubmittedFormIds(new Set(res.submittedFormIds));
        }
      });
    } else if (!isAuthenticated) {
      setSubmittedFormIds(new Set());
    }
  }, [isAuthenticated, data.forms]);

  const handleFormAction = async (form: any, e: React.MouseEvent) => {
    if (!isAuthenticated) {
      e.preventDefault();
      const returnUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : pathname;
      router.push(`/auth/student/login?redirect=${encodeURIComponent(returnUrl)}`);
      return;
    }

    const isAlreadySubmitted = submittedFormIds.has(form.id);
    if (isAlreadySubmitted) {
      e.preventDefault();
      const slug = tenantSlug || form.college?.slug || '';
      router.push(`/feedback/confirmation?formId=${form.id}${slug ? `&tenant=${slug}` : ''}`);
      return;
    }

    // Pre-flight check in case response was just synced to Google Sheets
    e.preventDefault();
    try {
      const elig = await checkStudentFormEligibilityAction(form.id);
      if (elig.alreadySubmitted) {
        setSubmittedFormIds((prev) => new Set([...prev, form.id]));
        const slug = tenantSlug || form.college?.slug || '';
        router.push(`/feedback/confirmation?formId=${form.id}${slug ? `&tenant=${slug}` : ''}`);
        return;
      }
    } catch {
      // non-fatal
    }

    if (form.googleFormUrl) {
      window.open(form.googleFormUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Debounce timer ref for search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Build a new URL preserving the current pathname but updating page/search params.
   * Omits page=1 and empty search for cleaner URLs.
   */
  const buildUrl = useCallback(
    (page: number, searchTerm: string) => {
      const params = new URLSearchParams();
      if (page > 1) params.set('page', String(page));
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname]
  );

  /**
   * Push URL state without full navigation — uses router.replace for shallow update.
   */
  const syncUrl = useCallback(
    (page: number, searchTerm: string) => {
      const url = buildUrl(page, searchTerm);
      router.replace(url, { scroll: false });
    },
    [buildUrl, router]
  );

  const handleSearchChange = (val: string) => {
    setSearch(val);

    // Debounce search requests to avoid spamming the server on fast typing
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    searchTimerRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await getPublicActiveFormsAction({
          page: 1,
          pageSize: PAGE_SIZE,
          search: val,
          collegeId,
        });
        if (res.success) {
          setData(res);
          setCurrentPage(1);
          syncUrl(1, val);
        }
      });
    }, 300);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > data.totalPages) return;
    startTransition(async () => {
      const res = await getPublicActiveFormsAction({
        page: newPage,
        pageSize: PAGE_SIZE,
        search,
        collegeId,
      });
      if (res.success) {
        // Clamp to valid page if backend returns fewer pages than requested
        const safePage = Math.min(newPage, res.totalPages || 1);
        setData(res);
        setCurrentPage(safePage);
        syncUrl(safePage, search);
      }
    });
  };

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  return (
    <section className="space-y-4 sm:space-y-6 pt-6 sm:pt-8 border-t border-slate-200/80 dark:border-amber-950/40">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="p-3 sm:p-4 rounded-2xl bg-white/85 dark:bg-[#18110b]/85 backdrop-blur-md border border-slate-200/80 dark:border-amber-950/70 shadow-xs max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 text-xs font-bold mb-1.5 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Open Submissions</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            All Feedback Forms
          </h2>
          <p className="text-xs text-slate-600 dark:text-amber-100/90 font-medium mt-0.5">
            Browse all currently active semester and faculty evaluations. Sorted recently published first.
          </p>
        </div>

        {/* Quick Search & Academic Level Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Level Filter Tabs: All / B.Tech / M.Tech */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/90 dark:bg-[#18110b]/95 border border-slate-200 dark:border-amber-950/70 shadow-xs">
            <button
              type="button"
              onClick={() => setLevelFilter('ALL')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                levelFilter === 'ALL'
                  ? 'bg-amber-700 text-white dark:bg-amber-500 dark:text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-amber-200/70 dark:hover:text-amber-100 hover:bg-slate-100 dark:hover:bg-amber-950/40'
              }`}
            >
              All ({data.forms.length})
            </button>
            <button
              type="button"
              onClick={() => setLevelFilter('B.Tech')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                levelFilter === 'B.Tech'
                  ? 'bg-blue-600 text-white dark:bg-blue-500 dark:text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-amber-200/70 dark:hover:text-amber-100 hover:bg-slate-100 dark:hover:bg-amber-950/40'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              B.Tech ({btechCount})
            </button>
            <button
              type="button"
              onClick={() => setLevelFilter('M.Tech')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                levelFilter === 'M.Tech'
                  ? 'bg-purple-600 text-white dark:bg-purple-500 dark:text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-amber-200/70 dark:hover:text-amber-100 hover:bg-slate-100 dark:hover:bg-amber-950/40'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              M.Tech ({mtechCount})
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 dark:text-amber-400/80 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search active forms..."
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 min-h-[38px] rounded-xl bg-white dark:bg-[#18110b]/95 border border-slate-200 dark:border-amber-950/70 focus:border-amber-500 dark:focus:border-amber-400 focus:ring-1 focus:ring-amber-500/20 text-base sm:text-xs text-slate-800 dark:text-amber-100 placeholder-slate-400 dark:placeholder-amber-200/40 shadow-xs outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* ExamPad Evaluation Clipboard with Vintage Metal Clip & Hardboard */}
      <div className="exam-pad-board-dashboard p-2 sm:p-3 md:p-4 pt-9 sm:pt-11 rounded-lg relative overflow-visible border-2 border-amber-950/60 dark:border-[#24160a] shadow-2xl">
        {/* Authentic Top Metal Exam Clip */}
        <ExamPadClip label="EVALUATION FORMS" size="default" />

        {/* Brass corner brackets */}
        <div className="absolute top-1.5 left-1.5 w-3 h-3 border-t-2 border-l-2 border-amber-500/80 pointer-events-none rounded-tl-xs" />
        <div className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 border-amber-500/80 pointer-events-none rounded-tr-xs" />
        <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b-2 border-l-2 border-amber-500/80 pointer-events-none rounded-bl-xs" />
        <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b-2 border-r-2 border-amber-500/80 pointer-events-none rounded-br-xs" />

        {/* Clipboard Surface Area */}
        <div className="rounded-[4px] p-2 sm:p-4 md:p-6 min-h-[360px]">
          {isPending ? (
            <div className="py-16 text-center text-slate-700 dark:text-[#faebd0]">
              <Loader2 className="w-8 h-8 animate-spin text-amber-600 dark:text-amber-400 mx-auto mb-2" />
              <p className="text-xs text-slate-600 dark:text-[#c4a97d] font-medium">Updating evaluation ledger...</p>
            </div>
          ) : filteredForms.length === 0 ? (
            <div className="bg-[#fffdfa] dark:bg-[#1a1208] rounded-[3px] border border-amber-900/30 dark:border-[#422e17] p-8 sm:p-12 text-center shadow-lg max-w-md mx-auto my-6 text-slate-800 dark:text-[#faebd0]">
              <div className="w-12 h-12 rounded-[2px] bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto mb-3 border border-amber-500/30">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#faebd0]">No Published Forms Found</h3>
              <p className="text-xs text-slate-600 dark:text-[#c4a97d] max-w-sm mx-auto mt-1">
                {search || levelFilter !== 'ALL'
                  ? `No feedback forms match your filter (${levelFilter !== 'ALL' ? levelFilter : ''}${search ? ` search "${search}"` : ''}).`
                  : 'There are currently no active feedback forms published for open submission.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 pt-6 sm:pt-7 pb-2">
              {filteredForms.map((form, index) => {
                const isSemester = form.formType === 'SEMESTER_FEEDBACK';
                const academicLevel =
                  form.academicLevel ||
                  resolveAcademicLevel(null, `${form.title} ${form.branch} ${form.semester}`);

                const rotations = ['-0.85deg', '0.75deg', '-0.5deg', '0.9deg', '-0.7deg', '0.6deg'];
                const delays = ['0s', '1.2s', '0.6s', '1.8s', '0.9s', '1.5s'];
                const durations = ['5.4s', '6.2s', '5.8s', '6.5s', '5.3s', '6.0s'];

                const rot = rotations[index % rotations.length];
                const delay = delays[index % delays.length];
                const dur = durations[index % durations.length];

                return (
                  <div
                    key={form.id}
                    style={{
                      ['--notice-rot' as any]: rot,
                      ['--notice-delay' as any]: delay,
                      ['--notice-dur' as any]: dur,
                    }}
                    className="notice-paper-card relative rounded-[2px] p-3.5 sm:p-5 flex flex-col justify-between group transition-all cursor-default overflow-visible"
                  >
                    {/* Realistic 3D Red Pushpin */}
                    <RedPushpin />

                    {/* Subtle Top Paper Pin Hole shadow */}
                    <div className="w-2.5 h-1 bg-black/35 dark:bg-black/60 rounded-full mx-auto -mt-1 mb-2 blur-[0.4px]" />

                    <div className="space-y-2.5 sm:space-y-3.5">
                      {/* Card Badges */}
                      <div className="flex items-center justify-between gap-1.5 pt-1 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-[3px] text-[10px] font-bold ${
                              isSemester
                                ? 'bg-purple-50 dark:bg-[#382612] text-purple-700 dark:text-amber-300 border border-purple-200 dark:border-[#6e4b1e]'
                                : 'bg-blue-50 dark:bg-[#332210] text-blue-700 dark:text-amber-300 border border-blue-200 dark:border-[#69461b]'
                            }`}
                          >
                            {isSemester ? 'Semester Feedback' : 'Faculty Feedback'}
                          </span>

                          {/* Academic Level Badge: B.Tech / M.Tech */}
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-[3px] text-[10px] font-extrabold uppercase tracking-wide border shadow-2xs ${
                              academicLevel === 'M.Tech'
                                ? 'bg-purple-100 text-purple-900 dark:bg-[#2b1733] dark:text-[#f0abfc] border-purple-300 dark:border-[#701a75]'
                                : 'bg-blue-100 text-blue-900 dark:bg-[#152a42] dark:text-[#93c5fd] border-blue-300 dark:border-[#1d4ed8]'
                            }`}
                          >
                            {academicLevel}
                          </span>
                        </div>

                        <span className="inline-flex items-center gap-1 text-[10.5px] sm:text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-[#1a2c17] px-2 py-0.5 rounded-[3px] border border-emerald-200 dark:border-[#35582b]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Active
                        </span>
                      </div>

                      {/* Form Title */}
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-[#f8ecd2] text-sm group-hover:text-indigo-600 dark:group-hover:text-amber-300 transition-colors line-clamp-2">
                          {form.title}
                        </h3>
                      </div>

                      {/* Academic Metadata Pills */}
                      <div className="space-y-1.5 sm:space-y-2 text-xs text-slate-600 dark:text-[#c4a97d] border-t border-slate-200/80 dark:border-[#423218] pt-2.5 sm:pt-3">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 dark:text-[#a88f63] text-[10.5px] sm:text-[11px] flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-[#d4af37]" />
                            Branch / Dept
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-[#fef3c7]">{form.branch}</span>
                        </div>

                        {/* Academic Level (B.Tech / M.Tech) */}
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 dark:text-[#a88f63] text-[10.5px] sm:text-[11px] flex items-center gap-1.5">
                            <GraduationCap className="w-3.5 h-3.5 text-slate-400 dark:text-[#d4af37]" />
                            Academic Level
                          </span>
                          <span
                            className={`font-bold px-2 py-0.5 rounded-[3px] text-[11px] border ${
                              academicLevel === 'M.Tech'
                                ? 'bg-purple-50 text-purple-900 dark:bg-[#2b1733] dark:text-[#f0abfc] border-purple-200 dark:border-[#701a75]'
                                : 'bg-blue-50 text-blue-900 dark:bg-[#152a42] dark:text-[#93c5fd] border-blue-200 dark:border-[#1d4ed8]'
                            }`}
                          >
                            {academicLevel}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 dark:text-[#a88f63] text-[10.5px] sm:text-[11px] flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-slate-400 dark:text-[#d4af37]" />
                            Semester Level
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-[#fef3c7]">{form.semester}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 dark:text-[#a88f63] text-[10.5px] sm:text-[11px] flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-[#d4af37]" />
                            Session
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-[#fef3c7]">{form.academicYear}</span>
                        </div>

                        <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-100 dark:border-[#382a13]">
                          <span className="text-slate-400 dark:text-[#a88f63] text-[10.5px] sm:text-[11px] flex items-center gap-1.5 shrink-0 mt-0.5">
                            <User className="w-3.5 h-3.5 text-slate-400 dark:text-[#d4af37]" />
                            Evaluation Target
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-[#fef3c7] text-right text-[10.5px] sm:text-[11px] line-clamp-2">
                            {form.facultySubjectDisplay}
                          </span>
                        </div>

                        {form.publishedAt && (
                          <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-[#a88f63] pt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400 dark:text-[#d4af37]" />
                              Published
                            </span>
                            <span>
                              {formatDateShort(form.publishedAt, hydrated)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Action */}
                    <div className="pt-3 sm:pt-4 mt-2.5 sm:mt-3 border-t border-slate-200/80 dark:border-[#423218]">
                      {!isAuthenticated && !sessionLoading ? (
                        <button
                          type="button"
                          onClick={(e) => handleFormAction(form, e)}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 sm:py-2.5 rounded-[4px] bg-slate-900 hover:bg-slate-800 dark:bg-[#332311] dark:hover:bg-[#432f17] text-white dark:text-amber-100 dark:border dark:border-amber-700/60 font-bold text-xs transition-all shadow-xs group-hover:shadow-md cursor-pointer"
                        >
                          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Sign In to Start Feedback</span>
                        </button>
                      ) : submittedFormIds.has(form.id) ? (
                        <button
                          type="button"
                          onClick={(e) => handleFormAction(form, e)}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 sm:py-2.5 rounded-[4px] bg-emerald-50 hover:bg-emerald-100 dark:bg-[#1a2d1d] dark:hover:bg-[#233f27] text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700/60 font-bold text-xs transition-all shadow-xs cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Already Submitted — View Receipt</span>
                        </button>
                      ) : form.googleFormUrl ? (
                        <button
                          type="button"
                          onClick={(e) => handleFormAction(form, e)}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 sm:py-2.5 rounded-[4px] bg-bce-navy hover:bg-slate-800 dark:bg-gradient-to-r dark:from-[#b45309] dark:to-[#d97706] dark:hover:from-[#c25e0a] dark:hover:to-[#e68310] text-white dark:text-amber-50 dark:border dark:border-amber-400/50 font-bold text-xs transition-all shadow-xs group-hover:shadow-md cursor-pointer"
                        >
                          <span>Start Feedback</span>
                          <ExternalLink className="w-3.5 h-3.5 text-amber-400 dark:text-amber-200 shrink-0" />
                        </button>
                      ) : (
                        <button
                          disabled
                          className="w-full px-4 py-2 sm:py-2.5 rounded-[4px] bg-slate-100 dark:bg-[#20170a] text-slate-400 dark:text-amber-900/80 text-xs font-medium cursor-not-allowed text-center"
                        >
                          Form URL Unavailable
                        </button>
                      )}
                    </div>

                    {/* Paper Dog-Ear Crease Effect on Bottom Right */}
                    <div
                      className="absolute bottom-0 right-0 w-3 h-3 pointer-events-none overflow-hidden"
                      aria-hidden="true"
                    >
                      <div className="absolute bottom-0 right-0 w-4 h-4 bg-black/10 dark:bg-black/50 rotate-45 translate-x-2 translate-y-2 border-t border-l border-black/10 dark:border-amber-500/20" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Pagination Bar */}
      {data.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 p-3 sm:p-4 bg-white dark:bg-[#18110b]/90 rounded-2xl border border-slate-200 dark:border-amber-950/70 shadow-lg text-xs text-slate-600 dark:text-amber-100 backdrop-blur-md text-center sm:text-left">
          <div>
            Showing Page <span className="font-bold text-slate-900 dark:text-white">{currentPage}</span> of{' '}
            <span className="font-bold text-slate-900 dark:text-white">{data.totalPages}</span> ({data.totalCount} active forms)
          </div>

          <div className="flex items-center gap-1.5">
            {/* Previous Button */}
            <button
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || isPending}
              className="inline-flex items-center gap-1 px-2.5 py-2 sm:py-1.5 rounded-lg border border-slate-200 dark:border-amber-950/70 hover:bg-slate-50 dark:hover:bg-[#251a11] text-slate-700 dark:text-amber-200 font-semibold disabled:opacity-30 transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Prev</span>
            </button>

            {/* Page Number Buttons */}
            {getPageNumbers(currentPage, data.totalPages).map((item, idx) =>
              item === '...' ? (
                <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 select-none">
                  …
                </span>
              ) : (
                <button
                  key={`page-${item}`}
                  type="button"
                  onClick={() => handlePageChange(item as number)}
                  disabled={isPending}
                  className={`min-w-[32px] h-8 sm:h-7 px-2 rounded-lg text-xs font-bold transition-all ${
                    currentPage === item
                      ? 'bg-amber-600 dark:bg-amber-500 text-slate-950 font-black shadow-sm border border-amber-600 dark:border-amber-400'
                      : 'border border-slate-200 dark:border-amber-950/70 text-slate-700 dark:text-amber-200 hover:bg-slate-100 dark:hover:bg-[#251a11]'
                  } disabled:opacity-40`}
                  aria-label={`Go to page ${item}`}
                  aria-current={currentPage === item ? 'page' : undefined}
                >
                  {item}
                </button>
              )
            )}

            {/* Next Button */}
            <button
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= data.totalPages || isPending}
              className="inline-flex items-center gap-1 px-2.5 py-2 sm:py-1.5 rounded-lg border border-slate-200 dark:border-amber-950/70 hover:bg-slate-50 dark:hover:bg-[#251a11] text-slate-700 dark:text-amber-200 font-semibold disabled:opacity-30 transition-colors"
              aria-label="Next page"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
