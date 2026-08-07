import Decimal from "decimal.js";

/**
 * Rateio proporcional de um valor total entre pesos (normalmente o valor de
 * cada item da nota). A diferença de centavos do arredondamento vai para o
 * maior peso, de modo que a soma das partes é sempre igual ao total.
 */
export function distribuirProporcional(pesos: number[], total: number, casas = 2): number[] {
  const n = pesos.length;
  if (n === 0) return [];
  const alvo = new Decimal(Number.isFinite(total) ? total : 0);
  if (alvo.isZero()) return pesos.map(() => 0);

  const seguros = pesos.map((p) => new Decimal(Number.isFinite(p) && p > 0 ? p : 0));
  const soma = seguros.reduce((acc, p) => acc.plus(p), new Decimal(0));

  // Sem pesos válidos: divide igualmente.
  const fracoes = soma.isZero()
    ? seguros.map(() => alvo.div(n))
    : seguros.map((p) => alvo.times(p).div(soma));

  const partes = fracoes.map((f) => f.toDecimalPlaces(casas, Decimal.ROUND_HALF_UP));
  const somaPartes = partes.reduce((acc, p) => acc.plus(p), new Decimal(0));
  const resto = alvo.minus(somaPartes);

  if (!resto.isZero()) {
    let maior = 0;
    for (let i = 1; i < n; i++) if (seguros[i].gt(seguros[maior])) maior = i;
    partes[maior] = partes[maior].plus(resto);
  }

  return partes.map((p) => p.toNumber());
}

/**
 * Parte de um total da nota (frete, seguro, outras despesas, desconto) que
 * cabe a um único item, proporcional ao valor desse item dentro do valor
 * total da nota. Usa o mesmo rateio proporcional de `distribuirProporcional`
 * — o "resto dos itens" entra como segundo peso só para manter a proporção;
 * apenas a primeira parte (a do item) é devolvida.
 */
export function ratearParaItem(valorItem: number, valorTotalNota: number, total: number): number {
  const item = Number.isFinite(valorItem) && valorItem > 0 ? valorItem : 0;
  const nota = Number.isFinite(valorTotalNota) && valorTotalNota > 0 ? valorTotalNota : 0;
  // Sem um valor de nota válido não há proporção confiável: não atribuir o
  // total inteiro a um único item por falta de referência.
  if (item === 0 || nota === 0) return 0;
  const restante = Math.max(0, nota - item);
  const [parte] = distribuirProporcional([item, restante], total);
  return parte ?? 0;
}
