-- ====================================================================
-- FMS MULTI-TENANT PLATFORM
-- MIGRATION: 20260927000001_response_exclusion_and_duplicates.sql
-- PURPOSE: Manual response exclusion, duplicate detection indexing,
--          audit tracking metadata, and RLS policies for response moderation.
-- ====================================================================

-- 1. ADD EXCLUSION & AUDIT COLUMNS TO FEEDBACK RESPONSE RECORDS
ALTER TABLE public.feedback_response_records
    ADD COLUMN IF NOT EXISTS is_excluded BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS excluded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS excluded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS exclusion_reason TEXT,
    ADD COLUMN IF NOT EXISTS included_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS included_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. CREATE PERFORMANCE INDEXES FOR MODERATION & DUPLICATE QUERIES
CREATE INDEX IF NOT EXISTS idx_response_records_is_excluded
    ON public.feedback_response_records(college_id, form_id, is_excluded);

CREATE INDEX IF NOT EXISTS idx_response_records_form_reg
    ON public.feedback_response_records(form_id, registration_number);

CREATE INDEX IF NOT EXISTS idx_response_records_form_email
    ON public.feedback_response_records(form_id, student_email);

CREATE INDEX IF NOT EXISTS idx_response_records_exclusion_audit
    ON public.feedback_response_records(college_id, is_excluded, excluded_at DESC);

-- 3. ROW LEVEL SECURITY: ADMIN UPDATE PERMISSION FOR RESPONSE RECORDS
DROP POLICY IF EXISTS "Admins update college response records" ON public.feedback_response_records;
CREATE POLICY "Admins update college response records" ON public.feedback_response_records
    FOR UPDATE TO authenticated
    USING (public.is_college_admin(auth.uid(), college_id))
    WITH CHECK (public.is_college_admin(auth.uid(), college_id));

-- Grant update privileges to authenticated admins & full access to service_role
GRANT UPDATE ON public.feedback_response_records TO authenticated;
GRANT ALL ON public.feedback_response_records TO service_role;
