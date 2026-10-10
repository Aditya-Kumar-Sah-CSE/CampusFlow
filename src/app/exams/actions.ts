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
import { getStudentSession } from '@/lib/auth/student-auth';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { getExamDbClient } from '@/lib/exams/exam-permission';

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
    const studentSession = await getStudentSession();
    if (!studentSession || !studentSession.user?.email) {
      return {
        success: false,
        error: 'Student sign-in is required to take this examination. Please log in first.',
      };
    }

    // Force student identity to logged in student credentials to prevent impersonation
    input.student_email = studentSession.user.email.toLowerCase().trim();
    if (studentSession.student?.fullName && !input.student_name) {
      input.student_name = studentSession.student.fullName;
    }
    if (studentSession.student?.registrationNumber) {
      input.registration_number = studentSession.student.registrationNumber.trim().toUpperCase();
    }

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
    const adminSession = await getAdminSession();
    const studentSession = await getStudentSession();

    if (!adminSession && !studentSession) {
      return { success: false, error: 'Sign in required to access exam attempt' };
    }

    const result = await getActiveAttempt(attemptId);

    // Verify student ownership if not admin
    if (!adminSession && studentSession?.user && result.attempt) {
      const userEmail = (studentSession.user.email || '').toLowerCase().trim();
      const studentRegNo = (studentSession.student?.registrationNumber || '').toLowerCase().trim();
      const attemptEmail = (result.attempt.student_email || '').toLowerCase().trim();
      const attemptRegNo = (result.attempt.registration_number || '').toLowerCase().trim();

      const isOwner =
        (attemptEmail && attemptEmail === userEmail) ||
        (studentRegNo && attemptRegNo && studentRegNo === attemptRegNo);

      if (!isOwner) {
        return {
          success: false,
          error: 'Access denied: You can only access your own examination attempt.',
        };
      }
    }

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
    const studentSession = await getStudentSession();
    const adminSession = await getAdminSession();
    if (!adminSession && !studentSession) {
      return { success: false, error: 'Authentication required to submit answers' };
    }

    // Check ownership if student
    if (!adminSession && studentSession?.user) {
      const db = await getExamDbClient();
      const { data: attempt } = await db
        .from('exam_attempts')
        .select('student_email, registration_number')
        .eq('id', params.attemptId)
        .single();

      if (attempt) {
        const userEmail = (studentSession.user.email || '').toLowerCase().trim();
        const studentRegNo = (studentSession.student?.registrationNumber || '').toLowerCase().trim();
        const attemptEmail = (attempt.student_email || '').toLowerCase().trim();
        const attemptRegNo = (attempt.registration_number || '').toLowerCase().trim();

        const isOwner =
          (attemptEmail && attemptEmail === userEmail) ||
          (studentRegNo && attemptRegNo && studentRegNo === attemptRegNo);

        if (!isOwner) {
          return { success: false, error: 'Unauthorized: Cannot modify another student\'s attempt' };
        }
      }
    }

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
    const studentSession = await getStudentSession();
    const adminSession = await getAdminSession();
    if (!adminSession && !studentSession) {
      return { success: false, error: 'Authentication required to submit exam' };
    }

    if (!adminSession && studentSession?.user) {
      const db = await getExamDbClient();
      const { data: attempt } = await db
        .from('exam_attempts')
        .select('student_email, registration_number')
        .eq('id', attemptId)
        .single();

      if (attempt) {
        const userEmail = (studentSession.user.email || '').toLowerCase().trim();
        const studentRegNo = (studentSession.student?.registrationNumber || '').toLowerCase().trim();
        const attemptEmail = (attempt.student_email || '').toLowerCase().trim();
        const attemptRegNo = (attempt.registration_number || '').toLowerCase().trim();

        const isOwner =
          (attemptEmail && attemptEmail === userEmail) ||
          (studentRegNo && attemptRegNo && studentRegNo === attemptRegNo);

        if (!isOwner) {
          return { success: false, error: 'Unauthorized: Cannot submit another student\'s attempt' };
        }
      }
    }

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
    const adminSession = await getAdminSession();
    const studentSession = await getStudentSession();

    if (!adminSession && !studentSession) {
      return { success: false, error: 'Sign in required to view examination result.' };
    }

    const result = await getAttemptResult(attemptId);

    // Verify ownership for students
    if (!adminSession && studentSession?.user && result.attempt) {
      const userEmail = (studentSession.user.email || '').toLowerCase().trim();
      const studentRegNo = (studentSession.student?.registrationNumber || '').toLowerCase().trim();
      const attemptEmail = (result.attempt.student_email || '').toLowerCase().trim();
      const attemptRegNo = (result.attempt.registration_number || '').toLowerCase().trim();

      const isOwner =
        (attemptEmail && attemptEmail === userEmail) ||
        (studentRegNo && attemptRegNo && studentRegNo === attemptRegNo);

      if (!isOwner) {
        return {
          success: false,
          error: 'Access restricted: Students can only view their own examination results. Please sign in with the student account that took this exam.',
        };
      }
    }

    return { success: true, result };
  } catch (error: any) {
    console.error('getExamResultAction error:', error);
    return { success: false, error: error?.message || 'Failed to load exam result' };
  }
}
