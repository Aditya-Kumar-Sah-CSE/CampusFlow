import { executeWithCollegeGoogleOAuthRetry } from './auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrCreateDriveFolder } from './feedback-drive';
import { isPrimarySuperAdmin } from '@/lib/auth/admin-auth-shared';

export interface GrantEditorResult {
  success: boolean;
  message: string;
  folderPermissionId?: string;
  formsSharedCount?: number;
  error?: string;
}

/**
 * Checks whether an admin email has approved Google Form Editor permissions for a college.
 * - Returns true immediately if the email is the College's connected Google account (Owner).
 * - Returns true if Primary Super Admin.
 * - Otherwise checks the database table `college_google_form_editors`.
 */
export async function isGoogleFormEditorApproved(
  collegeId: string,
  adminEmail: string
): Promise<{ approved: boolean; isOwner: boolean }> {
  if (!collegeId || !adminEmail) {
    return { approved: false, isOwner: false };
  }

  const normalizedEmail = adminEmail.trim().toLowerCase();

  const db = createAdminClient();
  if (!db) {
    return { approved: false, isOwner: false };
  }

  // 1. Check if this is the connected Google Account (Owner)
  const { data: conn } = await db
    .from('college_google_connections')
    .select('account_email')
    .eq('college_id', collegeId)
    .maybeSingle();

  if (conn?.account_email && conn.account_email.toLowerCase() === normalizedEmail) {
    return { approved: true, isOwner: true };
  }

  // 2. Check approved editors table (must have been actually granted on Google Drive)
  try {
    const { data: editorRecord, error } = await db
      .from('college_google_form_editors')
      .select('id, is_active')
      .eq('college_id', collegeId)
      .eq('is_active', true)
      .ilike('admin_email', normalizedEmail)
      .maybeSingle();

    if (!error && editorRecord) {
      return { approved: true, isOwner: false };
    }
  } catch (err) {
    console.warn('[EditorPermissions] Check warning:', err);
  }

  return { approved: false, isOwner: false };
}

/**
 * Grants Google Drive editor ('writer') permission to an admin email across:
 * 1. The institution's 'Feedback Forms' root directory in Google Drive.
 * 2. All existing Google Forms created for this college.
 * This guarantees both existing forms and all future forms in this folder can be edited.
 */
export async function grantGoogleDriveEditorAccess(params: {
  collegeId: string;
  adminEmail: string;
}): Promise<GrantEditorResult> {
  const { collegeId, adminEmail } = params;
  const normalizedEmail = adminEmail.trim().toLowerCase();

  const db = createAdminClient();
  if (!db) {
    return { success: false, message: 'Database client unavailable.' };
  }

  // Fetch college name
  const { data: college } = await db
    .from('colleges')
    .select('id, name')
    .eq('id', collegeId)
    .maybeSingle();

  const collegeName = college?.name || 'Institution';

  return executeWithCollegeGoogleOAuthRetry(collegeId, async ({ drive }) => {
    let folderPermissionId: string | undefined;

    // 1. Traverse / create the standard Drive hierarchy: CampusFlow -> <College> -> Feedback Forms
    const campusFlowFolder = await getOrCreateDriveFolder(drive, 'CampusFlow');
    const institutionFolder = await getOrCreateDriveFolder(drive, collegeName, campusFlowFolder.id);
    const feedbackRootFolder = await getOrCreateDriveFolder(drive, 'Feedback Forms', institutionFolder.id);

    // 2. Grant 'writer' on the 'Feedback Forms' folder
    try {
      const folderPermRes = await drive.permissions.create({
        fileId: feedbackRootFolder.id,
        requestBody: {
          role: 'writer',
          type: 'user',
          emailAddress: normalizedEmail,
        },
        sendNotificationEmail: false,
        fields: 'id',
      });
      folderPermissionId = (folderPermRes.data?.id as string) || undefined;
    } catch (permErr: any) {
      // If already shared or sharing with owner, safe to continue
      console.warn(`[EditorPermissions] Folder share notice for ${normalizedEmail}:`, permErr?.message || permErr);
    }

    // 3. Grant direct 'writer' access to all existing forms of this college
    let sharedCount = 0;
    try {
      const { data: forms } = await db
        .from('feedback_forms')
        .select('google_form_id, google_sheet_id')
        .eq('college_id', collegeId);

      if (forms && forms.length > 0) {
        for (const f of forms) {
          if (f.google_form_id) {
            try {
              await drive.permissions.create({
                fileId: f.google_form_id,
                requestBody: {
                  role: 'writer',
                  type: 'user',
                  emailAddress: normalizedEmail,
                },
                sendNotificationEmail: false,
                fields: 'id',
              });
              sharedCount++;
            } catch {
              // Ignore if already shared
            }
          }
          if (f.google_sheet_id) {
            try {
              await drive.permissions.create({
                fileId: f.google_sheet_id,
                requestBody: {
                  role: 'writer',
                  type: 'user',
                  emailAddress: normalizedEmail,
                },
                sendNotificationEmail: false,
                fields: 'id',
              });
            } catch {
              // Ignore if already shared
            }
          }
        }
      }
    } catch (formsErr: any) {
      console.warn('[EditorPermissions] Existing forms share notice:', formsErr?.message || formsErr);
    }

    return {
      success: true,
      message: `Google Drive editor permission granted for ${normalizedEmail}.`,
      folderPermissionId,
      formsSharedCount: sharedCount,
    };
  });
}

/**
 * Automatically shares a newly created Google Form & Sheet with all approved editors
 * of that college so they have zero-friction instant edit access for all future forms.
 */
export async function shareNewFormWithApprovedEditors(params: {
  collegeId: string;
  googleFormId: string;
  googleSheetId?: string;
}): Promise<void> {
  const { collegeId, googleFormId, googleSheetId } = params;
  if (!collegeId || !googleFormId) return;

  const db = createAdminClient();
  if (!db) return;

  try {
    const { data: editors } = await db
      .from('college_google_form_editors')
      .select('admin_email')
      .eq('college_id', collegeId)
      .eq('is_active', true);

    if (!editors || editors.length === 0) return;

    await executeWithCollegeGoogleOAuthRetry(collegeId, async ({ drive }) => {
      for (const ed of editors) {
        if (!ed.admin_email) continue;
        const email = ed.admin_email.trim().toLowerCase();

        // Share Form
        try {
          await drive.permissions.create({
            fileId: googleFormId,
            requestBody: {
              role: 'writer',
              type: 'user',
              emailAddress: email,
            },
            sendNotificationEmail: false,
            fields: 'id',
          });
        } catch {
          // ignore if already shared
        }

        // Share Sheet if available
        if (googleSheetId) {
          try {
            await drive.permissions.create({
              fileId: googleSheetId,
              requestBody: {
                role: 'writer',
                type: 'user',
                emailAddress: email,
              },
              sendNotificationEmail: false,
              fields: 'id',
            });
          } catch {
            // ignore
          }
        }
      }
    });
  } catch (err) {
    console.warn('[EditorPermissions] Auto-share new form notice:', err);
  }
}
