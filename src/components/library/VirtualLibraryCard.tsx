'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Printer,
  ShieldCheck,
  Building2,
  Calendar,
  User,
  CreditCard,
  Hash,
  School,
  Sparkles,
  QrCode,
  Search,
  Loader2,
  Info,
  Clock,
  BookmarkCheck,
} from 'lucide-react';
import type { VirtualLibraryCardData } from '@/types/library';

interface Props {
  collegeId: string;
  initialIdentifier?: string;
  studentName?: string;
  registrationNumber?: string;
  rollNumber?: string;
  branch?: string;
  academicLevel?: string;
  collegeName?: string;
  collegeLogoUrl?: string | null;
}

export function VirtualLibraryCard({
  collegeId,
  initialIdentifier,
  studentName: propName,
  registrationNumber: propRegNo,
  rollNumber: propRollNo,
  branch: propBranch,
  academicLevel: propLevel,
  collegeName: propCollegeName,
  collegeLogoUrl: propLogoUrl,
}: Props) {
  const [cardData, setCardData] = useState<VirtualLibraryCardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [lookupQuery, setLookupQuery] = useState(
    initialIdentifier || propRegNo || propName || ''
  );
  const [hasSearched, setHasSearched] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const fetchCardData = useCallback(
    async (query?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('collegeId', collegeId);
        if (query) params.set('identifier', query);
        if (propName) params.set('name', propName);
        if (propRegNo) params.set('regNo', propRegNo);
        if (propBranch) params.set('branch', propBranch);
        if (propLevel) params.set('academicLevel', propLevel);

        const res = await fetch(`/api/library/card?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch library card data');
        const data = await res.json();
        if (data.card) {
          setCardData(data.card);
        }
      } catch (err) {
        console.error('Library card fetch error:', err);
      } finally {
        setLoading(false);
      }
    },
    [collegeId, propName, propRegNo, propBranch, propLevel]
  );

  useEffect(() => {
    fetchCardData(lookupQuery);
  }, []); // Run on mount

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupQuery.trim()) return;
    setHasSearched(true);
    fetchCardData(lookupQuery.trim());
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // If card data not loaded yet, show skeleton
  if (loading && !cardData) {
    return (
      <div className="w-full max-w-xl mx-auto p-6 bg-slate-900/90 rounded-3xl border border-slate-800 shadow-2xl animate-pulse space-y-4">
        <div className="flex items-center justify-between">
          <div className="w-12 h-12 bg-slate-800 rounded-2xl" />
          <div className="h-6 w-36 bg-slate-800 rounded-lg" />
        </div>
        <div className="h-8 w-56 bg-slate-800 rounded-lg" />
        <div className="grid grid-cols-3 gap-3 pt-4">
          <div className="h-20 bg-slate-800 rounded-2xl" />
          <div className="h-20 bg-slate-800 rounded-2xl" />
          <div className="h-20 bg-slate-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  const effectiveCollegeName = cardData?.collegeName || propCollegeName || 'Institution Library';
  const effectiveLogoUrl = cardData?.collegeLogoUrl || propLogoUrl;
  const effectiveStudentName = cardData?.studentName || propName || 'Enrolled Student';
  const effectiveRegNo = cardData?.registrationNumber || propRegNo || 'REG-PENDING';
  const effectiveRollNo = cardData?.rollNumber || propRollNo || effectiveRegNo;
  const effectiveBranch = cardData?.branch || propBranch || 'Academic Stream';
  const effectiveLevel = cardData?.academicLevel || propLevel || 'Regular';

  const slots = cardData?.allocatedBooks || [
    { slotNumber: 1, isUsed: false },
    { slotNumber: 2, isUsed: false },
    { slotNumber: 3, isUsed: false },
  ];

  const usedCount = slots.filter((s) => s.isUsed).length;
  const isFullCapacity = usedCount >= 3 || (cardData?.isMaxCapacityReached ?? false);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Interactive Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        {/* Real Lookup Form */}
        <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={lookupQuery}
              onChange={(e) => setLookupQuery(e.target.value)}
              placeholder="Search Reg No, Roll No, or Name..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30 focus:border-bce-cobalt font-medium text-slate-800"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Find Card'}
          </button>
        </form>

        {/* Card Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setIsFlipped(!isFlipped)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer select-none"
            title="Flip to see back terms & barcode"
          >
            <RotateCw className="w-3.5 h-3.5 text-slate-500" />
            <span>{isFlipped ? 'View Front' : 'Flip Card'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bce-navy hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer select-none"
            title="Print or Save Card as PDF"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span>Print Pass</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════ CARD CONTAINER (3D PERSPECTIVE) ═══════════════════════ */}
      <div
        ref={printRef}
        className="relative w-full transition-all duration-500 select-none"
        style={{ perspective: '1200px' }}
      >
        <div
          className={`relative w-full rounded-3xl transition-transform duration-700 ease-out transform-gpu ${
            isFlipped ? '[transform:rotateY(180deg)]' : ''
          }`}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* ────────────────── FRONT SIDE OF THE CARD ────────────────── */}
          <div
            className={`w-full bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-5 sm:p-7 border border-slate-700/80 shadow-2xl relative overflow-hidden transition-all duration-300 ${
              isFlipped ? 'pointer-events-none' : ''
            }`}
            style={{ backfaceVisibility: 'hidden' }}
          >
            {/* Holographic Sheen / Background Circuit Accents */}
            <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-gradient-to-tr from-amber-500/10 via-purple-500/15 to-blue-500/20 blur-3xl pointer-events-none" />
            <div className="absolute -left-20 -bottom-20 w-72 h-72 rounded-full bg-gradient-to-br from-indigo-500/15 via-emerald-500/10 to-teal-500/10 blur-3xl pointer-events-none" />

            {/* Subtle Diagonal Security Lines */}
            <div
              className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"
            />

            {/* Header: Official College Branding */}
            <div className="relative z-10 flex items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3 min-w-0">
                {effectiveLogoUrl ? (
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white p-1 shadow-md border border-white/30 shrink-0 flex items-center justify-center overflow-hidden">
                    <img
                      src={effectiveLogoUrl}
                      alt={effectiveCollegeName}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-600 text-slate-950 p-2 shadow-md shrink-0 flex items-center justify-center font-black text-base">
                    <School className="w-6 h-6" />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-extrabold text-xs sm:text-sm text-white tracking-wide uppercase truncate leading-tight">
                    {effectiveCollegeName}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-bold text-amber-400 font-mono tracking-wider">
                      {(cardData?.collegeCode || 'INSTITUTION').toUpperCase()} DIGITAL LIBRARY
                    </span>
                    <span className="text-white/40">•</span>
                    <span className="text-[10px] text-slate-300 font-mono uppercase">
                      ID: {cardData?.collegeCode || 'COL-LIB'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Holographic Chip & NFC Contactless Symbol */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Contactless waves SVG */}
                <svg
                  className="w-5 h-5 text-amber-300/80"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8.5 16.5a5 5 0 0 1 0-9" />
                  <path d="M12 19a8.5 8.5 0 0 0 0-14" />
                  <path d="M15.5 21.5a12 12 0 0 0 0-19" />
                </svg>

                {/* Smart Card EMV Chip Simulation */}
                <div className="w-9 h-7 rounded-lg bg-gradient-to-tr from-amber-300 via-amber-400 to-yellow-500 p-0.5 shadow-md flex flex-col justify-between overflow-hidden border border-amber-200">
                  <div className="flex justify-between h-2 border-b border-amber-600/40">
                    <span className="w-2.5 h-full border-r border-amber-600/40" />
                    <span className="w-2.5 h-full border-l border-amber-600/40" />
                  </div>
                  <div className="flex justify-between h-2 border-t border-amber-600/40">
                    <span className="w-2.5 h-full border-r border-amber-600/40" />
                    <span className="w-2.5 h-full border-l border-amber-600/40" />
                  </div>
                </div>
              </div>
            </div>

            {/* Student Identification Information */}
            <div className="relative z-10 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <span className="text-[9px] font-bold tracking-widest uppercase text-slate-400">
                  Student Member
                </span>
                <p className="text-base sm:text-lg font-black text-white tracking-wide truncate">
                  {effectiveStudentName}
                </p>
                <div className="flex items-center gap-2 pt-0.5 text-xs text-slate-300">
                  <span className="font-semibold text-amber-300">{effectiveBranch}</span>
                  <span>•</span>
                  <span className="text-[11px] text-slate-400">{effectiveLevel}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-right sm:text-right">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold tracking-widest uppercase text-slate-400 block">
                    Roll No
                  </span>
                  <span className="font-mono font-extrabold text-xs sm:text-sm text-slate-100 block">
                    {effectiveRollNo}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold tracking-widest uppercase text-slate-400 block">
                    Reg No
                  </span>
                  <span className="font-mono font-extrabold text-xs sm:text-sm text-amber-300 block">
                    {effectiveRegNo}
                  </span>
                </div>
              </div>
            </div>

            {/* ══════════════ 3 BOOK ALLOTMENT SLOTS SECTION ══════════════ */}
            <div className="relative z-10 mt-5 pt-4 border-t border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-300 flex items-center gap-1.5">
                  <BookmarkCheck className="w-3.5 h-3.5 text-amber-400" />
                  Book Allotment Capacity (Max 3 Books)
                </span>

                {/* Capacity Status Badge */}
                {isFullCapacity ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white tracking-wide shadow-md animate-pulse">
                    <AlertTriangle className="w-3 h-3" />
                    3/3 ALLOTTED (USED)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    {usedCount}/3 Used ({3 - usedCount} Available)
                  </span>
                )}
              </div>

              {/* Three Slot Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {slots.slice(0, 3).map((slot, index) => {
                  const isUsed = slot.isUsed;
                  return (
                    <div
                      key={slot.slotNumber || index}
                      className={`relative p-3 rounded-2xl border transition-all duration-200 overflow-hidden ${
                        isUsed
                          ? 'bg-rose-950/40 border-rose-500/50 shadow-inner'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Slot #{slot.slotNumber}
                        </span>

                        {/* Prominent USED vs AVAILABLE tag */}
                        {isUsed ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-600 text-white tracking-wider shadow-2xs">
                            USED
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Available
                          </span>
                        )}
                      </div>

                      {isUsed ? (
                        <div className="space-y-0.5">
                          <p
                            className="text-xs font-bold text-white truncate"
                            title={slot.bookTitle}
                          >
                            {slot.bookTitle || 'Allotted Book'}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {slot.bookAuthor ? `By ${slot.bookAuthor}` : 'Allotted to student'}
                          </p>
                          {slot.dueDate && (
                            <p className="text-[9px] text-amber-300/90 font-mono flex items-center gap-1 pt-1">
                              <Clock className="w-2.5 h-2.5" />
                              Due: {new Date(slot.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="py-1">
                          <p className="text-[11px] font-semibold text-slate-400 italic">
                            Empty slot
                          </p>
                          <p className="text-[9px] text-slate-500">
                            Ready to borrow
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Warning Notice when All 3 Books are Used */}
              {isFullCapacity && (
                <div className="mt-2 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-200 animate-in fade-in duration-200">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>
                    <strong>Maximum Book Limit Reached:</strong> All 3 book allotment slots are
                    currently <strong>USED</strong>. Please return a book to the library counter to borrow a new title.
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Bar: Holographic Barcode & Security Stamp */}
            <div className="relative z-10 mt-5 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-mono text-slate-300">
                  AUTH VALID: {new Date().getFullYear()}-{new Date().getFullYear() + 1}
                </span>
              </div>
              <span className="text-[9px] font-mono tracking-widest text-slate-500 uppercase">
                SECURE ID #{effectiveRegNo.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'CF7892'}
              </span>
            </div>
          </div>

          {/* ────────────────── BACK SIDE OF THE CARD ────────────────── */}
          <div
            className={`absolute inset-0 w-full h-full bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white rounded-3xl p-5 sm:p-7 border border-slate-700 shadow-2xl flex flex-col justify-between [transform:rotateY(180deg)] ${
              !isFlipped ? 'pointer-events-none' : ''
            }`}
            style={{ backfaceVisibility: 'hidden' }}
          >
            {/* Magnetic Stripe */}
            <div className="-mx-5 sm:-mx-7 -mt-1 h-10 sm:h-12 bg-slate-950 border-y border-slate-800 shadow-inner flex items-center px-6">
              <span className="text-[9px] font-mono text-slate-700 tracking-widest uppercase">
                {(cardData?.collegeCode || 'INSTITUTION').toUpperCase()} SECURE MAGNETIC ENCODED STRIP
              </span>
            </div>

            {/* Terms & Conditions */}
            <div className="space-y-2 text-slate-300 py-3 text-[11px] leading-relaxed">
              <h5 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Library Rules &amp; Regulations
              </h5>
              <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[10px]">
                <li>This card is non-transferable and remains the property of {effectiveCollegeName}.</li>
                <li>Maximum 3 books can be borrowed concurrently by any student.</li>
                <li>Books must be returned within the designated borrow period (15 days).</li>
                <li>Overdue returns will incur standard late fine per day per book.</li>
                <li>Loss of card or damaged books must be reported immediately to the Librarian.</li>
              </ul>
            </div>

            {/* Barcode Simulator & Verification QR */}
            <div className="border-t border-white/10 pt-3 flex items-center justify-between">
              <div className="space-y-1">
                {/* Visual Barcode Pattern */}
                <div className="flex items-center gap-[2px] h-9 bg-white p-1 rounded-md">
                  {[3, 1, 4, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 4, 2].map(
                    (w, i) => (
                      <span
                        key={i}
                        className="bg-slate-950 h-full inline-block"
                        style={{ width: `${w}px` }}
                      />
                    )
                  )}
                </div>
                <p className="font-mono text-[9px] text-slate-400 tracking-widest text-center">
                  *{effectiveRegNo}*
                </p>
              </div>

              {/* Authorized Stamp */}
              <div className="text-right space-y-0.5">
                <span className="text-[9px] uppercase tracking-widest text-slate-500 block">
                  Authorised Signatory
                </span>
                <p className="font-serif italic text-amber-300 text-xs">Chief Librarian</p>
                <span className="text-[8px] text-slate-500 font-mono block">
                  {effectiveCollegeName}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
