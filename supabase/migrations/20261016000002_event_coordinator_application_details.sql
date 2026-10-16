-- ====================================================================
-- CAMPUSFLOW MULTI-TENANT PLATFORM
-- MIGRATION: 20261016000002_event_coordinator_application_details.sql
-- PURPOSE: Add student application details (mobile, reg no, roll no,
--          semester, academic session, branch, and event description)
--          to college_admin_requests for student leadership onboarding.
-- SAFETY: Fully idempotent and backward-compatible.
-- ====================================================================

ALTER TABLE public.college_admin_requests
    ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100),
    ADD COLUMN IF NOT EXISTS roll_number VARCHAR(100),
    ADD COLUMN IF NOT EXISTS semester VARCHAR(50),
    ADD COLUMN IF NOT EXISTS academic_session VARCHAR(50),
    ADD COLUMN IF NOT EXISTS branch VARCHAR(100),
    ADD COLUMN IF NOT EXISTS event_description TEXT,
    ADD COLUMN IF NOT EXISTS application_details JSONB;

-- Index for quick lookups on registration number and phone across admin requests
CREATE INDEX IF NOT EXISTS idx_college_admin_requests_reg_no 
    ON public.college_admin_requests(college_id, registration_number) 
    WHERE registration_number IS NOT NULL;
