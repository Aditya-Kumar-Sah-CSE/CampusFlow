'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
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
  PublicFormSummary,
} from '@/app/feedback/actions';
import { PublicFeedbackCard } from '@/components/public/PublicFeedbackCard';
import { RedPushpin } from '@/components/ui/RedPushpin';
import { ExamPadClip } from '@/components/ui/ExamPadCard';
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

  return (
    <div className="space-y-4 sm:space-y-8">
      {/* 5-Step Cascading Selection ExamPad Clipboard with Vintage Metal Clip & Hardboard */}
      <div className="exam-pad-board-dashboard p-2 sm:p-3 md:p-4 pt-10 sm:pt-12 md:pt-14 rounded-lg relative overflow-visible border-2 border-amber-950/60 dark:border-[#24160a] shadow-2xl scroll-mt-28">
        {/* Authentic Top Metal Exam Clip */}
        <ExamPadClip label="FEEDBACK SELECTION" size="default" />

        {/* Brass corner brackets */}
        <div className="absolute top-1.5 left-1.5 w-3 h-3 border-t-2 border-l-2 border-amber-500/80 pointer-events-none rounded-tl-xs" />
        <div className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 border-amber-500/80 pointer-events-none rounded-tr-xs" />
        <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b-2 border-l-2 border-amber-500/80 pointer-events-none rounded-bl-xs" />
        <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b-2 border-r-2 border-amber-500/80 pointer-events-none rounded-br-xs" />

        {/* Main Paper Sheet Clamped Beneath Clip */}
        <div className="relative rounded-[3px] p-4 sm:p-7 bg-[#fffdfa] dark:bg-[#1a1208] border border-amber-900/30 dark:border-[#4d381c] shadow-[0_2px_8px_rgba(0,0,0,0.12)] space-y-3.5 sm:space-y-6 text-slate-800 dark:text-[#faebd0]">

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 sm:pb-4 border-b border-slate-200/80 dark:border-[#423218]">
              <div>
                <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#f8ecd2] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600 dark:text-[#d4af37]" />
                  Cascading Feedback Selection
                </h4>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-[#c4a97d] mt-0.5">
                  Select your academic details in order: Session → Department → Semester → Faculty → Subject.
                </p>
              </div>

              {(selectedBranchId || selectedFacultyId || selectedSubjectId) && (
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-semibold text-slate-700 hover:text-slate-900 bg-amber-50/80 hover:bg-amber-100/90 dark:bg-[#342613] dark:hover:bg-[#433119] dark:text-amber-200 border border-[#dfd7be] dark:border-amber-700/50 transition-colors self-start sm:self-auto cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500 dark:text-amber-400" />
                  <span>Reset Selection</span>
                </button>
              )}
            </div>

            {/* Tier 1: Academic Year + Branch + Semester */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
              {/* Step 1: Academic Year */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#d6be8c] mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-[#d4af37] shrink-0" />
                  1. Academic Session
                </label>
                <select
                  value={selectedYearId}
                  onChange={e => setSelectedYearId(e.target.value)}
                  className="paper-select w-full min-h-[44px] px-3.5 py-2 text-base sm:text-xs font-semibold cursor-pen"
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
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#d6be8c] mb-1.5 flex items-center justify-between">
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
                  className="paper-select w-full min-h-[44px] px-3.5 py-2 text-base sm:text-xs font-semibold cursor-pen disabled:opacity-60 disabled:cursor-not-allowed"
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
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#d6be8c] flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-amber-600 dark:text-[#d4af37] shrink-0" />
                    3. Academic Level & Semester
                  </label>
                  {hasMultipleProgrammes && (
                    <div className="flex items-center gap-1 bg-[#ede4ce] dark:bg-[#2e2110] p-0.5 rounded-[3px] border border-[#d6cbb1] dark:border-[#523c1c]">
                      <button
                        type="button"
                        onClick={() => setSelectedProgrammeFilter('ALL')}
                        className={`px-2 py-0.5 rounded-[2px] font-bold text-[10px] tracking-wide transition-all ${
                          selectedProgrammeFilter === 'ALL'
                            ? 'bg-amber-800 text-white dark:bg-[#d4af37] dark:text-[#1c1409] shadow-xs'
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
                          className={`px-2 py-0.5 rounded-[2px] font-bold text-[10px] tracking-wide transition-all ${
                            selectedProgrammeFilter === prog
                              ? 'bg-amber-800 text-white dark:bg-[#d4af37] dark:text-[#1c1409] shadow-xs'
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
                  className="paper-select w-full min-h-[44px] px-3.5 py-2 text-base sm:text-xs font-semibold cursor-pen"
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
              <div className="p-3.5 sm:p-5 rounded-[3px] bg-gradient-to-r from-bce-navy via-slate-900 to-indigo-950 dark:from-[#362512] dark:via-[#2b1c0b] dark:to-[#1f1406] text-white shadow-md border border-indigo-500/30 dark:border-amber-600/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-[3px] text-[10px] font-bold bg-amber-400 text-slate-950 uppercase tracking-wider">
                      Official All-in-One Form
                    </span>
                    {semesterFormResult.itemsCount ? (
                      <span className="text-blue-200 dark:text-amber-200 text-xs font-semibold flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-amber-400" />
                        {semesterFormResult.itemsCount} Teachers Evaluated
                      </span>
                    ) : null}
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white dark:text-[#faebd0]">
                    Official Semester Feedback Form Available — Includes All Subjects & Teachers
                  </h3>
                  <p className="text-xs text-slate-300 dark:text-[#c4a97d] max-w-xl">
                    Students of {selectedBranch?.name} ({selectedSemesterLabel || selectedSemester?.name}) can rate all course faculty in a single Google Form with standard Multiple Choice Grids.
                  </p>
                </div>

                {!isAuthenticated && !sessionLoading ? (
                  <button
                    type="button"
                    onClick={() => {
                      const returnUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : pathname;
                      router.push(`/auth/student/login?redirect=${encodeURIComponent(returnUrl)}`);
                    }}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 dark:bg-[#3d2a13] dark:hover:bg-[#4d3619] text-white dark:text-amber-100 font-bold text-xs rounded-[4px] transition-all shadow-md shrink-0 active:scale-95 cursor-pointer border border-slate-700 dark:border-amber-600/50"
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Sign In to Start Feedback</span>
                  </button>
                ) : semesterFormSubmitted && semesterFormResult?.form ? (
                  <Link
                    href={`/feedback/confirmation?formId=${semesterFormResult.form.id}`}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs rounded-[4px] transition-all shadow-md shrink-0 active:scale-95"
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
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs rounded-[4px] transition-all shadow-md shrink-0 active:scale-95 cursor-pointer border border-amber-600/30"
                  >
                    <span>Start Feedback</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </div>
            )}

            {/* Tier 2: Faculty & Subject Cascading Filters */}
            <div className="pt-3 sm:pt-4 border-t border-slate-200/80 dark:border-[#423218] space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-[#d6be8c] flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-600 dark:text-[#d4af37]" />
                  {semesterFormResult && semesterFormResult.status === 'PUBLISHED' && semesterFormResult.form
                    ? 'Or evaluate an individual faculty member & subject:'
                    : 'Individual Faculty Member & Course Evaluation:'}
                </span>
                <div className="h-px bg-slate-200/80 dark:bg-[#423218] flex-1" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
                {/* Step 4: Faculty Selector */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#d6be8c] mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-amber-600 dark:text-[#d4af37] shrink-0" />
                      4. Select Faculty Member
                    </span>
                    {loadingFaculties && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 dark:text-[#d4af37]" />}
                  </label>

                  {!selectedBranchId ? (
                    <div className="min-h-[44px] rounded-[2px] bg-[#f9f6ed] dark:bg-[#1a1309] border border-[#dfd7be] dark:border-[#4d3817] flex items-center px-3.5 text-xs text-slate-500 dark:text-[#a88f63] font-medium">
                      Please select your Branch / Discipline above
                    </div>
                  ) : loadingFaculties ? (
                    <div className="min-h-[44px] rounded-[2px] bg-[#f9f6ed] dark:bg-[#1a1309] border border-[#dfd7be] dark:border-[#4d3817] flex items-center px-3 text-xs text-slate-500 dark:text-[#a88f63]">
                      Loading assigned faculties...
                    </div>
                  ) : faculties.length === 0 ? (
                    <div className="p-3 bg-amber-50/80 dark:bg-[#2b1f0e] border border-amber-200/80 dark:border-amber-700/60 rounded-[2px] text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>No faculty assignments found for {selectedBranch?.name}, {selectedSemesterLabel || selectedSemester?.name}.</span>
                    </div>
                  ) : (
                    <select
                      value={selectedFacultyId}
                      onChange={e => setSelectedFacultyId(e.target.value)}
                      className="paper-select w-full min-h-[44px] px-3.5 py-2 text-base sm:text-xs font-semibold cursor-pen"
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#d6be8c] mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-[#d4af37] shrink-0" />
                      5. Select Course Subject
                    </span>
                    {loadingSubjects && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 dark:text-[#d4af37]" />}
                  </label>

                  {!selectedFacultyId ? (
                    <div className="min-h-[44px] rounded-[2px] bg-[#f9f6ed] dark:bg-[#1a1309] border border-[#dfd7be] dark:border-[#4d3817] flex items-center px-3 text-xs text-slate-500 dark:text-[#a88f63]">
                      Please select a faculty member first
                    </div>
                  ) : loadingSubjects ? (
                    <div className="min-h-[44px] rounded-[2px] bg-[#f9f6ed] dark:bg-[#1a1309] border border-[#dfd7be] dark:border-[#4d3817] flex items-center px-3 text-xs text-slate-500 dark:text-[#a88f63]">
                      Loading subjects taught by {selectedFaculty?.name}...
                    </div>
                  ) : subjects.length === 0 ? (
                    <div className="p-3 bg-amber-50/80 dark:bg-[#2b1f0e] border border-amber-200/80 dark:border-amber-700/60 rounded-[2px] text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>No subjects mapped to {selectedFaculty?.name} in this semester.</span>
                    </div>
                  ) : (
                    <select
                      value={selectedSubjectId}
                      onChange={e => setSelectedSubjectId(e.target.value)}
                      className="paper-select w-full min-h-[44px] px-3.5 py-2 text-base sm:text-xs font-semibold cursor-pen"
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

            {/* Paper Dog-Ear Crease Effect on Bottom Right */}
            <div
              className="absolute bottom-0 right-0 w-3.5 h-3.5 pointer-events-none overflow-hidden"
              aria-hidden="true"
            >
              <div className="absolute bottom-0 right-0 w-5 h-5 bg-black/10 dark:bg-black/50 rotate-45 translate-x-2.5 translate-y-2.5 border-t border-l border-black/10 dark:border-amber-500/20" />
            </div>
        </div>
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
