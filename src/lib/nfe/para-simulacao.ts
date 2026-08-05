import { aplicarRegime, estadoInicial, operacaoPadrao } from "@/lib/pricing-defaults";
import { simular } from "@/lib/pricing-engine";
import type { PurchaseTax, Regime, SimulationResult, SimulationState } from "@/types/pricing";
import { ehImportada, type ItemNota, type NotaImportada } from "./tipos";

/**
 * Direito a crédito depende do regime e do CST/CSOSN do item — nunca da alíquota.
 * CSOSN (Simples do fornecedor) e CST sem tributação não geram crédito para quem compra.
 */
export function creditaIcms(cst: string, regime: Regime): boolean {
  if (regime === "simples" || regime === "mei") return false;
  const c = (cst ?? "").trim().padStart(2, "0");
  // CSOSN tem 3 dígitos: mercadoria do Simples não transfere crédito automático.
  if ((cst ?? "").trim().length === 3) return false;
  return ["00", "10", "20", "51", "70", "90"].includes(c);
}

/** PIS/Cofins só geram crédito no regime não cumulativo (Lucro Real) e com CST tributado. */
export function creditaPisCofins(cst: string, regime: Regime): boolean {
  if (regime !== "real") return false;
  const c = (cst ?? "").trim().padStart(2, "0");
  return ["01", "02", "03", "05"].includes(c);
}

export interface PremissasVenda {
  margemDesejada: number;
  comissaoPercent: number;
  cartaoPercent: number;
  marketplacePercent: number;
  perdasPercent: number;
  outrosPercent: number;
  freteVendaUnidade: number;
  embalagemVendaUnidade: number;
  custoFixoUnidade: number;
  outrasDespesasFixasUnidade: number;
  /** Alíquotas de venda informadas pelo usuário (nunca fixadas no código). */
  icmsVendaPercent: number;
  pisVendaPercent: number;
  cofinsVendaPercent: number;
  dasPercent: number;
}

export function premissasPadrao(overrides: Partial<PremissasVenda> = {}): PremissasVenda {
  return {
    margemDesejada: 30,
    comissaoPercent: 0,
    cartaoPercent: 0,
    marketplacePercent: 0,
    perdasPercent: 0,
    outrosPercent: 0,
    freteVendaUnidade: 0,
    embalagemVendaUnidade: 0,
    custoFixoUnidade: 0,
    outrasDespesasFixasUnidade: 0,
    icmsVendaPercent: 0,
    pisVendaPercent: 0,
    cofinsVendaPercent: 0,
    dasPercent: 0,
    ...overrides,
  };
}

export interface OpcoesConversao {
  regime: Regime;
  premissas: PremissasVenda;
  /** Considerar ICMS de fronteira (DIFAL/antecipação) na compra interestadual. */
  fronteiraAtiva?: boolean;
  aliquotaInternaDestino?: number | null;
  aliquotaInterestadual?: number | null;
}

/** Aplica um tributo de compra com o valor destacado na nota. */
function comValorDaNota(
  tributos: PurchaseTax[],
  id: PurchaseTax["id"],
  valor: number,
  creditar: boolean,
  treatment: PurchaseTax["treatment"],
  nota: string,
): PurchaseTax[] {
  return tributos.map((t) =>
    t.id === id
      ? {
          ...t,
          enabled: valor > 0,
          useManualTax: true,
          manualTaxValue: valor,
          treatment,
          creditMode: creditar ? ("integral" as const) : ("nao" as const),
          note: nota,
        }
      : t,
  );
}

/** Converte um item da nota em um estado completo do simulador. */
export function itemParaSimulacao(
  item: ItemNota,
  nota: NotaImportada,
  opcoes: OpcoesConversao,
): SimulationState {
  const { regime, premissas } = opcoes;
  const base = aplicarRegime(estadoInicial(), regime);

  let tributos = base.tributosCompra;
  tributos = comValorDaNota(
    tributos,
    "icms",
    item.icms.valor,
    creditaIcms(item.icms.cst, regime),
    "incluido",
    `ICMS destacado (CST ${item.icms.cst || "não informado"}).`,
  );
  tributos = comValorDaNota(
    tributos,
    "pis",
    item.pis.valor,
    creditaPisCofins(item.pis.cst, regime),
    "incluido",
    `PIS destacado (CST ${item.pis.cst || "não informado"}).`,
  );
  tributos = comValorDaNota(
    tributos,
    "cofins",
    item.cofins.valor,
    creditaPisCofins(item.cofins.cst, regime),
    "incluido",
    `Cofins destacada (CST ${item.cofins.cst || "não informado"}).`,
  );
  // IPI e ICMS-ST são cobrados por fora e, na revenda, entram como custo.
  tributos = comValorDaNota(
    tributos,
    "ipi",
    item.ipi.valor,
    false,
    "porFora",
    "IPI destacado na nota. Empresas industriais podem ter crédito — confirme com a contabilidade.",
  );
  tributos = comValorDaNota(
    tributos,
    "icmsSt",
    item.icmsSt.valor,
    false,
    "porFora",
    "ICMS-ST retido pelo fornecedor: custo da mercadoria, sem crédito na revenda.",
  );

  const operacao = operacaoPadrao({
    regime,
    ufOrigem: nota.emitente.uf,
    ufDestino: nota.destinatario.uf,
    importada: ehImportada(item.origem),
    difalAtivo: opcoes.fronteiraAtiva ?? false,
    aliquotaInternaDestino: opcoes.aliquotaInternaDestino ?? null,
    aliquotaInterestadual: opcoes.aliquotaInterestadual ?? null,
    aliquotaSimples: regime === "simples" || regime === "mei" ? premissas.dasPercent : 0,
  });

  const tributosVenda = base.tributosVenda.map((t) => {
    if (t.id === "icmsVenda") {
      return { ...t, enabled: premissas.icmsVendaPercent > 0, rate: premissas.icmsVendaPercent };
    }
    if (t.id === "pisVenda") {
      return { ...t, enabled: premissas.pisVendaPercent > 0, rate: premissas.pisVendaPercent };
    }
    if (t.id === "cofinsVenda") {
      return {
        ...t,
        enabled: premissas.cofinsVendaPercent > 0,
        rate: premissas.cofinsVendaPercent,
      };
    }
    if (t.id === "dasVenda") {
      return { ...t, enabled: premissas.dasPercent > 0, rate: premissas.dasPercent };
    }
    return t;
  });

  return {
    ...base,
    produto: {
      ...base.produto,
      nome: item.descricao,
      sku: item.codigo,
      ncm: item.ncm,
      unidade: item.unidade,
      quantidade: item.quantidade,
      valorUnitario: item.valorUnitario,
      descontoTotal: item.desconto,
      freteTotal: item.frete,
      seguroTotal: item.seguro,
      outrasDespesas: item.outras,
    },
    tributosCompra: tributos,
    venda: {
      ...base.venda,
      modo: "margem",
      margemDesejada: premissas.margemDesejada,
      comissaoPercent: premissas.comissaoPercent,
      cartaoPercent: premissas.cartaoPercent,
      marketplacePercent: premissas.marketplacePercent,
      perdasPercent: premissas.perdasPercent,
      outrosPercent: premissas.outrosPercent,
      freteVendaUnidade: premissas.freteVendaUnidade,
      embalagemVendaUnidade: premissas.embalagemVendaUnidade,
      custoFixoUnidade: premissas.custoFixoUnidade,
      outrasDespesasFixasUnidade: premissas.outrasDespesasFixasUnidade,
    },
    tributosVenda,
    operacao,
  };
}

export interface ItemPrecificado {
  item: ItemNota;
  estado: SimulationState;
  resultado: SimulationResult;
}

export interface NotaPrecificada {
  nota: NotaImportada;
  itens: ItemPrecificado[];
  totais: {
    desembolso: number;
    creditos: number;
    custoLiquido: number;
    receitaSugerida: number;
    resultadoSugerido: number;
  };
}

/** Precifica a nota inteira: cada item passa pelo motor e os totais são somados. */
export function precificarNota(nota: NotaImportada, opcoes: OpcoesConversao): NotaPrecificada {
  const itens = nota.itens.map((item) => {
    const estado = itemParaSimulacao(item, nota, opcoes);
    return { item, estado, resultado: simular(estado) };
  });

  const totais = itens.reduce(
    (acc, { item, resultado }) => {
      const receita = (resultado.recomendado?.precoFinal ?? 0) * item.quantidade;
      return {
        desembolso: acc.desembolso + resultado.compra.desembolsoTotal,
        creditos: acc.creditos + resultado.compra.creditosTotais,
        custoLiquido: acc.custoLiquido + resultado.compra.custoLiquidoTotal,
        receitaSugerida: acc.receitaSugerida + receita,
        resultadoSugerido:
          acc.resultadoSugerido + (resultado.recomendado?.resultadoUnidade ?? 0) * item.quantidade,
      };
    },
    { desembolso: 0, creditos: 0, custoLiquido: 0, receitaSugerida: 0, resultadoSugerido: 0 },
  );

  return { nota, itens, totais };
}
