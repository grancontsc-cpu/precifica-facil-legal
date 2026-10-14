import { projetarReforma } from "@/lib/projecao-reforma";
import type { SimulationState } from "@/types/pricing";

const r2 = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 100) / 100;

/**
 * Resumo dos resultados já calculados pelo motor, enviado à IA como única fonte
 * de números. A IA apenas explica — nunca recalcula.
 */
export function contextoParaPergunta(state: SimulationState) {
  const p = projetarReforma(state);
  if (!p) return null;
  const qtd = state.produto?.quantidade ?? 1;
  return {
    produto: state.produto?.nome || "Produto avulso",
    regime: state.operacao?.regime ?? null,
    periodoSelecionado: state.operacao?.marcoTemporal ?? null,
    quantidadeReferencia: qtd,
    hoje: {
      precoFinalUnitario: r2(p.hoje.precoFinal),
      lucroUnitario: r2(p.hoje.resultadoUnidade),
      margemPercent: r2(p.hoje.margemEfetiva),
    },
    anoDeMaiorPerda: p.piorAno,
    anos: p.linhas.map((l) => ({
      ano: l.ano,
      custoLiquidoUnitario: r2(l.custoLiquidoUnitario),
      mantendoPreco: {
        lucroUnitario: r2(l.mantendoPreco.resultadoUnidade),
        margemPercent: r2(l.mantendoPreco.margemEfetiva),
        variacaoLucroUnitario: r2(l.perdaLucro),
        variacaoMargemPontos: r2(l.perdaMargemPp),
      },
      mantendoLucroEmReais: {
        precoNecessario: r2(l.mantendoLucro.preco?.precoFinal),
        aumentoReais: r2(l.mantendoLucro.aumentoValor),
        aumentoPercent: r2(l.mantendoLucro.aumentoPercent),
      },
      mantendoMargem: {
        precoNecessario: r2(l.mantendoMargem.preco?.precoFinal),
        aumentoPercent: r2(l.mantendoMargem.aumentoPercent),
      },
    })),
  };
}

export type ContextoPergunta = NonNullable<ReturnType<typeof contextoParaPergunta>>;
