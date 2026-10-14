import { describe, it, expect } from "vitest";
import { estadoExemplo } from "@/lib/pricing-defaults";
import { pendentes, premissasReforma } from "./revisao-premissas";

describe("revisão de premissas da Reforma", () => {
  it("Simples Nacional inclui a alíquota do DAS e o modelo", () => {
    const s = estadoExemplo();
    const simples = {
      ...s,
      operacao: { ...s.operacao!, regime: "simples" as const, aliquotaSimples: 6 },
    };
    const ids = premissasReforma(simples).map((p) => p.id);
    expect(ids).toContain("aliquotaSimples:6");
    expect(ids.some((i) => i.startsWith("modeloSimples:"))).toBe(true);
  });
  it("confirmar remove a pendência e mudar o valor a reabre", () => {
    const s = estadoExemplo();
    const simples = {
      ...s,
      operacao: { ...s.operacao!, regime: "simples" as const, aliquotaSimples: 6 },
    };
    const conf = { ...simples, premissasConfirmadas: premissasReforma(simples).map((p) => p.id) };
    expect(pendentes(conf)).toHaveLength(0);
    const mudou = { ...conf, operacao: { ...conf.operacao, aliquotaSimples: 7.5 } };
    expect(pendentes(mudou).map((p) => p.id)).toEqual(["aliquotaSimples:7.5"]);
  });
  it("lucro real não pede confirmação do Simples", () => {
    const s = estadoExemplo();
    const real = { ...s, operacao: { ...s.operacao!, regime: "real" as const } };
    expect(premissasReforma(real).some((p) => p.id.startsWith("aliquotaSimples"))).toBe(false);
  });
});
