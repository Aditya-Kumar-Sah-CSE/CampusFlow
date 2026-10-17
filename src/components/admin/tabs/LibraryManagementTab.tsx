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
} from 'lucide-react';
import type { LibraryBook, BorrowRequest, LibrarySettings, LibraryStats } from '@/types/library';
import { ExamPadCard } from '@/components/ui/ExamPadCard';
import { PinnedRosterBoard } from '@/components/ui/PinnedRosterBoard';

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
    const cacheKey = `campusflow_admin_lib_${activeCollegeId}`;
    try {
      const cached = typeof window !== 'undefined' ? sessionStorage.getItem(cacheKey) : null;
      if (cached) {
        const data = JSON.parse(cached);
        setSettings(data.settings);
        setBooks(data.books || []);
        setRequests(data.requests || []);
        setStats(data.stats);
        setLoading(false);
      } else {
        setLoading(true);
      }
    } catch {
      setLoading(true);
    }

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
      try {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKey, JSON.stringify(data));
        }
      } catch {}
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
      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 p-6 rounded-[3px] text-amber-900 dark:text-amber-200 text-xs space-y-2">
        <p className="font-bold text-sm">No Active Institution Selected</p>
        <p>Please switch to a specific college to manage its library.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#1f150c] p-8 rounded-[3px] border border-slate-200 dark:border-[#4d3817] shadow-xs animate-pulse space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-200 dark:bg-[#2e1f10] rounded-[3px]" />
          <div className="space-y-2">
            <div className="h-5 w-48 bg-slate-200 dark:bg-[#2e1f10] rounded-[2px]" />
            <div className="h-3 w-72 bg-slate-100 dark:bg-[#2e1f10]/60 rounded-[2px]" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 dark:bg-[#2e1f10] rounded-[3px]" />
          ))}
        </div>
      </div>
    );
  }

  // ─── Not Initialized State ─────────────────────────────────────
  if (!settings?.booksSheetId || !settings?.borrowLogSheetId) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-[#1f150c] p-6 sm:p-8 rounded-[3px] border border-slate-200 dark:border-[#4d3817] shadow-xs text-center max-w-lg mx-auto space-y-4">
          <div className="w-14 h-14 rounded-[3px] bg-gradient-to-br from-amber-600 to-amber-800 text-amber-200 mx-auto flex items-center justify-center shadow-md border border-amber-500/40">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-[#faebd0]">Setup Library System</h3>
          <p className="text-xs text-slate-500 dark:text-[#c4a97d] leading-relaxed">
            Initialize the library module to create Google Sheets for books inventory and borrow tracking.
            All data will be stored in your college&apos;s Google Drive.
          </p>
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-[3px] text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleInitialize}
            disabled={actionLoading === 'init'}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-600 text-white rounded-[3px] text-sm font-bold hover:bg-amber-700 transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            {actionLoading === 'init' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 text-amber-300" />
            )}
            {actionLoading === 'init' ? 'Setting up...' : 'Initialize Library'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5 w-full max-w-full min-w-0">
      {/* Header on Authentic Exam Pad Card */}
      <ExamPadCard
        variant="dashboard"
        title="Library Management"
        subtitle="Manage physical book catalog, track student borrow & return slips, and configure operating schedules."
        icon={<BookOpen className="w-5 h-5 text-bce-cobalt" />}
        badge="COLLEGE LIBRARY"
        action={
          <button
            type="button"
            onClick={fetchLibraryData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-[#faebd0] bg-slate-100 dark:bg-[#1a1309] hover:bg-slate-200 dark:hover:bg-[#2a1d10] border border-slate-300 dark:border-[#4d3817] rounded-[3px] transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        }
      >
        <div className="text-xs text-slate-600 dark:text-[#c4a97d] flex items-center justify-between flex-wrap gap-2 pt-1">
          <span>Official institutional library inventory, lending logs, and timing controls.</span>
          <span className="font-mono text-[11px] text-amber-800 dark:text-amber-400 font-bold">
            Total Titles: {books.length} • Active Requests: {requests.length}
          </span>
        </div>
      </ExamPadCard>

      {/* Notifications */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-[3px] text-xs text-red-700 dark:text-red-300 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-[3px] text-xs text-emerald-700 dark:text-emerald-300 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Sub-tab Navigation - Sharp Physical Document Bar */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar bg-slate-100/90 dark:bg-[#1a1309] p-1.5 rounded-[3px] border border-slate-200/90 dark:border-[#4d3817]">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          const isCurrent = subView === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubView(tab.id)}
              className={`px-3 py-1.5 rounded-[3px] text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer select-none ${
                isCurrent
                  ? 'bg-white dark:bg-[#2a1d10] text-amber-900 dark:text-amber-300 shadow-xs border border-amber-600/30'
                  : 'text-slate-600 dark:text-[#c4a97d] hover:text-slate-900 dark:hover:text-[#faebd0] hover:bg-white/60 dark:hover:bg-[#1f150c]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="px-1.5 py-0.2 rounded-[2px] text-[9px] font-extrabold bg-amber-500 text-slate-950 shadow-2xs">
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
          {/* Stats Cards - Sharp Physical Paper Tokens */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            {[
              { label: 'Total Books', value: stats?.totalBooks ?? 0, icon: Package, color: 'text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-950/40 border-blue-200/80 dark:border-blue-800/60' },
              { label: 'Available', value: stats?.totalAvailable ?? 0, icon: BookOpen, color: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200/80 dark:border-emerald-800/60' },
              { label: 'Borrowed', value: stats?.totalBorrowed ?? 0, icon: BookMarked, color: 'text-amber-700 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/40 border-amber-200/80 dark:border-amber-800/60' },
              { label: 'Pending', value: stats?.pendingRequests ?? 0, icon: Clock, color: 'text-orange-700 dark:text-orange-300 bg-orange-50/70 dark:bg-orange-950/40 border-orange-200/80 dark:border-orange-800/60' },
              { label: 'Overdue', value: stats?.overdueBooks ?? 0, icon: AlertCircle, color: 'text-red-700 dark:text-red-300 bg-red-50/70 dark:bg-red-950/40 border-red-200/80 dark:border-red-800/60' },
              { label: 'Fines Collected', value: `₹${stats?.totalFineCollected ?? 0}`, icon: IndianRupee, color: 'text-purple-700 dark:text-purple-300 bg-purple-50/70 dark:bg-purple-950/40 border-purple-200/80 dark:border-purple-800/60' },
            ].map((stat) => {
              const StatIcon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className={`p-3 sm:p-3.5 rounded-[3px] border ${stat.color} space-y-1 relative overflow-hidden`}
                >
                  <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-600/40 pointer-events-none" />
                  <div className="flex items-center gap-1.5">
                    <StatIcon className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{stat.label}</span>
                  </div>
                  <p className="text-lg sm:text-xl font-extrabold">{stat.value}</p>
                </div>
              );
            })}
          </div>

          {/* Active Rules Card */}
          <div className="bg-white dark:bg-[#1f150c] p-4 rounded-[3px] border border-slate-200/90 dark:border-[#4d3817] shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-500 dark:text-[#c4a97d] uppercase tracking-wider">Active Library Rules</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 dark:bg-[#1a1309] rounded-[3px] border border-slate-200/80 dark:border-[#382713] text-center">
                <p className="text-[10px] text-slate-400 dark:text-[#c4a97d]/70 font-bold uppercase">Max Books / Student</p>
                <p className="text-xl font-extrabold text-slate-900 dark:text-[#faebd0] mt-1">{settings?.maxBooksPerStudent ?? 3}</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-[#1a1309] rounded-[3px] border border-slate-200/80 dark:border-[#382713] text-center">
                <p className="text-[10px] text-slate-400 dark:text-[#c4a97d]/70 font-bold uppercase">Max Borrow Days</p>
                <p className="text-xl font-extrabold text-slate-900 dark:text-[#faebd0] mt-1">{settings?.maxBorrowDays ?? 15}</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-[#1a1309] rounded-[3px] border border-slate-200/80 dark:border-[#382713] text-center">
                <p className="text-[10px] text-slate-400 dark:text-[#c4a97d]/70 font-bold uppercase">Late Fine / Day</p>
                <p className="text-xl font-extrabold text-slate-900 dark:text-[#faebd0] mt-1">₹{settings?.finePerDay ?? 5}</p>
              </div>
            </div>
          </div>

          {/* Recent Pending Requests on Pinned Board */}
          {requests.filter((r) => r.status === 'PENDING').length > 0 && (
            <PinnedRosterBoard
              title="Pending Borrow Approvals"
              subtitle="Student book check-out slips waiting for administrator authorization"
              badge={`${requests.filter((r) => r.status === 'PENDING').length} PENDING`}
              icon={<Clock className="w-4 h-4" />}
              className="w-full"
            >
              <div className="p-3 sm:p-4 space-y-2.5">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-[#382713]">
                  <span className="text-[11px] text-slate-500 dark:text-[#c4a97d]">
                    Immediate action required
                  </span>
                  <button
                    onClick={() => setSubView('requests')}
                    className="text-xs font-bold text-amber-800 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    View All In Ledger →
                  </button>
                </div>
                <div className="space-y-2">
                  {requests
                    .filter((r) => r.status === 'PENDING')
                    .slice(0, 5)
                    .map((req) => (
                      <div
                        key={req.id}
                        className="flex items-center justify-between p-3 bg-amber-50/60 dark:bg-[#25180c] rounded-[3px] border border-amber-200/80 dark:border-amber-800/60"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-[#faebd0] truncate">{req.studentName}</p>
                          <p className="text-[11px] text-slate-500 dark:text-[#c4a97d] truncate">
                            {req.bookTitle} — {req.bookAuthor}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleRequestAction(req.id, 'approve')}
                            disabled={actionLoading === `approve-${req.id}`}
                            className="p-1.5 rounded-[3px] bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50"
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
                            className="p-1.5 rounded-[3px] bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
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
            </PinnedRosterBoard>
          )}
        </div>
      )}

      {/* ══════════════════════ BOOKS VIEW ══════════════════════════ */}
      {subView === 'books' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search books by title or author..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-4 py-2 text-xs rounded-[3px] border border-slate-200/90 dark:border-[#4d3817] bg-white dark:bg-[#1a1309] text-slate-800 dark:text-[#faebd0] placeholder:text-slate-400 dark:placeholder:text-[#c4a97d]/50 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowAddBook(!showAddBook)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 text-white rounded-[3px] text-xs font-bold hover:bg-amber-700 transition-all cursor-pointer shadow-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              {showAddBook ? 'Close Form' : 'Add Book'}
            </button>
          </div>

          {/* Add Book Form on Exam Pad Card */}
          {showAddBook && (
            <ExamPadCard
              variant="dashboard"
              title="Add New Book to Catalog"
              subtitle="Register a new academic title or physical volume into the institutional library."
              icon={<Plus className="w-4 h-4 text-amber-500" />}
              badge="INVENTORY ENTRY"
            >
              <form onSubmit={handleAddBook} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-[#c4a97d] uppercase tracking-wider mb-1">
                      Book Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={bookForm.title}
                      onChange={(e) => setBookForm((p) => ({ ...p, title: e.target.value }))}
                      className="w-full px-3 py-2 text-xs rounded-[3px] border border-slate-200/90 dark:border-[#4d3817] bg-white dark:bg-[#1a1309] text-slate-800 dark:text-[#faebd0] focus:outline-none focus:ring-1 focus:ring-amber-500"
                      placeholder="e.g. Data Structures & Algorithms"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-[#c4a97d] uppercase tracking-wider mb-1">
                      Author *
                    </label>
                    <input
                      type="text"
                      required
                      value={bookForm.author}
                      onChange={(e) => setBookForm((p) => ({ ...p, author: e.target.value }))}
                      className="w-full px-3 py-2 text-xs rounded-[3px] border border-slate-200/90 dark:border-[#4d3817] bg-white dark:bg-[#1a1309] text-slate-800 dark:text-[#faebd0] focus:outline-none focus:ring-1 focus:ring-amber-500"
                      placeholder="e.g. Thomas H. Cormen"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-[#c4a97d] uppercase tracking-wider mb-1">ISBN</label>
                    <input
                      type="text"
                      value={bookForm.isbn}
                      onChange={(e) => setBookForm((p) => ({ ...p, isbn: e.target.value }))}
                      className="w-full px-3 py-2 text-xs rounded-[3px] border border-slate-200/90 dark:border-[#4d3817] bg-white dark:bg-[#1a1309] text-slate-800 dark:text-[#faebd0] focus:outline-none focus:ring-1 focus:ring-amber-500"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-[#c4a97d] uppercase tracking-wider mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      value={bookForm.category}
                      onChange={(e) => setBookForm((p) => ({ ...p, category: e.target.value }))}
                      className="w-full px-3 py-2 text-xs rounded-[3px] border border-slate-200/90 dark:border-[#4d3817] bg-white dark:bg-[#1a1309] text-slate-800 dark:text-[#faebd0] focus:outline-none focus:ring-1 focus:ring-amber-500"
                      placeholder="e.g. Computer Science"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-[#c4a97d] uppercase tracking-wider mb-1">
                      Total Copies
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={bookForm.totalCopies}
                      onChange={(e) => setBookForm((p) => ({ ...p, totalCopies: parseInt(e.target.value) || 1 }))}
                      className="w-full px-3 py-2 text-xs rounded-[3px] border border-slate-200/90 dark:border-[#4d3817] bg-white dark:bg-[#1a1309] text-slate-800 dark:text-[#faebd0] focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={actionLoading === 'add-book'}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-[3px] text-xs font-bold hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading === 'add-book' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Add Book
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddBook(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-[#c4a97d] hover:text-slate-700 dark:hover:text-[#faebd0] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </ExamPadCard>
          )}

          {/* Books Table on Pinned Roster Board */}
          <PinnedRosterBoard
            title={`Books Inventory Catalog (${filteredBooks.length})`}
            subtitle="Master physical catalog of books in the institution library"
            badge={`${books.length} TITLES`}
            icon={<BookMarked className="w-4 h-4" />}
            className="w-full"
          >
            {filteredBooks.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-[#c4a97d]">
                <BookOpen className="w-8 h-8 text-slate-300 dark:text-[#c4a97d]/40 mx-auto mb-2" />
                <p className="font-bold text-slate-700 dark:text-[#faebd0]">No books found</p>
                <p>Add books to your library inventory to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-[#1a1309] border-b border-slate-200/80 dark:border-[#382713]">
                      <th className="text-left px-4 py-2.5 font-bold text-slate-600 dark:text-[#c4a97d] uppercase tracking-wider text-[10px]">Title</th>
                      <th className="text-left px-4 py-2.5 font-bold text-slate-600 dark:text-[#c4a97d] uppercase tracking-wider text-[10px]">Author</th>
                      <th className="text-left px-4 py-2.5 font-bold text-slate-600 dark:text-[#c4a97d] uppercase tracking-wider text-[10px]">Category</th>
                      <th className="text-center px-4 py-2.5 font-bold text-slate-600 dark:text-[#c4a97d] uppercase tracking-wider text-[10px]">Total</th>
                      <th className="text-center px-4 py-2.5 font-bold text-slate-600 dark:text-[#c4a97d] uppercase tracking-wider text-[10px]">Available</th>
                      <th className="text-center px-4 py-2.5 font-bold text-slate-600 dark:text-[#c4a97d] uppercase tracking-wider text-[10px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#382713]">
                    {filteredBooks.map((book) => (
                      <tr key={book.id} className="hover:bg-amber-50/30 dark:hover:bg-[#25180c]/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-[#faebd0]">{book.title}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-[#c4a97d]">{book.author}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-[#c4a97d]/80">{book.category || '—'}</td>
                        <td className="px-4 py-3 text-center font-bold text-slate-800 dark:text-[#faebd0]">{book.totalCopies}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-[2px] text-[10px] font-bold ${
                              book.availableCopies > 0
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                                : 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/60'
                            }`}
                          >
                            {book.availableCopies}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleDeleteBook(book.id, book.title)}
                            disabled={actionLoading === `del-${book.id}`}
                            className="p-1.5 rounded-[3px] text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 border border-slate-200/80 dark:border-[#4d3817] transition-colors cursor-pointer disabled:opacity-50"
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
          </PinnedRosterBoard>
        </div>
      )}

      {/* ══════════════════════ REQUESTS VIEW ══════════════════════ */}
      {subView === 'requests' && (
        <PinnedRosterBoard
          title={`Borrow & Return Requests (${filteredRequests.length})`}
          subtitle="Official student check-out requests and return verifications"
          badge={`${requests.length} REQUESTS`}
          icon={<Users className="w-4 h-4" />}
          className="w-full"
        >
          <div className="p-3 sm:p-4 border-b border-slate-200/80 dark:border-[#382713] bg-slate-50/70 dark:bg-[#1f150c]/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'RETURNED', 'OVERDUE'].map((f) => (
              <button
                key={f}
                onClick={() => setRequestFilter(f)}
                className={`px-3 py-1.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap cursor-pointer ${
                  requestFilter === f
                    ? 'bg-amber-500 text-slate-950 shadow-2xs border border-amber-600/50'
                    : 'bg-white dark:bg-[#1a1309] text-slate-600 dark:text-[#faebd0] border border-slate-200/90 dark:border-[#4d3817] hover:bg-slate-100 dark:hover:bg-[#2a1d10]'
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

          <div className="p-3.5 sm:p-4 space-y-2.5">
            {filteredRequests.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-[#c4a97d]">
                <Users className="w-8 h-8 text-slate-300 dark:text-[#c4a97d]/40 mx-auto mb-2" />
                <p className="font-bold text-slate-700 dark:text-[#faebd0]">No requests found</p>
                <p>No borrow requests matching this filter.</p>
              </div>
            ) : (
              filteredRequests.map((req) => {
                const isOverdue =
                  req.status === 'APPROVED' && req.dueDate && new Date(req.dueDate) < new Date();
                return (
                  <div
                    key={req.id}
                    className={`bg-white dark:bg-[#1f150c] p-3.5 sm:p-4 rounded-[3px] border shadow-xs transition-all relative overflow-hidden ${
                      isOverdue
                        ? 'border-red-300 dark:border-red-800 bg-red-50/30 dark:bg-red-950/30'
                        : 'border-slate-200/90 dark:border-[#4d3817]'
                    }`}
                  >
                    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-600/40 pointer-events-none" />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900 dark:text-[#faebd0]">{req.studentName}</p>
                          <span
                            className={`px-2 py-0.5 rounded-[2px] text-[9px] font-extrabold uppercase ${
                              req.status === 'PENDING'
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                                : req.status === 'APPROVED'
                                ? isOverdue
                                  ? 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/60'
                                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                                : req.status === 'REJECTED'
                                ? 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/60'
                                : req.status === 'RETURNED'
                                ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60'
                                : 'bg-slate-100 dark:bg-[#2e1f10] text-slate-800 dark:text-[#faebd0] border border-slate-200 dark:border-[#4d3817]'
                            }`}
                          >
                            {isOverdue ? 'OVERDUE' : req.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-[#c4a97d]">
                          📚 {req.bookTitle} — <span className="text-slate-400 dark:text-[#c4a97d]/70">{req.bookAuthor}</span>
                        </p>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-[#c4a97d]/70 flex-wrap">
                          {req.studentEmail && <span>✉ {req.studentEmail}</span>}
                          {req.studentPhone && <span>📱 {req.studentPhone}</span>}
                          <span>Requested: {new Date(req.requestedAt).toLocaleDateString('en-IN')}</span>
                          {req.dueDate && (
                            <span className={isOverdue ? 'text-red-600 dark:text-red-400 font-bold' : ''}>
                              Due: {new Date(req.dueDate).toLocaleDateString('en-IN')}
                            </span>
                          )}
                          {req.fineAmount !== undefined && req.fineAmount > 0 && (
                            <span className="text-red-600 dark:text-red-400 font-bold">Fine: ₹{req.fineAmount}</span>
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
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-[3px] text-[10px] font-bold hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50"
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
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-[3px] text-[10px] font-bold hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
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
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-[3px] text-[10px] font-bold hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50"
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
        </PinnedRosterBoard>
      )}

      {/* ══════════════════════ SETTINGS VIEW ══════════════════════ */}
      {subView === 'settings' && (
        <ExamPadCard
          variant="dashboard"
          title="Library Configuration & Operating Schedule"
          subtitle="These rules are enforced automatically. Students cannot exceed these limits."
          icon={<Settings className="w-4 h-4 text-amber-500" />}
          badge="RULES CONFIG"
          className="max-w-3xl"
        >
          <div className="space-y-5 text-slate-800 dark:text-[#faebd0]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-[#c4a97d] uppercase tracking-wider mb-1">
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
                  className="w-full px-3 py-2 text-sm rounded-[3px] border border-slate-200/90 dark:border-[#4d3817] bg-white dark:bg-[#1a1309] focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold text-slate-900 dark:text-[#faebd0]"
                />
                <p className="text-[10px] text-slate-400 dark:text-[#c4a97d]/70 mt-1">
                  How many books a student can borrow simultaneously.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-[#c4a97d] uppercase tracking-wider mb-1">
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
                  className="w-full px-3 py-2 text-sm rounded-[3px] border border-slate-200/90 dark:border-[#4d3817] bg-white dark:bg-[#1a1309] focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold text-slate-900 dark:text-[#faebd0]"
                />
                <p className="text-[10px] text-slate-400 dark:text-[#c4a97d]/70 mt-1">
                  After this many days, the book becomes overdue.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-[#c4a97d] uppercase tracking-wider mb-1">
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
                  className="w-full px-3 py-2 text-sm rounded-[3px] border border-slate-200/90 dark:border-[#4d3817] bg-white dark:bg-[#1a1309] focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold text-slate-900 dark:text-[#faebd0]"
                />
                <p className="text-[10px] text-slate-400 dark:text-[#c4a97d]/70 mt-1">
                  Charge per day for late book returns. Set to 0 for no fine.
                </p>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-[#1a1309] rounded-[3px] border border-slate-200/80 dark:border-[#382713]">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-[#faebd0]">Library Enabled</p>
                  <p className="text-[10px] text-slate-500 dark:text-[#c4a97d] mt-0.5">
                    Students can see and borrow books.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSettingsForm((p) => ({ ...p, isEnabled: !p.isEnabled }))}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                    settingsForm.isEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
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

            {/* Operating Timing Controls */}
            <div className="pt-4 border-t border-slate-200/80 dark:border-[#382713] space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h5 className="text-xs font-bold text-slate-900 dark:text-[#faebd0] flex items-center gap-1.5 uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    Library Operating Schedule &amp; Timing Control
                  </h5>
                  <p className="text-[11px] text-slate-500 dark:text-[#c4a97d] mt-0.5">
                    Restricts students from submitting book borrow registration outside working hours.
                  </p>
                </div>

                {/* Timing Enforcement Toggle */}
                <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-[#1a1309] px-3 py-1.5 rounded-[3px] border border-slate-200/80 dark:border-[#382713]">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-[#faebd0]">Enforce Timing:</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSettingsForm((p) => ({ ...p, isTimingEnforced: !p.isTimingEnforced }))
                    }
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                      settingsForm.isTimingEnforced ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
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
                      color: 'text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/60',
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
                        color: 'text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800/60',
                      };
                    }
                    if (!isWithinHours) {
                      return {
                        isOpen: false,
                        text: `CURRENTLY CLOSED (${formatTime12(currentTimeStr)} IST) • Operating window: ${formatTime12(settingsForm.operatingStartTime)} – ${formatTime12(settingsForm.operatingEndTime)} IST`,
                        color: 'text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800/60',
                      };
                    }
                    return {
                      isOpen: true,
                      text: `CURRENTLY OPEN (${formatTime12(currentTimeStr)} IST) • Closes at ${formatTime12(settingsForm.operatingEndTime)} IST`,
                      color: 'text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/60',
                    };
                  } catch {
                    return {
                      isOpen: true,
                      text: 'Operating in Asia/Kolkata (IST)',
                      color: 'text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800/60',
                    };
                  }
                })();

                return (
                  <div
                    className={`p-3 rounded-[3px] border text-xs font-semibold flex items-center justify-between gap-2 ${preview.color}`}
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
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-[#c4a97d] uppercase tracking-wider">
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
                      className="px-2 py-0.5 rounded-[2px] bg-slate-100 dark:bg-[#1a1309] hover:bg-slate-200 dark:hover:bg-[#2a1d10] text-slate-700 dark:text-[#faebd0] border border-slate-200/80 dark:border-[#4d3817] font-semibold cursor-pointer"
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
                      className="px-2 py-0.5 rounded-[2px] bg-slate-100 dark:bg-[#1a1309] hover:bg-slate-200 dark:hover:bg-[#2a1d10] text-slate-700 dark:text-[#faebd0] border border-slate-200/80 dark:border-[#4d3817] font-semibold cursor-pointer"
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
                      className="px-2 py-0.5 rounded-[2px] bg-slate-100 dark:bg-[#1a1309] hover:bg-slate-200 dark:hover:bg-[#2a1d10] text-slate-700 dark:text-[#faebd0] border border-slate-200/80 dark:border-[#4d3817] font-semibold cursor-pointer"
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
                        className={`p-2 rounded-[3px] text-xs font-bold text-center border transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                            : 'bg-white dark:bg-[#1a1309] text-slate-400 dark:text-[#c4a97d] border-slate-200/90 dark:border-[#4d3817] hover:border-amber-500/50'
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
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-[#c4a97d] uppercase tracking-wider mb-1">
                    Opening Time (IST)
                  </label>
                  <div className="relative">
                    <input
                      type="time"
                      value={settingsForm.operatingStartTime}
                      onChange={(e) =>
                        setSettingsForm((p) => ({ ...p, operatingStartTime: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm rounded-[3px] border border-slate-200/90 dark:border-[#4d3817] bg-white dark:bg-[#1a1309] text-slate-900 dark:text-[#faebd0] focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono font-bold"
                    />
                    <span className="text-[10px] text-slate-400 dark:text-[#c4a97d]/70 mt-1 block">
                      Displays as: {formatTime12(settingsForm.operatingStartTime)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-[#c4a97d] uppercase tracking-wider mb-1">
                    Closing Time (IST)
                  </label>
                  <div className="relative">
                    <input
                      type="time"
                      value={settingsForm.operatingEndTime}
                      onChange={(e) =>
                        setSettingsForm((p) => ({ ...p, operatingEndTime: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm rounded-[3px] border border-slate-200/90 dark:border-[#4d3817] bg-white dark:bg-[#1a1309] text-slate-900 dark:text-[#faebd0] focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono font-bold"
                    />
                    <span className="text-[10px] text-slate-400 dark:text-[#c4a97d]/70 mt-1 block">
                      Displays as: {formatTime12(settingsForm.operatingEndTime)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Custom Closure Notice */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-[#c4a97d] uppercase tracking-wider mb-1">
                  Custom Off-Hours Student Notice
                </label>
                <textarea
                  rows={2}
                  value={settingsForm.timingClosureMessage}
                  onChange={(e) =>
                    setSettingsForm((p) => ({ ...p, timingClosureMessage: e.target.value }))
                  }
                  placeholder="Message displayed to students when book registration is closed..."
                  className="w-full px-3 py-2 text-xs rounded-[3px] border border-slate-200/90 dark:border-[#4d3817] bg-white dark:bg-[#1a1309] text-slate-700 dark:text-[#faebd0] focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                />
                <p className="text-[10px] text-slate-400 dark:text-[#c4a97d]/70 mt-0.5">
                  Shown to students in the public library page outside allowed operating hours.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={actionLoading === 'settings'}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-600 text-white rounded-[3px] text-sm font-bold hover:bg-amber-700 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {actionLoading === 'settings' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-amber-200" />
                )}
                Save Settings
              </button>
            </div>
          </div>
        </ExamPadCard>
      )}
    </div>
  );
}
