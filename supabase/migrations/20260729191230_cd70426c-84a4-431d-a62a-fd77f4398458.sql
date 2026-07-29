
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('grancont_admin');
CREATE TYPE public.org_role AS ENUM ('org_admin', 'viewer');
CREATE TYPE public.tax_scenario AS ENUM ('atual', 'transicao', 'novo', 'personalizado');
CREATE TYPE public.simulation_status AS ENUM ('rascunho', 'salva', 'arquivada');

-- UPDATED AT
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES (global)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_grancont_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'grancont_admin');
$$;

-- ORGANIZATIONS
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT,
  regime TEXT,
  uf TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  defaults JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_tax_profile_id UUID,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- MEMBERS
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_org_member(_org UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = _org AND m.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_org UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = _org AND m.user_id = auth.uid() AND m.role = 'org_admin');
$$;

-- PRODUCTS
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  sku TEXT,
  ncm TEXT,
  unidade TEXT NOT NULL DEFAULT 'unidade',
  valor_unitario NUMERIC(18,6) NOT NULL DEFAULT 0,
  defaults JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- TAX PROFILES
CREATE TABLE public.tax_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scenario public.tax_scenario NOT NULL DEFAULT 'atual',
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_to DATE,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  locked_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_profiles TO authenticated;
GRANT ALL ON public.tax_profiles TO service_role;
ALTER TABLE public.tax_profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tax_profile_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_profile_id UUID NOT NULL REFERENCES public.tax_profiles(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('compra','venda')),
  tax_id TEXT NOT NULL,
  label TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  rate NUMERIC(9,4) NOT NULL DEFAULT 0,
  base_mode TEXT NOT NULL DEFAULT 'padrao',
  base_manual NUMERIC(18,6) NOT NULL DEFAULT 0,
  base_reduction NUMERIC(9,4) NOT NULL DEFAULT 0,
  use_manual_tax BOOLEAN NOT NULL DEFAULT false,
  manual_tax_value NUMERIC(18,6) NOT NULL DEFAULT 0,
  treatment TEXT NOT NULL DEFAULT 'incluido',
  credit_mode TEXT NOT NULL DEFAULT 'nao',
  credit_percent NUMERIC(9,4) NOT NULL DEFAULT 0,
  credit_manual NUMERIC(18,6) NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  UNIQUE (tax_profile_id, side, tax_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_profile_lines TO authenticated;
GRANT ALL ON public.tax_profile_lines TO service_role;
ALTER TABLE public.tax_profile_lines ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_default_tax_profile_fk
  FOREIGN KEY (default_tax_profile_id) REFERENCES public.tax_profiles(id) ON DELETE SET NULL;

-- SIMULATIONS
CREATE TABLE public.simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  tax_profile_id UUID REFERENCES public.tax_profiles(id) ON DELETE SET NULL,
  tax_profile_name TEXT,
  tax_profile_version INTEGER,
  tax_profile_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  overridden_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  titulo TEXT NOT NULL DEFAULT 'Simulação',
  produto_nome TEXT,
  status public.simulation_status NOT NULL DEFAULT 'salva',
  quantidade NUMERIC(18,6) NOT NULL DEFAULT 1,
  custo_liquido_unitario NUMERIC(18,6),
  preco_final NUMERIC(18,6),
  margem_efetiva NUMERIC(9,4),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulations TO authenticated;
GRANT ALL ON public.simulations TO service_role;
ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.simulation_purchase_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  chave TEXT NOT NULL,
  valor NUMERIC(18,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.simulation_purchase_lines TO authenticated;
GRANT ALL ON public.simulation_purchase_lines TO service_role;
ALTER TABLE public.simulation_purchase_lines ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.simulation_tax_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('compra','venda')),
  tax_id TEXT NOT NULL,
  label TEXT NOT NULL,
  rate NUMERIC(9,4) NOT NULL DEFAULT 0,
  base NUMERIC(18,6) NOT NULL DEFAULT 0,
  valor NUMERIC(18,6) NOT NULL DEFAULT 0,
  credito NUMERIC(18,6) NOT NULL DEFAULT 0,
  treatment TEXT NOT NULL DEFAULT 'incluido',
  credit_mode TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.simulation_tax_lines TO authenticated;
GRANT ALL ON public.simulation_tax_lines TO service_role;
ALTER TABLE public.simulation_tax_lines ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.simulation_sale_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  chave TEXT NOT NULL,
  descricao TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'percentual',
  valor NUMERIC(18,6) NOT NULL DEFAULT 0,
  valor_unitario NUMERIC(18,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.simulation_sale_expenses TO authenticated;
GRANT ALL ON public.simulation_sale_expenses TO service_role;
ALTER TABLE public.simulation_sale_expenses ENABLE ROW LEVEL SECURITY;

-- AUDIT LOGS
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- TRIGGERS updated_at
CREATE TRIGGER t_profiles_upd BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_org_upd BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_products_upd BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_taxp_upd BEFORE UPDATE ON public.tax_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_sim_upd BEFORE UPDATE ON public.simulations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- NEW USER TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- AUDIT TRIGGER FOR TAX PROFILES
CREATE OR REPLACE FUNCTION public.audit_tax_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org UUID; v_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN v_org := OLD.organization_id; v_id := OLD.id;
  ELSE v_org := NEW.organization_id; v_id := NEW.id; END IF;
  INSERT INTO public.audit_logs (organization_id, actor_id, entity, entity_id, action, before_data, after_data)
  VALUES (v_org, auth.uid(), TG_TABLE_NAME, v_id, lower(TG_OP),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER t_audit_tax_profiles AFTER INSERT OR UPDATE OR DELETE ON public.tax_profiles FOR EACH ROW EXECUTE FUNCTION public.audit_tax_profile();

CREATE OR REPLACE FUNCTION public.audit_tax_profile_line()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org UUID; v_pid UUID; v_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN v_pid := OLD.tax_profile_id; v_id := OLD.id;
  ELSE v_pid := NEW.tax_profile_id; v_id := NEW.id; END IF;
  SELECT organization_id INTO v_org FROM public.tax_profiles WHERE id = v_pid;
  INSERT INTO public.audit_logs (organization_id, actor_id, entity, entity_id, action, before_data, after_data)
  VALUES (v_org, auth.uid(), TG_TABLE_NAME, v_id, lower(TG_OP),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER t_audit_tax_profile_lines AFTER INSERT OR UPDATE OR DELETE ON public.tax_profile_lines FOR EACH ROW EXECUTE FUNCTION public.audit_tax_profile_line();

-- IMMUTABILITY: snapshots cannot be updated
CREATE OR REPLACE FUNCTION public.block_snapshot_update()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Registros de snapshot da simulação são imutáveis'; END; $$;
CREATE TRIGGER t_imm_purchase BEFORE UPDATE ON public.simulation_purchase_lines FOR EACH ROW EXECUTE FUNCTION public.block_snapshot_update();
CREATE TRIGGER t_imm_taxlines BEFORE UPDATE ON public.simulation_tax_lines FOR EACH ROW EXECUTE FUNCTION public.block_snapshot_update();
CREATE TRIGGER t_imm_expenses BEFORE UPDATE ON public.simulation_sale_expenses FOR EACH ROW EXECUTE FUNCTION public.block_snapshot_update();

-- POLICIES
CREATE POLICY "profiles_select_self_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_grancont_admin() OR EXISTS (
    SELECT 1 FROM public.organization_members a JOIN public.organization_members b ON a.organization_id = b.organization_id
    WHERE a.user_id = auth.uid() AND b.user_id = public.profiles.id));
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_grancont_admin());

CREATE POLICY "org_select" ON public.organizations FOR SELECT TO authenticated
  USING (public.is_grancont_admin() OR public.is_org_member(id));
CREATE POLICY "org_insert" ON public.organizations FOR INSERT TO authenticated WITH CHECK (public.is_grancont_admin());
CREATE POLICY "org_update" ON public.organizations FOR UPDATE TO authenticated
  USING (public.is_grancont_admin() OR public.is_org_admin(id))
  WITH CHECK (public.is_grancont_admin() OR public.is_org_admin(id));
CREATE POLICY "org_delete" ON public.organizations FOR DELETE TO authenticated USING (public.is_grancont_admin());

CREATE POLICY "members_select" ON public.organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_grancont_admin() OR public.is_org_member(organization_id));
CREATE POLICY "members_write" ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (public.is_grancont_admin() OR public.is_org_admin(organization_id));
CREATE POLICY "members_update" ON public.organization_members FOR UPDATE TO authenticated
  USING (public.is_grancont_admin() OR public.is_org_admin(organization_id))
  WITH CHECK (public.is_grancont_admin() OR public.is_org_admin(organization_id));
CREATE POLICY "members_delete" ON public.organization_members FOR DELETE TO authenticated
  USING (public.is_grancont_admin() OR public.is_org_admin(organization_id));

CREATE POLICY "products_select" ON public.products FOR SELECT TO authenticated
  USING (public.is_grancont_admin() OR public.is_org_member(organization_id));
CREATE POLICY "products_insert" ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.is_grancont_admin() OR public.is_org_admin(organization_id));
CREATE POLICY "products_update" ON public.products FOR UPDATE TO authenticated
  USING (public.is_grancont_admin() OR public.is_org_admin(organization_id))
  WITH CHECK (public.is_grancont_admin() OR public.is_org_admin(organization_id));
CREATE POLICY "products_delete" ON public.products FOR DELETE TO authenticated
  USING (public.is_grancont_admin() OR public.is_org_admin(organization_id));

CREATE POLICY "taxp_select" ON public.tax_profiles FOR SELECT TO authenticated
  USING (public.is_grancont_admin() OR (active AND (organization_id IS NULL OR public.is_org_member(organization_id))));
CREATE POLICY "taxp_insert" ON public.tax_profiles FOR INSERT TO authenticated WITH CHECK (public.is_grancont_admin());
CREATE POLICY "taxp_update" ON public.tax_profiles FOR UPDATE TO authenticated
  USING (public.is_grancont_admin()) WITH CHECK (public.is_grancont_admin());
CREATE POLICY "taxp_delete" ON public.tax_profiles FOR DELETE TO authenticated USING (public.is_grancont_admin());

CREATE POLICY "taxpl_select" ON public.tax_profile_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tax_profiles p WHERE p.id = tax_profile_id
    AND (public.is_grancont_admin() OR (p.active AND (p.organization_id IS NULL OR public.is_org_member(p.organization_id))))));
CREATE POLICY "taxpl_write" ON public.tax_profile_lines FOR ALL TO authenticated
  USING (public.is_grancont_admin()) WITH CHECK (public.is_grancont_admin());

CREATE POLICY "sim_select" ON public.simulations FOR SELECT TO authenticated
  USING (public.is_grancont_admin() OR public.is_org_member(organization_id));
CREATE POLICY "sim_insert" ON public.simulations FOR INSERT TO authenticated
  WITH CHECK ((public.is_grancont_admin() OR public.is_org_admin(organization_id)) AND created_by = auth.uid());
CREATE POLICY "sim_update" ON public.simulations FOR UPDATE TO authenticated
  USING (public.is_grancont_admin() OR public.is_org_admin(organization_id))
  WITH CHECK (public.is_grancont_admin() OR public.is_org_admin(organization_id));
CREATE POLICY "sim_delete" ON public.simulations FOR DELETE TO authenticated
  USING (public.is_grancont_admin() OR public.is_org_admin(organization_id));

CREATE OR REPLACE FUNCTION public.can_read_simulation(_sim UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.simulations s WHERE s.id = _sim
    AND (public.is_grancont_admin() OR public.is_org_member(s.organization_id)));
$$;
CREATE OR REPLACE FUNCTION public.can_write_simulation(_sim UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.simulations s WHERE s.id = _sim
    AND (public.is_grancont_admin() OR public.is_org_admin(s.organization_id)));
$$;

CREATE POLICY "simpl_select" ON public.simulation_purchase_lines FOR SELECT TO authenticated USING (public.can_read_simulation(simulation_id));
CREATE POLICY "simpl_insert" ON public.simulation_purchase_lines FOR INSERT TO authenticated WITH CHECK (public.can_write_simulation(simulation_id));
CREATE POLICY "simpl_delete" ON public.simulation_purchase_lines FOR DELETE TO authenticated USING (public.can_write_simulation(simulation_id));

CREATE POLICY "simtl_select" ON public.simulation_tax_lines FOR SELECT TO authenticated USING (public.can_read_simulation(simulation_id));
CREATE POLICY "simtl_insert" ON public.simulation_tax_lines FOR INSERT TO authenticated WITH CHECK (public.can_write_simulation(simulation_id));
CREATE POLICY "simtl_delete" ON public.simulation_tax_lines FOR DELETE TO authenticated USING (public.can_write_simulation(simulation_id));

CREATE POLICY "simse_select" ON public.simulation_sale_expenses FOR SELECT TO authenticated USING (public.can_read_simulation(simulation_id));
CREATE POLICY "simse_insert" ON public.simulation_sale_expenses FOR INSERT TO authenticated WITH CHECK (public.can_write_simulation(simulation_id));
CREATE POLICY "simse_delete" ON public.simulation_sale_expenses FOR DELETE TO authenticated USING (public.can_write_simulation(simulation_id));

CREATE POLICY "audit_select" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_grancont_admin() OR (organization_id IS NOT NULL AND public.is_org_admin(organization_id)));
CREATE POLICY "audit_insert" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

CREATE INDEX idx_sim_org ON public.simulations(organization_id);
CREATE INDEX idx_sim_created ON public.simulations(created_at DESC);
CREATE INDEX idx_products_org ON public.products(organization_id);
CREATE INDEX idx_taxp_org ON public.tax_profiles(organization_id);
CREATE INDEX idx_audit_org ON public.audit_logs(organization_id, created_at DESC);
