import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { getAdminEventById } from '@/lib/events/service';
import { getAdminProgramById } from '@/lib/events/programs-service';
import { getAdminProgramRegistrations } from '@/lib/events/program-registrations-service';

export const dynamic = 'force-dynamic';

function escapeCsvField(field: unknown): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
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

    const registrations = await getAdminProgramRegistrations({
      programId: program.id,
      collegeId,
    });

    const isPaid = event.payment_required && program.registration_fee > 0;
    const isTeamProgram = program.participation_type === 'TEAM' || program.participation_type === 'BOTH';

    const headers = [
      'S.No',
      'Registration Number',
      'Type',
      'Participant Name',
      'Student ID',
      'Email',
      'Mobile',
      'Branch',
      'Semester',
    ];
    if (isTeamProgram) headers.push('Team Name', 'Team Members');
    if (isPaid) headers.push('Payment Status', 'Payment Ref', 'Amount');
    headers.push('Registration Status', 'Registered At');

    const rows = registrations.map((r, idx) => {
      const row = [
        String(idx + 1),
        escapeCsvField(r.registration_number),
        escapeCsvField(r.registration_type),
        escapeCsvField(r.participant_name),
        escapeCsvField(r.student_id),
        escapeCsvField(r.email),
        escapeCsvField(r.mobile),
        escapeCsvField(r.branch),
        escapeCsvField(r.semester),
      ];
      if (isTeamProgram) {
        row.push(escapeCsvField(r.team_name));
        const memberNames = (r.members || []).map((m) => m.member_name).join('; ');
        row.push(escapeCsvField(memberNames));
      }
      if (isPaid) {
        row.push(
          escapeCsvField(r.payment_status),
          escapeCsvField(r.payment_reference),
          escapeCsvField(r.payment_amount)
        );
      }
      row.push(
        escapeCsvField(r.registration_status),
        escapeCsvField(new Date(r.registered_at).toLocaleString('en-IN'))
      );
      return row.join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const filename = `${event.slug}-${program.slug}-registrations-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    console.error('[PROGRAM_CSV_ROUTE_ERROR]', err);
    return NextResponse.json({ error: (err as Error).message || 'Failed to export CSV.' }, { status: 500 });
  }
}
