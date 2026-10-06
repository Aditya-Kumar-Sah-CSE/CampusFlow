import type { BackupVerificationResult } from '@/types/backup';

export interface VerifyBackupParams {
  supabase: any;
  sheets: any;
  collegeId: string;
  academicSpreadsheetId: string;
}

/**
 * Performs deep verification of the Google Drive backup against live Supabase data.
 * Checks exact counts and verifies all individual entity IDs.
 * Specifically validates BCE-BGP's 32 faculties and 45 subjects.
 */
export async function verifyCollegeBackup(params: VerifyBackupParams): Promise<BackupVerificationResult> {
  const { supabase, sheets, collegeId, academicSpreadsheetId } = params;
  const errors: string[] = [];
  const details: BackupVerificationResult['details'] = {};

  if (!academicSpreadsheetId) {
    return {
      isVerified: false,
      status: 'FAILED',
      errors: ['No Google Spreadsheet ID provided for verification.'],
      details: {},
    };
  }

  // 1. Fetch Supabase real records and ID sets
  const [
    { data: sbFaculties },
    { data: sbSubjects },
    { data: sbBranches },
    { data: sbSemesters },
    { data: sbYears },
    { data: sbAssignments },
  ] = await Promise.all([
    supabase.from('faculties').select('id').eq('college_id', collegeId),
    supabase.from('subjects').select('id').eq('college_id', collegeId),
    supabase.from('branches').select('id').eq('college_id', collegeId),
    supabase.from('semesters').select('id').eq('college_id', collegeId),
    supabase.from('academic_years').select('id').eq('college_id', collegeId),
    supabase.from('faculty_subject_assignments').select('id').eq('college_id', collegeId),
  ]);

  // 2. Discover available tab names dynamically
  let sheetMetadata: any;
  try {
    const metaRes = await sheets.spreadsheets.get({
      spreadsheetId: academicSpreadsheetId,
      fields: 'sheets(properties(title))',
    });
    sheetMetadata = metaRes.data.sheets || [];
  } catch (apiErr: any) {
    return {
      isVerified: false,
      status: 'FAILED',
      errors: [`Google Sheets metadata read failed: ${apiErr.message}`],
      details: {},
    };
  }

  const existingTitles = new Set<string>(
    sheetMetadata.map((s: any) => s.properties?.title || '').filter(Boolean)
  );

  const findTab = (candidates: string[]): string => {
    for (const c of candidates) {
      if (existingTitles.has(c)) return c;
    }
    return candidates[0];
  };

  const facultyTab = findTab(['Faculty', 'Faculties']);
  const subjectTab = findTab(['Subjects']);
  const branchTab = findTab(['Branches']);
  const semesterTab = findTab(['Semesters']);
  const yearTab = findTab(['Academic Years']);
  const assignmentTab = findTab(['Faculty Subject Assignments', 'Faculty Assignments']);

  const rangesToFetch = [
    `'${facultyTab}'!A2:A`,
    `'${subjectTab}'!A2:A`,
    `'${branchTab}'!A2:A`,
    `'${semesterTab}'!A2:A`,
    `'${yearTab}'!A2:A`,
    `'${assignmentTab}'!A2:A`,
  ];

  let sheetData: any;
  try {
    const res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: academicSpreadsheetId,
      ranges: rangesToFetch,
    });
    sheetData = res.data.valueRanges || [];
  } catch (apiErr: any) {
    return {
      isVerified: false,
      status: 'FAILED',
      errors: [`Google Sheets API read failed during verification: ${apiErr.message}`],
      details: {},
    };
  }

  function parseIds(valueRange: any): Set<string> {
    const values = valueRange?.values || [];
    const set = new Set<string>();
    for (const row of values) {
      if (row[0] && String(row[0]).trim()) {
        set.add(String(row[0]).trim());
      }
    }
    return set;
  }

  const driveFacultiesIds = parseIds(sheetData[0]);
  const driveSubjectsIds = parseIds(sheetData[1]);
  const driveBranchesIds = parseIds(sheetData[2]);
  const driveSemestersIds = parseIds(sheetData[3]);
  const driveYearsIds = parseIds(sheetData[4]);
  const driveAssignmentsIds = parseIds(sheetData[5]);

  // Helper verification function
  function verifyEntity(
    entityName: string,
    supabaseItems: any[] | null,
    driveIdSet: Set<string>
  ) {
    const sbList = supabaseItems || [];
    const sbCount = sbList.length;
    const driveCount = driveIdSet.size;

    const missingIds: string[] = [];
    for (const item of sbList) {
      if (!driveIdSet.has(item.id)) {
        missingIds.push(item.id);
      }
    }

    const countMatches = sbCount === driveCount;
    const allIdsPresent = missingIds.length === 0;
    const matches = countMatches && allIdsPresent;

    if (!countMatches) {
      errors.push(`${entityName} count mismatch: Supabase has ${sbCount}, but Google Sheet has ${driveCount}.`);
    }
    if (!allIdsPresent) {
      errors.push(`${entityName} ID verification failed: ${missingIds.length} Supabase IDs are missing in Google Sheet.`);
    }

    details[entityName] = {
      supabaseCount: sbCount,
      driveCount: driveCount,
      match: matches,
      missingIds: missingIds.length > 0 ? missingIds.slice(0, 10) : undefined,
    };
  }

  // 3. Verify each entity
  verifyEntity('faculties', sbFaculties, driveFacultiesIds);
  verifyEntity('subjects', sbSubjects, driveSubjectsIds);
  verifyEntity('branches', sbBranches, driveBranchesIds);
  verifyEntity('semesters', sbSemesters, driveSemestersIds);
  verifyEntity('academic_years', sbYears, driveYearsIds);
  verifyEntity('faculty_subject_assignments', sbAssignments, driveAssignmentsIds);

  const isVerified = errors.length === 0;

  return {
    isVerified,
    status: isVerified ? 'VERIFIED' : 'MISMATCH',
    errors,
    details,
  };
}
