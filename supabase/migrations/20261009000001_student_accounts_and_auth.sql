-- ====================================================================
-- CAMPUSFLOW MULTI-TENANT PLATFORM
-- MIGRATION: 20261009000001_student_accounts_and_auth.sql
-- PURPOSE: Production-ready Student Authentication & Profiles Schema
--          with College association, Row Level Security, and safe policies.
-- SAFETY: Idempotent. Fully non-destructive to existing admin tables.
-- ====================================================================

-- 1. STUDENTS TABLE (TENANT-SCOPED STUDENT PROFILE & MEMBERSHIP)
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE RESTRICT,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    registration_number VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for ultra-fast lookup, tenant isolation, and normalization
CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_college_id ON public.students(college_id);
CREATE INDEX IF NOT EXISTS idx_students_email ON public.students(LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_college_email ON public.students(college_id, LOWER(email));

-- ====================================================================
-- 2. STABLE SECURITY-DEFINER HELPER FUNCTIONS FOR STUDENTS
-- ====================================================================

-- Function 2.1: Check if an authenticated user is a verified student
CREATE OR REPLACE FUNCTION public.is_student(auth_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth_user_id IS NULL THEN 
    RETURN false; 
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.students
    WHERE user_id = auth_user_id 
      AND is_active = true
  );
END;
$$;

-- Function 2.2: Get the enrolled college ID of a student
CREATE OR REPLACE FUNCTION public.get_student_college_id(auth_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_college_id UUID;
BEGIN
  IF auth_user_id IS NULL THEN 
    RETURN NULL; 
  END IF;

  SELECT college_id INTO v_college_id
  FROM public.students
  WHERE user_id = auth_user_id
    AND is_active = true
  LIMIT 1;

  RETURN v_college_id;
END;
$$;

-- ====================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES ON STUDENTS TABLE
-- ====================================================================

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- 3.1 Student can read their own profile
DROP POLICY IF EXISTS "Students view own profile" ON public.students;
CREATE POLICY "Students view own profile" ON public.students
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- 3.2 Student can update their own profile (name, registration number)
DROP POLICY IF EXISTS "Students update own profile" ON public.students;
CREATE POLICY "Students update own profile" ON public.students
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 3.3 College Admins can view enrolled students of their institution
DROP POLICY IF EXISTS "College Admins view students" ON public.students;
CREATE POLICY "College Admins view students" ON public.students
    FOR SELECT TO authenticated
    USING (public.is_college_admin(auth.uid(), college_id));

-- 3.4 Platform Super Admins have full access to manage students
DROP POLICY IF EXISTS "Super Admins manage students" ON public.students;
CREATE POLICY "Super Admins manage students" ON public.students
    FOR ALL TO authenticated
    USING (public.is_platform_super_admin(auth.uid()))
    WITH CHECK (public.is_platform_super_admin(auth.uid()));

-- ====================================================================
-- 4. FEEDBACK RESPONSE RECORDS ACCESS FOR STUDENTS
-- ====================================================================
-- Allow authenticated students to view exclusively their own submission receipts
DROP POLICY IF EXISTS "Students view own response records" ON public.feedback_response_records;
CREATE POLICY "Students view own response records" ON public.feedback_response_records
    FOR SELECT TO authenticated
    USING (
        LOWER(student_email) = LOWER(auth.jwt() ->> 'email')
    );

-- ====================================================================
-- 5. EXPLICIT GRANTS
-- ====================================================================
GRANT SELECT, UPDATE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
