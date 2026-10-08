import { getExamDbClient, logExamAudit } from './exam-permission';
import {
  evaluateExamSubmission,
  buildStudentQuestionResults,
} from './exam-evaluation';
import {
  startExamAttemptSchema,
  saveAnswerSchema,
  type StartExamAttemptInput,
} from './exam-validation';
import type {
  Exam,
  ExamAttempt,
  ExamQuestion,
  ExamQuestionOption,
  ExamAnswer,
  ExamAttemptResult,
} from '@/types/exams';

/**
 * Deterministically shuffles an array based on a seed string (e.g., attemptId).
 */
function seededShuffle<T>(array: T[], seedStr: string): T[] {
  const arr = [...array];
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed << 5) - seed + seedStr.charCodeAt(i);
    seed |= 0;
  }
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return Math.abs(seed) / 233280;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

import { unstable_cache } from 'next/cache';

/**
 * Retrieves exams available for a college and optionally filtered by branch and semester (direct lookup).
 */
async function fetchStudentAvailableExamsDirect(params: {
  collegeId: string;
  branchId?: string;
  semesterId?: string;
}): Promise<Exam[]> {
  const db = await getExamDbClient();
  let query = db
    .from('exams')
    .select(`
      *,
      branches:exam_branches(branch_id, branch:branches(id, name, code)),
      subjects:exam_subjects(subject_id, subject:subjects(id, name, code)),
      academic_session:academic_years(id, name),
      semester:semesters(id, name, semester_number)
    `)
    .eq('college_id', params.collegeId)
    .in('status', ['PUBLISHED', 'ACTIVE'])
    .order('created_at', { ascending: false });

  if (params.semesterId) {
    query = query.eq('semester_id', params.semesterId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching student available exams:', error);
    throw new Error('Failed to load available exams.');
  }

  let exams: Exam[] = (data || []).map((row: any) => ({
    ...row,
    branches: (row.branches || []).map((b: any) => b.branch).filter(Boolean),
    subjects: (row.subjects || []).map((s: any) => s.subject).filter(Boolean),
  }));

  // If branchId is specified, ensure exam targets this branch or has no branch restrictions
  if (params.branchId) {
    exams = exams.filter(e => {
      if (!e.branches || e.branches.length === 0) return true;
      return e.branches.some(b => b.id === params.branchId);
    });
  }

  return exams;
}

const getCachedStudentAvailableExams = unstable_cache(
  async (collegeId: string, branchId?: string, semesterId?: string): Promise<Exam[]> => {
    return fetchStudentAvailableExamsDirect({ collegeId, branchId, semesterId });
  },
  ['student_available_exams_cache'],
  {
    revalidate: 300,
    tags: ['exams'],
  }
);

/**
 * Retrieves exams available for a college with 60s cache.
 */
export async function getStudentAvailableExams(params: {
  collegeId: string;
  branchId?: string;
  semesterId?: string;
}): Promise<Exam[]> {
  try {
    return await getCachedStudentAvailableExams(params.collegeId, params.branchId, params.semesterId);
  } catch {
    return fetchStudentAvailableExamsDirect(params);
  }
}

/**
 * Loads high-level public details of an exam (instructions, duration, rules) without question keys.
 */
export async function getPublicExamDetails(examId: string): Promise<Exam> {
  const db = await getExamDbClient();
  const { data, error } = await db
    .from('exams')
    .select(`
      *,
      branches:exam_branches(branch_id, branch:branches(id, name, code)),
      subjects:exam_subjects(subject_id, subject:subjects(id, name, code)),
      academic_session:academic_years(id, name),
      semester:semesters(id, name, semester_number),
      college:colleges(id, name, code, logo_url)
    `)
    .eq('id', examId)
    .single();

  if (error || !data) {
    throw new Error('Exam not found or unavailable.');
  }

  // Count active questions
  const { count } = await db
    .from('exam_questions')
    .select('id', { count: 'exact', head: true })
    .eq('exam_id', examId);

  return {
    ...data,
    total_questions: count || 0,
    branches: (data.branches || []).map((b: any) => b.branch).filter(Boolean),
    subjects: (data.subjects || []).map((s: any) => s.subject).filter(Boolean),
  };
}

/**
 * Starts a new exam attempt or resumes an in-progress one.
 * Strips correct answers and explanations before delivering to student.
 */
export async function startExamAttempt(input: StartExamAttemptInput): Promise<{
  attempt: ExamAttempt;
  questions: ExamQuestion[];
  savedAnswers: Record<string, string>;
  isResumed: boolean;
}> {
  const validated = startExamAttemptSchema.parse(input);
  const db = await getExamDbClient();

  // 1. Fetch exam
  const { data: examData, error: examErr } = await db
    .from('exams')
    .select('*')
    .eq('id', validated.exam_id)
    .single();

  if (examErr || !examData) {
    throw new Error('Exam not found.');
  }

  const exam: Exam = examData;

  // 2. Validate exam status
  if (exam.status !== 'PUBLISHED' && exam.status !== 'ACTIVE') {
    throw new Error('This exam is currently not open for attempts.');
  }

  // 3. Validate timing window
  const now = new Date();
  if (exam.start_at && new Date(exam.start_at) > now) {
    throw new Error(`This exam has not started yet. It opens on ${new Date(exam.start_at).toLocaleString()}.`);
  }
  if (exam.end_at && new Date(exam.end_at) < now) {
    throw new Error(`This exam has closed. Submission deadline was ${new Date(exam.end_at).toLocaleString()}.`);
  }

  const cleanRegNo = validated.registration_number.trim().toUpperCase();

  // 4. Check for existing attempts by this student
  const { data: existingAttempts, error: attemptsErr } = await db
    .from('exam_attempts')
    .select('*')
    .eq('exam_id', exam.id)
    .eq('registration_number', cleanRegNo)
    .order('attempt_number', { ascending: false });

  if (attemptsErr) {
    console.error('Error checking existing attempts:', attemptsErr);
    throw new Error('Could not verify attempt status.');
  }

  // Check if there is an active IN_PROGRESS attempt
  const activeAttempt = existingAttempts?.find(a => a.status === 'IN_PROGRESS');
  if (activeAttempt) {
    const deadline = new Date(activeAttempt.deadline_at);
    if (deadline <= now) {
      // Deadline has passed while user was away - auto submit it
      await submitExamAttempt(activeAttempt.id, true);
    } else {
      // Resume existing active attempt safely!
      const { questions, savedAnswers } = await loadAttemptQuestionsAndAnswers(
        exam,
        activeAttempt.id
      );
      return {
        attempt: activeAttempt,
        questions,
        savedAnswers,
        isResumed: true,
      };
    }
  }

  // 5. Verify max attempts rule
  const completedAttempts = (existingAttempts || []).filter(
    a => a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED'
  );
  if (completedAttempts.length >= exam.max_attempts) {
    throw new Error(
      `You have reached the maximum allowed attempts (${exam.max_attempts}) for this test.`
    );
  }

  // 6. Calculate attempt number & server-authoritative deadline
  const nextAttemptNumber = (existingAttempts?.[0]?.attempt_number || 0) + 1;
  const startedAt = new Date();
  const deadlineAt = new Date(startedAt.getTime() + exam.duration_minutes * 60 * 1000);

  // If exam has a strict end_at before the duration deadline, clamp to end_at
  const finalDeadline = exam.end_at && new Date(exam.end_at) < deadlineAt
    ? new Date(exam.end_at)
    : deadlineAt;

  // 7. Create new attempt record
  const { data: newAttempt, error: createErr } = await db
    .from('exam_attempts')
    .insert({
      exam_id: exam.id,
      college_id: exam.college_id,
      student_name: validated.student_name.trim(),
      roll_number: validated.roll_number.trim().toUpperCase(),
      registration_number: cleanRegNo,
      student_email: validated.student_email ? validated.student_email.trim().toLowerCase() : null,
      branch_id: validated.branch_id || null,
      semester_id: validated.semester_id || exam.semester_id || null,
      attempt_number: nextAttemptNumber,
      status: 'IN_PROGRESS',
      started_at: startedAt.toISOString(),
      deadline_at: finalDeadline.toISOString(),
    })
    .select()
    .single();

  if (createErr || !newAttempt) {
    console.error('Error creating exam attempt:', createErr);
    throw new Error('Failed to initiate exam attempt.');
  }

  // 8. Fetch exam questions with options (STRIPPED of correct answers and explanations)
  const { questions, savedAnswers } = await loadAttemptQuestionsAndAnswers(exam, newAttempt.id);

  return {
    attempt: newAttempt,
    questions,
    savedAnswers,
    isResumed: false,
  };
}

/**
 * Loads exam questions stripped of answer keys and any already saved student answers.
 */
async function loadAttemptQuestionsAndAnswers(
  exam: Exam,
  attemptId: string
): Promise<{ questions: ExamQuestion[]; savedAnswers: Record<string, string> }> {
  const db = await getExamDbClient();

  // Load questions
  const { data: rawQuestions, error: qErr } = await db
    .from('exam_questions')
    .select(`
      id,
      exam_id,
      question_text,
      marks,
      difficulty,
      topic,
      position,
      options:exam_question_options(
        id,
        question_id,
        option_key,
        option_text,
        position
      )
    `)
    .eq('exam_id', exam.id)
    .order('position', { ascending: true });

  if (qErr || !rawQuestions) {
    throw new Error('Failed to load exam questions.');
  }

  // Sanitize: ensure no is_correct or explanation is leaked to the student
  let questions: ExamQuestion[] = rawQuestions.map((q: any) => ({
    id: q.id,
    exam_id: q.exam_id,
    question_text: q.question_text,
    explanation: null,
    marks: Number(q.marks) || 1,
    difficulty: q.difficulty,
    topic: q.topic,
    position: q.position,
    options: (q.options || [])
      .sort((a: any, b: any) => a.position - b.position)
      .map((opt: any) => ({
        id: opt.id,
        question_id: opt.question_id,
        option_key: opt.option_key,
        option_text: opt.option_text,
        position: opt.position,
        is_correct: false, // Explicitly false to prevent client inspection
      })),
  }));

  // Apply randomization if configured, seeded by attemptId for consistency on refresh
  if (exam.randomize_questions) {
    questions = seededShuffle(questions, attemptId);
  }
  if (exam.randomize_options) {
    questions = questions.map(q => ({
      ...q,
      options: seededShuffle(q.options, `${attemptId}-${q.id}`),
    }));
  }

  // Load already saved answers for this attempt
  const { data: existingAnswers, error: aErr } = await db
    .from('exam_answers')
    .select('question_id, selected_option_id')
    .eq('attempt_id', attemptId);

  const savedAnswers: Record<string, string> = {};
  if (!aErr && existingAnswers) {
    for (const a of existingAnswers) {
      if (a.selected_option_id) {
        savedAnswers[a.question_id] = a.selected_option_id;
      }
    }
  }

  return { questions, savedAnswers };
}

/**
 * Resumes an active attempt by attemptId (e.g., after browser refresh or reconnection).
 */
export async function getActiveAttempt(attemptId: string): Promise<{
  attempt: ExamAttempt;
  exam: Exam;
  questions: ExamQuestion[];
  savedAnswers: Record<string, string>;
}> {
  const db = await getExamDbClient();
  const { data: attempt, error: attErr } = await db
    .from('exam_attempts')
    .select('*')
    .eq('id', attemptId)
    .single();

  if (attErr || !attempt) {
    throw new Error('Attempt session not found.');
  }

  const { data: exam, error: examErr } = await db
    .from('exams')
    .select(`
      *,
      branches:exam_branches(branch_id, branch:branches(id, name, code)),
      subjects:exam_subjects(subject_id, subject:subjects(id, name, code)),
      college:colleges(id, name, code, logo_url)
    `)
    .eq('id', attempt.exam_id)
    .single();

  if (examErr || !exam) {
    throw new Error('Associated exam not found.');
  }

  // Check if deadline passed
  const now = new Date();
  if (attempt.status === 'IN_PROGRESS' && new Date(attempt.deadline_at) <= now) {
    // Automatically submit attempt
    await submitExamAttempt(attempt.id, true);
    // Reload updated attempt
    const { data: updatedAttempt } = await db
      .from('exam_attempts')
      .select('*')
      .eq('id', attemptId)
      .single();

    return {
      attempt: updatedAttempt || attempt,
      exam,
      questions: [],
      savedAnswers: {},
    };
  }

  const { questions, savedAnswers } = await loadAttemptQuestionsAndAnswers(exam, attempt.id);

  return {
    attempt,
    exam,
    questions,
    savedAnswers,
  };
}

/**
 * Incremental, debounced answer auto-saver.
 * Upserts selected option for a given question in the active attempt.
 */
export async function saveAnswerIncremental(params: {
  attemptId: string;
  questionId: string;
  selectedOptionId: string | null;
}): Promise<{ success: boolean; answeredAt: string }> {
  const validated = saveAnswerSchema.parse(params);
  const db = await getExamDbClient();

  // 1. Verify attempt is still IN_PROGRESS
  const { data: attempt, error: attErr } = await db
    .from('exam_attempts')
    .select('id, exam_id, status, deadline_at')
    .eq('id', validated.attempt_id)
    .single();

  if (attErr || !attempt) {
    throw new Error('Attempt not found.');
  }

  if (attempt.status !== 'IN_PROGRESS') {
    throw new Error('This attempt has already been submitted and cannot be modified.');
  }

  // 2. Verify deadline
  const now = new Date();
  if (new Date(attempt.deadline_at) < now) {
    // Trigger auto-submit and block change
    await submitExamAttempt(attempt.id, true);
    throw new Error('Exam time limit has expired. Your attempt has been automatically submitted.');
  }

  // 3. Upsert answer
  const answeredAt = new Date().toISOString();
  const { error: upsertErr } = await db
    .from('exam_answers')
    .upsert(
      {
        attempt_id: validated.attempt_id,
        question_id: validated.question_id,
        selected_option_id: validated.selected_option_id,
        answered_at: answeredAt,
      },
      { onConflict: 'attempt_id,question_id' }
    );

  if (upsertErr) {
    console.error('Error saving answer:', upsertErr);
    throw new Error('Failed to record answer.');
  }

  return { success: true, answeredAt };
}

/**
 * Authoritatively submits the exam attempt, evaluates answers against database keys,
 * updates scores, and finalizes the attempt record.
 */
export async function submitExamAttempt(
  attemptId: string,
  autoSubmitted: boolean = false
): Promise<ExamAttemptResult> {
  const db = await getExamDbClient();

  // 1. Load attempt
  const { data: attempt, error: attErr } = await db
    .from('exam_attempts')
    .select('*')
    .eq('id', attemptId)
    .single();

  if (attErr || !attempt) {
    throw new Error('Attempt not found.');
  }

  // 2. Idempotency: If already submitted, return the final result directly
  if (attempt.status === 'SUBMITTED' || attempt.status === 'AUTO_SUBMITTED') {
    return await getAttemptResult(attempt.id);
  }

  // 3. Load exam configuration
  const { data: exam, error: examErr } = await db
    .from('exams')
    .select('*')
    .eq('id', attempt.exam_id)
    .single();

  if (examErr || !exam) {
    throw new Error('Associated exam record not found.');
  }

  // 4. Fetch all questions with authoritative correct answers from server database
  const { data: questionsData, error: qErr } = await db
    .from('exam_questions')
    .select(`
      id,
      exam_id,
      question_text,
      explanation,
      marks,
      difficulty,
      topic,
      position,
      options:exam_question_options(
        id,
        question_id,
        option_key,
        option_text,
        position,
        is_correct
      )
    `)
    .eq('exam_id', exam.id)
    .order('position', { ascending: true });

  if (qErr || !questionsData) {
    throw new Error('Could not retrieve exam questions for grading.');
  }

  const questions: ExamQuestion[] = questionsData.map((q: any) => ({
    id: q.id,
    exam_id: q.exam_id,
    question_text: q.question_text,
    explanation: q.explanation,
    marks: Number(q.marks) || 1,
    difficulty: q.difficulty,
    topic: q.topic,
    position: q.position,
    options: (q.options || []).sort((a: any, b: any) => a.position - b.position),
  }));

  // 5. Fetch all answers submitted/saved by the student
  const { data: answersData, error: aErr } = await db
    .from('exam_answers')
    .select('*')
    .eq('attempt_id', attempt.id);

  const submittedAnswers: { question_id: string; selected_option_id: string | null }[] = [];
  const existingAnswersMap = new Map<string, any>();
  if (!aErr && answersData) {
    for (const a of answersData) {
      existingAnswersMap.set(a.question_id, a);
      submittedAnswers.push({
        question_id: a.question_id,
        selected_option_id: a.selected_option_id,
      });
    }
  }

  // 6. Run authoritative evaluation engine
  const evaluation = evaluateExamSubmission(exam, questions, submittedAnswers);

  // 7. Persist individual answer grades into exam_answers table (bulk upsert)
  if (evaluation.evaluated_answers.length > 0) {
    const answeredAt = new Date().toISOString();
    const answersPayload = evaluation.evaluated_answers.map((evaluated) => ({
      attempt_id: attempt.id,
      question_id: evaluated.question_id,
      selected_option_id: evaluated.selected_option_id,
      is_correct: evaluated.is_correct,
      marks_awarded: evaluated.marks_awarded,
      answered_at: answeredAt,
    }));

    const { error: upsertErr } = await db
      .from('exam_answers')
      .upsert(answersPayload, { onConflict: 'attempt_id,question_id' });

    if (upsertErr) {
      console.error('Error bulk updating exam answers:', upsertErr);
      throw new Error('Failed to record evaluated answers.');
    }
  }

  // 8. Update attempt record with authoritative score and status
  const finalStatus = autoSubmitted ? 'AUTO_SUBMITTED' : 'SUBMITTED';
  const submittedAt = new Date().toISOString();

  const { error: updateErr } = await db
    .from('exam_attempts')
    .update({
      status: finalStatus,
      submitted_at: submittedAt,
      total_marks: evaluation.total_marks,
      obtained_marks: evaluation.obtained_marks,
      percentage: evaluation.percentage,
      is_passed: evaluation.is_passed,
      total_questions: evaluation.total_questions,
      attempted_count: evaluation.attempted_count,
      correct_count: evaluation.correct_count,
      wrong_count: evaluation.wrong_count,
      unanswered_count: evaluation.unanswered_count,
      updated_at: submittedAt,
    })
    .eq('id', attempt.id);

  if (updateErr) {
    console.error('Error updating attempt results:', updateErr);
    throw new Error('Failed to record exam results.');
  }

  // 9. Log audit
  await logExamAudit({
    collegeId: attempt.college_id,
    adminId: null,
    actorEmail: attempt.student_email || `${attempt.registration_number}@student.campusflow.in`,
    action: 'SUBMIT_ATTEMPT',
    examId: exam.id,
    details: `Attempt #${attempt.attempt_number} submitted by ${attempt.student_name} (${attempt.registration_number}). Score: ${evaluation.obtained_marks}/${evaluation.total_marks} (${evaluation.percentage}%). Status: ${finalStatus}.`,
    metadata: {
      attempt_id: attempt.id,
      is_passed: evaluation.is_passed,
      percentage: evaluation.percentage,
      auto_submitted: autoSubmitted,
    },
  });

  return await getAttemptResult(attempt.id);
}

/**
 * Retrieves the comprehensive result of a completed attempt, respecting result visibility rules.
 */
export async function getAttemptResult(attemptId: string): Promise<ExamAttemptResult> {
  const db = await getExamDbClient();

  const { data: attempt, error: attErr } = await db
    .from('exam_attempts')
    .select(`
      *,
      branch:branches(id, name, code),
      semester:semesters(id, name, semester_number),
      college:colleges(id, name, code, logo_url)
    `)
    .eq('id', attemptId)
    .single();

  if (attErr || !attempt) {
    throw new Error('Attempt result not found.');
  }

  const { data: exam, error: examErr } = await db
    .from('exams')
    .select(`
      *,
      branches:exam_branches(branch_id, branch:branches(id, name, code)),
      subjects:exam_subjects(subject_id, subject:subjects(id, name, code)),
      academic_session:academic_years(id, name),
      semester:semesters(id, name, semester_number)
    `)
    .eq('id', attempt.exam_id)
    .single();

  if (examErr || !exam) {
    throw new Error('Exam not found for result view.');
  }

  // Check result visibility
  const now = new Date();
  let canViewDetailedResult = true;
  let canViewCorrectAnswers = false;

  if (exam.result_visibility === 'AFTER_EXAM_END') {
    if (exam.end_at && new Date(exam.end_at) > now) {
      canViewDetailedResult = false;
    } else {
      canViewCorrectAnswers = true;
    }
  } else if (exam.result_visibility === 'AFTER_SUBMISSION') {
    canViewCorrectAnswers = true;
  } else if (exam.result_visibility === 'MANUAL_RELEASE') {
    canViewDetailedResult = false;
  }

  // Fetch questions and student answers
  const { data: rawQuestions } = await db
    .from('exam_questions')
    .select(`
      id,
      exam_id,
      question_text,
      explanation,
      marks,
      difficulty,
      topic,
      position,
      options:exam_question_options(
        id,
        question_id,
        option_key,
        option_text,
        position,
        is_correct
      )
    `)
    .eq('exam_id', exam.id)
    .order('position', { ascending: true });

  const { data: rawAnswers } = await db
    .from('exam_answers')
    .select('*')
    .eq('attempt_id', attempt.id);

  const questions: ExamQuestion[] = (rawQuestions || []).map((q: any) => ({
    id: q.id,
    exam_id: q.exam_id,
    question_text: q.question_text,
    explanation: q.explanation,
    marks: Number(q.marks) || 1,
    difficulty: q.difficulty,
    topic: q.topic,
    position: q.position,
    options: (q.options || []).sort((a: any, b: any) => a.position - b.position),
  }));

  const answers: ExamAnswer[] = (rawAnswers || []).map((a: any) => ({
    id: a.id,
    attempt_id: a.attempt_id,
    question_id: a.question_id,
    selected_option_id: a.selected_option_id,
    answered_at: a.answered_at,
    is_correct: a.is_correct,
    marks_awarded: Number(a.marks_awarded) || 0,
  }));

  const questionBreakdown = canViewDetailedResult
    ? buildStudentQuestionResults(questions, answers, canViewCorrectAnswers)
    : [];

  return {
    attempt: {
      ...attempt,
      branch: attempt.branch,
      semester: attempt.semester,
    },
    exam: {
      ...exam,
      branches: (exam.branches || []).map((b: any) => b.branch).filter(Boolean),
      subjects: (exam.subjects || []).map((s: any) => s.subject).filter(Boolean),
    },
    breakdown: questionBreakdown,
    can_view_breakdown: canViewDetailedResult,
    can_view_answers: canViewCorrectAnswers,
  };
}
