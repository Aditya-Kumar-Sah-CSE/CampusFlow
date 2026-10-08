import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { getAttemptResult } from './exam-attempt-service';
import { getExamResultsDashboard } from './exam-service';
import { getExamDbClient } from './exam-permission';
import { BCE_BGP_LOGO_DATA_URI } from '@/lib/events/college-logos';
import { renderPdfAttributionFooter } from '@/lib/utils/pdf-attribution';
import type { ExamAttemptResult } from '@/types/exams';

const COLORS = {
  primary: '#1B365D', // Deep Navy
  secondary: '#334155', // Slate 700
  accent: '#2563EB', // Blue 600
  success: '#059669', // Emerald 600
  warning: '#D97706', // Amber 600
  danger: '#DC2626', // Red 600
  border: '#CBD5E1', // Slate 300
  bgLight: '#F8FAFC', // Slate 50
  textMuted: '#64748B', // Slate 500
  white: '#FFFFFF',
};

function streamToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

const logoBufferCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const LOGO_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Fetches logo buffer handling Data URI, local static file, and fallbacks.
 */
async function fetchCollegeLogoBuffer(logoUrl?: string | null): Promise<Buffer | null> {
  if (logoUrl) {
    const cached = logoBufferCache.get(logoUrl);
    if (cached && Date.now() - cached.timestamp < LOGO_CACHE_TTL) {
      return cached.buffer;
    }
  }

  if (logoUrl && logoUrl.startsWith('data:image/')) {
    try {
      const base64Data = logoUrl.split(',')[1];
      if (base64Data) {
        const buf = Buffer.from(base64Data, 'base64');
        logoBufferCache.set(logoUrl, { buffer: buf, timestamp: Date.now() });
        return buf;
      }
    } catch {}
  }

  if (logoUrl && logoUrl.startsWith('/')) {
    try {
      const localPath = path.join(process.cwd(), 'public', logoUrl.replace(/^\//, ''));
      if (fs.existsSync(localPath)) {
        const buf = fs.readFileSync(localPath);
        logoBufferCache.set(logoUrl, { buffer: buf, timestamp: Date.now() });
        return buf;
      }
    } catch {}
  }

  if (logoUrl && logoUrl.startsWith('http')) {
    try {
      const res = await fetch(logoUrl, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const ab = await res.arrayBuffer();
        const buf = Buffer.from(ab);
        logoBufferCache.set(logoUrl, { buffer: buf, timestamp: Date.now() });
        return buf;
      }
    } catch {}
  }

  // Fallback to BCE built-in logo
  try {
    const base64 = BCE_BGP_LOGO_DATA_URI.split(',')[1];
    if (base64) return Buffer.from(base64, 'base64');
  } catch {}

  return null;
}

/**
 * Generates an official, vector-sharp Student Examination Scorecard PDF.
 */
export async function generateStudentResultPdf(attemptId: string): Promise<Buffer> {
  const resultData: ExamAttemptResult = await getAttemptResult(attemptId);
  const { attempt, exam, breakdown } = resultData;

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 32, bottom: 42, left: 36, right: 36 },
    bufferPages: true,
  });

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  // Fetch institution logo
  const collegeLogoBuffer = await fetchCollegeLogoBuffer(attempt.college?.logo_url);

  // Top color accent
  doc.rect(margin, 25, contentWidth, 4).fill(COLORS.accent);

  // Header Section
  const logoSize = 44;
  if (collegeLogoBuffer) {
    try {
      doc.image(collegeLogoBuffer, margin, 35, { width: logoSize, height: logoSize, fit: [logoSize, logoSize] });
    } catch {}
  }

  const headerLeft = collegeLogoBuffer ? margin + logoSize + 14 : margin;
  const collegeName = attempt.college?.name || 'INSTITUTION EXAMINATION AUTHORITY';

  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor(COLORS.primary)
    .text(collegeName.toUpperCase(), headerLeft, 35, { width: contentWidth - (headerLeft - margin) });

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(COLORS.accent)
    .text('OFFICIAL EXAMINATION SCORECARD & PERFORMANCE TRANSCRIPT', headerLeft, 52);

  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor(COLORS.textMuted)
    .text(`Issued by CampusFlow Academic Assessment Engine • Generated: ${new Date().toLocaleString()}`, headerLeft, 65);

  // Divider line
  let curY = 88;
  doc.strokeColor(COLORS.border).lineWidth(0.5).moveTo(margin, curY).lineTo(pageWidth - margin, curY).stroke();

  // Exam Meta Banner
  curY += 8;
  doc.rect(margin, curY, contentWidth, 38).fill(COLORS.bgLight);
  doc.rect(margin, curY, contentWidth, 38).strokeColor(COLORS.border).lineWidth(0.5).stroke();

  const subjectNames = (exam.subjects || []).map((s: any) => `${s.name} (${s.code || 'N/A'})`).join(', ') || 'N/A';
  const sessionText = (exam.academic_session as any)?.name || (exam.academic_session as any)?.year_range || 'N/A';
  const semText = exam.semester?.name || ((exam.semester as any)?.semester_number ? `Semester ${(exam.semester as any).semester_number}` : 'N/A');

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(COLORS.primary)
    .text(exam.title, margin + 10, curY + 6);

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(COLORS.secondary)
    .text(`Subject: ${subjectNames}   |   Session: ${sessionText}   |   ${semText}`, margin + 10, curY + 22);

  curY += 46;

  // Student Details Box (Left) & Score Badge (Right)
  const leftBoxWidth = contentWidth * 0.58;
  const rightBoxWidth = contentWidth * 0.40;
  const cardHeight = 74;

  // Student Info Card
  doc.rect(margin, curY, leftBoxWidth, cardHeight).fill(COLORS.white);
  doc.rect(margin, curY, leftBoxWidth, cardHeight).strokeColor(COLORS.border).lineWidth(0.5).stroke();

  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor(COLORS.primary)
    .text('STUDENT CREDENTIALS', margin + 8, curY + 6);

  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(COLORS.secondary)
    .text('Name:', margin + 8, curY + 20)
    .font('Helvetica')
    .text(attempt.student_name, margin + 70, curY + 20)
    .font('Helvetica-Bold')
    .text('Roll No:', margin + 8, curY + 32)
    .font('Helvetica')
    .text(attempt.roll_number, margin + 70, curY + 32)
    .font('Helvetica-Bold')
    .text('Reg No:', margin + 8, curY + 44)
    .font('Helvetica')
    .text(attempt.registration_number, margin + 70, curY + 44)
    .font('Helvetica-Bold')
    .text('Branch:', margin + 8, curY + 56)
    .font('Helvetica')
    .text(attempt.branch?.name || 'General Scope', margin + 70, curY + 56);

  // Score Badge Card
  const scoreX = margin + leftBoxWidth + (contentWidth * 0.02);
  const isPassed = attempt.is_passed;
  const statusColor = isPassed ? COLORS.success : COLORS.danger;

  doc.rect(scoreX, curY, rightBoxWidth, cardHeight).fill(COLORS.bgLight);
  doc.rect(scoreX, curY, rightBoxWidth, cardHeight).strokeColor(COLORS.border).lineWidth(0.5).stroke();

  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor(COLORS.primary)
    .text('ASSESSMENT OUTCOME', scoreX + 8, curY + 6);

  // Score value
  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor(COLORS.primary)
    .text(`${attempt.obtained_marks}`, scoreX + 8, curY + 20, { continued: true })
    .font('Helvetica')
    .fontSize(9.5)
    .fillColor(COLORS.textMuted)
    .text(` / ${attempt.total_marks} Marks (${attempt.percentage}%)`);

  // Pass / Fail Pill
  const pillY = curY + 48;
  doc.roundedRect(scoreX + 8, pillY, 68, 16, 3).fill(statusColor);
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(COLORS.white)
    .text(isPassed ? 'PASSED' : 'FAILED', scoreX + 8, pillY + 4, { width: 68, align: 'center' });

  // Attempt # & Mode
  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor(COLORS.textMuted)
    .text(`Attempt: #${attempt.attempt_number} • ${attempt.status}`, scoreX + 82, pillY + 4);

  curY += cardHeight + 10;

  // Analytics Metrics Bar
  const statBoxWidth = contentWidth / 5;
  const stats = [
    { label: 'Total Questions', val: attempt.total_questions || 0, color: COLORS.secondary },
    { label: 'Attempted', val: attempt.attempted_count || 0, color: COLORS.accent },
    { label: 'Correct', val: attempt.correct_count || 0, color: COLORS.success },
    { label: 'Wrong', val: attempt.wrong_count || 0, color: COLORS.danger },
    { label: 'Unanswered', val: attempt.unanswered_count || 0, color: COLORS.warning },
  ];

  stats.forEach((st, idx) => {
    const x = margin + idx * statBoxWidth;
    doc.rect(x, curY, statBoxWidth - 3, 34).fill(COLORS.white);
    doc.rect(x, curY, statBoxWidth - 3, 34).strokeColor(COLORS.border).lineWidth(0.5).stroke();

    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(st.color)
      .text(String(st.val), x + 6, curY + 5);

    doc
      .font('Helvetica')
      .fontSize(6.8)
      .fillColor(COLORS.textMuted)
      .text(st.label, x + 6, curY + 20);
  });

  curY += 44;

  // Question Breakdown Section Header
  doc
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .fillColor(COLORS.primary)
    .text('QUESTION-BY-QUESTION EVALUATION DETAILS', margin, curY);

  curY += 14;

  // Breakdown Table Header
  const colW = {
    num: 28,
    q: 230,
    stuAns: 105,
    correctAns: 105,
    marks: 55,
  };

  doc.rect(margin, curY, contentWidth, 18).fill(COLORS.primary);
  doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.white);

  let hX = margin;
  doc.text('Q#', hX + 4, curY + 5, { width: colW.num });
  hX += colW.num;
  doc.text('Question Statement', hX + 4, curY + 5, { width: colW.q });
  hX += colW.q;
  doc.text('Student Answer', hX + 4, curY + 5, { width: colW.stuAns });
  hX += colW.stuAns;
  doc.text('Correct Answer', hX + 4, curY + 5, { width: colW.correctAns });
  hX += colW.correctAns;
  doc.text('Marks', hX + 4, curY + 5, { width: colW.marks });

  curY += 18;

  // Rows
  if (!breakdown || breakdown.length === 0) {
    doc.rect(margin, curY, contentWidth, 24).fill(COLORS.bgLight);
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textMuted).text(
      'Detailed question results are restricted by examination administration policy.',
      margin + 8,
      curY + 7
    );
    curY += 24;
  } else {
    for (let i = 0; i < breakdown.length; i++) {
      const row = breakdown[i];
      const isOdd = i % 2 === 1;

      // Check if page overflow
      if (curY > pageHeight - 65) {
        doc.addPage();
        curY = 36;
        // Redraw table header on new page
        doc.rect(margin, curY, contentWidth, 18).fill(COLORS.primary);
        doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.white);
        let rhX = margin;
        doc.text('Q#', rhX + 4, curY + 5, { width: colW.num });
        rhX += colW.num;
        doc.text('Question Statement', rhX + 4, curY + 5, { width: colW.q });
        rhX += colW.q;
        doc.text('Student Answer', rhX + 4, curY + 5, { width: colW.stuAns });
        rhX += colW.stuAns;
        doc.text('Correct Answer', rhX + 4, curY + 5, { width: colW.correctAns });
        rhX += colW.correctAns;
        doc.text('Marks', rhX + 4, curY + 5, { width: colW.marks });
        curY += 18;
      }

      const isUnanswered = !row.selected_option_id;
      const qText = row.question_text.length > 95 ? row.question_text.slice(0, 92) + '...' : row.question_text;
      const stuAnsText = row.selected_option_text || (isUnanswered ? '— (Not Attempted)' : '—');
      const correctAnsText = row.correct_option_text || '— (Hidden)';

      const rowH = 22;
      if (isOdd) {
        doc.rect(margin, curY, contentWidth, rowH).fill(COLORS.bgLight);
      }
      doc.rect(margin, curY, contentWidth, rowH).strokeColor(COLORS.border).lineWidth(0.25).stroke();

      let rX = margin;
      // Q#
      doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.primary).text(`Q${i + 1}`, rX + 4, curY + 6, { width: colW.num });
      rX += colW.num;

      // Question
      doc.font('Helvetica').fontSize(6.8).fillColor(COLORS.secondary).text(qText, rX + 4, curY + 6, { width: colW.q - 8 });
      rX += colW.q;

      // Student Answer
      const stuColor = isUnanswered ? COLORS.textMuted : row.is_correct ? COLORS.success : COLORS.danger;
      doc.font('Helvetica').fontSize(6.8).fillColor(stuColor).text(stuAnsText, rX + 4, curY + 6, { width: colW.stuAns - 8 });
      rX += colW.stuAns;

      // Correct Answer
      doc.font('Helvetica').fontSize(6.8).fillColor(COLORS.secondary).text(correctAnsText, rX + 4, curY + 6, { width: colW.correctAns - 8 });
      rX += colW.correctAns;

      // Marks
      const marksPrefix = row.marks_awarded > 0 ? `+${row.marks_awarded}` : `${row.marks_awarded}`;
      const marksColor = row.marks_awarded > 0 ? COLORS.success : row.marks_awarded < 0 ? COLORS.danger : COLORS.textMuted;
      doc.font('Helvetica-Bold').fontSize(7).fillColor(marksColor).text(`${marksPrefix} / ${row.marks}`, rX + 4, curY + 6, { width: colW.marks - 8 });

      curY += rowH;
    }
  }

  // Draw footer on all pages
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const footerY = pageHeight - 34;

    doc.strokeColor(COLORS.border).lineWidth(0.5).moveTo(margin, footerY - 5).lineTo(pageWidth - margin, footerY - 5).stroke();

    doc
      .font('Helvetica')
      .fontSize(6.5)
      .fillColor(COLORS.textMuted)
      .text(
        `CampusFlow Exam Security Engine • Verification Code: CF-EXAM-${attempt.id.slice(0, 8).toUpperCase()} • Page ${i + 1} of ${range.count}`,
        margin,
        footerY,
        { width: contentWidth }
      );

    renderPdfAttributionFooter(doc, footerY + 11, { fontSize: 6.2 });
  }

  doc.end();
  return await streamToBuffer(doc);
}

/**
 * Generates an official Exam Results Master Roster PDF for Faculty / Administration.
 */
export async function generateExamRosterPdf(examId: string, collegeId: string): Promise<Buffer> {
  const dashboard: any = await getExamResultsDashboard(examId, collegeId);
  const { exam, summary, attempts } = dashboard;

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: 32, bottom: 42, left: 36, right: 36 },
    bufferPages: true,
  });

  const pageWidth = 841.89; // Landscape A4
  const pageHeight = 595.28;
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  const collegeLogoBuffer = await fetchCollegeLogoBuffer((exam as any).college?.logo_url);

  // Top color accent
  doc.rect(margin, 25, contentWidth, 4).fill(COLORS.accent);

  // Header Section
  const logoSize = 40;
  if (collegeLogoBuffer) {
    try {
      doc.image(collegeLogoBuffer, margin, 34, { width: logoSize, height: logoSize, fit: [logoSize, logoSize] });
    } catch {}
  }

  const headerLeft = collegeLogoBuffer ? margin + logoSize + 14 : margin;
  const collegeName = (exam as any).college?.name || 'INSTITUTION EXAMINATION AUTHORITY';

  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor(COLORS.primary)
    .text(collegeName.toUpperCase(), headerLeft, 34, { width: contentWidth - (headerLeft - margin) });

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(COLORS.accent)
    .text('COMPREHENSIVE EXAMINATION RESULTS MASTER ROSTER', headerLeft, 50);

  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor(COLORS.textMuted)
    .text(`Exam: ${exam.title} (${exam.exam_code}) • Session: ${(exam.academic_session as any)?.name || (exam.academic_session as any)?.year_range || 'N/A'} • Generated: ${new Date().toLocaleString()}`, headerLeft, 62);

  let curY = 82;
  doc.strokeColor(COLORS.border).lineWidth(0.5).moveTo(margin, curY).lineTo(pageWidth - margin, curY).stroke();

  // Summary KPI Cards (Horizontal 6 stats)
  curY += 8;
  const cardW = contentWidth / 6;
  const statList = [
    { label: 'Total Attempts', val: summary.total_attempts || summary.total_submissions || 0, color: COLORS.primary },
    { label: 'Unique Students', val: summary.unique_students_count || summary.total_students_attempted || 0, color: COLORS.secondary },
    { label: 'Average Score', val: `${summary.average_score} (${summary.average_percentage}%)`, color: COLORS.accent },
    { label: 'Highest Score', val: summary.highest_score, color: COLORS.success },
    { label: 'Pass Count', val: `${summary.pass_count} (${summary.pass_percentage || summary.pass_rate_percentage || 0}%)`, color: COLORS.success },
    { label: 'Fail Count', val: summary.fail_count, color: COLORS.danger },
  ];

  statList.forEach((st, idx) => {
    const x = margin + idx * cardW;
    doc.rect(x, curY, cardW - 4, 30).fill(COLORS.bgLight);
    doc.rect(x, curY, cardW - 4, 30).strokeColor(COLORS.border).lineWidth(0.5).stroke();

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(st.color)
      .text(String(st.val), x + 6, curY + 4);

    doc
      .font('Helvetica')
      .fontSize(6.5)
      .fillColor(COLORS.textMuted)
      .text(st.label, x + 6, curY + 18);
  });

  curY += 38;

  // Table Columns Setup
  const cols = {
    sno: 26,
    roll: 64,
    reg: 76,
    name: 140,
    branch: 90,
    att: 38,
    score: 65,
    pct: 55,
    status: 55,
    submitted: 160,
  };

  // Header Row
  doc.rect(margin, curY, contentWidth, 18).fill(COLORS.primary);
  doc.font('Helvetica-Bold').fontSize(7.2).fillColor(COLORS.white);

  let hX = margin;
  doc.text('S.No', hX + 4, curY + 5, { width: cols.sno });
  hX += cols.sno;
  doc.text('Roll No', hX + 4, curY + 5, { width: cols.roll });
  hX += cols.roll;
  doc.text('Reg No', hX + 4, curY + 5, { width: cols.reg });
  hX += cols.reg;
  doc.text('Student Name', hX + 4, curY + 5, { width: cols.name });
  hX += cols.name;
  doc.text('Branch', hX + 4, curY + 5, { width: cols.branch });
  hX += cols.branch;
  doc.text('Att#', hX + 4, curY + 5, { width: cols.att });
  hX += cols.att;
  doc.text('Score', hX + 4, curY + 5, { width: cols.score });
  hX += cols.score;
  doc.text('Pct %', hX + 4, curY + 5, { width: cols.pct });
  hX += cols.pct;
  doc.text('Status', hX + 4, curY + 5, { width: cols.status });
  hX += cols.status;
  doc.text('Submitted At', hX + 4, curY + 5, { width: cols.submitted });

  curY += 18;

  if (attempts.length === 0) {
    doc.rect(margin, curY, contentWidth, 24).fill(COLORS.bgLight);
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.textMuted).text(
      'No student attempts recorded for this examination yet.',
      margin + 8,
      curY + 8
    );
  } else {
    for (let i = 0; i < attempts.length; i++) {
      const a = attempts[i];
      const isOdd = i % 2 === 1;

      if (curY > pageHeight - 55) {
        doc.addPage();
        curY = 36;
        // Redraw table header
        doc.rect(margin, curY, contentWidth, 18).fill(COLORS.primary);
        doc.font('Helvetica-Bold').fontSize(7.2).fillColor(COLORS.white);
        let rhX = margin;
        doc.text('S.No', rhX + 4, curY + 5, { width: cols.sno });
        rhX += cols.sno;
        doc.text('Roll No', rhX + 4, curY + 5, { width: cols.roll });
        rhX += cols.roll;
        doc.text('Reg No', rhX + 4, curY + 5, { width: cols.reg });
        rhX += cols.reg;
        doc.text('Student Name', rhX + 4, curY + 5, { width: cols.name });
        rhX += cols.name;
        doc.text('Branch', rhX + 4, curY + 5, { width: cols.branch });
        rhX += cols.branch;
        doc.text('Att#', rhX + 4, curY + 5, { width: cols.att });
        rhX += cols.att;
        doc.text('Score', rhX + 4, curY + 5, { width: cols.score });
        rhX += cols.score;
        doc.text('Pct %', rhX + 4, curY + 5, { width: cols.pct });
        rhX += cols.pct;
        doc.text('Status', rhX + 4, curY + 5, { width: cols.status });
        rhX += cols.status;
        doc.text('Submitted At', rhX + 4, curY + 5, { width: cols.submitted });
        curY += 18;
      }

      const rowH = 18;
      if (isOdd) {
        doc.rect(margin, curY, contentWidth, rowH).fill(COLORS.bgLight);
      }
      doc.rect(margin, curY, contentWidth, rowH).strokeColor(COLORS.border).lineWidth(0.25).stroke();

      let rX = margin;
      doc.font('Helvetica').fontSize(6.8).fillColor(COLORS.textMuted).text(String(i + 1), rX + 4, curY + 5, { width: cols.sno });
      rX += cols.sno;

      doc.font('Helvetica-Bold').fontSize(6.8).fillColor(COLORS.secondary).text(a.roll_number, rX + 4, curY + 5, { width: cols.roll });
      rX += cols.roll;

      doc.font('Helvetica').fontSize(6.8).fillColor(COLORS.secondary).text(a.registration_number, rX + 4, curY + 5, { width: cols.reg });
      rX += cols.reg;

      doc.font('Helvetica-Bold').fontSize(6.8).fillColor(COLORS.primary).text(a.student_name, rX + 4, curY + 5, { width: cols.name - 6 });
      rX += cols.name;

      doc.font('Helvetica').fontSize(6.8).fillColor(COLORS.secondary).text(a.branch?.code || a.branch?.name || 'General', rX + 4, curY + 5, { width: cols.branch });
      rX += cols.branch;

      doc.font('Helvetica').fontSize(6.8).fillColor(COLORS.textMuted).text(`#${a.attempt_number}`, rX + 4, curY + 5, { width: cols.att });
      rX += cols.att;

      doc.font('Helvetica-Bold').fontSize(6.8).fillColor(COLORS.primary).text(`${a.obtained_marks} / ${a.total_marks}`, rX + 4, curY + 5, { width: cols.score });
      rX += cols.score;

      doc.font('Helvetica-Bold').fontSize(6.8).fillColor(COLORS.secondary).text(`${a.percentage}%`, rX + 4, curY + 5, { width: cols.pct });
      rX += cols.pct;

      const stColor = a.is_passed ? COLORS.success : COLORS.danger;
      doc.font('Helvetica-Bold').fontSize(6.8).fillColor(stColor).text(a.is_passed ? 'PASS' : 'FAIL', rX + 4, curY + 5, { width: cols.status });
      rX += cols.status;

      const submittedStr = a.submitted_at ? new Date(a.submitted_at).toLocaleString() : 'In Progress';
      doc.font('Helvetica').fontSize(6.5).fillColor(COLORS.textMuted).text(submittedStr, rX + 4, curY + 5, { width: cols.submitted });

      curY += rowH;
    }
  }

  // Draw footer on all pages
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const footerY = pageHeight - 34;

    doc.strokeColor(COLORS.border).lineWidth(0.5).moveTo(margin, footerY - 5).lineTo(pageWidth - margin, footerY - 5).stroke();

    doc
      .font('Helvetica')
      .fontSize(6.5)
      .fillColor(COLORS.textMuted)
      .text(
        `CampusFlow Exam Security Engine • Institution Master Roster • Page ${i + 1} of ${range.count}`,
        margin,
        footerY,
        { width: contentWidth }
      );

    renderPdfAttributionFooter(doc, footerY + 11, { fontSize: 6.2 });
  }

  doc.end();
  return await streamToBuffer(doc);
}
