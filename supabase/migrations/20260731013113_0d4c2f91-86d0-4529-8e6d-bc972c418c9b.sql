ALTER TABLE public.access_requests
  ADD COLUMN IF NOT EXISTS requested_area text;

ALTER TABLE public.access_requests
  DROP CONSTRAINT IF EXISTS access_requests_requested_area_check;

ALTER TABLE public.access_requests
  ADD CONSTRAINT access_requests_requested_area_check
  CHECK (requested_area IS NULL OR requested_area IN ('painel_admin','gestao_empresa','simulacao'));