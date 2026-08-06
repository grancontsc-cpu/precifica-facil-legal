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

/** Códigos padronizados de negação — nunca revelam dados do registro. */
export type CodigoAcesso =
  "sessao_expirada" | "conta_inativa" | "sem_permissao_leitura" | "somente_leitura";

export interface MensagemAcesso {
  titulo: string;
  descricao: string;
  /** Orientação prática para o usuário resolver ou seguir adiante. */
  orientacao: string;
}

/**
 * Catálogo único de mensagens de acesso. As frases são genéricas de propósito:
 * não confirmam a existência da simulação nem indicam empresa, autor ou
 * qualquer outro dado do registro solicitado.
 */
export const MENSAGENS_ACESSO: Record<CodigoAcesso, MensagemAcesso> = {
  sessao_expirada: {
    titulo: "Sessão expirada",
    descricao: "Sua sessão não está mais válida.",
    orientacao: "Entre novamente para continuar.",
  },
  conta_inativa: {
    titulo: "Conta sem acesso",
    descricao: "Sua conta não está ativa no sistema.",
    orientacao: "Fale com o administrador da sua empresa para reativar o acesso.",
  },
  sem_permissao_leitura: {
    titulo: "Simulação indisponível",
    descricao: "Você não tem permissão para acessar esta simulação.",
    orientacao: "Abra uma simulação do seu histórico ou crie uma nova.",
  },
  somente_leitura: {
    titulo: "Edição não permitida",
    descricao: "Você pode consultar esta simulação, mas não alterá-la.",
    orientacao: "Duplique-a para trabalhar em uma cópia sua ou solicite permissão ao gestor.",
  },
};

/** Texto curto padronizado (toasts e mensagens de erro). */
export function textoAcesso(codigo: CodigoAcesso): string {
  const m = MENSAGENS_ACESSO[codigo];
  return `${m.descricao} ${m.orientacao}`;
}

export interface ResultadoAcesso {
  podeLer: boolean;
  podeEscrever: boolean;
  codigo: CodigoAcesso | null;
  motivo: string | null;
}

function negar(codigo: CodigoAcesso): ResultadoAcesso {
  return { podeLer: false, podeEscrever: false, codigo, motivo: textoAcesso(codigo) };
}

/**
 * Leitura e escrita seguem a mesma regra da RLS: Administrador Geral, gestor da
 * empresa da simulação ou autor da simulação com vínculo ativo.
 */
export function avaliarAcessoSimulacao(
  ctx: ContextoAcesso,
  sim: Simulacao | null,
): ResultadoAcesso {
  if (!ctx.userId) return negar("sessao_expirada");
  if (!ctx.contaAtiva) return negar("conta_inativa");
  // Registro inexistente e registro sem permissão devolvem a MESMA resposta,
  // para não revelar se a simulação existe.
  if (!sim) return negar("sem_permissao_leitura");
  if (!podeAcessarSimulacao(ctx, sim)) return negar("sem_permissao_leitura");
  return { podeLer: true, podeEscrever: true, codigo: null, motivo: null };
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
