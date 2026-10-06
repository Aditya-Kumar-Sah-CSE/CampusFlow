import type { BackupVerificationResult, BackupVerificationEntityDetail } from '@/types/backup';

export interface VerifyBackupParams {
  supabase: any;
  sheets: any;
  collegeId: string;
  academicSpreadsheetId: string;
}

/**
 * Performs deep verification of the Google Drive backup against live Supabase data.
 * Checks exact counts and verifies all individual entity IDs.
 * Specifically checks for missing records, duplicate records, and unexpected records.
 * Dynamically validates BCE-BGP (e.g. 32 faculties, 45 subjects, 6 branches, 8 semesters).
 */
export async function verifyCollegeBackup(params: VerifyBackupParams): Promise<BackupVerificationResult> {
  const { supabase, sheets, collegeId, academicSpreadsheetId } = params;
  const errors: string[] = [];
  const details: Record<string, BackupVerificationEntityDetail> = {};

  if (!academicSpreadsheetId) {
    return {
      isVerified: false,
      status: 'FAILED',
      errors: ['No Google Spreadsheet ID provided for verification.'],
      totalSupabase: 0,
      totalDrive: 0,
      totalMissing: 0,
      totalDuplicates: 0,
      totalUnexpected: 0,
      details: {},
    };
  }

  // 1. Fetch Supabase real records and ID sets strictly scoped to collegeId
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
      totalSupabase: 0,
      totalDrive: 0,
      totalMissing: 0,
      totalDuplicates: 0,
      totalUnexpected: 0,
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
      totalSupabase: 0,
      totalDrive: 0,
      totalMissing: 0,
      totalDuplicates: 0,
      totalUnexpected: 0,
      details: {},
    };
  }

  function parseRows(valueRange: any): {
    idList: string[];
    idSet: Set<string>;
    duplicates: string[];
  } {
    const values = valueRange?.values || [];
    const idList: string[] = [];
    const idSet = new Set<string>();
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const row of values) {
      const val = row[0] ? String(row[0]).trim() : '';
      if (val) {
        idList.push(val);
        if (seen.has(val)) {
          duplicates.push(val);
        } else {
          seen.add(val);
        }
        idSet.add(val);
      }
    }
    return { idList, idSet, duplicates };
  }

  const driveFaculties = parseRows(sheetData[0]);
  const driveSubjects = parseRows(sheetData[1]);
  const driveBranches = parseRows(sheetData[2]);
  const driveSemesters = parseRows(sheetData[3]);
  const driveYears = parseRows(sheetData[4]);
  const driveAssignments = parseRows(sheetData[5]);

  let totalSupabase = 0;
  let totalDrive = 0;
  let totalMissing = 0;
  let totalDuplicates = 0;
  let totalUnexpected = 0;

  // Helper verification function with duplicate and unexpected record detection
  function verifyEntity(
    entityName: string,
    supabaseItems: any[] | null,
    driveData: { idList: string[]; idSet: Set<string>; duplicates: string[] }
  ) {
    const sbList = supabaseItems || [];
    const sbCount = sbList.length;
    const driveCount = driveData.idList.length;
    const uniqueDriveCount = driveData.idSet.size;

    const sbIdSet = new Set<string>(sbList.map((i: any) => i.id));

    // Detect missing Supabase records in Google Sheet
    const missingIds: string[] = [];
    for (const item of sbList) {
      if (!driveData.idSet.has(item.id)) {
        missingIds.push(item.id);
      }
    }

    // Detect unexpected records in Google Sheet not in Supabase
    const unexpectedIds: string[] = [];
    for (const dId of driveData.idSet) {
      if (!sbIdSet.has(dId)) {
        unexpectedIds.push(dId);
      }
    }

    const missingCount = missingIds.length;
    const duplicateCount = driveData.duplicates.length;
    const unexpectedCount = unexpectedIds.length;

    totalSupabase += sbCount;
    totalDrive += driveCount;
    totalMissing += missingCount;
    totalDuplicates += duplicateCount;
    totalUnexpected += unexpectedCount;

    const countMatches = sbCount === driveCount;
    const noMissing = missingCount === 0;
    const noDuplicates = duplicateCount === 0;
    const noUnexpected = unexpectedCount === 0;
    const match = countMatches && noMissing && noDuplicates && noUnexpected;

    if (!countMatches) {
      errors.push(`${entityName} count mismatch: Supabase has ${sbCount}, but Google Sheet has ${driveCount}.`);
    }
    if (!noMissing) {
      errors.push(`${entityName}: ${missingCount} record(s) missing in Google Sheet.`);
    }
    if (!noDuplicates) {
      errors.push(`${entityName}: ${duplicateCount} duplicate row(s) found in Google Sheet.`);
    }
    if (!noUnexpected) {
      errors.push(`${entityName}: ${unexpectedCount} unexpected record(s) found in Google Sheet.`);
    }

    details[entityName] = {
      supabaseCount: sbCount,
      driveCount,
      uniqueDriveCount,
      match,
      missingCount,
      duplicateCount,
      unexpectedCount,
      missingIds: missingIds.length > 0 ? missingIds.slice(0, 10) : undefined,
      duplicateIds: driveData.duplicates.length > 0 ? driveData.duplicates.slice(0, 10) : undefined,
      unexpectedIds: unexpectedIds.length > 0 ? unexpectedIds.slice(0, 10) : undefined,
    };
  }

  // 3. Verify each entity
  verifyEntity('faculties', sbFaculties, driveFaculties);
  verifyEntity('subjects', sbSubjects, driveSubjects);
  verifyEntity('branches', sbBranches, driveBranches);
  verifyEntity('semesters', sbSemesters, driveSemesters);
  verifyEntity('academic_years', sbYears, driveYears);
  verifyEntity('faculty_subject_assignments', sbAssignments, driveAssignments);

  const isVerified = errors.length === 0 && totalMissing === 0 && totalDuplicates === 0;

  return {
    isVerified,
    status: isVerified ? 'VERIFIED' : 'MISMATCH',
    errors,
    totalSupabase,
    totalDrive,
    totalMissing,
    totalDuplicates,
    totalUnexpected,
    details,
  };
}
