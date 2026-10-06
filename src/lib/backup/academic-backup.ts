import {
  getOrCreateAcademicSpreadsheet,
  syncSpreadsheetTab,
  removeDefaultSheetIfExtraneous,
  reorderSpreadsheetTabs,
  type SpreadsheetSyncStats,
} from './sheet-utils';

export interface AcademicBackupResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  counts: {
    colleges: number;
    academicYears: number;
    branches: number;
    semesters: number;
    faculties: number;
    subjects: number;
    assignments: number;
  };
  stats: {
    recordsExported: number;
    recordsCreated: number;
    recordsUpdated: number;
  };
}

/**
 * Backs up Academic Structure (Colleges, Faculty, Subjects, Branches, Semesters, Academic Years, Assignments)
 * to a single dedicated Google Spreadsheet "[College Name] - Academic Structure" inside the "Academic Structure" folder.
 * 
 * Canonical Tab Order:
 * 1. College Profile
 * 2. Faculty
 * 3. Subjects
 * 4. Branches
 * 5. Semesters
 * 6. Academic Years
 * 7. Faculty Subject Assignments
 * 
 * Strictly non-destructive. Re-uses existing spreadsheets and avoids duplicate spreadsheet creation.
 */
export async function backupAcademicStructure(params: {
  supabase: any;
  drive: any;
  sheets: any;
  collegeId: string;
  academicFolderId: string;
}): Promise<AcademicBackupResult> {
  const { supabase, drive, sheets, collegeId, academicFolderId } = params;

  // 1. Fetch live academic data strictly scoped to college_id
  const [
    { data: college },
    { data: years },
    { data: branches },
    { data: semesters },
    { data: faculties },
    { data: subjects },
    { data: assignments },
  ] = await Promise.all([
    supabase.from('colleges').select('*').eq('id', collegeId).single(),
    supabase.from('academic_years').select('*').eq('college_id', collegeId).order('name', { ascending: false }),
    supabase.from('branches').select('*').eq('college_id', collegeId).order('name', { ascending: true }),
    supabase.from('semesters').select('*').eq('college_id', collegeId).order('semester_number', { ascending: true }),
    supabase.from('faculties').select('*').eq('college_id', collegeId).order('name', { ascending: true }),
    supabase.from('subjects').select('*, branches(name, code), semesters(name, semester_number)').eq('college_id', collegeId).order('code', { ascending: true }),
    supabase.from('faculty_subject_assignments').select(`
      *,
      faculties(name, department),
      subjects(name, code),
      academic_years(name),
      branches(name, code),
      semesters(name, semester_number)
    `).eq('college_id', collegeId).order('created_at', { ascending: false }),
  ]);

  if (!college) {
    throw new Error(`College [${collegeId}] not found in database.`);
  }

  // Lookup maps for clean foreign-key resolution
  const branchMap = new Map<string, string>();
  (branches || []).forEach((b: any) => branchMap.set(b.id, b.name));

  const semesterMap = new Map<string, string>();
  (semesters || []).forEach((s: any) => semesterMap.set(s.id, s.name));

  // 2. Locate or create "[College Name] - Academic Structure" Spreadsheet (reusing existing if present)
  const academicSheet = await getOrCreateAcademicSpreadsheet(
    drive,
    sheets,
    academicFolderId,
    college.name,
    college.code
  );

  const spreadsheetId = academicSheet.spreadsheetId;
  const spreadsheetUrl = academicSheet.spreadsheetUrl;

  let totalExported = 0;
  let totalCreated = 0;
  let totalUpdated = 0;

  function trackStats(st: SpreadsheetSyncStats) {
    totalExported += st.total;
    totalCreated += st.created;
    totalUpdated += st.updated;
  }

  // 3. Tab 1: College Profile
  const collegeHeaders = [
    'College ID',
    'College Name',
    'Code',
    'Slug',
    'Tagline',
    'Established Year',
    'AICTE Approved',
    'Affiliated University',
    'Contact Email',
    'Contact Phone',
    'Website URL',
    'Status',
    'Created At',
    'Updated At',
  ];
  const collegeRows = [
    [
      college.id,
      college.name,
      college.code,
      college.slug,
      college.tagline || '',
      college.established_year || '',
      college.aicte_approved ? 'YES' : 'NO',
      college.affiliated_university || '',
      college.contact_email || '',
      college.contact_phone || '',
      college.website_url || '',
      college.is_active ? 'ACTIVE' : 'INACTIVE',
      college.created_at,
      college.updated_at,
    ],
  ];
  const s1 = await syncSpreadsheetTab(sheets, spreadsheetId, 'College Profile', collegeHeaders, collegeRows);
  trackStats(s1);

  // 4. Tab 2: Faculty (Supports dynamic faculty count, e.g. BCE-BGP 32)
  const facultyHeaders = [
    'Faculty ID',
    'Faculty Name',
    'Employee ID',
    'Designation',
    'Department / Branch',
    'College ID',
    'Status',
    'Created At',
    'Updated At',
  ];
  const facultyRows = (faculties || []).map((f: any) => [
    f.id,
    f.name,
    f.employee_id || '',
    f.designation,
    f.department,
    f.college_id,
    f.is_active ? 'ACTIVE' : 'INACTIVE',
    f.created_at,
    f.updated_at,
  ]);
  const s2 = await syncSpreadsheetTab(sheets, spreadsheetId, 'Faculty', facultyHeaders, facultyRows);
  trackStats(s2);

  // 5. Tab 3: Subjects (Supports dynamic subject count, e.g. BCE-BGP 45)
  const subjectHeaders = [
    'Subject ID',
    'Subject Code',
    'Subject Name',
    'Branch ID',
    'Branch Name',
    'Semester ID',
    'Semester Name',
    'College ID',
    'Status',
    'Created At',
    'Updated At',
  ];
  const subjectRows = (subjects || []).map((sub: any) => {
    const bName = sub.branches?.name || branchMap.get(sub.branch_id) || '';
    const sName = sub.semesters?.name || semesterMap.get(sub.semester_id) || '';
    return [
      sub.id,
      sub.code,
      sub.name,
      sub.branch_id || '',
      bName,
      sub.semester_id || '',
      sName,
      sub.college_id,
      sub.is_active ? 'ACTIVE' : 'INACTIVE',
      sub.created_at,
      sub.updated_at,
    ];
  });
  const s3 = await syncSpreadsheetTab(sheets, spreadsheetId, 'Subjects', subjectHeaders, subjectRows);
  trackStats(s3);

  // 6. Tab 4: Branches
  const branchHeaders = ['Branch ID', 'College ID', 'Branch Code', 'Branch Name', 'Status', 'Created At', 'Updated At'];
  const branchRows = (branches || []).map((b: any) => [
    b.id,
    b.college_id,
    b.code,
    b.name,
    b.is_active ? 'ACTIVE' : 'INACTIVE',
    b.created_at,
    b.updated_at,
  ]);
  const s4 = await syncSpreadsheetTab(sheets, spreadsheetId, 'Branches', branchHeaders, branchRows);
  trackStats(s4);

  // 7. Tab 5: Semesters
  const semesterHeaders = [
    'Semester ID',
    'College ID',
    'Semester Number',
    'Year Number',
    'Semester Name',
    'Status',
    'Created At',
    'Updated At',
  ];
  const semesterRows = (semesters || []).map((s: any) => [
    s.id,
    s.college_id,
    s.semester_number,
    s.year_number,
    s.name,
    s.is_active ? 'ACTIVE' : 'INACTIVE',
    s.created_at,
    s.updated_at,
  ]);
  const s5 = await syncSpreadsheetTab(sheets, spreadsheetId, 'Semesters', semesterHeaders, semesterRows);
  trackStats(s5);

  // 8. Tab 6: Academic Years
  const yearHeaders = ['Academic Year ID', 'College ID', 'Academic Year Name', 'Status', 'Created At', 'Updated At'];
  const yearRows = (years || []).map((y: any) => [
    y.id,
    y.college_id,
    y.name,
    y.is_active ? 'ACTIVE' : 'INACTIVE',
    y.created_at,
    y.updated_at,
  ]);
  const s6 = await syncSpreadsheetTab(sheets, spreadsheetId, 'Academic Years', yearHeaders, yearRows);
  trackStats(s6);

  // 9. Tab 7: Faculty Subject Assignments
  const assignHeaders = [
    'Assignment ID',
    'Faculty ID',
    'Faculty Name',
    'Subject ID',
    'Subject Code',
    'Subject Name',
    'Academic Year ID',
    'Academic Year Name',
    'Branch ID',
    'Branch Name',
    'Semester ID',
    'Semester Name',
    'College ID',
    'Status',
    'Created At',
    'Updated At',
  ];
  const assignRows = (assignments || []).map((asg: any) => [
    asg.id,
    asg.faculty_id,
    asg.faculties?.name || '',
    asg.subject_id,
    asg.subjects?.code || '',
    asg.subjects?.name || '',
    asg.academic_year_id,
    asg.academic_years?.name || '',
    asg.branch_id || '',
    asg.branches?.name || branchMap.get(asg.branch_id) || '',
    asg.semester_id || '',
    asg.semesters?.name || semesterMap.get(asg.semester_id) || '',
    asg.college_id,
    asg.is_active ? 'ACTIVE' : 'INACTIVE',
    asg.created_at,
    asg.updated_at,
  ]);
  const s7 = await syncSpreadsheetTab(sheets, spreadsheetId, 'Faculty Subject Assignments', assignHeaders, assignRows);
  trackStats(s7);

  // 10. Clean up extraneous default 'Sheet1' and ensure canonical tab order
  await removeDefaultSheetIfExtraneous(sheets, spreadsheetId);
  await reorderSpreadsheetTabs(sheets, spreadsheetId, [
    'College Profile',
    'Faculty',
    'Subjects',
    'Branches',
    'Semesters',
    'Academic Years',
    'Faculty Subject Assignments',
  ]);

  return {
    spreadsheetId,
    spreadsheetUrl,
    counts: {
      colleges: 1,
      academicYears: (years || []).length,
      branches: (branches || []).length,
      semesters: (semesters || []).length,
      faculties: (faculties || []).length,
      subjects: (subjects || []).length,
      assignments: (assignments || []).length,
    },
    stats: {
      recordsExported: totalExported,
      recordsCreated: totalCreated,
      recordsUpdated: totalUpdated,
    },
  };
}
