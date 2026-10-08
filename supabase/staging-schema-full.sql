-- CAMPUSFLOW FULL CONSOLIDATED STAGING SCHEMA MIGRATIONS (1 to 24)
-- Target Database: Isolated Staging Only (ggisjcegbcvxwgczwdbd)
-- Generated: October 2026


-- ====================================================================
-- MIGRATION: 20260922000001_phase1_platform_and_tenants.sql
-- ====================================================================

-- ====================================================================
-- FMS MULTI-TENANT PLATFORM
-- MIGRATION: 20260922000001_phase1_platform_and_tenants.sql
-- PURPOSE: Platform foundation, multi-tenant colleges, memberships,
--          and STABLE security-definer authorization functions.
-- SAFETY: Idempotent. Zero single-tenant BCE assumptions.
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- 2. PLATFORM ENTITIES: COLLEGES (ROOT TENANTS)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.colleges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    tagline VARCHAR(255),
    established_year INTEGER,
    aicte_approved BOOLEAN NOT NULL DEFAULT true,
    affiliated_university VARCHAR(255),
    logo_url TEXT,
    primary_color VARCHAR(20) NOT NULL DEFAULT '#0B192C',
    secondary_color VARCHAR(20) NOT NULL DEFAULT '#1E3E62',
    accent_color VARCHAR(20) NOT NULL DEFAULT '#F6995C',
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address TEXT,
    website_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for lightning-fast slug and code resolution
CREATE INDEX IF NOT EXISTS idx_colleges_slug ON public.colleges(slug);
CREATE INDEX IF NOT EXISTS idx_colleges_code ON public.colleges(code);
CREATE INDEX IF NOT EXISTS idx_colleges_active ON public.colleges(is_active);

-- ====================================================================
-- 3. PLATFORM ADMINISTRATORS (CROSS-TENANT PRIVILEGES)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.platform_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'PLATFORM_SUPER_ADMIN',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_platform_admins_user ON public.platform_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_admins_email ON public.platform_admins(LOWER(email));

-- ====================================================================
-- 4. COLLEGE MEMBERSHIPS (TENANT-ADMIN ASSOCIATIONS)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.college_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'COLLEGE_ADMIN' CHECK (role IN ('COLLEGE_ADMIN')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_college_memberships_college_user UNIQUE (college_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user_college ON public.college_memberships(user_id, college_id, status);
CREATE INDEX IF NOT EXISTS idx_memberships_college ON public.college_memberships(college_id);

-- ====================================================================
-- 5. COLLEGE ADMIN ACCESS REQUESTS (TENANT-SCOPED ONBOARDING)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.college_admin_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Partial index preventing duplicate pending requests for the same college + email
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_requests_pending_unique 
    ON public.college_admin_requests (college_id, LOWER(email)) 
    WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_admin_requests_college_status 
    ON public.college_admin_requests(college_id, status, created_at DESC);

-- ====================================================================
-- 6. SECURITY-DEFINER READ-ONLY STABLE AUTHORIZATION FUNCTIONS
-- ====================================================================

-- Function 6.1: Check if user is an active Platform Super Admin
CREATE OR REPLACE FUNCTION public.is_platform_super_admin(auth_user_id UUID)
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
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth_user_id 
      AND is_active = true
  );
END;
$$;

-- Function 6.2: Check if user is an active College Admin for a given college
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
      AND role = 'COLLEGE_ADMIN'
      AND status = 'ACTIVE'
  );
END;
$$;

-- Function 6.3: Get all college IDs where the user has active admin privileges
CREATE OR REPLACE FUNCTION public.get_user_college_ids(auth_user_id UUID)
RETURNS TABLE (college_id UUID)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth_user_id IS NULL THEN
    RETURN;
  END IF;

  IF public.is_platform_super_admin(auth_user_id) THEN
    RETURN QUERY SELECT id FROM public.colleges WHERE is_active = true;
  ELSE
    RETURN QUERY 
      SELECT cm.college_id 
      FROM public.college_memberships cm
      JOIN public.colleges c ON c.id = cm.college_id
      WHERE cm.user_id = auth_user_id 
        AND cm.status = 'ACTIVE'
        AND c.is_active = true;
  END IF;
END;
$$;


-- ====================================================================
-- MIGRATION: 20260922000002_phase2_academic_structure.sql
-- ====================================================================

-- ====================================================================
-- FMS MULTI-TENANT PLATFORM
-- MIGRATION: 20260922000002_phase2_academic_structure.sql
-- PURPOSE: Tenant-scoped academic curriculum structures:
--          academic years, branches, semesters, faculties, subjects,
--          and faculty-subject assignments.
-- ====================================================================

-- ====================================================================
-- 1. ACADEMIC YEARS
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_academic_years_college_name UNIQUE (college_id, name)
);

CREATE INDEX IF NOT EXISTS idx_academic_years_college ON public.academic_years(college_id);
CREATE INDEX IF NOT EXISTS idx_academic_years_active ON public.academic_years(college_id, is_active);

-- ====================================================================
-- 2. BRANCHES (DEPARTMENTS)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_branches_college_code UNIQUE (college_id, code)
);

CREATE INDEX IF NOT EXISTS idx_branches_college ON public.branches(college_id);
CREATE INDEX IF NOT EXISTS idx_branches_active ON public.branches(college_id, is_active);

-- ====================================================================
-- 3. SEMESTERS
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.semesters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    year_number INTEGER NOT NULL CHECK (year_number BETWEEN 1 AND 4),
    semester_number INTEGER NOT NULL CHECK (semester_number BETWEEN 1 AND 8),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_semesters_college_sem_no UNIQUE (college_id, semester_number)
);

CREATE INDEX IF NOT EXISTS idx_semesters_college ON public.semesters(college_id, semester_number);
CREATE INDEX IF NOT EXISTS idx_semesters_active ON public.semesters(college_id, is_active);

-- ====================================================================
-- 4. FACULTIES (TEACHING STAFF)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.faculties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    employee_id VARCHAR(100),
    department VARCHAR(255) NOT NULL,
    designation VARCHAR(100) NOT NULL DEFAULT 'Assistant Professor',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Filtered unique index: employee_id is unique per college when provided
CREATE UNIQUE INDEX IF NOT EXISTS idx_faculties_employee_unique 
    ON public.faculties(college_id, employee_id) 
    WHERE employee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_faculties_college_dept ON public.faculties(college_id, department);
CREATE INDEX IF NOT EXISTS idx_faculties_college_name ON public.faculties(college_id, name);
CREATE INDEX IF NOT EXISTS idx_faculties_college_active ON public.faculties(college_id, is_active);

-- ====================================================================
-- 5. SUBJECTS (COURSES)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    semester_id UUID REFERENCES public.semesters(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_subjects_college_code UNIQUE (college_id, code)
);

CREATE INDEX IF NOT EXISTS idx_subjects_college ON public.subjects(college_id);
CREATE INDEX IF NOT EXISTS idx_subjects_college_curriculum ON public.subjects(college_id, branch_id, semester_id);
CREATE INDEX IF NOT EXISTS idx_subjects_active ON public.subjects(college_id, is_active);

-- ====================================================================
-- 6. FACULTY-SUBJECT ASSIGNMENTS
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.faculty_subject_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    faculty_id UUID NOT NULL REFERENCES public.faculties(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    semester_id UUID REFERENCES public.semesters(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_faculty_assignments_f_s_y UNIQUE (college_id, faculty_id, subject_id, academic_year_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_lookup 
    ON public.faculty_subject_assignments(college_id, academic_year_id, branch_id, semester_id, is_active);
CREATE INDEX IF NOT EXISTS idx_assignments_faculty ON public.faculty_subject_assignments(faculty_id);
CREATE INDEX IF NOT EXISTS idx_assignments_subject ON public.faculty_subject_assignments(subject_id);


-- ====================================================================
-- MIGRATION: 20260922000003_phase3_feedback_structure.sql
-- ====================================================================

-- ====================================================================
-- FMS MULTI-TENANT PLATFORM
-- MIGRATION: 20260922000003_phase3_feedback_structure.sql
-- PURPOSE: Tenant-scoped feedback forms, multi-teacher form items,
--          response metadata sync tracking, and safe public views.
-- ====================================================================

-- ====================================================================
-- 1. FEEDBACK FORMS TABLE
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.feedback_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    semester_id UUID NOT NULL REFERENCES public.semesters(id) ON DELETE RESTRICT,
    faculty_id UUID REFERENCES public.faculties(id) ON DELETE RESTRICT,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE RESTRICT,
    form_type VARCHAR(50) NOT NULL DEFAULT 'FACULTY_FEEDBACK' 
        CHECK (form_type IN ('FACULTY_FEEDBACK', 'SEMESTER_FEEDBACK')),
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' 
        CHECK (status IN ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED')),
    slug VARCHAR(255) NOT NULL,
    google_form_id TEXT,
    google_sheet_id TEXT,
    google_form_url TEXT,
    google_form_edit_url TEXT,
    google_sheet_url TEXT,
    response_destination_type VARCHAR(50) DEFAULT 'APPLICATION_MANAGED' 
        CHECK (response_destination_type IN ('NATIVE_SHEET', 'APPLICATION_MANAGED')),
    response_count INTEGER NOT NULL DEFAULT 0,
    last_synced_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_feedback_forms_college_slug UNIQUE (college_id, slug),
    CONSTRAINT chk_feedback_forms_scope CHECK (
        (form_type = 'SEMESTER_FEEDBACK') OR 
        (faculty_id IS NOT NULL AND subject_id IS NOT NULL)
    )
);

-- Performance and Discovery Indexes
CREATE INDEX IF NOT EXISTS idx_feedback_forms_college ON public.feedback_forms(college_id);
CREATE INDEX IF NOT EXISTS idx_feedback_forms_discovery 
    ON public.feedback_forms(college_id, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_forms_cascading 
    ON public.feedback_forms(college_id, academic_year_id, branch_id, semester_id, status);
CREATE INDEX IF NOT EXISTS idx_feedback_forms_google_ids 
    ON public.feedback_forms(college_id, google_form_id, google_sheet_id);

-- ====================================================================
-- 2. FEEDBACK FORM ITEMS (MULTI-FACULTY SEMESTER FORMS)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.feedback_form_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES public.feedback_forms(id) ON DELETE CASCADE,
    faculty_id UUID NOT NULL REFERENCES public.faculties(id) ON DELETE RESTRICT,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
    assignment_id UUID REFERENCES public.faculty_subject_assignments(id) ON DELETE SET NULL,
    grid_title VARCHAR(255) NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_feedback_form_items_form_f_s UNIQUE (form_id, faculty_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_form_items_form_order 
    ON public.feedback_form_items(form_id, order_index);
CREATE INDEX IF NOT EXISTS idx_feedback_form_items_faculty 
    ON public.feedback_form_items(faculty_id);
CREATE INDEX IF NOT EXISTS idx_feedback_form_items_subject 
    ON public.feedback_form_items(subject_id);

-- ====================================================================
-- 3. FEEDBACK RESPONSE RECORDS (METADATA & RECEIPT TRACKING)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.feedback_response_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    form_id UUID NOT NULL REFERENCES public.feedback_forms(id) ON DELETE CASCADE,
    google_response_id VARCHAR(255) NOT NULL,
    student_email VARCHAR(255) NOT NULL,
    student_name VARCHAR(255),
    registration_number VARCHAR(100),
    submitted_at TIMESTAMPTZ,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    confirmation_email_sent_at TIMESTAMPTZ,
    email_status VARCHAR(50) NOT NULL DEFAULT 'PENDING' 
        CHECK (email_status IN ('PENDING', 'SENT', 'FAILED', 'EMAIL_NOT_CONFIGURED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_feedback_response_records_c_f_g UNIQUE (college_id, form_id, google_response_id)
);

CREATE INDEX IF NOT EXISTS idx_response_records_college_form 
    ON public.feedback_response_records(college_id, form_id, synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_response_records_email 
    ON public.feedback_response_records(college_id, student_email);
CREATE INDEX IF NOT EXISTS idx_response_records_reg_no 
    ON public.feedback_response_records(college_id, registration_number);

-- ====================================================================
-- 4. PUBLIC VIEW (SAFE PROJECTION FOR STUDENTS & PUBLIC ACCESS)
-- ====================================================================
-- Strictly omits google_sheet_id, google_sheet_url, google_form_edit_url.
CREATE OR REPLACE VIEW public.public_feedback_forms AS
SELECT 
    f.id,
    f.college_id,
    c.slug AS college_slug,
    c.name AS college_name,
    f.title,
    f.description,
    f.academic_year_id,
    f.branch_id,
    f.semester_id,
    f.faculty_id,
    f.subject_id,
    f.form_type,
    f.status,
    f.slug,
    f.google_form_url,
    f.published_at,
    f.closed_at
FROM public.feedback_forms f
JOIN public.colleges c ON c.id = f.college_id
WHERE f.status IN ('PUBLISHED', 'CLOSED') 
  AND c.is_active = true;

GRANT SELECT ON public.public_feedback_forms TO anon, authenticated;


-- ====================================================================
-- MIGRATION: 20260922000004_phase4_google_connections.sql
-- ====================================================================

-- ====================================================================
-- FMS MULTI-TENANT PLATFORM
-- MIGRATION: 20260922000004_phase4_google_connections.sql
-- PURPOSE: Tenant-scoped Google Workspace OAuth connections.
--          Replaces the legacy global singleton OAuth token model.
--          Protects refresh tokens from client-side exposure.
-- ====================================================================

-- ====================================================================
-- 1. COLLEGE GOOGLE CONNECTIONS TABLE
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.college_google_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL UNIQUE REFERENCES public.colleges(id) ON DELETE CASCADE,
    account_email VARCHAR(255) NOT NULL,
    account_name VARCHAR(255),
    refresh_token TEXT NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT '{}'::text[],
    is_valid BOOLEAN NOT NULL DEFAULT true,
    last_error TEXT,
    last_verified_at TIMESTAMPTZ,
    connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_google_connections_college 
    ON public.college_google_connections(college_id);

-- ====================================================================
-- 2. ACCESS RESTRICTIONS & PERMISSIONS
-- ====================================================================
-- Crucial Security Rule:
-- Google OAuth refresh tokens must NEVER be accessible to client browsers
-- or exposed via the Supabase Data API (anon or authenticated).
-- All token exchanges and API actions run server-side via service_role.

ALTER TABLE public.college_google_connections ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.college_google_connections FROM anon, authenticated, public;
GRANT ALL ON public.college_google_connections TO service_role;

-- ====================================================================
-- 3. SAFE STATUS VIEW FOR DASHBOARD (EXCLUDES REFRESH TOKENS)
-- ====================================================================

CREATE OR REPLACE VIEW public.college_google_status AS
SELECT 
    id,
    college_id,
    account_email,
    account_name,
    scopes,
    is_valid,
    last_error,
    last_verified_at,
    connected_at,
    updated_at
FROM public.college_google_connections
WHERE (
    public.is_platform_super_admin(auth.uid()) OR
    public.is_college_admin(auth.uid(), college_id)
);

-- Allow authenticated admins to read only non-sensitive metadata for their college
GRANT SELECT ON public.college_google_status TO authenticated;


-- ====================================================================
-- MIGRATION: 20260922000005_phase5_billing_and_entitlements.sql
-- ====================================================================

-- ====================================================================
-- FMS MULTI-TENANT PLATFORM
-- MIGRATION: 20260922000005_phase5_billing_and_entitlements.sql
-- PURPOSE: Tenant-scoped billing, subscription plans, trials,
--          payment proofs storage, and verification requests.
-- ====================================================================

-- ====================================================================
-- 1. BILLING PLANS TABLE (PLATFORM CATALOG)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.billing_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    price INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    billing_interval VARCHAR(20) NOT NULL DEFAULT 'MONTHLY' 
        CHECK (billing_interval IN ('FREE', 'MONTHLY', 'YEARLY', 'ONETIME', 'CUSTOM')),
    duration_days INTEGER DEFAULT NULL,
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_recommended BOOLEAN NOT NULL DEFAULT false,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_billing_plans_active ON public.billing_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_billing_plans_slug ON public.billing_plans(slug);
CREATE INDEX IF NOT EXISTS idx_billing_plans_display ON public.billing_plans(display_order);

-- ====================================================================
-- 2. PAYMENT SETTINGS TABLE (PLATFORM SINGLETON)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.payment_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upi_id VARCHAR(255) DEFAULT '',
    account_name VARCHAR(255) DEFAULT '',
    bank_name VARCHAR(255) DEFAULT '',
    account_number VARCHAR(50) DEFAULT '',
    ifsc_code VARCHAR(20) DEFAULT '',
    support_phone VARCHAR(20) DEFAULT '9470870830',
    payment_instructions TEXT DEFAULT 'Pay via UPI or Bank Transfer. After payment, enter the UTR/transaction reference number below.',
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ====================================================================
-- 3. COLLEGE BILLING ACCOUNTS (TENANT SUBSCRIPTION STATE)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.college_billing_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL UNIQUE REFERENCES public.colleges(id) ON DELETE CASCADE,
    plan_type VARCHAR(50) NOT NULL DEFAULT 'FREE',
    current_plan_id UUID REFERENCES public.billing_plans(id) ON DELETE SET NULL,
    access_status VARCHAR(20) NOT NULL DEFAULT 'LOCKED' 
        CHECK (access_status IN ('LOCKED', 'UNLOCKED')),
    subscription_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' 
        CHECK (subscription_status IN ('ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING')),
    started_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_billing_accounts_college ON public.college_billing_accounts(college_id);
CREATE INDEX IF NOT EXISTS idx_billing_accounts_status ON public.college_billing_accounts(access_status, subscription_status);

-- ====================================================================
-- 4. COLLEGE TRIAL ENTITLEMENTS (TEMPORARY FEATURE TRIALS)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.college_trial_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    granted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    starts_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' 
        CHECK (status IN ('ACTIVE', 'EXPIRED', 'REVOKED')),
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    note TEXT,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_college_trial_dates CHECK (expires_at > starts_at)
);

-- Partial index: at most ONE active trial per college at any time
CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_active_trial_per_college 
    ON public.college_trial_entitlements(college_id) 
    WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_trial_college_lookup 
    ON public.college_trial_entitlements(college_id, status, expires_at);

-- ====================================================================
-- 5. COLLEGE PAYMENT REQUESTS (PAYMENT VERIFICATION WORKFLOW)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.college_payment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    billing_plan_id UUID REFERENCES public.billing_plans(id) ON DELETE SET NULL,
    plan_type VARCHAR(50) NOT NULL,
    amount INTEGER NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('UPI', 'BANK_TRANSFER')),
    payment_reference VARCHAR(255) NOT NULL,
    payment_proof_url TEXT,
    snapshot_plan_name VARCHAR(100),
    snapshot_billing_interval VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' 
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    submitted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_college 
    ON public.college_payment_requests(college_id, status, created_at DESC);

-- ====================================================================
-- 6. STORAGE BUCKET CONFIGURATION FOR PAYMENT PROOFS
-- ====================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'payment-proofs',
    'payment-proofs',
    false,
    5242880,
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

-- Storage Policies for 'payment-proofs'
-- Path structure: <college_id>/<filename>
-- Safe validation: extracts first folder segment and safely checks UUID format before casting

DROP POLICY IF EXISTS "Admins can upload payment proofs" ON storage.objects;
CREATE POLICY "Admins can upload payment proofs" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'payment-proofs' AND (
            public.is_platform_super_admin(auth.uid()) OR
            CASE 
                WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN public.is_college_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
                ELSE false
            END
        )
    );

DROP POLICY IF EXISTS "Admins can view payment proofs" ON storage.objects;
CREATE POLICY "Admins can view payment proofs" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'payment-proofs' AND (
            public.is_platform_super_admin(auth.uid()) OR
            CASE 
                WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN public.is_college_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
                ELSE false
            END
        )
    );

DROP POLICY IF EXISTS "Admins can update payment proofs" ON storage.objects;
CREATE POLICY "Admins can update payment proofs" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'payment-proofs' AND (
            public.is_platform_super_admin(auth.uid()) OR
            CASE 
                WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN public.is_college_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
                ELSE false
            END
        )
    )
    WITH CHECK (
        bucket_id = 'payment-proofs' AND (
            public.is_platform_super_admin(auth.uid()) OR
            CASE 
                WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN public.is_college_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
                ELSE false
            END
        )
    );

DROP POLICY IF EXISTS "Admins can delete payment proofs" ON storage.objects;
CREATE POLICY "Admins can delete payment proofs" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'payment-proofs' AND (
            public.is_platform_super_admin(auth.uid()) OR
            CASE 
                WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN public.is_college_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
                ELSE false
            END
        )
    );



-- ====================================================================
-- MIGRATION: 20260922000006_phase6_audit_and_rls.sql
-- ====================================================================

-- ====================================================================
-- FMS MULTI-TENANT PLATFORM
-- MIGRATION: 20260922000006_phase6_audit_and_rls.sql
-- PURPOSE: Platform and tenant audit logging, complete Row Level Security
--          (RLS) enforcement across all tables, and explicit grants.
-- ====================================================================

-- ====================================================================
-- 1. AUDIT LOGS TABLE (HYBRID: PLATFORM + TENANT EVENTS)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID REFERENCES public.colleges(id) ON DELETE SET NULL,
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id TEXT NOT NULL,
    details TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_college_created 
    ON public.audit_logs(college_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor 
    ON public.audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action 
    ON public.audit_logs(action);

-- ====================================================================
-- 2. ENABLE ROW LEVEL SECURITY ACROSS ALL APPLICATION TABLES
-- ====================================================================

ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.college_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.college_admin_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty_subject_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_form_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_response_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.college_billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.college_trial_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.college_payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- 3. RLS POLICIES
-- ====================================================================

-- --------------------------------------------------------------------
-- 3.1 COLLEGES POLICIES
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read active colleges" ON public.colleges;
CREATE POLICY "Public read active colleges" ON public.colleges
    FOR SELECT TO anon, authenticated
    USING (is_active = true);

DROP POLICY IF EXISTS "Super Admin manages colleges" ON public.colleges;
CREATE POLICY "Super Admin manages colleges" ON public.colleges
    FOR ALL TO authenticated
    USING (public.is_platform_super_admin(auth.uid()))
    WITH CHECK (public.is_platform_super_admin(auth.uid()));

-- --------------------------------------------------------------------
-- 3.2 PLATFORM ADMINS POLICIES
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Super Admin manages platform admins" ON public.platform_admins;
CREATE POLICY "Super Admin manages platform admins" ON public.platform_admins
    FOR ALL TO authenticated
    USING (public.is_platform_super_admin(auth.uid()))
    WITH CHECK (public.is_platform_super_admin(auth.uid()));

-- --------------------------------------------------------------------
-- 3.3 COLLEGE MEMBERSHIPS POLICIES
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Super Admin manages all memberships" ON public.college_memberships;
CREATE POLICY "Super Admin manages all memberships" ON public.college_memberships
    FOR ALL TO authenticated
    USING (public.is_platform_super_admin(auth.uid()))
    WITH CHECK (public.is_platform_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins view own college memberships" ON public.college_memberships;
CREATE POLICY "Admins view own college memberships" ON public.college_memberships
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id OR 
        public.is_college_admin(auth.uid(), college_id)
    );

-- --------------------------------------------------------------------
-- 3.4 COLLEGE ADMIN REQUESTS POLICIES
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Applicants insert admin request" ON public.college_admin_requests;
CREATE POLICY "Applicants insert admin request" ON public.college_admin_requests
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Applicants view own requests" ON public.college_admin_requests;
CREATE POLICY "Applicants view own requests" ON public.college_admin_requests
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "College Admins manage requests" ON public.college_admin_requests;
CREATE POLICY "College Admins manage requests" ON public.college_admin_requests
    FOR ALL TO authenticated
    USING (public.is_college_admin(auth.uid(), college_id))
    WITH CHECK (public.is_college_admin(auth.uid(), college_id));

-- --------------------------------------------------------------------
-- 3.5 ACADEMIC ENTITIES POLICIES (YEARS, BRANCHES, SEMESTERS, FACULTIES, SUBJECTS, ASSIGNMENTS)
-- --------------------------------------------------------------------

-- Academic Years
DROP POLICY IF EXISTS "Public view active academic years" ON public.academic_years;
CREATE POLICY "Public view active academic years" ON public.academic_years
    FOR SELECT TO anon, authenticated
    USING (is_active = true AND EXISTS (SELECT 1 FROM public.colleges c WHERE c.id = academic_years.college_id AND c.is_active = true));

DROP POLICY IF EXISTS "Admins manage academic years" ON public.academic_years;
CREATE POLICY "Admins manage academic years" ON public.academic_years
    FOR ALL TO authenticated
    USING (public.is_college_admin(auth.uid(), college_id))
    WITH CHECK (public.is_college_admin(auth.uid(), college_id));

-- Branches
DROP POLICY IF EXISTS "Public view active branches" ON public.branches;
CREATE POLICY "Public view active branches" ON public.branches
    FOR SELECT TO anon, authenticated
    USING (is_active = true AND EXISTS (SELECT 1 FROM public.colleges c WHERE c.id = branches.college_id AND c.is_active = true));

DROP POLICY IF EXISTS "Admins manage branches" ON public.branches;
CREATE POLICY "Admins manage branches" ON public.branches
    FOR ALL TO authenticated
    USING (public.is_college_admin(auth.uid(), college_id))
    WITH CHECK (public.is_college_admin(auth.uid(), college_id));

-- Semesters
DROP POLICY IF EXISTS "Public view active semesters" ON public.semesters;
CREATE POLICY "Public view active semesters" ON public.semesters
    FOR SELECT TO anon, authenticated
    USING (is_active = true AND EXISTS (SELECT 1 FROM public.colleges c WHERE c.id = semesters.college_id AND c.is_active = true));

DROP POLICY IF EXISTS "Admins manage semesters" ON public.semesters;
CREATE POLICY "Admins manage semesters" ON public.semesters
    FOR ALL TO authenticated
    USING (public.is_college_admin(auth.uid(), college_id))
    WITH CHECK (public.is_college_admin(auth.uid(), college_id));

-- Faculties
DROP POLICY IF EXISTS "Public view active faculties" ON public.faculties;
CREATE POLICY "Public view active faculties" ON public.faculties
    FOR SELECT TO anon, authenticated
    USING (is_active = true AND EXISTS (SELECT 1 FROM public.colleges c WHERE c.id = faculties.college_id AND c.is_active = true));

DROP POLICY IF EXISTS "Admins manage faculties" ON public.faculties;
CREATE POLICY "Admins manage faculties" ON public.faculties
    FOR ALL TO authenticated
    USING (public.is_college_admin(auth.uid(), college_id))
    WITH CHECK (public.is_college_admin(auth.uid(), college_id));

-- Subjects
DROP POLICY IF EXISTS "Public view active subjects" ON public.subjects;
CREATE POLICY "Public view active subjects" ON public.subjects
    FOR SELECT TO anon, authenticated
    USING (is_active = true AND EXISTS (SELECT 1 FROM public.colleges c WHERE c.id = subjects.college_id AND c.is_active = true));

DROP POLICY IF EXISTS "Admins manage subjects" ON public.subjects;
CREATE POLICY "Admins manage subjects" ON public.subjects
    FOR ALL TO authenticated
    USING (public.is_college_admin(auth.uid(), college_id))
    WITH CHECK (public.is_college_admin(auth.uid(), college_id));

-- Faculty Subject Assignments
DROP POLICY IF EXISTS "Public view active assignments" ON public.faculty_subject_assignments;
CREATE POLICY "Public view active assignments" ON public.faculty_subject_assignments
    FOR SELECT TO anon, authenticated
    USING (is_active = true AND EXISTS (SELECT 1 FROM public.colleges c WHERE c.id = faculty_subject_assignments.college_id AND c.is_active = true));

DROP POLICY IF EXISTS "Admins manage assignments" ON public.faculty_subject_assignments;
CREATE POLICY "Admins manage assignments" ON public.faculty_subject_assignments
    FOR ALL TO authenticated
    USING (public.is_college_admin(auth.uid(), college_id))
    WITH CHECK (public.is_college_admin(auth.uid(), college_id));

-- --------------------------------------------------------------------
-- 3.6 FEEDBACK FORMS & ITEMS POLICIES
-- --------------------------------------------------------------------

-- Feedback Forms
DROP POLICY IF EXISTS "Public view published feedback forms" ON public.feedback_forms;
CREATE POLICY "Public view published feedback forms" ON public.feedback_forms
    FOR SELECT TO anon, authenticated
    USING (
        status IN ('PUBLISHED', 'CLOSED') 
        AND EXISTS (SELECT 1 FROM public.colleges c WHERE c.id = feedback_forms.college_id AND c.is_active = true)
    );

DROP POLICY IF EXISTS "Admins manage feedback forms" ON public.feedback_forms;
CREATE POLICY "Admins manage feedback forms" ON public.feedback_forms
    FOR ALL TO authenticated
    USING (public.is_college_admin(auth.uid(), college_id))
    WITH CHECK (public.is_college_admin(auth.uid(), college_id));

-- Feedback Form Items (Derived ownership via parent form)
DROP POLICY IF EXISTS "Public view published feedback form items" ON public.feedback_form_items;
CREATE POLICY "Public view published feedback form items" ON public.feedback_form_items
    FOR SELECT TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.feedback_forms f
            JOIN public.colleges c ON c.id = f.college_id
            WHERE f.id = feedback_form_items.form_id
              AND f.status IN ('PUBLISHED', 'CLOSED')
              AND c.is_active = true
        )
    );

DROP POLICY IF EXISTS "Admins manage feedback form items" ON public.feedback_form_items;
CREATE POLICY "Admins manage feedback form items" ON public.feedback_form_items
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.feedback_forms f
            WHERE f.id = feedback_form_items.form_id
              AND public.is_college_admin(auth.uid(), f.college_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.feedback_forms f
            WHERE f.id = feedback_form_items.form_id
              AND public.is_college_admin(auth.uid(), f.college_id)
        )
    );

-- --------------------------------------------------------------------
-- 3.7 FEEDBACK RESPONSE RECORDS POLICIES (STUDENT PRIVACY PROTECTED)
-- --------------------------------------------------------------------
REVOKE ALL ON public.feedback_response_records FROM anon, public;
GRANT SELECT ON public.feedback_response_records TO authenticated;
GRANT ALL ON public.feedback_response_records TO service_role;

DROP POLICY IF EXISTS "Admins view college response records" ON public.feedback_response_records;
CREATE POLICY "Admins view college response records" ON public.feedback_response_records
    FOR SELECT TO authenticated
    USING (public.is_college_admin(auth.uid(), college_id));

-- --------------------------------------------------------------------
-- 3.8 BILLING & PAYMENTS POLICIES
-- --------------------------------------------------------------------

-- Billing Plans
DROP POLICY IF EXISTS "Public view active billing plans" ON public.billing_plans;
CREATE POLICY "Public view active billing plans" ON public.billing_plans
    FOR SELECT TO anon, authenticated
    USING (is_active = true);

DROP POLICY IF EXISTS "Super Admin manages billing plans" ON public.billing_plans;
CREATE POLICY "Super Admin manages billing plans" ON public.billing_plans
    FOR ALL TO authenticated
    USING (public.is_platform_super_admin(auth.uid()))
    WITH CHECK (public.is_platform_super_admin(auth.uid()));

-- Payment Settings
DROP POLICY IF EXISTS "Admins view payment settings" ON public.payment_settings;
CREATE POLICY "Admins view payment settings" ON public.payment_settings
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Super Admin manages payment settings" ON public.payment_settings;
CREATE POLICY "Super Admin manages payment settings" ON public.payment_settings
    FOR ALL TO authenticated
    USING (public.is_platform_super_admin(auth.uid()))
    WITH CHECK (public.is_platform_super_admin(auth.uid()));

-- College Billing Accounts
DROP POLICY IF EXISTS "Admins view college billing" ON public.college_billing_accounts;
CREATE POLICY "Admins view college billing" ON public.college_billing_accounts
    FOR SELECT TO authenticated
    USING (public.is_college_admin(auth.uid(), college_id));

DROP POLICY IF EXISTS "Super Admin manages all college billing" ON public.college_billing_accounts;
CREATE POLICY "Super Admin manages all college billing" ON public.college_billing_accounts
    FOR ALL TO authenticated
    USING (public.is_platform_super_admin(auth.uid()))
    WITH CHECK (public.is_platform_super_admin(auth.uid()));

-- College Trial Entitlements
DROP POLICY IF EXISTS "Admins view college trials" ON public.college_trial_entitlements;
CREATE POLICY "Admins view college trials" ON public.college_trial_entitlements
    FOR SELECT TO authenticated
    USING (public.is_college_admin(auth.uid(), college_id));

DROP POLICY IF EXISTS "Super Admin manages college trials" ON public.college_trial_entitlements;
CREATE POLICY "Super Admin manages college trials" ON public.college_trial_entitlements
    FOR ALL TO authenticated
    USING (public.is_platform_super_admin(auth.uid()))
    WITH CHECK (public.is_platform_super_admin(auth.uid()));

-- College Payment Requests
DROP POLICY IF EXISTS "Admins view and submit payment requests" ON public.college_payment_requests;
CREATE POLICY "Admins view and submit payment requests" ON public.college_payment_requests
    FOR SELECT TO authenticated
    USING (public.is_college_admin(auth.uid(), college_id));

CREATE POLICY "Admins insert payment requests" ON public.college_payment_requests
    FOR INSERT TO authenticated
    WITH CHECK (public.is_college_admin(auth.uid(), college_id));

DROP POLICY IF EXISTS "Super Admin manages payment requests" ON public.college_payment_requests;
CREATE POLICY "Super Admin manages payment requests" ON public.college_payment_requests
    FOR ALL TO authenticated
    USING (public.is_platform_super_admin(auth.uid()))
    WITH CHECK (public.is_platform_super_admin(auth.uid()));

-- --------------------------------------------------------------------
-- 3.9 AUDIT LOGS POLICIES
-- --------------------------------------------------------------------
REVOKE ALL ON public.audit_logs FROM anon, public;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

DROP POLICY IF EXISTS "Admins view college audit logs" ON public.audit_logs;
CREATE POLICY "Admins view college audit logs" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
        public.is_platform_super_admin(auth.uid()) OR
        (college_id IS NOT NULL AND public.is_college_admin(auth.uid(), college_id))
    );

DROP POLICY IF EXISTS "Authenticated users insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users insert audit logs" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            (college_id IS NULL AND public.is_platform_super_admin(auth.uid())) OR
            (college_id IS NOT NULL AND public.is_college_admin(auth.uid(), college_id))
        )
    );

-- ====================================================================
-- 4. SERVICE ROLE FULL ACCESS GRANTS
-- ====================================================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;


-- ====================================================================
-- MIGRATION: 20260922000007_phase7_seed_initial_platform.sql
-- ====================================================================

-- ====================================================================
-- FMS MULTI-TENANT PLATFORM
-- MIGRATION: 20260922000007_phase7_seed_initial_platform.sql
-- PURPOSE: Minimal safe platform bootstrap:
--          1. Seed master billing plans catalog
--          2. Seed payment settings singleton
--          3. Seed initial tenant: BCE-BGP (deterministic UUID)
--          4. Seed BCE-BGP billing account
--          5. Automated Super Admin linkage for SUPER_ADMIN_EMAIL
--          6. Reload PostgREST schema cache
-- SAFETY: Zero production tokens, forms, sheets, or mock records copied.
-- ====================================================================

-- ====================================================================
-- 1. SEED AUTHORITATIVE BILLING PLANS
-- ====================================================================

INSERT INTO public.billing_plans (name, slug, description, price, currency, billing_interval, duration_days, features, is_active, is_recommended, display_order)
VALUES
    ('Free', 'FREE', 'Permanent base plan with Basic Analytics.', 0, 'INR', 'FREE', NULL,
     '["Basic analytics"]'::jsonb, true, false, 0),
    ('Basic', 'BASIC', 'Essential tools for Google Form generation and Sheet response sync.', 999, 'INR', 'MONTHLY', 30,
     '["Google Form generation", "Google Sheet integration", "Basic analytics"]'::jsonb, true, false, 10),
    ('Full Access', 'FULL_ACCESS', 'Complete access to form generation, response sync, full analytics, and PDF reports.', 2999, 'INR', 'MONTHLY', 30,
     '["Google Form generation", "Google Sheet integration", "Basic analytics", "Full analytics access", "Analytics PDF reports"]'::jsonb, true, true, 20),
    ('Yearly', 'YEARLY', 'Best value annual plan — save over ₹5,900/year with priority support.', 29999, 'INR', 'YEARLY', 365,
     '["Google Form generation", "Google Sheet integration", "Basic analytics", "Full analytics access", "Analytics PDF reports", "Priority support"]'::jsonb, true, false, 30)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    features = EXCLUDED.features,
    is_active = true,
    updated_at = timezone('utc'::text, now());

-- ====================================================================
-- 2. SEED PAYMENT SETTINGS SINGLETON
-- ====================================================================

INSERT INTO public.payment_settings (upi_id, account_name, bank_name, support_phone, payment_instructions)
SELECT 
    '', 
    'FMS Platform', 
    '', 
    '9470870830', 
    'Pay via UPI or Bank Transfer. After payment, enter the UTR/transaction reference number below.'
WHERE NOT EXISTS (SELECT 1 FROM public.payment_settings LIMIT 1);

-- ====================================================================
-- 3. SEED INITIAL TENANT: BCE-BGP (BHAGALPUR COLLEGE OF ENGINEERING)
-- ====================================================================

INSERT INTO public.colleges (
    id,
    name,
    code,
    slug,
    tagline,
    established_year,
    aicte_approved,
    affiliated_university,
    primary_color,
    secondary_color,
    accent_color,
    is_active
)
VALUES (
    'bce00000-0000-0000-0000-000000000001',
    'Bhagalpur College of Engineering',
    'BCE-BGP',
    'bce-bgp',
    'Govt. of Bihar | Dept. of Science, Technology & Technical Education',
    1960,
    true,
    'Bihar Engineering University, Patna',
    '#0B192C',
    '#1E3E62',
    '#F6995C',
    true
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    tagline = EXCLUDED.tagline,
    is_active = true,
    updated_at = timezone('utc'::text, now());

-- ====================================================================
-- 4. SEED INITIAL BILLING ACCOUNT FOR BCE-BGP
-- ====================================================================

INSERT INTO public.college_billing_accounts (
    college_id,
    plan_type,
    access_status,
    subscription_status
)
VALUES (
    'bce00000-0000-0000-0000-000000000001',
    'FREE',
    'UNLOCKED',
    'ACTIVE'
)
ON CONFLICT (college_id) DO NOTHING;

-- ====================================================================
-- 5. AUTOMATED SUPER ADMIN ENROLLMENT & LINKAGE FUNCTION
-- ====================================================================

CREATE OR REPLACE FUNCTION public.sync_platform_super_admin(p_user_id UUID, p_email TEXT, p_name TEXT DEFAULT 'Aditya (Platform Super Admin)')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_email TEXT;
BEGIN
    v_clean_email := LOWER(TRIM(p_email));
    
    -- 1. Ensure Platform Super Admin record
    INSERT INTO public.platform_admins (user_id, email, name, role, is_active, updated_at)
    VALUES (
        p_user_id,
        v_clean_email,
        COALESCE(NULLIF(p_name, ''), 'Aditya (Platform Super Admin)'),
        'PLATFORM_SUPER_ADMIN',
        true,
        timezone('utc'::text, now())
    )
    ON CONFLICT (user_id) DO UPDATE SET
        email = EXCLUDED.email,
        role = 'PLATFORM_SUPER_ADMIN',
        is_active = true,
        updated_at = timezone('utc'::text, now());

    -- 2. Ensure initial College Admin membership for master tenant BCE-BGP
    INSERT INTO public.college_memberships (college_id, user_id, role, status, updated_at)
    VALUES (
        'bce00000-0000-0000-0000-000000000001',
        p_user_id,
        'COLLEGE_ADMIN',
        'ACTIVE',
        timezone('utc'::text, now())
    )
    ON CONFLICT (college_id, user_id) DO UPDATE SET
        role = 'COLLEGE_ADMIN',
        status = 'ACTIVE',
        updated_at = timezone('utc'::text, now());
END;
$$;

-- 5.1 Immediate check: if auth.users already contains iambestadi@gmail.com, link now
DO $$
DECLARE
    v_user RECORD;
BEGIN
    SELECT id, email, raw_user_meta_data 
    INTO v_user 
    FROM auth.users 
    WHERE LOWER(email) = 'iambestadi@gmail.com' 
    LIMIT 1;

    IF FOUND THEN
        PERFORM public.sync_platform_super_admin(
            v_user.id, 
            v_user.email, 
            COALESCE(v_user.raw_user_meta_data->>'name', 'Aditya (Platform Super Admin)')
        );
    END IF;
END $$;

-- 5.2 Trigger on auth.users for future registration of iambestadi@gmail.com
CREATE OR REPLACE FUNCTION public.handle_super_admin_auth_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF LOWER(NEW.email) = 'iambestadi@gmail.com' THEN
        PERFORM public.sync_platform_super_admin(
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'name', 'Aditya (Platform Super Admin)')
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_super_admin_on_registration ON auth.users;
CREATE TRIGGER trg_sync_super_admin_on_registration
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_super_admin_auth_registration();

-- ====================================================================
-- 6. RELOAD SCHEMA CACHE
-- ====================================================================
NOTIFY pgrst, 'reload schema';


-- ====================================================================
-- MIGRATION: 20260923000001_institution_logos_and_rls.sql
-- ====================================================================

-- ====================================================================
-- FMS MULTI-TENANT PLATFORM
-- MIGRATION: 20260923000001_institution_logos_and_rls.sql
-- PURPOSE: Provision institution-logos public storage bucket with strict
--          scoped RLS, harden public.colleges RLS policies for College
--          Admins, and enforce database-level BEFORE UPDATE trigger
--          preventing non-Super Admins from mutating is_active, code, or slug.
-- ====================================================================

-- 1. PROVISION STORAGE BUCKET: 'institution-logos'
-- Public read for portal/report rendering, 5MB limit, strict image types.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'institution-logos',
    'institution-logos',
    true,
    5242880,
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

-- 2. STORAGE POLICIES FOR 'institution-logos'
-- Public read: Anyone (anon or authenticated) can view institution logos
DROP POLICY IF EXISTS "Public read institution logos" ON storage.objects;
CREATE POLICY "Public read institution logos" ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'institution-logos');

-- Super Admin can manage all objects in institution-logos
DROP POLICY IF EXISTS "Super Admin manages all institution logos" ON storage.objects;
CREATE POLICY "Super Admin manages all institution logos" ON storage.objects
    FOR ALL TO authenticated
    USING (
        bucket_id = 'institution-logos' AND
        public.is_platform_super_admin(auth.uid())
    )
    WITH CHECK (
        bucket_id = 'institution-logos' AND
        public.is_platform_super_admin(auth.uid())
    );

-- College Admin can insert/update/delete objects strictly within their own folder: <college_id>/...
DROP POLICY IF EXISTS "College Admin inserts own institution logo" ON storage.objects;
CREATE POLICY "College Admin inserts own institution logo" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'institution-logos' AND
        CASE 
            WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN public.is_college_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
            ELSE false
        END
    );

DROP POLICY IF EXISTS "College Admin updates own institution logo" ON storage.objects;
CREATE POLICY "College Admin updates own institution logo" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'institution-logos' AND
        CASE 
            WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN public.is_college_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
            ELSE false
        END
    )
    WITH CHECK (
        bucket_id = 'institution-logos' AND
        CASE 
            WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN public.is_college_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
            ELSE false
        END
    );

DROP POLICY IF EXISTS "College Admin deletes own institution logo" ON storage.objects;
CREATE POLICY "College Admin deletes own institution logo" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'institution-logos' AND
        CASE 
            WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN public.is_college_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
            ELSE false
        END
    );

-- 3. HARDEN RLS POLICIES ON public.colleges
-- College Admins can SELECT their own college even if temporarily inactive (for context inspection)
DROP POLICY IF EXISTS "College Admin reads own college" ON public.colleges;
CREATE POLICY "College Admin reads own college" ON public.colleges
    FOR SELECT TO authenticated
    USING (public.is_college_admin(auth.uid(), id));

-- College Admins can UPDATE their own college ONLY IF the institution is active
DROP POLICY IF EXISTS "College Admin updates own active college" ON public.colleges;
CREATE POLICY "College Admin updates own active college" ON public.colleges
    FOR UPDATE TO authenticated
    USING (
        is_active = true AND
        public.is_college_admin(auth.uid(), id)
    )
    WITH CHECK (
        is_active = true AND
        public.is_college_admin(auth.uid(), id)
    );

-- 4. DATABASE-LEVEL BEFORE UPDATE TRIGGER
-- Prohibits non-Super Admins from mutating is_active, code, or slug
CREATE OR REPLACE FUNCTION public.enforce_college_mutation_permissions()
RETURNS TRIGGER AS $$
BEGIN
    -- If actor is not a platform super admin, strictly prevent mutating critical identity columns
    IF NOT public.is_platform_super_admin(auth.uid()) THEN
        -- Prevent changing is_active
        IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
            RAISE EXCEPTION 'Forbidden: Only Platform Super Administrators can alter institution active status.';
        END IF;

        -- Prevent changing college code
        IF NEW.code IS DISTINCT FROM OLD.code THEN
            RAISE EXCEPTION 'Forbidden: Only Platform Super Administrators can alter institution code.';
        END IF;

        -- Prevent changing public portal slug
        IF NEW.slug IS DISTINCT FROM OLD.slug THEN
            RAISE EXCEPTION 'Forbidden: Only Platform Super Administrators can alter institution public slug.';
        END IF;
    END IF;

    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_college_mutation_permissions ON public.colleges;
CREATE TRIGGER trg_enforce_college_mutation_permissions
    BEFORE UPDATE ON public.colleges
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_college_mutation_permissions();


-- ====================================================================
-- MIGRATION: 20260923000001_super_admin_promotion_system.sql
-- ====================================================================

-- ====================================================================
-- FMS MULTI-TENANT PLATFORM
-- MIGRATION: 20260923000001_super_admin_promotion_system.sql
-- PURPOSE: Super Admin promotion/demotion system, backward compatibility
--          helpers, security-definer procedures, and safety invariants.
-- ====================================================================

-- 1. INDEX OPTIMIZATION
CREATE INDEX IF NOT EXISTS idx_platform_admins_active_user 
    ON public.platform_admins(user_id, is_active);

-- ====================================================================
-- 2. CENTRALIZED DATABASE AUTHORIZATION FUNCTIONS
-- ====================================================================

-- Function 2.1: public.is_super_admin
-- Checks if target_user_id is an active Platform Super Admin.
-- Defaults to auth.uid() when called within authenticated context.
CREATE OR REPLACE FUNCTION public.is_super_admin(target_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF target_user_id IS NULL THEN
        RETURN false;
    END IF;

    RETURN public.is_platform_super_admin(target_user_id);
END;
$$;

-- Function 2.2: public.is_admin
-- Returns true if user is an active Platform Super Admin OR has an active
-- institutional membership in any college.
CREATE OR REPLACE FUNCTION public.is_admin(target_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF target_user_id IS NULL THEN
        RETURN false;
    END IF;

    -- Platform Super Admins possess all administrative privileges
    IF public.is_platform_super_admin(target_user_id) THEN
        RETURN true;
    END IF;

    -- Active college admin in any college
    RETURN EXISTS (
        SELECT 1 FROM public.college_memberships
        WHERE user_id = target_user_id
          AND status = 'ACTIVE'
    );
END;
$$;

-- ====================================================================
-- 3. PROMOTION & DEMOTION PROCEDURES (SECURITY DEFINER)
-- ====================================================================

-- Function 3.1: public.promote_admin_to_super_admin
CREATE OR REPLACE FUNCTION public.promote_admin_to_super_admin(
    p_target_user_id UUID,
    p_actor_user_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_user RECORD;
    v_actor_email TEXT;
    v_result JSONB;
BEGIN
    -- 1. Validate that the actor is an authorized active Super Admin
    IF p_actor_user_id IS NULL OR NOT public.is_platform_super_admin(p_actor_user_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only an active Super Admin can promote administrators to Super Admin.';
    END IF;

    -- 2. Verify target user exists in auth.users
    SELECT id, email, raw_user_meta_data
    INTO v_target_user
    FROM auth.users
    WHERE id = p_target_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target administrator account not found in authentication system.';
    END IF;

    -- Resolve actor email for audit
    SELECT email INTO v_actor_email FROM auth.users WHERE id = p_actor_user_id;

    -- 3. Upsert into public.platform_admins
    INSERT INTO public.platform_admins (
        user_id,
        email,
        name,
        role,
        is_active,
        updated_at
    )
    VALUES (
        v_target_user.id,
        LOWER(TRIM(v_target_user.email)),
        COALESCE(v_target_user.raw_user_meta_data->>'name', split_part(v_target_user.email, '@', 1)),
        'PLATFORM_SUPER_ADMIN',
        true,
        timezone('utc'::text, now())
    )
    ON CONFLICT (user_id) DO UPDATE SET
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.platform_admins.name),
        role = 'PLATFORM_SUPER_ADMIN',
        is_active = true,
        updated_at = timezone('utc'::text, now());

    -- 4. Record audit log entry
    INSERT INTO public.audit_logs (
        actor_user_id,
        actor_email,
        action,
        entity_type,
        entity_id,
        details,
        metadata
    )
    VALUES (
        p_actor_user_id,
        v_actor_email,
        'ADMIN_PROMOTED_TO_SUPER_ADMIN',
        'platform_admins',
        p_target_user_id::text,
        format('Administrator %s (ID: %s) promoted to Super Admin by %s', v_target_user.email, p_target_user_id, v_actor_email),
        jsonb_build_object(
            'target_user_id', p_target_user_id,
            'target_email', v_target_user.email,
            'promoted_by', p_actor_user_id
        )
    );

    v_result := jsonb_build_object(
        'success', true,
        'user_id', p_target_user_id,
        'email', v_target_user.email,
        'role', 'SUPER_ADMIN'
    );

    RETURN v_result;
END;
$$;

-- Function 3.2: public.demote_super_admin_to_admin
CREATE OR REPLACE FUNCTION public.demote_super_admin_to_admin(
    p_target_user_id UUID,
    p_actor_user_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_user RECORD;
    v_actor_email TEXT;
    v_active_super_admins_count INTEGER;
    v_result JSONB;
BEGIN
    -- 1. Validate that the actor is an authorized active Super Admin
    IF p_actor_user_id IS NULL OR NOT public.is_platform_super_admin(p_actor_user_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only an active Super Admin can demote administrators.';
    END IF;

    -- 2. Prevent accidental self-demotion
    IF p_target_user_id = p_actor_user_id THEN
        RAISE EXCEPTION 'Forbidden: You cannot demote your own Super Admin account. Another Super Admin must perform this action.';
    END IF;

    -- 3. Verify target user exists in auth.users
    SELECT id, email INTO v_target_user FROM auth.users WHERE id = p_target_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target administrator account not found in authentication system.';
    END IF;

    -- 4. Protect Primary Super Admin
    IF LOWER(TRIM(v_target_user.email)) = 'iambestadi@gmail.com' 
       OR p_target_user_id = 'e606b509-7864-4150-8666-a6e47a63abc4'::UUID THEN
        RAISE EXCEPTION 'Forbidden: The Primary Super Admin cannot be demoted under any circumstance.';
    END IF;

    -- 5. Prevent demoting the last active Super Admin
    SELECT COUNT(*) INTO v_active_super_admins_count
    FROM public.platform_admins
    WHERE is_active = true;

    IF v_active_super_admins_count <= 1 THEN
        RAISE EXCEPTION 'Forbidden: Cannot demote the last remaining active Super Admin on the platform.';
    END IF;

    -- Resolve actor email for audit
    SELECT email INTO v_actor_email FROM auth.users WHERE id = p_actor_user_id;

    -- 6. Deactivate Platform Super Admin record
    UPDATE public.platform_admins
    SET is_active = false,
        updated_at = timezone('utc'::text, now())
    WHERE user_id = p_target_user_id;

    -- 7. Record audit log entry
    INSERT INTO public.audit_logs (
        actor_user_id,
        actor_email,
        action,
        entity_type,
        entity_id,
        details,
        metadata
    )
    VALUES (
        p_actor_user_id,
        v_actor_email,
        'SUPER_ADMIN_DEMOTED_TO_ADMIN',
        'platform_admins',
        p_target_user_id::text,
        format('Super Admin %s (ID: %s) demoted to Admin by %s', v_target_user.email, p_target_user_id, v_actor_email),
        jsonb_build_object(
            'target_user_id', p_target_user_id,
            'target_email', v_target_user.email,
            'demoted_by', p_actor_user_id
        )
    );

    v_result := jsonb_build_object(
        'success', true,
        'user_id', p_target_user_id,
        'email', v_target_user.email,
        'role', 'ADMIN'
    );

    RETURN v_result;
END;
$$;

-- ====================================================================
-- 4. COMPATIBILITY VIEW: public.admins
-- Provides a unified backward-compatible representation of all administrators
-- ====================================================================

CREATE OR REPLACE VIEW public.admins AS
SELECT 
    pa.id,
    pa.user_id,
    NULL::UUID AS college_id,
    pa.email,
    pa.name,
    'SUPER_ADMIN'::VARCHAR(50) AS role,
    CASE WHEN pa.is_active THEN 'ACTIVE' ELSE 'INACTIVE' END::VARCHAR(50) AS status,
    pa.created_at,
    pa.updated_at
FROM public.platform_admins pa
UNION ALL
SELECT 
    cm.id,
    cm.user_id,
    cm.college_id,
    COALESCE(u.email, 'admin@college.local') AS email,
    COALESCE(u.raw_user_meta_data->>'name', split_part(COALESCE(u.email, 'admin'), '@', 1)) AS name,
    'ADMIN'::VARCHAR(50) AS role,
    cm.status::VARCHAR(50) AS status,
    cm.created_at,
    cm.updated_at
FROM public.college_memberships cm
LEFT JOIN auth.users u ON u.id = cm.user_id
WHERE NOT EXISTS (
    SELECT 1 FROM public.platform_admins pa2 
    WHERE pa2.user_id = cm.user_id AND pa2.is_active = true
);

-- Ensure authenticated and service roles can query functions and view
GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.promote_admin_to_super_admin(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.demote_super_admin_to_admin(UUID, UUID) TO authenticated, service_role;
GRANT SELECT ON public.admins TO authenticated, service_role;


-- ====================================================================
-- MIGRATION: 20260927000001_response_exclusion_and_duplicates.sql
-- ====================================================================

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


-- ====================================================================
-- MIGRATION: 20260929000001_pwa_installations.sql
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.pwa_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  installation_id uuid NOT NULL,
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  installed_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  user_agent text NULL,
  device_type text NULL,
  CONSTRAINT pwa_installations_college_installation_unique UNIQUE (college_id, installation_id)
);

CREATE INDEX IF NOT EXISTS pwa_installations_college_idx ON public.pwa_installations(college_id);
ALTER TABLE public.pwa_installations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pwa_installations FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_pwa_installation(
  p_college_id uuid,
  p_installation_id uuid,
  p_user_agent text DEFAULT NULL,
  p_device_type text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.colleges WHERE id = p_college_id AND is_active = true) THEN
    RAISE EXCEPTION 'Active college not found';
  END IF;
  INSERT INTO public.pwa_installations (college_id, installation_id, user_id, user_agent, device_type)
  VALUES (p_college_id, p_installation_id, auth.uid(), left(p_user_agent, 512), left(p_device_type, 64))
  ON CONFLICT (college_id, installation_id) DO UPDATE SET
    last_seen_at = now(),
    user_id = COALESCE(auth.uid(), pwa_installations.user_id),
    user_agent = COALESCE(EXCLUDED.user_agent, pwa_installations.user_agent),
    device_type = COALESCE(EXCLUDED.device_type, pwa_installations.device_type);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_pwa_install_count(p_college_id uuid)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(DISTINCT installation_id)
  FROM public.pwa_installations
  WHERE college_id = p_college_id
    AND EXISTS (SELECT 1 FROM public.colleges WHERE id = p_college_id AND is_active = true);
$$;

REVOKE ALL ON FUNCTION public.record_pwa_installation(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_pwa_installation(uuid, uuid, text, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_pwa_install_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pwa_install_count(uuid) TO anon, authenticated;


-- ====================================================================
-- MIGRATION: 20260930000001_college_events_and_registrations.sql
-- ====================================================================

-- ====================================================================
-- FMS MULTI-TENANT PLATFORM
-- MIGRATION: 20260930000001_college_events_and_registrations.sql
-- PURPOSE: Production-ready, tenant-isolated College Events & Student Registration
--          1. events table with lifecycle and optional payments
--          2. event_registrations table with duplicate protection & capacity handling
--          3. Atomic registration procedure register_for_event
--          4. Row Level Security policies (strict tenant isolation)
--          5. Storage bucket configuration for event-assets
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- 2. EVENTS TABLE (TENANT-SCOPED)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    venue TEXT,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    registration_start TIMESTAMPTZ,
    registration_end TIMESTAMPTZ,
    max_capacity INTEGER NULL CHECK (max_capacity IS NULL OR max_capacity > 0),
    status TEXT NOT NULL DEFAULT 'DRAFT' 
        CHECK (status IN ('DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED')),
    registration_enabled BOOLEAN NOT NULL DEFAULT true,
    payment_required BOOLEAN NOT NULL DEFAULT false,
    payment_amount NUMERIC(10,2) NULL CHECK (payment_amount IS NULL OR payment_amount >= 0),
    payment_upi_id TEXT NULL,
    payment_qr_url TEXT NULL,
    payment_instructions TEXT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_events_college_slug UNIQUE (college_id, slug),
    CONSTRAINT chk_events_dates CHECK (end_at >= start_at),
    CONSTRAINT chk_events_reg_dates CHECK (registration_end >= registration_start),
    CONSTRAINT chk_events_payment CHECK (
        payment_required = false OR (
            payment_amount IS NOT NULL 
            AND payment_amount >= 0 
            AND (payment_upi_id IS NOT NULL OR payment_qr_url IS NOT NULL)
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_events_college_status ON public.events(college_id, status);
CREATE INDEX IF NOT EXISTS idx_events_college_slug ON public.events(college_id, slug);
CREATE INDEX IF NOT EXISTS idx_events_dates ON public.events(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_events_reg_window ON public.events(registration_start, registration_end);

-- ====================================================================
-- 3. EVENT REGISTRATIONS TABLE
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.event_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    registration_number TEXT NOT NULL,
    student_name TEXT NOT NULL,
    email TEXT NOT NULL,
    mobile TEXT,
    branch_id UUID NULL REFERENCES public.branches(id) ON DELETE SET NULL,
    semester_id UUID NULL REFERENCES public.semesters(id) ON DELETE SET NULL,
    transaction_id TEXT NULL,
    payment_status TEXT NOT NULL DEFAULT 'NOT_REQUIRED' 
        CHECK (payment_status IN ('NOT_REQUIRED', 'PENDING', 'VERIFIED', 'REJECTED')),
    payment_screenshot_url TEXT NULL,
    registration_status TEXT NOT NULL DEFAULT 'REGISTERED' 
        CHECK (registration_status IN ('REGISTERED', 'CANCELLED', 'REJECTED')),
    registered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_event_reg_event_regnum UNIQUE (event_id, registration_number)
);

CREATE INDEX IF NOT EXISTS idx_event_reg_event_college ON public.event_registrations(event_id, college_id);
CREATE INDEX IF NOT EXISTS idx_event_reg_college ON public.event_registrations(college_id);
CREATE INDEX IF NOT EXISTS idx_event_reg_event_id ON public.event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_reg_regnum ON public.event_registrations(registration_number);
CREATE INDEX IF NOT EXISTS idx_event_reg_payment_status ON public.event_registrations(payment_status);
CREATE INDEX IF NOT EXISTS idx_event_reg_status ON public.event_registrations(event_id, registration_status, payment_status);
CREATE INDEX IF NOT EXISTS idx_event_reg_created ON public.event_registrations(registered_at DESC);

-- ====================================================================
-- 4. ATOMIC SAFE REGISTRATION FUNCTION (HANDLES CAPACITY & CONCURRENCY)
-- ====================================================================

CREATE OR REPLACE FUNCTION public.register_for_event(
    p_event_id UUID,
    p_registration_number TEXT,
    p_student_name TEXT,
    p_email TEXT,
    p_mobile TEXT,
    p_branch_id UUID DEFAULT NULL,
    p_semester_id UUID DEFAULT NULL,
    p_transaction_id TEXT DEFAULT NULL,
    p_payment_screenshot_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event RECORD;
    v_clean_reg_num TEXT;
    v_clean_email TEXT;
    v_clean_mobile TEXT;
    v_active_count INTEGER;
    v_new_reg_id UUID;
    v_pay_status VARCHAR(20);
BEGIN
    v_clean_reg_num := UPPER(TRIM(p_registration_number));
    v_clean_email := LOWER(TRIM(p_email));
    v_clean_mobile := TRIM(p_mobile);

    IF v_clean_reg_num = '' OR p_student_name IS NULL OR TRIM(p_student_name) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Registration number and student name are required.');
    END IF;

    -- Lock event row for atomic capacity check
    SELECT * INTO v_event 
    FROM public.events 
    WHERE id = p_event_id 
    FOR SHARE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Event not found.');
    END IF;

    IF v_event.status != 'PUBLISHED' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Registration is closed for this event.');
    END IF;

    IF NOT v_event.registration_enabled THEN
        RETURN jsonb_build_object('success', false, 'error', 'Registration is currently disabled for this event.');
    END IF;

    IF now() < v_event.registration_start THEN
        RETURN jsonb_build_object('success', false, 'error', 'Registration has not opened yet.');
    END IF;

    IF now() > v_event.registration_end THEN
        RETURN jsonb_build_object('success', false, 'error', 'Registration deadline has passed.');
    END IF;

    -- Validate branch and semester consistency with event college if provided
    IF p_branch_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id = p_branch_id AND college_id = v_event.college_id) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Invalid academic branch for this institution.');
        END IF;
    END IF;

    IF p_semester_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.semesters WHERE id = p_semester_id AND college_id = v_event.college_id) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Invalid academic semester for this institution.');
        END IF;
    END IF;

    -- Check duplicate registration
    IF EXISTS (
        SELECT 1 FROM public.event_registrations 
        WHERE event_id = p_event_id 
          AND UPPER(TRIM(registration_number)) = v_clean_reg_num
    ) THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'You are already registered for this event.',
            'code', 'ALREADY_REGISTERED'
        );
    END IF;

    -- Check capacity
    IF v_event.max_capacity IS NOT NULL THEN
        SELECT count(*) INTO v_active_count
        FROM public.event_registrations
        WHERE event_id = p_event_id
          AND registration_status = 'REGISTERED';

        IF v_active_count >= v_event.max_capacity THEN
            RETURN jsonb_build_object(
                'success', false, 
                'error', 'Event capacity has been reached. No seats available.',
                'code', 'CAPACITY_REACHED'
            );
        END IF;
    END IF;

    -- Determine payment status
    IF v_event.payment_required THEN
        v_pay_status := 'PENDING';
    ELSE
        v_pay_status := 'NOT_REQUIRED';
    END IF;

    INSERT INTO public.event_registrations (
        event_id,
        college_id,
        registration_number,
        student_name,
        email,
        mobile,
        branch_id,
        semester_id,
        transaction_id,
        payment_status,
        payment_screenshot_url,
        registration_status
    )
    VALUES (
        p_event_id,
        v_event.college_id,
        v_clean_reg_num,
        TRIM(p_student_name),
        v_clean_email,
        v_clean_mobile,
        p_branch_id,
        p_semester_id,
        NULLIF(TRIM(p_transaction_id), ''),
        v_pay_status,
        NULLIF(TRIM(p_payment_screenshot_url), ''),
        'REGISTERED'
    )
    RETURNING id INTO v_new_reg_id;

    RETURN jsonb_build_object(
        'success', true,
        'registration_id', v_new_reg_id,
        'event_id', p_event_id,
        'payment_status', v_pay_status,
        'message', 'Registration submitted successfully.'
    );
END;
$$;

-- ====================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- 5.1 EVENTS POLICIES
-- Public can view PUBLISHED events of active colleges
DROP POLICY IF EXISTS "Public view published events" ON public.events;
CREATE POLICY "Public view published events" ON public.events
    FOR SELECT TO anon, authenticated
    USING (
        status = 'PUBLISHED'
        AND EXISTS (SELECT 1 FROM public.colleges c WHERE c.id = events.college_id AND c.is_active = true)
    );

-- Admins manage their own college's events
DROP POLICY IF EXISTS "Admins manage college events" ON public.events;
CREATE POLICY "Admins manage college events" ON public.events
    FOR ALL TO authenticated
    USING (public.is_college_admin(auth.uid(), college_id))
    WITH CHECK (public.is_college_admin(auth.uid(), college_id));

-- 5.2 EVENT REGISTRATIONS POLICIES
-- Public access is strictly prohibited from viewing registration lists
REVOKE ALL ON public.event_registrations FROM anon, public;
GRANT SELECT, INSERT, UPDATE ON public.event_registrations TO authenticated;
GRANT ALL ON public.event_registrations TO service_role;

-- Admins manage their college's event registrations
DROP POLICY IF EXISTS "Admins manage college event registrations" ON public.event_registrations;
CREATE POLICY "Admins manage college event registrations" ON public.event_registrations
    FOR ALL TO authenticated
    USING (public.is_college_admin(auth.uid(), college_id))
    WITH CHECK (public.is_college_admin(auth.uid(), college_id));

-- Function permissions
GRANT EXECUTE ON FUNCTION public.register_for_event TO anon, authenticated, service_role;

-- ====================================================================
-- 6. STORAGE BUCKET FOR EVENT ASSETS (QR CODES & PAYMENT PROOFS)
-- ====================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'event-assets',
    'event-assets',
    true,
    5242880,
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

-- Storage RLS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
          AND tablename = 'objects' 
          AND policyname = 'Public can view event assets'
    ) THEN
        CREATE POLICY "Public can view event assets" ON storage.objects
            FOR SELECT TO anon, authenticated
            USING (bucket_id = 'event-assets');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
          AND tablename = 'objects' 
          AND policyname = 'Admins can manage event assets'
    ) THEN
        CREATE POLICY "Admins can manage event assets" ON storage.objects
            FOR ALL TO authenticated
            USING (bucket_id = 'event-assets')
            WITH CHECK (bucket_id = 'event-assets');
    END IF;
END $$;

-- 7. NOTIFY POSTGREST TO RELOAD SCHEMA CACHE IMMEDIATELY
NOTIFY pgrst, 'reload schema';


-- ====================================================================
-- MIGRATION: 20260930000002_landing_page_modules_toggles.sql
-- ====================================================================

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


-- ====================================================================
-- MIGRATION: 20260930000003_event_programs_and_categories.sql
-- ====================================================================

-- ====================================================================
-- FMS MULTI-TENANT PLATFORM
-- MIGRATION: 20260930000003_event_programs_and_categories.sql
-- PURPOSE: Program-wise Event Registration Management
--          1. event_categories — Sports, Cultural, Technical, etc.
--          2. event_programs — Cricket, Debate, etc. with individual/team config
--          3. program_registrations — Per-program registrations (individual or team)
--          4. program_registration_members — Team member records
--          5. RLS policies for all new tables
--          6. Indexes and constraints
-- BACKWARD COMPATIBLE: Does NOT modify existing events or event_registrations tables
-- ====================================================================

-- ====================================================================
-- 1. ADD show_public_participants TO EXISTING EVENTS TABLE
-- ====================================================================

ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS show_public_participants BOOLEAN NOT NULL DEFAULT false;

-- ====================================================================
-- 2. EVENT CATEGORIES TABLE
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.event_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_event_category_name UNIQUE (event_id, name)
);

CREATE INDEX IF NOT EXISTS idx_event_categories_event ON public.event_categories(event_id);
CREATE INDEX IF NOT EXISTS idx_event_categories_college ON public.event_categories(college_id);
CREATE INDEX IF NOT EXISTS idx_event_categories_order ON public.event_categories(event_id, display_order);

-- ====================================================================
-- 3. EVENT PROGRAMS TABLE
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.event_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.event_categories(id) ON DELETE CASCADE,
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    rules TEXT,
    participation_type TEXT NOT NULL DEFAULT 'INDIVIDUAL'
        CHECK (participation_type IN ('INDIVIDUAL', 'TEAM', 'BOTH')),
    registration_fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (registration_fee >= 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    min_team_size INTEGER NULL CHECK (min_team_size IS NULL OR min_team_size > 0),
    max_team_size INTEGER NULL CHECK (max_team_size IS NULL OR max_team_size > 0),
    max_participants INTEGER NULL CHECK (max_participants IS NULL OR max_participants > 0),
    max_teams INTEGER NULL CHECK (max_teams IS NULL OR max_teams > 0),
    registration_open_at TIMESTAMPTZ,
    registration_close_at TIMESTAMPTZ,
    show_public_participants BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_event_program_slug UNIQUE (event_id, slug),
    CONSTRAINT chk_program_team_sizes CHECK (
        min_team_size IS NULL OR max_team_size IS NULL OR min_team_size <= max_team_size
    ),
    CONSTRAINT chk_program_reg_dates CHECK (
        registration_close_at IS NULL OR registration_open_at IS NULL OR registration_close_at >= registration_open_at
    )
);

CREATE INDEX IF NOT EXISTS idx_event_programs_event ON public.event_programs(event_id);
CREATE INDEX IF NOT EXISTS idx_event_programs_category ON public.event_programs(category_id);
CREATE INDEX IF NOT EXISTS idx_event_programs_college ON public.event_programs(college_id);
CREATE INDEX IF NOT EXISTS idx_event_programs_slug ON public.event_programs(event_id, slug);
CREATE INDEX IF NOT EXISTS idx_event_programs_order ON public.event_programs(event_id, display_order);

-- ====================================================================
-- 4. PROGRAM REGISTRATIONS TABLE
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.program_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES public.event_programs(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.event_categories(id) ON DELETE CASCADE,
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    registration_number TEXT NOT NULL,
    registration_type TEXT NOT NULL DEFAULT 'INDIVIDUAL'
        CHECK (registration_type IN ('INDIVIDUAL', 'TEAM')),

    -- Individual participant fields (also used for team leader)
    participant_name TEXT NOT NULL,
    student_id TEXT,
    email TEXT NOT NULL,
    mobile TEXT,
    branch TEXT,
    semester TEXT,
    gender TEXT,

    -- Team fields (NULL for individual registrations)
    team_name TEXT,

    -- Payment
    payment_status TEXT NOT NULL DEFAULT 'NOT_REQUIRED'
        CHECK (payment_status IN ('NOT_REQUIRED', 'PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED')),
    payment_reference TEXT,
    payment_method TEXT,
    payment_amount NUMERIC(10,2),
    payment_screenshot_url TEXT,
    paid_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Status
    registration_status TEXT NOT NULL DEFAULT 'REGISTERED'
        CHECK (registration_status IN ('REGISTERED', 'CANCELLED', 'REJECTED', 'WAITLISTED')),

    registered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT uq_program_reg_number UNIQUE (event_id, registration_number)
);

CREATE INDEX IF NOT EXISTS idx_prog_reg_event ON public.program_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_prog_reg_program ON public.program_registrations(program_id);
CREATE INDEX IF NOT EXISTS idx_prog_reg_category ON public.program_registrations(category_id);
CREATE INDEX IF NOT EXISTS idx_prog_reg_college ON public.program_registrations(college_id);
CREATE INDEX IF NOT EXISTS idx_prog_reg_payment ON public.program_registrations(payment_status);
CREATE INDEX IF NOT EXISTS idx_prog_reg_status ON public.program_registrations(registration_status);
CREATE INDEX IF NOT EXISTS idx_prog_reg_regnum ON public.program_registrations(registration_number);
CREATE INDEX IF NOT EXISTS idx_prog_reg_type ON public.program_registrations(program_id, registration_type);
CREATE INDEX IF NOT EXISTS idx_prog_reg_created ON public.program_registrations(registered_at DESC);

-- Prevent duplicate individual registration: same student_id + program
CREATE UNIQUE INDEX IF NOT EXISTS uq_prog_reg_individual_student
    ON public.program_registrations(program_id, UPPER(TRIM(student_id)))
    WHERE registration_type = 'INDIVIDUAL' AND registration_status = 'REGISTERED' AND student_id IS NOT NULL;

-- ====================================================================
-- 5. PROGRAM REGISTRATION MEMBERS (TEAM MEMBERS)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.program_registration_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES public.program_registrations(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES public.event_programs(id) ON DELETE CASCADE,
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    member_name TEXT NOT NULL,
    student_id TEXT,
    email TEXT,
    mobile TEXT,
    branch TEXT,
    semester TEXT,
    gender TEXT,
    is_leader BOOLEAN NOT NULL DEFAULT false,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_prog_reg_members_reg ON public.program_registration_members(registration_id);
CREATE INDEX IF NOT EXISTS idx_prog_reg_members_program ON public.program_registration_members(program_id);
CREATE INDEX IF NOT EXISTS idx_prog_reg_members_college ON public.program_registration_members(college_id);

-- Prevent same student being added to same team registration twice
CREATE UNIQUE INDEX IF NOT EXISTS uq_prog_reg_member_student
    ON public.program_registration_members(registration_id, UPPER(TRIM(student_id)))
    WHERE student_id IS NOT NULL;

-- ====================================================================
-- 6. ROW LEVEL SECURITY
-- ====================================================================

ALTER TABLE public.event_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_registration_members ENABLE ROW LEVEL SECURITY;

-- 6.1 EVENT CATEGORIES POLICIES
-- Public can view active categories of published events
DROP POLICY IF EXISTS "Public view event categories" ON public.event_categories;
CREATE POLICY "Public view event categories" ON public.event_categories
    FOR SELECT TO anon, authenticated
    USING (
        is_active = true
        AND EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = event_categories.event_id
              AND e.status = 'PUBLISHED'
              AND EXISTS (SELECT 1 FROM public.colleges c WHERE c.id = e.college_id AND c.is_active = true)
        )
    );

-- Admins manage their college's categories
DROP POLICY IF EXISTS "Admins manage event categories" ON public.event_categories;
CREATE POLICY "Admins manage event categories" ON public.event_categories
    FOR ALL TO authenticated
    USING (public.is_college_admin(auth.uid(), college_id))
    WITH CHECK (public.is_college_admin(auth.uid(), college_id));

-- 6.2 EVENT PROGRAMS POLICIES
-- Public can view active programs of published events
DROP POLICY IF EXISTS "Public view event programs" ON public.event_programs;
CREATE POLICY "Public view event programs" ON public.event_programs
    FOR SELECT TO anon, authenticated
    USING (
        is_active = true
        AND EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = event_programs.event_id
              AND e.status = 'PUBLISHED'
              AND EXISTS (SELECT 1 FROM public.colleges c WHERE c.id = e.college_id AND c.is_active = true)
        )
    );

-- Admins manage their college's programs
DROP POLICY IF EXISTS "Admins manage event programs" ON public.event_programs;
CREATE POLICY "Admins manage event programs" ON public.event_programs
    FOR ALL TO authenticated
    USING (public.is_college_admin(auth.uid(), college_id))
    WITH CHECK (public.is_college_admin(auth.uid(), college_id));

-- 6.3 PROGRAM REGISTRATIONS POLICIES
-- Public cannot view registrations directly (controlled by server-side logic)
REVOKE ALL ON public.program_registrations FROM anon, public;
GRANT SELECT, INSERT, UPDATE ON public.program_registrations TO authenticated;
GRANT ALL ON public.program_registrations TO service_role;

-- Admins manage their college's program registrations
DROP POLICY IF EXISTS "Admins manage program registrations" ON public.program_registrations;
CREATE POLICY "Admins manage program registrations" ON public.program_registrations
    FOR ALL TO authenticated
    USING (public.is_college_admin(auth.uid(), college_id))
    WITH CHECK (public.is_college_admin(auth.uid(), college_id));

-- 6.4 PROGRAM REGISTRATION MEMBERS POLICIES
REVOKE ALL ON public.program_registration_members FROM anon, public;
GRANT SELECT, INSERT, UPDATE ON public.program_registration_members TO authenticated;
GRANT ALL ON public.program_registration_members TO service_role;

-- Admins manage their college's team members
DROP POLICY IF EXISTS "Admins manage program reg members" ON public.program_registration_members;
CREATE POLICY "Admins manage program reg members" ON public.program_registration_members
    FOR ALL TO authenticated
    USING (public.is_college_admin(auth.uid(), college_id))
    WITH CHECK (public.is_college_admin(auth.uid(), college_id));

-- ====================================================================
-- 7. NOTIFY POSTGREST TO RELOAD SCHEMA CACHE
-- ====================================================================

NOTIFY pgrst, 'reload schema';


-- ====================================================================
-- MIGRATION: 20260930000004_add_registration_sheet_id.sql
-- ====================================================================

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


-- ====================================================================
-- MIGRATION: 20260930000005_internal_event_team_invitations.sql
-- ====================================================================

-- ====================================================================
-- FMS MULTI-TENANT PLATFORM
-- MIGRATION: 20260930000005_internal_event_team_invitations.sql
-- PURPOSE: Create event_team_invitations table for in-app invitation
--          workflow metadata. Google Sheets remains source of truth
--          for accepted memberships.
--
-- Replaces the earlier team_member_invitations migration (removed)
-- and the rename migration that failed on remote.
-- ====================================================================

-- Drop the old table/function if they somehow exist (idempotent cleanup)
DROP TABLE IF EXISTS public.team_member_invitations CASCADE;
DROP FUNCTION IF EXISTS public.create_team_member_invitation(UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,INTEGER,INTEGER);

-- Create the canonical invitation table
CREATE TABLE IF NOT EXISTS public.event_team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.event_programs(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  invited_registration_number TEXT NOT NULL,
  invited_name TEXT,
  invited_by_registration_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','ACCEPTED','DECLINED','EXPIRED','CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  notification_read_at TIMESTAMPTZ,
  acceptance_started_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_event_team_invite_team
  ON public.event_team_invitations(college_id, event_id, program_id, team_id, status);
CREATE INDEX IF NOT EXISTS idx_event_team_invite_student
  ON public.event_team_invitations(event_id, invited_registration_number, status);

-- RLS & Grants: service_role only (no browser access)
ALTER TABLE public.event_team_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_team_invitations FROM anon, authenticated, public;
GRANT ALL ON public.event_team_invitations TO service_role;

-- Atomic invitation creator with advisory locking
CREATE OR REPLACE FUNCTION public.create_team_member_invitation(
  p_college_id UUID, p_event_id UUID, p_program_id UUID, p_team_id TEXT,
  p_invited_registration_number TEXT, p_invited_name TEXT,
  p_leader_registration_number TEXT, p_expires_at TIMESTAMPTZ,
  p_current_member_count INTEGER, p_max_team_size INTEGER
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id UUID; reserved_count INTEGER;
BEGIN
  -- Lock per-student to prevent duplicate invitations
  PERFORM pg_advisory_xact_lock(hashtext(
    p_college_id::text || ':' || p_event_id::text || ':' || p_program_id::text
    || ':student:' || upper(trim(p_invited_registration_number))
  ));
  -- Lock per-team to serialize capacity checks
  PERFORM pg_advisory_xact_lock(hashtext(
    p_college_id::text || ':' || p_event_id::text || ':' || p_program_id::text
    || ':' || upper(p_team_id)
  ));

  SELECT count(*) INTO reserved_count FROM public.event_team_invitations
    WHERE college_id = p_college_id AND event_id = p_event_id
      AND program_id = p_program_id
      AND upper(team_id) = upper(p_team_id)
      AND status = 'PENDING' AND expires_at > now();

  IF p_current_member_count + reserved_count >= p_max_team_size THEN
    RAISE EXCEPTION 'Team capacity is full.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.event_team_invitations
    WHERE college_id = p_college_id AND event_id = p_event_id
      AND program_id = p_program_id
      AND upper(invited_registration_number) = upper(trim(p_invited_registration_number))
      AND status = 'PENDING' AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'An active invitation already exists.';
  END IF;

  INSERT INTO public.event_team_invitations(
    college_id, event_id, program_id, team_id,
    invited_registration_number, invited_name,
    invited_by_registration_number, status, expires_at
  ) VALUES (
    p_college_id, p_event_id, p_program_id, p_team_id,
    upper(trim(p_invited_registration_number)),
    nullif(trim(p_invited_name), ''),
    p_leader_registration_number, 'PENDING', p_expires_at
  ) RETURNING id INTO new_id;

  RETURN new_id;
END $$;

REVOKE ALL ON FUNCTION public.create_team_member_invitation(
  UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,INTEGER,INTEGER
) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_team_member_invitation(
  UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,INTEGER,INTEGER
) TO service_role;

NOTIFY pgrst, 'reload schema';


-- ====================================================================
-- MIGRATION: 20260930000006_team_join_requests.sql
-- ====================================================================

-- ====================================================================
-- FMS MULTI-TENANT PLATFORM
-- MIGRATION: 20260930000006_team_join_requests.sql
-- PURPOSE: Create team_join_requests table for "Find Team & Request
--          to Join" workflow. Google Sheets remains source of truth
--          for accepted memberships. This table only stores temporary
--          request workflow state.
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.team_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.event_programs(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  requester_registration_number TEXT NOT NULL,
  requester_name TEXT,
  requester_student_id TEXT,
  requester_branch TEXT,
  requester_semester TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED','EXPIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  responded_by TEXT,
  requester_notification_read_at TIMESTAMPTZ,
  leader_notification_read_at TIMESTAMPTZ
);

-- Indexes for common access patterns
CREATE INDEX IF NOT EXISTS idx_join_req_team
  ON public.team_join_requests(college_id, event_id, program_id, team_id, status);
CREATE INDEX IF NOT EXISTS idx_join_req_requester
  ON public.team_join_requests(event_id, requester_registration_number, status);

-- RLS & Grants: service_role only (no browser/anon access)
ALTER TABLE public.team_join_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.team_join_requests FROM anon, authenticated, public;
GRANT ALL ON public.team_join_requests TO service_role;

-- Atomic join request creator with advisory locking to prevent duplicates
CREATE OR REPLACE FUNCTION public.create_team_join_request(
  p_college_id UUID, p_event_id UUID, p_program_id UUID, p_team_id TEXT,
  p_requester_registration_number TEXT, p_requester_name TEXT,
  p_requester_student_id TEXT, p_requester_branch TEXT, p_requester_semester TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id UUID;
BEGIN
  -- Lock per-requester per-program to prevent duplicate requests
  PERFORM pg_advisory_xact_lock(hashtext(
    p_college_id::text || ':' || p_event_id::text || ':' || p_program_id::text
    || ':joinreq:' || upper(trim(p_requester_registration_number))
  ));

  -- Check for existing pending request for this program (any team)
  IF EXISTS (
    SELECT 1 FROM public.team_join_requests
    WHERE college_id = p_college_id AND event_id = p_event_id
      AND program_id = p_program_id
      AND upper(requester_registration_number) = upper(trim(p_requester_registration_number))
      AND status = 'PENDING'
  ) THEN
    RAISE EXCEPTION 'You already have a pending join request for this program.';
  END IF;

  INSERT INTO public.team_join_requests(
    college_id, event_id, program_id, team_id,
    requester_registration_number, requester_name,
    requester_student_id, requester_branch, requester_semester
  ) VALUES (
    p_college_id, p_event_id, p_program_id, p_team_id,
    upper(trim(p_requester_registration_number)),
    nullif(trim(p_requester_name), ''),
    nullif(trim(p_requester_student_id), ''),
    nullif(trim(p_requester_branch), ''),
    nullif(trim(p_requester_semester), '')
  ) RETURNING id INTO new_id;

  RETURN new_id;
END $$;

REVOKE ALL ON FUNCTION public.create_team_join_request(
  UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT
) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_team_join_request(
  UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT
) TO service_role;

NOTIFY pgrst, 'reload schema';


-- ====================================================================
-- MIGRATION: 20261004000002_small_events_google_registration.sql
-- ====================================================================

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
    ADD COLUMN IF NOT EXISTS performance_categories TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS participation_modes TEXT[] DEFAULT '{}',
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


-- ====================================================================
-- MIGRATION: 20261004000003_event_custom_categories.sql
-- ====================================================================

-- Add performance_categories and participation_modes columns to events table
-- These allow admins to configure custom categories per event instead of hardcoded defaults

ALTER TABLE events ADD COLUMN IF NOT EXISTS performance_categories TEXT[] DEFAULT NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS participation_modes TEXT[] DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN events.performance_categories IS 'Admin-configured performance category options for Google Form (e.g. Singing, Dance, Quiz). NULL = use defaults.';
COMMENT ON COLUMN events.participation_modes IS 'Admin-configured participation mode options for Google Form (e.g. Solo, Duet, Group). NULL = use defaults.';


-- ====================================================================
-- MIGRATION: 20261007000001_production_safe_backup_and_performance.sql
-- ====================================================================

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


-- ====================================================================
-- MIGRATION: 20261007000002_admin_single_session_policy.sql
-- ====================================================================

-- ====================================================================
-- CAMPUSFLOW SERVER-SIDE SINGLE-CONCURRENT-SESSION POLICY FOR ADMINISTRATORS
-- MIGRATION: 20261007000002_admin_single_session_policy.sql
-- PURPOSE:
--   1. Enforce strict single-concurrent-session per platform for admin accounts.
--   2. Max ONE active WEB session, max ONE active ANDROID session.
--   3. Simultaneous WEB + ANDROID allowed.
--   4. Atomic transaction / RPC to prevent race conditions during concurrent logins.
-- SAFETY:
--   Idempotent, backward-compatible, strictly additive. Zero data loss.
-- ====================================================================

-- 1. CREATE ADMIN_SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('WEB', 'ANDROID')),
    session_id TEXT NOT NULL UNIQUE,
    device_id TEXT NULL,
    user_agent TEXT NULL,
    ip_address TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NULL,
    revoked_at TIMESTAMPTZ NULL,
    revoke_reason TEXT NULL
);

-- 2. CREATE TARGETED PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_platform 
    ON public.admin_sessions (user_id, platform);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_plat_revoked 
    ON public.admin_sessions (user_id, platform, revoked_at);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_session_id 
    ON public.admin_sessions (session_id);

-- Enforces at most ONE active session per user per platform at the database engine level
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_admin_session_per_platform
    ON public.admin_sessions (user_id, platform)
    WHERE revoked_at IS NULL;

-- 3. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- Admins can view their own sessions
DROP POLICY IF EXISTS "Admins can view their own sessions" ON public.admin_sessions;
CREATE POLICY "Admins can view their own sessions"
    ON public.admin_sessions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Service role has full administrative access
DROP POLICY IF EXISTS "Service role full access on admin_sessions" ON public.admin_sessions;
CREATE POLICY "Service role full access on admin_sessions"
    ON public.admin_sessions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 4. ATOMIC RPC FUNCTION TO CLAIM / CREATE A NEW SESSION SAFELY
-- Automatically invalidates any existing active session for the same user and platform
-- Handles race conditions via row locking within an atomic transaction
CREATE OR REPLACE FUNCTION public.claim_admin_session(
    p_user_id UUID,
    p_platform TEXT,
    p_session_id TEXT,
    p_device_id TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    session_id TEXT,
    platform TEXT,
    revoked_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_revoked INTEGER := 0;
    v_new_id UUID;
BEGIN
    -- 1. Exclusively lock rows for this user & platform to prevent concurrent race conditions
    PERFORM 1 FROM public.admin_sessions AS s
    WHERE s.user_id = p_user_id AND s.platform = p_platform AND s.revoked_at IS NULL
    FOR UPDATE;

    -- 2. Revoke any existing active session for this user on this platform
    UPDATE public.admin_sessions AS s
    SET revoked_at = timezone('utc'::text, now()),
        revoke_reason = 'SUPERSEDED_BY_NEW_LOGIN'
    WHERE s.user_id = p_user_id
      AND s.platform = p_platform
      AND s.revoked_at IS NULL;
      
    GET DIAGNOSTICS v_revoked = ROW_COUNT;

    -- 3. Insert the new active session
    INSERT INTO public.admin_sessions (
        user_id,
        platform,
        session_id,
        device_id,
        user_agent,
        ip_address,
        expires_at,
        created_at,
        last_seen_at
    )
    VALUES (
        p_user_id,
        p_platform,
        p_session_id,
        p_device_id,
        p_user_agent,
        p_ip_address,
        p_expires_at,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    RETURNING admin_sessions.id INTO v_new_id;

    RETURN QUERY SELECT v_new_id, p_session_id, p_platform, v_revoked;
END;
$$;


-- ====================================================================
-- MIGRATION: 20261008000001_exam_and_online_testing_module.sql
-- ====================================================================

-- ====================================================================
-- CAMPUSFLOW MULTI-TENANT PLATFORM
-- MIGRATION: 20261008000001_exam_and_online_testing_module.sql
-- PURPOSE: Complete normalized schema for Exams & Online Testing Module:
--          exams, exam_branches, exam_subjects, exam_questions,
--          exam_question_options, exam_attempts, exam_answers.
-- ====================================================================

-- 1. EXAMS TABLE
CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    academic_session_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    semester_id UUID NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    exam_code VARCHAR(50) NOT NULL,
    description TEXT,
    instructions TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
    passing_percentage NUMERIC(5,2) NOT NULL DEFAULT 40.00 CHECK (passing_percentage >= 0 AND passing_percentage <= 100),
    negative_marking_enabled BOOLEAN NOT NULL DEFAULT false,
    negative_marks NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (negative_marks >= 0),
    max_attempts INTEGER NOT NULL DEFAULT 1 CHECK (max_attempts > 0),
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    result_visibility VARCHAR(50) NOT NULL DEFAULT 'IMMEDIATE' CHECK (result_visibility IN ('IMMEDIATE', 'AFTER_END_DATE', 'MANUAL')),
    show_correct_answers BOOLEAN NOT NULL DEFAULT true,
    randomize_questions BOOLEAN NOT NULL DEFAULT false,
    randomize_options BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ACTIVE', 'CLOSED', 'ARCHIVED')),
    total_marks NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    total_questions INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_exams_college_code UNIQUE (college_id, exam_code)
);

CREATE INDEX IF NOT EXISTS idx_exams_college ON public.exams(college_id);
CREATE INDEX IF NOT EXISTS idx_exams_status ON public.exams(college_id, status);
CREATE INDEX IF NOT EXISTS idx_exams_academic ON public.exams(college_id, academic_session_id, semester_id);
CREATE INDEX IF NOT EXISTS idx_exams_window ON public.exams(start_at, end_at);

-- 2. EXAM BRANCHES (Many-to-many: exam can apply to single, multiple, or all branches)
CREATE TABLE IF NOT EXISTS public.exam_branches (
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (exam_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_branches_branch ON public.exam_branches(branch_id);

-- 3. EXAM SUBJECTS (Many-to-many: exam can evaluate single or multi-subject scope)
CREATE TABLE IF NOT EXISTS public.exam_subjects (
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (exam_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_subjects_subject ON public.exam_subjects(subject_id);

-- 4. EXAM QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS public.exam_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    explanation TEXT,
    difficulty VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')),
    topic VARCHAR(100),
    marks NUMERIC(5,2) NOT NULL DEFAULT 1.00 CHECK (marks > 0),
    position INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_exam_questions_pos UNIQUE (exam_id, position)
);

CREATE INDEX IF NOT EXISTS idx_exam_questions_exam ON public.exam_questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_pos ON public.exam_questions(exam_id, position);

-- 5. EXAM QUESTION OPTIONS TABLE (Multiple choice options for questions)
CREATE TABLE IF NOT EXISTS public.exam_question_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.exam_questions(id) ON DELETE CASCADE,
    option_key VARCHAR(10) NOT NULL, -- 'A', 'B', 'C', 'D'
    option_text TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 1,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_exam_options_key UNIQUE (question_id, option_key),
    CONSTRAINT uq_exam_options_pos UNIQUE (question_id, position)
);

CREATE INDEX IF NOT EXISTS idx_exam_options_question ON public.exam_question_options(question_id);

-- 6. EXAM ATTEMPTS TABLE (Student attempts)
CREATE TABLE IF NOT EXISTS public.exam_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    student_name VARCHAR(255) NOT NULL,
    roll_number VARCHAR(100) NOT NULL,
    registration_number VARCHAR(100) NOT NULL,
    student_email VARCHAR(255),
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    semester_id UUID REFERENCES public.semesters(id) ON DELETE SET NULL,
    attempt_number INTEGER NOT NULL DEFAULT 1 CHECK (attempt_number > 0),
    status VARCHAR(50) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED', 'ABANDONED')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    deadline_at TIMESTAMPTZ NOT NULL,
    submitted_at TIMESTAMPTZ,
    total_marks NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    obtained_marks NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    is_passed BOOLEAN NOT NULL DEFAULT false,
    total_questions INTEGER NOT NULL DEFAULT 0,
    attempted_count INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    wrong_count INTEGER NOT NULL DEFAULT 0,
    unanswered_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_exam_attempts_reg UNIQUE (exam_id, registration_number, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam ON public.exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_college ON public.exam_attempts(college_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student ON public.exam_attempts(exam_id, registration_number);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_status ON public.exam_attempts(status);

-- 7. EXAM ANSWERS TABLE (Individual question responses in an attempt)
CREATE TABLE IF NOT EXISTS public.exam_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.exam_questions(id) ON DELETE CASCADE,
    selected_option_id UUID REFERENCES public.exam_question_options(id) ON DELETE SET NULL,
    answered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_correct BOOLEAN,
    marks_awarded NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT uq_exam_answers_attempt_q UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_answers_attempt ON public.exam_answers(attempt_id);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_answers ENABLE ROW LEVEL SECURITY;

-- 1. EXAMS POLICIES
DROP POLICY IF EXISTS "Public view published exams" ON public.exams;
CREATE POLICY "Public view published exams" ON public.exams
    FOR SELECT TO anon, authenticated
    USING (
        status IN ('PUBLISHED', 'ACTIVE', 'CLOSED')
        AND EXISTS (SELECT 1 FROM public.colleges c WHERE c.id = exams.college_id AND c.is_active = true)
    );

DROP POLICY IF EXISTS "Admins manage exams" ON public.exams;
CREATE POLICY "Admins manage exams" ON public.exams
    FOR ALL TO authenticated
    USING (public.is_college_admin(auth.uid(), college_id))
    WITH CHECK (public.is_college_admin(auth.uid(), college_id));

-- 2. EXAM BRANCHES & SUBJECTS POLICIES
DROP POLICY IF EXISTS "Public view exam branches" ON public.exam_branches;
CREATE POLICY "Public view exam branches" ON public.exam_branches
    FOR SELECT TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.exams e
            JOIN public.colleges c ON c.id = e.college_id
            WHERE e.id = exam_branches.exam_id
              AND e.status IN ('PUBLISHED', 'ACTIVE', 'CLOSED')
              AND c.is_active = true
        )
    );

DROP POLICY IF EXISTS "Admins manage exam branches" ON public.exam_branches;
CREATE POLICY "Admins manage exam branches" ON public.exam_branches
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.exams e
            WHERE e.id = exam_branches.exam_id
              AND public.is_college_admin(auth.uid(), e.college_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.exams e
            WHERE e.id = exam_branches.exam_id
              AND public.is_college_admin(auth.uid(), e.college_id)
        )
    );

DROP POLICY IF EXISTS "Public view exam subjects" ON public.exam_subjects;
CREATE POLICY "Public view exam subjects" ON public.exam_subjects
    FOR SELECT TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.exams e
            JOIN public.colleges c ON c.id = e.college_id
            WHERE e.id = exam_subjects.exam_id
              AND e.status IN ('PUBLISHED', 'ACTIVE', 'CLOSED')
              AND c.is_active = true
        )
    );

DROP POLICY IF EXISTS "Admins manage exam subjects" ON public.exam_subjects;
CREATE POLICY "Admins manage exam subjects" ON public.exam_subjects
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.exams e
            WHERE e.id = exam_subjects.exam_id
              AND public.is_college_admin(auth.uid(), e.college_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.exams e
            WHERE e.id = exam_subjects.exam_id
              AND public.is_college_admin(auth.uid(), e.college_id)
        )
    );

-- 3. EXAM QUESTIONS & OPTIONS POLICIES
DROP POLICY IF EXISTS "Admins manage exam questions" ON public.exam_questions;
CREATE POLICY "Admins manage exam questions" ON public.exam_questions
    FOR ALL TO authenticated
    USING (public.is_college_admin(auth.uid(), college_id))
    WITH CHECK (public.is_college_admin(auth.uid(), college_id));

DROP POLICY IF EXISTS "Admins manage exam options" ON public.exam_question_options;
CREATE POLICY "Admins manage exam options" ON public.exam_question_options
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.exam_questions q
            WHERE q.id = exam_question_options.question_id
              AND public.is_college_admin(auth.uid(), q.college_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.exam_questions q
            WHERE q.id = exam_question_options.question_id
              AND public.is_college_admin(auth.uid(), q.college_id)
        )
    );

-- 4. ATTEMPTS & ANSWERS POLICIES
DROP POLICY IF EXISTS "Public read own attempt by ID" ON public.exam_attempts;
CREATE POLICY "Public read own attempt by ID" ON public.exam_attempts
    FOR SELECT TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Public insert attempt" ON public.exam_attempts;
CREATE POLICY "Public insert attempt" ON public.exam_attempts
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Public update own attempt" ON public.exam_attempts;
CREATE POLICY "Public update own attempt" ON public.exam_attempts
    FOR UPDATE TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Admins view all attempts" ON public.exam_attempts;
CREATE POLICY "Admins view all attempts" ON public.exam_attempts
    FOR ALL TO authenticated
    USING (public.is_college_admin(auth.uid(), college_id))
    WITH CHECK (public.is_college_admin(auth.uid(), college_id));

DROP POLICY IF EXISTS "Public manage own answers" ON public.exam_answers;
CREATE POLICY "Public manage own answers" ON public.exam_answers
    FOR ALL TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.exam_attempts a
            WHERE a.id = exam_answers.attempt_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.exam_attempts a
            WHERE a.id = exam_answers.attempt_id
        )
    );

DROP POLICY IF EXISTS "Admins manage exam answers" ON public.exam_answers;
CREATE POLICY "Admins manage exam answers" ON public.exam_answers
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.exam_attempts a
            WHERE a.id = exam_answers.attempt_id
              AND public.is_college_admin(auth.uid(), a.college_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.exam_attempts a
            WHERE a.id = exam_answers.attempt_id
              AND public.is_college_admin(auth.uid(), a.college_id)
        )
    );


-- ====================================================================
-- MIGRATION: 20261008000002_academic_programmes_and_levels.sql
-- ====================================================================

-- ====================================================================
-- MIGRATION: 20261008000002_academic_programmes_and_levels.sql
-- PURPOSE: Generalized Academic Programme & Level Architecture
--          Supports Higher Ed (B.Tech, M.Tech, B.E., Diploma) and
--          School (Class 1-12) without forcing School into a semester model.
--          100% backward compatible with existing semesters table,
--          foreign keys, subjects, feedback forms, and exams.
-- ====================================================================

-- 1. ACADEMIC PROGRAMMES TABLE
CREATE TABLE IF NOT EXISTS public.academic_programmes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL,
    programme_type VARCHAR(50) NOT NULL DEFAULT 'UNDERGRADUATE' 
        CHECK (programme_type IN ('UNDERGRADUATE', 'POSTGRADUATE', 'DIPLOMA', 'SCHOOL', 'OTHER')),
    duration_years INTEGER NOT NULL DEFAULT 4 CHECK (duration_years >= 1 AND duration_years <= 15),
    level_type VARCHAR(50) NOT NULL DEFAULT 'SEMESTER'
        CHECK (level_type IN ('SEMESTER', 'CLASS', 'CUSTOM')),
    has_branches BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_academic_programmes_college_code UNIQUE (college_id, code)
);

CREATE INDEX IF NOT EXISTS idx_academic_programmes_college ON public.academic_programmes(college_id, is_active);

-- 2. EXTEND PUBLIC.SEMESTERS FOR GENERIC ACADEMIC LEVEL MODEL
-- Drop older restrictive constraints that assumed only 4 years and 8 semesters
ALTER TABLE public.semesters DROP CONSTRAINT IF EXISTS semesters_year_number_check;
ALTER TABLE public.semesters DROP CONSTRAINT IF EXISTS semesters_semester_number_check;
ALTER TABLE public.semesters DROP CONSTRAINT IF EXISTS uq_semesters_college_sem_no;

-- Make year_number and semester_number nullable to support School (which uses classes)
ALTER TABLE public.semesters ALTER COLUMN semester_number DROP NOT NULL;
ALTER TABLE public.semesters ALTER COLUMN year_number DROP NOT NULL;

-- Add generic programme and level columns
ALTER TABLE public.semesters ADD COLUMN IF NOT EXISTS programme_id UUID REFERENCES public.academic_programmes(id) ON DELETE CASCADE;
ALTER TABLE public.semesters ADD COLUMN IF NOT EXISTS level_type VARCHAR(50) NOT NULL DEFAULT 'SEMESTER';
ALTER TABLE public.semesters ADD COLUMN IF NOT EXISTS level_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.semesters ADD COLUMN IF NOT EXISTS class_number INTEGER NULL;
ALTER TABLE public.semesters ADD COLUMN IF NOT EXISTS code VARCHAR(50) NULL;
ALTER TABLE public.semesters ADD COLUMN IF NOT EXISTS display_name VARCHAR(150) NULL;

-- Relaxed check constraints: year_number and semester_number must be positive if present
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_semesters_year_positive') THEN
        ALTER TABLE public.semesters ADD CONSTRAINT chk_semesters_year_positive CHECK (year_number IS NULL OR year_number >= 1);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_semesters_sem_positive') THEN
        ALTER TABLE public.semesters ADD CONSTRAINT chk_semesters_sem_positive CHECK (semester_number IS NULL OR semester_number >= 1);
    END IF;
END $$;

-- 3. AUTOMATIC BACKFILL FOR EXISTING SEMESTERS
-- Ensure every college that already has semesters gets a default 'B.Tech' programme
INSERT INTO public.academic_programmes (college_id, name, code, programme_type, duration_years, level_type, has_branches, is_active)
SELECT DISTINCT 
    s.college_id,
    'B.Tech' AS name,
    'BTECH' AS code,
    'UNDERGRADUATE' AS programme_type,
    4 AS duration_years,
    'SEMESTER' AS level_type,
    true AS has_branches,
    true AS is_active
FROM public.semesters s
WHERE NOT EXISTS (
    SELECT 1 FROM public.academic_programmes ap 
    WHERE ap.college_id = s.college_id AND ap.code = 'BTECH'
);

-- Link all legacy semesters where programme_id is NULL to the college's B.Tech programme
UPDATE public.semesters s
SET 
    programme_id = ap.id,
    level_type = 'SEMESTER',
    level_number = COALESCE(s.semester_number, 1),
    display_name = s.name
FROM public.academic_programmes ap
WHERE s.college_id = ap.college_id 
  AND ap.code = 'BTECH' 
  AND s.programme_id IS NULL;

-- Fallback level_number backfill
UPDATE public.semesters
SET level_number = COALESCE(semester_number, class_number, 1)
WHERE level_number IS NULL OR level_number < 1;

-- 4. UNIQUE INDEXES & PERFORMANCE INDEXES
CREATE UNIQUE INDEX IF NOT EXISTS uq_semesters_college_prog_level 
ON public.semesters(college_id, programme_id, level_number) 
WHERE programme_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_semesters_programme ON public.semesters(programme_id, is_active);
CREATE INDEX IF NOT EXISTS idx_semesters_level_type ON public.semesters(college_id, level_type);

-- 5. COMPATIBILITY VIEW: ACADEMIC_LEVELS
CREATE OR REPLACE VIEW public.academic_levels AS
SELECT 
    s.id,
    s.college_id,
    s.programme_id,
    s.name,
    s.code,
    s.level_number,
    s.level_type,
    s.year_number,
    s.semester_number,
    s.class_number,
    s.display_name,
    s.is_active,
    s.created_at,
    s.updated_at,
    p.name AS programme_name,
    p.code AS programme_code,
    p.programme_type,
    p.has_branches
FROM public.semesters s
LEFT JOIN public.academic_programmes p ON s.programme_id = p.id;

-- 6. ROW LEVEL SECURITY (RLS) FOR ACADEMIC PROGRAMMES
ALTER TABLE public.academic_programmes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view active academic programmes" ON public.academic_programmes;
CREATE POLICY "Public view active academic programmes" ON public.academic_programmes
    FOR SELECT 
    USING (
        is_active = true AND 
        EXISTS (
            SELECT 1 FROM public.colleges c 
            WHERE c.id = academic_programmes.college_id AND c.is_active = true
        )
    );

DROP POLICY IF EXISTS "Admins manage academic programmes" ON public.academic_programmes;
CREATE POLICY "Admins manage academic programmes" ON public.academic_programmes
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.admins a 
            WHERE a.college_id = academic_programmes.college_id 
              AND a.status = 'ACTIVE' 
              AND a.id = auth.uid()
        )
    );


-- ====================================================================
-- MIGRATION: 20261008000003_performance_composite_indexes.sql
-- ====================================================================

-- ====================================================================
-- FMS MULTI-TENANT PLATFORM
-- MIGRATION: 20261008000003_performance_composite_indexes.sql
-- PURPOSE: Targeted composite performance indexes for 10K concurrency.
--          Fully idempotent, non-destructive, transaction-safe.
-- ====================================================================

-- 1. Optimize question analytics & accuracy aggregations in exam_answers
-- Serves faculty scorecard analytics and question difficulty breakdown.
CREATE INDEX IF NOT EXISTS idx_exam_answers_question_correct
    ON public.exam_answers(question_id, is_correct);

-- 2. Optimize exam attempt status filtering & proctoring dashboards
-- Serves exam submission count and status-filtered score retrieval.
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_status
    ON public.exam_attempts(exam_id, status);

-- 3. Optimize is_college_admin RLS evaluation
-- Covering index on (user_id, college_id, role, status) enables index-only scans.
CREATE INDEX IF NOT EXISTS idx_college_memberships_admin_lookup
    ON public.college_memberships(user_id, college_id, role, status);

