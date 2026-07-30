-- 1) Auditoria de simulações (campos-chave)
CREATE OR REPLACE FUNCTION public.audit_simulation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before JSONB;
  v_after JSONB;
  v_org UUID;
  v_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN v_org := OLD.organization_id; v_id := OLD.id;
  ELSE v_org := NEW.organization_id; v_id := NEW.id; END IF;

  IF TG_OP <> 'INSERT' THEN
    v_before := jsonb_build_object(
      'titulo', OLD.titulo, 'status', OLD.status, 'organization_id', OLD.organization_id,
      'product_id', OLD.product_id, 'produto_nome', OLD.produto_nome,
      'tax_profile_id', OLD.tax_profile_id, 'tax_profile_name', OLD.tax_profile_name,
      'tax_profile_version', OLD.tax_profile_version, 'quantidade', OLD.quantidade,
      'custo_liquido_unitario', OLD.custo_liquido_unitario, 'preco_final', OLD.preco_final,
      'margem_efetiva', OLD.margem_efetiva, 'overridden_fields', OLD.overridden_fields,
      'archived_at', OLD.archived_at, 'calculation_version', OLD.calculation_version);
  END IF;

  IF TG_OP <> 'DELETE' THEN
    v_after := jsonb_build_object(
      'titulo', NEW.titulo, 'status', NEW.status, 'organization_id', NEW.organization_id,
      'product_id', NEW.product_id, 'produto_nome', NEW.produto_nome,
      'tax_profile_id', NEW.tax_profile_id, 'tax_profile_name', NEW.tax_profile_name,
      'tax_profile_version', NEW.tax_profile_version, 'quantidade', NEW.quantidade,
      'custo_liquido_unitario', NEW.custo_liquido_unitario, 'preco_final', NEW.preco_final,
      'margem_efetiva', NEW.margem_efetiva, 'overridden_fields', NEW.overridden_fields,
      'archived_at', NEW.archived_at, 'calculation_version', NEW.calculation_version);
  END IF;

  -- Só registra atualização quando um campo-chave mudou.
  IF TG_OP = 'UPDATE' AND v_before = v_after THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.audit_logs (organization_id, actor_id, entity, entity_id, action, before_data, after_data)
  VALUES (v_org, auth.uid(), TG_TABLE_NAME, v_id, lower(TG_OP), v_before, v_after);

  RETURN COALESCE(NEW, OLD);
END; $$;

REVOKE ALL ON FUNCTION public.audit_simulation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_simulations ON public.simulations;
CREATE TRIGGER trg_audit_simulations
AFTER INSERT OR UPDATE OR DELETE ON public.simulations
FOR EACH ROW EXECUTE FUNCTION public.audit_simulation();

-- 2) Auditoria das linhas de detalhe da simulação
CREATE OR REPLACE FUNCTION public.audit_simulation_line()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sim UUID;
  v_org UUID;
  v_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN v_sim := OLD.simulation_id; v_id := OLD.id;
  ELSE v_sim := NEW.simulation_id; v_id := NEW.id; END IF;

  SELECT s.organization_id INTO v_org FROM public.simulations s WHERE s.id = v_sim;

  INSERT INTO public.audit_logs (organization_id, actor_id, entity, entity_id, action, before_data, after_data)
  VALUES (
    v_org, auth.uid(), TG_TABLE_NAME, v_id, lower(TG_OP),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END);

  RETURN COALESCE(NEW, OLD);
END; $$;

REVOKE ALL ON FUNCTION public.audit_simulation_line() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_simulation_purchase_lines ON public.simulation_purchase_lines;
CREATE TRIGGER trg_audit_simulation_purchase_lines
AFTER INSERT OR UPDATE OR DELETE ON public.simulation_purchase_lines
FOR EACH ROW EXECUTE FUNCTION public.audit_simulation_line();

DROP TRIGGER IF EXISTS trg_audit_simulation_tax_lines ON public.simulation_tax_lines;
CREATE TRIGGER trg_audit_simulation_tax_lines
AFTER INSERT OR UPDATE OR DELETE ON public.simulation_tax_lines
FOR EACH ROW EXECUTE FUNCTION public.audit_simulation_line();

DROP TRIGGER IF EXISTS trg_audit_simulation_sale_expenses ON public.simulation_sale_expenses;
CREATE TRIGGER trg_audit_simulation_sale_expenses
AFTER INSERT OR UPDATE OR DELETE ON public.simulation_sale_expenses
FOR EACH ROW EXECUTE FUNCTION public.audit_simulation_line();

-- 3) Impede que usuários forjem registros de auditoria para outras empresas
DROP POLICY IF EXISTS audit_insert ON public.audit_logs;
CREATE POLICY audit_insert ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND (
    is_grancont_admin()
    OR (organization_id IS NOT NULL AND is_org_member(organization_id))
  )
);