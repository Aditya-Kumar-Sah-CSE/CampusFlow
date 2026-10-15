-- ====================================================================
-- CAMPUSFLOW MULTI-TENANT PLATFORM
-- MIGRATION: 20261016000001_admin_roles_and_library_timing.sql
-- PURPOSE: 
--   1. Expanded Admin Roles (Primary Admin, Event Coordinator, Librarian, Feedback & Exam Coordinator)
--   2. Library Timing Schedule Control (Operating Days, Start/End Hours, Timing Enforcement)
--   3. Student Event Coordinator applications & Security Functions
-- ====================================================================

-- 1. UPDATE COLLEGE_MEMBERSHIPS ROLE CONSTRAINT
-- Drop existing check constraint and add support for granular role-based access
ALTER TABLE public.college_memberships 
    DROP CONSTRAINT IF EXISTS college_memberships_role_check;

ALTER TABLE public.college_memberships 
    ADD CONSTRAINT college_memberships_role_check 
    CHECK (role IN (
        'PRIMARY_ADMIN',
        'COLLEGE_ADMIN',
        'EVENT_COORDINATOR',
        'LIBRARIAN',
        'FEEDBACK_EXAM_COORDINATOR'
    ));

-- 2. ADD REQUESTED_ROLE TO COLLEGE_ADMIN_REQUESTS
ALTER TABLE public.college_admin_requests 
    ADD COLUMN IF NOT EXISTS requested_role VARCHAR(50) DEFAULT 'COLLEGE_ADMIN';

-- 3. ADD TIMING CONTROLS TO LIBRARY_SETTINGS
ALTER TABLE public.library_settings 
    ADD COLUMN IF NOT EXISTS operating_days TEXT[] DEFAULT ARRAY['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
    ADD COLUMN IF NOT EXISTS operating_start_time TIME DEFAULT '10:00:00',
    ADD COLUMN IF NOT EXISTS operating_end_time TIME DEFAULT '16:00:00',
    ADD COLUMN IF NOT EXISTS is_timing_enforced BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS timing_timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    ADD COLUMN IF NOT EXISTS timing_closure_message TEXT DEFAULT 'Book registration is open Monday to Saturday from 10:00 AM to 04:00 PM.';

-- 4. UPDATE is_college_admin TO ALLOW ALL ACTIVE ROLES
CREATE OR REPLACE FUNCTION public.is_college_admin(auth_user_id UUID, target_college_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth_user_id IS NULL OR target_college_id IS NULL THEN 
    RETURN false; 
  END IF;

  -- Platform Super Admins possess administrative privileges across all colleges
  IF public.is_platform_super_admin(auth_user_id) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.college_memberships
    WHERE user_id = auth_user_id
      AND college_id = target_college_id
      AND status = 'ACTIVE'
  );
END;
$$;

-- 5. FUNCTION: Check if user is Primary Admin or Platform Super Admin for a college
CREATE OR REPLACE FUNCTION public.is_college_primary_admin(auth_user_id UUID, target_college_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth_user_id IS NULL OR target_college_id IS NULL THEN 
    RETURN false; 
  END IF;

  IF public.is_platform_super_admin(auth_user_id) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.college_memberships
    WHERE user_id = auth_user_id
      AND college_id = target_college_id
      AND (role = 'PRIMARY_ADMIN' OR role = 'COLLEGE_ADMIN')
      AND status = 'ACTIVE'
  );
END;
$$;

-- 6. FUNCTION: Get admin's specific college role
CREATE OR REPLACE FUNCTION public.get_user_college_role(auth_user_id UUID, target_college_id UUID)
RETURNS VARCHAR(50)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role VARCHAR(50);
BEGIN
  IF auth_user_id IS NULL OR target_college_id IS NULL THEN 
    RETURN NULL; 
  END IF;

  IF public.is_platform_super_admin(auth_user_id) THEN
    RETURN 'PLATFORM_SUPER_ADMIN';
  END IF;

  SELECT role INTO v_role
  FROM public.college_memberships
  WHERE user_id = auth_user_id
    AND college_id = target_college_id
    AND status = 'ACTIVE'
  LIMIT 1;

  RETURN v_role;
END;
$$;
