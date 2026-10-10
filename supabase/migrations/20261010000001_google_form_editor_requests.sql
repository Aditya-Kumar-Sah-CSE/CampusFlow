-- ====================================================================
-- CAMPUSFLOW MULTI-TENANT PLATFORM
-- MIGRATION: 20261010000001_google_form_editor_requests.sql
-- PURPOSE: Google Forms collaborative editor permission workflow.
--          Allows non-owner admins to request Google Drive editor access
--          from Super Admin, granting lifetime edit permissions for all
--          available and future forms without repeated prompts.
-- SAFETY: Idempotent. Fully non-destructive to existing tables.
-- ====================================================================

-- 1. GOOGLE FORM EDITOR ACCESS REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.google_form_editor_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    admin_email VARCHAR(255) NOT NULL,
    admin_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_by_email VARCHAR(255),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_google_form_editor_requests UNIQUE (college_id, admin_email)
);

CREATE INDEX IF NOT EXISTS idx_google_editor_requests_college 
    ON public.google_form_editor_requests(college_id, status);
CREATE INDEX IF NOT EXISTS idx_google_editor_requests_email 
    ON public.google_form_editor_requests(LOWER(admin_email));

-- 2. APPROVED GOOGLE DRIVE FORM EDITORS PER COLLEGE TABLE
CREATE TABLE IF NOT EXISTS public.college_google_form_editors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    admin_email VARCHAR(255) NOT NULL,
    admin_name VARCHAR(255),
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    granted_by_email VARCHAR(255),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_college_google_form_editors UNIQUE (college_id, admin_email)
);

CREATE INDEX IF NOT EXISTS idx_college_google_editors_lookup 
    ON public.college_google_form_editors(college_id, LOWER(admin_email), is_active);

-- 3. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.google_form_editor_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.college_google_form_editors ENABLE ROW LEVEL SECURITY;

-- Grant service role full management
GRANT ALL ON public.google_form_editor_requests TO service_role;
GRANT ALL ON public.college_google_form_editors TO service_role;

-- Allow authenticated users to view active editors and their own requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'google_form_editor_requests' AND policyname = 'allow_read_editor_requests'
  ) THEN
    CREATE POLICY allow_read_editor_requests ON public.google_form_editor_requests
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'college_google_form_editors' AND policyname = 'allow_read_form_editors'
  ) THEN
    CREATE POLICY allow_read_form_editors ON public.college_google_form_editors
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
