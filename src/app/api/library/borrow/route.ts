import { NextRequest, NextResponse } from 'next/server';
import {
  getLibrarySettings,
  getLibraryBooks,
  submitBorrowRequest,
  isLibraryTimingOpen,
} from '@/lib/library/service';

export const dynamic = 'force-dynamic';

/** GET — Public: Fetch available books and library settings for students */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collegeId = searchParams.get('collegeId');

    if (!collegeId) {
      return NextResponse.json({ error: 'collegeId is required.' }, { status: 400 });
    }

    const settings = await getLibrarySettings(collegeId);

    if (!settings.isEnabled) {
      return NextResponse.json({
        enabled: false,
        books: [],
        timing: {
          isOpen: false,
          reason: 'Library module is not active for this institution.',
          operatingDays: [],
          startTime: '10:00',
          endTime: '16:00',
          isTimingEnforced: true,
        },
        settings: { maxBooksPerStudent: 0, maxBorrowDays: 0, finePerDay: 0 },
      });
    }

    const timing = isLibraryTimingOpen(settings);
    const books = await getLibraryBooks(collegeId);
    const availableBooks = books.filter((b) => b.availableCopies > 0);

    return NextResponse.json({
      enabled: true,
      books: availableBooks,
      timing,
      settings: {
        maxBooksPerStudent: settings.maxBooksPerStudent,
        maxBorrowDays: settings.maxBorrowDays,
        finePerDay: settings.finePerDay,
        operatingDays: settings.operatingDays,
        operatingStartTime: settings.operatingStartTime,
        operatingEndTime: settings.operatingEndTime,
        isTimingEnforced: settings.isTimingEnforced,
        timingClosureMessage: settings.timingClosureMessage,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch library data.' }, { status: 500 });
  }
}

/** POST — Public: Submit a book borrow request */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { collegeId, studentName, studentEmail, studentPhone, bookId, bookTitle, bookAuthor } = body;

    if (!collegeId || !studentName || !bookId || !bookTitle || !bookAuthor) {
      return NextResponse.json(
        { error: 'Missing required fields: collegeId, studentName, bookId, bookTitle, bookAuthor.' },
        { status: 400 }
      );
    }

    // Sanitize student name (basic XSS prevention)
    const cleanName = String(studentName).trim().slice(0, 100);
    if (cleanName.length < 2) {
      return NextResponse.json({ error: 'Student name must be at least 2 characters.' }, { status: 400 });
    }

    const result = await submitBorrowRequest(collegeId, {
      studentName: cleanName,
      studentEmail: studentEmail ? String(studentEmail).trim().slice(0, 150) : undefined,
      studentPhone: studentPhone ? String(studentPhone).trim().slice(0, 15) : undefined,
      bookId,
      bookTitle,
      bookAuthor,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to submit borrow request.' }, { status: 500 });
  }
}
