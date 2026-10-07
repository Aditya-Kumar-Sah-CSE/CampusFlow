'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { generateResponseToken, verifyResponseToken } from '@/lib/feedback/response-token';
import { sendStudentSubmissionConfirmationEmail } from '@/lib/email/service';
import { syncFormResponsesToSheet } from '@/lib/google/sync';
import { appUrl } from '@/lib/config/app';

export interface VerifiedConfirmationData {
  isValid: boolean;
  formId?: string;
  formTitle: string;
  collegeId?: string;
  collegeName?: string;
  collegeSlug?: string;
  collegeCode?: string;
  collegeLogoUrl?: string | null;
  academicYear: string;
  branch: string;
  semester: string;
  submittedAt: string | null;
  studentEmail: string;
  studentName: string | null;
  registrationNumber: string | null;
  downloadUrl: string;
  emailStatus: string;
  errorMessage?: string;
}

/**
 * Validates an HMAC token and returns the verified student confirmation details
 */
export async function getConfirmationByTokenAction(
  token: string
): Promise<VerifiedConfirmationData | null> {
  const payload = verifyResponseToken(token);
  if (!payload) {
    return null;
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return null;
  }

  const { data: rec } = await supabase
    .from('feedback_response_records')
    .select(`
      id,
      google_response_id,
      student_email,
      student_name,
      registration_number,
      submitted_at,
      email_status,
      form:feedback_forms(
        id,
        title,
        college_id,
        college:colleges(id, name, slug, code, logo_url),
        branch:branches(name),
        semester:semesters(name),
        academic_year:academic_years(name)
      )
    `)
    .eq('form_id', payload.formId)
    .eq('google_response_id', payload.responseId)
    .maybeSingle();

  if (!rec || !rec.form) {
    return null;
  }

  const form: any = rec.form;
  const downloadUrl = appUrl(`/api/feedback/response/download?token=${encodeURIComponent(token)}`);

  return {
    isValid: true,
    formId: form.id,
    formTitle: form.title,
    collegeId: form.college?.id || form.college_id,
    collegeName: form.college?.name || 'Institution',
    collegeSlug: form.college?.slug || '',
    collegeCode: form.college?.code || '',
    collegeLogoUrl: form.college?.logo_url || null,
    academicYear: form.academic_year?.name || 'Academic Session',
    branch: form.branch?.name || 'Department',
    semester: form.semester?.name || 'Semester',
    submittedAt: rec.submitted_at,
    studentEmail: rec.student_email,
    studentName: rec.student_name,
    registrationNumber: rec.registration_number,
    downloadUrl,
    emailStatus: rec.email_status || 'PENDING',
  };
}

/**
 * Looks up a verified submission by student email and formId, returning a signed token
 */
export async function verifyStudentSubmissionAction(params: {
  formId: string;
  email: string;
}): Promise<{ success: boolean; data?: VerifiedConfirmationData; token?: string; message: string }> {
  const { formId, email } = params;

  const rawQuery = (email || '').trim();
  if (!formId || !rawQuery) {
    return {
      success: false,
      message: 'Please provide a feedback form and your registered email or university registration number.',
    };
  }

  const normalizedQuery = rawQuery.toLowerCase();
  const isEmail = rawQuery.includes('@');
  const supabase = createAdminClient();
  if (!supabase) {
    return {
      success: false,
      message: 'Database service is currently unavailable.',
    };
  }

  // 1. Resolve actual form UUID in case google_form_id or alternate key was passed
  let resolvedFormId = formId;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(formId);
  if (!isUuid) {
    const { data: matchedForm } = await supabase
      .from('feedback_forms')
      .select('id')
      .eq('google_form_id', formId)
      .maybeSingle();
    if (matchedForm) {
      resolvedFormId = matchedForm.id;
    }
  }

  const buildQuery = () => {
    let q = supabase
      .from('feedback_response_records')
      .select(`
        id,
        google_response_id,
        student_email,
        student_name,
        registration_number,
        submitted_at,
        email_status,
        form:feedback_forms(
          id,
          title,
          college_id,
          college:colleges(id, name, slug, code, logo_url),
          branch:branches(name),
          semester:semesters(name),
          academic_year:academic_years(name)
        )
      `)
      .eq('form_id', resolvedFormId);

    if (isEmail) {
      q = q.ilike('student_email', normalizedQuery);
    } else {
      q = q.or(`registration_number.eq.${rawQuery},registration_number.ilike.${normalizedQuery}`);
    }
    return q.order('submitted_at', { ascending: false }).limit(1);
  };

  // 2. Query existing verified record
  let { data: rec } = await buildQuery().maybeSingle();

  // 3. If not found in DB yet, trigger instant on-demand sync with Google Forms
  if (!rec) {
    try {
      await syncFormResponsesToSheet({ formId: resolvedFormId, skipAuthCheck: true });
      const { data: retryRec } = await buildQuery().maybeSingle();
      rec = retryRec;
    } catch (syncErr) {
      console.warn('[verifyStudentSubmissionAction] On-demand sync attempt notice:', syncErr);
    }
  }

  // 4. Fallback: if student submitted on a form with anonymous/disabled Google Form email collection
  if (!rec) {
    const { data: recentUnboundRec } = await supabase
      .from('feedback_response_records')
      .select(`
        id,
        google_response_id,
        student_email,
        student_name,
        registration_number,
        submitted_at,
        email_status,
        form:feedback_forms(
          id,
          title,
          college_id,
          college:colleges(id, name, slug, code, logo_url),
          branch:branches(name),
          semester:semesters(name),
          academic_year:academic_years(name)
        )
      `)
      .eq('form_id', resolvedFormId)
      .or('student_email.is.null,student_email.eq.')
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentUnboundRec && recentUnboundRec.form) {
      await supabase
        .from('feedback_response_records')
        .update({ student_email: normalizedQuery })
        .eq('id', recentUnboundRec.id);
      recentUnboundRec.student_email = normalizedQuery;
      rec = recentUnboundRec;
    }
  }

  if (!rec || !rec.form) {
    return {
      success: false,
      message:
        'No verified submission found for this email on the selected form. If you just submitted Google Forms, please allow 1–2 minutes for the system sync.',
    };
  }

  const form: any = rec.form;
  const token = generateResponseToken({
    responseId: rec.google_response_id,
    formId: resolvedFormId,
    email: rec.student_email,
  });

  const downloadUrl = appUrl(`/api/feedback/response/download?token=${encodeURIComponent(token)}`);

  return {
    success: true,
    message: 'Submission successfully verified from institutional records.',
    token,
    data: {
      isValid: true,
      formId: form.id,
      formTitle: form.title,
      collegeId: form.college?.id || form.college_id,
      collegeName: form.college?.name || 'Institution',
      collegeSlug: form.college?.slug || '',
      collegeCode: form.college?.code || '',
      collegeLogoUrl: form.college?.logo_url || null,
      academicYear: form.academic_year?.name || 'Academic Session',
      branch: form.branch?.name || 'Department',
      semester: form.semester?.name || 'Semester',
      submittedAt: rec.submitted_at,
      studentEmail: rec.student_email,
      studentName: rec.student_name,
      registrationNumber: rec.registration_number,
      downloadUrl,
      emailStatus: rec.email_status || 'PENDING',
    },
  };
}

/**
 * Fetch form details and college branding for direct completion landing
 */
export async function getFormContextAction(formId: string): Promise<{
  formId: string;
  formTitle: string;
  collegeId: string;
  collegeName: string;
  collegeSlug: string;
  collegeCode?: string;
  collegeLogoUrl: string | null;
} | null> {
  if (!formId) return null;
  const supabase = createAdminClient();
  if (!supabase) return null;

  const { data: form } = await supabase
    .from('feedback_forms')
    .select('id, title, college_id, college:colleges(id, name, slug, code, logo_url)')
    .eq('id', formId)
    .maybeSingle();

  if (!form) return null;
  const col: any = form.college;
  return {
    formId: form.id,
    formTitle: form.title,
    collegeId: form.college_id,
    collegeName: col?.name || 'Institution',
    collegeSlug: col?.slug || '',
    collegeCode: col?.code || '',
    collegeLogoUrl: col?.logo_url || null,
  };
}

/**
 * Fetch college details and branding for tenant-directed completion landing
 */
export async function getTenantContextAction(tenantSlug: string): Promise<{
  collegeId: string;
  collegeName: string;
  collegeSlug: string;
  collegeCode?: string;
  collegeLogoUrl: string | null;
} | null> {
  if (!tenantSlug) return null;
  const supabase = createAdminClient();
  if (!supabase) return null;

  const { data: col } = await supabase
    .from('colleges')
    .select('id, name, slug, code, logo_url')
    .eq('slug', tenantSlug)
    .maybeSingle();

  if (!col) return null;
  return {
    collegeId: col.id,
    collegeName: col.name,
    collegeSlug: col.slug,
    collegeCode: col.code,
    collegeLogoUrl: col.logo_url || null,
  };
}

/**
 * Resends the confirmation email for a verified submission
 */
export async function resendConfirmationEmailAction(params: {
  formId: string;
  email: string;
}): Promise<{ success: boolean; message: string }> {
  const verified = await verifyStudentSubmissionAction(params);
  if (!verified.success || !verified.data) {
    return { success: false, message: verified.message };
  }

  const data = verified.data;
  const emailRes = await sendStudentSubmissionConfirmationEmail({
    studentEmail: data.studentEmail,
    studentName: data.studentName,
    registrationNumber: data.registrationNumber,
    formTitle: data.formTitle,
    academicYear: data.academicYear,
    branch: data.branch,
    semester: data.semester,
    submittedAt: data.submittedAt,
    downloadUrl: data.downloadUrl,
  });

  if (emailRes.status === 'SENT') {
    return {
      success: true,
      message: `Confirmation email successfully dispatched to ${data.studentEmail}.`,
    };
  } else if (emailRes.status === 'EMAIL_NOT_CONFIGURED') {
    return {
      success: false,
      message: 'Email service is not configured on the institution server. Please use "Download My Response" directly.',
    };
  } else {
    return {
      success: false,
      message: `Failed to dispatch email: ${emailRes.error || 'Unknown error'}`,
    };
  }
}
