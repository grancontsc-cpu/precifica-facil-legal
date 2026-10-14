import { describe, expect, it } from "vitest";
import { aplicarRegime, estadoInicial, operacaoPadrao } from "@/lib/pricing-defaults";
import { estadoDaEtapa, etapasReformaPadrao, projetarReforma } from "@/lib/projecao-reforma";
import type { Regime, SimulationState } from "@/types/pricing";

function base(regime: Regime, extra: Partial<SimulationState["operacao"]> = {}) {
  let s = estadoInicial();
  s.produto = { ...s.produto, nome: "Produto", quantidade: 1, valorUnitario: 100 };
  s.operacao = operacaoPadrao({ regime, difalAtivo: false, aliquotaSimples: 6, ...extra });
  s = aplicarRegime(s, regime);
  s.tributosCompra = s.tributosCompra.map((t) =>
    t.id === "icms"
      ? { ...t, enabled: true, rate: 18 }
      : t.id === "pis"
        ? { ...t, enabled: true, rate: 1.65 }
        : t.id === "cofins"
          ? { ...t, enabled: true, rate: 7.6 }
          : t,
  );
  s.tributosVenda = s.tributosVenda.map((t) =>
    t.id === "icmsVenda"
      ? { ...t, enabled: true, rate: 18 }
      : t.id === "pisVenda"
        ? { ...t, enabled: true, rate: 1.65 }
        : t.id === "cofinsVenda"
          ? { ...t, enabled: true, rate: 7.6 }
          : t,
  );
  s.venda = { ...s.venda, margemDesejada: 20 };
  return s;
}

const linha = (p: ReturnType<typeof projetarReforma>, ano: string) =>
  p!.linhas.find((l) => l.ano === ano)!;

describe("projeção da reforma ano a ano", () => {
  it("tem as etapas de 2026 a 2033 com ICMS caindo 10% ao ano a partir de 2029", () => {
    const e = etapasReformaPadrao();
    expect(e.map((x) => x.ano)).toEqual([
      "2026",
      "2027",
      "2028",
      "2029",
      "2030",
      "2031",
      "2032",
      "2033",
    ]);
    expect(e.find((x) => x.ano === "2029")).toMatchObject({ fatorIcms: 90, ibs: 1.77 });
    expect(e.find((x) => x.ano === "2032")).toMatchObject({ fatorIcms: 60, ibs: 7.08 });
    expect(e.find((x) => x.ano === "2033")).toMatchObject({ fatorIcms: 0, ibs: 17.7, cbs: 8.8 });
  });

  it("aplica a fração do ICMS e do IBS na etapa de 2030", () => {
    const s = estadoDaEtapa(base("real"), etapasReformaPadrao()[4]);
    expect(s.tributosCompra.find((t) => t.id === "icms")!.rate).toBe(14.4);
    expect(s.tributosVenda.find((t) => t.id === "icmsVenda")!.rate).toBe(14.4);
    expect(s.tributosVenda.find((t) => t.id === "ibsVenda")!.rate).toBe(3.54);
  });

  it("preço para manter o lucro em R$ devolve o lucro de hoje", () => {
    const p = projetarReforma(base("real"))!;
    for (const l of p.linhas) {
      expect(l.mantendoLucro.preco!.resultadoUnidade).toBeCloseTo(p.hoje.resultadoUnidade, 2);
    }
  });

  it("preço para manter a margem % devolve a margem de hoje", () => {
    const p = projetarReforma(base("presumido"))!;
    for (const l of p.linhas) {
      expect(l.mantendoMargem.preco!.margemEfetiva).toBeCloseTo(p.hoje.margemEfetiva, 2);
    }
  });

  it("mantendo o preço em 2027 no Lucro Real, IBS/CBS por fora reduzem o lucro", () => {
    const p = projetarReforma(base("real"))!;
    const l = linha(p, "2027");
    expect(l.mantendoPreco.precoFinal).toBeCloseTo(p.hoje.precoFinal, 2);
    expect(l.perdaLucro).toBeLessThan(0);
    expect(l.mantendoLucro.aumentoPercent!).toBeGreaterThan(0);
  });

  it("Simples Puro não sente IBS/CBS na venda; Híbrido sim", () => {
    const puro = projetarReforma(base("simples", { modeloSimples: "puro" }))!;
    const hib = projetarReforma(base("simples", { modeloSimples: "hibrido" }))!;
    expect(linha(puro, "2027").mantendoPreco.tributosPorFora).toBe(0);
    expect(linha(hib, "2027").mantendoPreco.tributosPorFora).toBeGreaterThan(0);
  });

  it("alíquota editada pelo usuário muda a projeção", () => {
    const s = base("real");
    const padrao = linha(projetarReforma(s), "2027").mantendoLucro.preco!.precoFinal;
    s.etapasReforma = etapasReformaPadrao().map((e) => (e.ano === "2027" ? { ...e, cbs: 12 } : e));
    const editado = linha(projetarReforma(s), "2027").mantendoLucro.preco!.precoFinal;
    expect(editado).toBeGreaterThan(padrao);
  });
});
