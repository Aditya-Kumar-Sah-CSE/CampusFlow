/**
 * Library Service — Business logic layer
 * 
 * Settings stored in Supabase (minimal usage),
 * all book/borrow data lives in Google Sheets.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { LibrarySettings, LibraryStats, VirtualLibraryCardData } from '@/types/library';
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
// ─── Default Settings ────────────────────────────────────────────
const DEFAULT_SETTINGS: Omit<LibrarySettings, 'collegeId'> = {
  maxBooksPerStudent: 3,
  maxBorrowDays: 15,
  finePerDay: 5,
  isEnabled: false,
  operatingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
  operatingStartTime: '10:00',
  operatingEndTime: '16:00',
  isTimingEnforced: true,
  timingTimezone: 'Asia/Kolkata',
  timingClosureMessage: 'Book registration is open Monday to Saturday from 10:00 AM to 04:00 PM.',
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
    operatingDays: data.operating_days ?? ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
    operatingStartTime: data.operating_start_time ?? '10:00',
    operatingEndTime: data.operating_end_time ?? '16:00',
    isTimingEnforced: data.is_timing_enforced ?? true,
    timingTimezone: data.timing_timezone ?? 'Asia/Kolkata',
    timingClosureMessage:
      data.timing_closure_message ||
      'Book registration is open Monday to Saturday from 10:00 AM to 04:00 PM.',
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

  const payload: any = {
    college_id: collegeId,
    max_books_per_student: settings.maxBooksPerStudent ?? 3,
    max_borrow_days: settings.maxBorrowDays ?? 15,
    fine_per_day: settings.finePerDay ?? 5,
    is_enabled: settings.isEnabled ?? false,
    books_sheet_id: settings.booksSheetId || null,
    borrow_log_sheet_id: settings.borrowLogSheetId || null,
    operating_days: settings.operatingDays ?? ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
    operating_start_time: settings.operatingStartTime ?? '10:00',
    operating_end_time: settings.operatingEndTime ?? '16:00',
    is_timing_enforced: settings.isTimingEnforced ?? true,
    timing_timezone: settings.timingTimezone ?? 'Asia/Kolkata',
    timing_closure_message:
      settings.timingClosureMessage ??
      'Book registration is open Monday to Saturday from 10:00 AM to 04:00 PM.',
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
    operatingDays: data.operating_days ?? ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
    operatingStartTime: data.operating_start_time ?? '10:00',
    operatingEndTime: data.operating_end_time ?? '16:00',
    isTimingEnforced: data.is_timing_enforced ?? true,
    timingTimezone: data.timing_timezone ?? 'Asia/Kolkata',
    timingClosureMessage: data.timing_closure_message,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ─── Check Operating Timing (IST) ────────────────────────────────
export function isLibraryTimingOpen(settings: LibrarySettings): {
  isOpen: boolean;
  reason?: string;
  operatingDays: string[];
  startTime: string;
  endTime: string;
  isTimingEnforced: boolean;
} {
  const days =
    settings.operatingDays && settings.operatingDays.length > 0
      ? settings.operatingDays.map((d) => d.toUpperCase().trim())
      : ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const startTime = settings.operatingStartTime ? settings.operatingStartTime.slice(0, 5) : '10:00';
  const endTime = settings.operatingEndTime ? settings.operatingEndTime.slice(0, 5) : '16:00';
  const isEnforced = settings.isTimingEnforced ?? true;

  if (!isEnforced) {
    return {
      isOpen: true,
      operatingDays: days,
      startTime,
      endTime,
      isTimingEnforced: false,
    };
  }

  const tz = settings.timingTimezone || 'Asia/Kolkata';
  const now = new Date();

  // Day of week in target timezone (e.g., 'MON', 'TUE')
  const dayNameShort = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: tz,
  })
    .format(now)
    .toUpperCase(); // e.g. "MON"

  const dayNameFull = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: tz,
  })
    .format(now)
    .toUpperCase(); // e.g. "MONDAY"

  const isDayAllowed = days.some(
    (d) => d === dayNameShort || d === dayNameFull || dayNameFull.startsWith(d)
  );

  if (!isDayAllowed) {
    return {
      isOpen: false,
      reason:
        settings.timingClosureMessage ||
        `Library registration is closed today (${dayNameShort}). Operating schedule: Monday to Saturday from ${startTime} to ${endTime} (${tz}).`,
      operatingDays: days,
      startTime,
      endTime,
      isTimingEnforced: true,
    };
  }

  // Current time in target timezone: HH:mm
  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: tz,
  });
  const currentTime = timeFormatter.format(now); // e.g. "11:30"

  if (currentTime < startTime || currentTime > endTime) {
    return {
      isOpen: false,
      reason:
        settings.timingClosureMessage ||
        `Library book registrations are open from ${startTime} to ${endTime} (${tz}). Current time is ${currentTime}.`,
      operatingDays: days,
      startTime,
      endTime,
      isTimingEnforced: true,
    };
  }

  return {
    isOpen: true,
    operatingDays: days,
    startTime,
    endTime,
    isTimingEnforced: true,
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

  // Enforce operating hours schedule
  const timing = isLibraryTimingOpen(settings);
  if (!timing.isOpen) {
    throw new Error(
      timing.reason ||
        'Library book registration is currently closed. Operating hours: Monday to Saturday 10:00 AM - 04:00 PM.'
    );
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

// ─── Get Student Virtual Library Card Data ───────────────────────
export async function getStudentLibraryCardData(
  collegeId: string,
  identifier?: string,
  studentProfile?: {
    fullName?: string;
    registrationNumber?: string;
    branch?: string;
    academicLevel?: string;
    email?: string;
  }
): Promise<VirtualLibraryCardData> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error('Supabase client not configured.');

  // Fetch college details
  const { data: college } = await supabase
    .from('colleges')
    .select('id, name, code, slug, logo_url')
    .eq('id', collegeId)
    .single();

  const collegeName = college?.name || 'Institution Library';
  const collegeCode = college?.code || 'LIB';
  const collegeLogoUrl = college?.logo_url || null;

  // Fetch settings for maxBooksPerStudent
  const settings = await getLibrarySettings(collegeId);
  const maxBooksAllowed = settings.maxBooksPerStudent || 3;

  let studentName = studentProfile?.fullName || '';
  let rollNumber = studentProfile?.registrationNumber || '';
  let registrationNumber = studentProfile?.registrationNumber || '';
  let branch = studentProfile?.branch || '';
  let academicLevel = studentProfile?.academicLevel || '';
  let studentEmail = studentProfile?.email || '';

  // If identifier provided and fields are missing, lookup in students table
  if (identifier && identifier.trim() && (!studentName || !registrationNumber)) {
    const cleanId = identifier.trim();
    const { data: matchedStudent } = await supabase
      .from('students')
      .select('id, email, full_name, registration_number')
      .eq('college_id', collegeId)
      .or(`email.ilike.%${cleanId}%,registration_number.ilike.%${cleanId}%,full_name.ilike.%${cleanId}%`)
      .limit(1)
      .maybeSingle();

    if (matchedStudent) {
      studentName = studentName || matchedStudent.full_name || cleanId;
      registrationNumber = registrationNumber || matchedStudent.registration_number || cleanId;
      rollNumber = rollNumber || matchedStudent.registration_number || cleanId;
      studentEmail = studentEmail || matchedStudent.email || '';
    }
  }

  // Fallbacks for display (no fake data)
  studentName = studentName || identifier || 'Student Cardholder';
  rollNumber = rollNumber || '-';
  registrationNumber = registrationNumber || '-';
  branch = branch || 'All Disciplines';
  academicLevel = academicLevel || 'Undergraduate';

  // Fetch active borrow requests from Google Sheet
  let activeBorrows: any[] = [];
  const searchName = (studentName || identifier || '').trim().toLowerCase();
  const searchEmail = (studentEmail || identifier || '').trim().toLowerCase();

  if (settings.borrowLogSheetId && (searchName || searchEmail)) {
    try {
      const allRequests = await fetchAllBorrowRequests(collegeId, settings.borrowLogSheetId);
      activeBorrows = allRequests.filter((r) => {
        const matchesName = searchName && r.studentName && r.studentName.toLowerCase().includes(searchName);
        const matchesEmail = searchEmail && r.studentEmail && r.studentEmail.toLowerCase() === searchEmail;
        const isActiveStatus = r.status === 'APPROVED' || r.status === 'PENDING' || r.status === 'OVERDUE';
        return (matchesName || matchesEmail) && isActiveStatus;
      });
    } catch (sheetErr) {
      console.warn('[LIBRARY_CARD_SHEET_LOOKUP_WARNING]', sheetErr);
    }
  }

  const activeBorrowsCount = activeBorrows.length;
  const isMaxCapacityReached = activeBorrowsCount >= maxBooksAllowed;

  // Construct exactly maxBooksAllowed slots (default 3)
  const allocatedBooks = Array.from({ length: maxBooksAllowed }, (_, idx) => {
    const slotNumber = idx + 1;
    const borrow = activeBorrows[idx];
    if (borrow) {
      return {
        slotNumber,
        isUsed: true,
        bookId: borrow.bookId,
        bookTitle: borrow.bookTitle,
        bookAuthor: borrow.bookAuthor,
        borrowedAt: borrow.approvedAt || borrow.requestedAt,
        dueDate: borrow.dueDate,
        status: borrow.status,
      };
    }
    return {
      slotNumber,
      isUsed: false,
    };
  });

  return {
    collegeId,
    collegeName,
    collegeCode,
    collegeLogoUrl,
    studentName,
    rollNumber,
    registrationNumber,
    branch,
    academicLevel,
    cardStatus: 'ACTIVE',
    issueDate: new Date().toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    maxBooksAllowed,
    activeBorrowsCount,
    isMaxCapacityReached,
    allocatedBooks,
  };
}
