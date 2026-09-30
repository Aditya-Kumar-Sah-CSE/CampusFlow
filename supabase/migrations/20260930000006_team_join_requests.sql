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
