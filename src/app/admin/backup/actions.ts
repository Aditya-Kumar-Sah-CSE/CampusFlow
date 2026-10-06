'use server';

import { getAdminSession, resolveAuthorizedCollegeId } from '@/lib/auth/admin-auth';
import { executeCollegeBackup, verifyExistingCollegeBackup, getCollegeBackupState } from '@/lib/backup/backup-service';
import { isCollegeGoogleConfigured, getCollegeGoogleConnectionMetadata } from '@/lib/google/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import type { BackupExecutionResult, BackupVerificationResult, CollegeBackupState } from '@/types/backup';

export interface LiveCollegeEntityCounts {
  faculties: number;
  subjects: number;
  branches: number;
  semesters: number;
  academicYears: number;
  assignments: number;
  feedbackForms: number;
  events: number;
}

export interface CollegeBackupStateResponse {
  success: boolean;
  error?: string;
  collegeId: string;
  collegeName?: string;
  state: CollegeBackupState | null;
  googleConnected: boolean;
  googleAccountEmail?: string | null;
  canManageBackup: boolean;
  liveCounts?: LiveCollegeEntityCounts;
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

  const supabase = createAdminClient();

  const [state, googleConnected, googleMeta, liveCountsRes] = await Promise.all([
    getCollegeBackupState(authorizedCollegeId),
    isCollegeGoogleConfigured(authorizedCollegeId),
    getCollegeGoogleConnectionMetadata(authorizedCollegeId),
    (async (): Promise<LiveCollegeEntityCounts> => {
      if (!supabase) {
        return {
          faculties: 0,
          subjects: 0,
          branches: 0,
          semesters: 0,
          academicYears: 0,
          assignments: 0,
          feedbackForms: 0,
          events: 0,
        };
      }
      const [
        { count: facCount },
        { count: subCount },
        { count: brCount },
        { count: semCount },
        { count: yrCount },
        { count: asgCount },
        { count: fbCount },
        { count: evCount },
      ] = await Promise.all([
        supabase.from('faculties').select('*', { count: 'exact', head: true }).eq('college_id', authorizedCollegeId),
        supabase.from('subjects').select('*', { count: 'exact', head: true }).eq('college_id', authorizedCollegeId),
        supabase.from('branches').select('*', { count: 'exact', head: true }).eq('college_id', authorizedCollegeId),
        supabase.from('semesters').select('*', { count: 'exact', head: true }).eq('college_id', authorizedCollegeId),
        supabase.from('academic_years').select('*', { count: 'exact', head: true }).eq('college_id', authorizedCollegeId),
        supabase.from('faculty_subject_assignments').select('*', { count: 'exact', head: true }).eq('college_id', authorizedCollegeId),
        supabase.from('feedback_forms').select('*', { count: 'exact', head: true }).eq('college_id', authorizedCollegeId),
        supabase.from('events').select('*', { count: 'exact', head: true }).eq('college_id', authorizedCollegeId),
      ]);
      return {
        faculties: facCount || 0,
        subjects: subCount || 0,
        branches: brCount || 0,
        semesters: semCount || 0,
        academicYears: yrCount || 0,
        assignments: asgCount || 0,
        feedbackForms: fbCount || 0,
        events: evCount || 0,
      };
    })(),
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
    liveCounts: liveCountsRes,
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
      totalSupabase: 0,
      totalDrive: 0,
      totalMissing: 0,
      totalDuplicates: 0,
      totalUnexpected: 0,
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
      totalSupabase: 0,
      totalDrive: 0,
      totalMissing: 0,
      totalDuplicates: 0,
      totalUnexpected: 0,
      details: {},
    };
  }

  return verifyExistingCollegeBackup(authorizedCollegeId);
}
