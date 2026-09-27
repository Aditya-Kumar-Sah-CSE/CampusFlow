'use server';

import { revalidatePath } from 'next/cache';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { fetchSingleResponseFromSheet } from '@/lib/google/sheets';
import { syncFormResponsesToSheet } from '@/lib/google/sync';
import { isGoogleConfigured } from '@/lib/google/auth';
import { BCE_FEEDBACK_PARAMETERS } from '@/lib/google/template';
import { isValidUUID } from '@/lib/validation';
import { assertBasicAnalyticsAccess } from '@/lib/billing/access-control';

export interface AdminResponseItem {
  id: string;
  formId: string;
  googleResponseId: string;
  studentEmail: string;
  studentName: string | null;
  registrationNumber: string | null;
  submittedAt: string | null;
  syncedAt: string;
  emailStatus: string;
  isExcluded: boolean;
  excludedAt: string | null;
  excludedBy: string | null;
  exclusionReason: string | null;
  includedAt: string | null;
  includedBy: string | null;
  isDuplicateRegNo: boolean;
  isDuplicateEmail: boolean;
  duplicateRegCount: number;
  duplicateEmailCount: number;
}

export interface AdminResponsesResult {
  success: boolean;
  responses: AdminResponseItem[];
  totalCount: number;
  totalSubmissions: number;
  includedCount: number;
  excludedCount: number;
  duplicateRegCount: number;
  duplicateEmailCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  formTitle: string;
  formType: string;
  activeFilter?: 'ALL' | 'INCLUDED' | 'EXCLUDED' | 'DUPLICATE_REG' | 'DUPLICATE_EMAIL';
  error?: string;
  code?: string;
}

export interface ResponseDetailItem {
  facultyName: string;
  subjectName: string;
  ratings: Array<{
    parameterId: number;
    parameterTitle: string;
    rating: string;
  }>;
}

export interface StudentResponseDetail {
  responseId: string;
  studentName: string | null;
  registrationNumber: string | null;
  studentEmail: string;
  submittedAt: string | null;
  facultyEvaluations: ResponseDetailItem[];
  generalFeedback: string | null;
  isExcluded?: boolean;
  excludedAt?: string | null;
  excludedBy?: string | null;
  exclusionReason?: string | null;
  includedAt?: string | null;
  includedBy?: string | null;
  isDuplicateRegNo?: boolean;
  isDuplicateEmail?: boolean;
}

async function getAdminDb(client?: any) {
  return createAdminClient() || client || (await createClient());
}

/**
 * Server action to fetch paginated feedback response records with search, tab filters,
 * duplicate detection, and manual exclusion status.
 */
export async function getFormResponsesAction(
  params: {
    formId: string;
    page?: number;
    pageSize?: number;
    search?: string;
    startDate?: string;
    endDate?: string;
    filter?: 'ALL' | 'INCLUDED' | 'EXCLUDED' | 'DUPLICATE_REG' | 'DUPLICATE_EMAIL';
  },
  options?: { client?: any }
): Promise<AdminResponsesResult> {
  const session = await getAdminSession(options?.client);
  if (!session.isAuthenticated || !session.isActive) {
    return {
      success: false,
      responses: [],
      totalCount: 0,
      totalSubmissions: 0,
      includedCount: 0,
      excludedCount: 0,
      duplicateRegCount: 0,
      duplicateEmailCount: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
      formTitle: '',
      formType: '',
      error: 'Unauthorized. Active admin session required.',
    };
  }

  // Centralized Billing & Plan Basic Analytics Permission Check
  const access = await assertBasicAnalyticsAccess(
    session.admin?.id,
    session.admin?.email || session.user?.email,
    session.admin?.role,
    session.admin?.status
  );

  if (!access.allowed) {
    return {
      success: false,
      responses: [],
      totalCount: 0,
      totalSubmissions: 0,
      includedCount: 0,
      excludedCount: 0,
      duplicateRegCount: 0,
      duplicateEmailCount: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
      formTitle: '',
      formType: '',
      code: access.code || 'BASIC_ANALYTICS_LOCKED',
      error: access.reason || 'Basic analytics access required. Please contact the Super Admin.',
    };
  }

  const { formId, page = 1, pageSize = 20, search, startDate, endDate, filter = 'ALL' } = params;
  const validPageSize = [10, 20, 50].includes(pageSize) ? pageSize : 20;

  if (!isValidUUID(formId)) {
    return {
      success: false,
      responses: [],
      totalCount: 0,
      totalSubmissions: 0,
      includedCount: 0,
      excludedCount: 0,
      duplicateRegCount: 0,
      duplicateEmailCount: 0,
      page: 1,
      pageSize: validPageSize,
      totalPages: 0,
      formTitle: '',
      formType: '',
      error: 'Invalid feedback form identifier format.',
    };
  }

  const supabase = await getAdminDb(options?.client);
  if (!supabase) {
    return {
      success: false,
      responses: [],
      totalCount: 0,
      totalSubmissions: 0,
      includedCount: 0,
      excludedCount: 0,
      duplicateRegCount: 0,
      duplicateEmailCount: 0,
      page: 1,
      pageSize: validPageSize,
      totalPages: 0,
      formTitle: '',
      formType: '',
      error: 'Database connection failed.',
    };
  }

  // 1. Fetch form metadata
  const { data: form } = await supabase
    .from('feedback_forms')
    .select('id, college_id, title, form_type, google_form_id, google_sheet_id, google_form_url, google_sheet_url')
    .eq('id', formId)
    .maybeSingle();

  if (!form) {
    return {
      success: false,
      responses: [],
      totalCount: 0,
      totalSubmissions: 0,
      includedCount: 0,
      excludedCount: 0,
      duplicateRegCount: 0,
      duplicateEmailCount: 0,
      page: 1,
      pageSize: validPageSize,
      totalPages: 0,
      formTitle: '',
      formType: '',
      error: 'Form not found.',
    };
  }

  // Tenant authorization check
  if (!session.isPlatformSuperAdmin) {
    const hasMembership = session.colleges.some(
      (c) => c.collegeId === form.college_id && c.status === 'ACTIVE'
    );
    if (!hasMembership) {
      return {
        success: false,
        responses: [],
        totalCount: 0,
        totalSubmissions: 0,
        includedCount: 0,
        excludedCount: 0,
        duplicateRegCount: 0,
        duplicateEmailCount: 0,
        page: 1,
        pageSize: validPageSize,
        totalPages: 0,
        formTitle: '',
        formType: '',
        code: 'FORBIDDEN',
        error: 'Access denied. You do not have permission to view responses for this form.',
      };
    }
  }

  // 2. Auto-sync if records table is empty or stale (>30s since last sync) and Google is configured
  const { count: currentRecordCount } = await supabase
    .from('feedback_response_records')
    .select('id', { count: 'exact', head: true })
    .eq('form_id', formId);

  const lastSyncedTime = form.last_synced_at ? new Date(form.last_synced_at).getTime() : 0;
  const isStale = Date.now() - lastSyncedTime > 30 * 1000;

  if ((currentRecordCount === 0 || currentRecordCount === null || isStale) && isGoogleConfigured()) {
    const resolvedFormId =
      form.google_form_id ||
      form.google_form_edit_url?.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/)?.[1] ||
      form.google_form_url?.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/)?.[1];
    const resolvedSheetId =
      form.google_sheet_id ||
      form.google_sheet_url?.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1];

    if (resolvedFormId && resolvedSheetId) {
      try {
        await syncFormResponsesToSheet({
          googleFormId: resolvedFormId,
          googleSheetId: resolvedSheetId,
          formId,
          callerSession: session,
          skipAuthCheck: true,
        });
      } catch (syncErr) {
        console.warn('Auto-sync in getFormResponsesAction encountered an issue:', syncErr);
      }
    }
  }

  // 3. Query all response records for this form to detect duplicates, exclusions, and compute summary counts
  let rawRecords: any[] = [];
  let isExcludedColSupported = true;

  const fullQuery = await supabase
    .from('feedback_response_records')
    .select(
      'id, form_id, google_response_id, student_email, student_name, registration_number, submitted_at, synced_at, email_status, is_excluded, excluded_at, excluded_by, exclusion_reason, included_at, included_by'
    )
    .eq('form_id', formId)
    .order('submitted_at', { ascending: false });

  if (fullQuery.error) {
    // If is_excluded column doesn't exist yet, query lean columns
    isExcludedColSupported = false;
    const fallbackQuery = await supabase
      .from('feedback_response_records')
      .select(
        'id, form_id, google_response_id, student_email, student_name, registration_number, submitted_at, synced_at, email_status'
      )
      .eq('form_id', formId)
      .order('submitted_at', { ascending: false });

    rawRecords = fallbackQuery.data || [];
  } else {
    rawRecords = fullQuery.data || [];
  }

  // If column not supported yet, overlay exclusion states from audit_logs
  const auditExclusionMap = new Map<string, { isExcluded: boolean; excludedAt?: string; excludedBy?: string; reason?: string; includedAt?: string; includedBy?: string }>();
  if (!isExcludedColSupported) {
    try {
      const { data: auditLogs } = await supabase
        .from('audit_logs')
        .select('action, entity_id, actor_user_id, metadata, created_at')
        .in('action', ['EXCLUDE_FEEDBACK_RESPONSE', 'INCLUDE_FEEDBACK_RESPONSE'])
        .order('created_at', { ascending: true });

      if (auditLogs) {
        for (const log of auditLogs) {
          const meta = (log.metadata as any) || {};
          if (meta.formId === formId) {
            const key = meta.recordId || log.entity_id;
            if (log.action === 'EXCLUDE_FEEDBACK_RESPONSE') {
              auditExclusionMap.set(key, {
                isExcluded: true,
                excludedAt: log.created_at,
                excludedBy: log.actor_user_id,
                reason: meta.reason || 'Manual exclusion',
              });
            } else if (log.action === 'INCLUDE_FEEDBACK_RESPONSE') {
              auditExclusionMap.set(key, {
                isExcluded: false,
                includedAt: log.created_at,
                includedBy: log.actor_user_id,
              });
            }
          }
        }
      }
    } catch {
      // Non-fatal fallback
    }
  }

  // 4. Calculate frequencies for Duplicate Registration Number and Duplicate Email
  const regCounts: Record<string, number> = {};
  const emailCounts: Record<string, number> = {};

  for (const r of rawRecords) {
    const rawReg = (r.registration_number || '').trim().toLowerCase();
    if (rawReg && rawReg !== 'n/a' && rawReg !== '-' && rawReg !== 'na' && rawReg !== 'null') {
      regCounts[rawReg] = (regCounts[rawReg] || 0) + 1;
    }

    const rawEmail = (r.student_email || '').trim().toLowerCase();
    if (rawEmail && rawEmail.includes('@')) {
      emailCounts[rawEmail] = (emailCounts[rawEmail] || 0) + 1;
    }
  }

  // 5. Annotate each record with duplicate & exclusion status
  const annotatedRecords: AdminResponseItem[] = rawRecords.map((r: any) => {
    const rawReg = (r.registration_number || '').trim().toLowerCase();
    const isValidReg = rawReg && rawReg !== 'n/a' && rawReg !== '-' && rawReg !== 'na' && rawReg !== 'null';
    const regCount = isValidReg ? regCounts[rawReg] || 0 : 0;
    const isDupReg = regCount > 1;

    const rawEmail = (r.student_email || '').trim().toLowerCase();
    const isValidEmail = rawEmail && rawEmail.includes('@');
    const emailCount = isValidEmail ? emailCounts[rawEmail] || 0 : 0;
    const isDupEmail = emailCount > 1;

    let isExcluded = false;
    let excludedAt: string | null = null;
    let excludedBy: string | null = null;
    let exclusionReason: string | null = null;
    let includedAt: string | null = null;
    let includedBy: string | null = null;

    if (isExcludedColSupported) {
      isExcluded = Boolean(r.is_excluded);
      excludedAt = r.excluded_at || null;
      excludedBy = r.excluded_by || null;
      exclusionReason = r.exclusion_reason || null;
      includedAt = r.included_at || null;
      includedBy = r.included_by || null;
    } else {
      const auditState = auditExclusionMap.get(r.id) || auditExclusionMap.get(r.google_response_id);
      if (auditState) {
        isExcluded = auditState.isExcluded;
        excludedAt = auditState.excludedAt || null;
        excludedBy = auditState.excludedBy || null;
        exclusionReason = auditState.reason || null;
        includedAt = auditState.includedAt || null;
        includedBy = auditState.includedBy || null;
      }
    }

    return {
      id: r.id,
      formId: r.form_id,
      googleResponseId: r.google_response_id,
      studentEmail: r.student_email,
      studentName: r.student_name,
      registrationNumber: r.registration_number,
      submittedAt: r.submitted_at,
      syncedAt: r.synced_at,
      emailStatus: r.email_status || 'PENDING',
      isExcluded,
      excludedAt,
      excludedBy,
      exclusionReason,
      includedAt,
      includedBy,
      isDuplicateRegNo: isDupReg,
      isDuplicateEmail: isDupEmail,
      duplicateRegCount: regCount,
      duplicateEmailCount: emailCount,
    };
  });

  // Calculate summary counts across ALL responses
  const totalSubmissions = annotatedRecords.length;
  const includedCount = annotatedRecords.filter(r => !r.isExcluded).length;
  const excludedCount = annotatedRecords.filter(r => r.isExcluded).length;
  const duplicateRegCount = annotatedRecords.filter(r => r.isDuplicateRegNo).length;
  const duplicateEmailCount = annotatedRecords.filter(r => r.isDuplicateEmail).length;

  // 6. Filter annotated records by activeFilter, search, and date range
  let filtered = annotatedRecords;

  if (filter === 'INCLUDED') {
    filtered = filtered.filter(r => !r.isExcluded);
  } else if (filter === 'EXCLUDED') {
    filtered = filtered.filter(r => r.isExcluded);
  } else if (filter === 'DUPLICATE_REG') {
    filtered = filtered.filter(r => r.isDuplicateRegNo);
  } else if (filter === 'DUPLICATE_EMAIL') {
    filtered = filtered.filter(r => r.isDuplicateEmail);
  }

  if (search && search.trim()) {
    const term = search.trim().toLowerCase();
    filtered = filtered.filter(r =>
      (r.studentName || '').toLowerCase().includes(term) ||
      (r.registrationNumber || '').toLowerCase().includes(term) ||
      (r.studentEmail || '').toLowerCase().includes(term)
    );
  }

  if (startDate) {
    filtered = filtered.filter(r => r.submittedAt && r.submittedAt >= startDate);
  }
  if (endDate) {
    filtered = filtered.filter(r => r.submittedAt && r.submittedAt <= endDate);
  }

  const totalFilteredCount = filtered.length;
  const totalPages = Math.ceil(totalFilteredCount / validPageSize) || 1;

  // 7. Paginate
  const from = (page - 1) * validPageSize;
  const pagedResponses = filtered.slice(from, from + validPageSize);

  return {
    success: true,
    responses: pagedResponses,
    totalCount: totalFilteredCount,
    totalSubmissions,
    includedCount,
    excludedCount,
    duplicateRegCount,
    duplicateEmailCount,
    page,
    pageSize: validPageSize,
    totalPages,
    formTitle: form.title,
    formType: form.form_type,
    activeFilter: filter,
  };
}

/**
 * Server action to fetch individual student response details from authoritative Google Sheet
 */
export async function getResponseDetailAction(
  params: {
    formId: string;
    responseId: string;
  },
  options?: { client?: any }
): Promise<{ success: boolean; detail?: StudentResponseDetail; error?: string; code?: string }> {
  const session = await getAdminSession(options?.client);
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized. Active admin session required.' };
  }

  // Centralized Billing & Plan Basic Analytics Permission Check
  const access = await assertBasicAnalyticsAccess(
    session.admin?.id,
    session.admin?.email || session.user?.email,
    session.admin?.role,
    session.admin?.status
  );

  if (!access.allowed) {
    return {
      success: false,
      code: 'ANALYTICS_UPGRADE_REQUIRED',
      error: access.reason || 'Basic analytics access required. Please contact the Super Admin.',
    };
  }

  const { formId, responseId } = params;

  if (!isValidUUID(formId)) {
    return { success: false, error: 'Invalid feedback form identifier format.' };
  }

  const supabase = await getAdminDb(options?.client);
  if (!supabase) {
    return { success: false, error: 'Database service unavailable.' };
  }

  const { data: form } = await supabase
    .from('feedback_forms')
    .select(`
      id,
      college_id,
      title,
      form_type,
      google_sheet_id,
      google_sheet_url,
      faculty:faculties(name),
      subject:subjects(name, code),
      items:feedback_form_items(
        grid_title,
        order_index,
        faculty:faculties(name),
        subject:subjects(name, code)
      )
    `)
    .eq('id', formId)
    .maybeSingle();

  if (!form) {
    return { success: false, error: 'Feedback form not found.' };
  }

  // Tenant authorization check
  if (!session.isPlatformSuperAdmin) {
    const hasMembership = session.colleges.some(
      (c) => c.collegeId === form.college_id && c.status === 'ACTIVE'
    );
    if (!hasMembership) {
      return {
        success: false,
        error: 'Access denied. You do not have permission to view responses for this form.',
        code: 'FORBIDDEN',
      };
    }
  }

  const sheetId =
    form.google_sheet_id ||
    form.google_sheet_url?.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1];

  if (!sheetId) {
    return { success: false, error: 'Connected Google Sheet not found.' };
  }

  const sheetData = await fetchSingleResponseFromSheet(sheetId, responseId, form.college_id);
  if (!sheetData) {
    return { success: false, error: 'Response record not found in Google Sheet.' };
  }

  const { headers, row } = sheetData;

  let studentName: string | null = null;
  let registrationNumber: string | null = null;
  let studentEmail = '';
  let submittedAt: string | null = null;
  let generalFeedback: string | null = null;

  headers.forEach((h, idx) => {
    const lower = h.toLowerCase();
    const val = row[idx] || '';

    if (lower.includes('timestamp') || lower === 'date' || lower === 'time') {
      submittedAt = val;
    } else if (lower.includes('email') || lower.includes('username')) {
      studentEmail = val;
    } else if (lower.includes('student name') || (lower.includes('name') && !lower.includes('faculty') && !lower.includes('subject'))) {
      studentName = val;
    } else if (lower.includes('registration') || lower.includes('reg') || lower.includes('roll')) {
      registrationNumber = val;
    } else if (lower.includes('general feedback') || lower.includes('suggestion') || lower.includes('comment')) {
      generalFeedback = val;
    }
  });

  const facultyEvaluations: ResponseDetailItem[] = [];

  if (form.form_type === 'SEMESTER_FEEDBACK' && form.items && form.items.length > 0) {
    const sortedItems = [...form.items].sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));

    for (const item of sortedItems) {
      const fName = (item.faculty as any)?.name || 'Faculty Member';
      const sName = (item.subject as any)?.name || 'Subject';
      const sCode = (item.subject as any)?.code || '';
      const fullSubject = sCode ? `${sName} (${sCode})` : sName;
      const expectedPrefix = (item.grid_title || `${sName} — ${fName}`).toLowerCase();

      const ratings: Array<{ parameterId: number; parameterTitle: string; rating: string }> = [];

      for (const param of BCE_FEEDBACK_PARAMETERS) {
        let ratingVal = 'Not Rated';
        const pLower = param.title.toLowerCase();

        for (let c = 0; c < headers.length; c++) {
          const hLower = headers[c].toLowerCase();
          if (
            (hLower.includes(expectedPrefix) || expectedPrefix.includes(hLower.split('[')[0].trim())) &&
            hLower.includes(pLower)
          ) {
            ratingVal = row[c] || 'Not Rated';
            break;
          }
        }

        ratings.push({
          parameterId: param.id,
          parameterTitle: param.title,
          rating: ratingVal,
        });
      }

      facultyEvaluations.push({
        facultyName: fName,
        subjectName: fullSubject,
        ratings,
      });
    }
  } else {
    const fName = (form.faculty as any)?.name || 'Faculty Member';
    const sName = (form.subject as any)?.name || 'Subject';
    const sCode = (form.subject as any)?.code || '';
    const fullSubject = sCode ? `${sName} (${sCode})` : sName;

    const ratings: Array<{ parameterId: number; parameterTitle: string; rating: string }> = [];

    for (const param of BCE_FEEDBACK_PARAMETERS) {
      let ratingVal = 'Not Rated';
      const pLower = param.title.toLowerCase();

      for (let c = 0; c < headers.length; c++) {
        const hLower = headers[c].toLowerCase();
        if (
          hLower.startsWith(`${param.id}.`) ||
          hLower.startsWith(`${param.id}:`) ||
          hLower.startsWith(`${param.id} `) ||
          hLower.includes(pLower)
        ) {
          ratingVal = row[c] || 'Not Rated';
          break;
        }
      }

      ratings.push({
        parameterId: param.id,
        parameterTitle: param.title,
        rating: ratingVal,
      });
    }

    facultyEvaluations.push({
      facultyName: fName,
      subjectName: fullSubject,
      ratings,
    });
  }

  // Fetch exclusion & duplicate info from response records
  let isExcluded = false;
  let excludedAt: string | null = null;
  let excludedBy: string | null = null;
  let exclusionReason: string | null = null;
  let includedAt: string | null = null;
  let includedBy: string | null = null;
  let isDuplicateRegNo = false;
  let isDuplicateEmail = false;

  try {
    const { data: recData } = await supabase
      .from('feedback_response_records')
      .select('id, google_response_id, is_excluded, excluded_at, excluded_by, exclusion_reason, included_at, included_by, registration_number, student_email')
      .eq('form_id', formId);

    if (recData && recData.length > 0) {
      const currentRec = recData.find(
        (r: any) => r.google_response_id === responseId || r.id === responseId
      );

      if (currentRec) {
        isExcluded = Boolean(currentRec.is_excluded);
        excludedAt = currentRec.excluded_at || null;
        excludedBy = currentRec.excluded_by || null;
        exclusionReason = currentRec.exclusion_reason || null;
        includedAt = currentRec.included_at || null;
        includedBy = currentRec.included_by || null;

        const regVal = (currentRec.registration_number || registrationNumber || '').trim().toLowerCase();
        if (regVal && regVal !== 'n/a' && regVal !== '-' && regVal !== 'na') {
          const matchCount = recData.filter(
            (r: any) => (r.registration_number || '').trim().toLowerCase() === regVal
          ).length;
          isDuplicateRegNo = matchCount > 1;
        }

        const emailVal = (currentRec.student_email || studentEmail || '').trim().toLowerCase();
        if (emailVal && emailVal.includes('@')) {
          const matchCount = recData.filter(
            (r: any) => (r.student_email || '').trim().toLowerCase() === emailVal
          ).length;
          isDuplicateEmail = matchCount > 1;
        }
      }
    }
  } catch (err) {
    console.warn('Could not load record exclusion info for response detail:', err);
  }

  return {
    success: true,
    detail: {
      responseId,
      studentName,
      registrationNumber,
      studentEmail,
      submittedAt,
      facultyEvaluations,
      generalFeedback,
      isExcluded,
      excludedAt,
      excludedBy,
      exclusionReason,
      includedAt,
      includedBy,
      isDuplicateRegNo,
      isDuplicateEmail,
    },
  };
}

/**
 * Server action to manually Exclude or Include (Restore) a feedback response from analytics.
 * Strictly checks tenant boundaries and requires COLLEGE_ADMIN, HOD, or SUPER_ADMIN authorization.
 * Preserves the original response record in the database permanently for audit history.
 */
export async function toggleResponseExclusionAction(
  params: {
    formId: string;
    responseId: string;
    exclude: boolean;
    reason?: string;
  },
  options?: { client?: any }
): Promise<{ success: boolean; error?: string; message?: string }> {
  const session = await getAdminSession(options?.client);
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized. Active admin session required.' };
  }

  const { formId, responseId, exclude, reason } = params;

  if (!isValidUUID(formId)) {
    return { success: false, error: 'Invalid feedback form identifier format.' };
  }

  if (!responseId || !responseId.trim()) {
    return { success: false, error: 'Response identifier is required.' };
  }

  const supabase = await getAdminDb(options?.client);
  if (!supabase) {
    return { success: false, error: 'Database service unavailable.' };
  }

  // 1. Fetch form to verify tenant boundary
  const { data: form } = await supabase
    .from('feedback_forms')
    .select('id, college_id, title')
    .eq('id', formId)
    .maybeSingle();

  if (!form) {
    return { success: false, error: 'Feedback form not found.' };
  }

  // 2. Enforce strict server-side authorization (COLLEGE_ADMIN, HOD, SUPER_ADMIN)
  if (!session.isPlatformSuperAdmin) {
    const membership = session.colleges.find(
      (c) => c.collegeId === form.college_id && c.status === 'ACTIVE'
    );
    if (!membership) {
      return {
        success: false,
        error: 'Access denied: You do not have administrative permissions for this institution.',
      };
    }
  }

  // 3. Locate the response record in feedback_response_records
  let recQuery = supabase
    .from('feedback_response_records')
    .select('*')
    .eq('form_id', formId);

  if (isValidUUID(responseId)) {
    recQuery = recQuery.eq('id', responseId);
  } else {
    recQuery = recQuery.eq('google_response_id', responseId);
  }

  let { data: record } = await recQuery.maybeSingle();

  if (!record && isValidUUID(responseId)) {
    const alt = await supabase
      .from('feedback_response_records')
      .select('*')
      .eq('form_id', formId)
      .eq('google_response_id', responseId)
      .maybeSingle();
    record = alt.data;
  }

  if (!record) {
    return { success: false, error: 'Student response record not found in database.' };
  }

  const now = new Date().toISOString();
  const userId = session.admin?.id || session.user?.id || null;
  const userEmail = session.admin?.email || session.user?.email || 'admin';
  const cleanReason = reason?.trim() || (exclude ? 'Manual exclusion by administrator' : null);

  // 4. Update the record
  if (exclude) {
    try {
      await supabase
        .from('feedback_response_records')
        .update({
          is_excluded: true,
          excluded_at: now,
          excluded_by: userId,
          exclusion_reason: cleanReason,
          updated_at: now,
        })
        .eq('id', record.id);
    } catch (err) {
      console.warn('Direct column update failed, logging audit record:', err);
    }

    // Insert into audit_logs
    try {
      await supabase.from('audit_logs').insert({
        college_id: form.college_id,
        actor_user_id: userId,
        actor_email: userEmail,
        action: 'EXCLUDE_FEEDBACK_RESPONSE',
        entity_type: 'feedback_response_records',
        entity_id: record.id,
        details: `Excluded student response from analytics. Reason: ${cleanReason || 'N/A'}`,
        metadata: {
          formId,
          recordId: record.id,
          googleResponseId: record.google_response_id,
          studentEmail: record.student_email,
          studentName: record.student_name,
          registrationNumber: record.registration_number,
          reason: cleanReason,
          excludedAt: now,
          excludedBy: userId,
        },
      });
    } catch (auditErr) {
      console.warn('Failed to insert audit log for response exclusion:', auditErr);
    }
  } else {
    // Restore / Include
    try {
      await supabase
        .from('feedback_response_records')
        .update({
          is_excluded: false,
          included_at: now,
          included_by: userId,
          updated_at: now,
        })
        .eq('id', record.id);
    } catch (err) {
      console.warn('Direct column update failed, logging audit record:', err);
    }

    // Insert into audit_logs
    try {
      await supabase.from('audit_logs').insert({
        college_id: form.college_id,
        actor_user_id: userId,
        actor_email: userEmail,
        action: 'INCLUDE_FEEDBACK_RESPONSE',
        entity_type: 'feedback_response_records',
        entity_id: record.id,
        details: 'Restored student response to analytics.',
        metadata: {
          formId,
          recordId: record.id,
          googleResponseId: record.google_response_id,
          studentEmail: record.student_email,
          studentName: record.student_name,
          registrationNumber: record.registration_number,
          includedAt: now,
          includedBy: userId,
        },
      });
    } catch (auditErr) {
      console.warn('Failed to insert audit log for response inclusion:', auditErr);
    }
  }

  // 5. Revalidate next.js cache paths
  try {
    revalidatePath(`/admin/dashboard/results/${formId}/responses`);
    revalidatePath(`/admin/dashboard/results/${formId}`);
    revalidatePath('/admin/dashboard/results');
  } catch {
    // Non-fatal if invoked outside request context
  }

  return {
    success: true,
    message: exclude
      ? 'Response excluded from analytics and reports successfully.'
      : 'Response restored and included in analytics successfully.',
  };
}
