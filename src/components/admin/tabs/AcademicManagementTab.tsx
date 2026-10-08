'use client';

import { useState, useTransition, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  createAcademicYearAction,
  updateAcademicYearAction,
  createBranchAction,
  updateBranchAction,
  deleteBranchAction,
  createSemesterAction,
  updateSemesterAction,
  deleteSemesterAction,
  bulkSetupSemestersAction,
  getAcademicProgrammesAction,
  bulkSetupAcademicProgrammesAction,
  createAcademicLevelAction,
  updateAcademicLevelAction,
  createFacultyAction,
  updateFacultyAction,
  deleteFacultyAction,
  createSubjectAction,
  updateSubjectAction,
  deleteSubjectAction,
  createAssignmentAction,
  updateAssignmentAction,
  deleteAssignmentAction,
  getPaginatedFacultiesAction,
  getPaginatedSubjectsAction,
  getPaginatedAssignmentsAction,
} from '@/app/admin/actions';
import {
  Calendar,
  Layers,
  BookOpen,
  Users,
  GraduationCap,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  Building2,
  Search,
  Edit2,
  X,
  Check,
  Zap,
  CheckSquare,
  Square,
  Filter,
  School,
  Settings2,
  ChevronDown,
} from 'lucide-react';
import type {
  AcademicYear,
  Branch,
  Semester,
  AcademicProgramme,
  AcademicLevel,
  Faculty,
  Subject,
  FacultySubjectAssignment,
} from '@/types/database';
import { PROGRAMME_PRESETS, ProgrammePreset } from '@/lib/academic/programme-service';
import { PaginationControl } from '@/components/ui/PaginationControl';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

export type AcademicSubTab =
  | 'faculties'
  | 'subjects'
  | 'assignments'
  | 'years'
  | 'branches'
  | 'semesters';

const VALID_ACADEMIC_SUBTABS: AcademicSubTab[] = [
  'faculties',
  'subjects',
  'assignments',
  'years',
  'branches',
  'semesters',
];

interface Props {
  academicYears: AcademicYear[];
  branches: Branch[];
  semesters: Semester[];
  faculties: Faculty[];
  subjects: Subject[];
  assignments: FacultySubjectAssignment[];
  initialFacultyTotal?: number;
  initialSubjectTotal?: number;
  initialAssignmentTotal?: number;
  activeCollegeId?: string;
  initialSubTab?: string;
}

export function AcademicManagementTab({
  academicYears,
  branches,
  semesters,
  faculties: initialFaculties,
  subjects: initialSubjects,
  assignments: initialAssignments,
  initialFacultyTotal,
  initialSubjectTotal,
  initialAssignmentTotal,
  activeCollegeId,
  initialSubTab,
}: Props) {
  const searchParams = useSearchParams();

  const resolveSubTab = useCallback((): AcademicSubTab => {
    const param = searchParams?.get('subtab');
    if (param && VALID_ACADEMIC_SUBTABS.includes(param as AcademicSubTab)) {
      return param as AcademicSubTab;
    }
    if (initialSubTab && VALID_ACADEMIC_SUBTABS.includes(initialSubTab as AcademicSubTab)) {
      return initialSubTab as AcademicSubTab;
    }
    return 'faculties';
  }, [searchParams, initialSubTab]);

  const [activeSubTab, setActiveSubTab] = useState<AcademicSubTab>(() => resolveSubTab());

  const handleSubTabChange = useCallback((nextSubTab: AcademicSubTab) => {
    setActiveSubTab(nextSubTab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'academic');
      url.searchParams.set('subtab', nextSubTab);
      window.history.pushState(null, '', url.toString());
    }
  }, []);

  // Listen for browser Back/Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sub = urlParams.get('subtab');
      if (sub && VALID_ACADEMIC_SUBTABS.includes(sub as AcademicSubTab)) {
        setActiveSubTab(sub as AcademicSubTab);
      } else {
        setActiveSubTab(resolveSubTab());
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [resolveSubTab]);

  // Sync on searchParams update or client navigation
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sub = urlParams.get('subtab');
    const targetSub = (sub && VALID_ACADEMIC_SUBTABS.includes(sub as AcademicSubTab))
      ? (sub as AcademicSubTab)
      : resolveSubTab();

    if (targetSub !== activeSubTab) {
      setActiveSubTab(targetSub);
    }
  }, [resolveSubTab, activeSubTab, searchParams]);

  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Masters local state (for fast in-place mutation without full dashboard re-fetch)
  const [branchList, setBranchList] = useState<Branch[]>(branches);
  const [yearList, setYearList] = useState<AcademicYear[]>(academicYears);
  const [semesterList, setSemesterList] = useState<Semester[]>(semesters);

  // Only active branches for assignment/subject/faculty dropdowns, sorted alphabetically
  const activeBranches = useMemo(
    () => branchList.filter((b) => b.is_active).sort((a, b) => a.name.localeCompare(b.name)),
    [branchList]
  );

  // Master lists for complete institution coverage (all 32+ faculties & 45+ subjects)
  // decoupled from table pagination/search states so assignments & dropdowns never lose data
  const [allFaculties, setAllFaculties] = useState<Faculty[]>(initialFaculties);
  const [allSubjects, setAllSubjects] = useState<Subject[]>(initialSubjects);

  // -------------------------------------------------------------
  // 1. FACULTIES STATE & PAGINATION
  // -------------------------------------------------------------
  const [facultyList, setFacultyList] = useState<Faculty[]>(initialFaculties.slice(0, 20));
  const [facultyTotal, setFacultyTotal] = useState<number>(initialFacultyTotal ?? initialFaculties.length);
  const [facultyPage, setFacultyPage] = useState<number>(1);
  const [facultyPageSize, setFacultyPageSize] = useState<number>(20);
  const [facultySearch, setFacultySearch] = useState<string>('');
  const [debouncedFacultySearch, setDebouncedFacultySearch] = useState<string>('');
  const [facultyDeptFilter, setFacultyDeptFilter] = useState<string>('ALL');
  const [facultyStatusFilter, setFacultyStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [facultyLoading, setFacultyLoading] = useState<boolean>(false);

  // Faculty form
  const [facName, setFacName] = useState('');
  const [facDept, setFacDept] = useState(
    branches.find((b) => b.is_active)?.name || branches[0]?.name || ''
  );
  const [facDesig, setFacDesig] = useState('Assistant Professor');
  const [facEmpId, setFacEmpId] = useState('');

  // 300ms debounce on faculty search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFacultySearch(facultySearch);
      setFacultyPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [facultySearch]);

  const loadFaculties = useCallback(async () => {
    setFacultyLoading(true);
    const res = await getPaginatedFacultiesAction({
      page: facultyPage,
      pageSize: facultyPageSize,
      search: debouncedFacultySearch,
      department: facultyDeptFilter,
      status: facultyStatusFilter,
      collegeId: activeCollegeId,
    });
    setFacultyLoading(false);
    if (res.success) {
      setFacultyList(res.data as Faculty[]);
      setFacultyTotal(res.total);
    }
  }, [facultyPage, facultyPageSize, debouncedFacultySearch, facultyDeptFilter, facultyStatusFilter, activeCollegeId]);

  useEffect(() => {
    // Only fetch if filters or page actually changed from initial state
    if (debouncedFacultySearch || facultyDeptFilter !== 'ALL' || facultyStatusFilter !== 'ALL' || facultyPage > 1 || facultyPageSize !== 20) {
      loadFaculties();
    }
  }, [loadFaculties, debouncedFacultySearch, facultyDeptFilter, facultyStatusFilter, facultyPage, facultyPageSize]);

  // -------------------------------------------------------------
  // 2. SUBJECTS STATE & PAGINATION
  // -------------------------------------------------------------
  const [subjectList, setSubjectList] = useState<Subject[]>(initialSubjects.slice(0, 20));
  const [subjectTotal, setSubjectTotal] = useState<number>(initialSubjectTotal ?? initialSubjects.length);
  const [subjectPage, setSubjectPage] = useState<number>(1);
  const [subjectPageSize, setSubjectPageSize] = useState<number>(20);
  const [subjectSearch, setSubjectSearch] = useState<string>('');
  const [debouncedSubjectSearch, setDebouncedSubjectSearch] = useState<string>('');
  const [subjectBranchFilter, setSubjectBranchFilter] = useState<string>('ALL');
  const [subjectSemesterFilter, setSubjectSemesterFilter] = useState<string>('ALL');
  const [subjectStatusFilter, setSubjectStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [subjectLoading, setSubjectLoading] = useState<boolean>(false);

  // Subject form
  const [subName, setSubName] = useState('');
  const [subCode, setSubCode] = useState('');
  const [subBranchId, setSubBranchId] = useState(
    branches.find((b) => b.is_active)?.id || branches[0]?.id || ''
  );
  const [subSemesterId, setSubSemesterId] = useState(semesters[0]?.id || '');

  // 300ms debounce on subject search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSubjectSearch(subjectSearch);
      setSubjectPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [subjectSearch]);

  const loadSubjects = useCallback(async () => {
    setSubjectLoading(true);
    const res = await getPaginatedSubjectsAction({
      page: subjectPage,
      pageSize: subjectPageSize,
      search: debouncedSubjectSearch,
      branchId: subjectBranchFilter,
      semesterId: subjectSemesterFilter,
      status: subjectStatusFilter,
      collegeId: activeCollegeId,
    });
    setSubjectLoading(false);
    if (res.success) {
      setSubjectList(res.data as Subject[]);
      setSubjectTotal(res.total);
    }
  }, [subjectPage, subjectPageSize, debouncedSubjectSearch, subjectBranchFilter, subjectSemesterFilter, subjectStatusFilter, activeCollegeId]);

  useEffect(() => {
    if (debouncedSubjectSearch || subjectBranchFilter !== 'ALL' || subjectSemesterFilter !== 'ALL' || subjectStatusFilter !== 'ALL' || subjectPage > 1 || subjectPageSize !== 20) {
      loadSubjects();
    }
  }, [loadSubjects, debouncedSubjectSearch, subjectBranchFilter, subjectSemesterFilter, subjectStatusFilter, subjectPage, subjectPageSize]);

  // -------------------------------------------------------------
  // 3. ASSIGNMENTS STATE & PAGINATION
  // -------------------------------------------------------------
  const [assignmentList, setAssignmentList] = useState<FacultySubjectAssignment[]>(initialAssignments);
  const [assignTotal, setAssignTotal] = useState<number>(initialAssignmentTotal ?? initialAssignments.length);
  const [assignPage, setAssignPage] = useState<number>(1);
  const [assignPageSize, setAssignPageSize] = useState<number>(20);
  const [assignYearFilter, setAssignYearFilter] = useState<string>('ALL');
  const [assignBranchFilter, setAssignBranchFilter] = useState<string>('ALL');
  const [assignSemesterFilter, setAssignSemesterFilter] = useState<string>('ALL');
  const [assignLoading, setAssignLoading] = useState<boolean>(false);

  // Assignment form
  const [assignFacultyId, setAssignFacultyId] = useState(initialFaculties[0]?.id || '');
  const [assignSubjectId, setAssignSubjectId] = useState(initialSubjects[0]?.id || '');
  const [assignYearId, setAssignYearId] = useState(
    academicYears.find((y) => y.is_active)?.id || academicYears[0]?.id || ''
  );
  const [assignBranchId, setAssignBranchId] = useState(
    initialSubjects[0]?.branch_id || branches.find((b) => b.is_active)?.id || branches[0]?.id || ''
  );
  const [assignSemesterId, setAssignSemesterId] = useState(
    initialSubjects[0]?.semester_id || semesters[0]?.id || ''
  );
  const [filterAssignSubjectsByBranchSem, setFilterAssignSubjectsByBranchSem] = useState<boolean>(false);

  const loadAssignments = useCallback(async () => {
    setAssignLoading(true);
    const res = await getPaginatedAssignmentsAction({
      page: assignPage,
      pageSize: assignPageSize,
      academicYearId: assignYearFilter,
      branchId: assignBranchFilter,
      semesterId: assignSemesterFilter,
      collegeId: activeCollegeId,
    });
    setAssignLoading(false);
    if (res.success) {
      setAssignmentList(res.data as FacultySubjectAssignment[]);
      setAssignTotal(res.total);
    }
  }, [assignPage, assignPageSize, assignYearFilter, assignBranchFilter, assignSemesterFilter, activeCollegeId]);

  useEffect(() => {
    if (assignYearFilter !== 'ALL' || assignBranchFilter !== 'ALL' || assignSemesterFilter !== 'ALL' || assignPage > 1 || assignPageSize !== 20) {
      loadAssignments();
    }
  }, [loadAssignments, assignYearFilter, assignBranchFilter, assignSemesterFilter, assignPage, assignPageSize]);

  // Options for SearchableSelect (built from complete master lists, always accessible)
  const facultyOptions = useMemo(
    () =>
      allFaculties.map((f) => ({
        id: f.id,
        label: f.name,
        sublabel: [f.department, f.designation].filter(Boolean).join(' • ') || 'General',
      })),
    [allFaculties]
  );

  const subjectOptions = useMemo(() => {
    let list = allSubjects;
    if (filterAssignSubjectsByBranchSem) {
      list = allSubjects.filter((s) => {
        const matchesBranch = !s.branch_id || !assignBranchId || s.branch_id === assignBranchId;
        const matchesSemester = !s.semester_id || !assignSemesterId || s.semester_id === assignSemesterId;
        return matchesBranch && matchesSemester;
      });
    }
    return list.map((s) => {
      const branchCode = s.branch?.code || branchList.find((b) => b.id === s.branch_id)?.code || 'Common/All';
      const semName = s.semester?.name || semesterList.find((sem) => sem.id === s.semester_id)?.name || '';
      const details = [s.code, branchCode, semName].filter(Boolean).join(' • ');
      return {
        id: s.id,
        label: s.name,
        sublabel: details,
      };
    });
  }, [allSubjects, filterAssignSubjectsByBranchSem, assignBranchId, assignSemesterId, branchList, semesterList]);

  const handleAssignSubjectSelect = (subId: string) => {
    setAssignSubjectId(subId);
    const selectedSub = allSubjects.find((s) => s.id === subId);
    if (selectedSub) {
      if (selectedSub.branch_id) {
        setAssignBranchId(selectedSub.branch_id);
      }
      if (selectedSub.semester_id) {
        setAssignSemesterId(selectedSub.semester_id);
      }
    }
  };

  // 4. Year & Branch forms
  const [yearName, setYearName] = useState('');
  const [yearActive, setYearActive] = useState(true);
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [editBranchName, setEditBranchName] = useState('');
  const [editBranchCode, setEditBranchCode] = useState('');
  const [editBranchActive, setEditBranchActive] = useState(true);
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);

  // Faculty edit state
  const [editingFaculty, setEditingFaculty] = useState<Faculty | null>(null);
  const [editFacName, setEditFacName] = useState('');
  const [editFacDept, setEditFacDept] = useState('');
  const [editFacDesig, setEditFacDesig] = useState('Assistant Professor');
  const [editFacEmpId, setEditFacEmpId] = useState('');
  const [editFacActive, setEditFacActive] = useState(true);

  // Subject edit state
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editSubName, setEditSubName] = useState('');
  const [editSubCode, setEditSubCode] = useState('');
  const [editSubBranchId, setEditSubBranchId] = useState('');
  const [editSubSemesterId, setEditSubSemesterId] = useState('');
  const [editSubActive, setEditSubActive] = useState(true);

  // Assignment edit state
  const [editingAssignment, setEditingAssignment] = useState<FacultySubjectAssignment | null>(null);
  const [editAssignFacultyId, setEditAssignFacultyId] = useState('');
  const [editAssignSubjectId, setEditAssignSubjectId] = useState('');
  const [editAssignYearId, setEditAssignYearId] = useState('');
  const [editAssignBranchId, setEditAssignBranchId] = useState('');
  const [editAssignSemesterId, setEditAssignSemesterId] = useState('');
  const [editAssignActive, setEditAssignActive] = useState(true);

  // 5. Academic Programmes & Levels State
  const [programmeList, setProgrammeList] = useState<AcademicProgramme[]>([]);
  const [selectedPresets, setSelectedPresets] = useState<string[]>(['BTECH']);
  const [showCustomPreset, setShowCustomPreset] = useState<boolean>(false);
  const [customProgName, setCustomProgName] = useState<string>('');
  const [customProgCode, setCustomProgCode] = useState<string>('');
  const [customProgType, setCustomProgType] = useState<any>('UNDERGRADUATE');
  const [customProgDuration, setCustomProgDuration] = useState<number>(4);
  const [customProgLevelType, setCustomProgLevelType] = useState<any>('SEMESTER');
  const [customProgHasBranches, setCustomProgHasBranches] = useState<boolean>(true);
  const [customProgTotalLevels, setCustomProgTotalLevels] = useState<number>(8);

  // Manual Add Level State
  const [selectedProgIdForAdd, setSelectedProgIdForAdd] = useState<string>('');
  const [levelNumber, setLevelNumber] = useState<number>(1);
  const [levelYearNumber, setLevelYearNumber] = useState<number>(1);
  const [levelName, setLevelName] = useState<string>('');

  // Table Filters State
  const [levelProgFilter, setLevelProgFilter] = useState<string>('ALL');
  const [levelTypeFilter, setLevelTypeFilter] = useState<string>('ALL');
  const [levelStatusFilter, setLevelStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [levelSearchQuery, setLevelSearchQuery] = useState<string>('');
  const [deletingSemester, setDeletingSemester] = useState<Semester | null>(null);

  // Subject Form Programme Scope State
  const [subProgId, setSubProgId] = useState<string>('ALL');

  // Sync state when props or activeCollegeId changes
  useEffect(() => {
    setBranchList(branches);
    setYearList(academicYears);
    setSemesterList(semesters);
    setAllFaculties(initialFaculties);
    setAllSubjects(initialSubjects);
    setFacultyList(initialFaculties.slice(0, facultyPageSize));
    setSubjectList(initialSubjects.slice(0, subjectPageSize));
    setAssignmentList(initialAssignments);
    setFacultyTotal(initialFacultyTotal ?? initialFaculties.length);
    setSubjectTotal(initialSubjectTotal ?? initialSubjects.length);
    setAssignTotal(initialAssignmentTotal ?? initialAssignments.length);
    setFacultyPage(1);
    setSubjectPage(1);
    setAssignPage(1);
  }, [branches, academicYears, semesters, initialFaculties, initialSubjects, initialAssignments, initialFacultyTotal, initialSubjectTotal, initialAssignmentTotal, activeCollegeId, facultyPageSize, subjectPageSize]);

  // Load academic programmes for the active college
  useEffect(() => {
    async function loadProgrammes() {
      const res = await getAcademicProgrammesAction(activeCollegeId);
      if (res.success && res.programmes) {
        setProgrammeList(res.programmes);
        if (res.programmes.length > 0) {
          setSelectedProgIdForAdd((prev) => prev || res.programmes[0].id);
          const existingCodes = res.programmes.map((p) => p.code.toUpperCase());
          setSelectedPresets((prev) => Array.from(new Set([...prev, ...existingCodes])));
        }
      }
    }
    loadProgrammes();
  }, [activeCollegeId]);

  // -------------------------------------------------------------
  // HANDLERS (With immediate local state updates)
  // -------------------------------------------------------------

  const handleCreateFaculty = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await createFacultyAction({
        name: facName,
        department: facDept,
        designation: facDesig,
        employee_id: facEmpId || undefined,
        is_active: true,
        collegeId: activeCollegeId,
      });
      if (res.success && res.faculty) {
        setMessage({ type: 'success', text: `Faculty ${facName} added successfully.` });
        setAllFaculties((prev) => [res.faculty as Faculty, ...prev]);
        setFacultyList((prev) => [res.faculty as Faculty, ...prev]);
        setFacultyTotal((prev) => prev + 1);
        setFacName('');
        setFacEmpId('');
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to create faculty.' });
      }
    });
  };

  const handleToggleFacultyActive = (f: Faculty) => {
    const nextActive = !f.is_active;
    // Optimistic update
    setAllFaculties((prev) =>
      prev.map((item) => (item.id === f.id ? { ...item, is_active: nextActive } : item))
    );
    setFacultyList((prev) =>
      prev.map((item) => (item.id === f.id ? { ...item, is_active: nextActive } : item))
    );

    startTransition(async () => {
      const res = await updateFacultyAction(f.id, {
        name: f.name,
        department: f.department,
        designation: f.designation,
        employee_id: f.employee_id || undefined,
        is_active: nextActive,
        collegeId: activeCollegeId,
      });
      if (!res.success) {
        // Rollback
        setAllFaculties((prev) =>
          prev.map((item) => (item.id === f.id ? { ...item, is_active: f.is_active } : item))
        );
        setFacultyList((prev) =>
          prev.map((item) => (item.id === f.id ? { ...item, is_active: f.is_active } : item))
        );
        setMessage({ type: 'error', text: res.error || 'Failed to update faculty status.' });
      }
    });
  };

  const handleDeleteFaculty = (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete faculty member ${name}?`)) return;
    setMessage(null);

    const prevMaster = [...allFaculties];
    const prevList = [...facultyList];
    setAllFaculties((prev) => prev.filter((item) => item.id !== id));
    setFacultyList((prev) => prev.filter((item) => item.id !== id));
    setFacultyTotal((prev) => Math.max(0, prev - 1));

    startTransition(async () => {
      const res = await deleteFacultyAction(id, activeCollegeId);
      if (res.success) {
        setMessage({ type: 'success', text: `Faculty ${name} deleted successfully.` });
      } else {
        setAllFaculties(prevMaster);
        setFacultyList(prevList);
        setFacultyTotal((prev) => prev + 1);
        setMessage({ type: 'error', text: res.error || 'Failed to delete faculty.' });
      }
    });
  };

  const handleCreateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await createSubjectAction({
        name: subName,
        code: subCode,
        branch_id: subBranchId || undefined,
        semester_id: subSemesterId || undefined,
        is_active: true,
        collegeId: activeCollegeId,
      });
      if (res.success && res.subject) {
        setMessage({ type: 'success', text: `Subject ${subName} (${subCode}) added successfully.` });
        const newSub = res.subject as Subject;
        setAllSubjects((prev) => [newSub, ...prev]);
        setSubjectList((prev) => [newSub, ...prev]);
        setSubjectTotal((prev) => prev + 1);
        setSubName('');
        setSubCode('');
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to create subject.' });
      }
    });
  };

  const handleToggleSubjectActive = (s: Subject) => {
    const nextActive = !s.is_active;
    setAllSubjects((prev) =>
      prev.map((item) => (item.id === s.id ? { ...item, is_active: nextActive } : item))
    );
    setSubjectList((prev) =>
      prev.map((item) => (item.id === s.id ? { ...item, is_active: nextActive } : item))
    );

    startTransition(async () => {
      const res = await updateSubjectAction(s.id, {
        name: s.name,
        code: s.code,
        branch_id: s.branch_id || undefined,
        semester_id: s.semester_id || undefined,
        is_active: nextActive,
        collegeId: activeCollegeId,
      });
      if (!res.success) {
        setAllSubjects((prev) =>
          prev.map((item) => (item.id === s.id ? { ...item, is_active: s.is_active } : item))
        );
        setSubjectList((prev) =>
          prev.map((item) => (item.id === s.id ? { ...item, is_active: s.is_active } : item))
        );
        setMessage({ type: 'error', text: res.error || 'Failed to update subject status.' });
      }
    });
  };

  const handleDeleteSubject = (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete subject ${name}?`)) return;
    setMessage(null);

    const prevMaster = [...allSubjects];
    const prevList = [...subjectList];
    setAllSubjects((prev) => prev.filter((item) => item.id !== id));
    setSubjectList((prev) => prev.filter((item) => item.id !== id));
    setSubjectTotal((prev) => Math.max(0, prev - 1));

    startTransition(async () => {
      const res = await deleteSubjectAction(id, activeCollegeId);
      if (res.success) {
        setMessage({ type: 'success', text: `Subject ${name} deleted successfully.` });
      } else {
        setAllSubjects(prevMaster);
        setSubjectList(prevList);
        setSubjectTotal((prev) => prev + 1);
        setMessage({ type: 'error', text: res.error || 'Failed to delete subject.' });
      }
    });
  };

  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!assignFacultyId || !assignSubjectId || !assignYearId) {
      setMessage({ type: 'error', text: 'Please select faculty, subject, and session.' });
      return;
    }
    startTransition(async () => {
      const res = await createAssignmentAction({
        faculty_id: assignFacultyId,
        subject_id: assignSubjectId,
        academic_year_id: assignYearId,
        branch_id: assignBranchId || undefined,
        semester_id: assignSemesterId || undefined,
        is_active: true,
        collegeId: activeCollegeId,
      });
      if (res.success && res.assignment) {
        setMessage({ type: 'success', text: 'Faculty assignment created successfully.' });
        // Enhance with relations for instant display
        const faculty = allFaculties.find((f) => f.id === assignFacultyId);
        const subject = allSubjects.find((s) => s.id === assignSubjectId);
        const year = yearList.find((y) => y.id === assignYearId);
        const branch = branchList.find((b) => b.id === assignBranchId);
        const semester = semesterList.find((s) => s.id === assignSemesterId);

        const newObj = {
          ...res.assignment,
          faculty: faculty || { id: assignFacultyId, name: 'Faculty' },
          subject: subject || { id: assignSubjectId, name: 'Subject' },
          academic_year: year,
          branch,
          semester,
        } as FacultySubjectAssignment;

        setAssignmentList((prev) => [newObj, ...prev]);
        setAssignTotal((prev) => prev + 1);
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to create assignment.' });
      }
    });
  };

  const handleDeleteAssignment = (id: string) => {
    if (!confirm('Are you sure you want to remove this faculty assignment?')) return;
    setMessage(null);

    const prevList = [...assignmentList];
    setAssignmentList((prev) => prev.filter((item) => item.id !== id));
    setAssignTotal((prev) => Math.max(0, prev - 1));

    startTransition(async () => {
      const res = await deleteAssignmentAction(id, activeCollegeId);
      if (res.success) {
        setMessage({ type: 'success', text: 'Assignment removed.' });
      } else {
        setAssignmentList(prevList);
        setAssignTotal((prev) => prev + 1);
        setMessage({ type: 'error', text: res.error || 'Failed to remove assignment.' });
      }
    });
  };

  const handleCreateYear = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await createAcademicYearAction({ name: yearName, is_active: yearActive, collegeId: activeCollegeId });
      if (res.success && res.year) {
        setMessage({ type: 'success', text: `Academic Year ${yearName} added.` });
        setYearList((prev) => [res.year as AcademicYear, ...prev]);
        setYearName('');
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to add year.' });
      }
    });
  };

  const handleToggleYear = (y: AcademicYear) => {
    const nextActive = !y.is_active;
    setYearList((prev) =>
      prev.map((item) => (item.id === y.id ? { ...item, is_active: nextActive } : item))
    );

    startTransition(async () => {
      const res = await updateAcademicYearAction(y.id, { name: y.name, is_active: nextActive, collegeId: activeCollegeId });
      if (!res.success) {
        setYearList((prev) =>
          prev.map((item) => (item.id === y.id ? { ...item, is_active: y.is_active } : item))
        );
        setMessage({ type: 'error', text: res.error || 'Failed to update year.' });
      }
    });
  };

  const handleCreateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await createBranchAction({ name: branchName, code: branchCode, is_active: true, collegeId: activeCollegeId });
      if (res.success && res.branch) {
        setMessage({ type: 'success', text: `Branch ${branchName} (${branchCode}) created.` });
        setBranchList((prev) => [...prev, res.branch as Branch]);
        setBranchName('');
        setBranchCode('');
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to add branch.' });
      }
    });
  };

  const handleToggleBranch = (b: Branch) => {
    const nextActive = !b.is_active;
    setBranchList((prev) =>
      prev.map((item) => (item.id === b.id ? { ...item, is_active: nextActive } : item))
    );

    startTransition(async () => {
      const res = await updateBranchAction(b.id, { name: b.name, code: b.code, is_active: nextActive, collegeId: activeCollegeId });
      if (!res.success) {
        setBranchList((prev) =>
          prev.map((item) => (item.id === b.id ? { ...item, is_active: b.is_active } : item))
        );
        setMessage({ type: 'error', text: res.error || 'Failed to update branch.' });
      }
    });
  };

  const handleOpenEditFaculty = (f: Faculty) => {
    setEditingFaculty(f);
    setEditFacName(f.name);
    setEditFacDept(f.department || (branchList[0]?.name || ''));
    setEditFacDesig(f.designation || 'Assistant Professor');
    setEditFacEmpId(f.employee_id || '');
    setEditFacActive(f.is_active);
  };

  const handleUpdateFacultySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaculty) return;
    setMessage(null);
    startTransition(async () => {
      const res = await updateFacultyAction(editingFaculty.id, {
        name: editFacName,
        department: editFacDept,
        designation: editFacDesig,
        employee_id: editFacEmpId || undefined,
        is_active: editFacActive,
        collegeId: activeCollegeId,
      });
      if (res.success) {
        setMessage({
          type: 'success',
          text: `Faculty "${editFacName.trim()}" updated successfully.`,
        });
        const updatedFac = {
          name: editFacName.trim(),
          department: editFacDept.trim(),
          designation: editFacDesig.trim(),
          employee_id: editFacEmpId.trim() || null,
          is_active: editFacActive,
        };
        setAllFaculties((prev) =>
          prev.map((f) => (f.id === editingFaculty.id ? { ...f, ...updatedFac } : f))
        );
        setFacultyList((prev) =>
          prev.map((f) => (f.id === editingFaculty.id ? { ...f, ...updatedFac } : f))
        );
        setEditingFaculty(null);
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to update faculty.' });
      }
    });
  };

  const handleOpenEditSubject = (s: Subject) => {
    setEditingSubject(s);
    setEditSubName(s.name);
    setEditSubCode(s.code);
    setEditSubBranchId(s.branch_id || '');
    setEditSubSemesterId(s.semester_id || '');
    setEditSubActive(s.is_active);
  };

  const handleUpdateSubjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject) return;
    setMessage(null);
    startTransition(async () => {
      const res = await updateSubjectAction(editingSubject.id, {
        name: editSubName,
        code: editSubCode,
        branch_id: editSubBranchId || undefined,
        semester_id: editSubSemesterId || undefined,
        is_active: editSubActive,
        collegeId: activeCollegeId,
      });
      if (res.success) {
        setMessage({
          type: 'success',
          text: `Subject "${editSubName.trim()}" (${editSubCode.trim().toUpperCase()}) updated successfully.`,
        });
        const updatedSub = {
          name: editSubName.trim(),
          code: editSubCode.trim().toUpperCase(),
          branch_id: editSubBranchId || null,
          semester_id: editSubSemesterId || null,
          is_active: editSubActive,
        };
        setAllSubjects((prev) =>
          prev.map((s) => (s.id === editingSubject.id ? { ...s, ...updatedSub } : s))
        );
        setSubjectList((prev) =>
          prev.map((s) => (s.id === editingSubject.id ? { ...s, ...updatedSub } : s))
        );
        setEditingSubject(null);
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to update subject.' });
      }
    });
  };

  const handleOpenEditAssignment = (a: FacultySubjectAssignment) => {
    setEditingAssignment(a);
    setEditAssignFacultyId(a.faculty_id);
    setEditAssignSubjectId(a.subject_id);
    setEditAssignYearId(a.academic_year_id);
    setEditAssignBranchId(a.branch_id || '');
    setEditAssignSemesterId(a.semester_id || '');
    setEditAssignActive(a.is_active);
  };

  const handleUpdateAssignmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAssignment) return;
    setMessage(null);
    startTransition(async () => {
      const res = await updateAssignmentAction(editingAssignment.id, {
        faculty_id: editAssignFacultyId,
        subject_id: editAssignSubjectId,
        academic_year_id: editAssignYearId,
        branch_id: editAssignBranchId || undefined,
        semester_id: editAssignSemesterId || undefined,
        is_active: editAssignActive,
        collegeId: activeCollegeId,
      });
      if (res.success && res.assignment) {
        setMessage({
          type: 'success',
          text: `Assignment updated successfully.`,
        });
        const faculty = allFaculties.find((f) => f.id === editAssignFacultyId);
        const subject = allSubjects.find((s) => s.id === editAssignSubjectId);
        const year = yearList.find((y) => y.id === editAssignYearId);
        const branch = branchList.find((b) => b.id === editAssignBranchId);
        const semester = semesterList.find((s) => s.id === editAssignSemesterId);

        const updatedObj = {
          ...editingAssignment,
          ...res.assignment,
          faculty: faculty || editingAssignment.faculty,
          subject: subject || editingAssignment.subject,
          academic_year: year || editingAssignment.academic_year,
          branch: branch || undefined,
          semester: semester || undefined,
          is_active: editAssignActive,
        } as unknown as FacultySubjectAssignment;

        setAssignmentList((prev) =>
          prev.map((a) => (a.id === editingAssignment.id ? updatedObj : a))
        );
        setEditingAssignment(null);
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to update assignment.' });
      }
    });
  };

  const handleOpenEditBranch = (b: Branch) => {
    setEditingBranch(b);
    setEditBranchName(b.name);
    setEditBranchCode(b.code);
    setEditBranchActive(b.is_active);
  };

  const handleUpdateBranchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;
    setMessage(null);
    startTransition(async () => {
      const res = await updateBranchAction(editingBranch.id, {
        name: editBranchName,
        code: editBranchCode,
        is_active: editBranchActive,
        collegeId: activeCollegeId,
      });
      if (res.success) {
        setMessage({
          type: 'success',
          text: `Branch updated to "${editBranchName.trim()}" (${editBranchCode.trim().toUpperCase()}).`,
        });
        setBranchList((prev) =>
          prev.map((b) =>
            b.id === editingBranch.id
              ? { ...b, name: editBranchName.trim(), code: editBranchCode.trim().toUpperCase(), is_active: editBranchActive }
              : b
          )
        );
        setEditingBranch(null);
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to update branch.' });
      }
    });
  };

  const handleDeleteBranchConfirm = () => {
    if (!deletingBranch) return;
    setMessage(null);
    startTransition(async () => {
      const res = await deleteBranchAction(deletingBranch.id, activeCollegeId);
      if (res.success) {
        setMessage({
          type: 'success',
          text: `Branch "${deletingBranch.name}" (${deletingBranch.code}) deleted successfully.`,
        });
        setBranchList((prev) => prev.filter((b) => b.id !== deletingBranch.id));
        setDeletingBranch(null);
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to delete branch.' });
        setDeletingBranch(null);
      }
    });
  };

  const handleToggleSemester = (s: Semester) => {
    const nextActive = !s.is_active;
    setSemesterList((prev) =>
      prev.map((item) => (item.id === s.id ? { ...item, is_active: nextActive } : item))
    );

    startTransition(async () => {
      const res = await updateAcademicLevelAction(s.id, {
        name: s.name,
        year_number: s.year_number || undefined,
        semester_number: s.semester_number || undefined,
        class_number: s.class_number || undefined,
        level_number: s.level_number || undefined,
        is_active: nextActive,
        collegeId: activeCollegeId,
      });
      if (!res.success) {
        setSemesterList((prev) =>
          prev.map((item) => (item.id === s.id ? { ...item, is_active: s.is_active } : item))
        );
        setMessage({ type: 'error', text: res.error || 'Failed to update academic level.' });
      }
    });
  };

  const handleCreateAcademicLevel = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const targetProg = programmeList.find((p) => p.id === selectedProgIdForAdd) || programmeList[0];
    if (!targetProg) {
      setMessage({ type: 'error', text: 'Please select an academic programme first.' });
      return;
    }

    startTransition(async () => {
      const isClass = targetProg.level_type === 'CLASS';
      const autoName = levelName.trim() || (isClass ? `Class ${levelNumber}` : `Semester ${levelNumber}`);

      const res = await createAcademicLevelAction({
        programmeId: targetProg.id,
        name: autoName,
        levelNumber,
        levelType: targetProg.level_type,
        yearNumber: isClass ? levelNumber : levelYearNumber,
        semesterNumber: isClass ? undefined : levelNumber,
        classNumber: isClass ? levelNumber : undefined,
        is_active: true,
        collegeId: activeCollegeId,
      });

      if (res.success && res.level) {
        setMessage({ type: 'success', text: `Added ${res.level.name} to ${targetProg.name}.` });
        setSemesterList((prev) => [...prev, res.level as Semester]);
        setLevelNumber((prev) => prev + 1);
        setLevelName('');
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to add academic level.' });
      }
    });
  };

  const handleBulkSetupProgrammes = () => {
    if (selectedPresets.length === 0 && !showCustomPreset) {
      setMessage({ type: 'error', text: 'Please select at least one academic programme preset.' });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const customPayload = showCustomPreset && customProgName.trim() && customProgCode.trim() ? {
        name: customProgName.trim(),
        code: customProgCode.trim().toUpperCase(),
        programme_type: customProgType,
        duration_years: Number(customProgDuration),
        level_type: customProgLevelType,
        has_branches: customProgHasBranches,
        totalLevels: Number(customProgTotalLevels),
      } : undefined;

      const res = await bulkSetupAcademicProgrammesAction({
        presetCodes: selectedPresets,
        customProgramme: customPayload,
        collegeId: activeCollegeId,
      });

      if (res.success && res.levels) {
        setMessage({
          type: 'success',
          text: `Configured programmes successfully! Added ${res.createdLevelsCount} new academic level(s).`,
        });
        setSemesterList(res.levels as Semester[]);
        if (res.programmes) setProgrammeList(res.programmes);
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to configure academic programmes.' });
      }
    });
  };

  const handleDeleteSemesterConfirm = () => {
    if (!deletingSemester) return;
    setMessage(null);
    startTransition(async () => {
      const res = await deleteSemesterAction(deletingSemester.id, activeCollegeId);
      if (res.success) {
        setMessage({
          type: 'success',
          text: `Academic level "${deletingSemester.name}" deleted successfully.`,
        });
        setSemesterList((prev) => prev.filter((s) => s.id !== deletingSemester.id));
        setDeletingSemester(null);
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to delete academic level.' });
        setDeletingSemester(null);
      }
    });
  };

  // Filtered Academic Levels
  const filteredLevels = useMemo(() => {
    return semesterList.filter((lev: any) => {
      const isClass =
        lev.level_type === 'CLASS' ||
        Boolean(lev.class_number) ||
        (typeof lev.name === 'string' && /^class\b/i.test(lev.name.trim()));

      // Programme filter
      if (levelProgFilter !== 'ALL') {
        const progId = lev.programme_id || lev.programme?.id;
        const progCode = lev.programme?.code?.toUpperCase();
        const btechProg = programmeList.find((p) => p.code.toUpperCase() === 'BTECH');

        if (!progId && !isClass) {
          // Legacy records without explicit programme_id default to B.Tech
          if (btechProg && levelProgFilter !== btechProg.id && levelProgFilter !== 'BTECH') {
            return false;
          }
        } else if (progId !== levelProgFilter && progCode !== levelProgFilter) {
          return false;
        }
      }
      // Level type filter (SEMESTER, CLASS, CUSTOM)
      if (levelTypeFilter !== 'ALL') {
        const type = isClass ? 'CLASS' : (lev.level_type || 'SEMESTER');
        if (type !== levelTypeFilter) return false;
      }
      // Status filter
      if (levelStatusFilter === 'ACTIVE' && !lev.is_active) return false;
      if (levelStatusFilter === 'INACTIVE' && lev.is_active) return false;
      // Search
      if (levelSearchQuery.trim()) {
        const q = levelSearchQuery.toLowerCase();
        const mName = (lev.name || '').toLowerCase().includes(q);
        const mProg = (lev.programme?.name || (isClass ? 'School' : 'B.Tech')).toLowerCase().includes(q);
        const mCode = (lev.code || '').toLowerCase().includes(q);
        return mName || mProg || mCode;
      }
      return true;
    });
  }, [semesterList, levelProgFilter, levelTypeFilter, levelStatusFilter, levelSearchQuery, programmeList]);

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0">
      {/* Sub-Navigation Tabs */}
      <div className="bg-white p-1.5 sm:p-2 rounded-2xl border border-slate-200 shadow-xs flex overflow-x-auto no-scrollbar gap-1.5 w-full max-w-full min-w-0 touch-pan-x sm:flex-wrap">
        {[
          { id: 'faculties', label: `Faculties (${facultyTotal})`, icon: Users },
          { id: 'subjects', label: `Subjects (${subjectTotal})`, icon: BookOpen },
          { id: 'assignments', label: `Assignments (${assignTotal})`, icon: GraduationCap },
          { id: 'years', label: `Academic Years (${yearList.length})`, icon: Calendar },
          { id: 'branches', label: `Branches (${branchList.length})`, icon: Layers },
          { id: 'semesters', label: `Academic Levels (${semesterList.length})`, icon: Layers },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              suppressHydrationWarning
              onClick={() => handleSubTabChange(tab.id as AcademicSubTab)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 min-h-[40px] sm:min-h-[36px] ${
                isActive
                  ? 'bg-bce-navy text-amber-400 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {/* 1. FACULTIES SUBTAB */}
      {activeSubTab === 'faculties' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 w-full min-w-0">
          {/* Add Faculty Form */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 min-w-0 w-full">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-bce-cobalt" />
              Add New Faculty
            </h4>
            <form onSubmit={handleCreateFaculty} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Faculty Name</label>
                <input
                  type="text"
                  required
                  value={facName}
                  onChange={(e) => setFacName(e.target.value)}
                  placeholder="e.g. Dr. Anil Kumar"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-base sm:text-xs min-h-[42px] sm:min-h-[36px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Department / Branch *</label>
                <select
                  value={facDept}
                  onChange={(e) => setFacDept(e.target.value)}
                  required
                  aria-label="Department / Branch"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-base sm:text-xs min-h-[42px] sm:min-h-[36px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                >
                  <option value="">Select Branch / Discipline</option>
                  {activeBranches.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Designation</label>
                <input
                  type="text"
                  required
                  value={facDesig}
                  onChange={(e) => setFacDesig(e.target.value)}
                  placeholder="e.g. Assistant Professor / HOD"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-base sm:text-xs min-h-[42px] sm:min-h-[36px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Employee ID (Optional)</label>
                <input
                  type="text"
                  value={facEmpId}
                  onChange={(e) => setFacEmpId(e.target.value)}
                  placeholder="e.g. EMP-101"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-base sm:text-xs min-h-[42px] sm:min-h-[36px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2.5 px-4 min-h-[44px] rounded-xl bg-bce-cobalt hover:bg-bce-navy text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{isPending ? 'Adding Faculty...' : 'Add Faculty'}</span>
              </button>
            </form>
          </div>

          {/* Faculty List with Fast Search, Filter & Pagination */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col min-w-0 w-full">
            {/* Filter / Search Header */}
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/40 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={facultySearch}
                  onChange={(e) => setFacultySearch(e.target.value)}
                  placeholder="Search faculty..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-base sm:text-xs min-h-[38px] sm:min-h-[32px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-bce-cobalt"
                />
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
                <select
                  value={facultyDeptFilter}
                  onChange={(e) => {
                    setFacultyDeptFilter(e.target.value);
                    setFacultyPage(1);
                  }}
                  aria-label="Filter Department"
                  className="flex-1 sm:flex-none px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-base sm:text-xs min-h-[38px] sm:min-h-[32px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-bce-cobalt"
                >
                  <option value="ALL">All Departments</option>
                  {activeBranches.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.code} - {b.name}
                    </option>
                  ))}
                </select>

                <select
                  value={facultyStatusFilter}
                  onChange={(e) => {
                    setFacultyStatusFilter(e.target.value as any);
                    setFacultyPage(1);
                  }}
                  className="flex-1 sm:flex-none px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-base sm:text-xs min-h-[38px] sm:min-h-[32px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-bce-cobalt"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-x-auto min-w-0">
              {facultyLoading ? (
                <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-bce-cobalt" />
                  <span>Loading faculties...</span>
                </div>
              ) : facultyList.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No faculty members found matching your search.
                </div>
              ) : (
                <table className="w-full text-left text-xs min-w-[580px]">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">Name</th>
                      <th className="px-4 py-2.5">Department</th>
                      <th className="px-4 py-2.5">Designation</th>
                      <th className="px-4 py-2.5">Emp ID</th>
                      <th className="px-4 py-2.5 text-center">Status</th>
                      <th className="px-4 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {facultyList.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 font-bold text-slate-800">{f.name}</td>
                        <td className="px-4 py-2.5 text-slate-600">{f.department}</td>
                        <td className="px-4 py-2.5 text-slate-500">{f.designation}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-400">{f.employee_id || '—'}</td>
                        <td className="px-4 py-2.5 text-center">
                          <button
                            onClick={() => handleToggleFacultyActive(f)}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                              f.is_active
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            }`}
                          >
                            {f.is_active ? 'ACTIVE' : 'INACTIVE'}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditFaculty(f)}
                              className="p-1 rounded text-slate-500 hover:text-bce-cobalt hover:bg-slate-100 transition-colors"
                              title="Edit faculty member"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFaculty(f.id, f.name)}
                              className="p-1 rounded text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete faculty member"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Controls */}
            <PaginationControl
              currentPage={facultyPage}
              totalPages={Math.ceil(facultyTotal / facultyPageSize)}
              totalItems={facultyTotal}
              pageSize={facultyPageSize}
              onPageChange={setFacultyPage}
              onPageSizeChange={(sz) => {
                setFacultyPageSize(sz);
                setFacultyPage(1);
              }}
              pageSizeOptions={[10, 20, 50]}
              isLoading={facultyLoading}
            />
          </div>

          {/* Edit Faculty Modal */}
          {editingFaculty && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Edit2 className="w-4 h-4 text-bce-cobalt" />
                    <span>Edit Faculty Member</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setEditingFaculty(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleUpdateFacultySubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Faculty Name
                    </label>
                    <input
                      type="text"
                      required
                      value={editFacName}
                      onChange={(e) => setEditFacName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Department / Branch
                    </label>
                    <select
                      value={editFacDept}
                      onChange={(e) => setEditFacDept(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                    >
                      {activeBranches.map((b) => (
                        <option key={b.id} value={b.name}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Designation
                    </label>
                    <input
                      type="text"
                      required
                      value={editFacDesig}
                      onChange={(e) => setEditFacDesig(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Employee ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={editFacEmpId}
                      onChange={(e) => setEditFacEmpId(e.target.value)}
                      placeholder="e.g. EMP-101"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20 font-mono"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="editFacActive"
                      checked={editFacActive}
                      onChange={(e) => setEditFacActive(e.target.checked)}
                      className="w-4 h-4 text-bce-cobalt rounded border-slate-300 focus:ring-bce-cobalt/20"
                    />
                    <label htmlFor="editFacActive" className="text-xs font-medium text-slate-700 select-none cursor-pointer">
                      Active faculty member (visible for feedback & assignments)
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEditingFaculty(null)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="px-4 py-2 rounded-xl bg-bce-cobalt hover:bg-bce-navy text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                    >
                      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Save Changes</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. SUBJECTS SUBTAB */}
      {activeSubTab === 'subjects' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 w-full min-w-0">
          {/* Add Subject Form */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 min-w-0 w-full">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-bce-cobalt" />
              Add New Subject
            </h4>
            <form onSubmit={handleCreateSubject} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Subject Name</label>
                <input
                  type="text"
                  required
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="e.g. Data Structures & Algorithms"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-base sm:text-xs min-h-[42px] sm:min-h-[36px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Subject Code</label>
                <input
                  type="text"
                  required
                  value={subCode}
                  onChange={(e) => setSubCode(e.target.value)}
                  placeholder="e.g. CS-401"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-base sm:text-xs min-h-[42px] sm:min-h-[36px] text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                />
              </div>

              {programmeList.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Academic Programme</label>
                  <select
                    value={subProgId}
                    onChange={(e) => {
                      const pId = e.target.value;
                      setSubProgId(pId);
                      const selectedProg = programmeList.find((p) => p.id === pId);
                      if (selectedProg && !selectedProg.has_branches) {
                        setSubBranchId('');
                      }
                      const firstMatching = semesterList.find(
                        (s: any) => pId === 'ALL' || s.programme_id === pId || s.programme?.id === pId
                      );
                      if (firstMatching) setSubSemesterId(firstMatching.id);
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-base sm:text-xs min-h-[42px] sm:min-h-[36px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                  >
                    <option value="ALL">All Programmes</option>
                    {programmeList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.level_type === 'CLASS' ? 'School' : `${p.duration_years} Yrs`})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Academic Level (Semester / Class)
                </label>
                <select
                  value={subSemesterId}
                  onChange={(e) => setSubSemesterId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-base sm:text-xs min-h-[42px] sm:min-h-[36px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                >
                  <option value="">Any Academic Level</option>
                  {semesterList
                    .filter(
                      (s: any) =>
                        subProgId === 'ALL' ||
                        s.programme_id === subProgId ||
                        s.programme?.id === subProgId
                    )
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.programme?.name ? `${s.programme.name} • ` : ''}
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Branch / Discipline</label>
                {(() => {
                  const currentProg = programmeList.find((p) => p.id === subProgId);
                  const isBranchless = currentProg && !currentProg.has_branches;
                  if (isBranchless) {
                    return (
                      <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-500 italic">
                        Not Applicable ({currentProg.name} curriculum has no branches)
                      </div>
                    );
                  }
                  return (
                    <select
                      value={subBranchId}
                      onChange={(e) => setSubBranchId(e.target.value)}
                      aria-label="Branch / Discipline"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-base sm:text-xs min-h-[42px] sm:min-h-[36px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                    >
                      <option value="">Common / All Branches</option>
                      {activeBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  );
                })()}
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2.5 px-4 min-h-[44px] rounded-xl bg-bce-cobalt hover:bg-bce-navy text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{isPending ? 'Adding Subject...' : 'Add Subject'}</span>
              </button>
            </form>
          </div>

          {/* Subjects List */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col min-w-0 w-full">
            {/* Filter Header */}
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/40 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                  placeholder="Code or name..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-base sm:text-xs min-h-[38px] sm:min-h-[32px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-bce-cobalt"
                />
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
                <select
                  value={subjectBranchFilter}
                  onChange={(e) => {
                    setSubjectBranchFilter(e.target.value);
                    setSubjectPage(1);
                  }}
                  aria-label="Filter Branch"
                  className="flex-1 sm:flex-none px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-base sm:text-xs min-h-[38px] sm:min-h-[32px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-bce-cobalt"
                >
                  <option value="ALL">All Branches</option>
                  {activeBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code}
                    </option>
                  ))}
                </select>

                <select
                  value={subjectSemesterFilter}
                  onChange={(e) => {
                    setSubjectSemesterFilter(e.target.value);
                    setSubjectPage(1);
                  }}
                  className="flex-1 sm:flex-none px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-base sm:text-xs min-h-[38px] sm:min-h-[32px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-bce-cobalt"
                >
                  <option value="ALL">All Semesters</option>
                  {semesterList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <select
                  value={subjectStatusFilter}
                  onChange={(e) => {
                    setSubjectStatusFilter(e.target.value as any);
                    setSubjectPage(1);
                  }}
                  className="flex-1 sm:flex-none px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-base sm:text-xs min-h-[38px] sm:min-h-[32px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-bce-cobalt"
                >
                  <option value="ALL">All</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-x-auto">
              {subjectLoading ? (
                <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-bce-cobalt" />
                  <span>Loading subjects...</span>
                </div>
              ) : subjectList.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No subjects registered matching your criteria.
                </div>
              ) : (
                <table className="w-full text-left text-xs min-w-[560px]">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">Code</th>
                      <th className="px-4 py-2.5">Subject Name</th>
                      <th className="px-4 py-2.5">Branch</th>
                      <th className="px-4 py-2.5">Semester</th>
                      <th className="px-4 py-2.5 text-center">Status</th>
                      <th className="px-4 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {subjectList.map((s) => {
                      const branch = branchList.find((b) => b.id === s.branch_id);
                      const sem = semesterList.find((sm) => sm.id === s.semester_id);
                      return (
                        <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2.5 font-mono font-bold text-slate-800">{s.code}</td>
                          <td className="px-4 py-2.5 font-semibold text-slate-800">{s.name}</td>
                          <td className="px-4 py-2.5 text-slate-600">{branch?.code || 'All'}</td>
                          <td className="px-4 py-2.5 text-slate-500">{sem?.name || '—'}</td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              onClick={() => handleToggleSubjectActive(s)}
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                                s.is_active
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                              }`}
                            >
                              {s.is_active ? 'ACTIVE' : 'INACTIVE'}
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditSubject(s)}
                                className="p-1 rounded text-slate-500 hover:text-bce-cobalt hover:bg-slate-100 transition-colors"
                                title="Edit subject"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSubject(s.id, s.name)}
                                className="p-1 rounded text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Delete subject"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Controls */}
            <PaginationControl
              currentPage={subjectPage}
              totalPages={Math.ceil(subjectTotal / subjectPageSize)}
              totalItems={subjectTotal}
              pageSize={subjectPageSize}
              onPageChange={setSubjectPage}
              onPageSizeChange={(sz) => {
                setSubjectPageSize(sz);
                setSubjectPage(1);
              }}
              pageSizeOptions={[10, 20, 50]}
              isLoading={subjectLoading}
            />
          </div>

          {/* Edit Subject Modal */}
          {editingSubject && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Edit2 className="w-4 h-4 text-bce-cobalt" />
                    <span>Edit Course Subject</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setEditingSubject(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleUpdateSubjectSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Subject Name
                    </label>
                    <input
                      type="text"
                      required
                      value={editSubName}
                      onChange={(e) => setEditSubName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Subject Code
                    </label>
                    <input
                      type="text"
                      required
                      value={editSubCode}
                      onChange={(e) => setEditSubCode(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 uppercase font-mono focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Branch / Discipline
                    </label>
                    <select
                      value={editSubBranchId}
                      onChange={(e) => setEditSubBranchId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                    >
                      <option value="">All Branches</option>
                      {activeBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Semester
                    </label>
                    <select
                      value={editSubSemesterId}
                      onChange={(e) => setEditSubSemesterId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                    >
                      <option value="">Select Semester</option>
                      {semesterList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="editSubActive"
                      checked={editSubActive}
                      onChange={(e) => setEditSubActive(e.target.checked)}
                      className="w-4 h-4 text-bce-cobalt rounded border-slate-300 focus:ring-bce-cobalt/20"
                    />
                    <label htmlFor="editSubActive" className="text-xs font-medium text-slate-700 select-none cursor-pointer">
                      Active course subject
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEditingSubject(null)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="px-4 py-2 rounded-xl bg-bce-cobalt hover:bg-bce-navy text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                    >
                      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Save Changes</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. ASSIGNMENTS SUBTAB */}
      {activeSubTab === 'assignments' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 w-full min-w-0">
          {/* Add Assignment Form with SearchableSelect */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 min-w-0 w-full">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-bce-cobalt" />
              Assign Faculty to Subject
            </h4>
            <form onSubmit={handleCreateAssignment} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Faculty Member</label>
                <SearchableSelect
                  options={facultyOptions}
                  value={assignFacultyId}
                  onChange={setAssignFacultyId}
                  placeholder="Choose faculty..."
                  searchPlaceholder="Search faculty by name..."
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-600">Subject</label>
                  <button
                    type="button"
                    onClick={() => setFilterAssignSubjectsByBranchSem((prev) => !prev)}
                    className="text-[11px] text-bce-cobalt hover:underline cursor-pointer font-medium"
                    title={filterAssignSubjectsByBranchSem ? `Show all ${allSubjects.length} subjects` : 'Show only subjects matching selected branch & semester'}
                  >
                    {filterAssignSubjectsByBranchSem ? `Show all (${allSubjects.length})` : 'Filter by Branch/Sem'}
                  </button>
                </div>
                <SearchableSelect
                  options={subjectOptions}
                  value={assignSubjectId}
                  onChange={handleAssignSubjectSelect}
                  placeholder="Choose subject..."
                  searchPlaceholder="Search subject by code, name, branch or sem..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Academic Session</label>
                <select
                  value={assignYearId}
                  onChange={(e) => setAssignYearId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-base sm:text-xs min-h-[42px] sm:min-h-[36px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                >
                  {yearList.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name} {y.is_active ? '(Active)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Branch / Discipline</label>
                <select
                  value={assignBranchId}
                  onChange={(e) => setAssignBranchId(e.target.value)}
                  aria-label="Branch / Discipline"
                  disabled={activeBranches.length === 0}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-base sm:text-xs min-h-[42px] sm:min-h-[36px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {!assignBranchId && (
                    <option value="" disabled>
                      Select Branch / Discipline
                    </option>
                  )}
                  {activeBranches.length === 0 ? (
                    <option value="" disabled>
                      No active branches available
                    </option>
                  ) : (
                    activeBranches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Semester</label>
                <select
                  value={assignSemesterId}
                  onChange={(e) => setAssignSemesterId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-base sm:text-xs min-h-[42px] sm:min-h-[36px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                >
                  {semesterList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2.5 px-4 min-h-[44px] rounded-xl bg-bce-cobalt hover:bg-bce-navy text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{isPending ? 'Assigning Faculty...' : 'Assign Faculty'}</span>
              </button>
            </form>
          </div>

          {/* Assignments List */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col min-w-0 w-full">
            {/* Filter Header */}
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/40 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div className="text-xs font-bold text-slate-700">Filter Assignments:</div>
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
                <select
                  value={assignYearFilter}
                  onChange={(e) => {
                    setAssignYearFilter(e.target.value);
                    setAssignPage(1);
                  }}
                  className="flex-1 sm:flex-none px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-base sm:text-xs min-h-[38px] sm:min-h-[32px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-bce-cobalt"
                >
                  <option value="ALL">All Sessions</option>
                  {yearList.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </select>

                <select
                  value={assignBranchFilter}
                  onChange={(e) => {
                    setAssignBranchFilter(e.target.value);
                    setAssignPage(1);
                  }}
                  aria-label="Filter Branch"
                  className="flex-1 sm:flex-none px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-base sm:text-xs min-h-[38px] sm:min-h-[32px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-bce-cobalt"
                >
                  <option value="ALL">All Branches</option>
                  {activeBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code}
                    </option>
                  ))}
                </select>

                <select
                  value={assignSemesterFilter}
                  onChange={(e) => {
                    setAssignSemesterFilter(e.target.value);
                    setAssignPage(1);
                  }}
                  className="flex-1 sm:flex-none px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-base sm:text-xs min-h-[38px] sm:min-h-[32px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-bce-cobalt"
                >
                  <option value="ALL">All Semesters</option>
                  {semesterList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-x-auto">
              {assignLoading ? (
                <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-bce-cobalt" />
                  <span>Loading assignments...</span>
                </div>
              ) : assignmentList.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No faculty assignments configured for the selected filters.
                </div>
              ) : (
                <table className="w-full text-left text-xs min-w-[560px]">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">Faculty</th>
                      <th className="px-4 py-2.5">Subject</th>
                      <th className="px-4 py-2.5">Session</th>
                      <th className="px-4 py-2.5">Branch</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {assignmentList.map((a) => {
                      const faculty = a.faculty || allFaculties.find((f) => f.id === a.faculty_id);
                      const subject = a.subject || allSubjects.find((s) => s.id === a.subject_id);
                      const year = a.academic_year || yearList.find((y) => y.id === a.academic_year_id);
                      const branch = a.branch || branchList.find((b) => b.id === a.branch_id);
                      return (
                        <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2.5 font-bold text-slate-800">{faculty?.name || 'Faculty'}</td>
                          <td className="px-4 py-2.5 text-slate-700">{subject?.name || 'Subject'}</td>
                          <td className="px-4 py-2.5 text-slate-500 font-mono">{year?.name || '—'}</td>
                          <td className="px-4 py-2.5 text-slate-500">{branch?.code || 'All'}</td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditAssignment(a)}
                                className="p-1 rounded text-slate-500 hover:text-bce-cobalt hover:bg-slate-100 transition-colors"
                                title="Edit Assignment"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAssignment(a.id)}
                                className="p-1 rounded text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Delete Assignment"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Controls */}
            <PaginationControl
              currentPage={assignPage}
              totalPages={Math.ceil(assignTotal / assignPageSize)}
              totalItems={assignTotal}
              pageSize={assignPageSize}
              onPageChange={setAssignPage}
              onPageSizeChange={(sz) => {
                setAssignPageSize(sz);
                setAssignPage(1);
              }}
              pageSizeOptions={[10, 20, 50]}
              isLoading={assignLoading}
            />
          </div>

          {/* Edit Assignment Modal */}
          {editingAssignment && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Edit2 className="w-4 h-4 text-bce-cobalt" />
                    <span>Edit Course Assignment</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setEditingAssignment(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleUpdateAssignmentSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Faculty Member
                    </label>
                    <select
                      value={editAssignFacultyId}
                      onChange={(e) => setEditAssignFacultyId(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                    >
                      {allFaculties.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.department || 'General'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Course Subject
                    </label>
                    <select
                      value={editAssignSubjectId}
                      onChange={(e) => {
                        const newSubId = e.target.value;
                        setEditAssignSubjectId(newSubId);
                        const sub = allSubjects.find((s) => s.id === newSubId);
                        if (sub) {
                          if (sub.branch_id) setEditAssignBranchId(sub.branch_id);
                          if (sub.semester_id) setEditAssignSemesterId(sub.semester_id);
                        }
                      }}
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                    >
                      {allSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Academic Session
                    </label>
                    <select
                      value={editAssignYearId}
                      onChange={(e) => setEditAssignYearId(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                    >
                      {yearList.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.name} {y.is_active ? '(Active)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Branch / Discipline
                    </label>
                    <select
                      value={editAssignBranchId}
                      onChange={(e) => setEditAssignBranchId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                    >
                      <option value="">All Branches</option>
                      {activeBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Semester
                    </label>
                    <select
                      value={editAssignSemesterId}
                      onChange={(e) => setEditAssignSemesterId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                    >
                      <option value="">All Semesters</option>
                      {semesterList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="editAssignActive"
                      checked={editAssignActive}
                      onChange={(e) => setEditAssignActive(e.target.checked)}
                      className="w-4 h-4 text-bce-cobalt rounded border-slate-300 focus:ring-bce-cobalt/20"
                    />
                    <label htmlFor="editAssignActive" className="text-xs font-medium text-slate-700 select-none cursor-pointer">
                      Active course assignment
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEditingAssignment(null)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="px-4 py-2 rounded-xl bg-bce-cobalt hover:bg-bce-navy text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                    >
                      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Save Changes</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. ACADEMIC YEARS SUBTAB */}
      {activeSubTab === 'years' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 w-full min-w-0">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 min-w-0 w-full">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-bce-cobalt" />
              Add Academic Year
            </h4>
            <form onSubmit={handleCreateYear} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Session Name</label>
                <input
                  type="text"
                  required
                  value={yearName}
                  onChange={(e) => setYearName(e.target.value)}
                  placeholder="e.g. 2026-2027"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-base sm:text-xs min-h-[42px] sm:min-h-[36px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="yrActive"
                  checked={yearActive}
                  onChange={(e) => setYearActive(e.target.checked)}
                  className="rounded border-slate-300 text-bce-cobalt focus:ring-bce-cobalt"
                />
                <label htmlFor="yrActive" className="text-xs text-slate-700 font-medium">
                  Set as Active Session
                </label>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2.5 px-4 min-h-[44px] rounded-xl bg-bce-cobalt hover:bg-bce-navy text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{isPending ? 'Adding Year...' : 'Add Year'}</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden min-w-0 w-full">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">Academic Sessions ({yearList.length})</h4>
            </div>
            <div className="overflow-x-auto min-w-0">
            <table className="w-full text-left text-xs min-w-[360px]">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Session Name</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Toggle Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {yearList.map((y) => (
                  <tr key={y.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-bold text-slate-800">{y.name}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          y.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {y.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleToggleYear(y)}
                        className="text-bce-cobalt hover:underline text-xs font-semibold cursor-pointer"
                      >
                        {y.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. BRANCHES SUBTAB */}
      {activeSubTab === 'branches' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 w-full min-w-0">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 min-w-0 w-full">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-bce-cobalt" />
              Add Engineering Branch
            </h4>
            <form onSubmit={handleCreateBranch} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Branch Name</label>
                <input
                  type="text"
                  required
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="e.g. Artificial Intelligence & Data Science"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-base sm:text-xs min-h-[42px] sm:min-h-[36px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Branch Code</label>
                <input
                  type="text"
                  required
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value)}
                  placeholder="e.g. AI-DS"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-base sm:text-xs min-h-[42px] sm:min-h-[36px] text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2.5 px-4 min-h-[44px] rounded-xl bg-bce-cobalt hover:bg-bce-navy text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{isPending ? 'Adding Branch...' : 'Add Branch'}</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden min-w-0 w-full">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">Engineering Branches ({branchList.length})</h4>
            </div>
            <div className="overflow-x-auto min-w-0">
            <table className="w-full text-left text-xs min-w-[480px]">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3">Branch Name</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branchList.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-mono font-bold text-slate-800">{b.code}</td>
                    <td className="px-5 py-3 font-semibold text-slate-800">{b.name}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          b.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {b.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditBranch(b)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                          title="Edit Branch"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleBranch(b)}
                          className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors ${
                            b.is_active
                              ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                              : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                          }`}
                        >
                          {b.is_active ? 'Deactivate' : 'Activate'}
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeletingBranch(b)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete Branch"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {/* Edit Branch Modal */}
          {editingBranch && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Edit2 className="w-4 h-4 text-bce-cobalt" />
                    <span>Edit Engineering Branch</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setEditingBranch(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleUpdateBranchSubmit} className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Branch Name
                    </label>
                    <input
                      type="text"
                      required
                      value={editBranchName}
                      onChange={(e) => setEditBranchName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Branch Code
                    </label>
                    <input
                      type="text"
                      required
                      value={editBranchCode}
                      onChange={(e) => setEditBranchCode(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="editBranchActive"
                      checked={editBranchActive}
                      onChange={(e) => setEditBranchActive(e.target.checked)}
                      className="w-4 h-4 text-bce-cobalt rounded border-slate-300 focus:ring-bce-cobalt/20"
                    />
                    <label htmlFor="editBranchActive" className="text-xs font-medium text-slate-700 select-none cursor-pointer">
                      Active engineering branch
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingBranch(null)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="px-4 py-2 rounded-xl bg-bce-cobalt hover:bg-bce-navy text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                    >
                      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Save Changes</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Delete Branch Confirmation Modal */}
          {deletingBranch && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
                <div className="p-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
                  <h4 className="text-sm font-bold text-rose-900 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>Confirm Branch Deletion</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setDeletingBranch(null)}
                    className="p-1 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-100 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-3 text-xs text-slate-600">
                  <p className="text-slate-800 font-medium">
                    Are you sure you want to permanently delete the branch:
                  </p>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 flex items-center justify-between">
                    <span>{deletingBranch.name}</span>
                    <span className="font-mono text-xs px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md">
                      {deletingBranch.code}
                    </span>
                  </div>
                  <p className="text-rose-600 text-[11px] leading-relaxed">
                    ⚠️ Deletion is permanently blocked if any feedback forms, subjects, faculty members, or teaching assignments are linked to this branch.
                  </p>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDeletingBranch(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteBranchConfirm}
                    disabled={isPending}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                  >
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    <span>Delete Branch</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. ACADEMIC LEVELS SUBTAB */}
      {activeSubTab === 'semesters' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Quick Multi-Select Setup & Manual Add Level */}
            <div className="space-y-6 lg:col-span-1">
              {/* Quick Academic Setup Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Zap className="w-4 h-4 fill-amber-500 text-amber-500" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Quick Academic Setup</h4>
                      <p className="text-[11px] text-slate-500">Multi-select standard programme & level generator</p>
                    </div>
                  </div>
                </div>

                {/* Multi-select presets list */}
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                    Supported Programmes
                  </span>

                  {[
                    { code: 'BTECH', name: 'B.Tech', duration: '4 Years · 8 Semesters', badge: 'UG' },
                    { code: 'MTECH', name: 'M.Tech', duration: '2 Years · 4 Semesters', badge: 'PG' },
                    { code: 'BE', name: 'B.E.', duration: '4 Years · 8 Semesters', badge: 'UG' },
                    { code: 'DIPLOMA', name: 'Diploma', duration: '3 Years · 6 Semesters', badge: 'DIPLOMA' },
                    { code: 'SCHOOL', name: 'School', duration: 'Classes 1–12 (No Semesters)', badge: 'K-12' },
                  ].map((preset) => {
                    const isSelected = selectedPresets.includes(preset.code);
                    const matchingProg = programmeList.find((p) => p.code.toUpperCase() === preset.code);
                    const levelCount = semesterList.filter((s: any) => {
                      if (matchingProg && (s.programme_id === matchingProg.id || s.programme?.id === matchingProg.id)) {
                        return true;
                      }
                      const isClassItem =
                        s.level_type === 'CLASS' ||
                        Boolean(s.class_number) ||
                        (typeof s.name === 'string' && /^class\b/i.test(s.name.trim()));
                      if (preset.code === 'BTECH') {
                        return !isClassItem && (!s.programme_id || s.programme_id === matchingProg?.id);
                      }
                      if (preset.code === 'SCHOOL') {
                        return isClassItem;
                      }
                      return false;
                    }).length;

                    return (
                      <div
                        key={preset.code}
                        onClick={() => {
                          setSelectedPresets((prev) =>
                            isSelected ? prev.filter((c) => c !== preset.code) : [...prev, preset.code]
                          );
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-50/70 border-bce-cobalt/40 shadow-2xs'
                            : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // Controlled via parent div onClick
                            className="w-4 h-4 rounded text-bce-cobalt focus:ring-bce-cobalt pointer-events-none"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">{preset.name}</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-200/80 text-slate-700">
                                {preset.badge}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 block">{preset.duration}</span>
                          </div>
                        </div>

                        {levelCount > 0 ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            {levelCount} configured
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">Ready</span>
                        )}
                      </div>
                    );
                  })}

                  {/* Custom Programme Toggle */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowCustomPreset(!showCustomPreset)}
                      className="text-xs font-bold text-bce-cobalt hover:text-bce-navy flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{showCustomPreset ? 'Hide Custom Programme' : '+ Add Custom Programme'}</span>
                    </button>

                    {showCustomPreset && (
                      <div className="mt-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in duration-150">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Programme Name</label>
                            <input
                              type="text"
                              value={customProgName}
                              onChange={(e) => setCustomProgName(e.target.value)}
                              placeholder="e.g. B.Arch"
                              className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Code</label>
                            <input
                              type="text"
                              value={customProgCode}
                              onChange={(e) => setCustomProgCode(e.target.value)}
                              placeholder="e.g. BARCH"
                              className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg uppercase font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Level Type</label>
                            <select
                              value={customProgLevelType}
                              onChange={(e) => setCustomProgLevelType(e.target.value as any)}
                              className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                            >
                              <option value="SEMESTER">Semesters</option>
                              <option value="CLASS">Classes (School)</option>
                              <option value="CUSTOM">Custom Terms</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Total Levels</label>
                            <input
                              type="number"
                              min="1"
                              max="20"
                              value={customProgTotalLevels}
                              onChange={(e) => setCustomProgTotalLevels(Number(e.target.value) || 1)}
                              className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="customProgBranches"
                            checked={customProgHasBranches}
                            onChange={(e) => setCustomProgHasBranches(e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-bce-cobalt"
                          />
                          <label htmlFor="customProgBranches" className="text-[11px] font-medium text-slate-700 cursor-pointer">
                            Has branches / disciplines (e.g. CSE, ECE)
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleBulkSetupProgrammes}
                  disabled={isPending || (selectedPresets.length === 0 && !showCustomPreset)}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-98"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />}
                  <span>Apply & Generate Academic Levels</span>
                </button>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Generates all missing academic levels in ONE operation. Existing records are preserved without duplication. School uses Classes 1–12 without fake semesters.
                </p>
              </div>

              {/* Manual Add Academic Level Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-bce-cobalt" />
                  <span>Add Single Academic Level</span>
                </h4>
                <form onSubmit={handleCreateAcademicLevel} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Academic Programme
                    </label>
                    <select
                      value={selectedProgIdForAdd}
                      onChange={(e) => {
                        const pid = e.target.value;
                        setSelectedProgIdForAdd(pid);
                        const prog = programmeList.find((p) => p.id === pid);
                        if (prog?.level_type === 'CLASS') {
                          setLevelName(`Class ${levelNumber}`);
                        } else {
                          setLevelName(`Semester ${levelNumber}`);
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                    >
                      {programmeList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.level_type === 'CLASS' ? 'School Classes' : `${p.duration_years} Yrs`})
                        </option>
                      ))}
                    </select>
                  </div>

                  {(() => {
                    const currentProg = programmeList.find((p) => p.id === selectedProgIdForAdd) || programmeList[0];
                    const isClass = currentProg?.level_type === 'CLASS';

                    if (isClass) {
                      return (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Class Number
                            </label>
                            <select
                              value={levelNumber}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                setLevelNumber(n);
                                setLevelName(`Class ${n}`);
                              }}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                            >
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((cn) => (
                                <option key={cn} value={cn}>
                                  Class {cn}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Display Name
                            </label>
                            <input
                              type="text"
                              required
                              value={levelName}
                              onChange={(e) => setLevelName(e.target.value)}
                              placeholder="e.g. Class 10"
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                            />
                          </div>
                        </div>
                      );
                    }

                    return (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Semester #
                            </label>
                            <select
                              value={levelNumber}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                setLevelNumber(n);
                                setLevelYearNumber(Math.ceil(n / 2));
                                setLevelName(`Semester ${n}`);
                              }}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                            >
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((sn) => (
                                <option key={sn} value={sn}>
                                  Semester {sn}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Year Level
                            </label>
                            <select
                              value={levelYearNumber}
                              onChange={(e) => setLevelYearNumber(Number(e.target.value))}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                            >
                              {[1, 2, 3, 4, 5].map((y) => (
                                <option key={y} value={y}>
                                  Year {y}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Display Name
                          </label>
                          <input
                            type="text"
                            required
                            value={levelName}
                            onChange={(e) => setLevelName(e.target.value)}
                            placeholder="e.g. Semester 1"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                          />
                        </div>
                      </>
                    );
                  })()}

                  <button
                    type="submit"
                    disabled={isPending || !levelName.trim()}
                    className="w-full mt-2 bg-bce-cobalt hover:bg-bce-navy text-white text-xs font-bold py-2.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>Add Academic Level</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column: Configured Academic Levels Table with Filters */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden lg:col-span-2 min-w-0 flex flex-col">
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Configured Academic Levels ({filteredLevels.length})
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Levels available for subjects, feedback forms & examination scopes
                  </p>
                </div>
                {semesterList.length > 0 && (
                  <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full self-start sm:self-auto">
                    {semesterList.filter((s) => s.is_active).length} Active of {semesterList.length}
                  </span>
                )}
              </div>

              {/* Filters Bar */}
              <div className="p-3.5 bg-slate-50/70 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div>
                  <select
                    value={levelProgFilter}
                    onChange={(e) => setLevelProgFilter(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700"
                  >
                    <option value="ALL">All Programmes</option>
                    {programmeList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <select
                    value={levelTypeFilter}
                    onChange={(e) => setLevelTypeFilter(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700"
                  >
                    <option value="ALL">All Types</option>
                    <option value="SEMESTER">Semesters</option>
                    <option value="CLASS">School Classes</option>
                  </select>
                </div>

                <div>
                  <select
                    value={levelStatusFilter}
                    onChange={(e) => setLevelStatusFilter(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>

                <div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={levelSearchQuery}
                      onChange={(e) => setLevelSearchQuery(e.target.value)}
                      placeholder="Search level..."
                      className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400"
                    />
                  </div>
                </div>
              </div>

              {filteredLevels.length === 0 ? (
                <div className="p-8 text-center space-y-3 flex-1 flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-slate-800">No Academic Levels Found</h5>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Use the quick setup cards on the left to configure your college or school curriculum structure.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto min-w-0 flex-1">
                  <table className="w-full text-left text-xs min-w-[550px]">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100 uppercase tracking-wider">
                      <tr>
                        <th className="px-5 py-3">Programme</th>
                        <th className="px-5 py-3">Academic Level</th>
                        <th className="px-5 py-3">Year Level</th>
                        <th className="px-5 py-3">Type & #</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredLevels.map((lev: any) => {
                        const isClass =
                          lev.level_type === 'CLASS' ||
                          Boolean(lev.class_number) ||
                          (typeof lev.name === 'string' && /^class\b/i.test(lev.name.trim()));

                        const progName =
                          lev.programme?.name ||
                          (isClass ? 'School' : 'B.Tech');

                        const progType =
                          lev.programme?.programme_type ||
                          (isClass ? 'SCHOOL' : 'UNDERGRADUATE');

                        const progBadge = isClass
                          ? 'K-12'
                          : progType === 'POSTGRADUATE'
                          ? 'PG'
                          : progType === 'DIPLOMA'
                          ? 'DIPLOMA'
                          : 'UG';

                        const computedYearNumber =
                          lev.year_number ||
                          (lev.semester_number
                            ? Math.ceil(Number(lev.semester_number) / 2)
                            : lev.level_number
                            ? Math.ceil(Number(lev.level_number) / 2)
                            : null);

                        const numMatch = typeof lev.name === 'string' ? lev.name.match(/\d+/) : null;
                        const fallbackNum = numMatch ? Number(numMatch[0]) : 1;

                        const semOrClassNum =
                          (isClass ? lev.class_number : lev.semester_number) ||
                          lev.level_number ||
                          fallbackNum;

                        return (
                          <tr key={lev.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900">{progName}</span>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                  {progBadge}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-3 font-bold text-slate-800">{lev.name}</td>
                            <td className="px-5 py-3 text-slate-600">
                              {isClass ? '—' : computedYearNumber ? `Year ${computedYearNumber}` : '—'}
                            </td>
                            <td className="px-5 py-3 text-slate-600">
                              {isClass ? `Class ${semOrClassNum}` : `Sem ${semOrClassNum}`}
                            </td>
                            <td className="px-5 py-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  lev.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {lev.is_active ? 'ACTIVE' : 'INACTIVE'}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSemester(lev)}
                                  className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                                    lev.is_active
                                      ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                                      : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                  }`}
                                >
                                  {lev.is_active ? 'Deactivate' : 'Activate'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setDeletingSemester(lev)}
                                  className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Delete Academic Level"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Delete Academic Level Confirmation Modal */}
          {deletingSemester && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
                <div className="p-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between shrink-0">
                  <h4 className="text-sm font-bold text-rose-900 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>Confirm Academic Level Deletion</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setDeletingSemester(null)}
                    className="p-1 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-3 text-xs text-slate-600">
                  <p className="text-slate-800 font-medium">
                    Are you sure you want to permanently delete:
                  </p>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 flex items-center justify-between">
                    <span>{deletingSemester.name}</span>
                    <span className="font-mono text-xs px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md">
                      {(deletingSemester.programme?.name || (deletingSemester.level_type === 'CLASS' || deletingSemester.class_number ? 'School' : 'B.Tech'))} • Level {deletingSemester.level_number || deletingSemester.semester_number || deletingSemester.class_number || 1}
                    </span>
                  </div>
                  <p className="text-rose-600 text-[11px] leading-relaxed">
                    ⚠️ Deletion is permanently blocked if any course subjects, faculty teaching assignments, feedback forms, or exams are currently linked to this academic level.
                  </p>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDeletingSemester(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteSemesterConfirm}
                    disabled={isPending}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    <span>Delete Level</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
