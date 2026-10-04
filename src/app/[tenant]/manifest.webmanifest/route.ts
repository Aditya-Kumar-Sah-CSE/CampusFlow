import { GET as getTenantManifest } from '@/app/api/manifest/[slug]/route';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant } = await params;
  return getTenantManifest(request, { params: Promise.resolve({ slug: tenant }) });
}
