ALTER TABLE public.tax_profiles ADD COLUMN IF NOT EXISTS marco_temporal text;
ALTER TABLE public.tax_profiles ADD CONSTRAINT tax_profiles_marco_temporal_chk
  CHECK (marco_temporal IS NULL OR marco_temporal IN ('atual','transicao2026','vigencia2027','definitivo2033'));
CREATE INDEX IF NOT EXISTS tax_profiles_org_marco_idx ON public.tax_profiles (organization_id, marco_temporal) WHERE active;