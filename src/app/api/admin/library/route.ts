import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin-auth';
import {
  getLibrarySettings,
  saveLibrarySettings,
  initializeLibrarySheets,
  getLibraryBooks,
  addBook,
  removeBook,
  getBorrowRequests,
  approveBorrowRequest,
  rejectBorrowRequest,
  markBookReturned,
  getLibraryStats,
  computeLibraryStatsFromData,
} from '@/lib/library/service';

export const dynamic = 'force-dynamic';

/** GET — Fetch library data (settings, books, requests, stats) */
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session.isAuthenticated || !session.isActive) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const collegeId = session.activeCollegeId || session.colleges[0]?.collegeId;
    if (!collegeId) {
      return NextResponse.json({ error: 'Active institution context required.' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'all';

    switch (action) {
      case 'settings': {
        const settings = await getLibrarySettings(collegeId);
        return NextResponse.json({ settings });
      }
      case 'books': {
        const books = await getLibraryBooks(collegeId);
        return NextResponse.json({ books });
      }
      case 'requests': {
        const requests = await getBorrowRequests(collegeId);
        return NextResponse.json({ requests });
      }
      case 'stats': {
        const stats = await getLibraryStats(collegeId);
        return NextResponse.json({ stats });
      }
      case 'all':
      default: {
        const [settings, books, requests] = await Promise.all([
          getLibrarySettings(collegeId),
          getLibraryBooks(collegeId).catch(() => []),
          getBorrowRequests(collegeId).catch(() => []),
        ]);
        const stats = computeLibraryStatsFromData(books, requests);
        return NextResponse.json({ settings, books, requests, stats });
      }
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch library data.' }, { status: 500 });
  }
}

/** POST — Admin actions (setup, save settings, add book, approve, reject, return, delete book) */
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session.isAuthenticated || !session.isActive) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const collegeId = session.activeCollegeId || session.colleges[0]?.collegeId;
    if (!collegeId) {
      return NextResponse.json({ error: 'Active institution context required.' }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'initialize': {
        const result = await initializeLibrarySheets(collegeId);
        return NextResponse.json({ success: true, ...result });
      }

      case 'save-settings': {
        const updated = await saveLibrarySettings(collegeId, {
          maxBooksPerStudent: body.maxBooksPerStudent,
          maxBorrowDays: body.maxBorrowDays,
          finePerDay: body.finePerDay,
          isEnabled: body.isEnabled,
          operatingDays: body.operatingDays,
          operatingStartTime: body.operatingStartTime,
          operatingEndTime: body.operatingEndTime,
          isTimingEnforced: body.isTimingEnforced,
          timingTimezone: body.timingTimezone,
          timingClosureMessage: body.timingClosureMessage,
        });
        return NextResponse.json({ success: true, settings: updated });
      }

      case 'add-book': {
        const result = await addBook(collegeId, {
          title: body.title,
          author: body.author,
          isbn: body.isbn,
          category: body.category,
          totalCopies: body.totalCopies || 1,
        });
        return NextResponse.json({ success: true, ...result });
      }

      case 'delete-book': {
        await removeBook(collegeId, body.bookId);
        return NextResponse.json({ success: true });
      }

      case 'approve': {
        const result = await approveBorrowRequest(collegeId, body.requestId, body.adminNote);
        return NextResponse.json({ success: true, ...result });
      }

      case 'reject': {
        await rejectBorrowRequest(collegeId, body.requestId, body.adminNote);
        return NextResponse.json({ success: true });
      }

      case 'return': {
        const result = await markBookReturned(collegeId, body.requestId);
        return NextResponse.json({ success: true, ...result });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Library operation failed.' }, { status: 500 });
  }
}
