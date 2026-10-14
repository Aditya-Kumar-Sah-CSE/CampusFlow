-- Library Management Module: Settings Table
-- Minimal Supabase usage — only stores admin-controlled configuration + Google Sheet references.
-- All book inventory and borrow log data lives in Google Sheets.

CREATE TABLE IF NOT EXISTS public.library_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  
  -- Admin-controlled settings (NOT hard-coded)
  max_books_per_student INTEGER NOT NULL DEFAULT 3,
  max_borrow_days INTEGER NOT NULL DEFAULT 15,
  fine_per_day NUMERIC(10, 2) NOT NULL DEFAULT 5.00,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  
  -- Google Sheet references
  books_sheet_id TEXT,
  borrow_log_sheet_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT library_settings_college_unique UNIQUE (college_id)
);

-- Index for fast tenant lookup
CREATE INDEX IF NOT EXISTS idx_library_settings_college ON public.library_settings(college_id);

-- Enable RLS
ALTER TABLE public.library_settings ENABLE ROW LEVEL SECURITY;

-- RLS: Service role has full access (used by server-side API)
CREATE POLICY "service_role_full_access_library_settings"
  ON public.library_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS: Authenticated admins can read their college's settings
CREATE POLICY "admins_read_own_college_library_settings"
  ON public.library_settings
  FOR SELECT
  TO authenticated
  USING (
    college_id IN (
      SELECT ac.college_id FROM public.admin_colleges ac
      JOIN public.admins a ON a.id = ac.admin_id
      WHERE a.user_id = auth.uid()
        AND ac.status = 'ACTIVE'
    )
  );

COMMENT ON TABLE public.library_settings IS 'Admin-controlled library configuration per college. Data storage in Google Sheets.';
