import { getOrCreateSpreadsheetInFolder, syncSpreadsheetTab, type SpreadsheetSyncStats } from './sheet-utils';

export interface FeedbackBackupResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  counts: {
    feedbackForms: number;
    feedbackFormItems: number;
    feedbackResponseRecords: number;
  };
  stats: {
    recordsExported: number;
    recordsCreated: number;
    recordsUpdated: number;
  };
}

/**
 * Backs up Feedback forms, form items, and student response records to
 * "CampusFlow - Feedback Backup" spreadsheet inside "Feedback Forms" folder.
 */
export async function backupFeedbackForms(params: {
  supabase: any;
  drive: any;
  sheets: any;
  collegeId: string;
  feedbackFolderId: string;
}): Promise<FeedbackBackupResult> {
  const { supabase, drive, sheets, collegeId, feedbackFolderId } = params;

  // 1. Fetch Feedback Forms, Items, and Response Records
  const { data: forms } = await supabase
    .from('feedback_forms')
    .select(`
      *,
      academic_years(name),
      branches(name, code),
      semesters(name),
      faculties(name),
      subjects(name, code)
    `)
    .eq('college_id', collegeId)
    .order('created_at', { ascending: false });

  const formIds = (forms || []).map((f: any) => f.id);

  let formItems: any[] = [];
  if (formIds.length > 0) {
    const { data: items } = await supabase
      .from('feedback_form_items')
      .select('*, faculties(name), subjects(name, code)')
      .in('form_id', formIds)
      .order('order_index', { ascending: true });
    formItems = items || [];
  }

  const { data: responses } = await supabase
    .from('feedback_response_records')
    .select('*')
    .eq('college_id', collegeId)
    .order('synced_at', { ascending: false });

  // 2. Locate or create Spreadsheet
  const { spreadsheetId, spreadsheetUrl } = await getOrCreateSpreadsheetInFolder(
    drive,
    sheets,
    feedbackFolderId,
    'CampusFlow - Feedback Backup',
    'Feedback Forms'
  );

  let totalExported = 0;
  let totalCreated = 0;
  let totalUpdated = 0;

  function trackStats(st: SpreadsheetSyncStats) {
    totalExported += st.total;
    totalCreated += st.created;
    totalUpdated += st.updated;
  }

  // 3. Tab 1: Feedback Forms
  const formHeaders = [
    'Form ID',
    'College ID',
    'Title',
    'Form Type',
    'Status',
    'Slug',
    'Academic Year ID',
    'Academic Year Name',
    'Branch ID',
    'Branch Name',
    'Semester ID',
    'Semester Name',
    'Faculty ID',
    'Subject ID',
    'Google Form URL',
    'Google Sheet URL',
    'Responses Count',
    'Published At',
    'Created At',
    'Updated At',
  ];
  const formRows = (forms || []).map((f: any) => [
    f.id,
    f.college_id,
    f.title,
    f.form_type,
    f.status,
    f.slug,
    f.academic_year_id,
    f.academic_years?.name || '',
    f.branch_id,
    f.branches?.name || '',
    f.semester_id,
    f.semesters?.name || '',
    f.faculty_id || '',
    f.subject_id || '',
    f.google_form_url || '',
    f.google_sheet_url || '',
    f.response_count || 0,
    f.published_at || '',
    f.created_at,
    f.updated_at,
  ]);
  const s1 = await syncSpreadsheetTab(sheets, spreadsheetId, 'Feedback Forms', formHeaders, formRows);
  trackStats(s1);

  // 4. Tab 2: Form Items
  const itemHeaders = [
    'Item ID',
    'Form ID',
    'Faculty ID',
    'Faculty Name',
    'Subject ID',
    'Subject Code',
    'Subject Name',
    'Grid Title',
    'Order Index',
    'Created At',
  ];
  const itemRows = formItems.map((item: any) => [
    item.id,
    item.form_id,
    item.faculty_id,
    item.faculties?.name || '',
    item.subject_id,
    item.subjects?.code || '',
    item.subjects?.name || '',
    item.grid_title || '',
    item.order_index ?? 0,
    item.created_at,
  ]);
  const s2 = await syncSpreadsheetTab(sheets, spreadsheetId, 'Form Items', itemHeaders, itemRows);
  trackStats(s2);

  // 5. Tab 3: Response Records
  const responseHeaders = [
    'Record ID',
    'College ID',
    'Form ID',
    'Google Response ID',
    'Student Email',
    'Student Name',
    'Registration Number',
    'Email Delivery Status',
    'Submitted At',
    'Synced At',
  ];
  const responseRows = (responses || []).map((r: any) => [
    r.id,
    r.college_id,
    r.form_id,
    r.google_response_id,
    r.student_email,
    r.student_name || '',
    r.registration_number || '',
    r.email_status || 'PENDING',
    r.submitted_at || '',
    r.synced_at,
  ]);
  const s3 = await syncSpreadsheetTab(sheets, spreadsheetId, 'Response Records', responseHeaders, responseRows);
  trackStats(s3);

  return {
    spreadsheetId,
    spreadsheetUrl,
    counts: {
      feedbackForms: (forms || []).length,
      feedbackFormItems: formItems.length,
      feedbackResponseRecords: (responses || []).length,
    },
    stats: {
      recordsExported: totalExported,
      recordsCreated: totalCreated,
      recordsUpdated: totalUpdated,
    },
  };
}
