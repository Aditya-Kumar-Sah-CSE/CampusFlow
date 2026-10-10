import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { StudentSession, StudentProfile, StudentFormEligibility } from '@/types/student';

/**
 * Resolves the authenticated student session.
 * Cached per-request with React.cache to avoid redundant auth and database round-trips.
 */
export const getStudentSession = cache(async function getStudentSession(
  client?: any
): Promise<StudentSession> {
  const supabase = client || (await createClient());

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      isAuthenticated: false,
      isStudent: false,
      emailVerified: false,
      student: null,
      user: null,
    };
  }

  const email = (user.email || '').toLowerCase().trim();
  const emailVerified = Boolean(
    user.email_confirmed_at ||
    user.user_metadata?.email_verified === true
  );

  // 1. Check if user has a record in students table
  let studentProfile: StudentProfile | null = null;
  const adminDb = createAdminClient() || supabase;

  try {
    const { data: studentRecord, error: studentError } = await adminDb
      .from('students')
      .select(`
        id,
        user_id,
        college_id,
        email,
        full_name,
        registration_number,
        is_active,
        email_verified,
        created_at,
        updated_at,
        colleges (
          id,
          name,
          slug,
          code,
          logo_url,
          is_active
        )
      `)
      .eq('user_id', user.id)
      .maybeSingle();

    if (studentRecord && studentRecord.colleges) {
      const col = (studentRecord as any).colleges;
      studentProfile = {
        id: studentRecord.id,
        userId: studentRecord.user_id,
        collegeId: studentRecord.college_id,
        collegeName: col.name,
        collegeSlug: col.slug,
        collegeCode: col.code,
        collegeLogoUrl: col.logo_url || null,
        email: studentRecord.email,
        fullName: studentRecord.full_name || user.user_metadata?.name || 'Student',
        registrationNumber: studentRecord.registration_number || null,
        emailVerified: Boolean(studentRecord.email_verified || emailVerified),
        isActive: studentRecord.is_active,
        createdAt: studentRecord.created_at,
        updatedAt: studentRecord.updated_at,
      };
    }
  } catch (err) {
    console.warn('[student-auth] Failed to query students table, falling back to metadata:', err);
  }

  // 2. Resilient fallback: If students table record does not exist or table not yet migrated,
  // resolve student association from user_metadata and colleges table
  if (!studentProfile && user.user_metadata?.role === 'STUDENT' && user.user_metadata?.college_id) {
    try {
      const { data: college } = await adminDb
        .from('colleges')
        .select('id, name, slug, code, logo_url, is_active')
        .eq('id', user.user_metadata.college_id)
        .maybeSingle();

      if (college && college.is_active) {
        studentProfile = {
          id: user.id,
          userId: user.id,
          collegeId: college.id,
          collegeName: college.name,
          collegeSlug: college.slug,
          collegeCode: college.code,
          collegeLogoUrl: college.logo_url || null,
          email,
          fullName: user.user_metadata.name || 'Student',
          registrationNumber: user.user_metadata.registration_number || null,
          emailVerified,
          isActive: true,
          createdAt: user.created_at,
        };
      }
    } catch (err) {
      console.warn('[student-auth] Metadata college lookup failed:', err);
    }
  }

  const isStudent = Boolean(studentProfile || user.user_metadata?.role === 'STUDENT');

  return {
    isAuthenticated: true,
    isStudent,
    emailVerified: Boolean(studentProfile?.emailVerified || emailVerified),
    student: studentProfile,
    user: {
      id: user.id,
      email,
      user_metadata: user.user_metadata,
    },
  };
});

/**
 * Checks student eligibility to submit an active feedback form.
 * Preserves institutional scoping (cross-college isolation) and submission state.
 */
export async function checkStudentFormEligibility(
  formId: string,
  providedSession?: StudentSession
): Promise<StudentFormEligibility> {
  const session = providedSession || (await getStudentSession());

  if (!session.isAuthenticated || !session.user) {
    return {
      isEligible: false,
      isAuthenticated: false,
      isEmailVerified: false,
      reason: 'NOT_AUTHENTICATED',
      message: 'Please sign in with your student account to submit this feedback form.',
    };
  }

  if (!session.emailVerified) {
    return {
      isEligible: false,
      isAuthenticated: true,
      isEmailVerified: false,
      reason: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email address to access and submit feedback forms.',
      studentCollegeId: session.student?.collegeId,
      studentCollegeName: session.student?.collegeName,
    };
  }

  const db = createAdminClient() || (await createClient());

  // Fetch form details including college_id and status
  const { data: form, error } = await db
    .from('feedback_forms')
    .select(`
      id,
      college_id,
      status,
      title,
      colleges (
        id,
        name,
        slug
      )
    `)
    .eq('id', formId)
    .maybeSingle();

  if (error || !form) {
    return {
      isEligible: false,
      isAuthenticated: true,
      isEmailVerified: true,
      reason: 'FORM_CLOSED',
      message: 'Feedback form not found or unavailable.',
    };
  }

  const formCollege = (form as any).colleges;
  const formCollegeId = form.college_id;
  const formCollegeName = formCollege?.name || 'Institution';

  // Check form status
  if (form.status === 'CLOSED' || form.status === 'ARCHIVED') {
    return {
      isEligible: false,
      isAuthenticated: true,
      isEmailVerified: true,
      reason: 'FORM_CLOSED',
      message: 'This feedback form has concluded and is no longer accepting responses.',
      formCollegeId,
      formCollegeName,
      studentCollegeId: session.student?.collegeId,
      studentCollegeName: session.student?.collegeName,
    };
  }

  // Cross-college tenant check
  if (session.student?.collegeId && session.student.collegeId !== formCollegeId) {
    return {
      isEligible: false,
      isAuthenticated: true,
      isEmailVerified: true,
      reason: 'CROSS_COLLEGE_RESTRICTED',
      message: `This feedback form is restricted to students of ${formCollegeName}. You are registered with ${session.student.collegeName}.`,
      formCollegeId,
      formCollegeName,
      studentCollegeId: session.student.collegeId,
      studentCollegeName: session.student.collegeName,
    };
  }

  // Check if student already submitted this form
  let alreadySubmitted = false;
  let submittedAt: string | null = null;

  try {
    let { data: existingResponse } = await db
      .from('feedback_response_records')
      .select('id, submitted_at')
      .eq('form_id', formId)
      .ilike('student_email', session.user.email)
      .limit(1)
      .maybeSingle();

    if (!existingResponse) {
      try {
        const { syncFormResponsesToSheet } = await import('@/lib/google/sync');
        await syncFormResponsesToSheet({ formId, skipAuthCheck: true });
        const { data: syncedResponse } = await db
          .from('feedback_response_records')
          .select('id, submitted_at')
          .eq('form_id', formId)
          .ilike('student_email', session.user.email)
          .limit(1)
          .maybeSingle();
        existingResponse = syncedResponse;
      } catch (syncErr) {
        // non-fatal fallback
      }
    }

    if (existingResponse) {
      alreadySubmitted = true;
      submittedAt = existingResponse.submitted_at;
    }
  } catch (err) {
    console.warn('[student-auth] Duplicate check warning:', err);
  }

  return {
    isEligible: true,
    isAuthenticated: true,
    isEmailVerified: true,
    reason: 'ELIGIBLE',
    message: alreadySubmitted
      ? 'You have already submitted a response for this feedback form.'
      : 'You are eligible to submit feedback for this course.',
    formCollegeId,
    formCollegeName,
    studentCollegeId: session.student?.collegeId,
    studentCollegeName: session.student?.collegeName,
    alreadySubmitted,
    submittedAt,
  };
}
