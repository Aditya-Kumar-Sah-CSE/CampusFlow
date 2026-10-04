-- ====================================================================
-- FMS MULTI-TENANT PLATFORM
-- MIGRATION: 20261004000002_small_events_google_registration.sql
-- PURPOSE: Adds metadata columns for automatic Google Form & Drive resources
--          for Small/Cultural Events.
--          IMPORTANT: Zero participant registration responses are stored
--          in Supabase. Google Sheets is the sole source of truth.
-- ====================================================================

-- 1. Add Google resource metadata columns to events table
ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS registration_type TEXT NOT NULL DEFAULT 'internal',
    ADD COLUMN IF NOT EXISTS registration_deadline TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS registration_label TEXT NOT NULL DEFAULT 'Register Now',
    ADD COLUMN IF NOT EXISTS google_form_id TEXT,
    ADD COLUMN IF NOT EXISTS google_form_url TEXT,
    ADD COLUMN IF NOT EXISTS google_spreadsheet_id TEXT,
    ADD COLUMN IF NOT EXISTS google_spreadsheet_url TEXT,
    ADD COLUMN IF NOT EXISTS google_drive_folder_id TEXT,
    ADD COLUMN IF NOT EXISTS google_drive_folder_url TEXT,
    ADD COLUMN IF NOT EXISTS google_registration_status TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    ADD COLUMN IF NOT EXISTS google_registration_error TEXT,
    ADD COLUMN IF NOT EXISTS google_resources_created_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS google_resources_updated_at TIMESTAMPTZ;

-- 2. Add validation constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'events_registration_type_check'
    ) THEN
        ALTER TABLE public.events ADD CONSTRAINT events_registration_type_check
            CHECK (registration_type IN ('none', 'google_form', 'internal'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'events_google_registration_status_check'
    ) THEN
        ALTER TABLE public.events ADD CONSTRAINT events_google_registration_status_check
            CHECK (google_registration_status IN ('NOT_CONFIGURED', 'PENDING', 'READY', 'ERROR'));
    END IF;
END $$;

-- 3. Document columns
COMMENT ON COLUMN public.events.google_form_id IS 'Google Form ID automatically created for this event';
COMMENT ON COLUMN public.events.google_form_url IS 'Public responder URL for the Google Form';
COMMENT ON COLUMN public.events.google_spreadsheet_id IS 'Google Spreadsheet ID destination where responses are saved';
COMMENT ON COLUMN public.events.google_spreadsheet_url IS 'Google Spreadsheet web URL for responses';
COMMENT ON COLUMN public.events.google_drive_folder_id IS 'Dedicated Google Drive folder ID for event assets';
COMMENT ON COLUMN public.events.google_drive_folder_url IS 'Web URL to the Google Drive folder';
COMMENT ON COLUMN public.events.google_registration_status IS 'State of Google resources: NOT_CONFIGURED, PENDING, READY, ERROR';

-- 4. PostgREST reload
NOTIFY pgrst, 'reload schema';
