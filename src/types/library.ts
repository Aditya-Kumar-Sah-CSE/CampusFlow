/**
 * Library Management System Types
 * Storage: Google Sheets (books inventory + borrow log) + Supabase (settings only)
 */

export type BorrowRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED' | 'OVERDUE';

export interface LibraryBook {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  category?: string;
  totalCopies: number;
  availableCopies: number;
  addedAt: string;
}

export interface BorrowRequest {
  id: string;
  studentName: string;
  studentEmail?: string;
  studentPhone?: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  status: BorrowRequestStatus;
  requestedAt: string;
  approvedAt?: string;
  returnedAt?: string;
  dueDate?: string;
  fineAmount?: number;
  adminNote?: string;
}

export interface LibrarySettings {
  id?: string;
  collegeId: string;
  maxBooksPerStudent: number;
  maxBorrowDays: number;
  finePerDay: number;
  isEnabled: boolean;
  booksSheetId?: string;
  borrowLogSheetId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LibraryStats {
  totalBooks: number;
  totalAvailable: number;
  totalBorrowed: number;
  pendingRequests: number;
  overdueBooks: number;
  totalFineCollected: number;
}
