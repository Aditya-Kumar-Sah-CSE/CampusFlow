import {
  getCollegeGoogleServices,
  isGoogleOAuthError,
  markCollegeGoogleConnectionInvalid,
} from '@/lib/google/auth';

export interface RawSheetData {
  headers: string[];
  rows: string[][];
  totalRowCount: number;
  error?: string;
  isAuthError?: boolean;
}

/**
 * Fetches raw response rows from a connected Google Sheet
 * Reads from 'Form Responses' sheet (or the first sheet in the spreadsheet)
 * using the institutional credentials of the college owning the form.
 */
export async function fetchRawSheetResponses(
  spreadsheetId: string,
  collegeId?: string
): Promise<RawSheetData> {
  if (!spreadsheetId || !collegeId) {
    return { headers: [], rows: [], totalRowCount: 0 };
  }

  try {
    const { sheets } = await getCollegeGoogleServices(collegeId);

    // 1. First get spreadsheet metadata to know the exact sheet name
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const allSheets = meta.data.sheets || [];
    let selectedSheet = allSheets[0];
    const candidateSheets = allSheets.filter(s =>
      /form[\s_-]*responses?|responses?/i.test(s.properties?.title || '')
    );
    if (candidateSheets.length > 0) {
      const withData = candidateSheets.find(s => (s.properties?.gridProperties?.rowCount || 0) > 1);
      selectedSheet = withData || candidateSheets[0];
    }
    let sheetTitle = selectedSheet?.properties?.title || 'Form Responses';

    // 2. Fetch all rows across all columns (A1:ZZ)
    let res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetTitle}'!A1:ZZ`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    let allValues = (res.data.values || []) as (string | number)[][];

    // If selected sheet was empty (<=1 rows) and other sheets exist, try them
    if (allValues.length <= 1 && allSheets.length > 1) {
      for (const otherSheet of allSheets) {
        const otherTitle = otherSheet.properties?.title;
        if (!otherTitle || otherTitle === sheetTitle) continue;
        try {
          const otherRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `'${otherTitle}'!A1:ZZ`,
            valueRenderOption: 'UNFORMATTED_VALUE',
          });
          const otherValues = (otherRes.data.values || []) as (string | number)[][];
          if (otherValues.length > allValues.length) {
            allValues = otherValues;
            sheetTitle = otherTitle;
            break;
          }
        } catch {
          // Ignore range error on other sheet
        }
      }
    }

    if (allValues.length === 0) {
      return { headers: [], rows: [], totalRowCount: 0 };
    }

    const headers = allValues[0].map(h => String(h || '').trim());
    const rawRows = allValues.slice(1);

    // Convert all row cells to clean strings
    const rows = rawRows.map(row => row.map(cell => String(cell || '').trim()));

    // Filter out rows that are completely empty
    const cleanRows = rows.filter(r => r.some(cell => cell.length > 0));

    return {
      headers,
      rows: cleanRows,
      totalRowCount: cleanRows.length,
    };
  } catch (err: unknown) {
    const isAuth =
      isGoogleOAuthError(err) ||
      (err as any)?.code === 'GOOGLE_CONNECTION_REQUIRED' ||
      String((err as any)?.message || '').toLowerCase().includes('invalid_grant');

    if (isAuth && collegeId) {
      try {
        await markCollegeGoogleConnectionInvalid(
          collegeId,
          err instanceof Error ? err.message : 'Google OAuth authorization expired or was revoked'
        );
      } catch (markErr) {
        console.warn('[Sheets Reader] Could not mark connection invalid:', markErr);
      }
    }

    console.warn('[Sheets Reader] Error fetching Google Sheet responses:', err instanceof Error ? err.message : err);
    return {
      headers: [],
      rows: [],
      totalRowCount: 0,
      error: err instanceof Error ? err.message : String(err),
      isAuthError: isAuth,
    };
  }
}

