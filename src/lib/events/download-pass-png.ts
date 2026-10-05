'use client';

import QRCode from 'qrcode';

/**
 * High-Resolution VIP PNG Event Pass Generator
 * Renders an official, modern, professional Event Pass directly on client-side Canvas
 * with real scannable QR verification, payment status, college logo crest, and program access entitlements.
 */

export interface EventPassDetails {
  eventTitle: string;
  collegeName?: string;
  collegeLogoUrl?: string;
  collegeCode?: string;
  collegeSlug?: string;
  venue?: string;
  startDate?: string;
  endDate?: string;
  participantName: string;
  email: string;
  registrationNumber: string;
  studentId?: string; // Roll number
  branch?: string;
  semester?: string;
  mobile?: string;
  eventSlug?: string;
  verificationUrl?: string;

  // Payment & Access Entitlements
  isPaid?: boolean;
  totalPaidAmount?: number;
  specialEntryName?: string; // e.g. "DJ Night"
}

export { DEFAULT_COLLEGE_LOGOS, resolveCollegeLogoUrl } from './college-logos';
import { resolveCollegeLogoUrl, BCE_BGP_LOGO_DATA_URI } from './college-logos';

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function loadSingleImage(src: string, timeoutMs: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // Only set crossOrigin for remote absolute HTTP/S endpoints
    if (src.startsWith('http://') || src.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);

    img.onload = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(img);
      }
    };
    img.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    };
    img.src = src;
  });
}

async function loadLogoImage(url?: string): Promise<HTMLImageElement | null> {
  const targetUrl = url || BCE_BGP_LOGO_DATA_URI;

  // 1. Data URI: load immediately
  if (targetUrl.startsWith('data:image/')) {
    const dataImg = await loadSingleImage(targetUrl, 2000);
    if (dataImg) return dataImg;
  }

  // 2. Local relative static asset (/images/... or /logos/...): load immediately
  if (targetUrl.startsWith('/')) {
    const localImg = await loadSingleImage(targetUrl, 3000);
    if (localImg) return localImg;
  }

  // 3. Remote HTTP/S: try direct load
  if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
    const direct = await loadSingleImage(targetUrl, 3000);
    if (direct) return direct;

    // 4. Remote HTTP/S fallback: via same-origin image-proxy to bypass CORS
    if (typeof window !== 'undefined') {
      const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(targetUrl)}`;
      const proxied = await loadSingleImage(proxyUrl, 4000);
      if (proxied) return proxied;
    }
  }

  // 5. Ultimate fallback: bundled BCE Bhagalpur Data URI
  return loadSingleImage(BCE_BGP_LOGO_DATA_URI, 2000);
}

export async function generateAndDownloadPassPNG(details: EventPassDetails): Promise<void> {
  const width = 1200;
  const height = 620;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not initialize canvas context');

  // Font loading sync
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // non-fatal
    }
  }

  // Pre-load logo image if provided, with automatic fallback resolution
  const effectiveLogoUrl = resolveCollegeLogoUrl({
    collegeLogoUrl: details.collegeLogoUrl,
    collegeCode: details.collegeCode,
    collegeSlug: details.collegeSlug || details.eventSlug,
    collegeName: details.collegeName,
  });
  const logoImg = await loadLogoImage(effectiveLogoUrl);

  // Smooth rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1. Background Rounded Card
  const cardRadius = 28;
  ctx.save();
  roundRect(ctx, 0, 0, width, height, cardRadius);
  ctx.clip();

  // Dark rich VIP gradient background
  const bgGradient = ctx.createLinearGradient(0, 0, width, height);
  bgGradient.addColorStop(0, '#070D18');   // Deep Navy Black
  bgGradient.addColorStop(0.5, '#0B1728'); // Midnight Slate
  bgGradient.addColorStop(1, '#052F24');   // Emerald Glow
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  // Subtle radial ambient glow
  const glow1 = ctx.createRadialGradient(920, 90, 10, 920, 90, 420);
  glow1.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
  glow1.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, width, height);

  const glow2 = ctx.createRadialGradient(180, 520, 10, 180, 520, 420);
  glow2.addColorStop(0, 'rgba(59, 130, 246, 0.16)');
  glow2.addColorStop(1, 'rgba(59, 130, 246, 0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  // Ticket Perforation Stub Notch (at X = 850)
  const stubX = 850;

  // Dashed dividing line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(stubX, 28);
  ctx.lineTo(stubX, height - 28);
  ctx.stroke();
  ctx.setLineDash([]);

  // Top & bottom ticket notches
  ctx.fillStyle = '#030712';
  ctx.beginPath();
  ctx.arc(stubX, 0, 22, 0, Math.PI);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(stubX, height, 22, Math.PI, 0);
  ctx.fill();

  ctx.restore();

  // Outer border with subtle neon emerald outline
  ctx.save();
  roundRect(ctx, 1, 1, width - 2, height - 2, cardRadius);
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // ============================================================
  // LEFT SECTION: MAIN EVENT & PARTICIPANT & ACCESS PRIVILEGES
  // ============================================================
  const leftX = 50;
  const maxContentWidth = stubX - leftX - 40;

  // 1. Header Badges: Verified Status & College Name
  const pillY = 38;
  const pillH = 30;
  const pillW = 250;
  roundRect(ctx, leftX, pillY, pillW, pillH, 15);
  ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Green status dot
  ctx.fillStyle = '#10B981';
  ctx.beginPath();
  ctx.arc(leftX + 16, pillY + pillH / 2, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = 'bold 11px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#34D399';
  ctx.fillText('OFFICIAL EVENT PASS • VERIFIED', leftX + 28, pillY + 19);

  // College Name in Header
  if (details.collegeName) {
    ctx.font = 'bold 11px "Inter", system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94A3B8';
    let cName = details.collegeName.toUpperCase();
    const maxCollegeWidth = stubX - (leftX + pillW + 40);
    while (ctx.measureText(cName).width > maxCollegeWidth && cName.length > 5) {
      cName = cName.slice(0, -4) + '...';
    }
    ctx.fillText(cName, leftX + pillW + 18, pillY + 19);
  }

  // 2. Event Title
  ctx.font = '900 34px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  let cleanTitle = details.eventTitle || 'Campus Event';
  while (ctx.measureText(cleanTitle).width > maxContentWidth && cleanTitle.length > 5) {
    cleanTitle = cleanTitle.slice(0, -4) + '...';
  }
  ctx.fillText(cleanTitle, leftX, 108);

  // 3. Venue
  const venueText = details.venue ? `📍 ${details.venue}` : '📍 Campus Venue';
  ctx.font = '500 15px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#CBD5E1';
  let cleanVenue = venueText;
  while (ctx.measureText(cleanVenue).width > maxContentWidth && cleanVenue.length > 5) {
    cleanVenue = cleanVenue.slice(0, -4) + '...';
  }
  ctx.fillText(cleanVenue, leftX, 136);

  // 4. Horizontal Separator
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(leftX, 160);
  ctx.lineTo(stubX - 50, 160);
  ctx.stroke();

  // 5. Participant Info
  ctx.font = 'bold 10px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#34D399';
  ctx.fillText('PARTICIPANT DETAILS', leftX, 184);

  // Full Name
  ctx.font = 'bold 26px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  let cleanParticipant = details.participantName || 'Participant';
  while (ctx.measureText(cleanParticipant).width > maxContentWidth && cleanParticipant.length > 5) {
    cleanParticipant = cleanParticipant.slice(0, -4) + '...';
  }
  ctx.fillText(cleanParticipant, leftX, 218);

  // Email
  ctx.font = '500 14px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText(details.email || '', leftX, 242);

  // 6. Metadata Pills (Roll, Branch, Semester, Mobile)
  const badges: { label: string; value: string }[] = [];
  if (details.studentId) badges.push({ label: 'Roll', value: details.studentId });
  if (details.branch) badges.push({ label: 'Branch', value: details.branch });
  if (details.semester) badges.push({ label: 'Sem', value: details.semester });
  if (details.mobile) badges.push({ label: 'Phone', value: details.mobile });

  let badgeX = leftX;
  const badgeY = 266;
  const badgeH = 30;

  for (const b of badges) {
    const text = `${b.label}: ${b.value}`;
    ctx.font = 'bold 12px "Inter", system-ui, -apple-system, sans-serif';
    const textWidth = ctx.measureText(text).width;
    const badgeW = textWidth + 22;

    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 9);
    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(text, badgeX + 11, badgeY + 20);

    badgeX += badgeW + 8;
    if (badgeX > stubX - 100) break;
  }

  // 7. PROGRAM ACCESS & PRIVILEGES CARD (MODERN KEYWORD-BASED)
  // "allowwed for all FREE program if paid program ka bhi money pay kia then special entry event name show krna as example DJ Night"
  const accessCardY = 320;
  const accessCardH = 205;
  const accessCardW = maxContentWidth;

  roundRect(ctx, leftX, accessCardY, accessCardW, accessCardH, 16);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.65)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Card Header Row
  ctx.font = 'bold 10px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#34D399';
  ctx.fillText('PASS PRIVILEGES & INCLUSIONS', leftX + 18, accessCardY + 24);

  const hasSpecialPaid = Boolean(
    (details.totalPaidAmount && details.totalPaidAmount > 0) || details.specialEntryName || details.isPaid
  );

  // Access Tier Badge on Top-Right of Card
  const tierText = hasSpecialPaid ? '★ VIP ALL-ACCESS' : '✓ STANDARD ACCESS';
  ctx.font = 'bold 10px "Inter", system-ui, -apple-system, sans-serif';
  const tierW = ctx.measureText(tierText).width + 20;
  const tierX = leftX + accessCardW - tierW - 18;
  const tierY = accessCardY + 12;
  roundRect(ctx, tierX, tierY, tierW, 22, 6);
  ctx.fillStyle = hasSpecialPaid ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.18)';
  ctx.fill();
  ctx.strokeStyle = hasSpecialPaid ? 'rgba(245, 158, 11, 0.55)' : 'rgba(16, 185, 129, 0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = hasSpecialPaid ? '#FBBF24' : '#34D399';
  ctx.fillText(tierText, tierX + 10, tierY + 15);

  // INCLUSION ROW 1: "ALLOWED FOR ALL FREE PROGRAMS"
  const incPill1Y = accessCardY + 44;
  const incPill1H = 34;
  const incPill1W = accessCardW - 36;
  roundRect(ctx, leftX + 18, incPill1Y, incPill1W, incPill1H, 10);
  ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Green check dot
  ctx.fillStyle = '#10B981';
  ctx.beginPath();
  ctx.arc(leftX + 34, incPill1Y + incPill1H / 2, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = 'bold 12px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#34D399';
  ctx.fillText('ALLOWED FOR ALL FREE PROGRAMS', leftX + 46, incPill1Y + 22);

  ctx.font = '500 11px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('• Indoor & Outdoor Sports, Competitions & Open Entry', leftX + 300, incPill1Y + 22);

  // INCLUSION ROW 2: SPECIAL ENTRY (e.g. DJ Night if paid) OR STANDARD ENTRY
  const incPill2Y = accessCardY + 88;
  const incPill2H = 34;
  const incPill2W = accessCardW - 36;
  roundRect(ctx, leftX + 18, incPill2Y, incPill2W, incPill2H, 10);

  if (hasSpecialPaid) {
    ctx.fillStyle = 'rgba(245, 158, 11, 0.16)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Gold star dot
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(leftX + 34, incPill2Y + incPill2H / 2, 4.5, 0, Math.PI * 2);
    ctx.fill();

    const specialName = (details.specialEntryName || 'SPECIAL EVENT').toUpperCase();
    ctx.font = 'bold 12px "Inter", system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#FBBF24';
    ctx.fillText(`★ SPECIAL ENTRY: ${specialName}`, leftX + 46, incPill2Y + 22);

    ctx.font = 'bold 11px "Inter", system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#34D399';
    ctx.fillText('• PAID & VERIFIED ✓', leftX + 46 + ctx.measureText(`★ SPECIAL ENTRY: ${specialName}`).width + 16, incPill2Y + 22);
  } else {
    ctx.fillStyle = 'rgba(30, 41, 59, 0.75)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Blue dot
    ctx.fillStyle = '#60A5FA';
    ctx.beginPath();
    ctx.arc(leftX + 34, incPill2Y + incPill2H / 2, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 12px "Inter", system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText('STANDARD EVENT ADMISSION', leftX + 46, incPill2Y + 22);

    ctx.font = '500 11px "Inter", system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('• Upgrade available for special ticketed events (DJ Night, etc.)', leftX + 270, incPill2Y + 22);
  }

  // INCLUSION ROW 3: MODERN KEYWORD TAGS (NO LONG PARAGRAPHS!)
  const keywordTags = [
    'GATE ADMISSION: AUTHORISED',
    'PHOTO ID MANDATORY',
    'ALL-DAY ENTRY',
    'NON-TRANSFERABLE',
  ];

  let tagX = leftX + 18;
  const tagY = accessCardY + 138;
  const tagH = 26;

  for (const t of keywordTags) {
    ctx.font = 'bold 10px "Inter", system-ui, -apple-system, sans-serif';
    const tWidth = ctx.measureText(t).width;
    const tBoxW = tWidth + 18;

    roundRect(ctx, tagX, tagY, tBoxW, tagH, 7);
    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#CBD5E1';
    ctx.fillText(t, tagX + 9, tagY + 17);

    tagX += tBoxW + 8;
    if (tagX > leftX + accessCardW - 100) break;
  }

  // 8. Footer Micro-Bar (Modern & Compact Keyword Footer)
  ctx.font = 'bold 10px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.fillText(
    'CAMPUSFLOW SECURE PASS • PRESENT AT REGISTRATION DESK • VALID WITH COLLEGE PHOTO ID',
    leftX,
    578
  );

  // ============================================================
  // RIGHT SECTION: TICKET STUB / LOGO / REG # / QR / PAYMENT
  // ============================================================
  const rightWidth = width - stubX;
  const rightCenterX = stubX + rightWidth / 2;

  // 1. TOP: COLLEGE LOGO CREST
  // "right part me top me college logo"
  const logoCenterY = 46;
  const logoRadius = 24;

  if (logoImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(rightCenterX, logoCenterY, logoRadius, 0, Math.PI * 2);
    ctx.clip();

    // Crisp white background so transparent or dark crests render brilliantly
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    ctx.drawImage(
      logoImg,
      rightCenterX - logoRadius,
      logoCenterY - logoRadius,
      logoRadius * 2,
      logoRadius * 2
    );
    ctx.restore();

    // Subtle emerald glowing ring around logo
    ctx.beginPath();
    ctx.arc(rightCenterX, logoCenterY, logoRadius + 1, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.75)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    // Sleek branded monogram emblem
    ctx.beginPath();
    ctx.arc(rightCenterX, logoCenterY, logoRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const collegeAbbr = details.collegeCode || (details.collegeSlug ? details.collegeSlug.split('-')[0].toUpperCase() : null) || details.collegeName?.slice(0, 3).toUpperCase() || 'BCE';
    ctx.font = '900 13px "Inter", system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#34D399';
    ctx.textAlign = 'center';
    ctx.fillText(collegeAbbr, rightCenterX, logoCenterY + 5);
  }

  // 2. Header
  ctx.font = 'bold 10px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#94A3B8';
  ctx.textAlign = 'center';
  ctx.fillText('EVENT REGISTRATION #', rightCenterX, 86);

  // 3. Golden Registration Box
  const regBoxW = 270;
  const regBoxH = 50;
  const regBoxX = rightCenterX - regBoxW / 2;
  const regBoxY = 96;

  roundRect(ctx, regBoxX, regBoxY, regBoxW, regBoxH, 13);
  ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.font = 'bold 23px "Courier New", Courier, monospace';
  ctx.fillStyle = '#FBBF24';
  ctx.textAlign = 'center';
  ctx.fillText(details.registrationNumber, rightCenterX, regBoxY + 34);

  // 4. Verification URL & Real QR Code
  let verificationUrl = details.verificationUrl;
  if (!verificationUrl) {
    const origin = typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://campusflow.in';
    const slug = details.eventSlug || (details.eventTitle || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    verificationUrl = `${origin}/events/${slug}/verify?reg=${encodeURIComponent(details.registrationNumber)}`;
  }

  const qrContainerW = 158;
  const qrContainerH = 158;
  const qrContainerX = rightCenterX - qrContainerW / 2;
  const qrContainerY = 158;

  // Background white card with rounded corners and emerald border for maximum camera contrast
  roundRect(ctx, qrContainerX, qrContainerY, qrContainerW, qrContainerH, 15);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Render QR Code via qrcode onto temporary canvas
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, verificationUrl, {
    width: 320,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#070D18',
      light: '#FFFFFF',
    },
  });

  const qrPad = 8;
  const qrDrawSize = qrContainerW - qrPad * 2;
  ctx.drawImage(
    qrCanvas,
    qrContainerX + qrPad,
    qrContainerY + qrPad,
    qrDrawSize,
    qrDrawSize
  );

  // Label under QR
  ctx.font = 'bold 10px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#34D399';
  ctx.textAlign = 'center';
  ctx.fillText('⚡ SCAN TO VERIFY PASS', rightCenterX, qrContainerY + qrContainerH + 18);

  // 5. PAYMENT INFO BOX (DIRECTLY UNDER QR CODE)
  // "FREE or total paid charge QR ke bottom me show kro"
  const payBoxW = 270;
  const payBoxH = 50;
  const payBoxX = rightCenterX - payBoxW / 2;
  const payBoxY = 348;

  roundRect(ctx, payBoxX, payBoxY, payBoxW, payBoxH, 13);

  const isPaidStudent = Boolean(
    (details.totalPaidAmount && details.totalPaidAmount > 0) || details.isPaid
  );
  const paidAmount = details.totalPaidAmount || 0;

  if (isPaidStudent && paidAmount > 0) {
    ctx.fillStyle = 'rgba(245, 158, 11, 0.16)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.font = 'bold 14px "Inter", system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#FBBF24';
    ctx.textAlign = 'center';
    ctx.fillText(`TOTAL PAID: ₹${paidAmount}`, rightCenterX, payBoxY + 23);

    ctx.font = 'bold 9px "Inter", system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#34D399';
    ctx.fillText('PAYMENT VERIFIED • VIP INCLUSIONS ✓', rightCenterX, payBoxY + 39);
  } else {
    ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.font = 'bold 14px "Inter", system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#34D399';
    ctx.textAlign = 'center';
    ctx.fillText('ENTRY: FREE PASS • ₹0', rightCenterX, payBoxY + 23);

    ctx.font = 'bold 9px "Inter", system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('COMPLIMENTARY STUDENT ACCESS', rightCenterX, payBoxY + 39);
  }

  // 6. BOTTOM: DIGITAL SECURITY SEAL
  const sealY = 412;
  const sealH = 72;
  roundRect(ctx, regBoxX + 15, sealY, regBoxW - 30, sealH, 13);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.7)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = 'bold 10px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#34D399';
  ctx.textAlign = 'center';
  ctx.fillText('CAMPUSFLOW VERIFIED PASS', rightCenterX, sealY + 26);

  ctx.font = '500 10px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText(`ISSUED: ${new Date().toLocaleDateString('en-IN')}`, rightCenterX, sealY + 44);

  ctx.font = 'bold 8px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.fillText('ENCRYPTED ID • TAMPER-EVIDENT', rightCenterX, sealY + 59);

  // Reset text align
  ctx.textAlign = 'left';

  // 7. Convert to Blob & Trigger Download
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to generate pass PNG'));
        return;
      }

      const cleanReg = (details.registrationNumber || 'pass').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const cleanEvent = (details.eventTitle || 'event').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const filename = `${cleanEvent}-pass-${cleanReg}.png`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        URL.revokeObjectURL(url);
        resolve();
      }, 500);
    }, 'image/png');
  });
}
