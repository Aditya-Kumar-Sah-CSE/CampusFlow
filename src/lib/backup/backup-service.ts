import { createAdminClient } from '@/lib/supabase/admin';
import { executeWithCollegeGoogleOAuthRetry, isCollegeGoogleConfigured } from '@/lib/google/auth';
import { ensureCollegeDriveHierarchy } from './drive-hierarchy';
import { backupAcademicStructure } from './academic-backup';
import { backupFeedbackForms } from './feedback-backup';
import { backupEventsData } from './events-backup';
import { backupBillingAndSystemData } from './billing-system-backup';
import { createBackupManifestAndSnapshot } from './backup-manifest';
import { verifyCollegeBackup } from './backup-verification';
import { BackupLock } from '@/lib/google/backup/backup-lock';
import type { BackupExecutionResult, BackupVerificationResult, CollegeBackupState } from '@/types/backup';

/**
 * Executes a transient-safe exponential backoff retry for Google API operations.
 */
async function withTransientRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelayMs = 1500): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const status = err?.status || err?.response?.status;
      const isTransient =
        status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        err?.code === 'ETIMEDOUT' ||
        err?.code === 'ECONNRESET';

      if (attempt >= maxRetries || !isTransient) {
        throw err;
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500;
      console.warn(`[BackupService] Transient error (status ${status}). Retrying attempt ${attempt}/${maxRetries} after ${delay.toFixed(0)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Retrieves the current persistent backup state for a college.
 */
export async function getCollegeBackupState(collegeId: string): Promise<CollegeBackupState | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('college_backup_states')
      .select('*')
      .eq('college_id', collegeId)
      .maybeSingle();

    if (error && (error.code === '42P01' || error.message.includes('does not exist'))) {
      return null;
    }

    return (data as CollegeBackupState) || null;
  } catch {
    return null;
  }
}

/**
 * Main production-safe backup orchestrator.
 * Connects live Supabase database with Google Drive & Sheets.
 * Strictly non-destructive. Supabase remains the primary source of truth.
 */
export async function executeCollegeBackup(
  collegeId: string,
  actorUserId?: string
): Promise<BackupExecutionResult> {
  const startTime = Date.now();
  const startedAtIso = new Date().toISOString();

  const supabase = createAdminClient();
  if (!supabase) {
    throw new Error('Supabase client unavailable for backup service.');
  }

  // 1. Verify College Existence
  const { data: college, error: collegeErr } = await supabase
    .from('colleges')
    .select('id, name, code, slug')
    .eq('id', collegeId)
    .single();

  if (collegeErr || !college) {
    throw new Error(`College [${collegeId}] not found.`);
  }

  const backupRecordId = crypto.randomUUID();

  // Concurrency safety: acquire lock
  if (!BackupLock.acquire(collegeId, backupRecordId)) {
    return {
      success: false,
      status: 'IN_PROGRESS',
      verificationStatus: 'UNVERIFIED',
      recordsExported: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      tableCounts: {},
      driveUrls: {},
      durationMs: 0,
      error: 'A backup is currently in progress for this institution. Please wait for it to complete.',
    };
  }

  try {
    return await runBackupWithLock(supabase, college, collegeId, backupRecordId, startedAtIso, startTime, actorUserId);
  } finally {
    BackupLock.release(collegeId, backupRecordId);
  }
}

async function runBackupWithLock(
  supabase: any,
  college: any,
  collegeId: string,
  backupRecordId: string,
  startedAtIso: string,
  startTime: number,
  actorUserId?: string
): Promise<BackupExecutionResult> {
  // 2. Verify Google Workspace Connection
  const isConnected = await isCollegeGoogleConfigured(collegeId);
  if (!isConnected) {
    return {
      success: false,
      status: 'FAILED',
      verificationStatus: 'FAILED',
      recordsExported: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      tableCounts: {},
      driveUrls: {},
      durationMs: Date.now() - startTime,
      error: 'Google Workspace is not connected for this institution. Please connect in Settings to enable Drive backups.',
    };
  }

  // 3. Retrieve Existing State (for Folder ID caching)
  const existingState = await getCollegeBackupState(collegeId);

  // 4. Create in-progress backup record (fail-soft if table pending migration)
  try {
    const { data: insertedRec } = await supabase
      .from('institution_backups')
      .insert({
        id: backupRecordId,
        college_id: collegeId,
        status: 'IN_PROGRESS',
        backup_version: '1.0',
        started_at: startedAtIso,
        triggered_by: actorUserId || null,
      })
      .select('id')
      .maybeSingle();

    if (insertedRec?.id) {
      backupRecordId = insertedRec.id;
    }

    // Write audit log
    await supabase.from('audit_logs').insert({
      college_id: collegeId,
      actor_user_id: actorUserId || null,
      action: 'BACKUP_STARTED',
      entity_type: 'institution_backups',
      entity_id: backupRecordId,
      details: `Google Drive backup started for ${college.name}`,
    });
  } catch (dbErr) {
    console.warn('[BackupService] Notice logging backup start to DB:', dbErr);
  }

  try {
    // 5. Execute Backup with OAuth Client
    const backupResult = await executeWithCollegeGoogleOAuthRetry(collegeId, async ({ drive, sheets }) => {
      return await withTransientRetry(async () => {
        // Step A: Ensure Drive Directory Hierarchy
        console.log('[BackupService] Step A: Ensuring Drive directory hierarchy...');
        const hierarchy = await ensureCollegeDriveHierarchy(drive, college.name, existingState);
        console.log('[BackupService] Drive hierarchy ready:', hierarchy.institutionFolderUrl);

        // Step B: Backup Academic Structure
        console.log('[BackupService] Step B: Backing up academic structure...');
        const academicRes = await backupAcademicStructure({
          supabase,
          drive,
          sheets,
          collegeId,
          academicFolderId: hierarchy.academicFolderId,
        });
        console.log('[BackupService] Academic structure backed up:', academicRes.spreadsheetUrl);

        // Step C: Backup Feedback Forms
        console.log('[BackupService] Step C: Backing up feedback forms...');
        const feedbackRes = await backupFeedbackForms({
          supabase,
          drive,
          sheets,
          collegeId,
          feedbackFolderId: hierarchy.feedbackFolderId,
        });
        console.log('[BackupService] Feedback forms backed up:', feedbackRes.spreadsheetUrl);

        // Step D: Backup Events
        console.log('[BackupService] Step D: Backing up events...');
        const eventsRes = await backupEventsData({
          supabase,
          drive,
          sheets,
          collegeId,
          eventsFolderId: hierarchy.eventsFolderId,
        });
        console.log('[BackupService] Events backed up:', eventsRes.spreadsheetUrl);

        // Step E: Backup Billing and System
        console.log('[BackupService] Step E: Backing up billing and system data...');
        const billingRes = await backupBillingAndSystemData({
          supabase,
          drive,
          sheets,
          collegeId,
          billingFolderId: hierarchy.billingFolderId,
          systemFolderId: hierarchy.systemFolderId,
        });
        console.log('[BackupService] Billing & system backed up.');

        // Combine counts & metrics
        const tableCounts: Record<string, number> = {
          colleges: academicRes.counts.colleges,
          academic_years: academicRes.counts.academicYears,
          branches: academicRes.counts.branches,
          semesters: academicRes.counts.semesters,
          faculties: academicRes.counts.faculties,
          subjects: academicRes.counts.subjects,
          faculty_subject_assignments: academicRes.counts.assignments,
          feedback_forms: feedbackRes.counts.feedbackForms,
          feedback_form_items: feedbackRes.counts.feedbackFormItems,
          feedback_response_records: feedbackRes.counts.feedbackResponseRecords,
          events: eventsRes.counts.events,
          event_categories: eventsRes.counts.categories,
          event_programs: eventsRes.counts.programs,
          event_registrations: eventsRes.counts.eventRegistrations,
          program_registrations: eventsRes.counts.programRegistrations,
          program_registration_members: eventsRes.counts.teamMembers,
          event_team_invitations: eventsRes.counts.teamInvitations,
          team_join_requests: eventsRes.counts.teamJoinRequests,
          college_billing_accounts: billingRes.counts.billingAccounts,
          college_payment_requests: billingRes.counts.paymentRequests,
          college_trial_entitlements: billingRes.counts.trialEntitlements,
          audit_logs: billingRes.counts.auditLogs,
        };

        const totalExported =
          academicRes.stats.recordsExported +
          feedbackRes.stats.recordsExported +
          eventsRes.stats.recordsExported +
          billingRes.stats.recordsExported;

        const totalCreated =
          academicRes.stats.recordsCreated +
          feedbackRes.stats.recordsCreated +
          eventsRes.stats.recordsCreated +
          billingRes.stats.recordsCreated;

        const totalUpdated =
          academicRes.stats.recordsUpdated +
          feedbackRes.stats.recordsUpdated +
          eventsRes.stats.recordsUpdated +
          billingRes.stats.recordsUpdated;

        // Step F: Create Manifest & JSON Snapshot
        const completedAtIso = new Date().toISOString();
        const manifestRes = await createBackupManifestAndSnapshot({
          drive,
          sheets,
          college,
          manifestFolderId: hierarchy.manifestsFolderId,
          snapshotsFolderId: hierarchy.snapshotsFolderId,
          backupId: backupRecordId,
          backupVersion: '1.0',
          startedAt: startedAtIso,
          completedAt: completedAtIso,
          status: 'SUCCESS',
          tableCounts,
          totalExported,
          totalCreated,
          totalUpdated,
        });

        // Step G: Deep Verification of Academic Data (BCE 32 faculties, 45 subjects)
        const verification = await verifyCollegeBackup({
          supabase,
          sheets,
          collegeId,
          academicSpreadsheetId: academicRes.spreadsheetId,
        });

        return {
          hierarchy,
          academicRes,
          feedbackRes,
          eventsRes,
          billingRes,
          manifestRes,
          verification,
          tableCounts,
          totalExported,
          totalCreated,
          totalUpdated,
          completedAtIso,
        };
      });
    });

    const durationMs = Date.now() - startTime;
    const finalStatus = backupResult.verification.isVerified ? 'SUCCESS' : 'PARTIAL';

    // 6. Update Database Records
    try {
      await supabase
        .from('institution_backups')
        .update({
          status: finalStatus,
          drive_root_folder_id: backupResult.hierarchy.rootFolderId,
          drive_institution_folder_id: backupResult.hierarchy.institutionFolderId,
          drive_academic_folder_id: backupResult.hierarchy.academicFolderId,
          drive_academic_sheet_id: backupResult.academicRes.spreadsheetId,
          drive_academic_sheet_url: backupResult.academicRes.spreadsheetUrl,
          drive_manifest_sheet_id: backupResult.manifestRes.manifestSpreadsheetId,
          drive_snapshot_file_id: backupResult.manifestRes.snapshotFileId || null,
          records_exported: backupResult.totalExported,
          records_created: backupResult.totalCreated,
          records_updated: backupResult.totalUpdated,
          table_counts: backupResult.tableCounts,
          verification_status: backupResult.verification.status,
          verification_details: backupResult.verification.details,
          completed_at: backupResult.completedAtIso,
          updated_at: new Date().toISOString(),
        })
        .eq('id', backupRecordId);

      // Update college persistent backup state
      await supabase.from('college_backup_states').upsert({
        college_id: collegeId,
        last_backup_id: backupRecordId,
        last_backup_at: backupResult.completedAtIso,
        last_successful_backup_at: finalStatus === 'SUCCESS' ? backupResult.completedAtIso : existingState?.last_successful_backup_at || null,
        last_backup_status: finalStatus,
        last_verification_status: backupResult.verification.status,
        total_records_backed_up: backupResult.totalExported,
        last_error: backupResult.verification.errors.join('; ') || null,
        drive_root_folder_id: backupResult.hierarchy.rootFolderId,
        drive_institution_folder_id: backupResult.hierarchy.institutionFolderId,
        drive_academic_folder_id: backupResult.hierarchy.academicFolderId,
        drive_academic_sheet_id: backupResult.academicRes.spreadsheetId,
        drive_academic_sheet_url: backupResult.academicRes.spreadsheetUrl,
        drive_feedback_folder_id: backupResult.hierarchy.feedbackFolderId,
        drive_events_folder_id: backupResult.hierarchy.eventsFolderId,
        drive_billing_folder_id: backupResult.hierarchy.billingFolderId,
        drive_system_folder_id: backupResult.hierarchy.systemFolderId,
        drive_backup_folder_id: backupResult.hierarchy.backupFolderId,
        drive_snapshots_folder_id: backupResult.hierarchy.snapshotsFolderId,
        drive_manifests_folder_id: backupResult.hierarchy.manifestsFolderId,
        drive_recovery_folder_id: backupResult.hierarchy.recoveryFolderId,
        updated_at: new Date().toISOString(),
      });

      // Write audit log
      await supabase.from('audit_logs').insert({
        college_id: collegeId,
        actor_user_id: actorUserId || null,
        action: 'BACKUP_COMPLETED',
        entity_type: 'institution_backups',
        entity_id: backupRecordId,
        details: `Google Drive backup completed (${finalStatus}). ${backupResult.totalExported} records processed. Verification: ${backupResult.verification.status}.`,
        metadata: {
          durationMs,
          tableCounts: backupResult.tableCounts,
        },
      });
    } catch (dbErr) {
      console.warn('[BackupService] Notice updating DB backup states:', dbErr);
    }

    return {
      success: true,
      backupId: backupRecordId,
      status: finalStatus,
      verificationStatus: backupResult.verification.status,
      recordsExported: backupResult.totalExported,
      recordsCreated: backupResult.totalCreated,
      recordsUpdated: backupResult.totalUpdated,
      recordsMissing: backupResult.verification.totalMissing,
      recordsDuplicate: backupResult.verification.totalDuplicates,
      tableCounts: backupResult.tableCounts,
      driveUrls: {
        institutionFolder: backupResult.hierarchy.institutionFolderUrl,
        academicSheet: backupResult.academicRes.spreadsheetUrl,
        feedbackSheet: backupResult.feedbackRes.spreadsheetUrl,
        eventsSheet: backupResult.eventsRes.spreadsheetUrl,
        manifestSheet: backupResult.manifestRes.manifestSpreadsheetUrl,
      },
      durationMs,
      error: backupResult.verification.errors.length > 0 ? backupResult.verification.errors.join('; ') : undefined,
      verification: backupResult.verification,
      cleanupReport: backupResult.hierarchy.cleanupReport,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const errMsg = err?.message || String(err);
    console.error(`[BackupService] Backup failed for college [${collegeId}]:`, errMsg);

    // Record failure in DB
    try {
      await supabase
        .from('institution_backups')
        .update({
          status: 'FAILED',
          error_message: errMsg,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', backupRecordId);

      await supabase.from('college_backup_states').upsert({
        college_id: collegeId,
        last_backup_id: backupRecordId,
        last_backup_at: new Date().toISOString(),
        last_backup_status: 'FAILED',
        last_error: errMsg,
        updated_at: new Date().toISOString(),
      });

      await supabase.from('audit_logs').insert({
        college_id: collegeId,
        actor_user_id: actorUserId || null,
        action: 'BACKUP_FAILED',
        entity_type: 'institution_backups',
        entity_id: backupRecordId,
        details: `Backup execution failed: ${errMsg}`,
      });
    } catch {
      // Ignore DB error logging failure
    }

    return {
      success: false,
      backupId: backupRecordId,
      status: 'FAILED',
      verificationStatus: 'FAILED',
      recordsExported: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      tableCounts: {},
      driveUrls: {},
      durationMs,
      error: errMsg,
    };
  }
}

/**
 * Verifies an existing backup for a college without re-exporting.
 */
export async function verifyExistingCollegeBackup(collegeId: string): Promise<BackupVerificationResult> {
  const supabase = createAdminClient();
  if (!supabase) {
    return {
      isVerified: false,
      status: 'FAILED',
      errors: ['Supabase admin client unavailable.'],
      totalSupabase: 0,
      totalDrive: 0,
      totalMissing: 0,
      totalDuplicates: 0,
      totalUnexpected: 0,
      details: {},
    };
  }

  const state = await getCollegeBackupState(collegeId);
  if (!state || !state.drive_academic_sheet_id) {
    return {
      isVerified: false,
      status: 'FAILED',
      errors: ['No existing backup spreadsheet found. Please run "Backup Now" first.'],
      totalSupabase: 0,
      totalDrive: 0,
      totalMissing: 0,
      totalDuplicates: 0,
      totalUnexpected: 0,
      details: {},
    };
  }

  return executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
    return verifyCollegeBackup({
      supabase,
      sheets,
      collegeId,
      academicSpreadsheetId: state.drive_academic_sheet_id!,
    });
  });
}

export const runCollegeBackup = executeCollegeBackup;
