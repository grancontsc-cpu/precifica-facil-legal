-- ==========================================================
-- Tabelas de alíquotas de ICMS (configuráveis e versionadas)
-- ==========================================================

CREATE TABLE public.icms_aliquotas_internas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uf text NOT NULL CHECK (char_length(uf) = 2),
  aliquota numeric(6,3) NOT NULL CHECK (aliquota >= 0 AND aliquota <= 100),
  fcp numeric(6,3) NOT NULL DEFAULT 0 CHECK (fcp >= 0 AND fcp <= 100),
  vigencia_inicio date NOT NULL DEFAULT CURRENT_DATE,
  vigencia_fim date,
  fonte text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE UNIQUE INDEX icms_internas_uf_vigencia_idx
  ON public.icms_aliquotas_internas (uf, vigencia_inicio);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.icms_aliquotas_internas TO authenticated;
GRANT ALL ON public.icms_aliquotas_internas TO service_role;

ALTER TABLE public.icms_aliquotas_internas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem aliquotas internas"
  ON public.icms_aliquotas_internas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin geral gerencia aliquotas internas"
  ON public.icms_aliquotas_internas FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE TABLE public.icms_aliquotas_interestaduais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uf_origem text NOT NULL CHECK (char_length(uf_origem) = 2),
  uf_destino text NOT NULL CHECK (char_length(uf_destino) = 2),
  aliquota numeric(6,3) NOT NULL CHECK (aliquota >= 0 AND aliquota <= 100),
  aliquota_importado numeric(6,3) NOT NULL DEFAULT 4 CHECK (aliquota_importado >= 0 AND aliquota_importado <= 100),
  vigencia_inicio date NOT NULL DEFAULT CURRENT_DATE,
  vigencia_fim date,
  fonte text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE UNIQUE INDEX icms_inter_par_vigencia_idx
  ON public.icms_aliquotas_interestaduais (uf_origem, uf_destino, vigencia_inicio);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.icms_aliquotas_interestaduais TO authenticated;
GRANT ALL ON public.icms_aliquotas_interestaduais TO service_role;

ALTER TABLE public.icms_aliquotas_interestaduais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem aliquotas interestaduais"
  ON public.icms_aliquotas_interestaduais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin geral gerencia aliquotas interestaduais"
  ON public.icms_aliquotas_interestaduais FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE TRIGGER trg_icms_internas_updated_at
  BEFORE UPDATE ON public.icms_aliquotas_internas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_icms_inter_updated_at
  BEFORE UPDATE ON public.icms_aliquotas_interestaduais
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==========================================================
-- Carga inicial (valores gerais — conferir e ajustar na tela de administração)
-- ==========================================================

INSERT INTO public.icms_aliquotas_internas (uf, aliquota, fcp, vigencia_inicio, fonte, observacao) VALUES
  ('AC',19.0,0,'2025-01-01','Carga inicial Precifica','Alíquota geral. Confirmar produtos com alíquota específica.'),
  ('AL',20.0,1,'2025-01-01','Carga inicial Precifica','Alíquota geral.'),
  ('AM',20.0,0,'2025-01-01','Carga inicial Precifica','Alíquota geral.'),
  ('AP',18.0,0,'2025-01-01','Carga inicial Precifica','Alíquota geral.'),
  ('BA',20.5,0,'2025-01-01','Carga inicial Precifica','Alíquota geral.'),
  ('CE',20.0,2,'2025-01-01','Carga inicial Precifica','Alíquota geral.'),
  ('DF',20.0,0,'2025-01-01','Carga inicial Precifica','Alíquota geral.'),
  ('ES',17.0,2,'2025-01-01','Carga inicial Precifica','Alíquota geral.'),
  ('GO',19.0,0,'2025-01-01','Carga inicial Precifica','Alíquota geral.'),
  ('MA',23.0,2,'2025-01-01','Carga inicial Precifica','Alíquota geral.'),
  ('MG',18.0,2,'2025-01-01','Carga inicial Precifica','Alíquota geral.'),
  ('MS',17.0,2,'2025-01-01','Carga inicial Precifica','Alíquota geral.'),
  ('MT',17.0,2,'2025-01-01','Carga inicial Precifica','Alíquota geral.'),
  ('PA',19.0,0,'2025-01-01','Carga inicial Precifica','Alíquota geral.'),
  ('PB',20.0,2,'2025-01-01','Carga inicial Precifica','Alíquota geral.'),
  ('PE',20.5,2,'2025-01-01','Carga inicial Precifica','Alíquota geral.'),
  ('PI',22.5,2,'2025-01-01','Carga inicial Precifica','Alíquota geral.'),
  ('PR',19.5,2,'2025-01-01','Carga inicial Precifica','Alíquota geral.'),
  ('RJ',20.0,2,'2025-01-01','Carga inicial Precifica','Alíquota geral; FCP de 2% na maioria dos produtos.'),
  ('RN',20.0,2,'2025-01-01','Carga inicial Precifica','Alíquota geral.'),
  ('RO',19.5,2,'2025-01-01','Carga inicial Precifica','Alíquota geral.'),
  ('RR',20.0,0,'2025-01-01','Carga inicial Precifica','Alíquota geral.'),
  ('RS',17.0,2,'2025-01-01','Carga inicial Precifica','Alíquota geral.'),
  ('SC',17.0,0,'2025-01-01','Carga inicial Precifica','Alíquota geral.'),
  ('SE',20.0,2,'2025-01-01','Carga inicial Precifica','Alíquota geral.'),
  ('SP',18.0,2,'2025-01-01','Carga inicial Precifica','Alíquota geral.'),
  ('TO',20.0,2,'2025-01-01','Carga inicial Precifica','Alíquota geral.');

-- Interestaduais: 7% quando a origem é Sul/Sudeste (exceto ES) e o destino é
-- Norte/Nordeste/Centro-Oeste ou ES; 12% nos demais casos; 4% para importado.
INSERT INTO public.icms_aliquotas_interestaduais
  (uf_origem, uf_destino, aliquota, aliquota_importado, vigencia_inicio, fonte)
SELECT
  o.uf,
  d.uf,
  CASE
    WHEN o.uf IN ('SP','RJ','MG','PR','SC','RS')
     AND d.uf NOT IN ('SP','RJ','MG','PR','SC','RS') THEN 7
    ELSE 12
  END,
  4,
  '2025-01-01',
  'Resolução do Senado 22/1989 e 13/2012'
FROM (SELECT unnest(ARRAY['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']) AS uf) o
CROSS JOIN (SELECT unnest(ARRAY['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']) AS uf) d
WHERE o.uf <> d.uf;

-- ==========================================================
-- Empresa: contribuinte de ICMS
-- ==========================================================
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS icms_contribuinte boolean NOT NULL DEFAULT true;