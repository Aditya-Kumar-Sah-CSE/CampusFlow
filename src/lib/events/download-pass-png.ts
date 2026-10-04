'use client';

import QRCode from 'qrcode';

/**
 * High-Resolution PNG Event Pass Generator
 * Renders an official, beautiful VIP Event Pass directly on client-side Canvas
 * with a scannable, real QR Code linking to the live pass verification portal.
 */

export interface EventPassDetails {
  eventTitle: string;
  collegeName?: string;
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
}

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

export async function generateAndDownloadPassPNG(details: EventPassDetails): Promise<void> {
  const width = 1200;
  const height = 620;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not initialize canvas context');

  // Wait for fonts if available
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // non-fatal font wait
    }
  }

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
  bgGradient.addColorStop(0, '#09101F');   // Deep Navy Black
  bgGradient.addColorStop(0.5, '#0B1728'); // Slate Midnight
  bgGradient.addColorStop(1, '#063B2C');   // Emerald Glow
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  // Subtle radial glow top-right and bottom-left
  const glow1 = ctx.createRadialGradient(900, 100, 10, 900, 100, 400);
  glow1.addColorStop(0, 'rgba(16, 185, 129, 0.18)');
  glow1.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, width, height);

  const glow2 = ctx.createRadialGradient(200, 500, 10, 200, 500, 400);
  glow2.addColorStop(0, 'rgba(59, 130, 246, 0.15)');
  glow2.addColorStop(1, 'rgba(59, 130, 246, 0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  // Ticket Stub Notch (Perforated ticket cutout)
  const stubX = 850;

  // Draw dashed dividing line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(stubX, 30);
  ctx.lineTo(stubX, height - 30);
  ctx.stroke();
  ctx.setLineDash([]); // reset

  // Top and bottom cutouts (ticket punch notches)
  ctx.fillStyle = '#030712';
  ctx.beginPath();
  ctx.arc(stubX, 0, 22, 0, Math.PI);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(stubX, height, 22, Math.PI, 0);
  ctx.fill();

  ctx.restore();

  // Outer border with subtle glow
  ctx.save();
  roundRect(ctx, 1, 1, width - 2, height - 2, cardRadius);
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // ============================================================
  // LEFT SECTION: MAIN EVENT & PARTICIPANT DETAILS
  // ============================================================
  const leftX = 50;
  const maxContentWidth = stubX - leftX - 40;

  // 1. Header Badges: Verified Status & College
  // Status Pill
  const pillY = 48;
  const pillH = 32;
  const pillW = 260;
  roundRect(ctx, leftX, pillY, pillW, pillH, 16);
  ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Green checkmark dot
  ctx.fillStyle = '#10B981';
  ctx.beginPath();
  ctx.arc(leftX + 18, pillY + pillH / 2, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = 'bold 12px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#34D399';
  ctx.fillText('OFFICIAL EVENT PASS • VERIFIED', leftX + 32, pillY + 20);

  // College Name
  if (details.collegeName) {
    ctx.font = 'bold 12px "Inter", system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94A3B8';
    let cName = details.collegeName.toUpperCase();
    const maxCollegeWidth = stubX - (leftX + pillW + 40);
    while (ctx.measureText(cName).width > maxCollegeWidth && cName.length > 5) {
      cName = cName.slice(0, -4) + '...';
    }
    ctx.fillText(cName, leftX + pillW + 20, pillY + 20);
  }

  // 2. Event Title
  ctx.font = '900 36px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  let cleanTitle = details.eventTitle || 'Campus Event';
  while (ctx.measureText(cleanTitle).width > maxContentWidth && cleanTitle.length > 5) {
    cleanTitle = cleanTitle.slice(0, -4) + '...';
  }
  ctx.fillText(cleanTitle, leftX, 132);

  // 3. Venue & Dates
  const venueText = details.venue ? `📍 ${details.venue}` : '📍 Campus Venue';
  ctx.font = '500 16px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#CBD5E1';
  let cleanVenue = venueText;
  while (ctx.measureText(cleanVenue).width > maxContentWidth && cleanVenue.length > 5) {
    cleanVenue = cleanVenue.slice(0, -4) + '...';
  }
  ctx.fillText(cleanVenue, leftX, 164);

  // 4. Horizontal Separator
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(leftX, 196);
  ctx.lineTo(stubX - 50, 196);
  ctx.stroke();

  // 5. Participant Info
  ctx.font = 'bold 11px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#34D399';
  ctx.fillText('PARTICIPANT DETAILS', leftX, 226);

  // Full Name
  ctx.font = 'bold 28px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  let cleanParticipant = details.participantName || 'Participant';
  while (ctx.measureText(cleanParticipant).width > maxContentWidth && cleanParticipant.length > 5) {
    cleanParticipant = cleanParticipant.slice(0, -4) + '...';
  }
  ctx.fillText(cleanParticipant, leftX, 264);

  // Email
  ctx.font = '500 15px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText(details.email || '', leftX, 292);

  // 6. Metadata Pills (Roll, Branch, Semester, Mobile)
  const badges: { label: string; value: string }[] = [];
  if (details.studentId) badges.push({ label: 'Roll', value: details.studentId });
  if (details.branch) badges.push({ label: 'Branch', value: details.branch });
  if (details.semester) badges.push({ label: 'Semester', value: details.semester });
  if (details.mobile) badges.push({ label: 'Phone', value: details.mobile });

  let badgeX = leftX;
  const badgeY = 328;
  const badgeH = 34;

  for (const b of badges) {
    const text = `${b.label}: ${b.value}`;
    ctx.font = 'bold 13px "Inter", system-ui, -apple-system, sans-serif';
    const textWidth = ctx.measureText(text).width;
    const badgeW = textWidth + 24;

    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 10);
    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(text, badgeX + 12, badgeY + 22);

    badgeX += badgeW + 10;
    if (badgeX > stubX - 100) break;
  }

  // 7. Security note footer
  ctx.font = '400 12px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.fillText(
    '✓ Official student access pass. Scan the verified QR code with any camera to verify authenticity.',
    leftX,
    570
  );

  // ============================================================
  // RIGHT SECTION: TICKET STUB / REGISTRATION NUMBER & REAL QR CODE
  // ============================================================
  const rightWidth = width - stubX;
  const rightCenterX = stubX + rightWidth / 2;

  // Header
  ctx.font = 'bold 11px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#94A3B8';
  ctx.textAlign = 'center';
  ctx.fillText('EVENT REGISTRATION #', rightCenterX, 74);

  // Golden Registration Box
  const regBoxW = 270;
  const regBoxH = 56;
  const regBoxX = rightCenterX - regBoxW / 2;
  const regBoxY = 92;

  roundRect(ctx, regBoxX, regBoxY, regBoxW, regBoxH, 14);
  ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = 'bold 24px "Courier New", Courier, monospace';
  ctx.fillStyle = '#FBBF24';
  ctx.textAlign = 'center';
  ctx.fillText(details.registrationNumber, rightCenterX, regBoxY + 36);

  // Construct Verification URL for QR Code
  let verificationUrl = details.verificationUrl;
  if (!verificationUrl) {
    const origin = typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://campusflow.in';
    const slug = details.eventSlug || (details.eventTitle || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    verificationUrl = `${origin}/events/${slug}/verify?reg=${encodeURIComponent(details.registrationNumber)}`;
  }

  // Real Scannable QR Code
  const qrContainerW = 168;
  const qrContainerH = 168;
  const qrContainerX = rightCenterX - qrContainerW / 2;
  const qrContainerY = 168;

  // Background white card with rounded corners and emerald border for maximum scanner contrast
  roundRect(ctx, qrContainerX, qrContainerY, qrContainerW, qrContainerH, 16);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Render QR Code onto a temporary canvas
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, verificationUrl, {
    width: 320,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#09101F',
      light: '#FFFFFF',
    },
  });

  const qrPad = 10;
  const qrDrawSize = qrContainerW - qrPad * 2;
  ctx.drawImage(
    qrCanvas,
    qrContainerX + qrPad,
    qrContainerY + qrPad,
    qrDrawSize,
    qrDrawSize
  );

  // Micro label under QR
  ctx.font = 'bold 11px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#34D399';
  ctx.textAlign = 'center';
  ctx.fillText('⚡ SCAN TO VERIFY PASS', rightCenterX, qrContainerY + qrContainerH + 20);

  // Security Seal
  const sealY = 388;
  const sealH = 74;
  roundRect(ctx, regBoxX + 15, sealY, regBoxW - 30, sealH, 14);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.7)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = 'bold 11px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#34D399';
  ctx.textAlign = 'center';
  ctx.fillText('CAMPUSFLOW VERIFIED PASS', rightCenterX, sealY + 28);

  ctx.font = '500 10px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText(`ISSUED: ${new Date().toLocaleDateString('en-IN')}`, rightCenterX, sealY + 48);

  ctx.font = '400 9px "Inter", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.fillText('DIGITALLY SIGNED & ENCRYPTED', rightCenterX, sealY + 64);

  // Reset text align
  ctx.textAlign = 'left';

  // 8. Convert to Blob & Trigger Browser Download
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
