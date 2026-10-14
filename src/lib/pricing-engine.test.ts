import { describe, expect, it } from "vitest";
import {
  avaliarPreco,
  calcularCompra,
  resolverPrecoPorMargem,
  resolverPrecoPorPrecoFinal,
  simular,
  validar,
} from "./pricing-engine";
import { estadoInicial, tributosCompraPadrao } from "./pricing-defaults";
import type { PurchaseTax, SaleTax, SimulationState } from "@/types/pricing";

const round2 = (n: number) => Math.round(n * 100) / 100;

function compraSimples(patch: Partial<SimulationState["produto"]>) {
  return { ...estadoInicial().produto, ...patch };
}

function tributos(patchById: Record<string, Partial<PurchaseTax>>): PurchaseTax[] {
  return tributosCompraPadrao().map((t) =>
    patchById[t.id] ? ({ ...t, ...patchById[t.id] } as PurchaseTax) : { ...t, enabled: false },
  );
}

function tv(patch: Partial<SaleTax> & { id: SaleTax["id"]; rate: number }): SaleTax {
  return {
    label: patch.id,
    descricao: "",
    enabled: true,
    baseMode: "padrao",
    baseManual: 0,
    treatment: "incluido",
    ...patch,
  } as SaleTax;
}

function ctxVenda(custo: number | string, tributosVenda: SaleTax[], vendaPatch = {}) {
  const base = estadoInicial();
  return {
    custoLiquidoUnitario: custo,
    venda: { ...base.venda, ...vendaPatch },
    tributos: tributosVenda,
  };
}

const semTributos: SaleTax[] = [];

/* ================================================================== */
/* 1. Dupla contagem de tributos incluídos                             */
/* ================================================================== */
describe("1. tributos incluídos no preço não são somados duas vezes", () => {
  it("compra: ICMS 18% incluído não altera o desembolso", () => {
    const r = calcularCompra(
      compraSimples({ quantidade: 1, valorUnitario: 100 }),
      tributos({ icms: { enabled: true, rate: 18, treatment: "incluido", creditMode: "nao" } }),
    );
    expect(round2(r.desembolsoTotal)).toBe(100);
    expect(round2(r.tributosIncluidos)).toBe(18);
    expect(round2(r.custoLiquidoTotal)).toBe(100);
  });

  it("venda: tributo incluído não infla o preço final, só reduz o resultado", () => {
    const ev = avaliarPreco(100, ctxVenda(50, [tv({ id: "icmsVenda", rate: 20 })]));
    expect(round2(ev.precoFinal)).toBe(100);
    expect(round2(ev.tributosIncluidos)).toBe(20);
    expect(round2(ev.resultadoUnidade)).toBe(30);
  });

  it("CASO 1 — ICMS 7% incluído com crédito integral", () => {
    const r = calcularCompra(
      compraSimples({ quantidade: 1, valorUnitario: 48 }),
      tributos({
        icms: { enabled: true, rate: 7, treatment: "incluido", creditMode: "integral" },
        pis: { enabled: true, rate: 0 },
        cofins: { enabled: true, rate: 0 },
      }),
    );
    expect(round2(r.desembolsoTotal)).toBe(48);
    expect(round2(r.tributos.find((t) => t.id === "icms")!.credito)).toBe(3.36);
    expect(round2(r.custoLiquidoTotal)).toBe(44.64);
  });

  it("CASO 2 — ICMS 20,5% incluído com crédito integral", () => {
    const r = calcularCompra(
      compraSimples({ quantidade: 1, valorUnitario: 62 }),
      tributos({
        icms: { enabled: true, rate: 20.5, treatment: "incluido", creditMode: "integral" },
      }),
    );
    expect(round2(r.desembolsoTotal)).toBe(62);
    expect(round2(r.tributos.find((t) => t.id === "icms")!.credito)).toBe(12.71);
    expect(round2(r.custoLiquidoTotal)).toBe(49.29);
  });
});

/* ================================================================== */
/* 2. Tributos acrescentados por fora                                  */
/* ================================================================== */
describe("2. tributos por fora", () => {
  it("compra: IPI 10% por fora aumenta o desembolso", () => {
    const r = calcularCompra(
      compraSimples({ quantidade: 1, valorUnitario: 100 }),
      tributos({ ipi: { enabled: true, rate: 10, treatment: "porFora", creditMode: "nao" } }),
    );
    expect(round2(r.desembolsoTotal)).toBe(110);
    expect(round2(r.tributosPorFora)).toBe(10);
  });

  it("CASO 5 — CBS de 10% acrescentada por fora na venda", () => {
    const ev = avaliarPreco(
      100,
      ctxVenda(50, [tv({ id: "cbsVenda", rate: 10, treatment: "porFora" })]),
    );
    expect(round2(ev.tributosPorFora)).toBe(10);
    expect(round2(ev.precoFinal)).toBe(110);
  });

  it("tributo por fora é repasse puro: não muda o resultado por unidade", () => {
    const semPorFora = avaliarPreco(100, ctxVenda(50, semTributos));
    const comPorFora = avaliarPreco(
      100,
      ctxVenda(50, [tv({ id: "cbsVenda", rate: 10, treatment: "porFora" })]),
    );
    expect(round2(comPorFora.resultadoUnidade)).toBe(round2(semPorFora.resultadoUnidade));
  });
});

/* ================================================================== */
/* 3. Tributos informativos                                            */
/* ================================================================== */
describe("3. tributos informativos", () => {
  it("compra: informativo não muda desembolso nem custo", () => {
    const r = calcularCompra(
      compraSimples({ quantidade: 1, valorUnitario: 100 }),
      tributos({
        ibs: { enabled: true, rate: 0.1, treatment: "informativo", creditMode: "integral" },
      }),
    );
    expect(round2(r.desembolsoTotal)).toBe(100);
    expect(round2(r.custoLiquidoTotal)).toBe(100);
    expect(r.tributosInformativos).toBeCloseTo(0.1, 4);
    expect(round2(r.creditosTotais)).toBe(0);
  });

  it("venda: informativo não muda preço final nem resultado", () => {
    const base = avaliarPreco(100, ctxVenda(50, semTributos));
    const info = avaliarPreco(
      100,
      ctxVenda(50, [tv({ id: "ibsVenda", rate: 0.1, treatment: "informativo" })]),
    );
    expect(info.precoFinal).toBe(base.precoFinal);
    expect(info.resultadoUnidade).toBe(base.resultadoUnidade);
    expect(info.tributosInformativos).toBeCloseTo(0.1, 4);
  });
});

/* ================================================================== */
/* 4. Créditos integrais, parciais e manuais                           */
/* ================================================================== */
describe("4. modos de crédito", () => {
  it("crédito integral = 100% do tributo", () => {
    const r = calcularCompra(
      compraSimples({ quantidade: 1, valorUnitario: 100 }),
      tributos({ icms: { enabled: true, rate: 20, creditMode: "integral" } }),
    );
    expect(round2(r.creditosTotais)).toBe(20);
  });

  it("crédito parcial aplica o percentual informado", () => {
    const r = calcularCompra(
      compraSimples({ quantidade: 1, valorUnitario: 100 }),
      tributos({ icms: { enabled: true, rate: 20, creditMode: "parcial", creditPercent: 50 } }),
    );
    expect(round2(r.creditosTotais)).toBe(10);
  });

  it("crédito manual ignora a alíquota (inclusive com alíquota zero)", () => {
    const r = calcularCompra(
      compraSimples({ quantidade: 1, valorUnitario: 100 }),
      tributos({ icms: { enabled: true, rate: 0, creditMode: "manual", creditManual: 5 } }),
    );
    expect(round2(r.creditosTotais)).toBe(5);
    expect(round2(r.custoLiquidoTotal)).toBe(95);
  });

  it("alíquota e crédito são independentes: alíquota alta sem crédito", () => {
    const r = calcularCompra(
      compraSimples({ quantidade: 1, valorUnitario: 100 }),
      tributos({ icms: { enabled: true, rate: 25, creditMode: "nao" } }),
    );
    expect(round2(r.creditosTotais)).toBe(0);
  });
});

/* ================================================================== */
/* 5. PIS e Cofins com alíquota zero                                   */
/* ================================================================== */
describe("5. PIS e Cofins zerados", () => {
  it("não geram valor nem crédito e não quebram o cálculo", () => {
    const r = calcularCompra(
      compraSimples({ quantidade: 1, valorUnitario: 100 }),
      tributos({
        pis: { enabled: true, rate: 0, creditMode: "integral" },
        cofins: { enabled: true, rate: 0, creditMode: "integral" },
      }),
    );
    expect(round2(r.creditosTotais)).toBe(0);
    expect(round2(r.custoLiquidoTotal)).toBe(100);
    expect(Number.isFinite(r.custoLiquidoUnitario)).toBe(true);
  });

  it("venda com PIS/Cofins zero mantém a margem alvo", () => {
    const ev = resolverPrecoPorMargem(
      20,
      ctxVenda(100, [tv({ id: "pisVenda", rate: 0 }), tv({ id: "cofinsVenda", rate: 0 })]),
    )!;
    expect(round2(ev.precoFinal)).toBe(125);
  });
});

/* ================================================================== */
/* 6. Quantidade maior que uma unidade                                 */
/* ================================================================== */
describe("6. quantidade > 1", () => {
  it("escala valores totais e mantém o unitário coerente", () => {
    const r = calcularCompra(
      compraSimples({ quantidade: 120, valorUnitario: 18.9 }),
      tributos({
        icms: { enabled: true, rate: 18, treatment: "incluido", creditMode: "integral" },
      }),
    );
    expect(round2(r.valorBrutoProdutos)).toBe(2268);
    expect(round2(r.creditosTotais)).toBe(408.24);
    expect(round2(r.custoLiquidoTotal)).toBe(1859.76);
    expect(round2(r.custoLiquidoUnitario)).toBe(15.5);
  });

  it("quantidade fracionária é aceita", () => {
    const r = calcularCompra(compraSimples({ quantidade: 2.5, valorUnitario: 10 }), tributos({}));
    expect(round2(r.valorBrutoProdutos)).toBe(25);
    expect(round2(r.custoLiquidoUnitario)).toBe(10);
  });
});

/* ================================================================== */
/* 7. Descontos e fretes totais                                        */
/* ================================================================== */
describe("7. descontos e fretes totais", () => {
  it("CASO 3 — desconto e frete sem tributos", () => {
    const r = calcularCompra(
      compraSimples({ quantidade: 10, valorUnitario: 100, descontoTotal: 20, freteTotal: 50 }),
      tributos({}),
    );
    expect(round2(r.valorBrutoProdutos)).toBe(1000);
    expect(round2(r.valorProdutosLiquido)).toBe(980);
    expect(round2(r.custoLiquidoTotal)).toBe(1030);
    expect(round2(r.custoLiquidoUnitario)).toBe(103);
  });

  it("desconto reduz a base do tributo; frete não entra na base padrão", () => {
    const r = calcularCompra(
      compraSimples({ quantidade: 10, valorUnitario: 100, descontoTotal: 200, freteTotal: 100 }),
      tributos({
        icms: { enabled: true, rate: 10, treatment: "incluido", creditMode: "integral" },
      }),
    );
    expect(round2(r.tributos.find((t) => t.id === "icms")!.base)).toBe(800);
    expect(round2(r.creditosTotais)).toBe(80);
    expect(round2(r.desembolsoTotal)).toBe(900);
  });

  it("embalagem e rateio por unidade são multiplicados pela quantidade", () => {
    const r = calcularCompra(
      compraSimples({
        quantidade: 10,
        valorUnitario: 10,
        embalagemPorUnidade: 1,
        rateioPorUnidade: 0.5,
      }),
      tributos({}),
    );
    expect(round2(r.outrosCustosAquisicao)).toBe(15);
    expect(round2(r.custoLiquidoUnitario)).toBe(11.5);
  });

  it("desconto maior que o valor bruto é bloqueado", () => {
    const state = estadoInicial();
    state.produto = compraSimples({
      nome: "X",
      quantidade: 1,
      valorUnitario: 10,
      descontoTotal: 50,
    });
    expect(validar(state).some((i) => i.campo === "descontoTotal")).toBe(true);
  });
});

/* ================================================================== */
/* 8. Divisão entre totais e unitários                                 */
/* ================================================================== */
describe("8. totais x unitários", () => {
  it("custo unitário × quantidade reconstrói o custo total", () => {
    const r = calcularCompra(
      compraSimples({ quantidade: 3, valorUnitario: 10, freteTotal: 1 }),
      tributos({}),
    );
    expect(round2(Number(r.custoLiquidoUnitarioExato) * 3)).toBe(round2(r.custoLiquidoTotal));
  });

  it("dízima 100/3 não perde precisão até a venda", () => {
    const r = calcularCompra(compraSimples({ quantidade: 3, valorUnitario: 100 }), tributos({}));
    expect(Number(r.custoLiquidoUnitarioExato)).toBeCloseTo(100, 10);

    // 33,333333 × 3 = 99,999999 — o unitário exato reconstrói o total sem erro.
    const r2 = calcularCompra(
      compraSimples({ quantidade: 3, valorUnitario: 33.333333 }),
      tributos({}),
    );
    expect(Number(r2.custoLiquidoUnitarioExato) * 3).toBeCloseTo(99.999999, 9);
    // O total exposto é o mesmo número, arredondado só para exibição (4 casas).
    expect(r2.custoLiquidoTotal).toBe(100);
  });

  it("quantidade zero não gera divisão por zero", () => {
    const r = calcularCompra(compraSimples({ quantidade: 0, valorUnitario: 10 }), tributos({}));
    expect(r.custoLiquidoUnitario).toBe(0);
    expect(Number.isFinite(r.custoLiquidoUnitario)).toBe(true);
  });
});

/* ================================================================== */
/* 9. Cálculo reverso do preço pela margem                             */
/* ================================================================== */
describe("9. preço reverso pela margem", () => {
  it("CASO 4 — 20% de tributo incluído e margem de 30%", () => {
    const ctx = ctxVenda(100, [tv({ id: "icmsVenda", rate: 20 })]);
    expect(round2(resolverPrecoPorMargem(30, ctx)!.precoFinal)).toBe(200);
    expect(round2(resolverPrecoPorMargem(0, ctx)!.precoFinal)).toBe(125);
  });

  it("o preço encontrado devolve exatamente a margem pedida", () => {
    const ctx = ctxVenda(
      87.34,
      [tv({ id: "icmsVenda", rate: 18 }), tv({ id: "cbsVenda", rate: 8.8, treatment: "porFora" })],
      { comissaoPercent: 4, cartaoPercent: 2.5, freteVendaUnidade: 3, custoFixoUnidade: 1.2 },
    );
    for (const alvo of [0, 5, 12.5, 33.33, 60]) {
      const ev = resolverPrecoPorMargem(alvo, ctx)!;
      expect(ev.margemEfetiva).toBeCloseTo(alvo, 3);
    }
  });

  it("margem zero equivale a resultado zero", () => {
    const ev = resolverPrecoPorMargem(0, ctxVenda(50, [tv({ id: "icmsVenda", rate: 10 })]))!;
    expect(round2(ev.resultadoUnidade)).toBe(0);
  });

  it("modo análise: o preço final encontrado bate com o informado", () => {
    const ctx = ctxVenda(40, [tv({ id: "cbsVenda", rate: 10, treatment: "porFora" })]);
    const ev = resolverPrecoPorPrecoFinal(110, ctx);
    expect(round2(ev.precoFinal)).toBe(110);
    expect(round2(ev.precoBase)).toBe(100);
  });

  it("modo análise com preço zero ou negativo não trava", () => {
    const ctx = ctxVenda(40, semTributos);
    expect(resolverPrecoPorPrecoFinal(0, ctx).precoFinal).toBe(0);
    expect(resolverPrecoPorPrecoFinal(-10, ctx).precoFinal).toBe(0);
  });
});

/* ================================================================== */
/* 10. Arredondamento                                                  */
/* ================================================================== */
describe("10. arredondamento apenas na saída", () => {
  it("mantém 4 casas no motor (não arredonda para 2)", () => {
    const r = calcularCompra(
      compraSimples({ quantidade: 1, valorUnitario: 10 }),
      tributos({
        icms: { enabled: true, rate: 3.3333, treatment: "incluido", creditMode: "integral" },
      }),
    );
    expect(r.creditosTotais).toBeCloseTo(0.3333, 4);
  });

  it("soma de centavos não acumula erro de ponto flutuante", () => {
    const r = calcularCompra(
      compraSimples({ quantidade: 3, valorUnitario: 0.1, freteTotal: 0.2 }),
      tributos({}),
    );
    expect(r.custoLiquidoTotal).toBe(0.5); // 0.1*3 + 0.2 em binário daria 0.5000000000000001
  });

  it("a margem exibida é o arredondamento da margem real", () => {
    const ev = avaliarPreco(133.333333, ctxVenda(100, semTributos));
    expect(ev.margemEfetiva).toBeCloseTo(25, 4);
  });
});

/* ================================================================== */
/* 11. NaN, Infinity e negativos                                       */
/* ================================================================== */
describe("11. entradas inválidas", () => {
  it("NaN e Infinity são neutralizados (tratados como zero) e nunca vazam", () => {
    const r = calcularCompra(
      compraSimples({ quantidade: 2, valorUnitario: NaN, freteTotal: Infinity }),
      tributos({ icms: { enabled: true, rate: NaN as unknown as number, creditMode: "integral" } }),
    );
    for (const valor of Object.values(r)) {
      if (typeof valor === "number") expect(Number.isFinite(valor)).toBe(true);
    }
    expect(r.custoLiquidoTotal).toBe(0);
  });

  it("a venda não devolve NaN quando o custo é inválido", () => {
    const ev = avaliarPreco(100, ctxVenda(NaN as unknown as number, semTributos));
    expect(Number.isFinite(ev.resultadoUnidade)).toBe(true);
    expect(Number.isFinite(ev.margemEfetiva)).toBe(true);
  });

  it("valores inválidos e negativos viram erro de validação", () => {
    const state = estadoInicial();
    state.produto = compraSimples({ nome: "X", quantidade: NaN, valorUnitario: -5 });
    const issues = validar(state);
    expect(issues.some((i) => i.campo === "quantidade")).toBe(true);
    expect(issues.some((i) => i.campo === "valorUnitario")).toBe(true);
  });

  it("custo líquido negativo por excesso de crédito gera aviso", () => {
    const state = estadoInicial();
    state.produto = compraSimples({ nome: "X", quantidade: 1, valorUnitario: 100 });
    state.tributosCompra = tributos({
      icms: { enabled: true, rate: 0, creditMode: "manual", creditManual: 500 },
    });
    const res = simular(state);
    expect(res.issues.some((i) => i.campo === "custoLiquido" && i.severidade === "aviso")).toBe(
      true,
    );
  });

  it("markup não explode quando o custo é zero", () => {
    const ev = avaliarPreco(50, ctxVenda(0, semTributos));
    expect(Number.isFinite(ev.markupMultiplicador)).toBe(true);
    expect(Number.isFinite(ev.markupPercentual)).toBe(true);
  });
});

/* ================================================================== */
/* 12. Soma de percentuais próxima ou superior a 100%                  */
/* ================================================================== */
describe("12. percentuais somando perto de 100%", () => {
  it("CASO 6 — 60% de tributo com margem de 40% é impossível", () => {
    expect(
      resolverPrecoPorMargem(40, ctxVenda(100, [tv({ id: "icmsVenda", rate: 60 })])),
    ).toBeNull();

    const state = estadoInicial();
    state.produto = compraSimples({ nome: "Teste", quantidade: 1, valorUnitario: 100 });
    state.tributosCompra = tributos({});
    state.tributosVenda = [tv({ id: "icmsVenda", rate: 60 })];
    state.venda = { ...state.venda, margemDesejada: 40 };
    const res = simular(state);
    expect(res.impossivel).toBe(true);
    expect(res.mensagemImpossivel).toContain("Não é possível formar o preço");
  });

  it("99% ainda é resolvível, mas com preço alto", () => {
    const ctx = ctxVenda(100, [tv({ id: "icmsVenda", rate: 90 })]);
    const ev = resolverPrecoPorMargem(9, ctx)!;
    expect(round2(ev.precoFinal)).toBe(10000);
  });

  it("soma >= 95% emite aviso", () => {
    const state = estadoInicial();
    state.produto = compraSimples({ nome: "X", quantidade: 1, valorUnitario: 10 });
    state.tributosVenda = [tv({ id: "icmsVenda", rate: 70 })];
    state.venda = { ...state.venda, margemDesejada: 26 };
    expect(validar(state).some((i) => i.campo === "somaPercentuais")).toBe(true);
  });

  it("margem de 100% ou mais é bloqueada", () => {
    const state = estadoInicial();
    state.produto = compraSimples({ nome: "X", quantidade: 1, valorUnitario: 10 });
    state.venda = { ...state.venda, margemDesejada: 100 };
    expect(simular(state).issues.some((i) => i.campo === "margemDesejada")).toBe(true);
  });

  it("alíquotas incluídas na compra somando 100% são bloqueadas", () => {
    const state = estadoInicial();
    state.produto = compraSimples({ nome: "X", quantidade: 1, valorUnitario: 10 });
    state.tributosCompra = tributos({
      icms: { enabled: true, rate: 60, treatment: "incluido" },
      pis: { enabled: true, rate: 40, treatment: "incluido" },
    });
    expect(validar(state).some((i) => i.campo === "tributosCompra")).toBe(true);
  });
});

/* ================================================================== */
/* 13. Base da margem                                                  */
/* ================================================================== */
describe("13. alteração da base da margem", () => {
  it("margem sobre preço-base difere da margem sobre preço final quando há tributo por fora", () => {
    const t = [tv({ id: "cbsVenda", rate: 10, treatment: "porFora" })];
    const sobreFinal = avaliarPreco(100, ctxVenda(50, t, { baseMargem: "precoFinal" }));
    const sobreBase = avaliarPreco(100, ctxVenda(50, t, { baseMargem: "precoBase" }));
    expect(round2(sobreFinal.resultadoUnidade)).toBe(50);
    expect(round2(sobreFinal.margemEfetiva)).toBe(45.45); // 50/110
    expect(round2(sobreBase.margemEfetiva)).toBe(50); // 50/100
  });

  it("as duas bases coincidem quando não há tributo por fora", () => {
    const a = avaliarPreco(100, ctxVenda(50, semTributos, { baseMargem: "precoFinal" }));
    const b = avaliarPreco(100, ctxVenda(50, semTributos, { baseMargem: "precoBase" }));
    expect(a.margemEfetiva).toBe(b.margemEfetiva);
  });

  it("o solver respeita a base escolhida", () => {
    const t = [tv({ id: "cbsVenda", rate: 10, treatment: "porFora" })];
    const ev = resolverPrecoPorMargem(30, ctxVenda(50, t, { baseMargem: "precoBase" }))!;
    expect(round2(ev.precoBase)).toBe(71.43); // 50 / 0,7
    expect(ev.margemEfetiva).toBeCloseTo(30, 3);
  });
});

/* ================================================================== */
/* 14. IBS e CBS convivendo com ICMS, PIS e Cofins                     */
/* ================================================================== */
describe("14. convivência IBS/CBS com ICMS/PIS/Cofins", () => {
  it("compra na transição: cinco tributos ativos, créditos somados corretamente", () => {
    const r = calcularCompra(
      compraSimples({ quantidade: 10, valorUnitario: 100 }),
      tributos({
        icms: { enabled: true, rate: 18, treatment: "incluido", creditMode: "integral" },
        pis: { enabled: true, rate: 1.65, treatment: "incluido", creditMode: "integral" },
        cofins: { enabled: true, rate: 7.6, treatment: "incluido", creditMode: "integral" },
        ibs: { enabled: true, rate: 0.1, treatment: "informativo", creditMode: "nao" },
        cbs: { enabled: true, rate: 0.9, treatment: "informativo", creditMode: "nao" },
      }),
    );
    expect(round2(r.desembolsoTotal)).toBe(1000);
    expect(round2(r.creditosTotais)).toBe(272.5); // 18 + 1,65 + 7,6 = 27,25%
    expect(round2(r.custoLiquidoTotal)).toBe(727.5);
    expect(round2(r.tributosInformativos)).toBe(10);
  });

  it("venda: IBS e CBS incluídos junto de PIS/Cofins zerados", () => {
    const ev = resolverPrecoPorMargem(
      20,
      ctxVenda(100, [
        tv({ id: "ibsVenda", rate: 10 }),
        tv({ id: "cbsVenda", rate: 5 }),
        tv({ id: "pisVenda", rate: 0 }),
        tv({ id: "cofinsVenda", rate: 0 }),
      ]),
    )!;
    expect(round2(ev.precoFinal)).toBe(153.85); // 100 / (1 - 0,15 - 0,20)
  });

  it("venda mista: ICMS incluído + CBS por fora + IBS informativo", () => {
    const ev = avaliarPreco(
      100,
      ctxVenda(40, [
        tv({ id: "icmsVenda", rate: 18 }),
        tv({ id: "cbsVenda", rate: 8.8, treatment: "porFora" }),
        tv({ id: "ibsVenda", rate: 0.1, treatment: "informativo" }),
      ]),
    );
    expect(round2(ev.precoFinal)).toBe(108.8);
    expect(round2(ev.tributosIncluidos)).toBe(18);
    expect(round2(ev.resultadoUnidade)).toBe(42); // 100 - 40 - 18
    expect(round2(ev.tributosInformativos)).toBe(0.1);
  });
});

/* ================================================================== */
/* Coerência ponta a ponta                                             */
/* ================================================================== */
describe("coerência da simulação completa", () => {
  it("o resultado recomposto fecha com o preço final", () => {
    const state = estadoInicial();
    state.produto = compraSimples({
      nome: "Café torrado e moído 500g",
      quantidade: 120,
      valorUnitario: 18.9,
      descontoTotal: 90,
      freteTotal: 180,
    });
    const res = simular(state);
    const ev = res.recomendado!;
    const soma =
      ev.custoLiquidoUnitario +
      ev.tributosIncluidos +
      ev.tributosPorFora +
      ev.despesasVariaveis +
      ev.despesasFixasUnidade +
      ev.resultadoUnidade;
    expect(round2(soma)).toBe(round2(ev.precoFinal));
  });

  it("markup é calculado sobre o custo líquido unitário", () => {
    const ev = avaliarPreco(200, ctxVenda(100, semTributos));
    expect(round2(ev.markupMultiplicador)).toBe(2);
    expect(round2(ev.markupPercentual)).toBe(100);
  });

  it("quantidade zero bloqueia o preço recomendado", () => {
    const state = estadoInicial();
    state.produto = compraSimples({ nome: "X", quantidade: 0, valorUnitario: 10 });
    const res = simular(state);
    expect(res.issues.some((i) => i.campo === "quantidade")).toBe(true);
    expect(res.recomendado).toBeNull();
  });
});

/* ================================================================== */
/* 15. Reforma Tributária — vigência 2027                              */
/* ================================================================== */
import { aplicarMarcoTemporal, aplicarRegime, operacaoPadrao } from "./pricing-defaults";
import { tributosCompraEfetivos, tributosVendaEfetivos } from "./pricing-engine";
import type { Regime } from "@/types/pricing";

function estado2027(regime: Regime, extra: Partial<SimulationState["operacao"]> = {}) {
  let s = estadoInicial();
  s.produto = { ...s.produto, quantidade: 1, valorUnitario: 100 };
  s.operacao = operacaoPadrao({ regime, difalAtivo: false, aliquotaSimples: 6, ...extra });
  s = aplicarRegime(s, regime);
  return aplicarMarcoTemporal(s, "vigencia2027");
}
const achar = <T extends { id: string }>(l: T[], id: string) => l.find((t) => t.id === id)!;

describe("15. reforma tributária — vigência 2027", () => {
  it("extingue PIS/Cofins e ativa CBS 8,8% e IBS 0,1% por fora", () => {
    const s = estado2027("real");
    expect(achar(s.tributosCompra, "pis").enabled).toBe(false);
    expect(achar(s.tributosCompra, "cofins").enabled).toBe(false);
    expect(achar(s.tributosVenda, "pisVenda").enabled).toBe(false);
    expect(achar(s.tributosCompra, "cbs")).toMatchObject({
      enabled: true,
      rate: 8.8,
      treatment: "porFora",
    });
    expect(achar(s.tributosCompra, "ibs")).toMatchObject({
      enabled: true,
      rate: 0.1,
      treatment: "porFora",
    });
    expect(achar(s.tributosVenda, "cbsVenda")).toMatchObject({
      enabled: true,
      rate: 8.8,
      treatment: "porFora",
    });
    expect(achar(s.tributosCompra, "icms").enabled).toBe(true);
  });

  it("Lucro Real: compra paga 8,9 por fora e credita tudo", () => {
    const r = simular(estado2027("real"));
    expect(round2(r.compra.desembolsoTotal)).toBe(108.9);
    expect(round2(r.compra.creditosTotais)).toBe(8.9);
    expect(round2(r.compra.custoLiquidoTotal)).toBe(100);
  });

  it("Lucro Presumido: CBS e IBS também geram crédito", () => {
    const r = simular(estado2027("presumido"));
    expect(round2(r.compra.creditosTotais)).toBe(8.9);
    expect(round2(r.compra.custoLiquidoTotal)).toBe(100);
  });

  it("venda no Real destaca IBS/CBS por fora sobre o preço base", () => {
    const r = simular(estado2027("real"));
    const v = r.recomendado!;
    expect(v.tributosPorFora).toBeCloseTo(v.precoBase * 0.089, 6);
    expect(v.precoFinal).toBeCloseTo(v.precoBase * 1.089, 6);
  });

  it("Simples Híbrido: credita IBS/CBS e cobra por fora na venda junto do DAS", () => {
    const s = estado2027("simples", { modeloSimples: "hibrido" });
    const r = simular(s);
    expect(round2(r.compra.creditosTotais)).toBe(8.9);
    const vendas = tributosVendaEfetivos(s);
    expect(achar(vendas, "dasVenda")).toMatchObject({ enabled: true, rate: 6 });
    expect(achar(vendas, "cbsVenda")).toMatchObject({ enabled: true, treatment: "porFora" });
    expect(r.recomendado!.tributosPorFora).toBeGreaterThan(0);
  });

  it("Simples Puro: sem crédito de IBS/CBS e sem IBS/CBS por fora na venda", () => {
    const s = estado2027("simples", { modeloSimples: "puro" });
    expect(achar(tributosCompraEfetivos(s), "cbs").creditMode).toBe("nao");
    expect(achar(tributosVendaEfetivos(s), "cbsVenda").enabled).toBe(false);
    const r = simular(s);
    expect(round2(r.compra.custoLiquidoTotal)).toBe(108.9);
    expect(r.recomendado!.tributosPorFora).toBe(0);
  });

  it("fornecedor do Simples Puro não gera crédito de IBS/CBS por padrão", () => {
    const s = estado2027("real", { regimeFornecedor: "simplesPuro" });
    expect(achar(s.tributosCompra, "cbs").creditMode).toBe("nao");
  });

  it("alíquotas continuam editáveis pelo usuário", () => {
    const s = estado2027("real");
    s.tributosCompra = s.tributosCompra.map((t) => (t.id === "cbs" ? { ...t, rate: 9.3 } : t));
    expect(round2(simular(s).compra.creditosTotais)).toBe(9.4);
  });
});
