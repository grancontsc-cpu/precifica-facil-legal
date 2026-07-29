REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_tax_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_tax_profile_line() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_snapshot_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;