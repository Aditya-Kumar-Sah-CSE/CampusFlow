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
  operatingDays?: string[];
  operatingStartTime?: string;
  operatingEndTime?: string;
  isTimingEnforced?: boolean;
  timingTimezone?: string;
  timingClosureMessage?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LibraryTimingCheckResult {
  isOpen: boolean;
  reason?: string;
  operatingDays: string[];
  startTime: string;
  endTime: string;
  isTimingEnforced: boolean;
}

export interface VirtualLibraryCardData {
  collegeId: string;
  collegeName: string;
  collegeCode: string;
  collegeSlug?: string | null;
  collegeLogoUrl?: string | null;
  studentName: string;
  rollNumber: string;
  registrationNumber: string;
  branch: string;
  academicLevel: string;
  cardStatus: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
  issueDate: string;
  expiryDate?: string;
  maxBooksAllowed: number;
  activeBorrowsCount: number;
  isMaxCapacityReached: boolean;
  allocatedBooks: Array<{
    slotNumber: number;
    isUsed: boolean;
    bookId?: string;
    bookTitle?: string;
    bookAuthor?: string;
    borrowedAt?: string;
    dueDate?: string;
    status?: BorrowRequestStatus;
  }>;
}

export interface LibraryStats {
  totalBooks: number;
  totalAvailable: number;
  totalBorrowed: number;
  pendingRequests: number;
  overdueBooks: number;
  totalFineCollected: number;
}
