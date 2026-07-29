/**
 * Motor de comparação de fornecedores.
 *
 * REGRA CENTRAL: nenhuma fórmula tributária vive aqui. Todo cálculo de
 * desembolso, créditos e custo líquido vem de `calcularCompra()` — o mesmo
 * motor do simulador principal. Este módulo apenas orquestra chamadas e
 * calcula métricas comparativas (diferenças e ponto de equilíbrio de frete).
 */
import Decimal from "decimal.js";

import { D, calcularCompra } from "@/lib/pricing-engine";
import {
  MAX_ALTERNATIVAS,
  alternativaParaProduto,
  type DestaqueId,
  type ExplicacaoFornecedor,
  type SupplierAlternative,
  type SupplierComparison,
  type SupplierComparisonRow,
} from "@/types/comparison";

const r2 = (d: Decimal) => Number(d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
const r4 = (d: Decimal) => Number(d.toDecimalPlaces(4, Decimal.ROUND_HALF_UP));

/** Custo líquido unitário em precisão plena, direto do motor. */
function custoUnitarioExato(alt: SupplierAlternative, nomeProduto: string, freteExtra = 0): Decimal {
  const compra = calcularCompra(alternativaParaProduto(alt, nomeProduto, freteExtra), alt.tributos);
  return D(compra.custoLiquidoUnitarioExato);
}

/**
 * Frete adicional (total do pedido) que faz o custo líquido unitário desta
 * alternativa igualar `alvo`. O custo unitário é monótono crescente no frete,
 * então uma busca binária sobre o próprio motor resolve sem duplicar fórmula.
 * Retorna `null` quando não existe ponto de equilíbrio no intervalo válido.
 */
export function limiteFreteEquivalencia(
  alt: SupplierAlternative,
  alvo: Decimal,
  nomeProduto = "",
): number | null {
  if (!(alt.quantidade > 0) || !alvo.isFinite()) return null;

  const f = (delta: number) => custoUnitarioExato(alt, nomeProduto, delta);

  // Limite inferior: não é possível ter frete negativo no pedido.
  let lo = -alt.freteTotal;
  let hi = 1;
  const custoLo = f(lo);
  if (custoLo.gt(alvo)) return null; // nem zerando o frete a opção alcança o alvo

  // Expande o teto até ultrapassar o alvo.
  let guard = 0;
  while (f(hi).lt(alvo) && guard < 60) {
    hi *= 2;
    guard += 1;
  }
  if (f(hi).lt(alvo)) return null;

  for (let i = 0; i < 200; i += 1) {
    const mid = (lo + hi) / 2;
    if (f(mid).lt(alvo)) lo = mid;
    else hi = mid;
    if (Math.abs(hi - lo) < 1e-9) break;
  }
  return r2(D((lo + hi) / 2));
}

export function compararFornecedores(
  alternativas: SupplierAlternative[],
  nomeProduto = "",
): SupplierComparison {
  const avisos: string[] = [];
  const validas = alternativas.filter((a) => a.quantidade > 0 && Number.isFinite(a.valorUnitario));

  if (alternativas.length > MAX_ALTERNATIVAS) {
    avisos.push(`Compare no máximo ${MAX_ALTERNATIVAS} alternativas por vez.`);
  }
  if (validas.length < alternativas.length) {
    avisos.push("Alternativas com quantidade zero ou valor inválido foram ignoradas no ranking.");
  }

  const base = validas.map((alt) => {
    const compra = calcularCompra(alternativaParaProduto(alt, nomeProduto), alt.tributos);
    return { alt, compra, unit: D(compra.custoLiquidoUnitarioExato) };
  });

  if (base.length === 0) {
    return { linhas: [], vencedorId: null, vice: null, avisos, explicacoes: [] };
  }

  const quantidades = new Set(base.map((b) => b.alt.quantidade));
  if (quantidades.size > 1) {
    avisos.push(
      "As alternativas têm quantidades diferentes: a comparação usa o custo líquido unitário como critério principal.",
    );
  }

  // Ordena por custo líquido unitário (não pelo preço nominal).
  const ordenado = [...base].sort((a, b) => {
    const diff = a.unit.comparedTo(b.unit);
    if (diff !== 0) return diff;
    if (a.alt.prazoDias !== b.alt.prazoDias) return b.alt.prazoDias - a.alt.prazoDias;
    return a.compra.desembolsoTotal - b.compra.desembolsoTotal;
  });

  const vencedor = ordenado[0];
  const vice = ordenado[1] ?? null;

  const menorDesembolso = Math.min(...base.map((b) => b.compra.desembolsoTotal));
  const maiorCredito = Math.max(...base.map((b) => b.compra.creditosTotais));
  const melhorPrazo = Math.max(...base.map((b) => b.alt.prazoDias));
  const menorCustoLiquidoUnit = vencedor.unit;

  const linhas: SupplierComparisonRow[] = base.map(({ alt, compra, unit }) => {
    const ehVencedor = alt.id === vencedor.alt.id;
    const ref = ehVencedor ? vice : vencedor;
    const refUnit = ref ? ref.unit : null;

    const diferencaUnitaria = refUnit ? unit.minus(refUnit) : D(0);
    const diferencaPercentual =
      refUnit && !refUnit.isZero() ? diferencaUnitaria.div(refUnit).times(100) : D(0);
    const economiaPedido = diferencaUnitaria.negated().times(D(alt.quantidade));

    const destaques: DestaqueId[] = [];
    if (compra.desembolsoTotal === menorDesembolso) destaques.push("menorDesembolso");
    if (unit.equals(menorCustoLiquidoUnit)) destaques.push("menorCustoLiquido");
    if (compra.creditosTotais === maiorCredito && maiorCredito > 0) destaques.push("maiorCredito");
    if (alt.prazoDias === melhorPrazo && melhorPrazo > 0) destaques.push("melhorPrazo");
    if (ehVencedor) destaques.push("melhorOpcao");

    return {
      id: alt.id,
      nome: alt.nome,
      uf: alt.uf,
      regime: alt.regime,
      prazoDias: alt.prazoDias,
      quantidade: alt.quantidade,
      compra,
      desembolsoTotal: compra.desembolsoTotal,
      creditosTotais: compra.creditosTotais,
      custoLiquidoTotal: compra.custoLiquidoTotal,
      custoLiquidoUnitario: r4(unit),
      referenciaId: ref ? ref.alt.id : null,
      diferencaUnitaria: r4(diferencaUnitaria),
      diferencaPercentual: r4(diferencaPercentual),
      economiaPedido: r2(economiaPedido),
      limiteFreteAdicional: refUnit ? limiteFreteEquivalencia(alt, refUnit, nomeProduto) : null,
      destaques,
    };
  });

  return {
    linhas,
    vencedorId: vencedor.alt.id,
    vice: vice ? vice.alt.id : null,
    avisos,
    explicacoes: explicar(linhas, vencedor.alt.id),
  };
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

/** Narrativa detalhada: por que uma alternativa é melhor que a outra. */
export function explicar(
  linhas: SupplierComparisonRow[],
  vencedorId: string | null,
): ExplicacaoFornecedor[] {
  const porId = new Map(linhas.map((l) => [l.id, l]));

  return linhas.map((l) => {
    const ref = l.referenciaId ? porId.get(l.referenciaId) : undefined;
    const nomeRef = ref ? ref.nome : "—";
    const out: string[] = [];

    out.push(
      `Preço de tabela ${brl(l.compra.valorBrutoProdutos / Math.max(1, l.quantidade))} por unidade; ` +
        `desembolso total de ${brl(l.desembolsoTotal)}.`,
    );
    out.push(
      `Créditos recuperáveis de ${brl(l.creditosTotais)} reduzem o custo para ${brl(l.custoLiquidoTotal)} ` +
        `(${brl(l.custoLiquidoUnitario)} por unidade).`,
    );

    const comCredito = l.compra.tributos.filter((t) => t.enabled && t.credito > 0);
    if (comCredito.length > 0) {
      out.push(
        `Crédito vem de: ${comCredito
          .map((t) => `${t.label} ${brl(t.credito)} (${t.origemCredito.toLowerCase()})`)
          .join("; ")}.`,
      );
    } else {
      out.push("Nenhum tributo desta alternativa gera crédito recuperável.");
    }

    const custoNaoCreditavel = l.compra.tributos
      .filter((t) => t.enabled && t.treatment === "porFora" && t.credito === 0)
      .map((t) => t.label);
    if (custoNaoCreditavel.length > 0) {
      out.push(`Tributos cobrados por fora sem crédito viram custo: ${custoNaoCreditavel.join(", ")}.`);
    }

    if (ref) {
      if (l.diferencaUnitaria < 0) {
        out.push(
          `É ${brl(Math.abs(l.diferencaUnitaria))} por unidade (${Math.abs(l.diferencaPercentual).toFixed(2)}%) ` +
            `mais barata que ${nomeRef}, economia de ${brl(l.economiaPedido)} no pedido.`,
        );
      } else if (l.diferencaUnitaria > 0) {
        out.push(
          `Custa ${brl(l.diferencaUnitaria)} a mais por unidade (${l.diferencaPercentual.toFixed(2)}%) ` +
            `que ${nomeRef} — ${brl(Math.abs(l.economiaPedido))} de custo extra no pedido.`,
        );
      } else {
        out.push(`Empata em custo líquido unitário com ${nomeRef}.`);
      }

      if (l.limiteFreteAdicional !== null) {
        if (l.limiteFreteAdicional > 0) {
          out.push(
            `Suporta até ${brl(l.limiteFreteAdicional)} de frete adicional no pedido antes de empatar com ${nomeRef}.`,
          );
        } else {
          out.push(
            `Só empata com ${nomeRef} se o frete cair ${brl(Math.abs(l.limiteFreteAdicional))} no pedido.`,
          );
        }
      } else {
        out.push(`Não há ponto de equilíbrio de frete em relação a ${nomeRef}.`);
      }
    }

    if (l.destaques.includes("menorDesembolso") && l.id !== vencedorId) {
      out.push(
        "Atenção: tem o menor desembolso, mas não é a melhor opção econômica — o crédito recuperável muda o resultado.",
      );
    }
    if (l.prazoDias > 0) {
      out.push(`Prazo de pagamento de ${l.prazoDias} dias (não entra no cálculo do custo).`);
    }

    return { id: l.id, titulo: l.nome || "Fornecedor sem nome", linhas: out };
  });
}
