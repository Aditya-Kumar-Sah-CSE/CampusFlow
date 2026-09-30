'use server';

import { registerStudentForEvent } from '@/lib/events/service';
import { resolveTenantOrNotFound } from '@/lib/tenant/resolver';
import { uploadEventAsset } from '@/lib/events/storage';

export async function submitPublicEventRegistrationAction(formData: FormData): Promise<{
  success: boolean;
  error?: string;
  registrationId?: string;
  paymentStatus?: string;
}> {
  try {
    const tenantSlug = formData.get('tenantSlug') as string;
    const eventId = formData.get('eventId') as string;
    const registrationNumber = formData.get('registrationNumber') as string;
    const studentName = formData.get('studentName') as string;
    const email = formData.get('email') as string;
    const mobile = formData.get('mobile') as string;
    const branchId = (formData.get('branchId') as string) || null;
    const semesterId = (formData.get('semesterId') as string) || null;
    const transactionId = (formData.get('transactionId') as string) || null;
    const proofFile = formData.get('paymentProof') as File | null;

    if (!tenantSlug || !eventId || !registrationNumber || !studentName || !email || !mobile) {
      return { success: false, error: 'Please fill in all required registration fields.' };
    }

    // Resolve tenant server-side (Zero trust on client-supplied data)
    const tenant = await resolveTenantOrNotFound(tenantSlug);
    const collegeId = tenant.collegeId;

    let paymentScreenshotUrl: string | null = null;
    if (proofFile && proofFile.size > 0 && proofFile.size <= 5 * 1024 * 1024) {
      const buffer = Buffer.from(await proofFile.arrayBuffer());
      const uploadRes = await uploadEventAsset({
        collegeId,
        eventId,
        fileBuffer: buffer,
        fileName: proofFile.name,
        mimeType: proofFile.type || 'image/jpeg',
        folder: 'proofs',
      });
      if (uploadRes.url) {
        paymentScreenshotUrl = uploadRes.url;
      }
    }

    const result = await registerStudentForEvent({
      college_id: collegeId,
      event_id: eventId,
      registration_number: registrationNumber,
      student_name: studentName,
      email,
      mobile,
      branch_id: branchId && branchId !== '' ? branchId : null,
      semester_id: semesterId && semesterId !== '' ? semesterId : null,
      transaction_id: transactionId,
      payment_screenshot_url: paymentScreenshotUrl,
    });

    if (!result.success) {
      return { success: false, error: result.error || 'Registration failed.' };
    }

    return {
      success: true,
      registrationId: result.registration_id,
      paymentStatus: result.payment_status,
    };
  } catch (err: any) {
    console.error('[SUBMIT_EVENT_REGISTRATION_EXCEPTION]', err);
    return { success: false, error: err.message || 'An unexpected error occurred during registration.' };
  }
}
