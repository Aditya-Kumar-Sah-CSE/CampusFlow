import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { getAdminEventById } from '@/lib/events/service';
import { getAdminEventProgramRegistrations } from '@/lib/events/program-registrations-service';

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

    const registrations = await getAdminEventProgramRegistrations(event.id, collegeId);

    const headers = [
      'S.No',
      'Registration Number',
      'Program',
      'Category',
      'Type',
      'Participant Name',
      'Student ID',
      'Email',
      'Mobile',
      'Branch',
      'Semester',
      'Team Name',
      'Team Members',
      'Payment Status',
      'Payment Ref',
      'Amount',
      'Registration Status',
      'Registered At',
    ];

    const rows = registrations.map((r, idx) => {
      const programName = (r.program as unknown as { name: string } | null)?.name || '';
      const categoryName = (r.category as unknown as { name: string } | null)?.name || '';
      const memberNames = (r.members || []).map((m) => m.member_name).join('; ');

      return [
        String(idx + 1),
        escapeCsvField(r.registration_number),
        escapeCsvField(programName),
        escapeCsvField(categoryName),
        escapeCsvField(r.registration_type),
        escapeCsvField(r.participant_name),
        escapeCsvField(r.student_id),
        escapeCsvField(r.email),
        escapeCsvField(r.mobile),
        escapeCsvField(r.branch),
        escapeCsvField(r.semester),
        escapeCsvField(r.team_name),
        escapeCsvField(memberNames),
        escapeCsvField(r.payment_status),
        escapeCsvField(r.payment_reference),
        escapeCsvField(r.payment_amount),
        escapeCsvField(r.registration_status),
        escapeCsvField(new Date(r.registered_at).toLocaleString('en-IN')),
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const filename = `${event.slug}-all-programs-registrations-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    console.error('[EVENT_PROGRAMS_CSV_ROUTE_ERROR]', err);
    return NextResponse.json({ error: (err as Error).message || 'Failed to export CSV.' }, { status: 500 });
  }
}
