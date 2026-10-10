'use server';

import { getAdminSession } from '@/lib/auth/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  isGoogleFormEditorApproved,
  grantGoogleDriveEditorAccess,
} from '@/lib/google/editor-permissions';
import { revalidatePath } from 'next/cache';
import type { GoogleFormEditorRequest, CollegeGoogleFormEditor } from '@/types/database';

export interface EditorStatusResult {
  success: boolean;
  hasAccess: boolean;
  isOwner: boolean;
  isSuperAdmin: boolean;
  requestStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt?: string;
  connectedAccountEmail?: string;
  error?: string;
}

/**
 * Checks whether the currently logged-in admin has Google Drive editor access
 * for feedback forms in the specified college.
 */
export async function checkGoogleFormEditorStatusAction(
  collegeId: string
): Promise<EditorStatusResult> {
  try {
    const session = await getAdminSession();
    if (!session.isAuthenticated) {
      return {
        success: false,
        hasAccess: false,
        isOwner: false,
        isSuperAdmin: false,
        requestStatus: 'NONE',
        error: 'Unauthorized',
      };
    }

    const currentEmail = (session.admin?.email || session.user?.email || '').trim().toLowerCase();
    const isSuper = !!session.isSuperAdmin || !!session.isPlatformSuperAdmin;

    const db = createAdminClient();
    if (!db) {
      return {
        success: false,
        hasAccess: isSuper,
        isOwner: false,
        isSuperAdmin: isSuper,
        requestStatus: 'NONE',
        error: 'Database unavailable',
      };
    }

    // 1. Get connected Google account
    const { data: conn } = await db
      .from('college_google_connections')
      .select('account_email')
      .eq('college_id', collegeId)
      .maybeSingle();

    const connectedEmail = conn?.account_email || undefined;
    const isOwner = !!(connectedEmail && connectedEmail.toLowerCase() === currentEmail);

    // 2. Check approved editors table
    const { approved } = await isGoogleFormEditorApproved(collegeId, currentEmail);

    if (isOwner || approved) {
      return {
        success: true,
        hasAccess: true,
        isOwner,
        isSuperAdmin: isSuper,
        requestStatus: 'APPROVED',
        connectedAccountEmail: connectedEmail,
      };
    }

    // 3. Check pending request status
    let requestStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' = 'NONE';
    let requestedAt: string | undefined;

    try {
      const { data: req } = await db
        .from('google_form_editor_requests')
        .select('status, requested_at')
        .eq('college_id', collegeId)
        .ilike('admin_email', currentEmail)
        .maybeSingle();

      if (req) {
        requestStatus = req.status as any;
        requestedAt = req.requested_at;
      }
    } catch {
      // Ignore if table doesn't exist yet
    }

    return {
      success: true,
      hasAccess: false,
      isOwner: false,
      isSuperAdmin: isSuper,
      requestStatus,
      requestedAt,
      connectedAccountEmail: connectedEmail,
    };
  } catch (err: any) {
    return {
      success: false,
      hasAccess: false,
      isOwner: false,
      isSuperAdmin: false,
      requestStatus: 'NONE',
      error: err?.message || 'Failed to check editor status',
    };
  }
}

/**
 * Triggers a permission request to Super Admin for Google Form editor access.
 * If the current caller is already a Super Admin, grants access immediately with zero waiting.
 */
export async function requestGoogleFormEditorAccessAction(
  collegeId: string
): Promise<{
  success: boolean;
  grantedImmediately?: boolean;
  message: string;
  error?: string;
}> {
  try {
    const session = await getAdminSession();
    if (!session.isAuthenticated) {
      return { success: false, message: 'Authentication required.' };
    }

    const currentEmail = (session.admin?.email || session.user?.email || '').trim().toLowerCase();
    const currentName = session.name || session.user?.user_metadata?.name || currentEmail.split('@')[0];
    const isSuper = !!session.isSuperAdmin || !!session.isPlatformSuperAdmin;

    const db = createAdminClient();
    if (!db) {
      return { success: false, message: 'Database unavailable.' };
    }

    // If caller is Super Admin: grant immediately on Google Drive!
    if (isSuper) {
      const driveRes = await grantGoogleDriveEditorAccess({
        collegeId,
        adminEmail: currentEmail,
      });

      if (!driveRes.success) {
        return { success: false, message: driveRes.message || 'Drive permission grant failed.' };
      }

      // Record in approved editors table
      await db.from('college_google_form_editors').upsert(
        {
          college_id: collegeId,
          admin_id: session.admin?.id || session.user?.id || null,
          admin_email: currentEmail,
          admin_name: currentName,
          granted_by: session.admin?.id || session.user?.id || null,
          granted_by_email: currentEmail,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'college_id,admin_email' }
      );

      revalidatePath(`/admin/dashboard/forms`);
      return {
        success: true,
        grantedImmediately: true,
        message: 'Super Admin access verified! Google Drive editor permission granted for all forms.',
      };
    }

    // Normal Admin: create or update PENDING request in database
    const { error: upsertErr } = await db.from('google_form_editor_requests').upsert(
      {
        college_id: collegeId,
        admin_id: session.admin?.id || session.user?.id || null,
        admin_email: currentEmail,
        admin_name: currentName,
        status: 'PENDING',
        requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'college_id,admin_email' }
    );

    if (upsertErr) {
      console.error('[requestGoogleFormEditorAccess] Upsert error:', upsertErr);
      return { success: false, message: `Failed to register request: ${upsertErr.message}` };
    }

    revalidatePath(`/admin/dashboard/forms`);
    return {
      success: true,
      grantedImmediately: false,
      message: 'Permission request successfully sent to Super Admin. You will receive lifetime edit access upon approval.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to submit request.',
    };
  }
}

/**
 * Super Admin approval action: grants Google Drive editor access to the requested admin
 * across the institutional Feedback Forms folder and all existing forms.
 */
export async function approveGoogleFormEditorRequestAction(
  requestId: string
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const session = await getAdminSession();
    if (!session.isAuthenticated || (!session.isSuperAdmin && !session.isPlatformSuperAdmin)) {
      return { success: false, message: 'Super Admin privileges required to approve requests.' };
    }

    const db = createAdminClient();
    if (!db) {
      return { success: false, message: 'Database unavailable.' };
    }

    // Fetch the request
    const { data: req, error: reqErr } = await db
      .from('google_form_editor_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();

    if (reqErr || !req) {
      return { success: false, message: 'Request not found.' };
    }

    const targetEmail = req.admin_email.trim().toLowerCase();
    const collegeId = req.college_id;

    // 1. Grant Google Drive writer permission across the folder tree and forms
    const driveRes = await grantGoogleDriveEditorAccess({
      collegeId,
      adminEmail: targetEmail,
    });

    if (!driveRes.success) {
      return {
        success: false,
        message: `Google Drive grant failed: ${driveRes.message}`,
      };
    }

    // 2. Mark request as APPROVED
    await db
      .from('google_form_editor_requests')
      .update({
        status: 'APPROVED',
        reviewed_by: session.admin?.id || session.user?.id || null,
        reviewed_by_email: session.admin?.email || session.user?.email || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    // 3. Upsert into approved editors list
    await db.from('college_google_form_editors').upsert(
      {
        college_id: collegeId,
        admin_id: req.admin_id || null,
        admin_email: targetEmail,
        admin_name: req.admin_name || null,
        granted_by: session.admin?.id || session.user?.id || null,
        granted_by_email: session.admin?.email || session.user?.email || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'college_id,admin_email' }
    );

    revalidatePath(`/admin/dashboard`);
    revalidatePath(`/admin/dashboard/forms`);

    return {
      success: true,
      message: `Approved! ${targetEmail} can now edit all existing and future forms directly in Google Forms.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Approval failed.',
    };
  }
}

/**
 * Super Admin rejection action
 */
export async function rejectGoogleFormEditorRequestAction(
  requestId: string,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getAdminSession();
    if (!session.isAuthenticated || (!session.isSuperAdmin && !session.isPlatformSuperAdmin)) {
      return { success: false, message: 'Super Admin privileges required.' };
    }

    const db = createAdminClient();
    if (!db) {
      return { success: false, message: 'Database unavailable.' };
    }

    await db
      .from('google_form_editor_requests')
      .update({
        status: 'REJECTED',
        reviewed_by: session.admin?.id || session.user?.id || null,
        reviewed_by_email: session.admin?.email || session.user?.email || null,
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason || 'Access request declined by Super Admin',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    revalidatePath(`/admin/dashboard`);
    return { success: true, message: 'Request rejected.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Action failed.' };
  }
}

/**
 * Super Admin direct grant: allows Super Admin to directly add any admin email as an approved Google Form editor.
 */
export async function directGrantGoogleFormEditorAction(
  collegeId: string,
  email: string,
  name?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getAdminSession();
    if (!session.isAuthenticated || (!session.isSuperAdmin && !session.isPlatformSuperAdmin)) {
      return { success: false, message: 'Super Admin privileges required.' };
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return { success: false, message: 'Valid email required.' };
    }

    const db = createAdminClient();
    if (!db) {
      return { success: false, message: 'Database unavailable.' };
    }

    // 1. Grant Drive permission
    const driveRes = await grantGoogleDriveEditorAccess({
      collegeId,
      adminEmail: normalizedEmail,
    });

    if (!driveRes.success) {
      return { success: false, message: driveRes.message };
    }

    // 2. Upsert into approved editors
    await db.from('college_google_form_editors').upsert(
      {
        college_id: collegeId,
        admin_email: normalizedEmail,
        admin_name: name || normalizedEmail.split('@')[0],
        granted_by: session.admin?.id || session.user?.id || null,
        granted_by_email: session.admin?.email || session.user?.email || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'college_id,admin_email' }
    );

    // 3. If there was a pending request, mark it approved
    await db
      .from('google_form_editor_requests')
      .update({
        status: 'APPROVED',
        reviewed_by: session.admin?.id || session.user?.id || null,
        reviewed_by_email: session.admin?.email || session.user?.email || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('college_id', collegeId)
      .ilike('admin_email', normalizedEmail);

    revalidatePath(`/admin/dashboard`);
    revalidatePath(`/admin/dashboard/forms`);

    return {
      success: true,
      message: `Successfully granted Google Drive editor access to ${normalizedEmail} for all forms!`,
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Direct grant failed.' };
  }
}

/**
 * Super Admin revoke: removes active editor status in CampusFlow database.
 */
export async function revokeGoogleFormEditorAction(
  editorId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getAdminSession();
    if (!session.isAuthenticated || (!session.isSuperAdmin && !session.isPlatformSuperAdmin)) {
      return { success: false, message: 'Super Admin privileges required.' };
    }

    const db = createAdminClient();
    if (!db) {
      return { success: false, message: 'Database unavailable.' };
    }

    await db
      .from('college_google_form_editors')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', editorId);

    revalidatePath(`/admin/dashboard`);
    return { success: true, message: 'Google Form editor access revoked.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Revocation failed.' };
  }
}

/**
 * Fetches approved editors and pending requests for Super Admin review.
 */
export async function getGoogleFormEditorsOverviewAction(collegeId: string): Promise<{
  success: boolean;
  approvedEditors: CollegeGoogleFormEditor[];
  pendingRequests: GoogleFormEditorRequest[];
  connectedAccountEmail?: string;
  error?: string;
}> {
  try {
    const session = await getAdminSession();
    if (!session.isAuthenticated) {
      return { success: false, approvedEditors: [], pendingRequests: [], error: 'Unauthorized' };
    }

    const db = createAdminClient();
    if (!db) {
      return { success: false, approvedEditors: [], pendingRequests: [], error: 'Database unavailable' };
    }

    const [connRes, editorsRes, requestsRes] = await Promise.all([
      db.from('college_google_connections').select('account_email').eq('college_id', collegeId).maybeSingle(),
      db.from('college_google_form_editors').select('*').eq('college_id', collegeId).eq('is_active', true).order('granted_at', { ascending: false }),
      db.from('google_form_editor_requests').select('*').eq('college_id', collegeId).eq('status', 'PENDING').order('requested_at', { ascending: false }),
    ]);

    return {
      success: true,
      connectedAccountEmail: connRes.data?.account_email || undefined,
      approvedEditors: (editorsRes.data || []) as CollegeGoogleFormEditor[],
      pendingRequests: (requestsRes.data || []) as GoogleFormEditorRequest[],
    };
  } catch (err: any) {
    return {
      success: false,
      approvedEditors: [],
      pendingRequests: [],
      error: err?.message || 'Failed to fetch editors overview',
    };
  }
}
