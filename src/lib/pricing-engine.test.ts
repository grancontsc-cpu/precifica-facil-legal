import { describe, expect, it } from "vitest";
import {
  avaliarPreco,
  calcularCompra,
  resolverPrecoPorMargem,
  simular,
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

describe("motor de compra", () => {
  it("CASO 1 — ICMS 7% incluído com crédito integral", () => {
    const r = calcularCompra(
      compraSimples({ quantidade: 1, valorUnitario: 48 }),
      tributos({
        icms: { enabled: true, rate: 7, treatment: "incluido", creditMode: "integral" },
        pis: { enabled: true, rate: 0 },
        cofins: { enabled: true, rate: 0 },
        ibs: { enabled: true, rate: 0 },
        cbs: { enabled: true, rate: 0 },
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
        pis: { enabled: true, rate: 0 },
        cofins: { enabled: true, rate: 0 },
      }),
    );
    expect(round2(r.desembolsoTotal)).toBe(62);
    expect(round2(r.tributos.find((t) => t.id === "icms")!.credito)).toBe(12.71);
    expect(round2(r.custoLiquidoTotal)).toBe(49.29);
  });

  it("CASO 3 — desconto e frete sem tributos", () => {
    const r = calcularCompra(
      compraSimples({ quantidade: 10, valorUnitario: 100, descontoTotal: 20, freteTotal: 50 }),
      tributos({}),
    );
    expect(round2(r.valorBrutoProdutos)).toBe(1000);
    expect(round2(r.custoLiquidoTotal)).toBe(1030);
    expect(round2(r.custoLiquidoUnitario)).toBe(103);
  });

  it("não soma duas vezes tributo incluído nem altera custo de tributo informativo", () => {
    const r = calcularCompra(
      compraSimples({ quantidade: 1, valorUnitario: 100 }),
      tributos({
        icms: { enabled: true, rate: 18, treatment: "incluido", creditMode: "nao" },
        ibs: { enabled: true, rate: 0.1, treatment: "informativo", creditMode: "nao" },
      }),
    );
    expect(round2(r.desembolsoTotal)).toBe(100);
    expect(round2(r.creditosTotais)).toBe(0);
  });

  it("permite alíquota zero com crédito informado manualmente", () => {
    const r = calcularCompra(
      compraSimples({ quantidade: 1, valorUnitario: 100 }),
      tributos({ icms: { enabled: true, rate: 0, creditMode: "manual", creditManual: 5 } }),
    );
    expect(round2(r.creditosTotais)).toBe(5);
    expect(round2(r.custoLiquidoTotal)).toBe(95);
  });

  it("aplica crédito parcial", () => {
    const r = calcularCompra(
      compraSimples({ quantidade: 1, valorUnitario: 100 }),
      tributos({
        icms: { enabled: true, rate: 20, creditMode: "parcial", creditPercent: 50 },
      }),
    );
    expect(round2(r.creditosTotais)).toBe(10);
  });
});

function ctxVenda(custo: number, tributosVenda: SaleTax[], vendaPatch = {}) {
  const base = estadoInicial();
  return {
    custoLiquidoUnitario: custo,
    venda: { ...base.venda, ...vendaPatch },
    tributos: tributosVenda,
  };
}

const semTributos: SaleTax[] = [];

describe("motor de venda", () => {
  it("CASO 4 — 20% de tributos/despesas e margem de 30%", () => {
    const t: SaleTax[] = [
      {
        id: "icmsVenda",
        label: "ICMS",
        descricao: "",
        enabled: true,
        rate: 20,
        baseMode: "padrao",
        baseManual: 0,
        treatment: "incluido",
      },
    ];
    const ctx = ctxVenda(100, t);
    const recomendado = resolverPrecoPorMargem(30, ctx)!;
    const minimo = resolverPrecoPorMargem(0, ctx)!;
    expect(round2(recomendado.precoFinal)).toBe(200);
    expect(round2(minimo.precoFinal)).toBe(125);
  });

  it("CASO 5 — CBS de 10% acrescentada por fora", () => {
    const t: SaleTax[] = [
      {
        id: "cbsVenda",
        label: "CBS",
        descricao: "",
        enabled: true,
        rate: 10,
        baseMode: "padrao",
        baseManual: 0,
        treatment: "porFora",
      },
    ];
    const ev = avaliarPreco(100, ctxVenda(50, t));
    expect(round2(ev.tributosPorFora)).toBe(10);
    expect(round2(ev.precoFinal)).toBe(110);
  });

  it("CASO 6 — 60% de tributos/despesas com margem de 40% é impossível", () => {
    const t: SaleTax[] = [
      {
        id: "icmsVenda",
        label: "ICMS",
        descricao: "",
        enabled: true,
        rate: 60,
        baseMode: "padrao",
        baseManual: 0,
        treatment: "incluido",
      },
    ];
    expect(resolverPrecoPorMargem(40, ctxVenda(100, t))).toBeNull();

    const state = estadoInicial();
    state.produto = compraSimples({ nome: "Teste", quantidade: 1, valorUnitario: 100 });
    state.tributosCompra = tributos({});
    state.tributosVenda = t;
    state.venda = { ...state.venda, margemDesejada: 40 };
    const res = simular(state);
    expect(res.impossivel).toBe(true);
    expect(res.mensagemImpossivel).toContain("Não é possível formar o preço");
  });

  it("markup é calculado sobre o custo líquido unitário", () => {
    const ev = avaliarPreco(200, ctxVenda(100, semTributos));
    expect(round2(ev.markupMultiplicador)).toBe(2);
    expect(round2(ev.markupPercentual)).toBe(100);
  });

  it("funciona com PIS e Cofins zerados e IBS/CBS ativos", () => {
    const t: SaleTax[] = [
      {
        id: "ibsVenda",
        label: "IBS",
        descricao: "",
        enabled: true,
        rate: 10,
        baseMode: "padrao",
        baseManual: 0,
        treatment: "incluido",
      },
      {
        id: "cbsVenda",
        label: "CBS",
        descricao: "",
        enabled: true,
        rate: 5,
        baseMode: "padrao",
        baseManual: 0,
        treatment: "incluido",
      },
    ];
    const ev = resolverPrecoPorMargem(20, ctxVenda(100, t))!;
    // preço = 100 / (1 - 0,15 - 0,20)
    expect(round2(ev.precoFinal)).toBe(153.85);
  });
});

describe("validações", () => {
  it("bloqueia quantidade zero", () => {
    const state = estadoInicial();
    state.produto = compraSimples({ nome: "X", quantidade: 0, valorUnitario: 10 });
    const res = simular(state);
    expect(res.issues.some((i) => i.campo === "quantidade")).toBe(true);
    expect(res.recomendado).toBeNull();
  });

  it("bloqueia margem igual ou superior a 100%", () => {
    const state = estadoInicial();
    state.produto = compraSimples({ nome: "X", quantidade: 1, valorUnitario: 10 });
    state.venda = { ...state.venda, margemDesejada: 100 };
    const res = simular(state);
    expect(res.issues.some((i) => i.campo === "margemDesejada")).toBe(true);
  });
});
