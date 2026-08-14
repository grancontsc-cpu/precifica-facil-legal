-- Endurecimento das funções SECURITY DEFINER expostas na API
-- 1) Nenhuma função SECURITY DEFINER do schema public fica acessível a PUBLIC/anon
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
  END LOOP;
END $$;

-- 2) Funções internas: sem EXECUTE para authenticated (só service_role/postgres)
REVOKE ALL ON FUNCTION public.bootstrap_super_admin() FROM authenticated;
REVOKE ALL ON FUNCTION public.can_access_simulation(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.is_active_user() FROM authenticated;

-- 3) Predicados usados dentro das políticas de RLS precisam de EXECUTE pelo
--    papel que consulta; mantidos apenas para authenticated e service_role.
GRANT EXECUTE ON FUNCTION public.can_read_simulation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_simulation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_grancont_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;

-- 4) RPCs de negócio: mantidas para authenticated pois já validam a sessão e o
--    papel do chamador internamente (onboarding exige auth.uid() + e-mail
--    confirmado; métricas exigem administrador geral).
GRANT EXECUTE ON FUNCTION public.complete_customer_onboarding(text, text, text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.metricas_precificacao(integer) TO authenticated, service_role;