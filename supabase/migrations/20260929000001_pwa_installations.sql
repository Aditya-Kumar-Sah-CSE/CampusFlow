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
