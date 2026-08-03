-- 1. access_requests: permitir exclusão pelo solicitante (pendente) ou por admin/gestor
CREATE POLICY "access_requests_delete_own_or_admin"
ON public.access_requests FOR DELETE TO authenticated
USING (
  (requester_id = auth.uid() AND status = 'pending')
  OR public.is_super_admin()
  OR (organization_id IS NOT NULL AND public.has_org_role(organization_id, 'manager'))
);

-- 2. organizations: gestores não podem alterar campos sensíveis
CREATE OR REPLACE FUNCTION public.protect_organization_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN
    NEW.cnpj := OLD.cnpj;
    NEW.normalized_cnpj := OLD.normalized_cnpj;
    NEW.status := OLD.status;
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_protect_organization_fields ON public.organizations;
CREATE TRIGGER trg_protect_organization_fields
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.protect_organization_fields();

REVOKE EXECUTE ON FUNCTION public.protect_organization_fields() FROM PUBLIC, anon, authenticated;

-- 3. invitations: escrita apenas pelos fluxos de servidor (service_role)
REVOKE INSERT, UPDATE, DELETE ON public.invitations FROM anon, authenticated;
GRANT SELECT ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;

-- 4. bootstrap_super_admins: somente service_role
REVOKE ALL ON public.bootstrap_super_admins FROM anon, authenticated;
GRANT ALL ON public.bootstrap_super_admins TO service_role;

-- 5. funções SECURITY DEFINER internas: remover execução direta por usuários logados
REVOKE EXECUTE ON FUNCTION public.bootstrap_super_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_manage_license(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_use_feature(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_active_license(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_active_trial(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_valid_access(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_organization_role(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_organization_member(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.bootstrap_super_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_license(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_use_feature(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_active_license(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_active_trial(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_valid_access(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_organization_role(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_organization_member(uuid) TO service_role;