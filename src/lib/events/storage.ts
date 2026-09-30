import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * Uploads an event payment QR code or asset securely.
 * Stored in bucket: event-assets
 * Path format: events/{college_id}/{event_id}/payment-qr/{filename}
 */
export async function uploadEventAsset(params: {
  collegeId: string;
  eventId: string;
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  folder?: 'payment-qr' | 'proofs';
}): Promise<{ url: string | null; error: string | null }> {
  try {
    const adminDb = createAdminClient() || await createClient();
    const folder = params.folder || 'payment-qr';
    const cleanFileName = `${Date.now()}-${params.fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const storagePath = `events/${params.collegeId}/${params.eventId}/${folder}/${cleanFileName}`;

    const { error: uploadError } = await adminDb.storage
      .from('event-assets')
      .upload(storagePath, params.fileBuffer, {
        contentType: params.mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error('[EVENT_ASSET_UPLOAD_ERROR]', uploadError);
      return { url: null, error: uploadError.message };
    }

    const { data: publicUrlData } = adminDb.storage
      .from('event-assets')
      .getPublicUrl(storagePath);

    return { url: publicUrlData.publicUrl, error: null };
  } catch (err: any) {
    console.error('[EVENT_ASSET_UPLOAD_EXCEPTION]', err);
    return { url: null, error: err.message || 'Failed to upload event asset' };
  }
}
