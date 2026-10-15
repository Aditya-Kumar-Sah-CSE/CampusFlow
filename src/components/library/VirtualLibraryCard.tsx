'use client';

import { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  RotateCw,
  Printer,
  School,
  Search,
  Loader2,
  Clock,
  BookmarkCheck,
  AlertTriangle,
  CheckCircle2,
  QrCode,
} from 'lucide-react';
import type { VirtualLibraryCardData } from '@/types/library';

interface Props {
  collegeId: string;
  collegeSlug?: string;
  initialIdentifier?: string;
  studentName?: string;
  registrationNumber?: string;
  rollNumber?: string;
  branch?: string;
  academicLevel?: string;
  collegeName?: string;
  collegeLogoUrl?: string | null;
}

/** Formats college slug/code into uppercase brand display (e.g. "bce-bgp" → "BCE BGP", "110" → "GEC GAYA") */
function formatCodeDisplay(code?: string | null, slug?: string | null): string {
  if (slug && slug.trim()) {
    return slug.trim().replace(/[-_]+/g, ' ').toUpperCase();
  }
  if (!code || !code.trim()) return 'INSTITUTION';
  const c = code.trim();
  if (c === '108') return 'BCE BGP';
  if (c === '110') return 'GEC GAYA';
  if (/^\d+$/.test(c)) return 'CAMPUS';
  return c.replace(/[-_]+/g, ' ').toUpperCase();
}

export function VirtualLibraryCard({
  collegeId,
  collegeSlug: propSlug,
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
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run on mount

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupQuery.trim()) return;
    fetchCardData(lookupQuery.trim());
  };

  const effectiveCollegeName = cardData?.collegeName || propCollegeName || 'Institution Library';
  const effectiveCollegeCode = formatCodeDisplay(
    cardData?.collegeCode,
    cardData?.collegeSlug || propSlug
  );
  const effectiveLogoUrl = cardData?.collegeLogoUrl || propLogoUrl;
  const effectiveStudentName = cardData?.studentName || propName || 'Enrolled Student';
  const effectiveRegNo = cardData?.registrationNumber || propRegNo || 'REG-PENDING';
  const effectiveRollNo = cardData?.rollNumber || propRollNo || effectiveRegNo;
  const effectiveBranch = cardData?.branch || propBranch || 'All Disciplines';
  const effectiveLevel = cardData?.academicLevel || propLevel || 'Undergraduate';

  const slots = cardData?.allocatedBooks || [
    { slotNumber: 1, isUsed: false },
    { slotNumber: 2, isUsed: false },
    { slotNumber: 3, isUsed: false },
  ];

  const usedCount = slots.filter((s) => s.isUsed).length;
  const isFullCapacity = usedCount >= 3 || (cardData?.isMaxCapacityReached ?? false);

  // ═══════════════════════ GENERATE QR CODE (CLIENT-SIDE) ═══════════════════════
  useEffect(() => {
    const payload = JSON.stringify({
      app: 'CampusFlow',
      type: 'LIBRARY_PASS',
      college: effectiveCollegeName,
      code: effectiveCollegeCode,
      student: effectiveStudentName,
      regNo: effectiveRegNo,
      rollNo: effectiveRollNo,
      branch: effectiveBranch,
      level: effectiveLevel,
      quotaUsed: `${usedCount}/3`,
      status: 'ACTIVE',
      validThru: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    });

    QRCode.toDataURL(payload, {
      width: 256,
      margin: 1,
      color: {
        dark: '#020617',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error('Failed to generate Library QR code:', err));
  }, [
    effectiveCollegeName,
    effectiveCollegeCode,
    effectiveStudentName,
    effectiveRegNo,
    effectiveRollNo,
    effectiveBranch,
    effectiveLevel,
    usedCount,
  ]);

  // ═══════════════════════ PRINT PASS HANDLER (ONLY FRONT + BACK) ═══════════════════════
  const handlePrint = () => {
    // Create an isolated hidden iframe so absolutely none of the host website elements appear in print
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    const currentYear = new Date().getFullYear();
    const cleanRegNo = (effectiveRegNo || 'CF7892').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();

    const printHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>${effectiveStudentName} - Virtual Library Card | ${effectiveCollegeName}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #ffffff;
            color: #0f172a;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            padding: 10px 0;
          }
          .sheet-header {
            text-align: center;
            margin-bottom: 16px;
            border-bottom: 2px dashed #cbd5e1;
            padding-bottom: 10px;
            width: 100%;
            max-width: 480px;
          }
          .sheet-header h1 {
            font-size: 14px;
            font-weight: 800;
            letter-spacing: 1px;
            text-transform: uppercase;
            color: #0f172a;
          }
          .sheet-header p {
            font-size: 9px;
            color: #64748b;
            margin-top: 3px;
          }

          /* Card Container (Standard ID Card Aspect Ratio 85.6mm x 54mm) */
          .card {
            width: 470px;
            height: 280px;
            border-radius: 20px;
            padding: 18px 22px;
            background: linear-gradient(135deg, #020617 0%, #0B192C 45%, #1E3E62 100%);
            color: #ffffff;
            border: 1.5px solid #334155;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }

          /* Decorative Sheen */
          .card::before {
            content: "";
            position: absolute;
            top: -50px;
            right: -50px;
            width: 150px;
            height: 150px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(245,158,11,0.18), transparent 70%);
            pointer-events: none;
          }

          /* Header */
          .card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid rgba(255,255,255,0.12);
            padding-bottom: 10px;
          }
          .brand-left {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .logo-box {
            width: 40px;
            height: 40px;
            border-radius: 12px;
            background: #ffffff;
            padding: 2px;
            border: 1px solid rgba(255,255,255,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          }
          .logo-box img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          .college-info h2 {
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #ffffff;
            line-height: 1.2;
            max-width: 260px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .college-info span {
            font-size: 8px;
            font-weight: 700;
            color: #f59e0b;
            font-family: monospace;
            letter-spacing: 1px;
          }

          /* Chip & Contactless */
          .chip-area {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .emv-chip {
            width: 32px;
            height: 24px;
            border-radius: 6px;
            background: linear-gradient(135deg, #fde047 0%, #eab308 50%, #ca8a04 100%);
            border: 1px solid #fef08a;
            box-shadow: inset 0 0 2px rgba(0,0,0,0.4);
          }
          .contactless-icon {
            color: rgba(253, 224, 71, 0.85);
            font-size: 14px;
            font-weight: bold;
          }

          /* Student Info */
          .student-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin: 6px 0 2px 0;
          }
          .student-left span {
            font-size: 7.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #94a3b8;
            display: block;
          }
          .student-name {
            font-size: 14px;
            font-weight: 900;
            color: #ffffff;
            letter-spacing: 0.5px;
            margin: 1px 0;
          }
          .student-meta {
            font-size: 9px;
            color: #cbd5e1;
            font-weight: 600;
          }
          .student-meta .highlight {
            color: #fde047;
          }
          .student-numbers {
            text-align: right;
          }
          .student-numbers .num-label {
            font-size: 7.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #94a3b8;
          }
          .student-numbers .num-val {
            font-size: 11px;
            font-family: monospace;
            font-weight: 800;
            color: #fde047;
          }

          /* 3 Slots */
          .slots-container {
            border-top: 1px solid rgba(255,255,255,0.12);
            padding-top: 8px;
          }
          .slots-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
          }
          .slots-title {
            font-size: 8px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #cbd5e1;
          }
          .capacity-badge {
            font-size: 7.5px;
            font-weight: 800;
            padding: 2px 7px;
            border-radius: 999px;
            letter-spacing: 0.5px;
          }
          .capacity-badge.available {
            background: rgba(16, 185, 129, 0.25);
            color: #6ee7b7;
            border: 1px solid rgba(16, 185, 129, 0.4);
          }
          .capacity-badge.used {
            background: #ef4444;
            color: #ffffff;
          }
          .slots-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 6px;
          }
          .slot-box {
            border-radius: 8px;
            padding: 5px 7px;
            border: 1px solid rgba(255,255,255,0.1);
            background: rgba(255,255,255,0.04);
          }
          .slot-box.used {
            background: rgba(225, 29, 72, 0.25);
            border-color: rgba(244, 63, 94, 0.5);
          }
          .slot-num {
            font-size: 7px;
            font-weight: 700;
            text-transform: uppercase;
            color: #94a3b8;
            display: flex;
            justify-content: space-between;
          }
          .slot-tag {
            font-size: 6.5px;
            font-weight: 800;
            padding: 1px 4px;
            border-radius: 3px;
          }
          .slot-tag.tag-used {
            background: #e11d48;
            color: #ffffff;
          }
          .slot-tag.tag-avail {
            background: rgba(16,185,129,0.3);
            color: #6ee7b7;
          }
          .slot-title {
            font-size: 8px;
            font-weight: 700;
            color: #ffffff;
            margin-top: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .slot-sub {
            font-size: 7px;
            color: #94a3b8;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          /* Card Footer */
          .card-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 7.5px;
            color: #94a3b8;
            font-family: monospace;
            padding-top: 4px;
            border-top: 1px solid rgba(255,255,255,0.08);
          }

          /* Folding Divider */
          .divider-guide {
            width: 470px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin: 14px 0;
            color: #64748b;
            font-size: 8px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .divider-line {
            flex: 1;
            border-top: 1.5px dashed #94a3b8;
          }

          /* Back Card Specific */
          .back-card {
            background: linear-gradient(135deg, #020617 0%, #0B192C 60%, #0f172a 100%);
          }
          .mag-strip {
            margin: -18px -22px 10px -22px;
            height: 34px;
            background: #020617;
            border-top: 1px solid #1e293b;
            border-bottom: 1px solid #1e293b;
            display: flex;
            align-items: center;
            padding: 0 20px;
          }
          .mag-strip span {
            font-size: 7px;
            font-family: monospace;
            color: #475569;
            letter-spacing: 2px;
            text-transform: uppercase;
          }
          .rules-box h3 {
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            color: #f59e0b;
            letter-spacing: 0.8px;
            margin-bottom: 4px;
          }
          .rules-list {
            list-style: disc;
            padding-left: 14px;
            font-size: 8px;
            color: #cbd5e1;
            line-height: 1.35;
          }
          .rules-list li {
            margin-bottom: 2px;
          }

          /* Back Bottom QR & Signatory */
          .back-bottom {
            border-top: 1px solid rgba(255,255,255,0.12);
            padding-top: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .qr-block {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .qr-box {
            width: 54px;
            height: 54px;
            background: #ffffff;
            border-radius: 8px;
            padding: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(255,255,255,0.4);
          }
          .qr-box img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          .qr-text span {
            font-size: 7.5px;
            font-weight: 800;
            color: #f59e0b;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            display: block;
          }
          .qr-text .reg {
            font-size: 9px;
            font-family: monospace;
            font-weight: 800;
            color: #ffffff;
            margin: 1px 0;
          }
          .qr-text .desc {
            font-size: 7px;
            color: #94a3b8;
          }

          .sign-block {
            text-align: right;
          }
          .sign-block .sign-title {
            font-size: 7px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #64748b;
            display: block;
          }
          .sign-block .sign-name {
            font-family: Georgia, serif;
            font-style: italic;
            font-size: 12px;
            color: #fde047;
            font-weight: 600;
            margin: 2px 0 1px 0;
          }
          .sign-block .sign-college {
            font-size: 7px;
            color: #94a3b8;
            font-family: monospace;
            max-width: 190px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .sheet-footer {
            margin-top: 14px;
            font-size: 8px;
            color: #94a3b8;
            text-align: center;
            font-family: monospace;
          }
        </style>
      </head>
      <body>
        <div class="sheet-header">
          <h1>${effectiveCollegeName}</h1>
          <p>Official Digital Student Library Pass • Academic Year ${currentYear}-${currentYear + 1}</p>
        </div>

        <!-- ═════════ CARD FRONT ═════════ -->
        <div class="card">
          <div class="card-header">
            <div class="brand-left">
              ${
                effectiveLogoUrl
                  ? `<div class="logo-box"><img src="${effectiveLogoUrl}" alt="${effectiveCollegeName}" /></div>`
                  : `<div class="logo-box" style="background:#f59e0b;color:#0f172a;font-weight:900;font-size:16px;">LIB</div>`
              }
              <div class="college-info">
                <h2>${effectiveCollegeName}</h2>
                <span>${effectiveCollegeCode} DIGITAL LIBRARY</span>
              </div>
            </div>
            <div class="chip-area">
              <span class="contactless-icon">)))</span>
              <div class="emv-chip"></div>
            </div>
          </div>

          <div class="student-row">
            <div class="student-left">
              <span>Student Member</span>
              <div class="student-name">${effectiveStudentName}</div>
              <div class="student-meta"><span class="highlight">${effectiveBranch}</span> • ${effectiveLevel}</div>
            </div>
            <div class="student-numbers">
              <div class="num-label">Roll No: <span class="num-val">${effectiveRollNo}</span></div>
              <div class="num-label" style="margin-top:2px;">Reg No: <span class="num-val">${effectiveRegNo}</span></div>
            </div>
          </div>

          <div class="slots-container">
            <div class="slots-header">
              <span class="slots-title">Book Allotment Capacity (Max 3 Books)</span>
              ${
                isFullCapacity
                  ? `<span class="capacity-badge used">3/3 ALLOTTED (USED)</span>`
                  : `<span class="capacity-badge available">${usedCount}/3 Used (${3 - usedCount} Available)</span>`
              }
            </div>
            <div class="slots-grid">
              ${slots
                .slice(0, 3)
                .map(
                  (s, i) => `
                <div class="slot-box ${s.isUsed ? 'used' : ''}">
                  <div class="slot-num">
                    <span>Slot #${s.slotNumber || i + 1}</span>
                    <span class="slot-tag ${s.isUsed ? 'tag-used' : 'tag-avail'}">${s.isUsed ? 'USED' : 'Available'}</span>
                  </div>
                  <div class="slot-title">${s.isUsed ? (s.bookTitle || 'Allotted Book') : 'Empty slot'}</div>
                  <div class="slot-sub">${s.isUsed ? (s.bookAuthor ? 'By ' + s.bookAuthor : (s.dueDate ? 'Due: ' + new Date(s.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Allotted')) : 'Ready to borrow'}</div>
                </div>
              `
                )
                .join('')}
            </div>
          </div>

          <div class="card-footer">
            <span>● AUTH VALID: ${currentYear}-${currentYear + 1}</span>
            <span>SECURE ID #${cleanRegNo}</span>
          </div>
        </div>

        <!-- ═════════ CUT & FOLD GUIDE ═════════ -->
        <div class="divider-guide">
          <div class="divider-line"></div>
          <span>✂ FOLD OR CUT ALONG THIS LINE FOR DOUBLE-SIDED CARD ✂</span>
          <div class="divider-line"></div>
        </div>

        <!-- ═════════ CARD BACK (WITH QR CODE) ═════════ -->
        <div class="card back-card">
          <div class="mag-strip">
            <span>${effectiveCollegeCode} SECURE MAGNETIC ENCODED STRIP</span>
          </div>

          <div class="rules-box">
            <h3>Library Rules &amp; Regulations</h3>
            <ul class="rules-list">
              <li>This card is non-transferable and remains property of ${effectiveCollegeName}.</li>
              <li>Maximum 3 books can be borrowed concurrently by any student member.</li>
              <li>Books must be returned within designated borrow period (15 days).</li>
              <li>Overdue returns will incur standard fine per day as per library policy.</li>
              <li>Loss of card or damaged books must be reported immediately to the Librarian.</li>
            </ul>
          </div>

          <div class="back-bottom">
            <div class="qr-block">
              <div class="qr-box">
                <img src="${qrCodeDataUrl}" alt="Verification QR Code" />
              </div>
              <div class="qr-text">
                <span>Digital Pass QR</span>
                <div class="reg">*${effectiveRegNo}*</div>
                <div class="desc">Scan to verify student status &amp; quota</div>
              </div>
            </div>

            <div class="sign-block">
              <span class="sign-title">Authorised Signatory</span>
              <div class="sign-name">Chief Librarian</div>
              <div class="sign-college">${effectiveCollegeName}</div>
            </div>
          </div>
        </div>

        <div class="sheet-footer">
          Printed from ${effectiveCollegeName} Digital Campus Portal • Card ID: ${effectiveRegNo} • Issued: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </body>
      </html>
    `;

    doc.open();
    doc.write(printHtml);
    doc.close();

    const doPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Print trigger error:', err);
      } finally {
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch {}
        }, 1500);
      }
    };

    setTimeout(doPrint, 300);
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

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Print isolation styles for Ctrl+P */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body * {
            visibility: hidden !important;
          }
          #library-card-print-area,
          #library-card-print-area * {
            visibility: visible !important;
          }
          #library-card-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 10px 0 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            background: #ffffff !important;
            z-index: 9999999 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Interactive Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs no-print">
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
            title="Flip to see back terms & QR code"
          >
            <RotateCw className="w-3.5 h-3.5 text-slate-500" />
            <span>{isFlipped ? 'View Front' : 'Flip Card'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-bce-navy hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-md cursor-pointer select-none"
            title="Print Pass (Front + Back Card Only)"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span>Print Pass</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════ ON-SCREEN 3D INTERACTIVE CARD ═══════════════════════ */}
      <div
        className="relative w-full transition-all duration-500 select-none no-print"
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
            {/* Holographic Sheen / Background Accents */}
            <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-gradient-to-tr from-amber-500/10 via-purple-500/15 to-blue-500/20 blur-3xl pointer-events-none" />
            <div className="absolute -left-20 -bottom-20 w-72 h-72 rounded-full bg-gradient-to-br from-indigo-500/15 via-emerald-500/10 to-teal-500/10 blur-3xl pointer-events-none" />

            {/* Subtle Diagonal Security Grid */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />

            {/* Header: Official College Branding */}
            <div className="relative z-10 flex items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3 min-w-0">
                {effectiveLogoUrl ? (
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white p-1 shadow-md border border-white/30 shrink-0 flex items-center justify-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
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
                      {effectiveCollegeCode} DIGITAL LIBRARY
                    </span>
                    <span className="text-white/40">•</span>
                    <span className="text-[10px] text-slate-300 font-mono uppercase">
                      ID: {effectiveCollegeCode}
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

            {/* Bottom Bar: Holographic Auth Stamp */}
            <div className="relative z-10 mt-5 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-mono text-slate-300">
                  AUTH VALID: {new Date().getFullYear()}-{new Date().getFullYear() + 1}
                </span>
              </div>
              <span className="text-[9px] font-mono tracking-widest text-slate-500 uppercase">
                SECURE ID #{(effectiveRegNo || 'CF7892').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase()}
              </span>
            </div>
          </div>

          {/* ────────────────── BACK SIDE OF THE CARD (WITH QR CODE) ────────────────── */}
          <div
            className={`absolute inset-0 w-full h-full bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white rounded-3xl p-5 sm:p-7 border border-slate-700 shadow-2xl flex flex-col justify-between [transform:rotateY(180deg)] ${
              !isFlipped ? 'pointer-events-none' : ''
            }`}
            style={{ backfaceVisibility: 'hidden' }}
          >
            {/* Magnetic Stripe */}
            <div className="-mx-5 sm:-mx-7 -mt-1 h-10 sm:h-12 bg-slate-950 border-y border-slate-800 shadow-inner flex items-center px-6">
              <span className="text-[9px] font-mono text-slate-600 tracking-widest uppercase">
                {effectiveCollegeCode} SECURE MAGNETIC ENCODED STRIP
              </span>
            </div>

            {/* Terms & Conditions */}
            <div className="space-y-2 text-slate-300 py-2 text-[11px] leading-relaxed">
              <h5 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Library Rules &amp; Regulations
              </h5>
              <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[10px]">
                <li>This card is non-transferable and remains property of {effectiveCollegeName}.</li>
                <li>Maximum 3 books can be borrowed concurrently by any student member.</li>
                <li>Books must be returned within designated borrow period (15 days).</li>
                <li>Overdue returns will incur standard late fine per day per book.</li>
                <li>Loss of card or damaged books must be reported immediately to the Librarian.</li>
              </ul>
            </div>

            {/* Verification QR Code Section (Replaces Barcode) */}
            <div className="border-t border-white/10 pt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white p-1 shadow-md border border-white/30 shrink-0 flex items-center justify-center overflow-hidden">
                  {qrCodeDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrCodeDataUrl}
                      alt="Library Card Verification QR"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <QrCode className="w-8 h-8 text-slate-800 animate-pulse" />
                  )}
                </div>
                <div className="space-y-0.5 min-w-0">
                  <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider block">
                    Digital Pass QR
                  </span>
                  <p className="font-mono text-[10px] text-slate-200 font-extrabold truncate">
                    *{effectiveRegNo}*
                  </p>
                  <p className="text-[8px] text-slate-400 leading-tight">
                    Scan to verify membership &amp; borrow quota
                  </p>
                </div>
              </div>

              {/* Authorized Signatory */}
              <div className="text-right space-y-0.5 shrink-0">
                <span className="text-[8px] sm:text-[9px] uppercase tracking-widest text-slate-500 block font-semibold">
                  Authorised Signatory
                </span>
                <p className="font-serif italic text-amber-300 text-xs sm:text-sm font-semibold">
                  Chief Librarian
                </p>
                <span className="text-[8px] sm:text-[9px] text-slate-400 font-mono block max-w-[140px] truncate">
                  {effectiveCollegeName}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════ HIDDEN PRINT CONTAINER (FOR CTRL+P FALLBACK) ═══════════════════════ */}
      <div id="library-card-print-area" className="hidden">
        <div className="w-[470px] space-y-4">
          {/* Print Header */}
          <div className="text-center pb-2 border-b-2 border-dashed border-slate-300">
            <h1 className="text-xs font-black uppercase tracking-wider text-slate-900">{effectiveCollegeName}</h1>
            <p className="text-[9px] text-slate-500">Official Student Digital Library Pass • Academic Year {new Date().getFullYear()}-{new Date().getFullYear() + 1}</p>
          </div>

          {/* FRONT CARD FLAT */}
          <div className="w-[470px] h-[280px] rounded-2xl p-5 bg-slate-950 text-white border border-slate-700 shadow-sm flex flex-col justify-between overflow-hidden relative">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                {effectiveLogoUrl ? (
                  <div className="w-10 h-10 rounded-xl bg-white p-1 border border-white/30 flex items-center justify-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={effectiveLogoUrl} alt={effectiveCollegeName} className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-sm">LIB</div>
                )}
                <div>
                  <h3 className="text-xs font-extrabold uppercase truncate max-w-[260px] text-white">{effectiveCollegeName}</h3>
                  <span className="text-[8px] font-bold text-amber-400 font-mono">{effectiveCollegeCode} DIGITAL LIBRARY</span>
                </div>
              </div>
              <div className="w-8 h-6 rounded bg-amber-400 border border-amber-200" />
            </div>

            <div className="flex justify-between items-end my-1">
              <div>
                <span className="text-[7.5px] uppercase font-bold text-slate-400 block tracking-wider">Student Member</span>
                <p className="text-sm font-black text-white">{effectiveStudentName}</p>
                <p className="text-[9px] text-slate-300"><span className="text-amber-300 font-bold">{effectiveBranch}</span> • {effectiveLevel}</p>
              </div>
              <div className="text-right">
                <p className="text-[8px] text-slate-400 uppercase font-bold">Roll No: <span className="font-mono text-amber-300 font-extrabold">{effectiveRollNo}</span></p>
                <p className="text-[8px] text-slate-400 uppercase font-bold mt-0.5">Reg No: <span className="font-mono text-amber-300 font-extrabold">{effectiveRegNo}</span></p>
              </div>
            </div>

            <div className="border-t border-white/10 pt-2 space-y-1.5">
              <div className="flex justify-between items-center text-[8px] font-bold">
                <span className="text-slate-300 uppercase tracking-wider">Book Allotment Capacity (Max 3 Books)</span>
                <span className={isFullCapacity ? 'text-rose-400' : 'text-emerald-400'}>
                  {usedCount}/3 Used ({3 - usedCount} Available)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {slots.slice(0, 3).map((s, i) => (
                  <div key={i} className={`p-1.5 rounded-lg border text-[7.5px] ${s.isUsed ? 'bg-rose-950/40 border-rose-500/40' : 'bg-white/5 border-white/10'}`}>
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-400">Slot #{s.slotNumber || i + 1}</span>
                      <span className={s.isUsed ? 'text-rose-400 font-black' : 'text-emerald-400 font-bold'}>{s.isUsed ? 'USED' : 'Avail'}</span>
                    </div>
                    <p className="truncate font-bold text-white mt-0.5">{s.isUsed ? (s.bookTitle || 'Allotted') : 'Empty'}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center text-[7.5px] font-mono text-slate-400 pt-1 border-t border-white/10">
              <span>● AUTH VALID: {new Date().getFullYear()}-{new Date().getFullYear() + 1}</span>
              <span>SECURE ID #{cleanRegNo}</span>
            </div>
          </div>

          {/* CUT / FOLD GUIDELINE */}
          <div className="flex items-center justify-center gap-2 py-1 text-[8px] font-bold uppercase text-slate-400">
            <span className="flex-1 border-t border-dashed border-slate-400" />
            <span>✂ Fold or Cut along this line for double-sided card ✂</span>
            <span className="flex-1 border-t border-dashed border-slate-400" />
          </div>

          {/* BACK CARD FLAT */}
          <div className="w-[470px] h-[280px] rounded-2xl p-5 bg-slate-950 text-white border border-slate-700 shadow-sm flex flex-col justify-between overflow-hidden relative">
            <div className="-mx-5 -mt-5 h-8 bg-black border-y border-slate-800 flex items-center px-5">
              <span className="text-[7.5px] font-mono text-slate-500 tracking-widest uppercase">{effectiveCollegeCode} SECURE MAGNETIC STRIP</span>
            </div>

            <div className="py-2 text-[8px] text-slate-300 space-y-1">
              <h5 className="font-bold text-amber-400 uppercase tracking-wider text-[8.5px]">Library Rules &amp; Regulations</h5>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-400 text-[7.5px]">
                <li>This card is non-transferable and remains property of {effectiveCollegeName}.</li>
                <li>Maximum 3 books can be borrowed concurrently by any student member.</li>
                <li>Books must be returned within designated borrow period (15 days).</li>
                <li>Loss of card or damaged books must be reported immediately to Librarian.</li>
              </ul>
            </div>

            <div className="border-t border-white/10 pt-2 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-13 h-13 rounded-lg bg-white p-1 flex items-center justify-center border border-white/30">
                  {qrCodeDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrCodeDataUrl} alt="Library QR" className="w-full h-full object-contain" />
                  ) : (
                    <QrCode className="w-8 h-8 text-black" />
                  )}
                </div>
                <div>
                  <span className="text-[8px] font-bold text-amber-400 uppercase tracking-wider block">Digital Pass QR</span>
                  <p className="font-mono text-[9px] font-extrabold text-white">*{effectiveRegNo}*</p>
                  <p className="text-[7px] text-slate-400">Scan to verify student status</p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[7.5px] uppercase tracking-wider text-slate-400 block font-semibold">Authorised Signatory</span>
                <p className="font-serif italic text-amber-300 text-xs font-semibold">Chief Librarian</p>
                <span className="text-[7.5px] text-slate-400 font-mono block max-w-[150px] truncate">{effectiveCollegeName}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
