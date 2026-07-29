
CREATE OR REPLACE FUNCTION public.bootstrap_grancont_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_exists BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'grancont_admin') INTO v_exists;
  IF v_exists THEN RETURN false; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'grancont_admin')
  ON CONFLICT DO NOTHING;
  RETURN true;
END; $$;
REVOKE EXECUTE ON FUNCTION public.bootstrap_grancont_admin() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.bootstrap_grancont_admin() TO authenticated;
