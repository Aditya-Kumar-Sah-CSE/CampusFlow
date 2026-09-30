-- Convert bearer/email invitations into registration-number scoped in-app workflow metadata.
ALTER TABLE public.team_member_invitations RENAME TO event_team_invitations;
DROP FUNCTION IF EXISTS public.create_team_member_invitation(UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,INTEGER,INTEGER);

ALTER TABLE public.event_team_invitations
  DROP CONSTRAINT IF EXISTS team_member_invitations_status_check,
  DROP CONSTRAINT IF EXISTS event_team_invitations_status_check;

-- Existing email-link invitations cannot be safely mapped to verified event identities.
UPDATE public.event_team_invitations SET status='EXPIRED' WHERE status='PENDING';
UPDATE public.event_team_invitations SET status='DECLINED' WHERE status='REJECTED';
ALTER TABLE public.event_team_invitations
  ADD COLUMN invited_registration_number TEXT,
  ADD COLUMN notification_read_at TIMESTAMPTZ,
  ADD COLUMN responded_at TIMESTAMPTZ;

ALTER TABLE public.event_team_invitations
  DROP COLUMN IF EXISTS token_hash,
  DROP COLUMN IF EXISTS invited_email,
  DROP COLUMN IF EXISTS invited_student_id,
  DROP COLUMN IF EXISTS accepted_at,
  DROP COLUMN IF EXISTS rejected_at;

UPDATE public.event_team_invitations SET invited_registration_number='' WHERE invited_registration_number IS NULL;
ALTER TABLE public.event_team_invitations
  ALTER COLUMN invited_registration_number SET NOT NULL,
  ALTER COLUMN invited_registration_number DROP DEFAULT;

ALTER TABLE public.event_team_invitations
  ADD CONSTRAINT event_team_invitations_status_check
  CHECK (status IN ('PENDING','ACCEPTED','DECLINED','EXPIRED','CANCELLED'));

DROP INDEX IF EXISTS public.idx_team_invite_team;
DROP INDEX IF EXISTS public.idx_team_invite_email;
CREATE INDEX IF NOT EXISTS idx_event_team_invite_team ON public.event_team_invitations(college_id,event_id,program_id,team_id,status);
CREATE INDEX IF NOT EXISTS idx_event_team_invite_student ON public.event_team_invitations(event_id,invited_registration_number,status);
REVOKE ALL ON public.event_team_invitations FROM anon, authenticated, public;
GRANT ALL ON public.event_team_invitations TO service_role;

CREATE OR REPLACE FUNCTION public.create_team_member_invitation(
  p_college_id UUID, p_event_id UUID, p_program_id UUID, p_team_id TEXT,
  p_invited_registration_number TEXT, p_invited_name TEXT,
  p_leader_registration_number TEXT, p_expires_at TIMESTAMPTZ,
  p_current_member_count INTEGER, p_max_team_size INTEGER
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id UUID; reserved_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_college_id::text || ':' || p_event_id::text || ':' || p_program_id::text || ':student:' || upper(trim(p_invited_registration_number))));
  PERFORM pg_advisory_xact_lock(hashtext(p_college_id::text || ':' || p_event_id::text || ':' || p_program_id::text || ':' || upper(p_team_id)));
  SELECT count(*) INTO reserved_count FROM public.event_team_invitations
    WHERE college_id=p_college_id AND event_id=p_event_id AND program_id=p_program_id
      AND upper(team_id)=upper(p_team_id) AND status='PENDING' AND expires_at > now();
  IF p_current_member_count + reserved_count >= p_max_team_size THEN RAISE EXCEPTION 'Team capacity is full.'; END IF;
  IF EXISTS (SELECT 1 FROM public.event_team_invitations WHERE college_id=p_college_id AND event_id=p_event_id
      AND program_id=p_program_id AND upper(invited_registration_number)=upper(trim(p_invited_registration_number))
      AND status='PENDING' AND expires_at > now()) THEN RAISE EXCEPTION 'An active invitation already exists.'; END IF;
  INSERT INTO public.event_team_invitations(
    college_id,event_id,program_id,team_id,invited_registration_number,invited_name,
    invited_by_registration_number,status,expires_at
  ) VALUES (
    p_college_id,p_event_id,p_program_id,p_team_id,upper(trim(p_invited_registration_number)),
    nullif(trim(p_invited_name),''),p_leader_registration_number,'PENDING',p_expires_at
  ) RETURNING id INTO new_id;
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.create_team_member_invitation(UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,INTEGER,INTEGER) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_team_member_invitation(UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,INTEGER,INTEGER) TO service_role;

NOTIFY pgrst, 'reload schema';
