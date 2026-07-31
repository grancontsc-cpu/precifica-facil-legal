CREATE TABLE public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  simulation_id uuid,
  organization_id uuid REFERENCES public.organizations ON DELETE SET NULL,
  reason_code text NOT NULL DEFAULT 'sem_permissao_leitura',
  message text NOT NULL DEFAULT '',
  contact text,
  status text NOT NULL DEFAULT 'pending',
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT access_requests_status_check CHECK (status IN ('pending','approved','rejected'))
);

CREATE INDEX access_requests_requester_idx ON public.access_requests (requester_id, created_at DESC);
CREATE INDEX access_requests_status_idx ON public.access_requests (status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.access_requests TO authenticated;
GRANT ALL ON public.access_requests TO service_role;

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "access_requests_select_own_or_admin"
  ON public.access_requests FOR SELECT TO authenticated
  USING (
    requester_id = auth.uid()
    OR public.is_super_admin()
    OR (organization_id IS NOT NULL AND public.has_org_role(organization_id, 'manager'))
  );

CREATE POLICY "access_requests_insert_self"
  ON public.access_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND status = 'pending');

CREATE POLICY "access_requests_update_admin"
  ON public.access_requests FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (organization_id IS NOT NULL AND public.has_org_role(organization_id, 'manager'))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (organization_id IS NOT NULL AND public.has_org_role(organization_id, 'manager'))
  );