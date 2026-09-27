import { GET as getManifest } from '@/app/api/manifest/route';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export const GET = getManifest;
