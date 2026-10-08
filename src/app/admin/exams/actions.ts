'use server';

import { revalidatePath } from 'next/cache';
import { assertExamFacultyAccess, getExamDbClient } from '@/lib/exams/exam-permission';
import {
  getCollegeExams,
  getExamById,
  createExam,
  updateExam,
  saveExamQuestions,
  publishExam,
  unpublishExam,
  deleteOrArchiveExam,
  getExamResultsDashboard,
} from '@/lib/exams/exam-service';
import type {
  CreateExamInput,
  UpdateExamInput,
  SaveExamQuestionsInput,
} from '@/lib/exams/exam-validation';
import type { Exam, ExamResultsDashboardData, ExamStatus } from '@/types/exams';

/**
 * Loads all exams for the authorized college tenant.
 */
export async function getCollegeExamsAction(
  collegeId?: string,
  filter?: { status?: string; branchId?: string; semesterId?: string }
): Promise<{ success: boolean; data?: Exam[]; error?: string }> {
  try {
    const { authorizedCollegeId } = await assertExamFacultyAccess(collegeId);
    const result = await getCollegeExams(authorizedCollegeId, {
      status: (filter?.status as ExamStatus | 'ALL') || 'ALL',
    });
    return { success: true, data: result.exams };
  } catch (error: any) {
    console.error('getCollegeExamsAction error:', error);
    return { success: false, error: error?.message || 'Failed to load exams' };
  }
}

/**
 * Loads a single exam with branches, subjects, and full questions.
 */
export async function getExamByIdAction(
  examId: string,
  collegeId?: string
): Promise<{ success: boolean; data?: Exam; error?: string }> {
  try {
    const { authorizedCollegeId } = await assertExamFacultyAccess(collegeId);
    const exam = await getExamById(examId, authorizedCollegeId);
    return { success: true, data: exam || undefined };
  } catch (error: any) {
    console.error('getExamByIdAction error:', error);
    return { success: false, error: error?.message || 'Failed to load exam details' };
  }
}

/**
 * Fetches academic master data for the guided exam creation wizard.
 */
export async function getAcademicMastersForExamsAction(collegeId?: string): Promise<{
  success: boolean;
  data?: {
    academicSessions: { id: string; name: string; is_active: boolean }[];
    programmes: {
      id: string;
      name: string;
      code: string;
      programme_type?: string;
      level_type?: string;
      has_branches?: boolean;
      is_active: boolean;
    }[];
    semesters: {
      id: string;
      name: string;
      display_name?: string | null;
      semester_number?: number | null;
      year_number?: number | null;
      class_number?: number | null;
      level_number?: number | null;
      level_type?: string;
      programme_id?: string | null;
      programme?: any;
      number?: number;
      is_active: boolean;
    }[];
    branches: { id: string; name: string; code: string; is_active: boolean }[];
    subjects: { id: string; name: string; code: string; branch_id?: string; semester_id?: string; is_active: boolean }[];
  };
  error?: string;
}> {
  try {
    const { authorizedCollegeId } = await assertExamFacultyAccess(collegeId);
    const db = await getExamDbClient();

    const [
      { data: sessions, error: sessErr },
      { data: progs, error: progErr },
      { data: sems, error: semErr },
      { data: branches, error: brErr },
      { data: subs, error: subErr },
    ] = await Promise.all([
      db
        .from('academic_years')
        .select('id, name, is_active')
        .eq('college_id', authorizedCollegeId)
        .order('name', { ascending: false }),
      db
        .from('academic_programmes')
        .select('id, name, code, programme_type, duration_years, level_type, has_branches, is_active')
        .eq('college_id', authorizedCollegeId)
        .order('name', { ascending: true }),
      db
        .from('semesters')
        .select(`
          id, name, semester_number, year_number, level_type, level_number, class_number, display_name, programme_id, is_active,
          programme:academic_programmes(id, name, code, programme_type, level_type, has_branches)
        `)
        .eq('college_id', authorizedCollegeId)
        .order('level_number', { ascending: true }),
      db
        .from('branches')
        .select('id, name, code, is_active')
        .eq('college_id', authorizedCollegeId)
        .order('name', { ascending: true }),
      db
        .from('subjects')
        .select('id, name, code, branch_id, semester_id, is_active')
        .eq('college_id', authorizedCollegeId)
        .order('name', { ascending: true }),
    ]);

    if (sessErr || semErr || brErr || subErr || progErr) {
      console.warn('Notice loading academic masters (non-blocking fallback):', {
        sessErr,
        progErr,
        semErr,
        brErr,
        subErr,
      });
    }

    return {
      success: true,
      data: {
        academicSessions: (sessions || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          is_active: Boolean(s.is_active),
        })),
        programmes: (progs || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          programme_type: p.programme_type,
          level_type: p.level_type,
          has_branches: Boolean(p.has_branches),
          is_active: Boolean(p.is_active),
        })),
        semesters: (sems || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          display_name: s.display_name || s.name,
          semester_number: s.semester_number,
          year_number: s.year_number,
          class_number: s.class_number,
          level_number: s.level_number || s.semester_number || s.class_number,
          level_type: s.level_type || (s.class_number ? 'CLASS' : 'SEMESTER'),
          programme_id: s.programme_id,
          programme: s.programme || null,
          is_active: Boolean(s.is_active),
        })),
        branches: (branches || []).map((b: any) => ({
          id: b.id,
          name: b.name,
          code: b.code || '',
          is_active: Boolean(b.is_active),
        })),
        subjects: (subs || []).map((sb: any) => ({
          id: sb.id,
          name: sb.name,
          code: sb.code || '',
          branch_id: sb.branch_id,
          semester_id: sb.semester_id,
          is_active: Boolean(sb.is_active),
        })),
      },
    };
  } catch (error: any) {
    console.error('getAcademicMastersForExamsAction error:', error);
    return { success: false, error: error?.message || 'Failed to load academic records' };
  }
}

/**
 * Creates a new draft exam.
 */
export async function createExamAction(
  input: CreateExamInput,
  collegeId?: string
): Promise<{ success: boolean; data?: Exam; error?: string }> {
  try {
    const { session, authorizedCollegeId } = await assertExamFacultyAccess(collegeId);
    const exam = await createExam({
      ...input,
      college_id: authorizedCollegeId,
      created_by: session.userId,
    } as any);

    revalidatePath('/admin/dashboard/exams');
    revalidatePath('/admin/dashboard');
    return { success: true, data: exam };
  } catch (error: any) {
    console.error('createExamAction error:', error);
    return { success: false, error: error?.message || 'Failed to create exam' };
  }
}

/**
 * Updates basic configuration and academic scope of an exam.
 */
export async function updateExamAction(
  input: UpdateExamInput,
  collegeId?: string
): Promise<{ success: boolean; data?: Exam; error?: string }> {
  try {
    const { authorizedCollegeId } = await assertExamFacultyAccess(collegeId);
    const exam = await updateExam(input.id, authorizedCollegeId, input as any);

    revalidatePath(`/admin/dashboard/exams/${input.id}`);
    revalidatePath('/admin/dashboard/exams');
    return { success: true, data: exam };
  } catch (error: any) {
    console.error('updateExamAction error:', error);
    return { success: false, error: error?.message || 'Failed to update exam' };
  }
}

/**
 * Saves or updates all questions and options for an exam.
 */
export async function saveExamQuestionsAction(
  input: SaveExamQuestionsInput,
  collegeId?: string
): Promise<{ success: boolean; data?: Exam; error?: string }> {
  try {
    const { authorizedCollegeId } = await assertExamFacultyAccess(collegeId);
    await saveExamQuestions(input.exam_id, authorizedCollegeId, input.questions as any);
    const exam = await getExamById(input.exam_id, authorizedCollegeId);

    revalidatePath(`/admin/dashboard/exams/${input.exam_id}`);
    return { success: true, data: exam || undefined };
  } catch (error: any) {
    console.error('saveExamQuestionsAction error:', error);
    return { success: false, error: error?.message || 'Failed to save questions' };
  }
}

/**
 * Validates and publishes an exam.
 */
export async function publishExamAction(
  examId: string,
  collegeId?: string
): Promise<{ success: boolean; data?: Exam; error?: string }> {
  try {
    const { session, authorizedCollegeId } = await assertExamFacultyAccess(collegeId);
    const res = await publishExam(examId, authorizedCollegeId, {
      id: session.userId,
      email: session.email,
    });

    if (!res.success) {
      throw new Error(res.error || 'Failed to publish exam');
    }

    revalidatePath(`/admin/dashboard/exams/${examId}`);
    revalidatePath('/admin/dashboard/exams');
    revalidatePath('/exams');
    return { success: true, data: res.exam };
  } catch (error: any) {
    console.error('publishExamAction error:', error);
    return { success: false, error: error?.message || 'Failed to publish exam' };
  }
}

/**
 * Unpublishes an active exam back to DRAFT or CLOSED.
 */
export async function unpublishExamAction(
  examId: string,
  collegeId?: string
): Promise<{ success: boolean; data?: Exam; error?: string }> {
  try {
    const { session, authorizedCollegeId } = await assertExamFacultyAccess(collegeId);
    const res = await unpublishExam(examId, authorizedCollegeId, {
      id: session.userId,
      email: session.email,
    });

    if (!res.success) {
      throw new Error(res.error || 'Failed to unpublish exam');
    }

    const exam = await getExamById(examId, authorizedCollegeId);

    revalidatePath(`/admin/dashboard/exams/${examId}`);
    revalidatePath('/admin/dashboard/exams');
    revalidatePath('/exams');
    return { success: true, data: exam || undefined };
  } catch (error: any) {
    console.error('unpublishExamAction error:', error);
    return { success: false, error: error?.message || 'Failed to unpublish exam' };
  }
}

/**
 * Deletes or safely archives an exam depending on whether student attempts exist.
 */
export async function deleteOrArchiveExamAction(
  examId: string,
  collegeId?: string
): Promise<{ success: boolean; actionTaken: 'DELETED' | 'ARCHIVED'; message: string }> {
  try {
    const { session, authorizedCollegeId } = await assertExamFacultyAccess(collegeId);
    const result = await deleteOrArchiveExam(examId, authorizedCollegeId, {
      id: session.userId,
      email: session.email,
    });

    revalidatePath('/admin/dashboard/exams');
    revalidatePath('/exams');
    return {
      success: result.success,
      actionTaken: result.action,
      message: result.error || 'Exam updated successfully',
    };
  } catch (error: any) {
    console.error('deleteOrArchiveExamAction error:', error);
    return { success: false, actionTaken: 'DELETED', message: error?.message || 'Failed to delete/archive exam' };
  }
}

/**
 * Fetches comprehensive faculty results dashboard including student attempts and question accuracy analytics.
 */
export async function getExamResultsDashboardAction(
  examId: string,
  collegeId?: string
): Promise<{ success: boolean; data?: ExamResultsDashboardData; error?: string }> {
  try {
    const { authorizedCollegeId } = await assertExamFacultyAccess(collegeId);
    const data = await getExamResultsDashboard(examId, authorizedCollegeId);
    return { success: true, data: data as any };
  } catch (error: any) {
    console.error('getExamResultsDashboardAction error:', error);
    return { success: false, error: error?.message || 'Failed to load exam results dashboard' };
  }
}
