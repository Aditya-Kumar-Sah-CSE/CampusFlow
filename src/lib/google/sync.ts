import type { forms_v1 } from 'googleapis';
import { executeWithCollegeGoogleOAuthRetry } from './auth';
import { appendResponsesToSheet, getExistingSheetResponseIds, cleanDuplicateRowsFromSheet } from './sheets';
import { BCE_FEEDBACK_PARAMETERS } from './template';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { generateResponseToken } from '@/lib/feedback/response-token';
import { sendStudentSubmissionConfirmationEmail } from '@/lib/email/service';
import { APP_URL } from '@/lib/config/app';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  totalResponses: number;
  message: string;
  error?: string;
}

/**
 * Synchronizes submitted Google Form responses into the connected Google Sheet
 * using official Google Forms API v1 and Google Sheets API v4.
 *
 * Security Invariant: The database feedback_forms.college_id is the authoritative
 * tenant boundary. Client-supplied collegeId is never trusted to choose credentials.
 * Authorization is strictly validated against form.college_id before accessing Google credentials.
 *
 * Idempotent: Skips response IDs that are already present in the sheet.
 */
export async function syncFormResponsesToSheet(params: {
  formId?: string;
  googleFormId?: string;
  googleSheetId?: string;
  skipAuthCheck?: boolean;
  callerSession?: any;
}): Promise<SyncResult> {
  const supabase = createAdminClient();
  if (!supabase) {
    return {
      success: false,
      syncedCount: 0,
      totalResponses: 0,
      message: 'Supabase admin client unavailable.',
      error: 'DATABASE_ERROR',
    };
  }

  // 1. Authoritatively resolve the form and its institutional owner from the database
  let formRecord: any = null;
  if (params.formId) {
    const { data, error } = await supabase
      .from('feedback_forms')
      .select('id, college_id, google_form_id, google_sheet_id, title, branch:branches(name), semester:semesters(name), academic_year:academic_years(name)')
      .eq('id', params.formId)
      .maybeSingle();
    if (error || !data) {
      return {
        success: false,
        syncedCount: 0,
        totalResponses: 0,
        message: `Feedback form not found: ${error?.message || params.formId}`,
        error: 'FORM_NOT_FOUND',
      };
    }
    formRecord = data;
  } else if (params.googleFormId) {
    const { data, error } = await supabase
      .from('feedback_forms')
      .select('id, college_id, google_form_id, google_sheet_id, title, branch:branches(name), semester:semesters(name), academic_year:academic_years(name)')
      .eq('google_form_id', params.googleFormId)
      .maybeSingle();
    if (error || !data) {
      return {
        success: false,
        syncedCount: 0,
        totalResponses: 0,
        message: `Feedback form not found for Google Form ID: ${params.googleFormId}`,
        error: 'FORM_NOT_FOUND',
      };
    }
    formRecord = data;
  } else {
    return {
      success: false,
      syncedCount: 0,
      totalResponses: 0,
      message: 'formId or googleFormId is required for response synchronization.',
      error: 'INVALID_INPUT',
    };
  }

  const collegeId: string = formRecord.college_id;
  if (!collegeId) {
    return {
      success: false,
      syncedCount: 0,
      totalResponses: 0,
      message: 'Form has no associated institutional college_id.',
      error: 'MISSING_COLLEGE_ID',
    };
  }

  // 2. Enforce admin session authorization for the form's authoritative college_id
  if (!params.skipAuthCheck) {
    const session = params.callerSession || (await getAdminSession());
    if (!session.isAuthenticated || !session.isActive) {
      return {
        success: false,
        syncedCount: 0,
        totalResponses: 0,
        message: 'Unauthorized: Active administrator session required.',
        error: 'UNAUTHORIZED',
      };
    }

    if (!session.isPlatformSuperAdmin) {
      const isAuthorizedMember = session.colleges?.some(
        (c: any) => c.collegeId === collegeId && c.status === 'ACTIVE'
      );
      if (!isAuthorizedMember) {
        return {
          success: false,
          syncedCount: 0,
          totalResponses: 0,
          message: 'Forbidden: Administrator is not authorized for the college that owns this form.',
          error: 'FORBIDDEN',
        };
      }
    }
  }

  const resolvedFormId = params.googleFormId || formRecord.google_form_id;
  const resolvedSheetId = params.googleSheetId || formRecord.google_sheet_id;

  if (!resolvedFormId || !resolvedSheetId) {
    return {
      success: false,
      syncedCount: 0,
      totalResponses: 0,
      message: 'Form is missing Google Form ID or Google Sheet ID.',
      error: 'MISSING_GOOGLE_RESOURCES',
    };
  }

  try {
    // Fetch form structure, submitted responses, and sheet state via college OAuth retry wrapper
    const { items, allResponses, sheetHeaders, sheetDataRows } = await executeWithCollegeGoogleOAuthRetry(
      collegeId,
      async ({ forms, sheets }) => {
        const formMetadata = await forms.forms.get({ formId: resolvedFormId });
        const items = formMetadata.data.items || [];

        let allResponses: forms_v1.Schema$FormResponse[] = [];
        try {
          const responsesRes = await forms.forms.responses.list({ formId: resolvedFormId });
          allResponses = (responsesRes.data.responses || []) as forms_v1.Schema$FormResponse[];
        } catch (formsErr: unknown) {
          console.warn('[Sync] Google Forms API responses list notice:', formsErr instanceof Error ? formsErr.message : formsErr);
        }

        let sheetHeaders: string[] = [];
        let sheetDataRows: any[][] = [];
        try {
          // 1. Proactively purge any duplicate rows previously appended to the sheet
          await cleanDuplicateRowsFromSheet(resolvedSheetId, collegeId);

          const meta = await sheets.spreadsheets.get({ spreadsheetId: resolvedSheetId });
          const sheetTitle = meta.data.sheets?.[0]?.properties?.title || 'Form Responses';
          const sheetDataRes = await sheets.spreadsheets.values.get({
            spreadsheetId: resolvedSheetId,
            range: `'${sheetTitle}'!A1:ZZ`,
          });
          const allSheetValues = sheetDataRes.data.values || [];
          sheetHeaders = (allSheetValues[0] || []).map(h => String(h || '').trim());
          sheetDataRows = allSheetValues.slice(1);
        } catch (sheetErr) {
          console.warn('[Sync] Google Sheets API values get notice:', sheetErr);
          sheetHeaders = [];
          sheetDataRows = [];
        }

        return { items, allResponses, sheetHeaders, sheetDataRows };
      }
    );

    // Map questionId -> parameter index (0..7) and identification / comment fields
    const questionIdToParamIndex = new Map<string, number>();
    const gridQuestionMap = new Map<string, { gridTitle: string; paramIndex: number }>();
    let studentNameQuestionId: string | null = null;
    let regNoQuestionId: string | null = null;
    let commentsQuestionId: string | null = null;

    items.forEach(item => {
      const itemTitle = (item.title || '').trim();
      const lowerItemTitle = itemTitle.toLowerCase();

      // 1. Single Question Item
      if (item.questionItem?.question) {
        const qId = item.questionItem.question.questionId;
        if (!qId) return;

        if (lowerItemTitle.includes('student name') || (lowerItemTitle.includes('name') && !lowerItemTitle.includes('faculty') && !lowerItemTitle.includes('subject'))) {
          studentNameQuestionId = qId;
        } else if (lowerItemTitle.includes('registration') || lowerItemTitle.includes('reg') || lowerItemTitle.includes('roll')) {
          regNoQuestionId = qId;
        } else if (lowerItemTitle.includes('comment') || lowerItemTitle.includes('suggestion') || lowerItemTitle.includes('general feedback') || (lowerItemTitle.includes('feedback') && !lowerItemTitle.includes('faculty'))) {
          commentsQuestionId = qId;
        } else {
          const paramIndex = BCE_FEEDBACK_PARAMETERS.findIndex(
            p => lowerItemTitle.includes(p.title.toLowerCase())
          );
          if (paramIndex !== -1) {
            questionIdToParamIndex.set(qId, paramIndex);
          }
        }
      }

      // 2. Multiple Choice Grid (questionGroupItem)
      if (item.questionGroupItem?.questions) {
        item.questionGroupItem.questions.forEach(q => {
          const qId = q.questionId;
          const rowTitle = (q.rowQuestion?.title || '').trim().toLowerCase();
          if (!qId) return;

          const paramIndex = BCE_FEEDBACK_PARAMETERS.findIndex(
            p => rowTitle.includes(p.title.toLowerCase()) || p.title.toLowerCase().includes(rowTitle)
          );
          if (paramIndex !== -1) {
            gridQuestionMap.set(qId, { gridTitle: itemTitle, paramIndex });
          }
        });
      }
    });

    const totalResponses = Math.max(allResponses.length, sheetDataRows.length);

    if (totalResponses === 0 && sheetDataRows.length === 0) {
      return {
        success: true,
        syncedCount: 0,
        totalResponses: 0,
        message: 'No responses submitted yet in Google Form or connected Google Sheet.',
      };
    }

    // 4. Check which responses are already recorded in the Google Sheet
    // Build authoritative identity sets from existing sheet rows
    const lowerHeaders = sheetHeaders.map(h => h.toLowerCase());
    const tsIdx = lowerHeaders.findIndex(h => h.includes('timestamp') || h === 'date' || h === 'time');
    const respIdIdx = lowerHeaders.findIndex(h => h.includes('response id') || (h === 'id' && !h.includes('student')));
    const emailIdx = lowerHeaders.findIndex(h => h.includes('email') || h.includes('username'));
    const nameIdx = lowerHeaders.findIndex(h => h.includes('student name') || (h.includes('name') && !h.includes('faculty') && !h.includes('subject')));
    const regIdx = lowerHeaders.findIndex(h => h.includes('registration') || h.includes('reg') || h.includes('roll'));

    const existingSheetRegNos = new Set<string>();
    const existingSheetNames = new Set<string>();
    const existingSheetEmails = new Set<string>();
    const existingSheetRespIds = new Set<string>();

    sheetDataRows.forEach(row => {
      const rId = String((respIdIdx !== -1 ? row[respIdIdx] : '') || '').trim();
      if (rId) existingSheetRespIds.add(rId);

      const rReg = String((regIdx !== -1 ? row[regIdx] : '') || '').trim().toLowerCase();
      if (rReg) existingSheetRegNos.add(rReg);

      const rName = String((nameIdx !== -1 ? row[nameIdx] : '') || '').trim().toLowerCase();
      if (rName) existingSheetNames.add(rName);

      const rEmail = String((emailIdx !== -1 ? row[emailIdx] : '') || '').trim().toLowerCase();
      if (rEmail) existingSheetEmails.add(rEmail);
    });

    const rowsToAppend: (string | number)[][] = [];

    for (const resp of allResponses) {
      const responseId = resp.responseId || '';
      const studentName = ((studentNameQuestionId && resp.answers?.[studentNameQuestionId]?.textAnswers?.answers?.[0]?.value) || '').trim();
      const regNo = ((regNoQuestionId && resp.answers?.[regNoQuestionId]?.textAnswers?.answers?.[0]?.value) || '').trim();
      let email = (resp.respondentEmail || '').trim();
      if (!email && resp.answers) {
        for (const ans of Object.values(resp.answers as Record<string, forms_v1.Schema$Answer>)) {
          const val = ans.textAnswers?.answers?.[0]?.value?.trim() || '';
          if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
            email = val;
            break;
          }
        }
      }

      const regLower = regNo.toLowerCase();
      const nameLower = studentName.toLowerCase();
      const emailLower = email.toLowerCase();

      // Check if this response is ALREADY present in the Google Sheet:
      // A. Explicit response ID match
      // B. Student registration number match (strictly 1 submission per student)
      // C. Student name + email match
      // D. Native Google Forms destination linking already captured all responses
      const alreadyInSheet =
        (responseId && existingSheetRespIds.has(responseId)) ||
        (regLower && existingSheetRegNos.has(regLower)) ||
        (nameLower && emailLower && existingSheetNames.has(nameLower) && existingSheetEmails.has(emailLower)) ||
        (nameLower && existingSheetNames.has(nameLower) && !regLower) ||
        (sheetDataRows.length >= allResponses.length && allResponses.length > 0);

      if (alreadyInSheet) {
        continue; // Already recorded in the Google Sheet — DO NOT APPEND!
      }

      const timestamp = resp.lastSubmittedTime || resp.createTime || new Date().toISOString();
      const comments = (commentsQuestionId && resp.answers?.[commentsQuestionId]?.textAnswers?.answers?.[0]?.value) || '';

      const singleAnswerRow: string[] = new Array(8).fill('N/A');
      const gridAnswerMap = new Map<string, string>(); // `${gridTitle.toLowerCase()}_${paramIndex}` -> answer value

      if (resp.answers) {
        const answersRecord = resp.answers as Record<string, forms_v1.Schema$Answer>;
        for (const [qId, answerObj] of Object.entries(answersRecord)) {
          const val = answerObj.textAnswers?.answers?.[0]?.value || '';

          // Single question match
          const paramIdx = questionIdToParamIndex.get(qId);
          if (paramIdx !== undefined && paramIdx >= 0 && paramIdx < 8) {
            singleAnswerRow[paramIdx] = val;
          }

          // Grid question match
          const gridInfo = gridQuestionMap.get(qId);
          if (gridInfo) {
            gridAnswerMap.set(`${gridInfo.gridTitle.toLowerCase()}_${gridInfo.paramIndex}`, val);
          }
        }
      }

      if (sheetHeaders.length > 0) {
        // Map dynamically to the exact columns of the target sheet
        const row: (string | number)[] = sheetHeaders.map(rawHeader => {
          const h = rawHeader.toLowerCase();
          if (h.includes('timestamp') || h === 'date' || h === 'time') return timestamp;
          if (h.includes('response id') || h === 'submission id' || (h === 'id' && !h.includes('student'))) return responseId;
          if (h.includes('email') || h.includes('username')) return email;
          if (h.includes('student name') || (h.includes('name') && !h.includes('faculty') && !h.includes('subject'))) return studentName;
          if (h.includes('registration') || h.includes('reg') || h.includes('roll')) return regNo;
          if (h.includes('comment') || h.includes('suggestion') || h.includes('general feedback') || (h.includes('feedback') && !h.includes('faculty'))) return comments;

          // Check if column is a grid column: "<Grid Title> [<Row Title>]"
          for (const [gridKey, val] of gridAnswerMap.entries()) {
            const [gt, pIdxStr] = gridKey.split('_');
            const pIdx = parseInt(pIdxStr, 10);
            const param = BCE_FEEDBACK_PARAMETERS[pIdx];
            if (param && h.includes(gt) && h.includes(param.title.toLowerCase())) {
              return val;
            }
          }

          // Check single question column match
          for (let pIdx = 0; pIdx < BCE_FEEDBACK_PARAMETERS.length; pIdx++) {
            const param = BCE_FEEDBACK_PARAMETERS[pIdx];
            if (h.includes(param.title.toLowerCase()) || h.startsWith(`${param.id}.`)) {
              return singleAnswerRow[pIdx] || 'N/A';
            }
          }

          return '';
        });

        rowsToAppend.push(row);
        sheetDataRows.push(row);
        if (responseId) existingSheetRespIds.add(responseId);
        if (regLower) existingSheetRegNos.add(regLower);
        if (nameLower) existingSheetNames.add(nameLower);
        if (emailLower) existingSheetEmails.add(emailLower);
      } else {
        // Fallback row layout
        const fallbackRow = [
          timestamp,
          responseId,
          email,
          studentName,
          regNo,
          ...singleAnswerRow,
          comments,
        ];
        rowsToAppend.push(fallbackRow);
        sheetDataRows.push(fallbackRow);
        if (responseId) existingSheetRespIds.add(responseId);
        if (regLower) existingSheetRegNos.add(regLower);
        if (nameLower) existingSheetNames.add(nameLower);
        if (emailLower) existingSheetEmails.add(emailLower);
      }
    }

    // 4. Append new response rows to the sheet ONLY if missing
    if (rowsToAppend.length > 0) {
      await appendResponsesToSheet(resolvedSheetId, rowsToAppend, collegeId);
    }

    // 5. Track Response Records in Supabase Database & Dispatch Confirmation Email (Idempotent)
    if (supabase && formRecord) {
      try {
        const formUuid = formRecord.id;
        const branchName = formRecord.branch?.name || 'Department';
        const semesterName = formRecord.semester?.name || 'Semester';
        const academicYearName = formRecord.academic_year?.name || 'Academic Session';
        const formTitle = formRecord.title || 'Faculty Feedback Form';
        const baseUrl = APP_URL;

        // Deduplicate and sanitize Supabase feedback_response_records
        // 1. Purge any historical duplicate records for this form
        const { data: existingAllDbRecs } = await supabase
          .from('feedback_response_records')
          .select('id, registration_number, student_name, student_email, google_response_id')
          .eq('form_id', formUuid)
          .order('submitted_at', { ascending: true });

        if (existingAllDbRecs && existingAllDbRecs.length > 1) {
          const seenDbKeys = new Set<string>();
          const duplicateDbIds: string[] = [];

          for (const dRec of existingAllDbRecs) {
            const reg = (dRec.registration_number || '').trim().toLowerCase();
            const name = (dRec.student_name || '').trim().toLowerCase();
            const email = (dRec.student_email || '').trim().toLowerCase();
            const key = reg ? `reg:${reg}` : name ? `name:${name}` : email ? `email:${email}` : dRec.google_response_id;
            if (seenDbKeys.has(key)) {
              duplicateDbIds.push(dRec.id);
            } else {
              seenDbKeys.add(key);
            }
          }

          if (duplicateDbIds.length > 0) {
            await supabase.from('feedback_response_records').delete().in('id', duplicateDbIds);
          }
        }

        // 2. Build unique tracking items prioritizing sheet rows (which contain student email)
        interface TrackingMetadata {
          responseId: string;
          timestamp: string;
          email: string;
          studentName: string | null;
          registrationNumber: string | null;
        }
        const trackingMap = new Map<string, TrackingMetadata>();
        const seenStudentKeys = new Set<string>();

        // Process Sheet Data Rows first (has actual student email from form sheet)
        if (sheetHeaders.length > 0 && sheetDataRows.length > 0) {
          sheetDataRows.forEach((row, rowIndex) => {
            let rId = String((respIdIdx !== -1 ? row[respIdIdx] : '') || '').trim();
            if (!rId) {
              rId = `row-${rowIndex + 2}`;
            }
            let rowEmail = String((emailIdx !== -1 ? row[emailIdx] : '') || '').trim();
            if (!rowEmail) {
              for (const cell of row) {
                const s = String(cell || '').trim();
                if (s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
                  rowEmail = s;
                  break;
                }
              }
            }
            const studentName = nameIdx !== -1 && row[nameIdx] ? String(row[nameIdx]).trim() : null;
            const registrationNumber = regIdx !== -1 && row[regIdx] ? String(row[regIdx]).trim() : null;

            const regLower = (registrationNumber || '').toLowerCase();
            const nameLower = (studentName || '').toLowerCase();
            const emailLower = rowEmail.toLowerCase();
            const studentKey = regLower ? `reg:${regLower}` : nameLower ? `name:${nameLower}` : emailLower ? `email:${emailLower}` : rId;

            if (!seenStudentKeys.has(studentKey)) {
              seenStudentKeys.add(studentKey);
              trackingMap.set(rId, {
                responseId: rId,
                timestamp: String((tsIdx !== -1 ? row[tsIdx] : '') || new Date().toISOString()),
                email: rowEmail,
                studentName,
                registrationNumber,
              });
            }
          });
        }

        // Process Forms API responses
        for (const resp of allResponses) {
          const responseId = resp.responseId;
          if (!responseId) continue;
          let respEmail = (resp.respondentEmail || '').trim();
          if (!respEmail && resp.answers) {
            for (const ans of Object.values(resp.answers as Record<string, forms_v1.Schema$Answer>)) {
              const val = ans.textAnswers?.answers?.[0]?.value?.trim() || '';
              if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                respEmail = val;
                break;
              }
            }
          }
          const studentName = (studentNameQuestionId && resp.answers?.[studentNameQuestionId]?.textAnswers?.answers?.[0]?.value) || null;
          const registrationNumber = (regNoQuestionId && resp.answers?.[regNoQuestionId]?.textAnswers?.answers?.[0]?.value) || null;

          const regLower = (registrationNumber || '').toLowerCase();
          const nameLower = (studentName || '').toLowerCase();
          const emailLower = respEmail.toLowerCase();
          const studentKey = regLower ? `reg:${regLower}` : nameLower ? `name:${nameLower}` : emailLower ? `email:${emailLower}` : responseId;

          if (!seenStudentKeys.has(studentKey)) {
            seenStudentKeys.add(studentKey);
            trackingMap.set(responseId, {
              responseId,
              timestamp: resp.lastSubmittedTime || resp.createTime || new Date().toISOString(),
              email: respEmail,
              studentName,
              registrationNumber,
            });
          }
        }

        // Build fast in-memory lookup sets from existing records to eliminate N+1 database queries
        const existingRespIdSet = new Set<string>();
        const existingRegNoSet = new Set<string>();
        const existingEmailSet = new Set<string>();

        for (const dRec of existingAllDbRecs || []) {
          if (dRec.google_response_id) existingRespIdSet.add(dRec.google_response_id.trim());
          if (dRec.registration_number) existingRegNoSet.add(dRec.registration_number.trim().toLowerCase());
          if (dRec.student_email) existingEmailSet.add(dRec.student_email.trim().toLowerCase());
        }

        const itemsToInsert: any[] = [];
        for (const item of trackingMap.values()) {
          const responseId = item.responseId;
          const regNo = item.registrationNumber ? item.registrationNumber.trim().toLowerCase() : null;
          const email = item.email ? item.email.trim().toLowerCase() : null;

          const isExisting =
            existingRespIdSet.has(responseId) ||
            Boolean(regNo && existingRegNoSet.has(regNo)) ||
            Boolean(email && existingEmailSet.has(email));

          if (isExisting) {
            continue;
          }

          // Mark in sets to prevent intra-batch duplicates
          existingRespIdSet.add(responseId);
          if (regNo) existingRegNoSet.add(regNo);
          if (email) existingEmailSet.add(email);

          itemsToInsert.push({
            college_id: collegeId,
            form_id: formUuid,
            google_response_id: responseId,
            student_email: item.email || null,
            student_name: item.studentName || null,
            registration_number: item.registrationNumber || null,
            submitted_at: item.timestamp,
            synced_at: new Date().toISOString(),
            email_status: 'PENDING',
          });
        }

        // Batch insert all new records in a single database operation
        let insertedRecords: any[] = [];
        if (itemsToInsert.length > 0) {
          const { data: insertedData, error: batchErr } = await supabase
            .from('feedback_response_records')
            .insert(itemsToInsert)
            .select('id, google_response_id, student_email, student_name, registration_number, submitted_at');

          if (batchErr) {
            console.warn('[Sync] Batch insert notice:', batchErr.message);
          } else {
            insertedRecords = insertedData || [];
          }
        }

        // Dispatch confirmation emails only for newly inserted student responses
        for (const newRec of insertedRecords) {
          const email = newRec.student_email;
          if (email && email.includes('@') && newRec.id) {
            try {
              const token = generateResponseToken({
                responseId: newRec.google_response_id,
                formId: formUuid,
                email,
              });
              const downloadUrl = `${baseUrl}/api/feedback/response/download?token=${encodeURIComponent(token)}`;

              const emailRes = await sendStudentSubmissionConfirmationEmail({
                studentEmail: email,
                studentName: newRec.student_name,
                registrationNumber: newRec.registration_number,
                formTitle,
                academicYear: academicYearName,
                branch: branchName,
                semester: semesterName,
                submittedAt: newRec.submitted_at,
                downloadUrl,
              });

              await supabase
                .from('feedback_response_records')
                .update({
                  confirmation_email_sent_at: emailRes.status === 'SENT' ? emailRes.sentAt : null,
                  email_status: emailRes.status,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', newRec.id);
            } catch (emailDispatchErr) {
              console.error(`[Sync] Email delivery exception for ${email}:`, emailDispatchErr);
              await supabase
                .from('feedback_response_records')
                .update({
                  email_status: 'FAILED',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', newRec.id);
            }
          }
        }

          // Authoritative student submission count
          const authoritativeStudentCount = trackingMap.size;
          if (authoritativeStudentCount > 0) {
            await supabase
              .from('feedback_forms')
              .update({
                response_count: authoritativeStudentCount,
                last_synced_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', formUuid);
          }
      } catch (dbSyncErr) {
        console.error('[Sync] Error syncing response metadata to Supabase:', dbSyncErr);
      }
    }

    const authoritativeTotal =
      allResponses.length > 0
        ? allResponses.length
        : sheetDataRows.length;

    return {
      success: true,
      syncedCount: rowsToAppend.length,
      totalResponses: authoritativeTotal,
      message:
        rowsToAppend.length > 0
          ? `Successfully synchronized ${rowsToAppend.length} new response(s) to Google Sheet (Total: ${authoritativeTotal}).`
          : `Sheet is up to date (${authoritativeTotal} response(s) already recorded).`,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errCode = (err as any)?.code || ((err as any)?.status === 401 ? 'UNAUTHORIZED' : undefined);
    return {
      success: false,
      syncedCount: 0,
      totalResponses: 0,
      message:
        errCode === 'GOOGLE_CONNECTION_REQUIRED'
          ? (err as any).message || 'Google account is not connected for this college.'
          : `Failed to synchronize responses: ${errMsg}`,
      error: errCode || errMsg,
    };
  }
}

