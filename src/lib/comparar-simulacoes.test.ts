import { describe, it, expect } from "vitest";
import { estadoExemplo } from "@/lib/pricing-defaults";
import { simular } from "@/lib/pricing-engine";
import { linhasComparacao, type SimulacaoSalva } from "./comparar-simulacoes";

function sim(id: string, regime: "real" | "presumido"): SimulacaoSalva {
  const base = estadoExemplo();
  const state = { ...base, operacao: { ...base.operacao!, regime } };
  return { id, titulo: id, produto: "P", perfil: "manual", state, resultado: simular(state) };
}

describe("comparar simulações salvas", () => {
  it("usa os resultados gravados e marca o maior lucro", () => {
    const a = sim("a", "real");
    const b = sim("b", "real");
    b.resultado = {
      ...b.resultado,
      recomendado: { ...b.resultado.recomendado!, resultadoUnidade: 999 },
    };
    const lucro = linhasComparacao([a, b]).find((l) => l.rotulo === "Lucro por unidade")!;
    expect(lucro.valores[1]).toBe(999);
    expect(lucro.melhor).toBe(1);
  });
  it("não destaca quando os valores são iguais", () => {
    const linhas = linhasComparacao([sim("a", "real"), sim("b", "real")]);
    expect(linhas.find((l) => l.rotulo === "Custo líquido unitário")!.melhor).toBeNull();
    expect(linhas.find((l) => l.rotulo === "Regime")!.valores).toEqual([
      "Lucro Real",
      "Lucro Real",
    ]);
  });
});
