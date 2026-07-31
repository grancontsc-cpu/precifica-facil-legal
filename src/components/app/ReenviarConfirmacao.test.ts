import { describe, expect, it } from "vitest";

import { ESPERAS_REENVIO, esperaReenvio, rotuloEspera } from "@/components/app/ReenviarConfirmacao";

describe("espera progressiva de reenvio de confirmação", () => {
  it("libera o primeiro reenvio após 5 segundos", () => {
    expect(esperaReenvio(0)).toBe(5);
  });

  it("exige 30 segundos após o primeiro reenvio", () => {
    expect(esperaReenvio(1)).toBe(30);
  });

  it("exige 1 minuto após o segundo reenvio", () => {
    expect(esperaReenvio(2)).toBe(60);
  });

  it("mantém teto de 5 minutos a partir do terceiro reenvio", () => {
    expect(esperaReenvio(3)).toBe(300);
    expect(esperaReenvio(10)).toBe(300);
  });

  it("é sempre crescente", () => {
    const lista = [...ESPERAS_REENVIO];
    expect(lista).toEqual([...lista].sort((a, b) => a - b));
  });

  it("formata a contagem de forma legível", () => {
    expect(rotuloEspera(5)).toBe("5s");
    expect(rotuloEspera(60)).toBe("1min");
    expect(rotuloEspera(90)).toBe("1min 30s");
    expect(rotuloEspera(300)).toBe("5min");
  });
});
