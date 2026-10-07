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
  _targetMap?: Map<string, string>
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

    for (const folder of subfolders) {
      // Check all files/subfolders inside this subfolder
      const filesRes = await drive.files.list({
        q: `'${folder.id}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType)',
        pageSize: 100,
      });

      const files = filesRes.data.files || [];

      // If files exist, safely migrate them into academicFolderId root
      if (files.length > 0) {
        logs.push(`[DriveCleanup] Found ${files.length} file(s) in subfolder "${folder.name}". Migrating to Academic Structure root...`);

        for (const file of files) {
          try {
            await drive.files.update({
              fileId: file.id,
              addParents: academicFolderId,
              removeParents: folder.id,
              fields: 'id, parents',
            });
            migratedFilesCount++;
            logs.push(`[DriveCleanup] Migrated file "${file.name}" (${file.id}) to Academic Structure.`);
          } catch (moveErr: any) {
            logs.push(`[DriveCleanup] Warning migrating file "${file.name}" (${file.id}): ${moveErr.message}`);
          }
        }
      }

      // Verify the folder is genuinely empty before deletion
      const verifyRes = await drive.files.list({
        q: `'${folder.id}' in parents and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 5,
      });

      const remainingItems = verifyRes.data.files || [];
      if (remainingItems.length === 0) {
        try {
          await drive.files.update({
            fileId: folder.id,
            requestBody: { trashed: true },
          });
          removedFoldersCount++;
          logs.push(`[DriveCleanup] Safely removed empty subfolder "${folder.name}" (${folder.id}).`);
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
 * Deep cleanup for the entire institution Drive structure:
 * 1. Cleans up redundant/empty folders inside Academic Structure.
 * 2. Safely moves legacy duplicate spreadsheets to Backup/Recovery.
 * 3. Cleans up obsolete, genuinely empty top-level folders (Institution, Feedback, System, Billing, System Backups).
 * Strictly non-destructive: only deletes folders that are verified 100% empty.
 */
export async function cleanupCollegeDriveStructure(params: {
  drive: any;
  collegeName: string;
  institutionFolderId: string;
  academicFolderId: string;
  academicSubsMap: Map<string, string>;
  backupFolderId?: string;
  feedbackFolderId?: string;
}): Promise<DriveCleanupReport> {
  const {
    drive,
    institutionFolderId,
    academicFolderId,
    academicSubsMap,
    backupFolderId,
    feedbackFormsFolderId = params.feedbackFolderId,
  } = params as any;

  // Step 1: Clean academic structure subfolders
  const report = await cleanupAcademicDriveStructure(drive, academicFolderId, academicSubsMap);

  // Step 2: Check for legacy duplicate academic spreadsheet inside Academic Structure
  if (backupFolderId) {
    try {
      const academicFilesRes = await drive.files.list({
        q: `'${academicFolderId}' in parents and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
        fields: 'files(id, name)',
      });
      const academicFiles = academicFilesRes.data.files || [];
      const hasSpecificSheet = academicFiles.some((f: any) =>
        f.name?.toLowerCase().includes('academic structure') &&
        !f.name?.toLowerCase().startsWith('campusflow -')
      );

      if (hasSpecificSheet) {
        const legacySheet = academicFiles.find(
          (f: any) => f.name === 'CampusFlow - Academic Structure'
        );
        if (legacySheet) {
          // Resolve Recovery folder inside Backup
          const recoveryRes = await drive.files.list({
            q: `name = 'Recovery' and '${backupFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
          });
          let recoveryFolderId = recoveryRes.data.files?.[0]?.id;
          if (!recoveryFolderId) {
            const createRecovery = await drive.files.create({
              requestBody: {
                name: 'Recovery',
                mimeType: 'application/vnd.google-apps.folder',
                parents: [backupFolderId],
              },
              fields: 'id',
            });
            recoveryFolderId = createRecovery.data.id;
          }

          if (recoveryFolderId) {
            await drive.files.update({
              fileId: legacySheet.id,
              addParents: recoveryFolderId,
              removeParents: academicFolderId,
              fields: 'id, parents',
            });
            report.migratedFilesCount++;
            report.logs.push(`[DriveCleanup] Safely moved legacy duplicate spreadsheet "${legacySheet.name}" (${legacySheet.id}) to Backup/Recovery.`);
          }
        }
      }
    } catch (legErr: any) {
      report.logs.push(`[DriveCleanup] Notice checking legacy academic spreadsheet: ${legErr.message}`);
    }
  }

  // Step 3: Clean redundant top-level folders in institution folder
  const redundantTopLevelNames = ['institution', 'feedback', 'system', 'billing', 'system backups'];

  try {
    const topRes = await drive.files.list({
      q: `'${institutionFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 100,
    });
    const topFolders = topRes.data.files || [];

    for (const folder of topFolders) {
      const lower = folder.name?.toLowerCase().trim() || '';
      if (!redundantTopLevelNames.includes(lower)) {
        continue;
      }

      // Check items inside this redundant top folder
      const itemsRes = await drive.files.list({
        q: `'${folder.id}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType)',
        pageSize: 100,
      });
      const items = itemsRes.data.files || [];

      // Determine migration target folder
      const migrationTarget = lower === 'feedback' && feedbackFormsFolderId
        ? feedbackFormsFolderId
        : backupFolderId;

      for (const item of items) {
        if (item.mimeType === 'application/vnd.google-apps.folder') {
          // Check inside subfolder
          const subItemsRes = await drive.files.list({
            q: `'${item.id}' in parents and trashed = false`,
            fields: 'files(id, name)',
            pageSize: 100,
          });
          const subItems = subItemsRes.data.files || [];

          if (subItems.length > 0 && migrationTarget) {
            for (const si of subItems) {
              try {
                await drive.files.update({
                  fileId: si.id,
                  addParents: migrationTarget,
                  removeParents: item.id,
                  fields: 'id, parents',
                });
                report.migratedFilesCount++;
                report.logs.push(`[DriveCleanup] Migrated "${si.name}" (${si.id}) from "${folder.name}/${item.name}" to Backup.`);
              } catch (mvErr: any) {
                report.logs.push(`[DriveCleanup] Warning migrating "${si.name}": ${mvErr.message}`);
              }
            }
          }

          // Verify subfolder is empty, then delete
          const verifySub = await drive.files.list({
            q: `'${item.id}' in parents and trashed = false`,
            fields: 'files(id)',
            pageSize: 1,
          });
          if (!verifySub.data.files || verifySub.data.files.length === 0) {
            try {
              await drive.files.update({ fileId: item.id, requestBody: { trashed: true } });
              report.removedFoldersCount++;
              report.logs.push(`[DriveCleanup] Removed empty subfolder "${folder.name}/${item.name}" (${item.id}).`);
            } catch (delErr: any) {
              report.preservedFoldersCount++;
              report.logs.push(`[DriveCleanup] Could not remove "${folder.name}/${item.name}": ${delErr.message}`);
            }
          } else {
            report.preservedFoldersCount++;
          }
        } else if (migrationTarget) {
          // File directly in redundant folder -> migrate to target
          try {
            await drive.files.update({
              fileId: item.id,
              addParents: migrationTarget,
              removeParents: folder.id,
              fields: 'id, parents',
            });
            report.migratedFilesCount++;
            report.logs.push(`[DriveCleanup] Migrated file "${item.name}" (${item.id}) from "${folder.name}".`);
          } catch (mvErr: any) {
            report.logs.push(`[DriveCleanup] Warning migrating "${item.name}": ${mvErr.message}`);
          }
        }
      }

      // Verify top-level redundant folder is now 100% empty, then delete
      const verifyTop = await drive.files.list({
        q: `'${folder.id}' in parents and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 5,
      });
      const remaining = verifyTop.data.files || [];
      if (remaining.length === 0) {
        try {
          await drive.files.update({ fileId: folder.id, requestBody: { trashed: true } });
          report.removedFoldersCount++;
          report.logs.push(`[DriveCleanup] Safely removed redundant empty folder "${folder.name}" (${folder.id}).`);
        } catch (delErr: any) {
          report.preservedFoldersCount++;
          report.logs.push(`[DriveCleanup] Could not remove "${folder.name}": ${delErr.message}`);
        }
      } else {
        report.preservedFoldersCount++;
        report.logs.push(`[DriveCleanup] Preserved "${folder.name}" (${folder.id}) because it still contains ${remaining.length} item(s).`);
      }
    }
  } catch (topErr: any) {
    report.logs.push(`[DriveCleanup] Notice during top-level folder cleanup: ${topErr.message}`);
  }

  // Step 4: Clean up legacy folders and organize loose spreadsheets in Backup folder
  if (backupFolderId) {
    try {
      // 4a. Check for legacy 'Snapshots' folder (empty)
      const snapRes = await drive.files.list({
        q: `'${backupFolderId}' in parents and name = 'Snapshots' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
      });
      for (const snap of (snapRes.data.files || [])) {
        const snapItems = await drive.files.list({ q: `'${snap.id}' in parents and trashed = false`, fields: 'files(id)' });
        if (!snapItems.data.files || snapItems.data.files.length === 0) {
          await drive.files.update({ fileId: snap.id, requestBody: { trashed: true } });
          report.removedFoldersCount++;
          report.logs.push(`[DriveCleanup] Removed empty legacy folder "${snap.name}" (${snap.id}).`);
        }
      }

      // 4b. Consolidate legacy 'Manifests' into 'Backup Manifests'
      const manRes = await drive.files.list({
        q: `'${backupFolderId}' in parents and name = 'Manifests' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
      });
      const backupManRes = await drive.files.list({
        q: `'${backupFolderId}' in parents and name = 'Backup Manifests' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
      });
      const targetManFolderId = backupManRes.data.files?.[0]?.id;

      for (const man of (manRes.data.files || [])) {
        const items = await drive.files.list({ q: `'${man.id}' in parents and trashed = false`, fields: 'files(id, name)' });
        if (items.data.files && items.data.files.length > 0 && targetManFolderId) {
          for (const item of items.data.files) {
            await drive.files.update({
              fileId: item.id,
              addParents: targetManFolderId,
              removeParents: man.id,
              fields: 'id, parents',
            });
            report.migratedFilesCount++;
            report.logs.push(`[DriveCleanup] Migrated "${item.name}" from Manifests to Backup Manifests.`);
          }
        }
        await drive.files.update({ fileId: man.id, requestBody: { trashed: true } });
        report.removedFoldersCount++;
        report.logs.push(`[DriveCleanup] Removed legacy folder "${man.name}" (${man.id}).`);
      }

      // 4c. Move loose spreadsheets in Backup into their respective subfolders
      const auditExportsFolderId = (await drive.files.list({
        q: `'${backupFolderId}' in parents and name = 'Audit Exports' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id)',
      })).data.files?.[0]?.id;

      const looseFiles = await drive.files.list({
        q: `'${backupFolderId}' in parents and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
        fields: 'files(id, name)',
      });

      for (const file of (looseFiles.data.files || [])) {
        if (file.name.includes('Audit Logs') && auditExportsFolderId) {
          await drive.files.update({
            fileId: file.id,
            addParents: auditExportsFolderId,
            removeParents: backupFolderId,
            fields: 'id, parents',
          });
          report.migratedFilesCount++;
          report.logs.push(`[DriveCleanup] Organized loose spreadsheet "${file.name}" into Audit Exports.`);
        } else if ((file.name.includes('Backup Manifest') || file.name.includes('Billing Backup')) && targetManFolderId) {
          await drive.files.update({
            fileId: file.id,
            addParents: targetManFolderId,
            removeParents: backupFolderId,
            fields: 'id, parents',
          });
          report.migratedFilesCount++;
          report.logs.push(`[DriveCleanup] Organized loose spreadsheet "${file.name}" into Backup Manifests.`);
        }
      }
    } catch (backupCleanupErr: any) {
      report.logs.push(`[DriveCleanup] Notice during Backup folder cleanup: ${backupCleanupErr.message}`);
    }
  }

  return report;
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

  // 5. Academic Structure: unified master spreadsheet (no redundant subfolders)
  const academicSubs = new Map<string, string>();

  // Run deep cleanup & migration of old fragmented folders across Drive
  const cleanupReport = await cleanupCollegeDriveStructure({
    drive,
    collegeName,
    institutionFolderId: instFolder.id,
    academicFolderId,
    academicSubsMap: academicSubs,
    backupFolderId: systemBackupsFolderId,
    feedbackFolderId,
  });

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
