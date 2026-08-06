import { describe, expect, it } from "vitest";

import { chaveItem, compararItem, criarVersao, diferencasPremissas } from "./versoes";
import { premissasPadrao } from "./para-simulacao";
import type { NotaPrecificada } from "./para-simulacao";
import type { VersaoLote } from "./versoes";

function notaFake(preco: number | null, margem: number | null): NotaPrecificada {
  return {
    nota: { id: "n1", itens: [] } as unknown as NotaPrecificada["nota"],
    itens: [
      {
        item: { numero: 1, descricao: "Produto A", quantidade: 2 },
        estado: {},
        resultado: {
          compra: {
            desembolsoTotal: 200,
            creditosTotais: 20,
            custoLiquidoTotal: 180,
            custoLiquidoUnitario: 90,
          },
          recomendado: preco === null ? null : { precoFinal: preco, margemEfetiva: margem ?? 0 },
        },
      } as unknown as NotaPrecificada["itens"][number],
    ],
    totais: {
      desembolso: 200,
      creditos: 20,
      custoLiquido: 180,
      receitaSugerida: (preco ?? 0) * 2,
      resultadoSugerido: 40,
    },
  };
}

const base = {
  id: "v1",
  rotulo: "Versão 1",
  criadaEm: "2026-01-01T00:00:00.000Z",
  regime: "real" as const,
  fronteiraAtiva: false,
  premissas: premissasPadrao(),
};

describe("versões do lote importado", () => {
  it("congela preços e totais da versão", () => {
    const v = criarVersao([notaFake(150, 30)], base);
    expect(v.itens).toHaveLength(1);
    expect(v.itens[0].chave).toBe(chaveItem("n1", 1));
    expect(v.itens[0].precoFinal).toBe(150);
    expect(v.totais.receitaSugerida).toBe(300);
  });

  it("compara preço anterior com o recalculado", () => {
    const v = criarVersao([notaFake(150, 30)], base);
    const c = compararItem(v, chaveItem("n1", 1), 165, 35);
    expect(c.precoAnterior).toBe(150);
    expect(c.variacaoAbsoluta).toBe(15);
    expect(c.variacaoPercentual).toBeCloseTo(10, 8);
    expect(c.variacaoMargem).toBe(5);
  });

  it("não inventa variação quando falta preço", () => {
    const v = criarVersao([notaFake(null, null)], base);
    const c = compararItem(v, chaveItem("n1", 1), 100, 20);
    expect(c.precoAnterior).toBeNull();
    expect(c.variacaoAbsoluta).toBeNull();
    expect(c.variacaoPercentual).toBeNull();
  });

  it("item ausente na versão anterior fica sem comparação", () => {
    const v = criarVersao([notaFake(150, 30)], base);
    const c = compararItem(v, chaveItem("n2", 7), 100, 20);
    expect(c.anterior).toBeNull();
    expect(c.variacaoAbsoluta).toBeNull();
  });

  it("lista as premissas alteradas", () => {
    const v: VersaoLote = criarVersao([notaFake(150, 30)], base);
    const dif = diferencasPremissas(
      v,
      premissasPadrao({ margemDesejada: 40, cartaoPercent: 2 }),
      "presumido",
      true,
    );
    const campos = dif.map((d) => d.campo);
    expect(campos).toContain("Regime");
    expect(campos).toContain("margemDesejada");
    expect(campos).toContain("cartaoPercent");
    expect(campos).toContain("ICMS de fronteira");
  });

  it("sem mudanças, não há diferenças", () => {
    const v = criarVersao([notaFake(150, 30)], base);
    expect(diferencasPremissas(v, premissasPadrao(), "real", false)).toHaveLength(0);
  });
});
