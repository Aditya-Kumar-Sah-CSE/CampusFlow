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
