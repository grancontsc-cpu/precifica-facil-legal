-- =========================================================
-- 1. PAPÉIS POR EMPRESA: org_admin -> manager, viewer -> user
-- =========================================================
ALTER TABLE public.organization_members ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.organization_members ALTER COLUMN role TYPE text USING role::text;
UPDATE public.organization_members SET role = 'manager' WHERE role = 'org_admin';
UPDATE public.organization_members SET role = 'user' WHERE role = 'viewer';
ALTER TABLE public.organization_members ALTER COLUMN role SET DEFAULT 'user';
ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_role_check CHECK (role IN ('manager','user'));

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS membership_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS invited_by uuid,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS joined_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_status_check
  CHECK (membership_status IN ('invited','active','suspended','archived'));

CREATE UNIQUE INDEX IF NOT EXISTS organization_members_org_user_uidx
  ON public.organization_members (organization_id, user_id);

-- =========================================================
-- 2. PERFIS
-- =========================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_access_at timestamptz;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_status_check
  CHECK (account_status IN ('invited','pending_email_verification','pending_approval','active','suspended','rejected','archived'));

CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (lower(email));

-- =========================================================
-- 3. EMPRESAS
-- =========================================================
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS trade_name text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

UPDATE public.organizations SET legal_name = COALESCE(legal_name, name), trade_name = COALESCE(trade_name, name);
CREATE UNIQUE INDEX IF NOT EXISTS organizations_cnpj_uidx ON public.organizations (cnpj) WHERE cnpj IS NOT NULL;

-- =========================================================
-- 4. PAPÉIS GLOBAIS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.global_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin')),
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.global_user_roles TO authenticated;
GRANT ALL ON public.global_user_roles TO service_role;
ALTER TABLE public.global_user_roles ENABLE ROW LEVEL SECURITY;

INSERT INTO public.global_user_roles (user_id, role)
SELECT user_id, 'super_admin' FROM public.user_roles WHERE role = 'grancont_admin'
ON CONFLICT DO NOTHING;

-- e-mails autorizados a receber o papel de Administrador Geral (somente backend)
CREATE TABLE IF NOT EXISTS public.bootstrap_super_admins (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.bootstrap_super_admins TO service_role;
ALTER TABLE public.bootstrap_super_admins ENABLE ROW LEVEL SECURITY;
INSERT INTO public.bootstrap_super_admins (email) VALUES ('raulalmeida6@gmail.com') ON CONFLICT DO NOTHING;

-- =========================================================
-- 5. CONVITES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  intended_role text NOT NULL CHECK (intended_role IN ('manager','user')),
  full_name text,
  invitation_status text NOT NULL DEFAULT 'pending' CHECK (invitation_status IN ('pending','accepted','expired','cancelled')),
  token_hash text,
  invited_by uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS invitations_pending_uidx
  ON public.invitations (lower(email), organization_id) WHERE invitation_status = 'pending';
CREATE INDEX IF NOT EXISTS invitations_email_idx ON public.invitations (lower(email));
GRANT SELECT ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 6. SIMULAÇÕES / PRODUTOS
-- =========================================================
ALTER TABLE public.simulations
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS calculation_version text NOT NULL DEFAULT 'v1';

-- =========================================================
-- 7. FUNÇÕES SEGURAS
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.global_user_roles g WHERE g.user_id = auth.uid() AND g.role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.account_status = 'active');
$$;

CREATE OR REPLACE FUNCTION public.is_grancont_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin() AND public.is_active_user();
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_active_user() AND EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = _org AND m.user_id = auth.uid() AND m.membership_status = 'active');
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org uuid, _role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_active_user() AND EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = _org AND m.user_id = auth.uid()
      AND m.membership_status = 'active' AND m.role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_org_role(_org, 'manager');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_org_users(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_grancont_admin() OR public.has_org_role(_org, 'manager');
$$;

CREATE OR REPLACE FUNCTION public.can_access_simulation(_sim uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.simulations s WHERE s.id = _sim AND (
      public.is_grancont_admin()
      OR public.is_org_admin(s.organization_id)
      OR (public.is_org_member(s.organization_id) AND s.created_by = auth.uid())));
$$;

CREATE OR REPLACE FUNCTION public.can_read_simulation(_sim uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_access_simulation(_sim);
$$;

CREATE OR REPLACE FUNCTION public.can_write_simulation(_sim uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_access_simulation(_sim);
$$;

REVOKE ALL ON FUNCTION public.can_access_simulation(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM anon;
REVOKE ALL ON FUNCTION public.is_active_user() FROM anon;
REVOKE ALL ON FUNCTION public.has_org_role(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.can_manage_org_users(uuid) FROM anon;

-- =========================================================
-- 8. PROTEÇÃO DO PAPEL GLOBAL
-- =========================================================
CREATE OR REPLACE FUNCTION public.protect_global_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_restantes int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Somente o Administrador Geral pode alterar papéis globais';
  END IF;
  IF TG_OP = 'DELETE' THEN
    SELECT count(*) INTO v_restantes FROM public.global_user_roles WHERE role = 'super_admin' AND user_id <> OLD.user_id;
    IF v_restantes = 0 THEN
      RAISE EXCEPTION 'O último Administrador Geral não pode ser removido';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_protect_global_roles ON public.global_user_roles;
CREATE TRIGGER trg_protect_global_roles
BEFORE INSERT OR UPDATE OR DELETE ON public.global_user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_global_roles();

-- =========================================================
-- 9. NOVO USUÁRIO: perfil + papel global se autorizado
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, account_status, email_verified_at)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email,
          CASE WHEN NEW.email_confirmed_at IS NULL THEN 'pending_email_verification' ELSE 'active' END,
          NEW.email_confirmed_at)
  ON CONFLICT (id) DO NOTHING;

  IF EXISTS (SELECT 1 FROM public.bootstrap_super_admins b WHERE b.email = lower(NEW.email)) THEN
    INSERT INTO public.global_user_roles (user_id, role) VALUES (NEW.id, 'super_admin') ON CONFLICT DO NOTHING;
    UPDATE public.profiles SET account_status = 'active' WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- sincroniza situação do perfil ao confirmar o e-mail
CREATE OR REPLACE FUNCTION public.sync_profile_email_confirmation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND (OLD.email_confirmed_at IS NULL) THEN
    UPDATE public.profiles
       SET email_verified_at = NEW.email_confirmed_at,
           account_status = CASE WHEN account_status IN ('pending_email_verification','invited') THEN 'active' ELSE account_status END,
           email = NEW.email
     WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email_confirmation();

-- garante perfis para usuários já existentes
INSERT INTO public.profiles (id, full_name, email, account_status, email_verified_at)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'full_name', u.email), u.email, 'active', u.email_confirmed_at
FROM auth.users u ON CONFLICT (id) DO NOTHING;

-- semeia o Administrador Geral quando o e-mail já existir
INSERT INTO public.global_user_roles (user_id, role)
SELECT u.id, 'super_admin' FROM auth.users u
JOIN public.bootstrap_super_admins b ON b.email = lower(u.email)
ON CONFLICT DO NOTHING;

-- =========================================================
-- 10. EMPRESA INICIAL
-- =========================================================
INSERT INTO public.organizations (name, legal_name, trade_name, active)
SELECT 'Grancont', 'Grancont', 'Grancont', true
WHERE NOT EXISTS (SELECT 1 FROM public.organizations);

-- =========================================================
-- 11. POLÍTICAS
-- =========================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS global_roles_select ON public.global_user_roles;
CREATE POLICY global_roles_select ON public.global_user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS invitations_select ON public.invitations;
CREATE POLICY invitations_select ON public.invitations FOR SELECT TO authenticated
  USING (public.is_grancont_admin() OR public.has_org_role(organization_id, 'manager'));

-- simulações: usuário comum acessa apenas as próprias
DROP POLICY IF EXISTS sim_select ON public.simulations;
CREATE POLICY sim_select ON public.simulations FOR SELECT TO authenticated
  USING (public.is_grancont_admin()
     OR public.is_org_admin(organization_id)
     OR (public.is_org_member(organization_id) AND created_by = auth.uid()));

DROP POLICY IF EXISTS sim_insert ON public.simulations;
CREATE POLICY sim_insert ON public.simulations FOR INSERT TO authenticated
  WITH CHECK ((public.is_grancont_admin() OR public.is_org_member(organization_id)) AND created_by = auth.uid());

DROP POLICY IF EXISTS sim_update ON public.simulations;
CREATE POLICY sim_update ON public.simulations FOR UPDATE TO authenticated
  USING (public.is_grancont_admin() OR public.is_org_admin(organization_id)
     OR (public.is_org_member(organization_id) AND created_by = auth.uid()))
  WITH CHECK (public.is_grancont_admin() OR public.is_org_admin(organization_id)
     OR (public.is_org_member(organization_id) AND created_by = auth.uid()));

DROP POLICY IF EXISTS sim_delete ON public.simulations;
CREATE POLICY sim_delete ON public.simulations FOR DELETE TO authenticated
  USING (public.is_grancont_admin() OR public.is_org_admin(organization_id)
     OR (public.is_org_member(organization_id) AND created_by = auth.uid()));

-- produtos: usuário comum lê, gestor administra
DROP POLICY IF EXISTS products_select ON public.products;
CREATE POLICY products_select ON public.products FOR SELECT TO authenticated
  USING (public.is_grancont_admin() OR public.is_org_member(organization_id));

-- perfis: gestor vê os usuários da própria empresa
DROP POLICY IF EXISTS profiles_select_self_or_admin ON public.profiles;
CREATE POLICY profiles_select_self_or_admin ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.organization_members a
    JOIN public.organization_members b ON a.organization_id = b.organization_id
    WHERE a.user_id = auth.uid() AND a.role = 'manager' AND b.user_id = profiles.id));

-- o usuário nunca edita status/papel: bloqueado por gatilho
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN
    NEW.account_status := OLD.account_status;
    NEW.email_verified_at := OLD.email_verified_at;
    NEW.last_access_at := OLD.last_access_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- vínculos: gestor não promove ninguém a gestor
CREATE OR REPLACE FUNCTION public.protect_member_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_super_admin() THEN RETURN NEW; END IF;
  IF NEW.role = 'manager' AND (TG_OP = 'INSERT' OR OLD.role IS DISTINCT FROM 'manager') THEN
    RAISE EXCEPTION 'Somente o Administrador Geral pode conceder o papel de Gestor';
  END IF;
  IF EXISTS (SELECT 1 FROM public.global_user_roles g WHERE g.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Somente o Administrador Geral pode alterar um Administrador Geral';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_protect_member_role ON public.organization_members;
CREATE TRIGGER trg_protect_member_role BEFORE INSERT OR UPDATE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.protect_member_role();

DROP POLICY IF EXISTS members_select ON public.organization_members;
CREATE POLICY members_select ON public.organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin() OR public.has_org_role(organization_id, 'manager'));

-- auditoria: gestor vê a própria empresa
DROP POLICY IF EXISTS audit_select ON public.audit_logs;
CREATE POLICY audit_select ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_grancont_admin() OR (organization_id IS NOT NULL AND public.has_org_role(organization_id, 'manager')));
