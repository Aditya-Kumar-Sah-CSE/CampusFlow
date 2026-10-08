import { GET as getManifest } from '@/app/api/manifest/route';
import type { NextRequest } from 'next/server';

export const revalidate = 3600;

export async function GET(request: NextRequest) {
  return getManifest(request);
}

