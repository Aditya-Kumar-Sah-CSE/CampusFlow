import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { uploadEventAsset } from '@/lib/events/storage';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session.isAuthenticated || !session.isActive) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as any) || 'payment-qr';
    const collegeId = (formData.get('collegeId') as string) || session.activeCollegeId;
    const eventId = (formData.get('eventId') as string) || 'temp';

    if (!file || !collegeId) {
      return NextResponse.json({ error: 'File and institution required.' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must not exceed 5MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const res = await uploadEventAsset({
      collegeId,
      eventId,
      fileBuffer: buffer,
      fileName: file.name,
      mimeType: file.type || 'image/png',
      folder,
    });

    if (res.error || !res.url) {
      return NextResponse.json({ error: res.error || 'Upload failed.' }, { status: 500 });
    }

    return NextResponse.json({ url: res.url });
  } catch (err: any) {
    console.error('[EVENT_UPLOAD_ROUTE_ERROR]', err);
    return NextResponse.json({ error: err.message || 'Upload error.' }, { status: 500 });
  }
}
