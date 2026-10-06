import { getOrCreateDriveFolder } from '@/lib/google/feedback-drive';
import type { CollegeBackupState } from '@/types/backup';

export interface CollegeDriveHierarchy {
  rootFolderId: string;
  rootFolderUrl: string;
  platformFolderId: string;
  platformFolderUrl: string;
  institutionFolderId: string;
  institutionFolderUrl: string;
  academicFolderId: string;
  academicFolderUrl: string;
  feedbackFolderId: string;
  feedbackFolderUrl: string;
  eventsFolderId: string;
  eventsFolderUrl: string;
  reportsFolderId: string;
  reportsFolderUrl: string;
  systemBackupsFolderId: string;
  systemBackupsFolderUrl: string;
  snapshotsFolderId: string;
  snapshotsFolderUrl: string;
  manifestsFolderId: string;
  manifestsFolderUrl: string;
  auditExportsFolderId: string;
  auditExportsFolderUrl: string;
  // Backwards-compatible aliases
  backupFolderId: string;
  backupFolderUrl: string;
  recoveryFolderId: string;
  recoveryFolderUrl: string;
  institutionSubFolderId: string;
  institutionSubFolderUrl: string;
  billingFolderId: string;
  billingFolderUrl: string;
  systemFolderId: string;
  systemFolderUrl: string;
}

/**
 * Validates whether an existing Drive folder ID exists and is active (not trashed).
 */
export async function verifyFolderExists(drive: any, folderId: string | null | undefined): Promise<boolean> {
  if (!folderId || typeof folderId !== 'string') return false;
  try {
    const res = await drive.files.get({
      fileId: folderId,
      fields: 'id, trashed, mimeType',
    });
    return Boolean(
      res.data?.id &&
      !res.data.trashed &&
      res.data.mimeType === 'application/vnd.google-apps.folder'
    );
  } catch {
    return false;
  }
}

/**
 * Gets or creates a folder, checking cached folder ID first before making a search/create call.
 */
export async function resolveFolder(
  drive: any,
  folderName: string,
  parentId?: string,
  cachedId?: string | null
): Promise<{ id: string; url: string }> {
  if (cachedId) {
    const isValid = await verifyFolderExists(drive, cachedId);
    if (isValid) {
      return {
        id: cachedId,
        url: `https://drive.google.com/drive/folders/${cachedId}`,
      };
    }
  }
  return getOrCreateDriveFolder(drive, folderName, parentId);
}

/**
 * High-performance batch subfolder resolution:
 * Performs 1 list query to find all existing subfolders under parentId,
 * and only creates missing subfolders sequentially to avoid rate-limiting.
 */
export async function ensureSubFolders(
  drive: any,
  parentId: string,
  folderNames: string[]
): Promise<Map<string, string>> {
  const resultMap = new Map<string, string>();

  try {
    const listRes = await drive.files.list({
      q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 100,
    });

    const existingFiles = listRes.data.files || [];
    for (const f of existingFiles) {
      if (f.name && f.id) {
        resultMap.set(f.name.toLowerCase().trim(), f.id);
      }
    }
  } catch (err) {
    console.warn(`[DriveBackup] Subfolder batch search notice for parent [${parentId}]:`, err);
  }

  // Create only missing subfolders sequentially to avoid rate limits
  for (const name of folderNames) {
    const cleanName = name.trim();
    if (!resultMap.has(cleanName.toLowerCase())) {
      try {
        const createRes = await drive.files.create({
          requestBody: {
            name: cleanName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
          },
          fields: 'id',
        });
        if (createRes.data.id) {
          resultMap.set(cleanName.toLowerCase(), createRes.data.id);
        }
      } catch (createErr) {
        console.warn(`[DriveBackup] Failed to create subfolder "${cleanName}":`, createErr);
      }
    }
  }

  return resultMap;
}

/**
 * Ensures the production Google Drive directory hierarchy for an institution.
 * Strictly non-destructive. Re-uses existing folders and avoids duplicate folder creation.
 */
export async function ensureCollegeBackupStructure(
  drive: any,
  collegeName: string,
  cachedState?: Partial<CollegeBackupState> | null
): Promise<CollegeDriveHierarchy> {
  const cleanInstName = collegeName.trim() || 'Institution';

  // 1. Root: CampusFlow
  const campusFlowFolder = await resolveFolder(
    drive,
    'CampusFlow',
    undefined,
    cachedState?.drive_root_folder_id
  );

  // 2. Global Platform Folder under CampusFlow
  const platformFolder = await resolveFolder(
    drive,
    'Platform',
    campusFlowFolder.id
  );
  await ensureSubFolders(drive, platformFolder.id, [
    'Platform Configuration',
    'Global Backups',
  ]);

  // 3. Institution: {College Name} (e.g. Bhagalpur College of Engineering)
  const instFolder = await resolveFolder(
    drive,
    cleanInstName,
    campusFlowFolder.id,
    cachedState?.drive_institution_folder_id
  );

  // 4. Top-level category folders under {College Name}
  const instSubFolders = await ensureSubFolders(drive, instFolder.id, [
    'Academic Structure',
    'Feedback',
    'Events',
    'Reports',
    'System Backups',
    'Billing',
  ]);

  // Academic Structure
  const academicFolderId =
    instSubFolders.get('academic structure') ||
    (await resolveFolder(drive, 'Academic Structure', instFolder.id)).id;

  // Feedback (with backward compatibility for 'Feedback Forms')
  const feedbackFolderId =
    instSubFolders.get('feedback') ||
    instSubFolders.get('feedback forms') ||
    (await resolveFolder(drive, 'Feedback', instFolder.id)).id;

  // Events
  const eventsFolderId =
    instSubFolders.get('events') ||
    (await resolveFolder(drive, 'Events', instFolder.id)).id;

  // Reports
  const reportsFolderId =
    instSubFolders.get('reports') ||
    (await resolveFolder(drive, 'Reports', instFolder.id)).id;

  // System Backups (with backward compatibility for 'Backup')
  const systemBackupsFolderId =
    instSubFolders.get('system backups') ||
    instSubFolders.get('backup') ||
    (await resolveFolder(drive, 'System Backups', instFolder.id)).id;

  // Billing (optional)
  const billingFolderId =
    instSubFolders.get('billing') ||
    (await resolveFolder(drive, 'Billing', instFolder.id)).id;

  // 5. Populate subfolders within each category
  const [, , , , systemSubs] = await Promise.all([
    ensureSubFolders(drive, academicFolderId, [
      'College Profile',
      'Academic Years',
      'Branches',
      'Semesters',
      'Faculty',
      'Subjects',
      'Faculty Subject Assignments',
    ]),
    ensureSubFolders(drive, feedbackFolderId, [
      'Feedback Forms',
      'Response Backups',
      'Reports',
    ]),
    ensureSubFolders(drive, eventsFolderId, [
      'Event Data',
      'Registrations',
      'Teams',
      'Payments',
      'Reports',
    ]),
    ensureSubFolders(drive, reportsFolderId, [
      'Academic',
      'Feedback',
      'Events',
    ]),
    ensureSubFolders(drive, systemBackupsFolderId, [
      'Database Snapshots',
      'Backup Manifests',
      'Audit Exports',
    ]),
  ]);

  const snapshotsFolderId =
    systemSubs.get('database snapshots') ||
    systemSubs.get('snapshots') ||
    (await resolveFolder(drive, 'Database Snapshots', systemBackupsFolderId)).id;

  const manifestsFolderId =
    systemSubs.get('backup manifests') ||
    systemSubs.get('manifests') ||
    (await resolveFolder(drive, 'Backup Manifests', systemBackupsFolderId)).id;

  const auditExportsFolderId =
    systemSubs.get('audit exports') ||
    (await resolveFolder(drive, 'Audit Exports', systemBackupsFolderId)).id;

  return {
    rootFolderId: campusFlowFolder.id,
    rootFolderUrl: campusFlowFolder.url,
    platformFolderId: platformFolder.id,
    platformFolderUrl: platformFolder.url,
    institutionFolderId: instFolder.id,
    institutionFolderUrl: instFolder.url,
    academicFolderId,
    academicFolderUrl: `https://drive.google.com/drive/folders/${academicFolderId}`,
    feedbackFolderId,
    feedbackFolderUrl: `https://drive.google.com/drive/folders/${feedbackFolderId}`,
    eventsFolderId,
    eventsFolderUrl: `https://drive.google.com/drive/folders/${eventsFolderId}`,
    reportsFolderId,
    reportsFolderUrl: `https://drive.google.com/drive/folders/${reportsFolderId}`,
    systemBackupsFolderId,
    systemBackupsFolderUrl: `https://drive.google.com/drive/folders/${systemBackupsFolderId}`,
    snapshotsFolderId,
    snapshotsFolderUrl: `https://drive.google.com/drive/folders/${snapshotsFolderId}`,
    manifestsFolderId,
    manifestsFolderUrl: `https://drive.google.com/drive/folders/${manifestsFolderId}`,
    auditExportsFolderId,
    auditExportsFolderUrl: `https://drive.google.com/drive/folders/${auditExportsFolderId}`,
    // Backwards-compatible aliases
    backupFolderId: systemBackupsFolderId,
    backupFolderUrl: `https://drive.google.com/drive/folders/${systemBackupsFolderId}`,
    recoveryFolderId: systemBackupsFolderId,
    recoveryFolderUrl: `https://drive.google.com/drive/folders/${systemBackupsFolderId}`,
    institutionSubFolderId: instFolder.id,
    institutionSubFolderUrl: instFolder.url,
    billingFolderId,
    billingFolderUrl: `https://drive.google.com/drive/folders/${billingFolderId}`,
    systemFolderId: systemBackupsFolderId,
    systemFolderUrl: `https://drive.google.com/drive/folders/${systemBackupsFolderId}`,
  };
}

// Re-export ensureCollegeDriveHierarchy for backwards compatibility
export const ensureCollegeDriveHierarchy = ensureCollegeBackupStructure;
