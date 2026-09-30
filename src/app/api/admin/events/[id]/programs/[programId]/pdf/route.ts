import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { getAdminEventById } from '@/lib/events/service';
import { getAdminProgramById, getProgramStats } from '@/lib/events/programs-service';
import { getAdminProgramRegistrations } from '@/lib/events/program-registrations-service';
import PDFDocument from 'pdfkit';

export const dynamic = 'force-dynamic';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; programId: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session.isAuthenticated || !session.isActive) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { id: eventId, programId } = await params;
    const collegeId = session.activeCollegeId || session.colleges[0]?.collegeId;
    if (!collegeId) {
      return NextResponse.json({ error: 'Active institution context is required.' }, { status: 400 });
    }

    const event = await getAdminEventById(eventId, collegeId);
    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }

    const program = await getAdminProgramById(programId, collegeId);
    if (!program) {
      return NextResponse.json({ error: 'Program not found.' }, { status: 404 });
    }

    const [registrations, stats] = await Promise.all([
      getAdminProgramRegistrations({ programId: program.id, collegeId }),
      getProgramStats(program.id, collegeId),
    ]);

    const isPaid = event.payment_required && program.registration_fee > 0;

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 36,
      info: {
        Title: `${program.name} - Registration Roster`,
        Author: `${event.title} Event Management`,
        Subject: 'Program Registration Report',
      },
    });

    const bufferPromise = streamToBuffer(doc);
    const pageW = doc.page.width - 72;

    // Header
    doc
      .rect(36, 36, pageW, 50)
      .fill(COLORS.primary);

    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor(COLORS.white)
      .text(program.name.toUpperCase(), 50, 50, { width: pageW - 28 });

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#94A3B8')
      .text(`Event: ${event.title}  |  Type: ${program.participation_type}  |  Fee: ${isPaid ? `₹${program.registration_fee}` : 'Free'}`, 50, 68, { width: pageW - 28 });

    // Stats row
    const statsY = 100;
    const statsData = [
      { label: 'Registrations', val: stats.totalRegistrations },
      { label: 'Participants', val: stats.totalParticipants },
      { label: 'Teams', val: stats.totalTeams },
      { label: 'Individual', val: stats.totalIndividual },
    ];
    if (isPaid) {
      statsData.push(
        { label: 'Verified', val: stats.paymentVerified },
        { label: 'Pending', val: stats.paymentPending },
        { label: 'Revenue', val: stats.totalRevenue },
      );
    }

    const statBoxW = Math.floor(pageW / statsData.length);
    statsData.forEach((s, i) => {
      const x = 36 + i * statBoxW;
      doc.rect(x, statsY, statBoxW - 4, 32).fill(COLORS.bgLight).stroke(COLORS.border);
      doc.font('Helvetica').fontSize(7).fillColor(COLORS.slateMuted).text(s.label, x + 6, statsY + 4);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.slateDark).text(String(s.val), x + 6, statsY + 14);
    });

    // Table
    let tableY = statsY + 48;

    const cols = [
      { label: '#', w: 25 },
      { label: 'Reg No.', w: 80 },
      { label: 'Type', w: 42 },
      { label: 'Name', w: 100 },
      { label: 'Student ID', w: 70 },
      { label: 'Email', w: 110 },
      { label: 'Mobile', w: 65 },
      { label: 'Branch', w: 50 },
    ];

    if (isPaid) {
      cols.push({ label: 'Payment', w: 50 });
      cols.push({ label: 'Ref', w: 60 });
    }
    cols.push({ label: 'Status', w: 50 });

    // Scale columns to fit
    const totalColW = cols.reduce((s, c) => s + c.w, 0);
    const scale = pageW / totalColW;
    cols.forEach((c) => { c.w = Math.floor(c.w * scale); });

    // Header row
    let colX = 36;
    doc.rect(36, tableY, pageW, 16).fill(COLORS.secondary);
    cols.forEach((c) => {
      doc.font('Helvetica-Bold').fontSize(6.5).fillColor(COLORS.white).text(c.label, colX + 3, tableY + 4, { width: c.w - 6 });
      colX += c.w;
    });
    tableY += 16;

    // Data rows
    registrations.forEach((r, idx) => {
      if (tableY > doc.page.height - 60) {
        doc.addPage();
        tableY = 36;
      }

      const bgColor = idx % 2 === 0 ? COLORS.white : COLORS.bgLight;
      doc.rect(36, tableY, pageW, 14).fill(bgColor);

      colX = 36;
      const rowData = [
        String(idx + 1),
        r.registration_number,
        r.registration_type,
        r.participant_name + (r.team_name ? ` (${r.team_name})` : ''),
        r.student_id || '',
        r.email,
        r.mobile || '',
        r.branch || '',
      ];

      if (isPaid) {
        rowData.push(r.payment_status);
        rowData.push(r.payment_reference || '');
      }
      rowData.push(r.registration_status);

      rowData.forEach((val, ci) => {
        let textColor = COLORS.slateDark;
        if (val === 'VERIFIED') textColor = COLORS.success;
        else if (val === 'PENDING' || val === 'SUBMITTED') textColor = COLORS.warning;
        else if (val === 'REJECTED') textColor = COLORS.danger;

        doc.font('Helvetica').fontSize(6).fillColor(textColor).text(val, colX + 3, tableY + 3, { width: cols[ci].w - 6, lineBreak: false });
        colX += cols[ci].w;
      });

      tableY += 14;
    });

    // Footer
    doc
      .font('Helvetica')
      .fontSize(6)
      .fillColor(COLORS.slateMuted)
      .text(`Generated: ${new Date().toLocaleString('en-IN')} | Total: ${registrations.length} registrations`, 36, doc.page.height - 30);

    doc.end();
    const buffer = await bufferPromise;

    const filename = `${event.slug}-${program.slug}-registrations-${new Date().toISOString().slice(0, 10)}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    console.error('[PROGRAM_PDF_ROUTE_ERROR]', err);
    return NextResponse.json({ error: (err as Error).message || 'Failed to generate PDF.' }, { status: 500 });
  }
}
