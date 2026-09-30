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
