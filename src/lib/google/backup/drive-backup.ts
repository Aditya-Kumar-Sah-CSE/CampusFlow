import { getOrCreateDriveFolder } from '@/lib/google/feedback-drive';
import type { CollegeBackupState, DriveCleanupReport } from '@/types/backup';

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
  // Subfolders under Academic Structure
  collegeProfileFolderId?: string;
  facultyAssignmentsFolderId?: string;
  subjectsBranchesFolderId?: string;
  academicYearsSemestersFolderId?: string;
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
  cleanupReport?: DriveCleanupReport;
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
 * Safely migrates files from redundant old folders under Academic Structure
 * into the consolidated target subfolders, and removes empty redundant folders.
 * Strictly non-destructive: only deletes folders that are verified 100% empty.
 */
export async function cleanupAcademicDriveStructure(
  drive: any,
  academicFolderId: string,
  targetMap: Map<string, string>
): Promise<DriveCleanupReport> {
  const logs: string[] = [];
  let migratedFilesCount = 0;
  let removedFoldersCount = 0;
  let preservedFoldersCount = 0;

  try {
    const listRes = await drive.files.list({
      q: `'${academicFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 100,
    });

    const subfolders = listRes.data.files || [];

    // Map old fragmented folder names to their consolidated target folder key
    const redundantFolderToTargetKey: Record<string, string> = {
      'faculty': 'faculty & assignments',
      'faculties': 'faculty & assignments',
      'faculty subject assignments': 'faculty & assignments',
      'subjects': 'subjects & branches',
      'branches': 'subjects & branches',
      'academic years': 'academic years & semesters',
      'semesters': 'academic years & semesters',
    };

    for (const folder of subfolders) {
      const lowerName = folder.name?.toLowerCase().trim() || '';
      const targetKey = redundantFolderToTargetKey[lowerName];

      if (!targetKey) {
        // Not a redundant folder (e.g. 'college profile', 'faculty & assignments', etc.)
        continue;
      }

      const targetFolderId = targetMap.get(targetKey);
      if (!targetFolderId) {
        logs.push(`[DriveCleanup] Target folder for "${folder.name}" (${targetKey}) not found in map. Skipping.`);
        preservedFoldersCount++;
        continue;
      }

      // Check all files/subfolders inside this redundant folder
      const filesRes = await drive.files.list({
        q: `'${folder.id}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType)',
        pageSize: 100,
      });

      const files = filesRes.data.files || [];

      // If files exist, safely migrate them into the target folder
      if (files.length > 0) {
        logs.push(`[DriveCleanup] Found ${files.length} file(s) in redundant folder "${folder.name}". Migrating to "${targetKey}"...`);

        for (const file of files) {
          try {
            await drive.files.update({
              fileId: file.id,
              addParents: targetFolderId,
              removeParents: folder.id,
              fields: 'id, parents',
            });
            migratedFilesCount++;
            logs.push(`[DriveCleanup] Migrated file "${file.name}" (${file.id}) from "${folder.name}".`);
          } catch (moveErr: any) {
            logs.push(`[DriveCleanup] Warning migrating file "${file.name}" (${file.id}): ${moveErr.message}`);
          }
        }
      }

      // Verify the folder is genuinely empty before deletion
      const verifyRes = await drive.files.list({
        q: `'${folder.id}' in parents and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 10,
      });

      const remainingItems = verifyRes.data.files || [];
      if (remainingItems.length === 0) {
        try {
          await drive.files.update({
            fileId: folder.id,
            requestBody: { trashed: true },
          });
          removedFoldersCount++;
          logs.push(`[DriveCleanup] Safely removed empty redundant folder "${folder.name}" (${folder.id}).`);
        } catch (delErr: any) {
          logs.push(`[DriveCleanup] Error removing empty folder "${folder.name}": ${delErr.message}`);
          preservedFoldersCount++;
        }
      } else {
        logs.push(`[DriveCleanup] Preserved folder "${folder.name}" (${folder.id}) because it still contains ${remainingItems.length} item(s).`);
        preservedFoldersCount++;
      }
    }
  } catch (err: any) {
    logs.push(`[DriveCleanup] Notice during academic structure folder cleanup: ${err.message}`);
  }

  return {
    migratedFilesCount,
    removedFoldersCount,
    preservedFoldersCount,
    logs,
  };
}

/**
 * Ensures the clean, minimal, production-ready Google Drive directory hierarchy for an institution.
 * 
 * Target Structure:
 * CampusFlow/
 * └── [College Name]/
 *     ├── Academic Structure/
 *     │   ├── College Profile
 *     │   ├── Faculty & Assignments
 *     │   ├── Subjects & Branches
 *     │   └── Academic Years & Semesters
 *     │
 *     ├── Feedback Forms/
 *     ├── Events/
 *     ├── Reports/
 *     └── Backup/
 * 
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

  // 3. Institution: [College Name] (e.g. Bhagalpur College of Engineering)
  const instFolder = await resolveFolder(
    drive,
    cleanInstName,
    campusFlowFolder.id,
    cachedState?.drive_institution_folder_id
  );

  // 4. Top-level category folders under [College Name]
  // Target: Academic Structure, Feedback Forms, Events, Reports, Backup
  const instSubFolders = await ensureSubFolders(drive, instFolder.id, [
    'Academic Structure',
    'Feedback Forms',
    'Events',
    'Reports',
    'Backup',
  ]);

  // Academic Structure folder
  const academicFolderId =
    instSubFolders.get('academic structure') ||
    (await resolveFolder(drive, 'Academic Structure', instFolder.id)).id;

  // Feedback Forms folder (with backward compatibility for 'Feedback')
  const feedbackFolderId =
    instSubFolders.get('feedback forms') ||
    instSubFolders.get('feedback') ||
    (await resolveFolder(drive, 'Feedback Forms', instFolder.id)).id;

  // Events folder
  const eventsFolderId =
    instSubFolders.get('events') ||
    (await resolveFolder(drive, 'Events', instFolder.id)).id;

  // Reports folder
  const reportsFolderId =
    instSubFolders.get('reports') ||
    (await resolveFolder(drive, 'Reports', instFolder.id)).id;

  // Backup folder (with backward compatibility for 'System Backups')
  const systemBackupsFolderId =
    instSubFolders.get('backup') ||
    instSubFolders.get('system backups') ||
    (await resolveFolder(drive, 'Backup', instFolder.id)).id;

  // Billing folder (preserved for backward compatibility)
  const billingFolderId =
    instSubFolders.get('billing') ||
    (await resolveFolder(drive, 'Billing', instFolder.id)).id;

  // 5. Minimal, consolidated subfolders under Academic Structure
  const academicSubs = await ensureSubFolders(drive, academicFolderId, [
    'College Profile',
    'Faculty & Assignments',
    'Subjects & Branches',
    'Academic Years & Semesters',
  ]);

  // Run cleanup & migration of old fragmented folders under Academic Structure
  const cleanupReport = await cleanupAcademicDriveStructure(drive, academicFolderId, academicSubs);

  // 6. Populate subfolders within other categories
  const [, , , systemSubs] = await Promise.all([
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
    // Specific Academic Structure subfolders
    collegeProfileFolderId: academicSubs.get('college profile'),
    facultyAssignmentsFolderId: academicSubs.get('faculty & assignments'),
    subjectsBranchesFolderId: academicSubs.get('subjects & branches'),
    academicYearsSemestersFolderId: academicSubs.get('academic years & semesters'),
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
    cleanupReport,
  };
}

// Re-export ensureCollegeDriveHierarchy for backwards compatibility
export const ensureCollegeDriveHierarchy = ensureCollegeBackupStructure;
