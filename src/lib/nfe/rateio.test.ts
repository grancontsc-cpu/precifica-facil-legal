import { describe, expect, it } from "vitest";

import { distribuirProporcional, ratearParaItem } from "./rateio";

describe("distribuirProporcional", () => {
  it("distribui proporcionalmente ao peso de cada item", () => {
    // 3 itens de R$100, R$200 e R$700 (nota de R$1000), frete de R$100.
    const partes = distribuirProporcional([100, 200, 700], 100);
    expect(partes).toEqual([10, 20, 70]);
    expect(partes.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("a soma das partes sempre bate com o total, mesmo com resto de centavos", () => {
    // 3 itens de peso igual dividindo R$100: 33,33 + 33,33 + 33,33 = 99,99 sem ajuste.
    const partes = distribuirProporcional([1, 1, 1], 100);
    const soma = partes.reduce((a, b) => a + b, 0);
    expect(soma).toBe(100);
    // O resto (0,01) vai para o primeiro peso encontrado com o maior valor.
    expect(partes.filter((p) => p === 33.34)).toHaveLength(1);
  });

  it("divide igualmente quando nenhum peso é válido", () => {
    expect(distribuirProporcional([0, 0], 10)).toEqual([5, 5]);
  });

  it("devolve tudo zero quando o total é zero", () => {
    expect(distribuirProporcional([10, 20], 0)).toEqual([0, 0]);
  });

  it("devolve array vazio para lista de pesos vazia", () => {
    expect(distribuirProporcional([], 100)).toEqual([]);
  });

  it("ignora pesos negativos ou não finitos, tratando-os como zero", () => {
    const partes = distribuirProporcional([100, -50, NaN], 100);
    expect(partes[0]).toBe(100);
    expect(partes[1]).toBe(0);
    expect(partes[2]).toBe(0);
  });
});

describe("ratearParaItem", () => {
  it("calcula a parte do item proporcional ao valor dele na nota", () => {
    // Item de R$100 numa nota de R$1000 (10%): recebe 10% do frete de R$1000.
    expect(ratearParaItem(100, 1000, 1000)).toBe(100);
  });

  it("bate com o exemplo do usuário: 10 itens iguais, frete de R$1000", () => {
    // Item de R$100 (1 dos 10 itens de R$100 cada, nota de R$1000).
    expect(ratearParaItem(100, 1000, 1000)).toBe(100);
    // Item maior (R$300) na mesma nota recebe proporcionalmente mais.
    expect(ratearParaItem(300, 1000, 1000)).toBe(300);
  });

  it("devolve zero quando o valor do item é zero ou inválido", () => {
    expect(ratearParaItem(0, 1000, 500)).toBe(0);
    expect(ratearParaItem(NaN, 1000, 500)).toBe(0);
  });

  it("devolve zero quando o valor total da nota é zero ou inválido", () => {
    expect(ratearParaItem(100, 0, 500)).toBe(0);
  });

  it("nunca ultrapassa o total a distribuir mesmo com valor do item maior que a nota", () => {
    // Entrada inconsistente (item maior que a nota informada): não deve gerar valor negativo pro resto.
    const parte = ratearParaItem(1500, 1000, 500);
    expect(parte).toBe(500);
  });
});
