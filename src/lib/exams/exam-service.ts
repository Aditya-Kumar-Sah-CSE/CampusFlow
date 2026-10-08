import { getExamDbClient, logExamAudit } from './exam-permission';
import { roundDecimal, calculateQuestionAnalytics } from './exam-evaluation';
import type {
  Exam,
  ExamStatus,
  ExamQuestion,
  ExamQuestionOption,
  QuestionAnalyticsItem,
  ExamResultsDashboardSummary,
  ExamResultsDashboardData,
} from '@/types/exams';

export interface CreateExamInput {
  college_id: string;
  academic_session_id: string;
  semester_id: string;
  branch_ids: string[];
  subject_ids: string[];
  title: string;
  exam_code: string;
  description?: string | null;
  instructions?: string | null;
  duration_minutes: number;
  passing_percentage: number;
  negative_marking_enabled: boolean;
  negative_marks: number;
  max_attempts: number;
  start_at?: string | null;
  end_at?: string | null;
  result_visibility: 'IMMEDIATE' | 'AFTER_END_DATE' | 'MANUAL';
  show_correct_answers: boolean;
  randomize_questions: boolean;
  randomize_options: boolean;
  status?: ExamStatus;
  created_by?: string | null;
}

export interface SaveQuestionItemInput {
  id?: string;
  question_text: string;
  explanation?: string | null;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  topic?: string | null;
  marks: number;
  position: number;
  options: {
    id?: string;
    option_key: string;
    option_text: string;
    position: number;
    is_correct: boolean;
  }[];
}

/**
 * Fetch list of exams strictly scoped to college.
 */
export async function getCollegeExams(
  collegeId: string,
  options?: {
    status?: ExamStatus | 'ALL';
    search?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<{ exams: Exam[]; totalCount: number }> {
  const db = await getExamDbClient();
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = db
    .from('exams')
    .select(`
      *,
      academic_session:academic_years(id, name),
      semester:semesters(id, name, semester_number),
      exam_branches(branch:branches(id, name, code)),
      exam_subjects(subject:subjects(id, name, code))
    `, { count: 'exact' })
    .eq('college_id', collegeId)
    .order('created_at', { ascending: false });

  if (options?.status && options.status !== 'ALL') {
    query = query.eq('status', options.status);
  }

  if (options?.search && options.search.trim()) {
    const q = options.search.trim();
    query = query.or(`title.ilike.%${q}%,exam_code.ilike.%${q}%`);
  }

  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.error('[GET_COLLEGE_EXAMS_ERROR]', error);
    return { exams: [], totalCount: 0 };
  }

  const normalizedExams: Exam[] = (data || []).map((row: any) => ({
    ...row,
    branches: (row.exam_branches || []).map((eb: any) => eb.branch).filter(Boolean),
    subjects: (row.exam_subjects || []).map((es: any) => es.subject).filter(Boolean),
  }));

  return { exams: normalizedExams, totalCount: count || 0 };
}

/**
 * Fetch a single exam by ID with full relations (questions, options, branches, subjects).
 */
export async function getExamById(
  examId: string,
  collegeId?: string
): Promise<Exam | null> {
  const db = await getExamDbClient();

  let query = db
    .from('exams')
    .select(`
      *,
      academic_session:academic_years(id, name),
      semester:semesters(id, name, semester_number),
      exam_branches(branch:branches(id, name, code)),
      exam_subjects(subject:subjects(id, name, code))
    `)
    .eq('id', examId);

  if (collegeId) {
    query = query.eq('college_id', collegeId);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return null;
  }

  // Fetch questions with options in order
  const { data: questionsData } = await db
    .from('exam_questions')
    .select(`
      *,
      options:exam_question_options(*)
    `)
    .eq('exam_id', examId)
    .order('position', { ascending: true });

  const normalizedQuestions: ExamQuestion[] = (questionsData || []).map((q: any) => ({
    ...q,
    options: (q.options || []).sort((a: any, b: any) => a.position - b.position),
  }));

  return {
    ...data,
    branches: (data.exam_branches || []).map((eb: any) => eb.branch).filter(Boolean),
    subjects: (data.exam_subjects || []).map((es: any) => es.subject).filter(Boolean),
    questions: normalizedQuestions,
  };
}

/**
 * Create a new Exam with branch & subject mappings.
 */
export async function createExam(input: CreateExamInput): Promise<Exam> {
  const db = await getExamDbClient();

  // 1. Insert exam master record
  const { data: examData, error: insertError } = await db
    .from('exams')
    .insert({
      college_id: input.college_id,
      academic_session_id: input.academic_session_id,
      semester_id: input.semester_id,
      title: input.title.trim(),
      exam_code: input.exam_code.trim().toUpperCase(),
      description: input.description?.trim() || null,
      instructions: input.instructions?.trim() || null,
      duration_minutes: input.duration_minutes,
      passing_percentage: input.passing_percentage,
      negative_marking_enabled: input.negative_marking_enabled,
      negative_marks: input.negative_marking_enabled ? input.negative_marks : 0,
      max_attempts: input.max_attempts,
      start_at: input.start_at || null,
      end_at: input.end_at || null,
      result_visibility: input.result_visibility,
      show_correct_answers: input.show_correct_answers,
      randomize_questions: input.randomize_questions,
      randomize_options: input.randomize_options,
      status: input.status || 'DRAFT',
      created_by: input.created_by || null,
      total_marks: 0,
      total_questions: 0,
    })
    .select()
    .single();

  if (insertError || !examData) {
    throw new Error(`Failed to create exam record: ${insertError?.message || 'Database error'}`);
  }

  const examId = examData.id;

  // 2. Link branches
  if (input.branch_ids.length > 0) {
    const branchInserts = input.branch_ids.map(bId => ({
      exam_id: examId,
      branch_id: bId,
    }));
    await db.from('exam_branches').insert(branchInserts);
  }

  // 3. Link subjects
  if (input.subject_ids.length > 0) {
    const subjectInserts = input.subject_ids.map(sId => ({
      exam_id: examId,
      subject_id: sId,
    }));
    await db.from('exam_subjects').insert(subjectInserts);
  }

  return (await getExamById(examId, input.college_id))!;
}

/**
 * Update existing exam metadata & academic scope.
 */
export async function updateExam(
  examId: string,
  collegeId: string,
  input: Partial<CreateExamInput>
): Promise<Exam> {
  const db = await getExamDbClient();

  const updatePayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) updatePayload.title = input.title.trim();
  if (input.exam_code !== undefined) updatePayload.exam_code = input.exam_code.trim().toUpperCase();
  if (input.description !== undefined) updatePayload.description = input.description?.trim() || null;
  if (input.instructions !== undefined) updatePayload.instructions = input.instructions?.trim() || null;
  if (input.academic_session_id !== undefined) updatePayload.academic_session_id = input.academic_session_id;
  if (input.semester_id !== undefined) updatePayload.semester_id = input.semester_id;
  if (input.duration_minutes !== undefined) updatePayload.duration_minutes = input.duration_minutes;
  if (input.passing_percentage !== undefined) updatePayload.passing_percentage = input.passing_percentage;
  if (input.negative_marking_enabled !== undefined) updatePayload.negative_marking_enabled = input.negative_marking_enabled;
  if (input.negative_marks !== undefined) updatePayload.negative_marks = input.negative_marking_enabled ? input.negative_marks : 0;
  if (input.max_attempts !== undefined) updatePayload.max_attempts = input.max_attempts;
  if (input.start_at !== undefined) updatePayload.start_at = input.start_at || null;
  if (input.end_at !== undefined) updatePayload.end_at = input.end_at || null;
  if (input.result_visibility !== undefined) updatePayload.result_visibility = input.result_visibility;
  if (input.show_correct_answers !== undefined) updatePayload.show_correct_answers = input.show_correct_answers;
  if (input.randomize_questions !== undefined) updatePayload.randomize_questions = input.randomize_questions;
  if (input.randomize_options !== undefined) updatePayload.randomize_options = input.randomize_options;
  if (input.status !== undefined) updatePayload.status = input.status;

  const { error } = await db
    .from('exams')
    .update(updatePayload)
    .eq('id', examId)
    .eq('college_id', collegeId);

  if (error) {
    throw new Error(`Failed to update exam: ${error.message}`);
  }

  // Update branches if specified
  if (input.branch_ids) {
    await db.from('exam_branches').delete().eq('exam_id', examId);
    if (input.branch_ids.length > 0) {
      const branchInserts = input.branch_ids.map(bId => ({ exam_id: examId, branch_id: bId }));
      await db.from('exam_branches').insert(branchInserts);
    }
  }

  // Update subjects if specified
  if (input.subject_ids) {
    await db.from('exam_subjects').delete().eq('exam_id', examId);
    if (input.subject_ids.length > 0) {
      const subjectInserts = input.subject_ids.map(sId => ({ exam_id: examId, subject_id: sId }));
      await db.from('exam_subjects').insert(subjectInserts);
    }
  }

  return (await getExamById(examId, collegeId))!;
}

/**
 * Save / Replace complete questions and options for an exam (handles draft autosave).
 * Recalculates total_marks and total_questions on the exam master.
 */
export async function saveExamQuestions(
  examId: string,
  collegeId: string,
  questions: SaveQuestionItemInput[]
): Promise<ExamQuestion[]> {
  const db = await getExamDbClient();

  // Verify exam exists and belongs to college
  const exam = await getExamById(examId, collegeId);
  if (!exam) {
    throw new Error('Exam not found or unauthorized.');
  }

  // Check if attempts already exist
  const { count: attemptCount } = await db
    .from('exam_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('exam_id', examId);

  if (attemptCount && attemptCount > 0) {
    throw new Error('Cannot modify questions: students have already submitted or started attempts for this exam.');
  }

  // Delete existing questions & options (cascade handles options)
  await db.from('exam_questions').delete().eq('exam_id', examId);

  let totalMarks = 0;
  let totalQuestions = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qMarks = Number(q.marks) || 1;
    totalMarks += qMarks;
    totalQuestions++;

    const { data: newQ, error: qErr } = await db
      .from('exam_questions')
      .insert({
        exam_id: examId,
        college_id: collegeId,
        question_text: q.question_text.trim(),
        explanation: q.explanation?.trim() || null,
        difficulty: q.difficulty || 'MEDIUM',
        topic: q.topic?.trim() || null,
        marks: qMarks,
        position: i + 1,
      })
      .select()
      .single();

    if (qErr || !newQ) {
      console.error('[SAVE_QUESTION_ERROR]', qErr);
      continue;
    }

    // Insert options
    if (q.options && q.options.length > 0) {
      const optionsToInsert = q.options.map((opt, optIdx) => ({
        question_id: newQ.id,
        option_key: opt.option_key || String.fromCharCode(65 + optIdx),
        option_text: opt.option_text.trim(),
        position: optIdx + 1,
        is_correct: Boolean(opt.is_correct),
      }));

      await db.from('exam_question_options').insert(optionsToInsert);
    }
  }

  // Update total marks and total questions on the exam
  await db
    .from('exams')
    .update({
      total_marks: roundDecimal(totalMarks),
      total_questions: totalQuestions,
      updated_at: new Date().toISOString(),
    })
    .eq('id', examId);

  const updatedExam = await getExamById(examId, collegeId);
  return updatedExam?.questions || [];
}

/**
 * Validates and publishes an exam.
 */
export async function publishExam(
  examId: string,
  collegeId: string,
  adminUser?: { id: string; email: string }
): Promise<{ success: boolean; error?: string; exam?: Exam }> {
  const exam = await getExamById(examId, collegeId);
  if (!exam) {
    return { success: false, error: 'Exam not found.' };
  }

  if (!exam.questions || exam.questions.length === 0) {
    return { success: false, error: 'Cannot publish exam without questions. Please add at least one question.' };
  }

  // Validate every question has >= 2 options and exactly 1 correct answer
  for (let idx = 0; idx < exam.questions.length; idx++) {
    const q = exam.questions[idx];
    if (!q.question_text.trim()) {
      return { success: false, error: `Question ${idx + 1} has empty text.` };
    }
    if (!q.options || q.options.length < 2) {
      return { success: false, error: `Question ${idx + 1} must have at least 2 options.` };
    }
    if (q.options.some(o => !o.option_text || !o.option_text.trim())) {
      return { success: false, error: `Question ${idx + 1} has one or more blank options.` };
    }
    const correctCount = q.options.filter(o => o.is_correct).length;
    if (correctCount !== 1) {
      return { success: false, error: `Question ${idx + 1} must have exactly one correct answer selected.` };
    }
  }

  const db = await getExamDbClient();
  const { error } = await db
    .from('exams')
    .update({
      status: 'PUBLISHED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', examId)
    .eq('college_id', collegeId);

  if (error) {
    return { success: false, error: error.message };
  }

  await logExamAudit({
    collegeId,
    adminId: adminUser?.id,
    actorEmail: adminUser?.email,
    action: 'PUBLISH_EXAM',
    examId,
    details: `Published exam "${exam.title}" (${exam.questions.length} questions, ${exam.total_marks} marks)`,
  });

  const updated = await getExamById(examId, collegeId);
  return { success: true, exam: updated || undefined };
}

/**
 * Unpublish exam back to DRAFT state.
 */
export async function unpublishExam(
  examId: string,
  collegeId: string,
  adminUser?: { id: string; email: string }
): Promise<{ success: boolean; error?: string }> {
  const db = await getExamDbClient();

  const { error } = await db
    .from('exams')
    .update({
      status: 'DRAFT',
      updated_at: new Date().toISOString(),
    })
    .eq('id', examId)
    .eq('college_id', collegeId);

  if (error) return { success: false, error: error.message };

  await logExamAudit({
    collegeId,
    adminId: adminUser?.id,
    actorEmail: adminUser?.email,
    action: 'UNPUBLISH_EXAM',
    examId,
    details: `Reverted exam status to DRAFT`,
  });

  return { success: true };
}

/**
 * Safe delete or archive: If attempts exist, archives the exam rather than deleting historical results.
 */
export async function deleteOrArchiveExam(
  examId: string,
  collegeId: string,
  adminUser?: { id: string; email: string }
): Promise<{ success: boolean; action: 'DELETED' | 'ARCHIVED'; error?: string }> {
  const db = await getExamDbClient();
  const exam = await getExamById(examId, collegeId);
  if (!exam) {
    return { success: false, action: 'DELETED', error: 'Exam not found.' };
  }

  // Check if student attempts exist
  const { count: attemptCount } = await db
    .from('exam_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('exam_id', examId);

  if (attemptCount && attemptCount > 0) {
    // Soft-archive to preserve historical records
    await db
      .from('exams')
      .update({
        status: 'ARCHIVED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', examId)
      .eq('college_id', collegeId);

    await logExamAudit({
      collegeId,
      adminId: adminUser?.id,
      actorEmail: adminUser?.email,
      action: 'ARCHIVE_EXAM',
      examId,
      details: `Archived exam "${exam.title}" (${attemptCount} attempts preserved)`,
    });

    return { success: true, action: 'ARCHIVED' };
  }

  // No attempts exist: safe hard delete
  const { error } = await db
    .from('exams')
    .delete()
    .eq('id', examId)
    .eq('college_id', collegeId);

  if (error) {
    return { success: false, action: 'DELETED', error: error.message };
  }

  await logExamAudit({
    collegeId,
    adminId: adminUser?.id,
    actorEmail: adminUser?.email,
    action: 'DELETE_EXAM',
    examId,
    details: `Deleted draft exam "${exam.title}"`,
  });

  return { success: true, action: 'DELETED' };
}

/**
 * Fetch exam results dashboard data for faculty.
 */
export async function getExamResultsDashboard(
  examId: string,
  collegeId: string,
  filters?: {
    branchId?: string;
    status?: string;
    search?: string;
    sortBy?: 'score' | 'percentage' | 'name' | 'submitted_at';
    sortOrder?: 'asc' | 'desc';
  }
): Promise<ExamResultsDashboardData> {
  const db = await getExamDbClient();
  const exam = await getExamById(examId, collegeId);
  if (!exam) {
    throw new Error('Exam not found or unauthorized.');
  }

  let query = db
    .from('exam_attempts')
    .select(`
      *,
      branch:branches(id, name, code),
      semester:semesters(id, name)
    `)
    .eq('exam_id', examId)
    .eq('college_id', collegeId);

  if (filters?.branchId && filters.branchId !== 'ALL') {
    query = query.eq('branch_id', filters.branchId);
  }

  if (filters?.status && filters.status !== 'ALL') {
    query = query.eq('status', filters.status);
  }

  if (filters?.search && filters.search.trim()) {
    const q = filters.search.trim();
    query = query.or(`student_name.ilike.%${q}%,roll_number.ilike.%${q}%,registration_number.ilike.%${q}%`);
  }

  // Sorting
  const sortCol = filters?.sortBy === 'score'
    ? 'obtained_marks'
    : filters?.sortBy === 'percentage'
    ? 'percentage'
    : filters?.sortBy === 'name'
    ? 'student_name'
    : 'submitted_at';

  query = query.order(sortCol, { ascending: filters?.sortOrder === 'asc' });

  const { data: attemptsData } = await query;
  const attempts = attemptsData || [];

  // Calculate summary metrics
  const totalStudents = attempts.length;
  const submittedAttempts = attempts.filter((a: any) => a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED');
  const scores = submittedAttempts.map((a: any) => Number(a.obtained_marks) || 0);
  const percentages = submittedAttempts.map((a: any) => Number(a.percentage) || 0);

  const avgScore = scores.length > 0 ? roundDecimal(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const avgPct = percentages.length > 0 ? roundDecimal(percentages.reduce((a, b) => a + b, 0) / percentages.length) : 0;
  const highest = scores.length > 0 ? Math.max(...scores) : 0;
  const lowest = scores.length > 0 ? Math.min(...scores) : 0;
  const passCount = submittedAttempts.filter((a: any) => a.is_passed).length;
  const failCount = submittedAttempts.length - passCount;
  const passRate = submittedAttempts.length > 0 ? roundDecimal((passCount / submittedAttempts.length) * 100) : 0;

  const summary: ExamResultsDashboardSummary = {
    exam_id: exam.id,
    exam_title: exam.title,
    total_students_attempted: totalStudents,
    total_submissions: submittedAttempts.length,
    average_score: avgScore,
    average_percentage: avgPct,
    highest_score: highest,
    lowest_score: lowest,
    pass_count: passCount,
    fail_count: failCount,
    pass_rate_percentage: passRate,
  };

  // Fetch all answers for submitted attempts to compute question accuracy analytics
  const attemptIds = submittedAttempts.map((a: any) => a.id);
  let allAnswers: any[] = [];
  if (attemptIds.length > 0) {
    const { data: ansData } = await db
      .from('exam_answers')
      .select('*')
      .in('attempt_id', attemptIds);
    allAnswers = ansData || [];
  }

  const questionAnalytics = calculateQuestionAnalytics(exam.questions || [], allAnswers);

  return {
    exam,
    summary: {
      ...summary,
      total_attempts: summary.total_submissions,
      unique_students_count: summary.total_students_attempted,
      pass_percentage: summary.pass_rate_percentage,
    },
    attempts,
    questionAnalytics,
    question_analytics: questionAnalytics,
  };
}
