/**
 * Google Sheets-backed Event Registration Service
 * 
 * SOURCE OF TRUTH for all registration data:
 * Google Sheets in the college's connected Google Drive is the ONLY source of truth for:
 *   - event registrations
 *   - participant records
 *   - team records
 *   - program registrations
 *   - payment records
 *   - registration numbers
 * 
 * SPREADSHEET STRUCTURE:
 * Sheet 1: EVENT_REGISTRATIONS (Master Sheet - 22 columns)
 * Additional Sheets: PROGRAM_<program-slug> (Program Sheets - 14 columns)
 * 
 * Supabase ONLY stores event configuration (categories, programs, rules, fees).
 * Fails closed if Google connection is unavailable.
 */

import { executeWithCollegeGoogleOAuthRetry, isCollegeGoogleConfigured } from './auth';
import { getColumnLetter } from './sheets';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

// ============================================================
// CONSTANTS: HEADERS & TAB NAMES
// ============================================================

export const MASTER_SHEET_NAME = 'EVENT_REGISTRATIONS';

export const EVENT_REG_HEADERS = [
  'Registration Number',                 // Col A (0)
  'Event ID',                            // Col B (1)
  'Program ID',                          // Col C (2)
  'Program Name',                        // Col D (3)
  'Participation Type',                  // Col E (4)
  'Team ID',                             // Col F (5)
  'Team Name',                           // Col G (6)
  'Participant Role',                    // Col H (7)
  'Participant Name',                    // Col I (8)
  'Registration Number / Student ID',    // Col J (9)
  'Email',                               // Col K (10)
  'Mobile',                              // Col L (11)
  'Branch',                              // Col M (12)
  'Semester',                            // Col N (13)
  'Gender',                              // Col O (14)
  'Payment Required',                    // Col P (15)
  'Payment Amount',                      // Col Q (16)
  'Payment Status',                      // Col R (17)
  'Payment Reference',                   // Col S (18)
  'Registration Status',                 // Col T (19)
  'Registered At',                       // Col U (20)
  'Team Leader Registration Number',     // Col V (21)
];

export const PROGRAM_SHEET_HEADERS = [
  'Registration Number',                 // Col A (0)
  'Team ID',                             // Col B (1)
  'Team Name',                           // Col C (2)
  'Participation Type',                  // Col D (3)
  'Participant Role',                    // Col E (4)
  'Student Name',                        // Col F (5)
  'Student ID',                          // Col G (6)
  'Email',                               // Col H (7)
  'Mobile',                              // Col I (8)
  'Branch',                              // Col J (9)
  'Semester',                            // Col K (10)
  'Payment Amount',                      // Col L (11)
  'Payment Status',                      // Col M (12)
  'Registered At',                       // Col N (13)
];

// ============================================================
// TYPES
// ============================================================

export interface MasterRegistrationRow {
  registrationNumber: string;
  eventId: string;
  programId: string;
  programName: string;
  participationType: string;
  teamId: string;
  teamName: string;
  participantRole: string;
  participantName: string;
  studentId: string;
  email: string;
  mobile: string;
  branch: string;
  semester: string;
  gender: string;
  paymentRequired: string;
  paymentAmount: number;
  paymentStatus: string;
  paymentReference: string;
  registrationStatus: string;
  registeredAt: string;
  teamLeaderRegistrationNumber: string;
  rowIndex?: number; // 1-indexed row in sheet
}

export interface ProgramSheetRow {
  registrationNumber: string;
  teamId: string;
  teamName: string;
  participationType: string;
  participantRole: string;
  studentName: string;
  studentId: string;
  email: string;
  mobile: string;
  branch: string;
  semester: string;
  paymentAmount: number;
  paymentStatus: string;
  registeredAt: string;
  rowIndex?: number;
}

export interface EventRegistrationInputData {
  eventId: string;
  fullName: string;
  studentId: string;
  email: string;
  mobile: string;
  branch?: string;
  semester?: string;
  gender?: string;
  paymentRequired?: boolean;
  paymentAmount?: number;
  paymentStatus?: string;
  paymentReference?: string;
}

export interface ProgramRegistrationInputData {
  eventId: string;
  programId: string;
  programName: string;
  participationType: 'INDIVIDUAL' | 'TEAM';
  teamId?: string;
  teamName?: string;
  participantRole?: 'INDIVIDUAL' | 'TEAM LEADER' | 'TEAM MEMBER';
  fullName: string;
  studentId: string;
  email: string;
  mobile: string;
  branch?: string;
  semester?: string;
  gender?: string;
  paymentRequired: boolean;
  paymentAmount: number;
  paymentStatus?: string;
  paymentReference?: string;
  leaderEventRegNumber?: string;
}

export interface EventStats {
  totalEventRegistrations: number;
  totalPrograms: number;
  totalProgramRegistrations: number;
  individualParticipants: number;
  teams: number;
  paidRegistrations: number;
  pendingPayments: number;
  confirmedRegistrations: number;
  totalRevenue: number;
  programCards: {
    programId: string;
    programName: string;
    teams: number;
    participants: number;
    revenue: number;
  }[];
}

export interface SheetProgramStats {
  totalRegistrations: number;
  totalParticipants: number;
  totalTeams: number;
  totalIndividual: number;
  paymentPending: number;
  paymentVerified: number;
  paymentRejected: number;
  paymentSubmitted: number;
  totalRevenue: number;
}

// ============================================================
// HELPERS
// ============================================================

export function getProgramTabName(programSlug: string): string {
  const sanitized = programSlug
    .replace(/[^A-Za-z0-9]/g, '_')
    .toUpperCase();
  return `PROGRAM_${sanitized}`;
}

function cellValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

/**
 * Ensures Google connection is active or throws clear fail-closed error.
 */
export async function assertCollegeGoogleConnected(collegeId: string): Promise<void> {
  const connected = await isCollegeGoogleConfigured(collegeId);
  if (!connected) {
    throw new Error('Registration is temporarily unavailable because the college registration service is not connected.');
  }
}

/**
 * Generate collision-safe event registration number.
 * Format: {EVENT_PREFIX}-E{001}
 */
export function generateEventRegNumber(eventSlug: string, existingNumbers: Set<string>): string {
  const prefix = eventSlug
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 7);

  let seq = 1;
  const maxRetries = 500;
  for (let i = 0; i < maxRetries; i++) {
    const candidate = `${prefix}-E${String(seq).padStart(3, '0')}`;
    if (!existingNumbers.has(candidate.toUpperCase())) {
      return candidate;
    }
    seq++;
  }

  // Fallback: entropy suffix
  const salt = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-E${salt}`;
}

/**
 * Generate collision-safe program registration number.
 * Format: {EVENT_PREFIX}-{PROG_PREFIX}-{001}
 */
export function generateProgramRegNumber(
  eventSlug: string,
  programSlug: string,
  existingNumbers: Set<string>
): string {
  const eventPrefix = eventSlug
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 7);

  const progPrefix = programSlug
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 3);

  let seq = 1;
  const maxRetries = 500;
  for (let i = 0; i < maxRetries; i++) {
    const candidate = `${eventPrefix}-${progPrefix}-${String(seq).padStart(3, '0')}`;
    if (!existingNumbers.has(candidate.toUpperCase())) {
      return candidate;
    }
    seq++;
  }

  const salt = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${eventPrefix}-${progPrefix}-${salt}`;
}

/**
 * Generate collision-safe team ID.
 * Format: TEAM-{PROG_PREFIX}-{001}
 */
export function generateTeamId(programSlug: string, existingTeamIds: Set<string>): string {
  const progPrefix = programSlug
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 7);

  let seq = 1;
  const maxRetries = 500;
  for (let i = 0; i < maxRetries; i++) {
    const candidate = `TEAM-${progPrefix}-${String(seq).padStart(3, '0')}`;
    if (!existingTeamIds.has(candidate.toUpperCase())) {
      return candidate;
    }
    seq++;
  }

  const salt = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `TEAM-${progPrefix}-${salt}`;
}

// ============================================================
// 1. SPREADSHEET INITIALIZATION & TAB MANAGEMENT
// ============================================================

/**
 * Auto-discover existing Event Registration spreadsheet in the college's Google Drive.
 * Searches for exact title: `${eventTitle} — Event Registrations`
 * Prefers Google Sheets MIME type, ignores trashed files, and orders by modifiedTime desc.
 * Returns the spreadsheet ID if found, or null if no matching spreadsheet exists.
 */
export async function findEventRegistrationSpreadsheetInDrive(
  collegeId: string,
  eventTitle: string
): Promise<string | null> {
  if (!collegeId || !eventTitle) return null;

  try {
    const isConfigured = await isCollegeGoogleConfigured(collegeId);
    if (!isConfigured) return null;

    return await executeWithCollegeGoogleOAuthRetry(collegeId, async ({ drive }) => {
      // Check the existing double-space name first, then legacy names. This
      // prevents creating a second workbook when older records used another
      // separator style.
      const candidateTitles = [
        `${eventTitle}  Event Registrations`,
        `${eventTitle} — Event Registrations`,
        `${eventTitle} - Event Registrations`,
      ];
      for (const title of [...new Set(candidateTitles)]) {
        const escapedTitle = title.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const result = await drive.files.list({
          q: `name = '${escapedTitle}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
          fields: 'files(id, name, modifiedTime)',
          orderBy: 'modifiedTime desc',
          pageSize: 10,
        });
        const spreadsheetId = result.data.files?.find(file => file.id)?.id;
        if (spreadsheetId) return spreadsheetId;
      }

      return null;
    });
  } catch (err) {
    console.warn(`[EventRegSheets] findEventRegistrationSpreadsheetInDrive error for event "${eventTitle}":`, err);
    return null;
  }
}

/**
 * Creates a brand new event registration spreadsheet in Google Drive.
 * Internal helper: Callers should always use resolveEventRegistrationSpreadsheet to prevent duplicates.
 */
async function createNewEventRegistrationSpreadsheetInternal(
  collegeId: string,
  eventId: string,
  eventTitle: string
): Promise<string> {
  const spreadsheetId = await executeWithCollegeGoogleOAuthRetry(
    collegeId,
    async ({ sheets }) => {
      const title = `${eventTitle} — Event Registrations`;
      const createRes = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title },
          sheets: [
            {
              properties: {
                title: MASTER_SHEET_NAME,
                index: 0,
                gridProperties: { frozenRowCount: 1 },
              },
            },
          ],
        },
      });

      const newId = createRes.data.spreadsheetId;
      if (!newId) throw new Error('Failed to create registration spreadsheet.');

      const sheetId = createRes.data.sheets?.[0]?.properties?.sheetId ?? 0;
      const lastCol = getColumnLetter(EVENT_REG_HEADERS.length);

      // Populate headers
      await sheets.spreadsheets.values.update({
        spreadsheetId: newId,
        range: `'${MASTER_SHEET_NAME}'!A1:${lastCol}1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [EVENT_REG_HEADERS] },
      });

      // Style headers: Navy Blue (#0B192C) with White Bold text
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: newId,
          requestBody: {
            requests: [
              {
                repeatCell: {
                  range: {
                    sheetId,
                    startRowIndex: 0,
                    endRowIndex: 1,
                    startColumnIndex: 0,
                    endColumnIndex: EVENT_REG_HEADERS.length,
                  },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: { red: 11 / 255, green: 25 / 255, blue: 44 / 255 },
                      textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 10 },
                      horizontalAlignment: 'CENTER',
                      verticalAlignment: 'MIDDLE',
                      wrapStrategy: 'WRAP',
                    },
                  },
                  fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)',
                },
              },
              {
                autoResizeDimensions: {
                  dimensions: {
                    sheetId,
                    dimension: 'COLUMNS',
                    startIndex: 0,
                    endIndex: EVENT_REG_HEADERS.length,
                  },
                },
              },
            ],
          },
        });
      } catch (styleErr) {
        console.warn('[EventRegSheets] Header styling warning:', styleErr);
      }

      return newId;
    }
  );

  // Attempt non-fatal persistence in Supabase
  const supabase = createAdminClient();
  if (supabase && eventId) {
    try {
      await supabase
        .from('events')
        .update({ registration_sheet_id: spreadsheetId })
        .eq('id', eventId)
        .eq('college_id', collegeId);
    } catch {
      // Non-fatal if column doesn't exist
    }
  }

  return spreadsheetId;
}

/**
 * Centralized resolver for event registration spreadsheets.
 * 1. Checks Supabase cached registration_sheet_id (schema-safe against missing column 42703).
 * 2. If cached, verifies the spreadsheet exists and is accessible.
 * 3. If null/missing/inaccessible, searches Google Drive for `${eventTitle} — Event Registrations`.
 * 4. If found in Drive, attempts to non-fatally cache in Supabase.
 * 5. If not found and options.createIfMissing is true, creates exactly one new spreadsheet.
 * 6. Never duplicates an existing spreadsheet in Google Drive.
 */
export async function resolveEventRegistrationSpreadsheet(
  collegeId: string,
  eventId: string,
  eventTitle?: string,
  options?: { createIfMissing?: boolean }
): Promise<string | null> {
  await assertCollegeGoogleConnected(collegeId);

  const supabase = createAdminClient();
  let cachedSheetId: string | null = null;
  let resolvedTitle: string = eventTitle || '';

  // 1. Try reading registration_sheet_id from Supabase events table
  if (supabase && eventId) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId.trim());
    let query = supabase.from('events').select('id, title, registration_sheet_id');
    if (isUuid) {
      query = query.eq('id', eventId.trim());
    } else {
      query = query.eq('slug', eventId.trim());
    }
    if (collegeId) {
      query = query.eq('college_id', collegeId);
    }

    const { data, error } = await query.maybeSingle();

    if (!error && data) {
      cachedSheetId = data.registration_sheet_id || null;
      resolvedTitle = resolvedTitle || data.title;
    } else if (error && error.code === '42703') {
      // Column registration_sheet_id does not exist in schema yet
      let fallbackQuery = supabase.from('events').select('id, title');
      if (isUuid) {
        fallbackQuery = fallbackQuery.eq('id', eventId.trim());
      } else {
        fallbackQuery = fallbackQuery.eq('slug', eventId.trim());
      }
      if (collegeId) {
        fallbackQuery = fallbackQuery.eq('college_id', collegeId);
      }
      const { data: fallbackData } = await fallbackQuery.maybeSingle();
      if (fallbackData) {
        resolvedTitle = resolvedTitle || fallbackData.title;
      }
    }
  }

  // 2. Validate cached spreadsheet ID if present
  if (cachedSheetId) {
    try {
      await executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
        await sheets.spreadsheets.get({
          spreadsheetId: cachedSheetId!,
          fields: 'spreadsheetId',
        });
      });
      return cachedSheetId;
    } catch {
      console.warn(`[EventRegSheets] Cached sheet ${cachedSheetId} inaccessible, falling back to Drive discovery.`);
      cachedSheetId = null;
    }
  }

  // 3. Search Google Drive by title if title is available
  if (resolvedTitle) {
    const driveSheetId = await findEventRegistrationSpreadsheetInDrive(collegeId, resolvedTitle);
    if (driveSheetId) {
      // Attempt non-fatal cache update in Supabase
      if (supabase && eventId) {
        void (async () => {
          try {
            const { error: updateErr } = await supabase
              .from('events')
              .update({ registration_sheet_id: driveSheetId })
              .eq('id', eventId);
            if (updateErr && updateErr.code !== '42703') {
              console.warn(`[EventRegSheets] Non-fatal cache update notice:`, updateErr.message);
            }
          } catch {
            // Ignore non-fatal update error
          }
        })();
      }
      return driveSheetId;
    }
  }

  // 4. Create spreadsheet only if explicitly requested
  if (options?.createIfMissing && resolvedTitle) {
    return await createNewEventRegistrationSpreadsheetInternal(collegeId, eventId, resolvedTitle);
  }

  return null;
}

/**
 * Get or create the event registration spreadsheet.
 * Strictly avoids creating duplicates by resolving existing sheets in Supabase and Google Drive first.
 */
export async function getOrCreateEventRegistrationSpreadsheet(
  collegeId: string,
  eventId: string,
  eventTitle: string
): Promise<string> {
  const sheetId = await resolveEventRegistrationSpreadsheet(collegeId, eventId, eventTitle, { createIfMissing: true });
  if (!sheetId) {
    throw new Error('Failed to resolve or create event registration spreadsheet.');
  }
  return sheetId;
}

/**
 * Ensure EVENT_REGISTRATIONS sheet exists with 22 headers.
 */
export async function ensureEventRegistrationSheet(
  collegeId: string,
  spreadsheetId: string
): Promise<void> {
  await executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title',
    });

    const hasMaster = (meta.data.sheets || []).some(
      s => s.properties?.title === MASTER_SHEET_NAME
    );

    if (!hasMaster) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: MASTER_SHEET_NAME,
                  index: 0,
                  gridProperties: { frozenRowCount: 1 },
                },
              },
            },
          ],
        },
      });

      const lastCol = getColumnLetter(EVENT_REG_HEADERS.length);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${MASTER_SHEET_NAME}'!A1:${lastCol}1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [EVENT_REG_HEADERS] },
      });
    }
  });
}

/**
 * Ensure program-specific sheet exists (PROGRAM_<slug>) with 14 headers.
 */
export async function ensureProgramSheet(
  collegeId: string,
  spreadsheetId: string,
  programSlug: string,
  _programName?: string
): Promise<string> {
  const tabName = getProgramTabName(programSlug);

  return executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title,sheets.properties.sheetId',
    });

    const existingSheet = (meta.data.sheets || []).find(
      s => s.properties?.title === tabName
    );

    if (existingSheet) {
      return tabName;
    }

    // Create tab
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: tabName,
                gridProperties: { frozenRowCount: 1 },
              },
            },
          },
        ],
      },
    });

    const newSheetId = addRes.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0;
    const lastCol = getColumnLetter(PROGRAM_SHEET_HEADERS.length);

    // Populate headers
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tabName}'!A1:${lastCol}1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [PROGRAM_SHEET_HEADERS] },
    });

    // Style headers
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: newSheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: PROGRAM_SHEET_HEADERS.length,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 30 / 255, green: 62 / 255, blue: 98 / 255 },
                    textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 10 },
                    horizontalAlignment: 'CENTER',
                    verticalAlignment: 'MIDDLE',
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
              },
            },
            {
              autoResizeDimensions: {
                dimensions: {
                  sheetId: newSheetId,
                  dimension: 'COLUMNS',
                  startIndex: 0,
                  endIndex: PROGRAM_SHEET_HEADERS.length,
                },
              },
            },
          ],
        },
      });
    } catch {
      // non-fatal
    }

    return tabName;
  });
}

// ============================================================
// 2. READ OPERATIONS
// ============================================================

/**
 * Get all registrations from EVENT_REGISTRATIONS master tab.
 */
export async function getEventRegistrations(
  collegeId: string,
  spreadsheetId: string
): Promise<MasterRegistrationRow[]> {
  await assertCollegeGoogleConnected(collegeId);

  return executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${MASTER_SHEET_NAME}'!A2:V`,
    });

    const rows = res.data.values || [];
    return rows.map((r, idx) => ({
      registrationNumber: cellValue(r[0]),
      eventId: cellValue(r[1]),
      programId: cellValue(r[2]),
      programName: cellValue(r[3]),
      participationType: cellValue(r[4]),
      teamId: cellValue(r[5]),
      teamName: cellValue(r[6]),
      participantRole: cellValue(r[7]),
      participantName: cellValue(r[8]),
      studentId: cellValue(r[9]),
      email: cellValue(r[10]),
      mobile: cellValue(r[11]),
      branch: cellValue(r[12]),
      semester: cellValue(r[13]),
      gender: cellValue(r[14]),
      paymentRequired: cellValue(r[15]),
      paymentAmount: parseFloat(cellValue(r[16])) || 0,
      paymentStatus: cellValue(r[17]) || 'NOT_REQUIRED',
      paymentReference: cellValue(r[18]),
      registrationStatus: cellValue(r[19]) || 'REGISTERED',
      registeredAt: cellValue(r[20]),
      teamLeaderRegistrationNumber: cellValue(r[21]),
      rowIndex: idx + 2, // row index in 1-based sheet
    }));
  });
}

/**
 * Get program-specific registrations from PROGRAM_<slug> tab.
 */
export async function getProgramRegistrations(
  collegeId: string,
  spreadsheetId: string,
  programSlug: string
): Promise<ProgramSheetRow[]> {
  await assertCollegeGoogleConnected(collegeId);
  const tabName = getProgramTabName(programSlug);

  return executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${tabName}'!A2:N`,
      });

      const rows = res.data.values || [];
      return rows.map((r, idx) => ({
        registrationNumber: cellValue(r[0]),
        teamId: cellValue(r[1]),
        teamName: cellValue(r[2]),
        participationType: cellValue(r[3]),
        participantRole: cellValue(r[4]),
        studentName: cellValue(r[5]),
        studentId: cellValue(r[6]),
        email: cellValue(r[7]),
        mobile: cellValue(r[8]),
        branch: cellValue(r[9]),
        semester: cellValue(r[10]),
        paymentAmount: parseFloat(cellValue(r[11])) || 0,
        paymentStatus: cellValue(r[12]) || 'NOT_REQUIRED',
        registeredAt: cellValue(r[13]),
        rowIndex: idx + 2,
      }));
    } catch {
      // Tab may not exist yet if no registrations have occurred
      return [];
    }
  });
}

/**
 * Find registration in EVENT_REGISTRATIONS by registration number.
 */
export async function findRegistrationByNumber(
  collegeId: string,
  spreadsheetId: string,
  registrationNumber: string
): Promise<MasterRegistrationRow | null> {
  const all = await getEventRegistrations(collegeId, spreadsheetId);
  const cleanTarget = registrationNumber.trim().toUpperCase();
  return all.find(r => r.registrationNumber.toUpperCase() === cleanTarget) || null;
}

/**
 * Find event registration by student ID / roll number.
 */
export async function findRegistrationByStudentId(
  collegeId: string,
  spreadsheetId: string,
  studentId: string
): Promise<MasterRegistrationRow | null> {
  const all = await getEventRegistrations(collegeId, spreadsheetId);
  const cleanTarget = studentId.trim().toUpperCase();
  // Find primary event registration (programId is empty or role is PARTICIPANT)
  return all.find(r => r.studentId.toUpperCase() === cleanTarget) || null;
}

/**
 * Find existing event registration by credentials (server-side verification).
 * Verifies eventId, registrationNumber, and registered email against Google Sheet.
 */
export async function findEventRegistrationByCredentials(
  collegeId: string,
  eventId: string,
  email?: string,
  registrationNumber?: string,
  providedSpreadsheetId?: string
): Promise<MasterRegistrationRow | null> {
  await assertCollegeGoogleConnected(collegeId);

  let spreadsheetId = providedSpreadsheetId;
  if (!spreadsheetId) {
    spreadsheetId = (await resolveEventRegistrationSpreadsheet(collegeId, eventId)) || undefined;
  }

  if (!spreadsheetId) return null;

  const all = await getEventRegistrations(collegeId, spreadsheetId);
  const cleanRegNum = registrationNumber?.trim().toUpperCase() || '';
  const cleanEmail = email?.trim().toLowerCase() || '';

  if (!cleanRegNum && !cleanEmail) return null;

  // Find rows matching registrationNumber and/or email, eventId, and not cancelled
  const matching = all.filter(r => {
    const eventMatches = !r.eventId || r.eventId === eventId;
    const notCancelled = r.registrationStatus !== 'CANCELLED';
    if (!eventMatches || !notCancelled) return false;

    // Both provided -> both must match (Strict credential verification & Case 8 enforcement)
    if (cleanRegNum && cleanEmail) {
      const regMatches = r.registrationNumber.trim().toUpperCase() === cleanRegNum || r.studentId.trim().toUpperCase() === cleanRegNum;
      const emailMatches = r.email.trim().toLowerCase() === cleanEmail;
      return regMatches && emailMatches;
    }

    // Only reg number / student id provided
    if (cleanRegNum) {
      return r.registrationNumber.trim().toUpperCase() === cleanRegNum || r.studentId.trim().toUpperCase() === cleanRegNum;
    }

    // Only email provided
    if (cleanEmail) {
      return r.email.trim().toLowerCase() === cleanEmail;
    }

    return false;
  });

  if (matching.length === 0) return null;

  // Prefer the primary event registration row (programId is empty)
  const primary = matching.find(r => r.programId === '');
  return primary || matching[0];
}

/**
 * Lookup an existing event registration by registration number for team member linking.
 * Returns the verified event registration row if found for this event.
 */
export async function lookupEventRegistrationByNumber(
  collegeId: string,
  spreadsheetId: string,
  eventId: string,
  registrationNumber: string
): Promise<MasterRegistrationRow | null> {
  const all = await getEventRegistrations(collegeId, spreadsheetId);
  const cleanTarget = registrationNumber.trim().toUpperCase();

  const matching = all.filter(
    r =>
      r.registrationNumber.trim().toUpperCase() === cleanTarget &&
      (!r.eventId || r.eventId === eventId) &&
      r.registrationStatus !== 'CANCELLED'
  );

  if (matching.length === 0) return null;
  const primary = matching.find(r => r.programId === '');
  return primary || matching[0];
}

/**
 * Find existing registration for a specific program to prevent duplicates and load details.
 */
export async function findExistingProgramRegistration(
  collegeId: string,
  spreadsheetId: string,
  eventId: string,
  programId: string,
  params: {
    eventRegNumber?: string;
    studentId?: string;
    email?: string;
  }
): Promise<MasterRegistrationRow | null> {
  const all = await getEventRegistrations(collegeId, spreadsheetId);
  const cleanEventRegNum = params.eventRegNumber?.trim().toUpperCase() || '';
  const cleanStudentId = params.studentId?.trim().toUpperCase() || '';
  const cleanEmail = params.email?.trim().toLowerCase() || '';

  return (
    all.find(r => {
      if (r.programId !== programId) return false;
      if (r.eventId && r.eventId !== eventId) return false;
      if (r.registrationStatus === 'CANCELLED') return false;

      // Check by event registration number (leader or direct)
      if (
        cleanEventRegNum &&
        (r.teamLeaderRegistrationNumber.toUpperCase() === cleanEventRegNum ||
          r.registrationNumber.toUpperCase() === cleanEventRegNum ||
          r.studentId.toUpperCase() === cleanEventRegNum)
      ) {
        return true;
      }

      // Check by student ID / roll number
      if (cleanStudentId && r.studentId.toUpperCase() === cleanStudentId) {
        return true;
      }

      // Check by registered email
      if (cleanEmail && r.email.toLowerCase() === cleanEmail) {
        return true;
      }

      return false;
    }) || null
  );
}

/**
 * Check if student or email or registration number is already registered for a specific program.
 */
export async function checkDuplicateProgramRegistration(
  collegeId: string,
  spreadsheetId: string,
  programId: string,
  studentId: string,
  email: string,
  eventRegNumber?: string,
  eventId?: string
): Promise<boolean> {
  const existing = await findExistingProgramRegistration(
    collegeId,
    spreadsheetId,
    eventId || '',
    programId,
    { eventRegNumber, studentId, email }
  );
  return existing !== null;
}

// ============================================================
// 3. WRITE OPERATIONS: EVENT & PROGRAM REGISTRATIONS
// ============================================================

/**
 * Append event registration (Student registers for event first).
 * Generates unique, collision-safe Event Registration Number.
 */
export async function appendEventRegistration(
  collegeId: string,
  spreadsheetId: string,
  eventSlug: string,
  data: EventRegistrationInputData
): Promise<{ registrationNumber: string }> {
  await assertCollegeGoogleConnected(collegeId);
  await ensureEventRegistrationSheet(collegeId, spreadsheetId);

  // Read existing registrations to prevent duplicate and generate unique number
  const existingRows = await getEventRegistrations(collegeId, spreadsheetId);
  const cleanStudentId = data.studentId.trim().toUpperCase();
  const cleanEmail = data.email.trim().toLowerCase();

  // Check duplicate event registration (where programId is empty)
  const existingEventReg = existingRows.find(
    r =>
      r.programId === '' &&
      (r.studentId.toUpperCase() === cleanStudentId || r.email.toLowerCase() === cleanEmail) &&
      r.registrationStatus !== 'CANCELLED'
  );

  if (existingEventReg) {
    throw new Error('You are already registered for this event. Your Registration Number is: ' + existingEventReg.registrationNumber);
  }

  // Generate collision-safe event registration number
  const existingNumbers = new Set(existingRows.map(r => r.registrationNumber.toUpperCase()));
  const registrationNumber = generateEventRegNumber(eventSlug, existingNumbers);

  const rowValues = [
    registrationNumber,                    // Registration Number
    data.eventId,                          // Event ID
    '',                                    // Program ID
    '',                                    // Program Name
    'INDIVIDUAL',                          // Participation Type
    '',                                    // Team ID
    '',                                    // Team Name
    'PARTICIPANT',                         // Participant Role
    data.fullName.trim(),                  // Participant Name
    cleanStudentId,                        // Registration Number / Student ID
    cleanEmail,                            // Email
    data.mobile.trim(),                    // Mobile
    data.branch?.trim() || '',             // Branch
    data.semester?.trim() || '',           // Semester
    data.gender?.trim() || '',             // Gender
    data.paymentRequired ? 'YES' : 'NO',                    // Payment Required
    String(data.paymentAmount || 0),                        // Payment Amount
    data.paymentStatus || (data.paymentRequired ? 'PENDING' : 'NOT_REQUIRED'), // Payment Status
    data.paymentReference || '',                            // Payment Reference
    'REGISTERED',                          // Registration Status
    new Date().toISOString(),              // Registered At
    '',                                    // Team Leader Registration Number
  ];

  await executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${MASTER_SHEET_NAME}'!A:V`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [rowValues] },
    });
  });

  return { registrationNumber };
}

/**
 * Append individual program registration.
 * Student must already be event-registered.
 * Writes to both EVENT_REGISTRATIONS and PROGRAM_<slug>.
 */
export async function appendProgramRegistration(
  collegeId: string,
  spreadsheetId: string,
  programSlug: string,
  data: ProgramRegistrationInputData & { eventSlug: string }
): Promise<{ registrationNumber: string }> {
  await assertCollegeGoogleConnected(collegeId);
  const tabName = await ensureProgramSheet(collegeId, spreadsheetId, programSlug, data.programName);

  // 1. Check duplicate for this program
  const isDuplicate = await checkDuplicateProgramRegistration(
    collegeId,
    spreadsheetId,
    data.programId,
    data.studentId,
    data.email
  );
  if (isDuplicate) {
    throw new Error('You are already registered for this program.');
  }

  // 2. Generate program registration number
  const existingRows = await getEventRegistrations(collegeId, spreadsheetId);
  const existingNumbers = new Set(existingRows.map(r => r.registrationNumber.toUpperCase()));
  const progRegNumber = generateProgramRegNumber(data.eventSlug, programSlug, existingNumbers);

  const cleanStudentId = data.studentId.trim().toUpperCase();
  const cleanEmail = data.email.trim().toLowerCase();
  const cleanName = data.fullName.trim();
  const registeredAt = new Date().toISOString();
  const paymentStatus = data.paymentStatus || (data.paymentRequired ? 'PENDING' : 'NOT_REQUIRED');
  const regStatus = data.paymentRequired && paymentStatus === 'PENDING' ? 'PENDING_PAYMENT' : 'CONFIRMED';

  // 3. Write to EVENT_REGISTRATIONS (Master Sheet - 22 columns)
  const masterRow = [
    progRegNumber,                               // Registration Number
    data.eventId,                                // Event ID
    data.programId,                              // Program ID
    data.programName,                            // Program Name
    data.participationType,                      // Participation Type
    data.teamId || '',                           // Team ID
    data.teamName || '',                         // Team Name
    data.participantRole || 'INDIVIDUAL',        // Participant Role
    cleanName,                                   // Participant Name
    cleanStudentId,                              // Registration Number / Student ID
    cleanEmail,                                  // Email
    data.mobile.trim(),                          // Mobile
    data.branch?.trim() || '',                   // Branch
    data.semester?.trim() || '',                 // Semester
    data.gender?.trim() || '',                   // Gender
    data.paymentRequired ? 'YES' : 'NO',         // Payment Required
    String(data.paymentAmount || 0),             // Payment Amount
    paymentStatus,                               // Payment Status
    data.paymentReference || '',                 // Payment Reference
    regStatus,                                   // Registration Status
    registeredAt,                                // Registered At
    data.leaderEventRegNumber || '',             // Team Leader Registration Number
  ];

  // 4. Write to PROGRAM_<slug> (14 columns)
  const programRow = [
    progRegNumber,                               // Registration Number
    data.teamId || '',                           // Team ID
    data.teamName || '',                         // Team Name
    data.participationType,                      // Participation Type
    data.participantRole || 'INDIVIDUAL',        // Participant Role
    cleanName,                                   // Student Name
    cleanStudentId,                              // Student ID
    cleanEmail,                                  // Email
    data.mobile.trim(),                          // Mobile
    data.branch?.trim() || '',                   // Branch
    data.semester?.trim() || '',                 // Semester
    String(data.paymentAmount || 0),             // Payment Amount
    paymentStatus,                               // Payment Status
    registeredAt,                                // Registered At
  ];

  await executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
    // Append to Master
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${MASTER_SHEET_NAME}'!A:V`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [masterRow] },
    });

    // Append to Program tab
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${tabName}'!A:N`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [programRow] },
    });
  });

  return { registrationNumber: progRegNumber };
}

// ============================================================
// 4. TEAMS & TEAM MEMBERS
// ============================================================

/**
 * Create a team with collision-safe Team ID.
 */
export async function createTeam(
  collegeId: string,
  spreadsheetId: string,
  programSlug: string,
  _teamData?: { programId?: string; programName?: string; teamName?: string; leaderEventRegNumber?: string }
): Promise<{ teamId: string }> {
  await assertCollegeGoogleConnected(collegeId);

  const existingRows = await getEventRegistrations(collegeId, spreadsheetId);
  const existingTeamIds = new Set(
    existingRows.map(r => r.teamId.toUpperCase()).filter(Boolean)
  );

  const teamId = generateTeamId(programSlug, existingTeamIds);
  return { teamId };
}

/**
 * Add a team member (or leader) to a program.
 * Auto-registers member for event in EVENT_REGISTRATIONS if not yet registered.
 * Writes to both EVENT_REGISTRATIONS and PROGRAM_<slug>.
 */
export async function addTeamMember(
  collegeId: string,
  spreadsheetId: string,
  programSlug: string,
  memberData: {
    eventId: string;
    eventSlug: string;
    programId: string;
    programName: string;
    teamId: string;
    teamName: string;
    member: {
      fullName: string;
      studentId: string;
      email: string;
      mobile: string;
      branch?: string;
      semester?: string;
      gender?: string;
      role: 'TEAM LEADER' | 'TEAM MEMBER';
      eventRegNumber?: string;
    };
    paymentRequired: boolean;
    paymentAmount: number;
    paymentStatus?: string;
    paymentReference?: string;
    leaderEventRegNumber: string;
  }
): Promise<{ programRegNumber: string; eventRegNumber: string }> {
  await assertCollegeGoogleConnected(collegeId);
  const tabName = await ensureProgramSheet(collegeId, spreadsheetId, programSlug, memberData.programName);

  const cleanStudentId = memberData.member.studentId.trim().toUpperCase();
  const cleanEmail = memberData.member.email.trim().toLowerCase();
  const cleanName = memberData.member.fullName.trim();
  const providedRegNum = memberData.member.eventRegNumber?.trim().toUpperCase();

  // 1. Check if member is already registered for this event
  const existingRows = await getEventRegistrations(collegeId, spreadsheetId);
  let eventRegNumber = '';

  let existingEventReg: MasterRegistrationRow | undefined;
  if (providedRegNum) {
    existingEventReg = existingRows.find(
      r =>
        r.registrationNumber.toUpperCase() === providedRegNum &&
        (!r.eventId || r.eventId === memberData.eventId) &&
        r.registrationStatus !== 'CANCELLED'
    );
  }

  if (!existingEventReg) {
    existingEventReg = existingRows.find(
      r =>
        r.programId === '' &&
        ((cleanStudentId && r.studentId.toUpperCase() === cleanStudentId) ||
          (cleanEmail && r.email.toLowerCase() === cleanEmail)) &&
        r.registrationStatus !== 'CANCELLED'
    );
  }

  let finalName = cleanName;
  let finalStudentId = cleanStudentId;
  let finalEmail = cleanEmail;
  let finalMobile = memberData.member.mobile.trim();
  let finalBranch = memberData.member.branch?.trim() || '';
  let finalSemester = memberData.member.semester?.trim() || '';
  let finalGender = memberData.member.gender?.trim() || '';

  if (existingEventReg) {
    eventRegNumber = existingEventReg.registrationNumber;
    // Prefer verified data from existing registration if available
    finalName = existingEventReg.participantName || finalName;
    finalStudentId = existingEventReg.studentId || finalStudentId;
    finalEmail = existingEventReg.email || finalEmail;
    finalMobile = existingEventReg.mobile || finalMobile;
    finalBranch = existingEventReg.branch || finalBranch;
    finalSemester = existingEventReg.semester || finalSemester;
    finalGender = existingEventReg.gender || finalGender;
  } else {
    // Member does not have event registration -> AUTO REGISTER for event
    const existingNumbers = new Set(existingRows.map(r => r.registrationNumber.toUpperCase()));
    eventRegNumber = generateEventRegNumber(memberData.eventSlug, existingNumbers);

    const autoEventRow = [
      eventRegNumber,
      memberData.eventId,
      '',                                // Program ID
      '',                                // Program Name
      'INDIVIDUAL',
      '',
      '',
      'PARTICIPANT',
      finalName,
      finalStudentId,
      finalEmail,
      finalMobile,
      finalBranch,
      finalSemester,
      finalGender,
      'NO',
      '0',
      'NOT_REQUIRED',
      '',
      'REGISTERED',
      new Date().toISOString(),
      '',
    ];

    await executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${MASTER_SHEET_NAME}'!A:V`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [autoEventRow] },
      });
    });

    // Add to existing set for subsequent collision check
    existingNumbers.add(eventRegNumber.toUpperCase());
  }

  // 2. Generate program registration number for this member
  const currentRows = await getEventRegistrations(collegeId, spreadsheetId);
  const currentNumbers = new Set(currentRows.map(r => r.registrationNumber.toUpperCase()));
  const programRegNumber = generateProgramRegNumber(memberData.eventSlug, programSlug, currentNumbers);

  const registeredAt = new Date().toISOString();
  const paymentStatus = memberData.paymentStatus || (memberData.paymentRequired ? 'PENDING' : 'NOT_REQUIRED');
  const regStatus = memberData.paymentRequired && paymentStatus === 'PENDING' ? 'PENDING_PAYMENT' : 'CONFIRMED';

  // 3. Write program record to EVENT_REGISTRATIONS (Master - 22 columns)
  const masterRow = [
    programRegNumber,
    memberData.eventId,
    memberData.programId,
    memberData.programName,
    'TEAM',
    memberData.teamId,
    memberData.teamName.trim(),
    memberData.member.role,
    finalName,
    finalStudentId,
    finalEmail,
    finalMobile,
    finalBranch,
    finalSemester,
    finalGender,
    memberData.paymentRequired ? 'YES' : 'NO',
    String(memberData.paymentAmount || 0),
    paymentStatus,
    memberData.paymentReference || '',
    regStatus,
    registeredAt,
    memberData.leaderEventRegNumber || eventRegNumber,
  ];

  // 4. Write to PROGRAM_<slug> (14 columns)
  const programRow = [
    programRegNumber,
    memberData.teamId,
    memberData.teamName.trim(),
    'TEAM',
    memberData.member.role,
    finalName,
    finalStudentId,
    finalEmail,
    finalMobile,
    finalBranch,
    finalSemester,
    String(memberData.paymentAmount || 0),
    paymentStatus,
    registeredAt,
  ];

  // One Sheets batchUpdate keeps the authoritative master row and program row in sync:
  // Google applies all requests in a batch atomically or applies none of them.
  await executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties(sheetId,title)',
    });
    const masterSheetId = metadata.data.sheets?.find(sheet => sheet.properties?.title === MASTER_SHEET_NAME)?.properties?.sheetId;
    const programSheetId = metadata.data.sheets?.find(sheet => sheet.properties?.title === tabName)?.properties?.sheetId;
    if (masterSheetId === undefined || programSheetId === undefined) {
      throw new Error('Event or program registration sheet is unavailable.');
    }
    const makeRow = (values: string[]) => ({
      values: values.map(value => ({ userEnteredValue: { stringValue: String(value) } })),
    });
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          { appendCells: { sheetId: masterSheetId, rows: [makeRow(masterRow)], fields: 'userEnteredValue' } },
          { appendCells: { sheetId: programSheetId, rows: [makeRow(programRow)], fields: 'userEnteredValue' } },
        ],
      },
    });
  });

  return { programRegNumber, eventRegNumber };
}

/**
 * Get all members of a team.
 */
export async function getTeamMembers(
  collegeId: string,
  spreadsheetId: string,
  teamId: string,
  programSlug?: string
): Promise<ProgramSheetRow[]> {
  if (programSlug) {
    const progRows = await getProgramRegistrations(collegeId, spreadsheetId, programSlug);
    return progRows.filter(r => r.teamId.toUpperCase() === teamId.trim().toUpperCase());
  }

  const all = await getEventRegistrations(collegeId, spreadsheetId);
  const matching = all.filter(r => r.teamId.toUpperCase() === teamId.trim().toUpperCase() && r.registrationStatus !== 'CANCELLED');
  return matching.map(r => ({
    registrationNumber: r.registrationNumber,
    teamId: r.teamId,
    teamName: r.teamName,
    participationType: r.participationType,
    participantRole: r.participantRole,
    studentName: r.participantName,
    studentId: r.studentId,
    email: r.email,
    mobile: r.mobile,
    branch: r.branch,
    semester: r.semester,
    paymentAmount: r.paymentAmount,
    paymentStatus: r.paymentStatus,
    registeredAt: r.registeredAt,
  }));
}

/**
 * Update team name across all members of a team in EVENT_REGISTRATIONS and PROGRAM tab.
 */
export async function updateTeamNameInSheets(
  collegeId: string,
  spreadsheetId: string,
  programSlug: string,
  teamId: string,
  newTeamName: string
): Promise<boolean> {
  await assertCollegeGoogleConnected(collegeId);
  const cleanTeamId = teamId.trim().toUpperCase();
  const cleanNewName = newTeamName.trim();
  if (!cleanNewName) return false;

  // 1. Update master sheet EVENT_REGISTRATIONS
  const all = await getEventRegistrations(collegeId, spreadsheetId);
  const targetRows = all.filter(
    r => r.teamId.toUpperCase() === cleanTeamId && r.registrationStatus !== 'CANCELLED'
  );
  if (targetRows.length === 0) return false;

  await executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
    const dataUpdates = targetRows.map(r => ({
      range: `'${MASTER_SHEET_NAME}'!G${r.rowIndex}`,
      values: [[cleanNewName]],
    }));

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: dataUpdates,
      },
    });
  });

  // 2. Update PROGRAM_<slug> tab if exists
  try {
    const tabName = getProgramTabName(programSlug);
    const progRows = await getProgramRegistrations(collegeId, spreadsheetId, programSlug);
    const targetProgRows = progRows.filter(r => r.teamId.toUpperCase() === cleanTeamId);
    if (targetProgRows.length > 0) {
      await executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
        const progUpdates = targetProgRows.map(r => ({
          range: `'${tabName}'!C${r.rowIndex}`,
          values: [[cleanNewName]],
        }));
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            valueInputOption: 'USER_ENTERED',
            data: progUpdates,
          },
        });
      });
    }
  } catch (err) {
    console.warn('[EventRegSheets] Update team name in program tab notice:', err);
  }

  return true;
}

/**
 * Update a team member's personal and contact details in both EVENT_REGISTRATIONS and PROGRAM tab.
 */
export async function updateTeamMemberDetailsInSheet(
  collegeId: string,
  spreadsheetId: string,
  programSlug: string,
  registrationNumber: string,
  details: {
    fullName: string;
    studentId: string;
    email: string;
    mobile: string;
    branch?: string;
    semester?: string;
    gender?: string;
  }
): Promise<boolean> {
  await assertCollegeGoogleConnected(collegeId);
  const cleanReg = registrationNumber.trim().toUpperCase();
  const all = await getEventRegistrations(collegeId, spreadsheetId);
  const target = all.find(r => r.registrationNumber.toUpperCase() === cleanReg);
  if (!target || !target.rowIndex) return false;

  const cleanName = details.fullName.trim();
  const cleanStudentId = details.studentId.trim().toUpperCase();
  const cleanEmail = details.email.trim().toLowerCase();
  const cleanMobile = details.mobile.trim();
  const cleanBranch = details.branch?.trim() || '';
  const cleanSemester = details.semester?.trim() || '';
  const cleanGender = details.gender?.trim() || '';

  // Master sheet columns I to O:
  // I: Participant Name, J: Student ID, K: Email, L: Mobile, M: Branch, N: Semester, O: Gender
  await executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${MASTER_SHEET_NAME}'!I${target.rowIndex}:O${target.rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[cleanName, cleanStudentId, cleanEmail, cleanMobile, cleanBranch, cleanSemester, cleanGender]],
      },
    });
  });

  // PROGRAM_<slug> tab columns F to K:
  // F: Student Name, G: Student ID, H: Email, I: Mobile, J: Branch, K: Semester
  try {
    const tabName = getProgramTabName(programSlug);
    const progRows = await getProgramRegistrations(collegeId, spreadsheetId, programSlug);
    const targetProg = progRows.find(r => r.registrationNumber.toUpperCase() === cleanReg);
    if (targetProg && targetProg.rowIndex) {
      await executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${tabName}'!F${targetProg.rowIndex}:K${targetProg.rowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[cleanName, cleanStudentId, cleanEmail, cleanMobile, cleanBranch, cleanSemester]],
          },
        });
      });
    }
  } catch (err) {
    console.warn('[EventRegSheets] Update member in program tab notice:', err);
  }

  return true;
}

/**
 * Update a student's personal details (Name, Roll, Branch, Semester, Mobile) in EVENT_REGISTRATIONS
 * and any enrolled program sheets where their registration number appears.
 */
export async function updateStudentEventRegistrationInSheet(
  collegeId: string,
  spreadsheetId: string,
  registrationNumber: string,
  details: {
    fullName: string;
    studentId: string;
    email?: string;
    mobile?: string;
    branch?: string;
    semester?: string;
    gender?: string;
  }
): Promise<boolean> {
  await assertCollegeGoogleConnected(collegeId);
  const cleanReg = registrationNumber.trim().toUpperCase();
  const all = await getEventRegistrations(collegeId, spreadsheetId);
  const matchingRows = all.filter(r => r.registrationNumber.toUpperCase() === cleanReg);
  if (matchingRows.length === 0) return false;

  const cleanName = details.fullName.trim();
  const cleanStudentId = details.studentId.trim().toUpperCase();
  const cleanMobile = details.mobile?.trim() || '';
  const cleanBranch = details.branch?.trim() || '';
  const cleanSemester = details.semester?.trim() || '';
  const cleanGender = details.gender?.trim() || '';

  // Update in MASTER_SHEET_NAME for all rows matching this registration number
  await executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
    for (const target of matchingRows) {
      if (!target.rowIndex) continue;
      const keepEmail = (details.email?.trim() || target.email || '').toLowerCase();
      const keepGender = cleanGender || target.gender || '';
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${MASTER_SHEET_NAME}'!I${target.rowIndex}:O${target.rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[cleanName, cleanStudentId, keepEmail, cleanMobile, cleanBranch, cleanSemester, keepGender]],
        },
      });
    }
  });

  return true;
}


/**
 * Remove a team member by cancelling in EVENT_REGISTRATIONS and deleting the row in PROGRAM tab.
 */
export async function removeTeamMemberFromSheet(
  collegeId: string,
  spreadsheetId: string,
  programSlug: string,
  registrationNumber: string
): Promise<boolean> {
  await assertCollegeGoogleConnected(collegeId);
  const cleanReg = registrationNumber.trim().toUpperCase();

  // 1. Mark CANCELLED in EVENT_REGISTRATIONS master tab
  const all = await getEventRegistrations(collegeId, spreadsheetId);
  const target = all.find(r => r.registrationNumber.toUpperCase() === cleanReg);
  if (!target || !target.rowIndex) return false;

  await executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
    // Col T is Registration Status
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${MASTER_SHEET_NAME}'!T${target.rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['CANCELLED']] },
    });
  });

  // 2. Delete row in PROGRAM_<slug> tab if exists
  try {
    const tabName = getProgramTabName(programSlug);
    const progRows = await getProgramRegistrations(collegeId, spreadsheetId, programSlug);
    const targetProg = progRows.find(r => r.registrationNumber.toUpperCase() === cleanReg);
    if (targetProg && typeof targetProg.rowIndex === 'number') {
      const progRowIndex = targetProg.rowIndex;
      await executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
        const meta = await sheets.spreadsheets.get({
          spreadsheetId,
          fields: 'sheets.properties',
        });
        const sheetObj = (meta.data.sheets || []).find(s => s.properties?.title === tabName);
        if (sheetObj?.properties?.sheetId !== undefined) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [
                {
                  deleteDimension: {
                    range: {
                      sheetId: sheetObj.properties.sheetId,
                      dimension: 'ROWS',
                      startIndex: progRowIndex - 1,
                      endIndex: progRowIndex,
                    },
                  },
                },
              ],
            },
          });
        }
      });
    }
  } catch (err) {
    console.warn('[EventRegSheets] Delete member in program tab notice:', err);
  }

  return true;
}

// ============================================================
// 5. UPDATE OPERATIONS
// ============================================================

/**
 * Update registration row in EVENT_REGISTRATIONS (and PROGRAM tab if applicable).
 */
export async function updateRegistration(
  collegeId: string,
  spreadsheetId: string,
  registrationNumber: string,
  updates: Partial<MasterRegistrationRow>
): Promise<boolean> {
  await assertCollegeGoogleConnected(collegeId);
  const all = await getEventRegistrations(collegeId, spreadsheetId);
  const target = all.find(
    r => r.registrationNumber.toUpperCase() === registrationNumber.trim().toUpperCase()
  );

  if (!target || !target.rowIndex) return false;

  const rowIndex = target.rowIndex;

  await executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
    if (updates.paymentRequired !== undefined) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${MASTER_SHEET_NAME}'!P${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[updates.paymentRequired]] },
      });
    }

    if (updates.paymentAmount !== undefined) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${MASTER_SHEET_NAME}'!Q${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[String(updates.paymentAmount)]] },
      });
    }

    // If updating payment status or reference
    if (updates.paymentStatus !== undefined) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${MASTER_SHEET_NAME}'!R${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[updates.paymentStatus]] },
      });
    }

    if (updates.paymentReference !== undefined) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${MASTER_SHEET_NAME}'!S${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[updates.paymentReference]] },
      });
    }

    if (updates.registrationStatus !== undefined) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${MASTER_SHEET_NAME}'!T${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[updates.registrationStatus]] },
      });
    }
  });

  return true;
}

/**
 * Update payment status for a registration.
 * Updates both EVENT_REGISTRATIONS and the specific PROGRAM tab.
 */
export async function updatePaymentStatus(
  collegeId: string,
  spreadsheetId: string,
  registrationNumber: string,
  paymentStatus: string,
  paymentReference?: string,
  programSlug?: string
): Promise<boolean> {
  const updated = await updateRegistration(collegeId, spreadsheetId, registrationNumber, {
    paymentStatus,
    paymentReference: paymentReference || undefined,
    registrationStatus: paymentStatus === 'VERIFIED' || paymentStatus === 'PAID' ? 'CONFIRMED' : undefined,
  });

  if (!updated) return false;

  // Also update in program sheet if programSlug is provided or can be discovered
  if (programSlug) {
    try {
      const tabName = getProgramTabName(programSlug);
      const progRows = await getProgramRegistrations(collegeId, spreadsheetId, programSlug);
      const targetProg = progRows.find(
        r => r.registrationNumber.toUpperCase() === registrationNumber.trim().toUpperCase()
      );

      if (targetProg && targetProg.rowIndex) {
        await executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${tabName}'!M${targetProg.rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[paymentStatus]] },
          });
        });
      }
    } catch (err) {
      console.warn('[EventRegSheets] Program tab payment update notice:', err);
    }
  }

  return true;
}

// ============================================================
// 6. STATISTICS COMPUTATION (From real Google Sheet data)
// ============================================================

/**
 * Compute event-wide statistics directly from EVENT_REGISTRATIONS.
 * NO fake or static numbers.
 */
export async function getEventStats(
  collegeId: string,
  spreadsheetId: string
): Promise<EventStats> {
  await assertCollegeGoogleConnected(collegeId);
  const rows = await getEventRegistrations(collegeId, spreadsheetId);

  // 1. Total base event registrations (where Program ID is empty)
  const eventRows = rows.filter(r => r.programId === '' && r.registrationStatus !== 'CANCELLED');
  const totalEventRegistrations = eventRows.length;

  // 2. Program registrations (where Program ID is non-empty)
  const progRows = rows.filter(r => r.programId !== '' && r.registrationStatus !== 'CANCELLED');
  const totalProgramRegistrations = progRows.length;

  // 3. Distinct programs
  const distinctPrograms = new Set(progRows.map(r => r.programId));
  const totalPrograms = distinctPrograms.size;

  // 4. Individual participants vs Teams
  const individualParticipants = progRows.filter(r => r.participationType === 'INDIVIDUAL').length;
  const distinctTeams = new Set(progRows.map(r => r.teamId).filter(Boolean));
  const teams = distinctTeams.size;

  // 5. Payment stats
  const paidRegistrations = progRows.filter(
    r => r.paymentStatus === 'PAID' || r.paymentStatus === 'VERIFIED'
  ).length;

  const pendingPayments = progRows.filter(
    r => r.paymentStatus === 'PENDING' || r.paymentStatus === 'SUBMITTED'
  ).length;

  const confirmedRegistrations = progRows.filter(
    r => r.registrationStatus === 'CONFIRMED' || r.registrationStatus === 'REGISTERED'
  ).length;

  const totalRevenue = progRows
    .filter(r => r.paymentStatus === 'PAID' || r.paymentStatus === 'VERIFIED')
    .reduce((sum, r) => sum + (r.paymentAmount || 0), 0);

  // 6. Program Cards summary
  const programMap: Record<string, { programName: string; teams: Set<string>; participants: number; revenue: number }> = {};
  for (const r of progRows) {
    if (!programMap[r.programId]) {
      programMap[r.programId] = {
        programName: r.programName || 'Program',
        teams: new Set(),
        participants: 0,
        revenue: 0,
      };
    }
    programMap[r.programId].participants += 1;
    if (r.teamId) programMap[r.programId].teams.add(r.teamId);
    if (r.paymentStatus === 'PAID' || r.paymentStatus === 'VERIFIED') {
      programMap[r.programId].revenue += r.paymentAmount || 0;
    }
  }

  const programCards = Object.entries(programMap).map(([progId, data]) => ({
    programId: progId,
    programName: data.programName,
    teams: data.teams.size,
    participants: data.participants,
    revenue: data.revenue,
  }));

  return {
    totalEventRegistrations,
    totalPrograms,
    totalProgramRegistrations,
    individualParticipants,
    teams,
    paidRegistrations,
    pendingPayments,
    confirmedRegistrations,
    totalRevenue,
    programCards,
  };
}

/**
 * Compute program-specific statistics directly from PROGRAM_<slug>.
 */
export async function getProgramStats(
  collegeId: string,
  spreadsheetId: string,
  programSlug: string
): Promise<SheetProgramStats> {
  await assertCollegeGoogleConnected(collegeId);
  const rows = await getProgramRegistrations(collegeId, spreadsheetId, programSlug);

  const totalRegistrations = rows.length;
  const totalParticipants = rows.length;
  const distinctTeams = new Set(rows.map(r => r.teamId).filter(Boolean));
  const totalTeams = distinctTeams.size;
  const totalIndividual = rows.filter(r => r.participationType === 'INDIVIDUAL').length;

  const paymentPending = rows.filter(
    r => r.paymentStatus === 'PENDING' || r.paymentStatus === 'SUBMITTED'
  ).length;

  const paymentVerified = rows.filter(
    r => r.paymentStatus === 'VERIFIED' || r.paymentStatus === 'PAID'
  ).length;

  const paymentRejected = rows.filter(r => r.paymentStatus === 'REJECTED').length;
  const paymentSubmitted = rows.filter(r => r.paymentStatus === 'SUBMITTED').length;

  const totalRevenue = rows
    .filter(r => r.paymentStatus === 'VERIFIED' || r.paymentStatus === 'PAID')
    .reduce((sum, r) => sum + (r.paymentAmount || 0), 0);

  return {
    totalRegistrations,
    totalParticipants,
    totalTeams,
    totalIndividual,
    paymentPending,
    paymentVerified,
    paymentRejected,
    paymentSubmitted,
    totalRevenue,
  };
}

// ============================================================
// TEAM JOIN REQUESTS (Stored in event spreadsheet)
// ============================================================

export const TEAM_JOIN_REQUESTS_SHEET = 'TEAM_JOIN_REQUESTS';

export const TEAM_JOIN_REQUEST_HEADERS = [
  'Request ID',                   // Col A (0)
  'Event ID',                     // Col B (1)
  'Program ID',                   // Col C (2)
  'Program Name',                 // Col D (3)
  'Team ID',                      // Col E (4)
  'Team Name',                    // Col F (5)
  'Requester Reg Number',         // Col G (6)
  'Requester Name',               // Col H (7)
  'Requester Student ID',         // Col I (8)
  'Requester Email',              // Col J (9)
  'Requester Branch',             // Col K (10)
  'Requester Semester',           // Col L (11)
  'Requester Mobile',             // Col M (12)
  'Status',                       // Col N (13) - PENDING | APPROVED | REJECTED | CANCELLED
  'Created At',                   // Col O (14) - ISO string
  'Responded At',                 // Col P (15) - ISO string
  'Responded By',                 // Col Q (16) - Leader Reg Number
];

export interface TeamJoinRequestRow {
  requestId: string;
  eventId: string;
  programId: string;
  programName: string;
  teamId: string;
  teamName: string;
  requesterRegistrationNumber: string;
  requesterName: string;
  requesterStudentId: string;
  requesterEmail: string;
  requesterBranch: string;
  requesterSemester: string;
  requesterMobile: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  createdAt: string;
  respondedAt?: string;
  respondedBy?: string;
  rowIndex?: number;
}

/**
 * Ensure TEAM_JOIN_REQUESTS sheet exists in the spreadsheet.
 */
export async function ensureTeamJoinRequestsSheet(
  collegeId: string,
  spreadsheetId: string
): Promise<void> {
  await executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title',
    });

    const hasSheet = (meta.data.sheets || []).some(
      s => s.properties?.title === TEAM_JOIN_REQUESTS_SHEET
    );

    if (!hasSheet) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: TEAM_JOIN_REQUESTS_SHEET,
                  gridProperties: { frozenRowCount: 1 },
                },
              },
            },
          ],
        },
      });

      const lastCol = getColumnLetter(TEAM_JOIN_REQUEST_HEADERS.length);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${TEAM_JOIN_REQUESTS_SHEET}'!A1:${lastCol}1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [TEAM_JOIN_REQUEST_HEADERS] },
      });
    }
  });
}

/**
 * Get all join requests from the spreadsheet.
 */
export async function getTeamJoinRequestsFromSheet(
  collegeId: string,
  spreadsheetId: string,
  eventId?: string
): Promise<TeamJoinRequestRow[]> {
  await assertCollegeGoogleConnected(collegeId);
  return executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${TEAM_JOIN_REQUESTS_SHEET}'!A2:Q`,
      });

      const rows = res.data.values || [];
      const result: TeamJoinRequestRow[] = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[0]) continue;
        const reqEventId = r[1] || '';
        if (eventId && reqEventId && reqEventId !== eventId) continue;

        result.push({
          requestId: String(r[0] || '').trim(),
          eventId: reqEventId,
          programId: String(r[2] || '').trim(),
          programName: String(r[3] || '').trim(),
          teamId: String(r[4] || '').trim(),
          teamName: String(r[5] || '').trim(),
          requesterRegistrationNumber: String(r[6] || '').trim().toUpperCase(),
          requesterName: String(r[7] || '').trim(),
          requesterStudentId: String(r[8] || '').trim(),
          requesterEmail: String(r[9] || '').trim(),
          requesterBranch: String(r[10] || '').trim(),
          requesterSemester: String(r[11] || '').trim(),
          requesterMobile: String(r[12] || '').trim(),
          status: (String(r[13] || '').trim().toUpperCase() as TeamJoinRequestRow['status']) || 'PENDING',
          createdAt: String(r[14] || '').trim(),
          respondedAt: r[15] ? String(r[15]).trim() : undefined,
          respondedBy: r[16] ? String(r[16]).trim() : undefined,
          rowIndex: i + 2,
        });
      }

      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Unable to parse range') || msg.includes('not found')) {
        return [];
      }
      throw err;
    }
  });
}

/**
 * Create a new join request row in Google Sheets.
 */
export async function createTeamJoinRequestInSheet(
  collegeId: string,
  spreadsheetId: string,
  data: {
    eventId: string;
    programId: string;
    programName: string;
    teamId: string;
    teamName: string;
    requesterRegistrationNumber: string;
    requesterName: string;
    requesterStudentId?: string;
    requesterEmail?: string;
    requesterBranch?: string;
    requesterSemester?: string;
    requesterMobile?: string;
  }
): Promise<string> {
  await assertCollegeGoogleConnected(collegeId);
  await ensureTeamJoinRequestsSheet(collegeId, spreadsheetId);

  const cleanReg = data.requesterRegistrationNumber.trim().toUpperCase();
  const all = await getTeamJoinRequestsFromSheet(collegeId, spreadsheetId, data.eventId);

  // Check for duplicate pending request for this program
  const duplicate = all.find(
    r =>
      r.programId === data.programId &&
      r.requesterRegistrationNumber.toUpperCase() === cleanReg &&
      r.status === 'PENDING'
  );
  if (duplicate) {
    throw new Error('You already have a pending join request for this program.');
  }

  const requestId = 'REQ-' + crypto.randomUUID().slice(0, 8).toUpperCase();
  const now = new Date().toISOString();

  const newRow = [
    requestId,
    data.eventId,
    data.programId,
    data.programName || '',
    data.teamId,
    data.teamName || '',
    cleanReg,
    data.requesterName.trim(),
    data.requesterStudentId?.trim() || '',
    data.requesterEmail?.trim() || '',
    data.requesterBranch?.trim() || '',
    data.requesterSemester?.trim() || '',
    data.requesterMobile?.trim() || '',
    'PENDING',
    now,
    '',
    '',
  ];

  await executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${TEAM_JOIN_REQUESTS_SHEET}'!A:Q`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [newRow] },
    });
  });

  return requestId;
}

/**
 * Update join request status (APPROVED | REJECTED | CANCELLED).
 */
export async function updateTeamJoinRequestStatusInSheet(
  collegeId: string,
  spreadsheetId: string,
  requestId: string,
  status: 'APPROVED' | 'REJECTED' | 'CANCELLED',
  respondedBy?: string
): Promise<boolean> {
  await assertCollegeGoogleConnected(collegeId);
  const cleanId = requestId.trim().toUpperCase();
  const all = await getTeamJoinRequestsFromSheet(collegeId, spreadsheetId);

  const target = all.find(r => r.requestId.toUpperCase() === cleanId);
  if (!target || !target.rowIndex) return false;

  const now = new Date().toISOString();
  await executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${TEAM_JOIN_REQUESTS_SHEET}'!N${target.rowIndex}:Q${target.rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[status, target.createdAt, now, respondedBy || '']],
      },
    });
  });

  // If approved, cancel any other pending requests from this student for this program
  if (status === 'APPROVED') {
    const otherPending = all.filter(
      r =>
        r.requestId.toUpperCase() !== cleanId &&
        r.programId === target.programId &&
        r.requesterRegistrationNumber.toUpperCase() === target.requesterRegistrationNumber.toUpperCase() &&
        r.status === 'PENDING' &&
        r.rowIndex
    );

    for (const other of otherPending) {
      if (!other.rowIndex) continue;
      try {
        await executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${TEAM_JOIN_REQUESTS_SHEET}'!N${other.rowIndex}:Q${other.rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [['CANCELLED', other.createdAt, now, 'AUTO_CANCELLED']],
            },
          });
        });
      } catch (cancelErr) {
        console.warn('[EventRegSheets] Cancel duplicate request notice:', cancelErr);
      }
    }
  }

  return true;
}
