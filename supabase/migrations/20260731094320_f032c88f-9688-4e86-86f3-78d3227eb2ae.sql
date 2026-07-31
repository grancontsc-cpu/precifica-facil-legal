REVOKE EXECUTE ON FUNCTION public.can_manage_license(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_license(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.can_use_feature(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_feature(uuid, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_active_license(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_license(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_active_trial(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_trial(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_organization_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_organization_role(uuid, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_valid_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_valid_access(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_organization_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_organization_member(uuid) TO authenticated, service_role;