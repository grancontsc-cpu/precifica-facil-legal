import { describe, expect, it } from "vitest";
import {
  apuraPeloSimples,
  calcularFronteira,
  creditaFronteiraPorRegime,
  simular,
  tributoFronteira,
  tributosCompraEfetivos,
  tributosVendaEfetivos,
} from "@/lib/pricing-engine";
import { aplicarRegime, estadoInicial, operacaoPadrao } from "@/lib/pricing-defaults";
import type { OperacaoFiscal, Regime, SimulationState } from "@/types/pricing";

function op(patch: Partial<OperacaoFiscal> = {}): OperacaoFiscal {
  return operacaoPadrao({
    ufOrigem: "RJ",
    ufDestino: "BA",
    aliquotaInternaDestino: 20.5,
    aliquotaInterestadual: 7,
    ...patch,
  });
}

function base(regime: Regime, patch: Partial<OperacaoFiscal> = {}): SimulationState {
  const s = aplicarRegime(estadoInicial(), regime);
  return {
    ...s,
    produto: { ...s.produto, nome: "Produto", quantidade: 10, valorUnitario: 100 },
    operacao: { ...op(patch), regime },
  };
}

describe("ICMS de fronteira (DIFAL/antecipação)", () => {
  it("calcula a diferença entre a alíquota interna e a interestadual", () => {
    const r = calcularFronteira(op());
    expect(r.aplicavel).toBe(true);
    expect(r.rate).toBeCloseTo(13.5, 6);
  });

  it("não aplica fronteira em operação dentro do mesmo estado", () => {
    const r = calcularFronteira(op({ ufOrigem: "BA", ufDestino: "BA" }));
    expect(r.aplicavel).toBe(false);
    expect(r.rate).toBe(0);
  });

  it("nunca gera diferencial negativo", () => {
    const r = calcularFronteira(op({ aliquotaInternaDestino: 4, aliquotaInterestadual: 12 }));
    expect(r.rate).toBe(0);
    expect(r.aplicavel).toBe(false);
  });

  it("sinaliza alíquota não cadastrada para o par de estados", () => {
    const r = calcularFronteira(op({ aliquotaInternaDestino: null }));
    expect(r.faltaAliquota).toBe(true);
    expect(r.aplicavel).toBe(false);
  });

  it("desligado pelo usuário não produz tributo", () => {
    expect(tributoFronteira(op({ difalAtivo: false }))).toBeNull();
  });

  it("respeita o valor manual mesmo sem alíquota cadastrada", () => {
    const t = tributoFronteira(op({ aliquotaInternaDestino: null, difalManual: 90 }));
    expect(t?.useManualTax).toBe(true);
    expect(t?.manualTaxValue).toBe(90);
  });
});

describe("Crédito do ICMS de fronteira por regime", () => {
  it("Lucro Real e Lucro Presumido creditam", () => {
    expect(creditaFronteiraPorRegime("real")).toBe(true);
    expect(creditaFronteiraPorRegime("presumido")).toBe(true);
  });

  it("Simples e MEI não creditam: é custo puro", () => {
    expect(creditaFronteiraPorRegime("simples")).toBe(false);
    expect(creditaFronteiraPorRegime("mei")).toBe(false);
  });

  it("no Lucro Real a fronteira entra como crédito recuperável", () => {
    const r = simular(base("real"));
    const linha = r.compra.tributos.find((t) => t.id === "icmsFronteira");
    expect(linha).toBeDefined();
    expect(linha!.credito).toBeGreaterThan(0);
    expect(linha!.credito).toBeCloseTo(linha!.valor, 2);
  });

  it("no Simples a fronteira aumenta o custo líquido e não gera crédito", () => {
    const real = simular(base("real"));
    const simples = simular(base("simples"));
    const linha = simples.compra.tributos.find((t) => t.id === "icmsFronteira");
    expect(linha!.credito).toBe(0);
    expect(simples.compra.custoLiquidoTotal).toBeGreaterThan(real.compra.custoLiquidoTotal);
  });

  it("a sobreposição manual de crédito vence a regra do regime", () => {
    const t = tributoFronteira(op({ regime: "simples", creditarDifal: true }));
    expect(t?.creditMode).toBe("integral");
  });

  it("a fronteira é somada por fora do valor da compra", () => {
    const r = simular(base("real"));
    const linha = r.compra.tributos.find((t) => t.id === "icmsFronteira");
    expect(linha!.treatment).toBe("porFora");
    expect(r.compra.desembolsoTotal).toBeGreaterThan(1000);
  });

  it("sem contexto fiscal o resultado não muda", () => {
    const semOp: SimulationState = { ...base("real"), operacao: undefined };
    expect(tributosCompraEfetivos(semOp).some((t) => t.id === "icmsFronteira")).toBe(false);
  });
});

describe("Simples Nacional e MEI na venda", () => {
  it("regimes do DAS são identificados", () => {
    expect(apuraPeloSimples("simples")).toBe(true);
    expect(apuraPeloSimples("mei")).toBe(true);
    expect(apuraPeloSimples("real")).toBe(false);
  });

  it("no Simples só o DAS é cobrado na venda", () => {
    const s = base("simples", { aliquotaSimples: 8 });
    const tributos = tributosVendaEfetivos(s).filter((t) => t.enabled);
    expect(tributos.map((t) => t.id)).toContain("dasVenda");
    expect(tributos.some((t) => ["icmsVenda", "pisVenda", "cofinsVenda"].includes(t.id))).toBe(
      false,
    );
    expect(tributos.find((t) => t.id === "dasVenda")!.rate).toBe(8);
  });

  it("no Lucro Real o DAS fica desligado", () => {
    const tributos = tributosVendaEfetivos(base("real"));
    expect(tributos.find((t) => t.id === "dasVenda")!.enabled).toBe(false);
  });

  it("o DAS é incluído no preço e reduz a margem quando aumenta", () => {
    const a = simular(base("simples", { aliquotaSimples: 4 }));
    const b = simular(base("simples", { aliquotaSimples: 12 }));
    expect(b.recomendado!.precoFinal).toBeGreaterThan(a.recomendado!.precoFinal);
  });

  it("aplicarRegime remove o crédito de ICMS, PIS e Cofins no Simples", () => {
    const s = aplicarRegime(estadoInicial(), "simples");
    for (const id of ["icms", "pis", "cofins"]) {
      expect(s.tributosCompra.find((t) => t.id === id)!.creditMode).toBe("nao");
    }
  });

  it("no Lucro Presumido PIS e Cofins não geram crédito, mas o ICMS sim", () => {
    const s = aplicarRegime(estadoInicial(), "presumido");
    expect(s.tributosCompra.find((t) => t.id === "icms")!.creditMode).toBe("integral");
    expect(s.tributosCompra.find((t) => t.id === "pis")!.creditMode).toBe("nao");
    expect(s.tributosCompra.find((t) => t.id === "cofins")!.creditMode).toBe("nao");
  });
});

describe("Validações do contexto fiscal", () => {
  it("com os dois estados em branco apenas avisa, sem travar o cálculo", () => {
    const s = base("real", { ufOrigem: "", ufDestino: "" });
    const issue = simular(s).issues.find((i) => i.campo === "ufOrigem");
    expect(issue?.severidade).toBe("aviso");
  });

  it("trajeto pela metade é erro", () => {
    expect(simular(base("real", { ufOrigem: "" })).issues.some((i) => i.campo === "ufOrigem" && i.severidade === "erro")).toBe(true);
    expect(simular(base("real", { ufDestino: "" })).issues.some((i) => i.campo === "ufDestino" && i.severidade === "erro")).toBe(true);
  });

  it("avisa quando falta alíquota cadastrada para o trajeto", () => {
    const s = base("real", { aliquotaInterestadual: null });
    const issue = simular(s).issues.find((i) => i.campo === "aliquotasIcms");
    expect(issue?.severidade).toBe("erro");
  });

  it("avisa quando a alíquota do DAS está zerada", () => {
    const s = base("simples", { aliquotaSimples: 0 });
    const issue = simular(s).issues.find((i) => i.campo === "aliquotaSimples");
    expect(issue?.severidade).toBe("aviso");
  });
});
