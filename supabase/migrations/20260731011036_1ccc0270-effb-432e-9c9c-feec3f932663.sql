REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_access_simulation(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_active_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_manage_org_users(uuid) FROM PUBLIC, anon, authenticated;