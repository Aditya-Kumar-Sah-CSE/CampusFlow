-- ====================================================================
-- FMS MULTI-TENANT PLATFORM
-- MIGRATION: 20260930000002_landing_page_modules_toggles.sql
-- PURPOSE: Independent Feedbacks and Events toggles for public landing page
-- ====================================================================

-- 1. Add show_feedbacks and show_events columns to public.colleges
ALTER TABLE public.colleges 
ADD COLUMN IF NOT EXISTS show_feedbacks BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS show_events BOOLEAN NOT NULL DEFAULT true;

-- 2. Ensure existing records have them set to true
UPDATE public.colleges 
SET 
  show_feedbacks = COALESCE(show_feedbacks, true),
  show_events = COALESCE(show_events, true)
WHERE show_feedbacks IS NULL OR show_events IS NULL;

-- 3. Notify PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';
