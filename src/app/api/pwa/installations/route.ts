import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  let body: { collegeId?: unknown; installationId?: unknown; deviceType?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (typeof body.collegeId !== 'string' || !UUID_RE.test(body.collegeId) || typeof body.installationId !== 'string' || !UUID_RE.test(body.installationId)) {
    return NextResponse.json({ error: 'Invalid installation details.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('record_pwa_installation', {
    p_college_id: body.collegeId,
    p_installation_id: body.installationId,
    p_user_agent: request.headers.get('user-agent')?.slice(0, 512) ?? null,
    p_device_type: typeof body.deviceType === 'string' ? body.deviceType.slice(0, 64) : null,
  });
  if (error) {
    console.error('[PWA] Could not record installation:', error.message);
    return NextResponse.json({ error: 'Could not record installation.' }, { status: 400 });
  }

  try {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(`pwa_install_count_${body.collegeId}`);
  } catch {}

  return NextResponse.json({ success: true });
}
