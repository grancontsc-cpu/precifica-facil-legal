
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_grancont_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_read_simulation(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_write_simulation(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.audit_tax_profile() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.audit_tax_profile_line() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_grancont_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_simulation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_simulation(uuid) TO authenticated;
