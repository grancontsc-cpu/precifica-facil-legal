-- ============================================================
-- ETAPA 1: fundação do novo fluxo (aditiva)
-- ============================================================

-- 1. Schema privado + bootstrap de super admins -------------------------------
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
REVOKE ALL ON SCHEMA app_private FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS app_private.super_admin_bootstrap (
  email TEXT PRIMARY KEY,
  active BOOLEAN NOT NULL DEFAULT true,
  claimed_at TIMESTAMPTZ,
  claimed_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO app_private.super_admin_bootstrap (email) VALUES
  ('raulalmeida6@gmail.com'), ('grancontsc@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- 2. Colunas novas em tabelas existentes --------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS normalized_email TEXT,
  ADD COLUMN IF NOT EXISTS terms_version TEXT,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacy_version TEXT,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ;
UPDATE public.profiles SET normalized_email = lower(btrim(email)) WHERE normalized_email IS NULL AND email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_normalized_email ON public.profiles (normalized_email);

CREATE OR REPLACE FUNCTION public.set_normalized_email()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.normalized_email := lower(btrim(NEW.email)); RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION public.set_normalized_email() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_profiles_normalized_email ON public.profiles;
CREATE TRIGGER trg_profiles_normalized_email BEFORE INSERT OR UPDATE OF email ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_normalized_email();

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS normalized_cnpj TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
UPDATE public.organizations
   SET normalized_cnpj = NULLIF(regexp_replace(COALESCE(cnpj,''), '\D', '', 'g'), '')
 WHERE normalized_cnpj IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_organizations_normalized_cnpj
  ON public.organizations (normalized_cnpj) WHERE normalized_cnpj IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_normalized_cnpj()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.normalized_cnpj := NULLIF(regexp_replace(COALESCE(NEW.cnpj,''), '\D', '', 'g'), ''); RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION public.set_normalized_cnpj() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_organizations_normalized_cnpj ON public.organizations;
CREATE TRIGGER trg_organizations_normalized_cnpj BEFORE INSERT OR UPDATE OF cnpj ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.set_normalized_cnpj();

-- 3. Planos e recursos ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  plan_type TEXT NOT NULL DEFAULT 'paid',
  status TEXT NOT NULL DEFAULT 'active',
  default_duration_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.features TO authenticated;
GRANT ALL ON public.features TO service_role;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, feature_id)
);
GRANT SELECT ON public.plan_features TO authenticated;
GRANT ALL ON public.plan_features TO service_role;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

-- Seed do plano de teste e dos recursos padrão
INSERT INTO public.plans (name, description, plan_type, default_duration_days)
SELECT 'Teste Gratuito', 'Avaliação de 30 dias sem limites comerciais.', 'trial', 30
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE plan_type = 'trial');

INSERT INTO public.features (feature_key, name, description) VALUES
  ('precificacao_lite',  'Precificação Lite',        'Simulador rápido de precificação.'),
  ('precificacao_full',  'Precificação Completa',    'Simulador completo com perfis tributários.'),
  ('comparar_fornecedor','Comparação de fornecedores','Comparação de até cinco alternativas.'),
  ('produtos',           'Produtos',                  'Cadastro de produtos.'),
  ('historico',          'Histórico',                 'Histórico de simulações.'),
  ('relatorios',         'Relatórios',                'Relatórios gerenciais.'),
  ('exportacoes',        'Exportações',               'Exportar PDF, CSV e WhatsApp.')
ON CONFLICT (feature_key) DO NOTHING;

INSERT INTO public.plan_features (plan_id, feature_id, enabled)
SELECT p.id, f.id, true FROM public.plans p CROSS JOIN public.features f
WHERE p.plan_type = 'trial'
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- 4. Licenças por empresa ------------------------------------------------------
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.plans(id),
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activated_by UUID,
  ADD COLUMN IF NOT EXISTS suspended_by UUID,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

ALTER TABLE public.licenses DROP CONSTRAINT IF EXISTS licenses_pkey;
ALTER TABLE public.licenses ALTER COLUMN user_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_licenses_id ON public.licenses (id);
ALTER TABLE public.licenses ADD CONSTRAINT licenses_pkey PRIMARY KEY USING INDEX uq_licenses_id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_licenses_user ON public.licenses (user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_licenses_org ON public.licenses (organization_id) WHERE organization_id IS NOT NULL;

-- Vincula a licença existente à empresa do usuário, sem duplicar
UPDATE public.licenses l
   SET organization_id = m.organization_id
  FROM public.organization_members m
 WHERE l.organization_id IS NULL AND m.user_id = l.user_id AND m.membership_status = 'active'
   AND NOT EXISTS (SELECT 1 FROM public.licenses l2 WHERE l2.organization_id = m.organization_id);

UPDATE public.licenses SET plan_id = (SELECT id FROM public.plans WHERE plan_type = 'trial' LIMIT 1)
 WHERE plan_id IS NULL AND status IN ('trial','trial_expired');

CREATE TABLE IF NOT EXISTS public.license_feature_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (license_id, feature_id)
);
GRANT SELECT ON public.license_feature_overrides TO authenticated;
GRANT ALL ON public.license_feature_overrides TO service_role;
ALTER TABLE public.license_feature_overrides ENABLE ROW LEVEL SECURITY;

-- 5. Controle de teste gratuito -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trial_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  normalized_email TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  normalized_cnpj TEXT,
  trial_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_trial_claims_user ON public.trial_claims (user_id) WHERE user_id IS NOT NULL AND status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS uq_trial_claims_email ON public.trial_claims (normalized_email) WHERE normalized_email IS NOT NULL AND status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS uq_trial_claims_org ON public.trial_claims (organization_id) WHERE organization_id IS NOT NULL AND status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS uq_trial_claims_cnpj ON public.trial_claims (normalized_cnpj) WHERE normalized_cnpj IS NOT NULL AND status = 'active';
GRANT SELECT ON public.trial_claims TO authenticated;
GRANT ALL ON public.trial_claims TO service_role;
ALTER TABLE public.trial_claims ENABLE ROW LEVEL SECURITY;

-- 6. Eventos de licença, e-mail e vínculo ---------------------------------------
CREATE TABLE IF NOT EXISTS public.license_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  license_id UUID REFERENCES public.licenses(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  previous_expiration TIMESTAMPTZ,
  new_expiration TIMESTAMPTZ,
  reason TEXT,
  actor_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.license_events TO authenticated;
GRANT ALL ON public.license_events TO service_role;
ALTER TABLE public.license_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  normalized_email TEXT,
  event_type TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'supabase_auth_default',
  request_status TEXT NOT NULL DEFAULT 'requested',
  provider_status TEXT,
  error_code TEXT,
  error_message TEXT,
  request_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_events TO authenticated;
GRANT ALL ON public.email_events TO service_role;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.organization_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  normalized_cnpj TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  requested_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_join_request_pendente
  ON public.organization_join_requests (user_id, normalized_cnpj) WHERE status = 'pending';
GRANT SELECT ON public.organization_join_requests TO authenticated;
GRANT ALL ON public.organization_join_requests TO service_role;
ALTER TABLE public.organization_join_requests ENABLE ROW LEVEL SECURITY;

-- 7. Funções de autorização ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_active_trial(_org UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.licenses l
    WHERE l.organization_id = _org AND l.status = 'trial'
      AND l.trial_ends_at IS NOT NULL AND l.trial_ends_at > now());
$$;

CREATE OR REPLACE FUNCTION public.has_active_license(_org UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.licenses l
    WHERE l.organization_id = _org AND l.status IN ('active','courtesy')
      AND (l.starts_at IS NULL OR l.starts_at <= now())
      AND (l.expires_at IS NULL OR l.expires_at > now()));
$$;

CREATE OR REPLACE FUNCTION public.has_valid_access(_org UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin() OR (
    public.is_active_user()
    AND public.is_org_member(_org)
    AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = _org AND o.status = 'active')
    AND (public.has_active_trial(_org) OR public.has_active_license(_org))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_use_feature(_org UUID, _feature_key TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lic public.licenses%ROWTYPE; v_feature UUID; v_enabled BOOLEAN;
BEGIN
  IF public.is_super_admin() THEN RETURN true; END IF;
  IF NOT public.has_valid_access(_org) THEN RETURN false; END IF;
  SELECT id INTO v_feature FROM public.features WHERE feature_key = _feature_key AND active;
  IF v_feature IS NULL THEN RETURN false; END IF;
  SELECT * INTO v_lic FROM public.licenses WHERE organization_id = _org;
  IF v_lic.id IS NULL THEN RETURN false; END IF;
  SELECT enabled INTO v_enabled FROM public.license_feature_overrides
   WHERE license_id = v_lic.id AND feature_id = v_feature;
  IF v_enabled IS NOT NULL THEN RETURN v_enabled; END IF;
  IF v_lic.plan_id IS NULL THEN RETURN true; END IF;
  SELECT enabled INTO v_enabled FROM public.plan_features
   WHERE plan_id = v_lic.plan_id AND feature_id = v_feature;
  RETURN COALESCE(v_enabled, false);
END; $$;

CREATE OR REPLACE FUNCTION public.can_manage_license(_org UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_grancont_admin();
$$;

CREATE OR REPLACE FUNCTION public.is_organization_member(_org UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_org_member(_org);
$$;

CREATE OR REPLACE FUNCTION public.has_organization_role(_org UUID, _role TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_org_role(_org, _role);
$$;

-- 8. Bootstrap de Administrador Geral ---------------------------------------------
CREATE OR REPLACE FUNCTION public.bootstrap_super_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_email TEXT; v_conf TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  SELECT lower(btrim(u.email)), u.email_confirmed_at INTO v_email, v_conf
    FROM auth.users u WHERE u.id = v_uid;
  IF v_email IS NULL OR v_conf IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM app_private.super_admin_bootstrap b
                  WHERE b.email = v_email AND b.active) THEN RETURN false; END IF;

  INSERT INTO public.global_user_roles (user_id, role) VALUES (v_uid, 'super_admin')
  ON CONFLICT DO NOTHING;
  UPDATE public.profiles SET account_status = 'active' WHERE id = v_uid;
  UPDATE app_private.super_admin_bootstrap
     SET active = false, claimed_at = now(), claimed_user_id = v_uid
   WHERE email = v_email;
  INSERT INTO public.audit_logs (actor_id, entity, entity_id, action, after_data)
  VALUES (v_uid, 'global_user_roles', v_uid, 'bootstrap_super_admin',
          jsonb_build_object('email', v_email));
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.bootstrap_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_super_admin() TO authenticated;

-- 9. Onboarding idempotente do cliente ---------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_customer_onboarding(
  p_full_name TEXT, p_company_name TEXT, p_cnpj TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL, p_city TEXT DEFAULT NULL,
  p_terms_version TEXT DEFAULT '1.0', p_privacy_version TEXT DEFAULT '1.0')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid(); v_email TEXT; v_conf TIMESTAMPTZ;
  v_cnpj TEXT; v_org UUID; v_lic public.licenses%ROWTYPE;
  v_plan UUID; v_start TIMESTAMPTZ; v_super BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('status','unauthenticated'); END IF;
  SELECT lower(btrim(u.email)), u.email_confirmed_at INTO v_email, v_conf FROM auth.users u WHERE u.id = v_uid;
  IF v_conf IS NULL THEN RETURN jsonb_build_object('status','email_nao_confirmado'); END IF;

  PERFORM public.bootstrap_super_admin();
  v_super := public.is_super_admin();

  INSERT INTO public.profiles (id, full_name, email, account_status, email_verified_at)
  VALUES (v_uid, COALESCE(NULLIF(btrim(p_full_name),''), v_email), v_email, 'active', v_conf)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.profiles
     SET full_name = COALESCE(NULLIF(btrim(p_full_name),''), full_name),
         email = v_email, account_status = 'active', email_verified_at = COALESCE(email_verified_at, v_conf),
         terms_version = COALESCE(terms_version, p_terms_version),
         terms_accepted_at = COALESCE(terms_accepted_at, now()),
         privacy_version = COALESCE(privacy_version, p_privacy_version),
         privacy_accepted_at = COALESCE(privacy_accepted_at, now())
   WHERE id = v_uid;

  -- Já vinculado? nada a criar (idempotente)
  SELECT m.organization_id INTO v_org FROM public.organization_members m
   WHERE m.user_id = v_uid AND m.membership_status = 'active' LIMIT 1;
  IF v_org IS NOT NULL THEN
    RETURN jsonb_build_object('status','ja_concluido','organization_id',v_org,'super_admin',v_super);
  END IF;

  IF v_super THEN RETURN jsonb_build_object('status','super_admin','super_admin',true); END IF;

  IF EXISTS (SELECT 1 FROM public.organization_join_requests r WHERE r.user_id = v_uid AND r.status = 'pending') THEN
    RETURN jsonb_build_object('status','vinculo_pendente');
  END IF;

  v_cnpj := NULLIF(regexp_replace(COALESCE(p_cnpj,''), '\D', '', 'g'), '');

  IF v_cnpj IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.normalized_cnpj = v_cnpj) THEN
    INSERT INTO public.organization_join_requests (user_id, normalized_cnpj, organization_id, requested_name)
    SELECT v_uid, v_cnpj, o.id, btrim(p_company_name) FROM public.organizations o WHERE o.normalized_cnpj = v_cnpj
    ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('status','vinculo_pendente');
  END IF;

  INSERT INTO public.organizations (name, legal_name, cnpj, uf, city, status, created_by)
  VALUES (COALESCE(NULLIF(btrim(p_company_name),''), 'Minha empresa'),
          NULLIF(btrim(p_company_name),''), NULLIF(btrim(p_cnpj),''),
          COALESCE(NULLIF(btrim(p_state),''),'SP'), NULLIF(btrim(p_city),''), 'active', v_uid)
  RETURNING id INTO v_org;

  INSERT INTO public.organization_members (organization_id, user_id, role, membership_status, approved_by)
  VALUES (v_org, v_uid, 'manager', 'active', v_uid);

  -- Teste gratuito: uma única vez por conta, e-mail, empresa ou CNPJ
  IF EXISTS (SELECT 1 FROM public.trial_claims c
              WHERE c.status = 'active'
                AND (c.user_id = v_uid OR c.normalized_email = v_email
                     OR (v_cnpj IS NOT NULL AND c.normalized_cnpj = v_cnpj))) THEN
    RETURN jsonb_build_object('status','teste_ja_utilizado','organization_id',v_org);
  END IF;

  SELECT id INTO v_plan FROM public.plans WHERE plan_type = 'trial' AND status = 'active' LIMIT 1;
  v_start := now();

  SELECT * INTO v_lic FROM public.licenses WHERE organization_id = v_org;
  IF v_lic.id IS NULL THEN
    INSERT INTO public.licenses (user_id, organization_id, plan_id, status, plan,
                                 trial_started_at, trial_ends_at, starts_at)
    VALUES (v_uid, v_org, v_plan, 'trial', 'free_trial', v_start, v_start + interval '30 days', v_start)
    RETURNING * INTO v_lic;
  END IF;

  INSERT INTO public.trial_claims (user_id, normalized_email, organization_id, normalized_cnpj,
                                   trial_started_at, trial_ends_at, created_by)
  VALUES (v_uid, v_email, v_org, v_cnpj, v_start, v_start + interval '30 days', v_uid)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.license_events (organization_id, license_id, event_type, new_status, new_expiration, actor_user_id, reason)
  VALUES (v_org, v_lic.id, 'trial_started', 'trial', v_start + interval '30 days', v_uid, 'Início automático após confirmação do e-mail');

  INSERT INTO public.audit_logs (organization_id, actor_id, entity, entity_id, action, after_data)
  VALUES (v_org, v_uid, 'organizations', v_org, 'onboarding_concluido',
          jsonb_build_object('trial_ends_at', v_start + interval '30 days'));

  RETURN jsonb_build_object('status','criado','organization_id',v_org,'trial_ends_at', v_start + interval '30 days');
END; $$;
REVOKE ALL ON FUNCTION public.complete_customer_onboarding(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_customer_onboarding(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;

-- 10. Expiração automática de testes -------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_expired_trials()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_expirados INT := 0; v_avisos INT := 0;
BEGIN
  WITH exp AS (
    UPDATE public.licenses l SET status = 'trial_expired', updated_at = now()
     WHERE l.status = 'trial' AND l.trial_ends_at IS NOT NULL AND l.trial_ends_at <= now()
    RETURNING l.id, l.organization_id, l.trial_ends_at)
  INSERT INTO public.license_events (organization_id, license_id, event_type, previous_status, new_status, new_expiration, reason)
  SELECT organization_id, id, 'trial_expired', 'trial', 'trial_expired', trial_ends_at, 'Encerramento automático do período gratuito'
    FROM exp;
  GET DIAGNOSTICS v_expirados = ROW_COUNT;

  UPDATE public.trial_claims c SET status = 'expired'
   WHERE c.status = 'active' AND c.trial_ends_at <= now();

  WITH avisos AS (
    SELECT l.id, l.organization_id, l.trial_ends_at,
           CEIL(EXTRACT(EPOCH FROM (l.trial_ends_at - now())) / 86400)::INT AS dias
      FROM public.licenses l
     WHERE l.status = 'trial' AND l.trial_ends_at > now())
  INSERT INTO public.license_events (organization_id, license_id, event_type, new_status, new_expiration, reason)
  SELECT a.organization_id, a.id, 'trial_warning_' || a.dias || 'd', 'trial', a.trial_ends_at,
         'Aviso automático de ' || a.dias || ' dia(s) restante(s)'
    FROM avisos a
   WHERE a.dias IN (1,3,7)
     AND NOT EXISTS (SELECT 1 FROM public.license_events e
                      WHERE e.license_id = a.id AND e.event_type = 'trial_warning_' || a.dias || 'd');
  GET DIAGNOSTICS v_avisos = ROW_COUNT;

  RETURN jsonb_build_object('expirados', v_expirados, 'avisos', v_avisos, 'processado_em', now());
END; $$;
REVOKE ALL ON FUNCTION public.process_expired_trials() FROM PUBLIC, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$ BEGIN
  PERFORM cron.unschedule('precifica-processar-testes');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('precifica-processar-testes', '0 8 * * *', $$SELECT public.process_expired_trials();$$);

-- 11. Políticas RLS das novas tabelas ---------------------------------------------------
DROP POLICY IF EXISTS plans_leitura ON public.plans;
CREATE POLICY plans_leitura ON public.plans FOR SELECT TO authenticated USING (public.is_active_user());
DROP POLICY IF EXISTS plans_admin ON public.plans;
CREATE POLICY plans_admin ON public.plans FOR ALL TO authenticated
  USING (public.is_grancont_admin()) WITH CHECK (public.is_grancont_admin());

DROP POLICY IF EXISTS features_leitura ON public.features;
CREATE POLICY features_leitura ON public.features FOR SELECT TO authenticated USING (public.is_active_user());
DROP POLICY IF EXISTS features_admin ON public.features;
CREATE POLICY features_admin ON public.features FOR ALL TO authenticated
  USING (public.is_grancont_admin()) WITH CHECK (public.is_grancont_admin());

DROP POLICY IF EXISTS plan_features_leitura ON public.plan_features;
CREATE POLICY plan_features_leitura ON public.plan_features FOR SELECT TO authenticated USING (public.is_active_user());
DROP POLICY IF EXISTS plan_features_admin ON public.plan_features;
CREATE POLICY plan_features_admin ON public.plan_features FOR ALL TO authenticated
  USING (public.is_grancont_admin()) WITH CHECK (public.is_grancont_admin());

DROP POLICY IF EXISTS lfo_leitura ON public.license_feature_overrides;
CREATE POLICY lfo_leitura ON public.license_feature_overrides FOR SELECT TO authenticated
  USING (public.is_grancont_admin() OR EXISTS (
    SELECT 1 FROM public.licenses l WHERE l.id = license_id AND public.is_org_member(l.organization_id)));
DROP POLICY IF EXISTS lfo_admin ON public.license_feature_overrides;
CREATE POLICY lfo_admin ON public.license_feature_overrides FOR ALL TO authenticated
  USING (public.is_grancont_admin()) WITH CHECK (public.is_grancont_admin());

DROP POLICY IF EXISTS trial_claims_admin ON public.trial_claims;
CREATE POLICY trial_claims_admin ON public.trial_claims FOR ALL TO authenticated
  USING (public.is_grancont_admin()) WITH CHECK (public.is_grancont_admin());
DROP POLICY IF EXISTS trial_claims_proprio ON public.trial_claims;
CREATE POLICY trial_claims_proprio ON public.trial_claims FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS license_events_leitura ON public.license_events;
CREATE POLICY license_events_leitura ON public.license_events FOR SELECT TO authenticated
  USING (public.is_grancont_admin() OR public.is_org_member(organization_id));
DROP POLICY IF EXISTS license_events_admin ON public.license_events;
CREATE POLICY license_events_admin ON public.license_events FOR ALL TO authenticated
  USING (public.is_grancont_admin()) WITH CHECK (public.is_grancont_admin());

DROP POLICY IF EXISTS email_events_admin ON public.email_events;
CREATE POLICY email_events_admin ON public.email_events FOR ALL TO authenticated
  USING (public.is_grancont_admin()) WITH CHECK (public.is_grancont_admin());
DROP POLICY IF EXISTS email_events_proprio ON public.email_events;
CREATE POLICY email_events_proprio ON public.email_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS join_requests_proprio ON public.organization_join_requests;
CREATE POLICY join_requests_proprio ON public.organization_join_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_grancont_admin());
DROP POLICY IF EXISTS join_requests_admin ON public.organization_join_requests;
CREATE POLICY join_requests_admin ON public.organization_join_requests FOR ALL TO authenticated
  USING (public.is_grancont_admin()) WITH CHECK (public.is_grancont_admin());

-- 12. Licenças: leitura por empresa (mantendo a política por usuário existente) ----------
DROP POLICY IF EXISTS licenses_org_leitura ON public.licenses;
CREATE POLICY licenses_org_leitura ON public.licenses FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND public.is_org_member(organization_id));
