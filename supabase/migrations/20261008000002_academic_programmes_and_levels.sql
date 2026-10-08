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
