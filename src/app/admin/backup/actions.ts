'use server';

import { getAdminSession, resolveAuthorizedCollegeId } from '@/lib/auth/admin-auth';
import { executeCollegeBackup, verifyExistingCollegeBackup, getCollegeBackupState } from '@/lib/backup/backup-service';
import { isCollegeGoogleConfigured, getCollegeGoogleConnectionMetadata } from '@/lib/google/auth';
import type { BackupExecutionResult, BackupVerificationResult, CollegeBackupState } from '@/types/backup';

export interface CollegeBackupStateResponse {
  success: boolean;
  error?: string;
  collegeId: string;
  collegeName?: string;
  state: CollegeBackupState | null;
  googleConnected: boolean;
  googleAccountEmail?: string | null;
  canManageBackup: boolean;
}

/**
 * Retrieves persistent backup state and Google Drive connection status for an authorized college.
 */
export async function getCollegeBackupStateAction(
  targetCollegeId?: string
): Promise<CollegeBackupStateResponse> {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return {
      success: false,
      error: 'Unauthorized.',
      collegeId: '',
      state: null,
      googleConnected: false,
      canManageBackup: false,
    };
  }

  let authorizedCollegeId: string;
  try {
    authorizedCollegeId = await resolveAuthorizedCollegeId(session, targetCollegeId);
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Unable to resolve institution context.',
      collegeId: '',
      state: null,
      googleConnected: false,
      canManageBackup: false,
    };
  }

  const [state, googleConnected, googleMeta] = await Promise.all([
    getCollegeBackupState(authorizedCollegeId),
    isCollegeGoogleConfigured(authorizedCollegeId),
    getCollegeGoogleConnectionMetadata(authorizedCollegeId),
  ]);

  const canManageBackup =
    session.isPlatformSuperAdmin ||
    session.colleges.some(
      (c) => c.collegeId === authorizedCollegeId && c.status === 'ACTIVE'
    );

  return {
    success: true,
    collegeId: authorizedCollegeId,
    state,
    googleConnected,
    googleAccountEmail: googleMeta?.accountEmail || null,
    canManageBackup,
  };
}

/**
 * Triggers a full, non-destructive, production-safe Google Drive backup for the authorized college.
 */
export async function runCollegeBackupAction(
  targetCollegeId?: string
): Promise<BackupExecutionResult> {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return {
      success: false,
      status: 'FAILED',
      verificationStatus: 'FAILED',
      recordsExported: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      tableCounts: {},
      driveUrls: {},
      durationMs: 0,
      error: 'Unauthorized. Administrator credentials required.',
    };
  }

  let authorizedCollegeId: string;
  try {
    authorizedCollegeId = await resolveAuthorizedCollegeId(session, targetCollegeId);
  } catch (err: any) {
    return {
      success: false,
      status: 'FAILED',
      verificationStatus: 'FAILED',
      recordsExported: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      tableCounts: {},
      driveUrls: {},
      durationMs: 0,
      error: err.message || 'Unable to determine the active institution.',
    };
  }

  // Authorization check
  const canManageCollege =
    session.isPlatformSuperAdmin ||
    session.colleges.some(
      (c) => c.collegeId === authorizedCollegeId && c.status === 'ACTIVE'
    );

  if (!canManageCollege) {
    return {
      success: false,
      status: 'FAILED',
      verificationStatus: 'FAILED',
      recordsExported: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      tableCounts: {},
      driveUrls: {},
      durationMs: 0,
      error: 'You do not have administrative permissions to trigger backups for this institution.',
    };
  }

  return executeCollegeBackup(authorizedCollegeId, session.user?.id);
}

/**
 * Deep-verifies the live Supabase academic data against the Google Drive backup spreadsheet.
 */
export async function verifyCollegeBackupAction(
  targetCollegeId?: string
): Promise<BackupVerificationResult> {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return {
      isVerified: false,
      status: 'FAILED',
      errors: ['Unauthorized.'],
      details: {},
    };
  }

  let authorizedCollegeId: string;
  try {
    authorizedCollegeId = await resolveAuthorizedCollegeId(session, targetCollegeId);
  } catch (err: any) {
    return {
      isVerified: false,
      status: 'FAILED',
      errors: [err.message || 'Unable to determine the active institution.'],
      details: {},
    };
  }

  return verifyExistingCollegeBackup(authorizedCollegeId);
}
