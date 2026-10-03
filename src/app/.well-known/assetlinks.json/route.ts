import { NextResponse } from 'next/server';

export const dynamic = 'force-static';
export const revalidate = 86400; // 24 hours

export async function GET() {
  // Canonical Android TWA Digital Asset Links configuration for CampusFlow
  // Package ID: com.campusflow.app
  const defaultFingerprints = [
    '14:6D:E9:7F:0F:52:EA:CB:5B:EA:99:9A:00:4E:9E:09:E6:1F:11:F9:DC:27:0B:53:C4:2C:BE:BB:44:8D:88:FB',
    '08:33:F7:00:9D:29:27:1F:E8:31:4F:77:07:DE:DB:90:17:A4:6F:C5:BD:0B:E6:A9:F0:03:4D:95:85:EF:51:83',
  ];
  const envFingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS || process.env.ANDROID_SHA256_FINGERPRINT || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const fingerprints = Array.from(new Set([...defaultFingerprints, ...envFingerprints]));

  const assetLinks = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.campusflow.app',
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];

  return new NextResponse(JSON.stringify(assetLinks, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}
