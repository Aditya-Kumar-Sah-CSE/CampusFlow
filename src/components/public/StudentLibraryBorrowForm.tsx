'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  User,
  Mail,
  Phone,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  BookMarked,
  Clock,
  IndianRupee,
  Send,
  ArrowLeft,
} from 'lucide-react';
import type { LibraryBook } from '@/types/library';

interface Props {
  collegeId: string;
}

export function StudentLibraryBorrowForm({ collegeId }: Props) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [libraryEnabled, setLibraryEnabled] = useState(false);
  const [maxBooks, setMaxBooks] = useState(3);
  const [maxDays, setMaxDays] = useState(15);
  const [finePerDay, setFinePerDay] = useState(5);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null);
  const [formData, setFormData] = useState({
    studentName: '',
    studentEmail: '',
    studentPhone: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/library/borrow?collegeId=${collegeId}`);
      if (!res.ok) throw new Error('Failed to fetch library data');
      const data = await res.json();
      setLibraryEnabled(data.enabled);
      setBooks(data.books || []);
      setMaxBooks(data.settings?.maxBooksPerStudent ?? 3);
      setMaxDays(data.settings?.maxBorrowDays ?? 15);
      setFinePerDay(data.settings?.finePerDay ?? 5);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [collegeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredBooks = books.filter(
    (b) =>
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBook || !formData.studentName.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/library/borrow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collegeId,
          studentName: formData.studentName.trim(),
          studentEmail: formData.studentEmail.trim() || undefined,
          studentPhone: formData.studentPhone.trim() || undefined,
          bookId: selectedBook.id,
          bookTitle: selectedBook.title,
          bookAuthor: selectedBook.author,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit request');

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm animate-pulse space-y-4">
        <div className="h-6 w-48 bg-slate-200 rounded" />
        <div className="h-4 w-64 bg-slate-100 rounded" />
        <div className="h-32 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  // ─── Library Disabled ──────────────────────────────────────────
  if (!libraryEnabled) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 text-center space-y-3 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
          <BookOpen className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">Library Service Unavailable</h3>
        <p className="text-xs text-slate-500">
          The library module is currently not enabled for this institution. Please check back later.
        </p>
      </div>
    );
  }

  // ─── Success State ─────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="bg-white rounded-2xl border border-emerald-200 p-6 sm:p-8 text-center space-y-4 shadow-sm animate-completion-in">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center animate-success-pop">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-emerald-900">Borrow Request Submitted!</h3>
        <p className="text-xs text-slate-600 max-w-sm mx-auto">
          Your request to borrow <strong>&ldquo;{selectedBook?.title}&rdquo;</strong> has been submitted successfully.
          Please wait for admin approval. You will be notified once approved.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => {
              setSubmitted(false);
              setSelectedBook(null);
              setFormData({ studentName: '', studentEmail: '', studentPhone: '' });
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Borrow Another Book
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Library Info Bar */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-[10px] sm:text-xs text-slate-500 bg-white/80 px-3 py-2.5 rounded-xl border border-slate-200/80">
        <span className="flex items-center gap-1">
          <BookMarked className="w-3 h-3 text-blue-500" />
          Max <strong className="text-slate-900">{maxBooks}</strong> books
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-amber-500" />
          Max <strong className="text-slate-900">{maxDays}</strong> days
        </span>
        <span className="flex items-center gap-1">
          <IndianRupee className="w-3 h-3 text-red-500" />
          Late fine <strong className="text-slate-900">₹{finePerDay}/day</strong>
        </span>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden"
      >
        {/* Step 1: Student Details */}
        <div className="p-4 sm:p-5 border-b border-slate-100 space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-bce-cobalt" />
            Student Details
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">
                Full Name <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  required
                  value={formData.studentName}
                  onChange={(e) => setFormData((p) => ({ ...p, studentName: e.target.value }))}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30 focus:border-bce-cobalt"
                  placeholder="Your full name"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="email"
                  value={formData.studentEmail}
                  onChange={(e) => setFormData((p) => ({ ...p, studentEmail: e.target.value }))}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30 focus:border-bce-cobalt"
                  placeholder="student@college.edu"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">Phone</label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="tel"
                  value={formData.studentPhone}
                  onChange={(e) => setFormData((p) => ({ ...p, studentPhone: e.target.value }))}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30 focus:border-bce-cobalt"
                  placeholder="9876543210"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Select Book */}
        <div className="p-4 sm:p-5 space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-bce-cobalt" />
            Select Book <span className="text-red-400">*</span>
          </h4>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by book title or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30 focus:border-bce-cobalt focus:bg-white transition-colors"
            />
          </div>

          {/* Book Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
            {filteredBooks.length === 0 ? (
              <div className="col-span-2 py-6 text-center text-xs text-slate-400">
                <BookOpen className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                No available books found.
              </div>
            ) : (
              filteredBooks.map((book) => {
                const isSelected = selectedBook?.id === book.id;
                return (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => setSelectedBook(isSelected ? null : book)}
                    className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-bce-cobalt bg-blue-50/60 ring-2 ring-bce-cobalt/20 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-bce-cobalt text-white' : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {isSelected ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <BookMarked className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{book.title}</p>
                        <p className="text-[10px] text-slate-500 truncate">{book.author}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {book.category && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                              {book.category}
                            </span>
                          )}
                          <span className="text-[9px] font-bold text-emerald-600">
                            {book.availableCopies} available
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="px-4 sm:px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[10px] text-slate-400">
            {selectedBook
              ? `Selected: "${selectedBook.title}" by ${selectedBook.author}`
              : 'Please select a book to borrow'}
          </p>
          <button
            type="submit"
            disabled={!selectedBook || !formData.studentName.trim() || submitting}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-bce-navy text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5 text-amber-400" />
            )}
            {submitting ? 'Submitting...' : 'Submit Borrow Request'}
          </button>
        </div>
      </form>
    </div>
  );
}
