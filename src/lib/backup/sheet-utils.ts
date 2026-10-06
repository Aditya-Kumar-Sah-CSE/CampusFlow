import { getColumnLetter } from '@/lib/google/sheets';
import { moveDriveFileToFolder } from '@/lib/google/feedback-drive';

export interface SpreadsheetSyncStats {
  created: number;
  updated: number;
  markedDeleted: number;
  total: number;
}

/**
 * Searches for or creates a Google Spreadsheet directly inside a designated Drive folder.
 */
export async function getOrCreateSpreadsheetInFolder(
  drive: any,
  sheets: any,
  folderId: string,
  title: string,
  initialTabName: string = 'Overview'
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const cleanTitle = title.trim();
  const escapedTitle = cleanTitle.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  try {
    const listRes = await drive.files.list({
      q: `name = '${escapedTitle}' and '${folderId}' in parents and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
      fields: 'files(id, name, webViewLink)',
      pageSize: 1,
    });

    const existing = listRes.data.files?.[0];
    if (existing?.id) {
      return {
        spreadsheetId: existing.id,
        spreadsheetUrl: existing.webViewLink || `https://docs.google.com/spreadsheets/d/${existing.id}/edit`,
      };
    }
  } catch (err) {
    console.warn(`[SheetUtils] Search notice for spreadsheet "${cleanTitle}":`, err);
  }

  // Create new spreadsheet
  const createRes = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: cleanTitle,
      },
      sheets: [
        {
          properties: {
            title: initialTabName,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      ],
    },
  });

  const spreadsheetId = createRes.data.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error(`Failed to create Google Spreadsheet "${cleanTitle}".`);
  }

  // Move into target folder
  await moveDriveFileToFolder(drive, spreadsheetId, folderId);

  const spreadsheetUrl = createRes.data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  return { spreadsheetId, spreadsheetUrl };
}

/**
 * Ensures a tab exists with frozen header styling (Navy background, bold white text).
 */
export async function ensureSpreadsheetTab(
  sheets: any,
  spreadsheetId: string,
  tabName: string
): Promise<number> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title))',
  });

  const existingSheet = meta.data.sheets?.find(
    (s: any) => s.properties?.title?.toLowerCase() === tabName.toLowerCase()
  );

  if (existingSheet?.properties?.sheetId !== undefined) {
    return existingSheet.properties.sheetId;
  }

  // Add new tab
  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: tabName,
              gridProperties: {
                frozenRowCount: 1,
              },
            },
          },
        },
      ],
    },
  });

  return addRes.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0;
}

/**
 * Formats header row with CampusFlow brand colors (#0B192C background, white bold text).
 */
export async function formatHeaderRow(
  sheets: any,
  spreadsheetId: string,
  sheetId: number,
  columnCount: number
): Promise<void> {
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: columnCount,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 11 / 255, green: 25 / 255, blue: 44 / 255 }, // #0B192C
                  textFormat: {
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    bold: true,
                    fontSize: 10,
                  },
                  horizontalAlignment: 'LEFT',
                  verticalAlignment: 'MIDDLE',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
            },
          },
          {
            updateSheetProperties: {
              properties: {
                sheetId,
                gridProperties: {
                  frozenRowCount: 1,
                },
              },
              fields: 'gridProperties.frozenRowCount',
            },
          },
        ],
      },
    });
  } catch (err) {
    console.warn(`[SheetUtils] Header format warning for sheet ${sheetId}:`, err);
  }
}

/**
 * Synchronizes rows into a specific spreadsheet tab.
 * - Non-destructive: preserves existing rows.
 * - Idempotent: detects existing rows via stable ID in column A.
 * - Updates changed rows, appends new rows.
 */
export async function syncSpreadsheetTab(
  sheets: any,
  spreadsheetId: string,
  tabName: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
  idColumnIndex: number = 0
): Promise<SpreadsheetSyncStats> {
  const sheetId = await ensureSpreadsheetTab(sheets, spreadsheetId, tabName);

  // Read existing values in the tab
  const getRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tabName}'!A1:Z`,
  });

  const existingData = getRes.data.values || [];

  // If tab is empty or only has headers
  if (existingData.length <= 1) {
    const allValues = [headers, ...rows.map(r => r.map(c => (c === null || c === undefined ? '' : String(c))))];
    const lastCol = getColumnLetter(headers.length);

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tabName}'!A1:${lastCol}${allValues.length}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: allValues },
    });

    await formatHeaderRow(sheets, spreadsheetId, sheetId, headers.length);

    return {
      created: rows.length,
      updated: 0,
      markedDeleted: 0,
      total: rows.length,
    };
  }

  // Map existing rows by stable database ID (Column index 0 / idColumnIndex)
  const existingIdToRowIndex = new Map<string, { rowIndex: number; row: any[] }>();
  for (let i = 1; i < existingData.length; i++) {
    const row = existingData[i];
    const id = row[idColumnIndex] ? String(row[idColumnIndex]).trim() : '';
    if (id) {
      existingIdToRowIndex.set(id, { rowIndex: i + 1, row }); // 1-based row index in sheet
    }
  }

  const updatesToBatch: { range: string; values: any[][] }[] = [];
  const rowsToAppend: any[][] = [];
  let updatedCount = 0;
  let createdCount = 0;
  let markedDeletedCount = 0;

  const lastCol = getColumnLetter(headers.length);
  const statusColIndex = headers.findIndex(h => /status/i.test(h));
  const incomingIdSet = new Set<string>();

  for (const rawRow of rows) {
    const formattedRow = rawRow.map(c => (c === null || c === undefined ? '' : String(c)));
    const rowId = formattedRow[idColumnIndex] ? String(formattedRow[idColumnIndex]).trim() : '';

    if (!rowId) {
      rowsToAppend.push(formattedRow);
      createdCount++;
      continue;
    }

    incomingIdSet.add(rowId);

    const existingMatch = existingIdToRowIndex.get(rowId);
    if (existingMatch) {
      // Check if row changed
      const hasChanged = formattedRow.some((val, idx) => {
        const existVal = existingMatch.row[idx] ?? '';
        return String(val) !== String(existVal);
      });

      if (hasChanged) {
        updatesToBatch.push({
          range: `'${tabName}'!A${existingMatch.rowIndex}:${lastCol}${existingMatch.rowIndex}`,
          values: [formattedRow],
        });
        updatedCount++;
      }
    } else {
      rowsToAppend.push(formattedRow);
      createdCount++;
    }
  }

  // Zero Data Loss: If a record exists in Sheets but is deleted from Supabase, mark as DELETED
  if (statusColIndex !== -1) {
    for (const [existId, { rowIndex, row }] of existingIdToRowIndex.entries()) {
      if (!incomingIdSet.has(existId)) {
        const currentStatus = String(row[statusColIndex] || '').toUpperCase();
        if (currentStatus !== 'DELETED') {
          const updatedRow = [...row];
          while (updatedRow.length < headers.length) {
            updatedRow.push('');
          }
          updatedRow[statusColIndex] = 'DELETED';
          updatesToBatch.push({
            range: `'${tabName}'!A${rowIndex}:${lastCol}${rowIndex}`,
            values: [updatedRow],
          });
          markedDeletedCount++;
        }
      }
    }
  }

  // Execute batch updates for modified and marked-deleted rows
  if (updatesToBatch.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: updatesToBatch,
      },
    });
  }

  // Execute append for new rows
  if (rowsToAppend.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${tabName}'!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: rowsToAppend,
      },
    });
  }

  await formatHeaderRow(sheets, spreadsheetId, sheetId, headers.length);

  return {
    created: createdCount,
    updated: updatedCount,
    markedDeleted: markedDeletedCount,
    total: rows.length,
  };
}

/**
 * Resolves or creates the primary Academic Structure spreadsheet for an institution.
 * Strictly avoids duplicate spreadsheets by searching for existing sheets matching
 * "{College Name} - Academic Structure" or legacy "CampusFlow - Academic Structure".
 */
export async function getOrCreateAcademicSpreadsheet(
  drive: any,
  sheets: any,
  folderId: string,
  collegeName: string,
  collegeCode?: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; isNew: boolean }> {
  const desiredTitle = `${collegeName.trim()} - Academic Structure`;

  try {
    // List all spreadsheets directly inside the Academic Structure folder
    const listRes = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
      fields: 'files(id, name, webViewLink, modifiedTime)',
      pageSize: 20,
    });

    const files = listRes.data.files || [];

    if (files.length > 0) {
      // Find candidate matching desired title or variations
      let match = files.find((f: any) => f.name?.toLowerCase().trim() === desiredTitle.toLowerCase());

      if (!match) {
        // Fallback checks: collegeCode, CampusFlow, or contains 'Academic Structure'
        const codeTitle = collegeCode ? `${collegeCode.trim()} - Academic Structure`.toLowerCase() : null;
        match = files.find((f: any) => {
          const fn = f.name?.toLowerCase().trim() || '';
          return (
            (codeTitle && fn === codeTitle) ||
            fn === 'campusflow - academic structure' ||
            fn.includes('academic structure')
          );
        });
      }

      if (match?.id) {
        // If title doesn't match desiredTitle, rename it for consistency
        if (match.name?.trim() !== desiredTitle) {
          try {
            await sheets.spreadsheets.batchUpdate({
              spreadsheetId: match.id,
              requestBody: {
                requests: [
                  {
                    updateSpreadsheetProperties: {
                      properties: { title: desiredTitle },
                      fields: 'title',
                    },
                  },
                ],
              },
            });
          } catch {
            // Renaming error is non-fatal
          }
        }

        return {
          spreadsheetId: match.id,
          spreadsheetUrl: match.webViewLink || `https://docs.google.com/spreadsheets/d/${match.id}/edit`,
          isNew: false,
        };
      }
    }
  } catch (err) {
    console.warn(`[SheetUtils] Search notice for Academic Structure sheet in folder [${folderId}]:`, err);
  }

  // Create new spreadsheet
  const created = await getOrCreateSpreadsheetInFolder(
    drive,
    sheets,
    folderId,
    desiredTitle,
    'College Profile'
  );

  return {
    spreadsheetId: created.spreadsheetId,
    spreadsheetUrl: created.spreadsheetUrl,
    isNew: true,
  };
}

/**
 * Removes extraneous default sheet (e.g. 'Sheet1') if other named tabs exist.
 */
export async function removeDefaultSheetIfExtraneous(sheets: any, spreadsheetId: string): Promise<void> {
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets(properties(sheetId,title))',
    });
    const allSheets = meta.data.sheets || [];
    if (allSheets.length > 1) {
      const sheet1 = allSheets.find((s: any) => s.properties?.title === 'Sheet1');
      if (sheet1?.properties?.sheetId !== undefined) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                deleteSheet: {
                  sheetId: sheet1.properties.sheetId,
                },
              },
            ],
          },
        });
      }
    }
  } catch {
    // Non-fatal if sheet1 does not exist
  }
}

/**
 * Reorders tabs in the spreadsheet to match the desired canonical order.
 */
export async function reorderSpreadsheetTabs(
  sheets: any,
  spreadsheetId: string,
  orderedTabNames: string[]
): Promise<void> {
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets(properties(sheetId,title,index))',
    });
    const allSheets = meta.data.sheets || [];
    const requests: any[] = [];

    orderedTabNames.forEach((targetTitle, targetIndex) => {
      const found = allSheets.find(
        (s: any) => s.properties?.title?.toLowerCase() === targetTitle.toLowerCase()
      );
      if (found && found.properties?.sheetId !== undefined && found.properties?.index !== targetIndex) {
        requests.push({
          updateSheetProperties: {
            properties: {
              sheetId: found.properties.sheetId,
              index: targetIndex,
            },
            fields: 'index',
          },
        });
      }
    });

    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });
    }
  } catch (err) {
    console.warn('[SheetUtils] Tab reorder notice:', err);
  }
}

