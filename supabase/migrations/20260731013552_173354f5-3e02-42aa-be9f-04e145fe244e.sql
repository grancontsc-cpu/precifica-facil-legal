CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.licenses (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','active','suspended','expired')),
  plan text NOT NULL DEFAULT 'free_trial',
  trial_started_at timestamptz NOT NULL DEFAULT now(),
  trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  activated_at timestamptz,
  expires_at timestamptz,
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.licenses TO authenticated;
GRANT ALL ON public.licenses TO service_role;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS licenses_select ON public.licenses;
CREATE POLICY licenses_select ON public.licenses FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS licenses_admin_write ON public.licenses;
CREATE POLICY licenses_admin_write ON public.licenses FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.licenca_valida(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN l.status = 'active' THEN (l.expires_at IS NULL OR l.expires_at > now())
      WHEN l.status = 'trial' THEN l.trial_ends_at > now()
      ELSE false
    END
    FROM public.licenses l WHERE l.user_id = _user_id
  ), false);
$$;
REVOKE ALL ON FUNCTION public.licenca_valida(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.licenca_valida(uuid) TO service_role;

DROP TRIGGER IF EXISTS licenses_updated_at ON public.licenses;
CREATE TRIGGER licenses_updated_at BEFORE UPDATE ON public.licenses
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.licenses (user_id, status, plan, activated_at, notes)
SELECT g.user_id, 'active', 'interno', now(), 'Administrador Geral'
FROM public.global_user_roles g WHERE g.role = 'super_admin'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.licenses (user_id)
SELECT p.id FROM public.profiles p
ON CONFLICT (user_id) DO NOTHING;