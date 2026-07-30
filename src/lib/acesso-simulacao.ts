/**
 * Verificação de acesso a simulações no lado do cliente.
 *
 * A autoridade final continua sendo a RLS do banco; estas funções apenas
 * espelham o mesmo contrato (src/lib/rls-simulacoes.ts) para que a interface
 * não exiba nem permita editar simulações de outras empresas/usuários quando
 * alguém digita ou adivinha um id na URL.
 */

import {
  ehAdminGeral,
  ehGestorDaEmpresa,
  ehMembroDaEmpresa,
  podeAcessarSimulacao,
  type ContextoAcesso,
  type Simulacao,
} from "@/lib/rls-simulacoes";

export interface DadosAcessoApp {
  userId: string | null;
  accountStatus: string | null;
  isSuperAdmin: boolean;
  memberships: { organization_id: string; role: "manager" | "user" }[];
}

/** Converte o estado do AppProvider no contexto usado pelas regras de acesso. */
export function contextoDoApp(app: DadosAcessoApp): ContextoAcesso {
  return {
    userId: app.userId,
    contaAtiva: app.accountStatus === "active",
    superAdmin: app.isSuperAdmin,
    vinculos: app.memberships.map((m) => ({
      organizationId: m.organization_id,
      papel: m.role,
    })),
  };
}

export interface ResultadoAcesso {
  podeLer: boolean;
  podeEscrever: boolean;
  motivo: string | null;
}

const MOTIVO_SEM_ACESSO =
  "Esta simulação pertence a outra empresa ou a outro usuário. Você não tem permissão para abri-la.";

/**
 * Leitura e escrita seguem a mesma regra da RLS: Administrador Geral, gestor da
 * empresa da simulação ou autor da simulação com vínculo ativo.
 */
export function avaliarAcessoSimulacao(
  ctx: ContextoAcesso,
  sim: Simulacao | null,
): ResultadoAcesso {
  if (!sim) return { podeLer: false, podeEscrever: false, motivo: MOTIVO_SEM_ACESSO };
  if (!ctx.userId) {
    return { podeLer: false, podeEscrever: false, motivo: "Sessão expirada. Entre novamente." };
  }
  if (!ctx.contaAtiva) {
    return { podeLer: false, podeEscrever: false, motivo: "Sua conta não está ativa." };
  }
  const permitido = podeAcessarSimulacao(ctx, sim);
  return {
    podeLer: permitido,
    podeEscrever: permitido,
    motivo: permitido ? null : MOTIVO_SEM_ACESSO,
  };
}

/** Pode criar uma nova simulação na empresa selecionada. */
export function podeCriarSimulacao(ctx: ContextoAcesso, organizationId: string | null): boolean {
  if (!organizationId) return false;
  return ehAdminGeral(ctx) || ehMembroDaEmpresa(ctx, organizationId);
}

/** Filtra uma lista vinda do banco, removendo o que o usuário não pode ver. */
export function filtrarSimulacoesVisiveis<T extends Simulacao>(
  ctx: ContextoAcesso,
  simulacoes: T[],
): T[] {
  return simulacoes.filter((s) => podeAcessarSimulacao(ctx, s));
}

export { ehAdminGeral, ehGestorDaEmpresa, ehMembroDaEmpresa, podeAcessarSimulacao };
export type { ContextoAcesso, Simulacao };
