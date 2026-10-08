'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Send,
  Loader2,
  Layers,
  ShieldCheck,
  RotateCcw,
  BookOpen,
} from 'lucide-react';
import {
  startExamAttemptAction,
  getActiveAttemptAction,
  saveAnswerIncrementalAction,
  submitExamAttemptAction,
} from '@/app/exams/actions';
import type { Exam, ExamAttempt, ExamQuestion } from '@/types/exams';

interface StudentExamPortalProps {
  exam: Exam;
  tenantSlug?: string;
}

export function StudentExamPortal({ exam, tenantSlug }: StudentExamPortalProps) {
  const router = useRouter();

  // Mode: 'PRE_EXAM' (credentials entry) | 'ACTIVE_TEST' (taking test) | 'SUBMITTING'
  const [mode, setMode] = useState<'PRE_EXAM' | 'ACTIVE_TEST' | 'SUBMITTING'>('PRE_EXAM');

  // Pre-exam form inputs
  const [studentName, setStudentName] = useState<string>('');
  const [rollNumber, setRollNumber] = useState<string>('');
  const [registrationNumber, setRegistrationNumber] = useState<string>('');
  const [studentEmail, setStudentEmail] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    exam.branches && exam.branches.length > 0 ? exam.branches[0].id : ''
  );
  const [acknowledgedRules, setAcknowledgedRules] = useState<boolean>(false);

  // Active attempt state
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // { [question_id]: selected_option_id }
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [savingStatus, setSavingStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  // Timer state
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  // Submission modal state
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autosaveDebounceRef = useRef<Record<string, NodeJS.Timeout>>({});

  const storageKey = `cf_exam_active_attempt_${exam.id}`;

  // 1. Check for existing active attempt in localStorage on component mount
  useEffect(() => {
    async function checkSavedAttempt() {
      try {
        const cachedAttemptId = localStorage.getItem(storageKey);
        if (cachedAttemptId) {
          const res = await getActiveAttemptAction(cachedAttemptId);
          if (res.success && res.attempt) {
            if (res.attempt.status === 'SUBMITTED' || res.attempt.status === 'AUTO_SUBMITTED') {
              // Already completed, navigate to result
              localStorage.removeItem(storageKey);
              const resultUrl = tenantSlug
                ? `/${tenantSlug}/exams/${exam.id}/result/${res.attempt.id}`
                : `/exams/${exam.id}/result/${res.attempt.id}`;
              router.push(resultUrl);
              return;
            }

            // Restore in-progress attempt
            setAttempt(res.attempt);
            setQuestions(res.questions || []);
            setAnswers(res.savedAnswers || {});
            setMode('ACTIVE_TEST');

            // Calculate remaining seconds
            const deadline = new Date(res.attempt.deadline_at).getTime();
            const now = Date.now();
            const diffSeconds = Math.max(0, Math.floor((deadline - now) / 1000));
            setSecondsRemaining(diffSeconds);
          } else {
            localStorage.removeItem(storageKey);
          }
        }
      } catch (err) {
        console.error('Error recovering active attempt:', err);
      } finally {
        setIsInitializing(false);
      }
    }

    checkSavedAttempt();
  }, [exam.id, storageKey, router, tenantSlug]);

  // 2. Countdown Timer Effect
  useEffect(() => {
    if (mode !== 'ACTIVE_TEST' || !attempt) return;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      const deadline = new Date(attempt.deadline_at).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((deadline - now) / 1000));

      setSecondsRemaining(diff);

      if (diff <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        // Time expired! Trigger authoritative auto-submission
        handleAutoSubmit();
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [mode, attempt]);

  // 3. Browser beforeunload listener to warn against accidental window closing
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (mode === 'ACTIVE_TEST') {
        e.preventDefault();
        e.returnValue = 'You have an active examination in progress. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [mode]);

  // Start or resume test
  const handleStartExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!studentName.trim() || !rollNumber.trim() || !registrationNumber.trim()) {
      setErrorMessage('Please fill in your Student Name, Roll Number, and Registration Number.');
      return;
    }
    if (!acknowledgedRules) {
      setErrorMessage('You must acknowledge the examination instructions before proceeding.');
      return;
    }

    setIsInitializing(true);
    try {
      const res = await startExamAttemptAction({
        exam_id: exam.id,
        student_name: studentName.trim(),
        roll_number: rollNumber.trim().toUpperCase(),
        registration_number: registrationNumber.trim().toUpperCase(),
        student_email: studentEmail.trim() ? studentEmail.trim().toLowerCase() : null,
        branch_id: selectedBranchId || null,
        semester_id: exam.semester_id || null,
      });

      if (!res.success || !res.attempt) {
        throw new Error(res.error || 'Failed to start examination.');
      }

      // Persist attempt ID in storage for refresh safety
      localStorage.setItem(storageKey, res.attempt.id);

      setAttempt(res.attempt);
      setQuestions(res.questions || []);
      setAnswers(res.savedAnswers || {});

      // Calculate time remaining
      const deadline = new Date(res.attempt.deadline_at).getTime();
      const now = Date.now();
      const diffSeconds = Math.max(0, Math.floor((deadline - now) / 1000));
      setSecondsRemaining(diffSeconds);

      setMode('ACTIVE_TEST');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to start exam.');
    } finally {
      setIsInitializing(false);
    }
  };

  // Select an option with debounced server autosave
  const handleSelectOption = (questionId: string, optionId: string) => {
    if (!attempt) return;

    // 1. Optimistic UI update
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));
    setSavingStatus('saving');

    // 2. Clear existing debounce timer for this question
    if (autosaveDebounceRef.current[questionId]) {
      clearTimeout(autosaveDebounceRef.current[questionId]);
    }

    // 3. Debounce server persistence by 400ms
    autosaveDebounceRef.current[questionId] = setTimeout(async () => {
      try {
        const res = await saveAnswerIncrementalAction({
          attemptId: attempt.id,
          questionId,
          selectedOptionId: optionId,
        });

        if (res.success) {
          setSavingStatus('saved');
        } else {
          setSavingStatus('error');
        }
      } catch (err) {
        console.error('Autosave error:', err);
        setSavingStatus('error');
      }
    }, 400);
  };

  // Clear selected option
  const handleClearOption = (questionId: string) => {
    if (!attempt) return;

    setAnswers(prev => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    setSavingStatus('saving');

    if (autosaveDebounceRef.current[questionId]) {
      clearTimeout(autosaveDebounceRef.current[questionId]);
    }

    autosaveDebounceRef.current[questionId] = setTimeout(async () => {
      try {
        await saveAnswerIncrementalAction({
          attemptId: attempt.id,
          questionId,
          selectedOptionId: null,
        });
        setSavingStatus('saved');
      } catch (err) {
        setSavingStatus('error');
      }
    }, 400);
  };

  // Final submission
  const handleFinalSubmit = async () => {
    if (!attempt) return;

    setMode('SUBMITTING');
    setShowSubmitModal(false);
    try {
      const res = await submitExamAttemptAction(attempt.id);
      if (!res.success || !res.result) {
        throw new Error(res.error || 'Failed to submit exam attempt.');
      }

      localStorage.removeItem(storageKey);
      const resultUrl = tenantSlug
        ? `/${tenantSlug}/exams/${exam.id}/result/${attempt.id}`
        : `/exams/${exam.id}/result/${attempt.id}`;
      router.push(resultUrl);
    } catch (err: any) {
      console.error(err);
      alert(`Submission error: ${err.message || 'Please retry.'}`);
      setMode('ACTIVE_TEST');
    }
  };

  // Auto-submit on time expiry
  const handleAutoSubmit = useCallback(async () => {
    if (!attempt) return;
    setMode('SUBMITTING');
    try {
      await submitExamAttemptAction(attempt.id);
      localStorage.removeItem(storageKey);
      const resultUrl = tenantSlug
        ? `/${tenantSlug}/exams/${exam.id}/result/${attempt.id}`
        : `/exams/${exam.id}/result/${attempt.id}`;
      router.push(resultUrl);
    } catch (err) {
      console.error('Auto submit error:', err);
    }
  }, [attempt, exam.id, storageKey, router, tenantSlug]);

  // Format timer as MM:SS or HH:MM:SS
  const formatTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isInitializing) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-bce-navy animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Checking examination session status...</p>
      </div>
    );
  }

  // ========================================================
  // VIEW 1: PRE-EXAM REGISTRATION & INSTRUCTIONS
  // ========================================================
  if (mode === 'PRE_EXAM') {
    return (
      <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
        {/* Exam Title & Instructions Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <span className="text-xs font-mono font-bold text-bce-navy bg-slate-100 px-2.5 py-1 rounded-lg">
              {exam.exam_code}
            </span>
            <span className="text-xs font-bold text-slate-500">
              Duration: {exam.duration_minutes} Minutes
            </span>
          </div>

          <div>
            <h1 className="text-xl font-extrabold text-bce-navy">{exam.title}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Subject: {(exam.subjects || []).map(s => s.name).join(', ') || 'N/A'} • Total Questions: {exam.total_questions || 'N/A'}
            </p>
          </div>

          {exam.instructions && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Instructions & Examination Rules
              </span>
              <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                {exam.instructions}
              </p>
            </div>
          )}

          {exam.negative_marking_enabled && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Negative Marking Active:</strong> Wrong answers will deduct {exam.negative_marks} marks each. Unanswered questions carry 0 marks.
              </span>
            </div>
          )}
        </div>

        {/* Student Verification Form */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Student Identity Verification</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your official academic details to initiate the timed examination attempt.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span className="font-semibold">{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleStartExam} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                placeholder="e.g. Rahul Kumar"
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Class Roll Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={rollNumber}
                  onChange={e => setRollNumber(e.target.value)}
                  placeholder="e.g. 21/CSE/042"
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  University / Registration Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={registrationNumber}
                  onChange={e => setRegistrationNumber(e.target.value)}
                  placeholder="e.g. 21105123042"
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={studentEmail}
                  onChange={e => setStudentEmail(e.target.value)}
                  placeholder="rahul@example.com"
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30"
                />
              </div>

              {exam.branches && exam.branches.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Department / Branch</label>
                  <select
                    value={selectedBranchId}
                    onChange={e => setSelectedBranchId(e.target.value)}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white"
                  >
                    {exam.branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Rules Checkbox */}
            <div className="pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={acknowledgedRules}
                  onChange={e => setAcknowledgedRules(e.target.checked)}
                  className="w-4 h-4 rounded text-bce-navy focus:ring-bce-navy mt-0.5 cursor-pointer"
                />
                <span className="text-xs text-slate-600 leading-relaxed">
                  I confirm that the details entered above are accurate. I have read the instructions and agree to complete this assessment independently within the allotted {exam.duration_minutes} minutes.
                </span>
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl text-sm font-extrabold text-white bg-bce-navy hover:bg-slate-900 shadow-md transition-all cursor-pointer active:scale-98"
            >
              Start Timed Examination
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ========================================================
  // VIEW 2: SUBMITTING LOADING STATE
  // ========================================================
  if (mode === 'SUBMITTING') {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4 text-center px-4">
        <Loader2 className="w-10 h-10 text-bce-navy animate-spin" />
        <h2 className="text-base font-extrabold text-slate-900">Grading & Finalizing Examination...</h2>
        <p className="text-xs text-slate-500 max-w-sm">
          Your answers are being securely submitted to the authoritative grading engine. Please do not close this window.
        </p>
      </div>
    );
  }

  // ========================================================
  // VIEW 3: ACTIVE TEST INTERFACE
  // ========================================================
  const currentQuestion = questions[currentIdx];
  const isLastQuestion = currentIdx === questions.length - 1;
  const answeredCount = Object.keys(answers).length;
  const unansweredCount = questions.length - answeredCount;
  const isTimeCritical = secondsRemaining <= 300; // < 5 minutes
  const isTimeEmergency = secondsRemaining <= 60; // < 1 minute

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12 px-3 sm:px-4">
      {/* Sticky Header with Timer & Progress */}
      <div className="sticky top-2 z-30 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xs sm:text-sm font-extrabold text-bce-navy line-clamp-1">{exam.title}</h1>
          <p className="text-[11px] text-slate-500">
            Question {currentIdx + 1} of {questions.length} • {answeredCount} Answered
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Autosave badge */}
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
            {savingStatus === 'saving' ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                <span>Saving...</span>
              </>
            ) : savingStatus === 'saved' ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3 h-3 text-red-500" />
                <span>Retry</span>
              </>
            )}
          </div>

          {/* Sticky Timer Pill */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono font-black text-xs sm:text-sm border transition-all ${
              isTimeEmergency
                ? 'bg-red-500 text-white border-red-600 animate-pulse'
                : isTimeCritical
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-slate-100 text-bce-navy border-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>{formatTime(secondsRemaining)}</span>
          </div>

          {/* Submit Test Button in Header */}
          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-bce-navy hover:bg-slate-900 transition-all cursor-pointer shadow-2xs active:scale-95"
          >
            Review & Submit
          </button>
        </div>
      </div>

      {/* Main Question Card */}
      {currentQuestion && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-xs space-y-6">
          {/* Question Header */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <span className="px-3 py-1 rounded-xl text-xs font-mono font-extrabold bg-blue-50 text-blue-900 border border-blue-200">
              Q{currentIdx + 1}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">
                Marks: +{currentQuestion.marks}m
                {exam.negative_marking_enabled && ` / -${exam.negative_marks}m`}
              </span>
            </div>
          </div>

          {/* Question Text */}
          <div className="text-sm sm:text-base font-bold text-slate-900 leading-relaxed">
            {currentQuestion.question_text}
          </div>

          {/* Multiple Choice Options */}
          <div className="space-y-3">
            {currentQuestion.options.map(opt => {
              const isSelected = answers[currentQuestion.id] === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => handleSelectOption(currentQuestion.id, opt.id)}
                  className={`p-3.5 sm:p-4 rounded-2xl border text-xs sm:text-sm cursor-pointer transition-all flex items-center gap-3 select-none ${
                    isSelected
                      ? 'bg-blue-50/70 border-bce-cobalt text-blue-950 font-bold shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 text-slate-700'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 border ${
                      isSelected
                        ? 'bg-bce-navy text-white border-bce-navy'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {opt.option_key}
                  </div>
                  <span className="flex-1 leading-snug">{opt.option_text}</span>
                </div>
              );
            })}
          </div>

          {/* Bottom Card Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx(prev => prev - 1)}
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              {answers[currentQuestion.id] && (
                <button
                  type="button"
                  onClick={() => handleClearOption(currentQuestion.id)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  Clear Selection
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isLastQuestion ? (
                <button
                  type="button"
                  onClick={() => setCurrentIdx(prev => prev + 1)}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold text-white bg-bce-navy hover:bg-slate-900 transition-colors cursor-pointer shadow-xs active:scale-95"
                >
                  <span>Next Question</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(true)}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer shadow-xs active:scale-95"
                >
                  <span>Review & Submit</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Question Palette Drawer */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800 uppercase tracking-wider">Question Palette</span>
          <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span>Answered ({answeredCount})</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200 inline-block" />
              <span>Unanswered ({unansweredCount})</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 pt-1">
          {questions.map((q, idx) => {
            const isAnswered = Boolean(answers[q.id]);
            const isCurrent = idx === currentIdx;

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIdx(idx)}
                className={`h-9 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center select-none ${
                  isCurrent
                    ? 'ring-2 ring-blue-500 ring-offset-1 bg-bce-navy text-white shadow-xs'
                    : isAnswered
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Confirmation & Submission Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">Confirm Exam Submission</h3>
              <p className="text-xs text-slate-500">
                Please verify your answering progress before finalizing.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-center">
              <div>
                <span className="text-slate-400 block font-semibold">Answered</span>
                <span className="text-lg font-extrabold text-emerald-700">{answeredCount}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Unanswered</span>
                <span className="text-lg font-extrabold text-amber-700">{unansweredCount}</span>
              </div>
            </div>

            {unansweredCount > 0 && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                ⚠️ You have <strong>{unansweredCount} unanswered questions</strong>. Once submitted, your score will be calculated immediately and cannot be modified.
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Keep Answering
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                className="px-4 py-2 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
              >
                Submit Examination
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
