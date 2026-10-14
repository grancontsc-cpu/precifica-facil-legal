import type { SimulationResult, SimulationState } from "@/types/pricing";

/**
 * Comparação lado a lado de simulações salvas. Usa somente as cópias gravadas
 * (premissas e resultado do momento do cálculo); nada é recalculado.
 */
export interface SimulacaoSalva {
  id: string;
  titulo: string;
  produto: string;
  perfil: string;
  state: SimulationState;
  resultado: SimulationResult;
}

export type Formato = "brl" | "pct" | "texto" | "num";
export interface LinhaComparacao {
  grupo: string;
  rotulo: string;
  formato: Formato;
  valores: Array<number | string | null>;
  /** Índice da melhor coluna (maior lucro/margem, menor custo), quando aplicável. */
  melhor: number | null;
}

const REGIMES: Record<string, string> = {
  simples: "Simples Nacional",
  presumido: "Lucro Presumido",
  real: "Lucro Real",
  mei: "MEI",
};
const PERIODOS: Record<string, string> = {
  atual: "Atual",
  transicao2026: "2026",
  vigencia2027: "2027",
  definitivo2033: "2033",
};

function melhorIndice(valores: Array<number | string | null>, sentido: "maior" | "menor" | null) {
  if (!sentido) return null;
  let idx: number | null = null;
  valores.forEach((v, i) => {
    if (typeof v !== "number") return;
    const atual = idx === null ? null : (valores[idx] as number);
    if (atual === null || (sentido === "maior" ? v > atual : v < atual)) idx = i;
  });
  const numeros = valores.filter((v) => typeof v === "number");
  return numeros.length > 1 && new Set(numeros).size > 1 ? idx : null;
}

export function linhasComparacao(sims: SimulacaoSalva[]): LinhaComparacao[] {
  const linhas: LinhaComparacao[] = [];
  const add = (
    grupo: string,
    rotulo: string,
    formato: Formato,
    f: (s: SimulacaoSalva) => number | string | null | undefined,
    sentido: "maior" | "menor" | null = null,
  ) => {
    const valores = sims.map((s) => {
      const v = f(s);
      return v === undefined ? null : v;
    });
    linhas.push({ grupo, rotulo, formato, valores, melhor: melhorIndice(valores, sentido) });
  };

  add("Premissas", "Produto", "texto", (s) => s.produto);
  add("Premissas", "Regime", "texto", (s) => REGIMES[s.state.operacao?.regime ?? ""] ?? "—");
  add("Premissas", "Período da Reforma", "texto", (s) => PERIODOS[s.state.operacao?.marcoTemporal ?? "atual"] ?? "—");
  add("Premissas", "Trajeto", "texto", (s) =>
    s.state.operacao ? `${s.state.operacao.ufOrigem} → ${s.state.operacao.ufDestino}` : "—",
  );
  add("Premissas", "Perfil tributário", "texto", (s) => s.perfil);
  add("Premissas", "Quantidade", "num", (s) => s.state.produto?.quantidade ?? null);

  add("Compra", "Desembolso total", "brl", (s) => s.resultado.compra.desembolsoTotal, "menor");
  add("Compra", "Créditos recuperáveis", "brl", (s) => s.resultado.compra.creditosTotais, "maior");
  add("Compra", "Custo líquido total", "brl", (s) => s.resultado.compra.custoLiquidoTotal, "menor");
  add("Compra", "Custo líquido unitário", "brl", (s) => s.resultado.compra.custoLiquidoUnitario, "menor");

  const r = (s: SimulacaoSalva) => s.resultado.recomendado;
  add("Venda (por unidade)", "Preço final", "brl", (s) => r(s)?.precoFinal ?? null);
  add("Venda (por unidade)", "Tributos incluídos no preço", "brl", (s) => r(s)?.tributosIncluidos ?? null, "menor");
  add("Venda (por unidade)", "Tributos por fora", "brl", (s) => r(s)?.tributosPorFora ?? null, "menor");
  add("Venda (por unidade)", "Despesas variáveis", "brl", (s) => r(s)?.despesasVariaveis ?? null, "menor");
  add("Venda (por unidade)", "Lucro por unidade", "brl", (s) => r(s)?.resultadoUnidade ?? null, "maior");
  add("Venda (por unidade)", "Margem efetiva", "pct", (s) => r(s)?.margemEfetiva ?? null, "maior");
  add("Venda (por unidade)", "Markup", "pct", (s) => r(s)?.markupPercentual ?? null);
  add("Venda (por unidade)", "Preço mínimo", "brl", (s) => s.resultado.precoMinimo?.precoFinal ?? null, "menor");
  return linhas;
}
