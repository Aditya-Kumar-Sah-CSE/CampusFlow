'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Layers,
  GitBranch,
  BookOpen,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  Save,
  Send,
  Loader2,
  FileCheck,
  GraduationCap,
  School,
  Sparkles,
} from 'lucide-react';
import { QuestionBuilder } from './QuestionBuilder';
import {
  createExamAction,
  updateExamAction,
  saveExamQuestionsAction,
  publishExamAction,
} from '@/app/admin/exams/actions';
import type { Exam, ExamQuestion } from '@/types/exams';

interface AcademicSessionItem {
  id: string;
  name: string;
  is_active: boolean;
}

export interface ProgrammeItem {
  id: string;
  name: string;
  code: string;
  programme_type?: string;
  level_type?: string;
  has_branches?: boolean;
  is_active?: boolean;
}

export interface AcademicLevelItem {
  id: string;
  name: string;
  display_name?: string | null;
  semester_number?: number | null;
  year_number?: number | null;
  class_number?: number | null;
  level_number?: number | null;
  level_type?: string;
  programme_id?: string | null;
  programme?: ProgrammeItem | null;
  number?: number;
  is_active: boolean;
}

interface BranchItem {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

interface SubjectItem {
  id: string;
  name: string;
  code: string;
  branch_id?: string;
  semester_id?: string;
  is_active: boolean;
}

interface CreateExamWizardProps {
  collegeId: string;
  academicSessions: AcademicSessionItem[];
  semesters: AcademicLevelItem[];
  branches: BranchItem[];
  subjects: SubjectItem[];
  programmes?: ProgrammeItem[];
  initialExam?: Exam | null;
}

type StepKey = 'session' | 'programme' | 'level' | 'branch' | 'config' | 'questions' | 'review';

export function CreateExamWizard({
  collegeId,
  academicSessions,
  semesters,
  branches,
  subjects,
  programmes,
  initialExam,
}: CreateExamWizardProps) {
  const router = useRouter();

  // 1. Synthesize or use programmes
  const availableProgrammes: ProgrammeItem[] = (() => {
    if (programmes && programmes.length > 0) return programmes;
    const progMap = new Map<string, ProgrammeItem>();
    for (const s of semesters) {
      if (s.programme && s.programme.id) {
        progMap.set(s.programme.id, s.programme);
      }
    }
    if (progMap.size > 0) return Array.from(progMap.values());

    const hasClass = semesters.some(s => s.level_type === 'CLASS' || Boolean(s.class_number));
    const hasSem = semesters.some(s => s.level_type === 'SEMESTER' || Boolean(s.semester_number));
    const derived: ProgrammeItem[] = [];
    if (hasSem) {
      derived.push({
        id: 'prog-btech',
        name: 'B.Tech',
        code: 'BTECH',
        programme_type: 'UNDERGRADUATE',
        level_type: 'SEMESTER',
        has_branches: true,
        is_active: true,
      });
    }
    if (hasClass) {
      derived.push({
        id: 'prog-school',
        name: 'School',
        code: 'SCHOOL',
        programme_type: 'SCHOOL',
        level_type: 'CLASS',
        has_branches: false,
        is_active: true,
      });
    }
    return derived.length > 0
      ? derived
      : [
          {
            id: 'prog-default',
            name: 'Higher Education',
            code: 'HE',
            programme_type: 'UNDERGRADUATE',
            level_type: 'SEMESTER',
            has_branches: true,
            is_active: true,
          },
        ];
  })();

  // 2. Programme selection state
  const [programmeId, setProgrammeId] = useState<string>(() => {
    if (initialExam?.semester_id) {
      const match = semesters.find(s => s.id === initialExam.semester_id);
      if (match?.programme_id) return match.programme_id;
      if (match?.level_type === 'CLASS') {
        const schoolProg = availableProgrammes.find(p => p.level_type === 'CLASS' || p.code === 'SCHOOL');
        if (schoolProg) return schoolProg.id;
      }
    }
    return availableProgrammes[0]?.id || '';
  });

  const selectedProgramme = availableProgrammes.find(p => p.id === programmeId) || availableProgrammes[0];

  // 3. Filtered levels for currently selected programme
  const availableLevels = semesters.filter(s => {
    if (!selectedProgramme) return true;
    if (s.programme_id && s.programme_id === selectedProgramme.id) return true;
    if (selectedProgramme.level_type === 'CLASS') {
      return s.level_type === 'CLASS' || Boolean(s.class_number);
    }
    if (selectedProgramme.level_type === 'SEMESTER') {
      return s.level_type !== 'CLASS' && !s.class_number;
    }
    return true;
  });

  // 4. Academic level / semester state
  const [semesterId, setSemesterId] = useState<string>(() => {
    if (initialExam?.semester_id) return initialExam.semester_id;
    return availableLevels[0]?.id || semesters[0]?.id || '';
  });

  const selectedLevel = semesters.find(s => s.id === semesterId);

  // 5. Branch applicability (School or programmes where has_branches = false NEVER show branch selector)
  const isBranchApplicable = selectedProgramme
    ? selectedProgramme.has_branches !== false
    : selectedLevel?.level_type !== 'CLASS';

  // 6. Branch selection state
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(
    initialExam?.branches?.map(b => b.id) || []
  );

  // 7. Dynamic step list
  const isSchool = selectedProgramme?.level_type === 'CLASS' || selectedLevel?.level_type === 'CLASS';

  const STEPS: { key: StepKey; label: string; icon: any }[] = [
    { key: 'session', label: 'Academic Session', icon: Calendar },
    { key: 'programme', label: 'Programme', icon: GraduationCap },
    {
      key: 'level',
      label: isSchool ? 'Class Level' : 'Academic Level',
      icon: Layers,
    },
    ...(isBranchApplicable ? [{ key: 'branch' as StepKey, label: 'Branch Scope', icon: GitBranch }] : []),
    { key: 'config', label: 'Subject & Setup', icon: BookOpen },
    { key: 'questions', label: 'Question Builder', icon: HelpCircle },
    { key: 'review', label: 'Review & Publish', icon: FileCheck },
  ];

  // Wizard active step (1-indexed)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const currentStepConfig = STEPS[currentStep - 1] || STEPS[0];
  const currentStepKey = currentStepConfig.key;

  const [savedExamId, setSavedExamId] = useState<string | null>(initialExam?.id || null);

  // Form State
  const defaultSession = academicSessions.find(s => s.is_active)?.id || academicSessions[0]?.id || '';
  const [sessionId, setSessionId] = useState<string>(initialExam?.academic_session_id || defaultSession);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>(
    initialExam?.subjects?.map(s => s.id) || []
  );

  const [title, setTitle] = useState<string>(initialExam?.title || '');
  const [examCode, setExamCode] = useState<string>(
    initialExam?.exam_code || `EXAM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [description, setDescription] = useState<string>(initialExam?.description || '');
  const [instructions, setInstructions] = useState<string>(
    initialExam?.instructions ||
      'Attempt all questions carefully.\nEach question carries the designated marks.\nThere is no negative marking unless stated.\nDo not refresh or navigate away from the test window during the active exam.'
  );

  const [durationMinutes, setDurationMinutes] = useState<number>(initialExam?.duration_minutes || 30);
  const [passingPercentage, setPassingPercentage] = useState<number>(initialExam?.passing_percentage || 40);
  const [negativeMarkingEnabled, setNegativeMarkingEnabled] = useState<boolean>(
    initialExam?.negative_marking_enabled || false
  );
  const [negativeMarks, setNegativeMarks] = useState<number>(initialExam?.negative_marks || 0.25);
  const [maxAttempts, setMaxAttempts] = useState<number>(initialExam?.max_attempts || 1);
  const [startAt, setStartAt] = useState<string>(
    initialExam?.start_at ? new Date(initialExam.start_at).toISOString().slice(0, 16) : ''
  );
  const [endAt, setEndAt] = useState<string>(
    initialExam?.end_at ? new Date(initialExam.end_at).toISOString().slice(0, 16) : ''
  );
  const [resultVisibility, setResultVisibility] = useState<any>(
    initialExam?.result_visibility || 'AFTER_SUBMISSION'
  );
  const [randomizeQuestions, setRandomizeQuestions] = useState<boolean>(
    initialExam?.randomize_questions || false
  );
  const [randomizeOptions, setRandomizeOptions] = useState<boolean>(
    initialExam?.randomize_options || false
  );
  const [showCorrectAnswers, setShowCorrectAnswers] = useState<boolean>(
    initialExam?.show_correct_answers !== undefined ? initialExam.show_correct_answers : true
  );

  // Questions State
  const [questions, setQuestions] = useState<ExamQuestion[]>(
    initialExam?.questions && initialExam.questions.length > 0
      ? initialExam.questions
      : [
          {
            id: crypto.randomUUID(),
            exam_id: '',
            question_text: '',
            explanation: '',
            marks: 1,
            difficulty: 'MEDIUM',
            topic: '',
            position: 1,
            options: [
              { id: crypto.randomUUID(), question_id: '', option_key: 'A', option_text: '', position: 1, is_correct: true },
              { id: crypto.randomUUID(), question_id: '', option_key: 'B', option_text: '', position: 2, is_correct: false },
              { id: crypto.randomUUID(), question_id: '', option_key: 'C', option_text: '', position: 3, is_correct: false },
              { id: crypto.randomUUID(), question_id: '', option_key: 'D', option_text: '', position: 4, is_correct: false },
            ],
          },
        ]
  );

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter subjects based on branch and academic level
  const filteredSubjects = subjects.filter(s => {
    if (s.semester_id && s.semester_id !== semesterId) return false;
    if (isBranchApplicable && selectedBranchIds.length > 0 && s.branch_id && !selectedBranchIds.includes(s.branch_id)) {
      return false;
    }
    return true;
  });

  const handleSelectProgramme = (prog: ProgrammeItem) => {
    setProgrammeId(prog.id);
    const matchingLevels = semesters.filter(s => {
      if (s.programme_id && s.programme_id === prog.id) return true;
      if (prog.level_type === 'CLASS') return s.level_type === 'CLASS' || Boolean(s.class_number);
      return s.level_type !== 'CLASS' && !s.class_number;
    });
    if (!matchingLevels.some(l => l.id === semesterId)) {
      setSemesterId(matchingLevels[0]?.id || '');
    }
    if (prog.has_branches === false) {
      setSelectedBranchIds([]);
    }
  };

  // Helper validation for each step before advancing
  const canAdvanceStep = (stepKey: StepKey): { can: boolean; error?: string } => {
    if (stepKey === 'session') {
      if (!sessionId) return { can: false, error: 'Please select an Academic Session.' };
    }
    if (stepKey === 'programme') {
      if (!programmeId && !selectedProgramme) return { can: false, error: 'Please select an Academic Programme.' };
    }
    if (stepKey === 'level') {
      if (!semesterId) {
        return {
          can: false,
          error: isSchool ? 'Please select a Class cohort.' : 'Please select an Academic Level / Semester cohort.',
        };
      }
    }
    if (stepKey === 'branch') {
      // Branch can be all (empty) or selected
      return { can: true };
    }
    if (stepKey === 'config') {
      if (!title.trim()) return { can: false, error: 'Please enter an Exam Title.' };
      if (selectedSubjectIds.length === 0) return { can: false, error: 'Please select at least one Subject.' };
      if (durationMinutes <= 0) return { can: false, error: 'Duration must be greater than 0 minutes.' };
    }
    if (stepKey === 'questions') {
      if (questions.length === 0) return { can: false, error: 'Exam must contain at least 1 question.' };
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.question_text.trim()) {
          return { can: false, error: `Question #${i + 1} has an empty statement.` };
        }
        if (!q.options || q.options.length < 2) {
          return { can: false, error: `Question #${i + 1} requires at least 2 options.` };
        }
        if (q.options.some(o => !o.option_text.trim())) {
          return { can: false, error: `Question #${i + 1} has one or more empty option texts.` };
        }
        if (q.options.filter(o => o.is_correct).length !== 1) {
          return { can: false, error: `Question #${i + 1} must have exactly one correct option marked.` };
        }
        if (!q.marks || q.marks <= 0) {
          return { can: false, error: `Question #${i + 1} marks must be greater than 0.` };
        }
      }
    }
    return { can: true };
  };

  const handleNextStep = async () => {
    setErrorMsg(null);
    const check = canAdvanceStep(currentStepKey);
    if (!check.can) {
      setErrorMsg(check.error || 'Please fill in all required fields.');
      return;
    }

    // Auto-save draft when passing the config step or questions step
    if (currentStepKey === 'config') {
      await saveDraftExamConfig();
    } else if (currentStepKey === 'questions') {
      await saveQuestionsToServer();
    }

    setCurrentStep(prev => Math.min(STEPS.length, prev + 1));
  };

  const handlePrevStep = () => {
    setErrorMsg(null);
    setCurrentStep(prev => Math.max(1, prev - 1));
  };

  const saveDraftExamConfig = async (): Promise<string | null> => {
    setLoading(true);
    setErrorMsg(null);
    const effectiveBranchIds = isBranchApplicable ? selectedBranchIds : [];
    try {
      if (savedExamId) {
        const res = await updateExamAction(
          {
            id: savedExamId,
            academic_session_id: sessionId,
            semester_id: semesterId,
            branch_ids: effectiveBranchIds,
            subject_ids: selectedSubjectIds,
            title,
            exam_code: examCode,
            description,
            instructions,
            duration_minutes: durationMinutes,
            passing_percentage: passingPercentage,
            negative_marking_enabled: negativeMarkingEnabled,
            negative_marks: negativeMarks,
            max_attempts: maxAttempts,
            start_at: startAt ? new Date(startAt).toISOString() : null,
            end_at: endAt ? new Date(endAt).toISOString() : null,
            result_visibility: resultVisibility,
            show_correct_answers: showCorrectAnswers,
            randomize_questions: randomizeQuestions,
            randomize_options: randomizeOptions,
            status: 'DRAFT',
          },
          collegeId
        );
        if (!res.success || !res.data) throw new Error(res.error || 'Failed to update exam draft.');
        setSuccessMsg('Exam settings draft saved.');
        return res.data.id;
      } else {
        const res = await createExamAction(
          {
            academic_session_id: sessionId,
            semester_id: semesterId,
            branch_ids: effectiveBranchIds,
            subject_ids: selectedSubjectIds,
            title,
            exam_code: examCode,
            description,
            instructions,
            duration_minutes: durationMinutes,
            passing_percentage: passingPercentage,
            negative_marking_enabled: negativeMarkingEnabled,
            negative_marks: negativeMarks,
            max_attempts: maxAttempts,
            start_at: startAt ? new Date(startAt).toISOString() : null,
            end_at: endAt ? new Date(endAt).toISOString() : null,
            result_visibility: resultVisibility,
            show_correct_answers: showCorrectAnswers,
            randomize_questions: randomizeQuestions,
            randomize_options: randomizeOptions,
            status: 'DRAFT',
          },
          collegeId
        );
        if (!res.success || !res.data) throw new Error(res.error || 'Failed to create exam draft.');
        setSavedExamId(res.data.id);
        setSuccessMsg('Exam draft created successfully.');
        return res.data.id;
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error saving exam draft.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const saveQuestionsToServer = async (): Promise<boolean> => {
    let examId = savedExamId;
    if (!examId) {
      examId = await saveDraftExamConfig();
      if (!examId) return false;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await saveExamQuestionsAction(
        {
          exam_id: examId,
          questions: questions.map((q, idx) => ({
            id: q.id,
            question_text: q.question_text.trim(),
            explanation: q.explanation?.trim() || null,
            difficulty: q.difficulty || 'MEDIUM',
            topic: q.topic?.trim() || null,
            marks: Number(q.marks) || 1,
            position: idx + 1,
            options: q.options.map((opt, optIdx) => ({
              id: opt.id,
              option_key: opt.option_key,
              option_text: opt.option_text.trim(),
              position: optIdx + 1,
              is_correct: Boolean(opt.is_correct),
            })),
          })),
        },
        collegeId
      );

      if (!res.success) throw new Error(res.error || 'Failed to save questions.');
      setSuccessMsg('Questions saved to server.');
      return true;
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error saving questions.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handlePublishExam = async () => {
    let examId = savedExamId;
    if (!examId) {
      examId = await saveDraftExamConfig();
      if (!examId) return;
    }

    const savedQ = await saveQuestionsToServer();
    if (!savedQ) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await publishExamAction(examId, collegeId);
      if (!res.success) throw new Error(res.error || 'Failed to publish exam.');

      setSuccessMsg('Exam published successfully! Eligible students can now access it.');
      setTimeout(() => {
        router.push('/admin/dashboard/exams');
      }, 1200);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error publishing exam.');
    } finally {
      setLoading(false);
    }
  };

  const totalCalculatedMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
  const passingMarksValue = ((totalCalculatedMarks * passingPercentage) / 100).toFixed(1);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Guided Stepper */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <div>
            <h1 className="text-base sm:text-lg font-extrabold text-bce-navy">
              {initialExam ? 'Edit Examination' : 'Create New Examination / Test'}
            </h1>
            <p className="text-xs text-slate-500">
              Step {currentStep} of {STEPS.length} — {currentStepConfig.label}
            </p>
          </div>
          {savedExamId && (
            <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl font-bold">
              Draft ID: {savedExamId.slice(0, 8)}...
            </span>
          )}
        </div>

        {/* Stepper Progress Chips */}
        <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-${Math.min(STEPS.length, 7)} gap-2`}>
          {STEPS.map((s, idx) => {
            const stepNum = idx + 1;
            const Icon = s.icon;
            const isDone = stepNum < currentStep;
            const isCurrent = stepNum === currentStep;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => {
                  if (stepNum < currentStep) setCurrentStep(stepNum);
                }}
                className={`flex items-center gap-2 p-2 rounded-xl text-left border transition-all text-xs cursor-pointer select-none ${
                  isCurrent
                    ? 'bg-bce-navy text-amber-300 border-bce-navy font-bold shadow-xs'
                    : isDone
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200 font-semibold hover:bg-emerald-100/60'
                      : 'bg-slate-50 text-slate-400 border-slate-200 opacity-70'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-xs font-mono font-bold ${
                    isCurrent
                      ? 'bg-amber-400 text-bce-navy'
                      : isDone
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : stepNum}
                </div>
                <span className="truncate">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs flex items-center gap-2.5 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs flex items-center gap-2.5 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {/* Step Contents */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs">
        {/* STEP: Academic Session */}
        {currentStepKey === 'session' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">Step 1 — Select Academic Session</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Choose the active academic session year for this examination.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              {academicSessions.map(sess => (
                <div
                  key={sess.id}
                  onClick={() => setSessionId(sess.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    sessionId === sess.id
                      ? 'border-bce-navy bg-blue-50/60 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">{sess.name}</span>
                    {sess.is_active && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-200">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Official Academic Session</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP: Programme */}
        {currentStepKey === 'programme' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">Step 2 — Select Academic Programme</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Select the target academic programme category (Higher Education, School, etc.).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 pt-2">
              {availableProgrammes.map(prog => {
                const isSelected = selectedProgramme?.id === prog.id;
                const isSchoolProg = prog.level_type === 'CLASS' || prog.code === 'SCHOOL';
                return (
                  <div
                    key={prog.id}
                    onClick={() => handleSelectProgramme(prog)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all relative ${
                      isSelected
                        ? 'border-bce-navy bg-blue-50/60 shadow-xs ring-2 ring-bce-navy/10'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                            isSelected
                              ? 'bg-bce-navy text-amber-300'
                              : isSchoolProg
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isSchoolProg ? <School className="w-5 h-5" /> : <GraduationCap className="w-5 h-5" />}
                        </div>
                        <div>
                          <span className="text-sm font-extrabold text-slate-900 block">{prog.name}</span>
                          <span className="font-mono text-[10px] font-semibold text-slate-400 uppercase">
                            {prog.code}
                          </span>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                          isSelected ? 'bg-bce-navy text-white border-bce-navy' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100/80 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">
                        {isSchoolProg ? 'School Classes 1–12' : 'Semester Structure'}
                      </span>
                      <span
                        className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${
                          prog.has_branches !== false
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {prog.has_branches !== false ? 'Branch Applicable' : 'No Branches Required'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP: Academic Level */}
        {currentStepKey === 'level' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                {isSchool ? 'Step 3 — Select Class' : 'Step 3 — Select Academic Level (Semester)'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isSchool
                  ? 'Choose the class level eligible for this test.'
                  : 'Choose the semester cohort applicable to this examination.'}
              </p>
            </div>

            {availableLevels.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">No levels configured for {selectedProgramme?.name}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Please generate levels in Academic Structure settings before creating exams.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
                {availableLevels.map(lvl => {
                  const isSelected = semesterId === lvl.id;
                  const label = lvl.display_name || lvl.name;
                  const isClassItem = lvl.level_type === 'CLASS' || Boolean(lvl.class_number);
                  const yearTag = !isClassItem && lvl.year_number ? `Year ${lvl.year_number}` : null;

                  return (
                    <div
                      key={lvl.id}
                      onClick={() => setSemesterId(lvl.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all text-center ${
                        isSelected
                          ? 'border-bce-navy bg-blue-50/60 shadow-xs ring-2 ring-bce-navy/10'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="font-extrabold text-slate-900 text-sm">{label}</div>
                      <div className="flex items-center justify-center gap-1.5 mt-1.5">
                        {yearTag && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                            {yearTag}
                          </span>
                        )}
                        <span className="text-[10px] font-medium text-slate-400">
                          {isClassItem ? 'School Cohort' : 'Semester Cohort'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* STEP: Branch Scope (Only shown when branch is applicable) */}
        {currentStepKey === 'branch' && isBranchApplicable && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">Step 4 — Select Branch Scope</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Select one or more branches. Leave unselected or choose "All Branches" to make exam college-wide.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedBranchIds([])}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  selectedBranchIds.length === 0
                    ? 'bg-bce-navy text-amber-300 border-bce-navy shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                All Branches (College-wide)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
              {branches.map(br => {
                const isSelected = selectedBranchIds.includes(br.id);
                return (
                  <div
                    key={br.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedBranchIds(selectedBranchIds.filter(id => id !== br.id));
                      } else {
                        setSelectedBranchIds([...selectedBranchIds, br.id]);
                      }
                    }}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-bce-navy bg-blue-50/60 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-900">{br.name}</span>
                      <p className="text-[11px] font-mono text-slate-400">{br.code}</p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                        isSelected ? 'bg-bce-navy text-white border-bce-navy' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP: Scope, Subjects & Rules */}
        {currentStepKey === 'config' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Step {currentStep} — Exam Scope, Subject(s) & Rules
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure exam subject, title, duration, negative marking, and availability schedule.
              </p>
            </div>

            {/* Subject Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Applicable Subject(s) <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-1 border border-slate-200 rounded-xl">
                {filteredSubjects.length === 0 ? (
                  <p className="text-xs text-slate-400 p-2 col-span-full">No subjects found for current academic scope.</p>
                ) : (
                  filteredSubjects.map(sub => {
                    const isSelected = selectedSubjectIds.includes(sub.id);
                    return (
                      <div
                        key={sub.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedSubjectIds(selectedSubjectIds.filter(id => id !== sub.id));
                          } else {
                            setSelectedSubjectIds([...selectedSubjectIds, sub.id]);
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-50/70 border-blue-400 font-bold text-blue-950'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate">{sub.name} ({sub.code})</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Exam Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Mid-Term Test: Mathematics"
                  className="w-full text-xs sm:text-sm px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Exam Code</label>
                <input
                  type="text"
                  value={examCode}
                  onChange={e => setExamCode(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30 font-mono uppercase"
                />
              </div>
            </div>

            {/* Duration, Passing, Max attempts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Duration (Minutes) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="5"
                  max="300"
                  value={durationMinutes}
                  onChange={e => setDurationMinutes(parseInt(e.target.value) || 30)}
                  className="w-full text-xs sm:text-sm px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Passing Percentage (%)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={passingPercentage}
                  onChange={e => setPassingPercentage(parseFloat(e.target.value) || 40)}
                  className="w-full text-xs sm:text-sm px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Max Attempts per Student</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={maxAttempts}
                  onChange={e => setMaxAttempts(parseInt(e.target.value) || 1)}
                  className="w-full text-xs sm:text-sm px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30"
                />
              </div>
            </div>

            {/* Negative Marking & Randomization */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={negativeMarkingEnabled}
                    onChange={e => setNegativeMarkingEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-bce-cobalt focus:ring-bce-cobalt cursor-pointer"
                  />
                  <span>Enable Negative Marking</span>
                </label>

                {negativeMarkingEnabled && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600">Deduct per wrong answer:</span>
                    <input
                      type="number"
                      step="0.25"
                      min="0.1"
                      max="5"
                      value={negativeMarks}
                      onChange={e => setNegativeMarks(parseFloat(e.target.value) || 0.25)}
                      className="w-20 text-xs px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-mono"
                    />
                    <span className="text-xs text-slate-500">marks</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={randomizeQuestions}
                    onChange={e => setRandomizeQuestions(e.target.checked)}
                    className="w-4 h-4 rounded text-bce-cobalt focus:ring-bce-cobalt cursor-pointer"
                  />
                  <span>Randomize question order for each student</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={randomizeOptions}
                    onChange={e => setRandomizeOptions(e.target.checked)}
                    className="w-4 h-4 rounded text-bce-cobalt focus:ring-bce-cobalt cursor-pointer"
                  />
                  <span>Randomize options order (A/B/C/D) for each question</span>
                </label>
              </div>
            </div>

            {/* Schedule Windows */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Start Available Date & Time</label>
                <input
                  type="datetime-local"
                  value={startAt}
                  onChange={e => setStartAt(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Leave blank for immediate availability</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">End / Deadline Date & Time</label>
                <input
                  type="datetime-local"
                  value={endAt}
                  onChange={e => setEndAt(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Leave blank if no closing deadline</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP: Question Builder */}
        {currentStepKey === 'questions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Step {currentStep} — Question Builder
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Build multiple-choice questions, set marks, and specify answer explanations.
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-800">
                  Total Questions: <span className="text-bce-navy">{questions.length}</span>
                </span>
                <span className="block text-[11px] text-emerald-700 font-semibold">
                  Total Marks: {totalCalculatedMarks} pts
                </span>
              </div>
            </div>

            <QuestionBuilder questions={questions} onChange={setQuestions} />
          </div>
        )}

        {/* STEP: Review & Publish */}
        {currentStepKey === 'review' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Step {currentStep} — Review & Publish Examination
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Review the examination structure, questions, and eligibility before making it live.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Session:</span>
                  <span className="font-bold text-slate-800">
                    {academicSessions.find(s => s.id === sessionId)?.name || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Programme:</span>
                  <span className="font-bold text-slate-800">{selectedProgramme?.name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Academic Level:</span>
                  <span className="font-bold text-slate-800">
                    {selectedLevel?.display_name || selectedLevel?.name || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Branch Scope:</span>
                  <span className="font-bold text-slate-800">
                    {!isBranchApplicable
                      ? 'N/A (Common Cohort)'
                      : selectedBranchIds.length === 0
                        ? 'All Branches'
                        : branches.filter(b => selectedBranchIds.includes(b.id)).map(b => b.code).join(', ')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Subject(s):</span>
                  <span className="font-bold text-slate-800">
                    {subjects.filter(s => selectedSubjectIds.includes(s.id)).map(s => s.name).join(', ') || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Duration:</span>
                  <span className="font-bold text-slate-800">{durationMinutes} Minutes</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Passing Threshold:</span>
                  <span className="font-bold text-slate-800">{passingPercentage}% ({passingMarksValue} pts)</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Negative Marking:</span>
                  <span className="font-bold text-slate-800">
                    {negativeMarkingEnabled ? `Enabled (-${negativeMarks} pts)` : 'Disabled'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Total Questions:</span>
                  <span className="font-extrabold text-blue-700 text-sm">{questions.length}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Total Marks:</span>
                  <span className="font-extrabold text-emerald-700 text-sm">{totalCalculatedMarks} pts</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Max Attempts:</span>
                  <span className="font-bold text-slate-800">{maxAttempts}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Answer Keys:</span>
                  <span className="font-bold text-slate-800">{showCorrectAnswers ? 'Shown on submit' : 'Hidden'}</span>
                </div>
              </div>
            </div>

            {/* Question Summary Checklist */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Question Roster Summary</h4>
              <div className="max-h-60 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-white">
                {questions.map((q, idx) => {
                  const correctOpt = q.options.find(o => o.is_correct);
                  return (
                    <div key={q.id} className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-bold text-bce-navy">Q{idx + 1}.</span>
                        <span className="truncate max-w-sm text-slate-700">{q.question_text}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] text-emerald-700 font-semibold">
                          Ans: {correctOpt?.option_key}
                        </span>
                        <span className="font-mono font-bold text-slate-500">{q.marks}m</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Wizard Bottom Navigation Buttons */}
        <div className="flex items-center justify-between pt-5 mt-5 border-t border-slate-100">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                disabled={loading}
                onClick={handlePrevStep}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                await saveDraftExamConfig();
                if (currentStepKey === 'questions' || currentStepKey === 'review') {
                  await saveQuestionsToServer();
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save Draft</span>
            </button>

            {currentStep < STEPS.length ? (
              <button
                type="button"
                disabled={loading}
                onClick={handleNextStep}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-bce-navy hover:bg-slate-900 rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handlePublishExam}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-extrabold text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 rounded-xl shadow-sm transition-all cursor-pointer active:scale-95"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Publish Exam Live</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
