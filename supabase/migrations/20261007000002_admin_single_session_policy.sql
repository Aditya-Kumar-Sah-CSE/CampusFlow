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
    PERFORM 1 FROM public.admin_sessions
    WHERE user_id = p_user_id AND platform = p_platform AND revoked_at IS NULL
    FOR UPDATE;

    -- 2. Revoke any existing active session for this user on this platform
    UPDATE public.admin_sessions
    SET revoked_at = timezone('utc'::text, now()),
        revoke_reason = 'SUPERSEDED_BY_NEW_LOGIN'
    WHERE user_id = p_user_id
      AND platform = p_platform
      AND revoked_at IS NULL;
      
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
