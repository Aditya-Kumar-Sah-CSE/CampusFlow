import { executeWithCollegeGoogleOAuthRetry } from './auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Searches for or creates a single Google Drive folder under a given parent.
 */
export async function getOrCreateDriveFolder(
  drive: any,
  folderName: string,
  parentId?: string
): Promise<{ id: string; url: string }> {
  const cleanName = folderName.trim().slice(0, 100);
  const escapedName = cleanName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  let query = `name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  try {
    const listRes = await drive.files.list({
      q: query,
      fields: 'files(id, name, webViewLink)',
      pageSize: 1,
    });

    const existing = listRes.data.files?.[0];
    if (existing?.id) {
      return {
        id: existing.id,
        url: existing.webViewLink || `https://drive.google.com/drive/folders/${existing.id}`,
      };
    }
  } catch (err) {
    console.warn(`[FeedbackDrive] Folder search notice for "${cleanName}":`, err);
  }

  const createRes = await drive.files.create({
    requestBody: {
      name: cleanName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id, name, webViewLink',
  });

  const newId = createRes.data.id;
  if (!newId) {
    throw new Error(`Failed to create Google Drive folder "${cleanName}".`);
  }

  return {
    id: newId,
    url: createRes.data.webViewLink || `https://drive.google.com/drive/folders/${newId}`,
  };
}

/**
 * Moves a file (Form or Sheet) into a designated Google Drive folder.
 */
export async function moveDriveFileToFolder(
  drive: any,
  fileId: string,
  targetFolderId: string
): Promise<void> {
  if (!fileId || !targetFolderId) return;
  try {
    const fileInfo = await drive.files.get({ fileId, fields: 'parents' });
    const prevParents = (fileInfo.data.parents || []).join(',');
    await drive.files.update({
      fileId,
      addParents: targetFolderId,
      removeParents: prevParents || undefined,
      fields: 'id, parents',
    });
  } catch (moveErr: any) {
    console.warn(`[FeedbackDrive] Move warning for file [${fileId}]:`, moveErr?.message || moveErr);
  }
}

export interface FeedbackDriveHierarchyResult {
  formFolderId: string;
  formFolderUrl: string;
  sessionFolderId: string;
  sessionFolderUrl: string;
  feedbackRootFolderId: string;
  feedbackRootFolderUrl: string;
  institutionFolderId: string;
}

/**
 * Ensures standard session-wise Google Drive folder hierarchy for Feedback Forms:
 * CampusFlow / <Institution> / Feedback Forms / <Academic Year (e.g. 2024-2025)> / <Form Title>
 */
export async function ensureFeedbackFormDriveHierarchy(params: {
  collegeId: string;
  collegeName: string;
  academicYearName: string;
  formTitle: string;
  existingFolderId?: string | null;
}): Promise<FeedbackDriveHierarchyResult> {
  const { collegeId, collegeName, academicYearName, formTitle, existingFolderId } = params;

  return executeWithCollegeGoogleOAuthRetry(collegeId, async ({ drive }) => {
    // 1. Verify existing folder ID if provided
    if (existingFolderId) {
      try {
        const check = await drive.files.get({
          fileId: existingFolderId,
          fields: 'id, name, trashed, webViewLink',
        });
        if (check.data?.id && !check.data.trashed) {
          return {
            formFolderId: check.data.id,
            formFolderUrl: check.data.webViewLink || `https://drive.google.com/drive/folders/${check.data.id}`,
            sessionFolderId: '',
            sessionFolderUrl: '',
            feedbackRootFolderId: '',
            feedbackRootFolderUrl: '',
            institutionFolderId: '',
          };
        }
      } catch {
        console.warn(`[FeedbackDrive] Stored folder ID ${existingFolderId} invalid; reconstructing path.`);
      }
    }

    // 2. Root: CampusFlow
    const campusFlowFolder = await getOrCreateDriveFolder(drive, 'CampusFlow');

    // 3. Institution Level: <Institution Name> (alongside Events)
    const cleanInstName = collegeName.trim() || 'Institution';
    const institutionFolder = await getOrCreateDriveFolder(drive, cleanInstName, campusFlowFolder.id);

    // 4. Feedback Forms Level (alongside Events)
    const feedbackRootFolder = await getOrCreateDriveFolder(drive, 'Feedback Forms', institutionFolder.id);

    // 5. Session Level: e.g. 2024-2025, 2025-2026, 2026-2027
    const sessionClean = (academicYearName || 'General Session').trim().replace(/[/\\?%*:|"<>]/g, '-');
    const sessionFolder = await getOrCreateDriveFolder(drive, sessionClean, feedbackRootFolder.id);

    // 6. Form Level: <Form Title>
    const cleanTitle = (formTitle || 'Feedback Form').trim().replace(/[/\\?%*:|"<>]/g, '—').slice(0, 100);
    const formFolder = await getOrCreateDriveFolder(drive, cleanTitle, sessionFolder.id);

    return {
      formFolderId: formFolder.id,
      formFolderUrl: formFolder.url,
      sessionFolderId: sessionFolder.id,
      sessionFolderUrl: sessionFolder.url,
      feedbackRootFolderId: feedbackRootFolder.id,
      feedbackRootFolderUrl: feedbackRootFolder.url,
      institutionFolderId: institutionFolder.id,
    };
  });
}

/**
 * Organizes all feedback forms and sessions for a college into the structured Google Drive tree.
 * Creates session folders (2024-2025, 2025-2026, etc.) and moves existing Forms and Sheets into their form folders.
 */
export async function organizeAllCollegeFeedbackFormsInDrive(collegeId: string): Promise<{
  success: boolean;
  message: string;
  feedbackFolderUrl?: string;
  organizedCount: number;
}> {
  const db = createAdminClient();
  if (!db) {
    throw new Error('Supabase client unavailable.');
  }

  // 1. Fetch college details
  const { data: college, error: collegeErr } = await db
    .from('colleges')
    .select('id, name')
    .eq('id', collegeId)
    .single();

  if (collegeErr || !college) {
    throw new Error(`College not found: ${collegeErr?.message || collegeId}`);
  }

  const collegeName = college.name || 'Institution';

  return executeWithCollegeGoogleOAuthRetry(collegeId, async ({ drive }) => {
    // 1. CampusFlow root
    const campusFlowFolder = await getOrCreateDriveFolder(drive, 'CampusFlow');

    // 2. Institution folder
    const instFolder = await getOrCreateDriveFolder(drive, collegeName, campusFlowFolder.id);

    // 3. Feedback Forms folder (alongside Events)
    const feedbackFolder = await getOrCreateDriveFolder(drive, 'Feedback Forms', instFolder.id);

    // 4. Fetch all academic years for this college
    const { data: years } = await db
      .from('academic_years')
      .select('id, name')
      .eq('college_id', collegeId)
      .order('name', { ascending: false });

    const sessionFolderMap = new Map<string, string>(); // yearId -> folderId

    for (const yr of years || []) {
      const sessionClean = yr.name.trim().replace(/[/\\?%*:|"<>]/g, '-');
      const sFolder = await getOrCreateDriveFolder(drive, sessionClean, feedbackFolder.id);
      sessionFolderMap.set(yr.id, sFolder.id);
    }

    // 5. Fetch feedback forms for this college
    const { data: forms } = await db
      .from('feedback_forms')
      .select('id, title, academic_year_id, google_form_id, google_sheet_id')
      .eq('college_id', collegeId);

    let movedCount = 0;

    for (const form of forms || []) {
      const parentSessionFolderId =
        (form.academic_year_id && sessionFolderMap.get(form.academic_year_id)) || feedbackFolder.id;

      const cleanTitle = (form.title || 'Feedback Form').trim().replace(/[/\\?%*:|"<>]/g, '—').slice(0, 100);
      const formFolder = await getOrCreateDriveFolder(drive, cleanTitle, parentSessionFolderId);

      if (form.google_form_id) {
        await moveDriveFileToFolder(drive, form.google_form_id, formFolder.id);
        movedCount++;
      }

      if (form.google_sheet_id) {
        await moveDriveFileToFolder(drive, form.google_sheet_id, formFolder.id);
      }
    }

    return {
      success: true,
      message: `Organized ${forms?.length || 0} feedback forms across academic sessions in Google Drive.`,
      feedbackFolderUrl: feedbackFolder.url,
      organizedCount: forms?.length || 0,
    };
  });
}
