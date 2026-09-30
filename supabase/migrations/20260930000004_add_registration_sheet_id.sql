-- ====================================================================
-- FMS MULTI-TENANT PLATFORM
-- MIGRATION: 20260930000004_add_registration_sheet_id.sql
-- PURPOSE: Add registration_sheet_id column to events table.
--          This column stores the Google Spreadsheet ID for the
--          event's registration data (source of truth in Google Sheets).
-- ====================================================================

ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS registration_sheet_id TEXT;

COMMENT ON COLUMN public.events.registration_sheet_id
    IS 'Google Spreadsheet ID that stores all registration data for this event. NULL means no sheet created yet.';

-- NOTIFY POSTGREST TO RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
