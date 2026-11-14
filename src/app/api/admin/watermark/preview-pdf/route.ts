import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { getAdminSession } from '@/lib/auth/admin-auth';
import {
  type CollegeWatermarkConfig,
  DEFAULT_WATERMARK_CONFIG,
  renderWatermark,
  getCollegeWatermarkConfig,
} from '@/lib/pdf/watermark';
import { renderPdfAttributionFooter } from '@/lib/utils/pdf-attribution';
import { resolvePdfLogoBuffer } from '@/lib/pdf/pdf-logo';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function streamToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session.isAuthenticated || !session.isPlatformSuperAdmin) {
      return new NextResponse('Unauthorized: Super Admin access required.', { status: 403 });
    }

    const body = await req.json();
    const config: CollegeWatermarkConfig = {
      ...DEFAULT_WATERMARK_CONFIG,
      ...(body.config || {}),
      collegeId: body.collegeId || body.config?.collegeId || 'preview-college',
    };

    const collegeName = body.collegeName || 'Bhagalpur College of Engineering';
    const collegeCode = body.collegeCode || '108';
    const sampleType = body.sampleType || 'report'; // 'report' | 'exam' | 'certificate'

    const pdfBuffer = await generatePreviewPdfBuffer(config, collegeName, collegeCode, sampleType);

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="watermark-preview.pdf"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err: any) {
    console.error('[WATERMARK_PREVIEW_PDF_ERR]', err);
    return new NextResponse('Internal error generating PDF preview: ' + err?.message, {
      status: 500,
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session.isAuthenticated || !session.isPlatformSuperAdmin) {
      return new NextResponse('Unauthorized: Super Admin access required.', { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const collegeId = searchParams.get('collegeId') || '';
    const sampleType = searchParams.get('sampleType') || 'report';

    let collegeName = 'Bhagalpur College of Engineering';
    let collegeCode = '108';
    let config: CollegeWatermarkConfig;

    if (collegeId) {
      const supabase = createAdminClient();
      if (supabase) {
        const { data: college } = await supabase
          .from('colleges')
          .select('name, code')
          .eq('id', collegeId)
          .maybeSingle();

        if (college) {
          collegeName = college.name;
          collegeCode = college.code;
        }
      }
      config = await getCollegeWatermarkConfig(collegeId, collegeName, collegeCode);
    } else {
      config = {
        collegeId: 'preview-college',
        ...DEFAULT_WATERMARK_CONFIG,
      };
    }

    // Optional overrides from query parameters for live sandbox testing
    if (searchParams.has('format')) {
      config.format = searchParams.get('format') as any;
    }
    if (searchParams.has('contentType')) {
      config.contentType = searchParams.get('contentType') as any;
    }
    if (searchParams.has('opacity')) {
      config.opacity = parseFloat(searchParams.get('opacity') || '0.55');
    }
    if (searchParams.has('rotationAngle')) {
      config.rotationAngle = parseInt(searchParams.get('rotationAngle') || '-24', 10);
    }
    if (searchParams.has('text')) {
      config.text = searchParams.get('text') || config.text;
    }
    if (searchParams.has('textColor')) {
      config.textColor = searchParams.get('textColor') || config.textColor;
    }

    const pdfBuffer = await generatePreviewPdfBuffer(config, collegeName, collegeCode, sampleType);

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="watermark-preview.pdf"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err: any) {
    console.error('[WATERMARK_PREVIEW_GET_ERR]', err);
    return new NextResponse('Internal error generating PDF: ' + err?.message, { status: 500 });
  }
}

async function generatePreviewPdfBuffer(
  config: CollegeWatermarkConfig,
  collegeName: string,
  collegeCode: string,
  sampleType: string
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 36,
    bufferPages: true,
    info: {
      Title: `Sample Report - ${collegeName}`,
      Author: 'CampusFlow Academic Engine',
      Subject: 'Official Verification Report Sample',
    },
  });

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  // Resolve Logo if applicable
  let logoBuffer: Buffer | null = null;
  if (config.logoSource === 'college') {
    logoBuffer = await resolvePdfLogoBuffer({ name: collegeName, code: collegeCode });
  } else if (config.logoSource === 'custom' && config.customLogoUrl) {
    logoBuffer = await resolvePdfLogoBuffer({ url: config.customLogoUrl });
  }

  // Draw Sample Document Content
  // 1. Top Decorative Ribbon
  doc
    .rect(margin, 20, contentWidth, 4)
    .fill('#2563EB');

  // 2. Header
  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor('#0F172A')
    .text(collegeName.toUpperCase(), margin, 38, {
      width: contentWidth,
      align: 'center',
    });

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#475569')
    .text(`College Code: ${collegeCode}   \u2022   CampusFlow Academic Enterprise Suite`, margin, 58, {
      width: contentWidth,
      align: 'center',
    });

  // Divider
  doc
    .strokeColor('#E2E8F0')
    .lineWidth(1)
    .moveTo(margin, 76)
    .lineTo(pageWidth - margin, 76)
    .stroke();

  // Document Title Badge
  const badgeTitle =
    sampleType === 'exam'
      ? 'OFFICIAL EXAM VERIFICATION & SCORE ROSTER'
      : sampleType === 'certificate'
      ? 'CERTIFICATE OF MERIT & EVENT REGISTRATION'
      : 'OFFICIAL ACADEMIC EVALUATION & FEEDBACK REPORT';

  doc
    .rect(margin + 60, 88, contentWidth - 120, 24)
    .fill('#F1F5F9');

  doc
    .font('Helvetica-Bold')
    .fontSize(10.5)
    .fillColor('#1E293B')
    .text(badgeTitle, margin + 60, 95, {
      width: contentWidth - 120,
      align: 'center',
    });

  // Metadata Card
  const metaY = 126;
  doc
    .rect(margin, metaY, contentWidth, 74)
    .lineWidth(0.8)
    .strokeColor('#CBD5E1')
    .fillAndStroke('#F8FAFC', '#CBD5E1');

  const col1X = margin + 14;
  const col2X = margin + 260;

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748B').text('CANDIDATE NAME:', col1X, metaY + 12);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0F172A').text('Aditya Kumar Sah', col1X, metaY + 23);

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748B').text('REGISTRATION NUMBER:', col1X, metaY + 42);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0F172A').text('21108107001 (B.Tech CSE)', col1X, metaY + 53);

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748B').text('ACADEMIC TERM:', col2X, metaY + 12);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0F172A').text('Academic Session 2026-27', col2X, metaY + 23);

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748B').text('DOCUMENT SECURITY HASH:', col2X, metaY + 42);
  doc.font('Helvetica').fontSize(8).fillColor('#2563EB').text('SHA256: 7f8a9e01...c4b2 (VERIFIED)', col2X, metaY + 53);

  // Sample Table
  const tableY = 216;
  doc.rect(margin, tableY, contentWidth, 22).fill('#1E293B');

  const headers = ['#', 'Subject / Category', 'Score / Credits', 'Evaluation', 'Status'];
  const colWidths = [30, 240, 90, 90, 73];

  let curX = margin;
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#FFFFFF');
  headers.forEach((h, idx) => {
    doc.text(h, curX + 6, tableY + 6, { width: colWidths[idx] - 12, align: idx === 0 ? 'center' : 'left' });
    curX += colWidths[idx];
  });

  const sampleRows = [
    ['1', 'CS801: Distributed Systems & Cloud Infrastructure', '94 / 100 (4.0)', 'Grade A+ (Outstanding)', 'VERIFIED'],
    ['2', 'CS802: Advanced Machine Learning & Neural Networks', '91 / 100 (4.0)', 'Grade A+ (Outstanding)', 'VERIFIED'],
    ['3', 'CS803: Secure Software Architecture & Cryptography', '88 / 100 (3.5)', 'Grade A (Excellent)', 'VERIFIED'],
    ['4', 'CS804: Engineering Leadership & Technical Ethics', '95 / 100 (3.0)', 'Grade O (Distinction)', 'VERIFIED'],
    ['5', 'CS805: Capstone System Implementation & Deployment', '98 / 100 (6.0)', 'Grade O (Distinction)', 'VERIFIED'],
    ['6', 'AC806: Institutional Feedback & Faculty Assessment', '4.92 / 5.00', 'Top 1% Percentile', 'VERIFIED'],
  ];

  let rowY = tableY + 22;
  sampleRows.forEach((row, rowIdx) => {
    const isEven = rowIdx % 2 === 0;
    doc
      .rect(margin, rowY, contentWidth, 24)
      .fillAndStroke(isEven ? '#FFFFFF' : '#F8FAFC', '#E2E8F0');

    let x = margin;
    row.forEach((cell, cellIdx) => {
      doc
        .font(cellIdx === 0 || cellIdx === 4 ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(8)
        .fillColor(cellIdx === 4 ? '#16A34A' : '#1E293B');

      doc.text(cell, x + 6, rowY + 7, {
        width: colWidths[cellIdx] - 12,
        align: cellIdx === 0 ? 'center' : 'left',
      });
      x += colWidths[cellIdx];
    });

    rowY += 24;
  });

  // Summary box
  doc
    .rect(margin, rowY + 14, contentWidth, 54)
    .strokeColor('#CBD5E1')
    .lineWidth(0.8)
    .fillAndStroke('#F1F5F9', '#CBD5E1');

  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor('#0F172A')
    .text('CUMULATIVE PERFORMANCE SUMMARY:', margin + 14, rowY + 24);

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#475569')
    .text(
      'CGPA: 9.68 / 10.00   \u2022   Total Credits Earned: 24.5   \u2022   Result Classification: First Class with Distinction   \u2022   Integrity Status: Authenticated by CampusFlow Autonomous Verification Engine.',
      margin + 14,
      rowY + 38,
      { width: contentWidth - 28 }
    );

  // Authority Signature Block
  const sigY = 560;
  doc
    .strokeColor('#94A3B8')
    .lineWidth(0.8)
    .moveTo(margin + 30, sigY + 40)
    .lineTo(margin + 200, sigY + 40)
    .stroke();

  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor('#334155')
    .text('Controller of Examinations / Dean', margin + 30, sigY + 45);

  doc
    .strokeColor('#94A3B8')
    .lineWidth(0.8)
    .moveTo(pageWidth - margin - 200, sigY + 40)
    .lineTo(pageWidth - margin - 30, sigY + 40)
    .stroke();

  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor('#334155')
    .text('Institutional Authority Verification Seal', pageWidth - margin - 200, sigY + 45, {
      align: 'right',
      width: 170,
    });

  // Footer Attribution Line (The exact new attribution line with clickable links and no raw URL!)
  const footerY = pageHeight - 26;
  doc
    .strokeColor('#CBD5E1')
    .lineWidth(0.5)
    .moveTo(margin, footerY - 7)
    .lineTo(pageWidth - margin, footerY - 7)
    .stroke();

  renderPdfAttributionFooter(doc, footerY, {
    fontSize: 5.8,
    textColor: '#64748B',
    linkColor: '#2563EB',
  });

  // Apply Watermark according to settings
  if (config.enabled || config.paymentPolicy === 'always_show') {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      renderWatermark(doc, config, collegeName, logoBuffer);
    }
  }

  doc.end();
  return await streamToBuffer(doc);
}

