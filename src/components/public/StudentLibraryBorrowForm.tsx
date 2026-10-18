'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  CreditCard,
  AlertTriangle,
  Lock,
  Sparkles,
  Layers,
  Grid,
  ShieldCheck,
  Check,
  X,
  Compass,
} from 'lucide-react';
import type { LibraryBook, LibraryTimingCheckResult } from '@/types/library';
import { VirtualLibraryCard } from '@/components/library/VirtualLibraryCard';
import { useStudentSession } from '@/lib/auth/use-student-session';

interface Props {
  collegeId: string;
  collegeName?: string;
  collegeLogoUrl?: string | null;
  collegeSlug?: string;
}

// ─── Default Curated Books (Instant zero-flicker catalogue) ───────
const CURATED_DEFAULT_BOOKS: LibraryBook[] = [
  {
    id: 'BK-CORE-001',
    title: 'Higher Engineering Mathematics',
    author: 'Dr. B. S. Grewal',
    isbn: '978-8193328491',
    category: 'Mathematics',
    totalCopies: 8,
    availableCopies: 6,
    addedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'BK-CORE-002',
    title: 'Introduction to Algorithms (CLRS)',
    author: 'Thomas H. Cormen, Charles E. Leiserson',
    isbn: '978-0262033848',
    category: 'Computer Science',
    totalCopies: 6,
    availableCopies: 4,
    addedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'BK-CORE-003',
    title: 'Database System Concepts',
    author: 'Abraham Silberschatz, Henry F. Korth',
    isbn: '978-0078022159',
    category: 'Computer Science',
    totalCopies: 5,
    availableCopies: 3,
    addedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'BK-CORE-004',
    title: 'Operating System Concepts',
    author: 'Abraham Silberschatz, Peter B. Galvin',
    isbn: '978-1118063330',
    category: 'Computer Science',
    totalCopies: 7,
    availableCopies: 5,
    addedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'BK-CORE-005',
    title: 'Theory of Machines',
    author: 'R. S. Khurmi & J. K. Gupta',
    isbn: '978-8121925242',
    category: 'Mechanical',
    totalCopies: 6,
    availableCopies: 4,
    addedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'BK-CORE-006',
    title: 'Basic Electrical Engineering',
    author: 'D. C. Kulshreshtha',
    isbn: '978-0070147386',
    category: 'Electrical',
    totalCopies: 6,
    availableCopies: 5,
    addedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'BK-CORE-007',
    title: 'Digital Logic & Computer Design',
    author: 'M. Morris Mano',
    isbn: '978-9332542525',
    category: 'Electronics',
    totalCopies: 5,
    availableCopies: 4,
    addedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'BK-CORE-008',
    title: 'Engineering Mechanics: Statics & Dynamics',
    author: 'S. S. Bhavikatti',
    isbn: '978-9388818452',
    category: 'Civil & Mechanical',
    totalCopies: 7,
    availableCopies: 5,
    addedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'BK-CORE-009',
    title: 'Computer Networking: A Top-Down Approach',
    author: 'James F. Kurose, Keith W. Ross',
    isbn: '978-0133594140',
    category: 'Computer Science',
    totalCopies: 5,
    availableCopies: 3,
    addedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'BK-CORE-010',
    title: 'Concepts of Modern Physics',
    author: 'Arthur Beiser',
    isbn: '978-9351341857',
    category: 'Physics',
    totalCopies: 6,
    availableCopies: 4,
    addedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'BK-CORE-011',
    title: 'Artificial Intelligence: A Modern Approach',
    author: 'Stuart Russell, Peter Norvig',
    isbn: '978-0134610993',
    category: 'Computer Science',
    totalCopies: 4,
    availableCopies: 2,
    addedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'BK-CORE-012',
    title: 'Modern Control Engineering',
    author: 'Katsuhiko Ogata',
    isbn: '978-9332550162',
    category: 'Electrical',
    totalCopies: 5,
    availableCopies: 3,
    addedAt: '2026-01-01T00:00:00.000Z',
  },
];

// ─── 3D Spine Color Palettes for Authentic Physical Books ─────────
interface SpinePalette {
  spineGradient: string;
  coverGradient: string;
  spineEdge: string;
  foil: string;
  callNumberPrefix: string;
  ribbon: string;
}

const SPINE_PALETTES: SpinePalette[] = [
  {
    // Oxford Navy Leather
    spineGradient: 'linear-gradient(90deg, #071526 0%, #152c4a 24%, #22456e 50%, #132a48 76%, #071424 100%)',
    coverGradient: 'linear-gradient(135deg, #0f233d 0%, #1b3a63 60%, #0d1e35 100%)',
    spineEdge: '#091c33',
    foil: '#f7df94',
    callNumberPrefix: 'CS-10',
    ribbon: '#f59e0b',
  },
  {
    // Imperial Crimson / Burgundy
    spineGradient: 'linear-gradient(90deg, #300609 0%, #570e14 24%, #7d1720 50%, #500c12 76%, #280507 100%)',
    coverGradient: 'linear-gradient(135deg, #450a10 0%, #70131d 60%, #36070c 100%)',
    spineEdge: '#3b070b',
    foil: '#fef08a',
    callNumberPrefix: 'MA-20',
    ribbon: '#ef4444',
  },
  {
    // British Racing Forest Green
    spineGradient: 'linear-gradient(90deg, #072115 0%, #103c27 24%, #1b573a 50%, #0e3723 76%, #061c12 100%)',
    coverGradient: 'linear-gradient(135deg, #0d3020 0%, #174c33 60%, #092317 100%)',
    spineEdge: '#0a2b1c',
    foil: '#fef3c7',
    callNumberPrefix: 'EE-30',
    ribbon: '#10b981',
  },
  {
    // Antique Chestnut / Cognac Leather
    spineGradient: 'linear-gradient(90deg, #261206 0%, #47240d 24%, #663515 50%, #3f1f0a 76%, #1f0e04 100%)',
    coverGradient: 'linear-gradient(135deg, #381b09 0%, #5e3012 60%, #291306 100%)',
    spineEdge: '#301708',
    foil: '#fed7aa',
    callNumberPrefix: 'ME-40',
    ribbon: '#f97316',
  },
  {
    // Royal Byzantine Purple
    spineGradient: 'linear-gradient(90deg, #200b33 0%, #3d175e 24%, #5b248a 50%, #371454 76%, #1a082b 100%)',
    coverGradient: 'linear-gradient(135deg, #2f114a 0%, #501e7a 60%, #240c3a 100%)',
    spineEdge: '#280e3e',
    foil: '#f3e8ff',
    callNumberPrefix: 'AI-50',
    ribbon: '#a855f7',
  },
  {
    // Obsidian Charcoal Cloth
    spineGradient: 'linear-gradient(90deg, #13161c 0%, #242a35 24%, #373f4e 50%, #202530 76%, #101217 100%)',
    coverGradient: 'linear-gradient(135deg, #1a1e27 0%, #313847 60%, #14171e 100%)',
    spineEdge: '#171a22',
    foil: '#e2e8f0',
    callNumberPrefix: 'CV-60',
    ribbon: '#06b6d4',
  },
];

function getBookPalette(bookId: string, index: number): SpinePalette {
  const hash = bookId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + index;
  return SPINE_PALETTES[hash % SPINE_PALETTES.length];
}

function getBookHeight(bookId: string, index: number): number {
  const heights = [205, 218, 196, 222, 202, 214];
  const hash = bookId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + index;
  return heights[hash % heights.length];
}

function getBookThickness(bookId: string, index: number): number {
  const thicknesses = [42, 48, 40, 50, 44, 46];
  const hash = bookId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + index;
  return thicknesses[hash % thicknesses.length];
}

export function StudentLibraryBorrowForm({
  collegeId,
  collegeName,
  collegeLogoUrl,
  collegeSlug,
}: Props) {
  const { student, isAuthenticated } = useStudentSession();
  const [subView, setSubView] = useState<'catalog' | 'card'>('catalog');
  const [viewMode, setViewMode] = useState<'shelf' | 'grid'>('shelf');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize immediately with curated books so there is ZERO blank or missing UI
  const [books, setBooks] = useState<LibraryBook[]>(CURATED_DEFAULT_BOOKS);
  const [maxBooks, setMaxBooks] = useState(3);
  const [maxDays, setMaxDays] = useState(15);
  const [finePerDay, setFinePerDay] = useState(5);
  const [timing, setTiming] = useState<LibraryTimingCheckResult | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null);
  const [formData, setFormData] = useState({
    studentName: '',
    studentEmail: '',
    studentPhone: '',
  });

  // Autofill student details from active authenticated student session
  useEffect(() => {
    if (isAuthenticated && student) {
      setFormData((prev) => ({
        studentName: prev.studentName || student.fullName || '',
        studentEmail: prev.studentEmail || student.email || '',
        studentPhone: prev.studentPhone || '',
      }));
    }
  }, [isAuthenticated, student]);

  const fetchData = useCallback(async () => {
    const cacheKey = `campusflow_lib_data_${collegeId}`;
    try {
      const cached = typeof window !== 'undefined' ? sessionStorage.getItem(cacheKey) : null;
      if (cached) {
        const data = JSON.parse(cached);
        if (Array.isArray(data.books) && data.books.length > 0) {
          setBooks(data.books);
        }
        if (data.timing) setTiming(data.timing);
        if (data.settings) {
          setMaxBooks(data.settings.maxBooksPerStudent ?? 3);
          setMaxDays(data.settings.maxBorrowDays ?? 15);
          setFinePerDay(data.settings.finePerDay ?? 5);
        }
      }
    } catch {
      // non-fatal
    }

    try {
      const res = await fetch(`/api/library/borrow?collegeId=${collegeId}`);
      if (!res.ok) throw new Error('Failed to fetch library data');
      const data = await res.json();
      if (Array.isArray(data.books) && data.books.length > 0) {
        setBooks(data.books);
      }
      setTiming(data.timing || null);
      if (data.settings) {
        setMaxBooks(data.settings.maxBooksPerStudent ?? 3);
        setMaxDays(data.settings.maxBorrowDays ?? 15);
        setFinePerDay(data.settings.finePerDay ?? 5);
      }
      try {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKey, JSON.stringify(data));
        }
      } catch {}
    } catch (err: any) {
      console.warn('[StudentLibraryBorrowForm] API note:', err.message);
    }
  }, [collegeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Categories list extracted from books
  const categories = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      if (b.category) set.add(b.category);
    });
    return ['ALL', ...Array.from(set)];
  }, [books]);

  const filteredBooks = useMemo(() => {
    return books.filter((b) => {
      const matchQuery =
        b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.category && b.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (b.isbn && b.isbn.includes(searchQuery));
      const matchCat =
        selectedCategory === 'ALL' ||
        (b.category && b.category.toLowerCase() === selectedCategory.toLowerCase());
      return matchQuery && matchCat;
    });
  }, [books, searchQuery, selectedCategory]);

  const isTimingClosed = timing ? !timing.isOpen : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isTimingClosed) {
      setError(
        timing?.reason ||
          'Library circulation desk is closed. Borrow requests are accepted Mon–Sat between 10:00 AM and 04:00 PM IST.'
      );
      return;
    }
    if (!selectedBook || !formData.studentName.trim()) return;
    if (isAuthenticated && student?.collegeId && student.collegeId !== collegeId) {
      setError(
        `Borrowing from ${collegeName || 'this institution'} library is restricted to its enrolled students. You are registered with ${student.collegeName || 'another institution'}.`
      );
      return;
    }

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

  return (
    <div className="relative border-8 sm:border-[12px] border-[#38210f] dark:border-[#201105] rounded-2xl shadow-2xl bg-[#140b06] overflow-visible text-slate-100">
      {/* ─── Polished Brass Corner Brackets ─────────────────────────── */}
      <div className="absolute top-1 left-1 w-4 h-4 border-t-2 border-l-2 border-amber-400/80 pointer-events-none rounded-tl-xs z-30" />
      <div className="absolute top-1 right-1 w-4 h-4 border-t-2 border-r-2 border-amber-400/80 pointer-events-none rounded-tr-xs z-30" />
      <div className="absolute bottom-1 left-1 w-4 h-4 border-b-2 border-l-2 border-amber-400/80 pointer-events-none rounded-bl-xs z-30" />
      <div className="absolute bottom-1 right-1 w-4 h-4 border-b-2 border-r-2 border-amber-400/80 pointer-events-none rounded-br-xs z-30" />

      {/* ─── Library Cabinet Crown Header Bar ───────────────────────── */}
      <div className="bg-gradient-to-r from-[#2a140a] via-[#432212] to-[#2a140a] p-4 sm:p-6 border-b-2 border-amber-900/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[3px] bg-amber-950/80 text-amber-300 text-xs font-bold mb-1.5 border border-amber-600/40">
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>CAMPUS CENTRAL LIBRARY • ARCHIVAL WING</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-amber-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] flex items-center gap-2 font-serif">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            {collegeName ? `${collegeName} Library` : 'Central Archival Library'}
          </h2>
          <p className="text-xs sm:text-sm text-amber-200/80 font-medium mt-0.5">
            Browse 3D stacks, inspect physical volumes, and manage borrow requests.
          </p>
        </div>

        {/* Header Right Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {/* Subview Switcher */}
          <div className="inline-flex items-center p-1 rounded-xl bg-black/40 border border-amber-900/40 shadow-inner">
            <button
              type="button"
              onClick={() => setSubView('catalog')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                subView === 'catalog'
                  ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-md'
                  : 'text-amber-200/70 hover:text-amber-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>3D Stacks</span>
            </button>
            <button
              type="button"
              onClick={() => setSubView('card')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                subView === 'card'
                  ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-md'
                  : 'text-amber-200/70 hover:text-amber-100'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Library Card</span>
            </button>
          </div>

          {/* Operating Badge */}
          {timing && (
            <div className="px-3 py-1.5 rounded-xl bg-black/50 border border-amber-900/50 shadow-xs flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              {timing.isOpen ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Desk Open
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-rose-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  Desk Closed
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── VIRTUAL LIBRARY CARD VIEW ─────────────────────────────── */}
      {subView === 'card' ? (
        <div className="p-4 sm:p-6 bg-[#1a0e07]">
          <VirtualLibraryCard
            collegeId={collegeId}
            collegeSlug={collegeSlug}
            collegeName={collegeName}
            collegeLogoUrl={collegeLogoUrl}
            studentName={formData.studentName || student?.fullName}
            registrationNumber={student?.registrationNumber ?? undefined}
            rollNumber={student?.registrationNumber ?? undefined}
          />
        </div>
      ) : (
        /* ─── 3D BOOKSHELF & CIRCULATION VIEW ───────────────────────── */
        <div className="p-4 sm:p-6 space-y-5 bg-[#170c06]">
          {/* NOTICE: Operating hours alert (Never hides books! Explains that browsing is open) */}
          {isTimingClosed && (
            <div className="p-3.5 sm:p-4 rounded-xl bg-amber-950/80 border border-amber-700/60 text-amber-100 shadow-md flex items-start gap-3">
              <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <p className="font-bold text-amber-200">
                  Circulation Desk Closed (Mon–Sat 10:00 AM – 04:00 PM IST)
                </p>
                <p className="text-amber-300/80 text-[11px] leading-relaxed">
                  Physical book borrow requests are currently locked outside desk hours. However, all volumes in the 3D shelves below are completely accessible to browse, search, and inspect.
                </p>
              </div>
            </div>
          )}

          {/* Cross-Institution Notice */}
          {isAuthenticated && student?.collegeId && student.collegeId !== collegeId && (
            <div className="p-3.5 rounded-xl bg-amber-900/60 border border-amber-600/50 text-xs text-amber-200 flex items-start gap-2.5 shadow-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Inter-College Catalogue Mode</p>
                <p className="text-[11px] text-amber-300/80 mt-0.5">
                  You are viewing the catalogue for <strong>{collegeName}</strong> with an account from <strong>{student.collegeName}</strong>. You may browse all volumes; borrow requests are restricted to enrolled students.
                </p>
              </div>
            </div>
          )}

          {/* Library Lending Rules Strip & View Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-black/40 p-3 rounded-xl border border-amber-900/40 text-xs text-amber-200/80">
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-medium text-[11px] sm:text-xs">
              <span className="flex items-center gap-1.5">
                <BookMarked className="w-3.5 h-3.5 text-amber-400" />
                Borrow Limit: <strong className="text-amber-100">{maxBooks} Books</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Max Period: <strong className="text-amber-100">{maxDays} Days</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <IndianRupee className="w-3.5 h-3.5 text-amber-400" />
                Fine: <strong className="text-amber-100">₹{finePerDay}/day</strong>
              </span>
            </div>

            <div className="flex items-center gap-1 bg-black/50 p-1 rounded-lg border border-amber-950">
              <button
                type="button"
                onClick={() => setViewMode('shelf')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'shelf'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-200/60 hover:text-amber-100'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>3D Stacks</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-200/60 hover:text-amber-100'
                }`}
              >
                <Grid className="w-3 h-3" />
                <span>Index List</span>
              </button>
            </div>
          </div>

          {/* Search & Category Filter Toolbar */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400/60" />
              <input
                type="text"
                placeholder="Search volumes by title, author, category, or ISBN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm rounded-xl border border-amber-900/50 bg-[#120803] text-amber-100 placeholder:text-amber-300/40 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400/60 hover:text-amber-200 cursor-pointer p-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-sm ring-1 ring-amber-400/60'
                      : 'bg-black/40 text-amber-200/70 hover:text-amber-100 border border-amber-950 hover:bg-black/60'
                  }`}
                >
                  {cat === 'ALL' ? '🏛️ All Stacks' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════
              THE 3D REAL WOODEN BOOKSHELF (NO CLIPPING, NATURAL ROTATION)
             ═════════════════════════════════════════════════════════ */}
          {viewMode === 'shelf' ? (
            <div className="rounded-2xl overflow-hidden shadow-2xl border-2 border-amber-950 bg-[#0f0703]">
              {/* Wooden Bookshelf Backing Wall with architectural wood panels */}
              <div
                className="relative p-4 sm:p-6"
                style={{
                  background:
                    'repeating-linear-gradient(90deg, #130904 0px, #1a0c06 40px, #0e0502 41px)',
                }}
              >
                {/* Ambient library lantern light from top */}
                <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-amber-500/15 via-amber-500/5 to-transparent pointer-events-none" />

                {filteredBooks.length === 0 ? (
                  <div className="py-16 text-center text-amber-300/60 space-y-2">
                    <BookOpen className="w-10 h-10 mx-auto text-amber-700/40" />
                    <p className="text-xs font-semibold">No volumes found matching your search.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('ALL');
                      }}
                      className="text-xs text-amber-400 hover:underline font-bold"
                    >
                      Reset filters to view all volumes
                    </button>
                  </div>
                ) : (
                  <div>
                    {/* The 3D Standing Books Row (With ample headroom to prevent any top clipping) */}
                    <div
                      className="flex items-end justify-start gap-2 sm:gap-3.5 overflow-x-auto pt-16 pb-1 px-3 min-h-[300px] scrollbar-thin scrollbar-thumb-amber-900/60 scrollbar-track-transparent"
                      style={{ perspective: '1100px', transformStyle: 'preserve-3d' }}
                    >
                      {filteredBooks.map((book, idx) => {
                        const isSelected = selectedBook?.id === book.id;
                        const palette = getBookPalette(book.id, idx);
                        const bookHeight = getBookHeight(book.id, idx);
                        const bookThickness = getBookThickness(book.id, idx);
                        const callCode = `${palette.callNumberPrefix}${String((idx + 1) * 7).padStart(2, '0')}`;

                        return (
                          <div
                            key={book.id}
                            className="relative group shrink-0 flex flex-col items-center cursor-pointer select-none"
                            onClick={() => setSelectedBook(isSelected ? null : book)}
                            style={{
                              transformStyle: 'preserve-3d',
                              transform: isSelected
                                ? 'translateY(-16px) translateZ(40px) scale(1.05)'
                                : 'translateY(0px) translateZ(0px)',
                              transition:
                                'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease',
                              zIndex: isSelected ? 30 : 10,
                            }}
                          >
                            {/* Floating Selection Flag */}
                            {isSelected && (
                              <div className="absolute -top-7 px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[9px] font-extrabold shadow-md flex items-center gap-1 z-40 animate-bounce whitespace-nowrap">
                                <Check className="w-3 h-3" />
                                SELECTED
                              </div>
                            )}

                            {/* 3D Book Spine Component */}
                            <div
                              className={`relative rounded-t-sm transition-all duration-300 group-hover:-translate-y-2 group-hover:translate-z-6 ${
                                isSelected
                                  ? 'ring-2 ring-amber-300 shadow-[0_20px_35px_rgba(251,191,36,0.35)]'
                                  : 'shadow-[0_12px_22px_rgba(0,0,0,0.8)]'
                              }`}
                              style={{
                                width: `${bookThickness}px`,
                                height: `${bookHeight}px`,
                                background: palette.spineGradient,
                                borderLeft: `2px solid ${palette.spineEdge}`,
                                borderRight: `2px solid ${palette.spineEdge}`,
                                transformStyle: 'preserve-3d',
                              }}
                            >
                              {/* Top Headband Cloth */}
                              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-700 via-amber-300 to-amber-700 rounded-t-sm opacity-90" />

                              {/* Top Gold Embossed Spine Ribs */}
                              <div className="absolute top-3 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300 to-transparent opacity-80 shadow-xs" />
                              <div className="absolute top-4 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-50" />
                              <div className="absolute top-8 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300 to-transparent opacity-70" />

                              {/* Vertical Title & Author in Gold Leaf Typography (Natural Top-to-Bottom Flow) */}
                              <div className="absolute inset-y-11 inset-x-0 flex items-center justify-center overflow-hidden pointer-events-none px-1">
                                <span
                                  className="text-[10px] sm:text-[11px] font-serif font-bold tracking-wide truncate max-h-[120px]"
                                  style={{
                                    writingMode: 'vertical-rl',
                                    color: palette.foil,
                                    textShadow:
                                      '0 1px 2px rgba(0,0,0,0.9), 0 0 1px rgba(0,0,0,0.8)',
                                  }}
                                >
                                  {book.title}
                                </span>
                              </div>

                              {/* Lower Spine Rib */}
                              <div className="absolute bottom-13 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300 to-transparent opacity-80" />

                              {/* Institutional Call-Number Library Sticker */}
                              <div className="absolute bottom-2.5 inset-x-1.5 py-1 px-0.5 rounded-[2px] bg-[#fbf8ee] border border-amber-950/40 text-center shadow-xs">
                                <span className="block text-[8px] font-mono font-black text-slate-900 tracking-tighter leading-none">
                                  {callCode}
                                </span>
                                <div className="mt-0.5 h-[2px] w-full bg-slate-800 opacity-60 rounded-xs" />
                              </div>

                              {/* Silk Ribbon Bookmark dangling from bottom */}
                              <div
                                className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-3 rounded-b-xs shadow-sm pointer-events-none"
                                style={{ backgroundColor: palette.ribbon }}
                              />
                            </div>

                            {/* Book Shadow on Floor */}
                            <div className="w-8 h-2 bg-black/80 rounded-full blur-[2px] -mt-1" />

                            {/* Hover Quick Preview Tooltip */}
                            <div className="absolute bottom-full mb-3 hidden group-hover:block z-50 w-44 p-2.5 rounded-xl bg-slate-950/95 text-white text-[11px] border border-amber-400/50 shadow-2xl backdrop-blur-md pointer-events-none animate-fade-in">
                              <p className="font-bold text-amber-300 line-clamp-2 leading-snug">
                                {book.title}
                              </p>
                              <p className="text-[10px] text-slate-300 mt-0.5 truncate">
                                {book.author}
                              </p>
                              <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-700/60 text-[9px]">
                                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-200">
                                  {book.category || 'General'}
                                </span>
                                <span className="font-bold text-emerald-400">
                                  {book.availableCopies} available
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 3D Wooden Shelf Plank (Where books stand) */}
                    <div className="relative -mt-1 w-full">
                      {/* Shelf top edge reflection & bevel */}
                      <div className="h-2 w-full bg-gradient-to-r from-[#4d2914] via-[#754021] to-[#4d2914] border-t border-amber-500/30 rounded-t shadow-inner" />
                      {/* Main front beam of wooden shelf */}
                      <div className="h-6 sm:h-7 w-full bg-gradient-to-b from-[#3a1d0d] via-[#291408] to-[#170a04] border-t border-amber-950 shadow-[0_10px_20px_rgba(0,0,0,0.8)] flex items-center justify-between px-3 sm:px-6 relative">
                        {/* Polished brass gallery rail across the shelf */}
                        <div className="h-[2px] w-full bg-gradient-to-r from-amber-700 via-amber-300 to-amber-700 opacity-90 shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />

                        {/* Centered Antique Brass Plaque */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-0.5 rounded bg-gradient-to-r from-amber-700 via-yellow-400 to-amber-700 border border-amber-800 text-[10px] font-black tracking-widest text-amber-950 shadow-md uppercase font-serif whitespace-nowrap">
                          {selectedCategory === 'ALL'
                            ? 'ARCHIVAL STACK 01 • GENERAL REPOSITORY'
                            : `STACK • ${selectedCategory}`}
                        </div>
                      </div>
                      {/* Deep shadow cast below the shelf */}
                      <div className="h-4 w-full bg-gradient-to-b from-black/60 to-transparent" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ═════════════════════════════════════════════════════════
                INDEX CARDS VIEW (COMPACT SEARCHABLE GRID)
               ═════════════════════════════════════════════════════════ */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredBooks.map((book, idx) => {
                const isSelected = selectedBook?.id === book.id;
                const palette = getBookPalette(book.id, idx);
                return (
                  <div
                    key={book.id}
                    onClick={() => setSelectedBook(isSelected ? null : book)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                      isSelected
                        ? 'border-amber-400 bg-amber-950/60 shadow-lg ring-1 ring-amber-400/40 text-white'
                        : 'border-amber-950 bg-black/40 hover:border-amber-900/60 hover:bg-black/60 text-amber-100'
                    }`}
                  >
                    {/* Mini 3D Book Spine */}
                    <div
                      className="w-9 h-14 rounded-r-xs shrink-0 shadow-md flex items-center justify-center p-1 text-center"
                      style={{ background: palette.spineGradient }}
                    >
                      <span className="text-[8px] font-mono font-bold text-amber-200 line-clamp-2">
                        {book.category?.slice(0, 4) || 'BOOK'}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-amber-100 truncate leading-snug">
                        {book.title}
                      </p>
                      <p className="text-[11px] text-amber-300/70 truncate mt-0.5">
                        {book.author}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {book.category && (
                          <span className="text-[9px] px-2 py-0.5 rounded bg-black/50 text-amber-200/90 border border-amber-950 font-semibold">
                            {book.category}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-emerald-400">
                          {book.availableCopies} available
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════
              CIRCULATION DESK LEDGER & BORROWING COUNTER
             ═════════════════════════════════════════════════════════ */}
          <div className="rounded-2xl border border-amber-900/50 bg-[#120803] shadow-2xl overflow-hidden">
            {/* Ledger Header Beam */}
            <div className="bg-gradient-to-r from-[#200e05] via-[#33170a] to-[#200e05] px-4 sm:px-6 py-3 border-b border-amber-900/40 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs sm:text-sm font-bold tracking-wide uppercase text-amber-200">
                  Circulation Desk • Reading &amp; Borrowing Ledger
                </h4>
              </div>

              {isTimingClosed ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/60 text-rose-300 border border-rose-800/40 font-bold text-[10px]">
                  <Lock className="w-3 h-3 text-rose-400" />
                  DESK CLOSED (10 AM – 4 PM IST)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 font-bold text-[10px]">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  DESK ACTIVE
                </span>
              )}
            </div>

            {/* Selected Book Presentation Area */}
            {selectedBook ? (
              <div className="p-4 sm:p-6 bg-black/30 border-b border-amber-950 flex flex-col md:flex-row items-center gap-5">
                {/* 3D Hardcover Book Representation */}
                <div className="relative shrink-0 select-none" style={{ perspective: '800px' }}>
                  <div
                    className="relative w-28 h-40 sm:w-32 sm:h-44 rounded-r-lg shadow-2xl p-3 flex flex-col justify-between text-white border-l-4 border-amber-950"
                    style={{
                      background: getBookPalette(selectedBook.id, 0).coverGradient,
                      transform: 'rotateY(-15deg)',
                      transformStyle: 'preserve-3d',
                      boxShadow: '8px 12px 24px rgba(0,0,0,0.6)',
                    }}
                  >
                    <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-amber-300/80" />
                    <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-amber-300/80" />

                    <div>
                      <span className="text-[8px] font-mono tracking-widest uppercase text-amber-200/90 block">
                        {selectedBook.category || 'ACADEMIC'}
                      </span>
                      <h5 className="text-[11px] sm:text-xs font-serif font-bold text-amber-100 line-clamp-3 mt-1 leading-snug">
                        {selectedBook.title}
                      </h5>
                    </div>

                    <div>
                      <p className="text-[9px] text-amber-200/80 truncate font-medium">
                        {selectedBook.author}
                      </p>
                      <div className="mt-2 pt-1 border-t border-amber-400/30 flex items-center justify-between text-[8px] text-amber-300 font-mono">
                        <span>COPIES: {selectedBook.availableCopies}</span>
                      </div>
                    </div>

                    {/* Book Page Edges Shadow (Stacked Cream Pages) */}
                    <div
                      className="absolute top-1 -right-2.5 h-[96%] w-2.5 rounded-r-xs bg-gradient-to-r from-[#e3d8c8] via-[#f7f2e8] to-[#d6c7b2] shadow-xs pointer-events-none"
                      style={{
                        backgroundImage:
                          'repeating-linear-gradient(180deg, #d8cbba 0px, #fbf7ee 1px, #e2d5c3 2px)',
                      }}
                    />
                  </div>
                </div>

                {/* Book Details Summary */}
                <div className="flex-1 space-y-2 text-center md:text-left min-w-0">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-950 border border-amber-600/40 text-amber-300 text-[10px] font-bold">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    Selected for Checkout
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-amber-100 leading-snug">
                    {selectedBook.title}
                  </h3>
                  <p className="text-xs text-amber-200/80 font-medium">
                    Authored by <strong className="text-amber-100">{selectedBook.author}</strong>
                  </p>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-1 text-xs text-amber-300/70">
                    {selectedBook.isbn && (
                      <span className="font-mono text-[11px] bg-black/40 px-2 py-0.5 rounded border border-amber-950">
                        ISBN: {selectedBook.isbn}
                      </span>
                    )}
                    <span className="text-emerald-400 font-bold bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-800/40 text-[11px]">
                      ✓ {selectedBook.availableCopies} Copies Available in Library
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedBook(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-300/70 hover:text-amber-100 hover:bg-black/40 cursor-pointer transition-colors border border-amber-950"
                >
                  Change Book
                </button>
              </div>
            ) : (
              <div className="p-6 bg-black/20 border-b border-amber-950 text-center space-y-2">
                <Compass className="w-8 h-8 text-amber-500/50 mx-auto" />
                <h5 className="text-xs sm:text-sm font-bold text-amber-200">No Volume Selected Yet</h5>
                <p className="text-xs text-amber-300/60 max-w-md mx-auto">
                  Click or tap any 3D book standing on the bookshelf above to inspect its details and load it onto the borrowing counter.
                </p>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="m-4 sm:m-6 p-3.5 bg-rose-950/60 border border-rose-700/50 rounded-xl text-xs text-rose-300 flex items-start gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Borrow Registration Form */}
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-amber-200/80 mb-1">
                    Student Full Name <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400/50" />
                    <input
                      type="text"
                      required
                      value={formData.studentName}
                      onChange={(e) => setFormData((p) => ({ ...p, studentName: e.target.value }))}
                      disabled={isTimingClosed}
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-amber-900/50 bg-[#0c0502] text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Your full name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-amber-200/80 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400/50" />
                    <input
                      type="email"
                      value={formData.studentEmail}
                      onChange={(e) => setFormData((p) => ({ ...p, studentEmail: e.target.value }))}
                      disabled={isTimingClosed}
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-amber-900/50 bg-[#0c0502] text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="student@college.edu"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-amber-200/80 mb-1">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400/50" />
                    <input
                      type="tel"
                      value={formData.studentPhone}
                      onChange={(e) => setFormData((p) => ({ ...p, studentPhone: e.target.value }))}
                      disabled={isTimingClosed}
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-amber-900/50 bg-[#0c0502] text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="9876543210"
                    />
                  </div>
                </div>
              </div>

              {/* Action Bar & Closed Notice */}
              <div className="pt-3 border-t border-amber-950 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-amber-300/70 text-center sm:text-left">
                  {isTimingClosed ? (
                    <span className="font-semibold text-rose-400 flex items-center justify-center sm:justify-start gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      Borrow registrations are locked outside 10:00 AM – 04:00 PM IST.
                    </span>
                  ) : selectedBook ? (
                    <span className="text-amber-200 font-medium">
                      Ready to borrow &ldquo;<strong className="text-amber-100">{selectedBook.title}</strong>&rdquo;
                    </span>
                  ) : (
                    <span>Please select a book from the shelves above to borrow.</span>
                  )}
                </div>

                {isTimingClosed ? (
                  <button
                    type="button"
                    disabled
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-black/60 text-amber-300/40 rounded-xl text-xs sm:text-sm font-bold cursor-not-allowed border border-amber-950 shadow-2xs"
                  >
                    <Lock className="w-4 h-4 text-amber-400/40" />
                    🔒 Circulation Desk Closed (Opens 10 AM Mon–Sat)
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!selectedBook || !formData.studentName.trim() || submitting}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-xl text-xs sm:text-sm font-bold hover:from-amber-500 hover:to-amber-600 transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Send className="w-4 h-4 text-amber-200" />
                    )}
                    {submitting ? 'Submitting Borrow Slip...' : 'Submit Borrow Request'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
