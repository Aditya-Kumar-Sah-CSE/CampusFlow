import { GET as getManifest } from '@/app/api/manifest/route';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function GET(request: NextRequest) {
  return getManifest(request);
}

