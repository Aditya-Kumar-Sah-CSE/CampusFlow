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
