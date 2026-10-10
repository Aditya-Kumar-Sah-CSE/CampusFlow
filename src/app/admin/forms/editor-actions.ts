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

function isTableMissingError(err: any): boolean {
  if (!err) return false;
  return (
    err.code === 'PGRST205' ||
    err.code === '42P01' ||
    (typeof err.message === 'string' &&
      (err.message.includes('schema cache') ||
        err.message.includes('does not exist') ||
        err.message.includes('Could not find the table')))
  );
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

    // 2. Check approved editors table & audit_logs fallback
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

    // 3. Check pending request status (from dedicated table or audit_logs fallback)
    let requestStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' = 'NONE';
    let requestedAt: string | undefined;

    try {
      const { data: req, error: reqErr } = await db
        .from('google_form_editor_requests')
        .select('status, requested_at')
        .eq('college_id', collegeId)
        .ilike('admin_email', currentEmail)
        .maybeSingle();

      if (!reqErr && req) {
        requestStatus = req.status as any;
        requestedAt = req.requested_at;
      } else if (isTableMissingError(reqErr) || !req) {
        // Fallback: check audit_logs
        const { data: auditRows } = await db
          .from('audit_logs')
          .select('*')
          .eq('college_id', collegeId)
          .eq('entity_type', 'GOOGLE_FORM_EDITOR_REQUEST')
          .ilike('entity_id', currentEmail)
          .order('created_at', { ascending: false })
          .limit(1);

        if (auditRows && auditRows.length > 0) {
          const row = auditRows[0];
          requestStatus = (row.action as any) || row.metadata?.status || 'PENDING';
          requestedAt = (row.metadata as any)?.requested_at || row.created_at;
        }
      }
    } catch {
      // Ignore
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

      // Try record in approved editors table
      try {
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
      } catch {}

      // Always record active editor in audit_logs as well (guaranteed persistence)
      await db.from('audit_logs').insert({
        college_id: collegeId,
        actor_user_id: session.admin?.id || session.user?.id || null,
        actor_email: currentEmail,
        action: 'ACTIVE',
        entity_type: 'GOOGLE_FORM_EDITOR_ACTIVE',
        entity_id: currentEmail,
        details: `Direct self-granted Google Form Editor access for Super Admin ${currentName} (${currentEmail})`,
        metadata: {
          admin_name: currentName,
          admin_email: currentEmail,
          granted_by_email: currentEmail,
          is_active: true,
          granted_at: new Date().toISOString(),
        },
      });

      revalidatePath(`/admin/dashboard/forms`);
      return {
        success: true,
        grantedImmediately: true,
        message: 'Super Admin access verified! Google Drive editor permission granted for all forms.',
      };
    }

    // Normal Admin: create or update PENDING request
    // 1. Try dedicated table first
    try {
      await db.from('google_form_editor_requests').upsert(
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
    } catch {}

    // 2. Always record in audit_logs so requests NEVER get lost even if migration wasn't run!
    const { error: auditErr } = await db.from('audit_logs').insert({
      college_id: collegeId,
      actor_user_id: session.admin?.id || session.user?.id || null,
      actor_email: currentEmail,
      action: 'PENDING',
      entity_type: 'GOOGLE_FORM_EDITOR_REQUEST',
      entity_id: currentEmail,
      details: `Google Form edit access requested by ${currentName} (${currentEmail})`,
      metadata: {
        admin_name: currentName,
        admin_email: currentEmail,
        admin_id: session.admin?.id || session.user?.id || null,
        status: 'PENDING',
        requested_at: new Date().toISOString(),
      },
    });

    if (auditErr) {
      console.error('[requestGoogleFormEditorAccess] audit_logs insert warning:', auditErr);
    }

    revalidatePath(`/admin/dashboard`);
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

    // 1. Fetch the request (check dedicated table first, then audit_logs)
    let targetEmail = '';
    let collegeId = '';
    let adminName = '';
    let adminId: string | null = null;

    try {
      const { data: req } = await db
        .from('google_form_editor_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();

      if (req) {
        targetEmail = req.admin_email.trim().toLowerCase();
        collegeId = req.college_id;
        adminName = req.admin_name || '';
        adminId = req.admin_id || null;
      }
    } catch {}

    if (!targetEmail) {
      // Check audit_logs
      const { data: auditLog } = await db
        .from('audit_logs')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();

      if (auditLog) {
        targetEmail = (auditLog.entity_id || auditLog.actor_email || '').trim().toLowerCase();
        collegeId = auditLog.college_id;
        adminName = (auditLog.metadata as any)?.admin_name || targetEmail.split('@')[0];
        adminId = auditLog.actor_user_id || null;
      }
    }

    if (!targetEmail || !collegeId) {
      return { success: false, message: 'Request not found.' };
    }

    // 2. Grant Google Drive writer permission across the folder tree and forms
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

    // 3. Mark request as APPROVED in dedicated table if available
    try {
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

      await db.from('college_google_form_editors').upsert(
        {
          college_id: collegeId,
          admin_id: adminId,
          admin_email: targetEmail,
          admin_name: adminName,
          granted_by: session.admin?.id || session.user?.id || null,
          granted_by_email: session.admin?.email || session.user?.email || null,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'college_id,admin_email' }
      );
    } catch {}

    // 4. Update request status in audit_logs & register active editor in audit_logs
    try {
      await db
        .from('audit_logs')
        .update({
          action: 'APPROVED',
          details: `Approved Google Form Editor access for ${adminName} (${targetEmail})`,
          metadata: {
            admin_name: adminName,
            admin_email: targetEmail,
            status: 'APPROVED',
            reviewed_by: session.admin?.id || session.user?.id || null,
            reviewed_by_email: session.admin?.email || session.user?.email || null,
            reviewed_at: new Date().toISOString(),
          },
        })
        .eq('id', requestId);
    } catch {}

    await db.from('audit_logs').insert({
      college_id: collegeId,
      actor_user_id: session.admin?.id || session.user?.id || null,
      actor_email: session.admin?.email || session.user?.email || '',
      action: 'ACTIVE',
      entity_type: 'GOOGLE_FORM_EDITOR_ACTIVE',
      entity_id: targetEmail,
      details: `Active Google Form Editor permission granted to ${adminName} (${targetEmail})`,
      metadata: {
        admin_name: adminName,
        admin_email: targetEmail,
        admin_id: adminId,
        granted_by: session.admin?.id || session.user?.id || null,
        granted_by_email: session.admin?.email || session.user?.email || null,
        is_active: true,
        granted_at: new Date().toISOString(),
      },
    });

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

    try {
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
    } catch {}

    try {
      await db
        .from('audit_logs')
        .update({
          action: 'REJECTED',
          details: `Rejected Google Form Editor access: ${reason || 'Declined by Super Admin'}`,
          metadata: {
            status: 'REJECTED',
            rejection_reason: reason || 'Access request declined by Super Admin',
            reviewed_by: session.admin?.id || session.user?.id || null,
            reviewed_by_email: session.admin?.email || session.user?.email || null,
            reviewed_at: new Date().toISOString(),
          },
        })
        .eq('id', requestId);
    } catch {}

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

    // 2. Try upserting into approved editors
    try {
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
    } catch {}

    // 3. Always register in audit_logs
    await db.from('audit_logs').insert({
      college_id: collegeId,
      actor_user_id: session.admin?.id || session.user?.id || null,
      actor_email: session.admin?.email || session.user?.email || '',
      action: 'ACTIVE',
      entity_type: 'GOOGLE_FORM_EDITOR_ACTIVE',
      entity_id: normalizedEmail,
      details: `Directly granted lifetime Google Form Editor access to ${name || normalizedEmail} (${normalizedEmail})`,
      metadata: {
        admin_name: name || normalizedEmail.split('@')[0],
        admin_email: normalizedEmail,
        granted_by: session.admin?.id || session.user?.id || null,
        granted_by_email: session.admin?.email || session.user?.email || null,
        is_active: true,
        granted_at: new Date().toISOString(),
      },
    });

    // Also mark any pending audit log request as approved
    try {
      await db
        .from('audit_logs')
        .update({
          action: 'APPROVED',
          metadata: {
            status: 'APPROVED',
            reviewed_by_email: session.admin?.email || session.user?.email || null,
            reviewed_at: new Date().toISOString(),
          },
        })
        .eq('college_id', collegeId)
        .eq('entity_type', 'GOOGLE_FORM_EDITOR_REQUEST')
        .ilike('entity_id', normalizedEmail)
        .eq('action', 'PENDING');
    } catch {}

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

    try {
      await db
        .from('college_google_form_editors')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', editorId);
    } catch {}

    try {
      await db
        .from('audit_logs')
        .update({
          action: 'REVOKED',
          metadata: { is_active: false, revoked_at: new Date().toISOString() },
        })
        .eq('id', editorId);
    } catch {}

    revalidatePath(`/admin/dashboard`);
    return { success: true, message: 'Google Form editor access revoked.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Revocation failed.' };
  }
}

/**
 * Fetches approved editors and pending requests for Super Admin review.
 * Uses dedicated tables if present, and seamlessly merges/falls back to audit_logs.
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

    // 1. Get connected account
    const { data: conn } = await db
      .from('college_google_connections')
      .select('account_email')
      .eq('college_id', collegeId)
      .maybeSingle();

    // 2. Fetch approved editors
    const approvedEditors: CollegeGoogleFormEditor[] = [];
    const seenApprovedEmails = new Set<string>();

    try {
      const { data: editors, error: edErr } = await db
        .from('college_google_form_editors')
        .select('*')
        .eq('college_id', collegeId)
        .eq('is_active', true)
        .order('granted_at', { ascending: false });

      if (!edErr && editors) {
        for (const ed of editors) {
          approvedEditors.push(ed as CollegeGoogleFormEditor);
          seenApprovedEmails.add(ed.admin_email.toLowerCase());
        }
      }
    } catch {}

    // Fallback/Merge with audit_logs for active editors
    try {
      const { data: auditEditors } = await db
        .from('audit_logs')
        .select('*')
        .eq('college_id', collegeId)
        .eq('entity_type', 'GOOGLE_FORM_EDITOR_ACTIVE')
        .order('created_at', { ascending: false });

      if (auditEditors) {
        for (const log of auditEditors) {
          const email = (log.entity_id || log.actor_email || '').toLowerCase().trim();
          if (!email || seenApprovedEmails.has(email)) continue;
          if (log.action === 'REVOKED' || (log.metadata as any)?.is_active === false) continue;

          seenApprovedEmails.add(email);
          approvedEditors.push({
            id: log.id,
            college_id: log.college_id,
            admin_id: log.actor_user_id,
            admin_email: email,
            admin_name: (log.metadata as any)?.admin_name || email.split('@')[0],
            granted_by: (log.metadata as any)?.granted_by || null,
            granted_by_email: (log.metadata as any)?.granted_by_email || log.actor_email || null,
            is_active: true,
            granted_at: (log.metadata as any)?.granted_at || log.created_at,
            created_at: log.created_at,
            updated_at: log.created_at,
          });
        }
      }
    } catch {}

    // 3. Fetch pending requests
    const pendingRequests: GoogleFormEditorRequest[] = [];
    const seenRequestEmails = new Set<string>();

    try {
      const { data: requests, error: reqErr } = await db
        .from('google_form_editor_requests')
        .select('*')
        .eq('college_id', collegeId)
        .eq('status', 'PENDING')
        .order('requested_at', { ascending: false });

      if (!reqErr && requests) {
        for (const req of requests) {
          pendingRequests.push(req as GoogleFormEditorRequest);
          seenRequestEmails.add(req.admin_email.toLowerCase());
        }
      }
    } catch {}

    // Fallback/Merge with audit_logs for pending requests
    try {
      const { data: auditRequests } = await db
        .from('audit_logs')
        .select('*')
        .eq('college_id', collegeId)
        .eq('entity_type', 'GOOGLE_FORM_EDITOR_REQUEST')
        .order('created_at', { ascending: false });

      if (auditRequests) {
        const processedEmails = new Set<string>();

        for (const log of auditRequests) {
          const email = (log.entity_id || log.actor_email || '').toLowerCase().trim();
          if (!email || processedEmails.has(email)) continue;
          processedEmails.add(email);

          // If already in list or already approved, don't show as pending
          if (seenRequestEmails.has(email) || seenApprovedEmails.has(email)) continue;
          if (log.action === 'APPROVED' || log.action === 'REJECTED') continue;

          seenRequestEmails.add(email);
          pendingRequests.push({
            id: log.id,
            college_id: log.college_id,
            admin_id: log.actor_user_id,
            admin_email: email,
            admin_name: (log.metadata as any)?.admin_name || email.split('@')[0],
            status: 'PENDING',
            requested_at: (log.metadata as any)?.requested_at || log.created_at,
            created_at: log.created_at,
            updated_at: log.created_at,
          });
        }
      }
    } catch {}

    return {
      success: true,
      connectedAccountEmail: conn?.account_email || undefined,
      approvedEditors,
      pendingRequests,
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
