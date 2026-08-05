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
