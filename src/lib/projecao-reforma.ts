/**
 * Projeção da Reforma Tributária ano a ano (EC 132/2023 e LC 214/2025).
 *
 * Recalcula a mesma simulação em cada etapa da transição e responde:
 *  - mantendo o preço de hoje, quanto muda o lucro e a margem;
 *  - qual preço mantém o lucro em R$ de hoje;
 *  - qual preço mantém a margem % de hoje.
 * As alíquotas são sugestões editáveis (state.etapasReforma).
 */
import Decimal from "decimal.js";
import {
  D,
  contextoVenda,
  resolverPrecoPorMargem,
  resolverPrecoPorPrecoFinal,
  resolverPrecoPorResultado,
  simular,
} from "@/lib/pricing-engine";
import { ALIQUOTAS_REFORMA_PADRAO, aplicarMarcoTemporal } from "@/lib/pricing-defaults";
import type { EtapaReforma, SaleEvaluation, SimulationState } from "@/types/pricing";

/** Tabela de referência: CBS plena e IBS crescendo à medida que o ICMS cai. */
export function etapasReformaPadrao(): EtapaReforma[] {
  const t26 = ALIQUOTAS_REFORMA_PADRAO.transicao2026;
  const t27 = ALIQUOTAS_REFORMA_PADRAO.vigencia2027;
  const pleno = ALIQUOTAS_REFORMA_PADRAO.definitivo2033;
  const fracao = (pct: number) => D(pleno.ibs).times(pct).div(100).toNumber();
  return [
    { ano: "2026", marco: "transicao2026", cbs: t26.cbs, ibs: t26.ibs, fatorIcms: 100 },
    { ano: "2027", marco: "vigencia2027", cbs: t27.cbs, ibs: t27.ibs, fatorIcms: 100 },
    { ano: "2028", marco: "vigencia2027", cbs: t27.cbs, ibs: t27.ibs, fatorIcms: 100 },
    { ano: "2029", marco: "vigencia2027", cbs: pleno.cbs, ibs: fracao(10), fatorIcms: 90 },
    { ano: "2030", marco: "vigencia2027", cbs: pleno.cbs, ibs: fracao(20), fatorIcms: 80 },
    { ano: "2031", marco: "vigencia2027", cbs: pleno.cbs, ibs: fracao(30), fatorIcms: 70 },
    { ano: "2032", marco: "vigencia2027", cbs: pleno.cbs, ibs: fracao(40), fatorIcms: 60 },
    { ano: "2033", marco: "definitivo2033", cbs: pleno.cbs, ibs: pleno.ibs, fatorIcms: 0 },
  ];
}

export function etapasDoEstado(state: SimulationState): EtapaReforma[] {
  return state.etapasReforma?.length ? state.etapasReforma : etapasReformaPadrao();
}

const fator = (rate: number, pct: number) => D(rate).times(pct).div(100).toNumber();

/** Estado da simulação reprocessado para uma etapa da reforma. */
export function estadoDaEtapa(state: SimulationState, etapa: EtapaReforma): SimulationState {
  const s = aplicarMarcoTemporal(state, etapa.marco);
  const icmsCompra = new Set(["icms", "icmsSt"]);
  const op = s.operacao;
  return {
    ...s,
    tributosCompra: s.tributosCompra.map((t) => {
      if (t.id === "ibs") return { ...t, rate: etapa.ibs };
      if (t.id === "cbs") return { ...t, rate: etapa.cbs };
      if (icmsCompra.has(t.id) && etapa.marco !== "definitivo2033")
        return {
          ...t,
          rate: fator(t.rate, etapa.fatorIcms),
          manualTaxValue: fator(t.manualTaxValue, etapa.fatorIcms),
        };
      return t;
    }),
    tributosVenda: s.tributosVenda.map((t) => {
      if (t.id === "ibsVenda") return { ...t, rate: etapa.ibs };
      if (t.id === "cbsVenda") return { ...t, rate: etapa.cbs };
      if (t.id === "icmsVenda") return { ...t, rate: fator(t.rate, etapa.fatorIcms) };
      return t;
    }),
    operacao: op
      ? {
          ...op,
          difalAtivo: etapa.fatorIcms > 0 && op.difalAtivo,
          aliquotaInternaDestino:
            op.aliquotaInternaDestino == null
              ? null
              : fator(op.aliquotaInternaDestino, etapa.fatorIcms),
          aliquotaInterestadual:
            op.aliquotaInterestadual == null
              ? null
              : fator(op.aliquotaInterestadual, etapa.fatorIcms),
          difalManual:
            op.difalManual == null ? null : fator(op.difalManual, etapa.fatorIcms),
        }
      : op,
  };
}

export interface Variacao {
  preco: SaleEvaluation | null;
  /** Aumento do preço final em R$ e em % sobre o preço de hoje. */
  aumentoValor: number | null;
  aumentoPercent: number | null;
}

export interface LinhaProjecao {
  ano: string;
  etapa: EtapaReforma | null;
  custoLiquidoUnitario: number;
  /** Mantendo o preço final de hoje. */
  mantendoPreco: SaleEvaluation;
  perdaLucro: number;
  perdaMargemPp: number;
  mantendoLucro: Variacao;
  mantendoMargem: Variacao;
}

export interface ProjecaoReforma {
  hoje: SaleEvaluation;
  linhas: LinhaProjecao[];
  /** Ano com a maior perda de lucro mantendo o preço. */
  piorAno: string | null;
}

function variacao(preco: SaleEvaluation | null, precoHoje: Decimal): Variacao {
  if (!preco) return { preco: null, aumentoValor: null, aumentoPercent: null };
  const diff = D(preco.precoFinal).minus(precoHoje);
  return {
    preco,
    aumentoValor: diff.toNumber(),
    aumentoPercent: precoHoje.gt(0) ? diff.div(precoHoje).times(100).toNumber() : null,
  };
}

/** Projeta a simulação em cada etapa. Null quando a simulação de hoje não tem preço. */
export function projetarReforma(state: SimulationState): ProjecaoReforma | null {
  const hoje = simular(state).recomendado;
  if (!hoje || hoje.precoFinal <= 0) return null;
  const precoHoje = D(hoje.precoFinal);

  const linhas: LinhaProjecao[] = etapasDoEstado(state).map((etapa) => {
    const ctx = contextoVenda(estadoDaEtapa(state, etapa));
    const mantendoPreco = resolverPrecoPorPrecoFinal(hoje.precoFinal, ctx);
    return {
      ano: etapa.ano,
      etapa,
      custoLiquidoUnitario: D(ctx.custoLiquidoUnitario).toNumber(),
      mantendoPreco,
      perdaLucro: D(mantendoPreco.resultadoUnidade).minus(hoje.resultadoUnidade).toNumber(),
      perdaMargemPp: D(mantendoPreco.margemEfetiva).minus(hoje.margemEfetiva).toNumber(),
      mantendoLucro: variacao(resolverPrecoPorResultado(hoje.resultadoUnidade, ctx), precoHoje),
      mantendoMargem: variacao(resolverPrecoPorMargem(hoje.margemEfetiva, ctx), precoHoje),
    };
  });

  let piorAno: string | null = null;
  let pior = 0;
  for (const l of linhas) {
    if (l.perdaLucro < pior) {
      pior = l.perdaLucro;
      piorAno = l.ano;
    }
  }
  return { hoje, linhas, piorAno };
}
