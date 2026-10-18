'use client';

import { useSearchParams } from 'next/navigation';
import { useAppRouter as useRouter } from '@/lib/hooks/use-app-router';
import { Search, RotateCcw } from 'lucide-react';
import { AcademicYear, Branch, Semester } from '@/types/database';
import { useState, useTransition, useEffect, useCallback, useMemo } from 'react';
import { ExamPadCard } from '@/components/ui/ExamPadCard';
import { resolveAcademicLevel } from '@/lib/academic/level-utils';

interface Props {
  academicYears: AcademicYear[];
  branches: Branch[];
  semesters: Semester[];
  selectedYear: string;
  selectedBranch: string;
  selectedSemester: string;
  selectedStatus: string;
  initialSearch: string;
}

export function FormsFilterClient({
  academicYears,
  branches,
  semesters,
  selectedYear,
  selectedBranch,
  selectedSemester,
  selectedStatus,
  initialSearch,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(initialSearch);
  const [year, setYear] = useState(selectedYear);
  const [branch, setBranch] = useState(selectedBranch);
  const [semester, setSemester] = useState(selectedSemester);
  const [status, setStatus] = useState(selectedStatus);

  const activeBranches = useMemo(
    () => (branches || []).filter((b: Branch) => b.is_active).sort((a: Branch, b: Branch) => a.name.localeCompare(b.name)),
    [branches]
  );

  // Group semesters by programme (e.g. B.Tech, M.Tech) to eliminate duplicate ambiguity
  const { semesterGroups, hasMultipleProgrammes } = useMemo(() => {
    const groupsMap = new Map<string, { programmeName: string; title: string; items: Semester[] }>();

    for (const s of semesters || []) {
      const lvl = resolveAcademicLevel(s.programme?.name, s.name || s.display_name);
      const progName = s.programme?.name || lvl || 'General';
      const isPg = progName.toLowerCase().includes('m.tech') || progName.toLowerCase().includes('pg');
      const isDip = progName.toLowerCase().includes('diploma');
      const title = isDip
        ? `${progName} (Polytechnic / Diploma)`
        : isPg
        ? `${progName} (Postgraduate / 2-Year)`
        : `${progName} (Undergraduate / 4-Year)`;

      if (!groupsMap.has(progName)) {
        groupsMap.set(progName, { programmeName: progName, title, items: [] });
      }
      groupsMap.get(progName)!.items.push(s);
    }

    // Sort items inside each group by semester_number
    for (const group of groupsMap.values()) {
      group.items.sort((a, b) => {
        const aNum = a.semester_number ?? a.level_number ?? 0;
        const bNum = b.semester_number ?? b.level_number ?? 0;
        return aNum - bNum;
      });
    }

    const groups = Array.from(groupsMap.values());
    return {
      semesterGroups: groups,
      hasMultipleProgrammes: groups.length > 1,
    };
  }, [semesters]);

  const applyFilters = useCallback(
    (newParams: {
      year?: string;
      branch?: string;
      semester?: string;
      status?: string;
      search?: string;
    }) => {
      const params = new URLSearchParams(searchParams.toString());

      const finalYear = newParams.year !== undefined ? newParams.year : year;
      const finalBranch = newParams.branch !== undefined ? newParams.branch : branch;
      const finalSem = newParams.semester !== undefined ? newParams.semester : semester;
      const finalStatus = newParams.status !== undefined ? newParams.status : status;
      const finalSearch = newParams.search !== undefined ? newParams.search : search;

      if (finalYear && finalYear !== 'ALL') params.set('year', finalYear);
      else params.delete('year');

      if (finalBranch && finalBranch !== 'ALL') params.set('branch', finalBranch);
      else params.delete('branch');

      if (finalSem && finalSem !== 'ALL') params.set('semester', finalSem);
      else params.delete('semester');

      if (finalStatus && finalStatus !== 'ALL') params.set('status', finalStatus);
      else params.delete('status');

      if (finalSearch && finalSearch.trim()) params.set('search', finalSearch.trim());
      else params.delete('search');

      // Reset to page 1 on filter change
      params.delete('page');

      startTransition(() => {
        router.push(`/admin/dashboard/forms?${params.toString()}`);
      });
    },
    [searchParams, year, branch, semester, status, search, router]
  );

  // 300ms debounce for search to prevent database requests on every keystroke
  useEffect(() => {
    if (search === initialSearch) return;
    const timer = setTimeout(() => {
      applyFilters({ search });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, initialSearch, applyFilters]);

  const handleReset = () => {
    setSearch('');
    setYear('ALL');
    setBranch('ALL');
    setSemester('ALL');
    setStatus('ALL');
    startTransition(() => {
      router.push('/admin/dashboard/forms');
    });
  };

  return (
    <ExamPadCard variant="compact" clipLabel="CATALOG FILTERS">
      <div className="space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#c4a97d] mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 dark:text-[#8c7453] absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Faculty, subject, code..."
                className="w-full bg-slate-50 dark:bg-[#140e07] border border-slate-300 dark:border-[#382710] rounded-[3px] pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-[#faebd0] focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>

          {/* Academic Year */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#c4a97d] mb-1">
              Session
            </label>
            <select
              value={year}
              onChange={e => {
                setYear(e.target.value);
                applyFilters({ year: e.target.value });
              }}
              className="w-full bg-slate-50 dark:bg-[#140e07] border border-slate-300 dark:border-[#382710] rounded-[3px] px-3 py-2 text-xs text-slate-900 dark:text-[#faebd0] focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="ALL">All Academic Years</option>
              {academicYears.map(y => (
                <option key={y.id} value={y.id}>
                  {y.name} {y.is_active ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Branch / Discipline */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#c4a97d] mb-1">
              Branch / Discipline
            </label>
            <select
              value={branch}
              onChange={e => {
                setBranch(e.target.value);
                applyFilters({ branch: e.target.value });
              }}
              aria-label="Filter Branch / Discipline"
              className="w-full bg-slate-50 dark:bg-[#140e07] border border-slate-300 dark:border-[#382710] rounded-[3px] px-3 py-2 text-xs text-slate-900 dark:text-[#faebd0] focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="ALL">All Branches</option>
              {activeBranches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          {/* Semester */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#c4a97d] mb-1">
              Semester
            </label>
            <select
              value={semester}
              onChange={e => {
                setSemester(e.target.value);
                applyFilters({ semester: e.target.value });
              }}
              className="w-full bg-slate-50 dark:bg-[#140e07] border border-slate-300 dark:border-[#382710] rounded-[3px] px-3 py-2 text-xs text-slate-900 dark:text-[#faebd0] focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="ALL">All Semesters</option>
              {hasMultipleProgrammes ? (
                semesterGroups.map(group => (
                  <optgroup key={group.programmeName} label={group.title}>
                    {group.items.map(s => {
                      const semNum = s.semester_number ?? s.level_number;
                      let semLabel = s.name || '';
                      if (/^\d+$/.test(semLabel.trim())) {
                        semLabel = `Semester ${semLabel.trim()}`;
                      } else if (!/semester|sem|class|grade|year/i.test(semLabel) && semNum) {
                        semLabel = `${semLabel} (Sem ${semNum})`;
                      }
                      return (
                        <option key={s.id} value={s.id}>
                          {group.programmeName} — {semLabel}
                        </option>
                      );
                    })}
                  </optgroup>
                ))
              ) : (
                (semesters || []).map(s => {
                  const semNum = s.semester_number ?? s.level_number;
                  let semLabel = s.name || '';
                  if (/^\d+$/.test(semLabel.trim())) {
                    semLabel = `Semester ${semLabel.trim()}`;
                  } else if (!/semester|sem|class|grade|year/i.test(semLabel) && semNum) {
                    semLabel = `${semLabel} (Sem ${semNum})`;
                  }
                  return (
                    <option key={s.id} value={s.id}>
                      {semLabel}
                    </option>
                  );
                })
              )}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#c4a97d] mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={e => {
                setStatus(e.target.value);
                applyFilters({ status: e.target.value });
              }}
              className="w-full bg-slate-50 dark:bg-[#140e07] border border-slate-300 dark:border-[#382710] rounded-[3px] px-3 py-2 text-xs text-slate-900 dark:text-[#faebd0] focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="PUBLISHED">PUBLISHED</option>
              <option value="CLOSED">CLOSED</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </div>
        </div>

        {/* Reset Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs pt-2.5 border-t border-slate-200/80 dark:border-[#382710]">
          <span className="text-slate-400 dark:text-[#8c7453] text-[11px] sm:text-xs">
            {isPending ? 'Applying filters...' : 'Filter forms by session, branch, semester or lifecycle'}
          </span>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1 text-slate-500 dark:text-[#c4a97d] hover:text-slate-800 dark:hover:text-[#faebd0] font-semibold cursor-pointer self-end sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        </div>
      </div>
    </ExamPadCard>
  );
}
