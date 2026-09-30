import PDFDocument from 'pdfkit';
import type { CollegeEvent, EventRegistration, EventStats } from '@/types/events';
import type { CollegeBranding } from '@/lib/tenant/branding';

const COLORS = {
  primary: '#0B192C',
  secondary: '#1E3E62',
  slateDark: '#1E293B',
  slateMuted: '#64748B',
  border: '#CBD5E1',
  bgLight: '#F8FAFC',
  white: '#FFFFFF',
  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
};

function streamToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

async function fetchLogoBuffer(url?: string | null): Promise<Buffer | null> {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

export async function generateEventEnrollmentPDF(params: {
  event: CollegeEvent;
  registrations: EventRegistration[];
  stats: EventStats;
  collegeName: string;
  collegeCode?: string;
  branding?: CollegeBranding;
}): Promise<Buffer> {
  const { event, registrations, stats, collegeName, collegeCode = 'COLLEGE', branding } = params;
  const isPaid = event.payment_required;

  // Landscape A4 for wide table presentation
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 36, // 0.5 inch margins
    info: {
      Title: `${event.title} - Enrollment Roster`,
      Author: `${collegeName} Event Management`,
      Subject: 'Official Student Event Enrollment Roster',
      Keywords: 'event, enrollment, registration, college',
    },
  });

  const bufferPromise = streamToBuffer(doc);

  // Load logo buffer if present
  const logoBuffer = await fetchLogoBuffer(branding?.logoUrl);

  const pageWidth = doc.page.width; // 841.89 pt
  const pageHeight = doc.page.height; // 595.28 pt
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  // --- HEADER SECTION ---
  let y = margin;

  // Header background bar
  doc
    .rect(margin, y, contentWidth, 68)
    .fillAndStroke(COLORS.bgLight, COLORS.border);

  // Logo or Fallback Monogram
  const logoX = margin + 12;
  const logoY = y + 10;
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, logoX, logoY, { fit: [48, 48], align: 'center', valign: 'center' });
    } catch {
      // Fallback
      doc.rect(logoX, logoY, 48, 48).fill(branding?.primaryColor || COLORS.primary);
      doc.fillColor(COLORS.white).fontSize(14).font('Helvetica-Bold').text(collegeCode.slice(0, 3), logoX, logoY + 16, { width: 48, align: 'center' });
    }
  } else {
    doc.rect(logoX, logoY, 48, 48).fill(branding?.primaryColor || COLORS.primary);
    doc.fillColor(COLORS.white).fontSize(14).font('Helvetica-Bold').text(collegeCode.slice(0, 4), logoX, logoY + 16, { width: 48, align: 'center' });
  }

  // Institution & Event Info
  const textX = logoX + 58;
  doc
    .fillColor(branding?.primaryColor || COLORS.primary)
    .fontSize(14)
    .font('Helvetica-Bold')
    .text(collegeName, textX, y + 10, { width: contentWidth - 250, ellipsis: true });

  doc
    .fillColor(COLORS.secondary)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text(`Event: ${event.title}`, textX, y + 27, { width: contentWidth - 250, ellipsis: true });

  const eventDateStr = new Date(event.start_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  doc
    .fillColor(COLORS.slateMuted)
    .fontSize(9)
    .font('Helvetica')
    .text(`Venue: ${event.venue}  |  Date: ${eventDateStr}  |  Generated: ${new Date().toLocaleDateString('en-IN')}`, textX, y + 43);

  // Total Enrolled Badge (Top Right)
  const badgeWidth = 140;
  const badgeX = margin + contentWidth - badgeWidth - 12;
  const badgeY = y + 10;
  doc.rect(badgeX, badgeY, badgeWidth, 48).fillAndStroke(COLORS.white, COLORS.border);
  doc.fillColor(COLORS.slateMuted).fontSize(8).font('Helvetica').text('TOTAL ENROLLED', badgeX, badgeY + 8, { width: badgeWidth, align: 'center' });
  doc.fillColor(COLORS.primary).fontSize(16).font('Helvetica-Bold').text(String(stats.totalEnrolled), badgeX, badgeY + 22, { width: badgeWidth, align: 'center' });

  y += 78;

  // --- TABLE COLUMN DEFINITIONS ---
  interface ColDef {
    header: string;
    width: number;
    align: 'left' | 'center' | 'right';
  }

  const columns: ColDef[] = [
    { header: 'S.No', width: 34, align: 'center' },
    { header: 'Reg. Number', width: 90, align: 'left' },
    { header: 'Student Name', width: 130, align: 'left' },
    { header: 'Email', width: 140, align: 'left' },
    { header: 'Mobile', width: 85, align: 'center' },
    { header: 'Branch', width: 85, align: 'left' },
    { header: 'Sem', width: 36, align: 'center' },
  ];

  if (isPaid) {
    columns.push({ header: 'Payment Status', width: 85, align: 'center' });
  }
  columns.push({ header: 'Registration Status', width: 84, align: 'center' });

  const renderTableHeader = (currentY: number) => {
    doc.rect(margin, currentY, contentWidth, 22).fill(COLORS.primary);
    let colX = margin;
    doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(8.5);

    for (const col of columns) {
      doc.text(col.header, colX + 4, currentY + 6, {
        width: col.width - 8,
        align: col.align,
      });
      colX += col.width;
    }
    return currentY + 22;
  };

  y = renderTableHeader(y);

  // Table Body Rows
  const rowHeight = 19;
  let rowIdx = 0;

  for (const reg of registrations) {
    rowIdx++;

    // Pagination check
    if (y + rowHeight > pageHeight - margin - 35) {
      doc.addPage();
      y = margin;
      y = renderTableHeader(y);
    }

    const isEven = rowIdx % 2 === 0;
    if (isEven) {
      doc.rect(margin, y, contentWidth, rowHeight).fill('#F1F5F9');
    }

    // Border line bottom
    doc.moveTo(margin, y + rowHeight).lineTo(margin + contentWidth, y + rowHeight).strokeColor('#E2E8F0').lineWidth(0.5).stroke();

    let colX = margin;
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.slateDark);

    // 1. S.No
    doc.text(String(rowIdx), colX + 2, y + 5, { width: columns[0].width - 4, align: 'center' });
    colX += columns[0].width;

    // 2. Reg. Number
    doc.font('Helvetica-Bold').text(reg.registration_number, colX + 4, y + 5, { width: columns[1].width - 8, align: 'left', ellipsis: true });
    doc.font('Helvetica');
    colX += columns[1].width;

    // 3. Student Name
    doc.text(reg.student_name, colX + 4, y + 5, { width: columns[2].width - 8, align: 'left', ellipsis: true });
    colX += columns[2].width;

    // 4. Email
    doc.text(reg.email, colX + 4, y + 5, { width: columns[3].width - 8, align: 'left', ellipsis: true });
    colX += columns[3].width;

    // 5. Mobile
    doc.text(reg.mobile, colX + 4, y + 5, { width: columns[4].width - 8, align: 'center' });
    colX += columns[4].width;

    // 6. Branch
    const branchName = reg.branch?.code || reg.branch?.name || '-';
    doc.text(branchName, colX + 4, y + 5, { width: columns[5].width - 8, align: 'left', ellipsis: true });
    colX += columns[5].width;

    // 7. Sem
    const semName = reg.semester?.semester_number ? `Sem ${reg.semester.semester_number}` : '-';
    doc.text(semName, colX + 2, y + 5, { width: columns[6].width - 4, align: 'center' });
    colX += columns[6].width;

    // 8. Payment Status (if paid event)
    if (isPaid) {
      const pColor =
        reg.payment_status === 'VERIFIED'
          ? COLORS.success
          : reg.payment_status === 'REJECTED'
          ? COLORS.danger
          : COLORS.warning;
      doc.fillColor(pColor).font('Helvetica-Bold').text(reg.payment_status, colX + 4, y + 5, { width: columns[7].width - 8, align: 'center' });
      doc.fillColor(COLORS.slateDark).font('Helvetica');
      colX += columns[7].width;
    }

    // 9. Registration Status
    const rColor = reg.registration_status === 'REGISTERED' ? COLORS.primary : COLORS.danger;
    doc.fillColor(rColor).font('Helvetica-Bold').text(reg.registration_status, colX + 4, y + 5, { width: columns[columns.length - 1].width - 8, align: 'center' });

    y += rowHeight;
  }

  // --- SUMMARY STATISTICS BAR AT BOTTOM ---
  if (y + 36 > pageHeight - margin) {
    doc.addPage();
    y = margin;
  } else {
    y += 10;
  }

  doc.rect(margin, y, contentWidth, 26).fillAndStroke('#F8FAFC', COLORS.border);

  let summaryText = `Total Enrolled: ${stats.totalEnrolled}`;
  if (isPaid) {
    summaryText += `    |    Payment Verified: ${stats.paymentVerified}    |    Payment Pending: ${stats.paymentPending}    |    Payment Rejected: ${stats.paymentRejected}`;
  }
  if (stats.availableSeats !== null) {
    summaryText += `    |    Available Seats: ${stats.availableSeats}`;
  }

  doc
    .fillColor(COLORS.primary)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text(summaryText, margin + 12, y + 8, { width: contentWidth - 24, align: 'center' });

  // Page numbers on all pages
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .fillColor(COLORS.slateMuted)
      .fontSize(8)
      .font('Helvetica')
      .text(
        `Page ${i + 1} of ${range.count}  •  ${collegeName}  •  Confidential Official Record`,
        margin,
        pageHeight - 24,
        { width: contentWidth, align: 'center' }
      );
  }

  doc.end();
  return bufferPromise;
}

export const generateEnrollmentPDF = generateEventEnrollmentPDF;
