import type { SimulationState, TaxTreatment } from "@/types/pricing";

/**
 * Ajustes que o usuário pode fazer no modo rápido sem ir ao modo completo.
 * Guardam apenas premissas de entrada — nenhuma fórmula vive aqui.
 */
export interface AjustesRapido {
  aliquotaInternaDestino: number | null;
  aliquotaInterestadual: number | null;
  difalManual: number | null;
  creditarDifal: boolean | null;
  aliquotaSimples: number | null;
  freteTotal: number | null;
  despesasVariaveisPercent: number | null;
  /** Alíquota (%) sobreposta por tributo de compra. */
  tributosCompra: Record<string, number>;
  /** Alíquota e tratamento sobrepostos por tributo de venda. */
  tributosVenda: Record<string, { rate?: number; treatment?: TaxTreatment }>;
}

export function ajustesVazios(): AjustesRapido {
  return {
    aliquotaInternaDestino: null,
    aliquotaInterestadual: null,
    difalManual: null,
    creditarDifal: null,
    aliquotaSimples: null,
    freteTotal: null,
    despesasVariaveisPercent: null,
    tributosCompra: {},
    tributosVenda: {},
  };
}

export function temAjustes(a: AjustesRapido): boolean {
  return (
    a.aliquotaInternaDestino !== null ||
    a.aliquotaInterestadual !== null ||
    a.difalManual !== null ||
    a.creditarDifal !== null ||
    a.aliquotaSimples !== null ||
    a.freteTotal !== null ||
    a.despesasVariaveisPercent !== null ||
    Object.keys(a.tributosCompra).length > 0 ||
    Object.keys(a.tributosVenda).length > 0
  );
}

/** Aplica as premissas informadas pelo usuário sobre o estado montado por padrão. */
export function aplicarAjustes(state: SimulationState, a: AjustesRapido): SimulationState {
  const operacao = state.operacao
    ? {
        ...state.operacao,
        aliquotaInternaDestino:
          a.aliquotaInternaDestino ?? state.operacao.aliquotaInternaDestino,
        aliquotaInterestadual:
          a.aliquotaInterestadual ?? state.operacao.aliquotaInterestadual,
        difalManual: a.difalManual ?? state.operacao.difalManual,
        creditarDifal: a.creditarDifal ?? state.operacao.creditarDifal,
        aliquotaSimples: a.aliquotaSimples ?? state.operacao.aliquotaSimples,
      }
    : state.operacao;

  return {
    ...state,
    operacao,
    produto: {
      ...state.produto,
      freteTotal: a.freteTotal ?? state.produto.freteTotal,
    },
    venda: {
      ...state.venda,
      outrosPercent: a.despesasVariaveisPercent ?? state.venda.outrosPercent,
    },
    tributosCompra: state.tributosCompra.map((t) =>
      a.tributosCompra[t.id] !== undefined ? { ...t, rate: a.tributosCompra[t.id] } : t,
    ),
    tributosVenda: state.tributosVenda.map((t) => {
      const ov = a.tributosVenda[t.id];
      if (!ov) return t;
      return {
        ...t,
        rate: ov.rate ?? t.rate,
        treatment: ov.treatment ?? t.treatment,
      };
    }),
  };
}

export type TipoSuposicao = "faltante" | "estimado" | "informativo";

export interface Suposicao {
  id: string;
  rotulo: string;
  tipo: TipoSuposicao;
  detalhe: string;
}

/** Lista o que ainda é premissa (não confirmada) no cálculo atual. */
export function detectarSuposicoes(state: SimulationState): Suposicao[] {
  const itens: Suposicao[] = [];
  const op = state.operacao;

  if (op) {
    if (op.aliquotaInternaDestino === null) {
      itens.push({
        id: "internaDestino",
        rotulo: "Alíquota interna do destino",
        tipo: "faltante",
        detalhe: "Não encontrada na base para o estado de destino.",
      });
    } else {
      itens.push({
        id: "internaDestino",
        rotulo: "Alíquota interna do destino",
        tipo: "estimado",
        detalhe: "Alíquota geral da base — pode variar por produto ou benefício fiscal.",
      });
    }

    if (op.ufOrigem && op.ufDestino && op.ufOrigem !== op.ufDestino) {
      itens.push({
        id: "interestadual",
        rotulo: "Alíquota interestadual",
        tipo: op.aliquotaInterestadual === null ? "faltante" : "estimado",
        detalhe: "Vale 4% para mercadoria importada — confirme a origem do produto.",
      });
      itens.push({
        id: "fronteira",
        rotulo: "ICMS de fronteira (DIFAL/antecipação/ST)",
        tipo: op.difalManual === null ? "estimado" : "informativo",
        detalhe:
          "Calculado pela diferença de alíquotas. Informe o valor da guia se já souber o montante.",
      });
    }

    if (op.regime === "simples" || op.regime === "mei") {
      itens.push({
        id: "das",
        rotulo: "Alíquota efetiva do DAS",
        tipo: "estimado",
        detalhe: "Depende do anexo e do faturamento dos últimos 12 meses.",
      });
    }
  }

  if (!state.produto.freteTotal) {
    itens.push({
      id: "frete",
      rotulo: "Frete e despesas de compra",
      tipo: "faltante",
      detalhe: "Ainda não considerado no custo de aquisição.",
    });
  }

  if (!state.venda.outrosPercent) {
    itens.push({
      id: "despesas",
      rotulo: "Despesas variáveis de venda",
      tipo: "faltante",
      detalhe: "Comissão, taxa de cartão ou marketplace ainda não informados.",
    });
  }

  for (const t of state.tributosVenda) {
    if (t.enabled && t.treatment === "informativo") {
      itens.push({
        id: `venda:${t.id}`,
        rotulo: `${t.label} na venda`,
        tipo: "informativo",
        detalhe: "Exibido no relatório, mas fora da formação do preço.",
      });
    }
  }

  return itens;
}
