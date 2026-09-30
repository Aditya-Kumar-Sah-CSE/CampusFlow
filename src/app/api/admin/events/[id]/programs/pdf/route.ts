import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { getAdminEventById } from '@/lib/events/service';
import { getAdminEventPrograms, getEventProgramsStats } from '@/lib/events/programs-service';
import { getAdminEventProgramRegistrations } from '@/lib/events/program-registrations-service';
import { getAdminEventCategories } from '@/lib/events/categories-service';
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
  categoryBg: '#F0F9FF',
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session.isAuthenticated || !session.isActive) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { id: eventId } = await params;
    const collegeId = session.activeCollegeId || session.colleges[0]?.collegeId;
    if (!collegeId) {
      return NextResponse.json({ error: 'Active institution context is required.' }, { status: 400 });
    }

    const event = await getAdminEventById(eventId, collegeId);
    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }

    const [categories, programs, stats, registrations] = await Promise.all([
      getAdminEventCategories(event.id, collegeId),
      getAdminEventPrograms(event.id, collegeId),
      getEventProgramsStats(event.id, collegeId),
      getAdminEventProgramRegistrations(event.id, collegeId),
    ]);

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 36,
      info: {
        Title: `${event.title} - Complete Program Report`,
        Author: 'FMS Event Management',
        Subject: 'Event Programs & Registrations Report',
      },
    });

    const bufferPromise = streamToBuffer(doc);
    const pageW = doc.page.width - 72;

    // Title Page Header
    doc.rect(36, 36, pageW, 56).fill(COLORS.primary);
    doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.white).text(event.title.toUpperCase(), 50, 46, { width: pageW - 28 });
    doc.font('Helvetica').fontSize(8).fillColor('#94A3B8').text('Complete Event Programs & Registrations Report', 50, 70, { width: pageW - 28 });

    // Stats summary
    let y = 108;
    const summaryItems = [
      { l: 'Categories', v: stats.totalCategories },
      { l: 'Programs', v: stats.totalPrograms },
      { l: 'Total Registrations', v: stats.totalRegistrations },
      { l: 'Participants', v: stats.totalParticipants },
      { l: 'Teams', v: stats.totalTeams },
      { l: 'Revenue', v: `₹${stats.totalRevenue.toLocaleString('en-IN')}` },
    ];
    const boxW = Math.floor(pageW / summaryItems.length);
    summaryItems.forEach((s, i) => {
      const x = 36 + i * boxW;
      doc.rect(x, y, boxW - 4, 32).fill(COLORS.bgLight).stroke(COLORS.border);
      doc.font('Helvetica').fontSize(6.5).fillColor(COLORS.slateMuted).text(s.l, x + 6, y + 4);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.slateDark).text(String(s.v), x + 6, y + 15);
    });

    y += 48;

    // Per-program sections
    for (const cat of categories) {
      const catPrograms = programs.filter((p) => p.category_id === cat.id);
      if (catPrograms.length === 0) continue;

      // Category header
      if (y > doc.page.height - 80) { doc.addPage(); y = 36; }
      doc.rect(36, y, pageW, 18).fill(COLORS.categoryBg).stroke(COLORS.border);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.secondary).text(`📂 ${cat.name.toUpperCase()}`, 44, y + 4, { width: pageW - 16 });
      y += 24;

      for (const prog of catPrograms) {
        if (y > doc.page.height - 80) { doc.addPage(); y = 36; }

        // Program sub-header
        doc.rect(36, y, pageW, 14).fill(COLORS.secondary);
        doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.white)
          .text(`${prog.name} | ${prog.participation_type} | Fee: ${prog.registration_fee > 0 ? `₹${prog.registration_fee}` : 'Free'} | Regs: ${prog.registrations_count || 0}`, 44, y + 3, { width: pageW - 16 });
        y += 18;

        // Registrations for this program
        const progRegs = registrations.filter((r) => r.program_id === prog.id);
        if (progRegs.length === 0) {
          doc.font('Helvetica').fontSize(7).fillColor(COLORS.slateMuted).text('No registrations.', 44, y + 2);
          y += 16;
          continue;
        }

        // Mini table header
        const miniCols = ['#', 'Reg No.', 'Type', 'Name', 'Student ID', 'Email', 'Status'];
        const miniW = [20, 75, 35, 120, 65, 130, 50];
        const totalMiniW = miniW.reduce((s, w) => s + w, 0);
        const miniScale = pageW / totalMiniW;
        const scaledMiniW = miniW.map((w) => Math.floor(w * miniScale));

        let colX = 36;
        doc.rect(36, y, pageW, 12).fill('#E2E8F0');
        miniCols.forEach((h, ci) => {
          doc.font('Helvetica-Bold').fontSize(5.5).fillColor(COLORS.slateDark).text(h, colX + 2, y + 3, { width: scaledMiniW[ci] - 4, lineBreak: false });
          colX += scaledMiniW[ci];
        });
        y += 12;

        progRegs.forEach((r, idx) => {
          if (y > doc.page.height - 40) { doc.addPage(); y = 36; }

          const bgColor = idx % 2 === 0 ? COLORS.white : COLORS.bgLight;
          doc.rect(36, y, pageW, 10).fill(bgColor);

          const rowData = [
            String(idx + 1),
            r.registration_number,
            r.registration_type,
            r.participant_name + (r.team_name ? ` (${r.team_name})` : ''),
            r.student_id || '',
            r.email,
            r.registration_status,
          ];

          colX = 36;
          rowData.forEach((val, ci) => {
            let tc = COLORS.slateDark;
            if (val === 'REGISTERED') tc = COLORS.success;
            else if (val === 'CANCELLED') tc = COLORS.slateMuted;
            else if (val === 'REJECTED') tc = COLORS.danger;
            doc.font('Helvetica').fontSize(5.5).fillColor(tc).text(val, colX + 2, y + 2, { width: scaledMiniW[ci] - 4, lineBreak: false });
            colX += scaledMiniW[ci];
          });
          y += 10;
        });

        y += 8;
      }
    }

    // Footer
    doc.font('Helvetica').fontSize(6).fillColor(COLORS.slateMuted)
      .text(`Generated: ${new Date().toLocaleString('en-IN')} | ${event.title} - All Programs Report`, 36, doc.page.height - 28);

    doc.end();
    const buffer = await bufferPromise;

    const filename = `${event.slug}-all-programs-report-${new Date().toISOString().slice(0, 10)}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    console.error('[EVENT_PROGRAMS_PDF_ROUTE_ERROR]', err);
    return NextResponse.json({ error: (err as Error).message || 'Failed to generate PDF.' }, { status: 500 });
  }
}
