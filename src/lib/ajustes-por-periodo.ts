/**
 * Guarda os tributos ajustados pelo usuário em cada período da Reforma, para que
 * alternar o período não apague alíquotas e tratamentos já configurados.
 * Nenhuma fórmula vive aqui — apenas troca de configuração.
 */
import { aplicarMarcoTemporal, operacaoPadrao } from "@/lib/pricing-defaults";
import type { MarcoTemporal, PurchaseTax, SaleTax, ScenarioId, SimulationState } from "@/types/pricing";

export interface AjustePeriodo {
  cenario: ScenarioId;
  tributosCompra: PurchaseTax[];
  tributosVenda: SaleTax[];
}
export type AjustesPorPeriodo = Partial<Record<MarcoTemporal, AjustePeriodo>>;

export function marcoDe(state: SimulationState): MarcoTemporal {
  return state.operacao?.marcoTemporal ?? operacaoPadrao().marcoTemporal ?? "atual";
}

/** Fotografa a configuração atual do período corrente. */
export function guardarAjuste(state: SimulationState, memoria: AjustesPorPeriodo): AjustesPorPeriodo {
  return {
    ...memoria,
    [marcoDe(state)]: {
      cenario: state.cenario,
      tributosCompra: structuredClone(state.tributosCompra),
      tributosVenda: structuredClone(state.tributosVenda),
    },
  };
}

/**
 * Troca de período: guarda o período atual e restaura o novo, se já foi
 * configurado. Sem ajuste salvo, aplica os padrões do período (`restaurado=false`).
 */
export function trocarPeriodo(
  state: SimulationState,
  novo: MarcoTemporal,
  memoria: AjustesPorPeriodo,
): { state: SimulationState; memoria: AjustesPorPeriodo; restaurado: boolean } {
  const mem = guardarAjuste(state, memoria);
  const salvo = mem[novo];
  if (!salvo || marcoDe(state) === novo) {
    return { state: aplicarMarcoTemporal(state, novo), memoria: mem, restaurado: false };
  }
  // Os parâmetros da operação seguem os do período (ex.: DIFAL desligado em 2033),
  // mas os tributos voltam exatamente como o usuário deixou.
  const base = aplicarMarcoTemporal(state, novo);
  return {
    state: {
      ...base,
      cenario: salvo.cenario,
      tributosCompra: structuredClone(salvo.tributosCompra),
      tributosVenda: structuredClone(salvo.tributosVenda),
    },
    memoria: mem,
    restaurado: true,
  };
}

/** Perfil salvo mais recente da empresa para o período, se houver. */
export function perfilDoPeriodo<
  P extends { organization_id: string | null; marco_temporal?: string | null; updated_at: string },
>(perfis: P[], orgId: string | null, marco: MarcoTemporal): P | null {
  const candidatos = perfis
    .filter((p) => p.marco_temporal === marco && (p.organization_id === orgId || !p.organization_id))
    .sort((a, b) => {
      const prioridade = Number(b.organization_id === orgId) - Number(a.organization_id === orgId);
      return prioridade || b.updated_at.localeCompare(a.updated_at);
    });
  return candidatos[0] ?? null;
}
