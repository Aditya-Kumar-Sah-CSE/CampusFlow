/**
 * Library Service — Business logic layer
 * 
 * Settings stored in Supabase (minimal usage),
 * all book/borrow data lives in Google Sheets.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { LibrarySettings, LibraryStats } from '@/types/library';
import {
  createBooksInventorySheet,
  createBorrowLogSheet,
  fetchAllBooksFromSheet,
  fetchAllBorrowRequests,
  addBookToSheet,
  addBorrowRequestToSheet,
  updateBorrowRequestStatus,
  updateBookAvailability,
  deleteBookFromSheet,
  countStudentActiveBorrows,
} from '@/lib/google/library-sheets';

// ─── Default Settings ────────────────────────────────────────────
const DEFAULT_SETTINGS: Omit<LibrarySettings, 'collegeId'> = {
  maxBooksPerStudent: 3,
  maxBorrowDays: 15,
  finePerDay: 5,
  isEnabled: false,
};

// ─── Get / Create Library Settings ───────────────────────────────
export async function getLibrarySettings(collegeId: string): Promise<LibrarySettings> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error('Supabase service role not configured');

  const { data, error } = await supabase
    .from('library_settings')
    .select('*')
    .eq('college_id', collegeId)
    .single();

  if (error || !data) {
    return { ...DEFAULT_SETTINGS, collegeId };
  }

  return {
    id: data.id,
    collegeId: data.college_id,
    maxBooksPerStudent: data.max_books_per_student ?? 3,
    maxBorrowDays: data.max_borrow_days ?? 15,
    finePerDay: data.fine_per_day ?? 5,
    isEnabled: data.is_enabled ?? false,
    booksSheetId: data.books_sheet_id || undefined,
    borrowLogSheetId: data.borrow_log_sheet_id || undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ─── Save / Update Library Settings ──────────────────────────────
export async function saveLibrarySettings(
  collegeId: string,
  settings: Partial<LibrarySettings>
): Promise<LibrarySettings> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error('Supabase service role not configured');

  const payload = {
    college_id: collegeId,
    max_books_per_student: settings.maxBooksPerStudent ?? 3,
    max_borrow_days: settings.maxBorrowDays ?? 15,
    fine_per_day: settings.finePerDay ?? 5,
    is_enabled: settings.isEnabled ?? false,
    books_sheet_id: settings.booksSheetId || null,
    borrow_log_sheet_id: settings.borrowLogSheetId || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('library_settings')
    .upsert(payload, { onConflict: 'college_id' })
    .select()
    .single();

  if (error) throw new Error(`Failed to save library settings: ${error.message}`);

  return {
    id: data.id,
    collegeId: data.college_id,
    maxBooksPerStudent: data.max_books_per_student,
    maxBorrowDays: data.max_borrow_days,
    finePerDay: data.fine_per_day,
    isEnabled: data.is_enabled,
    booksSheetId: data.books_sheet_id || undefined,
    borrowLogSheetId: data.borrow_log_sheet_id || undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ─── Initialize Library Sheets ───────────────────────────────────
export async function initializeLibrarySheets(collegeId: string) {
  const settings = await getLibrarySettings(collegeId);

  let booksSheetId = settings.booksSheetId;
  let borrowLogSheetId = settings.borrowLogSheetId;

  if (!booksSheetId) {
    const result = await createBooksInventorySheet(collegeId);
    booksSheetId = result.spreadsheetId;
  }

  if (!borrowLogSheetId) {
    const result = await createBorrowLogSheet(collegeId);
    borrowLogSheetId = result.spreadsheetId;
  }

  await saveLibrarySettings(collegeId, {
    ...settings,
    booksSheetId,
    borrowLogSheetId,
    isEnabled: true,
  });

  return { booksSheetId, borrowLogSheetId };
}

// ─── Get Library Books ───────────────────────────────────────────
export async function getLibraryBooks(collegeId: string) {
  const settings = await getLibrarySettings(collegeId);
  if (!settings.booksSheetId) return [];
  return fetchAllBooksFromSheet(collegeId, settings.booksSheetId);
}

// ─── Add Book ────────────────────────────────────────────────────
export async function addBook(
  collegeId: string,
  book: { title: string; author: string; isbn?: string; category?: string; totalCopies: number }
) {
  const settings = await getLibrarySettings(collegeId);
  if (!settings.booksSheetId) throw new Error('Library not initialized. Please setup library first.');
  return addBookToSheet(collegeId, settings.booksSheetId, {
    ...book,
    availableCopies: book.totalCopies,
  });
}

// ─── Remove Book ─────────────────────────────────────────────────
export async function removeBook(collegeId: string, bookId: string) {
  const settings = await getLibrarySettings(collegeId);
  if (!settings.booksSheetId) throw new Error('Library not initialized.');
  return deleteBookFromSheet(collegeId, settings.booksSheetId, bookId);
}

// ─── Get Borrow Requests ────────────────────────────────────────
export async function getBorrowRequests(collegeId: string) {
  const settings = await getLibrarySettings(collegeId);
  if (!settings.borrowLogSheetId) return [];
  return fetchAllBorrowRequests(collegeId, settings.borrowLogSheetId);
}

// ─── Submit Borrow Request (Student) ─────────────────────────────
export async function submitBorrowRequest(
  collegeId: string,
  request: {
    studentName: string;
    studentEmail?: string;
    studentPhone?: string;
    bookId: string;
    bookTitle: string;
    bookAuthor: string;
  }
) {
  const settings = await getLibrarySettings(collegeId);
  if (!settings.isEnabled) throw new Error('Library service is not enabled for this institution.');
  if (!settings.borrowLogSheetId || !settings.booksSheetId) {
    throw new Error('Library not initialized.');
  }

  // Check max books limit
  const activeCount = await countStudentActiveBorrows(
    collegeId,
    settings.borrowLogSheetId,
    request.studentName
  );
  if (activeCount >= settings.maxBooksPerStudent) {
    throw new Error(
      `You have already borrowed ${activeCount} book(s). Maximum allowed is ${settings.maxBooksPerStudent}.`
    );
  }

  // Check book availability
  const books = await fetchAllBooksFromSheet(collegeId, settings.booksSheetId);
  const book = books.find((b) => b.id === request.bookId);
  if (!book || book.availableCopies <= 0) {
    throw new Error('This book is currently not available.');
  }

  return addBorrowRequestToSheet(collegeId, settings.borrowLogSheetId, request);
}

// ─── Approve Borrow Request (Admin) ──────────────────────────────
export async function approveBorrowRequest(collegeId: string, requestId: string, adminNote?: string) {
  const settings = await getLibrarySettings(collegeId);
  if (!settings.borrowLogSheetId || !settings.booksSheetId) throw new Error('Library not initialized.');

  const requests = await fetchAllBorrowRequests(collegeId, settings.borrowLogSheetId);
  const req = requests.find((r) => r.id === requestId);
  if (!req) throw new Error('Borrow request not found.');
  if (req.status !== 'PENDING') throw new Error('Request is not in PENDING status.');

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + settings.maxBorrowDays);

  await updateBorrowRequestStatus(collegeId, settings.borrowLogSheetId, requestId, {
    status: 'APPROVED',
    approvedAt: new Date().toISOString(),
    dueDate: dueDate.toISOString(),
    adminNote,
  });

  // Decrease available copies
  await updateBookAvailability(collegeId, settings.booksSheetId, req.bookId, -1);

  return { dueDate: dueDate.toISOString() };
}

// ─── Reject Borrow Request (Admin) ───────────────────────────────
export async function rejectBorrowRequest(collegeId: string, requestId: string, adminNote?: string) {
  const settings = await getLibrarySettings(collegeId);
  if (!settings.borrowLogSheetId) throw new Error('Library not initialized.');

  await updateBorrowRequestStatus(collegeId, settings.borrowLogSheetId, requestId, {
    status: 'REJECTED',
    adminNote,
  });
}

// ─── Mark Book Returned (Admin) ──────────────────────────────────
export async function markBookReturned(collegeId: string, requestId: string) {
  const settings = await getLibrarySettings(collegeId);
  if (!settings.borrowLogSheetId || !settings.booksSheetId) throw new Error('Library not initialized.');

  const requests = await fetchAllBorrowRequests(collegeId, settings.borrowLogSheetId);
  const req = requests.find((r) => r.id === requestId);
  if (!req) throw new Error('Borrow request not found.');

  // Calculate fine if overdue
  let fineAmount = 0;
  if (req.dueDate) {
    const due = new Date(req.dueDate);
    const now = new Date();
    if (now > due) {
      const daysLate = Math.ceil((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      fineAmount = daysLate * settings.finePerDay;
    }
  }

  await updateBorrowRequestStatus(collegeId, settings.borrowLogSheetId, requestId, {
    status: 'RETURNED',
    returnedAt: new Date().toISOString(),
    fineAmount,
  });

  // Increase available copies
  await updateBookAvailability(collegeId, settings.booksSheetId, req.bookId, +1);

  return { fineAmount };
}

// ─── Get Library Stats ───────────────────────────────────────────
export async function getLibraryStats(collegeId: string): Promise<LibraryStats> {
  const settings = await getLibrarySettings(collegeId);

  if (!settings.booksSheetId || !settings.borrowLogSheetId) {
    return {
      totalBooks: 0,
      totalAvailable: 0,
      totalBorrowed: 0,
      pendingRequests: 0,
      overdueBooks: 0,
      totalFineCollected: 0,
    };
  }

  const [books, requests] = await Promise.all([
    fetchAllBooksFromSheet(collegeId, settings.booksSheetId),
    fetchAllBorrowRequests(collegeId, settings.borrowLogSheetId),
  ]);

  const totalBooks = books.reduce((sum, b) => sum + b.totalCopies, 0);
  const totalAvailable = books.reduce((sum, b) => sum + b.availableCopies, 0);
  const totalBorrowed = requests.filter((r) => r.status === 'APPROVED' || r.status === 'OVERDUE').length;
  const pendingRequests = requests.filter((r) => r.status === 'PENDING').length;
  const now = new Date();
  const overdueBooks = requests.filter(
    (r) => r.status === 'APPROVED' && r.dueDate && new Date(r.dueDate) < now
  ).length;
  const totalFineCollected = requests
    .filter((r) => r.status === 'RETURNED' && r.fineAmount)
    .reduce((sum, r) => sum + (r.fineAmount || 0), 0);

  return {
    totalBooks,
    totalAvailable,
    totalBorrowed,
    pendingRequests,
    overdueBooks,
    totalFineCollected,
  };
}
