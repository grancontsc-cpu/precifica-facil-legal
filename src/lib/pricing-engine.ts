import Decimal from "decimal.js";
import type {
  MarginBase,
  ProdutoCompra,
  PurchaseResult,
  PurchaseTax,
  PurchaseTaxResult,
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
 * Regras estruturais:
 *  - Tributo "incluído" já está dentro do valor informado -> NUNCA soma de novo.
 *  - Tributo "por fora" é acrescentado ao desembolso / ao preço cobrado.
 *  - Tributo "informativo" não altera desembolso nem custo (crédito só se manual).
 *  - Alíquota e direito ao crédito são independentes.
 *  - Todo o cálculo interno usa Decimal com 12 dígitos; a exibição arredonda em 2.
 */

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

const D = (v: number | string | Decimal) => new Decimal(v ?? 0);
const ZERO = new Decimal(0);

/** Arredonda para 4 casas (precisão interna mínima exigida). */
const r4 = (v: Decimal) => v.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();

const pct = (v: number) => D(v).div(100);

/* ------------------------------------------------------------------ */
/* Compra                                                              */
/* ------------------------------------------------------------------ */

export function calcularCompra(produto: ProdutoCompra, tributos: PurchaseTax[]): PurchaseResult {
  const quantidade = D(produto.quantidade);
  const valorBruto = D(produto.valorUnitario).times(quantidade);
  const desconto = D(produto.descontoTotal);
  const produtosLiquido = valorBruto.minus(desconto);

  const outrosCustos = D(produto.freteTotal)
    .plus(produto.seguroTotal)
    .plus(produto.outrasDespesas)
    .plus(D(produto.embalagemPorUnidade).times(quantidade))
    .plus(D(produto.rateioPorUnidade).times(quantidade));

  const valorBaseAquisicao = produtosLiquido.plus(outrosCustos);

  let porFora = ZERO;
  let incluidos = ZERO;
  let informativos = ZERO;
  let creditos = ZERO;

  const detalhes: PurchaseTaxResult[] = tributos.map((t) => {
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
    const base = baseBruta.times(D(1).minus(pct(t.baseReduction)));

    const valor = t.useManualTax ? D(t.manualTaxValue) : base.times(pct(t.rate));

    const origemValor = t.useManualTax
      ? "Valor destacado na nota (informado manualmente)"
      : `${formatoFormula(base)} × ${t.rate}%`;

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
      credito = valor.times(pct(t.creditPercent));
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
    valorMedioUnitario: r4(valorMedioUnitario),
  tributos: detalhes,
  };
}

function formatoFormula(base: Decimal) {
  return `base ${base.toDecimalPlaces(2).toString()}`;
}

/* ------------------------------------------------------------------ */
/* Venda — função pura de avaliação de um preço candidato              */
/* ------------------------------------------------------------------ */

export interface SaleContext {
  custoLiquidoUnitario: number;
  venda: VendaConfig;
  tributos: SaleTax[];
}

/**
 * Avalia um preço-base candidato (valor da mercadoria antes dos tributos
 * acrescentados por fora) e devolve toda a decomposição da venda.
 */
export function avaliarPreco(precoBase: number | Decimal, ctx: SaleContext): SaleEvaluation {
  const p = D(precoBase);
  const v = ctx.venda;

  let incluidos = ZERO;
  let porFora = ZERO;
  let informativos = ZERO;

  const detalhes: SaleTaxResult[] = ctx.tributos
    .filter((t) => t.enabled)
    .map((t) => {
      const base = t.baseMode === "manual" ? D(t.baseManual) : p;
      const valor = base.times(pct(t.rate));
      if (t.treatment === "incluido") incluidos = incluidos.plus(valor);
      else if (t.treatment === "porFora") porFora = porFora.plus(valor);
      else informativos = informativos.plus(valor);
      return {
        id: t.id,
        label: t.label,
        rate: t.rate,
        base: r4(base),
        valor: r4(valor),
        treatment: t.treatment,
      };
    });

  const precoFinal = p.plus(porFora);

  // Despesas percentuais incidem sobre o preço final cobrado.
  const percentuais = D(v.comissaoPercent)
    .plus(v.cartaoPercent)
    .plus(v.marketplacePercent)
    .plus(v.perdasPercent)
    .plus(v.outrosPercent);
  const despesasVariaveis = precoFinal.times(pct(percentuais.toNumber()));

  const despesasFixas = D(v.freteVendaUnidade)
    .plus(v.embalagemVendaUnidade)
    .plus(v.custoFixoUnidade)
    .plus(v.outrasDespesasFixasUnidade);

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

  const markupMult = custo.gt(0) ? precoFinal.div(custo) : ZERO;
  const markupPct = custo.gt(0) ? markupMult.minus(1).times(100) : ZERO;

  return {
    precoBase: r4(p),
    tributosIncluidos: r4(incluidos),
    tributosPorFora: r4(porFora),
    tributosInformativos: r4(informativos),
    precoFinal: r4(precoFinal),
    despesasVariaveis: r4(despesasVariaveis),
    despesasFixasUnidade: r4(despesasFixas),
    custoLiquidoUnitario: r4(custo),
    resultadoUnidade: r4(resultado),
    margemEfetiva: r4(margem),
    markupMultiplicador: r4(markupMult),
    markupPercentual: r4(markupPct),
    tributos: detalhes,
  };
}

/**
 * Margem exata (sem arredondamento) de um preço candidato.
 * Usada apenas pela busca binária, para não confundir uma margem
 * assintoticamente inatingível com uma margem realmente alcançada.
 */
function margemExata(precoBase: Decimal, ctx: SaleContext): Decimal {
  const v = ctx.venda;
  let incluidos = ZERO;
  let porFora = ZERO;
  for (const t of ctx.tributos) {
    if (!t.enabled) continue;
    const base = t.baseMode === "manual" ? D(t.baseManual) : precoBase;
    const valor = base.times(pct(t.rate));
    if (t.treatment === "incluido") incluidos = incluidos.plus(valor);
    else if (t.treatment === "porFora") porFora = porFora.plus(valor);
  }
  const precoFinal = precoBase.plus(porFora);
  const percentuais = D(v.comissaoPercent)
    .plus(v.cartaoPercent)
    .plus(v.marketplacePercent)
    .plus(v.perdasPercent)
    .plus(v.outrosPercent);
  const despesasVariaveis = precoFinal.times(pct(percentuais.toNumber()));
  const despesasFixas = D(v.freteVendaUnidade)
    .plus(v.embalagemVendaUnidade)
    .plus(v.custoFixoUnidade)
    .plus(v.outrasDespesasFixasUnidade);
  const resultado = precoFinal
    .minus(ctx.custoLiquidoUnitario)
    .minus(incluidos)
    .minus(porFora)
    .minus(despesasVariaveis)
    .minus(despesasFixas);
  const denominador = v.baseMargem === "precoBase" ? precoBase : precoFinal;
  return denominador.gt(0) ? resultado.div(denominador).times(100) : ZERO;
}

const TOLERANCIA = new Decimal("0.0001");
/** Preço-base máximo considerado pela busca (evita resultados absurdos). */
const PRECO_MAXIMO = new Decimal("1e9");

/**
 * Busca binária determinística pelo preço-base que produz a margem alvo.
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

  for (let i = 0; i < 300; i++) {
    const mid = lo.plus(hi).div(2);
    const evalMid = avaliarPreco(mid, ctx);
    const diff = D(evalMid.margemEfetiva).minus(alvo);
    if (diff.abs().lt(TOLERANCIA) && hi.minus(lo).lt(TOLERANCIA)) {
      return evalMid;
    }
    if (diff.gt(0)) hi = mid;
    else lo = mid;
  }
  return avaliarPreco(lo.plus(hi).div(2), ctx);
}

/** Encontra o preço-base cujo preço final cobrado é igual ao informado. */
export function resolverPrecoPorPrecoFinal(
  precoFinalDesejado: number,
  ctx: SaleContext,
): SaleEvaluation {
  const alvo = D(precoFinalDesejado);
  let lo = new Decimal(0);
  let hi = alvo.gt(0) ? alvo.times(2).plus(1) : new Decimal(1);

  for (let i = 0; i < 300; i++) {
    const mid = lo.plus(hi).div(2);
    const ev = avaliarPreco(mid, ctx);
    const diff = D(ev.precoFinal).minus(alvo);
    if (diff.abs().lt(TOLERANCIA)) return ev;
    if (diff.gt(0)) hi = mid;
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

  if (!p.nome.trim()) {
    issues.push({ campo: "nome", mensagem: "Informe o nome do produto.", severidade: "erro" });
  }
  if (!(p.quantidade > 0)) {
    issues.push({
      campo: "quantidade",
      mensagem: "A quantidade precisa ser maior que zero.",
      severidade: "erro",
    });
  } else if (D(p.quantidade).decimalPlaces() > 4) {
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
    if (valor < 0) {
      issues.push({
        campo,
        mensagem: `${rotulo} não pode ser negativo.`,
        severidade: "erro",
      });
    }
  }

  for (const t of state.tributosCompra) {
    if (!t.enabled) continue;
    if (t.rate < 0 || t.rate > 100) {
      issues.push({
        campo: t.id,
        mensagem: `${t.label}: a alíquota deve ficar entre 0% e 100%.`,
        severidade: "erro",
      });
    }
    if (t.baseReduction < 0 || t.baseReduction > 100) {
      issues.push({
        campo: t.id,
        mensagem: `${t.label}: a redução de base deve ficar entre 0% e 100%.`,
        severidade: "erro",
      });
    }
    if (t.creditMode === "parcial" && (t.creditPercent < 0 || t.creditPercent > 100)) {
      issues.push({
        campo: t.id,
        mensagem: `${t.label}: o percentual de crédito deve ficar entre 0% e 100%.`,
        severidade: "erro",
      });
    }
    if (t.creditMode === "manual" && t.creditManual < 0) {
      issues.push({
        campo: t.id,
        mensagem: `${t.label}: o crédito informado manualmente não pode ser negativo.`,
        severidade: "erro",
      });
    }
    if (t.useManualTax && t.manualTaxValue < 0) {
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

  for (const t of state.tributosVenda) {
    if (!t.enabled) continue;
    if (t.rate < 0 || t.rate > 100) {
      issues.push({
        campo: t.id,
        mensagem: `${t.label} (venda): a alíquota deve ficar entre 0% e 100%.`,
        severidade: "erro",
      });
    }
  }

  const v = state.venda;
  if (v.modo === "margem" && v.margemDesejada >= 100) {
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
  if (percentuais.some((x) => x < 0 || x > 100)) {
    issues.push({
      campo: "despesasPercentuais",
      mensagem: "Os percentuais de despesa devem ficar entre 0% e 100%.",
      severidade: "erro",
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
    custoLiquidoUnitario: compra.custoLiquidoUnitario,
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
