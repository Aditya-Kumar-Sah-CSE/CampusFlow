'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Plus,
  Trash2,
  Check,
  X,
  RotateCcw,
  Settings,
  AlertCircle,
  Loader2,
  BookMarked,
  Users,
  Clock,
  IndianRupee,
  CheckCircle2,
  XCircle,
  Package,
  Search,
  RefreshCw,
  Zap,
  Calendar,
  Globe,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import type { LibraryBook, BorrowRequest, LibrarySettings, LibraryStats } from '@/types/library';

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

function formatTime12(timeStr?: string): string {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || '0', 10);
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

interface Props {
  activeCollegeId?: string;
}

type SubView = 'dashboard' | 'books' | 'requests' | 'settings';

export function LibraryManagementTab({ activeCollegeId }: Props) {
  const [subView, setSubView] = useState<SubView>('dashboard');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Data
  const [settings, setSettings] = useState<LibrarySettings | null>(null);
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [stats, setStats] = useState<LibraryStats | null>(null);

  // Form states
  const [showAddBook, setShowAddBook] = useState(false);
  const [bookForm, setBookForm] = useState({ title: '', author: '', isbn: '', category: '', totalCopies: 1 });
  const [searchQuery, setSearchQuery] = useState('');
  const [requestFilter, setRequestFilter] = useState<string>('ALL');

  // Settings form with operating schedule controls
  const [settingsForm, setSettingsForm] = useState({
    maxBooksPerStudent: 3,
    maxBorrowDays: 15,
    finePerDay: 5,
    isEnabled: false,
    isTimingEnforced: true,
    operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as string[],
    operatingStartTime: '10:00',
    operatingEndTime: '16:00',
    timingTimezone: 'Asia/Kolkata',
    timingClosureMessage: 'Online book registration is available only Monday to Saturday, between 10:00 AM and 04:00 PM IST.',
  });

  const fetchLibraryData = useCallback(async () => {
    if (!activeCollegeId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/library?action=all');
      if (!res.ok) throw new Error('Failed to fetch library data');
      const data = await res.json();
      setSettings(data.settings);
      setBooks(data.books || []);
      setRequests(data.requests || []);
      setStats(data.stats);
      setSettingsForm({
        maxBooksPerStudent: data.settings?.maxBooksPerStudent ?? 3,
        maxBorrowDays: data.settings?.maxBorrowDays ?? 15,
        finePerDay: data.settings?.finePerDay ?? 5,
        isEnabled: data.settings?.isEnabled ?? false,
        isTimingEnforced: data.settings?.isTimingEnforced ?? true,
        operatingDays:
          data.settings?.operatingDays && data.settings.operatingDays.length > 0
            ? data.settings.operatingDays
            : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        operatingStartTime: data.settings?.operatingStartTime ?? '10:00',
        operatingEndTime: data.settings?.operatingEndTime ?? '16:00',
        timingTimezone: data.settings?.timingTimezone ?? 'Asia/Kolkata',
        timingClosureMessage:
          data.settings?.timingClosureMessage ??
          'Online book registration is available only Monday to Saturday, between 10:00 AM and 04:00 PM IST.',
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeCollegeId]);

  useEffect(() => {
    fetchLibraryData();
  }, [fetchLibraryData]);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const showSuccessMsg = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  };

  // ─── Initialize Library ─────────────────────────────────────────
  const handleInitialize = async () => {
    setActionLoading('init');
    clearMessages();
    try {
      const res = await fetch('/api/admin/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initialize' }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to initialize');
      }
      showSuccessMsg('Library initialized! Google Sheets created for books inventory & borrow log.');
      await fetchLibraryData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Save Settings ──────────────────────────────────────────────
  const handleSaveSettings = async () => {
    setActionLoading('settings');
    clearMessages();
    try {
      const res = await fetch('/api/admin/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-settings', ...settingsForm }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to save settings');
      }
      showSuccessMsg('Library settings updated successfully!');
      await fetchLibraryData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Add Book ───────────────────────────────────────────────────
  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookForm.title.trim() || !bookForm.author.trim()) return;
    setActionLoading('add-book');
    clearMessages();
    try {
      const res = await fetch('/api/admin/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-book', ...bookForm }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to add book');
      }
      showSuccessMsg(`"${bookForm.title}" added to library!`);
      setBookForm({ title: '', author: '', isbn: '', category: '', totalCopies: 1 });
      setShowAddBook(false);
      await fetchLibraryData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Delete Book ────────────────────────────────────────────────
  const handleDeleteBook = async (bookId: string, title: string) => {
    if (!confirm(`Delete "${title}" from library? This cannot be undone.`)) return;
    setActionLoading(`del-${bookId}`);
    clearMessages();
    try {
      const res = await fetch('/api/admin/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-book', bookId }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to delete');
      }
      showSuccessMsg(`"${title}" removed from library.`);
      await fetchLibraryData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Approve / Reject / Return ─────────────────────────────────
  const handleRequestAction = async (requestId: string, action: 'approve' | 'reject' | 'return') => {
    setActionLoading(`${action}-${requestId}`);
    clearMessages();
    try {
      const res = await fetch('/api/admin/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, requestId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Action failed');

      if (action === 'return' && d.fineAmount > 0) {
        showSuccessMsg(`Book returned. Fine: ₹${d.fineAmount} (late return).`);
      } else {
        showSuccessMsg(
          action === 'approve'
            ? `Request approved! Due: ${new Date(d.dueDate).toLocaleDateString('en-IN')}`
            : action === 'reject'
            ? 'Request rejected.'
            : 'Book returned successfully!'
        );
      }
      await fetchLibraryData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Filtered Data ─────────────────────────────────────────────
  const filteredBooks = books.filter(
    (b) =>
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRequests = requests.filter((r) =>
    requestFilter === 'ALL' ? true : r.status === requestFilter
  );

  // ─── Sub-tab Nav Items ──────────────────────────────────────────
  const subTabs: { id: SubView; label: string; icon: typeof BookOpen; badge?: number }[] = [
    { id: 'dashboard', label: 'Overview', icon: BookOpen },
    { id: 'books', label: 'Books Inventory', icon: BookMarked, badge: books.length },
    {
      id: 'requests',
      label: 'Borrow Requests',
      icon: Users,
      badge: requests.filter((r) => r.status === 'PENDING').length || undefined,
    },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  if (!activeCollegeId) {
    return (
      <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-amber-900 text-xs space-y-2">
        <p className="font-bold text-sm">No Active Institution Selected</p>
        <p>Please switch to a specific college to manage its library.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs animate-pulse space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-200 rounded-xl" />
          <div className="space-y-2">
            <div className="h-5 w-48 bg-slate-200 rounded" />
            <div className="h-3 w-72 bg-slate-100 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ─── Not Initialized State ─────────────────────────────────────
  if (!settings?.booksSheetId || !settings?.borrowLogSheetId) {
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs text-center max-w-lg mx-auto space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-bce-cobalt to-bce-navy text-amber-400 mx-auto flex items-center justify-center shadow-lg">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Setup Library System</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Initialize the library module to create Google Sheets for books inventory and borrow tracking.
            All data will be stored in your college&apos;s Google Drive.
          </p>
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleInitialize}
            disabled={actionLoading === 'init'}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-bce-navy text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            {actionLoading === 'init' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 text-amber-400" />
            )}
            {actionLoading === 'init' ? 'Setting up...' : 'Initialize Library'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-bce-cobalt" />
            Library Management
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage books, approve borrow requests, and configure fines & limits.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchLibraryData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          const isCurrent = subView === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubView(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer select-none ${
                isCurrent
                  ? 'bg-white text-bce-navy shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-bce-cobalt' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-amber-500 text-slate-950 shadow-2xs">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════ DASHBOARD VIEW ══════════════════════ */}
      {subView === 'dashboard' && (
        <div className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total Books', value: stats?.totalBooks ?? 0, icon: Package, color: 'text-blue-600 bg-blue-50 border-blue-200' },
              { label: 'Available', value: stats?.totalAvailable ?? 0, icon: BookOpen, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
              { label: 'Borrowed', value: stats?.totalBorrowed ?? 0, icon: BookMarked, color: 'text-amber-600 bg-amber-50 border-amber-200' },
              { label: 'Pending', value: stats?.pendingRequests ?? 0, icon: Clock, color: 'text-orange-600 bg-orange-50 border-orange-200' },
              { label: 'Overdue', value: stats?.overdueBooks ?? 0, icon: AlertCircle, color: 'text-red-600 bg-red-50 border-red-200' },
              { label: 'Fines Collected', value: `₹${stats?.totalFineCollected ?? 0}`, icon: IndianRupee, color: 'text-purple-600 bg-purple-50 border-purple-200' },
            ].map((stat) => {
              const StatIcon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className={`p-3 sm:p-4 rounded-xl border ${stat.color} space-y-1`}
                >
                  <div className="flex items-center gap-1.5">
                    <StatIcon className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{stat.label}</span>
                  </div>
                  <p className="text-lg sm:text-xl font-extrabold">{stat.value}</p>
                </div>
              );
            })}
          </div>

          {/* Active Rules */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Library Rules</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Max Books / Student</p>
                <p className="text-xl font-extrabold text-bce-navy mt-1">{settings?.maxBooksPerStudent ?? 3}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Max Borrow Days</p>
                <p className="text-xl font-extrabold text-bce-navy mt-1">{settings?.maxBorrowDays ?? 15}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Late Fine / Day</p>
                <p className="text-xl font-extrabold text-bce-navy mt-1">₹{settings?.finePerDay ?? 5}</p>
              </div>
            </div>
          </div>

          {/* Recent Pending Requests */}
          {requests.filter((r) => r.status === 'PENDING').length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  Pending Approvals
                </h4>
                <button
                  onClick={() => setSubView('requests')}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-900 cursor-pointer"
                >
                  View All →
                </button>
              </div>
              <div className="space-y-2">
                {requests
                  .filter((r) => r.status === 'PENDING')
                  .slice(0, 5)
                  .map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-3 bg-amber-50/60 rounded-xl border border-amber-100"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{req.studentName}</p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {req.bookTitle} — {req.bookAuthor}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleRequestAction(req.id, 'approve')}
                          disabled={actionLoading === `approve-${req.id}`}
                          className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors cursor-pointer disabled:opacity-50"
                          title="Approve"
                        >
                          {actionLoading === `approve-${req.id}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleRequestAction(req.id, 'reject')}
                          disabled={actionLoading === `reject-${req.id}`}
                          className="p-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-50"
                          title="Reject"
                        >
                          {actionLoading === `reject-${req.id}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <X className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ BOOKS VIEW ══════════════════════════ */}
      {subView === 'books' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search books by title or author..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30 focus:border-bce-cobalt"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowAddBook(!showAddBook)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-bce-navy text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer shadow-sm shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              Add Book
            </button>
          </div>

          {/* Add Book Form */}
          {showAddBook && (
            <form
              onSubmit={handleAddBook}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 animate-fade-in"
            >
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-bce-cobalt" />
                Add New Book
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Book Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={bookForm.title}
                    onChange={(e) => setBookForm((p) => ({ ...p, title: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30 focus:border-bce-cobalt"
                    placeholder="e.g. Data Structures & Algorithms"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Author *
                  </label>
                  <input
                    type="text"
                    required
                    value={bookForm.author}
                    onChange={(e) => setBookForm((p) => ({ ...p, author: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30 focus:border-bce-cobalt"
                    placeholder="e.g. Thomas H. Cormen"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">ISBN</label>
                  <input
                    type="text"
                    value={bookForm.isbn}
                    onChange={(e) => setBookForm((p) => ({ ...p, isbn: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30 focus:border-bce-cobalt"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={bookForm.category}
                    onChange={(e) => setBookForm((p) => ({ ...p, category: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30 focus:border-bce-cobalt"
                    placeholder="e.g. Computer Science"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Total Copies
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={bookForm.totalCopies}
                    onChange={(e) => setBookForm((p) => ({ ...p, totalCopies: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30 focus:border-bce-cobalt"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={actionLoading === 'add-book'}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === 'add-book' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Add Book
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddBook(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Books Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {filteredBooks.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-700">No books found</p>
                <p>Add books to your library inventory to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Title</th>
                      <th className="text-left px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Author</th>
                      <th className="text-left px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Category</th>
                      <th className="text-center px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Total</th>
                      <th className="text-center px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Available</th>
                      <th className="text-center px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBooks.map((book) => (
                      <tr key={book.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900">{book.title}</td>
                        <td className="px-4 py-3 text-slate-600">{book.author}</td>
                        <td className="px-4 py-3 text-slate-500">{book.category || '—'}</td>
                        <td className="px-4 py-3 text-center font-bold">{book.totalCopies}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              book.availableCopies > 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {book.availableCopies}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleDeleteBook(book.id, book.title)}
                            disabled={actionLoading === `del-${book.id}`}
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                            title="Delete book"
                          >
                            {actionLoading === `del-${book.id}` ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════ REQUESTS VIEW ══════════════════════ */}
      {subView === 'requests' && (
        <div className="space-y-4">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'RETURNED', 'OVERDUE'].map((f) => (
              <button
                key={f}
                onClick={() => setRequestFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap cursor-pointer ${
                  requestFilter === f
                    ? 'bg-bce-navy text-white shadow-xs'
                    : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {f}
                {f !== 'ALL' && (
                  <span className="ml-1 opacity-70">
                    ({requests.filter((r) => r.status === f).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Requests List */}
          <div className="space-y-2">
            {filteredRequests.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-700">No requests found</p>
                <p>No borrow requests matching this filter.</p>
              </div>
            ) : (
              filteredRequests.map((req) => {
                const isOverdue =
                  req.status === 'APPROVED' && req.dueDate && new Date(req.dueDate) < new Date();
                return (
                  <div
                    key={req.id}
                    className={`bg-white p-4 rounded-xl border shadow-xs transition-all ${
                      isOverdue ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900">{req.studentName}</p>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                              req.status === 'PENDING'
                                ? 'bg-amber-100 text-amber-800'
                                : req.status === 'APPROVED'
                                ? isOverdue
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-emerald-100 text-emerald-800'
                                : req.status === 'REJECTED'
                                ? 'bg-red-100 text-red-800'
                                : req.status === 'RETURNED'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {isOverdue ? 'OVERDUE' : req.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">
                          📚 {req.bookTitle} — <span className="text-slate-400">{req.bookAuthor}</span>
                        </p>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400">
                          {req.studentEmail && <span>✉ {req.studentEmail}</span>}
                          {req.studentPhone && <span>📱 {req.studentPhone}</span>}
                          <span>Requested: {new Date(req.requestedAt).toLocaleDateString('en-IN')}</span>
                          {req.dueDate && (
                            <span className={isOverdue ? 'text-red-600 font-bold' : ''}>
                              Due: {new Date(req.dueDate).toLocaleDateString('en-IN')}
                            </span>
                          )}
                          {req.fineAmount !== undefined && req.fineAmount > 0 && (
                            <span className="text-red-600 font-bold">Fine: ₹{req.fineAmount}</span>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {req.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleRequestAction(req.id, 'approve')}
                              disabled={!!actionLoading}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-600 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {actionLoading === `approve-${req.id}` ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3 h-3" />
                              )}
                              Approve
                            </button>
                            <button
                              onClick={() => handleRequestAction(req.id, 'reject')}
                              disabled={!!actionLoading}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-[10px] font-bold hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {actionLoading === `reject-${req.id}` ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <XCircle className="w-3 h-3" />
                              )}
                              Reject
                            </button>
                          </>
                        )}
                        {(req.status === 'APPROVED' || isOverdue) && (
                          <button
                            onClick={() => handleRequestAction(req.id, 'return')}
                            disabled={!!actionLoading}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-[10px] font-bold hover:bg-blue-600 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {actionLoading === `return-${req.id}` ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3 h-3" />
                            )}
                            Mark Returned
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════ SETTINGS VIEW ══════════════════════ */}
      {subView === 'settings' && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5 max-w-2xl">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Settings className="w-4 h-4 text-bce-cobalt" />
              Library Configuration
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              These rules are enforced automatically. Students cannot exceed these limits.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Max Books per Student
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={settingsForm.maxBooksPerStudent}
                onChange={(e) =>
                  setSettingsForm((p) => ({ ...p, maxBooksPerStudent: parseInt(e.target.value) || 3 }))
                }
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30 focus:border-bce-cobalt font-bold text-bce-navy"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                How many books a student can borrow simultaneously.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Max Borrow Days
              </label>
              <input
                type="number"
                min={1}
                max={90}
                value={settingsForm.maxBorrowDays}
                onChange={(e) =>
                  setSettingsForm((p) => ({ ...p, maxBorrowDays: parseInt(e.target.value) || 15 }))
                }
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30 focus:border-bce-cobalt font-bold text-bce-navy"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                After this many days, the book becomes overdue.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Fine per Day (₹)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={settingsForm.finePerDay}
                onChange={(e) =>
                  setSettingsForm((p) => ({ ...p, finePerDay: parseFloat(e.target.value) || 0 }))
                }
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30 focus:border-bce-cobalt font-bold text-bce-navy"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Charge per day for late book returns. Set to 0 for no fine.
              </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/80">
              <div>
                <p className="text-xs font-bold text-slate-900">Library Enabled</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Students can see and borrow books.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsForm((p) => ({ ...p, isEnabled: !p.isEnabled }))}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                  settingsForm.isEnabled ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    settingsForm.isEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* ─── Operating Timing Controls ─── */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  Library Operating Schedule &amp; Timing Control
                </h5>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Restricts students from submitting book borrow registration outside working hours.
                </p>
              </div>

              {/* Timing Enforcement Toggle */}
              <div className="flex items-center gap-2.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-700">Enforce Timing:</span>
                <button
                  type="button"
                  onClick={() =>
                    setSettingsForm((p) => ({ ...p, isTimingEnforced: !p.isTimingEnforced }))
                  }
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                    settingsForm.isTimingEnforced ? 'bg-amber-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      settingsForm.isTimingEnforced ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Live IST Status indicator banner */}
            {(() => {
              const preview = (() => {
                if (!settingsForm.isTimingEnforced) {
                  return {
                    isOpen: true,
                    text: '24/7 OPEN • Timing restrictions are currently OFF',
                    color: 'text-emerald-800 bg-emerald-50 border-emerald-200',
                  };
                }
                try {
                  const now = new Date();
                  const formatter = new Intl.DateTimeFormat('en-US', {
                    timeZone: 'Asia/Kolkata',
                    weekday: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  });
                  const parts = formatter.formatToParts(now);
                  const day = parts.find((p) => p.type === 'weekday')?.value || '';
                  const hour = parts.find((p) => p.type === 'hour')?.value || '00';
                  const minute = parts.find((p) => p.type === 'minute')?.value || '00';
                  const currentTimeStr = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;

                  const isDayActive = settingsForm.operatingDays.includes(day);
                  const isWithinHours =
                    currentTimeStr >= settingsForm.operatingStartTime &&
                    currentTimeStr < settingsForm.operatingEndTime;

                  if (!isDayActive) {
                    return {
                      isOpen: false,
                      text: `CLOSED TODAY (${day.toUpperCase()}) • Allowed days: ${settingsForm.operatingDays.map((d) => d.slice(0, 3)).join(', ')}`,
                      color: 'text-rose-800 bg-rose-50 border-rose-200',
                    };
                  }
                  if (!isWithinHours) {
                    return {
                      isOpen: false,
                      text: `CURRENTLY CLOSED (${formatTime12(currentTimeStr)} IST) • Operating window: ${formatTime12(settingsForm.operatingStartTime)} – ${formatTime12(settingsForm.operatingEndTime)} IST`,
                      color: 'text-rose-800 bg-rose-50 border-rose-200',
                    };
                  }
                  return {
                    isOpen: true,
                    text: `CURRENTLY OPEN (${formatTime12(currentTimeStr)} IST) • Closes at ${formatTime12(settingsForm.operatingEndTime)} IST`,
                    color: 'text-emerald-800 bg-emerald-50 border-emerald-200',
                  };
                } catch {
                  return {
                    isOpen: true,
                    text: 'Operating in Asia/Kolkata (IST)',
                    color: 'text-blue-800 bg-blue-50 border-blue-200',
                  };
                }
              })();

              return (
                <div
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${preview.color}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        preview.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                      }`}
                    />
                    <span>{preview.text}</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-75">Asia/Kolkata (IST)</span>
                </div>
              );
            })()}

            {/* Operating Days */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Operating Days
                </label>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() =>
                      setSettingsForm((p) => ({
                        ...p,
                        operatingDays: [
                          'Monday',
                          'Tuesday',
                          'Wednesday',
                          'Thursday',
                          'Friday',
                          'Saturday',
                        ],
                      }))
                    }
                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                  >
                    Mon – Sat (Standard)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSettingsForm((p) => ({
                        ...p,
                        operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                      }))
                    }
                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                  >
                    Mon – Fri
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSettingsForm((p) => ({
                        ...p,
                        operatingDays: [...DAYS_OF_WEEK],
                      }))
                    }
                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                  >
                    All 7 Days
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
                {DAYS_OF_WEEK.map((day) => {
                  const isChecked = settingsForm.operatingDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        setSettingsForm((p) => {
                          const has = p.operatingDays.includes(day);
                          if (has) {
                            if (p.operatingDays.length <= 1) return p;
                            return { ...p, operatingDays: p.operatingDays.filter((d) => d !== day) };
                          }
                          return { ...p, operatingDays: [...p.operatingDays, day] };
                        });
                      }}
                      className={`p-2 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-bce-navy text-white border-bce-navy shadow-xs'
                          : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Operating Hours Window (Start & End Time) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Opening Time (IST)
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={settingsForm.operatingStartTime}
                    onChange={(e) =>
                      setSettingsForm((p) => ({ ...p, operatingStartTime: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 font-mono font-bold text-bce-navy"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Displays as: {formatTime12(settingsForm.operatingStartTime)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Closing Time (IST)
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={settingsForm.operatingEndTime}
                    onChange={(e) =>
                      setSettingsForm((p) => ({ ...p, operatingEndTime: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 font-mono font-bold text-bce-navy"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Displays as: {formatTime12(settingsForm.operatingEndTime)}
                  </span>
                </div>
              </div>
            </div>

            {/* Custom Closure Notice */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Custom Off-Hours Student Notice
              </label>
              <textarea
                rows={2}
                value={settingsForm.timingClosureMessage}
                onChange={(e) =>
                  setSettingsForm((p) => ({ ...p, timingClosureMessage: e.target.value }))
                }
                placeholder="Message displayed to students when book registration is closed..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-slate-700 resize-none"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                Shown to students in the public library page outside allowed operating hours.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={actionLoading === 'settings'}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-bce-navy text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {actionLoading === 'settings' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
              )}
              Save Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
