import type { CollegeBackupState, InstitutionBackupRecord, BackupExecutionResult, BackupVerificationResult } from '@/types/backup';

export type {
  CollegeBackupState,
  InstitutionBackupRecord,
  BackupExecutionResult,
  BackupVerificationResult,
};

export interface BackupLockState {
  collegeId: string;
  lockedAt: number;
  backupId: string;
}

export interface CollegeBackupConfig {
  collegeId: string;
  collegeName: string;
  collegeSlug: string;
  collegeCode: string;
}

export interface ManifestEntry {
  collegeId: string;
  collegeName: string;
  backupId: string;
  backupDate: string;
  table: string;
  rowsExported: number;
  rowsUpdated: number;
  rowsAdded: number;
  rowsMarkedDeleted: number;
  status: string;
  durationMs: number;
  error?: string;
}
