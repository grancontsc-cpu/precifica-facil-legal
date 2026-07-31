import Decimal from "decimal.js";
import type {
  MarginBase,
  OperacaoFiscal,
  ProdutoCompra,
  PurchaseResult,
  PurchaseTax,
  PurchaseTaxResult,
  Regime,
  SaleEvaluation,
  SaleTax,
  SaleTaxResult,
  SimulationResult,
  SimulationState,
  ValidationIssue,
  VendaConfig,
} from "@/types/pricing";


/**
 * Motor de precificação — funções puras, sem dependência de interface.
 *
 * Regras estruturais (auditadas):
 *  - Tributo "incluído" já está dentro do valor informado -> NUNCA soma de novo
 *    ao desembolso/preço; entra apenas como redutor do resultado.
 *  - Tributo "por fora" é acrescentado ao desembolso / ao preço cobrado e
 *    subtraído do resultado (efeito neutro: é repasse puro).
 *  - Tributo "informativo" não altera desembolso, preço nem resultado.
 *  - Alíquota e direito ao crédito são informações independentes.
 *  - Todo o cálculo interno usa Decimal; o arredondamento (4 casas) acontece
 *    só na fronteira de saída, e a exibição arredonda em 2.
 *  - Existe UMA única implementação de cada fórmula. A busca binária e a
 *    avaliação de preço consomem o mesmo núcleo (`nucleoVenda`).
 */

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

const ZERO = new Decimal(0);

/**
 * Converte qualquer entrada em Decimal finito.
 * NaN, Infinity, null, undefined e strings inválidas viram 0 — assim um campo
 * corrompido nunca contamina toda a simulação com NaN.
 */
export function D(v: unknown): Decimal {
  if (v instanceof Decimal) return v.isFinite() ? v : ZERO;
  if (typeof v === "number") return Number.isFinite(v) ? new Decimal(v) : ZERO;
  if (typeof v === "string" && v.trim() !== "") {
    const d = new Decimal(v.trim().replace(",", "."));
    return d.isFinite() ? d : ZERO;
  }
  return ZERO;
}

/** Entrada numérica é finita? (usado nas validações) */
const finito = (v: unknown) => typeof v === "number" && Number.isFinite(v);

/** Arredonda para 4 casas — apenas na saída do motor. */
const r4 = (v: Decimal) => v.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();

/** Percentual -> fator (100 -> 1). */
const pct = (v: unknown) => D(v).div(100);

/* ------------------------------------------------------------------ */
/* Compra                                                              */
/* ------------------------------------------------------------------ */

export function calcularCompra(produto: ProdutoCompra, tributos: PurchaseTax[]): PurchaseResult {
  const quantidade = D(produto.quantidade);
  const valorBruto = D(produto.valorUnitario).times(quantidade);
  const desconto = D(produto.descontoTotal);
  const produtosLiquido = valorBruto.minus(desconto);

  const outrosCustos = D(produto.freteTotal)
    .plus(D(produto.seguroTotal))
    .plus(D(produto.outrasDespesas))
    .plus(D(produto.embalagemPorUnidade).times(quantidade))
    .plus(D(produto.rateioPorUnidade).times(quantidade));

  const valorBaseAquisicao = produtosLiquido.plus(outrosCustos);

  let porFora = ZERO;
  let incluidos = ZERO;
  let informativos = ZERO;
  let creditos = ZERO;

  const detalhes: PurchaseTaxResult[] = (tributos ?? []).map((t) => {
    if (!t.enabled) {
      return {
        id: t.id,
        label: t.label,
        enabled: false,
        rate: t.rate,
        base: 0,
        valor: 0,
        treatment: t.treatment,
        creditMode: t.creditMode,
        credito: 0,
        origemValor: "Tributo desativado",
        origemCredito: "Tributo desativado",
      };
    }

    const baseBruta = t.baseMode === "manual" ? D(t.baseManual) : produtosLiquido;
    const reducao = Decimal.max(0, Decimal.min(100, D(t.baseReduction)));
    const base = baseBruta.times(D(1).minus(reducao.div(100)));

    const valor = t.useManualTax ? D(t.manualTaxValue) : base.times(pct(t.rate));

    const origemValor = t.useManualTax
      ? "Valor destacado na nota (informado manualmente)"
      : `${formatoFormula(base)} × ${t.rate}%`;

    // Tributo incluído já está dentro do valor informado: nunca soma ao desembolso.
    if (t.treatment === "porFora") porFora = porFora.plus(valor);
    else if (t.treatment === "incluido") incluidos = incluidos.plus(valor);
    else informativos = informativos.plus(valor);

    let credito = ZERO;
    let origemCredito = "Sem direito a crédito";
    if (t.creditMode === "manual") {
      credito = D(t.creditManual);
      origemCredito = "Crédito informado manualmente";
    } else if (t.treatment === "informativo") {
      origemCredito = "Tributo informativo: não gera crédito automático";
    } else if (t.creditMode === "integral") {
      credito = valor;
      origemCredito = "100% do tributo calculado";
    } else if (t.creditMode === "parcial") {
      const perc = Decimal.max(0, Decimal.min(100, D(t.creditPercent)));
      credito = valor.times(perc.div(100));
      origemCredito = `${t.creditPercent}% do tributo calculado`;
    }
    creditos = creditos.plus(credito);

    return {
      id: t.id,
      label: t.label,
      enabled: true,
      rate: t.rate,
      base: r4(base),
      valor: r4(valor),
      treatment: t.treatment,
      creditMode: t.creditMode,
      credito: r4(credito),
      origemValor,
      origemCredito,
    };
  });

  const desembolso = valorBaseAquisicao.plus(porFora);
  const custoLiquidoTotal = desembolso.minus(creditos);
  // Divisão total -> unitário só acontece aqui, uma única vez.
  const custoLiquidoUnitario = quantidade.gt(0) ? custoLiquidoTotal.div(quantidade) : ZERO;
  const valorMedioUnitario = quantidade.gt(0) ? desembolso.div(quantidade) : ZERO;

  return {
    valorBrutoProdutos: r4(valorBruto),
    desconto: r4(desconto),
    valorProdutosLiquido: r4(produtosLiquido),
    outrosCustosAquisicao: r4(outrosCustos),
    valorBaseAquisicao: r4(valorBaseAquisicao),
    tributosPorFora: r4(porFora),
    tributosIncluidos: r4(incluidos),
    tributosInformativos: r4(informativos),
    desembolsoTotal: r4(desembolso),
    creditosTotais: r4(creditos),
    custoLiquidoTotal: r4(custoLiquidoTotal),
    custoLiquidoUnitario: r4(custoLiquidoUnitario),
    /** Custo unitário em precisão plena (string Decimal) — evita perda na venda. */
    custoLiquidoUnitarioExato: custoLiquidoUnitario.toString(),
    valorMedioUnitario: r4(valorMedioUnitario),
    tributos: detalhes,
  };
}

function formatoFormula(base: Decimal) {
  return `base ${base.toDecimalPlaces(2).toString()}`;
}

/* ------------------------------------------------------------------ */
/* Regime tributário e ICMS de fronteira (DIFAL / antecipação)         */
/* ------------------------------------------------------------------ */

export const REGIMES: Array<{ id: Regime; nome: string; descricao: string }> = [
  {
    id: "simples",
    nome: "Simples Nacional",
    descricao: "Recolhe tudo no DAS. Não credita ICMS, PIS e Cofins da compra.",
  },
  {
    id: "presumido",
    nome: "Lucro Presumido",
    descricao: "Credita ICMS. PIS e Cofins são cumulativos (sem crédito).",
  },
  {
    id: "real",
    nome: "Lucro Real",
    descricao: "Credita ICMS, PIS e Cofins da compra.",
  },
  {
    id: "mei",
    nome: "MEI",
    descricao: "Recolhe valor fixo mensal. Nenhum tributo da compra gera crédito.",
  },
];

export function nomeRegime(regime: Regime | undefined | null): string {
  return REGIMES.find((r) => r.id === regime)?.nome ?? "Não informado";
}

/** Empresas do Simples e o MEI não se creditam do ICMS de fronteira: é custo puro. */
export function creditaFronteiraPorRegime(regime: Regime): boolean {
  return regime === "real" || regime === "presumido";
}

/** O regime apura a venda pelo DAS (tributo único incluído no preço)? */
export function apuraPeloSimples(regime: Regime): boolean {
  return regime === "simples" || regime === "mei";
}

export interface ResultadoFronteira {
  /** Alíquota resultante em % (interna do destino − interestadual). */
  rate: number;
  aliquotaInterna: number | null;
  aliquotaInterestadual: number | null;
  /** Existe diferencial a recolher? */
  aplicavel: boolean;
  /** Faltou alíquota cadastrada para o par informado. */
  faltaAliquota: boolean;
  creditavel: boolean;
  explicacao: string;
}

/**
 * ICMS de fronteira na entrada:
 *
 *   difal = max(0; alíquota interna do destino − alíquota interestadual) × base
 *
 * Operação dentro do mesmo estado não tem fronteira. Lucro Real e Presumido
 * creditam o valor recolhido; Simples e MEI o carregam como custo.
 */
export function calcularFronteira(op: OperacaoFiscal | undefined): ResultadoFronteira {
  const vazio: ResultadoFronteira = {
    rate: 0,
    aliquotaInterna: null,
    aliquotaInterestadual: null,
    aplicavel: false,
    faltaAliquota: false,
    creditavel: false,
    explicacao: "ICMS de fronteira não aplicável.",
  };
  if (!op || !op.difalAtivo) return vazio;

  const origem = (op.ufOrigem ?? "").toUpperCase();
  const destino = (op.ufDestino ?? "").toUpperCase();
  const creditavel = op.creditarDifal ?? creditaFronteiraPorRegime(op.regime);

  if (!origem || !destino) {
    return { ...vazio, explicacao: "Informe os estados de origem e destino." };
  }
  if (origem === destino) {
    return {
      ...vazio,
      explicacao: "Compra dentro do próprio estado: não há ICMS de fronteira.",
    };
  }

  const interna = op.aliquotaInternaDestino;
  const inter = op.aliquotaInterestadual;
  if (typeof interna !== "number" || typeof inter !== "number") {
    return {
      ...vazio,
      faltaAliquota: true,
      creditavel,
      explicacao: `Não há alíquota cadastrada para ${origem} → ${destino}.`,
    };
  }

  const diferenca = Decimal.max(0, D(interna).minus(D(inter)));
  return {
    rate: r4(diferenca),
    aliquotaInterna: interna,
    aliquotaInterestadual: inter,
    aplicavel: diferenca.gt(0),
    faltaAliquota: false,
    creditavel,
    explicacao: diferenca.gt(0)
      ? `${origem} → ${destino}: interna ${interna}% − interestadual ${inter}% = ${r4(diferenca)}%` +
        (creditavel
          ? ". Recuperável: entra como crédito."
          : ". Não recuperável neste regime: vira custo do produto.")
      : `Alíquota interna do destino (${interna}%) não é maior que a interestadual (${inter}%): nada a recolher.`,
  };
}

/** Tributo de compra derivado do contexto fiscal (ICMS de fronteira). */
export function tributoFronteira(op: OperacaoFiscal | undefined): PurchaseTax | null {
  if (!op || !op.difalAtivo) return null;
  const f = calcularFronteira(op);
  const manual = typeof op.difalManual === "number" && op.difalManual > 0;
  if (!manual && !f.aplicavel) return null;

  const creditavel = op.creditarDifal ?? creditaFronteiraPorRegime(op.regime);

  return {
    id: "icmsFronteira",
    label: "ICMS fronteira (DIFAL/antecipação)",
    descricao: f.explicacao,
    enabled: true,
    rate: f.rate,
    baseMode: "padrao",
    baseManual: 0,
    baseReduction: 0,
    useManualTax: manual,
    manualTaxValue: manual ? (op.difalManual as number) : 0,
    treatment: "porFora",
    creditMode: creditavel ? "integral" : "nao",
    creditPercent: 0,
    creditManual: 0,
    note: f.explicacao,
  };
}

/**
 * Tributos de compra efetivamente usados no cálculo: os informados pelo
 * usuário mais o ICMS de fronteira derivado do regime e das UFs.
 */
export function tributosCompraEfetivos(state: SimulationState): PurchaseTax[] {
  const informados = (state.tributosCompra ?? []).filter((t) => t.id !== "icmsFronteira");
  const fronteira = tributoFronteira(state.operacao);
  return fronteira ? [...informados, fronteira] : informados;
}

/**
 * Tributos de venda efetivos. No Simples/MEI a venda é tributada por um único
 * tributo (DAS) com a alíquota efetiva informada; os demais ficam desligados.
 */
export function tributosVendaEfetivos(state: SimulationState): SaleTax[] {
  const op = state.operacao;
  const lista = state.tributosVenda ?? [];
  if (!op) return lista.filter((t) => t.id !== "dasVenda" || t.enabled);

  if (apuraPeloSimples(op.regime)) {
    return lista.map((t) =>
      t.id === "dasVenda"
        ? { ...t, enabled: true, rate: D(op.aliquotaSimples).toNumber(), treatment: "incluido" as const, baseMode: "padrao" as const }
        : { ...t, enabled: t.treatment === "informativo" ? t.enabled : false },
    );
  }
  return lista.map((t) => (t.id === "dasVenda" ? { ...t, enabled: false } : t));
}


/* ------------------------------------------------------------------ */
/* Venda — núcleo único                                                */
/* ------------------------------------------------------------------ */

export interface SaleContext {
  /** Aceita número ou string Decimal (precisão plena). */
  custoLiquidoUnitario: number | string;
  venda: VendaConfig;
  tributos: SaleTax[];
}

interface NucleoVenda {
  precoBase: Decimal;
  incluidos: Decimal;
  porFora: Decimal;
  informativos: Decimal;
  precoFinal: Decimal;
  despesasVariaveis: Decimal;
  despesasFixas: Decimal;
  custo: Decimal;
  resultado: Decimal;
  margem: Decimal;
  detalhes: SaleTaxResult[];
}

/**
 * Núcleo da venda: única implementação das fórmulas.
 *
 *   precoFinal      = precoBase + tributos por fora
 *   despesasVar     = precoFinal × Σ percentuais
 *   resultado       = precoFinal − custo − incluídos − porFora − despVar − despFixas
 *                   = precoBase − custo − incluídos − despVar − despFixas
 *   margem          = resultado / (precoFinal ou precoBase) × 100
 *
 * Tributos informativos não entram em nenhuma das linhas acima.
 */
function nucleoVenda(precoBase: Decimal, ctx: SaleContext): NucleoVenda {
  const v = ctx.venda;
  const p = precoBase;

  let incluidos = ZERO;
  let porFora = ZERO;
  let informativos = ZERO;

  const detalhes: SaleTaxResult[] = [];
  for (const t of ctx.tributos ?? []) {
    if (!t.enabled) continue;
    const base = t.baseMode === "manual" ? D(t.baseManual) : p;
    const valor = base.times(pct(t.rate));
    if (t.treatment === "incluido") incluidos = incluidos.plus(valor);
    else if (t.treatment === "porFora") porFora = porFora.plus(valor);
    else informativos = informativos.plus(valor);
    detalhes.push({
      id: t.id,
      label: t.label,
      rate: t.rate,
      base: r4(base),
      valor: r4(valor),
      treatment: t.treatment,
    });
  }

  const precoFinal = p.plus(porFora);

  const percentuais = D(v.comissaoPercent)
    .plus(D(v.cartaoPercent))
    .plus(D(v.marketplacePercent))
    .plus(D(v.perdasPercent))
    .plus(D(v.outrosPercent));
  const despesasVariaveis = precoFinal.times(percentuais.div(100));

  const despesasFixas = D(v.freteVendaUnidade)
    .plus(D(v.embalagemVendaUnidade))
    .plus(D(v.custoFixoUnidade))
    .plus(D(v.outrasDespesasFixasUnidade));

  const custo = D(ctx.custoLiquidoUnitario);

  const resultado = precoFinal
    .minus(custo)
    .minus(incluidos)
    .minus(porFora)
    .minus(despesasVariaveis)
    .minus(despesasFixas);

  const baseMargem: MarginBase = v.baseMargem;
  const denominador = baseMargem === "precoBase" ? p : precoFinal;
  const margem = denominador.gt(0) ? resultado.div(denominador).times(100) : ZERO;

  return {
    precoBase: p,
    incluidos,
    porFora,
    informativos,
    precoFinal,
    despesasVariaveis,
    despesasFixas,
    custo,
    resultado,
    margem,
    detalhes,
  };
}

/** Avalia um preço-base candidato e devolve a decomposição arredondada. */
export function avaliarPreco(precoBase: number | string | Decimal, ctx: SaleContext): SaleEvaluation {
  const n = nucleoVenda(D(precoBase), ctx);

  const markupMult = n.custo.gt(0) ? n.precoFinal.div(n.custo) : ZERO;
  const markupPct = n.custo.gt(0) ? markupMult.minus(1).times(100) : ZERO;

  return {
    precoBase: r4(n.precoBase),
    tributosIncluidos: r4(n.incluidos),
    tributosPorFora: r4(n.porFora),
    tributosInformativos: r4(n.informativos),
    precoFinal: r4(n.precoFinal),
    despesasVariaveis: r4(n.despesasVariaveis),
    despesasFixasUnidade: r4(n.despesasFixas),
    custoLiquidoUnitario: r4(n.custo),
    resultadoUnidade: r4(n.resultado),
    margemEfetiva: r4(n.margem),
    markupMultiplicador: r4(markupMult),
    markupPercentual: r4(markupPct),
    tributos: n.detalhes,
  };
}

/** Margem exata (sem arredondamento) — usada pela busca binária. */
function margemExata(precoBase: Decimal, ctx: SaleContext): Decimal {
  return nucleoVenda(precoBase, ctx).margem;
}

const TOLERANCIA = new Decimal("1e-8");
/** Preço-base máximo considerado pela busca (evita resultados absurdos). */
const PRECO_MAXIMO = new Decimal("1e9");

/**
 * Busca binária determinística pelo preço-base que produz a margem alvo.
 * A margem é monotônica crescente no preço, então a bisseção converge.
 * Retorna null quando a margem é matematicamente inatingível.
 */
export function resolverPrecoPorMargem(
  margemAlvo: number,
  ctx: SaleContext,
): SaleEvaluation | null {
  const alvo = D(margemAlvo);
  if (alvo.gte(100)) return null;

  let lo = new Decimal(0);
  let hi = new Decimal(1);
  let encontrado = false;

  for (let i = 0; i < 200; i++) {
    if (margemExata(hi, ctx).gte(alvo)) {
      encontrado = true;
      break;
    }
    if (hi.gte(PRECO_MAXIMO)) break;
    lo = hi;
    hi = Decimal.min(hi.times(2), PRECO_MAXIMO);
  }
  if (!encontrado) return null;

  for (let i = 0; i < 400; i++) {
    const mid = lo.plus(hi).div(2);
    if (hi.minus(lo).lte(hi.abs().plus(1).times(TOLERANCIA))) break;
    if (margemExata(mid, ctx).gte(alvo)) hi = mid;
    else lo = mid;
  }
  return avaliarPreco(hi, ctx);
}

/**
 * Encontra o preço-base cujo preço final cobrado é igual ao informado.
 * Se nem o preço-base zero couber dentro do preço final desejado (tributos
 * por fora de base fixa maiores que o alvo), devolve a avaliação em zero.
 */
export function resolverPrecoPorPrecoFinal(
  precoFinalDesejado: number,
  ctx: SaleContext,
): SaleEvaluation {
  const alvo = D(precoFinalDesejado);
  if (alvo.lte(0)) return avaliarPreco(0, ctx);
  if (nucleoVenda(ZERO, ctx).precoFinal.gte(alvo)) return avaliarPreco(0, ctx);

  let lo = new Decimal(0);
  let hi = alvo.gt(0) ? alvo.times(2).plus(1) : new Decimal(1);

  for (let i = 0; i < 400; i++) {
    const mid = lo.plus(hi).div(2);
    if (hi.minus(lo).lte(alvo.abs().plus(1).times(TOLERANCIA))) break;
    if (nucleoVenda(mid, ctx).precoFinal.gte(alvo)) hi = mid;
    else lo = mid;
  }
  return avaliarPreco(lo.plus(hi).div(2), ctx);
}

/* ------------------------------------------------------------------ */
/* Validações                                                          */
/* ------------------------------------------------------------------ */

export const MENSAGEM_IMPOSSIVEL =
  "Não é possível formar o preço com os percentuais informados. A soma dos tributos, despesas e margem precisa ser inferior à receita disponível.";

export function validar(state: SimulationState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const p = state.produto;
  const tributosCompra = tributosCompraEfetivos(state);
  const tributosVenda = tributosVendaEfetivos(state);
  const op = state.operacao;

  if (op) {
    if (!op.ufOrigem) {
      issues.push({
        campo: "ufOrigem",
        mensagem: "Informe o estado de origem da mercadoria.",
        severidade: "erro",
      });
    }
    if (!op.ufDestino) {
      issues.push({
        campo: "ufDestino",
        mensagem: "Informe o estado de destino (o estado da sua empresa).",
        severidade: "erro",
      });
    }
    const fronteira = calcularFronteira(op);
    if (fronteira.faltaAliquota) {
      issues.push({
        campo: "aliquotasIcms",
        mensagem: `${fronteira.explicacao} Cadastre a alíquota vigente ou informe o valor de fronteira manualmente.`,
        severidade: "erro",
      });
    }
    if (apuraPeloSimples(op.regime)) {
      if (!finito(op.aliquotaSimples) || op.aliquotaSimples < 0) {
        issues.push({
          campo: "aliquotaSimples",
          mensagem: "Informe a alíquota efetiva do DAS (a que aparece na sua apuração).",
          severidade: "erro",
        });
      } else if (op.aliquotaSimples === 0) {
        issues.push({
          campo: "aliquotaSimples",
          mensagem:
            "A alíquota efetiva do DAS está zerada: o preço não considerará o imposto do Simples.",
          severidade: "aviso",
        });
      } else if (op.aliquotaSimples > 33) {
        issues.push({
          campo: "aliquotaSimples",
          mensagem: "A alíquota efetiva do DAS acima de 33% é incomum. Confira a apuração.",
          severidade: "aviso",
        });
      }
    }
  }


  if (!p.nome.trim()) {
    issues.push({ campo: "nome", mensagem: "Informe o nome do produto.", severidade: "erro" });
  }
  if (!finito(p.quantidade)) {
    issues.push({
      campo: "quantidade",
      mensagem: "A quantidade informada não é um número válido.",
      severidade: "erro",
    });
  } else if (!(p.quantidade > 0)) {
    issues.push({
      campo: "quantidade",
      mensagem: "A quantidade precisa ser maior que zero.",
      severidade: "erro",
    });
  } else if ((D(p.quantidade).decimalPlaces() ?? 0) > 4) {
    issues.push({
      campo: "quantidade",
      mensagem: "A quantidade aceita no máximo quatro casas decimais.",
      severidade: "erro",
    });
  }

  const monetarios: Array<[string, number, string]> = [
    ["valorUnitario", p.valorUnitario, "Valor unitário de compra"],
    ["descontoTotal", p.descontoTotal, "Desconto incondicional"],
    ["freteTotal", p.freteTotal, "Frete de compra"],
    ["seguroTotal", p.seguroTotal, "Seguro"],
    ["outrasDespesas", p.outrasDespesas, "Outras despesas de compra"],
    ["embalagemPorUnidade", p.embalagemPorUnidade, "Embalagem por unidade"],
    ["rateioPorUnidade", p.rateioPorUnidade, "Rateio por unidade"],
  ];
  for (const [campo, valor, rotulo] of monetarios) {
    if (!finito(valor)) {
      issues.push({
        campo,
        mensagem: `${rotulo}: informe um número válido.`,
        severidade: "erro",
      });
    } else if (valor < 0) {
      issues.push({ campo, mensagem: `${rotulo} não pode ser negativo.`, severidade: "erro" });
    }
  }

  if (finito(p.valorUnitario) && finito(p.quantidade) && finito(p.descontoTotal)) {
    const liquido = D(p.valorUnitario).times(D(p.quantidade)).minus(D(p.descontoTotal));
    if (liquido.lt(0)) {
      issues.push({
        campo: "descontoTotal",
        mensagem: "O desconto informado é maior que o valor bruto dos produtos.",
        severidade: "erro",
      });
    }
  }

  for (const t of tributosCompra) {
    if (!t.enabled) continue;
    if (!finito(t.rate) || t.rate < 0 || t.rate > 100) {
      issues.push({
        campo: t.id,
        mensagem: `${t.label}: a alíquota deve ficar entre 0% e 100%.`,
        severidade: "erro",
      });
    }
    if (!finito(t.baseReduction) || t.baseReduction < 0 || t.baseReduction > 100) {
      issues.push({
        campo: t.id,
        mensagem: `${t.label}: a redução de base deve ficar entre 0% e 100%.`,
        severidade: "erro",
      });
    }
    if (
      t.creditMode === "parcial" &&
      (!finito(t.creditPercent) || t.creditPercent < 0 || t.creditPercent > 100)
    ) {
      issues.push({
        campo: t.id,
        mensagem: `${t.label}: o percentual de crédito deve ficar entre 0% e 100%.`,
        severidade: "erro",
      });
    }
    if (t.creditMode === "manual" && (!finito(t.creditManual) || t.creditManual < 0)) {
      issues.push({
        campo: t.id,
        mensagem: `${t.label}: o crédito informado manualmente não pode ser negativo.`,
        severidade: "erro",
      });
    }
    if (t.useManualTax && (!finito(t.manualTaxValue) || t.manualTaxValue < 0)) {
      issues.push({
        campo: t.id,
        mensagem: `${t.label}: o valor destacado na nota não pode ser negativo.`,
        severidade: "erro",
      });
    }
    if (!t.useManualTax && t.baseMode === "manual" && !(t.baseManual > 0)) {
      issues.push({
        campo: t.id,
        mensagem: `${t.label}: informe a base de cálculo ou volte para a base padrão.`,
        severidade: "erro",
      });
    }
  }

  // Soma das alíquotas incluídas na compra: acima de 100% o valor informado
  // não comporta os tributos que supostamente estão dentro dele.
  const somaCompraIncluida = tributosCompra
    .filter((t) => t.enabled && t.treatment === "incluido" && !t.useManualTax && finito(t.rate))
    .reduce((acc, t) => acc + t.rate, 0);
  if (somaCompraIncluida >= 100) {
    issues.push({
      campo: "tributosCompra",
      mensagem:
        "A soma das alíquotas incluídas na compra chegou a 100% ou mais. Revise os tratamentos: um tributo por fora não deve estar marcado como incluído.",
      severidade: "erro",
    });
  }

  for (const t of tributosVenda) {
    if (!t.enabled) continue;
    if (!finito(t.rate) || t.rate < 0 || t.rate > 100) {
      issues.push({
        campo: t.id,
        mensagem: `${t.label} (venda): a alíquota deve ficar entre 0% e 100%.`,
        severidade: "erro",
      });
    }
    if (t.baseMode === "manual" && (!finito(t.baseManual) || t.baseManual < 0)) {
      issues.push({
        campo: t.id,
        mensagem: `${t.label} (venda): a base informada manualmente não pode ser negativa.`,
        severidade: "erro",
      });
    }
  }

  const v = state.venda;
  if (v.modo === "margem" && (!finito(v.margemDesejada) || v.margemDesejada >= 100)) {
    issues.push({
      campo: "margemDesejada",
      mensagem: "A margem desejada precisa ser menor que 100%.",
      severidade: "erro",
    });
  }
  if (v.modo === "analise" && !(v.precoInformado > 0)) {
    issues.push({
      campo: "precoInformado",
      mensagem: "Informe o preço de venda para analisar.",
      severidade: "erro",
    });
  }
  const percentuais = [
    v.comissaoPercent,
    v.cartaoPercent,
    v.marketplacePercent,
    v.perdasPercent,
    v.outrosPercent,
  ];
  if (percentuais.some((x) => !finito(x) || x < 0 || x > 100)) {
    issues.push({
      campo: "despesasPercentuais",
      mensagem: "Os percentuais de despesa devem ficar entre 0% e 100%.",
      severidade: "erro",
    });
  }
  const fixas: Array<[string, number, string]> = [
    ["freteVendaUnidade", v.freteVendaUnidade, "Frete de venda"],
    ["embalagemVendaUnidade", v.embalagemVendaUnidade, "Embalagem de venda"],
    ["custoFixoUnidade", v.custoFixoUnidade, "Custo fixo por unidade"],
    ["outrasDespesasFixasUnidade", v.outrasDespesasFixasUnidade, "Outras despesas fixas"],
  ];
  for (const [campo, valor, rotulo] of fixas) {
    if (!finito(valor) || valor < 0) {
      issues.push({
        campo,
        mensagem: `${rotulo}: informe um valor igual ou maior que zero.`,
        severidade: "erro",
      });
    }
  }

  // Aviso antecipado de percentuais próximos de 100%.
  const somaVenda =
    tributosVenda
      .filter((t) => t.enabled && t.treatment === "incluido" && finito(t.rate))
      .reduce((acc, t) => acc + t.rate, 0) +
    percentuais.filter(finito).reduce((acc, x) => acc + x, 0) +
    (v.modo === "margem" && finito(v.margemDesejada) ? v.margemDesejada : 0);
  if (somaVenda >= 95 && somaVenda < 100) {
    issues.push({
      campo: "somaPercentuais",
      mensagem: `A soma de tributos incluídos, despesas percentuais e margem chegou a ${somaVenda.toFixed(2)}%. O preço cresce muito rápido acima de 95%.`,
      severidade: "aviso",
    });
  }

  return issues;
}

/* ------------------------------------------------------------------ */
/* Simulação completa                                                  */
/* ------------------------------------------------------------------ */

export function simular(state: SimulationState): SimulationResult {
  const issues = validar(state);
  const compra = calcularCompra(state.produto, state.tributosCompra);

  if (compra.custoLiquidoTotal < 0) {
    issues.push({
      campo: "custoLiquido",
      mensagem:
        "O custo líquido ficou negativo: os créditos informados superam o desembolso. Revise as alíquotas e os créditos.",
      severidade: "aviso",
    });
  }

  const ctx: SaleContext = {
    // Precisão plena: a divisão total -> unitário não é arredondada aqui.
    custoLiquidoUnitario: compra.custoLiquidoUnitarioExato,
    venda: state.venda,
    tributos: state.tributosVenda,
  };

  const temErro = issues.some((i) => i.severidade === "erro");

  const precoMinimo = temErro ? null : resolverPrecoPorMargem(0, ctx);

  let recomendado: SaleEvaluation | null = null;
  let impossivel = false;

  if (!temErro) {
    if (state.venda.modo === "margem") {
      recomendado = resolverPrecoPorMargem(state.venda.margemDesejada, ctx);
      impossivel = recomendado === null;
    } else {
      recomendado = resolverPrecoPorPrecoFinal(state.venda.precoInformado, ctx);
    }
  }

  return {
    compra,
    precoMinimo,
    recomendado,
    issues,
    impossivel,
    mensagemImpossivel: impossivel ? MENSAGEM_IMPOSSIVEL : null,
  };
}
