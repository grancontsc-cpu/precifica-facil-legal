import { describe, it, expect } from "vitest";
import { estadoExemplo } from "@/lib/pricing-defaults";
import { contextoParaPergunta } from "./contexto-pergunta";

describe("contexto enviado ao assistente", () => {
  it("leva os anos da Reforma com valores do motor arredondados a centavos", () => {
    const c = contextoParaPergunta(estadoExemplo())!;
    expect(c).not.toBeNull();
    expect(c.anos.map((a) => a.ano)).toContain("2033");
    for (const a of c.anos) {
      const v = a.mantendoPreco.lucroUnitario!;
      expect(Math.round(v * 100) / 100).toBe(v);
    }
  });
});
