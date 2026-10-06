-- ====================================================================
-- CAMPUSFLOW PRODUCTION-SAFE GOOGLE DRIVE BACKUP & PERFORMANCE OPTIMIZATION
-- MIGRATION: 20261007000001_production_safe_backup_and_performance.sql
-- PURPOSE:
--   1. Create institution_backups & college_backup_states tables for
--      structured Google Drive backups, manifests, and verification.
--   2. Add targeted composite performance indexes for high-frequency queries.
--   3. Optimize RLS helper functions (is_college_active) for zero-subquery scans.
-- SAFETY:
--   Idempotent, backward-compatible, strictly additive. Zero data loss.
-- ====================================================================

-- 1. INSTITUTION BACKUPS AUDIT & MANIFEST TABLE
CREATE TABLE IF NOT EXISTS public.institution_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'PENDING' 
        CHECK (status IN ('PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED', 'PARTIAL')),
    backup_version TEXT NOT NULL DEFAULT '1.0',
    drive_root_folder_id TEXT NULL,
    drive_institution_folder_id TEXT NULL,
    drive_academic_folder_id TEXT NULL,
    drive_academic_sheet_id TEXT NULL,
    drive_academic_sheet_url TEXT NULL,
    drive_manifest_sheet_id TEXT NULL,
    drive_snapshot_file_id TEXT NULL,
    records_exported INTEGER NOT NULL DEFAULT 0,
    records_created INTEGER NOT NULL DEFAULT 0,
    records_updated INTEGER NOT NULL DEFAULT 0,
    records_failed INTEGER NOT NULL DEFAULT 0,
    table_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED' 
        CHECK (verification_status IN ('UNVERIFIED', 'VERIFIED', 'MISMATCH', 'FAILED')),
    verification_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ NULL,
    triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. COLLEGE BACKUP STATES (CURRENT PERSISTENT POINTERS & FOLDER IDS)
CREATE TABLE IF NOT EXISTS public.college_backup_states (
    college_id UUID PRIMARY KEY REFERENCES public.colleges(id) ON DELETE CASCADE,
    last_backup_id UUID REFERENCES public.institution_backups(id) ON DELETE SET NULL,
    last_backup_at TIMESTAMPTZ NULL,
    last_successful_backup_at TIMESTAMPTZ NULL,
    last_backup_status TEXT NOT NULL DEFAULT 'NEVER_RUN'
        CHECK (last_backup_status IN ('NEVER_RUN', 'PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED', 'PARTIAL')),
    last_verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED'
        CHECK (last_verification_status IN ('UNVERIFIED', 'VERIFIED', 'MISMATCH', 'FAILED')),
    total_records_backed_up INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    drive_root_folder_id TEXT NULL,
    drive_institution_folder_id TEXT NULL,
    drive_academic_folder_id TEXT NULL,
    drive_academic_sheet_id TEXT NULL,
    drive_academic_sheet_url TEXT NULL,
    drive_feedback_folder_id TEXT NULL,
    drive_events_folder_id TEXT NULL,
    drive_billing_folder_id TEXT NULL,
    drive_system_folder_id TEXT NULL,
    drive_backup_folder_id TEXT NULL,
    drive_snapshots_folder_id TEXT NULL,
    drive_manifests_folder_id TEXT NULL,
    drive_recovery_folder_id TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for backup querying
CREATE INDEX IF NOT EXISTS idx_inst_backups_college_created 
    ON public.institution_backups(college_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inst_backups_status 
    ON public.institution_backups(college_id, status);

-- 3. ROW LEVEL SECURITY ON BACKUP TABLES
ALTER TABLE public.institution_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.college_backup_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super Admins manage all backups" ON public.institution_backups;
CREATE POLICY "Super Admins manage all backups" ON public.institution_backups
    FOR ALL TO authenticated
    USING (public.is_platform_super_admin(auth.uid()))
    WITH CHECK (public.is_platform_super_admin(auth.uid()));

DROP POLICY IF EXISTS "College Admins view own college backups" ON public.institution_backups;
CREATE POLICY "College Admins view own college backups" ON public.institution_backups
    FOR SELECT TO authenticated
    USING (public.is_college_admin(auth.uid(), college_id));

DROP POLICY IF EXISTS "Super Admins manage all backup states" ON public.college_backup_states;
CREATE POLICY "Super Admins manage all backup states" ON public.college_backup_states
    FOR ALL TO authenticated
    USING (public.is_platform_super_admin(auth.uid()))
    WITH CHECK (public.is_platform_super_admin(auth.uid()));

DROP POLICY IF EXISTS "College Admins view own backup states" ON public.college_backup_states;
CREATE POLICY "College Admins view own backup states" ON public.college_backup_states
    FOR SELECT TO authenticated
    USING (public.is_college_admin(auth.uid(), college_id));

-- 4. HIGH-PERFORMANCE COMPOSITE INDEXES
-- Optimize: WHERE college_id = $1 AND is_active = true ORDER BY name ASC
CREATE INDEX IF NOT EXISTS idx_faculties_college_active_name 
    ON public.faculties(college_id, is_active, name);

-- Optimize: WHERE college_id = $1 AND is_active = true ORDER BY code ASC
CREATE INDEX IF NOT EXISTS idx_subjects_college_active_code 
    ON public.subjects(college_id, is_active, code);

-- Optimize: WHERE college_id = $1 AND branch_id = $2 AND semester_id = $3 AND is_active = true
CREATE INDEX IF NOT EXISTS idx_subjects_college_branch_sem_active 
    ON public.subjects(college_id, branch_id, semester_id, is_active);

-- Optimize: Admin Feedback Forms ordering & discovery
CREATE INDEX IF NOT EXISTS idx_feedback_forms_college_created 
    ON public.feedback_forms(college_id, created_at DESC);

-- Optimize: Admin Events ordering & discovery
CREATE INDEX IF NOT EXISTS idx_events_college_created 
    ON public.events(college_id, created_at DESC);

-- Optimize: Event categories ordering & filtering
CREATE INDEX IF NOT EXISTS idx_event_categories_college_event_active 
    ON public.event_categories(college_id, event_id, is_active, display_order);

-- Optimize: Event programs ordering & filtering
CREATE INDEX IF NOT EXISTS idx_event_programs_college_event_active 
    ON public.event_programs(college_id, event_id, is_active, display_order);

-- Optimize: Colleges active lookup
CREATE INDEX IF NOT EXISTS idx_colleges_id_active 
    ON public.colleges(id, is_active);

-- Optimize: Feedback forms status & academic year filtering
CREATE INDEX IF NOT EXISTS idx_feedback_forms_college_status_year 
    ON public.feedback_forms(college_id, status, academic_year_id);

-- Optimize: Events date range & status queries
CREATE INDEX IF NOT EXISTS idx_events_college_status_dates 
    ON public.events(college_id, status, start_at, end_at);

-- Optimize: Event registrations student email search
CREATE INDEX IF NOT EXISTS idx_event_registrations_event_email 
    ON public.event_registrations(event_id, email);

-- 5. STABLE HELPER FUNCTION FOR ZERO-SUBQUERY COLLEGE CHECKS IN RLS
CREATE OR REPLACE FUNCTION public.is_college_active(target_college_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.colleges
    WHERE id = target_college_id AND is_active = true
  );
$$;
