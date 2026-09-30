import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { getAdminEventById, getEventRegistrations } from '@/lib/events/service';

export const dynamic = 'force-dynamic';

function escapeCsvField(field: any): string {
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

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const branchId = searchParams.get('branchId') || undefined;
    const semesterId = searchParams.get('semesterId') || undefined;
    const paymentStatus = (searchParams.get('paymentStatus') as any) || 'ALL';
    const registrationStatus = (searchParams.get('registrationStatus') as any) || 'ALL';

    const { registrations } = await getEventRegistrations({
      eventId: event.id,
      collegeId,
      search,
      branchId,
      semesterId,
      paymentStatus,
      registrationStatus,
    });

    const isPaid = event.payment_required;
    const headers = [
      'S.No',
      'Registration Number',
      'Student Name',
      'Email',
      'Mobile',
      'Branch',
      'Semester',
    ];
    if (isPaid) {
      headers.push('Payment Status', 'Transaction ID');
    }
    headers.push('Registration Status', 'Registered At');

    const rows = registrations.map((r, idx) => {
      const row = [
        String(idx + 1),
        escapeCsvField(r.registration_number),
        escapeCsvField(r.student_name),
        escapeCsvField(r.email),
        escapeCsvField(r.mobile),
        escapeCsvField(r.branch?.name || r.branch?.code || ''),
        escapeCsvField(r.semester?.semester_number ? `Sem ${r.semester.semester_number}` : ''),
      ];
      if (isPaid) {
        row.push(escapeCsvField(r.payment_status), escapeCsvField(r.transaction_id || ''));
      }
      row.push(escapeCsvField(r.registration_status), escapeCsvField(new Date(r.registered_at).toLocaleString('en-IN')));
      return row.join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const filename = `${event.slug}-registrations-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('[EVENT_CSV_ROUTE_ERROR]', err);
    return NextResponse.json({ error: err.message || 'Failed to export CSV.' }, { status: 500 });
  }
}
