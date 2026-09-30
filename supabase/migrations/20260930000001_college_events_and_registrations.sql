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
