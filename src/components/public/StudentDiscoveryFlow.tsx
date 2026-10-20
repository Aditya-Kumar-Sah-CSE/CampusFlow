'use client';

import { useState, useEffect, useTransition, useMemo, useRef } from 'react';
import {
  AcademicYear,
  Branch,
  Semester,
  Faculty,
  Subject,
} from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import {
  getPublicFacultiesForSelectionAction,
  getPublicSubjectsForFacultyAction,
  getPublicFeedbackFormAction,
  getPublicSemesterFeedbackFormAction,
  getActiveBranchesAction,
  searchPublicFormsComprehensiveAction,
  PublicFormSearchResult,
  PublicFormSummary,
} from '@/app/feedback/actions';
import { PublicFeedbackCard } from '@/components/public/PublicFeedbackCard';
import { RedPushpin } from '@/components/ui/RedPushpin';
import { ExamPadClip } from '@/components/ui/ExamPadCard';
import { PaperRollEndCap } from '@/components/ui/PaperRollEndCap';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useStudentSession } from '@/lib/auth/use-student-session';
import { checkStudentFormEligibilityAction } from '@/app/auth/student/actions';
import { resolveAcademicLevel } from '@/lib/academic/level-utils';
import {
  Calendar,
  Layers,
  GraduationCap,
  BookOpen,
  User,
  AlertCircle,
  Loader2,
  Sparkles,
  RotateCcw,
  Info,
  ExternalLink,
  Users,
  Lock,
  CheckCircle2,
  Scroll,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Filter,
} from 'lucide-react';


interface Props {
  academicYears: AcademicYear[];
  branches: Branch[];
  semesters: Semester[];
  collegeId?: string;
}

export function StudentDiscoveryFlow({
  academicYears,
  branches,
  semesters,
  collegeId,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, loading: sessionLoading } = useStudentSession();
  const [semesterFormSubmitted, setSemesterFormSubmitted] = useState<boolean>(false);

  // Realistic 3D Paper Scroll state machine: rolled -> unrolling -> unrolled -> rolling
  type ScrollState = 'rolled' | 'unrolling' | 'unrolled' | 'rolling';
  const [scrollState, setScrollState] = useState<ScrollState>('rolled');
  const unrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const rollupTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup animation timers on unmount
  useEffect(() => {
    return () => {
      if (unrollTimerRef.current) clearTimeout(unrollTimerRef.current);
      if (rollupTimerRef.current) clearTimeout(rollupTimerRef.current);
    };
  }, []);

  const handleUnroll = () => {
    if (scrollState !== 'rolled') return;
    if (rollupTimerRef.current) clearTimeout(rollupTimerRef.current);
    setScrollState('unrolling');
    unrollTimerRef.current = setTimeout(() => {
      setScrollState('unrolled');
    }, 720);
  };

  const handleRollUp = () => {
    if (scrollState !== 'unrolled') return;
    if (unrollTimerRef.current) clearTimeout(unrollTimerRef.current);
    setScrollState('rolling');
    rollupTimerRef.current = setTimeout(() => {
      setScrollState('rolled');
    }, 600);
  };

  // Instant Live Search Feedback Form State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [allPublishedForms, setAllPublishedForms] = useState<PublicFormSearchResult[]>([]);
  const [loadingSearchForms, setLoadingSearchForms] = useState<boolean>(false);

  // Dynamic fetch of active published forms for instant client-side search
  useEffect(() => {
    let isMounted = true;
    setLoadingSearchForms(true);
    searchPublicFormsComprehensiveAction({ collegeId, limit: 100 })
      .then((res) => {
        if (isMounted && res.success && res.forms) {
          setAllPublishedForms(res.forms);
        }
      })
      .catch((err) => {
        console.error('[DYNAMIC_SEARCH_FORMS_FETCH]', err);
      })
      .finally(() => {
        if (isMounted) setLoadingSearchForms(false);
      });

    return () => {
      isMounted = false;
    };
  }, [collegeId]);

  // Realtime instant search results matching across title, faculty, subject, code, branch, sem
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const tokens = q.split(/\s+/).filter(Boolean);
    return allPublishedForms.filter((f) => {
      const combined = `${f.title} ${f.facultySubjectDisplay} ${f.branch} ${f.branchCode} ${f.semester} ${f.academicYear} ${f.academicLevel}`.toLowerCase();
      return tokens.every((token) => combined.includes(token));
    });
  }, [searchQuery, allPublishedForms]);

  // 1-Click Direct Form Action from Search Card
  const handleDirectFormAction = async (form: PublicFormSearchResult, e: React.MouseEvent) => {
    e.preventDefault();
    if (!isAuthenticated && !sessionLoading) {
      const returnUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : pathname;
      router.push(`/auth/student/login?redirect=${encodeURIComponent(returnUrl)}`);
      return;
    }

    try {
      const elig = await checkStudentFormEligibilityAction(form.id);
      if (elig.alreadySubmitted) {
        router.push(`/feedback/confirmation?formId=${form.id}`);
        return;
      }
    } catch {}

    if (form.googleFormUrl) {
      window.open(form.googleFormUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // 1-Click Auto-Populate Cascading Filters from Search Card
  const handleSelectFormInFilters = (form: PublicFormSearchResult) => {
    if (form.academicYearId) setSelectedYearId(form.academicYearId);
    if (form.branchId) setSelectedBranchId(form.branchId);
    if (form.semesterId) setSelectedSemesterId(form.semesterId);
    if (form.facultyId) setSelectedFacultyId(form.facultyId);
    if (form.subjectId) setSelectedSubjectId(form.subjectId);
    setSearchQuery('');
  };


  // Dynamic branches state initialized from server props, refreshed dynamically and live via Realtime
  const [branchList, setBranchList] = useState<Branch[]>(branches);
  const [loadingBranches, setLoadingBranches] = useState<boolean>(false);

  // Active branches dynamically filtered & sorted alphabetically
  const activeBranches = useMemo(
    () => branchList.filter(b => b.is_active).sort((a, b) => a.name.localeCompare(b.name)),
    [branchList]
  );

  // Dynamic fetch of active branches on mount
  useEffect(() => {
    let isMounted = true;
    setLoadingBranches(true);
    getActiveBranchesAction(collegeId)
      .then(res => {
        if (isMounted && res.success && res.branches) {
          setBranchList(res.branches);
        }
      })
      .catch(err => {
        console.error('[DYNAMIC_BRANCHES_FETCH]', err);
      })
      .finally(() => {
        if (isMounted) setLoadingBranches(false);
      });

    return () => {
      isMounted = false;
    };
  }, [collegeId]);

  // Supabase Realtime subscription for dynamic branch changes
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('public:branches-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'branches' },
        () => {
          getActiveBranchesAction(collegeId).then(res => {
            if (res.success && res.branches) {
              setBranchList(res.branches);
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [collegeId]);

  // Cascading selections - Branch starts unselected (empty) so user sees "Select Branch / Discipline"
  const [selectedYearId, setSelectedYearId] = useState<string>(
    academicYears.find(y => y.is_active)?.id || academicYears[0]?.id || ''
  );
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>(
    semesters.find(s => s.is_active)?.id || semesters[0]?.id || ''
  );
  const [selectedProgrammeFilter, setSelectedProgrammeFilter] = useState<string>('ALL');

  // Reset cascading selections and state when collegeId or master props change
  useEffect(() => {
    setBranchList(branches);
    setSelectedYearId(academicYears.find(y => y.is_active)?.id || academicYears[0]?.id || '');
    setSelectedBranchId('');
    setSelectedSemesterId(semesters.find(s => s.is_active)?.id || semesters[0]?.id || '');
    setSelectedFacultyId('');
    setSelectedSubjectId('');
    setMatchedForm(null);
    setSemesterFormResult(null);
  }, [collegeId, branches, academicYears, semesters]);

  // If currently selected branch was deactivated, reset selection to empty
  useEffect(() => {
    if (selectedBranchId && !activeBranches.some(b => b.id === selectedBranchId)) {
      setSelectedBranchId('');
    }
  }, [activeBranches, selectedBranchId]);
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

  // Dynamically loaded cohorts
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [matchedForm, setMatchedForm] = useState<PublicFormSummary | null>(null);
  const [formStatus, setFormStatus] = useState<'PUBLISHED' | 'CLOSED' | 'NONE'>('NONE');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Loading states
  const [loadingFaculties, setLoadingFaculties] = useState<boolean>(false);
  const [loadingSubjects, setLoadingSubjects] = useState<boolean>(false);
  const [loadingForm, setLoadingForm] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  // Semester form state
  const [semesterFormResult, setSemesterFormResult] = useState<{
    form: PublicFormSummary | null;
    status: 'PUBLISHED' | 'CLOSED' | 'NONE';
    itemsCount?: number;
    message: string;
  } | null>(null);

  // 1. Fetch faculties & semester form when Year + Branch + Semester change
  useEffect(() => {
    if (!selectedYearId || !selectedBranchId || !selectedSemesterId) {
      setFaculties([]);
      setSelectedFacultyId('');
      setSubjects([]);
      setSelectedSubjectId('');
      setMatchedForm(null);
      setSemesterFormResult(null);
      return;
    }

    let isMounted = true;
    setLoadingFaculties(true);
    setSelectedFacultyId('');
    setSubjects([]);
    setSelectedSubjectId('');
    setMatchedForm(null);
    setSemesterFormResult(null);

    // Fetch semester form if available
    getPublicSemesterFeedbackFormAction(selectedYearId, selectedBranchId, selectedSemesterId, collegeId).then(res => {
      if (isMounted) {
        if (res.success && res.form && res.status === 'PUBLISHED') {
          setSemesterFormResult(res);
          if (isAuthenticated && res.form.id) {
            checkStudentFormEligibilityAction(res.form.id).then((elig) => {
              if (isMounted && elig.alreadySubmitted) {
                setSemesterFormSubmitted(true);
              }
            }).catch(() => {});
          }
        } else {
          setSemesterFormResult(null);
          setSemesterFormSubmitted(false);
        }
      }
    });

    startTransition(async () => {
      try {
        const res = await getPublicFacultiesForSelectionAction(
          selectedYearId,
          selectedBranchId,
          selectedSemesterId,
          collegeId
        );

        if (isMounted) {
          setLoadingFaculties(false);
          if (res.success) {
            setFaculties(res.faculties);
          } else {
            setFaculties([]);
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('not found') || msg.includes('Server Action')) {
          if (typeof window !== 'undefined') {
            window.location.reload();
            return;
          }
        }
        if (isMounted) {
          setLoadingFaculties(false);
          setFaculties([]);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedYearId, selectedBranchId, selectedSemesterId, collegeId]);

  // 2. Fetch subjects when Faculty changes
  useEffect(() => {
    if (!selectedYearId || !selectedBranchId || !selectedSemesterId || !selectedFacultyId) {
      setSubjects([]);
      setSelectedSubjectId('');
      setMatchedForm(null);
      return;
    }

    let isMounted = true;
    setLoadingSubjects(true);
    setSelectedSubjectId('');
    setMatchedForm(null);

    startTransition(async () => {
      try {
        const res = await getPublicSubjectsForFacultyAction(
          selectedYearId,
          selectedBranchId,
          selectedSemesterId,
          selectedFacultyId,
          collegeId
        );

        if (isMounted) {
          setLoadingSubjects(false);
          if (res.success) {
            setSubjects(res.subjects);
          } else {
            setSubjects([]);
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('not found') || msg.includes('Server Action')) {
          if (typeof window !== 'undefined') {
            window.location.reload();
            return;
          }
        }
        if (isMounted) {
          setLoadingSubjects(false);
          setSubjects([]);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedYearId, selectedBranchId, selectedSemesterId, selectedFacultyId, collegeId]);

  // 3. Fetch Feedback Form when Subject is selected
  useEffect(() => {
    if (
      !selectedYearId ||
      !selectedBranchId ||
      !selectedSemesterId ||
      !selectedFacultyId ||
      !selectedSubjectId
    ) {
      setMatchedForm(null);
      setFormStatus('NONE');
      return;
    }

    let isMounted = true;
    setLoadingForm(true);

    startTransition(async () => {
      try {
        const res = await getPublicFeedbackFormAction(
          selectedYearId,
          selectedBranchId,
          selectedSemesterId,
          selectedFacultyId,
          selectedSubjectId,
          collegeId
        );

        if (isMounted) {
          setLoadingForm(false);
          if (res.success) {
            setMatchedForm(res.form);
            setFormStatus(res.status);
            setStatusMessage(res.message);
          } else {
            setMatchedForm(null);
            setFormStatus('NONE');
            setStatusMessage(res.message || 'Unable to check feedback form.');
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('not found') || msg.includes('Server Action')) {
          if (typeof window !== 'undefined') {
            window.location.reload();
            return;
          }
        }
        if (isMounted) {
          setLoadingForm(false);
          setMatchedForm(null);
          setFormStatus('NONE');
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [
    selectedYearId,
    selectedBranchId,
    selectedSemesterId,
    selectedFacultyId,
    selectedSubjectId,
    collegeId,
  ]);

  const handleReset = () => {
    setSearchQuery('');
    setSelectedBranchId('');
    setSelectedFacultyId('');
    setSelectedSubjectId('');
    setMatchedForm(null);
    setFormStatus('NONE');
    setSemesterFormResult(null);
  };

  const selectedYear = academicYears.find(y => y.id === selectedYearId);
  const selectedBranch = branchList.find(b => b.id === selectedBranchId);
  const selectedSemester = semesters.find(s => s.id === selectedSemesterId);
  const selectedFaculty = faculties.find(f => f.id === selectedFacultyId);
  const selectedSubject = subjects.find(s => s.id === selectedSubjectId);

  // Group semesters by Programme for clear disambiguation (e.g. B.Tech vs M.Tech)
  const { semesterGroups, hasMultipleProgrammes, programmeNames } = useMemo(() => {
    const progMap = new Map<string, { title: string; programmeName: string; items: Semester[] }>();

    semesters.forEach(s => {
      const resolvedLvl = resolveAcademicLevel(s.programme?.name, s.name);
      const progName = s.programme?.name || resolvedLvl || 'B.Tech';
      const progType = s.programme?.programme_type;
      const typeLabel =
        progType === 'UNDERGRADUATE'
          ? 'Undergraduate'
          : progType === 'POSTGRADUATE'
          ? 'Postgraduate'
          : progType === 'DIPLOMA'
          ? 'Diploma'
          : progType === 'SCHOOL'
          ? 'School'
          : resolvedLvl === 'M.Tech'
          ? 'Postgraduate'
          : 'Undergraduate';
      const title = `${progName} (${typeLabel})`;

      if (!progMap.has(progName)) {
        progMap.set(progName, { title, programmeName: progName, items: [] });
      }
      progMap.get(progName)!.items.push(s);
    });

    const groups = Array.from(progMap.values());
    const distinctProgs = Array.from(progMap.keys());

    return {
      semesterGroups: groups,
      hasMultipleProgrammes: groups.length > 1,
      programmeNames: distinctProgs,
    };
  }, [semesters]);

  const selectedSemesterLabel = useMemo(() => {
    if (!selectedSemester) return '';
    const resolvedLvl = resolveAcademicLevel(selectedSemester.programme?.name, selectedSemester.name);
    const progPrefix = selectedSemester.programme?.name ? `${selectedSemester.programme.name} — ` : `${resolvedLvl} — `;
    const semNum = selectedSemester.semester_number ?? selectedSemester.level_number;
    const semPart = semNum ? `${selectedSemester.name} (Sem ${semNum})` : selectedSemester.name;
    return `${progPrefix}${semPart}`;
  }, [selectedSemester]);

  const isSheetActive = scrollState === 'unrolled' || scrollState === 'unrolling' || scrollState === 'rolling';

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Search Feedback Form ExamPad Clipboard with Vintage Metal Clip & Hardboard */}
      <div
        className={`exam-pad-board-dashboard p-1.5 sm:p-2.5 md:p-3 ${
          isSheetActive ? 'pt-7 sm:pt-8 md:pt-9' : 'pt-6 sm:pt-7'
        } rounded-lg relative overflow-visible border-2 border-amber-950/60 dark:border-[#24160a] shadow-2xl scroll-mt-28 transition-all duration-300`}
      >
        {/* Authentic Top Metal Exam Clip */}
        <ExamPadClip label="SEARCH FEEDBACK FORM" size={isSheetActive ? 'default' : 'compact'} />

        {/* Brass corner brackets */}
        <div className="absolute top-1.5 left-1.5 w-3 h-3 border-t-2 border-l-2 border-amber-500/80 pointer-events-none rounded-tl-xs" />
        <div className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 border-amber-500/80 pointer-events-none rounded-tr-xs" />
        <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b-2 border-l-2 border-amber-500/80 pointer-events-none rounded-bl-xs" />
        <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b-2 border-r-2 border-amber-500/80 pointer-events-none rounded-br-xs" />

        {/* 3D ROLLED PAPER SCROLL (DEFAULT WRAPPED STATE) */}
        {scrollState === 'rolled' && (
          <div
            role="button"
            tabIndex={0}
            onClick={handleUnroll}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleUnroll();
              }
            }}
            aria-label="Unroll search feedback form"
            className="group paper-scroll-cylinder animate-cylinder-in rounded-full py-1.5 sm:py-2 px-1.5 sm:px-2.5 flex items-center justify-between gap-1 sm:gap-2 cursor-pointer border border-[#8f744e]/60 dark:border-[#52391b] select-none transition-all duration-200 active:scale-[0.99] focus:outline-hidden focus:ring-2 focus:ring-amber-500/60"
          >
            {/* Left Curled Spiral Paper End Cap */}
            <PaperRollEndCap side="left" />

            {/* Center Scroll Body: Information & Badges */}
            <div className="flex-1 min-w-0 px-1 sm:px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span className="p-1 rounded-full bg-amber-500/15 dark:bg-amber-400/15 text-amber-700 dark:text-amber-400 shrink-0">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-[#f8ecd2] truncate tracking-tight">
                    Search Feedback Form
                  </h4>
                  <span className="hidden xs:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100/90 dark:bg-[#382613] text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700/50">
                    📜 Rolled Scroll
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-600 dark:text-[#c4a97d] truncate mt-0.5">
                  {selectedBranch || selectedFaculty || selectedSubject
                    ? `Selected: ${selectedBranch?.name || ''} ${selectedFaculty ? `• ${selectedFaculty.name}` : ''}`
                    : 'Search by teacher, subject, course code, or department — or roll down to browse'}
                </p>
              </div>

              {/* 3D Unroll Call-To-Action Button with Subtle Pulse */}
              <div className="shrink-0 flex items-center gap-1 self-end sm:self-auto">
                <span className="animate-scroll-cta inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white dark:from-[#d4af37] dark:to-[#bfa136] dark:text-[#1c1308] shadow-sm transition-all group-hover:scale-105">
                  <Scroll className="w-3.5 h-3.5" />
                  <span>Unroll Form</span>
                  <ChevronDown className="w-3.5 h-3.5 transition-transform group-hover:translate-y-0.5" />
                </span>
              </div>
            </div>

            {/* Right Curled Spiral Paper End Cap */}
            <PaperRollEndCap side="right" />
          </div>
        )}

        {/* 3D UNROLLED PAPER SHEET (EXPANDED STATE WITH SMOOTH TWO-WAY ROLLING TRANSITION) */}
        {isSheetActive && (
          <div className="paper-unroll-perspective">
            <div
              className={`paper-unrolled-sheet relative rounded-[3px] p-3 sm:p-4 md:p-4.5 bg-[#fffdfa] dark:bg-[#1a1208] border border-amber-900/30 dark:border-[#4d381c] shadow-[0_2px_8px_rgba(0,0,0,0.12)] space-y-3 text-slate-800 dark:text-[#faebd0] ${
                scrollState === 'unrolling'
                  ? 'animate-paper-unroll-wavefront overflow-hidden'
                  : scrollState === 'rolling'
                  ? 'animate-paper-rollup-wavefront overflow-hidden'
                  : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 sm:pb-2.5 border-b border-slate-200/80 dark:border-[#423218]">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-[#f8ecd2] flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-amber-600 dark:text-[#d4af37]" />
                    Search Feedback Form
                  </h4>
                  <p className="text-[10px] sm:text-xs text-slate-600 dark:text-[#c4a97d] mt-0.5">
                    Quickly search feedback forms by teacher, subject, course code, or department — or filter below.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
                  {(searchQuery || selectedBranchId || selectedFacultyId || selectedSubjectId) && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[3px] text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-amber-50/80 hover:bg-amber-100/90 dark:bg-[#342613] dark:hover:bg-[#433119] dark:text-amber-200 border border-[#dfd7be] dark:border-amber-700/50 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3 text-slate-500 dark:text-amber-400" />
                      <span>Reset</span>
                    </button>
                  )}

                  {/* Wrap / Roll Up Button with realistic smooth reverse transition */}
                  <button
                    type="button"
                    onClick={handleRollUp}
                    disabled={scrollState !== 'unrolled'}
                    title="Roll up paper smoothly into 3D scroll"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[3px] text-[11px] font-bold text-amber-900 dark:text-amber-200 bg-amber-100/90 hover:bg-amber-200/90 dark:bg-[#3d2a13] dark:hover:bg-[#4d3618] border border-amber-300 dark:border-amber-700/60 shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <Scroll className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span>Wrap ▴</span>
                  </button>
                </div>
              </div>

              {/* Modern High-Speed Live Search Bar */}
              <div className="relative">
                <div className="relative flex items-center">
                  <Search className="absolute left-3 w-4 h-4 text-amber-700 dark:text-[#d4af37] pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Type teacher name, subject (e.g. DBMS, CS301), branch (e.g. CSE), or semester..."
                    className="w-full pl-9 pr-20 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold rounded-[4px] bg-[#fbf8f0] dark:bg-[#23180c] border border-[#cfc09f] dark:border-[#523b1b] text-slate-900 dark:text-[#faebd0] placeholder:text-slate-400 dark:placeholder:text-[#a0855c] focus:outline-hidden focus:ring-2 focus:ring-amber-500/50 focus:border-amber-600 dark:focus:border-amber-500 shadow-inner transition-all"
                  />
                  <div className="absolute right-2.5 flex items-center gap-1">
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        aria-label="Clear search"
                        className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:text-[#c4a97d] dark:hover:text-[#faebd0] transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {searchQuery && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/50">
                        {searchResults.length} found
                      </span>
                    )}
                  </div>
                </div>

                {/* Live Search Results (Rendered when user types a search query) */}
                {searchQuery.trim() && (
                  <div className="mt-2.5 space-y-2 p-2.5 rounded-[4px] bg-[#f7f2e4] dark:bg-[#1f150a] border border-[#d6c7a7] dark:border-[#4d381c]">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-[#d6be8c] px-1">
                      <span>Matching Feedback Forms ({searchResults.length})</span>
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="text-[10px] text-amber-700 dark:text-amber-400 hover:underline font-semibold cursor-pointer"
                      >
                        Close search results
                      </button>
                    </div>

                    {searchResults.length === 0 ? (
                      <div className="py-4 text-center space-y-1">
                        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mx-auto" />
                        <p className="text-xs font-semibold text-slate-800 dark:text-[#faebd0]">
                          No active forms found matching &quot;{searchQuery}&quot;
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-[#a0855c]">
                          Try searching by teacher surname, course code (e.g. CS301), or department, or browse using the filters below.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-1">
                        {searchResults.map((form) => (
                          <div
                            key={form.id}
                            className="p-2.5 rounded-[4px] bg-white dark:bg-[#160f06] border border-[#dfd5be] dark:border-[#3d2a13] hover:border-amber-500 dark:hover:border-amber-600/70 shadow-2xs transition-all space-y-1.5 flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1 flex-wrap">
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-[2px] bg-amber-100 dark:bg-[#342410] text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700/40">
                                  {form.formType === 'SEMESTER_FEEDBACK' ? 'All-in-One Form' : 'Course Evaluation'}
                                </span>
                                <span className="text-[9px] font-semibold text-slate-500 dark:text-[#a0855c]">
                                  {form.branchCode} • {form.semester}
                                </span>
                              </div>
                              <h5 className="text-xs font-bold text-slate-900 dark:text-[#faebd0] line-clamp-1 mt-1">
                                {form.title}
                              </h5>
                              <p className="text-[10px] text-slate-600 dark:text-[#c4a97d] line-clamp-1">
                                {form.facultySubjectDisplay}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-[#2a1d0d]">
                              {form.googleFormUrl && (
                                <button
                                  type="button"
                                  onClick={(e) => handleDirectFormAction(form, e)}
                                  className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded-[3px] text-[10px] font-bold bg-amber-600 hover:bg-amber-500 text-white dark:bg-[#d4af37] dark:hover:bg-[#e6c148] dark:text-slate-950 shadow-2xs transition-colors cursor-pointer"
                                >
                                  {!isAuthenticated && !sessionLoading ? (
                                    <>
                                      <Lock className="w-2.5 h-2.5" />
                                      <span>Sign In to Start</span>
                                    </>
                                  ) : (
                                    <>
                                      <span>Start Form</span>
                                      <ExternalLink className="w-2.5 h-2.5" />
                                    </>
                                  )}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleSelectFormInFilters(form)}
                                title="Load this form in academic selectors below"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-[3px] text-[10px] font-semibold text-slate-700 dark:text-amber-200 bg-amber-50 hover:bg-amber-100 dark:bg-[#2b1e0d] dark:hover:bg-[#3d2a13] border border-amber-200 dark:border-amber-700/50 transition-colors cursor-pointer"
                              >
                                <CheckCircle2 className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                                <span>Select in Filters</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Divider to Academic Selectors */}
              <div className="flex items-center gap-2 pt-1 pb-0.5">
                <div className="h-px bg-slate-200/90 dark:bg-[#3d2c14] flex-1" />
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#a88f63] flex items-center gap-1.5">
                  <Filter className="w-3 h-3 text-amber-600 dark:text-[#d4af37]" />
                  <span>Or Filter Step-by-Step by Academic Details</span>
                </span>
                <div className="h-px bg-slate-200/90 dark:bg-[#3d2c14] flex-1" />
              </div>

              {/* Tier 1: Academic Year + Branch + Semester */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                {/* Step 1: Academic Year */}
                <div>
                  <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#d6be8c] mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-[#d4af37] shrink-0" />
                    1. Academic Session
                  </label>
                  <select
                    value={selectedYearId}
                    onChange={e => setSelectedYearId(e.target.value)}
                    className="paper-select w-full min-h-[38px] sm:min-h-[40px] px-3 py-1.5 text-xs font-semibold cursor-pen"
                  >
                    {academicYears.map(y => (
                      <option key={y.id} value={y.id}>
                        {y.name} {y.is_active ? '(Active Session)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step 2: Branch */}
                <div>
                  <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#d6be8c] mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-600 dark:text-[#d4af37] shrink-0" />
                      2. Branch / Discipline
                    </span>
                    {loadingBranches && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 dark:text-[#d4af37]" />}
                  </label>
                  <select
                    value={selectedBranchId}
                    onChange={e => setSelectedBranchId(e.target.value)}
                    aria-label="Branch / Discipline"
                    disabled={activeBranches.length === 0 && !loadingBranches}
                    className="paper-select w-full min-h-[38px] sm:min-h-[40px] px-3 py-1.5 text-xs font-semibold cursor-pen disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="">Select Branch / Discipline</option>
                    {loadingBranches && activeBranches.length === 0 ? (
                      <option value="" disabled>
                        Loading branches...
                      </option>
                    ) : activeBranches.length === 0 ? (
                      <option value="" disabled>
                        No active branches available
                      </option>
                    ) : (
                      activeBranches.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Step 3: Semester */}
                <div>
                  <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                    <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#d6be8c] flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-amber-600 dark:text-[#d4af37] shrink-0" />
                      3. Academic Level & Semester
                    </label>
                    {hasMultipleProgrammes && (
                      <div className="flex items-center gap-0.5 bg-[#ede4ce] dark:bg-[#2e2110] p-0.5 rounded-[3px] border border-[#d6cbb1] dark:border-[#523c1c]">
                        <button
                          type="button"
                          onClick={() => setSelectedProgrammeFilter('ALL')}
                          className={`px-1.5 py-0.5 rounded-[2px] font-bold text-[9px] tracking-wide transition-all ${
                            selectedProgrammeFilter === 'ALL'
                              ? 'bg-amber-800 text-white dark:bg-[#d4af37] dark:text-[#1c1409] shadow-2xs'
                              : 'text-slate-700 hover:text-slate-900 dark:text-[#c4a97d] dark:hover:text-[#faebd0]'
                          }`}
                        >
                          All
                        </button>
                        {programmeNames.map(prog => (
                          <button
                            key={prog}
                            type="button"
                            onClick={() => {
                              setSelectedProgrammeFilter(prog);
                              const firstSem = semesters.find(s => {
                                const lvl = resolveAcademicLevel(s.programme?.name, s.name);
                                return (s.programme?.name || lvl) === prog;
                              });
                              if (firstSem && selectedSemesterId !== firstSem.id) {
                                setSelectedSemesterId(firstSem.id);
                              }
                            }}
                            className={`px-1.5 py-0.5 rounded-[2px] font-bold text-[9px] tracking-wide transition-all ${
                              selectedProgrammeFilter === prog
                                ? 'bg-amber-800 text-white dark:bg-[#d4af37] dark:text-[#1c1409] shadow-2xs'
                                : 'text-slate-700 hover:text-slate-900 dark:text-[#c4a97d] dark:hover:text-[#faebd0]'
                            }`}
                          >
                            {prog}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <select
                    value={selectedSemesterId}
                    onChange={e => {
                      setSelectedSemesterId(e.target.value);
                      const picked = semesters.find(s => s.id === e.target.value);
                      const pickedLvl = resolveAcademicLevel(picked?.programme?.name, picked?.name);
                      const progName = picked?.programme?.name || pickedLvl;
                      if (progName && selectedProgrammeFilter !== 'ALL' && selectedProgrammeFilter !== progName) {
                        setSelectedProgrammeFilter(progName);
                      }
                    }}
                    className="paper-select w-full min-h-[38px] sm:min-h-[40px] px-3 py-1.5 text-xs font-semibold cursor-pen"
                  >
                    {selectedProgrammeFilter === 'ALL' && hasMultipleProgrammes ? (
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
                      semesters
                        .filter(s => {
                          const lvl = resolveAcademicLevel(s.programme?.name, s.name);
                          return selectedProgrammeFilter === 'ALL' || (s.programme?.name || lvl) === selectedProgrammeFilter;
                        })
                        .map(s => {
                          const semNum = s.semester_number ?? s.level_number;
                          const lvl = resolveAcademicLevel(s.programme?.name, s.name);
                          const progPrefix = hasMultipleProgrammes ? (s.programme?.name ? `${s.programme.name} — ` : `${lvl} — `) : '';
                          let semLabel = s.name || '';
                          if (/^\d+$/.test(semLabel.trim())) {
                            semLabel = `Semester ${semLabel.trim()}`;
                          } else if (!/semester|sem|class|grade|year/i.test(semLabel) && semNum) {
                            semLabel = `${semLabel} (Sem ${semNum})`;
                          }
                          return (
                            <option key={s.id} value={s.id}>
                              {progPrefix}{semLabel}
                            </option>
                          );
                        })
                    )}
                  </select>
                </div>
              </div>

              {/* Prominent Banner for Official Semester Feedback Form */}
              {semesterFormResult && semesterFormResult.status === 'PUBLISHED' && semesterFormResult.form && (
                <div className="p-2.5 sm:p-3.5 rounded-[3px] bg-gradient-to-r from-bce-navy via-slate-900 to-indigo-950 dark:from-[#362512] dark:via-[#2b1c0b] dark:to-[#1f1406] text-white shadow-md border border-indigo-500/30 dark:border-amber-600/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-[2px] text-[9px] font-bold bg-amber-400 text-slate-950 uppercase tracking-wider">
                        Official All-in-One Form
                      </span>
                      {semesterFormResult.itemsCount ? (
                        <span className="text-blue-200 dark:text-amber-200 text-[11px] font-semibold flex items-center gap-1">
                          <Users className="w-3 h-3 text-amber-400" />
                          {semesterFormResult.itemsCount} Teachers Evaluated
                        </span>
                      ) : null}
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-white dark:text-[#faebd0]">
                      Official Semester Feedback Form Available — Includes All Subjects & Teachers
                    </h3>
                    <p className="text-[11px] text-slate-300 dark:text-[#c4a97d] max-w-xl">
                      Students of {selectedBranch?.name} ({selectedSemesterLabel || selectedSemester?.name}) can rate all course faculty in a single form.
                    </p>
                  </div>

                  {!isAuthenticated && !sessionLoading ? (
                    <button
                      type="button"
                      onClick={() => {
                        const returnUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : pathname;
                        router.push(`/auth/student/login?redirect=${encodeURIComponent(returnUrl)}`);
                      }}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-[#3d2a13] dark:hover:bg-[#4d3619] text-white dark:text-amber-100 font-bold text-xs rounded-[4px] transition-all shadow-md shrink-0 active:scale-95 cursor-pointer border border-slate-700 dark:border-amber-600/50"
                    >
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Sign In to Start Feedback</span>
                    </button>
                  ) : semesterFormSubmitted && semesterFormResult?.form ? (
                    <Link
                      href={`/feedback/confirmation?formId=${semesterFormResult.form.id}`}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs rounded-[4px] transition-all shadow-md shrink-0 active:scale-95"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />
                      <span>Already Submitted — View Receipt</span>
                    </Link>
                  ) : semesterFormResult?.form?.google_form_url ? (
                    <button
                      type="button"
                      onClick={async () => {
                        const targetForm = semesterFormResult?.form;
                        if (!targetForm) return;
                        try {
                          const elig = await checkStudentFormEligibilityAction(targetForm.id);
                          if (elig.alreadySubmitted) {
                            setSemesterFormSubmitted(true);
                            router.push(`/feedback/confirmation?formId=${targetForm.id}`);
                            return;
                          }
                        } catch {}
                        if (targetForm.google_form_url) {
                          window.open(targetForm.google_form_url, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs rounded-[4px] transition-all shadow-md shrink-0 active:scale-95 cursor-pointer border border-amber-600/30"
                    >
                      <span>Start Feedback</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>
              )}

              {/* Tier 2: Faculty & Subject Cascading Filters */}
              <div className="pt-2 sm:pt-2.5 border-t border-slate-200/80 dark:border-[#423218] space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-[#d6be8c] flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-600 dark:text-[#d4af37]" />
                    {semesterFormResult && semesterFormResult.status === 'PUBLISHED' && semesterFormResult.form
                      ? 'Or evaluate an individual faculty member & subject:'
                      : 'Individual Faculty Member & Course Evaluation:'}
                  </span>
                  <div className="h-px bg-slate-200/80 dark:bg-[#423218] flex-1" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {/* Step 4: Faculty Selector */}
                  <div>
                    <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#d6be8c] mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-amber-600 dark:text-[#d4af37] shrink-0" />
                        4. Select Faculty Member
                      </span>
                      {loadingFaculties && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 dark:text-[#d4af37]" />}
                    </label>

                    {!selectedBranchId ? (
                      <div className="min-h-[38px] sm:min-h-[40px] rounded-[2px] bg-[#f9f6ed] dark:bg-[#1a1309] border border-[#dfd7be] dark:border-[#4d3817] flex items-center px-3 text-xs text-slate-500 dark:text-[#a88f63] font-medium">
                        Please select your Branch / Discipline above
                      </div>
                    ) : loadingFaculties ? (
                      <div className="min-h-[38px] sm:min-h-[40px] rounded-[2px] bg-[#f9f6ed] dark:bg-[#1a1309] border border-[#dfd7be] dark:border-[#4d3817] flex items-center px-3 text-xs text-slate-500 dark:text-[#a88f63]">
                        Loading assigned faculties...
                      </div>
                    ) : faculties.length === 0 ? (
                      <div className="p-2.5 bg-amber-50/80 dark:bg-[#2b1f0e] border border-amber-200/80 dark:border-amber-700/60 rounded-[2px] text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>No faculty assignments found for {selectedBranch?.name}, {selectedSemesterLabel || selectedSemester?.name}.</span>
                      </div>
                    ) : (
                      <select
                        value={selectedFacultyId}
                        onChange={e => setSelectedFacultyId(e.target.value)}
                        className="paper-select w-full min-h-[38px] sm:min-h-[40px] px-3 py-1.5 text-xs font-semibold cursor-pen"
                      >
                        <option value="">-- Choose Faculty Member ({faculties.length} available) --</option>
                        {faculties.map(f => (
                          <option key={f.id} value={f.id}>
                            {f.name} ({f.designation || f.department || 'Faculty'})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Step 5: Subject Selector */}
                  <div>
                    <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#d6be8c] mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-[#d4af37] shrink-0" />
                        5. Select Course Subject
                      </span>
                      {loadingSubjects && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 dark:text-[#d4af37]" />}
                    </label>

                    {!selectedFacultyId ? (
                      <div className="min-h-[38px] sm:min-h-[40px] rounded-[2px] bg-[#f9f6ed] dark:bg-[#1a1309] border border-[#dfd7be] dark:border-[#4d3817] flex items-center px-3 text-xs text-slate-500 dark:text-[#a88f63]">
                        Please select a faculty member first
                      </div>
                    ) : loadingSubjects ? (
                      <div className="min-h-[38px] sm:min-h-[40px] rounded-[2px] bg-[#f9f6ed] dark:bg-[#1a1309] border border-[#dfd7be] dark:border-[#4d3817] flex items-center px-3 text-xs text-slate-500 dark:text-[#a88f63]">
                        Loading subjects taught by {selectedFaculty?.name}...
                      </div>
                    ) : subjects.length === 0 ? (
                      <div className="p-2.5 bg-amber-50/80 dark:bg-[#2b1f0e] border border-amber-200/80 dark:border-amber-700/60 rounded-[2px] text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>No subjects mapped to {selectedFaculty?.name} in this semester.</span>
                      </div>
                    ) : (
                      <select
                        value={selectedSubjectId}
                        onChange={e => setSelectedSubjectId(e.target.value)}
                        className="paper-select w-full min-h-[38px] sm:min-h-[40px] px-3 py-1.5 text-xs font-semibold cursor-pen"
                      >
                        <option value="">-- Choose Subject ({subjects.length} available) --</option>
                        {subjects.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} {s.code ? `(${s.code})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* Active Rolling Cylinder that rolls round and round during unrolling & rolling */}
              {(scrollState === 'unrolling' || scrollState === 'rolling') && (
                <div className="paper-roll-active-roller" aria-hidden="true">
                  <PaperRollEndCap
                    side="left"
                    spinDirection={scrollState === 'unrolling' ? 'forward' : 'reverse'}
                  />
                  <div
                    className={`flex-1 paper-roll-active-roller-body ${
                      scrollState === 'unrolling' ? 'animate-roller-spin-down' : 'animate-roller-spin-up'
                    }`}
                  />
                  <PaperRollEndCap
                    side="right"
                    spinDirection={scrollState === 'unrolling' ? 'forward' : 'reverse'}
                  />
                </div>
              )}

              {/* Resting bottom curl when fully unrolled */}
              {scrollState === 'unrolled' && (
                <div className="paper-scroll-bottom-curl" aria-hidden="true" />
              )}

              {/* Paper Dog-Ear Crease Effect on Bottom Right */}
              <div
                className="absolute bottom-0 right-0 w-3.5 h-3.5 pointer-events-none overflow-hidden"
                aria-hidden="true"
              >
                <div className="absolute bottom-0 right-0 w-5 h-5 bg-black/10 dark:bg-black/50 rotate-45 translate-x-2.5 translate-y-2.5 border-t border-l border-black/10 dark:border-amber-500/20" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Individual Form Results Area (Rendered dynamically when active or searching) */}
      {(loadingForm || matchedForm || (selectedSubjectId && !matchedForm)) && (
        <div className="space-y-3 sm:space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {loadingForm ? (
            <div className="p-6 sm:p-10 bg-white dark:bg-[#111724] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs text-center space-y-3">
              <Loader2 className="w-7 h-7 animate-spin text-bce-cobalt dark:text-amber-400 mx-auto" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Checking feedback form availability for {selectedFaculty?.name} — {selectedSubject?.name}...
              </p>
            </div>
          ) : matchedForm ? (
            /* Real Published or Closed Feedback Card */
            <PublicFeedbackCard form={matchedForm} isClosed={formStatus === 'CLOSED'} />
          ) : selectedSubjectId ? (
            /* Subject Selected but No Published Form Found */
            <div className="bg-white dark:bg-[#111724] rounded-2xl p-5 sm:p-8 border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-xs">
              <div className="w-11 h-11 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h5 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                No Published Feedback Form Available
              </h5>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                {statusMessage ||
                  `There is no active feedback form published for ${selectedFaculty?.name} teaching ${selectedSubject?.name} (${selectedBranch?.name}, ${selectedSemesterLabel || selectedSemester?.name}).`}
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-medium rounded-full">
                  <Info className="w-3.5 h-3.5" />
                  Forms are opened during designated academic feedback windows.
                </span>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
