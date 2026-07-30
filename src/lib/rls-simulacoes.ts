/**
 * Modelo declarativo das regras de acesso (RLS) das simulações.
 *
 * Este arquivo NÃO executa consultas: ele descreve, em código, o contrato de
 * segurança esperado no banco para `simulations` e suas tabelas de detalhe
 * (`simulation_purchase_lines`, `simulation_tax_lines`, `simulation_sale_expenses`).
 *
 * Os testes de regressão comparam este contrato com as políticas realmente
 * aplicadas no banco e também validam a matriz de permissões em memória.
 */

export type Acao = "SELECT" | "INSERT" | "UPDATE" | "DELETE";

export const TABELAS_DETALHE = [
  "simulation_purchase_lines",
  "simulation_tax_lines",
  "simulation_sale_expenses",
] as const;

export type TabelaDetalhe = (typeof TABELAS_DETALHE)[number];

/** Contexto do usuário autenticado avaliado pelas funções do banco. */
export interface ContextoAcesso {
  userId: string | null;
  /** Conta com status "active" em profiles. */
  contaAtiva: boolean;
  /** Administrador Geral (global_user_roles.role = 'super_admin'). */
  superAdmin: boolean;
  /** Vínculos ativos em organization_members. */
  vinculos: { organizationId: string; papel: "manager" | "user" }[];
}

export interface Simulacao {
  organizationId: string;
  createdBy: string | null;
}

/** Espelha public.is_active_user(). */
export function ehUsuarioAtivo(ctx: ContextoAcesso): boolean {
  return Boolean(ctx.userId) && ctx.contaAtiva;
}

/** Espelha public.is_grancont_admin() = is_super_admin() AND is_active_user(). */
export function ehAdminGeral(ctx: ContextoAcesso): boolean {
  return ctx.superAdmin && ehUsuarioAtivo(ctx);
}

/** Espelha public.is_org_member(_org). */
export function ehMembroDaEmpresa(ctx: ContextoAcesso, organizationId: string): boolean {
  return ehUsuarioAtivo(ctx) && ctx.vinculos.some((v) => v.organizationId === organizationId);
}

/** Espelha public.has_org_role(_org, 'manager') / is_org_admin(_org). */
export function ehGestorDaEmpresa(ctx: ContextoAcesso, organizationId: string): boolean {
  return (
    ehUsuarioAtivo(ctx) &&
    ctx.vinculos.some((v) => v.organizationId === organizationId && v.papel === "manager")
  );
}

/**
 * Espelha public.can_access_simulation(_sim), usada por can_read_simulation()
 * e can_write_simulation().
 */
export function podeAcessarSimulacao(ctx: ContextoAcesso, sim: Simulacao): boolean {
  if (ehAdminGeral(ctx)) return true;
  if (ehGestorDaEmpresa(ctx, sim.organizationId)) return true;
  return (
    ehMembroDaEmpresa(ctx, sim.organizationId) &&
    sim.createdBy !== null &&
    sim.createdBy === ctx.userId
  );
}

/** Regras da tabela `simulations` por ação. */
export function podeNaSimulacao(ctx: ContextoAcesso, sim: Simulacao, acao: Acao): boolean {
  if (acao === "INSERT") {
    const base = ehAdminGeral(ctx) || ehMembroDaEmpresa(ctx, sim.organizationId);
    return base && sim.createdBy !== null && sim.createdBy === ctx.userId;
  }
  return podeAcessarSimulacao(ctx, sim);
}

/** Regras das tabelas de detalhe: leitura usa can_read, escrita usa can_write. */
export function podeNaLinhaDeDetalhe(ctx: ContextoAcesso, sim: Simulacao, acao: Acao): boolean {
  return podeAcessarSimulacao(ctx, sim);
}

/** Contrato esperado das políticas no banco. */
export const CONTRATO_POLITICAS: Record<
  string,
  { acao: Acao; using: string | null; check: string | null }[]
> = {
  simulations: [
    {
      acao: "SELECT",
      using:
        "(is_grancont_admin() OR is_org_admin(organization_id) OR (is_org_member(organization_id) AND (created_by = auth.uid())))",
      check: null,
    },
    {
      acao: "INSERT",
      using: null,
      check:
        "((is_grancont_admin() OR is_org_member(organization_id)) AND (created_by = auth.uid()))",
    },
    {
      acao: "UPDATE",
      using:
        "(is_grancont_admin() OR is_org_admin(organization_id) OR (is_org_member(organization_id) AND (created_by = auth.uid())))",
      check:
        "(is_grancont_admin() OR is_org_admin(organization_id) OR (is_org_member(organization_id) AND (created_by = auth.uid())))",
    },
    {
      acao: "DELETE",
      using:
        "(is_grancont_admin() OR is_org_admin(organization_id) OR (is_org_member(organization_id) AND (created_by = auth.uid())))",
      check: null,
    },
  ],
  ...Object.fromEntries(
    TABELAS_DETALHE.map((tabela) => [
      tabela,
      [
        { acao: "SELECT" as Acao, using: "can_read_simulation(simulation_id)", check: null },
        { acao: "INSERT" as Acao, using: null, check: "can_write_simulation(simulation_id)" },
        {
          acao: "UPDATE" as Acao,
          using: "can_write_simulation(simulation_id)",
          check: "can_write_simulation(simulation_id)",
        },
        { acao: "DELETE" as Acao, using: "can_write_simulation(simulation_id)", check: null },
      ],
    ]),
  ),
};
