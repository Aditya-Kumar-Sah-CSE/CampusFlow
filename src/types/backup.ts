export type BackupStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'NEVER_RUN';
export type BackupVerificationStatus = 'UNVERIFIED' | 'VERIFIED' | 'MISMATCH' | 'FAILED';

export interface InstitutionBackupRecord {
  id: string;
  college_id: string;
  status: BackupStatus;
  backup_version: string;
  drive_root_folder_id?: string | null;
  drive_institution_folder_id?: string | null;
  drive_academic_folder_id?: string | null;
  drive_academic_sheet_id?: string | null;
  drive_academic_sheet_url?: string | null;
  drive_manifest_sheet_id?: string | null;
  drive_snapshot_file_id?: string | null;
  records_exported: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  table_counts: Record<string, number>;
  verification_status: BackupVerificationStatus;
  verification_details: Record<string, any>;
  error_message?: string | null;
  started_at: string;
  completed_at?: string | null;
  triggered_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CollegeBackupState {
  college_id: string;
  last_backup_id?: string | null;
  last_backup_at?: string | null;
  last_successful_backup_at?: string | null;
  last_backup_status: BackupStatus;
  last_verification_status: BackupVerificationStatus;
  total_records_backed_up: number;
  last_error?: string | null;
  drive_root_folder_id?: string | null;
  drive_institution_folder_id?: string | null;
  drive_academic_folder_id?: string | null;
  drive_academic_sheet_id?: string | null;
  drive_academic_sheet_url?: string | null;
  drive_feedback_folder_id?: string | null;
  drive_events_folder_id?: string | null;
  drive_billing_folder_id?: string | null;
  drive_system_folder_id?: string | null;
  drive_backup_folder_id?: string | null;
  drive_snapshots_folder_id?: string | null;
  drive_manifests_folder_id?: string | null;
  drive_recovery_folder_id?: string | null;
  created_at?: string;
  updated_at: string;
}

export interface BackupExecutionResult {
  success: boolean;
  backupId?: string;
  status: BackupStatus;
  verificationStatus: BackupVerificationStatus;
  recordsExported: number;
  recordsCreated: number;
  recordsUpdated: number;
  tableCounts: Record<string, number>;
  driveUrls: {
    institutionFolder?: string;
    academicSheet?: string;
    feedbackSheet?: string;
    eventsSheet?: string;
    manifestSheet?: string;
  };
  durationMs: number;
  error?: string;
}

export interface BackupVerificationResult {
  isVerified: boolean;
  status: BackupVerificationStatus;
  errors: string[];
  details: Record<
    string,
    {
      supabaseCount: number;
      driveCount: number;
      match: boolean;
      missingIds?: string[];
    }
  >;
}
