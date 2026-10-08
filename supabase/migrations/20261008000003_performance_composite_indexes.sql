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
