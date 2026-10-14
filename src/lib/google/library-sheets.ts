/**
 * Library Google Sheets Integration
 * 
 * Creates and manages two Google Sheets per college:
 * 1. Books Inventory Sheet — master catalog of all books
 * 2. Borrow Log Sheet — tracks all borrow requests, approvals, returns, fines
 * 
 * Uses the same OAuth pattern as feedback sheets (executeWithCollegeGoogleOAuthRetry).
 */

import { executeWithCollegeGoogleOAuthRetry } from './auth';
import { getColumnLetter } from './sheets';
import type { LibraryBook, BorrowRequest, BorrowRequestStatus } from '@/types/library';

// ─── Sheet Headers ───────────────────────────────────────────────
const BOOKS_HEADERS = [
  'Book ID',
  'Title',
  'Author',
  'ISBN',
  'Category',
  'Total Copies',
  'Available Copies',
  'Added At',
];

const BORROW_LOG_HEADERS = [
  'Request ID',
  'Student Name',
  'Student Email',
  'Student Phone',
  'Book ID',
  'Book Title',
  'Book Author',
  'Status',
  'Requested At',
  'Approved At',
  'Returned At',
  'Due Date',
  'Fine Amount',
  'Admin Note',
];

// ─── Sheet Styling (Premium Navy header — matches existing CampusFlow style) ─
async function applyPremiumHeaderStyling(
  sheets: any,
  spreadsheetId: string,
  sheetId: number,
  columnCount: number
) {
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
                  backgroundColor: { red: 11 / 255, green: 25 / 255, blue: 44 / 255 },
                  textFormat: {
                    bold: true,
                    foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                    fontSize: 10,
                  },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                  wrapStrategy: 'WRAP',
                },
              },
              fields:
                'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)',
            },
          },
          {
            updateSheetProperties: {
              properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
              fields: 'gridProperties.frozenRowCount',
            },
          },
          {
            autoResizeDimensions: {
              dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: columnCount },
            },
          },
        ],
      },
    });
  } catch (err) {
    console.warn('[LibrarySheets] Non-fatal: Header styling failed:', err);
  }
}

// ─── Create Books Inventory Sheet ────────────────────────────────
export async function createBooksInventorySheet(collegeId: string): Promise<{
  spreadsheetId: string;
  spreadsheetUrl: string;
}> {
  return executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
    const res = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: 'Library — Books Inventory' },
        sheets: [
          {
            properties: {
              title: 'Books',
              gridProperties: { frozenRowCount: 1 },
            },
          },
        ],
      },
    });

    const spreadsheetId = res.data.spreadsheetId!;
    const spreadsheetUrl =
      res.data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    const gridSheetId = res.data.sheets?.[0]?.properties?.sheetId ?? 0;

    const lastCol = getColumnLetter(BOOKS_HEADERS.length);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'Books'!A1:${lastCol}1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [BOOKS_HEADERS] },
    });

    await applyPremiumHeaderStyling(sheets, spreadsheetId, gridSheetId, BOOKS_HEADERS.length);

    return { spreadsheetId, spreadsheetUrl };
  });
}

// ─── Create Borrow Log Sheet ─────────────────────────────────────
export async function createBorrowLogSheet(collegeId: string): Promise<{
  spreadsheetId: string;
  spreadsheetUrl: string;
}> {
  return executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
    const res = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: 'Library — Borrow Log' },
        sheets: [
          {
            properties: {
              title: 'Borrow Log',
              gridProperties: { frozenRowCount: 1 },
            },
          },
        ],
      },
    });

    const spreadsheetId = res.data.spreadsheetId!;
    const spreadsheetUrl =
      res.data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    const gridSheetId = res.data.sheets?.[0]?.properties?.sheetId ?? 0;

    const lastCol = getColumnLetter(BORROW_LOG_HEADERS.length);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'Borrow Log'!A1:${lastCol}1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [BORROW_LOG_HEADERS] },
    });

    await applyPremiumHeaderStyling(sheets, spreadsheetId, gridSheetId, BORROW_LOG_HEADERS.length);

    return { spreadsheetId, spreadsheetUrl };
  });
}

// ─── Add Book to Inventory ───────────────────────────────────────
export async function addBookToSheet(
  collegeId: string,
  spreadsheetId: string,
  book: Omit<LibraryBook, 'id' | 'addedAt'>
) {
  return executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
    const bookId = `BK-${Date.now().toString(36).toUpperCase()}`;
    const row = [
      bookId,
      book.title,
      book.author,
      book.isbn || '',
      book.category || '',
      String(book.totalCopies),
      String(book.availableCopies),
      new Date().toISOString(),
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "'Books'!A:H",
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    return { bookId };
  });
}

// ─── Update Book Available Copies ────────────────────────────────
export async function updateBookAvailability(
  collegeId: string,
  spreadsheetId: string,
  bookId: string,
  delta: number // +1 for return, -1 for borrow
) {
  return executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'Books'!A:H",
    });
    const rows = res.data.values || [];
    if (rows.length < 2) return;

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === bookId) {
        const currentAvailable = parseInt(rows[i][6] || '0', 10);
        const newAvailable = Math.max(0, currentAvailable + delta);
        const rowNum = i + 1;

        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'Books'!G${rowNum}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[String(newAvailable)]] },
        });
        return;
      }
    }
  });
}

// ─── Fetch All Books ─────────────────────────────────────────────
export async function fetchAllBooksFromSheet(
  collegeId: string,
  spreadsheetId: string
): Promise<LibraryBook[]> {
  return executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'Books'!A:H",
    });
    const rows = res.data.values || [];
    if (rows.length < 2) return [];

    return rows.slice(1).map((row) => ({
      id: row[0] || '',
      title: row[1] || '',
      author: row[2] || '',
      isbn: row[3] || undefined,
      category: row[4] || undefined,
      totalCopies: parseInt(row[5] || '0', 10),
      availableCopies: parseInt(row[6] || '0', 10),
      addedAt: row[7] || '',
    }));
  });
}

// ─── Add Borrow Request ──────────────────────────────────────────
export async function addBorrowRequestToSheet(
  collegeId: string,
  spreadsheetId: string,
  request: {
    studentName: string;
    studentEmail?: string;
    studentPhone?: string;
    bookId: string;
    bookTitle: string;
    bookAuthor: string;
  }
) {
  return executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
    const requestId = `BR-${Date.now().toString(36).toUpperCase()}`;
    const row = [
      requestId,
      request.studentName,
      request.studentEmail || '',
      request.studentPhone || '',
      request.bookId,
      request.bookTitle,
      request.bookAuthor,
      'PENDING',
      new Date().toISOString(),
      '', // approvedAt
      '', // returnedAt
      '', // dueDate
      '0', // fineAmount
      '', // adminNote
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "'Borrow Log'!A:N",
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    return { requestId };
  });
}

// ─── Fetch All Borrow Requests ───────────────────────────────────
export async function fetchAllBorrowRequests(
  collegeId: string,
  spreadsheetId: string
): Promise<BorrowRequest[]> {
  return executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'Borrow Log'!A:N",
    });
    const rows = res.data.values || [];
    if (rows.length < 2) return [];

    return rows.slice(1).map((row) => ({
      id: row[0] || '',
      studentName: row[1] || '',
      studentEmail: row[2] || undefined,
      studentPhone: row[3] || undefined,
      bookId: row[4] || '',
      bookTitle: row[5] || '',
      bookAuthor: row[6] || '',
      status: (row[7] || 'PENDING') as BorrowRequestStatus,
      requestedAt: row[8] || '',
      approvedAt: row[9] || undefined,
      returnedAt: row[10] || undefined,
      dueDate: row[11] || undefined,
      fineAmount: row[12] ? parseFloat(row[12]) : undefined,
      adminNote: row[13] || undefined,
    }));
  });
}

// ─── Update Borrow Request Status ────────────────────────────────
export async function updateBorrowRequestStatus(
  collegeId: string,
  spreadsheetId: string,
  requestId: string,
  update: {
    status: BorrowRequestStatus;
    dueDate?: string;
    fineAmount?: number;
    adminNote?: string;
    returnedAt?: string;
    approvedAt?: string;
  }
) {
  return executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'Borrow Log'!A:N",
    });
    const rows = res.data.values || [];
    if (rows.length < 2) return;

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === requestId) {
        const rowNum = i + 1;
        // Update status (col H=8), approvedAt (J=10), returnedAt (K=11), dueDate (L=12), fine (M=13), note (N=14)
        const updatedRow = [
          update.status,
          update.approvedAt || rows[i][9] || '',
          update.returnedAt || rows[i][10] || '',
          update.dueDate || rows[i][11] || '',
          update.fineAmount !== undefined ? String(update.fineAmount) : (rows[i][12] || '0'),
          update.adminNote !== undefined ? update.adminNote : (rows[i][13] || ''),
        ];

        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'Borrow Log'!H${rowNum}:N${rowNum}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [updatedRow] },
        });
        return;
      }
    }
  });
}

// ─── Count Active Borrows for Student ────────────────────────────
export async function countStudentActiveBorrows(
  collegeId: string,
  spreadsheetId: string,
  studentName: string
): Promise<number> {
  const requests = await fetchAllBorrowRequests(collegeId, spreadsheetId);
  return requests.filter(
    (r) =>
      r.studentName.toLowerCase().trim() === studentName.toLowerCase().trim() &&
      (r.status === 'APPROVED' || r.status === 'OVERDUE')
  ).length;
}

// ─── Delete Book from Sheet ──────────────────────────────────────
export async function deleteBookFromSheet(
  collegeId: string,
  spreadsheetId: string,
  bookId: string
) {
  return executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetTabId = meta.data.sheets?.[0]?.properties?.sheetId || 0;

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'Books'!A:H",
    });
    const rows = res.data.values || [];

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === bookId) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: sheetTabId,
                    dimension: 'ROWS',
                    startIndex: i,
                    endIndex: i + 1,
                  },
                },
              },
            ],
          },
        });
        return;
      }
    }
  });
}
