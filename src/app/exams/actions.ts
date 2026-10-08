'use server';

import {
  getStudentAvailableExams,
  getPublicExamDetails,
  startExamAttempt,
  getActiveAttempt,
  saveAnswerIncremental,
  submitExamAttempt,
  getAttemptResult,
} from '@/lib/exams/exam-attempt-service';
import type { StartExamAttemptInput } from '@/lib/exams/exam-validation';
import type {
  Exam,
  ExamAttempt,
  ExamQuestion,
  ExamAttemptResult,
} from '@/types/exams';

/**
 * Retrieves public/published exams for students under a college tenant.
 */
export async function getPublicExamsAction(params: {
  collegeId: string;
  branchId?: string;
  semesterId?: string;
}): Promise<{ success: boolean; data?: Exam[]; error?: string }> {
  try {
    const exams = await getStudentAvailableExams(params);
    return { success: true, data: exams };
  } catch (error: any) {
    console.error('getPublicExamsAction error:', error);
    return { success: false, error: error?.message || 'Failed to load available exams' };
  }
}

/**
 * Loads exam overview and rules before student begins test.
 */
export async function getPublicExamDetailsAction(
  examId: string
): Promise<{ success: boolean; data?: Exam; error?: string }> {
  try {
    const exam = await getPublicExamDetails(examId);
    return { success: true, data: exam };
  } catch (error: any) {
    console.error('getPublicExamDetailsAction error:', error);
    return { success: false, error: error?.message || 'Failed to load exam details' };
  }
}

/**
 * Initiates an exam attempt for a student or resumes an existing active attempt safely.
 */
export async function startExamAttemptAction(input: StartExamAttemptInput): Promise<{
  success: boolean;
  attempt?: ExamAttempt;
  questions?: ExamQuestion[];
  savedAnswers?: Record<string, string>;
  isResumed?: boolean;
  error?: string;
}> {
  try {
    const result = await startExamAttempt(input);
    return {
      success: true,
      attempt: result.attempt,
      questions: result.questions,
      savedAnswers: result.savedAnswers,
      isResumed: result.isResumed,
    };
  } catch (error: any) {
    console.error('startExamAttemptAction error:', error);
    return { success: false, error: error?.message || 'Failed to start exam attempt' };
  }
}

/**
 * Restores an in-progress attempt during browser refresh or network reconnection.
 */
export async function getActiveAttemptAction(attemptId: string): Promise<{
  success: boolean;
  attempt?: ExamAttempt;
  exam?: Exam;
  questions?: ExamQuestion[];
  savedAnswers?: Record<string, string>;
  error?: string;
}> {
  try {
    const result = await getActiveAttempt(attemptId);
    return {
      success: true,
      attempt: result.attempt,
      exam: result.exam,
      questions: result.questions,
      savedAnswers: result.savedAnswers,
    };
  } catch (error: any) {
    console.error('getActiveAttemptAction error:', error);
    return { success: false, error: error?.message || 'Failed to restore active attempt' };
  }
}

/**
 * Debounced incremental answer saving.
 */
export async function saveAnswerIncrementalAction(params: {
  attemptId: string;
  questionId: string;
  selectedOptionId: string | null;
}): Promise<{ success: boolean; answeredAt?: string; error?: string }> {
  try {
    const res = await saveAnswerIncremental(params);
    return { success: true, answeredAt: res.answeredAt };
  } catch (error: any) {
    console.error('saveAnswerIncrementalAction error:', error);
    return { success: false, error: error?.message || 'Failed to save answer' };
  }
}

/**
 * Final authoritative submission of an exam attempt.
 */
export async function submitExamAttemptAction(
  attemptId: string
): Promise<{ success: boolean; result?: ExamAttemptResult; error?: string }> {
  try {
    const result = await submitExamAttempt(attemptId);
    return { success: true, result };
  } catch (error: any) {
    console.error('submitExamAttemptAction error:', error);
    return { success: false, error: error?.message || 'Failed to submit exam attempt' };
  }
}

/**
 * Retrieves the scorecard and breakdown for a completed attempt.
 */
export async function getExamResultAction(
  attemptId: string
): Promise<{ success: boolean; result?: ExamAttemptResult; error?: string }> {
  try {
    const result = await getAttemptResult(attemptId);
    return { success: true, result };
  } catch (error: any) {
    console.error('getExamResultAction error:', error);
    return { success: false, error: error?.message || 'Failed to load exam result' };
  }
}
