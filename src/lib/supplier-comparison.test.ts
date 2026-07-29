import { describe, expect, it } from "vitest";

import { compararFornecedores, limiteFreteEquivalencia } from "@/lib/supplier-comparison";
import { alternativaVazia, exemploComparacao } from "@/lib/comparison-defaults";
import { tributosCompraPadrao } from "@/lib/pricing-defaults";
import type { PurchaseTax, PurchaseTaxId } from "@/types/pricing";
import type { SupplierAlternative } from "@/types/comparison";

function comTributos(
  patches: Partial<Record<PurchaseTaxId, Partial<PurchaseTax>>>,
): PurchaseTax[] {
  return tributosCompraPadrao().map((t) => (patches[t.id] ? { ...t, ...patches[t.id] } : t));
}

const rj = (over: Partial<SupplierAlternative> = {}) =>
  alternativaVazia({
    nome: "RJ",
    uf: "RJ",
    valorUnitario: 48,
    quantidade: 1,
    tributos: comTributos({
      icms: { enabled: true, rate: 7, treatment: "incluido", creditMode: "integral" },
      pis: { enabled: true, rate: 0, treatment: "incluido", creditMode: "integral" },
      cofins: { enabled: true, rate: 0, treatment: "incluido", creditMode: "integral" },
    }),
    ...over,
  });

const ba = (over: Partial<SupplierAlternative> = {}) =>
  alternativaVazia({
    nome: "BA",
    uf: "BA",
    valorUnitario: 62,
    quantidade: 1,
    tributos: comTributos({
      icms: { enabled: true, rate: 20.5, treatment: "incluido", creditMode: "integral" },
      pis: { enabled: true, rate: 0, treatment: "incluido", creditMode: "integral" },
      cofins: { enabled: true, rate: 0, treatment: "incluido", creditMode: "integral" },
    }),
    ...over,
  });

describe("comparação de fornecedores — exemplo RJ x BA", () => {
  it("reproduz os custos líquidos esperados sem frete", () => {
    const { linhas, vencedorId } = compararFornecedores([rj(), ba()]);
    const a = linhas.find((l) => l.nome === "RJ")!;
    const b = linhas.find((l) => l.nome === "BA")!;

    expect(a.custoLiquidoUnitario).toBeCloseTo(44.64, 2);
    expect(b.custoLiquidoUnitario).toBeCloseTo(49.29, 2);
    expect(b.custoLiquidoUnitario - a.custoLiquidoUnitario).toBeCloseTo(4.65, 2);
    expect(vencedorId).toBe(a.id);
    expect(a.destaques).toContain("melhorOpcao");
  });

  it("o exemplo padrão do módulo bate com o mesmo resultado", () => {
    const { linhas } = compararFornecedores(exemploComparacao());
    expect(linhas[0].custoLiquidoUnitario).toBeCloseTo(44.64, 2);
    expect(linhas[1].custoLiquidoUnitario).toBeCloseTo(49.29, 2);
  });

  it("indica o frete adicional que ainda mantém o RJ vantajoso", () => {
    const { linhas } = compararFornecedores([rj(), ba()]);
    const a = linhas.find((l) => l.nome === "RJ")!;
    expect(a.limiteFreteAdicional).toBeCloseTo(4.65, 2);
  });

  it("no ponto de equilíbrio de frete os custos ficam iguais", () => {
    const limite = limiteFreteEquivalencia(rj(), (() => {
      const { linhas } = compararFornecedores([rj(), ba()]);
      return { toNumber: () => 0, ...({} as never) } as never;
    })() as never);
    // caminho direto: usa o comparador com o frete no ponto de equilíbrio
    void limite;
    const { linhas } = compararFornecedores([rj({ freteTotal: 4.65 }), ba()]);
    const a = linhas.find((l) => l.nome === "RJ")!;
    const b = linhas.find((l) => l.nome === "BA")!;
    expect(a.custoLiquidoUnitario).toBeCloseTo(b.custoLiquidoUnitario, 2);
  });

  it("com frete alto no RJ a BA passa a ser a melhor opção", () => {
    const { linhas, vencedorId } = compararFornecedores([rj({ freteTotal: 10 }), ba()]);
    const b = linhas.find((l) => l.nome === "BA")!;
    expect(vencedorId).toBe(b.id);
    expect(b.diferencaUnitaria).toBeLessThan(0);
  });
});

describe("comparação de fornecedores — regras gerais", () => {
  it("não escolhe pelo preço nominal: menor desembolso pode perder para maior crédito", () => {
    const barato = alternativaVazia({
      nome: "Barato sem crédito",
      valorUnitario: 100,
      quantidade: 10,
      tributos: comTributos({
        icms: { enabled: true, rate: 12, treatment: "incluido", creditMode: "nao" },
      }),
    });
    const caro = alternativaVazia({
      nome: "Caro com crédito",
      valorUnitario: 105,
      quantidade: 10,
      tributos: comTributos({
        icms: { enabled: true, rate: 18, treatment: "incluido", creditMode: "integral" },
      }),
    });
    const { linhas, vencedorId } = compararFornecedores([barato, caro]);
    const l1 = linhas.find((l) => l.nome === "Barato sem crédito")!;
    const l2 = linhas.find((l) => l.nome === "Caro com crédito")!;

    expect(l1.destaques).toContain("menorDesembolso");
    expect(vencedorId).toBe(l2.id);
    expect(l2.destaques).toContain("menorCustoLiquido");
    expect(l2.destaques).toContain("maiorCredito");
  });

  it("economia no pedido multiplica a diferença unitária pela quantidade", () => {
    const { linhas } = compararFornecedores([rj({ quantidade: 100 }), ba({ quantidade: 100 })]);
    const a = linhas.find((l) => l.nome === "RJ")!;
    expect(a.economiaPedido).toBeCloseTo(465, 0);
    const b = linhas.find((l) => l.nome === "BA")!;
    expect(b.economiaPedido).toBeCloseTo(-465, 0);
  });

  it("aplica desconto, frete, seguro e outras despesas totais", () => {
    const alt = alternativaVazia({
      nome: "Completo",
      valorUnitario: 50,
      quantidade: 10,
      descontoTotal: 50,
      freteTotal: 30,
      seguroTotal: 10,
      outrasDespesas: 10,
      tributos: comTributos({
        icms: { enabled: true, rate: 10, treatment: "incluido", creditMode: "integral" },
      }),
    });
    const { linhas } = compararFornecedores([alt]);
    const l = linhas[0];
    // 500 - 50 = 450 de produtos + 50 de outros custos = 500 de desembolso
    expect(l.desembolsoTotal).toBeCloseTo(500, 2);
    expect(l.creditosTotais).toBeCloseTo(45, 2);
    expect(l.custoLiquidoTotal).toBeCloseTo(455, 2);
    expect(l.custoLiquidoUnitario).toBeCloseTo(45.5, 2);
  });

  it("ICMS-ST cobrado por fora aumenta o desembolso e não gera crédito", () => {
    const semSt = alternativaVazia({ nome: "Sem ST", valorUnitario: 100, quantidade: 1 });
    const comSt = alternativaVazia({
      nome: "Com ST",
      valorUnitario: 100,
      quantidade: 1,
      tributos: comTributos({
        icmsSt: { enabled: true, rate: 10, treatment: "porFora", creditMode: "nao" },
      }),
    });
    const { linhas, vencedorId } = compararFornecedores([semSt, comSt]);
    const st = linhas.find((l) => l.nome === "Com ST")!;
    expect(st.desembolsoTotal).toBeCloseTo(110, 2);
    expect(st.creditosTotais).toBeCloseTo(0, 2);
    expect(vencedorId).toBe(linhas.find((l) => l.nome === "Sem ST")!.id);
  });

  it("crédito parcial e crédito manual são respeitados", () => {
    const parcial = alternativaVazia({
      nome: "Parcial",
      valorUnitario: 100,
      quantidade: 1,
      tributos: comTributos({
        icms: { enabled: true, rate: 20, treatment: "incluido", creditMode: "parcial", creditPercent: 50 },
      }),
    });
    const manual = alternativaVazia({
      nome: "Manual",
      valorUnitario: 100,
      quantidade: 1,
      tributos: comTributos({
        icms: { enabled: true, rate: 20, treatment: "incluido", creditMode: "manual", creditManual: 15 },
      }),
    });
    const { linhas } = compararFornecedores([parcial, manual]);
    expect(linhas.find((l) => l.nome === "Parcial")!.creditosTotais).toBeCloseTo(10, 2);
    expect(linhas.find((l) => l.nome === "Manual")!.creditosTotais).toBeCloseTo(15, 2);
  });

  it("PIS e Cofins com alíquota zero não alteram o custo", () => {
    const { linhas } = compararFornecedores([rj()]);
    const pis = linhas[0].compra.tributos.find((t) => t.id === "pis")!;
    expect(pis.valor).toBe(0);
    expect(pis.credito).toBe(0);
    expect(linhas[0].custoLiquidoUnitario).toBeCloseTo(44.64, 2);
  });

  it("tributo informativo não muda desembolso nem crédito", () => {
    const semInfo = alternativaVazia({ nome: "A", valorUnitario: 100, quantidade: 1 });
    const comInfo = alternativaVazia({
      nome: "B",
      valorUnitario: 100,
      quantidade: 1,
      tributos: comTributos({
        ibs: { enabled: true, rate: 9, treatment: "informativo", creditMode: "nao" },
        cbs: { enabled: true, rate: 0.9, treatment: "informativo", creditMode: "nao" },
      }),
    });
    const { linhas } = compararFornecedores([semInfo, comInfo]);
    expect(linhas[0].custoLiquidoUnitario).toBeCloseTo(linhas[1].custoLiquidoUnitario, 6);
  });

  it("destaca melhor prazo sem alterar o custo", () => {
    const { linhas } = compararFornecedores([rj({ prazoDias: 15 }), ba({ prazoDias: 60 })]);
    const b = linhas.find((l) => l.nome === "BA")!;
    expect(b.destaques).toContain("melhorPrazo");
    expect(b.custoLiquidoUnitario).toBeCloseTo(49.29, 2);
  });

  it("regime tributário é apenas informativo", () => {
    const a = compararFornecedores([rj({ regime: "simples" })]).linhas[0];
    const b = compararFornecedores([rj({ regime: "real" })]).linhas[0];
    expect(a.custoLiquidoUnitario).toBe(b.custoLiquidoUnitario);
  });

  it("ignora alternativas inválidas e avisa", () => {
    const invalida = alternativaVazia({ nome: "Zerada", quantidade: 0, valorUnitario: 10 });
    const { linhas, avisos } = compararFornecedores([rj(), invalida]);
    expect(linhas).toHaveLength(1);
    expect(avisos.join(" ")).toMatch(/ignoradas/i);
  });

  it("valores NaN/Infinity não contaminam o resultado", () => {
    const ruim = alternativaVazia({
      nome: "Ruim",
      valorUnitario: 100,
      quantidade: 1,
      freteTotal: Number.NaN,
      seguroTotal: Number.POSITIVE_INFINITY as unknown as number,
    });
    const { linhas } = compararFornecedores([ruim]);
    expect(Number.isFinite(linhas[0].custoLiquidoUnitario)).toBe(true);
    expect(linhas[0].custoLiquidoUnitario).toBeCloseTo(100, 2);
  });

  it("empate técnico não gera diferença", () => {
    const { linhas } = compararFornecedores([rj({ nome: "A" }), rj({ nome: "B" })]);
    expect(linhas[0].custoLiquidoUnitario).toBeCloseTo(linhas[1].custoLiquidoUnitario, 6);
    expect(Math.abs(linhas[0].diferencaUnitaria)).toBeCloseTo(0, 6);
  });

  it("suporta até cinco alternativas e avisa acima disso", () => {
    const cinco = Array.from({ length: 5 }, (_, i) =>
      alternativaVazia({ nome: `F${i}`, valorUnitario: 100 - i, quantidade: 1 }),
    );
    expect(compararFornecedores(cinco).avisos).toHaveLength(0);
    const seis = [...cinco, alternativaVazia({ nome: "F5", valorUnitario: 90, quantidade: 1 })];
    expect(compararFornecedores(seis).avisos.join(" ")).toMatch(/máximo 5/i);
  });

  it("gera explicação detalhada para cada alternativa", () => {
    const { explicacoes } = compararFornecedores([rj(), ba()]);
    expect(explicacoes).toHaveLength(2);
    expect(explicacoes[0].linhas.join(" ")).toMatch(/Créditos recuperáveis/);
    expect(explicacoes[0].linhas.join(" ")).toMatch(/frete adicional|equilíbrio|mais barata/i);
  });

  it("diferença percentual usa o custo líquido da referência", () => {
    const { linhas } = compararFornecedores([rj(), ba()]);
    const b = linhas.find((l) => l.nome === "BA")!;
    expect(b.diferencaPercentual).toBeCloseTo(((49.29 - 44.64) / 44.64) * 100, 1);
  });
});
