import { describe, expect, it } from "vitest";
import { estadoInicial, estadoExemplo } from "@/lib/pricing-defaults";
import { etapasPreenchimento } from "@/lib/progresso-simulacao";

describe("guia de preenchimento", () => {
  it("simulação nova só tem a margem padrão preenchida", () => {
    const feitas = etapasPreenchimento(estadoInicial()).filter((e) => e.feito).map((e) => e.id);
    expect(feitas).toEqual(["margem"]);
  });

  it("exemplo completo marca todas as etapas", () => {
    expect(etapasPreenchimento(estadoExemplo()).every((e) => e.feito)).toBe(true);
  });
});
