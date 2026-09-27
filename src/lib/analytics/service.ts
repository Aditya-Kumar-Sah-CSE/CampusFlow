import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { fetchRawSheetResponses } from '@/lib/analytics/sheets-reader';
import {
  normalizeSheetRows,
  detectMultiGrids,
  normalizeSheetRowsForSpecificGrid,
} from '@/lib/analytics/normalizer';
import {
  calculateFormAnalytics,
  aggregateAnalytics,
  countUniqueStudentResponses,
} from '@/lib/analytics/engine';
import type {
  FormAnalyticsReport,
  AggregatedAnalyticsReport,
  FacultyGridAnalyticsItem,
} from '@/lib/analytics/types';
import { isGoogleConfigured } from '@/lib/google/auth';
import { isValidUUID } from '@/lib/validation';

async function getAdminDb(client?: any) {
  return createAdminClient() || client || (await createClient());
}

export interface ScopeFilters {
  collegeId?: string;
  academicYearId?: string;
  branchId?: string;
  semesterId?: string;
  facultyId?: string;
  subjectId?: string;
}

/**
 * Resolves excluded response IDs and count metadata for a given feedback form.
 * Works with native feedback_response_records is_excluded column, with seamless
 * fallback to audit_logs for backward compatibility.
 */
export async function getFormExcludedResponseIds(supabase: any, formId: string): Promise<{
  excludedIds: Set<string>;
  totalRecordCount: number;
  totalExcludedCount: number;
}> {
  const excludedIds = new Set<string>();
  let totalRecordCount = 0;
  let totalExcludedCount = 0;

  try {
    const { data: records, error: recErr } = await supabase
      .from('feedback_response_records')
      .select('id, google_response_id, is_excluded')
      .eq('form_id', formId);

    if (!recErr && records) {
      totalRecordCount = records.length;
      for (const r of records) {
        if (r.is_excluded) {
          totalExcludedCount++;
          if (r.google_response_id) excludedIds.add(r.google_response_id.trim());
          if (r.id) excludedIds.add(r.id.trim());
        }
      }
    } else {
      // Fallback: Check audit_logs if is_excluded column is not yet present on table
      const { data: auditLogs } = await supabase
        .from('audit_logs')
        .select('action, entity_id, metadata, created_at')
        .in('action', ['EXCLUDE_FEEDBACK_RESPONSE', 'INCLUDE_FEEDBACK_RESPONSE'])
        .order('created_at', { ascending: true });

      if (auditLogs) {
        for (const log of auditLogs) {
          const meta = (log.metadata as any) || {};
          if (meta.formId === formId) {
            const respId = meta.googleResponseId || log.entity_id;
            if (log.action === 'EXCLUDE_FEEDBACK_RESPONSE') {
              if (respId) excludedIds.add(respId.trim());
              if (meta.recordId) excludedIds.add(meta.recordId.trim());
            } else if (log.action === 'INCLUDE_FEEDBACK_RESPONSE') {
              if (respId) excludedIds.delete(respId.trim());
              if (meta.recordId) excludedIds.delete(meta.recordId.trim());
            }
          }
        }
        totalExcludedCount = excludedIds.size;
      }
    }
  } catch (err) {
    console.warn('Could not determine response exclusions for form', formId, err);
  }

  return { excludedIds, totalRecordCount, totalExcludedCount };
}

/**
 * Fetches real-time analytics for a specific feedback form.
 * Directly sources responses from the connected Google Sheet and normalizes them.
 * Authoritative single source of truth for both dashboard and PDF reporting.
 * Excludes responses marked as excluded by Admin/HOD.
 */
export async function getFormAnalyticsData(
  formId: string,
  options?: { client?: any }
): Promise<{
  success: boolean;
  error?: string;
  report?: FormAnalyticsReport;
}> {
  // 1. Admin Authentication Check
  const session = await getAdminSession(options?.client);
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized. Active admin credentials required.' };
  }

  if (!isValidUUID(formId)) {
    return { success: false, error: 'Invalid feedback form identifier format.' };
  }

  const supabase = await getAdminDb(options?.client);

  // 2. Fetch Form Metadata
  const { data: form, error: formErr } = await supabase
    .from('feedback_forms')
    .select(`
      *,
      faculty:faculties(*),
      subject:subjects(*),
      academic_year:academic_years(*),
      branch:branches(*),
      semester:semesters(*)
    `)
    .eq('id', formId)
    .single();

  if (formErr || !form) {
    return { success: false, error: formErr?.message || 'Feedback form not found.' };
  }

  // Tenant authorization check
  if (!session.isPlatformSuperAdmin) {
    const hasMembership = session.colleges.some(
      (c) => c.collegeId === form.college_id && c.status === 'ACTIVE'
    );
    if (!hasMembership) {
      return { success: false, error: 'Access denied. You do not have permission to view analytics for this form.' };
    }
  }

  // 3. Resolve Excluded Response IDs (Admin / HOD manual exclusion)
  const { excludedIds, totalRecordCount, totalExcludedCount } = await getFormExcludedResponseIds(supabase, formId);

  // 4. Fetch Real Response Data from Google Sheet
  let canonicalRows: ReturnType<typeof normalizeSheetRows> = [];
  const isSemester = form.form_type === 'SEMESTER_FEEDBACK';
  let facultyGrids: FacultyGridAnalyticsItem[] = [];
  let totalRawSubmissions = 0;

  if (form.google_sheet_id && isGoogleConfigured()) {
    try {
      const sheetData = await fetchRawSheetResponses(form.google_sheet_id, form.college_id);

      if (sheetData.rows.length > 0) {
        const rawCanonicalRows = normalizeSheetRows(sheetData.headers, sheetData.rows);
        totalRawSubmissions = countUniqueStudentResponses(rawCanonicalRows);

        if (isSemester) {
          const detectedGrids = detectMultiGrids(sheetData.headers);

          if (detectedGrids.length > 0) {
            facultyGrids = detectedGrids.map(grid => {
              const rawGridRows = normalizeSheetRowsForSpecificGrid(
                sheetData.headers,
                sheetData.rows,
                grid.paramColIndices
              );

              // Filter out EXCLUDED responses so faculty reports reflect ONLY included responses
              const includedGridRows = rawGridRows.filter(
                r => !excludedIds.has(r.responseId?.trim())
              );

              const gridReport = calculateFormAnalytics({
                formId: form.id,
                title: `${grid.subjectName} — ${grid.facultyName}`,
                academicYear: form.academic_year?.name || 'Academic Session',
                branch: form.branch?.name || 'Branch',
                semester: form.semester?.name || 'Semester',
                facultyName: grid.facultyName || 'Faculty Member',
                subjectName: grid.subjectName || 'Subject',
                subjectCode: grid.subjectCode || '',
                formType: 'SEMESTER_FEEDBACK',
                status: form.status,
                lastSyncedAt: form.last_synced_at,
                googleSheetUrl: form.google_sheet_url,
                googleFormUrl: form.google_form_url,
                responses: includedGridRows,
              });

              gridReport.totalSubmissions = countUniqueStudentResponses(rawGridRows);
              gridReport.includedCount = countUniqueStudentResponses(includedGridRows);
              gridReport.excludedCount = Math.max(0, gridReport.totalSubmissions - gridReport.includedCount);

              return {
                gridTitle: grid.gridTitle,
                facultyName: grid.facultyName,
                subjectName: grid.subjectName,
                subjectCode: grid.subjectCode,
                report: gridReport,
              };
            });

            // Combined: Each student's grid evaluation (included only)
            canonicalRows = detectedGrids.flatMap(grid => {
              const rawRows = normalizeSheetRowsForSpecificGrid(
                sheetData.headers,
                sheetData.rows,
                grid.paramColIndices
              );
              return rawRows.filter(r => !excludedIds.has(r.responseId?.trim()));
            });
          } else {
            canonicalRows = rawCanonicalRows.filter(r => !excludedIds.has(r.responseId?.trim()));
          }
        } else {
          canonicalRows = rawCanonicalRows.filter(r => !excludedIds.has(r.responseId?.trim()));
        }

        // Authoritative unique student response count (included responses)
        const uniqueStudentCount = countUniqueStudentResponses(canonicalRows);

        // Update database response_count if changed (representing active included submissions)
        if (form.response_count !== uniqueStudentCount && uniqueStudentCount > 0) {
          await supabase
            .from('feedback_forms')
            .update({
              response_count: uniqueStudentCount,
              updated_at: new Date().toISOString(),
            })
            .eq('id', formId);
        }
      }
    } catch (sheetErr) {
      console.warn(`Could not read sheet for form ${formId}:`, sheetErr);
    }
  }

  // 5. Compute Unified Analytics (strictly using INCLUDED canonical responses)
  const report = calculateFormAnalytics({
    formId: form.id,
    title: form.title,
    academicYear: form.academic_year?.name || 'Academic Session',
    branch: form.branch?.name || 'Branch',
    semester: form.semester?.name || 'Semester',
    facultyName: isSemester ? 'All Assigned Faculty' : form.faculty?.name || 'Faculty Member',
    subjectName: isSemester ? 'All Semester Subjects' : form.subject?.name || 'Subject',
    subjectCode: form.subject?.code || '',
    formType: form.form_type || 'FACULTY_SPECIFIC',
    status: form.status,
    lastSyncedAt: form.last_synced_at,
    googleSheetUrl: form.google_sheet_url,
    googleFormUrl: form.google_form_url,
    responses: canonicalRows,
  });

  const totalRawCount = Math.max(totalRawSubmissions, totalRecordCount);
  const includedStudents = countUniqueStudentResponses(canonicalRows);
  const excludedStudents = Math.max(totalRawCount - includedStudents, totalExcludedCount);

  report.totalSubmissions = totalRawCount;
  report.includedCount = includedStudents;
  report.excludedCount = excludedStudents;

  if (isSemester) {
    report.isSemesterForm = true;
    report.facultyGrids = facultyGrids;
    if (includedStudents > 0) {
      report.totalResponses = includedStudents;
      report.totalStudents = includedStudents;
    }
  }

  report.collegeId = form.college_id;

  return { success: true, report };
}

/**
 * Fetches institutional scope analytics aggregated across matching feedback forms.
 */
export async function getOverallAnalyticsData(
  filters?: ScopeFilters,
  options?: { client?: any }
): Promise<{
  success: boolean;
  error?: string;
  report?: AggregatedAnalyticsReport;
}> {
  const session = await getAdminSession(options?.client);
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized. Active admin credentials required.' };
  }

  // Internal Tenant Enforcement
  let targetCollegeId: string | undefined = filters?.collegeId;

  if (!session.isPlatformSuperAdmin) {
    const activeCollegeIds = session.colleges
      .filter((c) => c.status === 'ACTIVE')
      .map((c) => c.collegeId);

    if (activeCollegeIds.length === 0) {
      return { success: false, error: 'Access denied. No active college memberships found.' };
    }

    if (targetCollegeId) {
      if (!activeCollegeIds.includes(targetCollegeId)) {
        return { success: false, error: 'Access denied. You do not have permission to access analytics for this college.' };
      }
    } else {
      if (session.activeCollegeId && activeCollegeIds.includes(session.activeCollegeId)) {
        targetCollegeId = session.activeCollegeId;
      } else {
        targetCollegeId = activeCollegeIds[0];
      }
    }
  } else {
    // Platform super admin: use session.activeCollegeId if none provided in filter
    if (!targetCollegeId && session.activeCollegeId) {
      targetCollegeId = session.activeCollegeId;
    }
  }

  // Validate filter UUIDs if present
  if (targetCollegeId && !isValidUUID(targetCollegeId)) {
    return { success: false, error: 'Invalid College filter format.' };
  }
  if (filters?.academicYearId && filters.academicYearId !== 'ALL' && !isValidUUID(filters.academicYearId)) {
    return { success: false, error: 'Invalid Academic Year filter format.' };
  }
  if (filters?.branchId && filters.branchId !== 'ALL' && !isValidUUID(filters.branchId)) {
    return { success: false, error: 'Invalid Branch filter format.' };
  }
  if (filters?.semesterId && filters.semesterId !== 'ALL' && !isValidUUID(filters.semesterId)) {
    return { success: false, error: 'Invalid Semester filter format.' };
  }
  if (filters?.facultyId && filters.facultyId !== 'ALL' && !isValidUUID(filters.facultyId)) {
    return { success: false, error: 'Invalid Faculty filter format.' };
  }
  if (filters?.subjectId && filters.subjectId !== 'ALL' && !isValidUUID(filters.subjectId)) {
    return { success: false, error: 'Invalid Subject filter format.' };
  }

  const supabase = await getAdminDb(options?.client);

  // Query matching feedback forms
  let query = supabase
    .from('feedback_forms')
    .select(`
      *,
      faculty:faculties(*),
      subject:subjects(*),
      academic_year:academic_years(*),
      branch:branches(*),
      semester:semesters(*)
    `)
    .order('created_at', { ascending: false });

  if (targetCollegeId && isValidUUID(targetCollegeId)) {
    query = query.eq('college_id', targetCollegeId);
  }
  if (filters?.academicYearId && filters.academicYearId !== 'ALL') {
    query = query.eq('academic_year_id', filters.academicYearId);
  }
  if (filters?.branchId && filters.branchId !== 'ALL') {
    query = query.eq('branch_id', filters.branchId);
  }
  if (filters?.semesterId && filters.semesterId !== 'ALL') {
    query = query.eq('semester_id', filters.semesterId);
  }
  if (filters?.facultyId && filters.facultyId !== 'ALL') {
    query = query.eq('faculty_id', filters.facultyId);
  }
  if (filters?.subjectId && filters.subjectId !== 'ALL') {
    query = query.eq('subject_id', filters.subjectId);
  }

  const { data: forms, error: formsErr } = await query;

  if (formsErr) {
    return { success: false, error: formsErr.message };
  }

  const allForms = forms || [];

  // Compute individual form reports
  const formReports: FormAnalyticsReport[] = [];

  for (const form of allForms) {
    let canonicalRows: ReturnType<typeof normalizeSheetRows> = [];
    const isSemesterForm = form.form_type === 'SEMESTER_FEEDBACK';
    let facultyGrids: FacultyGridAnalyticsItem[] = [];

    const { excludedIds, totalRecordCount, totalExcludedCount } = await getFormExcludedResponseIds(supabase, form.id);
    let totalRawSubmissions = 0;

    if (form.google_sheet_id && isGoogleConfigured()) {
      try {
        const sheetData = await fetchRawSheetResponses(form.google_sheet_id, form.college_id);
        if (sheetData.rows.length > 0) {
          const rawCanonicalRows = normalizeSheetRows(sheetData.headers, sheetData.rows);
          totalRawSubmissions = countUniqueStudentResponses(rawCanonicalRows);

          if (isSemesterForm) {
            const detectedGrids = detectMultiGrids(sheetData.headers);
            if (detectedGrids.length > 0) {
              facultyGrids = detectedGrids.map(grid => {
                const rawGridRows = normalizeSheetRowsForSpecificGrid(
                  sheetData.headers,
                  sheetData.rows,
                  grid.paramColIndices
                );

                const includedGridRows = rawGridRows.filter(
                  r => !excludedIds.has(r.responseId?.trim())
                );

                const gridReport = calculateFormAnalytics({
                  formId: form.id,
                  title: `${grid.subjectName} — ${grid.facultyName}`,
                  academicYear: form.academic_year?.name || 'Academic Session',
                  branch: form.branch?.name || 'Branch',
                  semester: form.semester?.name || 'Semester',
                  facultyName: grid.facultyName || 'Faculty Member',
                  subjectName: grid.subjectName || 'Subject',
                  subjectCode: grid.subjectCode || '',
                  formType: 'SEMESTER_FEEDBACK',
                  status: form.status,
                  lastSyncedAt: form.last_synced_at,
                  googleSheetUrl: form.google_sheet_url,
                  googleFormUrl: form.google_form_url,
                  responses: includedGridRows,
                });

                gridReport.totalSubmissions = countUniqueStudentResponses(rawGridRows);
                gridReport.includedCount = countUniqueStudentResponses(includedGridRows);
                gridReport.excludedCount = Math.max(0, gridReport.totalSubmissions - gridReport.includedCount);

                return {
                  gridTitle: grid.gridTitle,
                  facultyName: grid.facultyName,
                  subjectName: grid.subjectName,
                  subjectCode: grid.subjectCode,
                  report: gridReport,
                };
              });

              canonicalRows = detectedGrids.flatMap(grid => {
                const rawRows = normalizeSheetRowsForSpecificGrid(
                  sheetData.headers,
                  sheetData.rows,
                  grid.paramColIndices
                );
                return rawRows.filter(r => !excludedIds.has(r.responseId?.trim()));
              });
            } else {
              canonicalRows = rawCanonicalRows.filter(r => !excludedIds.has(r.responseId?.trim()));
            }
          } else {
            canonicalRows = rawCanonicalRows.filter(r => !excludedIds.has(r.responseId?.trim()));
          }
        }
      } catch (err) {
        console.warn(`Error reading sheet for form ${form.id}:`, err);
      }
    }

    const singleReport = calculateFormAnalytics({
      formId: form.id,
      title: form.title,
      academicYear: form.academic_year?.name || 'Academic Session',
      branch: form.branch?.name || 'Branch',
      semester: form.semester?.name || 'Semester',
      facultyName: isSemesterForm ? 'All Assigned Faculty' : form.faculty?.name || 'Faculty Member',
      subjectName: isSemesterForm ? 'All Semester Subjects' : form.subject?.name || 'Subject',
      subjectCode: form.subject?.code || '',
      formType: form.form_type || 'FACULTY_SPECIFIC',
      status: form.status,
      lastSyncedAt: form.last_synced_at,
      googleSheetUrl: form.google_sheet_url,
      googleFormUrl: form.google_form_url,
      responses: canonicalRows,
    });

    const totalRawCount = Math.max(totalRawSubmissions, totalRecordCount);
    const includedStudents = countUniqueStudentResponses(canonicalRows);
    const excludedStudents = Math.max(totalRawCount - includedStudents, totalExcludedCount);

    singleReport.totalSubmissions = totalRawCount;
    singleReport.includedCount = includedStudents;
    singleReport.excludedCount = excludedStudents;

    if (isSemesterForm) {
      singleReport.isSemesterForm = true;
      singleReport.facultyGrids = facultyGrids;
      if (includedStudents > 0) {
        singleReport.totalResponses = includedStudents;
        singleReport.totalStudents = includedStudents;
      }
    }

    formReports.push(singleReport);
  }

  // Determine human-readable scope title
  const parts: string[] = [];
  let academicYearName = '';
  let branchName = '';
  let semesterName = '';
  let facultyName = '';
  let subjectName = '';

  if (formReports.length > 0) {
    if (filters?.academicYearId && filters.academicYearId !== 'ALL') {
      academicYearName = formReports[0].academicYear;
      parts.push(academicYearName);
    }
    if (filters?.branchId && filters.branchId !== 'ALL') {
      branchName = formReports[0].branch;
      parts.push(branchName);
    }
    if (filters?.semesterId && filters.semesterId !== 'ALL') {
      semesterName = formReports[0].semester;
      parts.push(semesterName);
    }
    if (filters?.facultyId && filters.facultyId !== 'ALL') {
      facultyName = formReports[0].facultyName;
      parts.push(facultyName);
    }
    if (filters?.subjectId && filters.subjectId !== 'ALL') {
      subjectName = `${formReports[0].subjectName} (${formReports[0].subjectCode})`;
      parts.push(subjectName);
    }
  }

  const scopeTitle = parts.length > 0 ? parts.join(' → ') : 'Institution-Wide (All Active Feedback)';

  const aggregated = aggregateAnalytics(formReports, scopeTitle, {
    academicYearId: filters?.academicYearId,
    academicYearName,
    branchId: filters?.branchId,
    branchName,
    semesterId: filters?.semesterId,
    semesterName,
    facultyId: filters?.facultyId,
    facultyName,
    subjectId: filters?.subjectId,
    subjectName,
  });

  aggregated.collegeId = targetCollegeId;

  return { success: true, report: aggregated };
}
